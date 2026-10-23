import type { UserNotification } from '../types/domain';
import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

// Avisos in-app del usuario logueado (CAM-96), cualquier rol. El backend sabe de quién son por el
// token: ningún pedido manda un id de usuario.

/** GET /api/notifications -- los últimos avisos, leídos y sin leer, del más nuevo al más viejo. */
export async function getNotifications(limit = 30): Promise<UserNotification[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${API_BASE_URL}/api/notifications?${params.toString()}`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudieron cargar los avisos');
  const data = (await res.json()) as { items: UserNotification[] };
  return data.items;
}

/** GET /api/notifications/unread-count -- el numerito de la campanita. */
export async function getUnreadNotificationCount(): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo consultar los avisos sin leer');
  const data = (await res.json()) as { count: number };
  return data.count;
}

/** PATCH /api/notifications/{id}/read -- idempotente. */
export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudo marcar el aviso como leído');
}

/** PATCH /api/notifications/read-all */
export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  if (!res.ok) return throwApiError(res, 'No se pudieron marcar los avisos como leídos');
}
