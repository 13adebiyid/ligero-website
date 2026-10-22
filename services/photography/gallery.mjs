import {INTRO_DURATION, INTRO_FADE_DURATION, IDLE_DELAY, DRIFT_SPEED, introColumn, neighbors, easeScroll} from './motion.mjs';

export async function startGallery() {
  const root = document.documentElement;
  const grid = document.querySelector('.photo-grid');
  const original = [...grid.children];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width:1280px) and (hover:hover) and (pointer:fine)');
  let animations = [], introGrid = null, ready = false;
  let frame = 0, idleTimer = 0, drifting = false, lastTime = 0, target = scrollY;
  let hovered = null;
  const columns = () => Number(getComputedStyle(root).getPropertyValue('--columns'));
  const canAnimate = () => ready && !reduced.matches && !document.hidden && !root.classList.contains('menu-open');
  function cloneCard(card) {
    const clone = card.cloneNode(true);
    clone.classList.remove('is-hovered', 'is-neighbor');
    const image = clone.querySelector('img');
    image.loading = 'lazy';
    image.removeAttribute('fetchpriority');
    return clone;
  }
  function appendBatch() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 30; i++) fragment.append(cloneCard(original[i % original.length]));
    grid.append(fragment);
  }
  function recycle() {
    if (!ready || reduced.matches) return;
    const cards = [...grid.children];
    if (cards.length <= 60 && document.documentElement.scrollHeight - (scrollY + innerHeight) < 1800) appendBatch();
    if (grid.children.length <= 60) return;
    const first = grid.children[0], next = grid.children[30];
    const distance = next.offsetTop - first.offsetTop;
    if (scrollY < distance + 300 || [...grid.children].slice(0,30).some(card => card.contains(document.activeElement))) return;
    const position = scrollY;
    for (let i = 0; i < 30; i++) grid.firstElementChild.remove();
    window.scrollTo(0, position - distance);
    target = Math.max(0, target - distance);
  }
  function clearHover() {
    hovered = null;
    for (const card of grid.children) card.classList.remove('is-hovered','is-neighbor');
  }
  function hover(card) {
    if (!desktop.matches || hovered === card) return;
    clearHover();
    if (!card) return;
    hovered = card;
    const cards = [...grid.children], index = cards.indexOf(card);
    card.classList.add('is-hovered');
    for (const other of neighbors(index, cards.length, columns())) cards[other].classList.add('is-neighbor');
  }
  grid.addEventListener('pointerover', event => hover(event.target.closest('.photo-card')));
  grid.addEventListener('pointerleave', clearHover);
  grid.addEventListener('focusin', event => hover(event.target.closest('.photo-card')));
  grid.addEventListener('focusout', clearHover);
  function invalidate() { if (!frame && canAnimate()) frame = requestAnimationFrame(tick); }
  function tick(time) {
    frame = 0;
    if (!canAnimate()) return;
    const elapsed = Math.min(64, lastTime ? time - lastTime : 1000 / 60);
    lastTime = time;
    if (drifting) target = scrollY + DRIFT_SPEED * elapsed / 1000;
    const limit = document.documentElement.scrollHeight - innerHeight;
    target = Math.max(0, Math.min(limit, target));
    const next = drifting ? target : easeScroll(scrollY, target, elapsed);
    window.scrollTo(0, next);
    recycle();
    if (drifting || Math.abs(scrollY - target) > 1) invalidate();
    else lastTime = 0;
  }
  function resetIdle() {
    clearTimeout(idleTimer);
    drifting = false;
    if (canAnimate()) idleTimer = setTimeout(() => { drifting = true; target = scrollY; invalidate(); }, IDLE_DELAY);
  }
  function stopMotion() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0; target = scrollY;
    resetIdle();
  }
  window.addEventListener('wheel', event => {
    resetIdle();
    if (!canAnimate() || !desktop.matches || event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
    event.preventDefault();
    if (!frame) target = scrollY;
    target += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    invalidate();
  }, {passive:false});
  for (const event of ['pointerdown','touchstart','keydown']) window.addEventListener(event, stopMotion, {passive:true});
  window.addEventListener('pointermove', resetIdle, {passive:true});
  window.addEventListener('scroll', () => { if (!frame && !drifting) target = scrollY; recycle(); }, {passive:true});
  function finishIntro() {
    for (const animation of animations) animation.cancel();
    animations = [];
    introGrid?.remove(); introGrid = null;
    grid.inert = false;
    root.classList.remove('photo-pending','photo-entering');
    root.dataset.photoPhase = 'ready';
    ready = true;
    recycle(); resetIdle();
  }
  reduced.addEventListener('change', () => { if (reduced.matches) { finishIntro(); stopMotion(); } else resetIdle(); });
  document.addEventListener('photomenuchange', stopMotion);
  document.addEventListener('visibilitychange', () => {
    stopMotion();
    for (const animation of animations) { if (document.hidden) animation.pause(); else animation.play(); }
  });
  window.addEventListener('pagehide', () => { clearTimeout(idleTimer); cancelAnimationFrame(frame); frame = 0; });
  window.addEventListener('pageshow', event => { if (event.persisted) { finishIntro(); stopMotion(); } });
  window.addEventListener('resize', () => { clearHover(); if (!ready) finishIntro(); stopMotion(); });
  if (!root.classList.contains('photo-pending') || reduced.matches) { finishIntro(); return; }
  grid.inert = true;
  root.dataset.photoPhase = 'loading';
  await Promise.all([document.fonts.ready, window.ligeroRouteReady]);
  if (ready) return;
  introGrid = document.createElement('div');
  introGrid.className = 'photo-grid intro-grid';
  introGrid.inert = true;
  introGrid.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 12; i++) introGrid.append(cloneCard(original[i % original.length]));
  document.querySelector('#photographs').append(introGrid);
  const count = columns();
  const end = count === 2 ? -631 : -420;
  for (const [index, card] of [...introGrid.children].entries()) {
    animations.push(card.animate([{transform:`translateY(${introColumn(index,count)}%)`},{transform:`translateY(${end}%)`}], {duration:INTRO_DURATION,easing:'ease',fill:'both'}));
  }
  animations.push(introGrid.animate([{opacity:1},{opacity:1,offset:1-INTRO_FADE_DURATION/INTRO_DURATION,easing:'ease-out'},{opacity:0}], {duration:INTRO_DURATION,fill:'both'}));
  animations.push(grid.animate([{transform:'translateY(85%)'},{transform:'translateY(0)'}], {duration:INTRO_DURATION,easing:'ease',fill:'both'}));
  root.classList.replace('photo-pending','photo-entering');
  root.dataset.photoPhase = 'intro';
  await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  finishIntro();
}
