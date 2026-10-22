import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium} = require('@playwright/test');
const {PNG} = require('playwright-core/lib/utilsBundle');
const base = process.env.LIGERO_PREVIEW || 'http://127.0.0.1:4325';
const output = process.env.LIGERO_EVIDENCE;
if (output) await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:process.env.LIGERO_BROWSER || 'msedge',headless:true});
const failures = [];
async function check(name, run) {
  try {await run();console.log(name+' PASS');}
  catch (error) {failures.push(name+': '+error.message);console.error(name, error);}
}
try {
  for (const width of [1440,390]) await check(`home pixels ${width}`, async () => {
    const page = await browser.newPage({viewport:{width,height:900}});
    try {
      await page.goto(base+'/', {waitUntil:'domcontentloaded'});
      await page.locator('.page-transition').waitFor({state:'detached'});
      await page.waitForFunction(() => document.querySelector('#bgVideo')?.readyState>=2);
      await page.evaluate(async () => {
        const video = document.querySelector('#bgVideo');video.pause();
        await new Promise(resolve => {video.addEventListener('seeked',resolve,{once:true});video.currentTime=3;});
      });
      for (const theme of ['black','white']) {
        await page.locator(`[data-theme-choice="${theme}"]`).click();
        const clip = {x:20,y:250,width:width-40,height:120};
        const visible = PNG.sync.read(await page.screenshot({clip}));
        let light=0,dark=0;
        for (let i=0;i<visible.data.length;i+=4) {
          const luminance=(visible.data[i]+visible.data[i+1]+visible.data[i+2])/3;
          if (luminance>100) light++;
          if (luminance<35) dark++;
        }
        assert.ok(light>visible.width*visible.height*.05 && dark>visible.width*visible.height*.15,
          `${theme}: film must visibly include light and dark pixels (${light} light, ${dark} dark)`);
        assert.equal(await page.locator('#playPauseBtn').isVisible(),true);
        assert.equal(await page.locator('.choose-button').isVisible(),true);
        if (output) await page.screenshot({path:`${output}/home-${theme}-${width}.png`});
      }
    } finally {await page.close();}
  });
  for (const mode of (process.argv[2] ? [process.argv[2]] : ['normal','no-parallel','canvas-text'])) await check(`Services warmup ${mode}`,async () => {
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    try {
      await context.addInitScript(mode => {
        window.shaderLinks=[];
        const prototype=WebGL2RenderingContext.prototype;
        const extension=prototype.getExtension,link=prototype.linkProgram,source=prototype.shaderSource,attach=prototype.attachShader;
        const shaders=new WeakMap(),programs=new WeakMap();
        prototype.shaderSource=function(shader,text){shaders.set(shader,text);return source.call(this,shader,text);};
        prototype.attachShader=function(program,shader){if(!programs.has(program))programs.set(program,[]);programs.get(program).push(shaders.get(shader));return attach.call(this,program,shader);};
        prototype.getExtension=function(name){return mode==='no-parallel' && name==='KHR_parallel_shader_compile' ? null : extension.call(this,name);};
        prototype.linkProgram=function(program){
          const gallery=document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
          window.shaderLinks.push({at:performance.now(),ready:gallery?.core.shaderReady===true,sources:programs.get(program)});
          return link.call(this,program);
        };
      },mode);
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base+'/services/gallery/'+(mode==='canvas-text'?'?gltext=canvas':''),{waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => {
        const gallery=document.querySelector('#__nuxt')?.__vue_app__?.config.globalProperties.$nuxt?.$folio;
        return gallery?.cards.length===6 && gallery.cards.every(card=>card.landed);
      });
      const state=await page.evaluate(() => {
        const gallery=document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$nuxt.$folio;
        return {ready:gallery.core.shaderReady,links:window.shaderLinks,debug:gallery.core.renderer.debug.checkShaderErrors,programs:gallery.core.renderer.info.programs.length};
      });
      assert.equal(state.ready,true,'first-flight rendering must have an explicit shader-readiness barrier');
      assert.ok(state.links.length>0,'real GPU programs must be linked');
      if(state.links.some(link=>link.ready)) {const late=state.links.find(link=>link.ready); console.log('shader variants',JSON.stringify(state.links.map(link=>({ready:link.ready,lengths:link.sources?.map(text=>text.length),matchesLate:link.sources?.map((text,i)=>text===late.sources?.[i]),firstDifference:(()=>{const a=link.sources?.[0],b=late.sources?.[0];if(!a||!b||Math.abs(a.length-b.length)>50)return null;let j=0;while(j<Math.min(a.length,b.length)&&a[j]===b[j])j++;return {at:j,old:a.slice(Math.max(0,j-60),j+120),late:b.slice(Math.max(0,j-60),j+120)};})()}))));}
      assert.deepEqual(state.links.filter(link=>link.ready),[],'no first-use shader linking after the flight is released');
      assert.equal(state.debug,true,'shader errors must remain checked');
      assert.deepEqual(errors,[]);
      console.log(mode,JSON.stringify(state));
    } finally {await context.close();}
  });
} finally {await browser.close();}
assert.deepEqual(failures,[]);
