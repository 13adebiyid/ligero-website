import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {wrapIndex, frameLabel, pad} from '../services/set-design/bts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
const html = read('services/set-designing.html');
const page = read('services/creative-direction/page.mjs');
const css = read('services/set-design/page.css');

function exactFile(url) {
  let dir = root;
  for (const segment of url.replace(/^\//, '').split('/').filter(Boolean)) {
    assert.ok(readdirSync(dir).includes(segment), `Case-sensitive asset missing: ${url}`);
    dir = path.join(dir, segment);
  }
  return dir;
}
const localUrls = [...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)].map(m => m[1])
  .filter(u => !u.startsWith('/css/theme.css') && u !== '/js/theme.js' && !/\/$/.test(u) && u !== '/' );

test('page reuses the Creative renderer, player and page controller instead of forking them', () => {
  assert.match(html, /src="\/services\/creative-direction\/page\.mjs"/);
  assert.match(html, /href="\/services\/creative-direction\/page\.css"/);
  assert.match(html, /href="\/services\/creative-direction\/player\.css"/);
  assert.equal(readdirSync(path.join(root, 'services/set-design')).filter(f => /player|video-renderer|motion/.test(f)).length, 0);
  assert.match(read('services/set-design/bts.mjs'), /from '\.\.\/creative-direction\/player\.mjs'/);
});

test('theme scripts and stylesheet are ordered as the site shell requires', () => {
  const theme = html.indexOf('src="/js/theme.js"'), transitions = html.indexOf('src="/js/page-transitions.js"');
  assert.ok(theme > -1 && theme < transitions);
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
  assert.equal(sheets.at(-1), '/css/theme.css');
  assert.ok(sheets.indexOf('/services/set-design/page.css') < sheets.length - 1);
});

test('three real projects with existing credits; no Brand behind-the-scenes photography is invented', () => {
  const films = [...html.matchAll(/<article class="film"[\s\S]*?<\/article>/g)].map(m => m[0]);
  assert.equal(films.length, 3);
  assert.match(films[0], /Anisah Myers-Grey/); assert.match(films[0], /A Gift for a Gift/);
  assert.match(films[1], /London Fashion Week/); assert.match(films[1], /Tolu Coker SS<span class="number">25<\/span>/); assert.match(films[1], /Olapeju/);
  assert.match(films[2], /Johnnie Walker x Dankie Sounds/); assert.match(films[2], /A Seat at the Table/); assert.match(films[2], /Mara Lee/);
  for (const film of films) assert.match(film, /href="\/members\/ifeoluwa-segun-oludimu\.html"/);
  assert.doesNotMatch(films[2], /film-bts/);
  assert.deepEqual([...html.matchAll(/class="bts-sheet" data-for="(\w+)"/g)].map(m => m[1]), ['gift', 'fashion']);
  assert.doesNotMatch(html, /brand-still|data-for="brand"/);
});

test('every referenced local asset exists with exact case; previews and videos are the site files', () => {
  assert.ok(localUrls.length > 20);
  for (const url of localUrls) exactFile(url);
  for (const url of ['/videos/Gift-Preview.mp4', '/videos/Fashion-Preview.mp4', '/videos/Brand-Preview.mp4', '/videos/gift.mp4', '/videos/fashion.mp4', '/videos/brand.mp4'])
    assert.ok(html.includes(url), url);
});

test('contact sheets link originals but display bounded previews', () => {
  const sheets = [...html.matchAll(/<section class="bts-sheet"[\s\S]*?<\/section>/g)].map(m => m[0]);
  assert.equal(sheets.length, 2);
  let count = 0;
  for (const sheet of sheets) {
    for (const m of sheet.matchAll(/<a href="(\/images\/[^"]+)"[^>]*><img src="(\/services\/set-design\/thumbs\/[^"]+)" alt="[^"]*" width="(\d+)" height="(\d+)"/g)) {
      count++;
      const full = statSync(exactFile(m[1])), thumb = statSync(exactFile(m[2]));
      assert.ok(thumb.size < 60 * 1024, `${m[2]} is ${thumb.size} bytes`);
      assert.ok(thumb.size < full.size);
      assert.ok(Number(m[3]) <= 720 && Number(m[4]) <= 900);
    }
  }
  assert.equal(count, 8);
  // Heavy originals must never be an <img> source in the page itself.
  assert.doesNotMatch(html, /<img[^>]+src="\/images\//);
});

test('all text is Madani and only the logo/entry mark use Suissnord', () => {
  assert.match(css, /font-family:Madani/);
  assert.doesNotMatch(css, /ABCDiatype|Migra/);
  assert.doesNotMatch(css, /Suissnord/);
  assert.doesNotMatch(css, /cursor\s*:/);
});

test('overlays are theme-variable driven', () => {
  for (const name of ['--site-background', '--site-foreground', '--site-surface', '--site-border']) assert.ok(css.includes(name), name);
});

test('Creative controller yields input to marked overlays without changing its default behaviour', () => {
  assert.match(page, /dialog\[open\]\[data-creative-overlay\]/);
  assert.match(page, /function resumePreview\(\)[\s\S]*?overlayOpen\(\)/);
  assert.match(page, /function step\(direction\)[\s\S]*?overlayOpen\(\)/);
  assert.match(page, /document\.addEventListener\('keydown'[\s\S]*?overlayOpen\(\)/);
  assert.match(page, /container\.addEventListener\('wheel'[\s\S]*?overlayOpen\(\)/);
  assert.match(html, /id="bts-drawer"[^>]*data-creative-overlay/);
  assert.match(html, /id="still-dialog"[^>]*data-creative-overlay/);
  assert.match(html, /id="film-dialog"/);
});

test('page structure keeps the ids the shared controller requires and a no-script path', () => {
  for (const id of ['film-canvas', 'films', 'film-dialog', 'direction-menu', 'film-announcement', 'full-film', 'film-direct-link'])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /class="entry-mark"/); assert.match(html, /class="menu-toggle"/);
  assert.match(html, /<span>LIGERO<\/span>/);
  assert.match(css, /#bts-sheets/);
  assert.match(css, /\.bts-ready #bts-sheets/);
});

test('frame helpers wrap and format', () => {
  assert.equal(wrapIndex(0, -1, 4), 3); assert.equal(wrapIndex(3, 1, 4), 0); assert.equal(wrapIndex(2, 0, 4), 2); assert.equal(wrapIndex(0, 1, 0), 0);
  assert.equal(frameLabel(2, 8), '03 / 08'); assert.equal(pad(12), '12');
});
