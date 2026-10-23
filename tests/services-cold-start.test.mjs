import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {gzipSync,gunzipSync} from 'node:zlib';

const adapter=readFileSync(new URL('../services/gallery/gallery.js',import.meta.url),'utf8');
const renderer=readFileSync(new URL('../services/gallery/_nuxt/DZyj3ghP.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function deferred() {
  let resolve;
  const promise=new Promise(done=>{resolve=done;});
  return {promise,resolve};
}

test('gallery import starts while the parent route transition is still pending',async()=>{
  const route=deferred(),classes=new Set(['gallery-loading']),imports=[];
  const document={getElementById:()=>({hidden:false}),addEventListener(){},
    documentElement:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}},
    createElement:()=>({getContext:()=>({getExtension:()=>null})})};
  const context=vm.createContext({document,window:{parent:{ligeroRouteReady:route.promise}},
    location:{search:''},URLSearchParams,console,matchMedia:()=>({matches:false,addEventListener(){}}),
    fetch:async()=>({ok:true,json:async()=>({featured:[{slug:'creative-directing'}]})}),
    importRenderer:async()=>{imports.push('renderer');}});
  const source=adapter.replace(/^import[^\n]+\n/,'').replace("import('./_nuxt/DZyj3ghP.js')",'importRenderer()');
  vm.runInContext(source,context,{filename:'gallery.js'});
  try {
    await flush();
    assert.deepEqual(imports,['renderer'],'graphics preparation must overlap the route transition');
  } finally {route.resolve();await flush();}
});

for(const first of ['route','shaders'])test(`entrance waits for both readiness signals when ${first} finishes first`,async()=>{
  const route=deferred(),shaders=deferred(),events=[];
  const body=renderer.match(/Rn\(\(\)=>\{(gallery\.mount\(canvas\.value\);.*?)\}\);return/)?.[1];
  assert.ok(body,'the real application mount callback must be exercised');
  const gallery={mount:canvas=>events.push(canvas),warmShaders:()=>{events.push('prepare');return shaders.promise;},bootRelease:()=>events.push('entrance')};
  new Function('gallery','canvas','window',body)(gallery,{value:'canvas'},{parent:{ligeroRouteReady:route.promise}});
  assert.deepEqual(events,['canvas','prepare'],'mount and preparation begin immediately');
  (first==='route'?route:shaders).resolve();await flush();
  assert.deepEqual(events,['canvas','prepare'],'neither a hidden entrance nor an unprepared frame may start');
  (first==='route'?shaders:route).resolve();await flush();
  assert.deepEqual(events,['canvas','prepare','entrance'],'release exactly once after both signals');
});

test('standalone gallery starts after shader readiness without a parent route promise',async()=>{
  const shaders=deferred(),events=[];
  const body=renderer.match(/Rn\(\(\)=>\{(gallery\.mount\(canvas\.value\);.*?)\}\);return/)?.[1];
  assert.ok(body);
  const gallery={mount(){},warmShaders:()=>shaders.promise,bootRelease:()=>events.push('entrance')};
  new Function('gallery','canvas','window',body)(gallery,{value:{}},{parent:{}});
  await flush();assert.deepEqual(events,[]);
  shaders.resolve();await flush();assert.deepEqual(events,['entrance']);
});

for (const file of ['services/index.html','services/gallery/index.html']) test(`${file} discovers first-frame resources before boot`,()=>{
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const hints=[...html.matchAll(/<link\b[^>]*>/g)].map(match=>match[0]);
  const main=adapter.match(/import\('\.\/(_nuxt\/[^']+)'\)/)[1];
  for(const path of [main,'_nuxt/mriNB3Nt.js','_nuxt/CSMsEA09.js','_nuxt/D6Jn8M47.js']) {
    assert.ok(hints.some(hint=>hint.includes('rel="modulepreload"')&&hint.includes(`href="/services/gallery/${path}"`)),`preload ${path}`);
    assert.ok(readFileSync(new URL('../services/gallery/'+path,import.meta.url)).length);
  }
  for(const path of ['services.json','glyphs/sans-400.json','glyphs/sans-400.bin.gz','glyphs/sans-500.json','glyphs/sans-500.bin.gz']) {
    assert.ok(hints.some(hint=>hint.includes('rel="preload"')&&hint.includes('as="fetch"')&&hint.includes('crossorigin')&&hint.includes(`href="/services/gallery/${path}"`)),`preload ${path}`);
    assert.ok(readFileSync(new URL('../services/gallery/'+path,import.meta.url)).length);
  }
});

test('adapter hands the validated response to the renderer before importing',async()=>{
  const data={featured:[{slug:'creative-directing'}]},window={parent:{}},imports=[];
  const document={getElementById:()=>({hidden:false}),addEventListener(){},
    documentElement:{classList:{add(){},remove(){}}},
    createElement:()=>({getContext:()=>({getExtension:()=>null})})};
  const context=vm.createContext({document,window,location:{search:''},URLSearchParams,console,
    matchMedia:()=>({matches:false,addEventListener(){}}),fetch:async()=>({ok:true,json:async()=>data}),
    importRenderer:async()=>imports.push(window.ligeroServices)});
  vm.runInContext(adapter.replace(/^import[^\n]+\n/,'').replace("import('./_nuxt/DZyj3ghP.js')",'importRenderer()'),context);
  await flush();assert.equal(imports.length,1);assert.equal(imports[0],data);
});

test('renderer provider reuses the validated adapter response for every consumer',async()=>{
  const data={featured:['first'],projects:['all'],site:{name:'Ligero'}};
  const body=renderer.match(/tI=Pn\(\(\)=>\{(.*?)\}\);function nI/)?.[1];
  assert.ok(body,'exercise the shipped provider');let requests=0;
  const provider=new Function('window','fetch',body)({ligeroServices:data},async()=>{requests++;return {ok:true,json:async()=>data};});
  assert.deepEqual(await provider.provide.dato.featured(),data.featured);
  assert.deepEqual(await provider.provide.dato.projects(),data.projects);
  assert.equal(await provider.provide.dato.site(),data.site);assert.equal(requests,0,'no second Services request');
});

test('ordinary image textures load without waiting for a compressed-texture manifest',async()=>{
  const start=renderer.indexOf('texture(e){let t=this.cache.get(e);'),end=renderer.indexOf('async preload(e,t)',start);
  assert.ok(start>0&&end>start);
  const images=[],uploads=[],resolved=new Map,cache=new Map;
  class Loader {setCrossOrigin(){return this;}load(url,loaded){images.push(url);loaded({src:url});}}
  class Texture {constructor(image){this.image=image;}}
  const texture=new Function('vS','an',`return function ${renderer.slice(start,end)}`)(Loader,Texture);
  const gallery={cache,resolved,compressed:()=>new Promise(()=>{}),paintTexture(){},core:{renderer:{initTexture:t=>uploads.push(t)}}};
  const pending=texture.call(gallery,'/poster.webp');await flush();
  assert.deepEqual(images,['/poster.webp'],'ordinary posters must not wait for a manifest');
  const result=await pending;assert.equal(result.image.src,'/poster.webp');assert.equal(uploads[0],result);
  assert.equal(texture.call(gallery,'/poster.webp'),pending);assert.equal(resolved.get('/poster.webp'),result);
});

for(const name of ['sans-400','sans-500'])test(`${name} compressed transfer preserves every glyph byte`,()=>{
  const original=readFileSync(new URL(`../services/gallery/glyphs/${name}.bin`,import.meta.url));
  const packed=readFileSync(new URL(`../services/gallery/glyphs/${name}.bin.gz`,import.meta.url));
  assert.deepEqual(gunzipSync(packed),original);assert.ok(packed.length<original.length*.3);
});

for(const mode of ['gzip','http-decoded','http-wrapped','no-stream','gzip-failure'])test(`glyph loading ${mode} retains the exact table`,async()=>{
  const body=renderer.match(/static async curves\(e\)\{(.*?)\}static load\(e\)/)?.[1];
  assert.ok(body,'exercise production glyph decompression');
  const bytes=new Uint8Array([0,1,2,3,255]),urls=[];
  const fetch=async url=>{urls.push(url);if(url.endsWith('.gz'))return mode==='http-decoded'?new Response(bytes,{headers:{'Content-Encoding':'gzip'}}):new Response(mode==='gzip-failure'?'broken':gzipSync(bytes),mode==='http-wrapped'?{headers:{'Content-Encoding':'gzip'}}:undefined);return new Response(bytes);};
  const load=new Function('fetch','Response','DecompressionStream',`return async function(e){${body}}`)(fetch,Response,mode==='no-stream'?undefined:DecompressionStream);
  assert.deepEqual(new Uint8Array(await load('sans-400')),bytes);
  assert.equal(urls.length,mode==='gzip-failure'?2:1);
  assert.equal(urls[0].endsWith('.gz'),mode!=='no-stream');
});

test('warmup matches both real text geometry variants before awaiting glyph assets',()=>{
  const start=renderer.indexOf('async warmShaders(){'),end=renderer.indexOf('declare(){',start);
  const warmup=renderer.slice(start,end),compile=warmup.indexOf('renderer.compileAsync');
  assert.ok(warmup.indexOf('assets=Wc()')<compile);
  assert.ok(warmup.indexOf('await assets')>compile);
  assert.match(warmup.slice(0,compile),/text\.mesh\.geometry=glyphGeometry/);
  assert.match(warmup.slice(0,compile),/text\.material\.glslVersion=Wp/);
  assert.match(warmup.slice(0,compile),/canvasText\.geometry\(/,'canvas warmup must use its real normal-free text geometry');
});
