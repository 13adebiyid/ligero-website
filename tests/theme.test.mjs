import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../',import.meta.url));
const read = file => readFileSync(path.join(root,file),'utf8');
function theme(initial, blocked = false) {
  const listeners = new Map(), windowListeners = new Map(), choices = [], notices = [], classes = new Set();
  const saved = new Map(initial ? [['theme',initial]] : []);
  const document = {documentElement:{dataset:{},style:{}},body:{classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}},querySelectorAll:selector=>selector==='[data-theme-choice]'?choices:[],addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:event=>notices.push(event)};
  const window = {addEventListener:(name,fn)=>windowListeners.set(name,fn)};
  const storage = {getItem:key=>{if(blocked)throw new Error('denied');return saved.get(key)||null;},setItem:(key,value)=>{if(blocked)throw new Error('denied');saved.set(key,value);}};
  vm.runInNewContext(read('js/theme.js'),{document,window,localStorage:storage,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
  return {document,window,saved,classes,choices,notices,listeners,windowListeners};
}
test('saved light choice is applied before body mount; default and unknown saved choices are dark',()=>{
  assert.equal(theme('white').document.documentElement.dataset.theme,'white');
  for (const saved of [undefined,'invalid'])assert.equal(theme(saved).document.documentElement.dataset.theme,'black');
});
test('switching controls one stored choice, body compatibility, colour scheme and selection state',()=>{
  const page=theme();
  const attributes=new Map();
  page.choices.push({dataset:{themeChoice:'white'},setAttribute:(key,value)=>attributes.set(key,value)});
  page.window.setTheme('white');
  assert.equal(page.saved.get('theme'),'white');
  assert.equal(page.document.documentElement.style.colorScheme,'light');
  assert.ok(page.classes.has('white-theme'));
  assert.equal(attributes.get('aria-pressed'),'true');
  page.window.setTheme('black');
  assert.equal(page.document.documentElement.style.colorScheme,'dark');
  assert.equal(page.classes.has('white-theme'),false);
  assert.equal(attributes.get('aria-pressed'),'false');
});
test('storage refusal does not break the local choice and invalid input cannot become a theme',()=>{
  const page=theme(undefined,true);
  page.window.setTheme('white');
  assert.equal(page.document.documentElement.dataset.theme,'white');
  page.window.setTheme('<script>');
  assert.equal(page.document.documentElement.dataset.theme,'white');
});
test('another tab and bfcache restore resynchronize the same authority',()=>{
  const page=theme('white');
  page.windowListeners.get('storage')({key:'theme',newValue:'black'});
  assert.equal(page.document.documentElement.dataset.theme,'black');
  page.saved.set('theme','white');
  page.windowListeners.get('pageshow')({persisted:true});
  assert.equal(page.document.documentElement.dataset.theme,'white');
});
test('every public HTML page loads the early shared theme and shared control stylesheet',()=>{
  const files=readdirSync(root,{recursive:true}).filter(file=>file.endsWith('.html'));
  for(const file of files) {
    const html=read(file);
    assert.match(html,/<script src="\/js\/theme.js"><\/script>/,file);
    assert.match(html,/href="\/css\/theme.css"/,file);
    assert.ok(html.indexOf('/js/theme.js')<html.indexOf('<body'),file);
  }
  assert.doesNotMatch(read('js/script.js'),/function setTheme|localStorage.getItem\('theme'\)/);
});
test('Photography removes cursor tracking and uses Madani outside the Ligero marks',()=>{
  assert.doesNotMatch(read('services/photography/page.mjs'),/paintCursor|pointermove|customCursor/);
  assert.doesNotMatch(read('services/photography/page.css'),/custom-cursor|cursor:none/);
  assert.doesNotMatch(read('services/photography.html'),/customCursor/);
  for(const rule of ['.photo-caption h2','.photo-information h1','.menu-open .nav-item'])assert.ok(read('services/photography/page.css').includes(`${rule}{font-family:Madani`));
  assert.match(read('services/photography/page.css'),/\.logo\{font-family:Suissnord/);
});

test('shared text uses Madani while numerals remain legible with fallback glyphs',()=>{
  const css=read('css/styles.css');
  const form=read('form.html');
  assert.ok(/@font-face\s*\{[^}]*font-family:\s*'Madani'[^}]*unicode-range:\s*U\+0000-002F,\s*U\+003A-10FFFF/s.test(css),'demo-font digits must use readable fallback glyphs');
  assert.doesNotMatch(css, /font-family:\s*(?:["']?(?:Dubai Light|Aptos Light|Arial Nova Light))/i);
  assert.doesNotMatch(form, /font-family:\s*(?:["']?(?:Dubai Light|Aptos Light|Arial Nova Light))/i);
  assert.match(css, /\.logo\s*\{[^}]*font-family:\s*Suissnord/s);
});

test('no public page installs or hides a custom cursor',()=>{
  const script=read('js/script.js'), styles=read('css/styles.css');
  assert.doesNotMatch(script,/customCursor|setupEnhancedCustomCursor|style\.cursor = 'none'/);
  assert.doesNotMatch(styles,/cursor:\s*none|\.custom-cursor|^\.cursor\s*\{/m);
  assert.doesNotMatch(read('services/music/index.html'),/class="cursor"/);
});
