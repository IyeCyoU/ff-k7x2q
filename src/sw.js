/* Family Fund offline support. Keeps the app (never your data) on the device so it opens without
   internet. build.py fills in the cache name, which changes with every release, and the file list. */
const CACHE = '__CACHE__';
const FILES = __FILES__;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, {cache: 'reload'})))));
  // No skipWaiting: the page asks before switching to a new version.
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('family-fund-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* App page: network first (4 s limit), then the offline copy. Libraries and icons never change within
   a release, so they come from the offline copy. Fonts and other sites are left to the browser. */
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/(vendor|icons)\//.test(u.pathname)) { e.respondWith(caches.match(r).then(h => h || fetch(r))); return; }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(r, {cache: 'no-cache'}).then(res => { if (res && res.ok) cache.put(r, res.clone()); return res; });
    try { const res = await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]); if (res) return res; } catch (err) {}
    return (await cache.match(r, {ignoreSearch: true})) || (r.mode === 'navigate' && await cache.match('./')) || net;
  })());
});
