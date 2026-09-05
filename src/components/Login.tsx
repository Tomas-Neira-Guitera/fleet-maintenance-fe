import { useState } from 'react';
import type { FormEvent } from 'react';
import { login } from '../services/authService';
import { saveSession, saveUsername } from '../services/apiClient';
import type { Role } from '../types/domain';

interface LoginProps {
  onLogin: (role: Role, username: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(username, password);
      saveSession(result);
      saveUsername(username);
      onLogin(result.role, username);
    } catch {
      setError('Usuario o contraseña incorrectos.');
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
        <label className="login-field">
          <span className="defect-panel__field-label">Contraseña</span>
          <input
            className="text-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

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
