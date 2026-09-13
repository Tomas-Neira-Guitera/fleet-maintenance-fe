import type { IntervalType, MaintenancePlan } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

/** GET /api/maintenance-plans -- catálogo de planes, ver CAM-40-maintenance-api-contract.md. */
export async function getMaintenancePlans(active = true): Promise<MaintenancePlan[]> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance-plans?active=${active}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener el catálogo de planes de mantenimiento');
  const data = (await res.json()) as { items: MaintenancePlan[] };
  return data.items;
}

export interface CreateMaintenancePlanData {
  name: string;
  category?: string;
  intervalType: IntervalType;
  intervalKm?: number;
  intervalDays?: number;
}

/** POST /api/maintenance-plans -- crea un plan nuevo en el catálogo. */
export async function createMaintenancePlan(data: CreateMaintenancePlanData): Promise<MaintenancePlan> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo crear el plan de mantenimiento');
  return res.json() as Promise<MaintenancePlan>;
}

export type UpdateMaintenancePlanData = Partial<CreateMaintenancePlanData> & { active?: boolean };

/** PATCH /api/maintenance-plans/{id} -- edita campos parciales, o activa/desactiva con `active`. */
export async function updateMaintenancePlan(id: string, data: UpdateMaintenancePlanData): Promise<MaintenancePlan> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance-plans/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo editar el plan de mantenimiento');
  return res.json() as Promise<MaintenancePlan>;
}

/** DELETE /api/maintenance-plans/{id} -- borra el plan del catálogo (solo si nunca se asignó). */
export async function deleteMaintenancePlan(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance-plans/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo borrar el plan de mantenimiento');
}
