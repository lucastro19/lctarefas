// LCTarefas Service Worker — Web Push + PWA offline

const CACHE = "lctarefas-v2";
const PRECACHE = ["/", "/index.html", "/icon-192.png", "/icon-512.png"];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// Cache-first for static assets, network-first for API
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Skip non-GET and Supabase API requests
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/')) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        }
        return res;
      });
      return cached || fresh;
    })
  );
});

// ── Push recebido ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'LCTarefas', body: event.data.text() }; }

  const { title = 'LCTarefas', body = '', url = '/today', tag, taskId } = payload;

  const actions = taskId
    ? [
        { action: 'complete', title: '✓ Concluir' },
        { action: 'snooze',   title: '⏰ +30 min'  },
      ]
    : [];

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/favicon-32.png',
      tag: tag ?? 'lctarefas',
      renotify: true,
      data: { url, taskId },
      vibrate: [100, 50, 100],
      actions,
    })
  );
});

// ── Clique / ação na notificação ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { taskId, url } = event.notification.data ?? {};
  const action = event.action;

  // Ação: Concluir tarefa
  if (action === 'complete' && taskId) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        const msg = { type: 'COMPLETE_TASK', taskId };
        if (list.length > 0) {
          list[0].postMessage(msg);
          return 'focus' in list[0] ? list[0].focus() : null;
        }
        // App fechado: abre e passa o taskId via query string para completar ao carregar
        return clients.openWindow(`/?complete=${taskId}`);
      })
    );
    return;
  }

  // Ação: Adiar 30 minutos
  if (action === 'snooze' && taskId) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        const msg = { type: 'SNOOZE_TASK', taskId, minutes: 30 };
        if (list.length > 0) {
          list[0].postMessage(msg);
          return 'focus' in list[0] ? list[0].focus() : null;
        }
        return clients.openWindow(`/?snooze=${taskId}&minutes=30`);
      })
    );
    return;
  }

  // Clique padrão: abre/foca o app na URL da tarefa
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const target = url ?? '/today';
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
