import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const shared = readFileSync(new URL('../js/page-transitions.js', import.meta.url), 'utf8');
const legacy = readFileSync(new URL('../js/script.js', import.meta.url), 'utf8');

function navigation(pathname = '/') {
  const listeners = new Map(), timers = [], destinations = [], classes = new Set(), animations = [];
  const body = {style: {}, classList: {add: (...names) => names.forEach(n => classes.add(n)), remove: name => classes.delete(name)}};
  const location = {pathname, origin: 'http://localhost', hostname: 'localhost', href: 'http://localhost' + pathname,
    assign: url => destinations.push(url)};
  const document = {body, documentElement:{classList:{add(){},remove(){}},appendChild(){}}, head:{appendChild(){}}, readyState:'loading', referrer:'',
    createElement: () => ({style:{}, setAttribute(){}, animate: (frames, options) => {animations.push(options);return {finished: Promise.resolve()};}, remove(){}}),
    addEventListener: (name, listener) => listeners.set(name, listener), querySelector: () => null, getElementById: () => null};
  const window = {location, addEventListener(){}};
  const context = vm.createContext({document, window, location, URL, Date, matchMedia: () => ({matches:false}),
    getComputedStyle: () => ({getPropertyValue: () => '#000'}), sessionStorage:{getItem: () => null, setItem(){},removeItem(){}}, console,
    setTimeout: (callback, ms) => {timers.push({callback, ms}); return timers.length;}, clearTimeout(){}});
  vm.runInContext(legacy, context);
  vm.runInContext(shared, context);
  function click(href, options = {}) {
    let prevented = false;
    listeners.get('click')({target: {closest: () => ({href:'http://localhost'+href,hasAttribute: () => false,target:'_self'})},
      button:0, preventDefault:() => { prevented = true; }, ...options});
    return prevented;
  }
  return {click, timers, destinations, classes, context, window, animations};
}

test('Services links use only the shared transition; no 400ms legacy delay', async () => {
  const page = navigation();
  assert.equal(page.click('/services/'), true);
  assert.equal(page.timers.length, 0);
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(page.destinations, ['http://localhost/services/']);
});

test('modified link clicks retain normal browser new-tab behavior', () => {
  for (const key of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    const page = navigation();
    assert.equal(page.click('/services/', {[key]: true}), false);
    assert.equal(page.timers.length, 0);
  }
});

test('other internal pages use the browser directly when shared route does not apply', () => {
  const page = navigation('/contact/');
  assert.equal(page.click('/shop/'), false);
  assert.equal(page.timers.length, 0);
  assert.deepEqual(page.destinations, []);
});

test('Services does not create a second initial loading screen', () => {
  const page = navigation('/services/');
  vm.runInContext('initPageLoad()', page.context);
  assert.equal(page.timers.length, 0);
  assert.ok(page.classes.has('page-loaded'));
  assert.ok(page.classes.has('content-loaded'));
});


test('shared handoff stays within 240ms without shortening scene entrances', async () => {
  const page = navigation();
  page.click('/services/');
  await Promise.resolve();
  assert.equal(page.animations[0].duration, 120);
  const css = readFileSync(new URL('../css/page-transitions.css', import.meta.url), 'utf8');
  assert.match(css, /animation-duration: 240ms/);
  assert.match(css, /route-arrive 140ms 100ms/);
});
