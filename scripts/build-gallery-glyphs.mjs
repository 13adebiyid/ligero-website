import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=new URL('../services/gallery/glyphs/',import.meta.url);
for(const name of ['sans-400','sans-500']) {
  const original=await readFile(new URL(name+'.bin',root));
  const packed=gzipSync(original,{level:9});
  assert.deepEqual(gunzipSync(packed),original);
  if(process.argv.includes('--check'))assert.deepEqual(await readFile(new URL(name+'.bin.gz',root)),packed,`stale packed glyphs: ${name}`);
  else await writeFile(new URL(name+'.bin.gz',root),packed);
  console.log(`${name}: ${original.length} -> ${packed.length} bytes, lossless ${process.argv.includes('--check')?'verified':'built'}`);
}
