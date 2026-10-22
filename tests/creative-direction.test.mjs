import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {INTRO_DURATION, TRANSITION_DURATION, stackEase, expoInOut, powerInOut, introStates, restingStates, transitionStates, metadataMotion, nextIndex} from '../services/creative-direction/motion.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const page = readFileSync(path.join(root, 'services/creative-directing.html'), 'utf8');
const css = readFileSync(path.join(root, 'services/creative-direction/page.css'), 'utf8');
const close = (a, b) => assert.ok(Math.abs(a - b) < .00001, `${a} != ${b}`);
function exactFile(url) {
  let dir = root;
  for (const segment of url.replace(/^\//, '').split('/').filter(Boolean)) {
    assert.ok(readdirSync(dir).includes(segment), `Case-sensitive deployed asset missing: ${url}`);
    dir = path.join(dir, segment);
  }
}

test('reference easing preserves endpoints, midpoint and monotonic motion', () => {
  for (const ease of [stackEase, expoInOut, powerInOut]) {
    close(ease(-1), 0); close(ease(0), 0); close(ease(1), 1); close(ease(2), 1);
    for (let i = 1; i <= 100; i++) assert.ok(ease(i / 100) >= ease((i - 1) / 100));
  }
  close(powerInOut(.5), .5);
  close(powerInOut(.25), .0625);
  assert.ok(stackEase(.5) > .8);
});

test('entry starts below the viewport, rises as narrow cards, expands to first real film', () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const order = [2, 3, 0, 1];
    const start = introStates(0, order, width, height);
    start.forEach(card => assert.ok(card.y - card.height / 2 > height / 2));
    close(start[0].width, width * (width > 768 ? 760 / 1440 : 338 / 390));
    const risen = introStates(1900, order, width, height);
    assert.ok(Math.abs(risen[0].y) < 25);
    const end = introStates(INTRO_DURATION, order, width, height);
    close(end[0].y, 0);
    close(end[0].width, width * (width > 768 ? .98 : 1.05));
    assert.deepEqual(end.map(card => card.opacity), [1, 0, 0, 0]);
  }
});

test('scroll shrinks outgoing film then carries incoming film in the chosen direction', () => {
  for (const direction of [-1, 1]) {
    const start = transitionStates(0, 0, 1, direction, 4, 1440, 900);
    close(start[0].y, 0); close(start[1].y, direction * 900);
    const shrinking = transitionStates(200, 0, 1, direction, 4, 1440, 900);
    close(shrinking[0].width, .97 * 1440);
    const middle = transitionStates(700, 0, 1, direction, 4, 1440, 900);
    close(middle[0].y, -450 * direction); close(middle[1].y, 450 * direction);
    const end = transitionStates(TRANSITION_DURATION, 0, 1, direction, 4, 1440, 900);
    close(end[1].y, 0); close(end[1].width, .98 * 1440);
    assert.equal(end[0].opacity, 0);
    assert.ok(end[1].order > end[0].order);
  }
});

test('metadata exits with stagger while new title travels from outside the viewport', () => {
  close(metadataMotion(0, 1, 0, 900, true), 1350);
  close(metadataMotion(1200, 1, 0, 900, true), 0);
  assert.ok(metadataMotion(500, 1, 0, 900, false) < metadataMotion(500, 1, 3, 900, false));
});

test('all four films are reachable in both directions with one active resting plane', () => {
  assert.equal(nextIndex(3, 1, 4), 0);
  assert.equal(nextIndex(0, -1, 4), 3);
  for (let i = 0; i < 4; i++) assert.equal(restingStates(i, 4, 1440, 900).filter(card => card.opacity).length, 1);
});

test('creative page keeps the real titles, credits, original logo and menu without reference corner controls', () => {
  for (const text of ['LIGERO', 'Creative Direction', 'Perfect Combi', 'Wear Your Crown', 'One More Note', '100X', 'Ashleigh']) assert.ok(page.includes(text));
  for (const url of ['/shop/', '/services/', '/contact/', '/policies/']) assert.ok(page.includes(`href="${url}"`));
  assert.match(css, /font-family:Suissnord/);
  assert.match(css, /font-family:ABCDiatype/);
  assert.match(css, /font-family:Madani/);
  assert.doesNotMatch(page, /c-home-progress|bottom-left|bottom-right|\.DOLLARS/);
  assert.equal((page.match(/class="film"/g) || []).length, 4);
  assert.equal((page.match(/class="film-open"/g) || []).length, 4);
});

test('all new local assets and film links exist with production-case filenames', () => {
  for (const match of page.matchAll(/(?:src|href|data-preview)="(\/[^"#]+\.[\w]+)"/g)) exactFile(match[1]);
  for (const match of css.matchAll(/url\('(\/[^']+)'\)/g)) exactFile(match[1]);
  exactFile('/services/creative-direction/duotone.jpg');
  for (const file of ['motion.mjs','video-renderer.mjs','page.mjs','page.css']) exactFile(`/services/creative-direction/${file}`);
});

test('intro reveals film once, not every animation frame', () => {
  const controller = readFileSync(path.join(root, 'services/creative-direction/page.mjs'), 'utf8');
  const intro = controller.slice(controller.indexOf("if (phase === 'intro')"), controller.indexOf('} else if (transition)', controller.indexOf("if (phase === 'intro')")));
  assert.match(intro, /if \(elapsed >= 3180 && !films\[active\]\.classList\.contains\('is-active'\)\) revealFilm\(active\)/);
});
