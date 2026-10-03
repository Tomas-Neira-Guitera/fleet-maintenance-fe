import { useState } from 'react';
import { describeApiError } from '../../services/apiClient';
import { createUser, updateUser } from '../../services/usersService';
import type { Role, UserSummary } from '../../types/domain';
import { CloseIcon, EyeIcon, EyeOffIcon } from '../icons';
import { ROLE_LABEL } from '../../utils/roleLabels';
import '../../styles/dashboard.css';

// Mismos límites que valida el backend (UserService, CAM-23).
const USERNAME_MAX_LENGTH = 30;
const PASSWORD_MIN_LENGTH = 6;
// El tope de BCrypt son 72 bytes en UTF-8, no 72 caracteres: una letra con acento ocupa 2.
const PASSWORD_MAX_BYTES = 72;
const utf8 = new TextEncoder();

interface UserFormModalProps {
  /** Si viene, edita ese usuario; si no, da de alta uno nuevo. */
  user?: UserSummary;
  /** El admin logueado edita su propio usuario: no puede quitarse el rol ADMIN. */
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: UserSummary) => void;
}

/**
 * Alta y edición de un usuario (CAM-23) -- POST/PATCH /api/users[/{id}]. En la edición el
 * nombre de usuario no se cambia y la contraseña es opcional (solo para resetearla).
 * Activar o desactivar se hace desde el listado, no acá.
 */
export function UserFormModal({ user, isSelf, onClose, onSaved }: UserFormModalProps) {
  const isEdit = Boolean(user);

  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>(user?.role ?? 'CHOFER');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordTooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const passwordTooLong = utf8.encode(password).length > PASSWORD_MAX_BYTES;
  const passwordInvalid = passwordTooShort || passwordTooLong;
  const canSubmit = isEdit
    ? !passwordInvalid && (role !== user?.role || password.length > 0)
    : Boolean(username.trim()) && password.length >= PASSWORD_MIN_LENGTH && !passwordTooLong;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const saved =
        isEdit && user
          ? await updateUser(user.id, {
              ...(role !== user.role ? { role } : {}),
              ...(password ? { password } : {}),
            })
          : await createUser({ username: username.trim(), password, role });
      onSaved(saved);
    } catch (err) {
      setError(describeApiError(err, 'No se pudo guardar el usuario. Intentá de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <h2 className="modal__title">{isEdit ? `Editar ${user?.username}` : 'Nuevo usuario'}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {!isEdit && (
            <label className="schedule-picker__field">
              Usuario
              <input
                type="text"
                className="schedule-picker__input"
                value={username}
                maxLength={USERNAME_MAX_LENGTH}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: Juan Pérez"
                autoComplete="off"
              />
              <span className="muted">
                Es el nombre con el que entra y el que se ve en la app. Letras, números, espacios, punto, guion y guion bajo.
              </span>
            </label>
          )}

          <label className="schedule-picker__field">
            Rol
            <select
              className="schedule-picker__input"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={isSelf}
            >
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            {isSelf && <span className="muted">No podés quitarte el rol de administrador.</span>}
          </label>

          <div className="schedule-picker__field">
            <label htmlFor="user-form-password">{isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}</label>
            <div className="password-field">
              <input
                id="user-form-password"
                type={showPassword ? 'text' : 'password'}
                className="schedule-picker__input password-field__input"
                value={password}
                maxLength={PASSWORD_MAX_BYTES}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={isEdit ? 'Dejala vacía para no cambiarla' : undefined}
              />
              <button
                type="button"
                className="password-field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
              </button>
            </div>
            <span className={passwordInvalid ? 'field-error' : 'muted'}>
              {passwordTooLong
                ? 'Es demasiado larga: las letras con acento cuentan doble.'
                : `Al menos ${PASSWORD_MIN_LENGTH} caracteres.`}
            </span>
          </div>

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleSubmit} disabled={submitting || !canSubmit}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
