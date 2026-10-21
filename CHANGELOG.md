# Änderungen

Die Einträge unter einer Versionsnummer erscheinen beim Release automatisch in Jellyfin
(Dashboard → Plugins → Jellyfin Remote → Versionsverlauf).

## 1.3.5

- Schnellerer Start: Versionierte App-Dateien kommen direkt aus dem Offline-Speicher, ohne jedes Mal beim Server nachzufragen; nur index.html, service-worker.js und manifest.json werden online immer neu geprüft
- Sicherheit: Die ohne Anmeldung abrufbare Plugin-Info (`/JellyfinRemote/Info`) enthält die öffentliche Server-Adresse nicht mehr
- Sicherheit: Release-Workflow baut genau den gepushten Tag, prüft die Versionsangabe (kein eingeschleuster Shell-Code) und nutzt GitHub Actions in fest angegebenen Versionen

## 1.3.4

- Sicherheit: Bei der automatischen Anmeldung aus Jellyfin heraus wird ein altes Token (anderer Benutzer oder Server) jetzt zuerst am Server abgemeldet – es bleiben keine gültigen Tokens zurück, die Geräteliste wächst nicht
- Sicherheit: Links mit `?server=…` übernimmt die Web-App nur, wenn sie auf den eigenen Server zeigen; die iPhone-App fragt vorher nach (Schutz vor untergeschobenen Server-Adressen)
- Sicherheit: Server-Adressen ohne Schema werden als HTTPS statt HTTP angenommen
- Weniger Last: Die laufende Aktualisierung fragt nur noch das Zielgerät ab statt alle 2 Sekunden die komplette Sitzungsliste

## 1.3.3

- Kopfleisten-Knopf „Fernbedienung“ standardmäßig nur noch auf Handys und Tablets (Touch-Geräte, auch in den Jellyfin-Apps für iOS und Android); im Browser am Computer entsteht er nicht mehr – und landet damit auch nicht im Profilmenü
- Neue Einstellung „Symbol nur auf Handys und Tablets“ (abschaltbar, dann wieder überall)

## 1.3.2

- Steuerkreuz im Browser: Ein Druck ist jetzt wirklich ein Schritt – der Web-Client von Jellyfin 12 führte die Pfeil-Befehle zusätzlich selbst aus (über das neue Jellyfin-SDK), dadurch gab es doppelte Schritte und Aussetzer, die erst nach dem Neuladen weg waren
- Links/Rechts bleiben in der eigenen Reihe
- Auswahlrahmen um Kacheln wird nicht mehr seitlich abgeschnitten
- Doppelt empfangene Server-Nachrichten werden verworfen
- Diagnoseprotokoll aktualisiert sich in den Plugin-Einstellungen automatisch und zeigt die Anzahl der Einträge je Gerät; mehr Details (Live-Verbindungen, Grund, wenn der Web-Client die Navigation übernimmt)

## 1.3.1

- Die TV-App heißt jetzt „Quallenkino“: Apps, Einstellungen und TV-Bereiche im Menü funktionieren mit dem neuen Namen

## 1.3.0

- Neuer Reiter **Menü**: Startseite, Suche, Einstellungen und alle Bibliotheken (Filme, Serien, Live-TV …) mit einem Tipp auf dem Fernseher öffnen
- Mit der TV-App „Heimkino TV“ (Android TV / Fire TV): TV-Programm, Aufnahmen und Zeitplan öffnen, **Apps des Fernsehers starten** (Netflix, YouTube, Mediatheken …) und **Einstellungen des Fernsehers** öffnen (WLAN, Bluetooth, Bild, Ton)

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
