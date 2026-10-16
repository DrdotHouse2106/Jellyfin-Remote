/**
 * Jellyfin Remote – Skript für den Jellyfin-Web-Client (läuft auch in den Jellyfin-Apps
 * für iOS und Android, da diese den Web-Client anzeigen).
 *
 * 1. Fügt in der Kopfzeile neben der Suche ein Fernbedienungs-Symbol ein (abschaltbar).
 * 2. Öffnet die Fernbedienung beim Tippen auf das Symbol oder den Menü-Eintrag
 *    direkt angemeldet: Über Quick Connect wird mit der bestehenden Anmeldung ein
 *    eigenes Zugangs-Token für die Fernbedienung ausgestellt – ohne Passwort.
 * 3. Zeigt Suchbegriffe, die man auf dem Handy eingibt, direkt in der Suche dieses Geräts an.
 */
(function () {
    'use strict';

    var BUTTON_ID = 'jellyfinRemoteHeaderButton';
    var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
    var SHOW_HEADER_BUTTON = !/[?&]header=0\b/.test(SCRIPT_SRC);
    var DIAGNOSTICS = /[?&]diag=1\b/.test(SCRIPT_SRC);
    var APP_URL = new URL('../remote/', document.baseURI).href;
    var SERVER_URL = new URL('../', document.baseURI).href.replace(/\/+$/, '');

    // Speicherschlüssel der Fernbedienungs-App (gleiche Domain → gemeinsamer Speicher)
    var CONFIG_KEY = 'jellyfin-remote.config';
    var DEVICE_ID_KEY = 'jellyfin-remote.device-id';
    var FROM_WEB_KEY = 'jellyfin-remote.from-web';
    var CLIENT_NAME = 'Jellyfin Remote';
    var CLIENT_VERSION = '1.0.0';

    var ICON =
        '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="9" r="2.5"/>' +
        '<path d="M10 15h.01M14 15h.01M10 18h.01M14 18h.01"/></svg>';

    // ---------- Diagnoseprotokoll ----------

    var diagQueue = [];

    function diag(message) {
        if (!DIAGNOSTICS) return;
        diagQueue.push(new Date().toLocaleTimeString('de-DE') + ' ' + message);
    }

    function flushDiagnostics() {
        var apiClient = window.ApiClient;
        var token = apiClient && apiClient.accessToken && apiClient.accessToken();
        if (!diagQueue.length || !token) return;
        var lines = diagQueue.splice(0, diagQueue.length);
        fetch(SERVER_URL + '/JellyfinRemote/Diagnostics', {
            method: 'POST',
            keepalive: true,
            headers: { 'Authorization': 'MediaBrowser Token="' + token + '"', 'Content-Type': 'application/json' },
            body: JSON.stringify({ Source: 'Web-Client ' + browserName(), Lines: lines })
        }).catch(function () { /* ignorieren */ });
    }

    function browserName() {
        var ua = navigator.userAgent;
        if (/Edg\//.test(ua)) return 'Edge';
        if (/Chrome\//.test(ua)) return 'Chrome';
        if (/Firefox\//.test(ua)) return 'Firefox';
        if (/Safari\//.test(ua)) return 'Safari';
        return 'Browser';
    }

    /** Kurze, lesbare Beschreibung eines Elements fürs Protokoll. */
    function describe(el) {
        if (!el) return 'nichts';
        if (el === document.body) return 'nichts (body)';
        var text = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        var classes = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
        return el.tagName.toLowerCase() + (classes ? '.' + classes : '') + (text ? ' „' + text + '“' : '') + (isShown(el) ? '' : ' [unsichtbar]');
    }

    if (DIAGNOSTICS) {
        setInterval(flushDiagnostics, 3000);
        window.addEventListener('pagehide', flushDiagnostics);
        diag('Plugin-Skript geladen · ' + location.hash);
    }

    // ---------- Steuerung per Fernbedienung (Fokus) ----------

    var NAV_COMMANDS = { MoveUp: 1, MoveDown: 1, MoveLeft: 1, MoveRight: 1, Select: 1, Back: 1 };
    var FOCUSABLE = 'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    var HEADER = '.skinHeader, header, .MuiAppBar-root, .MuiToolbar-root';

    /** Wirklich sichtbar? (auch versteckte Menüs/Popups mit visibility:hidden oder opacity:0 ausschließen) */
    function isShown(el) {
        if (!el || !el.isConnected || el === document.body) return false;
        if (el.closest('.hide')) return false;
        var rect = el.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0)) return false;
        if (el.checkVisibility) {
            // Transparenz bewusst nicht prüfen: Kachelbilder werden per opacity eingeblendet.
            return el.checkVisibility({ visibilityProperty: true });
        }
        return getComputedStyle(el).visibility !== 'hidden';
    }

    function isSectionTitle(el) {
        return Boolean(el && el.closest && el.closest('.sectionTitleTextButton, .sectionTitleContainer, .sectionTitle'));
    }

    /**
     * Bedienbare, sichtbare Elemente – ohne Reihen-Überschriften und ohne die Zusatzknöpfe auf
     * Kacheln (pro Kachel zählt nur das erste Element, damit jede Kachel ein Schritt ist).
     */
    function navigableElements() {
        var result = [];
        var all = document.querySelectorAll(FOCUSABLE + ', .card');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            var card = el.closest('.card');
            if (card && el !== card) continue; // Elemente in Kacheln vertritt die Kachel selbst
            if (card) {
                if (!isShown(card)) continue;
                var primary = primaryElement(card);
                if (primary !== card || card.matches(FOCUSABLE)) result.push(primary);
                continue;
            }
            if (!isShown(el) || isSectionTitle(el) || el.closest('.emby-scrollbuttons')) continue;
            result.push(el);
        }
        return result;
    }

    /**
     * Eigene räumliche Navigation: nächstgelegenes Element in Richtung „up/down/left/right“.
     * Hoch/Runter: nächste Reihe, darin die Spalte, die am besten zu referenceX passt.
     * Links/Rechts: bevorzugt in derselben Reihe.
     */
    function findInDirection(from, direction, referenceX) {
        var fr = from.getBoundingClientRect();
        var cx = referenceX !== undefined ? referenceX : fr.left + fr.width / 2;
        var cy = fr.top + fr.height / 2;
        var best = null;
        var bestPrimary = Infinity;
        var bestScore = Infinity;
        var fromCard = from.closest('.card');
        var candidates = navigableElements();

        for (var i = 0; i < candidates.length; i++) {
            var el = candidates[i];
            if (el === from || (fromCard && el.closest('.card') === fromCard)) continue;
            var r = el.getBoundingClientRect();
            var ex = r.left + r.width / 2;
            var ey = r.top + r.height / 2;
            var primary;
            var secondary;

            if (direction === 'down') {
                if (r.top < fr.bottom - 1) continue;
                primary = r.top - fr.bottom; secondary = Math.abs(ex - cx);
            } else if (direction === 'up') {
                if (r.bottom > fr.top + 1) continue;
                primary = fr.top - r.bottom; secondary = Math.abs(ex - cx);
            } else if (direction === 'right') {
                if (r.left < fr.right - 1) continue;
                primary = r.left - fr.right; secondary = Math.abs(ey - cy);
            } else {
                if (r.right > fr.left + 1) continue;
                primary = fr.left - r.right; secondary = Math.abs(ey - cy);
            }

            if (direction === 'down' || direction === 'up') {
                // Erst die nächste Reihe (±20 px), darin die passendste Spalte.
                if (primary < bestPrimary - 20) {
                    best = el; bestPrimary = primary; bestScore = secondary;
                } else if (Math.abs(primary - bestPrimary) <= 20 && secondary < bestScore) {
                    best = el; bestScore = secondary; bestPrimary = Math.min(primary, bestPrimary);
                }
            } else {
                var score = primary + secondary * 4;
                if (score < bestScore) {
                    best = el; bestScore = score;
                }
            }
        }
        return best;
    }

    /** Erstes Element des Seiteninhalts (oben links, ohne Kopfzeile). */
    function firstContentElement() {
        var candidates = navigableElements();
        var best = null;
        var bestRect = null;
        for (var i = 0; i < candidates.length; i++) {
            var el = candidates[i];
            if (el.closest(HEADER)) continue;
            var r = el.getBoundingClientRect();
            if (r.bottom < 0) continue; // oberhalb des sichtbaren Bereichs
            if (!best || r.top < bestRect.top - 20 || (Math.abs(r.top - bestRect.top) <= 20 && r.left < bestRect.left)) {
                best = el; bestRect = r;
            }
        }
        return best;
    }

    var ARROWS = { MoveUp: 'up', MoveDown: 'down', MoveLeft: 'left', MoveRight: 'right' };

    /**
     * Pfeiltasten selbst übernehmen? Nur im normalen Layout (Desktop/Handy) – dort ist die Navigation
     * des Web-Clients unzuverlässig. Im TV-Layout, während der Wiedergabe und in Dialogen bleibt sie beim Web-Client.
     */
    function shouldTakeOverNavigation() {
        if (document.documentElement.classList.contains('layout-tv')) return false;
        if (/^#\/(video|music|nowplaying|queue)/.test(location.hash)) return false;
        var dialogs = document.querySelectorAll('.dialogContainer .dialog.opened, .MuiDialog-root, .MuiPopover-root, [role="dialog"]');
        for (var i = 0; i < dialogs.length; i++) {
            if (isShown(dialogs[i])) return false;
        }
        return true;
    }

    /** Bei Kacheln das Haupt-Element (in der Regel der Bild-Link) statt eines Zusatzknopfs. */
    function primaryElement(el) {
        var card = el.closest('.card');
        if (!card) return el;
        if (card.matches(FOCUSABLE)) return card;
        var inner = card.querySelectorAll(FOCUSABLE);
        for (var i = 0; i < inner.length; i++) {
            var r = inner[i].getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && !inner[i].closest('[class*="cardOverlay"]')) return inner[i];
        }
        return el;
    }

    /** Eigene Navigation: eine Kachel = ein Schritt, Überschriften und Zusatzknöpfe werden übersprungen. */
    function navigate(direction) {
        markRemoteNavigation();
        var active = document.activeElement;
        var start = isShown(active) ? primaryElement(active) : null;
        var target = start ? findInDirection(start, direction) : firstContentElement();
        diag('Pfeil ' + direction + ' (Plugin) · Seite ' + (location.hash || '/') + ' · von: ' + describe(start) + (start ? '' : ' → Start im Seiteninhalt'));
        if (target) {
            focusElement(target);
            diag('  → ' + describe(target));
        } else {
            diag('  → kein Element in dieser Richtung');
        }
    }

    function focusElement(el) {
        el.focus();
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    /** Sichtbarer Rahmen um das ausgewählte Element, solange per Fernbedienung gesteuert wird. */
    function markRemoteNavigation() {
        if (!document.getElementById('jellyfinRemoteFocusStyle')) {
            var style = document.createElement('style');
            style.id = 'jellyfinRemoteFocusStyle';
            style.textContent =
                // Allgemein: deutlicher Rahmen um das ausgewählte Element
                'html.jfr-remote-nav :focus:not(.card *) { outline: 3px solid #00a4dc !important; outline-offset: 2px !important; border-radius: 6px; }' +
                // Kacheln: Rahmen um das ganze Bild statt um den Titeltext
                'html.jfr-remote-nav .card :focus { outline: none !important; }' +
                'html.jfr-remote-nav .card:focus-within .cardScalable { outline: 4px solid #00a4dc; outline-offset: 3px; border-radius: 8px; }';
            document.head.appendChild(style);
        }
        document.documentElement.classList.add('jfr-remote-nav');
    }

    document.addEventListener('mousemove', function () {
        document.documentElement.classList.remove('jfr-remote-nav');
    }, { passive: true });

    /**
     * Läuft VOR der Verarbeitung durch den Web-Client:
     *  - Liegt der Fokus auf einem unsichtbaren Element (z. B. von der vorherigen Seite), wird er
     *    zurückgesetzt – sonst sucht der Web-Client Nachbarn auf der unsichtbaren Seite und nichts passiert.
     * Danach (kurz verzögert) eigene Navigation, wenn der Web-Client nicht sinnvoll reagiert hat:
     *  - noch nichts ausgewählt → erste Kachel im Inhalt (statt Kopfzeile),
     *  - Fokus nicht bewegt (z. B. in der Kopfzeile gefangen) → nächstes Element in der Richtung,
     *  - auf einer Reihen-Überschrift gelandet → weiter zur nächsten Kachel.
     */
    function handleNavCommand(name) {
        markRemoteNavigation();
        var before = document.activeElement;
        diag('Befehl ' + name + ' · Seite ' + (location.hash || '/') + ' · Fokus vorher: ' + describe(before));

        if (before && before !== document.body && !isShown(before)) {
            before.blur();
            diag('  → Fokus lag auf unsichtbarem Element (alte Seite) – zurückgesetzt');
        }

        var beforeShown = isShown(before);
        var beforeRect = beforeShown ? before.getBoundingClientRect() : null;
        var direction = { MoveUp: 'up', MoveDown: 'down', MoveLeft: 'left', MoveRight: 'right' }[name];

        setTimeout(function () {
            var after = document.activeElement;
            var target = null;
            var reason = '';

            if (direction) {
                var afterShown = isShown(after);
                var referenceX = beforeRect ? beforeRect.left + beforeRect.width / 2 : undefined;

                if (!beforeShown && (!afterShown || after.closest(HEADER))) {
                    // Noch nichts ausgewählt: im Inhalt beginnen statt in der Kopfzeile.
                    target = firstContentElement();
                    reason = 'Start im Seiteninhalt';
                } else if (beforeShown && (after === before || !afterShown)) {
                    // Web-Client hat den Fokus nicht bewegt (z. B. aus der Kopfzeile heraus).
                    target = findInDirection(before, direction, referenceX);
                    reason = 'Web-Client hat nicht reagiert – eigene Navigation';
                } else if (afterShown && isSectionTitle(after)) {
                    target = findInDirection(after, direction, referenceX);
                    reason = 'Reihen-Überschrift übersprungen';
                }
            }

            if (target && target !== after) {
                focusElement(target);
                diag('  → ' + reason);
                after = target;
            }
            diag('  Fokus nachher: ' + describe(after));
        }, 120);
    }

    // ---------- Suche vom Handy auf diesem Gerät anzeigen ----------
    //
    // Die Fernbedienung schickt den Suchbegriff per Jellyfin-Befehl „SendString“. Der Web-Client
    // setzt den Text dabei nur ins Eingabefeld, ohne die Suche auszulösen. Deshalb lauschen wir
    // auf der Live-Verbindung (WebSocket) mit und starten die Suche selbst.

    var NativeWebSocket = window.WebSocket;

    /**
     * Die Suchseite des Web-Clients liest den Begriff aus der Adresse (#/search?query=…).
     * location.replace ersetzt den Verlaufseintrag – so entsteht nicht pro Tastendruck ein „Zurück“-Schritt.
     */
    function applySearchText(text) {
        var target = '#/search' + (text ? '?query=' + encodeURIComponent(text) : '');
        if (location.hash === target) return;
        if (/^#\/search/.test(location.hash)) {
            location.replace(location.pathname + location.search + target);
        } else {
            location.hash = target;
        }
    }

    function onServerMessage(event) {
        var message;
        try {
            message = JSON.parse(event.data);
        } catch (e) {
            return;
        }
        if (!message || !message.MessageType) return;
        if (message.MessageType === 'GeneralCommand' && message.Data && NAV_COMMANDS[message.Data.Name]) {
            var name = message.Data.Name;
            if (ARROWS[name] && shouldTakeOverNavigation()) {
                navigate(ARROWS[name]);
                return true; // erledigt – nicht an den Web-Client weitergeben
            }
            handleNavCommand(name);
            return false;
        }
        if (message.MessageType === 'GeneralCommand' || message.MessageType === 'Playstate' || message.MessageType === 'Play') {
            diag('Empfangen: ' + message.MessageType + ' ' + JSON.stringify(message.Data).slice(0, 200));
        }
        if (message.MessageType === 'GeneralCommand' && message.Data && message.Data.Name === 'SendString') {
            var text = (message.Data.Arguments && message.Data.Arguments.String) || '';
            // Nach dem eigenen Handler des Web-Clients ausführen.
            setTimeout(function () { applySearchText(text); }, 50);
        }
    }

    if (NativeWebSocket) {
        var PatchedWebSocket = function (url, protocols) {
            var socket = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
            if (!/\/socket(\?|$)/.test(String(url))) return socket;
            try {
                // Der Web-Client setzt socket.onmessage. Wir schalten uns davor: Nachrichten, die wir
                // selbst erledigen (Pfeiltasten im normalen Layout), bekommt er nicht mehr.
                var clientHandler = null;
                Object.defineProperty(socket, 'onmessage', {
                    configurable: true,
                    get: function () { return clientHandler; },
                    set: function (fn) { clientHandler = fn; }
                });
                socket.addEventListener('message', function (event) {
                    var handled = false;
                    try {
                        handled = onServerMessage(event) === true;
                    } catch (e) {
                        diag('Fehler im Plugin-Skript: ' + e.message);
                    }
                    if (!handled && clientHandler) clientHandler.call(socket, event);
                });
            } catch (e) { /* ignorieren – dann arbeitet der Web-Client wie gewohnt */ }
            return socket;
        };
        PatchedWebSocket.prototype = NativeWebSocket.prototype;
        ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (key) {
            PatchedWebSocket[key] = NativeWebSocket[key];
        });
        window.WebSocket = PatchedWebSocket;
    }

    // ---------- Automatische Anmeldung ----------

    function readJson(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || {};
        } catch (e) {
            return {};
        }
    }

    /** Gleiche Geräte-ID wie die App – so bleibt es bei einem Gerät im Dashboard. */
    function getRemoteDeviceId() {
        var id = localStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
            var bytes = crypto.getRandomValues(new Uint8Array(16));
            id = Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
            localStorage.setItem(DEVICE_ID_KEY, id);
        }
        return id;
    }

    function detectDeviceName() {
        var ua = navigator.userAgent;
        if (/iPhone/.test(ua)) return 'iPhone';
        if (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'iPad';
        if (/Android/.test(ua)) return 'Android';
        return 'Browser';
    }

    function request(method, path, authorization, body) {
        var headers = { 'Authorization': authorization, 'Accept': 'application/json' };
        if (body) headers['Content-Type'] = 'application/json';
        return fetch(SERVER_URL + path, {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : undefined
        }).then(function (response) {
            if (!response.ok) throw new Error(path + ': HTTP ' + response.status);
            return response.status === 204 ? null : response.json();
        });
    }

    /**
     * Stellt sicher, dass die Fernbedienung für den aktuell angemeldeten Benutzer
     * eigene Zugangsdaten hat. Ablauf (alles mit Jellyfin-Bordmitteln):
     *   1. Fernbedienung startet eine Quick-Connect-Anfrage (eigene Geräte-ID),
     *   2. der angemeldete Web-Client bestätigt sie,
     *   3. die Fernbedienung erhält damit ihr eigenes Token.
     */
    function ensureRemoteLogin() {
        var apiClient = window.ApiClient;
        var webToken = apiClient && apiClient.accessToken && apiClient.accessToken();
        var userId = apiClient && apiClient.getCurrentUserId && apiClient.getCurrentUserId();
        if (!webToken || !userId) return Promise.resolve();

        var config = readJson(CONFIG_KEY);
        var sameUser = config.userId && config.userId.replace(/-/g, '').toLowerCase() === userId.replace(/-/g, '').toLowerCase();
        if (config.token && config.serverUrl === SERVER_URL && sameUser) {
            return Promise.resolve(); // bereits angemeldet
        }

        var remoteAuth = 'MediaBrowser Client="' + CLIENT_NAME + '", Device="' + detectDeviceName() +
            '", DeviceId="' + getRemoteDeviceId() + '", Version="' + CLIENT_VERSION + '"';
        var webAuth = 'MediaBrowser Token="' + webToken + '"';

        return request('POST', '/QuickConnect/Initiate', remoteAuth)
            .then(function (qc) {
                return request('POST', '/QuickConnect/Authorize?code=' + encodeURIComponent(qc.Code), webAuth)
                    .then(function () {
                        return request('POST', '/Users/AuthenticateWithQuickConnect', remoteAuth, { Secret: qc.Secret });
                    });
            })
            .then(function (result) {
                var keepTarget = config.serverUrl === SERVER_URL && sameUser;
                var next = {
                    serverUrl: SERVER_URL,
                    token: result.AccessToken,
                    authMode: 'user',
                    userId: result.User && result.User.Id,
                    userName: result.User && result.User.Name
                };
                if (keepTarget) {
                    next.targetDeviceId = config.targetDeviceId;
                    next.targetSessionId = config.targetSessionId;
                    next.targetName = config.targetName;
                }
                localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
            });
    }

    var opening = false;

    /** Öffnet die Fernbedienung im selben Fenster – so bleibt sie auch in den Jellyfin-Apps. */
    function openRemote() {
        if (opening) return;
        opening = true;
        ensureRemoteLogin()
            .catch(function (err) {
                // z. B. Quick Connect ausgeschaltet – dann meldet man sich in der Fernbedienung selbst an.
                console.warn('[Jellyfin Remote] Automatische Anmeldung nicht möglich:', err);
            })
            .then(function () {
                try { sessionStorage.setItem(FROM_WEB_KEY, '1'); } catch (e) { /* ignorieren */ }
                window.location.href = APP_URL;
            });
    }

    function isRemoteLink(anchor) {
        return Boolean(anchor && anchor.href && anchor.href.split(/[?#]/)[0] === APP_URL);
    }

    // Klicks auf alle Links zur Fernbedienung abfangen (Kopfzeilen-Symbol und Menü-Eintrag).
    document.addEventListener('click', function (event) {
        var anchor = event.target && event.target.closest ? event.target.closest('a') : null;
        if (!isRemoteLink(anchor)) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        openRemote();
    }, true);

    // ---------- Symbol in der Kopfzeile ----------

    var SEARCH_SELECTORS = '.skinHeader .headerSearchButton, header a[href*="search"], .MuiToolbar-root a[href*="search"]';

    function isVisible(el) {
        if (!el || el.classList.contains('hide')) return false;
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    /**
     * Sucht den sichtbaren Such-Button der Kopfzeile. Der Web-Client enthält je nach
     * Layout (klassisch / neu) mehrere Kopfzeilen, von denen nur eine sichtbar ist.
     */
    function findSearchButton() {
        var candidates = document.querySelectorAll(SEARCH_SELECTORS);
        for (var i = 0; i < candidates.length; i++) {
            if (candidates[i].id !== BUTTON_ID && isVisible(candidates[i])) return candidates[i];
        }
        return null;
    }

    function createButton(template) {
        var button = document.createElement('a');
        button.id = BUTTON_ID;
        button.href = APP_URL;
        button.title = 'Fernbedienung';
        button.setAttribute('aria-label', 'Fernbedienung');
        button.className = template.className
            .replace(/\bheaderSearchButton\b|\bhide\b|\bMui-disabled\b/g, '')
            .trim();
        button.style.display = 'inline-flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.color = 'inherit';
        button.innerHTML = ICON;
        return button;
    }

    function update() {
        var search = findSearchButton();
        var button = document.getElementById(BUTTON_ID);

        // Keine sichtbare Suche (z. B. Anmeldeseite, Videoplayer) → Symbol ausblenden.
        if (!search || !search.parentElement) {
            if (button) button.style.display = 'none';
            return;
        }
        if (!button || button.nextElementSibling !== search) {
            if (button) button.remove();
            button = createButton(search);
            search.parentElement.insertBefore(button, search);
        }
        button.style.display = 'inline-flex';
    }

    var scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(function () {
            scheduled = false;
            update();
        });
    }

    function start() {
        if (!SHOW_HEADER_BUTTON) return;
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        update();
    }

    if (document.body) {
        start();
    } else {
        document.addEventListener('DOMContentLoaded', start);
    }
})();
