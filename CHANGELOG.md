# Änderungen

Die Einträge unter einer Versionsnummer erscheinen beim Release automatisch in Jellyfin
(Dashboard → Plugins → Jellyfin Remote → Versionsverlauf).

## 1.1.4

- Updates kommen sofort an: Die App wird unter einer Adresse mit Versionsnummer ausgeliefert, damit kein Zwischenspeicher (z. B. der Jellyfin-App auf dem iPhone) noch die alte Version zeigt
- Zurück-Link zu Jellyfin funktioniert unabhängig davon, wie die Fernbedienung geöffnet wurde

## 1.1.3

- App-Dateien werden nicht mehr 24 Stunden im Browser zwischengespeichert
- Offline-Speicher lädt online immer zuerst die aktuelle Version
- Versionsnummer unten im Anmeldebildschirm

## 1.1.2

- Pfeil „Zurück zu Jellyfin“ immer sichtbar, wenn die Fernbedienung über das Plugin läuft
- Link „Zurück zu Jellyfin“ auch im Anmeldebildschirm

## 1.1.1

- Hinweis, warum kein Gerät steuerbar ist: Jellyfin auf dem Gerät nicht geöffnet oder Reverse-Proxy blockiert WebSockets (mit Anleitung)
- Andere Fernbedienungen erscheinen nicht mehr in der Geräteliste

## 1.1.0

- Automatische Anmeldung: Aus Jellyfin heraus geöffnet (Browser oder Jellyfin-App), ist die Fernbedienung direkt angemeldet – per Quick Connect mit eigenem Zugangs-Token
- Anmeldung per Quick-Connect-Code
- Fernbedienung öffnet im selben Fenster, mit Zurück-Pfeil zu Jellyfin

## 1.0.0

- Erste Version: Fernbedienung unter /remote/ mit Steuerkreuz, Wiedergabetasten, Lautstärke und Live-Suche
- Link „Fernbedienung“ im Menü und Symbol in der Kopfzeile des Web-Clients
- Einstellungsseite mit QR-Codes für Browser und iPhone-App
