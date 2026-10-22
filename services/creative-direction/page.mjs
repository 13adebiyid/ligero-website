import {setupFilmPlayer} from './player.mjs';
import { INTRO_DURATION, TRANSITION_DURATION, introStates, restingStates, transitionStates, metadataMotion, nextIndex, powerInOut } from './motion.mjs';

const root = document.documentElement;
const films = [...document.querySelectorAll('.film')];
const canvas = document.querySelector('#film-canvas');
const container = document.querySelector('#films');
const dialog = document.querySelector('#film-dialog');
const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#direction-menu');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Any open dialog (film player or a page-supplied overlay marked data-creative-overlay) owns input.
const overlayOpen = () => dialog.open || !!document.querySelector('dialog[open][data-creative-overlay]');
let renderer, frame = 0, active = 0, introStart = null, transition = null, hiddenAt = null;
let phase = 'loading';
const order = films.map((_, index) => index).slice(1);
for (let i = order.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [order[i], order[j]] = [order[j], order[i]];
}
order.splice(Math.max(0, films.length - 2), 0, 0);

function setPhase(value) {
  phase = value;
  root.dataset.phase = value;
}

function setMenu(open) {
  root.classList.toggle('menu-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  if (open) menu.querySelector('a').focus();
  resumePreview();
}

function resumePreview() {
  if (!renderer || phase === 'fallback') return;
  renderer.setActive(phase === 'ready' && !document.hidden && !overlayOpen() && !root.classList.contains('menu-open') ? active : -1);
  invalidate();
}

function revealFilm(index, leaving = -1) {
  films.forEach((film, i) => {
    film.classList.toggle('is-active', i === index);
    film.classList.toggle('is-leaving', i === leaving);
    film.inert = i !== index;
    film.setAttribute('aria-hidden', String(i !== index));
  });
}

function announceFilm() {
  document.querySelector('#film-announcement').textContent = `${active + 1} of ${films.length}. ${films[active].querySelector('h2').textContent}`;
}

function moveMetadata(film, offset) {
  for (const child of film.querySelector('.film-info').children) {
    child.style.transform = `translate3d(0,${offset(Number(child.dataset.order))}px,0)`;
  }
}

function invalidate() {
  if (!frame && !document.hidden && phase !== 'fallback') frame = requestAnimationFrame(draw);
}

function draw(now) {
  frame = 0;
  if (!renderer || phase === 'fallback' || phase === 'loading') return;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  let states;
  if (phase === 'intro') {
    introStart ??= now;
    const elapsed = now - introStart;
    states = introStates(elapsed, order, width, height);
    document.querySelector('.entry-mark').style.opacity = String(1 - powerInOut((elapsed - 1500) / 500));
    if (elapsed >= 3180 && !films[active].classList.contains('is-active')) revealFilm(active);
    if (elapsed >= 3180) moveMetadata(films[active], () => height * 1.5 * (1 - powerInOut((elapsed - 2700) / 1000)));
    if (elapsed >= 3580 && !root.classList.contains('header-ready')) root.classList.add('header-ready');
    if (elapsed >= INTRO_DURATION) {
      setPhase('ready');
      moveMetadata(films[active], () => 0);
      announceFilm();
      resumePreview();
    }
    invalidate();
  } else if (transition) {
    const elapsed = now - transition.start;
    const {from, to, direction} = transition;
    states = transitionStates(elapsed, from, to, direction, films.length, width, height);
    moveMetadata(films[from], childOrder => metadataMotion(elapsed, direction, childOrder, height, false));
    moveMetadata(films[to], childOrder => metadataMotion(elapsed, direction, childOrder, height, true));
    if (elapsed >= TRANSITION_DURATION) {
      transition = null;
      setPhase('ready');
      revealFilm(active);
      moveMetadata(films[active], () => 0);
      announceFilm();
      resumePreview();
    }
    invalidate();
  } else {
    states = restingStates(active, films.length, width, height);
  }
  renderer.render(states, now);
}

function step(direction) {
  if (phase !== 'ready' || overlayOpen() || root.classList.contains('menu-open')) return false;
  const from = active;
  active = nextIndex(active, direction, films.length);
  transition = {from, to: active, direction, start: performance.now()};
  setPhase('transition');
  revealFilm(active, from);
  moveMetadata(films[active], () => canvas.clientHeight * direction * 1.5);
  renderer.setActive(active);
  invalidate();
  return true;
}

function fallback(error) {
  if (error) console.warn('Creative Direction animation unavailable; showing the film list.', error);
  cancelAnimationFrame(frame);
  frame = 0;
  renderer?.dispose();
  renderer = null;
  transition = null;
  setPhase('fallback');
  root.classList.remove('cinema-pending', 'cinema', 'header-ready');
  films.forEach(film => {
    film.inert = false;
    film.removeAttribute('aria-hidden');
    film.classList.remove('is-active', 'is-leaving');
    moveMetadata(film, () => 0);
  });
}

const player = setupFilmPlayer({dialog, films, canOpen: () => phase === 'ready' || phase === 'fallback', onOpenChange: resumePreview});

menuButton.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
menu.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', event => {
  if (root.classList.contains('menu-open')) {
    if (event.key === 'Escape') { setMenu(false); menuButton.focus(); }
    if (event.key === 'Tab') {
      const controls = [menuButton, ...menu.querySelectorAll('a')];
      const index = controls.indexOf(document.activeElement);
      if (event.shiftKey && index === 0) { event.preventDefault(); controls.at(-1).focus(); }
      if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); menuButton.focus(); }
    }
    return;
  }
  if (overlayOpen() || event.ctrlKey || event.metaKey || event.altKey) return;
  const direction = ['ArrowDown', 'PageDown'].includes(event.key) ? 1 : ['ArrowUp', 'PageUp'].includes(event.key) ? -1 : 0;
  if (direction && step(direction)) event.preventDefault();
});
container.addEventListener('wheel', event => {
  if (phase === 'fallback' || event.ctrlKey) return;
  event.preventDefault();
  if (overlayOpen()) return;
  if (Math.abs(event.deltaY) > 10) step(Math.sign(event.deltaY));
}, {passive:false});
let touchStart = null, swiped = false;
container.addEventListener('touchstart', event => {
  const touch = event.touches.length === 1 ? event.touches[0] : null;
  touchStart = touch ? {x:touch.clientX, y:touch.clientY} : null;
  swiped = false;
}, {passive:true});
container.addEventListener('touchmove', event => {
  if (phase === 'fallback' || !touchStart || swiped || event.touches.length !== 1) return;
  const dx = touchStart.x - event.touches[0].clientX, dy = touchStart.y - event.touches[0].clientY;
  if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx)) return;
  event.preventDefault();
  swiped = step(Math.sign(dy));
}, {passive:false});
container.addEventListener('click', event => { if (swiped) { event.preventDefault(); event.stopPropagation(); swiped = false; } }, true);
window.addEventListener('resize', () => {
  if (innerWidth > 768 && root.classList.contains('menu-open')) setMenu(false);
  invalidate();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = performance.now();
    cancelAnimationFrame(frame); frame = 0;
  } else if (hiddenAt !== null) {
    const paused = performance.now() - hiddenAt;
    if (introStart !== null) introStart += paused;
    if (transition) transition.start += paused;
    hiddenAt = null;
  }
  resumePreview();
});
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  fallback(new Error('WebGL context lost'));
});
reducedMotion.addEventListener('change', event => { if (event.matches) fallback(); });
window.addEventListener('pagehide', event => {
  player.pause();
  cancelAnimationFrame(frame); frame = 0;
  if (event.persisted) renderer?.setActive(-1);
  else { renderer?.dispose(); player.dispose(); }
});
window.addEventListener('pageshow', event => { if (event.persisted) resumePreview(); });
root.classList.add('controls-ready');

async function start() {
  if (reducedMotion.matches) { fallback(); return; }
  try {
    const {VideoRenderer} = await import('./video-renderer.mjs');
    renderer = new VideoRenderer(canvas, films.map(film => ({poster:film.querySelector('img').src, preview:film.dataset.preview})), invalidate);
    await renderer.ready;
    await window.ligeroRouteReady;
    if (phase === 'fallback') return;
    root.classList.replace('cinema-pending', 'cinema');
    films.forEach(film => { film.inert = true; film.setAttribute('aria-hidden', 'true'); });
    setPhase('intro');
    invalidate();
  } catch (error) {
    fallback(error);
  }
}
start();
