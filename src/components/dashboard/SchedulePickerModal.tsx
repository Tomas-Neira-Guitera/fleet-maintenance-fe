import { useEffect, useState } from 'react';
import { createSchedule, getSchedule } from '../../services/scheduleService';
import { getVehicles } from '../../services/vehiclesService';
import { createWorkOrder } from '../../services/workOrdersService';
import type { ScheduledMaintenance, ScheduleSourceType, Vehicle, WorkOrderExecutionType } from '../../types/domain';
import { ApiError } from '../../services/apiClient';
import { CloseIcon } from '../icons';
import { WorkOrderResponsibleField } from './WorkOrderResponsibleField';
import '../../styles/dashboard.css';

interface SchedulePickerModalSourceProps {
  mode?: 'source';
  sourceType: Exclude<ScheduleSourceType, 'manual'>;
  sourceId: string;
  title: string;
  initialDate?: Date;
  onClose: () => void;
  onScheduled: (schedule: ScheduledMaintenance) => void;
}

interface SchedulePickerModalManualProps {
  mode: 'manual';
  initialDate?: Date;
  onClose: () => void;
  onScheduled: (schedule: ScheduledMaintenance) => void;
}

type SchedulePickerModalProps = SchedulePickerModalSourceProps | SchedulePickerModalManualProps;

const previewTimeFormatter = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

/** Sugiere mañana 09:00 hora local como punto de partida -- el usuario lo ajusta si hace falta. */
function defaultSuggestion(initialDate?: Date): string {
  const d = initialDate ? new Date(initialDate) : new Date();
  if (!initialDate) d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Modal compartido para "planificar" un mantenimiento (CAM-50, origen assignment), el
 * arreglo de un defecto (CAM-51, origen defect), o una programación suelta desde el
 * calendario (origen manual, sin plan ni defecto) -- mismo endpoint genérico de
 * creación, ver CAM-42-programacion-mantenimientos.md.
 *
 * Desde CAM-14, planificar también genera la orden de trabajo asociada en el mismo
 * paso (dos llamadas encadenadas: primero la programación, después la OT con
 * sourceType 'scheduled_maintenance' sobre lo recién creado) -- ver
 * claude/CAM-14-ordenes-de-trabajo.md, sección "Planificar genera la OT". Tipo de
 * ejecución y responsable son opcionales acá (se pueden completar después en el
 * detalle de la OT); si no se toca nada, la OT nace "interno" por default. Si la
 * programación se crea pero la OT falla, no se reintenta la programación -- solo la OT.
 */
export function SchedulePickerModal(props: SchedulePickerModalProps) {
  const manual = props.mode === 'manual';
  const [value, setValue] = useState(defaultSuggestion(props.initialDate));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [manualVehicleId, setManualVehicleId] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [notes, setNotes] = useState('');

  const [executionType, setExecutionType] = useState<WorkOrderExecutionType>('interno');
  const [externalProvider, setExternalProvider] = useState('');
  const [assignee, setAssignee] = useState('');
  const [technicianId, setTechnicianId] = useState('');

  /** Si la programación ya se creó pero la OT falló, guardamos acá para no duplicarla en un reintento. */
  const [createdSchedule, setCreatedSchedule] = useState<ScheduledMaintenance | null>(null);

  useEffect(() => {
    if (!manual) return;
    let cancelled = false;
    getVehicles()
      .then((data) => {
        if (!cancelled) setVehicles(data);
      })
      .catch(() => {
        if (!cancelled) setVehicles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [manual]);

  const [preview, setPreview] = useState<ScheduledMaintenance[] | null>(null);

  // Preview de "qué otra cosa hay planificada para este día" -- no filtra por vehículo:
  // lo que importa es la capacidad del taller ese día, no si es el mismo vehículo.
  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    const day = new Date(value);
    if (Number.isNaN(day.getTime())) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const from = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    getSchedule({ from: toIsoDate(from), to: toIsoDate(to) })
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const visiblePreview = preview ?? [];

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      let schedule = createdSchedule;
      if (!schedule) {
        const scheduledAt = new Date(value).toISOString();
        schedule =
          props.mode === 'manual'
            ? await createSchedule({
                sourceType: 'manual',
                vehicleId: manualVehicleId,
                title: manualTitle.trim(),
                scheduledAt,
                notes: notes.trim() || undefined,
              })
            : await createSchedule({
                sourceType: props.sourceType,
                sourceId: props.sourceId,
                scheduledAt,
                notes: notes.trim() || undefined,
              });
        setCreatedSchedule(schedule);
      }

      await createWorkOrder({
        sourceType: 'scheduled_maintenance',
        sourceId: schedule.id,
        executionType,
        externalProvider: executionType === 'externo' ? externalProvider.trim() : undefined,
        assignee: executionType === 'externo' ? assignee.trim() || undefined : undefined,
        technicianId: executionType === 'interno' ? technicianId || undefined : undefined,
        description: notes.trim() || undefined,
      });

      props.onScheduled(schedule);
    } catch (err) {
      setError(
        createdSchedule
          ? 'Se guardó la programación, pero no se pudo generar la orden de trabajo. Volvé a confirmar para reintentarlo.'
          : err instanceof ApiError
            ? err.message
            : 'No se pudo programar. Intentá de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const externalOk = executionType === 'interno' || externalProvider.trim().length > 0;
  const canConfirm = (manual ? Boolean(manualVehicleId && manualTitle.trim() && value) : Boolean(value)) && externalOk;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <h2 className="modal__title">Planificar</h2>
          <button type="button" className="modal__close" onClick={props.onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {props.mode !== 'manual' && <p className="schedule-picker__subject">{props.title}</p>}

          {manual && (
            <>
              <label className="schedule-picker__field">
                Vehículo
                <select
                  className="schedule-picker__input"
                  value={manualVehicleId}
                  onChange={(e) => setManualVehicleId(e.target.value)}
                  disabled={!vehicles || Boolean(createdSchedule)}
                >
                  <option value="">{vehicles ? 'Elegí un vehículo' : 'Cargando…'}</option>
                  {vehicles?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} · {v.brand} {v.model}
                    </option>
                  ))}
                </select>
              </label>
              <label className="schedule-picker__field">
                Descripción
                <input
                  type="text"
                  className="schedule-picker__input"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Ej: Revisión de frenos"
                  disabled={Boolean(createdSchedule)}
                />
              </label>
            </>
          )}

          <label className="schedule-picker__field">
            Fecha y hora
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="schedule-picker__input"
              disabled={Boolean(createdSchedule)}
            />
          </label>

          <label className="schedule-picker__field">
            Notas (opcional)
            <textarea
              className="schedule-picker__input schedule-picker__textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={Boolean(createdSchedule)}
            />
          </label>

          <div className="schedule-picker__field">
            Orden de trabajo (opcional, se puede completar después)
            <div className="wo-execution-toggle">
              <button
                type="button"
                className={`wo-execution-toggle__btn${executionType === 'interno' ? ' wo-execution-toggle__btn--active' : ''}`}
                onClick={() => setExecutionType('interno')}
                aria-pressed={executionType === 'interno'}
              >
                Personal propio
              </button>
              <button
                type="button"
                className={`wo-execution-toggle__btn${executionType === 'externo' ? ' wo-execution-toggle__btn--active' : ''}`}
                onClick={() => setExecutionType('externo')}
                aria-pressed={executionType === 'externo'}
              >
                Taller externo
              </button>
            </div>
          </div>

          {executionType === 'externo' && (
            <label className="schedule-picker__field">
              Proveedor / taller
              <input
                type="text"
                className="schedule-picker__input"
                value={externalProvider}
                onChange={(e) => setExternalProvider(e.target.value)}
                placeholder="Ej: Taller Norte SRL"
              />
            </label>
          )}

          <WorkOrderResponsibleField
            executionType={executionType}
            technicianId={technicianId}
            onTechnicianChange={setTechnicianId}
            assignee={assignee}
            onAssigneeChange={setAssignee}
          />

          {value && (
            <div className="schedule-picker__preview">
              <p className="schedule-picker__preview-title">Ya programado para ese día</p>
              {visiblePreview.length === 0 && <p className="muted">No hay nada más programado ese día.</p>}
              {visiblePreview.length > 0 && (
                <ul className="schedule-picker__preview-list">
                  {visiblePreview.map((s) => (
                    <li key={s.id} className="schedule-picker__preview-item">
                      <span>{previewTimeFormatter.format(new Date(s.scheduledAt))}</span>
                      <span className="schedule-picker__preview-item-title">{s.title}</span>
                      {s.plate && <span className="schedule-picker__preview-item-plate">{s.plate}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={props.onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleConfirm} disabled={submitting || !canConfirm}>
            {submitting ? 'Programando…' : 'Confirmar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
