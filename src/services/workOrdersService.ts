import type {
  WorkOrder,
  WorkOrderExecutionType,
  WorkOrderExpense,
  WorkOrderExpenseCategory,
  WorkOrderPhoto,
  WorkOrderSourceType,
  WorkOrderStatus,
} from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

export interface GetWorkOrdersOptions {
  vehicleId?: string;
  status?: WorkOrderStatus;
  executionType?: WorkOrderExecutionType;
  technicianId?: string;
}

/** GET /api/work-orders -- listado, con filtros opcionales (CAM-63). */
export async function getWorkOrders(options: GetWorkOrdersOptions = {}): Promise<WorkOrder[]> {
  const params = new URLSearchParams();
  if (options.vehicleId) params.set('vehicleId', options.vehicleId);
  if (options.status) params.set('status', options.status);
  if (options.executionType) params.set('executionType', options.executionType);
  if (options.technicianId) params.set('technicianId', options.technicianId);
  const qs = params.toString();

  const res = await fetch(`${API_BASE_URL}/api/work-orders${qs ? `?${qs}` : ''}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener las órdenes de trabajo');
  const data = (await res.json()) as { items: WorkOrder[] };
  return data.items;
}

/** GET /api/work-orders/{id} -- detalle completo, con gastos y fotos. */
export async function getWorkOrder(id: string): Promise<WorkOrder> {
  const res = await fetch(`${API_BASE_URL}/api/work-orders/${id}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener la orden de trabajo');
  return res.json() as Promise<WorkOrder>;
}

interface CreateWorkOrderFromSource {
  sourceType: Exclude<WorkOrderSourceType, 'manual'>;
  sourceId: string;
  executionType: WorkOrderExecutionType;
  externalProvider?: string;
  assignee?: string;
  technicianId?: string;
  description?: string;
}

interface CreateWorkOrderManual {
  sourceType: 'manual';
  vehicleId: string;
  title: string;
  executionType: WorkOrderExecutionType;
  externalProvider?: string;
  assignee?: string;
  technicianId?: string;
  description?: string;
}

export type CreateWorkOrderInput = CreateWorkOrderFromSource | CreateWorkOrderManual;

export interface CreateWorkOrderResult {
  workOrder: WorkOrder;
  /** false si ya había una OT abierta para ese origen y el backend devolvió esa, sin cambiar sus datos (CAM-60). */
  created: boolean;
}

/** POST /api/work-orders -- crea una OT desde un defecto, una fila programada, o manual (CAM-14). */
export async function createWorkOrder(input: CreateWorkOrderInput): Promise<CreateWorkOrderResult> {
  const res = await fetch(`${API_BASE_URL}/api/work-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo crear la orden de trabajo');
  return { workOrder: (await res.json()) as WorkOrder, created: res.status === 201 };
}

export interface UpdateWorkOrderInput {
  status?: Exclude<WorkOrderStatus, 'asignada'>;
  closingDescription?: string;
  completedKm?: number;
  assignee?: string;
  /** "" desasigna al técnico (CAM-60). */
  technicianId?: string;
  executionType?: WorkOrderExecutionType;
  externalProvider?: string;
  description?: string;
}

/** PATCH /api/work-orders/{id} -- avanzar/cancelar estado, o editar datos mientras está abierta. */
export async function updateWorkOrder(id: string, changes: UpdateWorkOrderInput): Promise<WorkOrder> {
  const res = await fetch(`${API_BASE_URL}/api/work-orders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(changes),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo actualizar la orden de trabajo');
  return res.json() as Promise<WorkOrder>;
}

export interface CreateExpenseInput {
  category: WorkOrderExpenseCategory;
  description: string;
  amount: number;
}

/** POST /api/work-orders/{id}/expenses -- agrega una línea de gasto. */
export async function addWorkOrderExpense(id: string, input: CreateExpenseInput): Promise<WorkOrderExpense> {
  const res = await fetch(`${API_BASE_URL}/api/work-orders/${id}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo agregar el gasto');
  return res.json() as Promise<WorkOrderExpense>;
}

/** DELETE /api/work-orders/{id}/expenses/{expenseId}. */
export async function deleteWorkOrderExpense(id: string, expenseId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/work-orders/${id}/expenses/${expenseId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo borrar el gasto');
}

/** POST /api/work-orders/{id}/photos -- registra una foto ya subida vía POST /api/photos. */
export async function addWorkOrderPhoto(id: string, photoUrl: string): Promise<WorkOrderPhoto> {
  const res = await fetch(`${API_BASE_URL}/api/work-orders/${id}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ photoUrl }),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo agregar la foto');
  return res.json() as Promise<WorkOrderPhoto>;
}

/** DELETE /api/work-orders/{id}/photos/{photoId}. */
export async function deleteWorkOrderPhoto(id: string, photoId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/work-orders/${id}/photos/${photoId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo borrar la foto');
}
