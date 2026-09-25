import type { Role, UserSummary } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

/** GET /api/users -- listado de solo lectura, hoy para el selector de técnico de una OT (CAM-60). */
export async function getUsers(role?: Role): Promise<UserSummary[]> {
  const qs = role ? `?role=${role}` : '';
  const res = await fetch(`${API_BASE_URL}/api/users${qs}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener los usuarios');
  const data = (await res.json()) as { items: UserSummary[] };
  return data.items;
}
