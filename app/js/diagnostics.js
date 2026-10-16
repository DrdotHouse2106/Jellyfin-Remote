/**
 * Diagnoseprotokoll der Fernbedienung. Ist es in den Plugin-Einstellungen eingeschaltet,
 * werden gesendete Befehle mit Antwortzeit an den Server übertragen
 * (Ansicht: Dashboard → Plugins → Jellyfin Remote).
 */

let api = null;
let enabled = false;
let timer = null;
const queue = [];

/** Fragt beim Plugin nach, ob das Protokoll eingeschaltet ist, und startet es gegebenenfalls. */
export async function initDiagnostics(jellyfinApi) {
  api = jellyfinApi;
  try {
    const info = await api.getPluginInfo();
    enabled = Boolean(info?.Diagnostics);
  } catch {
    enabled = false; // kein Plugin installiert
  }
  clearInterval(timer);
  if (enabled) {
    timer = setInterval(flush, 3000);
    log(`Fernbedienung gestartet · ${navigator.userAgent}`);
  }
}

export function log(message) {
  if (!enabled) return;
  queue.push(`${new Date().toLocaleTimeString('de-DE')} ${message}`);
}

function flush() {
  if (!queue.length || !api) return;
  const lines = queue.splice(0, queue.length);
  api.request('/JellyfinRemote/Diagnostics', { method: 'POST', body: { Source: 'Fernbedienung', Lines: lines } }).catch(() => {});
}
