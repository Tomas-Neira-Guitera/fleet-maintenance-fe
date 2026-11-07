import type { DefectDetail, DefectSummary, DefectStatus, RecurringDefects } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

/**
 * POST /api/vehicles/{id}/road-defects -- el chofer del viaje abierto reporta un defecto sin cerrarlo
 * (CAM-139). itemId: un control del pre-viaje del vehículo, o ROAD_OTHER_ITEM_ID.
 */
export async function reportRoadDefect(vehicleId: string, itemId: string, defect: DefectDetail): Promise<DefectSummary> {
  const details = defect.details?.trim();
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/road-defects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      itemId,
      defect: {
        severity: defect.severity,
        description: defect.description.trim(),
        ...(details ? { details } : {}),
        ...(defect.photoUrl ? { photoUrl: defect.photoUrl } : {}),
      },
    }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo reportar el problema');
  return res.json() as Promise<DefectSummary>;
}

/** "Reportado en viaje" (CAM-139), para los defectos que el chofer cargó durante el viaje. */
export function isReportedOnRoad(defect: Pick<DefectSummary, 'source'>): boolean {
  return defect.source === 'on-road';
}

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
