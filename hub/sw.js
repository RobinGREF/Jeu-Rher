// Service worker minimal : rend l'accueil installable et garde sa page en cache pour s'ouvrir sans réseau.
// Les jeux ne sont jamais servis depuis ce cache (toujours le réseau), pour ne pas figer une ancienne version.
const CACHE = 'hub-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'games.json', 'icons/hub-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isHub = url.pathname === new URL('./', self.location).pathname || url.pathname.endsWith('/games.json') || url.pathname.endsWith('/icons/hub-192.png');
  if (e.request.method !== 'GET' || !isHub) return; // les jeux : réseau normal
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
