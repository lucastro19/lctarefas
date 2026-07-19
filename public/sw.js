// LCTarefas Service Worker — Web Push + PWA offline

const CACHE = "lctarefas-v4";
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

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/')) return;

  // HTML: network-first — garante sempre a versão mais recente do app shell
  if (e.request.headers.get('accept')?.includes('text/html') || url.pathname === '/') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Assets com hash (JS/CSS): cache-first — nome muda a cada build, nunca fica stale
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Demais recursos (ícones, manifest): stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => {
        const fresh = fetch(e.request).then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        });
        return cached || fresh;
      })
    )
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

  if (action === 'complete' && taskId) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        const msg = { type: 'COMPLETE_TASK', taskId };
        if (list.length > 0) {
          list[0].postMessage(msg);
          return 'focus' in list[0] ? list[0].focus() : null;
        }
        return clients.openWindow(`/?complete=${taskId}`);
      })
    );
    return;
  }

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
