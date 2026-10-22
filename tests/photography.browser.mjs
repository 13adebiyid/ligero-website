import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium} = require('@playwright/test');
const base = process.env.LIGERO_PREVIEW || 'http://127.0.0.1:4325';
const evidence = process.env.LIGERO_EVIDENCE;
if (evidence) await mkdir(evidence, {recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const errors = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base+'/services/photography.html',{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('.intro-mark').count(),0);
    assert.equal(await page.locator('.photo-header .logo').innerText(),'LIGERO');
    assert.equal(await page.locator('.menu-toggle').isVisible(),width<=768);
    await page.waitForFunction(() => document.documentElement.dataset.photoPhase === 'intro');
    assert.equal(await page.locator('.intro-grid .photo-card').count(),12);
    await page.waitForFunction(() => document.documentElement.dataset.photoPhase === 'ready');
    assert.equal(await page.locator('.intro-grid').count(),0);
    assert.equal(await page.locator('.photo-card').count(),40);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('.photo-header .logo').isVisible(),true);
    assert.equal(await page.locator('.menu-toggle').isVisible(),width<=768);
    assert.equal(await page.evaluate(() => document.fonts.check('16px Suissnord') && document.fonts.check('16px Madani')),true);
    if (evidence) await page.screenshot({path:`${evidence}/photography-grid-${width}.png`});
    assert.equal(await page.locator('#customCursor').count(),0);
    assert.ok((await page.locator('.photo-caption h2').first().evaluate(element => getComputedStyle(element).fontFamily)).startsWith('Madani'));
    if (width<=768) {
      await page.locator('.menu-toggle').click();
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true');
      assert.equal(await page.locator('.menu-toggle').innerText(),'CLOSE');
      assert.equal(await page.locator('#photo-menu a:visible').count(),5);
      assert.equal(await page.locator('main').getAttribute('inert'),'');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
    } else {
      assert.equal(await page.locator('#photo-menu a:visible').count(),4);
    }
    if (width===1440) {
      await page.locator('.photo-link').first().hover();
      assert.equal(await page.locator('.photo-card.is-hovered').count(),1);
      assert.equal(await page.locator('.photo-card.is-neighbor').count(),8);
      assert.notEqual(await page.locator('.photo-link').first().evaluate(element => getComputedStyle(element).cursor),'none');
      await page.mouse.wheel(0,600);
      await page.waitForFunction(() => scrollY>400);
      const before = await page.evaluate(() => scrollY);
      await page.waitForFunction(before => scrollY>before+100,before);
      const end = await page.evaluate(() => document.documentElement.scrollHeight-innerHeight);
      await page.evaluate(end => scrollTo(0,end),end);
      await page.waitForFunction(end => scrollY < end - 800,end);
      for (let i=0; i<3; i++) {
        await page.evaluate(() => scrollTo(0,document.documentElement.scrollHeight));
        await page.waitForFunction(() => document.querySelectorAll('.photo-card').length<=90);
      }
      assert.ok(await page.locator('.photo-card').count()<=90,'gallery must not accumulate unbounded cards');
      console.log('desktop hover, normal cursor, smooth scroll, bounded repeat PASS');
    } else {
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.photo-grid')).gridTemplateColumns.split(' ').length),2);
      const end = await page.evaluate(() => document.documentElement.scrollHeight-innerHeight);
      await page.evaluate(end => scrollTo(0,end),end);
      await page.waitForFunction(end => scrollY < end - 800,end);
      console.log('mobile two-column, native scroll, menu PASS');
    }
    await page.locator('.photo-link').first().click();
    await page.waitForURL('**/services/photography/photo-1.html');
    assert.equal(await page.locator('.photo-information dt').count(),4);
    assert.equal(await page.locator('.photo-information dd a').getAttribute('href'),'/members/ashleigh-cooper-creative-director.html');
    assert.equal(await page.locator('.project-image img').evaluate(image => image.complete && image.naturalWidth>0),true);
    assert.equal(await page.locator('.photo-grid').count(),0,'detail has no gallery scroll controller');
    const geometry = await page.evaluate(() => ({left:document.querySelector('.photo-information').getBoundingClientRect().left,right:document.querySelector('.project-image').getBoundingClientRect().left}));
    if (width>768) assert.ok(geometry.right>geometry.left,'full image stays to the right');
    await page.evaluate(() => window.ligeroRouteReady);
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
    if (evidence) await page.screenshot({path:`${evidence}/photography-detail-${width}.png`});
    await page.locator('.back-link').click();
    await page.waitForURL('**/services/photography.html');
    await page.waitForFunction(() => document.documentElement.dataset.photoPhase === 'ready');
    assert.ok(await page.locator('.photo-link').first().isVisible());
    await page.close();
    console.log(`${width} gallery -> photo -> back PASS`);
  }
  const reduced = await browser.newPage({reducedMotion:'reduce'});
  await reduced.goto(base+'/services/photography.html');
  assert.equal(await reduced.locator('.intro-mark').count(),0);
  assert.equal(await reduced.locator('.photo-link').first().isVisible(),true);
  await reduced.close();
  const noJS = await browser.newPage({javaScriptEnabled:false});
  await noJS.goto(base+'/services/photography.html');
  assert.equal(await noJS.locator('.photo-link').first().isVisible(),true);
  assert.equal(await noJS.locator('#photo-menu a[href="/services/"]').isVisible(),true);
  await noJS.close();
  const failed = await browser.newPage();
  await failed.route('**/services/photography/gallery.mjs',route=>route.abort());
  await failed.goto(base+'/services/photography.html');
  await failed.waitForFunction(() => !document.documentElement.classList.contains('photo-pending'));
  assert.equal(await failed.locator('.photo-link').first().isVisible(),true);
  assert.equal(await failed.locator('.photo-grid').getAttribute('inert'),null);
  await failed.close();
  console.log('reduced-motion, no-JS and module-failure readable navigation PASS');
  assert.deepEqual(errors,[],'page errors');
} finally { await browser.close(); }
