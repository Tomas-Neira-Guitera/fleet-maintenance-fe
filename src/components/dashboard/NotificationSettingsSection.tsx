import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getNotificationSettings,
  resetNotificationSetting,
  saveNotificationSetting,
} from '../../services/notificationSettingsService';
import { getUsers } from '../../services/usersService';
import { describeApiError, isSessionExpired, SESSION_EXPIRED_MESSAGE } from '../../services/apiClient';
import type { NotificationChannel, NotificationSetting, Role, UserSummary } from '../../types/domain';
import { ROLE_LABEL } from '../../utils/roleLabels';
import { ChannelPicker } from './ChannelPicker';
import '../../styles/notifications.css';

const ROLES: Role[] = ['ADMIN', 'TECNICO', 'CHOFER'];
const ROLE_PLURAL: Record<Role, string> = { ADMIN: 'administradores', TECNICO: 'técnicos', CHOFER: 'choferes' };

interface Draft {
  enabled: boolean;
  channels: NotificationChannel[];
  recipientRoles: Role[];
  recipientUserIds: string[];
  leadDays: string;
  leadKm: string;
}

function toDraft(s: NotificationSetting): Draft {
  return {
    enabled: s.enabled,
    channels: s.channels,
    recipientRoles: s.recipientRoles,
    recipientUserIds: s.recipientUserIds,
    leadDays: s.leadDays?.toString() ?? '',
    leadKm: s.leadKm?.toString() ?? '',
  };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function isDirty(draft: Draft, s: NotificationSetting): boolean {
  const base = toDraft(s);
  return (
    draft.enabled !== base.enabled ||
    !sameSet(draft.channels, base.channels) ||
    !sameSet(draft.recipientRoles, base.recipientRoles) ||
    !sameSet(draft.recipientUserIds, base.recipientUserIds) ||
    draft.leadDays !== base.leadDays ||
    draft.leadKm !== base.leadKm
  );
}

/** Lo que le falta al borrador para poder guardarse; null si está bien (mismas reglas que el backend). */
function draftProblem(draft: Draft, s: NotificationSetting): string | null {
  if (!draft.enabled) return null;
  if (draft.channels.length === 0) return 'Elegí al menos un canal.';
  if (s.audience === 'configurable' && draft.recipientRoles.length === 0 && draft.recipientUserIds.length === 0) {
    return 'Elegí al menos un rol o un usuario.';
  }
  if (s.supportsLead) {
    const days = Number(draft.leadDays);
    const km = Number(draft.leadKm);
    if (!Number.isInteger(days) || days < 1 || days > 365) return 'Los días de anticipación van de 1 a 365.';
    if (!Number.isInteger(km) || km < 1 || km > 100000) return 'Los km de anticipación van de 1 a 100.000.';
  }
  return null;
}

/**
 * Configuración de avisos (CAM-117): por cada tipo, si está activo, por qué canales sale y, en los
 * avisos al admin, a quién. Los de técnico y chofer le llegan siempre a la persona involucrada.
 */
export function NotificationSettingsSection({ onLogout }: { onLogout: () => void }) {
  const [settings, setSettings] = useState<NotificationSetting[] | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
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
        else setError('No se pudo cargar la configuración de avisos. Intentá de nuevo.');
      });
    getUsers()
      .then((data) => {
        if (mountedRef.current) setUsers(data.filter((u) => u.active));
      })
      .catch(() => {
        // Sin la lista se puede configurar igual por rol.
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function replace(updated: NotificationSetting) {
    setSettings((prev) => prev?.map((s) => (s.type === updated.type ? updated : s)) ?? prev);
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

  const adminSettings = settings?.filter((s) => s.audience === 'configurable') ?? [];
  const ownerSettings = settings?.filter((s) => s.audience === 'owner') ?? [];

  return (
    <section className="fleet-status vehicles-section notif-settings">
      <header className="fleet-status__header notif-settings__header">
        <div>
          <h1 className="fleet-status__title">Notificaciones</h1>
          <p className="muted notif-settings__intro">
            Qué avisos se mandan, por qué canal y a quién. El email llega solo a quien lo tiene cargado en Usuarios.
          </p>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!settings && !error && <p className="muted">Cargando avisos…</p>}

      {settings && (
        <>
          <h2 className="notif-settings__group-title">Avisos al administrador</h2>
          <div className="notif-settings__list">
            {adminSettings.map((s) => (
              <NotificationSettingCard key={s.type} setting={s} users={users} onSaved={replace} />
            ))}
          </div>

          <h2 className="notif-settings__group-title">Avisos al técnico y al chofer</h2>
          <p className="muted notif-settings__group-hint">Le llegan siempre a la persona involucrada.</p>
          <div className="notif-settings__list">
            {ownerSettings.map((s) => (
              <NotificationSettingCard key={s.type} setting={s} users={users} onSaved={replace} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

interface CardProps {
  setting: NotificationSetting;
  users: UserSummary[];
  onSaved: (setting: NotificationSetting) => void;
}

function NotificationSettingCard({ setting, users, onSaved }: CardProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(setting));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  const dirty = isDirty(draft, setting);
  const problem = draftProblem(draft, setting);
  const configurable = setting.audience === 'configurable';
  const titleId = `notif-${setting.type}`;

  // Cuántos de los destinatarios elegidos tienen email, para avisar si el canal email no le llega a nadie.
  const emailCoverage = useMemo(() => {
    if (!configurable || !draft.channels.includes('email')) return null;
    const recipients = users.filter(
      (u) => draft.recipientRoles.includes(u.role) || draft.recipientUserIds.includes(u.id),
    );
    return { total: recipients.length, withEmail: recipients.filter((u) => u.email).length };
  }, [configurable, draft, users]);

  function update(changes: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...changes }));
    setSavedNote(false);
    setError(null);
  }

  async function run(request: () => Promise<NotificationSetting>) {
    setSaving(true);
    setError(null);
    try {
      const saved = await request();
      onSaved(saved);
      setDraft(toDraft(saved));
      setSavedNote(true);
    } catch (err) {
      setError(describeApiError(err, 'No se pudo guardar. Intentá de nuevo.'));
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    void run(() =>
      saveNotificationSetting(setting.type, {
        enabled: draft.enabled,
        channels: draft.channels,
        ...(configurable ? { recipientRoles: draft.recipientRoles, recipientUserIds: draft.recipientUserIds } : {}),
        ...(setting.supportsLead ? { leadDays: Number(draft.leadDays), leadKm: Number(draft.leadKm) } : {}),
      }),
    );
  }

  function toggleRole(role: Role) {
    update({
      recipientRoles: draft.recipientRoles.includes(role)
        ? draft.recipientRoles.filter((r) => r !== role)
        : [...draft.recipientRoles, role],
    });
  }

  function toggleUser(id: string) {
    update({
      recipientUserIds: draft.recipientUserIds.includes(id)
        ? draft.recipientUserIds.filter((u) => u !== id)
        : [...draft.recipientUserIds, id],
    });
  }

  return (
    <article className={`notif-card${draft.enabled ? '' : ' notif-card--off'}`} aria-labelledby={titleId}>
      <div className="notif-card__top">
        <div className="notif-card__text">
          <h3 id={titleId} className="notif-card__title">
            {setting.label}
            {setting.customized && <span className="notif-card__tag">Personalizado</span>}
          </h3>
          <p className="notif-card__description">{setting.description}</p>
          {!configurable && setting.recipientDescription && (
            <p className="notif-card__recipient">Le llega a: {setting.recipientDescription.toLowerCase()}</p>
          )}
        </div>
        <label className="notif-switch">
          <input
            type="checkbox"
            role="switch"
            checked={draft.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            aria-label={`${setting.label}: ${draft.enabled ? 'activo' : 'apagado'}`}
          />
          <span className="notif-switch__track" aria-hidden="true" />
        </label>
      </div>

      {draft.enabled && (
        <div className="notif-card__body">
          <div className="notif-card__row">
            <span className="notif-card__label">Canales</span>
            <ChannelPicker
              value={draft.channels}
              onChange={(channels) => update({ channels })}
              label={`Canales de ${setting.label}`}
            />
          </div>

          {configurable && (
            <div className="notif-card__row">
              <span className="notif-card__label">Destinatarios</span>
              <div className="notif-card__recipients">
                <div className="notif-chips" role="group" aria-label={`Roles que reciben ${setting.label}`}>
                  {ROLES.map((role) => (
                    <label
                      key={role}
                      className={`notif-chip${draft.recipientRoles.includes(role) ? ' notif-chip--on' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={draft.recipientRoles.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      Todos los {ROLE_PLURAL[role]}
                    </label>
                  ))}
                </div>
                {users.length > 0 && (
                  <details className="notif-card__users">
                    <summary>
                      Usuarios puntuales
                      {draft.recipientUserIds.length > 0 && ` (${draft.recipientUserIds.length})`}
                    </summary>
                    <ul>
                      {users
                        .filter((u) => !draft.recipientRoles.includes(u.role))
                        .map((u) => (
                          <li key={u.id}>
                            <label>
                              <input
                                type="checkbox"
                                checked={draft.recipientUserIds.includes(u.id)}
                                onChange={() => toggleUser(u.id)}
                              />
                              {u.username} <span className="muted">· {ROLE_LABEL[u.role]}</span>
                            </label>
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}

          {setting.supportsLead && (
            <div className="notif-card__row">
              <span className="notif-card__label">Anticipación</span>
              <div className="notif-card__lead">
                <label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    inputMode="numeric"
                    className="schedule-picker__input notif-card__number"
                    value={draft.leadDays}
                    onChange={(e) => update({ leadDays: e.target.value })}
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
                    value={draft.leadKm}
                    onChange={(e) => update({ leadKm: e.target.value })}
                  />
                  km antes
                </label>
                <span className="muted notif-card__hint">
                  Cada plan puede tener la suya desde Planes de mantenimiento. No cambia cuándo el dashboard marca
                  un plan como “por vencer”.
                </span>
              </div>
            </div>
          )}

          {emailCoverage && emailCoverage.withEmail < emailCoverage.total && (
            <p className="notif-card__warning">
              {emailCoverage.withEmail === 0
                ? 'Ningún destinatario tiene email cargado: por email no le va a llegar a nadie.'
                : `${emailCoverage.total - emailCoverage.withEmail} de ${emailCoverage.total} destinatarios no tienen email cargado.`}
            </p>
          )}
        </div>
      )}

      {(dirty || setting.customized || error || savedNote) && (
        <footer className="notif-card__footer">
          {error && <p className="field-error notif-card__error">{error}</p>}
          {!error && dirty && problem && <p className="field-error notif-card__error">{problem}</p>}
          {!dirty && savedNote && <span className="notif-card__saved">Guardado</span>}
          <div className="notif-card__actions">
            {setting.customized && !dirty && (
              <button
                type="button"
                className="notif-card__link-btn"
                onClick={() => void run(() => resetNotificationSetting(setting.type))}
                disabled={saving}
              >
                Volver a la configuración por defecto
              </button>
            )}
            {dirty && (
              <>
                <button type="button" className="notif-card__link-btn" onClick={() => update(toDraft(setting))} disabled={saving}>
                  Descartar cambios
                </button>
                <button
                  type="button"
                  className="primary-btn notif-card__save"
                  onClick={handleSave}
                  disabled={saving || problem !== null}
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </>
            )}
          </div>
        </footer>
      )}
    </article>
  );
}
