import type { FleetStatusPage } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

interface GetFleetStatusOptions {
  page?: number;
  pageSize?: number;
  status?: 'al_dia' | 'por_vencer' | 'vencido';
}

/** GET /api/vehicles?view=fleet-status -- ver CAM-40-maintenance-api-contract.md. */
export async function getFleetStatus(options: GetFleetStatusOptions = {}): Promise<FleetStatusPage> {
  const params = new URLSearchParams({ view: 'fleet-status' });
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));
  if (options.status) params.set('status', options.status);

  const res = await fetch(`${API_BASE_URL}/api/vehicles?${params.toString()}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener el estado de la flota');
  return res.json() as Promise<FleetStatusPage>;
}
