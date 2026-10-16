/**
 * Einrichtung: Server-URL und API-Token eingeben, testen und speichern.
 */

import { JellyfinApi, ApiError, normalizeServerUrl } from '../api.js';
import { $, withLoading } from '../ui.js';

export function initSetupView(app) {
  const form = $('#setup-form');
  const urlInput = $('#input-url');
  const tokenInput = $('#input-token');
  const testBtn = $('#btn-test');
  const saveBtn = $('#btn-save');
  const statusBox = $('#setup-status');
  const logoutBtn = $('#btn-logout');

  function setStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = `status-box is-${type}`;
    statusBox.hidden = false;
  }

  /** Prüft die Eingaben gegen /System/Info und liefert die bereinigten Zugangsdaten. */
  async function verify() {
    const serverUrl = normalizeServerUrl(urlInput.value);
    const token = tokenInput.value.trim();
    if (!token) throw new ApiError('Bitte ein API-Token eingeben.');

    const api = new JellyfinApi({ serverUrl, token, deviceId: app.deviceId });
    const info = await api.getSystemInfo();

    urlInput.value = serverUrl;
    setStatus(`✓ Verbunden mit „${info.ServerName}“ · Jellyfin ${info.Version}`, 'ok');
    return { serverUrl, token };
  }

  $('#btn-toggle-token').addEventListener('click', () => {
    tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
  });

  testBtn.addEventListener('click', () =>
    withLoading(testBtn, () => verify().catch((err) => setStatus(err.message, 'error'))),
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    withLoading(saveBtn, async () => {
      try {
        app.connect(await verify());
        app.show(app.session ? 'remote' : 'sessions');
      } catch (err) {
        setStatus(err.message, 'error');
      }
    });
  });

  logoutBtn.addEventListener('click', () => {
    if (confirm('Server-URL, Token und Zielgerät wirklich löschen?')) app.logout();
  });

  return {
    onShow() {
      urlInput.value = app.config.serverUrl ?? '';
      tokenInput.value = app.config.token ?? '';
      tokenInput.type = 'password';
      statusBox.hidden = true;
      logoutBtn.hidden = !app.config.token;
    },
  };
}
