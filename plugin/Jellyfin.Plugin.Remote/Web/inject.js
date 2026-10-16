/**
 * Jellyfin Remote – fügt in der Kopfzeile des Jellyfin-Web-Clients ein Symbol ein,
 * das die Fernbedienung (/remote/) in einem neuen Tab öffnet.
 *
 * Das Symbol wird direkt neben der Suche platziert und übernimmt deren Gestaltung,
 * damit es in alten und neuen Layouts des Web-Clients passend aussieht.
 */
(function () {
    'use strict';

    var BUTTON_ID = 'jellyfinRemoteHeaderButton';
    var APP_URL = new URL('../remote/', document.baseURI).href;
    var ICON =
        '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="9" r="2.5"/>' +
        '<path d="M10 15h.01M14 15h.01M10 18h.01M14 18h.01"/></svg>';

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
        button.target = '_blank';
        button.rel = 'noopener';
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
