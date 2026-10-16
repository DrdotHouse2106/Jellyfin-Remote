# Jellyfin Remote

*[English version](README.en.md)*

Eine minimalistische Progressive Web App (PWA), die dein Smartphone in eine Fernbedienung und einen Mediathek-Browser für deinen [Jellyfin](https://jellyfin.org)-Server verwandelt. Geschrieben in reinem HTML5, CSS3 und ES6-JavaScript – ohne Frameworks, ohne Build-Schritt.

## Funktionen

- **Einrichtung** – Server-URL und API-Token eingeben, per „Verbindung testen“ gegen `/System/Info` prüfen und lokal speichern.
- **Zielgerät wählen** – listet alle aktiven Sitzungen (`/Sessions`). Steuerbare Geräte (z. B. Jellyfin auf dem Fernseher) können ausgewählt werden.
- **Live-Suche** – sucht während der Eingabe (debounced) nach Filmen und Episoden und zeigt Cover an. Ein Tipp startet die Wiedergabe sofort auf dem Zielgerät.
- **Fernbedienung** – Steuerkreuz (Hoch, Runter, Links, Rechts, OK) sowie Zurück, Home und Bildschirmmenü.
- **Wiedergabe** – Play/Pause, 10 Sekunden vor/zurück, Stopp, Lautstärkeregler und Stummschaltung.
- **Läuft gerade** – Titel, Cover und Fortschritt des aktuellen Mediums werden alle 2 Sekunden aktualisiert.
- **PWA** – installierbar auf dem iPhone über Safari → Teilen → „Zum Home-Bildschirm“. Die App-Struktur wird per Service Worker offline zwischengespeichert.

## Projektstruktur

```
├── index.html            Grundgerüst mit allen Ansichten
├── manifest.json         Web-App-Manifest (Name, Icons, Farben)
├── service-worker.js     Offline-Cache der App-Shell
├── css/style.css         Dunkles, responsives Design
├── icons/                App-Icons (SVG + PNG, inkl. Apple-Touch-Icon)
└── js/
    ├── app.js            Einstieg, Zustand, Navigation, Zielgerät
    ├── api.js            Jellyfin-API-Client
    ├── storage.js        localStorage-Zugriff
    ├── ui.js             UI-Hilfsfunktionen (Toast, Debounce, Formatierung)
    └── views/
        ├── setup.js      Einrichtung
        ├── sessions.js   Sitzungs-Auswahl
        ├── remote.js     Fernbedienung
        └── search.js     Suche
```

## Verwendete Jellyfin-Endpunkte

| Funktion | Endpunkt |
| --- | --- |
| Verbindungstest | `GET /System/Info` |
| Sitzungen | `GET /Sessions` |
| Suche | `GET /Items?SearchTerm=…&IncludeItemTypes=Movie,Episode&Recursive=true` |
| Abspielen | `POST /Sessions/{SessionId}/Playing?playCommand=PlayNow&itemIds={ItemId}` |
| Navigation | `POST /Sessions/{SessionId}/Command/{MoveUp\|MoveDown\|MoveLeft\|MoveRight\|Select\|Back\|GoHome\|ToggleOsd\|ToggleMute}` |
| Play/Pause, Stopp | `POST /Sessions/{SessionId}/Playing/{PlayPause\|Stop}` |
| 10 s spulen | `POST /Sessions/{SessionId}/Playing/Seek?seekPositionTicks=…` |
| Lautstärke | `POST /Sessions/{SessionId}/Command` mit `{"Name":"SetVolume","Arguments":{"Volume":"50"}}` |

> **Hinweis:** In der Jellyfin-API wird „Abspielen“ über `POST /Sessions/{id}/Playing` mit den Parametern `playCommand=PlayNow` und `itemIds` ausgelöst. Einen Endpunkt `/Playing/Play` gibt es nicht – `/Playing/{Befehl}` ist ausschließlich für Wiedergabesteuerung (Pause, Stopp, Seek …) gedacht.

Die Authentifizierung erfolgt über den Header `Authorization: MediaBrowser … Token="…"`. Da Jellyfin bei jeder Neuverbindung eines Clients eine neue Sitzungs-ID vergibt, merkt sich die App die **Geräte-ID** des Zielgeräts und ermittelt die aktuelle Sitzung automatisch neu.

## Einrichtung

### 1. API-Schlüssel erstellen

Im Jellyfin-Dashboard unter **Dashboard → API-Schlüssel → „+“** einen neuen Schlüssel anlegen (z. B. „Remote“) und kopieren.

### 2. App bereitstellen

Die App besteht nur aus statischen Dateien und kann von jedem Webserver ausgeliefert werden, z. B.:

```bash
python3 -m http.server 8080
```

Danach `http://<IP-des-Rechners>:8080` auf dem Smartphone öffnen.

### 3. Auf dem iPhone installieren

1. Die App-URL in **Safari** öffnen.
2. Auf **Teilen** tippen → **„Zum Home-Bildschirm“**.
3. Die App startet nun im Vollbild ohne Browserleiste.

## Wichtig: HTTP, HTTPS und Offline-Modus

- **Mixed Content:** Wird die App über **HTTPS** ausgeliefert (z. B. GitHub Pages), muss auch der Jellyfin-Server per **HTTPS** erreichbar sein. Browser blockieren Anfragen von HTTPS-Seiten an HTTP-Server.
- **Service Worker:** Der Offline-Cache funktioniert nur in einem sicheren Kontext (HTTPS oder `localhost`). Über reines HTTP im Heimnetz lässt sich die App trotzdem zum Home-Bildschirm hinzufügen und nutzen – nur ohne Offline-Cache.
- **Empfehlung:** Die App über denselben Reverse-Proxy (z. B. Nginx, Caddy, Traefik) wie Jellyfin per HTTPS ausliefern, etwa unter `https://jellyfin.example.de/remote/`.
- **CORS:** Jellyfin erlaubt standardmäßig Anfragen von fremden Ursprüngen. Falls ein Reverse-Proxy CORS-Header entfernt, müssen diese dort erlaubt werden.

Nach Änderungen an den App-Dateien die Konstante `CACHE_NAME` in `service-worker.js` erhöhen, damit installierte Apps die neue Version laden.

## Sicherheit

Server-URL und API-Token werden im `localStorage` des Browsers gespeichert und verlassen das Gerät nur in Richtung deines Jellyfin-Servers. `localStorage` ist **nicht verschlüsselt** – wer Zugriff auf das entsperrte Gerät hat, kann das Token auslesen. Nutze daher einen eigenen API-Schlüssel nur für diese App, den du im Dashboard jederzeit widerrufen kannst. Über **Einstellungen → „Gespeicherte Daten löschen“** werden alle Daten entfernt.

## Voraussetzungen

- Jellyfin 10.8 oder neuer (getestet mit der API von 10.10)
- Ein steuerbarer Client auf dem Zielgerät (z. B. Jellyfin für Android TV, Jellyfin Web im Browser des Fernsehers, Jellyfin Media Player)
