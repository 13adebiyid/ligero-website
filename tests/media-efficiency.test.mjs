import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VideoRenderer} from '../services/creative-direction/video-renderer.mjs';
import {restingStates} from '../services/creative-direction/motion.mjs';
function rendererFixture(){
 const renderer=Object.create(VideoRenderer.prototype),uploads=[];
 const video={readyState:2,videoWidth:1920,videoHeight:1080};
 const state={playing:true,failed:false,thumb:0,tween:null,tex:{},vw:1920,vh:1080,mode:'in',framePending:true};
 Object.assign(renderer,{gl:new Proxy({isContextLost:()=>false},{get:(obj,key)=>obj[key]??(()=>{})}),duoTex:{},canvas:{width:1440,height:900,clientWidth:1440,clientHeight:900},u:{},thumbs:[{tex:{},w:1280,h:720}],videos:[video],videoState:[state],active:0,_upload:()=>uploads.push(1),invalidate(){}});
 return {renderer,state,uploads};
}
test('camera motion never uploads an unchanged full-HD video frame again',()=>{
 const {renderer,state,uploads}=rendererFixture();
 const frames=restingStates(0,1,1440,900);
 renderer.render(frames,0);
 for(let i=1;i<60;i++)renderer.render(frames,i*16.67);
 assert.equal(uploads.length,1,'one decoded frame needs one GPU upload, not 60');
 state.framePending=true;renderer.render(frames,1000);
 assert.equal(uploads.length,2,'next decoded frame is uploaded');
});
test('video-frame callback marks fresh pixels dirty without an always-on upload loop',()=>{
 const {renderer,state}=rendererFixture();let callback,wakes=0;
 state.framePending=false;state.frameStamp=null;
 renderer.videos[0].requestVideoFrameCallback=fn=>{callback=fn;return 1;};
 renderer.videos[0].cancelVideoFrameCallback=()=>{};
 renderer.invalidate=()=>wakes++;
 renderer._frameLoop(0);callback(0,{presentedFrames:3});
 assert.equal(state.framePending,true);assert.equal(wakes,1);
 state.framePending=false;callback(16,{presentedFrames:3});
 assert.equal(state.framePending,false);assert.equal(wakes,1);
 callback(33,{presentedFrames:4});assert.equal(state.framePending,true);assert.equal(wakes,2);
});
test('Services keeps nearby cards resident without decoding videos outside the viewport',()=>{
 const source=readFileSync(new URL('../services/gallery/_nuxt/DZyj3ghP.js',import.meta.url),'utf8');
 const start=source.indexOf('syncRegistry(){'),end=source.indexOf('publishClips(){',start);
 const sync=new Function('HF','VF','GF','Ke',`return function ${source.slice(start,end)}`)(.001,.99,.9,el=>el.rect);
 const decisions=[];
 const record=(left)=>({landed:true,el:{isConnected:true,_parked:false,_vrect:{left,right:left+400,top:0,bottom:300,width:400,height:300},dataset:{gl:'card'}},mesh:{userData:{videoSrc:String(left)},material:{uniforms:{u_alpha:{value:1},u_white:{value:0}}}}});
 const fixture={reg:{all:()=>[record(20),record(1800)]},videos:new Map([['20',20],['1800',1800]]),playVideo:(id,on)=>decisions.push([id,on]),onScreen:r=>r.left<1440&&r.right>0&&r.bottom>0&&r.top<900,cardPose:()=>null};
 sync.call(fixture);
 assert.deepEqual(decisions,[[20,true],[1800,false]]);
});

test('scoped preview MP4 headers precede media so first frames do not wait for the file tail',()=>{
 for(const name of ['Gabzy','Grime','Note','Reem','Gift']){
  const data=readFileSync(new URL(`../videos/${name}-Preview.mp4`,import.meta.url));
  const atoms=[];let offset=0;
  while(offset+8<=data.length){
   const size=data.readUInt32BE(offset),type=data.toString('ascii',offset+4,offset+8);
   atoms.push(type);assert.ok(size>=8,`${name}: valid atom size`);offset+=size;
  }
  assert.ok(atoms.indexOf('moov')>=0&&atoms.indexOf('moov')<atoms.indexOf('mdat'),`${name}: faststart metadata`);
 }
});
