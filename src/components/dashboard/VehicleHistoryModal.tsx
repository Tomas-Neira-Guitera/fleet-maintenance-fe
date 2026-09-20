import { useEffect, useState } from 'react';
import { getDefects } from '../../services/defectsService';
import { getWorkOrders } from '../../services/workOrdersService';
import type { DefectSummary, Vehicle, WorkOrder } from '../../types/domain';
import { CameraIcon, ClipboardListIcon, CloseIcon } from '../icons';
import { SeverityBadge } from '../SeverityBadge';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import '../../styles/dashboard.css';

type HistoryEvent =
  | { kind: 'defect'; at: string; defect: DefectSummary }
  | { kind: 'work-order'; at: string; workOrder: WorkOrder };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}

interface VehicleHistoryModalProps {
  vehicle: Vehicle;
  onClose: () => void;
}

/**
 * Historial combinado de defectos + órdenes de trabajo de un vehículo (CAM-15).
 * Se arma en el cliente combinando los dos recursos existentes, ordenado por
 * fecha -- no hay un endpoint nuevo que los junte (ver doc CAM-14, sección 4).
 */
export function VehicleHistoryModal({ vehicle, onClose }: VehicleHistoryModalProps) {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDefects({ vehicleId: vehicle.id }), getWorkOrders({ vehicleId: vehicle.id })])
      .then(([defects, workOrders]) => {
        if (cancelled) return;
        const combined: HistoryEvent[] = [
          ...defects.map((defect): HistoryEvent => ({ kind: 'defect', at: defect.createdAt, defect })),
          ...workOrders.map((workOrder): HistoryEvent => ({ kind: 'work-order', at: workOrder.createdAt, workOrder })),
        ];
        combined.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        setEvents(combined);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el historial. Intentá de nuevo.');
      });
    return () => {
      cancelled = true;
    };
  }, [vehicle.id]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal modal--wide">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">Historial</h2>
            <p className="modal__subtitle">
              {vehicle.plate} · {vehicle.brand} {vehicle.model}
            </p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon width={18} height={18} />
          </button>
        </header>

        <div className="modal__body">
          {error && <p className="error-banner">{error}</p>}
          {!events && !error && <p className="muted">Cargando historial…</p>}
          {events && events.length === 0 && <p className="muted">Sin defectos ni órdenes de trabajo todavía.</p>}

          {events && events.length > 0 && (
            <ul className="wo-history-list">
              {events.map((event) =>
                event.kind === 'defect' ? (
                  <li key={`defect-${event.defect.id}`} className="wo-history-list__item">
                    <span className="wo-history-list__icon wo-history-list__icon--defect">
                      <CameraIcon width={14} height={14} />
                    </span>
                    <div className="wo-history-list__info">
                      <span className="wo-history-list__title">{event.defect.description}</span>
                      <span className="wo-history-list__meta">{formatDateTime(event.at)} · Defecto reportado</span>
                    </div>
                    <SeverityBadge severity={event.defect.severity} />
                  </li>
                ) : (
                  <li key={`wo-${event.workOrder.id}`} className="wo-history-list__item">
                    <span className="wo-history-list__icon wo-history-list__icon--work-order">
                      <ClipboardListIcon width={14} height={14} />
                    </span>
                    <div className="wo-history-list__info">
                      <span className="wo-history-list__title">{event.workOrder.title}</span>
                      <span className="wo-history-list__meta">{formatDateTime(event.at)} · Orden de trabajo</span>
                    </div>
                    <WorkOrderStatusBadge status={event.workOrder.status} />
                  </li>
                ),
              )}
            </ul>
          )}
        </div>

        <footer className="modal__footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
