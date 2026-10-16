/**
 * Einrichtung: Server-URL eingeben und anmelden – wahlweise mit
 * Jellyfin-Benutzerkonto (Benutzername/Passwort) oder mit API-Token.
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

  function setStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `status-box is-${type}`;
    statusBox.hidden = false;
  }

  function setMode(next) {
    mode = next;
    document.querySelectorAll('.segmented__btn').forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
    $('#auth-user').hidden = mode !== 'user';
    $('#auth-token').hidden = mode !== 'token';
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
      setStatus(`✓ Server „${info.ServerName}“ erreichbar · Jellyfin ${info.Version}`, 'ok');
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
   * Läuft die App auf derselben Domain wie Jellyfin (z. B. jellyfin.example.de/remote/),
   * wird die Server-URL automatisch erkannt und vorausgefüllt.
   */
  async function detectServer() {
    if (isNativeApp || !/^https?:$/.test(location.protocol)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const info = await createApi(location.origin).getPublicSystemInfo({ signal: controller.signal });
      if (info?.ServerName && !urlInput.value) {
        urlInput.value = location.origin;
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
        setStatus(err.message, 'error');
      }
    });
  });

  $('#btn-setup-back').addEventListener('click', () => app.show(app.session ? 'remote' : 'sessions'));

  logoutBtn.addEventListener('click', () => {
    if (confirm('Abmelden und alle gespeicherten Daten löschen?')) app.logout();
  });

  return {
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
      if (!serverUrl) detectServer();
    },
  };
}
