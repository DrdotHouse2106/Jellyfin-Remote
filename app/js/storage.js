/**
 * Persistente Einstellungen im localStorage.
 *
 * Gespeichert werden: Server-URL, API-Token, eine zufällige Geräte-ID
 * für diese App sowie das zuletzt gewählte Zielgerät.
 */

const CONFIG_KEY = 'jellyfin-remote.config';
const DEVICE_ID_KEY = 'jellyfin-remote.device-id';

/** Liest die gespeicherte Konfiguration (leeres Objekt, falls nichts vorhanden). */
export function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
  } catch {
    return {};
  }
}

/** Führt die übergebenen Werte mit der gespeicherten Konfiguration zusammen. */
export function saveConfig(patch) {
  const config = { ...loadConfig(), ...patch };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  return config;
}

/** Löscht Server-URL, Token und Zielgerät. */
export function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

/** Liefert eine stabile, zufällige ID, mit der sich die App beim Server ausweist. */
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? fallbackUuid()).replace(/-/g, '');
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** crypto.randomUUID ist nur in sicheren Kontexten (HTTPS) verfügbar. */
function fallbackUuid() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
