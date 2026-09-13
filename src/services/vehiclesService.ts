import type { Vehicle } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

export async function getVehicles(active = true): Promise<Vehicle[]> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles?active=${active}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener la flota');
  return res.json() as Promise<Vehicle[]>;
}

export interface CreateVehicleData {
  plate: string;
  brand: string;
  model: string;
  vehicleType?: string;
  year?: number;
  chassisNumber?: string;
  odometerKm?: number;
}

export type UpdateVehicleData = Partial<CreateVehicleData> & { active?: boolean };

/** POST /api/vehicles -- alta de un vehículo (CAM-25). */
export async function createVehicle(data: CreateVehicleData): Promise<Vehicle> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo crear el vehículo');
  return res.json() as Promise<Vehicle>;
}

/** PATCH /api/vehicles/{id} -- edición parcial, o reactivar con { active: true } (CAM-25). */
export async function updateVehicle(id: string, data: UpdateVehicleData): Promise<Vehicle> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo editar el vehículo');
  return res.json() as Promise<Vehicle>;
}

/** DELETE /api/vehicles/{id} -- baja lógica (CAM-25). */
export async function deactivateVehicle(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo dar de baja el vehículo');
}

export interface OdometerResult {
  vehicleId: string;
  odometerKm: number;
  updatedAt: string;
}

/** PATCH /api/vehicles/{id}/odometer -- cargar el kilometraje actual (CAM-18). */
export async function updateOdometer(id: string, odometerKm: number): Promise<OdometerResult> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${id}/odometer`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ odometerKm }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo actualizar el kilometraje');
  return res.json() as Promise<OdometerResult>;
}
