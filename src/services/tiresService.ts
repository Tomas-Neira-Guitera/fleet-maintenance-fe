import type {
  Tire,
  TireBrandComparison,
  TireDetail,
  TirePositions,
  TireStatus,
  VehicleTires,
} from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

// CAM-157: neumáticos. Todo del admin, salvo las posiciones del vehículo, que también pide el chofer.

export interface TireInput {
  code?: string;
  brand: string;
  model?: string;
  size: string;
  purchaseDate: string;
  cost: number;
}

async function send<T>(path: string, method: string, body: unknown, fallback: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) return throwApiError(res, fallback);
  return res.json() as Promise<T>;
}

async function getJson<T>(path: string, fallback: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api${path}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, fallback);
  return res.json() as Promise<T>;
}

export async function getTires(status?: TireStatus): Promise<Tire[]> {
  const body = await getJson<{ items: Tire[] }>(`/tires${status ? `?status=${status}` : ''}`,
    'No se pudieron obtener los neumáticos');
  return body.items;
}

export function getTire(id: string): Promise<TireDetail> {
  return getJson(`/tires/${id}`, 'No se pudo obtener el neumático');
}

export function createTire(input: TireInput): Promise<Tire> {
  return send('/tires', 'POST', input, 'No se pudo cargar el neumático');
}

export function updateTire(id: string, input: TireInput): Promise<Tire> {
  return send(`/tires/${id}`, 'PUT', input, 'No se pudo guardar el neumático');
}

export function retireTire(id: string, reason?: string): Promise<Tire> {
  return send(`/tires/${id}/retire`, 'POST', { reason }, 'No se pudo dar de baja el neumático');
}

export async function deleteTire(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/tires/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo borrar el neumático');
}

export function getTireBrandComparison(): Promise<TireBrandComparison> {
  return getJson('/tires/brand-comparison', 'No se pudo obtener la comparación por marca');
}

export function getVehicleTires(vehicleId: string): Promise<VehicleTires> {
  return getJson(`/vehicles/${vehicleId}/tires`, 'No se pudieron obtener los neumáticos del vehículo');
}

export function mountTire(
  vehicleId: string,
  tireId: string,
  position: string,
  replaced?: 'stock' | 'retired',
  retiredReason?: string,
): Promise<VehicleTires> {
  return send(`/vehicles/${vehicleId}/tires/mount`, 'POST', { tireId, position, replaced, retiredReason },
    'No se pudo montar el neumático');
}

export function unmountTire(vehicleId: string, position: string, retire: boolean, reason?: string): Promise<VehicleTires> {
  return send(`/vehicles/${vehicleId}/tires/unmount`, 'POST', { position, retire, reason }, 'No se pudo sacar el neumático');
}

export function rotateTires(vehicleId: string, from: string, to: string): Promise<VehicleTires> {
  return send(`/vehicles/${vehicleId}/tires/rotate`, 'POST', { from, to }, 'No se pudo rotar el neumático');
}

/** Para el pre-viaje: el dibujo del vehículo y qué posiciones tienen neumático. */
export function getTirePositions(vehicleId: string): Promise<TirePositions> {
  return getJson<TirePositions>(`/vehicles/${vehicleId}/tire-positions`, 'No se pudieron obtener los neumáticos');
}
