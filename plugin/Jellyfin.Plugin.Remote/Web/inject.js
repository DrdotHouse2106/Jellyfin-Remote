/**
 * Jellyfin Remote – Skript für den Jellyfin-Web-Client (läuft auch in den Jellyfin-Apps
 * für iOS und Android, da diese den Web-Client anzeigen).
 *
 * 1. Fügt in der Kopfzeile neben der Suche ein Fernbedienungs-Symbol ein.
 * 2. Öffnet die Fernbedienung beim Tippen auf das Symbol oder den Menü-Eintrag
 *    direkt angemeldet: Über Quick Connect wird mit der bestehenden Anmeldung ein
 *    eigenes Zugangs-Token für die Fernbedienung ausgestellt – ohne Passwort.
 */
(function () {
    'use strict';

    var BUTTON_ID = 'jellyfinRemoteHeaderButton';
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
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        update();
    }

    if (document.body) {
        start();
    } else {
        document.addEventListener('DOMContentLoaded', start);
    }
})();
