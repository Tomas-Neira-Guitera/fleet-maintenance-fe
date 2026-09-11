import type { MaintenanceAssignment } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

/** GET /api/vehicles/{vehicleId}/maintenance-assignments -- ver CAM-40-maintenance-api-contract.md. */
export async function getVehicleMaintenanceAssignments(vehicleId: string): Promise<MaintenanceAssignment[]> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/maintenance-assignments`, {
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener los mantenimientos del vehículo');
  const data = (await res.json()) as { items: MaintenanceAssignment[] };
  return data.items;
}
