const CACHE_PREFIX = 'ascii-atelier-wilds-'
const CACHE_NAME = `${CACHE_PREFIX}v4`
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest?v=wilds-1',
  './src/app.js?v=wilds-1',
  './src/game.js',
  './src/world.js',
  './src/generator.js',
  './src/inspirations.js',
  './src/export.js',
  './src/styles.css?v=wilds-1',
  './src/assets/ascii-wilds-icon.svg',
  './src/assets/ascii-wilds-icon-180.png',
  './src/assets/ascii-wilds-icon-192.png',
  './src/assets/ascii-wilds-icon-512.png',
  './src/assets/ascii-wilds-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('./index.html')),
    )
    return
  }

  const refresh = fetch(event.request).then(async (response) => {
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(event.request, response.clone())
    }
    return response
  })
  event.waitUntil(refresh.then(() => undefined, () => undefined))
  event.respondWith(caches.match(event.request).then((cached) => cached || refresh))
})
