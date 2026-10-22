# Jellyfin Remote

[![Spendier mir einen Kaffee](https://img.shields.io/badge/☕_Spendier_mir_einen_Kaffee-PayPal-0070ba?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/DrdotHouse)

*[English version](README.en.md)*

Eine minimalistische Progressive Web App (PWA), die dein Smartphone in eine Fernbedienung und einen Mediathek-Browser für deinen [Jellyfin](https://jellyfin.org)-Server verwandelt. Geschrieben in reinem HTML5, CSS3 und ES6-JavaScript – ohne Frameworks, ohne Build-Schritt.

Die App lässt sich auf drei Arten nutzen:

1. **Als Jellyfin-Plugin** – die App ist danach direkt unter `https://jellyfin.example.de/remote/` erreichbar und im Jellyfin-Menü verlinkt. Kein zusätzlicher Server, kein Docker, keine Proxy-Änderung.
2. **Als installierte PWA** – in Safari „Zum Home-Bildschirm“, startet im Vollbild wie eine echte App
3. **Als native iPhone-App** – derselbe Code, mit [Capacitor](https://capacitorjs.com) in Xcode gebaut. Arbeitet mit dem Plugin zusammen (Kopplung per QR-Code).

## Funktionen

- **Anmeldung** – mit deinem Jellyfin-Benutzerkonto (Benutzername/Passwort), per **Quick Connect** (Code in einer angemeldeten Jellyfin-App bestätigen, kein Passwort nötig) oder mit einem API-Token. Wird die Fernbedienung aus Jellyfin heraus geöffnet, ist sie **automatisch angemeldet**. Läuft die App auf derselben Domain wie Jellyfin, wird die Server-URL automatisch erkannt.
- **Zielgerät wählen** – listet alle aktiven Sitzungen (`/Sessions`). Steuerbare Geräte (z. B. Jellyfin auf dem Fernseher) können ausgewählt werden.
- **Live-Suche** – sucht während der Eingabe (debounced) nach Filmen und Episoden und zeigt Cover an. Ein Tipp startet die Wiedergabe sofort auf dem Zielgerät.
- **Fernbedienung** – Steuerkreuz (Hoch, Runter, Links, Rechts, OK) sowie Zurück, Home und Bildschirmmenü.
- **Wiedergabe** – Play/Pause, 10 Sekunden vor/zurück, Stopp, Lautstärkeregler und Stummschaltung.
- **Läuft gerade** – Titel, Cover und Fortschritt des aktuellen Mediums, alle 2 Sekunden aktualisiert.
- **Menü** – Bereiche (Startseite, Suche, Einstellungen) und Bibliotheken (Filme, Serien, Live-TV …) direkt auf dem Fernseher öffnen. Mit der TV-App **[Quallenkino](https://github.com/DrdotHouse2106/Jellyfin-TV-Client)** (Android TV / Fire TV) zusätzlich TV-Programm, Aufnahmen und Zeitplan sowie die **Apps des Fernsehers** (Netflix, YouTube, Mediatheken …) und seine **Einstellungen** (WLAN, Bluetooth, Bild, Ton) – ohne Umweg über das Menü des Sticks.
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
- **Automatische Anmeldung** – tippst du in Jellyfin (Browser oder Jellyfin-App für iOS/Android) auf „Fernbedienung“, öffnet sie sich direkt angemeldet und im selben Fenster, mit einem „Zurück“-Button zu Jellyfin. Dafür stellt das Plugin per Quick Connect mit deiner bestehenden Anmeldung ein eigenes Token für die Fernbedienung aus – sie erscheint im Dashboard unter **Geräte** als „Jellyfin Remote“ und kann dort jederzeit abgemeldet werden. Voraussetzung: **Quick Connect** ist eingeschaltet (Dashboard → Allgemein, Standard: an); sonst öffnet sich die normale Anmeldung.
- **Link im Web-Client** – ein Eintrag „Fernbedienung“ im Seitenmenü und ein Fernbedienungs-Symbol neben der Suche in der Kopfzeile. Beides lässt sich in den Plugin-Einstellungen abschalten. Die Dateien des Web-Clients werden dabei **nicht verändert** – das Plugin ergänzt sie nur bei der Auslieferung.
- **Einstellungsseite** (Dashboard → Plugins → Jellyfin Remote, oder im Dashboard-Menü „Fernbedienung“) mit zwei QR-Codes:
  - **Im Browser öffnen** – öffnet die Web-App auf dem Smartphone.
  - **In der iPhone-App verbinden** – öffnet die iPhone-App und trägt die Server-URL automatisch ein.
- **Öffentliche Adresse** – trage dort z. B. `https://jellyfin.example.de` ein, damit die QR-Codes auch dann stimmen, wenn du das Dashboard im Heimnetz über die IP-Adresse aufrufst.
- **Info-Endpunkt** `GET /JellyfinRemote/Info` – die iPhone-App erkennt darüber, dass das Plugin installiert ist.

Nach dem Ein- oder Ausschalten der Links den Web-Client neu laden (am Computer **Strg + F5**).

### Neue Version veröffentlichen

Vorher in [`CHANGELOG.md`](CHANGELOG.md) einen Abschnitt `## <Version>` mit den Änderungen anlegen – er erscheint in Jellyfin im Versionsverlauf des Plugins und im GitHub-Release.

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

- **Kopplung mit dem Plugin:** In den Plugin-Einstellungen den QR-Code „In der iPhone-App verbinden“ mit der Kamera scannen – die App öffnet sich und die Server-URL ist eingetragen (URL-Schema `jellyfinremote://connect?server=…`; die App fragt vor dem Übernehmen nach). Ohne Plugin gibst du die Server-URL einmalig von Hand ein.
- Die iPhone-App braucht **keinen eigenen Server** – alle App-Dateien sind in der App enthalten, sie spricht direkt mit Jellyfin.
- Die App sendet Anfragen von einem eigenen Ursprung (`capacitor://localhost`) an Jellyfin. Jellyfin erlaubt solche Anfragen standardmäßig (CORS). Falls dein Reverse-Proxy CORS-Header entfernt oder überschreibt, müssen sie dort erlaubt werden.
- iOS erlaubt standardmäßig nur **HTTPS**-Verbindungen. Für einen reinen HTTP-Server im Heimnetz muss in `ios/App/App/Info.plist` unter `NSAppTransportSecurity` der Schlüssel `NSAllowsLocalNetworking` bzw. `NSAllowsArbitraryLoads` gesetzt werden.
- Der Ordner `ios/` wird lokal erzeugt und ist per `.gitignore` ausgeschlossen. Wer ihn versionieren möchte, entfernt den Eintrag.

---

## Lokal testen

```bash
npm install          # einmalig, feste Versionen laut package-lock.json
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
| Quick Connect | `GET /QuickConnect/Enabled`, `POST /QuickConnect/Initiate`, `GET /QuickConnect/Connect`, `POST /QuickConnect/Authorize`, `POST /Users/AuthenticateWithQuickConnect` |
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

## Steuerkreuz im Browser

Steuert die Fernbedienung den Jellyfin-Web-Client (z. B. Chrome am Fernseher oder PC), übernimmt das Plugin im normalen Layout die Pfeiltasten selbst: Ein Druck wählt die nächste Kachel, Reihen-Überschriften und Zusatzknöpfe werden übersprungen, und ein deutlicher Rahmen zeigt die Auswahl. Im **TV-Layout** (Jellyfin → Einstellungen → Anzeige → Layout), während der Wiedergabe und in Dialogen bleibt die Navigation beim Web-Client.

## Diagnoseprotokoll

Unter **Dashboard → Plugins → Jellyfin Remote → Fehlersuche** lässt sich ein Diagnoseprotokoll einschalten. Es zeichnet gesendete Befehle der Fernbedienung (mit Antwortzeit) und auf den gesteuerten Geräten empfangene Befehle samt ausgewähltem Element auf. Das Protokoll erscheint auf derselben Seite und lässt sich kopieren; es liegt nur im Arbeitsspeicher. Nach dem Einschalten Fernbedienung und gesteuerte Jellyfin-Fenster einmal neu laden.

## Gerät „nicht steuerbar“?

Jellyfin kann ein Gerät nur fernsteuern, solange zwischen Gerät und Server eine Live-Verbindung (**WebSocket**) besteht. Die Fernbedienung prüft das selbst und zeigt einen Hinweis an, wenn kein Gerät steuerbar ist:

- **Jellyfin ist auf dem Gerät nicht geöffnet** – Jellyfin-App auf dem Fernseher starten bzw. den Browser-Tab offen lassen. Beendete Sitzungen bleiben noch bis zu 15 Minuten in der Liste.
- **Der Reverse-Proxy blockiert WebSockets** – dann ist kein Gerät steuerbar. WebSocket-Unterstützung aktivieren:
  - *Nginx Proxy Manager:* beim Proxy-Host „Websockets Support“ einschalten.
  - *Nginx:* Jellyfin nutzt für die Live-Verbindung den Pfad `/socket`. Am einfachsten einen eigenen `location`-Block ergänzen (funktioniert auch, wenn im Haupt-Block `proxy_set_header Connection "";` steht):

    ```nginx
    location /socket {
        proxy_pass http://127.0.0.1:8096;   # gleiche Adresse wie im Haupt-Block
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }
    ```
  - *Caddy* und *Traefik* reichen WebSockets automatisch durch.

## Häufige Probleme

Hürden, auf die man bei Installation und Nutzung typischerweise stößt – jeweils mit Symptom, Ursache und Lösung. Der Abschnitt wird laufend ergänzt.

### Installation und Updates

**Plugin taucht im Katalog nicht auf**
- *Ursache:* Repository nicht oder falsch eingetragen, oder Jellyfin hat die Liste noch nicht neu geladen.
- *Lösung:* Unter **Dashboard → Plugins → Repositories** die URL aus [Installation](#installation) prüfen (sie endet auf `manifest.json` bzw. `jellyfin-repository.json`). Danach die Katalog-Seite neu öffnen.

**Neue Version erscheint nicht als Update**
- *Ursache:* Das gemeinsame Repository übernimmt neue Versionen zeitversetzt (Prüfung alle 15 Minuten), und Jellyfin fragt Repositories selbst nur gelegentlich ab.
- *Lösung:* Etwas warten oder unter **Dashboard → Geplante Aufgaben** die Aufgabe zum Aktualisieren der Plugins von Hand starten.

**Nach der Installation fehlen `/remote/`, Menüeintrag oder Einstellungsseite**
- *Ursache:* Jellyfin lädt Plugins nur beim Start; der Web-Client hält die alte Seite im Speicher.
- *Lösung:* Jellyfin **neu starten**, danach offene Jellyfin-Fenster neu laden (am Computer **Strg + F5**). Die Jellyfin-App auf Handy/Tablet ganz schließen und neu öffnen.

**Nach einem Update ist noch die alte Version aktiv**
- *Ursache:* Im Plugin-Ordner von Jellyfin liegen mehrere Versionen (z. B. eine von Hand kopierte und eine aus dem Katalog), oder Jellyfin wurde nach dem Update nicht neu gestartet.
- *Lösung:* Im Ordner `plugins` des Jellyfin-Datenverzeichnisses darf nur **ein** Ordner „Jellyfin Remote_…“ liegen; ältere löschen, Jellyfin neu starten. Die installierte Version steht unten im Anmeldebildschirm der Fernbedienung und im Dashboard unter **Plugins**.

**Steuerkreuz im Browser macht doppelte Schritte oder reagiert erst nach dem Neuladen**
- *Ursache:* Das gesteuerte Jellyfin-Fenster läuft noch mit dem Skript einer älteren Plugin-Version.
- *Lösung:* Nach jedem Plugin-Update die gesteuerten Jellyfin-Fenster (z. B. Browser am Fernseher) einmal neu laden.

### Konfiguration und Sicherung

**Wo liegen die Einstellungen?**
- *Plugin:* in `plugins/configurations/Jellyfin.Plugin.Remote.xml` im Jellyfin-Datenverzeichnis (Docker meist `/config`, Linux-Paket `/var/lib/jellyfin`, Windows `%ProgramData%\Jellyfin\Server`). Zum Sichern diese Datei kopieren – oder einfach das ganze Datenverzeichnis mitsichern, wie es Jellyfin ohnehin empfiehlt.
- *Fernbedienung:* Server-Adresse, Token, Zielgerät und Geräte-ID liegen nur im Speicher des Browsers bzw. der App auf dem Handy, nicht auf dem Server. Eine Sicherung ist nicht nötig: Nach einem Geräte- oder Browserwechsel einfach neu anmelden.

**Fernbedienung zurücksetzen**
- In der Fernbedienung die Verbindungseinstellungen (Anmeldebildschirm) öffnen und **„Abmelden & Daten löschen“** wählen. Das Token wird auch am Server widerrufen.
- Alte Anmeldungen lassen sich im Dashboard unter **Geräte** entfernen (Name „Jellyfin Remote“).

### Anmeldung

**Kein automatisches Anmelden beim Öffnen aus Jellyfin**
- *Ursache:* **Quick Connect** ist am Server ausgeschaltet.
- *Lösung:* Quick Connect einschalten (**Dashboard → Allgemein**) oder normal mit Benutzername und Passwort anmelden.

**Quick-Connect-Code wird nicht angenommen**
- *Ursache:* Der Code muss in einer **bereits angemeldeten** Jellyfin-App bestätigt werden und gilt nur kurz.
- *Lösung:* In Jellyfin (Browser oder App) **Einstellungen → Quick Connect** öffnen und den Code eingeben, solange er in der Fernbedienung angezeigt wird.

**Meldung „Link ignoriert: Er verweist auf einen fremden Server“**
- *Ursache:* Der Link enthält `?server=…` mit einer anderen Adresse als der, unter der die Fernbedienung läuft. Das ist ein Schutz gegen untergeschobene Server.
- *Lösung:* Die Fernbedienung über die Adresse des eigenen Servers öffnen (`…/remote/`) oder den QR-Code aus den Plugin-Einstellungen nutzen.

**„Server nicht erreichbar“ bzw. Hinweis auf „Mixed Content“**
- *Ursache:* Die Fernbedienung läuft über HTTPS, der Server aber über HTTP; Browser blockieren das. Ohne Angabe nimmt die App außerdem HTTPS an.
- *Lösung:* Die Server-Adresse mit dem richtigen Schema (`http://` oder `https://`) eintragen. Für den Zugriff von außen den Server per HTTPS erreichbar machen. Die iPhone-App braucht für reines HTTP eine Ausnahme in der `Info.plist` (siehe [Hinweise zur nativen App](#hinweise-zur-nativen-app)).

**QR-Code in den Plugin-Einstellungen enthält die falsche Adresse**
- *Ursache:* Das Dashboard wurde über eine interne Adresse aufgerufen.
- *Lösung:* In den Plugin-Einstellungen die **öffentliche Adresse** des Servers eintragen.

### Geräte und Steuerung

**Ein Gerät fehlt in der Liste**
- *Ursache:* Jellyfin ist auf dem Gerät nicht geöffnet, oder es gehört einem anderen Benutzer.
- *Lösung:* Jellyfin auf dem Gerät starten. Geräte anderer Benutzer zeigt Jellyfin nur, wenn das eigene Benutzerkonto sie steuern darf (**Dashboard → Benutzer → Profil → „Fernsteuerung anderer Benutzer erlauben“** bzw. **„… gemeinsam genutzter Geräte …“**).

**Gerät steht in der Liste, ist aber „nicht steuerbar“ oder reagiert nicht**
- *Ursache:* Meist blockiert der Reverse-Proxy die Live-Verbindung (WebSocket), seltener schläft das Gerät oder der Browser-Tab ist im Hintergrund.
- *Lösung:* Siehe [Gerät „nicht steuerbar“?](#gerät-nicht-steuerbar) – bei Nginx den `location /socket`-Block ergänzen. Den Jellyfin-Tab am gesteuerten Gerät im Vordergrund lassen.

**Suchergebnisse erscheinen auf dem Handy statt auf dem Fernseher**
- *Lösung:* In der Suche der Fernbedienung den Schalter **„Auf dem Fernseher anzeigen“** einschalten. Dann wird der Suchbegriff an das Zielgerät übertragen, und auf dem Handy bleibt ein kleines Steuerkreuz.

**Pfeiltasten verhalten sich im Browser anders als erwartet**
- *Ursache:* Im **TV-Layout**, während der Wiedergabe und in Dialogen übernimmt der Jellyfin-Web-Client die Navigation selbst.
- *Lösung:* Für die Kachel-Navigation des Plugins in Jellyfin unter **Einstellungen → Anzeige → Layout** das normale Layout (Desktop/Mobil) wählen.

**Taste für die Bildschirmanzeige (OSD) bewirkt im Browser nichts**
- *Ursache:* Der Jellyfin-Web-Client setzt diesen Befehl nicht um. In den TV-Apps funktioniert er.

**Fernbedienungs-Symbol in der Kopfzeile fehlt am Computer**
- *Ursache:* Seit Version 1.3.3 erscheint das Symbol standardmäßig nur auf Handys und Tablets.
- *Lösung:* In den Plugin-Einstellungen **„Symbol nur auf Handys und Tablets“** ausschalten. Der Menüeintrag „Fernbedienung“ ist unabhängig davon immer da.

### Fehlersuche

**Diagnoseprotokoll bleibt leer**
- *Ursache:* Die Fenster laufen noch ohne die Protokollierung.
- *Lösung:* Nach dem Einschalten sowohl die Fernbedienung als auch die gesteuerten Jellyfin-Fenster neu laden. Das Protokoll liegt nur im Arbeitsspeicher und ist nach einem Neustart von Jellyfin leer. Lesen können es nur Administratoren.

## Sicherheit

- Bei der Anmeldung per Benutzerkonto wird **nicht das Passwort**, sondern nur das von Jellyfin ausgestellte Zugriffstoken gespeichert. Die Anmeldung erscheint im Jellyfin-Dashboard unter **Geräte** und kann dort jederzeit entfernt werden. „Abmelden & Daten löschen“ widerruft das Token auch am Server.
- Das Token liegt im `localStorage` des Browsers bzw. der App. Dieser Speicher ist **nicht verschlüsselt** – wer Zugriff auf das entsperrte Gerät hat, kann es auslesen.
- Wird das Token widerrufen, leitet die App automatisch zur Anmeldung zurück.
- Beim Wechsel von Benutzer oder Server – auch bei der automatischen Anmeldung aus Jellyfin heraus – wird das alte Token zuerst am Server abgemeldet. Es bleiben keine gültigen Tokens zurück, und die Geräteliste im Dashboard wächst nicht.
- Links mit `?server=…` übernimmt die Web-App nur, wenn sie auf den eigenen Server zeigen; die iPhone-App fragt bei `jellyfinremote://connect?server=…` vorher nach. So kann niemand per präpariertem Link eine fremde Server-Adresse unterschieben.
- Wird eine Server-Adresse ohne `http://` bzw. `https://` eingegeben, nimmt die App **HTTPS** an.
- Für den Zugriff von außen ist **HTTPS Pflicht**, sonst würden Passwort und Token unverschlüsselt übertragen.
- Die vom Plugin ausgelieferten Dateien (`/remote/…`, `/JellyfinRemote/…`) sind ohne Anmeldung abrufbar – sie enthalten nur die App selbst, keine Daten deines Servers. Auch `GET /JellyfinRemote/Info` verrät keine Einstellungen (etwa die öffentliche Server-Adresse). Alles Weitere erfordert die normale Jellyfin-Anmeldung.
- Der Release-Workflow baut genau den gepushten Tag, übernimmt die Versionsangabe nur geprüft (Schutz vor eingeschleustem Shell-Code) und nutzt GitHub Actions in fest angegebenen Versionen (Commit-SHA). Auch die Werkzeuge für App-Bau und lokalen Test (`@capacitor/assets`, `http-server`) sind mit fester Version in `package.json` eingetragen statt per `npx` nachgeladen.
- Das Diagnoseprotokoll schreibt nur die Seite ohne Parameter mit, keine Suchbegriffe und keine per SendString übertragenen Texte.

## Voraussetzungen

- Plugin: Jellyfin 12.2 oder neuer
- App ohne Plugin: Jellyfin 10.8 oder neuer
- Ein steuerbarer Client auf dem Zielgerät (z. B. Jellyfin für Android TV, Jellyfin Web im Browser des Fernsehers, Jellyfin Media Player)

## Unterstützen

Die Entwicklung kostet Zeit und Geld (Server, Testgeräte, KI-Werkzeuge). Wenn dir das Projekt gefällt, freue ich mich über eine kleine Spende:

[![Spenden via PayPal](https://img.shields.io/badge/Spenden-PayPal-0070ba?logo=paypal&logoColor=white)](https://paypal.me/DrdotHouse)

### 🎮 Auch eine Zocker-Ader?

Dann ist vielleicht mein anderes Projekt genau das Richtige für dich: **[ZockerDB](https://zockerdb.de)** –
deine Spielesammlung an einem Platz. Spiele, Konsolen und Zubehör erfassen (auch per Barcode-Scan mit
dem Handy), bewerten und verwalten, mit Preisverlauf, Editionen und PAL/USK-Angaben. Direkt auf
[zockerdb.de](https://zockerdb.de) nutzen oder als [ZockerDB Basis](https://github.com/DrdotHouse2106/ZockerDBBasis) auf dem eigenen Server hosten.

## Lizenz

Dieses Projekt steht unter der [GNU General Public License v3.0](LICENSE) (GPL-3.0).
