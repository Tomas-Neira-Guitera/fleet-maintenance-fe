import type { FuelLoad, VehicleFuel } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

// CAM-156: cargas de combustible. Cargar: chofer o admin; corregir, borrar y ver el consumo: admin.

export interface FuelLoadInput {
  vehicleId: string;
  /** ISO-8601; sin valor, el backend toma ahora. */
  loadedAt?: string;
  liters: number;
  amount: number;
  odometerKm: number;
  fullTank: boolean;
}

export async function createFuelLoad(input: FuelLoadInput): Promise<FuelLoad> {
  const res = await fetch(`${API_BASE_URL}/api/fuel-loads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo registrar la carga');
  return res.json() as Promise<FuelLoad>;
}

export async function updateFuelLoad(id: string, input: FuelLoadInput): Promise<FuelLoad> {
  const res = await fetch(`${API_BASE_URL}/api/fuel-loads/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo guardar la carga');
  return res.json() as Promise<FuelLoad>;
}

export async function deleteFuelLoad(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/fuel-loads/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo borrar la carga');
}

export async function getVehicleFuel(vehicleId: string, months = 6): Promise<VehicleFuel> {
  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/fuel?months=${months}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener el consumo del vehículo');
  return res.json() as Promise<VehicleFuel>;
}
