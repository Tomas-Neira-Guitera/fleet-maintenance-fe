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
  /** true si no puede iniciar un viaje: defecto bloqueante abierto o documento vencido (CAM-89, CAM-127). */
  blocked?: boolean;
  /** Por qué no puede salir (CAM-127); vacío si puede. */
  blockReasons?: BlockReason[];
  /** El viaje abierto, si está "en viaje" (CAM-87). */
  currentTrip?: CurrentTrip | null;
}

export type VehicleStatus = 'available' | 'on-trip';

/** Un motivo de "No disponible" (CAM-127), con el texto ya armado por el backend. */
export interface BlockReason {
  type: 'blocking_defect' | 'expired_document';
  message: string;
}

/** Un usuario, por id y nombre actual. */
export interface UserRef {
  id: string;
  name: string;
}

/** Viaje abierto de un vehículo. openedBy falta en viajes anteriores a CAM-87. */
export interface CurrentTrip {
  startedAt: string;
  openedBy: UserRef | null;
}

export interface Trip {
  id: string;
  vehicleId: string;
  status: 'open' | 'closed';
  startedAt: string;
  endedAt: string | null;
  openedBy?: UserRef | null;
  closedBy?: UserRef | null;
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

/** Ítem de la configuración del checklist de un vehículo (CAM-31). locked: obligatorio. */
export interface VehicleChecklistItem extends ChecklistItemDef {
  origin: 'base' | 'extra';
  enabled: boolean;
  locked: boolean;
}

export type DefectSeverity = 'non-blocking' | 'blocking';
export type DefectStatus = 'open' | 'resuelto';

export interface DefectDetail {
  severity: DefectSeverity;
  /** Título corto del defecto (hasta 30 caracteres, CAM-79). */
  description: string;
  /** Descripción larga, opcional; se puede dictar (CAM-32). */
  details?: string;
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
  /** Descripción larga del defecto (CAM-32); `description` es el título corto. */
  details?: string | null;
}

/** Item de `inspections` en GET /api/vehicles/{id}/history (CAM-22). */
export interface InspectionHistoryItem {
  id: string;
  type: InspectionType;
  timestamp: string;
  driverName?: string | null;
  odometerKm?: number | null;
  notes?: string | null;
  hasBlockingDefect: boolean;
}

/** Item de `maintenance` en GET /api/vehicles/{id}/history: un "marcar como hecho" de un plan (CAM-22). */
export interface MaintenanceHistoryItem {
  id: string;
  planName: string;
  completedAt: string;
  completedKm?: number | null;
  workOrderId?: string | null;
  notes?: string | null;
}

/** Respuesta de GET /api/vehicles/{id}/history (CAM-22). */
export interface VehicleHistory {
  inspections: InspectionHistoryItem[];
  defects: DefectSummary[];
  maintenance: MaintenanceHistoryItem[];
}

export type Role = 'ADMIN' | 'CHOFER' | 'TECNICO';

/** Usuario de GET/POST/PATCH /api/users (CAM-60, CAM-23). Nunca trae la contraseña. */
export interface UserSummary {
  id: string;
  username: string;
  role: Role;
  /** false = desactivado: no puede loguearse (CAM-23). */
  active: boolean;
  /** Para los avisos por email (CAM-117). null si no tiene. */
  email: string | null;
}

/** Actividad de un chofer en un período -- GET /api/users/stats (CAM-91). `defects` incluye los bloqueantes. */
export interface DriverStats {
  userId: string;
  username: string;
  active: boolean;
  trips: number;
  inspections: number;
  defects: number;
  blockingDefects: number;
}

/**
 * Actividad de un técnico -- GET /api/users/stats (CAM-91). `openWorkOrders` es la foto de hoy;
 * el resto es del período. `avgResolutionHours` es null si no finalizó ninguna OT.
 */
export interface TechnicianStats {
  userId: string;
  username: string;
  active: boolean;
  openWorkOrders: number;
  finalizedWorkOrders: number;
  avgResolutionHours: number | null;
  expensesTotal: number;
}

export interface UserStats {
  drivers: DriverStats[];
  technicians: TechnicianStats[];
}

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
  /** CAM-127: si no puede salir y por qué. */
  blocked?: boolean;
  blockReasons?: BlockReason[];
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
  /** CAM-127: el documento que renueva este plan (solo planes por tiempo). */
  documentType?: VehicleDocumentType | null;
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
  /** CAM-127: el documento que renueva el plan, y si el vencimiento sale de ese documento cargado. */
  documentType?: VehicleDocumentType | null;
  dueDateFromDocument?: boolean;
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
  /** OT abierta (asignada o en proceso) vinculada a la programación, si hay una. */
  workOrder?: { id: string; status: WorkOrderStatus; responsible: string | null } | null;
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
  /** Número de la factura o el ticket (CAM-107); null si no se cargó. */
  receiptNumber: string | null;
  /** Foto de la factura o el ticket (CAM-107); null si no se adjuntó. */
  receiptPhotoUrl: string | null;
}

/** De dónde nació la OT de un gasto: un plan (preventivo), un defecto (correctivo) o suelta. */
export type ExpenseOrigin = 'plan' | 'defect' | 'manual';

/** Un gasto de mantenimiento con su vehículo y su OT -- GET /api/expenses (CAM-52). */
export interface Expense {
  id: string;
  /** Cuándo se cargó el gasto. */
  date: string;
  vehicleId: string;
  plate: string | null;
  category: WorkOrderExpenseCategory;
  description: string;
  amount: number;
  workOrderId: string;
  workOrderTitle: string;
  workOrderStatus: WorkOrderStatus;
  origin: ExpenseOrigin;
  executionType: WorkOrderExecutionType;
  /** Número de la factura o el ticket (CAM-107); null si no se cargó. */
  receiptNumber: string | null;
  /** Foto del comprobante (CAM-107); null si no se adjuntó. */
  receiptPhotoUrl: string | null;
}

/**
 * Costo de mantenimiento de un vehículo -- GET /api/vehicles/{id}/costs (CAM-105). firstKnownKm,
 * kmDriven y costPerKm vienen en null cuando no hay km suficientes para calcularlos.
 */
export interface VehicleCosts {
  totalAmount: number;
  last12MonthsAmount: number;
  expenseCount: number;
  currentKm: number;
  firstKnownKm: number | null;
  kmDriven: number | null;
  costPerKm: number | null;
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
  /** Defecto de origen, con gravedad, foto y quién lo reportó (CAM-60). Null si la OT no viene de un defecto. */
  defect: DefectSummary | null;
  assignmentId: string | null;
  title: string;
  description: string | null;
  executionType: WorkOrderExecutionType;
  externalProvider: string | null;
  assignee: string | null;
  /** Usuario TECNICO a cargo (CAM-60), solo en OTs internas. */
  technicianId: string | null;
  technicianUsername: string | null;
  status: WorkOrderStatus;
  closingDescription: string | null;
  expenses: WorkOrderExpense[];
  totalExpenses: number;
  photos: WorkOrderPhoto[];
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}

// ─── Avisos in-app (CAM-96) ────────────────────────────────────────────────

/** Qué originó el aviso. La campanita no lo usa para nada: el texto ya viene armado del backend. */
export type NotificationType =
  | 'work_order_assigned'
  | 'work_order_unassigned'
  | 'work_order_cancelled'
  | 'trip_open_reminder'
  | 'blocking_defect_reported'
  | 'work_order_finalized'
  | 'maintenance_due_soon'
  | 'maintenance_overdue'
  | 'document_due_soon'
  | 'document_expired'
  | 'vehicle_unavailable'
  | 'vehicle_available';

/** Por dónde sale un aviso (CAM-117). */
export type NotificationChannel = 'in_app' | 'push' | 'email';

/** Un tipo de aviso en GET /api/notification-settings (CAM-117). */
export interface NotificationSetting {
  type: NotificationType;
  label: string;
  description: string;
  /** owner: le llega a la persona involucrada (recipientDescription); configurable: a los elegidos. */
  audience: 'owner' | 'configurable';
  recipientDescription: string | null;
  enabled: boolean;
  channels: NotificationChannel[];
  recipientRoles: Role[];
  recipientUserIds: string[];
  /** "Mantenimiento por vencer" (días y km) y "Documento por vencer" (solo días, CAM-127). */
  supportsLead: boolean;
  supportsLeadKm?: boolean;
  leadDays: number | null;
  leadKm: number | null;
  /** false: rige la configuración por defecto. */
  customized: boolean;
}

export interface NotificationSettingInput {
  enabled: boolean;
  channels: NotificationChannel[];
  recipientRoles?: Role[];
  recipientUserIds?: string[];
  leadDays?: number | null;
  leadKm?: number | null;
}

/** GET /api/maintenance-plans/{id}/notifications (CAM-118). custom=false: usa la configuración general. */
export interface PlanNotificationSettings {
  planId: string;
  intervalType: IntervalType;
  custom: boolean;
  enabled: boolean | null;
  channels: NotificationChannel[] | null;
  leadDays: number | null;
  leadKm: number | null;
  general: {
    dueSoonEnabled: boolean;
    overdueEnabled: boolean;
    channels: NotificationChannel[];
    leadDays: number | null;
    leadKm: number | null;
  };
}

export interface PlanNotificationSettingsInput {
  enabled: boolean;
  channels: NotificationChannel[];
  leadDays: number | null;
  leadKm: number | null;
}

/** "UserNotification" y no "Notification", que es la API de notificaciones del navegador. */
export interface UserNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Ruta del front a la que lleva tocarlo ("/vehiculos/{id}", "/"); null si no lleva a ningún lado. */
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

// ─── Documentación del vehículo (CAM-127) ──────────────────────────────────

export type VehicleDocumentType =
  | 'vtv'
  | 'seguro'
  | 'cedula_azul'
  | 'habilitacion_carga'
  | 'cedula_verde'
  | 'titulo'
  | 'otro';

/** al_dia / por_vencer / vencido (desde el día siguiente al vencimiento) / sin_vencimiento. */
export type VehicleDocumentStatus = 'al_dia' | 'por_vencer' | 'vencido' | 'sin_vencimiento';

export interface VehicleDocument {
  id: string;
  vehicleId: string;
  type: VehicleDocumentType;
  typeLabel: string;
  /** Solo en el tipo "otro". */
  name: string | null;
  displayName: string;
  number: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  /** Comprobante (foto o PDF), de POST /api/photos?purpose=document. */
  fileUrl: string | null;
  status: VehicleDocumentStatus;
  /** Días que faltan; negativo si venció. */
  daysToExpiry: number | null;
  /** false: ya se renovó (historial). */
  current: boolean;
  replacedById: string | null;
  createdAt: string;
}

/** GET /api/vehicles/{id}/documents. */
export interface VehicleDocuments {
  items: VehicleDocument[];
  history: VehicleDocument[];
  /** Obligatorios (VTV, seguro) sin documento vigente: se marcan, no bloquean. */
  missingRequired: VehicleDocumentType[];
  /** Anticipación de "por vencer", en días. */
  leadDays: number;
}

/** El documento renovado que se carga junto con el mantenimiento de un plan vinculado (CAM-127). */
export interface DocumentInput {
  number?: string;
  expiresAt: string;
  fileUrl?: string;
}
