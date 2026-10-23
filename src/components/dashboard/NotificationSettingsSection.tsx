import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  getNotificationSettings,
  resetNotificationSetting,
  saveNotificationSetting,
} from '../../services/notificationSettingsService';
import { getUsers } from '../../services/usersService';
import { describeApiError, isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import type {
  NotificationChannel,
  NotificationSetting,
  NotificationSettingInput,
  NotificationType,
  Role,
  UserSummary,
} from '../../types/domain';
import { ROLE_LABEL } from '../../utils/roleLabels';
import {
  CHANNEL_HINT,
  CHANNEL_LABEL,
  NOTIFICATION_EXAMPLE,
  NOTIFICATION_TOPICS,
  type NotificationTopic,
} from '../../utils/notificationLabels';
import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  BellIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  TruckIcon,
  WrenchIcon,
} from '../icons';
import '../../styles/notifications.css';

const CHANNELS: NotificationChannel[] = ['in_app', 'push', 'email'];
const ROLES: Role[] = ['ADMIN', 'TECNICO', 'CHOFER'];
const ROLE_PLURAL: Record<Role, string> = { ADMIN: 'Administradores', TECNICO: 'Técnicos', CHOFER: 'Choferes' };
const TOPIC_ICON: Record<NotificationTopic, ReactNode> = {
  defects: <AlertOctagonIcon width={16} height={16} />,
  work_orders: <ClipboardListIcon width={16} height={16} />,
  maintenance: <WrenchIcon width={16} height={16} />,
  trips: <TruckIcon width={16} height={16} />,
};

/** Lo que el backend recibe para guardar un tipo: la configuración completa (PUT). */
function toInput(s: NotificationSetting): NotificationSettingInput {
  return {
    enabled: s.enabled,
    channels: s.channels,
    ...(s.audience === 'configurable' ? { recipientRoles: s.recipientRoles, recipientUserIds: s.recipientUserIds } : {}),
    ...(s.supportsLead ? { leadDays: s.leadDays, leadKm: s.leadKm } : {}),
  };
}

function recipientsOf(s: NotificationSetting, users: UserSummary[]): UserSummary[] {
  return users.filter((u) => s.recipientRoles.includes(u.role) || s.recipientUserIds.includes(u.id));
}

function recipientSummary(s: NotificationSetting): string {
  if (s.audience === 'owner') return s.recipientDescription ?? 'La persona involucrada';
  const parts = ROLES.filter((r) => s.recipientRoles.includes(r)).map((r) => ROLE_PLURAL[r]);
  const extra = s.recipientUserIds.length;
  if (extra > 0) parts.push(`${extra} ${extra === 1 ? 'usuario' : 'usuarios'}`);
  return parts.length > 0 ? parts.join(' + ') : 'Nadie';
}

/**
 * Configuración de avisos (CAM-117), en una matriz: un renglón por aviso con su interruptor y sus
 * canales. Cada cambio se guarda en el momento; los destinatarios, la anticipación y un ejemplo del
 * mensaje se abren en el detalle del renglón.
 */
export function NotificationSettingsSection({ onLogout, onGoToUsers }: { onLogout: () => void; onGoToUsers: () => void }) {
  const [settings, setSettings] = useState<NotificationSetting[] | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [expanded, setExpanded] = useState<Set<NotificationType>>(() => new Set());
  const [saving, setSaving] = useState<Set<NotificationType>>(() => new Set());
  const [rowErrors, setRowErrors] = useState<Partial<Record<NotificationType, string>>>({});
  const [status, setStatus] = useState<string | null>(null);
  const statusTimer = useRef<number | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    getNotificationSettings()
      .then((data) => {
        if (mountedRef.current) setSettings(data);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        if (isSessionExpired(err)) setSessionExpired(true);
        else setLoadError('No se pudo cargar la configuración de avisos. Intentá de nuevo.');
      });
    getUsers()
      .then((data) => {
        if (mountedRef.current) setUsers(data.filter((u) => u.active));
      })
      .catch(() => {
        // Sin la lista se configura igual por rol; solo no se pueden elegir usuarios puntuales.
      });
    return () => {
      mountedRef.current = false;
      window.clearTimeout(statusTimer.current);
    };
  }, []);

  function replace(updated: NotificationSetting) {
    setSettings((prev) => prev?.map((s) => (s.type === updated.type ? updated : s)) ?? prev);
  }

  function setFlag(set: typeof setSaving, type: NotificationType, on: boolean) {
    set((prev) => {
      const next = new Set(prev);
      if (on) next.add(type);
      else next.delete(type);
      return next;
    });
  }

  function flash(message: string) {
    setStatus(message);
    window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(null), 2500);
  }

  /** Guarda en el momento; si el backend no lo acepta, el renglón vuelve a como estaba. */
  async function persist(previous: NotificationSetting, request: () => Promise<NotificationSetting>, optimistic?: NotificationSetting) {
    if (optimistic) replace(optimistic);
    setFlag(setSaving, previous.type, true);
    setRowErrors((e) => ({ ...e, [previous.type]: undefined }));
    try {
      const saved = await request();
      if (!mountedRef.current) return;
      replace(saved);
      flash(`Guardado: ${saved.label}`);
    } catch (err) {
      if (!mountedRef.current) return;
      replace(previous);
      if (isSessionExpired(err)) setSessionExpired(true);
      setRowErrors((e) => ({ ...e, [previous.type]: describeApiError(err, 'No se pudo guardar. Intentá de nuevo.') }));
    } finally {
      if (mountedRef.current) setFlag(setSaving, previous.type, false);
    }
  }

  function update(previous: NotificationSetting, changes: Partial<NotificationSetting>) {
    const next = { ...previous, ...changes };
    void persist(previous, () => saveNotificationSetting(previous.type, toInput(next)), next);
  }

  function reset(previous: NotificationSetting) {
    void persist(previous, () => resetNotificationSetting(previous.type));
  }

  function toggleExpanded(type: NotificationType) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  if (sessionExpired) {
    return (
      <section className="fleet-status vehicles-section">
        <div className="error-banner users-section__session">
          <p>{SESSION_EXPIRED_MESSAGE}</p>
          <button type="button" className="secondary-btn" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </section>
    );
  }

  const byType = new Map(settings?.map((s) => [s.type, s]) ?? []);

  return (
    <section className="fleet-status vehicles-section notif-settings">
      <header className="fleet-status__header notif-settings__header">
        <div>
          <h1 className="fleet-status__title">
            <BellIcon width={24} height={24} aria-hidden="true" />
            Notificaciones
          </h1>
          <p className="muted notif-settings__intro">
            Qué avisos se mandan, por dónde y a quién. Los cambios se guardan solos.
          </p>
        </div>
        <p className={`notif-settings__status${status ? ' notif-settings__status--on' : ''}`} role="status" aria-live="polite">
          {status}
        </p>
      </header>

      {loadError && <p className="error-banner">{loadError}</p>}
      {!settings && !loadError && <p className="muted">Cargando avisos…</p>}

      {settings && (
        <div className="notif-matrix-wrap">
          <table className="notif-matrix">
            <thead>
              <tr>
                <th scope="col" className="notif-matrix__aviso">Aviso</th>
                <th scope="col" className="notif-matrix__center">Activo</th>
                {CHANNELS.map((c) => (
                  <th key={c} scope="col" className="notif-matrix__center">
                    <span className="notif-matrix__channel-head" title={CHANNEL_HINT[c]}>
                      {CHANNEL_LABEL[c]}
                      {c === 'push' && <span className="notif-matrix__channel-sub">navegador</span>}
                    </span>
                  </th>
                ))}
                <th scope="col">Le llega a</th>
                <th scope="col">
                  <span className="visually-hidden">Detalle</span>
                </th>
              </tr>
            </thead>
            {NOTIFICATION_TOPICS.map((topic) => {
              const rows = topic.types.map((t) => byType.get(t)).filter((s): s is NotificationSetting => Boolean(s));
              if (rows.length === 0) return null;
              return (
                <tbody key={topic.id}>
                  <tr className="notif-matrix__topic">
                    <th scope="colgroup" colSpan={7}>
                      <span className="notif-matrix__topic-label">
                        {TOPIC_ICON[topic.id]}
                        {topic.label}
                      </span>
                    </th>
                  </tr>
                  {rows.map((s) => (
                    <SettingRows
                      key={s.type}
                      setting={s}
                      users={users}
                      expanded={expanded.has(s.type)}
                      saving={saving.has(s.type)}
                      error={rowErrors[s.type]}
                      onToggleExpanded={() => toggleExpanded(s.type)}
                      onUpdate={(changes) => update(s, changes)}
                      onReset={() => reset(s)}
                      onGoToUsers={onGoToUsers}
                    />
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </section>
  );
}

interface SettingRowsProps {
  setting: NotificationSetting;
  users: UserSummary[];
  expanded: boolean;
  saving: boolean;
  error?: string;
  onToggleExpanded: () => void;
  onUpdate: (changes: Partial<NotificationSetting>) => void;
  onReset: () => void;
  onGoToUsers: () => void;
}

function SettingRows({ setting: s, users, expanded, saving, error, onToggleExpanded, onUpdate, onReset, onGoToUsers }: SettingRowsProps) {
  const detailId = `notif-detail-${s.type}`;
  const configurable = s.audience === 'configurable';
  const withoutEmail =
    configurable && s.channels.includes('email') ? recipientsOf(s, users).filter((u) => !u.email) : [];

  function toggleChannel(channel: NotificationChannel) {
    const channels = s.channels.includes(channel) ? s.channels.filter((c) => c !== channel) : [...s.channels, channel];
    onUpdate({ channels: CHANNELS.filter((c) => channels.includes(c)) });
  }

  return (
    <Fragment>
      <tr className={`notif-matrix__row${s.enabled ? '' : ' notif-matrix__row--off'}${expanded ? ' notif-matrix__row--open' : ''}`}>
        <th scope="row" className="notif-matrix__aviso">
          <button
            type="button"
            className="notif-matrix__name"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            aria-controls={detailId}
          >
            {s.label}
            {s.customized && <span className="notif-matrix__tag">Personalizado</span>}
          </button>
          <span className="notif-matrix__description">{s.description}</span>
        </th>
        <td className="notif-matrix__center" data-label="Activo">
          <label className="notif-switch">
            <input
              type="checkbox"
              role="switch"
              checked={s.enabled}
              disabled={saving}
              onChange={(e) => onUpdate({ enabled: e.target.checked })}
              aria-label={`${s.label}: ${s.enabled ? 'activo' : 'apagado'}`}
            />
            <span className="notif-switch__track" aria-hidden="true" />
          </label>
        </td>
        {CHANNELS.map((c) => {
          const on = s.channels.includes(c);
          // Activo, tiene que quedar al menos un canal: para no recibirlo, se apaga el aviso.
          const last = s.enabled && on && s.channels.length === 1;
          return (
            <td key={c} className="notif-matrix__center" data-label={CHANNEL_LABEL[c]}>
              <input
                type="checkbox"
                className="notif-matrix__check"
                checked={on}
                disabled={!s.enabled || saving || last}
                onChange={() => toggleChannel(c)}
                aria-label={`${CHANNEL_LABEL[c]} para ${s.label}`}
                title={last ? 'Tiene que quedar al menos un canal. Para no recibirlo, apagá el aviso.' : CHANNEL_HINT[c]}
              />
            </td>
          );
        })}
        <td className="notif-matrix__recipients" data-label="Le llega a">
          <span>{recipientSummary(s)}</span>
          {s.enabled && withoutEmail.length > 0 && (
            <button type="button" className="notif-matrix__warn" onClick={onToggleExpanded} aria-controls={detailId}>
              <AlertTriangleIcon width={13} height={13} aria-hidden="true" />
              {withoutEmail.length} sin email
            </button>
          )}
        </td>
        <td className="notif-matrix__expand">
          <button
            type="button"
            className="notif-matrix__chevron"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            aria-controls={detailId}
            aria-label={`${expanded ? 'Cerrar' : 'Abrir'} el detalle de ${s.label}`}
          >
            <ChevronRightIcon width={16} height={16} aria-hidden="true" />
          </button>
        </td>
      </tr>
      {error && (
        <tr className="notif-matrix__error-row">
          <td colSpan={7}>
            <p className="field-error" role="alert">
              {error}
            </p>
          </td>
        </tr>
      )}
      {expanded && (
        <tr className="notif-matrix__detail-row" id={detailId}>
          <td colSpan={7}>
            <SettingDetail
              key={`${s.leadDays}-${s.leadKm}`}
              setting={s}
              users={users}
              saving={saving}
              withoutEmail={withoutEmail}
              onUpdate={onUpdate}
              onReset={onReset}
              onGoToUsers={onGoToUsers}
            />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

interface SettingDetailProps {
  setting: NotificationSetting;
  users: UserSummary[];
  saving: boolean;
  withoutEmail: UserSummary[];
  onUpdate: (changes: Partial<NotificationSetting>) => void;
  onReset: () => void;
  onGoToUsers: () => void;
}

function SettingDetail({ setting: s, users, saving, withoutEmail, onUpdate, onReset, onGoToUsers }: SettingDetailProps) {
  const example = NOTIFICATION_EXAMPLE[s.type];
  const configurable = s.audience === 'configurable';
  const recipientCount = s.recipientRoles.length + s.recipientUserIds.length;
  const [leadDays, setLeadDays] = useState(s.leadDays?.toString() ?? '');
  const [leadKm, setLeadKm] = useState(s.leadKm?.toString() ?? '');

  const leadDirty = leadDays !== (s.leadDays?.toString() ?? '') || leadKm !== (s.leadKm?.toString() ?? '');
  const days = Number(leadDays);
  const km = Number(leadKm);
  const leadProblem =
    !Number.isInteger(days) || days < 1 || days > 365
      ? 'Los días van de 1 a 365.'
      : !Number.isInteger(km) || km < 1 || km > 100000
        ? 'Los km van de 1 a 100.000.'
        : null;

  function toggleRole(role: Role) {
    onUpdate({
      recipientRoles: s.recipientRoles.includes(role) ? s.recipientRoles.filter((r) => r !== role) : [...s.recipientRoles, role],
    });
  }

  function toggleUser(id: string) {
    onUpdate({
      recipientUserIds: s.recipientUserIds.includes(id)
        ? s.recipientUserIds.filter((u) => u !== id)
        : [...s.recipientUserIds, id],
    });
  }

  // Activo, tiene que quedar al menos un destinatario: el último no se puede sacar.
  const lockLast = s.enabled && recipientCount === 1;

  return (
    <div className="notif-detail">
      <div className="notif-detail__main">
        {configurable ? (
          <div className="notif-detail__block">
            <h3 className="notif-detail__title">Le llega a</h3>
            <div className="notif-chips" role="group" aria-label={`Roles que reciben ${s.label}`}>
              {ROLES.map((role) => {
                const on = s.recipientRoles.includes(role);
                return (
                  <label key={role} className={`notif-chip${on ? ' notif-chip--on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={saving || (on && lockLast)}
                      onChange={() => toggleRole(role)}
                    />
                    Todos los {ROLE_PLURAL[role].toLowerCase()}
                  </label>
                );
              })}
            </div>
            {lockLast && (
              <p className="notif-detail__lock">Tiene que quedar al menos un destinatario. Para no mandarlo, apagá el aviso.</p>
            )}
            {users.length > 0 && (
              <details className="notif-detail__users" open={s.recipientUserIds.length > 0}>
                <summary>
                  Usuarios puntuales{s.recipientUserIds.length > 0 && ` (${s.recipientUserIds.length})`}
                </summary>
                <ul>
                  {users
                    .filter((u) => !s.recipientRoles.includes(u.role))
                    .map((u) => {
                      const on = s.recipientUserIds.includes(u.id);
                      return (
                        <li key={u.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={saving || (on && lockLast)}
                              onChange={() => toggleUser(u.id)}
                            />
                            {u.username} <span className="muted">· {ROLE_LABEL[u.role]}</span>
                          </label>
                        </li>
                      );
                    })}
                </ul>
              </details>
            )}
          </div>
        ) : (
          <div className="notif-detail__block">
            <h3 className="notif-detail__title">Le llega a</h3>
            <p className="notif-detail__text">
              {s.recipientDescription}. Siempre a la persona involucrada; no se eligen destinatarios.
            </p>
          </div>
        )}

        {s.supportsLead && (
          <div className="notif-detail__block">
            <h3 className="notif-detail__title">Anticipación</h3>
            <div className="notif-card__lead">
              <label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  inputMode="numeric"
                  className="schedule-picker__input notif-card__number"
                  value={leadDays}
                  onChange={(e) => setLeadDays(e.target.value)}
                />
                días antes
              </label>
              <label>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  inputMode="numeric"
                  className="schedule-picker__input notif-card__number"
                  value={leadKm}
                  onChange={(e) => setLeadKm(e.target.value)}
                />
                km antes
              </label>
              {leadDirty && (
                <button
                  type="button"
                  className="primary-btn notif-detail__save"
                  disabled={saving || leadProblem !== null}
                  onClick={() => onUpdate({ leadDays: days, leadKm: km })}
                >
                  Guardar anticipación
                </button>
              )}
            </div>
            {leadDirty && leadProblem && <p className="field-error">{leadProblem}</p>}
            <p className="muted notif-detail__hint">
              Cada plan puede tener la suya desde Planes de mantenimiento. No cambia cuándo el dashboard marca un plan como
              “por vencer”.
            </p>
          </div>
        )}

        {withoutEmail.length > 0 && (
          <div className="notif-detail__email-warning">
            <AlertTriangleIcon width={16} height={16} aria-hidden="true" />
            <p>
              Sin email cargado, no lo reciben por email: <strong>{withoutEmail.map((u) => u.username).join(', ')}</strong>.{' '}
              <button type="button" className="notif-detail__link" onClick={onGoToUsers}>
                Cargar emails en Usuarios
              </button>
            </p>
          </div>
        )}

        {s.customized && (
          <button type="button" className="notif-detail__link notif-detail__reset" onClick={onReset} disabled={saving}>
            Volver a la configuración por defecto
          </button>
        )}
      </div>

      <figure className="notif-detail__example">
        <figcaption>Así se ve</figcaption>
        <div className="notif-preview">
          <span className="notif-preview__title">{example.title}</span>
          <span className="notif-preview__message">{example.message}</span>
          <span className="notif-preview__time">hace 2 min</span>
        </div>
      </figure>
    </div>
  );
}
