/**
 * Kleine, wiederverwendbare UI-Hilfsfunktionen.
 */

import { TICKS_PER_SECOND } from './api.js';

export const $ = (selector, root = document) => root.querySelector(selector);

/**
 * Erzeugt ein DOM-Element. Texte werden immer über textContent gesetzt,
 * damit Daten vom Server niemals als HTML interpretiert werden.
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value; // nur für statische Icons verwenden
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

/** Verzögert Aufrufe, bis für `wait` ms keine neuen Aufrufe mehr kamen. */
export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Lässt höchstens einen Aufruf pro `wait` ms durch – der letzte Aufruf geht nie verloren. */
export function throttle(fn, wait = 150) {
  let last = 0;
  let timer;
  return (...args) => {
    const remaining = wait - (Date.now() - last);
    clearTimeout(timer);
    if (remaining <= 0) {
      last = Date.now();
      fn(...args);
    } else {
      timer = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

/** Formatiert Jellyfin-Ticks als m:ss bzw. h:mm:ss. */
export function formatTicks(ticks = 0) {
  const total = Math.max(0, Math.floor(ticks / TICKS_PER_SECOND));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** Untertitel für ein Medienelement, z. B. "Serie · S01E03" oder "2019 · Film". */
export function itemSubtitle(item) {
  if (item.Type === 'Episode') {
    const pad = (n) => String(n ?? 0).padStart(2, '0');
    const code = item.ParentIndexNumber != null ? `S${pad(item.ParentIndexNumber)}E${pad(item.IndexNumber)}` : '';
    return [item.SeriesName, code].filter(Boolean).join(' · ');
  }
  return [item.ProductionYear, 'Film'].filter(Boolean).join(' · ');
}

// ---------- Toast-Benachrichtigungen ----------

let toastTimer;

export function toast(message, type = 'info') {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('is-error', type === 'error');
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), type === 'error' ? 4000 : 2200);
}

/** Zeigt einen Fehler als Toast an (Abbrüche durch AbortController werden ignoriert). */
export function showError(err) {
  if (err?.name === 'AbortError') return;
  console.error(err);
  toast(err?.message || 'Unbekannter Fehler', 'error');
}

/** Setzt einen Button während einer asynchronen Aktion in den Ladezustand. */
export async function withLoading(button, task) {
  button.classList.add('is-loading');
  button.disabled = true;
  try {
    return await task();
  } finally {
    button.classList.remove('is-loading');
    button.disabled = false;
  }
}
