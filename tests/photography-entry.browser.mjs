import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('@playwright/test');
const base=process.env.LIGERO_PREVIEW||'http://127.0.0.1:4325';
const evidence=process.env.LIGERO_EVIDENCE;
if(evidence)await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900}});
    try {
      await page.goto(base+'/services/photography.html',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.documentElement.dataset.photoPhase==='intro');
      await page.evaluate(()=>{
        window.entranceAnimations=document.getAnimations().filter(animation=>animation.effect.target.closest('#photographs'));
        for(const animation of window.entranceAnimations)animation.pause();
      });
      const samples=[];
      for(const time of [2300,2600,2900,2999]){
        const state=await page.evaluate(time=>{
          for(const animation of window.entranceAnimations)animation.currentTime=time;
          const intro=document.querySelector('.intro-grid');
          const grid=document.querySelector('.photo-grid:not(.intro-grid)');
          const rect=grid.firstElementChild.getBoundingClientRect();
          return {time,opacity:Number(getComputedStyle(intro).opacity),top:rect.top,left:rect.left,mark:!!document.querySelector('.intro-mark'),visibleClones:[...intro.children].filter(card=>{const r=card.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}).length};
        },time);
        samples.push(state);
        if(evidence&&(time===2600||time===2999))await page.screenshot({path:`${evidence}/entry-${width}-${time}.png`});
      }
      console.log(width,'entrance samples',samples);
      assert.equal(samples[0].opacity,1,'scrolling photo entrance remains visible before the final fade');
      assert.ok(samples[1].opacity>samples[2].opacity&&samples[2].opacity>samples[3].opacity,'temporary pictures must gently fade, not disappear at cleanup');
      assert.ok(samples[3].opacity<.01,'temporary pictures must be invisible before they are removed');
      assert.equal(samples[0].mark,false,'remove the large animated logo, not the normal header logo');
      await page.evaluate(()=>{for(const animation of window.entranceAnimations)animation.finish();});
      await page.waitForFunction(()=>document.documentElement.dataset.photoPhase==='ready');
      const settled=await page.locator('.photo-grid > .photo-card').first().boundingBox();
      assert.ok(Math.abs(settled.y-samples.at(-1).top)<1,'live gallery must not jump when the intro is cleaned up');
      assert.equal(await page.locator('.intro-grid').count(),0);
      assert.equal(await page.locator('.photo-grid').getAttribute('inert'),null);
      assert.equal(await page.locator('.photo-header .logo').innerText(),'LIGERO');
      assert.equal(await page.locator('.photo-card').count(),40);
      if(evidence)await page.screenshot({path:`${evidence}/entry-${width}-ready.png`});
      console.log(`${width}: no large logo; continuous exit fade; stable live-gallery handoff PASS`);
    } finally {await page.close();}
  }
} finally {await browser.close();}
