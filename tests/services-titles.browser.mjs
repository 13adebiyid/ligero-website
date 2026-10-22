import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium} = require('@playwright/test');
const {PNG} = require('playwright-core/lib/utilsBundle');
const base = process.env.LIGERO_PREVIEW || 'http://127.0.0.1:4325';
const output = process.env.LIGERO_EVIDENCE;
if (output) await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const failures = [];
const titleSelector = '#__nuxt [data-gl="card"] [data-title]';

async function check(name, run) {
  try { await run(); console.log(name + ' PASS'); }
  catch (error) { failures.push(name + ': ' + error.message); console.error(name, error); }
}

async function animatedTitles(width, theme) {
  const context = await browser.newContext({viewport:{width,height:900}});
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let blocked = 0;
  try {
    await context.addInitScript(theme => localStorage.setItem('theme', theme), theme);
    await context.route('**/services/gallery/glyphs/*', async route => {
      blocked++;
      await held;
      await route.continue().catch(() => {});
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/services/', {waitUntil:'domcontentloaded'});
    const frame = await (await page.locator('#services-gallery').elementHandle()).contentFrame();
    await frame.waitForFunction(() => document.querySelectorAll('[data-title]').length > 0);
    await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const state = await frame.evaluate(selector => {
      const gallery = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$folio;
      return {
        ready: gallery.core.shaderReady === true,
        theme: document.documentElement.dataset.theme,
        cards: document.querySelectorAll('[data-gl="card"]').length,
        titles: [...document.querySelectorAll(selector)].map(el => {
          const css = getComputedStyle(el), rect = el.getBoundingClientRect();
          return {text:el.textContent,filter:css.filter,opacity:css.opacity,visibility:css.visibility,width:rect.width,height:rect.height};
        }),
      };
    }, titleSelector);
    assert.ok(blocked > 0, 'The test must actually hold the glyph downloads');
    assert.equal(state.ready, false, 'Observe the titles before the renderer is ready');
    assert.equal(state.theme, theme);
    assert.equal(state.titles.length, state.cards);
    assert.ok(state.titles.length > 0);
    for (const title of state.titles) {
      assert.ok(title.width > 0 && title.height > 0, `${title.text}: retain measurable layout`);
      assert.equal(title.opacity, '1', `${title.text}: preserve the opacity sampled by the renderer`);
      assert.equal(title.visibility, 'visible', `${title.text}: preserve renderer visibility`);
      assert.equal(title.filter, 'opacity(0)', `${title.text}: duplicate HTML must not flash before the animated title`);
    }
    const before = PNG.sync.read(await page.screenshot());
    const hide = await frame.addStyleTag({content:`${titleSelector} { visibility: hidden !important; }`});
    const hidden = PNG.sync.read(await page.screenshot());
    await hide.evaluate(el => el.remove());
    assert.deepEqual(before.data, hidden.data, 'Removing HTML title paint must not change the pre-animation pixels');
    release();
    await frame.waitForFunction(() => {
      const gallery = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
      return gallery?.cards.length > 0 && gallery.cards.every(card => card.landed)
        && gallery.texts.length === gallery.cards.length && gallery.texts.every(text => text.progress === 1);
    });
    const rendered = await frame.evaluate(() => {
      const gallery = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$folio;
      const core = gallery.core, gl = core.renderer.getContext(), tick = core.onTick;
      const texts = gallery.texts.map(text => ({text,visible:text.mesh.visible}));
      const capture = () => {
        core.wake(); core.tick();
        const data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);
        return data;
      };
      core.onTick = null;
      try {
        const visible = capture();
        texts.forEach(({text}) => { text.mesh.visible = false; });
        const hidden = capture();
        let changed = 0;
        for (let i = 0; i < visible.length; i += 4) {
          if (Math.max(...[0,1,2].map(c => Math.abs(visible[i+c] - hidden[i+c]))) > 5) changed++;
        }
        return {changed,titles:texts.map(({text}) => ({alpha:text.material.uniforms.u_alpha.value,cssAlpha:text.cssAlpha}))};
      } finally {
        texts.forEach(({text,visible}) => { text.mesh.visible = visible; });
        core.onTick = tick; core.wake(); core.tick();
      }
    });
    assert.ok(rendered.changed > 50, `Animated titles must visibly affect the canvas (${rendered.changed} pixels)`);
    for (const title of rendered.titles) {
      assert.equal(title.alpha, 1);
      assert.equal(title.cssAlpha, 1);
    }
    const card = frame.locator('[data-gl="card"]').first();
    await card.focus();
    assert.equal(await card.evaluate(el => el === document.activeElement), true, 'Cards remain keyboard focusable');
    if (output) await page.screenshot({path:`${output}/titles-${theme}-${width}.png`});
    const id = await card.getAttribute('data-id');
    const destination = await frame.locator('#readable a').evaluateAll((links, id) => links.find(link => link.id === id)?.href, id);
    assert.ok(destination, 'The card retains its matching service destination');
    await page.keyboard.press('Enter');
    await page.waitForURL(new URL(destination, base).href, {waitUntil:'domcontentloaded'});
    assert.deepEqual(errors, []);
    console.log(`${width} ${theme}: HTML contributes no early pixels; animated titles contribute ${rendered.changed} pixels; keyboard navigation works`);
  } finally { release(); await context.close(); }
}

async function readableTitles(width, mode) {
  const context = await browser.newContext({viewport:{width,height:900},
    reducedMotion:mode === 'reduced-motion' ? 'reduce' : 'no-preference',javaScriptEnabled:mode !== 'no-javascript'});
  try {
    if (mode === 'no-webgl') await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type.includes('webgl') ? null : original.call(this, type, ...args);
      };
    });
    if (mode === 'data-failure') await context.route('**/services/gallery/services.json', route => route.abort());
    if (mode === 'module-failure') await context.route('**/services/gallery/_nuxt/DZyj3ghP.js', route => route.abort());
    const page = await context.newPage();
    await page.goto(base + '/services/gallery/' + (mode === 'readable' ? '?view=readable' : ''), {waitUntil:'load'});
    await page.locator('#readable').waitFor({state:'visible'});
    const links = page.locator('#readable .service-links a');
    assert.equal(await links.count(), 6);
    for (const link of await links.all()) {
      assert.equal(await link.isVisible(), true);
      const style = await link.locator('span').evaluate(el => {
        const css = getComputedStyle(el);
        return {filter:css.filter,opacity:css.opacity,visibility:css.visibility,text:el.textContent.trim()};
      });
      assert.equal(style.filter, 'none');
      assert.equal(style.opacity, '1');
      assert.equal(style.visibility, 'visible');
      assert.ok(style.text.length > 0);
      assert.ok(await link.getAttribute('href'));
    }
  } finally { await context.close(); }
}

try {
  for (const width of [1440,390]) {
    for (const theme of ['black','white']) await check(`titles ${width} ${theme}`, () => animatedTitles(width, theme));
    if (process.argv[2] !== 'titles') {
      for (const mode of ['readable','reduced-motion','no-webgl','no-javascript','data-failure','module-failure']) {
        await check(`fallback ${width} ${mode}`, () => readableTitles(width, mode));
      }
    }
  }
} finally { await browser.close(); }
assert.deepEqual(failures, []);
