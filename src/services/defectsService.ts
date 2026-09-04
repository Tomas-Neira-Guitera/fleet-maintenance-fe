import type { DefectSummary } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

export async function getDefects(): Promise<DefectSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/defects`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener los defectos');
  return res.json() as Promise<DefectSummary[]>;
}
