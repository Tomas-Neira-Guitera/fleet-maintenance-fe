import type { Downtime, MaintenanceCompliance } from '../types/domain';
import { periodParams, type Period } from '../utils/period';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

/** GET /api/downtime -- tiempo fuera de servicio y de reparación de la flota o de un vehículo (CAM-134). Solo ADMIN. */
export async function getDowntime(period: Period, vehicleId?: string): Promise<Downtime> {
  const params = new URLSearchParams(periodParams(period));
  if (vehicleId) params.set('vehicleId', vehicleId);
  const res = await fetch(`${API_BASE_URL}/api/downtime?${params.toString()}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener la disponibilidad');
  return res.json() as Promise<Downtime>;
}

/** GET /api/maintenance-compliance -- indicadores de cumplimiento del mantenimiento (CAM-155). Solo ADMIN. */
export async function getMaintenanceCompliance(period: Period): Promise<MaintenanceCompliance> {
  const params = new URLSearchParams(periodParams(period));
  const res = await fetch(`${API_BASE_URL}/api/maintenance-compliance?${params.toString()}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener los indicadores de mantenimiento');
  return res.json() as Promise<MaintenanceCompliance>;
}
