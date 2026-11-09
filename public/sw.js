// Офлайн-режим.
// Сторінку (index.html) беремо з мережі, коли вона є, - так оновлення видно з першого відкриття;
// без мережі - зі збереженої копії. Решта файлів (скрипти й стилі з хешем у назві, картинки)
// береться з кешу й тихо оновлюється в мережі (stale-while-revalidate).
const CACHE = 'stezhynka-v3';
const PAGE_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    // Повільна мережа не повинна тримати дитину перед білим екраном: після паузи - збережена копія.
    const response = await Promise.race([
      fetch(request, { cache: 'no-cache' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), PAGE_TIMEOUT_MS)),
    ]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) ?? (await cache.match('./index.html')) ?? Response.error();
  }
}

async function asset(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached ?? Response.error());
  return cached ?? network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? page(request) : asset(request));
});
