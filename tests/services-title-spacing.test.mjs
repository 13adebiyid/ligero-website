import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = readFileSync(path.join(root, 'services/gallery/_nuxt/DZyj3ghP.js'), 'utf8');
const atlas = JSON.parse(readFileSync(path.join(root, 'services/gallery/glyphs/sans-400.json'), 'utf8'));
const font = {glyph: cp => atlas.glyphs[cp] ?? null};

// Advances (units/1000) from fonts/MadaniDEMO-Thin.woff hmtx. This is the DOM face the
// renderer measures; the WebGL atlas is a different, narrower face.
const madani = {C: 770, r: 375, e: 651, a: 701, t: 351, i: 213, v: 544, ' ': 280, D: 750, c: 612, n: 637, g: 701, o: 0};

function respaceFn() {
  const start = bundle.indexOf('function ligeroRespace(');
  const end = bundle.indexOf('function O0(', start);
  assert.ok(start > 0 && end > start, 'ligeroRespace must exist in the gallery renderer');
  return new Function(`${bundle.slice(start, end)}; return ligeroRespace;`)();
}

function domPlaced(text, size) {
  const line = {left: 0, right: 0};
  const placed = [];
  let x = 0, sp = 0;
  for (const ch of text) {
    const adv = madani[ch] * size / 1000;
    if (ch === ' ') { sp++; x += adv; continue; }
    placed.push({glyph: atlas.glyphs[ch.codePointAt(0)], x, w: adv, domW: adv, size, ls: 0, align: 'left', sp, line});
    sp = 0; x += adv;
  }
  line.right = x;
  return {placed, line};
}

const inkGaps = placed => placed.slice(1).map((g, i) => {
  const p = placed[i];
  return (g.x + g.glyph.b[0] * g.size) - (p.x + p.glyph.b[2] * p.size);
});

test('Creative Directing is placed on baked-atlas advances, not on wider DOM-face advances', () => {
  const size = 45;
  const {placed, line} = domPlaced('Creative Directing', size);
  const before = inkGaps(placed.map(g => ({...g})));
  respaceFn()(placed, font);

  const text = 'CreativeDirecting';
  placed.forEach((g, i) => {
    if (i === 0) return;
    const prev = placed[i - 1];
    const space = text[i] === 'D' ? atlas.glyphs[32].a * size : 0;
    assert.ok(Math.abs(g.x - (prev.x + prev.glyph.a * size + space)) < 1e-9, `${text[i - 1]}${text[i]}`);
  });

  const after = inkGaps(placed);
  const AT = text.indexOf('at'); // inkGaps[i] is the gap between glyph i and i + 1: "a" -> "t"
  const WORD = text.indexOf('eD'); // "e" -> "D", the real word space
  assert.equal(text[AT] + text[AT + 1], 'at');
  const expectedAT = (atlas.glyphs[116].b[0] - atlas.glyphs[97].b[2] + atlas.glyphs[97].a) * size;
  assert.ok(Math.abs(after[AT] - expectedAT) < 1e-9, `a/t ink gap ${after[AT]} equals atlas arithmetic ${expectedAT}`);
  assert.ok(before[AT] - after[AT] > 0.1 * size, `fixture reproduces the wide a/t gap (${before[AT]} -> ${after[AT]})`);
  const otherLetterGaps = after.filter((_, i) => i !== AT && i !== WORD);
  assert.ok(after[AT] <= Math.max(...otherLetterGaps) + 1e-9, 'a/t is not an outlier');
  assert.ok(after[WORD] > 0.1 * size, 'word space is preserved');
  assert.equal(line.left, 0);
  const last = placed.at(-1);
  assert.ok(Math.abs(line.right - (last.x + last.glyph.a * size)) < 1e-9);
});

test('centred text stays centred after re-flow', () => {
  const {placed, line} = domPlaced('Creative', 30);
  placed.forEach(g => { g.align = 'center'; });
  const centre = (line.left + line.right) / 2;
  respaceFn()(placed, font);
  assert.ok(Math.abs((line.left + line.right) / 2 - centre) < 1e-9);
});

test('a line with non-contiguous DOM gaps is left exactly where the DOM put it', () => {
  const {placed} = domPlaced('Creative', 30);
  placed[4].x += 100;
  const xs = placed.map(g => g.x);
  respaceFn()(placed, font);
  assert.deepEqual(placed.map(g => g.x), xs);
});

test('bundle still measures letter-spacing, spaces and alignment for the re-flow', () => {
  for (const needle of ['letterSpacing', 'textAlign', 'ligeroRespace(i,e)']) assert.ok(bundle.includes(needle), needle);
});
