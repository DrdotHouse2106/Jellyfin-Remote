# Jellyfin Remote

*[Deutsche Version](README.md)*

A minimalist Progressive Web App (PWA) that turns your phone into a remote control and library browser for your [Jellyfin](https://jellyfin.org) server. Written in plain HTML5, CSS3 and ES6 JavaScript – no frameworks, no build step.

> The user interface is in German.

## Features

- **Setup** – enter server URL and API token, check them against `/System/Info` with "Verbindung testen" (test connection) and store them locally.
- **Target device** – lists all active sessions (`/Sessions`); controllable devices (e.g. Jellyfin on your TV) can be selected.
- **Live search** – debounced search for movies and episodes with cover art. Tapping a result starts playback on the target device immediately.
- **Remote** – D-pad (up, down, left, right, OK) plus Back, Home and on-screen display.
- **Playback** – play/pause, skip 10 seconds back/forward, stop, volume slider and mute.
- **Now playing** – title, artwork and progress, refreshed every 2 seconds.
- **PWA** – installable on iPhone via Safari → Share → "Add to Home Screen". The app shell is cached offline by a service worker.

## Jellyfin endpoints used

| Feature | Endpoint |
| --- | --- |
| Connection test | `GET /System/Info` |
| Sessions | `GET /Sessions` |
| Search | `GET /Items?SearchTerm=…&IncludeItemTypes=Movie,Episode&Recursive=true` |
| Play | `POST /Sessions/{SessionId}/Playing?playCommand=PlayNow&itemIds={ItemId}` |
| Navigation | `POST /Sessions/{SessionId}/Command/{MoveUp\|MoveDown\|MoveLeft\|MoveRight\|Select\|Back\|GoHome\|ToggleOsd\|ToggleMute}` |
| Play/pause, stop | `POST /Sessions/{SessionId}/Playing/{PlayPause\|Stop}` |
| Skip 10 s | `POST /Sessions/{SessionId}/Playing/Seek?seekPositionTicks=…` |
| Volume | `POST /Sessions/{SessionId}/Command` with `{"Name":"SetVolume","Arguments":{"Volume":"50"}}` |

> **Note:** Jellyfin starts playback via `POST /Sessions/{id}/Playing` with `playCommand=PlayNow` and `itemIds`. There is no `/Playing/Play` endpoint – `/Playing/{command}` is only for playstate commands (pause, stop, seek …).

Because Jellyfin assigns a new session ID whenever a client reconnects, the app remembers the target's **device ID** and re-resolves the current session automatically.

## Setup

1. Create an API key in Jellyfin under **Dashboard → API Keys → "+"**.
2. Serve the static files with any web server, e.g. `python3 -m http.server 8080`.
3. On the iPhone open the URL in **Safari** → **Share** → **"Add to Home Screen"**.

## HTTP, HTTPS and offline mode

- If the app is served over **HTTPS**, the Jellyfin server must also use **HTTPS** (browsers block mixed content).
- The service worker (offline cache) requires a secure context (HTTPS or `localhost`). Over plain HTTP the app still works and can be added to the home screen, just without offline caching.
- Recommended: serve the app via the same HTTPS reverse proxy as Jellyfin, e.g. `https://jellyfin.example.com/remote/`.
- Bump `CACHE_NAME` in `service-worker.js` after changing app files so installed apps pick up the new version.

## Security

Server URL and API token are stored in the browser's `localStorage`, which is **not encrypted**. Use a dedicated API key for this app that you can revoke in the dashboard at any time. "Gespeicherte Daten löschen" in the settings removes all stored data.
