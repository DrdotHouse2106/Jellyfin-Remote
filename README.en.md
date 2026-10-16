# Jellyfin Remote

*[Deutsche Version](README.md)*

A minimalist Progressive Web App (PWA) that turns your phone into a remote control and library browser for your [Jellyfin](https://jellyfin.org) server. Written in plain HTML5, CSS3 and ES6 JavaScript – no frameworks, no build step.

> The user interface is in German.

It can be used in three ways:

1. **In the browser from anywhere** – e.g. at `https://jellyfin.example.com/remote/`, right next to your Jellyfin
2. **As an installed PWA** – Safari → Share → "Add to Home Screen"
3. **As a native iPhone app** – the same code, built with [Capacitor](https://capacitorjs.com) in Xcode

## Features

- **Sign-in** with your Jellyfin user account (username/password) or an API token. When served on the same domain as Jellyfin, the server URL is detected automatically.
- **Target device** – lists all active sessions; controllable devices (e.g. Jellyfin on your TV) can be selected.
- **Live search** for movies and episodes with cover art; tap to play on the target device.
- **Remote** – D-pad, OK, Back, Home, on-screen display.
- **Playback** – play/pause, skip ±10 s, stop, volume slider, mute.
- **Now playing** – title, artwork and progress, refreshed every 2 seconds.

## Hosting at `jellyfin.example.com/remote`

1. Start the container: `docker compose up -d --build` (serves the app at `http://<host>:8097/remote/`). Without Docker, copy the contents of `app/` to your web server.
2. Route `/remote/` in your reverse proxy to the container and everything else to Jellyfin as before. Examples for Nginx and Caddy are in [`deploy/`](deploy/); the German README also covers Nginx Proxy Manager and Traefik.
3. Open `https://jellyfin.example.com/remote` in Safari, sign in, then Share → "Add to Home Screen".

## Building the native iPhone app

Requires a Mac with Xcode and Node.js 20+.

```bash
npm install
npm run ios:add      # creates ios/ plus app icons and splash screens
npm run ios:open     # opens Xcode
```

In Xcode select your team under *Signing & Capabilities*, connect your iPhone and press **Run**. After code changes run `npm run ios:sync`. A free Apple ID lets you run the app on your own device for 7 days at a time; the Apple Developer Program removes that limit and enables TestFlight/App Store.

In the native app the server URL has to be entered once (e.g. `https://jellyfin.example.com`). iOS only allows HTTPS by default; plain-HTTP servers require an `NSAppTransportSecurity` exception in `Info.plist`.

## Security

With account sign-in only the access token issued by Jellyfin is stored, never the password. The device shows up in the Jellyfin dashboard and can be revoked there; "Abmelden & Daten löschen" (sign out) also revokes it on the server. `localStorage` is not encrypted. Always use HTTPS for access from outside your home network.
