export const SEEK_STEP = 5;
const CLOSE_SLACK_MS = 60;

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const s = total % 60, m = Math.floor(total / 60) % 60, h = Math.floor(total / 3600);
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function spokenTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0 seconds';
  const total = Math.floor(seconds);
  const parts = [[Math.floor(total / 3600), 'hour'], [Math.floor(total / 60) % 60, 'minute'], [total % 60, 'second']]
    .filter(([n]) => n).map(([n, u]) => `${n} ${u}${n === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' ') : '0 seconds';
}

export function parseCssTime(value) {
  let longest = 0;
  for (const part of String(value ?? '').split(',')) {
    const match = /^\s*(-?[\d.]+)(ms|s)\s*$/.exec(part);
    if (!match) continue;
    const ms = Number(match[1]) * (match[2] === 's' ? 1000 : 1);
    if (ms > longest) longest = ms;
  }
  return longest;
}

export function transitionTotalMs(style) {
  const durations = String(style.transitionDuration ?? '').split(',');
  const delays = String(style.transitionDelay ?? '').split(',');
  let total = 0;
  durations.forEach((d, i) => {
    total = Math.max(total, parseCssTime(d) + parseCssTime(delays[i % delays.length]));
  });
  return total;
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function seekTarget(current, delta, duration) {
  const max = Number.isFinite(duration) ? duration : Infinity;
  return clamp((Number.isFinite(current) ? current : 0) + delta, 0, max);
}

export function progressPercent(current, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return clamp(current / duration, 0, 1) * 100;
}

export function isPlainPrimaryClick(event) {
  return (event.button ?? 0) === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

// A click whose target is the <dialog> itself may be on its padding (inside the
// panel) or on the backdrop. Only points outside the box are backdrop clicks.
export function isOutsideRect(point, rect) {
  if (!point.clientX && !point.clientY) return false;
  return point.clientX < rect.left || point.clientX > rect.right || point.clientY < rect.top || point.clientY > rect.bottom;
}

export function shouldPlayError(error) {
  return !!error && error.name !== 'AbortError' && error.name !== 'NotAllowedError';
}

function el(tag, className, attrs = {}, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function setupFilmPlayer({dialog, films, canOpen = () => true, onOpenChange = () => {}}) {
  const video = dialog.querySelector('#full-film');
  if (!video) throw new Error('Film player requires #full-film inside the dialog.');
  const title = dialog.querySelector('#film-dialog-title');
  const client = dialog.querySelector('#film-dialog-client');
  const direct = dialog.querySelector('#film-direct-link');
  const status = dialog.querySelector('.playback-status');
  const closeButton = dialog.querySelector('.film-close');
  const filmList = [...films];
  const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : {matches: false};

  const cleanups = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };

  let state = 'closed';          // closed | open | closing
  let session = 0;               // bumps on every open/close to drop stale async work
  let trigger = null;
  let closeTimer = 0;
  let scrubbing = false;
  let disposed = false;
  const originalControls = video.controls;
  const originalPreload = video.getAttribute('preload');

  const stage = el('div', 'film-player');
  const message = el('p', 'film-player-message', {role: 'status', 'aria-live': 'polite'});
  message.hidden = true;
  const bar = el('div', 'film-player-controls', {role: 'group', 'aria-label': 'Film controls'});
  const play = el('button', 'fp-button fp-play', {type: 'button', 'aria-label': 'Play film'}, 'Play');
  const time = el('p', 'fp-time');
  const elapsed = el('span', 'fp-elapsed', {}, '0:00');
  const total = el('span', 'fp-duration', {}, '0:00');
  time.append(elapsed, el('span', 'fp-sep', {'aria-hidden': 'true'}, ' / '), total);
  const scrub = el('input', 'fp-range fp-scrub', {type: 'range', min: '0', max: '0', step: '0.1', value: '0', 'aria-label': 'Seek'});
  scrub.disabled = true;
  const mute = el('button', 'fp-button fp-mute', {type: 'button', 'aria-label': 'Mute'}, 'Mute');
  const volume = el('input', 'fp-range fp-volume', {type: 'range', min: '0', max: '1', step: '0.05', value: '1', 'aria-label': 'Volume'});
  const fullscreen = el('button', 'fp-button fp-fullscreen', {type: 'button', 'aria-label': 'Enter full screen'}, 'Full screen');
  const fullscreenRoot = stage.requestFullscreen ? stage : null;
  const canFullscreen = !!(document.fullscreenEnabled && fullscreenRoot) || typeof video.webkitEnterFullscreen === 'function';
  fullscreen.hidden = !canFullscreen;
  bar.append(play, time, scrub, mute, volume, fullscreen);

  try {
    video.before(stage);
    stage.append(video, bar, message);
    video.controls = false;
    video.tabIndex = -1;
    video.preload = 'auto';
    dialog.classList.add('film-player-dialog');
  } catch (error) {
    // Leave the original native controls untouched if enhancement fails.
    stage.replaceWith(video);
    video.controls = originalControls;
    if (originalPreload !== null) video.setAttribute('preload', originalPreload);
    throw error;
  }

  const say = text => { message.textContent = text; message.hidden = !text; };

  function syncPlay() {
    const playing = !video.paused && !video.ended;
    play.textContent = playing ? 'Pause' : (video.ended ? 'Replay' : 'Play');
    play.setAttribute('aria-label', playing ? 'Pause film' : (video.ended ? 'Replay film' : 'Play film'));
    stage.classList.toggle('is-playing', playing);
  }
  function syncTime() {
    const duration = video.duration;
    const known = Number.isFinite(duration) && duration > 0;
    scrub.disabled = !known;
    if (known) scrub.max = String(duration);
    if (!scrubbing) scrub.value = String(known ? video.currentTime : 0);
    const now = scrubbing ? Number(scrub.value) : video.currentTime;
    elapsed.textContent = formatTime(now);
    total.textContent = known ? formatTime(duration) : '--:--';
    scrub.style.setProperty('--fp-progress', `${progressPercent(now, duration)}%`);
    scrub.setAttribute('aria-valuetext', known ? `${spokenTime(now)} of ${spokenTime(duration)}` : 'Duration unknown');
  }
  function syncVolume() {
    const silent = video.muted || video.volume === 0;
    mute.textContent = silent ? 'Unmute' : 'Mute';
    mute.setAttribute('aria-label', silent ? 'Unmute' : 'Mute');
    volume.value = String(video.muted ? 0 : video.volume);
    volume.style.setProperty('--fp-progress', `${(video.muted ? 0 : video.volume) * 100}%`);
    volume.setAttribute('aria-valuetext', `${Math.round((video.muted ? 0 : video.volume) * 100)} percent`);
  }
  function currentFullscreen() {
    return document.fullscreenElement === stage || !!video.webkitDisplayingFullscreen;
  }
  function syncFullscreen() {
    const on = currentFullscreen();
    fullscreen.textContent = on ? 'Exit full screen' : 'Full screen';
    fullscreen.setAttribute('aria-label', on ? 'Exit full screen' : 'Enter full screen');
    stage.classList.toggle('is-fullscreen', on);
  }
  function resetUi() {
    scrubbing = false;
    say('');
    syncPlay(); syncTime(); syncVolume(); syncFullscreen();
  }

  function startPlayback(mine) {
    const attempt = video.play();
    if (!attempt || typeof attempt.catch !== 'function') return;
    attempt.catch(error => {
      if (mine !== session || state === 'closed') return;
      if (shouldPlayError(error) && status) status.hidden = false;
      syncPlay();
    });
  }
  function toggle() {
    if (state !== 'open') return;
    if (video.paused || video.ended) {
      if (video.ended) video.currentTime = 0;
      startPlayback(session);
    } else video.pause();
  }
  function seekBy(delta) {
    if (!Number.isFinite(video.duration)) return;
    video.currentTime = seekTarget(video.currentTime, delta, video.duration);
    syncTime();
  }

  listen(play, 'click', toggle);
  listen(video, 'click', toggle);
  listen(video, 'play', syncPlay);
  listen(video, 'playing', syncPlay);
  listen(video, 'pause', syncPlay);
  listen(video, 'ended', syncPlay);
  listen(video, 'timeupdate', syncTime);
  listen(video, 'durationchange', syncTime);
  listen(video, 'loadedmetadata', syncTime);
  listen(video, 'seeked', syncTime);
  listen(video, 'volumechange', syncVolume);
  listen(video, 'error', () => {
    if (state !== 'closed' && video.hasAttribute('src') && status) status.hidden = false;
  });
  listen(scrub, 'input', () => {
    scrubbing = true;
    video.currentTime = Number(scrub.value);
    syncTime();
  });
  listen(scrub, 'change', () => { scrubbing = false; syncTime(); });
  listen(scrub, 'blur', () => { scrubbing = false; syncTime(); });
  listen(mute, 'click', () => {
    if (video.muted || video.volume === 0) { video.muted = false; if (video.volume === 0) video.volume = 0.5; }
    else video.muted = true;
  });
  listen(volume, 'input', () => {
    video.volume = Number(volume.value);
    video.muted = video.volume === 0;
  });
  listen(fullscreen, 'click', async () => {
    try {
      if (currentFullscreen()) {
        if (document.fullscreenElement) await document.exitFullscreen();
        else video.webkitExitFullscreen?.();
      } else if (document.fullscreenEnabled && fullscreenRoot) await stage.requestFullscreen();
      else if (typeof video.webkitEnterFullscreen === 'function') video.webkitEnterFullscreen();
      else throw new Error('unsupported');
      say('');
    } catch {
      say('Full screen could not start. Use the browser’s own full screen control instead.');
    }
    syncFullscreen();
  });
  listen(document, 'fullscreenchange', syncFullscreen);
  listen(video, 'webkitendfullscreen', syncFullscreen);
  listen(stage, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const onField = event.target.closest?.('input, button');
    if (event.target === video && (event.key === ' ' || event.key.toLowerCase() === 'k')) { event.preventDefault(); toggle(); }
    else if (!onField && event.key === 'ArrowLeft') { event.preventDefault(); seekBy(-SEEK_STEP); }
    else if (!onField && event.key === 'ArrowRight') { event.preventDefault(); seekBy(SEEK_STEP); }
    else if (!onField && event.key.toLowerCase() === 'm') { event.preventDefault(); mute.click(); }
    else if (!onField && event.key.toLowerCase() === 'f' && !fullscreen.hidden) { event.preventDefault(); fullscreen.click(); }
  });

  function posterFor(film) {
    const img = film?.querySelector?.('.film-poster, img');
    return film?.dataset?.poster || img?.currentSrc || img?.src || '';
  }
  function releaseVideo() {
    video.pause();
    video.removeAttribute('src');
    video.removeAttribute('poster');
    video.load();
  }
  function clearCloseTimer() {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = 0;
  }

  function open(link) {
    const film = link.closest('.film') ?? filmList.find(f => f.contains(link));
    const wasClosed = state === 'closed';
    clearCloseTimer();
    session++;
    const mine = session;
    trigger = link;
    dialog.classList.remove('is-closing');
    resetUi();
    if (title) title.textContent = film?.querySelector('h2')?.textContent ?? '';
    if (client) client.textContent = film?.querySelector('.film-client')?.textContent ?? '';
    if (direct) direct.href = link.href;
    if (status) status.hidden = true;
    // The real poster is the cover until the first frame is decoded: no black flash.
    const poster = posterFor(film);
    if (poster) video.poster = poster; else video.removeAttribute('poster');
    video.src = link.href;
    state = 'open';
    if (!dialog.open) dialog.showModal();
    void dialog.offsetWidth;           // commit the closed styles so the open transition runs
    dialog.classList.add('is-open');
    if (wasClosed) onOpenChange(true);
    startPlayback(mine);
  }

  function requestClose() {
    if (state !== 'open') return;
    state = 'closing';
    const mine = ++session;
    video.pause();
    dialog.classList.remove('is-open');
    dialog.classList.add('is-closing');
    const wait = reduced.matches ? 0 : transitionTotalMs(getComputedStyle(dialog));
    if (wait <= 0) { finishClose(mine); return; }
    clearCloseTimer();
    closeTimer = setTimeout(() => finishClose(mine), wait + CLOSE_SLACK_MS);
  }
  function finishClose(mine) {
    if (mine !== session || state !== 'closing') return;
    clearCloseTimer();
    if (dialog.open) dialog.close();
    onClosed();                        // synchronous so a queued 'close' event cannot hit a reopened dialog
  }
  function onClosed() {
    if (state === 'closed') return;
    clearCloseTimer();
    session++;
    state = 'closed';
    if (document.fullscreenElement === stage) document.exitFullscreen?.().catch(() => {});
    dialog.classList.remove('is-open', 'is-closing');
    releaseVideo();
    resetUi();
    const back = trigger;
    trigger = null;
    if (back?.isConnected) back.focus({preventScroll: true});
    onOpenChange(false);
  }

  filmList.forEach(film => {
    const link = film.querySelector('.film-open');
    if (!link) return;
    listen(link, 'click', event => {
      if (!isPlainPrimaryClick(event)) return;   // new tab, download, etc. keep default behaviour
      event.preventDefault();
      if (disposed || canOpen(link) === false) return;
      open(link);
    });
  });
  if (closeButton) listen(closeButton, 'click', requestClose);
  listen(dialog, 'click', event => {
    if (event.target === dialog && isOutsideRect(event, dialog.getBoundingClientRect())) requestClose();
  });
  listen(dialog, 'cancel', event => { event.preventDefault(); requestClose(); });
  listen(dialog, 'close', () => { if (!dialog.open) onClosed(); });
  listen(document, 'visibilitychange', () => { if (document.hidden) video.pause(); });
  listen(window, 'pagehide', () => video.pause());

  resetUi();

  return {
    pause() { video.pause(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      const wasOpen = state !== 'closed';
      clearCloseTimer();
      cleanups.splice(0).forEach(fn => fn());
      session++;
      state = 'closed';
      if (document.fullscreenElement === stage) document.exitFullscreen?.().catch(() => {});
      if (dialog.open) dialog.close();
      dialog.classList.remove('film-player-dialog', 'is-open', 'is-closing');
      releaseVideo();
      stage.replaceWith(video);
      video.controls = originalControls;
      video.removeAttribute('tabindex');
      if (originalPreload === null) video.removeAttribute('preload'); else video.setAttribute('preload', originalPreload);
      if (status) status.hidden = true;
      if (wasOpen) onOpenChange(false);
    },
  };
}
