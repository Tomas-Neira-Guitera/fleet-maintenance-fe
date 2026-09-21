import { useEffect, useState } from 'react';
import { getDefects } from '../../services/defectsService';
import { getWorkOrders } from '../../services/workOrdersService';
import type { DefectSummary, Vehicle, WorkOrder } from '../../types/domain';
import { CameraIcon, ClipboardListIcon } from '../icons';
import { SeverityBadge } from '../SeverityBadge';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import '../../styles/dashboard.css';

type HistoryEvent =
  | { kind: 'defect'; at: string; defect: DefectSummary }
  | { kind: 'work-order'; at: string; workOrder: WorkOrder };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}

interface VehicleHistorySectionProps {
  vehicles: Vehicle[] | null;
}

/**
 * Historial combinado de defectos + órdenes de trabajo por vehículo (CAM-15).
 * Sección fija debajo del listado de "Vehículos", con su propio selector --
 * reemplaza el modal por fila que tenía antes, para que se pueda dejar
 * abierto mientras se revisan varios vehículos sin perder el contexto de la
 * pantalla. Se arma en el cliente combinando los dos recursos existentes,
 * ordenado por fecha (ver doc CAM-14, sección 4).
 */
export function VehicleHistorySection({ vehicles }: VehicleHistorySectionProps) {
  const [selectedId, setSelectedId] = useState('');
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setEvents(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setEvents(null);
    setError(null);
    Promise.all([getDefects({ vehicleId: selectedId }), getWorkOrders({ vehicleId: selectedId })])
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
  }, [selectedId]);

  return (
    <section className="fleet-status vehicles-section vehicles-section--history">
      <header className="fleet-status__header">
        <h2 className="fleet-status__title">Historial</h2>
        <select
          className="work-orders__filter"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={!vehicles}
        >
          <option value="">{vehicles ? 'Elegí un vehículo' : 'Cargando…'}</option>
          {vehicles?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate} · {v.brand} {v.model}
            </option>
          ))}
        </select>
      </header>

      {!selectedId && <p className="muted">Elegí un vehículo para ver su historial de defectos y órdenes de trabajo.</p>}

      {selectedId && error && <p className="error-banner">{error}</p>}
      {selectedId && !events && !error && <p className="muted">Cargando historial…</p>}
      {selectedId && events && events.length === 0 && <p className="muted">Sin defectos ni órdenes de trabajo todavía.</p>}

      {selectedId && events && events.length > 0 && (
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
    </section>
  );
}
