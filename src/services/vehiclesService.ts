import type { Vehicle } from '../types/domain';
import { API_BASE_URL, throwApiError } from './apiClient';

export async function getVehicles(): Promise<Vehicle[]> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles`);
  if (!res.ok) return throwApiError(res, 'No se pudo obtener la flota');
  return res.json() as Promise<Vehicle[]>;
}
