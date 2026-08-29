// In-memory mock data store used while VITE_USE_MOCKS is on (no backend yet).
// Holds mutable copies of the seed data so the app behaves like a real backend
// would within one session (marking a vehicle "en viaje", closing a trip, etc.)
// without needing persistence. Not meant to be imported by components directly —
// go through src/services/vehiclesService.ts and src/services/inspectionsService.ts.
import vehiclesSeed from '../mocks/vehicles.json';
import type { Inspection, InspectionSubmission, Trip, Vehicle } from '../types/domain';

export const CURRENT_DRIVER_NAME = 'Carlos Gómez';

let vehicles: Vehicle[] = (vehiclesSeed as Vehicle[]).map((v) => ({ ...v }));

let trips: Trip[] = [
  {
    id: 'trip-seed-1',
    vehicleId: 'v3',
    driverName: CURRENT_DRIVER_NAME,
    status: 'open',
    preTripInspectionId: 'insp-seed-1',
    postTripInspectionId: null,
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    endedAt: null,
  },
  {
    id: 'trip-seed-2',
    vehicleId: 'v6',
    driverName: CURRENT_DRIVER_NAME,
    status: 'open',
    preTripInspectionId: 'insp-seed-2',
    postTripInspectionId: null,
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    endedAt: null,
  },
];

let inspections: Inspection[] = [];

let nextId = 1;
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${nextId++}`;
}

export function getVehicles(): Vehicle[] {
  return vehicles.map((v) => ({ ...v }));
}

export function getVehicleById(id: string): Vehicle | undefined {
  const vehicle = vehicles.find((v) => v.id === id);
  return vehicle ? { ...vehicle } : undefined;
}

export function getOpenTripForVehicle(vehicleId: string): Trip | undefined {
  return trips.find((t) => t.vehicleId === vehicleId && t.status === 'open');
}

export function submitPreTrip(payload: InspectionSubmission): { inspection: Inspection; trip: Trip } {
  const vehicle = vehicles.find((v) => v.id === payload.vehicleId);
  if (!vehicle) throw new Error(`Vehículo ${payload.vehicleId} no encontrado`);
  if (vehicle.openTripId) throw new Error('El vehículo ya tiene un viaje abierto');

  const hasBlockingDefect = payload.answers.some((a) => a.defect?.severity === 'blocking');
  const inspectionId = generateId('insp');
  const tripId = generateId('trip');

  const inspection: Inspection = {
    ...payload,
    id: inspectionId,
    tripId,
    hasBlockingDefect,
  };

  const trip: Trip = {
    id: tripId,
    vehicleId: vehicle.id,
    driverName: payload.driverName,
    status: 'open',
    preTripInspectionId: inspectionId,
    postTripInspectionId: null,
    startedAt: payload.timestamp,
    endedAt: null,
  };

  inspections = [...inspections, inspection];
  trips = [...trips, trip];
  vehicles = vehicles.map((v) => (v.id === vehicle.id ? { ...v, openTripId: tripId } : v));

  return { inspection, trip };
}

export function submitPostTrip(
  payload: InspectionSubmission,
  tripId: string,
): { inspection: Inspection; trip: Trip } {
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw new Error(`Viaje ${tripId} no encontrado`);
  if (trip.status !== 'open') throw new Error('El viaje ya está cerrado');

  const hasBlockingDefect = payload.answers.some((a) => a.defect?.severity === 'blocking');
  const inspectionId = generateId('insp');

  const inspection: Inspection = {
    ...payload,
    id: inspectionId,
    tripId,
    hasBlockingDefect,
  };

  const closedTrip: Trip = {
    ...trip,
    status: 'closed',
    postTripInspectionId: inspectionId,
    endedAt: payload.timestamp,
  };

  inspections = [...inspections, inspection];
  trips = trips.map((t) => (t.id === tripId ? closedTrip : t));
  vehicles = vehicles.map((v) => (v.id === trip.vehicleId ? { ...v, openTripId: null } : v));

  return { inspection, trip: closedTrip };
}
