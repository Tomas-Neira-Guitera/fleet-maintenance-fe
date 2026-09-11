import type { CompletionResult, MaintenanceAssignment } from '../types/domain';
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

/** POST /api/vehicles/{vehicleId}/maintenance-assignments -- asigna un plan del catálogo a este vehículo (CAM-16). */
export async function createMaintenanceAssignment(
  vehicleId: string,
  maintenancePlanId: string,
): Promise<MaintenanceAssignment> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/maintenance-assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ maintenancePlanId }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo asignar el plan a este vehículo');
  return res.json() as Promise<MaintenanceAssignment>;
}

/** DELETE /api/vehicles/{vehicleId}/maintenance-assignments/{assignmentId} -- desasigna (soft-delete) (CAM-16). */
export async function deleteMaintenanceAssignment(vehicleId: string, assignmentId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/maintenance-assignments/${assignmentId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo desasignar el plan de este vehículo');
}

/** GET .../maintenance-assignments/{assignmentId}/completions -- ver si el plan ya se marcó como hecho alguna vez. */
export async function hasMaintenanceCompletions(vehicleId: string, assignmentId: string): Promise<boolean> {
  const res = await fetch(
    `${API_BASE_URL}/api/vehicles/${vehicleId}/maintenance-assignments/${assignmentId}/completions`,
    { headers: authHeaders() },
  );
  if (!res.ok) return throwApiError(res, 'No se pudo obtener el historial de este mantenimiento');
  const data = (await res.json()) as { items: unknown[] };
  return data.items.length > 0;
}

export interface CreateCompletionData {
  completedAt: string;
  completedKm?: number;
  workOrderId?: string;
  notes?: string;
}

/** POST .../maintenance-assignments/{assignmentId}/completions -- marca el mantenimiento como hecho. */
export async function createMaintenanceCompletion(
  vehicleId: string,
  assignmentId: string,
  data: CreateCompletionData,
): Promise<CompletionResult> {
  const res = await fetch(
    `${API_BASE_URL}/api/vehicles/${vehicleId}/maintenance-assignments/${assignmentId}/completions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) return throwApiError(res, 'No se pudo registrar el mantenimiento como hecho');
  return res.json() as Promise<CompletionResult>;
}
