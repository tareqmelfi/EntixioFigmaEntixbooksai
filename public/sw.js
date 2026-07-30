// Service-worker KILL SWITCH.
// Older SW versions (cache-first navigations) could strand browsers on stale or
// looping responses. The SW is no longer used by the app — this file exists so
// every client that still has an old registration updates into this, wipes all
// caches, unregisters itself, and reloads clean.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    } catch (e) { /* caches API unavailable — continue */ }
    try { await self.registration.unregister() } catch (e) { /* noop */ }
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) client.navigate(client.url)
    } catch (e) { /* noop */ }
  })())
})
