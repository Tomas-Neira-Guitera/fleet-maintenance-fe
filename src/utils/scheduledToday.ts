import type { Vehicle } from '../types/domain';
import { argentinaDateKey } from './dateFormat';

/**
 * CAM-143: la hora del turno de taller de hoy ("15:00"), o null. El backend ya manda solo el de hoy, pero se
 * vuelve a mirar la fecha: sin señal se muestra la flota guardada (CAM-153), y un turno de ayer no es de hoy.
 * Día y hora en Argentina (CAM-88), igual que el backend.
 */
export function scheduledTodayTime(vehicle: Vehicle, now: Date = new Date()): string | null {
  const iso = vehicle.scheduledToday;
  if (!iso) return null;
  if (argentinaDateKey(iso) !== argentinaDateKey(now.toISOString())) return null;
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}
