# Jellyfin Remote

*[English version](README.en.md)*

Eine minimalistische Progressive Web App (PWA), die dein Smartphone in eine Fernbedienung und einen Mediathek-Browser für deinen [Jellyfin](https://jellyfin.org)-Server verwandelt. Geschrieben in reinem HTML5, CSS3 und ES6-JavaScript – ohne Frameworks, ohne Build-Schritt.

Die App lässt sich auf drei Arten nutzen:

1. **Von überall im Browser** – z. B. unter `https://jellyfin.example.de/remote/`, direkt neben deinem Jellyfin
2. **Als installierte PWA** – in Safari „Zum Home-Bildschirm“, startet im Vollbild wie eine echte App
3. **Als native iPhone-App** – derselbe Code, mit [Capacitor](https://capacitorjs.com) in Xcode gebaut

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
├── app/                      Die eigentliche App (nur dieser Ordner wird ausgeliefert)
│   ├── index.html            Grundgerüst mit allen Ansichten
│   ├── manifest.json         Web-App-Manifest
│   ├── service-worker.js     Offline-Cache der App-Shell
│   ├── css/style.css         Dunkles, responsives Design
│   ├── icons/                App-Icons
│   └── js/
│       ├── app.js            Einstieg, Zustand, Navigation, Zielgerät
│       ├── api.js            Jellyfin-API-Client
│       ├── storage.js        localStorage-Zugriff
│       ├── ui.js             UI-Hilfsfunktionen
│       └── views/            setup.js · sessions.js · remote.js · search.js
├── deploy/                   Nginx- und Caddy-Konfigurationen
├── Dockerfile                Container, der die App unter /remote/ ausliefert
├── docker-compose.yml
├── capacitor.config.json     Konfiguration für die native iOS-App
├── package.json              Capacitor-Abhängigkeiten und Skripte
└── resources/                Quellbilder für App-Icon und Startbildschirm (iOS)
```

---

## Von überall erreichbar: `jellyfin.example.de/remote`

Am einfachsten betreibst du die App auf **derselben Domain wie Jellyfin**. Vorteile:

- HTTPS-Zertifikat ist bereits vorhanden
- keine CORS- oder Mixed-Content-Probleme
- die Server-URL wird beim ersten Start automatisch erkannt – du musst dich nur noch anmelden
- der Offline-Cache (Service Worker) funktioniert, weil HTTPS

Im Folgenden steht `jellyfin.example.de` für deine Domain (z. B. `jellyfin.ulber.me`).

### Schritt 1: App starten

**Variante A – Docker (empfohlen):**

```bash
git clone https://github.com/DrdotHouse2106/Jellyfin-Remote.git
cd Jellyfin-Remote
docker compose up -d --build
```

Der Container liefert die App unter `http://<server>:8097/remote/` aus. Updates: `git pull && docker compose up -d --build`.

**Variante B – ohne Docker:** Den Inhalt des Ordners `app/` in ein Verzeichnis des Webservers kopieren, z. B. `/var/www/jellyfin-remote/`.

### Schritt 2: Reverse-Proxy um `/remote` erweitern

Alle anderen Pfade gehen wie bisher an Jellyfin – nur `/remote/` geht an die App.

**Nginx** (Ausschnitt, vollständiges Beispiel in [`deploy/nginx-reverse-proxy.conf`](deploy/nginx-reverse-proxy.conf)) – in den bestehenden `server`-Block von Jellyfin einfügen:

```nginx
location = /remote { return 301 /remote/; }
location /remote/ {
    proxy_pass http://127.0.0.1:8097;   # ohne abschließenden Pfad – /remote/ bleibt erhalten
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Caddy** ([`deploy/Caddyfile`](deploy/Caddyfile)):

```caddy
jellyfin.example.de {
	redir /remote /remote/
	reverse_proxy /remote/* 127.0.0.1:8097
	reverse_proxy 127.0.0.1:8096
}
```

**Nginx Proxy Manager:** Beim Proxy-Host von Jellyfin den Tab **Custom Locations** öffnen → Location `/remote` → Scheme `http`, Forward Hostname `jellyfin-remote` (bzw. IP des Docker-Hosts), Forward Port `80` (bzw. `8097`). Liegen beide Container im selben Docker-Netzwerk, in `docker-compose.yml` das Netzwerk eintragen (siehe Kommentar dort).

**Traefik** (Labels für den Container in `docker-compose.yml`):

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.jellyfin-remote.rule=Host(`jellyfin.example.de`) && PathPrefix(`/remote`)
  - traefik.http.routers.jellyfin-remote.entrypoints=websecure
  - traefik.http.routers.jellyfin-remote.tls.certresolver=letsencrypt
  - traefik.http.services.jellyfin-remote.loadbalancer.server.port=80
```

> Hat dein Proxy eine `Content-Security-Policy` für die ganze Domain gesetzt (wie in manchen Jellyfin-Anleitungen), muss sie `'self'` für Skripte, Styles und Bilder erlauben – die App lädt nichts von fremden Servern.

### Schritt 3: Anmelden und installieren

1. `https://jellyfin.example.de/remote` in **Safari** öffnen – die Server-URL ist bereits eingetragen.
2. Mit Jellyfin-Benutzername und Passwort anmelden.
3. **Teilen** → **„Zum Home-Bildschirm“** – fertig.

---

## Als native iPhone-App bauen

Die App ist für [Capacitor](https://capacitorjs.com) vorbereitet. Capacitor verpackt den Ordner `app/` unverändert in eine native iOS-App, die du per Xcode auf dein iPhone spielen oder im App Store veröffentlichen kannst.

### Voraussetzungen

- Mac mit **Xcode** (aus dem App Store) und **Node.js 20+**
- Apple-ID (kostenlos reicht zum Testen auf dem eigenen iPhone – die App läuft dann 7 Tage und muss danach neu installiert werden; das **Apple Developer Program** für 99 €/Jahr entfernt diese Grenze und ermöglicht TestFlight/App Store)

### Erstmalig einrichten

```bash
npm install
npm run ios:add      # erzeugt den Ordner ios/ und die App-Icons/Startbildschirme
npm run ios:open     # öffnet das Projekt in Xcode
```

In Xcode:

1. Links das Projekt **App** wählen → **Signing & Capabilities** → dein **Team** (Apple-ID) auswählen.
2. Bei Bedarf die **Bundle Identifier** anpassen (Standard: `me.ulber.jellyfinremote`, siehe `capacitor.config.json`).
3. iPhone per Kabel verbinden, oben als Ziel auswählen und **▶ Run** drücken.
4. Beim ersten Start auf dem iPhone: **Einstellungen → Allgemein → VPN und Geräteverwaltung** → Entwickler vertrauen.

### Nach Änderungen am Code

```bash
npm run ios:sync     # kopiert app/ ins iOS-Projekt
```

Dann in Xcode erneut **▶ Run**.

### Hinweise zur nativen App

- Die Server-URL muss in der App **einmalig eingegeben** werden (z. B. `https://jellyfin.example.de`) – eine automatische Erkennung ist hier nicht möglich.
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

## Voraussetzungen

- Jellyfin 10.8 oder neuer (getestet mit der API von 10.10)
- Ein steuerbarer Client auf dem Zielgerät (z. B. Jellyfin für Android TV, Jellyfin Web im Browser des Fernsehers, Jellyfin Media Player)
