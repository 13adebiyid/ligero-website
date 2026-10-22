import {transitionTotalMs} from '../creative-direction/player.mjs';

const CLOSE_SLACK_MS = 60;

export const wrapIndex = (index, delta, count) => count > 0 ? (((index + delta) % count) + count) % count : 0;
export const pad = value => String(value).padStart(2, '0');
export const frameLabel = (index, count) => `${pad(index + 1)} / ${pad(count)}`;

// A contact sheet is plain markup (also the no-JavaScript fallback):
// <section class="bts-sheet"><ol><li><a href="FULL"><img src="THUMB"></a></li>…
export function readFrames(sheet) {
  return [...sheet.querySelectorAll('li > a')].map(link => {
    const img = link.querySelector('img');
    return {
      href: link.getAttribute('href'),
      thumb: img?.getAttribute('src') ?? '',
      alt: img?.getAttribute('alt') ?? '',
      width: Number(img?.getAttribute('width')) || 16,
      height: Number(img?.getAttribute('height')) || 9,
      caption: link.dataset.caption ?? '',
    };
  });
}

function el(tag, className, attrs = {}, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

// Shared open/close lifecycle for an animated modal <dialog>: closed -> open -> closing.
function animatedDialog(dialog, {onOpen = () => {}, onClosed = () => {}} = {}) {
  const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : {matches: false};
  let state = 'closed', session = 0, timer = 0;
  const clear = () => { if (timer) clearTimeout(timer); timer = 0; };
  function finish(mine) {
    if (mine !== session || state !== 'closing') return;
    clear();
    if (dialog.open) dialog.close();
    settle();
  }
  function settle() {
    if (state === 'closed') return;
    clear();
    session++;
    state = 'closed';
    dialog.classList.remove('is-open', 'is-closing');
    onClosed();
  }
  dialog.addEventListener('close', () => { if (!dialog.open) settle(); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); api.close(); });
  const api = {
    get isOpen() { return state === 'open'; },
    open() {
      clear();
      session++;
      dialog.classList.remove('is-closing');
      state = 'open';
      if (!dialog.open) dialog.showModal();
      void dialog.offsetWidth;
      dialog.classList.add('is-open');
      onOpen();
    },
    close() {
      if (state !== 'open') return;
      state = 'closing';
      const mine = ++session;
      dialog.classList.remove('is-open');
      dialog.classList.add('is-closing');
      const wait = reduced.matches ? 0 : transitionTotalMs(getComputedStyle(dialog));
      if (wait <= 0) { finish(mine); return; }
      timer = setTimeout(() => finish(mine), wait + CLOSE_SLACK_MS);
    },
    dispose() { clear(); session++; state = 'closed'; if (dialog.open) dialog.close(); dialog.classList.remove('is-open', 'is-closing'); },
  };
  return api;
}

export function setupBehindTheSet({root = document.documentElement, drawer, stillDialog, sheets, buttons}) {
  const drawerBody = drawer.querySelector('.bts-body');
  const drawerTitle = drawer.querySelector('.bts-title');
  const drawerMeta = drawer.querySelector('.bts-meta');
  const still = {
    figure: stillDialog.querySelector('.still-figure'),
    img: stillDialog.querySelector('.still-image'),
    caption: stillDialog.querySelector('.still-caption'),
    count: stillDialog.querySelector('.still-count'),
    original: stillDialog.querySelector('.still-original'),
    status: stillDialog.querySelector('.still-status'),
    prev: stillDialog.querySelector('.still-prev'),
    next: stillDialog.querySelector('.still-next'),
    close: stillDialog.querySelector('.still-close'),
  };
  let frames = [], current = 0, stillSession = 0, trigger = null, stillTrigger = null, title = '';
  const cleanups = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };

  const drawerDialog = animatedDialog(drawer, {
    onClosed() {
      drawerBody.replaceChildren();
      const back = trigger; trigger = null;
      if (back?.isConnected) back.focus({preventScroll: true});
    },
  });
  const stills = animatedDialog(stillDialog, {
    onClosed() {
      stillSession++;
      still.img.removeAttribute('src');     // release the decoded original
      stillDialog.classList.remove('is-loading');
      const back = stillTrigger; stillTrigger = null;
      if (back?.isConnected) back.focus({preventScroll: true});
    },
  });

  function showFrame(index) {
    current = wrapIndex(index, 0, frames.length);
    const frame = frames[current];
    const mine = ++stillSession;
    still.count.textContent = frameLabel(current, frames.length);
    still.caption.textContent = [title, frame.caption].filter(Boolean).join(' — ');
    still.original.href = frame.href;
    still.img.alt = frame.alt;
    still.figure.style.setProperty('--still-ar', `${frame.width} / ${frame.height}`);
    // Show the bounded preview at once; swap to the full-resolution original once decoded.
    still.img.src = frame.thumb;
    stillDialog.classList.add('is-loading');
    still.status.textContent = 'Loading full resolution…';
    const full = new Image();
    full.decoding = 'async';
    const apply = ok => {
      if (mine !== stillSession) return;
      if (ok) still.img.src = frame.href;
      stillDialog.classList.remove('is-loading');
      still.status.textContent = ok ? '' : 'The full-resolution image could not load.';
    };
    full.onload = () => (full.decode ? full.decode().catch(() => {}) : Promise.resolve()).then(() => apply(true));
    full.onerror = () => apply(false);
    full.src = frame.href;
  }

  function openStill(index, from) {
    stillTrigger = from;
    showFrame(index);
    stills.open();
  }

  function openSheet(sheet, from) {
    frames = readFrames(sheet);
    if (!frames.length) return;
    title = sheet.dataset.title ?? '';
    trigger = from;
    drawerTitle.textContent = title;
    drawerMeta.textContent = sheet.dataset.meta ?? '';
    const list = el('ol', 'bts-grid');
    frames.forEach((frame, index) => {
      const item = el('li', 'bts-frame');
      const button = el('button', 'bts-open', {type: 'button', 'aria-label': `Open frame ${index + 1} of ${frames.length} in full resolution${frame.alt ? `: ${frame.alt}` : ''}`});
      button.style.setProperty('--ar', `${frame.width} / ${frame.height}`);
      const img = el('img', '', {src: frame.thumb, alt: '', width: String(frame.width), height: String(frame.height), loading: 'lazy', decoding: 'async'});
      button.append(img, el('span', 'bts-index', {'aria-hidden': 'true'}, pad(index + 1)));
      if (frame.caption) button.append(el('span', 'bts-label', {'aria-hidden': 'true'}, frame.caption));
      button.addEventListener('click', () => openStill(index, button));
      item.append(button);
      list.append(item);
    });
    drawerBody.replaceChildren(list);
    drawerBody.scrollTop = 0;
    drawerDialog.open();
  }

  buttons.forEach(button => {
    const sheet = sheets[button.dataset.bts];
    if (!sheet) return;
    listen(button, 'click', event => { event.preventDefault(); openSheet(sheet, button); });
  });
  listen(drawer.querySelector('.bts-close'), 'click', () => drawerDialog.close());
  listen(drawer, 'click', event => {
    if (event.target === drawer && !event.target.closest('.bts-panel')) drawerDialog.close();
  });
  listen(still.close, 'click', () => stills.close());
  listen(still.prev, 'click', () => showFrame(current - 1));
  listen(still.next, 'click', () => showFrame(current + 1));
  listen(stillDialog, 'click', event => { if (event.target === stillDialog) stills.close(); });
  listen(stillDialog, 'keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); showFrame(current - 1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); showFrame(current + 1); }
  });
  listen(window, 'pagehide', () => { stillSession++; });
  root.classList.add('bts-ready');

  return {
    get drawerOpen() { return drawerDialog.isOpen; },
    get stillOpen() { return stills.isOpen; },
    dispose() {
      cleanups.splice(0).forEach(fn => fn());
      stills.dispose(); drawerDialog.dispose();
      root.classList.remove('bts-ready');
    },
  };
}
