import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium} = require('@playwright/test');
const base = process.env.LIGERO_PREVIEW || 'http://127.0.0.1:4325';
const output = process.env.LIGERO_EVIDENCE;
if (output) await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const ready = page => page.waitForFunction(() => document.documentElement.dataset.phase === 'ready');
async function landed(page) {
  await page.waitForFunction(() => {
    const doc = document.querySelector('#services-gallery')?.contentDocument;
    const gallery = doc?.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
    return gallery?.cards.length === 6 && gallery.cards.every(card => card.landed);
  });
}
async function routeReady(page) {
  await page.evaluate(() => window.ligeroRouteReady);
  assert.equal(await page.locator('.route-cover').count(), 0);
}
async function instrumentRoutes(page, fallback) {
  await page.addInitScript(fallback => {
    if (fallback) {
      for (const type of ['pageswap','pagereveal']) addEventListener(type,event=>event.stopImmediatePropagation(),true);
      for (const key of ['onpageswap','onpagereveal']) {
        for (let owner = window; owner; owner = Object.getPrototypeOf(owner)) {
          if (Object.hasOwn(owner,key)) delete owner[key];
        }
      }
    }
    window.routeReceipt = null;
    addEventListener('pagereveal', event => {
      if (!event.viewTransition) return;
      event.viewTransition.ready.then(() => {
        const root = document.documentElement;
        window.routeReceipt = {
          color:getComputedStyle(root,'::view-transition').backgroundColor,
          depart:getComputedStyle(root,'::view-transition-old(root)').animationName,
          arrive:getComputedStyle(root,'::view-transition-new(root)').animationName,
          delay:getComputedStyle(root,'::view-transition-new(root)').animationDelay,
          phase:root.dataset.phase,
        };
      });
    });
    window.coverReceipt = null;
    new MutationObserver(() => {
      const cover = document.querySelector('.route-cover');
      if (cover && !document.documentElement.classList.contains('route-leaving')) window.coverReceipt = getComputedStyle(cover).backgroundColor;
    }).observe(document,{childList:true,subtree:true});
  },fallback);
}
async function navigationReceipt(page, fallback, color) {
  await routeReady(page);
  if (fallback) assert.equal(await page.evaluate(() => window.coverReceipt),color,'destination cover must match the entrance background');
  else {
    const receipt = await page.evaluate(() => window.routeReceipt);
    assert.equal(receipt?.color,color);
    assert.equal(receipt.depart,'route-depart');
    assert.equal(receipt.arrive,'route-arrive');
    assert.equal(receipt.delay,'0.1s');
    if (receipt.phase) assert.notEqual(receipt.phase,'intro','film entrance must wait until the route fade completes');
  }
}
const typography = page => page.locator('.nav-menu .nav-item:not(.nav-home)').first().evaluate(element => {
  const css = getComputedStyle(element);
  return {font:css.fontFamily.split(',')[0].replaceAll('"','').trim(),size:css.fontSize,padding:css.padding,text:css.textTransform};
});
async function servicesLink(page,width) {
  if (width <= 768) {await page.locator('.menu-toggle').click();return page.locator('#direction-menu a[href="/services/"]');}
  return page.locator('.nav-menu a[href="/services/"]');
}
try {
  for (const fallback of (['player','reduced'].includes(process.env.LIGERO_ROUTE_MODE)?[]:process.env.LIGERO_ROUTE_MODE==='fallback'?[true]:[false,true])) {
    for (const width of [1440,390]) {
      const context = await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror',error => errors.push(error.message));
      await instrumentRoutes(page,fallback);
      if(fallback) await page.route('**/css/page-transitions.css',async route=>{
        const response=await route.fetch();
        await route.fulfill({response,body:(await response.text()).replace('navigation: auto','navigation: none')});
      });
      await page.goto(base + '/services/',{waitUntil:'domcontentloaded'});
      assert.equal(await page.evaluate(() => 'onpageswap' in window),!fallback);
      await landed(page);
      await page.evaluate(() => document.fonts.ready);
      const originalMenu = await typography(page);
      let originalMobileMenu;
      if(width<=768){
        await page.locator('.hamburger-menu').click();
        originalMobileMenu = await page.locator('.mobile-menu-item').first().evaluate(el=>{
          const css=getComputedStyle(el);return {font:css.fontFamily.split(',')[0].replaceAll('"','').trim(),size:css.fontSize};
        });
        await page.locator('.hamburger-menu').click();
      }
      if (width===1440 && !fallback && output) await page.screenshot({path:`${output}/services-spacing-fixed.png`});
      const card = page.frameLocator('#services-gallery').locator('[data-gl="card"]').first();
      await card.focus();await page.keyboard.press('Enter');
      await page.waitForURL('**/services/creative-directing.html');
      await navigationReceipt(page,fallback,'rgb(0, 0, 0)');
      await ready(page);
      await page.evaluate(() => document.fonts.ready);
      if (width>768) assert.deepEqual(await typography(page),originalMenu,'original menu typography and padding must be preserved');
      assert.deepEqual(await page.locator('h1').evaluate(el => {
        const css=getComputedStyle(el);return {font:css.fontFamily,size:css.fontSize,weight:css.fontWeight,text:css.textTransform};
      }),{font:'Madani, sans-serif',size:width>768?'48px':'28.8px',weight:'300',text:'uppercase'});
      const returnLink=await servicesLink(page,width);
      if(width<=768){
        assert.deepEqual(await returnLink.evaluate(el=>{
          const css=getComputedStyle(el);return {font:css.fontFamily.split(',')[0].replaceAll('"','').trim(),size:css.fontSize};
        }),originalMobileMenu,'mobile overlay must keep the original Madani font and size');
        assert.equal(await page.locator('#direction-menu .nav-home').isVisible(),true);
      }
      await returnLink.click();
      await page.waitForURL('**/services/');await navigationReceipt(page,fallback,'rgb(0, 0, 0)');await landed(page);
      assert.equal(await page.locator('.services-title').innerText(),'OUR CAPABILITIES');
      await page.locator('.logo').click();await page.waitForURL(base+'/');await navigationReceipt(page,fallback,'rgb(0, 0, 0)');
      assert.equal(await page.locator('.page-transition').count(),0,'internal home arrival must not show the old loading overlay');
      if(width<=768) await page.locator('.hamburger-menu').click();
      await page.locator(`${width<=768?'.mobile-menu-overlay':'.nav-menu'} a[href="/services/"]`).click();
      await page.waitForURL('**/services/');await navigationReceipt(page,fallback,'rgb(0, 0, 0)');await landed(page);
      await page.goBack();await page.waitForURL(base+'/');await routeReady(page);
      assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('route-leaving')),false);
      assert.deepEqual(errors,[]);
      console.log(`${width} ${fallback?'fallback':'native'}: real card + reverse route + home round trip, destination color, ordered entrance, original typography PASS`);
      await context.close();
    }
  }
  for (const width of (process.env.LIGERO_ROUTE_MODE==='reduced'?[]:process.env.LIGERO_PLAYER_WIDTH?[Number(process.env.LIGERO_PLAYER_WIDTH)]:[1440,390])) {
    const page = await browser.newPage({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/services/creative-directing.html');await ready(page);
    const trigger=page.locator('.film.is-active .film-open');
    const open=async()=>{await trigger.click({position:{x:width/2,y:650}});await page.waitForFunction(()=>document.querySelector('#film-dialog').open);};
    const closed=()=>page.waitForFunction(()=>!document.querySelector('#film-dialog').open);
    await open();
    const initial=await page.locator('#film-dialog').evaluate(el=>({opacity:Number(getComputedStyle(el).opacity),poster:el.querySelector('video').getAttribute('poster'),native:el.querySelector('video').controls}));
    assert.ok(initial.opacity<1,'open starts inside its fade');assert.ok(initial.poster?.includes('gabzy.webp'));assert.equal(initial.native,false);
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#film-dialog')).opacity)===1&&document.querySelector('#full-film').currentTime>.1);
    assert.ok((await page.locator('.film-player-controls').evaluate(el=>getComputedStyle(el).fontFamily)).startsWith('Madani'));
    assert.equal(await page.locator('.fp-play').innerText(),'PAUSE');
    await page.locator('.fp-play').click();assert.equal(await page.locator('#full-film').evaluate(v=>v.paused),true);
    await page.locator('.fp-scrub').evaluate(el=>{el.value='12';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.waitForFunction(()=>Math.abs(document.querySelector('#full-film').currentTime-12)<.2);
    assert.ok((await page.locator('.fp-scrub').getAttribute('aria-valuetext')).includes('12 seconds'));
    await page.locator('.fp-mute').click();assert.equal(await page.locator('#full-film').evaluate(v=>v.muted),true);
    await page.locator('.fp-mute').click();assert.equal(await page.locator('#full-film').evaluate(v=>v.muted),false);
    if(width>768){
      await page.locator('.fp-volume').evaluate(el=>{el.value='0.4';el.dispatchEvent(new Event('input',{bubbles:true}));});
      assert.equal(await page.locator('#full-film').evaluate(v=>v.volume),.4);
      await page.locator('.fp-fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);
      assert.equal(await page.locator('.film-player-controls').isVisible(),true);
      await page.locator('.fp-fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
      await page.evaluate(()=>{document.querySelector('.film-player').requestFullscreen=()=>Promise.reject(new Error('denied'));});
      await page.locator('.fp-fullscreen').click();assert.equal(await page.locator('.film-player-message').isVisible(),true);
    }
    await page.locator('.film-close').focus();await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>{
      const dialog=document.querySelector('#film-dialog');
      const background=document.querySelector('.logo');background.focus();
      return dialog.matches(':modal')&&document.activeElement!==background;
    }),true,'native modal must keep background controls inert, including after Tab');
    await page.locator('#film-dialog').click({position:{x:3,y:3}});
    assert.equal(await page.locator('#film-dialog').evaluate(el=>el.open),true,'padding click must not close');
    if(output) await page.screenshot({path:`${output}/player-${width}.png`});
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#film-dialog').evaluate(el=>el.open&&el.classList.contains('is-closing')),true,'Escape keeps the modal mounted for its exit animation');
    assert.equal(await page.locator('#full-film').evaluate(v=>v.paused),true);
    await page.waitForFunction(()=>{const el=document.querySelector('#film-dialog');const opacity=Number(getComputedStyle(el).opacity);return el.open&&opacity>0&&opacity<1;});
    await closed();assert.equal(await page.locator('#full-film').getAttribute('src'),null);
    assert.equal(await page.locator('#full-film').getAttribute('poster'),null);
    assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('film-open')),true);
    await open();await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#film-dialog')).opacity)===1);
    await page.evaluate(()=>{document.querySelector('.film-close').click();document.querySelector('.film.is-active .film-open').click();});
    await page.waitForFunction(()=>document.querySelector('#full-film').currentTime>.5&&document.querySelector('#film-dialog').open);
    assert.equal(await page.locator('#film-dialog').evaluate(el=>el.classList.contains('is-open')&&!el.classList.contains('is-closing')),true,'reopen cancels stale close');
    await page.mouse.click(1,1);await closed();assert.equal(await page.locator('#full-film').getAttribute('src'),null);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);
    console.log(`${width}: animated player open/close, poster, controls, seek, mute, focus, backdrop, source release and close/reopen PASS`);
    await page.close();
  }
  const page=await browser.newPage({reducedMotion:'reduce',viewport:{width:390,height:844}});
  await page.goto(base+'/services/creative-directing.html');
  await page.locator('.film .film-open').first().click();
  await page.evaluate(()=>document.fonts.ready);
  const glyphs=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=60;
    const ctx=canvas.getContext('2d');
    const draw=(font,text)=>{ctx.clearRect(0,0,600,60);ctx.font=`32px ${font}`;ctx.fillText(text,0,40);return canvas.toDataURL();};
    return {digits:draw('Madani, ABCDiatype','0123456789'),fallbackDigits:draw('ABCDiatype','0123456789'),letters:draw('Madani, ABCDiatype','PLAY MUTE'),fallbackLetters:draw('ABCDiatype','PLAY MUTE')};
  });
  assert.equal(glyphs.digits,glyphs.fallbackDigits,'demo-font digit marks must fall back to readable numerals');
  assert.notEqual(glyphs.letters,glyphs.fallbackLetters,'button letters must retain the original Madani font');
  assert.equal(await page.locator('#film-dialog').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#film-dialog').evaluate(el=>el.open),false);
  console.log('Reduced motion: immediate player open/close, readable films PASS');
  await page.close();
} finally {await browser.close();}
