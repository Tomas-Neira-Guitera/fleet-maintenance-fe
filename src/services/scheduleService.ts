import type { ScheduledMaintenance, ScheduleSourceType, ScheduleStatus } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

interface GetScheduleOptions {
  from: string;
  to: string;
  status?: ScheduleStatus;
  vehicleId?: string;
}

/** GET /api/maintenance-schedule -- alimenta el calendario semanal/mensual y el preview del modal de Planificar. */
export async function getSchedule(options: GetScheduleOptions): Promise<ScheduledMaintenance[]> {
  const params = new URLSearchParams({ from: options.from, to: options.to });
  if (options.status) params.set('status', options.status);
  if (options.vehicleId) params.set('vehicleId', options.vehicleId);

  const res = await fetch(`${API_BASE_URL}/api/maintenance-schedule?${params.toString()}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo obtener el calendario de mantenimientos');
  const data = (await res.json()) as { items: ScheduledMaintenance[] };
  return data.items;
}

interface CreateScheduleFromSource {
  sourceType: Exclude<ScheduleSourceType, 'manual'>;
  sourceId: string;
  scheduledAt: string;
  notes?: string;
}

interface CreateManualSchedule {
  sourceType: 'manual';
  vehicleId: string;
  title: string;
  scheduledAt: string;
  notes?: string;
}

export type CreateScheduleInput = CreateScheduleFromSource | CreateManualSchedule;

/** POST /api/maintenance-schedule -- endpoint único: CAM-50 (assignment), CAM-51 (defect) o programación suelta (manual). */
export async function createSchedule(input: CreateScheduleInput): Promise<ScheduledMaintenance> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo programar el mantenimiento');
  return res.json() as Promise<ScheduledMaintenance>;
}

/** PATCH /api/maintenance-schedule/{id} -- reprogramar, cancelar, o marcar realizado (defect/manual). */
export async function updateSchedule(
  id: string,
  changes: { scheduledAt?: string; status?: 'done' | 'cancelled' },
): Promise<ScheduledMaintenance> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance-schedule/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(changes),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo actualizar la programación');
  return res.json() as Promise<ScheduledMaintenance>;
}
