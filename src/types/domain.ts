// Tipos de dominio compartidos por el flujo de inspección DVIR del chofer.

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  status: VehicleStatus;
}

export type VehicleStatus = 'available' | 'on-trip';

export interface Trip {
  id: string;
  vehicleId: string;
  status: 'open' | 'closed';
  startedAt: string;
  endedAt: string | null;
}

export type ChecklistItemType = 'check' | 'number';
export type ChecklistSection = 'exterior' | 'interior' | 'posttrip';

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
  photoUrl?: string;
}

export type CheckOutcome = 'ok' | 'defect';

/** Estado editable de un ítem del checklist mientras el chofer completa el formulario. */
export interface ChecklistItemState {
  outcome?: CheckOutcome;
  numberValue?: string;
  defect?: DefectDetail;
  /** true mientras la foto del defecto se está subiendo al backend. */
  uploading?: boolean;
}

/** Respuesta congelada de un ítem del checklist, usada en la UI (resumen) y para armar el envío. */
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

export interface Inspection {
  id: string;
  tripId: string;
  vehicleId: string;
  driverId: string;
  type: InspectionType;
  timestamp: string;
  odometerKm: number;
  answers: ChecklistAnswer[];
  notes?: string;
  hasBlockingDefect: boolean;
}

export interface SubmitInspectionResult {
  inspection: Inspection;
  trip: Trip;
}

/** Defecto reportado en una inspección, tal como lo lista GET /api/defects. */
export interface DefectSummary {
  id: string;
  severity: DefectSeverity;
  description: string;
  photoUrl?: string;
  createdAt: string;
  vehiclePlate: string;
  status: 'open';
}
