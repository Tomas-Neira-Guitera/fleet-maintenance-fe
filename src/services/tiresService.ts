import type {
  Tire,
  TireBrandComparison,
  TireDetail,
  TireLayout,
  TirePositionRef,
  TireStatus,
  TreadReading,
  VehicleTires,
} from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

// CAM-157: neumáticos. Todo del admin, salvo las posiciones montadas, que también pide el chofer.

export interface TireInput {
  code?: string;
  brand: string;
  model?: string;
  size: string;
  purchaseDate: string;
  cost: number;
  initialTreadMm?: number;
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
    'No se pudieron obtener las cubiertas');
  return body.items;
}

export function getTire(id: string): Promise<TireDetail> {
  return getJson(`/tires/${id}`, 'No se pudo obtener la cubierta');
}

export function createTire(input: TireInput): Promise<Tire> {
  return send('/tires', 'POST', input, 'No se pudo cargar la cubierta');
}

export function updateTire(id: string, input: TireInput): Promise<Tire> {
  return send(`/tires/${id}`, 'PUT', input, 'No se pudo guardar la cubierta');
}

export function retireTire(id: string, reason?: string): Promise<Tire> {
  return send(`/tires/${id}/retire`, 'POST', { reason }, 'No se pudo dar de baja la cubierta');
}

export async function deleteTire(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/tires/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo borrar la cubierta');
}

export function getTireBrandComparison(): Promise<TireBrandComparison> {
  return getJson('/tires/brand-comparison', 'No se pudo obtener la comparación por marca');
}

export function getVehicleTires(vehicleId: string): Promise<VehicleTires> {
  return getJson(`/vehicles/${vehicleId}/tires`, 'No se pudieron obtener las cubiertas del vehículo');
}

export function setTireLayout(vehicleId: string, layout: TireLayout): Promise<VehicleTires> {
  return send(`/vehicles/${vehicleId}/tire-layout`, 'PUT', { layout }, 'No se pudo cambiar la configuración');
}

export function mountTire(
  vehicleId: string,
  tireId: string,
  position: string,
  replaced?: 'stock' | 'retired',
  retiredReason?: string,
): Promise<VehicleTires> {
  return send(`/vehicles/${vehicleId}/tires/mount`, 'POST', { tireId, position, replaced, retiredReason },
    'No se pudo montar la cubierta');
}

export function unmountTire(vehicleId: string, position: string, retire: boolean, reason?: string): Promise<VehicleTires> {
  return send(`/vehicles/${vehicleId}/tires/unmount`, 'POST', { position, retire, reason }, 'No se pudo sacar la cubierta');
}

export function rotateTires(vehicleId: string, from: string, to: string): Promise<VehicleTires> {
  return send(`/vehicles/${vehicleId}/tires/rotate`, 'POST', { from, to }, 'No se pudo rotar la cubierta');
}

export function recordTreads(vehicleId: string, readings: TreadReading[]): Promise<VehicleTires> {
  return send(`/vehicles/${vehicleId}/tire-treads`, 'POST', { readings }, 'No se pudo cargar el dibujo');
}

/** Para el pre-viaje: las posiciones que ruedan y tienen cubierta. */
export async function getTirePositions(vehicleId: string): Promise<TirePositionRef[]> {
  const body = await getJson<{ items: TirePositionRef[] }>(`/vehicles/${vehicleId}/tire-positions`,
    'No se pudieron obtener las cubiertas');
  return body.items;
}
