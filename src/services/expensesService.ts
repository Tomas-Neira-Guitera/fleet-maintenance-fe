import type { Expense } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

/**
 * GET /api/expenses -- gastos de todas las OTs cargados en [from, to), del más reciente al más
 * antiguo (CAM-52). Solo ADMIN. La pestaña Gastos filtra vehículo y categoría en el cliente, sobre
 * este mismo listado: así los gráficos y los totales salen siempre de los mismos datos. El historial
 * de un vehículo (CAM-130) solo necesita los suyos: los pide con `vehicleId`.
 */
export async function getExpenses(period: { from: string; to: string }, vehicleId?: string): Promise<Expense[]> {
  const params = new URLSearchParams(period);
  if (vehicleId) params.set('vehicleId', vehicleId);
  const res = await fetch(`${API_BASE_URL}/api/expenses?${params.toString()}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener los gastos');
  const data = (await res.json()) as { items: Expense[] };
  return data.items;
}
