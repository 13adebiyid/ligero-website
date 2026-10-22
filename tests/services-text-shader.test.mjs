import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../services/gallery/_nuxt/DZyj3ghP.js',import.meta.url),'utf8');
const fragment=source.match(/\beF=`([\s\S]*?)`/)?.[1];
assert.ok(fragment,'the actual outline-text fragment shader must be found');
const start=source.indexOf('this.material=new Gt({glslVersion:this.outline');
const end=source.indexOf('),this.mesh=',start)+1;
assert.ok(start>0&&end>start,'exercise the actual text material constructor');
class Value {constructor(...args){this.value=args;}}
const dependencies={Gt:class {constructor(options){Object.assign(this,options);}},Wp:'GLSL3',xi:(...parts)=>parts.join('\n'),
  QU:'outline-vertex',tF:'canvas-vertex',Jl:'',Vl:'',Yu:'',HU:'',IS:'',eF:fragment,nF:'canvas-fragment',_a:'',ko:'',PS:'',
  B0:16,at:Value,W:Value,Oe:Value,ot:Value,We:Value,Pi:2,lF:.2,oF:.3,sF:1,rF:1,iF:1,r:{}};
const create=new Function(...Object.keys(dependencies),`return function(){${source.slice(start,end)};return this.material;}`)(...Object.values(dependencies));
function material(outline,reel=false){return create.call({outline,reel,font:{texture:{}},texture:{}});}
function blurCode(shader,enabled) {
  const block=shader.match(/#if LIGERO_REEL_BLUR\s*([\s\S]*?)#endif\s*(\{\s*raw = abs\(area3\(v_em, ppx, table \+ bh, split\)\);\s*\})/);
  assert.ok(block,'the real optional blur block must be compile-time selected');
  return (enabled?block[1]:'')+block[2];
}

test('ordinary outline titles exclude the rolling-digit blur loop at compilation',()=>{
  const text=material(true);
  assert.equal(text.defines?.LIGERO_REEL_BLUR,0);
  const compiled=blurCode(text.fragmentShader,false);
  assert.doesNotMatch(compiled,/for\s*\(.*BLUR/);
  assert.match(compiled,/raw = abs\(area3\(v_em, ppx, table \+ bh, split\)\)/);
  assert.equal(text.glslVersion,'GLSL3');assert.equal(text.uniforms.u_reel.value,0);
});

test('reel outline text retains the full rolling blur and identical coverage function',()=>{
  const ordinary=material(true),reel=material(true,true);
  assert.equal(reel.defines?.LIGERO_REEL_BLUR,1);
  assert.equal(reel.fragmentShader,ordinary.fragmentShader,'one shader authority, selected by a material define');
  assert.match(blurCode(reel.fragmentShader,true),/if \(vBlur > 0\.002\)/);
  assert.match(blurCode(reel.fragmentShader,true),/for \(int i = 0; i < BLUR; i\+\+\)/);
  assert.match(reel.fragmentShader,/const int BLUR = 16;/);
});

test('canvas-text fallback retains its original material and cannot enable reel blur',()=>{
  const text=material(false);
  assert.equal(text.defines?.LIGERO_REEL_BLUR,0);
  assert.equal(text.glslVersion,null);assert.match(text.fragmentShader,/^canvas-fragment/);
  assert.doesNotMatch(text.fragmentShader,/LIGERO_REEL_BLUR|area3/);
});
