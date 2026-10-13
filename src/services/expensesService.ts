import type { Expense } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

/**
 * GET /api/expenses -- gastos de todas las OTs cargados en [from, to), del más reciente al más
 * antiguo (CAM-52). Solo ADMIN. Vehículo y categoría se filtran en el cliente, sobre este mismo
 * listado: así los gráficos y los totales salen siempre de los mismos datos.
 */
export async function getExpenses(period: { from: string; to: string }): Promise<Expense[]> {
  const params = new URLSearchParams(period);
  const res = await fetch(`${API_BASE_URL}/api/expenses?${params.toString()}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron obtener los gastos');
  const data = (await res.json()) as { items: Expense[] };
  return data.items;
}
