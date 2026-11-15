import type { VehicleComparison } from '../types/domain';
import { periodParams, type Period } from '../utils/period';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

/** GET /api/vehicles/comparison -- los indicadores de los vehículos activos en un período (CAM-140). Solo ADMIN. */
export async function getVehicleComparison(period: Period): Promise<VehicleComparison> {
  const params = new URLSearchParams(periodParams(period));
  const res = await fetch(`${API_BASE_URL}/api/vehicles/comparison?${params.toString()}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener la comparación de vehículos');
  return res.json() as Promise<VehicleComparison>;
}
