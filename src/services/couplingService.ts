import type { Coupling } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

// CAM-157: enganche de remolques. Leerlo: admin o chofer; cambiarlo: admin.

export async function getCoupling(vehicleId: string): Promise<Coupling> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/coupling`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener el enganche');
  return res.json() as Promise<Coupling>;
}

/** Engancha el remolque trailerId al tractor o camión towingId. */
export async function coupleTrailer(trailerId: string, towingId: string): Promise<Coupling> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${trailerId}/coupling`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ towingId }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo enganchar el remolque');
  return res.json() as Promise<Coupling>;
}

export async function uncoupleTrailer(trailerId: string): Promise<Coupling> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${trailerId}/coupling`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo desenganchar el remolque');
  return res.json() as Promise<Coupling>;
}
