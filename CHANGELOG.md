# Änderungen

Die Einträge unter einer Versionsnummer erscheinen beim Release automatisch in Jellyfin
(Dashboard → Plugins → Jellyfin Remote → Versionsverlauf).

## 1.2.1

- Steuerkreuz im Jellyfin-Web-Client (Browser, normales Layout) zuverlässig: ein Druck = eine Kachel, Reihen-Überschriften und Zusatzknöpfe werden übersprungen, die Auswahl startet im Seiteninhalt statt in der oberen Leiste
- Funktioniert auch nach einem Seitenwechsel ohne Neuladen (Fokus lag vorher auf der unsichtbaren alten Seite)
- Deutlicher Rahmen um das ausgewählte Element, solange per Fernbedienung gesteuert wird
- Im TV-Layout, während der Wiedergabe und in Dialogen bleibt die Navigation wie bisher beim Web-Client
- Diagnoseprotokoll (Plugin-Einstellungen → Fehlersuche): protokolliert gesendete und empfangene Befehle sowie Fokuswechsel, mit Knopf zum Kopieren

## 1.2.0

- Suche auf dem Fernseher: Der Suchbegriff wird live an das Zielgerät übertragen, die Ergebnisse erscheinen dort; auf dem Handy bleibt ein kleines Steuerkreuz zum Auswählen (abschaltbar über den Schalter in der Suche)
- Schnellerer Start: App-Dateien bleiben dauerhaft im Speicher und werden gleichzeitig geladen
- Spulen braucht nur noch eine Anfrage an den Server
- Plugin-Skript im Web-Client läuft immer (auch bei ausgeschaltetem Kopfzeilen-Symbol), damit automatische Anmeldung und Suche überall funktionieren

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
