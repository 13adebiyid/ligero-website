import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('@playwright/test');
const base = process.env.LIGERO_PREVIEW || 'http://127.0.0.1:4325';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport:{width,height:900}});
    await page.addInitScript(() => {
      const check = () => {
        const readable = document.getElementById('readable');
        if (readable && getComputedStyle(readable).display !== 'none') window.readableFlashed = true;
        if (!document.documentElement.classList.contains('gallery-mode')) requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
      window.entranceSamples = [];
      const sampleEntrance = () => {
        const gallery = document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
        for (const card of gallery?.cards || []) {
          if (card.landed || !gallery.onScreen(card.el.getBoundingClientRect())) continue;
          const target = gallery.cardPose(card.el);
          if (target) window.entranceSamples.push({
            id: card.id,
            dx: card.mesh.position.x - target.pos.x,
            dy: card.mesh.position.y - target.pos.y,
          });
        }
        if (performance.now() < 6000) requestAnimationFrame(sampleEntrance);
      };
      requestAnimationFrame(sampleEntrance);
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let blocked = 0;
    await page.route('**/*', async route => {
      const url = route.request().url();
      if ((url.endsWith('.mp4') && !url.endsWith('/test_video.mp4')) || /\/(models|music|styling)\.svg$/.test(url)) {
        blocked++;
        await held;
        await route.abort().catch(() => {});
      } else await route.continue();
    });
    try {
      await page.goto(base + '/', {waitUntil:'domcontentloaded'});
      await page.locator('.page-transition').waitFor({state:'detached'});
      if (width === 390) await page.locator('.hamburger-menu').click();
      let start = 0, documentAt = 0;
      page.on('request', request => {
        if (request.url() === base + '/services/' && request.resourceType() === 'document') documentAt = Date.now();
      });
      start = Date.now();
      await page.locator(`${width === 390 ? '.mobile-menu-overlay' : '.nav-menu'} a[href="/services/"]`).click({noWaitAfter:true});
      await page.waitForURL('**/services/', {waitUntil:'domcontentloaded'});
      await page.evaluate(() => window.ligeroRouteReady);
      const galleryStart = Date.now();
      try {
        await page.waitForFunction(() => {
        const doc = document.querySelector('#services-gallery')?.contentDocument;
        const gallery = doc?.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
        return gallery?.cards.some(card => card.mesh.material.uniforms.u_alpha.value > .05 && card.mesh.material.uniforms.u_texture.value.image?.width > 1);
        }, null, {timeout:10000});
      } catch (error) {
        console.error(await page.evaluate(() => {
          const doc = document.querySelector('#services-gallery')?.contentDocument;
          const gallery = doc?.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
          return { mode: doc?.documentElement.className,
            resolved: [...(gallery?.resolved.keys() || [])],
            cards: gallery?.cards.map(c => ({id:c.id,alpha:c.mesh.material.uniforms.u_alpha.value})),
            rects: [...(doc?.querySelectorAll('[data-id]') || [])].map(c => ({id:c.dataset.id,rect:c.getBoundingClientRect().toJSON()})) };
        }));
        throw error;
      }
      const entranceMs = Date.now() - start;
      const readyEntranceMs = Date.now() - galleryStart;
      const frame = page.frameLocator('#services-gallery');
      await page.waitForFunction(() => {
        const win = document.querySelector('#services-gallery')?.contentWindow;
        return win?.entranceSamples?.some(sample => sample.dx < -.1 && sample.dy > .1);
      }, null, {timeout:2000});
      await page.waitForFunction(() => {
        const doc = document.querySelector('#services-gallery')?.contentDocument;
        const gallery = doc?.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
        return gallery?.cards.length === 6 && gallery.cards.every(card => card.landed);
      }, null, {timeout:3000});
      const samples = await frame.locator('body').evaluate(el => el.ownerDocument.defaultView.entranceSamples);
      const first = samples.find(sample => sample.dx < -.1 && sample.dy > .1);
      const last = samples.filter(sample => sample.id === first.id).at(-1);
      assert.ok(Math.hypot(last.dx, last.dy) < Math.hypot(first.dx, first.dy) * .1, 'The top-left flight must travel into its final carousel position');
      assert.equal(await frame.locator('#readable').isVisible(), false);
      assert.equal(await frame.locator('body').evaluate(el => !!el.ownerDocument.defaultView.readableFlashed), false);
      assert.equal(await page.locator('.page-transition').count(), 0);
      assert.equal(await frame.locator('[data-gl="bar"]').count(), 0);
      assert.equal(await frame.locator('[data-gl="card"]').count(), 6);
      assert.ok(blocked > 0, 'The slow optional media must really be held');
      assert.ok(documentAt-start < 300, `Services request delayed ${documentAt-start}ms`);
      assert.deepEqual(errors, []);
      console.log(`${width}: navigation ${documentAt-start}ms; textured entrance ${entranceMs}ms from click / ${readyEntranceMs}ms after route transition; top-left flight landed; ${blocked} optional media requests still held; no loader/grid flash`);
    } finally {
      release();
      await page.close();
    }
  }
} finally { await browser.close(); }
