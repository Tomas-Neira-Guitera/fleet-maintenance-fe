import type { DefectSummary, DefectStatus } from '../types/domain';
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
