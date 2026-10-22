import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const {chromium} = require('@playwright/test');
const base = process.env.LIGERO_PREVIEW || 'http://127.0.0.1:4325';
const output = process.env.LIGERO_EVIDENCE;
if (output) await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
async function styleOf(locator) {
  return locator.evaluate(el => {
    const css = pseudo => getComputedStyle(el,pseudo);
    return {width:css('::-webkit-scrollbar').width,track:css('::-webkit-scrollbar-track').backgroundColor,
      thumb:css('::-webkit-scrollbar-thumb').backgroundColor,radius:css('::-webkit-scrollbar-thumb').borderRadius,
      overflow:css().overflowY,room:el.scrollHeight-el.clientHeight};
  });
}
async function minimal(locator) {
  const style = await styleOf(locator);
  assert.equal(style.width,'8px','scrollbar must be a narrow native control, not the default strip');
  assert.equal(style.track,'rgba(0, 0, 0, 0)','scroll track must not paint a white strip');
  assert.equal(style.thumb,'rgba(0, 0, 0, 0)','thumb is invisible until scrolling');
  assert.equal(style.radius,'999px');
}
async function capture(page,name) {
  if (output) await page.screenshot({path:`${output}/${name}.png`});
}
try {
  const page = await browser.newPage({viewport:{width:1280,height:600},reducedMotion:'reduce'});
  await page.goto(base+'/policies/');
  await page.locator('.page-transition').waitFor({state:'detached'});
  await page.evaluate(()=>document.fonts.ready);
  await page.mouse.click(700,450);
  await capture(page,'policies-dark');
  console.log('page scrollbar:',await styleOf(page.locator('html')));
  await minimal(page.locator('html'));
  assert.ok((await styleOf(page.locator('html'))).room>0,'real policy page must overflow');
  await page.mouse.move(700,450);await page.mouse.wheel(0,450);
  await page.waitForFunction(()=>scrollY>0);
  await page.waitForFunction(()=>document.documentElement.classList.contains('scroll-active'));
  assert.ok(['rgb(119, 119, 119)','rgb(136, 136, 136)'].includes((await styleOf(page.locator('html'))).thumb));
  await page.waitForFunction(()=>!document.documentElement.classList.contains('scroll-active'),null,{timeout:5000});
  await minimal(page.locator('html'));
  await page.keyboard.press('Home');await page.waitForFunction(()=>scrollY===0);
  await page.locator('.policies-title').click();
  await page.keyboard.press('PageDown');await page.waitForFunction(()=>scrollY>0,null,{timeout:5000});
  await page.evaluate(()=>window.setTheme('white'));
  await page.waitForFunction(()=>!document.documentElement.classList.contains('scroll-active'));
  await minimal(page.locator('html'));await capture(page,'policies-light');
  await page.emulateMedia({forcedColors:'active'});
  assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).scrollbarColor),'auto');
  assert.notEqual((await styleOf(page.locator('html'))).width,'8px','high contrast retains OS scrollbar size');
  await page.emulateMedia({forcedColors:'none'});
  console.log('dark/light pages: wheel + keyboard scroll and native high-contrast defaults PASS');
  await page.goto(base+'/services/creative-directing.html');
  await page.waitForFunction(()=>document.documentElement.dataset.phase==='fallback');
  await minimal(page.locator('html'));
  await page.locator('.film .film-open').first().click();
  await page.waitForFunction(()=>document.querySelector('#film-dialog').open);
  await page.evaluate(()=>document.fonts.ready);
  const dialog=page.locator('#film-dialog');await minimal(dialog);
  assert.ok((await styleOf(dialog)).room>0,'short desktop must exercise actual dialog overflow');
  await page.mouse.move(1000,400);await page.mouse.wheel(0,400);
  await page.waitForFunction(()=>document.querySelector('#film-dialog').scrollTop>0);
  await page.waitForFunction(()=>document.documentElement.classList.contains('scroll-active'));
  assert.ok(['rgb(119, 119, 119)','rgb(136, 136, 136)'].includes((await styleOf(dialog)).thumb));
  await page.waitForFunction(()=>!document.documentElement.classList.contains('scroll-active'),null,{timeout:5000});
  await minimal(dialog);
  await capture(page,'film-dialog');
  await page.keyboard.press('Escape');
  assert.equal(await dialog.evaluate(el=>el.open),false);
  console.log('Creative readable page + scrollable film dialog + Escape PASS');
  await page.setViewportSize({width:390,height:600});
  await page.goto(base+'/services/gallery/?view=readable');
  const readable=page.locator('#readable');await minimal(readable);
  assert.ok((await styleOf(readable)).room>0);
  await page.mouse.move(200,400);await page.mouse.wheel(0,400);
  await page.waitForFunction(()=>document.querySelector('#readable').scrollTop>0);
  await page.waitForFunction(()=>document.documentElement.classList.contains('scroll-active'));
  assert.ok(['rgb(119, 119, 119)','rgb(136, 136, 136)'].includes((await styleOf(readable)).thumb));
  await page.waitForFunction(()=>!document.documentElement.classList.contains('scroll-active'),null,{timeout:5000});
  await minimal(readable);
  await capture(page,'gallery-mobile');
  console.log('mobile-width readable Services gallery scrollbar + scrolling PASS');
  await page.close();
} finally {await browser.close();}
