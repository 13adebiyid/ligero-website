import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

// Photography mosaic: every photographyData photo (ash-pic-1..10) in four staggered columns
// that scroll endlessly downward. Pre-rendered; the page only plays the MP4.
export const photos = Array.from({ length: 10 }, (_, i) => `ash-pic-${i + 1}.webp`);
export const width = 960;
export const height = 600;
export const fps = 30;
export const gutter = 4;
export const period = 860;            // px: one full loop of every column
export const speed = 2;               // px per frame, downward
export const frames = period / speed; // 430 frames = 14.33s; frame 430 === frame 0
export const duration = frames / fps;
export const columnWidth = (width - 3 * gutter) / 4; // 237
// Column contents (top to bottom), natural heights at 237px wide are 704..842 so crops stay modest.
export const columns = [
  { photos: [1, 5, 7], offset: 0 },
  { photos: [2, 8, 10], offset: 300 },
  { photos: [4, 6], offset: 120 },
  { photos: [3, 9], offset: 480 },
];
// Natural aspect heights (px) at the 1171-tall sources, for proportional slot sizing.
const naturalSize = { 1: [658, 1171], 2: [658, 1171], 3: [658, 1171], 4: [781, 1171], 5: [1756, 1171],
  6: [781, 1171], 7: [1755, 1171], 8: [1755, 1171], 9: [658, 1171], 10: [7508, 5008] };

// Slot heights (tile + trailing gutter) per column, even, summing exactly to `period`.
export function slotHeights(column) {
  const natural = column.photos.map((n) => columnWidth * naturalSize[n][1] / naturalSize[n][0] + gutter);
  const total = natural.reduce((a, b) => a + b, 0);
  const slots = natural.map((h) => 2 * Math.round(h * period / total / 2));
  slots[slots.length - 1] += period - slots.reduce((a, b) => a + b, 0);
  return slots;
}

function mosaicGraph(frameExpr) {
  const filters = [];
  const labels = [];
  let input = 0;
  columns.forEach((column, c) => {
    const tiles = column.photos.map((n, t) => {
      const slot = slotHeights(column)[t];
      const label = `c${c}t${t}`;
      filters.push(`[${input++}:v]scale=${columnWidth}:${slot - gutter}:force_original_aspect_ratio=increase,crop=${columnWidth}:${slot - gutter},` +
        `setsar=1,format=yuv444p,pad=${columnWidth}:${slot}:0:0:black[${label}]`);
      return label;
    });
    const stack = tiles.length > 1 ? `${tiles.map((l) => `[${l}]`).join('')}vstack=inputs=${tiles.length},` : `[${tiles[0]}]`;
    filters.push(`${stack}split[s${c}a][s${c}b]`);
    filters.push(`[s${c}a][s${c}b]vstack=inputs=2[loop${c}]`);
    // Content moves down: window origin decreases by `speed` px per frame, wrapping at `period`.
    const y = `mod(${column.offset + period}-${speed}*${frameExpr},${period})`;
    const right = c < columns.length - 1 ? `,pad=${columnWidth + gutter}:${height}:0:0:black` : '';
    filters.push(`[loop${c}]crop=${columnWidth}:${height}:0:'${y}'${right}[col${c}]`);
    labels.push(`[col${c}]`);
  });
  filters.push(`${labels.join('')}hstack=inputs=${columns.length},format=yuv420p[out]`);
  return filters.join(';');
}

function inputArgs() {
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  for (const column of columns) for (const n of column.photos) {
    args.push('-loop', '1', '-framerate', String(fps), '-i', path.join(root, 'images', `ash-pic-${n}.webp`));
  }
  return args;
}

export function mosaicArgs(output) {
  return [...inputArgs(), '-filter_complex_threads', '2', '-filter_complex', mosaicGraph('n'), '-map', '[out]',
    '-frames:v', String(frames), '-r', String(fps), '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
    '-threads', '3', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output];
}
export const slideshowArgs = mosaicArgs;

export function posterArgs(output) {
  return [...inputArgs(), '-filter_complex_threads', '2', '-filter_complex', mosaicGraph('0'), '-map', '[out]',
    '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82', '-threads', '2', output];
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const output = process.argv[2] || path.join(root, 'services/gallery/media/photography-slideshow.mp4');
  const poster = process.argv[3] || path.join(root, 'services/gallery/media/photography-mosaic.webp');
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  for (const args of [mosaicArgs(output), posterArgs(poster)]) {
    const result = spawnSync(ffmpeg, args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
  }
}
