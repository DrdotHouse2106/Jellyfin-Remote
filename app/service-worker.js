/**
 * Service Worker – speichert die App-Struktur (App-Shell) für den Offline-Start.
 *
 * Anfragen an den Jellyfin-Server werden bewusst NICHT zwischengespeichert:
 * Sitzungen, Suchergebnisse und Steuerbefehle müssen immer live sein.
 *
 * Nach Änderungen an App-Dateien die Versionsnummer erhöhen,
 * damit alle Geräte die neue Version laden.
 */

const CACHE_NAME = 'jellyfin-remote-v6';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/api.js',
  './js/storage.js',
  './js/ui.js',
  './js/views/setup.js',
  './js/views/sessions.js',
  './js/views/remote.js',
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
      .then((cache) => cache.addAll(APP_SHELL))
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

  // Seitenaufrufe: zuerst Netzwerk (für Updates), offline aus dem Cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // Statische Dateien: sofort aus dem Cache, im Hintergrund aktualisieren (Stale-While-Revalidate).
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
