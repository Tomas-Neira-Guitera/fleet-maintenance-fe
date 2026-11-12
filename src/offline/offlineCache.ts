// CAM-153: lo último que se cargó de la flota y de cada checklist, para seguir inspeccionando sin señal.
// Va en localStorage: son datos chicos y alcanza con la última versión.

const PREFIX = 'fleetguard.cache.';

export interface Cached<T> {
  data: T;
  savedAt: string;
}

export function saveCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: new Date().toISOString() }));
  } catch {
    // Sin lugar o sin localStorage: se sigue sin caché.
  }
}

export function loadCache<T>(key: string): Cached<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Cached<T>) : null;
  } catch {
    return null;
  }
}

/** Al cerrar sesión: el próximo que entre no ve la flota del anterior. */
export function clearOfflineCache(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // nada que limpiar
  }
}

export const VEHICLES_CACHE_KEY = 'vehicles';

export function checklistCacheKey(vehicleId: string, type: string): string {
  return `checklist.${vehicleId}.${type}`;
}

/** CAM-157: el remolque enganchado, para el pre-viaje sin señal. */
export function couplingCacheKey(vehicleId: string): string {
  return `coupling.${vehicleId}`;
}

/** CAM-157: las posiciones con cubierta del vehículo, para anotar el dibujo sin señal. */
export function tirePositionsCacheKey(vehicleId: string): string {
  return `tire-positions.${vehicleId}`;
}
