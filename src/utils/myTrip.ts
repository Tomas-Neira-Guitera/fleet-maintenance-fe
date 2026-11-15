import type { PendingInspection } from '../offline/pendingInspections';
import { getUsername } from '../services/apiClient';
import type { Vehicle } from '../types/domain';
import { isTrailer } from './vehicleTypes';

/**
 * CAM-153: cómo queda el vehículo después de lo que el chofer hizo sin señal. Un pre-viaje guardado lo deja en
 * viaje (y se puede hacer el post-viaje); un post-viaje guardado lo deja disponible.
 */
export function withPending(vehicle: Vehicle, pending: PendingInspection | undefined, currentUserId: string | null): Vehicle {
  if (!pending) return vehicle;
  if (pending.type === 'post-trip') return { ...vehicle, status: 'available', currentTrip: null };
  const blocking = pending.answers.some((a) => a.outcome === 'defect' && a.defect?.severity === 'blocking');
  if (blocking) {
    const message = 'Reportaste un defecto bloqueante (se envía cuando vuelva la señal).';
    return { ...vehicle, status: 'available', blocked: true, blockReasons: [{ type: 'blocking_defect', message }] };
  }
  const openedBy = currentUserId ? { id: currentUserId, name: getUsername() ?? '' } : null;
  return { ...vehicle, status: 'on-trip', blocked: false, currentTrip: { startedAt: pending.performedAt, openedBy } };
}

/** La última inspección guardada de cada vehículo es la que define cómo quedó. */
export function lastPendingByVehicle(items: PendingInspection[]): Map<string, PendingInspection> {
  const byVehicle = new Map<string, PendingInspection>();
  for (const item of items) if (item.status === 'pending') byVehicle.set(item.vehicleId, item);
  return byVehicle;
}

/** El viaje abierto del chofer, contando lo guardado sin señal. Si el servidor devolviera más de uno, el último. */
export function findMyTrip(vehicles: Vehicle[], pending: PendingInspection[], currentUserId: string | null): Vehicle | null {
  if (!currentUserId) return null;
  const byVehicle = lastPendingByVehicle(pending);
  let mine: Vehicle | null = null;
  for (const serverVehicle of vehicles) {
    if (isTrailer(serverVehicle.vehicleType)) continue;
    const vehicle = withPending(serverVehicle, byVehicle.get(serverVehicle.id), currentUserId);
    const trip = vehicle.currentTrip;
    if (vehicle.status !== 'on-trip' || !trip || trip.openedBy?.id !== currentUserId) continue;
    if (!mine?.currentTrip || Date.parse(trip.startedAt) > Date.parse(mine.currentTrip.startedAt)) mine = vehicle;
  }
  return mine;
}
