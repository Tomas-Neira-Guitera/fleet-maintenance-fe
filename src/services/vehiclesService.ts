import type { Vehicle, VehicleCosts, VehicleHistory } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

/** GET /api/vehicles/{id} -- detalle de un vehículo, también dado de baja (CAM-22). */
export async function getVehicle(id: string): Promise<Vehicle> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${id}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener el vehículo');
  return res.json() as Promise<Vehicle>;
}

/** GET /api/vehicles/{id}/history -- inspecciones, defectos y mantenimientos del vehículo (CAM-22). */
export async function getVehicleHistory(id: string): Promise<VehicleHistory> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${id}/history`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener el historial del vehículo');
  return res.json() as Promise<VehicleHistory>;
}

/** GET /api/vehicles/{id}/costs -- total de gastos y costo por km del vehículo (CAM-105). Solo ADMIN. */
export async function getVehicleCosts(id: string): Promise<VehicleCosts> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${id}/costs`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener los costos del vehículo');
  return res.json() as Promise<VehicleCosts>;
}

export async function getVehicles(active = true): Promise<Vehicle[]> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles?active=${active}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener la flota');
  return res.json() as Promise<Vehicle[]>;
}

/** CAM-154: resultado de POST /api/vehicles/import, una entrada por fila mandada. */
export interface VehicleImportResult {
  total: number;
  valid: number;
  created: number;
  rows: {
    row: number;
    plate: string | null;
    valid: boolean;
    errors: { field: string; message: string }[];
    vehicleId: string | null;
  }[];
}

/** POST /api/vehicles/import -- con dryRun valida sin guardar; si no, crea las filas válidas (CAM-154). */
export async function importVehicles(rows: CreateVehicleData[], dryRun: boolean): Promise<VehicleImportResult> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/import?dryRun=${dryRun}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo importar la flota');
  return res.json() as Promise<VehicleImportResult>;
}

export interface CreateVehicleData {
  plate: string;
  brand: string;
  model: string;
  vehicleType?: string;
  year?: number;
  chassisNumber?: string;
  odometerKm?: number;
  /** CAM-150: plantilla cuyos controles se copian al vehículo nuevo. */
  checklistTemplateId?: string;
}

export type UpdateVehicleData = Partial<Omit<CreateVehicleData, 'checklistTemplateId'>> & { active?: boolean };

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
