/**
 * Einstiegspunkt der App: hält den globalen Zustand, steuert die Ansichten
 * und verwaltet das aktuell gewählte Zielgerät.
 */

import { JellyfinApi, ApiError, isNativeApp } from './api.js';
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

  // Aktiviert :active-Zustände für Touch-Feedback in iOS Safari.
  document.addEventListener('touchstart', () => {}, { passive: true });

  const { serverUrl, token, targetDeviceId, targetSessionId, targetName } = app.config;
  if (!serverUrl || !token) {
    app.show('setup');
  } else {
    app.api = createApi(serverUrl, token);
    if (targetDeviceId || targetSessionId) {
      app.session = { Id: targetSessionId, DeviceId: targetDeviceId, DeviceName: targetName };
      app.show('remote');
    } else {
      app.show('sessions');
    }
  }
  updateDeviceChip();

  registerServiceWorker();
}

function registerServiceWorker() {
  // In der nativen App (Capacitor) liegen die Dateien ohnehin lokal – kein Service Worker nötig.
  if (isNativeApp || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('Service Worker konnte nicht registriert werden:', err);
    });
  });
}

init();
