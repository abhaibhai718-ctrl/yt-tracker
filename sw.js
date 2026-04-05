const CACHE = 'yt-tracker-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

// ── Install: cache all assets ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ─────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fall back to network ──────────────────────────
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Periodic Background Sync: check deadlines daily ───────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'deadline-check') {
    e.waitUntil(checkDeadlines());
  }
});

// ── Push (optional server-sent push) ──────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() || { title: 'YT Tracker', body: 'You have an upcoming deadline.' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'yt-reminder',
      requireInteraction: true,
    })
  );
});

// ── Notification click: open the app ──────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});

// ── Core deadline check logic ──────────────────────────────────────────────
async function checkDeadlines() {
  let channels = [];
  try {
    // Read data from all open clients first
    const allClients = await clients.matchAll({ includeUncontrolled: true });
    // Fall back to a shared cache key we write from the main thread
    const cache = await caches.open(CACHE);
    const dataResp = await cache.match('/__data__');
    if (dataResp) {
      const { channels: saved } = await dataResp.json();
      channels = saved || [];
    }
  } catch (e) {
    return;
  }

  const now = Date.now();
  const shown = new Set();

  for (const ch of channels) {
    for (const phase of (ch.phases || [])) {
      for (const task of (phase.tasks || [])) {
        if (task.done || !task.date) continue;

        const due = new Date(task.date + 'T23:59:59').getTime();
        const days = Math.ceil((due - now) / 86400000);

        if (days < 0 || days > 7) continue;

        const notifKey = `notif-sw-${task.id}-${task.date}`;
        // Use cache to track already-fired notifications (survives across sw restarts)
        const alreadyFired = await caches.open(CACHE)
          .then(c => c.match(notifKey))
          .then(r => !!r);

        if (!alreadyFired && !shown.has(task.id)) {
          const label = days === 0 ? 'Due TODAY' : days === 1 ? 'Due TOMORROW' : `Due in ${days} days`;
          await self.registration.showNotification(`${label} — ${ch.name}`, {
            body: task.name + (task.notes ? `\n${task.notes}` : ''),
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: task.id,
            requireInteraction: days <= 1,
          });
          // Mark as fired by caching a tiny sentinel
          const c = await caches.open(CACHE);
          await c.put(notifKey, new Response('1'));
          shown.add(task.id);
        }
      }
    }
  }
}
