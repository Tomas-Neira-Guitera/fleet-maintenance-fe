import { useCallback, useEffect, useRef, useState } from 'react';
import { getDefects } from '../services/defectsService';
import { getWorkOrders } from '../services/workOrdersService';
import type { DefectSummary, WorkOrder } from '../types/domain';
import { ArrowLeftIcon, CameraIcon, WrenchIcon } from './icons';
import { SeverityBadge } from './SeverityBadge';
import { SchedulePickerModal } from './dashboard/SchedulePickerModal';

interface DefectsListProps {
  onBack?: () => void;
}

/** "OT asignada · tecnico2", "OT en proceso · sin técnico", "OT asignada · Taller Norte". */
function describeOpenWorkOrder(wo: WorkOrder): string {
  const status = wo.status === 'en_proceso' ? 'OT en proceso' : 'OT asignada';
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

export function DefectsList({ onBack }: DefectsListProps) {
  const [defects, setDefects] = useState<DefectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<DefectSummary | null>(null);
  // Estado real (CAM-60): qué defectos ya tienen una OT abierta. Si no se puede cargar, todos
  // quedan en "Planificar" -- el backend igual no duplica la OT al replanificar.
  const [openWorkOrders, setOpenWorkOrders] = useState<Map<string, WorkOrder>>(new Map());
  // Id del último pedido de OTs: una respuesta vieja que llega tarde no pisa a una más nueva
  // (ni se aplica después de salir de la pantalla, que pone el contador en -1).
  const workOrdersRequestRef = useRef(0);

  // Solo las abiertas: el historial de OTs cerradas crece sin límite y acá no hace falta.
  const loadOpenWorkOrders = useCallback(() => {
    const requestId = ++workOrdersRequestRef.current;
    Promise.all([getWorkOrders({ status: 'asignada' }), getWorkOrders({ status: 'en_proceso' })])
      .then(([assigned, inProgress]) => {
        if (requestId === workOrdersRequestRef.current) {
          setOpenWorkOrders(openWorkOrdersByDefect([...assigned, ...inProgress]));
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

      <ul className="defect-summary-list">
        {defects?.map((defect) => {
          const openWorkOrder = openWorkOrders.get(defect.id);
          const resolved = defect.status === 'resuelto';
          return (
            <li key={defect.id} className="defect-summary-item">
              <div className="defect-summary-item__info">
                <span className="defect-summary-item__label">{defect.description}</span>
                <span className="defect-summary-item__meta">
                  <span className="vehicle-meta__plate">{defect.vehiclePlate}</span>
                  {' · '}
                  {formatDate(defect.createdAt)}
                  {defect.photoUrl && (
                    <>
                      {' · '}
                      <a href={defect.photoUrl} target="_blank" rel="noreferrer" className="photo-link">
                        <CameraIcon className="photo-link__icon" />
                        Ver foto
                      </a>
                    </>
                  )}
                </span>
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

      {scheduling && (
        <SchedulePickerModal
          sourceType="defect"
          sourceId={scheduling.id}
          title={scheduling.description}
          onClose={() => setScheduling(null)}
          onScheduled={() => {
            setScheduling(null);
            loadOpenWorkOrders();
          }}
        />
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
}
