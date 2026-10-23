// Service worker de FleetGuard (CAM-119): recibe las push del backend y las muestra como
// notificación del sistema, aunque la app esté cerrada. No cachea nada: no es una app offline.
// Va en public/ y no en src/ porque el navegador lo pide por su URL (/sw.js), sin pasar por Vite.

// Que tome el control de las pestañas abiertas ya, sin esperar a que se recarguen: sobre una pestaña
// que no controla no puede navegar al tocar la notificación.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Un mensaje que no es JSON se muestra igual, como texto.
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'FleetGuard';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: { link: data.link || '/' },
    }),
  );
});

// Tocar la notificación trae al frente una pestaña de FleetGuard que ya esté abierta y la lleva a la
// pantalla del aviso; si no hay ninguna, o no se puede navegar en ella, abre una nueva. Primero el
// foco: algunos navegadores solo dejan enfocar justo después del toque.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.link || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (!client) return self.clients.openWindow(url);
      const focused = await client.focus();
      if (focused.url === url) return focused;
      try {
        return await focused.navigate(url);
      } catch {
        return self.clients.openWindow(url);
      }
    })(),
  );
});
