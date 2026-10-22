import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const stems = ['gift', 'fashion'].flatMap(k => [1, 2, 3, 4].map(n => `${k}-still-${n}`));
const widths = [720, 1440, 2160];

function webpInfo(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  const chunks = [];
  for (let at = 12; at + 8 <= b.length;) { const size = b.readUInt32LE(at + 4); chunks.push(b.toString('ascii', at, at + 4)); at += 8 + size + (size & 1); }
  const ext = chunks[0] === 'VP8X';
  if (chunks.includes('VP8L')) {
    return {
      chunks, lossless: true,
      width: ext ? 1 + b.readUIntLE(24, 3) : 1 + (b.readUInt32LE(21) & 0x3fff),
      height: ext ? 1 + b.readUIntLE(27, 3) : 1 + ((b.readUInt32LE(21) >>> 14) & 0x3fff),
    };
  }
  assert.ok(chunks.includes('VP8 '), `${file} VP8 bitstream`);
  let at = 12;
  while (b.toString('ascii', at, at + 4) !== 'VP8 ') at += 8 + b.readUInt32LE(at + 4) + (b.readUInt32LE(at + 4) & 1);
  assert.equal(b.toString('hex', at + 11, at + 14), '9d012a', 'VP8 start code');
  return {chunks, lossless: false, width: b.readUInt16LE(at + 14) & 0x3fff, height: b.readUInt16LE(at + 16) & 0x3fff};
}
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const originalHashes = {
  'fashion-still-1': '7b1e96db3594c5e8e9585e111667370950c8f175d2d26ed43bbe037dbb530f30',
  'fashion-still-2': '30b26dded781c456d880b4b60cbefa2aa12baf10a8d0813b7f7050ca0a7a6689',
  'fashion-still-3': '2a22f1282324be485df1d29c76d8f00db6d9959e6bf5c64d839e87ad59e521f3',
  'fashion-still-4': '9f381781873ef33546d8c49bb157b8ceca7f6eff23b8597e7e62897a7601cd2b',
  'gift-still-1': 'bfe0810d4ded045465a9cd428fc4e722495e1d14ff1e4cf49e980aab3e2759dd',
  'gift-still-2': 'ffc74a5cf1df8e3e2bb13aae0ed953f0865215d914ef6930cd21bb0ad47a3492',
  'gift-still-3': '7abb526169c5404b78dbdfeccc4e63c34f738396b1eb44b08cfc311d30746913',
  'gift-still-4': '190fc30d66eedbb79327487c017fbae7277fa6f4755a564619a1b7b37a1ff758',
};
const sourceSizes = {
  'gift-still-1': [3840, 2160], 'gift-still-2': [3840, 2160], 'gift-still-3': [3840, 2160], 'gift-still-4': [3840, 2160],
  'fashion-still-1': [2837, 4256], 'fashion-still-2': [3405, 4256], 'fashion-still-3': [4319, 5399], 'fashion-still-4': [3508, 4385],
};
const original = stem => webpInfo(path.join(root, 'images', `${stem}.webp`));

test('every non-upscaled derivative exists with full-aspect dimensions and no extras', () => {
  const expected = [];
  for (const stem of stems) {
    const src = original(stem);
    for (const w of widths) {
      const name = `${stem}-${w}.webp`, file = path.join(root, 'members/media', name);
      if (w >= src.width) { assert.ok(!existsSync(file), `${name} would upscale`); continue; }
      assert.ok(existsSync(file), `missing ${name}`);
      expected.push(name);
      const info = webpInfo(file);
      assert.ok(info.lossless, `${name} lossless`);
      assert.equal(info.width, w, name);
      assert.equal(info.height, Math.max(1, Math.round(src.height * w / src.width)), `${name} aspect`);
    }
  }
  assert.deepEqual(readdirSync(path.join(root, 'members/media')).filter(f => f.endsWith('.webp')).sort(), expected.sort());
});

test('metadata chunks carried by sources are carried by derivatives', () => {
  for (const stem of stems) {
    const src = original(stem);
    for (const w of widths.filter(w => w < src.width)) {
      const got = webpInfo(path.join(root, `members/media/${stem}-${w}.webp`)).chunks;
      for (const c of ['EXIF', 'XMP ', 'ICCP']) if (src.chunks.includes(c)) assert.ok(got.includes(c), `${stem}-${w} ${c}`);
    }
  }
});

test('originals are byte-identical to the preserved SHA-256 hashes and expected dimensions', () => {
  for (const stem of stems) {
    const file = path.join(root, 'images', `${stem}.webp`);
    assert.equal(sha(file), originalHashes[stem], `${stem} changed`);
    const info = webpInfo(file);
    assert.deepEqual([info.width, info.height], sourceSizes[stem], stem);
  }
});

test('build script verifies exact Lanczos RGBA pixels and metadata', () => {
  assert.equal(spawnSync('uv', ['--version']).status, 0, 'uv is required for the pixel gate');
  const run = spawnSync('uv', ['run', '--offline', '--with', 'pillow', 'python', 'scripts/build-member-images.py', '--check'], {cwd: root, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.doesNotMatch(run.stdout, /MISSING|STALE|FAIL/);
  assert.equal((run.stdout.match(/ ok$/gm) || []).length, 24);
});
