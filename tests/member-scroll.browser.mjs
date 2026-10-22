import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium} = require('@playwright/test');
const {PNG} = require('playwright-core/lib/utilsBundle');
const base = process.env.LIGERO_PREVIEW || 'http://127.0.0.1:4325';
const output = process.env.LIGERO_EVIDENCE;
const before = process.env.LIGERO_MEMBER_BASELINE;
const requested=process.argv[2];
const routes = {ashleigh:'ashleigh-cooper-creative-director', ife:'ifeoluwa-segun-oludimu'};
if (output) await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const failures = [], results = [];
async function check(name, run) {
  try { await run(); console.log(name + ' PASS'); }
  catch (error) { failures.push(name + ': ' + error.message); console.error(name, error); }
}
async function settled(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished));
  });
}
async function stillDensity(page) {
  const items = page.locator('.feed-item[data-image]'), selected = [];
  for (let i=0; i<await items.count(); i++) {
    const item=items.nth(i), image=item.locator('img');
    await item.scrollIntoViewIfNeeded();
    const reserved=await item.boundingBox();
    await image.evaluate(img => img.decode());
    assert.deepEqual(await item.boundingBox(),reserved,'image decode must not shift its tile');
    const info = await image.evaluate(img => {
      const candidates=img.srcset.split(',').map(s => s.trim().split(/\s+/)).map(([url,w]) => ({url:new URL(url,location.href).href,width:parseInt(w)}));
      const chosen=candidates.find(c => c.url===img.currentSrc), original=img.closest('[data-image]').dataset.image;
      const width=Number(img.getAttribute('width')), height=Number(img.getAttribute('height'));
      return {src:img.currentSrc,original,chosen:chosen?.width,originalWidth:width,
        demand:Math.max(img.clientWidth,img.clientHeight*width/height)*1.02*1.02*devicePixelRatio,
        width:img.clientWidth,height:img.clientHeight,decoding:img.decoding,complete:img.complete};
    });
    assert.ok(info.chosen, 'selected source belongs to srcset');
    assert.ok(info.chosen+2>=info.demand || info.chosen===info.originalWidth, JSON.stringify(info));
    assert.equal(info.decoding,'async');
    selected.push(info);
  }
  return selected;
}
async function mediaPixels(page, video) {
  await video.evaluate(async v => {
    v.pause();
    await new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=2;});
  });
  const oldTransition=await video.evaluate(v=>{const previous=[v.style.getPropertyValue('transition'),v.style.getPropertyPriority('transition')];v.style.setProperty('transition','none','important');return previous;});
  const rect=await video.boundingBox();
  const clip={x:Math.max(0,rect.x+rect.width*.2),y:Math.max(100,rect.y+rect.height*.2),width:Math.min(140,rect.width*.4),height:Math.min(100,rect.height*.4)};
  const visible=PNG.sync.read(await page.screenshot({clip}));
  await video.evaluate(v => {v.style.visibility='hidden';});
  assert.equal(await video.evaluate(v=>getComputedStyle(v).visibility),'hidden','comparison must actually hide the video');
  const hidden=PNG.sync.read(await page.screenshot({clip}));
  await video.evaluate((v,previous) => {v.style.visibility='';if(previous[0])v.style.setProperty('transition',...previous);else v.style.removeProperty('transition');},oldTransition);
  let changed=0;
  for (let i=0;i<visible.data.length;i+=4) if (Math.abs(visible.data[i]-hidden.data[i])+Math.abs(visible.data[i+1]-hidden.data[i+1])+Math.abs(visible.data[i+2]-hidden.data[i+2])>18) changed++;
  if(output && changed<=visible.width*visible.height*.05){
    await writeFile(`${output}/pixel-visible.png`,PNG.sync.write(visible));
    await writeFile(`${output}/pixel-hidden.png`,PNG.sync.write(hidden));
    await page.screenshot({path:`${output}/pixel-page.png`});
  }
  assert.ok(changed>visible.width*visible.height*.05,`decoded preview must actually paint visible pixels: ${changed}/${visible.width*visible.height}, ${JSON.stringify(rect)}`);
}
async function entryAndLayers(page) {
  const state=await page.evaluate(() => {
    const entries=[document.querySelector('.page-fade-in'),document.querySelector('.video-section')];
    return {entries:entries.map(el => ({animations:el.getAnimations().length,transform:getComputedStyle(el).transform,opacity:getComputedStyle(el).opacity})),
      hints:[...document.querySelectorAll('.video-container-main,.video-metadata *')].map(el=>getComputedStyle(el).willChange),
      fixed:[...document.querySelector('.page-fade-in').querySelectorAll('*')].filter(el=>getComputedStyle(el).position==='fixed').length};
  });
  assert.deepEqual(state.entries,[{animations:0,transform:'none',opacity:'1'},{animations:0,transform:'none',opacity:'1'}]);
  assert.ok(state.hints.every(hint=>hint==='auto'),'no permanent member video/metadata layer hints');
  assert.equal(state.fixed,0,'removing the wrapper transform must not move fixed descendants');
  const timing=await page.evaluate(() => {
    const el=document.querySelector('.page-fade-in');
    el.style.animation='none';void el.offsetWidth;el.style.removeProperty('animation');
    const animation=el.getAnimations()[0];animation.pause();
    const samples=[0,200,500,800].map(time => {animation.currentTime=time;const s=getComputedStyle(el);return {time,opacity:Number(s.opacity),transform:s.transform};});
    const timing=animation.effect.getTiming();animation.cancel();
    return {timing,samples,easing:getComputedStyle(el).animationTimingFunction};
  });
  assert.equal(timing.timing.duration,600);assert.equal(timing.timing.delay,200);assert.equal(timing.easing,'ease-out');
  assert.equal(timing.samples[0].opacity,0);assert.equal(timing.samples[1].opacity,0);
  assert.ok(timing.samples[2].opacity>0&&timing.samples[2].opacity<1);assert.equal(timing.samples[3].opacity,1);
}
try {
  for (const [name,route] of Object.entries(routes).filter(([name])=>!requested||requested===name)) for (const width of [1440,390]) for (const theme of ['black','white']) {
    await check(`${name} ${width} ${theme}`, async () => {
      const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1.5,hasTouch:width===390,isMobile:width===390});
      try {
        await context.addInitScript(theme => {
          localStorage.setItem('theme',theme);
          window.memberWrites={seeks:[],pauses:[]};
          const time=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime'), pause=HTMLMediaElement.prototype.pause;
          Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{...time,set(value){if(this.matches('.feed-video'))window.memberWrites.seeks.push({id:this.id,from:time.get.call(this),to:value});time.set.call(this,value);}});
          HTMLMediaElement.prototype.pause=function(...args){if(this.matches('.feed-video'))window.memberWrites.pauses.push({id:this.id,paused:this.paused});return pause.apply(this,args);};
        },theme);
        const page=await context.newPage(), errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        if (before) for (const file of ['css/styles.css','js/script.js']) await page.route('**/'+file,route=>route.fulfill({path:before+'/'+file}));
        await page.goto(`${base}/members/${route}.html`,{waitUntil:'load'});await settled(page);
        await page.locator('.designer-hero img').evaluate(img=>img.decode());
        await entryAndLayers(page);
        const idle=await page.evaluate(()=>{window.memberWrites.seeks=[];window.memberWrites.pauses=[];for(let i=0;i<3;i++)window.syncFeedVideos();return window.memberWrites;});
        assert.deepEqual(idle,{seeks:[],pauses:[]});
        if(output)await page.screenshot({path:`${output}/${name}-${width}-${theme}-hero.png`});
        const videos=page.locator('.feed-video');
        assert.equal(await videos.count(),name==='ashleigh'?4:3);
        for(let i=0;i<await videos.count();i++) {
          const video=videos.nth(i);await video.scrollIntoViewIfNeeded();
          await page.waitForFunction(id=>{const v=document.getElementById(id);return v.currentTime>0&&!v.paused;},await video.getAttribute('id'));
          assert.ok(await video.evaluate(v=>v.videoWidth>0&&v.readyState>=2));
          if(i===0)await mediaPixels(page,video);
          const container=video.locator('..'), full=await container.getAttribute('data-video');
          await container.click();await page.locator('#videoModal.active').waitFor();
          assert.equal(await page.locator('#modalVideo').getAttribute('src'),full);
          assert.equal(await video.evaluate(v=>v.paused),true);
          await page.locator('#videoModal .modal-close').click();
          assert.equal(await page.locator('#modalVideo').evaluate(v=>v.paused&&!v.hasAttribute('src')),true);
          await page.waitForFunction(id=>!document.getElementById(id).paused,await video.getAttribute('id'));
        }
        const selected=await stillDensity(page);
        const items=page.locator('.feed-item[data-image]');
        for(let i=0;i<await items.count();i++) {
          const item=items.nth(i),original=await item.getAttribute('data-image');
          const expected=await item.locator('img').evaluate(img=>[Number(img.getAttribute('width')),Number(img.getAttribute('height'))]);
          await item.click();await page.locator('#imageModal.active').waitFor();
          await page.locator('#modalImage').evaluate(img=>img.decode());
          assert.equal(await page.locator('#modalImage').getAttribute('src'),original);
          assert.deepEqual(await page.locator('#modalImage').evaluate(img=>[img.naturalWidth,img.naturalHeight]),expected,'modal retains the high-resolution original');
          await page.locator('#imageModal .modal-close').click();
          assert.equal(await page.evaluate(()=>document.body.classList.contains('modal-open')),false);
        }
        await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
        await page.waitForFunction(()=>[...document.querySelectorAll('.feed-video')].every(v=>v.paused&&v.currentTime===0));
        const repeated=await page.evaluate(()=>{window.memberWrites.seeks=[];window.memberWrites.pauses=[];window.syncFeedVideos();window.syncFeedVideos();return window.memberWrites;});
        assert.deepEqual(repeated,{seeks:[],pauses:[]});
        assert.deepEqual(errors,[]);
        results.push({name,width,theme,selected});
      } finally {await context.close();}
    });
  }
  if(!before) {
    for(const [width,dpr] of (requested==='ashleigh'?[]:[[1920,2],[390,3]]))await check(`responsive density ${width} DPR${dpr}`,async()=>{
      const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:dpr});
      try {await page.goto(`${base}/members/${routes.ife}.html`);await settled(page);results.push({width,dpr,selected:await stillDensity(page)});}finally{await page.close();}
    });
    for(const [name,route] of Object.entries(routes).filter(([name])=>!requested||requested===name))await check(`${name} reduced motion + failed media`,async()=>{
      const page=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'});
      try {
        await page.route('**/*Preview.mp4',route=>route.abort());
        await page.route('**/members/media/**',route=>route.abort());
        await page.goto(`${base}/members/${route}.html`);await settled(page);
        assert.equal(await page.locator('.hero-title').isVisible(),true);
        await page.locator('.video-container-main').first().click();
        await page.locator('#videoModal.active').waitFor();
        assert.match(await page.locator('#modalVideo').getAttribute('src'),/^\/videos\/[^/]+\.mp4$/);
        await page.locator('#videoModal .modal-close').click();
        assert.equal(await page.locator('#modalVideo').evaluate(v=>v.paused&&!v.hasAttribute('src')),true);
        if(name==='ife'){
          const item=page.locator('.feed-item[data-image]').first(),original=await item.getAttribute('data-image');
          await item.click();await page.locator('#modalImage').evaluate(img=>img.decode());
          assert.equal(await page.locator('#modalImage').getAttribute('src'),original);
          await page.locator('#imageModal .modal-close').click();
        }
      }finally{await page.close();}
    });
  }
} finally {await browser.close();}
if(output)await writeFile(output+'/'+(requested||'all')+'-results.json',JSON.stringify({results,failures},null,2));
assert.deepEqual(failures,[]);
