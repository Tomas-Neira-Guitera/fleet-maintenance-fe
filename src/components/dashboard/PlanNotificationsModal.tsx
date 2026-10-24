import { useEffect, useState } from 'react';
import {
  getPlanNotificationSettings,
  resetPlanNotificationSettings,
  savePlanNotificationSettings,
} from '../../services/notificationSettingsService';
import { describeApiError } from '../../services/apiClient';
import type { MaintenancePlan, NotificationChannel, PlanNotificationSettings } from '../../types/domain';
import { numberFormatter } from '../../utils/maintenanceFormat';
import { CloseIcon } from '../icons';
import { CHANNEL_LABEL } from '../../utils/notificationLabels';
import { ChannelPicker } from './ChannelPicker';
import '../../styles/notifications.css';

interface PlanNotificationsModalProps {
  plan: MaintenancePlan;
  onClose: () => void;
}

/**
 * Avisos de vencimiento de un plan (CAM-118): usa la configuración general o una propia, con su
 * anticipación y sus canales. Los destinatarios son siempre los de Notificaciones.
 */
export function PlanNotificationsModal({ plan, onClose }: PlanNotificationsModalProps) {
  const [data, setData] = useState<PlanNotificationSettings | null>(null);
  const [custom, setCustom] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [leadDays, setLeadDays] = useState('');
  const [leadKm, setLeadKm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const byTime = plan.intervalType !== 'km';
  const byKm = plan.intervalType !== 'time';

  function fill(settings: PlanNotificationSettings) {
    setData(settings);
    setCustom(settings.custom);
    setEnabled(settings.custom ? Boolean(settings.enabled) : true);
    setChannels(settings.custom ? (settings.channels ?? []) : settings.general.channels);
    setLeadDays(String((settings.custom ? settings.leadDays : settings.general.leadDays) ?? ''));
    setLeadKm(String((settings.custom ? settings.leadKm : settings.general.leadKm) ?? ''));
  }

  useEffect(() => {
    let active = true;
    getPlanNotificationSettings(plan.id)
      .then((settings) => {
        if (active) fill(settings);
      })
      .catch((err: unknown) => {
        if (active) setError(describeApiError(err, 'No se pudieron cargar los avisos del plan.'));
      });
    return () => {
      active = false;
    };
  }, [plan.id]);

  const days = Number(leadDays);
  const km = Number(leadKm);
  const problem = !custom || !enabled
    ? null
    : channels.length === 0
      ? 'Elegí al menos un canal.'
      : byTime && (!Number.isInteger(days) || days < 1 || days > 365)
        ? 'Los días de anticipación van de 1 a 365.'
        : byKm && (!Number.isInteger(km) || km < 1 || km > 100000)
          ? 'Los km de anticipación van de 1 a 100.000.'
          : null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (custom) {
        await savePlanNotificationSettings(plan.id, {
          enabled,
          channels,
          leadDays: byTime ? days : null,
          leadKm: byKm ? km : null,
        });
      } else if (data?.custom) {
        await resetPlanNotificationSettings(plan.id);
      }
      onClose();
    } catch (err) {
      setError(describeApiError(err, 'No se pudieron guardar los avisos del plan. Intentá de nuevo.'));
      setSaving(false);
    }
  }

  const general = data?.general;
  const generalLead = general
    ? [
        byTime && general.leadDays != null ? `${general.leadDays} días antes` : null,
        byKm && general.leadKm != null ? `${numberFormatter.format(general.leadKm)} km antes` : null,
      ]
        .filter(Boolean)
        .join(' o ')
    : '';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="plan-notif-title">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <div>
            <h2 id="plan-notif-title" className="modal__title">
              Avisos de vencimiento
            </h2>
            <p className="user-form__subtitle">{plan.name}</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {!data && !error && <p className="muted">Cargando…</p>}
          {data && general && (
            <>
              <p className="muted">
                Se avisa una vez cuando el plan entra en la anticipación y otra cuando vence, en cada vehículo que lo
                tiene asignado.
              </p>

              <fieldset className="plan-notif__options">
                <legend className="visually-hidden">Configuración</legend>
                <label className={`plan-notif__option${!custom ? ' plan-notif__option--on' : ''}`}>
                  <input type="radio" name="plan-notif-mode" checked={!custom} onChange={() => setCustom(false)} />
                  <span>
                    <strong>Usar la configuración general</strong>
                    <span className="muted plan-notif__summary">
                      {general.dueSoonEnabled || general.overdueEnabled
                        ? `${generalLead || 'Al vencer'} · ${general.channels.map((c) => CHANNEL_LABEL[c]).join(', ')}`
                        : 'Hoy los avisos de vencimiento están apagados en Notificaciones.'}
                    </span>
                  </span>
                </label>
                <label className={`plan-notif__option${custom ? ' plan-notif__option--on' : ''}`}>
                  <input type="radio" name="plan-notif-mode" checked={custom} onChange={() => setCustom(true)} />
                  <span>
                    <strong>Configuración propia para este plan</strong>
                    <span className="muted plan-notif__summary">Otra anticipación u otros canales.</span>
                  </span>
                </label>
              </fieldset>

              {custom && (
                <div className="plan-notif__custom">
                  <label className="plan-notif__toggle">
                    <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                    Avisar los vencimientos de este plan
                  </label>
                  {enabled && (
                    <>
                      <div className="schedule-picker__field">
                        Anticipación
                        <div className="notif-card__lead">
                          {byTime && (
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
                          )}
                          {byKm && (
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
                          )}
                        </div>
                      </div>
                      <div className="schedule-picker__field">
                        Canales
                        <ChannelPicker value={channels} onChange={setChannels} label={`Canales de ${plan.name}`} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {problem && <p className="field-error">{problem}</p>}
          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void handleSave()}
            disabled={saving || !data || problem !== null}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
