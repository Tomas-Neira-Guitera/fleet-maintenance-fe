import type { FleetStatusRow } from '../types/domain';
import { daysUntilDue } from './maintenanceFormat';

const MAX_PER_BUCKET = 5;

/**
 * Franjas de "Próximos vencimientos" por días hasta el vencimiento (comparables entre sí, a
 * diferencia de mezclar con `remainingKm`). Un plan por km entra según su fecha estimada (CAM-137),
 * y uno por km y por tiempo según la más cercana de las dos (`daysUntilDue`). Los vencidos (días
 * negativos, o un plan que ya llegó a sus km) caen en la primera franja, la más urgente -- no se
 * agrega una franja separada para ellos.
 */
const BUCKETS = [
  { label: 'Próximos 7 días', min: -Infinity, max: 7 },
  { label: '8-14 días', min: 8, max: 14 },
  { label: '15-30 días', min: 15, max: 30 },
];

/**
 * CAM-137: un plan por km de un vehículo sin lecturas suficientes no tiene días. Va aparte, con los
 * km que faltan, pero solo si no está al día (por km, eso es estar a `WARNING_THRESHOLD_KM` del
 * backend o menos): si no, entraría cualquier plan por km lejano de un vehículo que casi no se
 * inspecciona.
 */
export const WITHOUT_ESTIMATE_LABEL = 'Por km, sin estimación';

export interface UpcomingGroup {
  label: string;
  items: FleetStatusRow[];
}

/** Agrupa la flota en las franjas de "Próximos vencimientos"; solo las que tienen algo. */
export function groupByDueDays(rows: FleetStatusRow[], today: Date = new Date()): UpcomingGroup[] {
  const withNext = rows.filter((row) => row.nextMaintenance != null);
  const due = new Map(withNext.map((row) => [row.vehicleId, daysUntilDue(row.nextMaintenance!, today)]));

  const groups: UpcomingGroup[] = BUCKETS.map((bucket) => ({
    label: bucket.label,
    items: withNext
      .filter((row) => {
        const days = due.get(row.vehicleId);
        return days != null && days >= bucket.min && days <= bucket.max;
      })
      .sort((a, b) => due.get(a.vehicleId)! - due.get(b.vehicleId)!)
      .slice(0, MAX_PER_BUCKET),
  }));

  groups.push({
    label: WITHOUT_ESTIMATE_LABEL,
    items: withNext
      .filter((row) => due.get(row.vehicleId) == null && row.nextMaintenance!.remainingKm != null
        && row.nextMaintenance!.status !== 'al_dia')
      .sort((a, b) => a.nextMaintenance!.remainingKm! - b.nextMaintenance!.remainingKm!)
      .slice(0, MAX_PER_BUCKET),
  });

  return groups.filter((group) => group.items.length > 0);
}
