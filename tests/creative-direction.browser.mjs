import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium} = require('@playwright/test');
const base = process.env.LIGERO_PREVIEW || 'http://127.0.0.1:4325';
const output = process.env.LIGERO_EVIDENCE;
if (output) await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'msedge', headless:true});
const ready = page => page.waitForFunction(() => document.documentElement.dataset.phase === 'ready');
async function activeIs(page, id) {
  await ready(page);
  assert.equal(await page.locator('.film.is-active').getAttribute('data-id'), id);
}
async function instrument(page) {
  await page.addInitScript(() => {
    window.previewVideos = [];
    const create = document.createElement.bind(document);
    document.createElement = function(tag, ...args) {
      const element = create(tag, ...args);
      if (tag === 'video') window.previewVideos.push(element);
      return element;
    };
    window.planeWidths = [];
    const uniform = WebGLRenderingContext.prototype.uniform2f;
    const locate = WebGLRenderingContext.prototype.getUniformLocation;
    const names = new WeakMap();
    WebGLRenderingContext.prototype.getUniformLocation = function(program, name) {
      const location = locate.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    WebGLRenderingContext.prototype.uniform2f = function(location, x, y) {
      if (names.get(location) === 'uSize' && document.documentElement.dataset.phase === 'intro') window.planeWidths.push(x);
      return uniform.call(this, location, x, y);
    };
  });
}
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
    const errors = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);});
    await instrument(page);
    await page.goto(base + '/services/creative-directing.html', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.documentElement.dataset.phase === 'intro');
    assert.equal(await page.evaluate(() => window.previewVideos.length), 0, 'intro must not fetch video');
    await page.waitForFunction(() => window.planeWidths.some(width => width > innerWidth * .55 && width < innerWidth * .95));
    if (output) await page.screenshot({path:`${output}/entry-${width}.png`});
    await activeIs(page, 'gabzy');
    await page.waitForFunction(() => window.previewVideos.some(video => video.readyState >= 2 && video.currentTime > .1 && !video.paused));
    await page.evaluate(() => document.fonts.ready);
    assert.deepEqual(await page.evaluate(() => ['12px Madani','32px Suissnord'].map(font => document.fonts.check(font))), [true,true]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok(await page.evaluate(() => window.planeWidths.some(w => w < innerWidth * .9)));
    if (output) await page.screenshot({path:`${output}/ready-${width}.png`});
    if (width === 390) {
      await page.locator('.menu-toggle').click();
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
      assert.equal(await page.locator('#direction-menu a').count(), 5);
      assert.equal(await page.evaluate(() => window.previewVideos.every(v => v.paused)), true);
      await page.keyboard.press('Escape');
    }
    for (const id of ['grime','note','reem','gabzy']) {
      await page.mouse.move(width/2, 650);
      await page.mouse.wheel(0, 450);
      await page.waitForFunction(() => document.documentElement.dataset.phase === 'transition');
      if (id === 'grime' && output) {
        await page.waitForFunction(() => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.film.is-active h2')).transform).m42) < innerHeight * .9);
        await page.screenshot({path:`${output}/scroll-${width}.png`});
      }
      await activeIs(page, id);
      await page.waitForFunction(id => window.previewVideos.some(v => v.src.toLowerCase().includes(id) && v.readyState >= 2 && !v.paused), id);
      assert.equal(await page.evaluate(() => window.previewVideos.filter(v => !v.paused).length), 1);
      assert.equal(await page.locator('.film:not([inert])').count(), 1);
    }
    await page.keyboard.press('ArrowUp');
    await activeIs(page, 'reem');
    if (width === 390) {
      await page.locator('#films').dispatchEvent('touchstart', {touches:[{identifier:1,clientX:180,clientY:700}]});
      await page.locator('#films').dispatchEvent('touchmove', {touches:[{identifier:1,clientX:180,clientY:400}]});
      await activeIs(page, 'gabzy');
      await page.locator('#films').dispatchEvent('click');
    }
    await page.locator('.film.is-active .film-open').click({position:{x:width/2,y:650}});
    await page.waitForFunction(() => document.querySelector('#film-dialog').open && document.querySelector('#full-film').readyState >= 2);
    assert.equal(await page.evaluate(() => window.previewVideos.every(v => v.paused)), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#film-dialog').open && window.previewVideos.some(v => !v.paused));
    assert.equal(await page.locator('#full-film').getAttribute('src'), null);
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('film-open')), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    console.log(`${width}: textured stack, fonts, all four decoded previews, wrap, modal and pause/resume PASS`);
    await page.close();
  }
  for (const mode of ['reduced-motion', 'no-webgl', 'module-failure', 'poster-failure', 'no-javascript']) {
    const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:mode==='reduced-motion'?'reduce':'no-preference',javaScriptEnabled:mode!=='no-javascript'});
    const page = await context.newPage();
    if (mode === 'no-webgl') await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {return type.startsWith('webgl') ? null : getContext.call(this, type, ...args);};
    });
    if (mode === 'module-failure') await page.route('**/video-renderer.mjs', route => route.abort());
    if (mode === 'poster-failure') await page.route('**/creative-direction/grime.webp', route => route.abort());
    await page.goto(base + '/services/creative-directing.html');
    if (mode !== 'no-javascript') await page.waitForFunction(() => document.documentElement.dataset.phase === 'fallback');
    assert.equal(await page.locator('#film-canvas').isVisible(), false);
    assert.equal(await page.locator('.film:not([inert])').count(), 4);
    assert.equal(await page.locator('.logo').isVisible(), true);
    await page.locator('.film:last-child .film-open').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.film:last-child h2').isVisible(), true);
    console.log(`${mode}: readable four-film list and navigation PASS`);
    await context.close();
  }
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  await instrument(page);
  await page.route('**/*-Preview.mp4', route => route.abort());
  await page.goto(base + '/services/creative-directing.html');
  await ready(page);
  await page.waitForFunction(() => window.previewVideos[0]?.error);
  await page.mouse.move(600,600); await page.mouse.wheel(0,450);
  await activeIs(page,'grime');
  await page.evaluate(() => document.querySelector('canvas').getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForFunction(() => document.documentElement.dataset.phase === 'fallback');
  assert.equal(await page.locator('.film:not([inert])').count(),4);
  assert.equal(await page.evaluate(() => window.previewVideos.every(v => !v.getAttribute('src'))),true);
  console.log('preview failure + context loss: posters, navigation and media release PASS');
  await page.close();
} finally {await browser.close();}
