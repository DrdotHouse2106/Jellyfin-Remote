/**
 * Sitzungs-Auswahl: listet alle aktiven Jellyfin-Sitzungen und lässt den
 * Nutzer das Zielgerät (z. B. den Fernseher) auswählen.
 */

import { $, h, toast, showError } from '../ui.js';

const TV_ICON =
  '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
const PHONE_ICON =
  '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>';
const BROWSER_ICON =
  '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></svg>';

function iconFor(session) {
  const text = `${session.Client} ${session.DeviceName}`.toLowerCase();
  if (/android tv|\btv\b|kodi|roku|fire ?tv|shield|webos|tizen|tvos/.test(text)) return TV_ICON;
  if (/iphone|ipad|ios|android|mobile/.test(text)) return PHONE_ICON;
  return BROWSER_ICON;
}

export function initSessionsView(app) {
  const list = $('#session-list');
  const empty = $('#sessions-empty');
  const refreshBtn = $('#btn-refresh-sessions');
  const hint = $('#sessions-hint');

  /** Ergebnis des WebSocket-Tests (einmal pro Seitenaufruf). */
  let webSocketCheck = null;

  function showHint(text, type = 'info') {
    hint.textContent = text;
    hint.className = `status-box${type === 'error' ? ' is-error' : ''}`;
    hint.hidden = false;
  }

  /**
   * Ist kein Gerät steuerbar, die Ursache ermitteln: Jellyfin kann ein Gerät nur über eine
   * offene WebSocket-Verbindung steuern. Lässt der Reverse-Proxy keine WebSockets durch,
   * ist nie ein Gerät steuerbar – sonst ist Jellyfin auf den Geräten gerade nicht geöffnet.
   */
  async function explainNoControllable() {
    showHint('Kein Gerät ist gerade steuerbar – prüfe die Verbindung …');
    webSocketCheck ??= app.api.testWebSocket(app.deviceId);
    if (await webSocketCheck) {
      showHint(
        'Kein Gerät ist gerade steuerbar. Steuern lässt sich ein Gerät nur, solange Jellyfin dort geöffnet ist ' +
          '(z. B. Jellyfin-App auf dem Fernseher gestartet, Browser-Tab offen). Geschlossene Sitzungen bleiben ' +
          'noch bis zu 15 Minuten in der Liste.',
      );
    } else {
      webSocketCheck = null; // beim nächsten Aktualisieren erneut prüfen
      showHint(
        'Dein Server bzw. Reverse-Proxy lässt keine WebSocket-Verbindungen durch. Jellyfin braucht sie, um ' +
          'Geräte fernzusteuern. Lösung: im Reverse-Proxy WebSocket-Unterstützung aktivieren – z. B. bei ' +
          'Nginx Proxy Manager „Websockets Support“ einschalten, bei Nginx die Header „Upgrade“ und ' +
          '„Connection“ weiterreichen.',
        'error',
      );
    }
  }

  async function load() {
    refreshBtn.classList.add('is-spinning');
    try {
      render(await app.api.getSessions());
    } catch (err) {
      showError(err);
    } finally {
      refreshBtn.classList.remove('is-spinning');
    }
  }

  function render(sessions) {
    const items = sessions
      // Fernbedienungen selbst (diese und andere Instanzen) sind keine Zielgeräte.
      .filter((s) => s.DeviceId !== app.deviceId && s.Client !== 'Jellyfin Remote')
      .sort(
        (a, b) =>
          Number(b.SupportsRemoteControl) - Number(a.SupportsRemoteControl) ||
          new Date(b.LastActivityDate) - new Date(a.LastActivityDate),
      );

    empty.hidden = items.length > 0;
    list.replaceChildren(...items.map((s) => h('li', {}, sessionCard(s))));

    hint.hidden = true;
    if (items.length > 0 && !items.some((s) => s.SupportsRemoteControl)) explainNoControllable();
  }

  function sessionCard(session) {
    const controllable = session.SupportsRemoteControl;
    const selected = session.DeviceId === app.config.targetDeviceId;
    const playing = session.NowPlayingItem;

    return h(
      'button',
      {
        type: 'button',
        class: `session${selected ? ' is-selected' : ''}`,
        disabled: !controllable,
        onClick: () => {
          app.selectSession(session);
          toast(`Verbunden mit ${session.DeviceName}`);
          app.show('remote');
        },
      },
      h('span', { class: 'session__icon', html: iconFor(session) }),
      h(
        'span',
        { class: 'session__body' },
        h('span', { class: 'session__name', text: session.DeviceName }),
        h('span', { class: 'session__meta', text: [session.Client, session.UserName].filter(Boolean).join(' · ') }),
        playing && h('span', { class: 'session__playing', text: `▶\uFE0E ${playing.Name}` }),
      ),
      selected && h('span', { class: 'badge', text: 'Aktiv' }),
      !controllable && h('span', { class: 'badge', text: 'Nicht steuerbar' }),
    );
  }

  refreshBtn.addEventListener('click', load);

  return { onShow: load };
}
