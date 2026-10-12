import { useEffect, useRef, useState } from 'react';
import { ApiError, getSessionUserId, isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import { getUsers } from '../../services/usersService';
import type { Role, UserSummary } from '../../types/domain';
import { ROLE_LABEL } from '../../utils/roleLabels';
import { ChevronRightIcon } from '../icons';
import { UserActivity } from './UserActivity';
import { UserFormModal } from './UserFormModal';
import '../../styles/dashboard.css';

interface UsersSectionProps {
  /** Para el botón de "volver a entrar" cuando la sesión venció. */
  onLogout: () => void;
}

const ROLES = Object.keys(ROLE_LABEL) as Role[];

/**
 * Sección "Usuarios" del admin (CAM-23, CAM-91): listado con búsqueda y filtro por rol, alta, y
 * edición en un modal (nombre, contraseña y desactivar; el rol no se cambia). Debajo, la
 * actividad de choferes y técnicos. /api/users exige el JWT de un ADMIN, así que si la sesión
 * venció se muestra el aviso en vez del contenido.
 */
export function UsersSection({ onLogout }: UsersSectionProps) {
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [formTarget, setFormTarget] = useState<'new' | UserSummary | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [showInactive, setShowInactive] = useState(false);
  // Cambia cuando se guarda un usuario: la actividad se vuelve a pedir (nombre o estado nuevos).
  const [activityKey, setActivityKey] = useState(0);
  const mountedRef = useRef(true);
  const currentUserId = getSessionUserId();

  function load() {
    getUsers()
      .then((data) => {
        if (!mountedRef.current) return;
        setUsers(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        if (isSessionExpired(err)) setSessionExpired(true);
        else setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de usuarios.');
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
    setActivityKey((key) => key + 1);
    load();
  }

  const inactiveCount = users?.filter((u) => !u.active).length ?? 0;
  const query = search.trim().toLocaleLowerCase('es');
  const visible = (users ?? [])
    .filter((u) => showInactive || u.active)
    .filter((u) => !roleFilter || u.role === roleFilter)
    .filter((u) => !query || u.username.toLocaleLowerCase('es').includes(query))
    // Los desactivados al final (lo habitual es buscar a alguien que sigue trabajando) y, dentro
    // de cada grupo, por nombre sin distinguir mayúsculas ni acentos.
    .sort((a, b) => Number(b.active) - Number(a.active) || a.username.localeCompare(b.username, 'es', { sensitivity: 'base' }));

  return (
    <section className="fleet-status vehicles-section users-section">
      <header className="fleet-status__header users-section__header">
        <h1 className="fleet-status__title">Usuarios</h1>
        {!sessionExpired && (
          <div className="vehicles-section__header-actions users-section__actions">
            <input
              type="search"
              className="work-orders__filter users-section__search"
              placeholder="Buscar por nombre"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar usuario por nombre"
            />
            <select
              className="work-orders__filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role | '')}
              aria-label="Rol"
            >
              <option value="">Todos los roles</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </select>
            {inactiveCount > 0 && (
              <label className="vehicles-section__toggle">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                Ver desactivados ({inactiveCount})
              </label>
            )}
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
          {users && visible.length === 0 && (
            <p className="muted">
              {users.length === 0 ? 'Todavía no hay usuarios.' : 'Ningún usuario coincide con la búsqueda.'}
            </p>
          )}

          {visible.length > 0 && (
            <div className="fleet-status__table-wrap">
              <table className="fleet-status__table users-section__table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th aria-hidden="true"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((u) => (
                    <tr
                      key={u.id}
                      className={`fleet-status__row${u.active ? '' : ' users-section__row--inactive'}`}
                      onClick={() => setFormTarget(u)}
                      title="Editar usuario"
                    >
                      <td>
                        {/* El nombre es el punto de entrada por teclado a la edición, como la patente en Vehículos. */}
                        <button
                          type="button"
                          className="vehicles-section__plate-link users-section__name"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormTarget(u);
                          }}
                        >
                          {u.username}
                        </button>
                        {u.id === currentUserId && <span className="muted users-section__self"> (vos)</span>}
                      </td>
                      <td>{ROLE_LABEL[u.role]}</td>
                      <td>
                        <span
                          className={`vehicles-section__status vehicles-section__status--${u.active ? 'active' : 'inactive'}`}
                        >
                          {u.active ? 'Activo' : 'Desactivado'}
                        </span>
                      </td>
                      <td>
                        <div className="vehicles-section__row-end">
                          <ChevronRightIcon width={16} height={16} className="vehicles-section__chevron" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {users && <UserActivity refreshKey={activityKey} onSessionExpired={() => setSessionExpired(true)} />}
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
