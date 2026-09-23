import { useEffect, useState, type ReactElement } from 'react';
import { ApiError } from '../../services/apiClient';
import { getVehicle, getVehicleHistory } from '../../services/vehiclesService';
import { getWorkOrders } from '../../services/workOrdersService';
import type { DefectSummary, Vehicle, VehicleHistory, WorkOrder, WorkOrderStatus } from '../../types/domain';
import { formatDate, numberFormatter } from '../../utils/maintenanceFormat';
import { AlertTriangleIcon, ArrowLeftIcon, ChevronRightIcon } from '../icons';
import { SeverityBadge } from '../SeverityBadge';
import { WorkOrderDetailModal } from './WorkOrderDetailModal';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import '../../styles/dashboard.css';

interface VehicleDetailProps {
  vehicleId: string;
  onBack: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatKm(km: number | null | undefined): string {
  return km == null ? '—' : `${numberFormatter.format(km)} km`;
}

/** Bloqueantes primero, más reciente primero dentro de cada grupo -- mismo criterio que
 *  DefectService.listDefects() en el listado general de defectos. */
function sortDefects(defects: DefectSummary[]): DefectSummary[] {
  return [...defects].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'blocking' ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const WORK_ORDER_STATUS_RANK: Record<WorkOrderStatus, number> = {
  en_proceso: 0,
  asignada: 1,
  finalizada: 2,
  cancelada: 3,
};

/** Abiertas (en proceso, después asignadas) primero, más reciente primero dentro de cada grupo. */
function sortWorkOrders(workOrders: WorkOrder[]): WorkOrder[] {
  return [...workOrders].sort((a, b) => {
    const rankDiff = WORK_ORDER_STATUS_RANK[a.status] - WORK_ORDER_STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const LIST_PREVIEW_LIMIT = 3;

interface CollapsibleListProps<T> {
  items: T[];
  renderItem: (item: T) => ReactElement;
  limit?: number;
}

/** Muestra los primeros `limit` ítems y colapsa el resto atrás de un "Ver más" -- listas largas
 *  (ej. muchos mantenimientos) no deben alargar la tarjeta indefinidamente. */
function CollapsibleList<T>({ items, renderItem, limit = LIST_PREVIEW_LIMIT }: CollapsibleListProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = items.length - limit;
  const visible = expanded || hiddenCount <= 0 ? items : items.slice(0, limit);

  return (
    <>
      <ul className="vehicle-detail__list">{visible.map(renderItem)}</ul>
      {hiddenCount > 0 && (
        <button type="button" className="vehicle-detail__toggle" onClick={() => setExpanded((e) => !e)}>
          <ChevronRightIcon
            width={14}
            height={14}
            className={`vehicle-detail__toggle-icon${expanded ? ' vehicle-detail__toggle-icon--expanded' : ''}`}
          />
          {expanded ? 'Ver menos' : `Ver ${hiddenCount} más`}
        </button>
      )}
    </>
  );
}

/**
 * Detalle de un vehículo (CAM-22): ficha + historial de inspecciones, defectos,
 * mantenimientos realizados y órdenes de trabajo (CAM-14). Las órdenes se piden
 * aparte de /history -- son un recurso propio (GET /api/work-orders?vehicleId=),
 * no un campo del historial.
 */
export function VehicleDetail({ vehicleId, onBack }: VehicleDetailProps) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [history, setHistory] = useState<VehicleHistory | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[] | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getVehicle(vehicleId), getVehicleHistory(vehicleId), getWorkOrders({ vehicleId })])
      .then(([v, h, wo]) => {
        if (cancelled) return;
        setVehicle(v);
        setHistory(h);
        setWorkOrders(wo);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? 'No se encontró el vehículo.'
            : 'No se pudo cargar el vehículo. Intentá de nuevo.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  function handleWorkOrderUpdated(updated: WorkOrder) {
    setSelectedWorkOrder(updated);
    setWorkOrders((prev) => prev?.map((wo) => (wo.id === updated.id ? updated : wo)) ?? prev);
  }

  const inactive = vehicle?.active === false;
  const blockingDefects = history?.defects.filter((d) => d.severity === 'blocking').length ?? 0;
  const openWorkOrders = workOrders?.filter((wo) => wo.status === 'asignada' || wo.status === 'en_proceso').length ?? 0;

  return (
    <section className="vehicle-detail">
      <button type="button" className="top-nav__back" onClick={onBack}>
        <ArrowLeftIcon width={16} height={16} />
        Volver
      </button>

      {error && (
        <p className="error-banner error-banner--icon">
          <AlertTriangleIcon width={16} height={16} />
          {error}
        </p>
      )}
      {!vehicle && !error && <p className="muted">Cargando vehículo…</p>}

      {vehicle && (
        <>
          <header className="vehicle-detail__header">
            <div>
              <span className="vehicle-detail__plate">{vehicle.plate}</span>
              <h1 className="vehicle-detail__title">
                {vehicle.brand} {vehicle.model}
              </h1>
            </div>
            <span className={`vehicles-section__status vehicles-section__status--${inactive ? 'inactive' : 'active'}`}>
              {inactive ? 'Dado de baja' : 'Activo'}
            </span>
          </header>

          <dl className="vehicle-detail__facts">
            <div>
              <dt>Año</dt>
              <dd>{vehicle.year ?? '—'}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{vehicle.vehicleType ?? '—'}</dd>
            </div>
            <div>
              <dt>Kilometraje</dt>
              <dd className="vehicle-detail__mono">{formatKm(vehicle.odometerKm ?? 0)}</dd>
            </div>
            <div>
              <dt>N° de chasis</dt>
              <dd className="vehicle-detail__mono">{vehicle.chassisNumber ?? '—'}</dd>
            </div>
            <div>
              <dt>Situación</dt>
              <dd>{vehicle.status === 'on-trip' ? 'En viaje' : 'Disponible'}</dd>
            </div>
          </dl>
        </>
      )}

      {history && (
        <div className="vehicle-detail__sections">
          {/* Inspecciones + Defectos: un defecto nace de una inspección. */}
          <div className="vehicle-detail__column">
            <section className="vehicle-detail__card">
              <h2 className="vehicle-detail__card-title">Inspecciones ({history.inspections.length})</h2>
              {history.inspections.length === 0 ? (
                <p className="muted">Sin inspecciones registradas.</p>
              ) : (
                <CollapsibleList
                  items={history.inspections}
                  renderItem={(i) => (
                    <li key={i.id} className="vehicle-detail__item">
                      <div className="vehicle-detail__item-main">
                        <span className="vehicle-detail__item-label">
                          {i.type === 'pre-trip' ? 'Pre-viaje' : 'Post-viaje'}
                          {i.driverName ? ` · ${i.driverName}` : ''}
                        </span>
                        <span className="vehicle-detail__item-meta">
                          {formatDateTime(i.timestamp)} · {formatKm(i.odometerKm)}
                        </span>
                        {i.notes && <span className="vehicle-detail__item-meta">{i.notes}</span>}
                      </div>
                      {i.hasBlockingDefect && <SeverityBadge severity="blocking" />}
                    </li>
                  )}
                />
              )}
            </section>

            <section className="vehicle-detail__card">
              <h2 className="vehicle-detail__card-title">
                Defectos ({history.defects.length})
                {blockingDefects > 0 && (
                  <span className="vehicle-detail__card-title-flag"> · {blockingDefects} bloqueante{blockingDefects > 1 ? 's' : ''}</span>
                )}
              </h2>
              {history.defects.length === 0 ? (
                <p className="muted">Sin defectos reportados.</p>
              ) : (
                <CollapsibleList
                  items={sortDefects(history.defects)}
                  renderItem={(d) => (
                    <li key={d.id} className="vehicle-detail__item">
                      <div className="vehicle-detail__item-main">
                        <span className="vehicle-detail__item-label">{d.description}</span>
                        <span className="vehicle-detail__item-meta">
                          {formatDateTime(d.createdAt)}
                          {d.reportedBy ? ` · ${d.reportedBy}` : ''}
                        </span>
                      </div>
                      <SeverityBadge severity={d.severity} />
                    </li>
                  )}
                />
              )}
            </section>
          </div>

          {/* Mantenimientos + Órdenes de trabajo: una OT cierra un mantenimiento (o un defecto). */}
          <div className="vehicle-detail__column">
            <section className="vehicle-detail__card">
              <h2 className="vehicle-detail__card-title">Mantenimientos realizados ({history.maintenance.length})</h2>
              {history.maintenance.length === 0 ? (
                <p className="muted">Sin mantenimientos registrados.</p>
              ) : (
                <CollapsibleList
                  items={history.maintenance}
                  renderItem={(m) => (
                    <li key={m.id} className="vehicle-detail__item">
                      <div className="vehicle-detail__item-main">
                        <span className="vehicle-detail__item-label">{m.planName}</span>
                        <span className="vehicle-detail__item-meta">
                          {formatDate(m.completedAt)} · {formatKm(m.completedKm)}
                          {m.workOrderId ? ` · OT ${m.workOrderId}` : ''}
                        </span>
                        {m.notes && <span className="vehicle-detail__item-meta">{m.notes}</span>}
                      </div>
                    </li>
                  )}
                />
              )}
            </section>

            <section className="vehicle-detail__card">
              <h2 className="vehicle-detail__card-title">
                Órdenes de trabajo ({workOrders?.length ?? 0})
                {openWorkOrders > 0 && (
                  <span className="vehicle-detail__card-title-flag vehicle-detail__card-title-flag--warn">
                    {' '}
                    · {openWorkOrders} en curso
                  </span>
                )}
              </h2>
              {!workOrders ? (
                <p className="muted">Cargando órdenes de trabajo…</p>
              ) : workOrders.length === 0 ? (
                <p className="muted">Sin órdenes de trabajo todavía.</p>
              ) : (
                <CollapsibleList
                  items={sortWorkOrders(workOrders)}
                  renderItem={(wo) => (
                    <li
                      key={wo.id}
                      className="vehicle-detail__item vehicle-detail__item--clickable"
                      onClick={() => setSelectedWorkOrder(wo)}
                    >
                      <div className="vehicle-detail__item-main">
                        <span className="vehicle-detail__item-label">{wo.title}</span>
                        <span className="vehicle-detail__item-meta">
                          {formatDateTime(wo.createdAt)}
                          {wo.assignee ? ` · ${wo.assignee}` : ''}
                        </span>
                      </div>
                      <WorkOrderStatusBadge status={wo.status} />
                    </li>
                  )}
                />
              )}
            </section>
          </div>
        </div>
      )}

      {selectedWorkOrder && (
        <WorkOrderDetailModal
          workOrder={selectedWorkOrder}
          onClose={() => setSelectedWorkOrder(null)}
          onUpdated={handleWorkOrderUpdated}
        />
      )}
    </section>
  );
}
