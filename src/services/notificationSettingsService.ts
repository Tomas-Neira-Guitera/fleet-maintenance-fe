import type {
  NotificationSetting,
  NotificationSettingInput,
  NotificationType,
  PlanNotificationSettings,
  PlanNotificationSettingsInput,
} from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

// Configuración de avisos (CAM-117) y avisos de vencimiento de cada plan (CAM-118). Solo ADMIN.

/** GET /api/notification-settings -- un item por tipo, aunque no se haya guardado nada. */
export async function getNotificationSettings(): Promise<NotificationSetting[]> {
  const res = await fetch(`${API_BASE_URL}/api/notification-settings`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo cargar la configuración de avisos');
  const data = (await res.json()) as { items: NotificationSetting[] };
  return data.items;
}

/** PUT /api/notification-settings/{type} -- reemplaza la configuración del tipo. */
export async function saveNotificationSetting(
  type: NotificationType,
  input: NotificationSettingInput,
): Promise<NotificationSetting> {
  const res = await fetch(`${API_BASE_URL}/api/notification-settings/${type}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo guardar el aviso');
  return res.json() as Promise<NotificationSetting>;
}

/** DELETE /api/notification-settings/{type} -- vuelve a la configuración por defecto. */
export async function resetNotificationSetting(type: NotificationType): Promise<NotificationSetting> {
  const res = await fetch(`${API_BASE_URL}/api/notification-settings/${type}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo restablecer el aviso');
  return res.json() as Promise<NotificationSetting>;
}

/** GET /api/maintenance-plans/{id}/notifications */
export async function getPlanNotificationSettings(planId: string): Promise<PlanNotificationSettings> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance-plans/${encodeURIComponent(planId)}/notifications`, {
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudieron cargar los avisos del plan');
  return res.json() as Promise<PlanNotificationSettings>;
}

/** PUT /api/maintenance-plans/{id}/notifications -- el plan pasa a tener su propia configuración. */
export async function savePlanNotificationSettings(
  planId: string,
  input: PlanNotificationSettingsInput,
): Promise<PlanNotificationSettings> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance-plans/${encodeURIComponent(planId)}/notifications`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!res.ok) return throwApiError(res, 'No se pudieron guardar los avisos del plan');
  return res.json() as Promise<PlanNotificationSettings>;
}

/** DELETE /api/maintenance-plans/{id}/notifications -- el plan vuelve a la configuración general. */
export async function resetPlanNotificationSettings(planId: string): Promise<PlanNotificationSettings> {
  const res = await fetch(`${API_BASE_URL}/api/maintenance-plans/${encodeURIComponent(planId)}/notifications`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudieron restablecer los avisos del plan');
  return res.json() as Promise<PlanNotificationSettings>;
}
