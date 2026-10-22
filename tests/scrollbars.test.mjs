import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>readFileSync(path.join(root,file),'utf8');
function usesScrollbars(file,seen=new Set()) {
  if(file==='css/scrollbars.css')return true;
  if(seen.has(file))return false;
  seen.add(file);
  const content=read(file);
  const links=file.endsWith('.html')?[...content.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]:[...content.matchAll(/@import\s+url\(["']([^"']+)["']\)/g)];
  return links.some(([,url])=>usesScrollbars(url.startsWith('/')?url.slice(1):path.join(path.dirname(file),url),seen));
}
test('every styled Ligero document reaches the single shared scrollbar treatment',()=>{
  const files=readdirSync(root,{recursive:true}).filter(file=>file.endsWith('.html')&&!file.startsWith('.git'));
  const styled=files.filter(file=>read(file).includes('rel="stylesheet"'));
  for(const file of ['index.html','services/creative-directing.html','services/gallery/index.html'])assert.ok(styled.some(entry=>entry.replaceAll('\\','/')===file));
  for(const file of styled)assert.ok(usesScrollbars(file),file);
});
test('scrollbar styling preserves native scrolling and removes the old carousel override',()=>{
  const css=read('css/scrollbars.css');
  assert.match(css,/@media \(forced-colors: none\)/);
  assert.match(css,/@supports not selector\(::-webkit-scrollbar\)/);
  assert.match(css,/html\.scroll-active/);
  assert.match(css,/scrollbar-color: transparent transparent/);
  assert.match(css,/background: transparent/);
  assert.match(css,/scrollbar-width: thin/);
  assert.doesNotMatch(css,/overflow:|scroll-behavior:|touch-action:|scrollbar-width: none/);
  assert.doesNotMatch(read('css/styles.css'),/::-webkit-scrollbar/);
});

test('shared controller activates only on real scroll and is loaded on every page',()=>{
  const controller=read('js/scrollbars.js');
  assert.match(controller,/addEventListener\('scroll'/);
  assert.match(controller,/scroll-active/);
  assert.match(read('js/page-transitions.js'),/scrollbars\.js/);
  assert.match(read('services/gallery/gallery.js'),/scrollbars\.js/);
});
