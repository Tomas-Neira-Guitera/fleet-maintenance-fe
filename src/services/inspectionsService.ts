// --- Mock/real API seam (see vehiclesService.ts for the full explanation) ---
// Swap the mock branch for fetch() calls once the inspections API exists.
import * as mockStore from './mockStore';
import type {
  InspectionSubmission,
  SubmitPostTripResult,
  SubmitPreTripResult,
  Trip,
} from '../types/domain';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export async function getOpenTripForVehicle(vehicleId: string): Promise<Trip | undefined> {
  if (USE_MOCKS) return mockStore.getOpenTripForVehicle(vehicleId);

  const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/open-trip`);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error('No se pudo obtener el viaje abierto');
  return res.json() as Promise<Trip>;
}

export async function submitPreTrip(payload: InspectionSubmission): Promise<SubmitPreTripResult> {
  if (USE_MOCKS) return mockStore.submitPreTrip(payload);

  const res = await fetch(`${API_BASE_URL}/api/inspections/pre-trip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('No se pudo enviar la inspección de pre-viaje');
  return res.json() as Promise<SubmitPreTripResult>;
}

export async function submitPostTrip(
  payload: InspectionSubmission,
  tripId: string,
): Promise<SubmitPostTripResult> {
  if (USE_MOCKS) return mockStore.submitPostTrip(payload, tripId);

  const res = await fetch(`${API_BASE_URL}/api/inspections/post-trip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, tripId }),
  });
  if (!res.ok) throw new Error('No se pudo enviar la inspección de post-viaje');
  return res.json() as Promise<SubmitPostTripResult>;
}
