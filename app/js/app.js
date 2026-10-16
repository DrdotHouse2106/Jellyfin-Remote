/**
 * Einstiegspunkt der App: hält den globalen Zustand, steuert die Ansichten
 * und verwaltet das aktuell gewählte Zielgerät.
 */

import { JellyfinApi, ApiError, isNativeApp, normalizeServerUrl } from './api.js';
import { loadConfig, saveConfig, clearConfig, getDeviceId } from './storage.js';
import { $, toast } from './ui.js';
import { initSetupView } from './views/setup.js';
import { initSessionsView } from './views/sessions.js';
import { initRemoteView } from './views/remote.js';
import { initSearchView } from './views/search.js';

/** Ansichten, in denen Kopfzeile bzw. Tab-Leiste sichtbar sind. */
const WITH_TOPBAR = ['sessions', 'remote', 'search'];
const WITH_TABBAR = ['remote', 'search'];

const app = {
  config: loadConfig(),
  deviceId: getDeviceId(),
  /** @type {JellyfinApi|null} */
  api: null,
  /** Aktuell gesteuerte Jellyfin-Sitzung (z. B. der Fernseher). */
  session: null,
  views: {},
  currentView: null,
  /** Server-URL aus QR-Code (?server=…) oder Deep-Link, die im Setup vorausgefüllt wird. */
  pendingServerUrl: null,

  /**
   * Speichert die Zugangsdaten und erstellt den API-Client.
   * @param {{serverUrl: string, token: string, authMode: 'user'|'token', userId: ?string, userName: ?string}} credentials
   */
  connect(credentials) {
    const previous = this.config;
    if (previous.serverUrl && previous.serverUrl !== credentials.serverUrl) this.clearTarget();
    // Ein altes Benutzer-Token beim Server abmelden, damit keine verwaisten Anmeldungen bleiben.
    if (previous.authMode === 'user' && previous.token && previous.token !== credentials.token) {
      this.api?.logout().catch(() => {});
    }

    this.config = saveConfig(credentials);
    this.api = createApi(credentials.serverUrl, credentials.token);
  },

  /** Meldet ab, entfernt alle gespeicherten Daten und kehrt zur Einrichtung zurück. */
  logout() {
    if (this.config.authMode === 'user') this.api?.logout().catch(() => {});
    clearConfig();
    this.config = {};
    this.api = null;
    this.session = null;
    updateDeviceChip();
    this.show('setup');
  },

  /** Merkt sich das gewählte Zielgerät dauerhaft. */
  selectSession(session) {
    this.session = session;
    this.config = saveConfig({
      targetDeviceId: session.DeviceId,
      targetSessionId: session.Id,
      targetName: session.DeviceName,
    });
    setOnline(true);
    updateDeviceChip();
  },

  clearTarget() {
    this.session = null;
    this.config = saveConfig({ targetDeviceId: null, targetSessionId: null, targetName: null });
    updateDeviceChip();
  },

  /**
   * Sucht die aktuelle Sitzung des Zielgeräts. Jellyfin vergibt bei jeder
   * Neuverbindung eine neue Sitzungs-ID – daher wird über die Geräte-ID gesucht.
   */
  async resolveSession() {
    const sessions = await this.api.getSessions();
    const found =
      sessions.find((s) => s.DeviceId && s.DeviceId === this.config.targetDeviceId) ??
      sessions.find((s) => s.Id === this.session?.Id) ??
      null;

    setOnline(Boolean(found));
    if (found) {
      this.session = found;
      if (found.Id !== this.config.targetSessionId || found.DeviceName !== this.config.targetName) {
        this.config = saveConfig({ targetSessionId: found.Id, targetName: found.DeviceName });
        updateDeviceChip();
      }
    }
    return found;
  },

  /**
   * Führt eine Aktion für das Zielgerät aus. Schlägt sie fehl, weil sich die
   * Sitzungs-ID geändert hat, wird die Sitzung neu ermittelt und einmal wiederholt.
   * @returns {Promise<boolean>} false, wenn kein Zielgerät gewählt ist.
   */
  async withTarget(action) {
    if (!this.session) {
      toast('Bitte zuerst ein Zielgerät wählen.', 'error');
      this.show('sessions');
      return false;
    }
    try {
      await action(this.session.Id);
    } catch (err) {
      if (err.status !== 400 && err.status !== 404) throw err;
      const fresh = await this.resolveSession();
      if (!fresh) throw new ApiError('Das Zielgerät ist nicht mehr verbunden.');
      await action(fresh.Id);
    }
    return true;
  },

  /** Wechselt die sichtbare Ansicht. */
  show(name) {
    if (this.currentView === name) return;
    this.views[this.currentView]?.onHide?.();

    for (const key of Object.keys(this.views)) $(`#view-${key}`).hidden = key !== name;
    $('#topbar').hidden = !WITH_TOPBAR.includes(name);
    $('#tabbar').hidden = !WITH_TABBAR.includes(name);
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.classList.toggle('is-active', tab.dataset.tab === name);
    });

    this.currentView = name;
    window.scrollTo(0, 0);
    this.views[name]?.onShow?.();
  },
};

function createApi(serverUrl, token) {
  return new JellyfinApi({
    serverUrl,
    token,
    deviceId: app.deviceId,
    // Token wurde widerrufen oder ist ungültig → zur Anmeldung zurück.
    onUnauthorized: () => {
      if (app.currentView === 'setup') return;
      toast('Sitzung abgelaufen – bitte erneut anmelden.', 'error');
      app.show('setup');
    },
  });
}

// ---------- Kopfzeile ----------

function updateDeviceChip() {
  $('#device-name').textContent = app.session?.DeviceName ?? app.config.targetName ?? 'Kein Gerät gewählt';
  if (!app.session) setOnline(null);
}

/** Statuspunkt: true = online, false = offline, null = unbekannt. */
function setOnline(online) {
  const dot = $('#device-status');
  dot.classList.toggle('is-online', online === true);
  dot.classList.toggle('is-offline', online === false);
}

// ---------- Kopplung (QR-Code / Deep-Link) ----------

/**
 * Übernimmt eine Server-URL aus einem Link, z. B.
 *   https://jellyfin.example.de/remote/?server=https://jellyfin.example.de
 *   jellyfinremote://connect?server=https://jellyfin.example.de   (iPhone-App)
 * @returns {boolean} true, wenn die Einrichtung geöffnet werden soll.
 */
function applyServerLink(link) {
  let server;
  try {
    server = new URL(link).searchParams.get('server');
    if (!server) return false;
    server = normalizeServerUrl(server);
  } catch {
    return false;
  }

  // Bereits mit genau diesem Server verbunden → nichts zu tun.
  if (server === app.config.serverUrl && app.config.token) return false;
  app.pendingServerUrl = server;
  return true;
}

function openSetupForPendingServer() {
  if (app.currentView === 'setup') app.views.setup.onShow();
  else app.show('setup');
}

/** In der nativen App: Links mit dem Schema jellyfinremote:// verarbeiten. */
function listenForDeepLinks() {
  const AppPlugin = window.Capacitor?.Plugins?.App;
  if (!AppPlugin) return;

  AppPlugin.addListener('appUrlOpen', ({ url }) => {
    if (applyServerLink(url)) openSetupForPendingServer();
  });
  AppPlugin.getLaunchUrl?.().then((result) => {
    if (result?.url && applyServerLink(result.url)) openSetupForPendingServer();
  });
}

// ---------- Start ----------

function init() {
  app.views = {
    setup: initSetupView(app),
    sessions: initSessionsView(app),
    remote: initRemoteView(app),
    search: initSearchView(app),
  };

  $('#btn-change-device').addEventListener('click', () => app.show('sessions'));
  $('#btn-settings').addEventListener('click', () => app.show('setup'));
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => app.show(tab.dataset.tab));
  });

  setupBackToJellyfin();

  // Aktiviert :active-Zustände für Touch-Feedback in iOS Safari.
  document.addEventListener('touchstart', () => {}, { passive: true });

  // ?server=… aus dem QR-Code übernehmen und aus der Adresszeile entfernen.
  const fromLink = applyServerLink(location.href);
  if (location.search.includes('server=')) history.replaceState(null, '', location.pathname);

  const { serverUrl, token, targetDeviceId, targetSessionId, targetName } = app.config;
  if (serverUrl && token) {
    app.api = createApi(serverUrl, token);
    if (targetDeviceId || targetSessionId) {
      app.session = { Id: targetSessionId, DeviceId: targetDeviceId, DeviceName: targetName };
    }
  }

  if (fromLink || !app.api) app.show('setup');
  else app.show(app.session ? 'remote' : 'sessions');
  updateDeviceChip();

  if (isNativeApp) listenForDeepLinks();
  registerServiceWorker();
}

/**
 * „Zurück zu Jellyfin“: immer sichtbar, wenn die App über das Plugin auf dem
 * Jellyfin-Server läuft (…/remote/). Kam man direkt aus Jellyfin, geht es per
 * Verlauf zurück (Jellyfin bleibt dann so, wie man es verlassen hat), sonst zur Startseite.
 */
function setupBackToJellyfin() {
  const servedByPlugin = !isNativeApp && /\/remote\//.test(location.pathname);
  // Absolut berechnen – relative Links würden sich auf die versionierte <base> beziehen.
  const jellyfinUrl = location.pathname.replace(/\/remote\/.*$/, '/web/');

  document.querySelectorAll('.js-back-jellyfin').forEach((link) => {
    link.hidden = !servedByPlugin;
    link.href = jellyfinUrl;
    link.addEventListener('click', (event) => {
      const cameFromJellyfin = document.referrer && new URL(document.referrer).pathname.includes('/web/');
      if (cameFromJellyfin && history.length > 1) {
        event.preventDefault();
        history.back();
      }
      // sonst folgt der Link normal zu ../web/
    });
  });
}

function registerServiceWorker() {
  // In der nativen App (Capacitor) liegen die Dateien ohnehin lokal – kein Service Worker nötig.
  if (isNativeApp || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    // Immer …/remote/service-worker.js (nicht relativ zur versionierten <base>),
    // damit der Service Worker für die ganze App unter /remote/ zuständig ist.
    const appRoot = location.href.replace(/(\/remote\/).*$/, '$1');
    navigator.serviceWorker.register(new URL('service-worker.js', appRoot)).catch((err) => {
      console.warn('Service Worker konnte nicht registriert werden:', err);
    });
  });
}

init();
