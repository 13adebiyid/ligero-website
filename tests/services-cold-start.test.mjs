import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

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
