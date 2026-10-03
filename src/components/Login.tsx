import { useState } from 'react';
import type { FormEvent } from 'react';
import { login } from '../services/authService';
import { ApiError, saveSession, saveUsername } from '../services/apiClient';
import type { Role } from '../types/domain';
import { EyeIcon, EyeOffIcon } from './icons';

interface LoginProps {
  onLogin: (role: Role, username: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setShowPassword(false);
    setSubmitting(true);
    try {
      const result = await login(username, password);
      // CAM-23: el saludo usa el nombre en la misma forma en que lo guarda el backend
      // ("  José   Muñoz " → "José Muñoz"); en JS, \s ya incluye el espacio duro (NBSP).
      const displayName = username.normalize('NFC').replace(/\s+/g, ' ').trim();
      saveSession(result);
      saveUsername(displayName);
      onLogin(result.role, displayName);
    } catch (err) {
      // CAM-23: un usuario desactivado recibe un 403 con su propio mensaje; cualquier otro
      // rechazo se muestra igual que siempre, sin distinguir usuario inexistente de contraseña mala.
      setError(
        err instanceof ApiError && err.errorCode === 'USER_INACTIVE'
          ? err.message
          : 'Usuario o contraseña incorrectos.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen login-screen">
      <header className="screen__header">
        <h1 className="screen__title">FleetGuard</h1>
        <p className="screen__subtitle">Iniciá sesión para continuar</p>
      </header>

      <form className="login-form" onSubmit={handleSubmit}>
        <label className="login-field">
          <span className="defect-panel__field-label">Usuario</span>
          <input
            className="text-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        {/* Label con htmlFor (no envolviendo): si envolviera al ojito, su aria-label se sumaría al
            nombre del campo ("Contraseña Mostrar contraseña"). */}
        <div className="login-field">
          <label htmlFor="login-password" className="defect-panel__field-label">
            Contraseña
          </label>
          <div className="password-field">
            <input
              id="login-password"
              className="text-input password-field__input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {/* type="button" para que no envíe el formulario; el aria-label cambia con el estado. */}
            <button
              type="button"
              className="password-field__toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOffIcon width={20} height={20} /> : <EyeIcon width={20} height={20} />}
            </button>
          </div>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <div className="screen__actions">
          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </div>
      </form>
    </div>
  );
}
