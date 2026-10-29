# Jellyfin Remote

[![Buy me a coffee](https://img.shields.io/badge/☕_Buy_me_a_coffee-PayPal-0070ba?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/DrdotHouse)

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

## Troubleshooting

Common pitfalls during installation and use (symptom → cause → fix). The [German README](README.md#häufige-probleme) has the full list and is kept up to date first.

- **Plugin missing from the catalog / update not offered** – check the repository URL under *Dashboard → Plugins → Repositories*. The combined repository picks up new versions every 15 minutes, and Jellyfin itself only refreshes repositories occasionally; you can run the plugin update task under *Dashboard → Scheduled Tasks*.
- **`/remote/`, menu entry or settings page missing after install** – restart Jellyfin, then reload open Jellyfin windows (Ctrl + F5); fully close and reopen the Jellyfin mobile app.
- **Old version still active after an update** – keep only **one** "Jellyfin Remote_…" folder in the `plugins` folder of the Jellyfin data directory and restart Jellyfin.
- **D-pad takes double steps or only works after reloading** – the controlled Jellyfin window still runs the script of an older plugin version; reload it after every plugin update.
- **Where is the configuration?** – the plugin settings are stored in `plugins/configurations/Jellyfin.Plugin.Remote.xml` inside the Jellyfin data directory (Docker usually `/config`, Linux package `/var/lib/jellyfin`, Windows `%ProgramData%\Jellyfin\Server`); back up this file or the whole data directory. The remote's own data (server, token, target device) lives only in the phone's browser/app storage – just sign in again on a new device.
- **No automatic sign-in from Jellyfin** – enable Quick Connect (*Dashboard → General*) or sign in with username and password.
- **Quick Connect code rejected** – confirm it in an **already signed-in** Jellyfin app (*Settings → Quick Connect*) while it is still shown.
- **"Link ignoriert: Er verweist auf einen fremden Server"** – the `?server=…` link points to a different server than the one serving the remote (protection against injected servers). Open the remote via your own server's `/remote/` or use the QR code.
- **"Server nicht erreichbar" / mixed content** – the app runs on HTTPS but the server on HTTP; enter the address with the correct scheme (the app assumes HTTPS when none is given). The iPhone app needs an `Info.plist` exception for plain HTTP.
- **QR code shows the wrong address** – set the **public URL** in the plugin settings.
- **A device is missing** – Jellyfin must be open on it. Devices of other users only appear if your account may control them (*Dashboard → Users → Profile → allow remote control of other users / shared devices*).
- **Device listed but not controllable** – usually the reverse proxy blocks WebSockets (Nginx: add a `location /socket` block with `Upgrade`/`Connection` headers; Nginx Proxy Manager: enable "Websockets Support"). Keep the controlled browser tab in the foreground.
- **Search results appear on the phone instead of the TV** – enable the "Auf dem Fernseher anzeigen" switch in the remote's search.
- **Arrow keys behave differently in the browser** – in the TV layout, during playback and in dialogs the Jellyfin web client handles navigation itself; choose the normal layout under *Settings → Display → Layout*.
- **OSD button does nothing in the browser** – the Jellyfin web client does not implement this command (TV apps do).
- **Remote icon missing in the header on a computer** – since 1.3.3 it is shown on phones and tablets only; turn off "Symbol nur auf Handys und Tablets" in the plugin settings. The menu entry is always available.
- **Installed home-screen app opens with a browser bar after an update** – versions before 1.3.7 installed it under the versioned path; remove it once and add it again.
- **Diagnostics log stays empty** – after enabling it, reload both the remote and the controlled Jellyfin windows. The log is kept in memory only and visible to administrators.

## Security

With account sign-in only the access token issued by Jellyfin is stored, never the password. The device shows up in the Jellyfin dashboard and can be revoked there; "Abmelden & Daten löschen" (sign out) also revokes it on the server. `localStorage` is not encrypted. Always use HTTPS for access from outside your home network.

When the user or server changes (including the automatic sign-in from within Jellyfin), the old token is signed out on the server first, so no valid tokens are left behind. Links with `?server=…` are only accepted by the web app if they point to its own server; the iPhone app asks for confirmation before using `jellyfinremote://connect?server=…`. A server address entered without a scheme defaults to HTTPS.

The files served by the plugin (`/remote/…`, `/JellyfinRemote/…`) are public but contain only the app itself; `GET /JellyfinRemote/Info` does not reveal any settings such as the public server URL. The release workflow builds exactly the pushed tag, validates the version input (no shell injection) and pins all GitHub Actions to commit SHAs; the build tools (`@capacitor/assets`, `http-server`) are pinned dev dependencies instead of being fetched via `npx`. The diagnostics log records pages without parameters and never search terms or SendString texts.

## Support the project

Development costs time and money (servers, test devices, AI tools). If you like the project, a small donation is very welcome:

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-0070ba?logo=paypal&logoColor=white)](https://paypal.me/DrdotHouse)

### 🎮 Got a gamer streak too?

Then my other project might be just right for you: **[ZockerDB](https://zockerdb.de)** – your game
collection in one place. Track games, consoles and accessories (including barcode scanning with your
phone), rate and manage them, with price history, editions and PAL/USK details. Use it directly at
[zockerdb.de](https://zockerdb.de) or self-host [ZockerDB Basis](https://github.com/DrdotHouse2106/ZockerDBBasis) on your own server.

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE) (GPL-3.0).
