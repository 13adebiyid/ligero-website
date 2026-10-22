import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url);
const {chromium}=require('@playwright/test');
const base=process.env.LIGERO_PREVIEW||'http://127.0.0.1:4325';
const evidence=process.env.LIGERO_EVIDENCE;
if(evidence)await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const urls=['/','/shop/','/services/','/services/gallery/?view=readable','/contact/','/policies/','/form.html','/services/models.html','/services/music/','/services/music/producers.html','/services/music/songwriters.html','/services/styling.html','/members/ashleigh-cooper-creative-director.html','/members/ifeoluwa-segun-oludimu.html','/services/creative-directing.html','/services/set-designing.html','/services/photography.html','/services/photography/photo-1.html'];
const typography={
 '/contact/':['.form-group input','.form-group .numbers'],
 '/form.html':['.questionnaire-form','.numbers'],
 '/policies/':['.number'],
 '/services/music/producers.html':['.artist-name','.bpm','.player-info','.progress-container'],
 '/members/ashleigh-cooper-creative-director.html':['.modal-title'],
 '/members/ifeoluwa-segun-oludimu.html':['.image-title','.modal-title'],
};
async function settled(page){
 await page.evaluate(()=>window.ligeroRouteReady);
 await page.evaluate(()=>document.fonts.ready);
}
try {
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390,reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const url of urls){
   const response=await page.goto(base+url,{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200,url);
   await page.locator('[data-theme-choice="white"]').waitFor({state:'visible'});
   assert.equal(await page.locator('.theme-switcher').count(),1,url);
   if(typography[url]) await page.evaluate(()=>document.fonts.ready);
   for(const selector of typography[url]||[]){
    const family=await page.locator(selector).first().evaluate(el=>getComputedStyle(el).fontFamily);
    assert.match(family,/^"?Madani\b/,`${url} ${selector} must use Madani, got ${family}`);
   }
   if(url==='/services/'){
    await page.waitForFunction(()=>document.querySelector('#services-gallery')?.contentDocument?.readyState==='complete');
    assert.equal(await page.frameLocator('#services-gallery').locator('.theme-switcher').count(),0,'embedded gallery must not overlay the parent theme control');
   }
   for(const theme of ['white','black']){
    await page.locator(`[data-theme-choice="${theme}"]`).click();
    const state=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,body:getComputedStyle(document.body).backgroundColor,saved:localStorage.getItem('theme'),white:document.body.classList.contains('white-theme'),pressed:document.querySelector('[data-theme-choice][aria-pressed="true"]')?.dataset.themeChoice}));
    assert.equal(state.theme,theme,url);assert.equal(state.saved,theme,url);assert.equal(state.pressed,theme,url);
    assert.equal(state.white,theme==='white',url);
    assert.equal(state.body,theme==='white'?'rgb(255, 255, 255)':'rgb(0, 0, 0)',url);
   }
  }
  await page.goto(base+'/services/photography.html');await settled(page);
  assert.equal(await page.locator('.menu-toggle').isVisible(),width<=768);
  assert.equal(await page.locator('#customCursor').count(),0);
  await page.locator('[data-theme-choice="white"]').click();
  if(evidence)await page.screenshot({path:`${evidence}/photo-gallery-light-${width}.png`});
  await page.locator('[data-theme-choice="black"]').click();
  if(evidence)await page.screenshot({path:`${evidence}/photo-gallery-dark-${width}.png`});
  await page.locator('.photo-link').first().click();await page.waitForURL('**/photo-1.html');await settled(page);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'black');
  assert.ok((await page.locator('.photo-information h1').evaluate(el=>getComputedStyle(el).fontFamily)).startsWith('Madani'));
  assert.equal(await page.locator('.menu-toggle').isVisible(),width<=768);
  if(evidence)await page.screenshot({path:`${evidence}/photo-detail-dark-${width}.png`});
  await page.locator('[data-theme-choice="white"]').click();
  await page.reload();await settled(page);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'white');
  if(evidence)await page.screenshot({path:`${evidence}/photo-detail-light-${width}.png`});
  await page.locator('.back-link').click();await page.waitForURL('**/photography.html');await settled(page);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'white');
  assert.deepEqual(errors,[]);
  console.log(width+' all public page themes, one control, desktop/mobile nav, Madani, native cursor, route/reload persistence PASS');
  await context.close();
 }
 const blocked=await browser.newPage({reducedMotion:'reduce'});
 await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('storage blocked');}});});
 await blocked.goto(base+'/services/photography.html');
 await blocked.locator('[data-theme-choice="white"]').click();
 assert.equal(await blocked.evaluate(()=>document.documentElement.dataset.theme),'white');
 await blocked.close();
 console.log('blocked storage still allows local theme switch PASS');
} finally {await browser.close();}
