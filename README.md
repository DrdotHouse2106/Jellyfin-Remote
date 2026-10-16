# Jellyfin Remote

*[English version](README.en.md)*

Eine minimalistische Progressive Web App (PWA), die dein Smartphone in eine Fernbedienung und einen Mediathek-Browser für deinen [Jellyfin](https://jellyfin.org)-Server verwandelt. Geschrieben in reinem HTML5, CSS3 und ES6-JavaScript – ohne Frameworks, ohne Build-Schritt.

Die App lässt sich auf drei Arten nutzen:

1. **Als Jellyfin-Plugin** – die App ist danach direkt unter `https://jellyfin.example.de/remote/` erreichbar und im Jellyfin-Menü verlinkt. Kein zusätzlicher Server, kein Docker, keine Proxy-Änderung.
2. **Als installierte PWA** – in Safari „Zum Home-Bildschirm“, startet im Vollbild wie eine echte App
3. **Als native iPhone-App** – derselbe Code, mit [Capacitor](https://capacitorjs.com) in Xcode gebaut. Arbeitet mit dem Plugin zusammen (Kopplung per QR-Code).

## Funktionen

- **Anmeldung** – mit deinem Jellyfin-Benutzerkonto (Benutzername/Passwort) oder alternativ mit einem API-Token. Läuft die App auf derselben Domain wie Jellyfin, wird die Server-URL automatisch erkannt.
- **Zielgerät wählen** – listet alle aktiven Sitzungen (`/Sessions`). Steuerbare Geräte (z. B. Jellyfin auf dem Fernseher) können ausgewählt werden.
- **Live-Suche** – sucht während der Eingabe (debounced) nach Filmen und Episoden und zeigt Cover an. Ein Tipp startet die Wiedergabe sofort auf dem Zielgerät.
- **Fernbedienung** – Steuerkreuz (Hoch, Runter, Links, Rechts, OK) sowie Zurück, Home und Bildschirmmenü.
- **Wiedergabe** – Play/Pause, 10 Sekunden vor/zurück, Stopp, Lautstärkeregler und Stummschaltung.
- **Läuft gerade** – Titel, Cover und Fortschritt des aktuellen Mediums, alle 2 Sekunden aktualisiert.
- **PWA** – installierbar, App-Struktur wird per Service Worker offline zwischengespeichert.

## Projektstruktur

```
├── app/                          Die eigentliche App (HTML, CSS, JavaScript)
│   ├── index.html · manifest.json · service-worker.js
│   ├── css/ · icons/
│   └── js/                       app.js · api.js · storage.js · ui.js · views/
├── plugin/Jellyfin.Plugin.Remote/  Jellyfin-Plugin (C#, .NET 10)
│   ├── Plugin.cs                 Plugin-Definition und Einstellungsseite
│   ├── Api/RemoteController.cs   liefert die App unter /remote/ aus
│   ├── Middleware/               ergänzt den Web-Client um den Fernbedienungs-Link
│   ├── Configuration/            Einstellungen und Einstellungsseite (mit QR-Codes)
│   └── Web/                      Kopfzeilen-Skript, QR-Code-Bibliothek
├── jellyfin-repository.json      Plugin-Repository für Jellyfin
├── .github/workflows/            baut das Plugin bei jedem Release
├── capacitor.config.json         Konfiguration der iPhone-App
├── scripts/ios-configure.mjs     ergänzt das iOS-Projekt (URL-Schema)
└── resources/                    App-Icon und Startbildschirm (iOS)
```

---

## Jellyfin-Plugin

Das Plugin enthält die komplette App und liefert sie direkt über Jellyfin aus – unter derselben Adresse wie dein Server, z. B. `https://jellyfin.example.de/remote/`. Da Jellyfin selbst die Dateien ausliefert, brauchst du weder Docker noch eine Änderung am Reverse-Proxy.

**Voraussetzung:** Jellyfin **12.2** oder neuer.

### Installation

1. Im Jellyfin-Dashboard **Plugins → Repositories → „+“** wählen und das gemeinsame Repository aller Plugins von DrdotHouse2106 eintragen ([Jellyfin-Plugins](https://github.com/DrdotHouse2106/Jellyfin-Plugins)):
   - Name: `DrdotHouse2106`
   - URL: `https://raw.githubusercontent.com/DrdotHouse2106/Jellyfin-Plugins/main/manifest.json`

   Alternativ nur dieses Plugin: `https://raw.githubusercontent.com/DrdotHouse2106/Jellyfin-Remote/main/jellyfin-repository.json`
2. Unter **Plugins → Katalog** das Plugin **Jellyfin Remote** installieren.
3. Jellyfin **neu starten**.
4. Fertig: `https://jellyfin.example.de/remote` öffnen und mit deinem Jellyfin-Konto anmelden.

Updates erscheinen danach automatisch im Dashboard.

### Was das Plugin macht

- **App unter `/remote/`** – die Server-URL wird automatisch erkannt (auch mit konfigurierter Basis-URL), du musst dich nur noch anmelden.
- **Link im Web-Client** – ein Eintrag „Fernbedienung“ im Seitenmenü und ein Fernbedienungs-Symbol neben der Suche in der Kopfzeile. Beides lässt sich in den Plugin-Einstellungen abschalten. Die Dateien des Web-Clients werden dabei **nicht verändert** – das Plugin ergänzt sie nur bei der Auslieferung.
- **Einstellungsseite** (Dashboard → Plugins → Jellyfin Remote, oder im Dashboard-Menü „Fernbedienung“) mit zwei QR-Codes:
  - **Im Browser öffnen** – öffnet die Web-App auf dem Smartphone.
  - **In der iPhone-App verbinden** – öffnet die iPhone-App und trägt die Server-URL automatisch ein.
- **Öffentliche Adresse** – trage dort z. B. `https://jellyfin.example.de` ein, damit die QR-Codes auch dann stimmen, wenn du das Dashboard im Heimnetz über die IP-Adresse aufrufst.
- **Info-Endpunkt** `GET /JellyfinRemote/Info` – die iPhone-App erkennt darüber, dass das Plugin installiert ist.

Nach dem Ein- oder Ausschalten der Links den Web-Client neu laden (am Computer **Strg + F5**).

### Neue Version veröffentlichen

Die GitHub Action [`.github/workflows/plugin-release.yml`](.github/workflows/plugin-release.yml) baut das Plugin, erstellt ein GitHub-Release und aktualisiert `jellyfin-repository.json`. Das gemeinsame Repository [Jellyfin-Plugins](https://github.com/DrdotHouse2106/Jellyfin-Plugins) übernimmt neue Versionen automatisch (Prüfung alle 15 Minuten):

```bash
git tag v1.0.1
git push origin v1.0.1
```

Alternativ unter **Actions → Plugin-Release → Run workflow** eine Version eingeben.

### Manuell installieren (ohne Repository)

```bash
npm run plugin:build      # oder: dotnet publish plugin/Jellyfin.Plugin.Remote -c Release -o plugin/dist
```

Die Datei `plugin/dist/Jellyfin.Plugin.Remote.dll` in einen neuen Ordner `plugins/JellyfinRemote/` im Jellyfin-Datenverzeichnis kopieren (bei Docker meist `/config/plugins/`) und Jellyfin neu starten.

---

## Als native iPhone-App bauen

Die App ist für [Capacitor](https://capacitorjs.com) vorbereitet. Capacitor verpackt den Ordner `app/` unverändert in eine native iOS-App, die du per Xcode auf dein iPhone spielen oder im App Store veröffentlichen kannst.

### Voraussetzungen

- Mac mit **Xcode** (aus dem App Store) und **Node.js 20+**
- Apple-ID (kostenlos reicht zum Testen auf dem eigenen iPhone – die App läuft dann 7 Tage und muss danach neu installiert werden; das **Apple Developer Program** für 99 €/Jahr entfernt diese Grenze und ermöglicht TestFlight/App Store)

### Erstmalig einrichten

```bash
npm install
npm run ios:add      # erzeugt den Ordner ios/, das URL-Schema sowie Icons und Startbildschirme
npm run ios:open     # öffnet das Projekt in Xcode
```

In Xcode:

1. Links das Projekt **App** wählen → **Signing & Capabilities** → dein **Team** (Apple-ID) auswählen.
2. Bei Bedarf die **Bundle Identifier** anpassen (Standard: `com.example.jellyfinremote` – für eigene Builds auf eine eigene Kennung ändern, z. B. `de.deinname.jellyfinremote`, siehe `capacitor.config.json`).
3. iPhone per Kabel verbinden, oben als Ziel auswählen und **▶ Run** drücken.
4. Beim ersten Start auf dem iPhone: **Einstellungen → Allgemein → VPN und Geräteverwaltung** → Entwickler vertrauen.

### Nach Änderungen am Code

```bash
npm run ios:sync     # kopiert app/ ins iOS-Projekt
```

Dann in Xcode erneut **▶ Run**.

### Hinweise zur nativen App

- **Kopplung mit dem Plugin:** In den Plugin-Einstellungen den QR-Code „In der iPhone-App verbinden“ mit der Kamera scannen – die App öffnet sich und die Server-URL ist eingetragen (URL-Schema `jellyfinremote://connect?server=…`). Ohne Plugin gibst du die Server-URL einmalig von Hand ein.
- Die iPhone-App braucht **keinen eigenen Server** – alle App-Dateien sind in der App enthalten, sie spricht direkt mit Jellyfin.
- Die App sendet Anfragen von einem eigenen Ursprung (`capacitor://localhost`) an Jellyfin. Jellyfin erlaubt solche Anfragen standardmäßig (CORS). Falls dein Reverse-Proxy CORS-Header entfernt oder überschreibt, müssen sie dort erlaubt werden.
- iOS erlaubt standardmäßig nur **HTTPS**-Verbindungen. Für einen reinen HTTP-Server im Heimnetz muss in `ios/App/App/Info.plist` unter `NSAppTransportSecurity` der Schlüssel `NSAllowsLocalNetworking` bzw. `NSAllowsArbitraryLoads` gesetzt werden.
- Der Ordner `ios/` wird lokal erzeugt und ist per `.gitignore` ausgeschlossen. Wer ihn versionieren möchte, entfernt den Eintrag.

---

## Lokal testen

```bash
npm run serve        # oder: python3 -m http.server 8080 --directory app
```

Danach `http://<IP-des-Rechners>:8080` öffnen. Über reines HTTP funktioniert alles außer dem Offline-Cache. Wird die App über HTTPS ausgeliefert, muss auch Jellyfin per HTTPS erreichbar sein (Browser blockieren sonst die Anfragen – „Mixed Content“).

Nach Änderungen an den App-Dateien die Konstante `CACHE_NAME` in `app/service-worker.js` erhöhen, damit installierte PWAs die neue Version laden.

## Verwendete Jellyfin-Endpunkte

| Funktion | Endpunkt |
| --- | --- |
| Server erkennen | `GET /System/Info/Public` |
| Plugin erkennen | `GET /JellyfinRemote/Info` (nur mit Plugin) |
| Anmeldung | `POST /Users/AuthenticateByName` |
| Abmeldung | `POST /Sessions/Logout` |
| Token prüfen | `GET /System/Info` |
| Sitzungen | `GET /Sessions` |
| Suche | `GET /Items?SearchTerm=…&IncludeItemTypes=Movie,Episode&Recursive=true` |
| Abspielen | `POST /Sessions/{SessionId}/Playing?playCommand=PlayNow&itemIds={ItemId}` |
| Navigation | `POST /Sessions/{SessionId}/Command/{MoveUp\|MoveDown\|MoveLeft\|MoveRight\|Select\|Back\|GoHome\|ToggleOsd\|ToggleMute}` |
| Play/Pause, Stopp | `POST /Sessions/{SessionId}/Playing/{PlayPause\|Stop}` |
| 10 s spulen | `POST /Sessions/{SessionId}/Playing/Seek?seekPositionTicks=…` |
| Lautstärke | `POST /Sessions/{SessionId}/Command` mit `{"Name":"SetVolume","Arguments":{"Volume":"50"}}` |

> **Hinweis:** In der Jellyfin-API wird „Abspielen“ über `POST /Sessions/{id}/Playing` mit `playCommand=PlayNow` und `itemIds` ausgelöst. Einen Endpunkt `/Playing/Play` gibt es nicht – `/Playing/{Befehl}` ist nur für die Wiedergabesteuerung (Pause, Stopp, Seek …) gedacht.

Da Jellyfin bei jeder Neuverbindung eines Clients eine neue Sitzungs-ID vergibt, merkt sich die App die **Geräte-ID** des Zielgeräts und ermittelt die aktuelle Sitzung automatisch neu.

## Sicherheit

- Bei der Anmeldung per Benutzerkonto wird **nicht das Passwort**, sondern nur das von Jellyfin ausgestellte Zugriffstoken gespeichert. Die Anmeldung erscheint im Jellyfin-Dashboard unter **Geräte** und kann dort jederzeit entfernt werden. „Abmelden & Daten löschen“ widerruft das Token auch am Server.
- Das Token liegt im `localStorage` des Browsers bzw. der App. Dieser Speicher ist **nicht verschlüsselt** – wer Zugriff auf das entsperrte Gerät hat, kann es auslesen.
- Wird das Token widerrufen, leitet die App automatisch zur Anmeldung zurück.
- Für den Zugriff von außen ist **HTTPS Pflicht**, sonst würden Passwort und Token unverschlüsselt übertragen.
- Die vom Plugin ausgelieferten Dateien (`/remote/…`, `/JellyfinRemote/…`) sind ohne Anmeldung abrufbar – sie enthalten nur die App selbst, keine Daten deines Servers. Alles Weitere erfordert die normale Jellyfin-Anmeldung.

## Voraussetzungen

- Plugin: Jellyfin 12.2 oder neuer
- App ohne Plugin: Jellyfin 10.8 oder neuer
- Ein steuerbarer Client auf dem Zielgerät (z. B. Jellyfin für Android TV, Jellyfin Web im Browser des Fernsehers, Jellyfin Media Player)
