// LCTarefas Service Worker — Web Push + PWA offline básico

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

// ── Push recebido ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'LCTarefas', body: event.data.text() }; }

  const { title = 'LCTarefas', body = '', url = '/today', tag } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/favicon-32.png',
      tag: tag ?? 'lctarefas',
      renotify: true,
      data: { url },
      vibrate: [100, 50, 100],
    })
  );
});

// ── Clique na notificação ──────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/today';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Foca janela existente se houver
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
