/**
 * Menü: Bereiche und Bibliotheken direkt auf dem Fernseher öffnen – ohne sich mit dem
 * Steuerkreuz durchzuklicken. Mit der TV-App „Quallenkino“ zusätzlich die Apps des
 * Fernsehers (Netflix, YouTube, …) und seine Einstellungen (WLAN, Bluetooth, Bild, Ton).
 */

import { $, h, showError, toast } from '../ui.js';

/** Client-Name der TV-App „Quallenkino“ (Jellyfin-TV-Client). */
const QUALLENKINO_CLIENT = /^(quallenkino|heimkino tv)/i;
/** Präfix für Zusatzbefehle an Quallenkino (per SendString). */
const TV_PREFIX = 'tvclient:';

const ICONS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  guide: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
  record: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
  schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  library: '<path d="M4 19V5M9 19V5M14 19l3-14 4 1-3 14"/>',
  movies: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  tv: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  app: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><path d="M12 19.5h.01"/>',
  bluetooth: '<path d="m7 7 10 10-5 5V2l5 5L7 17"/>',
  display: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  sound: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
};

const DEVICE_SETTINGS = {
  wifi: ['WLAN', 'wifi'],
  bluetooth: ['Bluetooth', 'bluetooth'],
  display: ['Bild', 'display'],
  sound: ['Ton', 'sound'],
  all: ['Alle Einstellungen', 'settings'],
};

function icon(name) {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ICONS.app}</svg>`;
}

function libraryIcon(view) {
  switch (view.CollectionType) {
    case 'movies': return 'movies';
    case 'tvshows': return 'tv';
    case 'livetv': return 'tv';
    case 'music': return 'music';
    default: return 'library';
  }
}

/** Ein Knopf im Menü-Raster. */
function tile(label, iconName, onClick) {
  return h('button', { class: 'key menu-tile', type: 'button', onClick },
    h('span', { class: 'menu-tile__icon', html: icon(iconName) }),
    h('span', { class: 'menu-tile__label', text: label }));
}

export function initMenuView(app) {
  const areas = $('#menu-areas');
  const libraries = $('#menu-libraries');
  const apps = $('#menu-apps');
  const device = $('#menu-device');
  const tvHint = $('#menu-tv-hint');

  const run = (action, done) =>
    app.withTarget(action).then((ok) => ok && done && toast(done)).catch(showError);

  const general = (command, done) => () => run((id) => app.api.sendGeneralCommand(id, command), done);
  const tvCommand = (text, done) => () => run((id) => app.api.sendCommand(id, 'SendString', { String: TV_PREFIX + text }), done);

  function fill(container, nodes) {
    container.replaceChildren(...nodes);
    container.closest('.menu-section').hidden = nodes.length === 0;
  }

  function renderAreas(session, heimkino) {
    const supported = session?.Capabilities?.SupportedCommands;
    const can = (cmd) => !Array.isArray(supported) || supported.includes(cmd);
    const nodes = [];
    if (can('GoHome')) nodes.push(tile('Startseite', 'home', general('GoHome')));
    if (can('GoToSearch')) nodes.push(tile('Suche', 'search', general('GoToSearch')));
    if (heimkino) {
      nodes.push(tile('TV-Programm', 'guide', general('Guide')));
      nodes.push(tile('Aufnahmen', 'record', tvCommand('open:recordings')));
      nodes.push(tile('Zeitplan', 'schedule', tvCommand('open:schedule')));
    }
    if (can('GoToSettings')) nodes.push(tile('Einstellungen', 'settings', general('GoToSettings')));
    fill(areas, nodes);
  }

  async function renderLibraries(session) {
    // Bibliotheken des am Fernseher angemeldeten Benutzers. Gehört der einem anderen Konto,
    // verweigert Jellyfin Nicht-Admins den Zugriff (403) – dann die eigenen Bibliotheken zeigen.
    const ownUserId = app.config.userId;
    const tvUserId = session?.UserId ?? ownUserId;
    if (!tvUserId) return fill(libraries, []);
    let views;
    try {
      views = (await app.api.getUserViews(tvUserId)).Items ?? [];
    } catch (err) {
      if (err.status !== 403 || !ownUserId || ownUserId === tvUserId) throw err;
      views = (await app.api.getUserViews(ownUserId)).Items ?? [];
    }
    fill(
      libraries,
      views.map((view) =>
        tile(view.Name, libraryIcon(view), () =>
          run((id) => app.api.sendCommand(id, 'DisplayContent', { ItemId: view.Id, ItemType: view.Type, ItemName: view.Name })),
        ),
      ),
    );
  }

  async function renderTvExtras(session) {
    const prefs = await app.api.getTvClientDevice(session.DeviceId, session.UserId).catch(() => null);
    const custom = prefs?.CustomPrefs ?? {};

    let appList = [];
    try {
      appList = JSON.parse(custom.apps ?? '[]');
    } catch {
      appList = [];
    }
    fill(apps, appList.map((a) => tile(a.name, 'app', tvCommand(`app:${a.id}`, `${a.name} wird geöffnet`))));

    const keys = (custom.settings ?? 'wifi,bluetooth,display,sound,all').split(',').filter((k) => DEVICE_SETTINGS[k]);
    fill(device, keys.map((key) => {
      const [label, iconName] = DEVICE_SETTINGS[key];
      return tile(label, iconName, tvCommand(`settings:${key}`));
    }));

    tvHint.hidden = appList.length > 0;
    tvHint.textContent = 'Die Liste der Apps erscheint, sobald „Quallenkino“ einmal die Startseite angezeigt hat.';
  }

  async function load() {
    if (!app.session) return;
    let session = app.session;
    try {
      session = (await app.resolveSession()) ?? app.session;
    } catch {
      // mit der bekannten Sitzung weitermachen
    }

    const heimkino = QUALLENKINO_CLIENT.test(session?.Client ?? '');
    renderAreas(session, heimkino);

    if (heimkino) {
      renderTvExtras(session).catch(showError);
    } else {
      fill(apps, []);
      fill(device, []);
      tvHint.hidden = false;
      tvHint.textContent =
        'Apps (Netflix, YouTube, …) und Einstellungen des Fernsehers lassen sich mit der TV-App „Quallenkino“ öffnen.';
    }

    renderLibraries(session).catch(showError);
  }

  return { onShow: load };
}
