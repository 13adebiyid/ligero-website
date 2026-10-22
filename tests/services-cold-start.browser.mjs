import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('@playwright/test');
const base=process.env.LIGERO_PREVIEW||'http://127.0.0.1:4325';
const output=process.env.LIGERO_EVIDENCE;
if(output)await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const failures=[];
async function check(name,run){try{await run();console.log(name+' PASS');}catch(error){failures.push(name+': '+error.message);console.error(name,error);}}
function holdArrival(theme) {
  localStorage.setItem('theme',theme);
  if(window!==window.top)return;
  let release,route;
  const hold=new Promise(resolve=>{release=resolve;});
  window.releaseArrival=()=>{window.arrivalReleased=true;release();};
  Object.defineProperty(window,'ligeroRouteReady',{configurable:true,get:()=>route,set:value=>{route=Promise.all([value,hold]);}});
}
async function heldArrival(width,theme) {
  const context=await browser.newContext({viewport:{width,height:900}});
  try {
    await context.addInitScript(holdArrival,theme);
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/services/',{waitUntil:'domcontentloaded'});
    const frame=await(await page.locator('#services-gallery').elementHandle()).contentFrame();
    await frame.waitForFunction(()=>document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio?.core.shaderReady===true,null,{timeout:15000});
    const pending=await frame.evaluate(async()=>{
      const gallery=document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$folio;
      let released=false;gallery.booted.then(()=>{released=true;});
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {released,cards:gallery.cards.length,texts:gallery.texts.length,programs:gallery.core.renderer.info.programs.length};
    });
    assert.equal(pending.released,false,'preparation must not consume the entrance behind the page fade');
    assert.equal(pending.cards,0);assert.equal(pending.texts,0);assert.ok(pending.programs>0);
    assert.equal(await frame.locator('#readable').isVisible(),false);
    await frame.evaluate(()=>{
      window.flightSamples=[];
      const gallery=document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$folio;
      const sample=()=>{
        for(const card of gallery.cards){
          if(card.landed||!gallery.onScreen(card.el.getBoundingClientRect()))continue;
          const target=gallery.cardPose(card.el);
          if(target)window.flightSamples.push({id:card.id,dx:card.mesh.position.x-target.pos.x,dy:card.mesh.position.y-target.pos.y});
        }
        if(!gallery.cards.length||gallery.cards.some(card=>!card.landed))requestAnimationFrame(sample);
      };requestAnimationFrame(sample);
    });
    await page.evaluate(()=>window.releaseArrival());
    await frame.waitForFunction(()=>{
      const gallery=document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
      return gallery?.cards.length===6&&gallery.cards.every(card=>card.landed);
    });
    const samples=await frame.evaluate(()=>window.flightSamples);
    assert.ok(samples.some(sample=>sample.dx<-.1&&sample.dy>.1),'the original top-left flight must still occur after release');
    const pixels=await frame.evaluate(()=>{
      const gallery=document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$folio;
      const core=gallery.core,gl=core.renderer.getContext();core.wake();core.tick();
      const data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);
      let colour=0;for(let i=0;i<data.length;i+=4)if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>15)colour++;
      return {colour,total:data.length/4,theme:document.documentElement.dataset.theme};
    });
    assert.equal(pixels.theme,theme);assert.ok(pixels.colour>pixels.total*.03,'real coloured card pixels must be presented');
    assert.deepEqual(errors,[]);
    if(output)await page.screenshot({path:`${output}/arrival-${theme}-${width}.png`});
  } finally {await context.close();}
}
async function failedGlyphs() {
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  try {
    await context.route('**/services/gallery/glyphs/*',route=>route.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/services/gallery/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{
      const gallery=document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
      return gallery?.cards.length===6&&gallery.cards.every(card=>card.landed)&&gallery.texts.length===6;
    });
    const fallback=await page.evaluate(()=>{
      const gallery=document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$folio;
      return gallery.core.shaderReady&&gallery.texts.every(text=>!text.outline&&text.texture?.image.width>0);
    });
    assert.equal(fallback,true,'failed glyph assets retain the real canvas-text fallback');assert.deepEqual(errors,[]);
  } finally {await context.close();}
}
try {
  for(const width of [1440,390])for(const theme of ['black','white'])await check(`held arrival ${width} ${theme}`,()=>heldArrival(width,theme));
  if(process.argv[2]!=='held')await check('standalone failed glyphs',failedGlyphs);
} finally {await browser.close();}
assert.deepEqual(failures,[]);
