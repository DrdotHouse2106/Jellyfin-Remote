/**
 * Schlanker Client für die Jellyfin-REST-API.
 * Kapselt Authentifizierung, Fehlerbehandlung und alle benötigten Endpunkte.
 */

const CLIENT_NAME = 'Jellyfin Remote';
const CLIENT_VERSION = '1.0.0';

/** Jellyfin rechnet Zeiten in "Ticks" (100 ns). */
export const TICKS_PER_SECOND = 10_000_000;

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Bereinigt eine eingegebene Server-URL:
 * ergänzt fehlendes Protokoll und entfernt abschließende Schrägstriche.
 */
export function normalizeServerUrl(input) {
  let url = String(input ?? '').trim();
  if (!url) throw new ApiError('Bitte eine Server-URL eingeben.');
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError('Die Server-URL ist ungültig.');
  }
  return (parsed.origin + parsed.pathname).replace(/\/+$/, '');
}

/** Ermittelt einen lesbaren Gerätenamen für das Jellyfin-Dashboard. */
function detectDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  return 'Browser';
}

/** Läuft die App als native iOS-/Android-App (Capacitor)? */
export const isNativeApp = Boolean(window.Capacitor?.isNativePlatform?.());

function statusMessage(status) {
  switch (status) {
    case 401: return 'Zugriff verweigert – das API-Token ist ungültig.';
    case 403: return 'Keine Berechtigung für diese Aktion.';
    case 404: return 'Nicht gefunden – ist das Gerät noch verbunden?';
    default:  return `Serverfehler (HTTP ${status}).`;
  }
}

function networkMessage(serverUrl) {
  if (location.protocol === 'https:' && serverUrl.startsWith('http:')) {
    return 'Die App läuft über HTTPS, der Server aber über HTTP. Browser blockieren solche Anfragen (Mixed Content).';
  }
  return 'Server nicht erreichbar. URL, Netzwerk und CORS-Einstellungen prüfen.';
}

export class JellyfinApi {
  /**
   * @param {object} options
   * @param {string} options.serverUrl
   * @param {string} [options.token]  Ohne Token sind nur öffentliche Endpunkte und die Anmeldung möglich.
   * @param {string} options.deviceId
   * @param {Function} [options.onUnauthorized]  Wird bei HTTP 401 aufgerufen (Token widerrufen/abgelaufen).
   */
  constructor({ serverUrl, token, deviceId, onUnauthorized }) {
    this.serverUrl = serverUrl;
    this.token = token;
    this.onUnauthorized = onUnauthorized;
    this.authHeader =
      `MediaBrowser Client="${CLIENT_NAME}", Device="${detectDeviceName()}", ` +
      `DeviceId="${deviceId}", Version="${CLIENT_VERSION}"` +
      (token ? `, Token="${token}"` : '');
  }

  /** Zentrale Request-Funktion. Gibt JSON, Text oder null (204) zurück. */
  async request(path, { method = 'GET', query, body, signal } = {}) {
    const url = new URL(this.serverUrl + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    }

    const headers = { Authorization: this.authHeader, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
        cache: 'no-store',
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new ApiError(networkMessage(this.serverUrl));
    }

    if (!response.ok) {
      if (response.status === 401) this.onUnauthorized?.();
      throw new ApiError(statusMessage(response.status), response.status);
    }
    if (response.status === 204) return null;

    const type = response.headers.get('content-type') ?? '';
    return type.includes('json') ? response.json() : response.text();
  }

  // ---------- System & Anmeldung ----------

  /** Öffentliche Serverinformationen – funktioniert ohne Anmeldung. */
  getPublicSystemInfo({ signal } = {}) {
    return this.request('/System/Info/Public', { signal });
  }

  /** Serverinformationen – dient als Verbindungstest (benötigt gültiges Token). */
  getSystemInfo() {
    return this.request('/System/Info');
  }

  /** Informationen des Jellyfin-Remote-Plugins (404, wenn es nicht installiert ist). */
  getPluginInfo({ signal } = {}) {
    return this.request('/JellyfinRemote/Info', { signal });
  }

  /** Anmeldung mit Benutzername und Passwort. Liefert u. a. AccessToken und User. */
  authenticateByName(username, password) {
    return this.request('/Users/AuthenticateByName', {
      method: 'POST',
      body: { Username: username, Pw: password },
    });
  }

  /**
   * Prüft, ob eine WebSocket-Verbindung zum Server möglich ist. Jellyfin braucht sie,
   * um Geräte fernzusteuern – manche Reverse-Proxys blockieren sie.
   * @returns {Promise<boolean>}
   */
  testWebSocket(deviceId, timeout = 6000) {
    return new Promise((resolve) => {
      let socket;
      const done = (ok) => {
        clearTimeout(timer);
        try {
          socket?.close();
        } catch {
          // ignorieren
        }
        resolve(ok);
      };
      const timer = setTimeout(() => done(false), timeout);
      try {
        const url = new URL(`${this.serverUrl}/socket`);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.searchParams.set('ApiKey', this.token);
        url.searchParams.set('deviceId', deviceId);
        socket = new WebSocket(url);
        socket.onopen = () => done(true);
        socket.onerror = () => done(false);
        socket.onclose = () => done(false);
      } catch {
        done(false);
      }
    });
  }

  // ---------- Quick Connect ----------

  /** Ist Quick Connect auf dem Server aktiviert? */
  async isQuickConnectEnabled() {
    return (await this.request('/QuickConnect/Enabled')) === true;
  }

  /** Startet eine Quick-Connect-Anfrage. Liefert u. a. Code (zum Eingeben) und Secret. */
  initiateQuickConnect() {
    return this.request('/QuickConnect/Initiate', { method: 'POST' });
  }

  /** Status einer Quick-Connect-Anfrage (Authenticated = true, sobald bestätigt). */
  getQuickConnectState(secret, { signal } = {}) {
    return this.request('/QuickConnect/Connect', { query: { secret }, signal });
  }

  /** Anmeldung mit einer bestätigten Quick-Connect-Anfrage. */
  authenticateWithQuickConnect(secret) {
    return this.request('/Users/AuthenticateWithQuickConnect', { method: 'POST', body: { Secret: secret } });
  }

  /** Meldet das aktuelle Token am Server ab (widerruft es). */
  logout() {
    return this.request('/Sessions/Logout', { method: 'POST' });
  }

  // ---------- Sitzungen ----------

  /** Alle aktiven Sitzungen (nur die der letzten 15 Minuten). */
  getSessions() {
    return this.request('/Sessions', { query: { ActiveWithinSeconds: 900 } });
  }

  // ---------- Mediathek ----------

  /** Live-Suche nach Filmen und Episoden. */
  searchItems(term, { userId, signal, limit = 40 } = {}) {
    return this.request('/Items', {
      signal,
      query: {
        SearchTerm: term,
        IncludeItemTypes: 'Movie,Episode',
        Recursive: true,
        Limit: limit,
        Fields: 'PrimaryImageAspectRatio',
        EnableImageTypes: 'Primary',
        ImageTypeLimit: 1,
        userId,
      },
    });
  }

  /**
   * URL des Cover-Bildes. Bei Episoden wird bevorzugt das Serien-Poster genutzt,
   * damit alle Ergebnisse im einheitlichen Hochformat erscheinen.
   */
  imageUrl(item, height = 360) {
    let id = item.Id;
    let tag = item.ImageTags?.Primary;

    if (item.Type === 'Episode' && item.SeriesId && item.SeriesPrimaryImageTag) {
      id = item.SeriesId;
      tag = item.SeriesPrimaryImageTag;
    }
    if (!tag) return null;

    const params = new URLSearchParams({ fillHeight: height, quality: 85, tag });
    return `${this.serverUrl}/Items/${id}/Images/Primary?${params}`;
  }

  // ---------- Fernsteuerung ----------

  /** Startet ein Element sofort auf dem Zielgerät (PlayCommand=PlayNow). */
  play(sessionId, itemId) {
    return this.request(`/Sessions/${sessionId}/Playing`, {
      method: 'POST',
      query: { playCommand: 'PlayNow', itemIds: itemId },
    });
  }

  /** Wiedergabesteuerung: PlayPause, Pause, Unpause, Stop, Seek, … */
  playstate(sessionId, command, query) {
    return this.request(`/Sessions/${sessionId}/Playing/${command}`, { method: 'POST', query });
  }

  /** Allgemeiner Befehl ohne Argumente: MoveUp, MoveDown, Select, Back, GoHome, ToggleMute, … */
  sendGeneralCommand(sessionId, command) {
    return this.request(`/Sessions/${sessionId}/Command/${command}`, { method: 'POST' });
  }

  /** Setzt die Lautstärke (0–100) auf dem Zielgerät. */
  setVolume(sessionId, volume) {
    return this.request(`/Sessions/${sessionId}/Command`, {
      method: 'POST',
      body: { Name: 'SetVolume', Arguments: { Volume: String(Math.round(volume)) } },
    });
  }
}
