import { useEffect, useState } from 'react';
import { getFleetStatus } from '../../services/fleetStatusService';
import type { FleetStatusRow } from '../../types/domain';
import { describeNextMaintenance } from '../../utils/maintenanceFormat';
import { StatusBadge } from './StatusBadge';
import '../../styles/dashboard.css';

/** No hay endpoint de conteos agregados (ver ROADMAP) -- alcanza con traer toda la flota. */
const FLEET_STATUS_PAGE_SIZE = 500;
const MAX_PER_BUCKET = 5;

/**
 * Franjas por `remainingDays` (siempre en días, comparables entre sí -- a diferencia de
 * mezclar con `remainingKm`). Los planes solo-por-km (`remainingDays == null`) quedan afuera
 * de este widget porque no encajan en una franja de días. Los vencidos (días negativos) caen
 * en la primera franja, la más urgente -- no se agrega una franja separada para ellos.
 */
const BUCKETS = [
  { label: 'Próximos 7 días', min: -Infinity, max: 7 },
  { label: '8-14 días', min: 8, max: 14 },
  { label: '15-30 días', min: 15, max: 30 },
];

export function UpcomingMaintenanceCard() {
  const [rows, setRows] = useState<FleetStatusRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFleetStatus({ pageSize: FLEET_STATUS_PAGE_SIZE })
      .then((page) => {
        if (!cancelled) setRows(page.items);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los próximos vencimientos. Intentá de nuevo.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bucketedGroups = rows
    ? BUCKETS.map((bucket) => ({
        ...bucket,
        items: rows
          .filter((row) => {
            const days = row.nextMaintenance?.remainingDays;
            return days != null && days >= bucket.min && days <= bucket.max;
          })
          .sort((a, b) => a.nextMaintenance!.remainingDays! - b.nextMaintenance!.remainingDays!)
          .slice(0, MAX_PER_BUCKET),
      })).filter((group) => group.items.length > 0)
    : null;

  return (
    <section className="upcoming-maintenance-card">
      <header className="upcoming-maintenance-card__header">
        <h2 className="upcoming-maintenance-card__title">Próximos vencimientos</h2>
      </header>

      {error && <p className="error-banner">{error}</p>}
      {!bucketedGroups && !error && <p className="muted">Cargando vencimientos…</p>}
      {bucketedGroups && bucketedGroups.length === 0 && <p className="muted">No hay vencimientos próximos.</p>}

      {bucketedGroups && bucketedGroups.length > 0 && (
        <div className="upcoming-maintenance-card__groups">
          {bucketedGroups.map((group) => (
            <div key={group.label} className="upcoming-maintenance-card__group">
              <h3 className="upcoming-maintenance-card__group-title">{group.label.toUpperCase()}</h3>
              <div className="upcoming-maintenance-card__list">
                {group.items.map((row) => (
                  <div key={row.vehicleId} className="upcoming-maintenance-card__item">
                    <div className="upcoming-maintenance-card__top-line">
                      <StatusBadge status={row.status} />
                      <span className="fleet-status__plate">{row.plate}</span>
                    </div>
                    <p className="upcoming-maintenance-card__description">{row.nextMaintenance!.name}</p>
                    <p className="upcoming-maintenance-card__meta">{describeNextMaintenance(row.nextMaintenance!)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
