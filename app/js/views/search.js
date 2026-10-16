/**
 * Suche: Live-Suche (debounced) nach Filmen und Episoden.
 * Ein Tipp auf ein Ergebnis startet die Wiedergabe auf dem Zielgerät.
 */

import { $, h, debounce, itemSubtitle, toast, showError } from '../ui.js';

const MIN_CHARS = 2;
const PLAY_ICON = '<svg class="ico ico--fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>';

export function initSearchView(app) {
  const input = $('#search-input');
  const clearBtn = $('#search-clear');
  const status = $('#search-status');
  const results = $('#search-results');

  let controller = null;
  let lastTerm = '';

  function setStatus(text) {
    status.textContent = text;
    status.hidden = !text;
  }

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
      toast(`▶\uFE0E ${item.Name} – auf ${app.session.DeviceName}`);
      app.show('remote');
    } catch (err) {
      showError(err);
    }
  }

  input.addEventListener('input', () => {
    const term = input.value.trim();
    clearBtn.hidden = !input.value;

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

  return {};
}
