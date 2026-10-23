import { deletePushSubscription, getPushPublicKey, savePushSubscription } from '../services/pushService';

// Push al navegador (CAM-119): service worker, permiso y suscripción. El navegador solo lo
// permite en HTTPS o en localhost; en otro origen `isPushSupported()` da false y no se ofrece.

const SW_URL = '/sw.js';

export function isPushSupported(): boolean {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Se llama una vez al arrancar la app. Si falla, la app anda igual, sin push. */
export function registerServiceWorker(): void {
  if (!isPushSupported()) return;
  navigator.serviceWorker.register(SW_URL).catch((err: unknown) => {
    console.warn('No se pudo registrar el service worker de las notificaciones', err);
  });
}

/** La suscripción de este navegador, si hay una. */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** La clave VAPID viene en base64url; `subscribe` la quiere en bytes. */
function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export type EnablePushResult = 'enabled' | 'denied' | 'dismissed';

/** La clave VAPID pública del servidor, o null si no tiene las push configuradas. */
export { getPushPublicKey };

/**
 * Pide el permiso, suscribe este navegador y se lo pasa al backend. 'denied' si el usuario bloqueó
 * las notificaciones; 'dismissed' si cerró el cartel sin elegir. Otros errores se tiran. El permiso
 * se pide antes que cualquier otra espera: algunos navegadores solo lo muestran justo después del toque.
 */
export async function enablePush(publicKey: string): Promise<EnablePushResult> {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'dismissed';

  const registration = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  // Una suscripción hecha con otra clave (cambiaron las del servidor) no sirve: se rehace.
  const currentKey = subscription?.options.applicationServerKey;
  if (subscription && currentKey && !sameKey(new Uint8Array(currentKey), base64UrlToBytes(publicKey))) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(publicKey),
  });
  await savePushSubscription(subscription.toJSON());
  return 'enabled';
}

function sameKey(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/**
 * Da de baja este navegador, en el backend y en el navegador. Al cerrar sesión se le pasan los
 * headers con el token, que se borra enseguida. No tira: si falla, el siguiente que active las
 * push en esta compu igual se queda con la suscripción.
 */
export async function disablePush(headers?: Record<string, string>): Promise<void> {
  try {
    const subscription = await getCurrentSubscription();
    if (!subscription) return;
    await deletePushSubscription(subscription.endpoint, headers).catch(() => undefined);
    await subscription.unsubscribe();
  } catch (err) {
    console.warn('No se pudieron desactivar las notificaciones de este dispositivo', err);
  }
}
