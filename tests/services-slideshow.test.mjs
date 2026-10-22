import test from 'node:test';
import assert from 'node:assert/strict';
import { mosaicArgs, slideshowArgs, posterArgs, photos, columns, slotHeights, period, speed, frames, fps, duration,
  width, height, gutter, columnWidth } from '../scripts/build-services-slideshow.mjs';

const graph = (args) => args[args.indexOf('-filter_complex') + 1];
const inputs = (args) => args.flatMap((arg, i) => arg === '-i' ? [args[i + 1]] : []);

test('mosaic uses every one of the ten photography photos exactly once', () => {
  const args = mosaicArgs('mosaic.mp4');
  const names = inputs(args).map((p) => p.replace(/\\/g, '/').split('/').pop()).sort();
  assert.deepEqual(names, [...photos].sort());
  assert.equal(photos.length, 10);
  assert.equal(new Set(columns.flatMap((c) => c.photos)).size, 10);
  assert.equal(slideshowArgs, mosaicArgs);
});

test('columns are staggered, gutters are small black, and layout fills 960x600', () => {
  assert.equal(columns.length, 4);
  assert.equal(new Set(columns.map((c) => c.offset)).size, columns.length);
  assert.equal(columns.length * columnWidth + (columns.length - 1) * gutter, width);
  assert.ok(gutter >= 2 && gutter <= 8);
  const g = graph(mosaicArgs('m.mp4'));
  assert.match(g, /pad=\d+:\d+:0:0:black/);
  assert.match(g, /hstack=inputs=4/);
  assert.ok(period > height, 'one loop is taller than the viewport so no photo repeats on screen');
});

test('every column slot layout sums exactly to the loop period', () => {
  for (const column of columns) {
    const slots = slotHeights(column);
    assert.equal(slots.reduce((a, b) => a + b, 0), period);
    assert.ok(slots.every((s) => s % 2 === 0 && s > 100));
  }
});

test('motion is downward: crop origin decreases per frame', () => {
  const g = graph(mosaicArgs('m.mp4'));
  assert.ok(speed > 0);
  assert.match(g, new RegExp(`mod\\(\\d+-${speed}\\*n,${period}\\)`));
  assert.doesNotMatch(g, /mod\(\d+\+\d*\*?n/); // origin must never grow with n (that would scroll upward)
});

test('loop is seamless: total travel is a whole number of periods for every column', () => {
  assert.equal(frames * speed, period);
  assert.ok(Number.isInteger(frames));
  assert.equal(duration, frames / fps);
  // Frame `frames` would equal frame 0 for each column offset; the final output frame is `frames - 1`.
  const y = (offset, n) => (((offset + period - speed * n) % period) + period) % period;
  for (const { offset } of columns) {
    assert.equal(y(offset, frames), y(offset, 0));
    assert.equal((y(offset, 0) - y(offset, 1) + period) % period, speed);
  }
  // Crop window (max origin + height) must stay inside the doubled column canvas.
  assert.ok(period - 1 + height <= 2 * period);
});

test('encoder output: 960x600, 30fps, no audio, faststart H.264, whole-loop frame count', () => {
  const args = mosaicArgs('mosaic.mp4');
  assert.equal(inputs(args).length, 10);
  assert.equal(args.at(-1), 'mosaic.mp4');
  assert.ok(args.includes('-an'));
  assert.equal(args[args.indexOf('-frames:v') + 1], String(frames));
  assert.equal(args[args.indexOf('-r') + 1], '30');
  assert.equal(args[args.indexOf('-c:v') + 1], 'libx264');
  assert.equal(args[args.indexOf('-movflags') + 1], '+faststart');
  assert.equal(args[args.indexOf('-pix_fmt') + 1], 'yuv420p');
  assert.equal(width, 960);
  assert.equal(height, 600);
  assert.match(graph(args), new RegExp(`crop=${columnWidth}:${height}`));
});

test('poster is the matching first mosaic frame as a single webp', () => {
  const args = posterArgs('poster.webp');
  assert.equal(args.at(-1), 'poster.webp');
  assert.equal(args[args.indexOf('-frames:v') + 1], '1');
  assert.equal(args[args.indexOf('-c:v') + 1], 'libwebp');
  assert.equal(inputs(args).length, 10);
  assert.match(graph(args), /mod\(\d+-2\*0,860\)/);
});
