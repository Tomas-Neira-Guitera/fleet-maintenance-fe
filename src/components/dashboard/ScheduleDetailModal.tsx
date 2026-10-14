import { useId, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { updateSchedule } from '../../services/scheduleService';
import type { ScheduledMaintenance } from '../../types/domain';
import { toLocalDateKey } from '../../utils/localDate';
import { SCHEDULE_SOURCE_LABEL, scheduleDisplayStatus } from '../../utils/scheduleStatus';
import { TITLE_MAX_LENGTH } from '../../utils/textLimits';
import { CharCounter } from '../CharCounter';
import { DateTimePicker } from '../datetime/DateTimePicker';
import { CloseIcon } from '../icons';
import { ScheduleStatusBadge } from './ScheduleStatusBadge';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import '../../styles/dashboard.css';

const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

// Valor para el selector de fecha y hora, "2026-10-16T09:00", en hora local.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ScheduleDetailModalProps {
  schedule: ScheduledMaintenance;
  onClose: () => void;
  /** Después de editar o cancelar, para que el calendario vuelva a pedir la semana. */
  onChanged: () => void;
}

/**
 * Detalle de un mantenimiento del calendario semanal, con "Editar" (fecha y hora, notas y,
 * si es manual, título) y "Cancelar turno", que cancela la programación (baja lógica, CAM-42 decisión 9).
 * Desde CAM-65 el turno cancelado sigue en el calendario, tachado, por eso ya no se habla de "eliminar".
 */
export function ScheduleDetailModal({ schedule, onClose, onChanged }: ScheduleDetailModalProps) {
  const [current, setCurrent] = useState(schedule);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(schedule.title);
  const [when, setWhen] = useState(toLocalInput(schedule.scheduledAt));
  const [notes, setNotes] = useState(schedule.notes ?? '');
  const whenLabelId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manual = current.sourceType === 'manual';
  // Un turno hecho o cancelado queda en el calendario (CAM-65), pero ya no se edita ni se cancela.
  const closed = current.status !== 'scheduled';
  const canSave = Boolean(when) && (!manual || Boolean(title.trim()));

  function startEditing() {
    setTitle(current.title);
    setWhen(toLocalInput(current.scheduledAt));
    setNotes(current.notes ?? '');
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateSchedule(current.id, {
        scheduledAt: new Date(when).toISOString(),
        notes: notes.trim(),
        ...(manual ? { title: title.trim() } : {}),
      });
      setCurrent(updated);
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el cambio. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const otNote = current.workOrder ? '\nTambién se cancela su orden de trabajo si todavía no empezó.' : '';
    if (!window.confirm(`¿Cancelar "${current.title}"? Va a quedar en el calendario como cancelado.${otNote}`)) return;
    setBusy(true);
    setError(null);
    try {
      try {
        await updateSchedule(current.id, { status: 'cancelled' });
      } catch (err) {
        // CAM-77: con una OT en curso el backend pide confirmación explícita antes de cancelar las dos.
        if (!(err instanceof ApiError) || err.errorCode !== 'WORK_ORDER_IN_PROGRESS') throw err;
        if (!window.confirm(err.message)) {
          setBusy(false);
          return;
        }
        await updateSchedule(current.id, { status: 'cancelled', cancelWorkOrder: true });
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cancelar el turno. Intentá de nuevo.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{editing ? 'Editar mantenimiento' : current.title}</h2>
            {current.plate && <p className="modal__subtitle">{current.plate}</p>}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {editing ? (
            <>
              {manual && (
                <label className="schedule-picker__field">
                  Título
                  <input
                    type="text"
                    className="schedule-picker__input"
                    value={title}
                    maxLength={TITLE_MAX_LENGTH}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <CharCounter value={title} />
                </label>
              )}
              <div className="schedule-picker__field" role="group" aria-labelledby={whenLabelId}>
                <label id={whenLabelId} htmlFor={`${whenLabelId}-day`}>
                  Fecha y hora
                </label>
                <DateTimePicker
                  id={`${whenLabelId}-day`}
                  value={when}
                  onChange={setWhen}
                  min={toLocalDateKey(new Date())}
                  className="schedule-picker__input"
                />
              </div>
              <label className="schedule-picker__field">
                Notas (opcional)
                <textarea
                  className="schedule-picker__input schedule-picker__textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </label>
            </>
          ) : (
            <dl className="schedule-detail">
              <div>
                <dt>Fecha y hora</dt>
                <dd className="schedule-detail__date">{dateTimeFormatter.format(new Date(current.scheduledAt))}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <ScheduleStatusBadge status={scheduleDisplayStatus(current)} />
                </dd>
              </div>
              <div>
                <dt>Origen</dt>
                <dd>{SCHEDULE_SOURCE_LABEL[current.sourceType]}</dd>
              </div>
              <div>
                <dt>Notas</dt>
                <dd>{current.notes || <span className="muted">Sin notas</span>}</dd>
              </div>
              <div>
                <dt>Orden de trabajo</dt>
                <dd>
                  {current.workOrder ? (
                    <span className="schedule-detail__wo">
                      <WorkOrderStatusBadge status={current.workOrder.status} />
                      {current.workOrder.responsible ?? 'Sin responsable'}
                    </span>
                  ) : (
                    <span className="muted">Sin orden de trabajo</span>
                  )}
                </dd>
              </div>
            </dl>
          )}

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          {editing ? (
            <>
              <button type="button" className="secondary-btn" onClick={() => setEditing(false)} disabled={busy}>
                Cancelar
              </button>
              <button type="button" className="primary-btn" onClick={handleSave} disabled={busy || !canSave}>
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          ) : closed ? (
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cerrar
            </button>
          ) : (
            <>
              <button type="button" className="secondary-btn schedule-detail__delete" onClick={handleDelete} disabled={busy}>
                Cancelar turno
              </button>
              <button type="button" className="primary-btn" onClick={startEditing} disabled={busy}>
                Editar
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
