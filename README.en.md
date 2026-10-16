# Jellyfin Remote

*[Deutsche Version](README.md)*

A minimalist Progressive Web App (PWA) that turns your phone into a remote control and library browser for your [Jellyfin](https://jellyfin.org) server. Written in plain HTML5, CSS3 and ES6 JavaScript – no frameworks, no build step.

> The user interface is in German.

It can be used in three ways:

1. **As a Jellyfin plugin** – the app is served directly by Jellyfin at `https://jellyfin.example.com/remote/` and linked in the web client. No extra server, no Docker, no proxy changes.
2. **As an installed PWA** – Safari → Share → "Add to Home Screen"
3. **As a native iPhone app** – the same code, built with [Capacitor](https://capacitorjs.com) in Xcode; pairs with the plugin via QR code

## Features

- **Sign-in** with your Jellyfin user account (username/password), **Quick Connect** (confirm a code in a signed-in Jellyfin app – no password) or an API token. Opened from within Jellyfin, the remote is **signed in automatically**. When served on the same domain as Jellyfin, the server URL is detected automatically.
- **Target device** – lists all active sessions; controllable devices (e.g. Jellyfin on your TV) can be selected.
- **Live search** for movies and episodes with cover art; tap to play on the target device.
- **Remote** – D-pad, OK, Back, Home, on-screen display.
- **Playback** – play/pause, skip ±10 s, stop, volume slider, mute.
- **Now playing** – title, artwork and progress, refreshed every 2 seconds.
- **Menu** – open sections (home, search, settings) and libraries directly on the TV. With the TV app [Quallenkino](https://github.com/DrdotHouse2106/Jellyfin-TV-Client) (Android TV / Fire TV) also the live TV guide, recordings, the TV's apps (Netflix, YouTube, …) and its settings (Wi-Fi, Bluetooth, display, sound).

## Jellyfin plugin (Jellyfin 12.2+)

1. In the dashboard go to **Plugins → Repositories → "+"** and add the combined repository of all DrdotHouse2106 plugins ([Jellyfin-Plugins](https://github.com/DrdotHouse2106/Jellyfin-Plugins)):
   `https://raw.githubusercontent.com/DrdotHouse2106/Jellyfin-Plugins/main/manifest.json`
   (or just this plugin: `https://raw.githubusercontent.com/DrdotHouse2106/Jellyfin-Remote/main/jellyfin-repository.json`)
2. Install **Jellyfin Remote** from the catalog and restart Jellyfin.
3. Open `https://jellyfin.example.com/remote` and sign in with your Jellyfin account.

The plugin
- serves the app at `/remote/` (server URL is detected automatically, base URLs are supported),
- signs the remote in automatically when it is opened from Jellyfin (browser or the Jellyfin iOS/Android app): a separate token is issued via Quick Connect using your existing session (requires Quick Connect to be enabled),
- adds a "Fernbedienung" (remote) entry to the web client menu and a remote icon next to the search button – without modifying any files on disk,
- has a settings page with QR codes to open the web app or pair the iPhone app (`jellyfinremote://connect?server=…`),
- exposes `GET /JellyfinRemote/Info` so the apps can detect it.

New releases are built by the GitHub Action in `.github/workflows/plugin-release.yml` when a tag like `v1.0.1` is pushed.

## Building the native iPhone app

Requires a Mac with Xcode and Node.js 20+.

```bash
npm install
npm run ios:add      # creates ios/, the URL scheme, app icons and splash screens
npm run ios:open     # opens Xcode
```

In Xcode select your team under *Signing & Capabilities*, connect your iPhone and press **Run**. After code changes run `npm run ios:sync`. A free Apple ID lets you run the app on your own device for 7 days at a time; the Apple Developer Program removes that limit and enables TestFlight/App Store.

The iPhone app needs no server of its own – all files are bundled. Scan the pairing QR code from the plugin settings to fill in the server URL, or enter it once by hand. iOS only allows HTTPS by default; plain-HTTP servers require an `NSAppTransportSecurity` exception in `Info.plist`.

## Security

With account sign-in only the access token issued by Jellyfin is stored, never the password. The device shows up in the Jellyfin dashboard and can be revoked there; "Abmelden & Daten löschen" (sign out) also revokes it on the server. `localStorage` is not encrypted. Always use HTTPS for access from outside your home network.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE) (GPL-3.0).
