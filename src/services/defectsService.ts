import type { DefectSummary, DefectStatus, RecurringDefects } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

export interface GetDefectsOptions {
  vehicleId?: string;
  status?: DefectStatus;
}

/** GET /api/defects -- acepta filtro opcional por vehículo y/o estado (CAM-14/CAM-15). */
export async function getDefects(options: GetDefectsOptions = {}): Promise<DefectSummary[]> {
  const params = new URLSearchParams();
  if (options.vehicleId) params.set('vehicleId', options.vehicleId);
  if (options.status) params.set('status', options.status);
  const qs = params.toString();

  const res = await fetch(`${API_BASE_URL}/api/defects${qs ? `?${qs}` : ''}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener los defectos');
  return res.json() as Promise<DefectSummary[]>;
}

/** GET /api/defects/recurring -- controles que fallan seguido, de la flota o de un vehículo (CAM-135). Solo ADMIN. */
export async function getRecurringDefects(vehicleId?: string): Promise<RecurringDefects> {
  const qs = vehicleId ? `?${new URLSearchParams({ vehicleId }).toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/api/defects/recurring${qs}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener los defectos recurrentes');
  return res.json() as Promise<RecurringDefects>;
}
