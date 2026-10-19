/**
 * Service Worker – speichert die App-Struktur (App-Shell) für den Offline-Start.
 *
 * Strategie „Netzwerk zuerst“: Online wird immer die aktuelle Version vom Server geladen
 * (nach einem Plugin-Update also sofort die neue App), der Zwischenspeicher dient nur
 * als Rückfall ohne Verbindung.
 *
 * Anfragen an die Jellyfin-API werden bewusst NICHT zwischengespeichert:
 * Sitzungen, Suchergebnisse und Steuerbefehle müssen immer live sein.
 */

// Wird beim Plugin-Release automatisch auf die Versionsnummer gesetzt.
const CACHE_NAME = 'jellyfin-remote-1.3.3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/version.js',
  './js/diagnostics.js',
  './js/api.js',
  './js/storage.js',
  './js/ui.js',
  './js/views/setup.js',
  './js/views/sessions.js',
  './js/views/remote.js',
  './js/views/menu.js',
  './js/views/search.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// Installation: App-Shell vollständig zwischenspeichern.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: 'reload' umgeht den HTTP-Cache des Browsers, damit wirklich die neue Version gespeichert wird.
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// Aktivierung: alte Cache-Versionen entfernen.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nur GET-Anfragen der eigenen Herkunft behandeln – alles andere (Jellyfin-API) geht direkt ans Netz.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Versionierte Pfade (…/remote/v1.2.3/js/app.js) unter dem unversionierten Namen speichern.
  const scope = self.registration.scope;
  const cacheKey =
    request.mode === 'navigate'
      ? './index.html'
      : url.href.startsWith(scope)
        ? scope + url.href.slice(scope.length).replace(/^v\d[^/]*\//, '')
        : request;

  // Netzwerk zuerst, bei fehlender Verbindung aus dem Zwischenspeicher.
  // cache: 'no-cache' lässt den Browser immer beim Server nachfragen (ETag → meist 304).
  const networkRequest = request.mode === 'navigate' ? request : new Request(request, { cache: 'no-cache' });
  event.respondWith(
    fetch(networkRequest)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy));
        }
        return response;
      })
      .catch(() => caches.match(cacheKey)),
  );
});
