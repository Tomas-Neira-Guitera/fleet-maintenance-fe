import { useEffect, useRef, useState } from 'react';
import { ApiError, getSessionUserId, isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import { getUsers, updateUser } from '../../services/usersService';
import type { UserSummary } from '../../types/domain';
import { ROLE_LABEL } from '../../utils/roleLabels';
import { PowerIcon } from '../icons';
import { UserFormModal } from './UserFormModal';
import '../../styles/dashboard.css';

interface UsersSectionProps {
  /** Para el botón de "volver a entrar" cuando la sesión venció. */
  onLogout: () => void;
}

/**
 * Sección "Usuarios" del admin (CAM-23): listado con alta, edición (rol y contraseña) y
 * desactivar/reactivar. Mismo molde que MaintenancePlansSection. /api/users exige el JWT de un
 * ADMIN, así que si la sesión venció se muestra el aviso en vez del listado.
 */
export function UsersSection({ onLogout }: UsersSectionProps) {
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [formTarget, setFormTarget] = useState<'new' | UserSummary | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const currentUserId = getSessionUserId();

  function handleError(err: unknown, fallback: string) {
    if (isSessionExpired(err)) {
      setSessionExpired(true);
      return;
    }
    setError(err instanceof ApiError ? err.message : fallback);
  }

  function load() {
    getUsers()
      .then((data) => {
        if (!mountedRef.current) return;
        setUsers(data);
        // Un error de una acción anterior no tiene que quedar pegado sobre la lista ya recargada.
        setError(null);
      })
      .catch((err: unknown) => {
        if (mountedRef.current) handleError(err, 'No se pudo cargar la lista de usuarios.');
      });
  }

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSaved() {
    setFormTarget(null);
    load();
  }

  async function handleToggleActive(user: UserSummary) {
    if (user.active && !window.confirm(`¿Desactivar a "${user.username}"? No va a poder iniciar sesión.`)) return;
    setPendingId(user.id);
    setError(null);
    try {
      await updateUser(user.id, { active: !user.active });
      load();
    } catch (err) {
      handleError(err, 'No se pudo actualizar el usuario. Intentá de nuevo.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="fleet-status vehicles-section">
      <header className="fleet-status__header">
        <h1 className="fleet-status__title">Usuarios</h1>
        {!sessionExpired && (
          <div className="vehicles-section__header-actions">
            <button type="button" className="primary-btn vehicles-section__new-btn" onClick={() => setFormTarget('new')}>
              + Nuevo usuario
            </button>
          </div>
        )}
      </header>

      {sessionExpired ? (
        <div className="error-banner users-section__session">
          <p>{SESSION_EXPIRED_MESSAGE}</p>
          <button type="button" className="secondary-btn" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      ) : (
        <>
          {error && <p className="error-banner">{error}</p>}
          {!users && !error && <p className="muted">Cargando usuarios…</p>}
          {users && users.length === 0 && <p className="muted">Todavía no hay usuarios.</p>}

          {users && users.length > 0 && (
            <ul className="vehicle-maintenance-list">
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <li key={u.id} className="vehicle-maintenance-list__item">
                    <div className="vehicle-maintenance-list__info">
                      <div className="vehicle-maintenance-list__top-line">
                        <span className="vehicle-maintenance-list__name">
                          {u.username}
                          {isSelf && <span className="muted"> (vos)</span>}
                        </span>
                        <span
                          className={`vehicles-section__status vehicles-section__status--${u.active ? 'active' : 'inactive'}`}
                        >
                          {u.active ? 'Activo' : 'Desactivado'}
                        </span>
                      </div>
                      <p className="vehicle-maintenance-list__detail">{ROLE_LABEL[u.role]}</p>
                    </div>
                    <div className="vehicle-maintenance-list__actions">
                      <button
                        type="button"
                        className="secondary-btn vehicle-maintenance-list__schedule-btn"
                        onClick={() => setFormTarget(u)}
                        disabled={pendingId === u.id}
                      >
                        Editar
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          className={`vehicle-maintenance-list__icon-btn vehicle-maintenance-list__schedule-btn ${
                            u.active ? 'vehicle-maintenance-list__icon-btn--warn' : 'vehicle-maintenance-list__icon-btn--ok'
                          }`}
                          onClick={() => void handleToggleActive(u)}
                          disabled={pendingId === u.id}
                        >
                          <PowerIcon width={14} height={14} />
                          {u.active ? 'Desactivar' : 'Reactivar'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {formTarget && (
        <UserFormModal
          user={formTarget === 'new' ? undefined : formTarget}
          isSelf={formTarget !== 'new' && formTarget.id === currentUserId}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}
