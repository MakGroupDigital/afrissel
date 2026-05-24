const SW_VERSION = 'v2';
const SHELL_CACHE = `afrisell-shell-${SW_VERSION}`;
const RUNTIME_CACHE = `afrisell-runtime-${SW_VERSION}`;
const MEDIA_CACHE = `afrisell-media-${SW_VERSION}`;
const OFFLINE_URL = '/';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/afrissel-icon.jpeg',
  '/afrissel-logo.jpeg',
  '/afrispay.jpeg',
  '/afrimarket.jpeg',
  '/africhat.jpeg',
  '/biashara.jpeg',
  '/afrimed.jpeg',
  '/afrischool.jpeg',
  '/safari.jpeg',
  '/a-freelance.jpeg'
];

const isSameOrigin = (url) => url.origin === self.location.origin;
const isStaticAsset = (request, url) => (
  isSameOrigin(url) &&
  (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'manifest' ||
    url.pathname.startsWith('/assets/')
  )
);
const isMediaRequest = (request, url) => (
  request.destination === 'image' ||
  request.destination === 'video' ||
  url.hostname.includes('res.cloudinary.com') ||
  url.hostname.includes('cloudinary.com') ||
  url.hostname.includes('firebasestorage.googleapis.com')
);

const trimCache = async (cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  await Promise.all(keys.slice(0, keys.length - maxEntries).map((request) => cache.delete(request)));
};

const cacheFirst = async (request, cacheName) => {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    return Response.error();
  }
};

const staleWhileRevalidate = async (request, cacheName, maxEntries = 80) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
        trimCache(cacheName, maxEntries);
      }
      return response;
    })
    .catch(() => cached || Response.error());

  return cached || networkFetch;
};

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return caches.match(OFFLINE_URL);
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => ![SHELL_CACHE, RUNTIME_CACHE, MEDIA_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.registration.navigationPreload ? self.registration.navigationPreload.enable() : undefined)
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, SHELL_CACHE));
    return;
  }

  if (isStaticAsset(event.request, url)) {
    event.respondWith(cacheFirst(event.request, SHELL_CACHE));
    return;
  }

  if (isMediaRequest(event.request, url)) {
    event.respondWith(staleWhileRevalidate(event.request, MEDIA_CACHE, 120));
    return;
  }

  if (isSameOrigin(url)) {
    event.respondWith(staleWhileRevalidate(event.request, RUNTIME_CACHE, 80));
  }
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'AfriSell',
    body: 'Nouvelle alerte AfriSell.',
    url: '/'
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    payload.body = event.data ? event.data.text() : payload.body;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/afrissel-icon.jpeg',
      badge: '/apple-touch-icon.png',
      data: {
        url: payload.url || '/'
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => 'focus' in client);
      if (existingClient) {
        existingClient.focus();
        if ('navigate' in existingClient) {
          return existingClient.navigate(targetUrl);
        }
        return undefined;
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
