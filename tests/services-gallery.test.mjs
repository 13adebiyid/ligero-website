import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const page = read('services/index.html');
const services = [
  ['creative-directing', 'Creative directing', '/services/creative-directing.html'],
  ['set-designing', 'Set design', '/services/set-designing.html'],
  ['photography', 'Photography', '/services/photography.html'],
  ['models', 'Models', '/services/models.html'],
  ['music', 'Music', '/services/music/'],
  ['styling', 'Styling', '/services/styling.html'],
];

test('the Services page retains Ligero branding, menu and capabilities heading', () => {
  assert.match(page, /<a href="\/" class="logo">LIGERO<\/a>/);
  assert.match(page, /<h1 class="services-title">OUR CAPABILITIES<\/h1>/);
  for (const link of ['/shop/', '/services/', '/contact/', '/policies/']) {
    assert.ok(page.includes(`href="${link}" class="nav-item"`));
    assert.ok(page.includes(`href="${link}" class="mobile-menu-item"`));
  }
  assert.match(page, /class="hamburger-menu"/);
});

test('the isolated gallery and readable fallback contain all six real services', () => {
  assert.match(page, /<iframe[^>]*src="\/services\/gallery\/"[^>]*title="[^"]*services[^"]*"/i);
  const gallery = read('services/gallery/index.html');
  const data = JSON.parse(read('services/gallery/services.json'));
  assert.equal(data.featured.length, services.length);
  assert.deepEqual(data.featured.map(project => project.slug), services.map(([slug]) => slug));
  assert.match(gallery, /id="readable"/);
  assert.match(gallery, /<base target="_top">/);
  assert.doesNotMatch(read('services/gallery/gallery.css'), /ABCDiatype/);
  for (const [slug, title, url] of services) {
    assert.ok(existsSync(path.join(root, url.slice(1))), `missing destination ${url}`);
    assert.match(gallery, new RegExp(`href="${url.replaceAll('/', '\\/')}"`));
    const item = data.featured.find(project => project.slug === slug);
    assert.equal(item.title.toLowerCase(), title.toLowerCase());
    assert.ok(existsSync(path.join(root, item.src.slice(1))), `missing card image for ${slug}`);
  }
});

test('gallery uses actual first videos, photography slideshow and owned colour cards', () => {
  const { featured } = JSON.parse(read('services/gallery/services.json'));
  const cards = Object.fromEntries(featured.map(card => [card.slug, card]));
  assert.equal(cards['creative-directing'].video, '/videos/Gabzy-Preview.mp4');
  assert.equal(cards['set-designing'].video, '/videos/Gift-Preview.mp4');
  assert.equal(cards.photography.video, '/services/gallery/media/photography-slideshow.mp4');
  assert.equal(cards.photography.src, '/services/gallery/media/photography-mosaic.webp');
  assert.equal(cards.photography.thumb, cards.photography.src);
  assert.equal(cards.photography.card, cards.photography.src);
  for (const slug of ['models', 'music', 'styling']) {
    assert.equal(cards[slug].video, null);
    assert.match(cards[slug].src, /^\/services\/gallery\/media\/[^/]+\.svg$/);
  }
  for (const card of featured) {
    if (card.video) assert.ok(existsSync(path.join(root, card.video.slice(1))), `missing video for ${card.slug}`);
  }
});

test('gallery selection navigates the parent to service pages and retains a readable mode', () => {
  const adapter = read('services/gallery/gallery.js');
  assert.match(adapter, /prefers-reduced-motion/);
  assert.match(adapter, /getContext\('webgl2'\)/);
  assert.match(adapter, /webglcontextlost/);
  assert.match(read("services/gallery/_nuxt/mriNB3Nt.js"), /postMessage/);
  assert.match(read('services/gallery/_nuxt/DZyj3ghP.js'), /c\.mesh\.visible=!!h\?\.isConnected&&!h\._parked/);
  assert.match(read('services/gallery/_nuxt/DZyj3ghP.js'), /a\.mesh\.visible=!s\._parked,a\.sync\(\)/);
  assert.match(read('services/gallery/index.html'), /data-gl="card"]:focus-visible/);
  assert.match(page, /event\.origin === location\.origin/);
  assert.match(page, /event\.source === [^\n]+contentWindow/);
  assert.match(page, /event\.data\?\.slug/);
});

test('gallery floor blends the original mirrored-card capture with either theme', () => {
  const renderer = read('services/gallery/_nuxt/DZyj3ghP.js');
  const shader = renderer.match(/,PF=`([\s\S]*?)`,IF=/)?.[1];
  assert.ok(shader, 'floor shader must exist');
  assert.doesNotMatch(shader, /u_grid|u_c1|refl \* line/);
  assert.match(shader, /vec3 col = u_c0;/);
  assert.match(shader, /texture2D\(u_refl, ruv\)/);
  assert.match(shader, /col = mix\(col, refl, u_reflA/);
  assert.ok(renderer.includes('this.renderer.setClearColor(this.background,1)'));
  assert.match(read('css/services-gallery.css'), /background: var\(--site-background, #000\)/);
  assert.match(renderer, /reflectTarget\.texture/);
});

test('mosaic poster is the readable photography card too', () => {
  assert.match(read('services/gallery/index.html'), /id="photography"[^>]*>\s*<img src="\/services\/gallery\/media\/photography-mosaic\.webp"/);
});


test('the gallery theme updates sky, floor, edge and clear colour together and wakes idle rendering', () => {
  const renderer=read('services/gallery/_nuxt/DZyj3ghP.js');
  const start=renderer.indexOf('syncTheme(){'), end=renderer.indexOf('syncEnv(){',start);
  assert.ok(start>0 && end>start);
  const document={documentElement:{dataset:{theme:'white'}}};
  const sync=new Function('document',`return function ${renderer.slice(start,end)}`)(document);
  const colours=[], surface=()=>({material:{uniforms:{u_c0:{value:{setHex:colour=>colours.push(colour)}}}}});
  let wakes=0;
  const gallery={sky:surface(),ground:surface(),veil:surface(),core:{wake:()=>wakes++}};
  sync.call(gallery);
  assert.deepEqual(colours,[0xffffff,0xffffff,0xffffff]);
  assert.equal(gallery.core.background,0xffffff);
  sync.call(gallery);assert.equal(wakes,1,'unchanged theme must not force a draw on every tick');
  document.documentElement.dataset.theme='black';sync.call(gallery);
  assert.deepEqual(colours.slice(3),[0,0,0]);assert.equal(gallery.core.background,0);assert.equal(wakes,2);
});
