/* FinanZen - Service Worker (PWA offline) */
const VERSION = 'finanzen-v1.1.2';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/state.js',
  './js/charts.js',
  './js/app.js',
  './js/sync.js',
  './js/sync-config.js',
  './js/vendor/supabase.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg'
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' })));

    const runtime = await caches.open(RUNTIME_CACHE);
    await Promise.all(CDN_ASSETS.map(async url => {
      try {
        const res = await fetch(url, { mode: 'no-cors' });
        await runtime.put(url, res);
      } catch (e) {
        // Sem rede no primeiro install: segue offline com o que houver
      }
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => !key.startsWith(VERSION))
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isNavigation(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navegação: rede primeiro, cache como fallback offline
  if (isNavigation(request)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Recursos do mesmo domínio: cache-first com atualização em segundo plano
  if (url.origin === self.location.origin) {
    // Config de sincronização: rede primeiro (o usuário costuma editá-la no GitHub)
    if (url.pathname.endsWith('/sync-config.js')) {
      event.respondWith((async () => {
        const cache = await caches.open(SHELL_CACHE);
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch (e) {
          return (await cache.match(request)) || Response.error();
        }
      })());
      return;
    }

    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      const network = fetch(request).then(res => {
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await network) || Response.error();
    })());
    return;
  }

  // CDNs e fontes: stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    }).catch(() => null);

    if (cached) return cached;
    const res = await network;
    if (res) return res;
    return new Response('', { status: 504, statusText: 'Offline' });
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
