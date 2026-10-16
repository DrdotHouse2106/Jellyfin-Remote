/**
 * Einrichtung: Server-URL eingeben und anmelden – wahlweise mit
 * Jellyfin-Benutzerkonto (Benutzername/Passwort), Quick Connect oder API-Token.
 */

import { JellyfinApi, ApiError, normalizeServerUrl, isNativeApp } from '../api.js';
import { $, withLoading } from '../ui.js';

export function initSetupView(app) {
  const form = $('#setup-form');
  const urlInput = $('#input-url');
  const usernameInput = $('#input-username');
  const passwordInput = $('#input-password');
  const tokenInput = $('#input-token');
  const testBtn = $('#btn-test');
  const saveBtn = $('#btn-save');
  const statusBox = $('#setup-status');
  const logoutBtn = $('#btn-logout');

  let mode = 'user';
  /** Bricht eine laufende Quick-Connect-Anmeldung ab. */
  let quickConnectAbort = null;

  const SUBMIT_LABELS = { user: 'Anmelden', quickconnect: 'Code anfordern', token: 'Anmelden' };

  function setStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `status-box is-${type}`;
    statusBox.hidden = false;
  }

  function setMode(next) {
    stopQuickConnect();
    mode = next;
    saveBtn.textContent = SUBMIT_LABELS[mode];
    document.querySelectorAll('.segmented__btn').forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
    $('#auth-user').hidden = mode !== 'user';
    $('#auth-token').hidden = mode !== 'token';
    $('#auth-quickconnect').hidden = mode !== 'quickconnect';
  }

  function stopQuickConnect() {
    quickConnectAbort?.abort();
    quickConnectAbort = null;
    $('#qc-code').hidden = true;
  }

  const wait = (ms, signal) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Abgebrochen', 'AbortError'));
      });
    });

  /**
   * Quick Connect: Code anzeigen und warten, bis er in einer angemeldeten
   * Jellyfin-App bestätigt wurde. Liefert anschließend die Zugangsdaten.
   */
  async function loginWithQuickConnect(serverUrl) {
    const api = createApi(serverUrl);
    if (!(await api.isQuickConnectEnabled())) {
      throw new ApiError('Quick Connect ist auf dem Server ausgeschaltet (Dashboard → Allgemein → Quick Connect).');
    }

    const request = await api.initiateQuickConnect();
    const controller = new AbortController();
    quickConnectAbort = controller;

    const codeBox = $('#qc-code');
    codeBox.textContent = request.Code;
    codeBox.hidden = false;
    setStatus('Warte auf Bestätigung … Code in Jellyfin unter Einstellungen → Quick Connect eingeben.', 'ok');

    const deadline = Date.now() + 10 * 60 * 1000; // Jellyfin verwirft Anfragen nach 10 Minuten
    while (Date.now() < deadline) {
      await wait(2000, controller.signal);
      const state = await api.getQuickConnectState(request.Secret, { signal: controller.signal });
      if (state?.Authenticated) {
        const result = await api.authenticateWithQuickConnect(request.Secret);
        stopQuickConnect();
        return {
          serverUrl,
          token: result.AccessToken,
          authMode: 'user',
          userId: result.User?.Id ?? null,
          userName: result.User?.Name ?? null,
        };
      }
    }
    stopQuickConnect();
    throw new ApiError('Der Code ist abgelaufen – bitte einen neuen anfordern.');
  }

  const createApi = (serverUrl, token) => new JellyfinApi({ serverUrl, token, deviceId: app.deviceId });

  /** Prüft, ob der Server erreichbar ist (bei API-Token zusätzlich, ob das Token gültig ist). */
  async function testConnection() {
    const serverUrl = normalizeServerUrl(urlInput.value);
    urlInput.value = serverUrl;

    if (mode === 'token') {
      const token = tokenInput.value.trim();
      if (!token) throw new ApiError('Bitte ein API-Token eingeben.');
      const info = await createApi(serverUrl, token).getSystemInfo();
      setStatus(`✓ Token gültig – „${info.ServerName}“ · Jellyfin ${info.Version}`, 'ok');
    } else {
      const info = await createApi(serverUrl).getPublicSystemInfo();
      const plugin = await createApi(serverUrl).getPluginInfo().catch(() => null);
      setStatus(
        `✓ Server „${info.ServerName}“ erreichbar · Jellyfin ${info.Version}` +
          (plugin?.Version ? ` · Remote-Plugin ${plugin.Version}` : ''),
        'ok',
      );
    }
  }

  /** Meldet sich an und liefert die zu speichernden Zugangsdaten. */
  async function login() {
    const serverUrl = normalizeServerUrl(urlInput.value);
    urlInput.value = serverUrl;

    if (mode === 'token') {
      const token = tokenInput.value.trim();
      if (!token) throw new ApiError('Bitte ein API-Token eingeben.');
      await createApi(serverUrl, token).getSystemInfo();
      return { serverUrl, token, authMode: 'token', userId: null, userName: null };
    }

    if (mode === 'quickconnect') return loginWithQuickConnect(serverUrl);

    const username = usernameInput.value.trim();
    if (!username) throw new ApiError('Bitte einen Benutzernamen eingeben.');
    try {
      const result = await createApi(serverUrl).authenticateByName(username, passwordInput.value);
      return {
        serverUrl,
        token: result.AccessToken,
        authMode: 'user',
        userId: result.User?.Id ?? null,
        userName: result.User?.Name ?? username,
      };
    } catch (err) {
      if (err.status === 401) throw new ApiError('Benutzername oder Passwort ist falsch.', 401);
      throw err;
    }
  }

  /**
   * Läuft die App auf derselben Domain wie Jellyfin (z. B. über das Plugin unter
   * jellyfin.example.de/remote/), wird die Server-URL automatisch erkannt und vorausgefüllt.
   * Eine Basis-URL wie /jellyfin/remote/ wird dabei berücksichtigt.
   */
  async function detectServer() {
    if (isNativeApp || !/^https?:$/.test(location.protocol)) return;
    const basePath = location.pathname.includes('/remote/') ? location.pathname.replace(/\/remote\/.*$/, '') : '';
    const candidate = location.origin + basePath;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const info = await createApi(candidate).getPublicSystemInfo({ signal: controller.signal });
      if (info?.ServerName && !urlInput.value) {
        urlInput.value = candidate;
        setStatus(`Server „${info.ServerName}“ erkannt.`, 'ok');
      }
    } catch {
      // Kein Jellyfin unter dieser Domain – URL muss manuell eingegeben werden.
    } finally {
      clearTimeout(timer);
    }
  }

  document.querySelectorAll('.segmented__btn').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  $('#btn-toggle-token').addEventListener('click', () => {
    tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
  });

  testBtn.addEventListener('click', () =>
    withLoading(testBtn, () => testConnection().catch((err) => setStatus(err.message, 'error'))),
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    withLoading(saveBtn, async () => {
      try {
        app.connect(await login());
        passwordInput.value = '';
        app.show(app.session ? 'remote' : 'sessions');
      } catch (err) {
        if (err.name !== 'AbortError') setStatus(err.message, 'error');
      }
    });
  });

  $('#btn-setup-back').addEventListener('click', () => app.show(app.session ? 'remote' : 'sessions'));

  logoutBtn.addEventListener('click', () => {
    if (confirm('Abmelden und alle gespeicherten Daten löschen?')) app.logout();
  });

  return {
    onHide: stopQuickConnect,
    onShow() {
      const { serverUrl, token, authMode, userName } = app.config;
      setMode(authMode ?? 'user');
      urlInput.value = serverUrl ?? '';
      usernameInput.value = userName ?? '';
      passwordInput.value = '';
      tokenInput.value = authMode === 'token' ? token ?? '' : '';
      tokenInput.type = 'password';
      statusBox.hidden = true;
      logoutBtn.hidden = !token;
      $('#btn-setup-back').hidden = !token;

      if (token && authMode === 'user') setStatus(`Angemeldet als ${userName}.`, 'ok');

      // Server-URL aus QR-Code bzw. Deep-Link der iPhone-App übernehmen.
      const suggested = app.pendingServerUrl;
      app.pendingServerUrl = null;
      if (suggested) {
        urlInput.value = suggested;
        setStatus('Server-URL übernommen – bitte anmelden.', 'ok');
      } else if (!serverUrl) {
        detectServer();
      }
    },
  };
}
