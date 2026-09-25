import { useEffect, useState } from 'react';
import { getSessionUserId, getUsername } from '../../services/apiClient';
import { getWorkOrders } from '../../services/workOrdersService';
import type { WorkOrder } from '../../types/domain';
import { ClipboardListIcon, WrenchIcon } from '../icons';

interface MyWorkOrdersProps {
  onSelectWorkOrder: (workOrder: WorkOrder) => void;
}

/** En proceso primero (lo que ya se está trabajando), después asignadas; más antigua primero dentro de cada grupo. */
function sortForTechnician(workOrders: WorkOrder[]): WorkOrder[] {
  return [...workOrders].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'en_proceso' ? -1 : 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * "Mis órdenes" (CAM-60): las OTs abiertas asignadas al técnico logueado. Mismo molde
 * que la lista de flota del chofer (VehicleList): tarjetas grandes, patente + estado.
 */
export function MyWorkOrders({ onSelectWorkOrder }: MyWorkOrdersProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const technicianId = getSessionUserId();
  const username = getUsername();

  useEffect(() => {
    if (!technicianId) return;
    let cancelled = false;
    getWorkOrders({ technicianId })
      .then((data) => {
        if (cancelled) return;
        setWorkOrders(sortForTechnician(data.filter((wo) => wo.status === 'asignada' || wo.status === 'en_proceso')));
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar tus órdenes. Intentá de nuevo.');
      });
    return () => {
      cancelled = true;
    };
  }, [technicianId]);

  return (
    <div className="screen">
      <header className="screen__header">
        <h1 className="screen__title">Mis órdenes</h1>
        <p className="screen__subtitle">
          {username ? `Hola, ${username}. ` : ''}Elegí una orden para trabajarla
        </p>
      </header>

      {!technicianId && <p className="error-banner">No se pudo identificar tu usuario. Cerrá sesión y volvé a entrar.</p>}
      {error && <p className="error-banner">{error}</p>}
      {technicianId && !workOrders && !error && <p className="muted">Cargando órdenes…</p>}
      {workOrders && workOrders.length === 0 && <p className="muted">No tenés órdenes asignadas.</p>}

      <ul className="vehicle-list">
        {workOrders?.map((wo) => (
          <li key={wo.id}>
            <button type="button" className="vehicle-card" onClick={() => onSelectWorkOrder(wo)}>
              <div className="vehicle-card__info">
                <span className="vehicle-card__plate">{wo.plate ?? '—'}</span>
                <span className="vehicle-card__model">{wo.title}</span>
              </div>
              {wo.status === 'en_proceso' ? (
                <span className="status-pill status-pill--warn">
                  <WrenchIcon className="status-pill__icon" />
                  En proceso
                </span>
              ) : (
                <span className="status-pill status-pill--neutral">
                  <ClipboardListIcon className="status-pill__icon" />
                  Asignada
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
