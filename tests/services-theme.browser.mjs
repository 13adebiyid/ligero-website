import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('@playwright/test');
const base=process.env.LIGERO_PREVIEW||'http://127.0.0.1:4325';
const evidence=process.env.LIGERO_EVIDENCE;
if(evidence) await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
async function ready(page){
  await page.waitForFunction(()=>{
    const doc=document.querySelector('#services-gallery')?.contentDocument;
    const folio=doc?.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
    return folio?.cards.length===6 && folio.cards.every(card=>card.landed);
  });
}
async function pixels(page){
  return page.evaluate(()=>{
    const doc=document.querySelector('#services-gallery').contentDocument;
    const folio=doc.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$folio;
    const core=folio.core, gl=core.renderer.getContext();
    core.wake();core.tick();
    const pixel=new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth/2),gl.drawingBufferHeight-5,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    return {theme:doc.documentElement.dataset.theme,sky:[...pixel].slice(0,3),floor:folio.ground.material.uniforms.u_c0.value.toArray(),reflect:core.reflectOn};
  });
}
try {
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    try {
      await page.goto(base+'/services/',{waitUntil:'domcontentloaded'});
      await ready(page);
      for(const theme of ['white','black','white']){
        await page.locator(`[data-theme-choice="${theme}"]`).click();
        await page.waitForFunction(expected=>document.querySelector('#services-gallery')?.contentDocument?.documentElement.dataset.theme===expected,theme);
        const state=await pixels(page), value=theme==='white'?255:0;
        assert.deepEqual(state.sky,[value,value,value],`${width} ${theme}: WebGL background must follow the theme`);
        assert.deepEqual(state.floor,[value/255,value/255,value/255],`${width} ${theme}: floor must follow the theme`);
        if(width===1440){
          const reflection=await page.evaluate(()=>{
            const doc=document.querySelector('#services-gallery').contentDocument;
            const folio=doc.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$folio;
            const core=folio.core,gl=core.renderer.getContext(),uniform=folio.ground.material.uniforms.u_reflA;
            const tick=core.onTick, strength=uniform.value;
            core.onTick=null;
            const capture=()=>{core.wake();core.tick();const data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
            try {
              const withReflection=capture();uniform.value=0;const withoutReflection=capture();
              let changed=0,colour=0;
              for(let i=0;i<withReflection.length/2;i+=4){
                if(Math.max(...[0,1,2].map(c=>Math.abs(withReflection[i+c]-withoutReflection[i+c])))>2){
                  changed++;
                  const rgb=[...withReflection.slice(i,i+3)];
                  if(Math.max(...rgb)-Math.min(...rgb)>2)colour++;
                }
              }
              return {strength,changed,colour};
            } finally {uniform.value=strength;core.onTick=tick;core.wake();core.tick();}
          });
          assert.ok(reflection.strength>0,'desktop reflections remain enabled');
          assert.ok(reflection.changed>100,`${theme}: reflection must visibly affect floor pixels: ${JSON.stringify(reflection)}`);
          assert.ok(reflection.colour>100,`${theme}: reflections retain the cards’ colour: ${JSON.stringify(reflection)}`);
          console.log(theme,'reflections',reflection);
        }
        await page.evaluate(()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
        if(evidence)await page.screenshot({path:`${evidence}/services-${theme}-${width}.png`});
      }
      await page.reload({waitUntil:'domcontentloaded'});await ready(page);
      assert.deepEqual((await pixels(page)).sky,[255,255,255],'saved light theme must also initialize the renderer');
      assert.equal(await page.locator('.hamburger-menu').isVisible(),width<=768);
      assert.equal(await page.locator('.nav-menu').isVisible(),width>768);
      assert.deepEqual(errors,[]);
      console.log(`${width}: white/black/white GPU background and floor; saved light reload; navigation PASS`);
    } finally {await page.close();}
  }
} finally {await browser.close();}
