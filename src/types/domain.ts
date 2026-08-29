// Domain types shared across the driver DVIR (vehicle inspection) flow.

export type AccessoryKey = 'faja' | 'traca' | 'grua' | 'rampa';

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  /** Extra equipment this vehicle carries; each one adds an extra checklist item. */
  accessories: AccessoryKey[];
  /** Id of the currently open trip for this vehicle, or null if none is open. */
  openTripId: string | null;
}

export type VehicleStatus = 'available' | 'on-trip';

export function getVehicleStatus(vehicle: Pick<Vehicle, 'openTripId'>): VehicleStatus {
  return vehicle.openTripId ? 'on-trip' : 'available';
}

export interface Trip {
  id: string;
  vehicleId: string;
  driverName: string;
  status: 'open' | 'closed';
  preTripInspectionId: string;
  postTripInspectionId: string | null;
  startedAt: string;
  endedAt: string | null;
}

export type ChecklistItemType = 'check' | 'number';
export type ChecklistSection = 'exterior' | 'interior' | 'accesorios' | 'posttrip';

export interface ChecklistItemDef {
  id: string;
  label: string;
  type: ChecklistItemType;
  section: ChecklistSection;
  required?: boolean;
}

export type DefectSeverity = 'non-blocking' | 'blocking';

export interface DefectDetail {
  severity: DefectSeverity;
  description: string;
  photoDataUrl?: string;
  photoFileName?: string;
}

export type CheckOutcome = 'ok' | 'defect';

/** Live editable state for one checklist item while the driver fills the form. */
export interface ChecklistItemState {
  outcome?: CheckOutcome; // 'check' items
  numberValue?: string; // 'number' items
  defect?: DefectDetail;
}

/** Frozen answer for one checklist item, as sent to submitPreTrip/submitPostTrip. */
export interface ChecklistAnswer {
  itemId: string;
  label: string;
  section: ChecklistSection;
  type: ChecklistItemType;
  outcome?: CheckOutcome;
  numberValue?: string;
  defect?: DefectDetail;
}

export type InspectionType = 'pre-trip' | 'post-trip';

export interface InspectionSubmission {
  vehicleId: string;
  driverName: string;
  type: InspectionType;
  timestamp: string;
  odometerKm: number;
  answers: ChecklistAnswer[];
  notes?: string;
}

export interface Inspection extends InspectionSubmission {
  id: string;
  tripId: string;
  hasBlockingDefect: boolean;
}

export interface SubmitPreTripResult {
  inspection: Inspection;
  trip: Trip;
}

export interface SubmitPostTripResult {
  inspection: Inspection;
  trip: Trip;
}
