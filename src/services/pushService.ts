import { API_BASE_URL, authHeaders, throwApiError } from './apiClient';

// Push al navegador (CAM-119). La parte del navegador (service worker, permiso, suscripción) está
// en utils/webPush.ts; acá solo las llamadas a la API.

/** GET /api/push/public-key -- null si el servidor no tiene las push configuradas. */
export async function getPushPublicKey(): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/api/push/public-key`, { headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo consultar la configuración de notificaciones');
  const data = (await res.json()) as { publicKey: string | null };
  return data.publicKey;
}

/** POST /api/push/subscriptions -- el body es `PushSubscription.toJSON()` tal cual. */
export async function savePushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/push/subscriptions`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
  if (!res.ok) return throwApiError(res, 'No se pudieron activar las notificaciones');
}

/**
 * DELETE /api/push/subscriptions -- idempotente. Recibe los headers aparte porque al cerrar sesión
 * se llama justo antes de borrar el token.
 */
export async function deletePushSubscription(
  endpoint: string,
  headers: Record<string, string> = authHeaders(),
): Promise<void> {
  const params = new URLSearchParams({ endpoint });
  const res = await fetch(`${API_BASE_URL}/api/push/subscriptions?${params.toString()}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) return throwApiError(res, 'No se pudieron desactivar las notificaciones');
}

/** POST /api/push/test -- devuelve a cuántos navegadores del usuario llegó. */
export async function sendTestPush(): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/api/push/test`, { method: 'POST', headers: authHeaders() });
  if (!res.ok) return throwApiError(res, 'No se pudo mandar la notificación de prueba');
  const data = (await res.json()) as { delivered: number };
  return data.delivered;
}
