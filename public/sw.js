// Офлайн-режим.
// Сторінку (index.html) беремо з мережі, коли вона є, - так оновлення видно з першого відкриття;
// без мережі - зі збереженої копії. Решта файлів (скрипти й стилі з хешем у назві, картинки)
// береться з кешу й тихо оновлюється в мережі (stale-while-revalidate).
// Вбудований голос (voice/*.m4a) завантажується наперед в окремий кеш: файли з хешем у назві
// не змінюються, тож переживають оновлення застосунку і не качаються вдруге.
const CACHE = 'stezhynka-v4';
const VOICE_CACHE = 'stezhynka-voice';
const PAGE_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png'])));
  self.skipWaiting();
});

/** Докачує вбудований голос для гри без інтернету і прибирає файли, яких уже немає. */
async function syncVoice() {
  const list = await fetch('./voice/index.json', { cache: 'no-cache' }).then((r) => r.json());
  const wanted = new Set(list.map((f) => new URL(`./voice/${f}`, self.location.href).href));
  const cache = await caches.open(VOICE_CACHE);
  const have = new Set((await cache.keys()).map((r) => r.url));
  await Promise.all([...have].filter((url) => !wanted.has(url)).map((url) => cache.delete(url)));
  for (const url of wanted) {
    if (!have.has(url)) await cache.add(url).catch(() => undefined);
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== VOICE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
  // Не тримаємо активацію: голос докачується у фоні, а що не встигне - кешується під час гри.
  syncVoice().catch(() => undefined);
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

async function voice(request) {
  const cache = await caches.open(VOICE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
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
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.respondWith(page(request));
  else if (/\/voice\/[0-9a-f]+\.m4a$/.test(url.pathname)) event.respondWith(voice(request));
  else event.respondWith(asset(request));
});
