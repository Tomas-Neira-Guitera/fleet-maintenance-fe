// --- Mock/real API seam ---
// While VITE_USE_MOCKS is "true" (the default — there's no backend yet), these
// functions read/write the in-memory mock store (src/services/mockStore.ts).
// Once the real API exists: set VITE_USE_MOCKS=false in .env and replace each
// function body with the corresponding fetch() call to VITE_API_BASE_URL — the
// function signatures already return the same shape a real API would, so no
// component code needs to change.
import * as mockStore from './mockStore';
import type { Vehicle } from '../types/domain';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export const CURRENT_DRIVER_NAME = mockStore.CURRENT_DRIVER_NAME;

export async function getVehicles(): Promise<Vehicle[]> {
  if (USE_MOCKS) return mockStore.getVehicles();

  const res = await fetch(`${API_BASE_URL}/api/vehicles`);
  if (!res.ok) throw new Error('No se pudo obtener la flota');
  return res.json() as Promise<Vehicle[]>;
}

export async function getVehicleById(id: string): Promise<Vehicle | undefined> {
  if (USE_MOCKS) return mockStore.getVehicleById(id);

  const res = await fetch(`${API_BASE_URL}/api/vehicles/${id}`);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`No se pudo obtener el vehículo ${id}`);
  return res.json() as Promise<Vehicle>;
}
