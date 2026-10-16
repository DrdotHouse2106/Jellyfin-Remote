/**
 * Suche: Live-Suche (debounced) nach Filmen und Episoden.
 *
 * Zwei Modi:
 *  - Auf dem Handy: Ergebnisse mit Cover, ein Tipp startet die Wiedergabe auf dem Zielgerät.
 *  - Auf dem Fernseher: Der Suchbegriff wird live an das Zielgerät übertragen (Jellyfin-Befehle
 *    „GoToSearch“ und „SendString“), die Ergebnisse erscheinen dort. Auf dem Handy bleibt ein
 *    kleines Steuerkreuz zum Auswählen.
 */

import { $, h, debounce, itemSubtitle, toast, showError } from '../ui.js';
import { saveConfig } from '../storage.js';

const MIN_CHARS = 2;
/** So lange gilt die Suche auf dem Zielgerät als geöffnet, danach wird sie erneut geöffnet. */
const TV_SEARCH_REOPEN_MS = 60_000;
const PLAY_ICON = '<svg class="ico ico--fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function initSearchView(app) {
  const input = $('#search-input');
  const clearBtn = $('#search-clear');
  const status = $('#search-status');
  const results = $('#search-results');
  const tvRow = $('#search-on-tv-row');
  const tvSwitch = $('#search-on-tv');
  const tvTarget = $('#search-on-tv-target');
  const tvPanel = $('#tv-search');

  let controller = null;
  let lastTerm = '';

  // Zustand der Suche auf dem Zielgerät
  let tvMode = false;
  let tvLastTerm = null;
  let tvSearchOpenedAt = 0;
  let tvDeviceId = null;

  function setStatus(text) {
    status.textContent = text;
    status.hidden = !text;
  }

  // ---------- Suche auf dem Handy ----------

  async function search(term) {
    if (term === lastTerm || input.value.trim() !== term) return;
    lastTerm = term;

    controller?.abort(); // vorherige, noch laufende Anfrage abbrechen
    controller = new AbortController();
    setStatus('Suche …');

    try {
      const data = await app.api.searchItems(term, { userId: app.config.userId ?? app.session?.UserId, signal: controller.signal });
      const items = data?.Items ?? [];
      render(items);
      setStatus(items.length ? '' : `Keine Treffer für „${term}“.`);
    } catch (err) {
      if (err.name === 'AbortError') return;
      lastTerm = '';
      results.replaceChildren();
      setStatus(err.message);
    }
  }

  const debouncedSearch = debounce(search, 350);

  function render(items) {
    results.replaceChildren(...items.map(resultCard));
  }

  function resultCard(item) {
    const url = app.api.imageUrl(item, 360);
    const poster = h('span', { class: 'item__poster', text: item.Name?.charAt(0) ?? '?' });

    if (url) {
      const img = h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' });
      img.addEventListener('load', () => img.classList.add('is-loaded'));
      img.addEventListener('error', () => img.remove());
      poster.append(img);
    }
    poster.append(h('span', { class: 'item__play', html: PLAY_ICON }));

    return h(
      'button',
      { type: 'button', class: 'item', 'aria-label': `${item.Name} abspielen`, onClick: () => play(item) },
      poster,
      h('span', { class: 'item__title', text: item.Name }),
      h('span', { class: 'item__sub', text: itemSubtitle(item) }),
    );
  }

  async function play(item) {
    try {
      const started = await app.withTarget((id) => app.api.play(id, item.Id));
      if (!started) return;
      toast(`▶︎ ${item.Name} – auf ${app.session.DeviceName}`);
      app.show('remote');
    } catch (err) {
      showError(err);
    }
  }

  // ---------- Suche auf dem Fernseher ----------

  /** Unterstützt das Zielgerät das Übertragen von Text (z. B. Jellyfin im Browser oder auf dem TV)? */
  function targetSupportsTvSearch() {
    const commands = app.session?.Capabilities?.SupportedCommands ?? [];
    return commands.includes('SendString');
  }

  async function sendToTv(term) {
    if (term === tvLastTerm) return;
    tvLastTerm = term;

    try {
      // Suche auf dem Zielgerät öffnen (erneut, falls dort inzwischen etwas anderes angezeigt wird).
      if (tvDeviceId !== app.session?.DeviceId || Date.now() - tvSearchOpenedAt > TV_SEARCH_REOPEN_MS) {
        const opened = await app.withTarget((id) => app.api.sendGeneralCommand(id, 'GoToSearch'));
        if (!opened) return;
        tvDeviceId = app.session.DeviceId;
        await wait(700); // Suchseite auf dem Zielgerät laden lassen
      }
      tvSearchOpenedAt = Date.now();
      await app.withTarget((id) => app.api.sendCommand(id, 'SendString', { String: term }));
      setStatus(term ? `„${term}“ wird auf ${app.session.DeviceName} gesucht – mit den Tasten oben auswählen.` : '');
    } catch (err) {
      tvLastTerm = null;
      showError(err);
    }
  }

  const debouncedSendToTv = debounce(sendToTv, 400);

  function applyMode() {
    const available = !tvRow.hidden;
    tvMode = available && tvSwitch.checked;
    tvPanel.hidden = !tvMode;
    results.hidden = tvMode;
    input.placeholder = tvMode ? 'Auf dem Fernseher suchen' : 'Filme und Episoden suchen';

    const term = input.value.trim();
    if (tvMode) {
      setStatus(term ? '' : `Tippe einen Suchbegriff – die Ergebnisse erscheinen auf ${app.session.DeviceName}.`);
    } else if (term.length < MIN_CHARS) {
      setStatus('Tippe mindestens zwei Zeichen ein.');
    }
  }

  async function updateTvAvailability() {
    if (app.session && !app.session.Capabilities) {
      await app.resolveSession().catch(() => null);
    }
    const supported = targetSupportsTvSearch();
    tvRow.hidden = !supported;
    if (supported) {
      tvTarget.textContent = `Ergebnisse auf „${app.session.DeviceName}“`;
      tvSwitch.checked = app.config.searchOnTv !== false; // Standard: an
    }
    applyMode();
  }

  tvSwitch.addEventListener('change', () => {
    app.config = saveConfig({ searchOnTv: tvSwitch.checked });
    tvLastTerm = null;
    applyMode();
    input.dispatchEvent(new Event('input'));
  });

  // Steuerkreuz zum Auswählen der Ergebnisse auf dem Fernseher
  tvPanel.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-cmd]');
    if (!button) return;
    app.withTarget((id) => app.api.sendGeneralCommand(id, button.dataset.cmd)).catch(showError);
  });

  // ---------- Eingabe ----------

  input.addEventListener('input', () => {
    const term = input.value.trim();
    clearBtn.hidden = !input.value;

    if (tvMode) {
      debouncedSendToTv(term);
      return;
    }

    if (term.length < MIN_CHARS) {
      controller?.abort();
      lastTerm = '';
      results.replaceChildren();
      setStatus('Tippe mindestens zwei Zeichen ein.');
      return;
    }
    debouncedSearch(term);
  });

  // „Suchen“ auf der Tastatur blendet die Tastatur aus.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') input.blur();
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.dispatchEvent(new Event('input'));
    input.focus();
  });

  return { onShow: updateTvAvailability };
}
