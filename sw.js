const CACHE = 'dcpr-v10';
const CACHE_PREFIX = 'dcpr-';
const ASSETS = [
  "./",
  "./manifest.webmanifest",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
];
const TILE_DOMAINS = [
  "basemaps.cartocdn.com",
  "tile.openstreetmap.org",
  "server.arcgisonline.com"
];

self.addEventListener('install', e => {
  console.log('[SW] Instalando versión:', CACHE);
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] Activando versión:', CACHE);
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE)
          .map(k => {
            console.log('[SW] Eliminando cache antiguo:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Não interceptar chamadas ao backend do Google
  if (url.includes('script.google.com')) return;

  // [V8.2] NETWORK-FIRST para documentos HTML — nunca cachear el HTML principal
  if (e.request.mode === 'navigate' ||
      e.request.destination === 'document' ||
      url.endsWith('.html') ||
      url.endsWith('/') ||
      (!url.includes('.') && !url.includes('cdnjs'))) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          console.log('[SW] HTML desde red:', url);
          return resp;
        })
        .catch(() => {
          console.log('[SW] HTML desde cache (offline):', url);
          return caches.match(e.request);
        })
    );
    return;
  }

  // Cache-First para assets estáticos (CSS, JS, imágenes, tiles)
  const isTile = TILE_DOMAINS.some(d => url.includes(d));
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && (resp.status === 200 || (isTile && resp.type === 'opaque'))) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});
