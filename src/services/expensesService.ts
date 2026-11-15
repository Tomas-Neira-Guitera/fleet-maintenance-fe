import type { Expense, VehicleExpenseCategory } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

/**
 * GET /api/expenses -- gastos de OT y operativos del período [from, to), del más reciente al más
 * antiguo (CAM-52, CAM-109). Solo ADMIN. La pestaña Gastos filtra vehículo y categoría en el cliente,
 * sobre este mismo listado: así los gráficos y los totales salen siempre de los mismos datos. El
 * historial de un vehículo (CAM-130) solo necesita los suyos: los pide con `vehicleId`.
 */
export async function getExpenses(period: { from: string; to: string }, vehicleId?: string): Promise<Expense[]> {
  const params = new URLSearchParams(period);
  if (vehicleId) params.set('vehicleId', vehicleId);
  const res = await fetch(`${API_BASE_URL}/api/expenses?${params.toString()}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener los gastos');
  const data = (await res.json()) as { items: Expense[] };
  return data.items;
}

export interface VehicleExpenseInput {
  vehicleId: string;
  /** Día del gasto, YYYY-MM-DD. */
  date: string;
  category: VehicleExpenseCategory;
  description: string;
  amount: number;
}

/** POST /api/expenses -- cargar un gasto operativo (CAM-109). */
export async function createVehicleExpense(input: VehicleExpenseInput): Promise<Expense> {
  const res = await fetch(`${API_BASE_URL}/api/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo cargar el gasto');
  return res.json() as Promise<Expense>;
}

/** PUT /api/expenses/{id} -- editar un gasto operativo (CAM-109). */
export async function updateVehicleExpense(id: string, input: VehicleExpenseInput): Promise<Expense> {
  const res = await fetch(`${API_BASE_URL}/api/expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo guardar el gasto');
  return res.json() as Promise<Expense>;
}

/** DELETE /api/expenses/{id} -- borrar un gasto operativo (CAM-109). */
export async function deleteVehicleExpense(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/expenses/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo borrar el gasto');
}
