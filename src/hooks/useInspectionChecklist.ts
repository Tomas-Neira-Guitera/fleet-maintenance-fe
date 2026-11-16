import { useEffect, useState } from 'react';
import { checklistCacheKey, loadCache, saveCache, tirePositionsCacheKey } from '../offline/offlineCache';
import { getVehicleChecklist } from '../services/checklistService';
import { getTirePositions } from '../services/tiresService';
import type { ChecklistItemDef, InspectionType, TirePositions } from '../types/domain';

interface InspectionChecklist {
  /** null mientras se carga. */
  items: ChecklistItemDef[] | null;
  /** CAM-157: el dibujo, para marcar qué neumático tiene problemas. null sin dibujo o mientras se carga. */
  tirePositions: TirePositions | null;
}

/**
 * CAM-31: el checklist de un vehículo; CAM-153: sin señal, el último que se cargó, y si no hay, la lista base
 * (el servidor ignora lo que no corresponda). CAM-159: lo usan el vehículo y el remolque que lleva.
 */
export function useInspectionChecklist(
  vehicleId: string | null,
  type: InspectionType,
  fallbackItems: ChecklistItemDef[],
  // CAM-159: el remolque marca neumáticos también en el post-viaje.
  withTires: boolean = type === 'pre-trip',
): InspectionChecklist {
  const [loaded, setLoaded] = useState<{ vehicleId: string; items: ChecklistItemDef[] } | null>(null);
  const [tires, setTires] = useState<{ vehicleId: string; positions: TirePositions | null } | null>(null);

  useEffect(() => {
    if (!vehicleId) return;
    let cancelled = false;
    const cacheKey = checklistCacheKey(vehicleId, type);
    getVehicleChecklist(vehicleId, type)
      .then((items) => {
        saveCache(cacheKey, items);
        if (!cancelled) setLoaded({ vehicleId, items });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ vehicleId, items: loadCache<ChecklistItemDef[]>(cacheKey)?.data ?? fallbackItems });
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, type, fallbackItems]);

  useEffect(() => {
    if (!vehicleId || !withTires) return;
    let cancelled = false;
    const cacheKey = tirePositionsCacheKey(vehicleId);
    const cached = () => {
      const data = loadCache<TirePositions>(cacheKey)?.data;
      // Antes se guardaba una lista de posiciones montadas: esa no sirve para dibujar.
      return data && !Array.isArray(data) ? data : null;
    };
    getTirePositions(vehicleId)
      .then((positions) => {
        saveCache(cacheKey, positions);
        if (!cancelled) setTires({ vehicleId, positions });
      })
      .catch(() => {
        if (!cancelled) setTires({ vehicleId, positions: cached() });
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, withTires]);

  // Lo cargado para otro vehículo (el chofer cambió de remolque) no vale.
  return {
    items: vehicleId && loaded?.vehicleId === vehicleId ? loaded.items : null,
    tirePositions: vehicleId && tires?.vehicleId === vehicleId ? tires.positions : null,
  };
}
