import { useEffect, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import { getVehicles } from '../../services/vehiclesService';
import { createWorkOrder } from '../../services/workOrdersService';
import type { Vehicle, WorkOrder, WorkOrderExecutionType, WorkOrderSourceType } from '../../types/domain';
import { CloseIcon } from '../icons';
import '../../styles/dashboard.css';

interface CreateWorkOrderModalSourceProps {
  mode?: 'source';
  sourceType: Exclude<WorkOrderSourceType, 'manual'>;
  sourceId: string;
  subject: string;
  onClose: () => void;
  onCreated: (workOrder: WorkOrder) => void;
}

interface CreateWorkOrderModalManualProps {
  mode: 'manual';
  onClose: () => void;
  onCreated: (workOrder: WorkOrder) => void;
}

type CreateWorkOrderModalProps = CreateWorkOrderModalSourceProps | CreateWorkOrderModalManualProps;

/**
 * Modal de creación de OT (CAM-14/CAM-63): mismo patrón dual-mode que
 * SchedulePickerModal -- desde un origen (hoy solo "defecto", CAM-14) o manual
 * (elegir vehículo + título libre, desde la sección "Órdenes de trabajo").
 */
export function CreateWorkOrderModal(props: CreateWorkOrderModalProps) {
  const manual = props.mode === 'manual';
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [manualVehicleId, setManualVehicleId] = useState('');
  const [manualTitle, setManualTitle] = useState('');

  const [executionType, setExecutionType] = useState<WorkOrderExecutionType>('interno');
  const [externalProvider, setExternalProvider] = useState('');
  const [assignee, setAssignee] = useState('');
  const [description, setDescription] = useState('');

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

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const workOrder =
        props.mode === 'manual'
          ? await createWorkOrder({
              sourceType: 'manual',
              vehicleId: manualVehicleId,
              title: manualTitle.trim(),
              executionType,
              externalProvider: executionType === 'externo' ? externalProvider.trim() : undefined,
              assignee: assignee.trim() || undefined,
              description: description.trim() || undefined,
            })
          : await createWorkOrder({
              sourceType: props.sourceType,
              sourceId: props.sourceId,
              executionType,
              externalProvider: executionType === 'externo' ? externalProvider.trim() : undefined,
              assignee: assignee.trim() || undefined,
              description: description.trim() || undefined,
            });
      props.onCreated(workOrder);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la orden de trabajo. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  const externalOk = executionType === 'interno' || externalProvider.trim().length > 0;
  const canConfirm = manual
    ? Boolean(manualVehicleId && manualTitle.trim() && externalOk)
    : externalOk;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--narrow">
        <header className="modal__header">
          <h2 className="modal__title">Nueva orden de trabajo</h2>
          <button type="button" className="modal__close" onClick={props.onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {props.mode !== 'manual' && <p className="schedule-picker__subject">{props.subject}</p>}

          {manual && (
            <>
              <label className="schedule-picker__field">
                Vehículo
                <select
                  className="schedule-picker__input"
                  value={manualVehicleId}
                  onChange={(e) => setManualVehicleId(e.target.value)}
                  disabled={!vehicles}
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
                Título
                <input
                  type="text"
                  className="schedule-picker__input"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Ej: Revisión eléctrica preventiva"
                />
              </label>
            </>
          )}

          <div className="schedule-picker__field">
            Ejecución
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

          <label className="schedule-picker__field">
            Responsable (opcional)
            <input
              type="text"
              className="schedule-picker__input"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Ej: Carlos (taller propio)"
            />
          </label>

          <label className="schedule-picker__field">
            Descripción (opcional)
            <textarea
              className="schedule-picker__input schedule-picker__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </label>

          {error && <p className="error-banner">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={props.onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="primary-btn" onClick={handleConfirm} disabled={submitting || !canConfirm}>
            {submitting ? 'Creando…' : 'Crear'}
          </button>
        </footer>
      </div>
    </div>
  );
}
