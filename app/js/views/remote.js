/**
 * Fernbedienung: Steuerkreuz, Wiedergabetasten, Lautstärke und
 * eine regelmäßig aktualisierte „Läuft gerade“-Anzeige.
 */

import { ApiError, TICKS_PER_SECOND } from '../api.js';
import { $, formatTicks, itemSubtitle, throttle, showError } from '../ui.js';

const POLL_INTERVAL = 2000;

export function initRemoteView(app) {
  const view = $('#view-remote');
  const slider = $('#volume');
  const volumeValue = $('#volume-value');

  const np = {
    art: $('#np-art'),
    title: $('#np-title'),
    sub: $('#np-sub'),
    progress: $('#np-progress'),
    pos: $('#np-pos'),
    dur: $('#np-dur'),
  };

  let pollTimer = null;
  let volumeLockedUntil = 0; // verhindert, dass das Polling den Regler beim Ziehen zurücksetzt

  /** Führt eine Aktion für das Zielgerät aus und zeigt Fehler an. */
  const run = (action) => app.withTarget(action).catch(showError);

  // ---------- Tasten (ein Listener für alle Buttons) ----------

  view.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const { cmd, play, seek } = button.dataset;

    if (cmd) {
      run((id) => app.api.sendGeneralCommand(id, cmd));
    } else if (play) {
      if (play === 'PlayPause') setPaused(!$('#ico-pause').hidden);
      run((id) => app.api.playstate(id, play)).then(() => setTimeout(refresh, 500));
    } else if (seek) {
      run(() => seekBy(Number(seek)));
    }
  });

  /** Zeitpunkt der letzten Aktualisierung von app.session (für die Positionsschätzung). */
  let sessionUpdatedAt = 0;

  /**
   * Springt relativ zur aktuellen Position vor bzw. zurück. Die Position stammt aus der laufenden
   * Aktualisierung (höchstens 2 s alt, um die vergangene Zeit ergänzt) – so genügt eine einzige Anfrage.
   */
  async function seekBy(seconds) {
    let session = app.session;
    if (!session?.PlayState || Date.now() - sessionUpdatedAt > 5000) {
      session = await app.resolveSession();
      sessionUpdatedAt = Date.now();
    }
    const item = session?.NowPlayingItem;
    if (!item) throw new ApiError('Auf dem Gerät läuft gerade nichts.');

    const elapsed = session.PlayState?.IsPaused ? 0 : (Date.now() - sessionUpdatedAt) * 10_000;
    const position = (session.PlayState?.PositionTicks ?? 0) + elapsed;
    const duration = item.RunTimeTicks ?? Infinity;
    const target = Math.min(Math.max(0, position + seconds * TICKS_PER_SECOND), duration - TICKS_PER_SECOND);

    const ticks = Math.round(Math.max(0, target));
    await app.api.playstate(session.Id, 'Seek', { seekPositionTicks: ticks });
    // Sofort anzeigen und als Ausgangspunkt für weitere Sprünge merken.
    app.session = { ...session, PlayState: { ...session.PlayState, PositionTicks: ticks } };
    sessionUpdatedAt = Date.now();
    render(app.session);
  }

  // ---------- Lautstärke ----------

  const sendVolume = throttle((value) => run((id) => app.api.setVolume(id, value)), 200);

  function paintSlider() {
    slider.style.setProperty('--val', `${slider.value}%`);
    volumeValue.textContent = slider.value;
  }

  slider.addEventListener('input', () => {
    volumeLockedUntil = Date.now() + 2500;
    paintSlider();
    sendVolume(slider.valueAsNumber);
  });

  // ---------- Anzeige ----------

  function setPaused(paused) {
    $('#ico-play').hidden = !paused;
    $('#ico-pause').hidden = paused;
  }

  function render(session) {
    const item = session?.NowPlayingItem;
    const state = session?.PlayState ?? {};

    if (item) {
      np.title.textContent = item.Name;
      np.sub.textContent = itemSubtitle(item) || session.DeviceName;
      const url = app.api.imageUrl(item, 168);
      np.art.style.backgroundImage = url ? `url("${url}")` : '';

      const position = state.PositionTicks ?? 0;
      const duration = item.RunTimeTicks ?? 0;
      np.progress.style.width = duration ? `${Math.min(100, (position / duration) * 100)}%` : '0%';
      np.pos.textContent = formatTicks(position);
      np.dur.textContent = formatTicks(duration);
    } else {
      np.title.textContent = session ? 'Keine Wiedergabe' : 'Gerät nicht erreichbar';
      np.sub.textContent = session
        ? `${session.DeviceName} ist bereit – wähle etwas über die Suche.`
        : 'Ist Jellyfin auf dem Gerät geöffnet?';
      np.art.style.backgroundImage = '';
      np.progress.style.width = '0%';
      np.pos.textContent = np.dur.textContent = '0:00';
    }

    setPaused(!item || Boolean(state.IsPaused));
    $('#ico-vol').hidden = Boolean(state.IsMuted);
    $('#ico-muted').hidden = !state.IsMuted;

    if (state.VolumeLevel != null && Date.now() > volumeLockedUntil) {
      slider.value = state.VolumeLevel;
      paintSlider();
    }
  }

  async function refresh() {
    if (!app.session || document.visibilityState !== 'visible') return;
    try {
      render(await app.resolveSession());
      sessionUpdatedAt = Date.now();
    } catch {
      // Netzwerkfehler beim Polling still ignorieren – der nächste Versuch folgt gleich.
    }
  }

  function startPolling() {
    stopPolling();
    refresh();
    pollTimer = setInterval(refresh, POLL_INTERVAL);
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (pollTimer && document.visibilityState === 'visible') refresh();
  });

  paintSlider();

  return { onShow: startPolling, onHide: stopPolling };
}
