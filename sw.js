// Service worker de Mi Negocio: guarda la app en el celular para que funcione sin internet.
//
// IMPORTANTE: cada vez que cambies cualquier archivo de la app, sube CACHE_VERSION
// (y APP_VERSION en js/config.js). Así los celulares bajan la versión nueva y
// muestran el aviso "Hay una versión nueva, toca para actualizar".
const CACHE_VERSION = 'mi-negocio-v1.0.0';

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/db.js',
  './js/format.js',
  './js/ui.js',
  './js/backup.js',
  './js/screens/inicio.js',
  './js/screens/caja.js',
  './js/screens/precio.js',
  './js/screens/ajustes.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_VERSION)
      // cache: 'reload' evita que se guarde una copia vieja que el navegador tenía guardada.
      .then((cache) => cache.addAll(ARCHIVOS.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n.startsWith('mi-negocio-') && n !== CACHE_VERSION).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

// La app avisa cuando la persona toca "Hay una versión nueva, toca para actualizar".
self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'actualizar') self.skipWaiting();
});

// En el computador (localhost) primero se pide al servidor, para ver los cambios al tiro;
// si el servidor está apagado, responde lo guardado igual que en el celular.
const EN_DESARROLLO = ['localhost', '127.0.0.1'].includes(self.location.hostname);

// Primero lo guardado en el celular (cache-first); si no está, internet.
self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // WhatsApp y otros sitios van directo

  const guardado = () =>
    request.mode === 'navigate' ? caches.match('./index.html') : caches.match(request, { ignoreSearch: true });

  if (EN_DESARROLLO) {
    evento.respondWith(fetch(request).catch(() => guardado().then((r) => r || Response.error())));
    return;
  }
  evento.respondWith(guardado().then((r) => r || fetch(request)));
});
