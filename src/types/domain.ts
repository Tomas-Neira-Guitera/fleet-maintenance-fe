// Tipos de dominio compartidos por el flujo de inspección DVIR del chofer.

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  status: VehicleStatus;
  vehicleType?: string | null;
  year?: number | null;
  chassisNumber?: string | null;
  odometerKm?: number;
  active?: boolean;
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
export type DefectStatus = 'open' | 'resuelto';

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
  vehicleId: string;
  vehiclePlate: string;
  status: DefectStatus;
  reportedBy?: string | null;
}

export type Role = 'ADMIN' | 'CHOFER';

/** Respuesta de POST /api/auth/login (CAM-43). */
export interface LoginResult {
  token: string;
  role: Role;
}

// --- Estado de flota / mantenimiento preventivo (CAM-40) ---
// Ver claude/CAM-40-modelo-mantenimiento-preventivo.md y
// claude/CAM-40-maintenance-api-contract.md en el proyecto de FleetGuard.

export type MaintenanceRowStatus = 'al_dia' | 'por_vencer' | 'vencido';

export interface NextMaintenanceSummary {
  assignmentId: string;
  name: string;
  status: MaintenanceRowStatus;
  dueDate: string | null;
  dueKm: number | null;
  remainingDays: number | null;
  remainingKm: number | null;
}

/** Una fila del componente "Estado de la flota" -- GET /api/vehicles?view=fleet-status. */
export interface FleetStatusRow {
  vehicleId: string;
  plate: string;
  brand: string;
  model: string;
  vehicleType: string | null;
  odometerKm: number;
  healthScore: number;
  status: MaintenanceRowStatus;
  nextMaintenance: NextMaintenanceSummary | null;
}

export interface FleetStatusPage {
  page: number;
  pageSize: number;
  total: number;
  items: FleetStatusRow[];
}

export type IntervalType = 'km' | 'time' | 'both';

/** Un plan del catálogo -- GET/POST /api/maintenance-plans (CAM-47). */
export interface MaintenancePlan {
  id: string;
  name: string;
  category: string | null;
  intervalType: IntervalType;
  intervalKm: number | null;
  intervalDays: number | null;
  active: boolean;
}

/** Un plan asignado a un vehículo puntual -- GET /api/vehicles/{id}/maintenance-assignments (CAM-40). */
export interface MaintenanceAssignment {
  id: string;
  vehicleId: string;
  maintenancePlanId: string;
  planName: string;
  intervalType: IntervalType;
  lastDoneKm: number | null;
  lastDoneDate: string | null;
  nextDueKm: number | null;
  nextDueDate: string | null;
  status: MaintenanceRowStatus;
  active: boolean;
}

/** Subconjunto de MaintenanceAssignment que devuelve un completion para refrescar el chip de estado. */
export interface AssignmentSummary {
  id: string;
  nextDueKm: number | null;
  nextDueDate: string | null;
  status: MaintenanceRowStatus;
}

/** Respuesta de POST .../maintenance-assignments/{id}/completions -- registrar que se hizo el mantenimiento. */
export interface CompletionResult {
  id: string;
  assignmentId: string;
  completedAt: string;
  completedKm: number | null;
  workOrderId: string | null;
  notes: string | null;
  updatedAssignment: AssignmentSummary;
}

// --- Programación de mantenimientos y arreglos (CAM-42, CAM-50, CAM-51) ---
// Ver claude/CAM-42-programacion-mantenimientos.md en el proyecto de FleetGuard.

export type ScheduleSourceType = 'assignment' | 'defect' | 'manual';
export type ScheduleStatus = 'scheduled' | 'done' | 'cancelled';

/** Cuándo se planea hacer un mantenimiento o resolver un defecto -- distinto de
 * nextDue* (calculado) y de MaintenanceCompletion (historial de cuándo ya se hizo). */
export interface ScheduledMaintenance {
  id: string;
  vehicleId: string;
  plate: string | null;
  sourceType: ScheduleSourceType;
  assignmentId: string | null;
  defectId: string | null;
  title: string;
  scheduledAt: string;
  status: ScheduleStatus;
  notes: string | null;
}

// --- Órdenes de trabajo (CAM-14/CAM-15/CAM-62/CAM-63) ---
// Ver claude/CAM-14-ordenes-de-trabajo.md en el proyecto de FleetGuard.

export type WorkOrderSourceType = 'scheduled_maintenance' | 'defect' | 'manual';
export type WorkOrderExecutionType = 'interno' | 'externo';
export type WorkOrderStatus = 'asignada' | 'en_proceso' | 'finalizada' | 'cancelada';
export type WorkOrderExpenseCategory = 'repuesto' | 'mano_de_obra' | 'otro';

export interface WorkOrderExpense {
  id: string;
  category: WorkOrderExpenseCategory;
  description: string;
  amount: number;
  createdAt: string;
}

export interface WorkOrderPhoto {
  id: string;
  photoUrl: string;
  createdAt: string;
}

/** Una orden de trabajo -- GET/POST/PATCH /api/work-orders. */
export interface WorkOrder {
  id: string;
  vehicleId: string;
  plate: string | null;
  sourceType: WorkOrderSourceType;
  scheduledMaintenanceId: string | null;
  defectId: string | null;
  assignmentId: string | null;
  title: string;
  description: string | null;
  executionType: WorkOrderExecutionType;
  externalProvider: string | null;
  assignee: string | null;
  status: WorkOrderStatus;
  closingDescription: string | null;
  expenses: WorkOrderExpense[];
  totalExpenses: number;
  photos: WorkOrderPhoto[];
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}
