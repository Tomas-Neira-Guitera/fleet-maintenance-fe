import { useCallback, useEffect, useRef, useState } from 'react';
import { getDefects, isReportedOnRoad } from '../services/defectsService';
import { getWorkOrders } from '../services/workOrdersService';
import type { DefectsFilter } from '../hooks/useAdminRoute';
import type { DefectSummary, WorkOrder } from '../types/domain';
import { ArrowLeftIcon, CameraIcon, WrenchIcon } from './icons';
import { OPEN_WORK_ORDER_STATUSES, WORK_ORDER_STATUS_LABEL } from '../utils/workOrderFormat';
import { OccurredOnTripNote } from './OccurredOnTripNote';
import { PhotoViewer } from './PhotoViewer';
import { SeverityBadge } from './SeverityBadge';
import { SchedulePickerModal } from './dashboard/SchedulePickerModal';

interface DefectsListProps {
  onBack?: () => void;
  /** Viene de la URL (CAM-142): sin filtro son todos. */
  filter?: DefectsFilter;
  onFilterChange: (filter: DefectsFilter | undefined) => void;
}

const FILTERS: { id: DefectsFilter | undefined; label: string }[] = [
  { id: undefined, label: 'Todos' },
  { id: 'on-trip', label: 'Ocurridos en el viaje' },
  { id: 'unattended', label: 'Sin atender' },
];

/** CAM-146 y CAM-142: qué defectos entran en cada filtro. */
function matchesFilter(defect: DefectSummary, filter: DefectsFilter | undefined): boolean {
  if (filter === 'on-trip') return Boolean(defect.occurredOnTrip);
  if (filter === 'unattended') return defect.unattendedDays != null;
  return true;
}

const EMPTY_FILTER_MESSAGE: Record<DefectsFilter, string> = {
  'on-trip': 'Ningún defecto apareció durante un viaje.',
  unattended: 'No hay defectos sin atender: todos tienen una OT o un turno, o se reportaron hace poco.',
};

/** "OT asignada · tecnico2", "OT en proceso · sin técnico", "OT en espera · Taller Norte". */
function describeOpenWorkOrder(wo: WorkOrder): string {
  const status = `OT ${WORK_ORDER_STATUS_LABEL[wo.status].toLowerCase()}`;
  const who =
    wo.executionType === 'externo' ? (wo.externalProvider ?? 'taller externo') : (wo.technicianUsername ?? 'sin técnico');
  return `${status} · ${who}`;
}

/**
 * Por defecto, la OT abierta que lo está resolviendo. Si hubiera más de una (duplicados de antes
 * de CAM-60), gana la más antigua: es la que el backend reusa al replanificar.
 */
function openWorkOrdersByDefect(workOrders: WorkOrder[]): Map<string, WorkOrder> {
  const map = new Map<string, WorkOrder>();
  const oldestFirst = [...workOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const wo of oldestFirst) {
    if (wo.defectId && !map.has(wo.defectId)) map.set(wo.defectId, wo);
  }
  return map;
}

export function DefectsList({ onBack, filter, onFilterChange }: DefectsListProps) {
  const [defects, setDefects] = useState<DefectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<DefectSummary | null>(null);
  // CAM-53: la foto se ve encima del listado, sin otra pestaña; al cerrarla queda todo como estaba.
  const [viewingPhoto, setViewingPhoto] = useState<DefectSummary | null>(null);
  // Estado real (CAM-60): qué defectos ya tienen una OT abierta. Si no se puede cargar, todos
  // quedan en "Planificar" -- el backend igual no duplica la OT al replanificar.
  const [openWorkOrders, setOpenWorkOrders] = useState<Map<string, WorkOrder>>(new Map());
  // Id del último pedido de OTs: una respuesta vieja que llega tarde no pisa a una más nueva
  // (ni se aplica después de salir de la pantalla, que pone el contador en -1).
  const workOrdersRequestRef = useRef(0);
  const visibleDefects = defects?.filter((d) => matchesFilter(d, filter));

  // Solo las abiertas: el historial de OTs cerradas crece sin límite y acá no hace falta.
  const loadOpenWorkOrders = useCallback(() => {
    const requestId = ++workOrdersRequestRef.current;
    Promise.all(OPEN_WORK_ORDER_STATUSES.map((status) => getWorkOrders({ status })))
      .then((byStatus) => {
        if (requestId === workOrdersRequestRef.current) {
          setOpenWorkOrders(openWorkOrdersByDefect(byStatus.flat()));
        }
      })
      .catch(() => {
        // Sin este dato la lista sigue siendo usable; no vale la pena un error en pantalla.
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDefects()
      .then((data) => {
        if (!cancelled) setDefects(data);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los defectos. Intentá de nuevo.');
      });
    loadOpenWorkOrders();
    return () => {
      cancelled = true;
      workOrdersRequestRef.current = -1;
    };
  }, [loadOpenWorkOrders]);

  return (
    <div className="screen">
      <header className="screen__header">
        {onBack && (
          <button type="button" className="top-nav__back" onClick={onBack}>
            <ArrowLeftIcon width={16} height={16} />
            Volver
          </button>
        )}
        <h1 className="screen__title">Defectos</h1>
        <p className="screen__subtitle">Reportados en inspecciones, para priorizar mantenimiento</p>
      </header>

      {error && <p className="error-banner">{error}</p>}

      {!defects && !error && <p className="muted">Cargando defectos…</p>}

      {defects && defects.length === 0 && <p className="muted">No hay defectos reportados.</p>}

      {defects && defects.length > 0 && (
        <div className="defect-filter" role="group" aria-label="Filtrar defectos">
          {FILTERS.map(({ id, label }) => {
            const active = filter === id;
            return (
              <button
                key={label}
                type="button"
                className={`wo-execution-toggle__btn${active ? ' wo-execution-toggle__btn--active' : ''}`}
                aria-pressed={active}
                onClick={() => onFilterChange(id)}
              >
                {label} ({defects.filter((d) => matchesFilter(d, id)).length})
              </button>
            );
          })}
        </div>
      )}

      {filter && defects && defects.length > 0 && visibleDefects?.length === 0 && (
        <p className="muted">{EMPTY_FILTER_MESSAGE[filter]}</p>
      )}

      <ul className="defect-summary-list">
        {visibleDefects?.map((defect) => {
          const openWorkOrder = openWorkOrders.get(defect.id);
          const resolved = defect.status === 'resuelto';
          return (
            <li key={defect.id} className="defect-summary-item">
              <div className="defect-summary-item__info">
                <span className="defect-summary-item__label">{defect.description}</span>
                {defect.details && <span className="defect-summary-item__details">{defect.details}</span>}
                <span className="defect-summary-item__meta">
                  <span className="vehicle-meta__plate">{defect.vehiclePlate}</span>
                  {' · '}
                  {formatDate(defect.createdAt)}
                  {defect.unattendedDays != null && (
                    <>
                      {' · '}
                      <span className="defect-unattended-tag">Sin atender hace {defect.unattendedDays} días</span>
                    </>
                  )}
                  {isReportedOnRoad(defect) && (
                    <>
                      {' · '}
                      <span className="defect-origin-tag">Reportado en viaje</span>
                    </>
                  )}
                  {defect.photoUrl && (
                    <>
                      {' · '}
                      <button type="button" className="photo-link" onClick={() => setViewingPhoto(defect)}>
                        <CameraIcon className="photo-link__icon" />
                        Ver foto
                      </button>
                    </>
                  )}
                </span>
                {defect.occurredOnTrip && (
                  <OccurredOnTripNote occurredOnTrip={defect.occurredOnTrip} reportedBy={defect.reportedBy} />
                )}
                {openWorkOrder && !resolved && (
                  <span className="defect-summary-item__work-order">
                    <WrenchIcon width={13} height={13} aria-hidden="true" />
                    {describeOpenWorkOrder(openWorkOrder)}
                  </span>
                )}
              </div>
              <div className="defect-summary-item__actions">
                <SeverityBadge severity={defect.severity} />
                {/* Replanificar no duplica la OT: solo mueve la fecha (y el modal avisa que la mantuvo). */}
                <button
                  type="button"
                  className="secondary-btn defect-summary-item__schedule-btn"
                  onClick={() => setScheduling(defect)}
                  disabled={resolved}
                >
                  {resolved ? 'Resuelto' : openWorkOrder ? 'Replanificar' : 'Planificar'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {viewingPhoto?.photoUrl && (
        <PhotoViewer
          src={viewingPhoto.photoUrl}
          alt={`Foto del defecto: ${viewingPhoto.description}`}
          onClose={() => setViewingPhoto(null)}
        />
      )}

      {scheduling && (
        <SchedulePickerModal
          sourceType="defect"
          sourceId={scheduling.id}
          title={scheduling.description}
          onClose={() => setScheduling(null)}
          onScheduled={() => {
            setScheduling(null);
            loadOpenWorkOrders();
            // CAM-142: con la OT o el turno nuevos, el defecto deja de estar sin atender.
            getDefects()
              .then(setDefects)
              .catch(() => {
                // Queda la lista anterior: la marca se corrige al volver a entrar.
              });
          }}
        />
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}
