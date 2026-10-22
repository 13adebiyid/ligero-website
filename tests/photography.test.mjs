import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildPages, escapeHTML} from '../scripts/build-photography.mjs';
import {introColumn, neighbors, easeScroll, INTRO_DURATION, INTRO_FADE_DURATION, IDLE_DELAY, DRIFT_SPEED} from '../services/photography/motion.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const photos = JSON.parse(readFileSync(path.join(root,'services/photography/photos.json'),'utf8'));
const pages = buildPages(photos);
test('ten real images, deep links, real artist link and full-resolution detail assets', () => {
  assert.equal(photos.length, 10);
  assert.equal(pages.size, 11);
  for (const photo of photos) {
    const detail = pages.get(`services/photography/photo-${photo.id}.html`);
    assert.ok(detail.includes(`<img src="${photo.image}"`));
    assert.ok(detail.includes(`href="${photo.photographerUrl}"`));
    assert.ok(existsSync(path.join(root,photo.image)));
    assert.ok(existsSync(path.join(root,photo.photographerUrl)));
    if(photo.preview)assert.ok(existsSync(path.join(root,photo.preview)));
  }
  assert.doesNotMatch(pages.get('services/photography.html'),/intro-mark/);
  assert.match(pages.get('services/photography.html'),/class="logo" aria-label="Ligero home">LIGERO/);
});
test('reference 3s stagger, 20s idle delay, and frame-independent 30px/s drift', () => {
  assert.equal(INTRO_DURATION, 3000);
  assert.equal(INTRO_FADE_DURATION, 650);
  assert.ok(INTRO_FADE_DURATION < INTRO_DURATION);
  assert.equal(IDLE_DELAY, 20000);
  assert.equal(DRIFT_SPEED, 30);
  assert.deepEqual([0,1,2,3,4,5].map(i=>introColumn(i,3)), [130,210,170,130,210,170]);
  assert.deepEqual([0,1,2,3].map(i=>introColumn(i,2)), [220,300,220,300]);
  assert.ok(easeScroll(0,100,1000/60)>0);
  assert.ok(easeScroll(0,100,1000/60)<100);
  assert.ok(Math.abs(easeScroll(0,100,1000/30)-19)<.01);
});
test('hover neighboring cells are bounded by rows and columns', () => {
  assert.deepEqual(neighbors(0,10,3), [1,2,3,4,5,6,7,8]);
  assert.deepEqual(neighbors(0,10,2), [1,2,3,4,5]);
  assert.ok(neighbors(9,10,3).every(i=>i>=0&&i<10&&i!==9));
});
test('generated HTML safely escapes supplied text rather than interpreting markup', () => {
  assert.equal(escapeHTML(`<b>"'&`),'&lt;b&gt;&quot;&#39;&amp;');
  const example={...photos[0],id:11,client:`<img src=x onerror=alert(1)>`};
  assert.ok(buildPages([example]).get('services/photography/photo-11.html').includes('&lt;img src=x onerror=alert(1)&gt;'));
});
test('all Photography pages are built from the source and reach the shared native scrollbar', () => {
  for (const [file, html] of pages) assert.equal(readFileSync(path.join(root,file),'utf8'),html,`stale ${file}`);
  assert.match(readFileSync(path.join(root,'services/photography/page.css'),'utf8'),/scrollbars\.css/);
  assert.match(readFileSync(path.join(root,'js/page-transitions.js'),'utf8'),/services\\\/photography/);
});
