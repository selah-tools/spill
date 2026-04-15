const VERSION = 'spill-pwa-v1'
const PRECACHE = `${VERSION}:precache`
const RUNTIME = `${VERSION}:runtime`

const scopePath = new URL(self.registration.scope).pathname
const basePath = scopePath.endsWith('/') ? scopePath : `${scopePath}/`

const appShell = [
  basePath,
  `${basePath}index.html`,
  `${basePath}offline.html`,
  `${basePath}manifest.webmanifest`,
  `${basePath}icons/icon-192.png`,
  `${basePath}icons/icon-512.png`,
  `${basePath}icons/icon-192-maskable.png`,
  `${basePath}icons/icon-512-maskable.png`,
  `${basePath}icons/apple-touch-icon.png`,
  `${basePath}icons/favicon-32.png`,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(appShell))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PRECACHE && key !== RUNTIME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

const isCacheableRequest = (request) => {
  if (request.method !== 'GET') return false
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return false
  if (url.pathname.startsWith(`${basePath}api/`)) return false
  return true
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME)

  try {
    const response = await fetch(request)
    if (response && response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return (
      (await cache.match(request)) ||
      (await caches.match(`${basePath}index.html`)) ||
      (await caches.match(`${basePath}offline.html`))
    )
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME)
  const cached = await cache.match(request)

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  return cached || network || fetch(request)
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response && response.ok) {
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (!isCacheableRequest(request)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  const destination = request.destination

  if (
    destination === 'script' ||
    destination === 'style' ||
    destination === 'worker'
  ) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  if (destination === 'image' || destination === 'font') {
    event.respondWith(cacheFirst(request))
  }
})
