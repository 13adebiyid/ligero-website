import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium} = require('@playwright/test');
const base = process.env.LIGERO_PREVIEW || 'http://127.0.0.1:4325';
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  for (const width of [1440,390]) {
    const context = await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});
    try {
      const page = await context.newPage();
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(() => {
        const load=HTMLMediaElement.prototype.load, play=HTMLMediaElement.prototype.play;
        window.siteSpeed={loads:[],plays:[],start:performance.now()};
        document.addEventListener('click', e=>{if(e.target.closest('.video-container-main')) window.siteSpeed.beforeClick=performance.now();},true);
        HTMLMediaElement.prototype.load=function(...args){window.siteSpeed.loads.push({id:this.id,at:performance.now()});return load.apply(this,args);};
        HTMLMediaElement.prototype.play=function(...args){window.siteSpeed.plays.push({id:this.id,at:performance.now()});return play.apply(this,args);};
      });
      const responses=[];page.on('response',response=>{if(response.status()>=400&&response.url().startsWith(base))responses.push(response.url());});
      const member='/members/ifeoluwa-segun-oludimu.html';
      await page.goto(base+member,{waitUntil:'domcontentloaded'});
      assert.equal(await page.locator('.page-transition').count(),0,'member content must not wait behind a generic logo');
      await page.waitForFunction(()=>document.querySelector('.designer-hero .hero-image')?.complete);
      assert.equal(await page.locator('.designer-hero .hero-image').evaluate(img=>img.naturalWidth>0),true);
      assert.equal(await page.locator('.feed-video').count(),3);
      const idle=await page.evaluate(()=>({loads:window.siteSpeed.loads.filter(item=>item.id.endsWith('-video')),plays:window.siteSpeed.plays.filter(item=>item.id.endsWith('-video')),requests:performance.getEntriesByType('resource').filter(item=>item.name.includes('Preview.mp4'))}));
      assert.equal(idle.loads.length,0,'offscreen previews must not be explicitly loaded');
      assert.equal(idle.plays.length,0,'offscreen previews must not play');
      assert.equal(idle.requests.length,0,'offscreen previews must not request bytes');
      await page.locator('#gift-video').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.querySelector('#gift-video').currentTime>0);
      assert.equal(await page.locator('#fashion-video').evaluate(v=>v.paused),true);
      await page.locator('.video-container-main').first().click();
      await page.waitForFunction(()=>document.querySelector('#videoModal').classList.contains('active'));
      const opened=await page.evaluate(()=>({delay:window.siteSpeed.plays.findLast(p=>p.id==='modalVideo')?.at-window.siteSpeed.beforeClick,
        paused:document.querySelector('#gift-video').paused,src:document.querySelector('#modalVideo').getAttribute('src')}));
      assert.ok(opened.delay>=0&&opened.delay<150,`full film playback started ${opened.delay}ms after click`);
      assert.equal(opened.paused,true,'opening the full film pauses preview decoding');
      assert.equal(opened.src,'/videos/gift.mp4');
      await page.locator('#videoModal .modal-close').click();
      assert.equal(await page.locator('#modalVideo').evaluate(v=>v.hasAttribute('src')),false);
      assert.equal(await page.locator('#modalVideo').evaluate(v=>v.paused),true);
      const afterClose=await page.evaluate(()=>window.siteSpeed.plays.filter(p=>p.id==='modalVideo').length);
      await page.waitForTimeout(260);
      assert.equal(await page.evaluate(()=>window.siteSpeed.plays.filter(p=>p.id==='modalVideo').length),afterClose,'close cannot cause delayed replay');
      await page.goto(base+'/contact/',{waitUntil:'domcontentloaded'});
      assert.equal(await page.locator('.page-transition').count(),0,'first-load overlay must not block contact page');
      assert.equal(await page.locator('.modern-contact-page').isVisible(),true);
      await page.goto(base+'/',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelector('#bgVideo')?.readyState>=2);
      await page.locator('#playPauseBtn').click();
      const paused=await page.locator('#bgVideo').evaluate(v=>v.paused);
      assert.equal(paused,true,'manual pause must work');
      await page.locator('#muteBtn').click();
      assert.equal(await page.locator('#bgVideo').evaluate(v=>v.muted),false);
      await page.evaluate(()=>document.querySelector('.home-page').dispatchEvent(new MouseEvent('click',{bubbles:true})));
      assert.equal(await page.locator('#bgVideo').evaluate(v=>v.paused),true,'unrelated clicks must not restart manually paused film');
      await page.locator('#playPauseBtn').click();
      assert.equal(await page.locator('#bgVideo').evaluate(v=>v.paused),false);
      assert.deepEqual(errors,[]);
      const changed=responses.filter(url=>/Preview\.mp4|jacket-|hero-/.test(url));
      assert.deepEqual(changed,[],'changed media paths must resolve with correct case');
      console.log(`${width}: no offscreen video requests, visible feed and immediate modal, source release, contact ready, home pause/mute PASS`);
    } finally {await context.close();}
  }
} finally {await browser.close();}
