import { useState } from 'react';
import { describeApiError, saveUsername } from '../../services/apiClient';
import { createUser, updateUser } from '../../services/usersService';
import type { Role, UserSummary } from '../../types/domain';
import { CloseIcon, EyeIcon, EyeOffIcon, PowerIcon } from '../icons';
import { ROLE_LABEL } from '../../utils/roleLabels';
import '../../styles/dashboard.css';

// Mismos límites que valida el backend (UserService, CAM-23).
const USERNAME_MAX_LENGTH = 30;
const PASSWORD_MIN_LENGTH = 6;
// El tope de BCrypt son 72 bytes en UTF-8, no 72 caracteres: una letra con acento ocupa 2.
const PASSWORD_MAX_BYTES = 72;
const utf8 = new TextEncoder();

/** Misma forma canónica que usa el backend: sin espacios en los extremos ni repetidos. */
function normalizeUsername(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

interface UserFormModalProps {
  /** Si viene, edita ese usuario; si no, da de alta uno nuevo. */
  user?: UserSummary;
  /** El admin logueado edita su propio usuario: no puede desactivarse. */
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: UserSummary) => void;
}

/**
 * Alta y edición de un usuario (CAM-23, CAM-91) -- POST/PATCH /api/users[/{id}]. El rol se elige
 * en el alta y después no se cambia. En la edición se puede renombrar, resetear la contraseña
 * (opcional) y, más abajo, desactivar o reactivar.
 */
export function UserFormModal({ user, isSelf, onClose, onSaved }: UserFormModalProps) {
  const isEdit = Boolean(user);

  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>(user?.role ?? 'CHOFER');
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanUsername = normalizeUsername(username);
  const renamed = isEdit && cleanUsername !== user?.username;
  const passwordTooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const passwordTooLong = utf8.encode(password).length > PASSWORD_MAX_BYTES;
  const passwordInvalid = passwordTooShort || passwordTooLong;
  const canSubmit = isEdit
    ? Boolean(cleanUsername) && !passwordInvalid && (renamed || password.length > 0)
    : Boolean(cleanUsername) && password.length >= PASSWORD_MIN_LENGTH && !passwordTooLong;

  async function run(request: () => Promise<UserSummary>) {
    setSubmitting(true);
    setError(null);
    try {
      const saved = await request();
      // El saludo del admin sale del nombre guardado en el login: si se renombró a sí mismo, se actualiza.
      if (isSelf) saveUsername(saved.username);
      onSaved(saved);
    } catch (err) {
      setError(describeApiError(err, 'No se pudo guardar el usuario. Intentá de nuevo.'));
      setConfirmingDeactivate(false);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit() {
    void run(() =>
      isEdit && user
        ? updateUser(user.id, {
            ...(renamed ? { username: cleanUsername } : {}),
            ...(password ? { password } : {}),
          })
        : createUser({ username: cleanUsername, password, role }),
    );
  }

  function handleSetActive(active: boolean) {
    if (user) void run(() => updateUser(user.id, { active }));
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</h2>
            {isEdit && user && (
              <p className="user-form__subtitle">
                {ROLE_LABEL[user.role]}
                {!user.active && ' · Desactivado'}
              </p>
            )}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          <label className="schedule-picker__field">
            Nombre de usuario
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
              {renamed
                ? 'Va a entrar con el nombre nuevo. Su historial pasa a mostrarse con ese nombre.'
                : 'Es el nombre con el que entra y el que se ve en la app. Letras, números, espacios, punto, guion y guion bajo.'}
            </span>
          </label>

          {!isEdit && (
            <label className="schedule-picker__field">
              Rol
              <select className="schedule-picker__input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <span className="muted">Elegilo bien: después no se puede cambiar.</span>
            </label>
          )}

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

          {/* CAM-91: activar o desactivar vive acá, aparte de los datos, y pide confirmación. */}
          {isEdit && user && !isSelf && (
            <div className="user-form__status">
              {user.active ? (
                confirmingDeactivate ? (
                  <>
                    <p className="user-form__status-text">
                      ¿Desactivar a <strong>{user.username}</strong>? No va a poder iniciar sesión.
                    </p>
                    <div className="user-form__status-actions">
                      <button
                        type="button"
                        className="secondary-btn user-form__status-btn"
                        onClick={() => setConfirmingDeactivate(false)}
                        disabled={submitting}
                      >
                        No, volver
                      </button>
                      <button
                        type="button"
                        className="vehicle-maintenance-list__icon-btn vehicle-maintenance-list__icon-btn--warn user-form__status-btn"
                        onClick={() => handleSetActive(false)}
                        disabled={submitting}
                      >
                        <PowerIcon width={14} height={14} />
                        Sí, desactivar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="user-form__status-text">
                      Un usuario desactivado no puede iniciar sesión. Su historial se conserva.
                    </p>
                    <button
                      type="button"
                      className="vehicle-maintenance-list__icon-btn vehicle-maintenance-list__icon-btn--warn user-form__status-btn"
                      onClick={() => setConfirmingDeactivate(true)}
                      disabled={submitting}
                    >
                      <PowerIcon width={14} height={14} />
                      Desactivar usuario
                    </button>
                  </>
                )
              ) : (
                <>
                  <p className="user-form__status-text">Está desactivado: no puede iniciar sesión.</p>
                  <button
                    type="button"
                    className="vehicle-maintenance-list__icon-btn vehicle-maintenance-list__icon-btn--ok user-form__status-btn"
                    onClick={() => handleSetActive(true)}
                    disabled={submitting}
                  >
                    <PowerIcon width={14} height={14} />
                    Reactivar usuario
                  </button>
                </>
              )}
            </div>
          )}
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
