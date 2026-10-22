import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {formatTime, spokenTime, parseCssTime, transitionTotalMs, seekTarget, progressPercent, isPlainPrimaryClick, isOutsideRect, shouldPlayError, clamp, setupFilmPlayer} from './player.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const js = readFileSync(path.join(dir, 'player.mjs'), 'utf8');
const css = readFileSync(path.join(dir, 'player.css'), 'utf8');
const html = readFileSync(path.join(dir, '../creative-directing.html'), 'utf8');

test('formatTime handles invalid, minutes and hours', () => {
  assert.equal(formatTime(NaN), '0:00');
  assert.equal(formatTime(Infinity), '0:00');
  assert.equal(formatTime(-3), '0:00');
  assert.equal(formatTime(5.9), '0:05');
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(3725), '1:02:05');
});

test('spokenTime reads naturally for screen readers', () => {
  assert.equal(spokenTime(0), '0 seconds');
  assert.equal(spokenTime(61), '1 minute 1 second');
  assert.equal(spokenTime(3720), '1 hour 2 minutes');
});

test('CSS time parsing supports lists, ms and s', () => {
  assert.equal(parseCssTime('0.38s'), 380);
  assert.equal(parseCssTime('120ms'), 120);
  assert.equal(parseCssTime('0s, 0.42s, 0.2s'), 420);
  assert.equal(parseCssTime('junk'), 0);
  assert.equal(transitionTotalMs({transitionDuration: '0.38s, 0.38s', transitionDelay: '0s'}), 380);
  assert.equal(transitionTotalMs({transitionDuration: '0s', transitionDelay: '0s'}), 0);
  assert.equal(transitionTotalMs({transitionDuration: '0.2s', transitionDelay: '0.1s, 0s'}), 300);
});

test('seek and progress clamp to the media range', () => {
  assert.equal(seekTarget(2, -5, 100), 0);
  assert.equal(seekTarget(98, 5, 100), 100);
  assert.equal(seekTarget(10, 5, 100), 15);
  assert.equal(seekTarget(NaN, 5, 100), 5);
  assert.equal(progressPercent(25, 100), 25);
  assert.equal(progressPercent(5, NaN), 0);
  assert.equal(progressPercent(500, 100), 100);
  assert.equal(clamp(5, 0, 3), 3);
});

test('modified or non-primary clicks keep default link behaviour', () => {
  assert.ok(isPlainPrimaryClick({button: 0}));
  for (const k of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) assert.ok(!isPlainPrimaryClick({button: 0, [k]: true}));
  assert.ok(!isPlainPrimaryClick({button: 1}));
});

test('only points outside the panel box count as backdrop clicks', () => {
  const rect = {left: 100, right: 500, top: 50, bottom: 350};
  assert.ok(!isOutsideRect({clientX: 120, clientY: 60}, rect));
  assert.ok(isOutsideRect({clientX: 20, clientY: 60}, rect));
  assert.ok(isOutsideRect({clientX: 300, clientY: 400}, rect));
  assert.ok(!isOutsideRect({clientX: 0, clientY: 0}, rect), 'keyboard-synthesised clicks never close');
});

test('play errors: abort and autoplay-block are not failures', () => {
  assert.ok(!shouldPlayError({name: 'AbortError'}));
  assert.ok(!shouldPlayError({name: 'NotAllowedError'}));
  assert.ok(shouldPlayError({name: 'NotSupportedError'}));
  assert.ok(!shouldPlayError(null));
});

test('setupFilmPlayer rejects a dialog without the full film video', () => {
  assert.throws(() => setupFilmPlayer({dialog: {querySelector: () => null}, films: []}), /#full-film/);
});

test('player targets only markup that exists in the page', () => {
  for (const sel of ['id="full-film"', 'id="film-dialog-title"', 'id="film-dialog-client"', 'id="film-direct-link"', 'class="film-close"', 'class="playback-status"', 'class="dialog-credit"']) assert.ok(html.includes(sel), sel);
  assert.match(html, /<video id="full-film" controls/, 'native controls remain as fallback in markup');
});

test('lifecycle contracts in source', () => {
  assert.match(js, /video\.controls = false/);
  assert.match(js, /dialog, 'cancel'[\s\S]*preventDefault\(\)[\s\S]*requestClose/, 'Esc is animated, not abrupt');
  assert.match(js, /removeAttribute\('src'\)[\s\S]*video\.load\(\)/, 'src released on close');
  assert.match(js, /video\.poster = poster/, 'real poster cover');
  assert.match(js, /document\.hidden\) video\.pause\(\)/);
  assert.match(js, /onOpenChange\(true\)/);
  assert.match(js, /onOpenChange\(false\)/);
  assert.match(js, /back\.focus\(/);
  assert.match(js, /isPlainPrimaryClick/);
  assert.match(js, /requestFullscreen\(\)[\s\S]*catch[\s\S]*could not start/, 'failed fullscreen is reported');
  assert.match(js, /session\+\+/, 'race token');
  assert.ok(!/\bimport\b[^;]*from\s+['"][^.]/.test(js), 'no dependencies');
});

test('every listener is registered through the cleanup list', () => {
  assert.equal((js.match(/\.addEventListener\(/g) ?? []).length, 1, 'only the listen() helper adds listeners');
  assert.match(js, /cleanups\.splice\(0\)\.forEach/);
});

test('css: Madani font, motion timing, reduced motion, labels and touch sizing', () => {
  assert.ok(existsSync(path.join(dir, '../../fonts/MadaniDEMO-Thin.woff')));
  assert.match(readFileSync(path.join(dir, 'page.css'), 'utf8'), /@font-face\{font-family:Madani;src:url\('\/fonts\/MadaniDEMO-Thin\.woff'\)/);
  assert.ok(!css.includes('@font-face'), 'Madani is declared once, in page.css');
  assert.match(css, /font-family:Madani,/);
  const ms = Number(/--fp-time:(\d+)ms/.exec(css)?.[1]);
  assert.ok(ms >= 300 && ms <= 420, `duration ${ms}`);
  assert.match(css, /\.film-player-dialog\{[^}]*opacity:0;transform:translateY\(22px\) scale\(\.975\)/);
  assert.match(css, /::backdrop\{opacity:0;transition:opacity/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{[^]*transition:none/);
  assert.match(css, /pointer:coarse[^]*min-height:44px/);
  assert.match(css, /focus-visible/);
});
