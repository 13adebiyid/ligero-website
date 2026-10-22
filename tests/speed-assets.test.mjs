import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
const pages = {
  form: read('form.html'),
  ash: read('members/ashleigh-cooper-creative-director.html'),
  ifeoluwa: read('members/ifeoluwa-segun-oludimu.html'),
};
const memberPages = [pages.ash, pages.ifeoluwa];
const pairs = [
  ['jacket-front.PNG', 'jacket-front.webp'],
  ['jacket-back.PNG', 'jacket-back.webp'],
  ['ash-hero.png', 'ash-hero.webp'],
  ['ifeoluwa-hero.png', 'ifeoluwa-hero.webp'],
];

function exactFile(url) {
  let dir = root;
  for (const segment of url.replace(/^\//, '').split('/')) {
    assert.ok(readdirSync(dir).includes(segment), `Case-sensitive asset missing: ${url}`);
    dir = path.join(dir, segment);
  }
  return dir;
}
const pngSize = file => { const b = readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
function webpInfo(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  const chunks = [];
  for (let at = 12; at + 8 <= b.length;) { const size = b.readUInt32LE(at + 4); chunks.push(b.toString('ascii', at, at + 4)); at += 8 + size + (size & 1); }
  assert.ok(chunks.includes('VP8L'), 'lossless VP8L bitstream');
  const extended = chunks[0] === 'VP8X';
  const width = extended ? 1 + b.readUIntLE(24, 3) : 1 + (b.readUInt32LE(21) & 0x3fff);
  const height = extended ? 1 + b.readUIntLE(27, 3) : 1 + ((b.readUInt32LE(21) >>> 14) & 0x3fff);
  return {width, height, chunks};
}

test('lossless WebP copies exist beside the preserved originals at exact resolution', () => {
  for (const [original, copy] of pairs) {
    const originalPath = exactFile(`/images/${original}`), copyPath = exactFile(`/images/${copy}`);
    const info = webpInfo(copyPath);
    assert.deepEqual([info.width, info.height], pngSize(originalPath), `${copy} dimensions`);
    assert.ok(statSync(copyPath).size < statSync(originalPath).size, `${copy} is smaller`);
  }
});

test('metadata chunks present in the sources are carried into the copies', () => {
  assert.ok(webpInfo(exactFile('/images/jacket-front.webp')).chunks.includes('EXIF'));
  assert.ok(webpInfo(exactFile('/images/jacket-back.webp')).chunks.includes('EXIF'));
  assert.ok(webpInfo(exactFile('/images/ifeoluwa-hero.webp')).chunks.includes('XMP '));
});

test('build script verifies every decoded RGBA pixel and metadata', { skip: spawnSync('uv', ['--version']).status !== 0 && 'uv unavailable' }, () => {
  const run = spawnSync('uv', ['run', '--with', 'pillow', 'python', 'scripts/build-speed-images.py', '--check'], {cwd: root, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal((run.stdout.match(/ ok$/gm) || []).length, pairs.length);
});

test('form jacket thumbnails and modal use the existing lossless WebP files', () => {
  const sources = [...pages.form.matchAll(/(?:src="|src: ')(\/images\/jacket-[^"']+)/g)].map(m => m[1]);
  assert.deepEqual(sources, ['/images/jacket-front.webp', '/images/jacket-back.webp', '/images/jacket-front.webp', '/images/jacket-back.webp']);
  sources.forEach(exactFile);
  assert.doesNotMatch(pages.form, /jacket-(front|back)\.(png|PNG)/);
});

test('member heroes use the lossless copies with eager priority and intrinsic dimensions', () => {
  for (const [html, name] of [[pages.ash, 'ash-hero'], [pages.ifeoluwa, 'ifeoluwa-hero']]) {
    const tag = html.match(new RegExp(`<img[^>]*${name}\\.webp[^>]*>`))?.[0];
    assert.ok(tag, `${name} image tag`);
    exactFile(`/images/${name}.webp`);
    assert.match(tag, /width="1920"/); assert.match(tag, /height="1080"/);
    assert.match(tag, /fetchpriority="high"/); assert.match(tag, /decoding="async"/);
    assert.doesNotMatch(tag, /loading="lazy"/);
    assert.doesNotMatch(html, new RegExp(`${name}\\.png`));
  }
});

test('every member video preview URL matches the real file capitalisation', () => {
  const urls = memberPages.flatMap(html => [...html.matchAll(/<source src="(\/videos\/[^"]*-[Pp]review\.mp4)"/g)].map(m => m[1]));
  assert.deepEqual(urls.sort(), ['Brand', 'Fashion', 'Gabzy', 'Gift', 'Grime', 'Note', 'Reem'].map(n => `/videos/${n}-Preview.mp4`).sort());
  urls.forEach(exactFile);
});

test('member pages do not preload the full film and modal video does not preload', () => {
  for (const html of memberPages) {
    assert.doesNotMatch(html, /<link[^>]*rel="preload"[^>]*as="video"/);
    assert.match(html.match(/<video class="modal-video"[^>]*>/)[0], /preload="none"/);
    assert.doesNotMatch(html.match(/<video class="modal-video"[\s\S]*?<\/video>/)[0], /<source/, 'no empty modal source');
  }
});

test('owned pages hint the existing font files with the Photography preload pattern', () => {
  const hints = ['/fonts/suissnord.regular.woff', '/fonts/MadaniDEMO-Thin.woff'];
  for (const html of Object.values(pages)) {
    const head = html.slice(0, html.indexOf('</head>'));
    for (const font of hints) {
      exactFile(font);
      assert.ok(head.includes(`<link rel="preload" href="${font}" as="font" type="font/woff" crossorigin>`), `${font} preload`);
    }
  }
});
