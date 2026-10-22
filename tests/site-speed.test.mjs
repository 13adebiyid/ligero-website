import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/script.js',import.meta.url),'utf8');
function element(){
 const listeners=new Map(),classes=new Set();
 return {listeners,style:{},dataset:{},classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n)},addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},removeEventListener(name,fn){listeners.set(name,(listeners.get(name)||[]).filter(f=>f!==fn));},dispatch(name,event={}){for(const fn of listeners.get(name)||[])fn({target:this,...event});},removeAttribute(name){delete this[name];},querySelectorAll(){return [];}};
}
function video(){
 return Object.assign(element(),{paused:true,currentTime:0,duration:8,readyState:4,loads:0,plays:0,pauses:0,play(){this.plays++;this.paused=false;this.dispatch('play');return Promise.resolve();},pause(){this.pauses++;this.paused=true;this.dispatch('pause');},load(){this.loads++;},getBoundingClientRect(){return {top:2000,bottom:2400};}});
}
function fixture(count=0){
 const videos=Array.from({length:count},video),observers=[],timers=[],intervals=[],ids=new Map();
 const body=element(),document=Object.assign(element(),{body,hidden:false,referrer:'',querySelectorAll:selector=>selector==='.feed-video'?videos:[],querySelector:()=>null,getElementById:id=>ids.get(id)||null});
 const window=Object.assign(element(),{innerWidth:1440,innerHeight:900,location:{pathname:'/',origin:'http://localhost',hostname:'localhost'}});
 const context=vm.createContext({document,window,console,URL,sessionStorage:{getItem:()=>null,setItem(){}},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){},setInterval:(fn,ms)=>intervals.push({fn,ms}),clearInterval(){},IntersectionObserver:class{constructor(callback,options){this.callback=callback;this.options=options;this.observed=[];observers.push(this);}observe(v){this.observed.push(v);}disconnect(){}}});
 vm.runInContext(source,context,{filename:new URL('../js/script.js',import.meta.url).href});
 return {context,videos,observers,timers,intervals,document,window,body,ids,run:code=>vm.runInContext(code,context),intersect(v,on){for(const observer of observers)observer.callback([{target:v,isIntersecting:on,intersectionRatio:on?1:0}]);}};
}
test('shared bootstrap has no perpetual navigation polling or beforeunload cache blocker',()=>{
 const f=fixture();assert.equal(f.intervals.length,0);assert.equal(f.window.listeners.has('beforeunload'),false);
});
test('feed setup binds once and never loads offscreen clips',()=>{
 const f=fixture(2);f.run('setupEnhancedFeedVideoAutoplay(); setupEnhancedFeedVideoAutoplay();');
 assert.equal(f.observers.length,1);assert.equal(f.observers[0].observed.length,2);
 assert.equal(f.timers.length,0);
 for(const v of f.videos){assert.equal(v.loads,0);assert.equal(v.plays,0);assert.equal(v.listeners.get('timeupdate')?.length,1);}
});
test('visible feed preview plays, hidden and modal states pause it, return resumes only eligible clips',async()=>{
 const f=fixture(2);f.run('setupEnhancedFeedVideoAutoplay()');const [a,b]=f.videos;
 f.intersect(a,true);await Promise.resolve();assert.equal(a.paused,false);assert.equal(b.plays,0);
 f.document.hidden=true;f.document.dispatch('visibilitychange');assert.equal(a.paused,true);
 f.document.hidden=false;f.document.dispatch('visibilitychange');await Promise.resolve();assert.equal(a.paused,false);
 f.body.classList.add('modal-open');f.run('syncFeedVideos()');assert.equal(a.paused,true);
 f.body.classList.remove('modal-open');f.run('syncFeedVideos()');await Promise.resolve();assert.equal(a.paused,false);
 a.currentTime=2;f.intersect(a,false);assert.equal(a.paused,true);assert.equal(a.currentTime,0);
 f.document.dispatch('visibilitychange');assert.equal(a.paused,true);assert.equal(b.plays,0);
});
test('feed looping is single-bound across metadata events and pagehide pauses decoding',async()=>{
 const f=fixture(1);f.run('setupEnhancedFeedVideoAutoplay()');const [v]=f.videos;
 v.dispatch('loadedmetadata');v.dispatch('loadedmetadata');assert.equal(v.listeners.get('timeupdate').length,1);
 f.intersect(v,true);await Promise.resolve();v.currentTime=4.1;v.dispatch('timeupdate');assert.equal(v.currentTime,0);
 f.window.dispatch('pagehide');assert.equal(v.paused,true);
 f.window.dispatch('pageshow',{persisted:true});await Promise.resolve();assert.equal(v.paused,false);
});
test('modal playback begins in the click, closing releases the source and cannot replay from a timer',()=>{
 const f=fixture(),v=video(),modal=element();f.ids.set('modalVideo',v);f.context.modal=modal;f.run('DOM.videoModal=modal; openVideoModal("/videos/gift.mp4","Gift","Client")');
 assert.equal(v.plays,1);assert.equal(f.timers.length,0);f.run('closeModal()');
 assert.equal(v.paused,true);assert.equal(v.src,undefined);assert.equal(v.loads,1);
});
test('home background respects manual pause across visibility and does not restart on unrelated clicks',async()=>{
 const f=fixture(),v=video(),play=element(),mute=element();f.ids.set('playPauseBtn',play);f.ids.set('muteBtn',mute);f.ids.set('playPauseIcon',{});f.ids.set('muteIcon',{});f.context.video=v;
 f.run('DOM.bgVideo=video; setupVideoControls()');await Promise.resolve();assert.equal(v.paused,false);
 f.document.hidden=true;f.document.dispatch('visibilitychange');assert.equal(v.paused,true);
 f.document.hidden=false;f.document.dispatch('visibilitychange');await Promise.resolve();assert.equal(v.paused,false);
 play.dispatch('click',{stopPropagation(){}});assert.equal(v.paused,true);
 f.document.dispatch('click');f.document.dispatch('pointerdown');f.document.hidden=true;f.document.dispatch('visibilitychange');f.document.hidden=false;f.document.dispatch('visibilitychange');
 await Promise.resolve();assert.equal(v.paused,true);
 play.dispatch('click',{stopPropagation(){}});await Promise.resolve();assert.equal(v.paused,false);
 f.window.dispatch('pagehide');assert.equal(v.paused,true);f.window.dispatch('pageshow',{persisted:true});await Promise.resolve();assert.equal(v.paused,false);
});

test('first direct visit to a non-home page does not wait behind a generic 1800ms logo',()=>{
 const f=fixture();f.window.location.pathname='/contact/';
 const overlays=[];f.document.createElement=()=>{const el=element();el.innerHTML='';overlays.push(el);return el;};f.body.appendChild=()=>{};f.run('initPageLoad()');
 assert.equal(overlays.length,0);assert.equal(f.timers.length,0);
 assert.equal(f.body.classList.contains('page-loaded'),true);assert.equal(f.body.classList.contains('content-loaded'),true);
});
test('modal click handlers bind once and do not run again when initialized later',()=>{
 const f=fixture(),item=element(),img=element(),container=element();
 item.hasAttribute=()=>true;item.getAttribute=()=>'/images/gift-still-1.webp';
 img.closest=()=>item;container.getAttribute=()=>'/videos/gift.mp4';
 f.document.querySelectorAll=selector=>({'.feed-item[data-image]':[item],'.feed-item img':[img],'.video-container-main':[container]})[selector]||[];
 f.run('setupModalClicks();setupModalClicks()');
 assert.equal(item.listeners.get('click').length,1);assert.equal(container.listeners.get('click').length,1);assert.equal(img.listeners.has('click'),false);
});

function observeMediaWrites(video) {
 const writes=[];let time=video.currentTime;
 Object.defineProperty(video,'currentTime',{get:()=>time,set:value=>{writes.push(value);time=value;}});
 return writes;
}

test('offscreen feed updates never seek an already-zero clip or pause an already-paused one',()=>{
 const f=fixture(2);f.run('setupEnhancedFeedVideoAutoplay()');
 const [a,b]=f.videos,writes=f.videos.map(observeMediaWrites);
 f.intersect(a,false);f.intersect(b,false);f.document.dispatch('visibilitychange');f.run('syncFeedVideos()');
 for(let i=0;i<f.videos.length;i++){
  assert.deepEqual(writes[i],[],'unrelated visibility updates must not schedule zero-to-zero seeks');
  assert.equal(f.videos[i].pauses,0,'already-paused clips need no pause command');
 }
});

test('a real feed exit resets once while later observer updates do no extra media work',async()=>{
 const f=fixture(2);f.run('setupEnhancedFeedVideoAutoplay()');const [a,b]=f.videos;
 const writes=observeMediaWrites(a);
 f.intersect(a,true);await Promise.resolve();a.currentTime=2;writes.length=0;
 f.intersect(a,false);
 assert.equal(a.paused,true);assert.equal(a.pauses,1);assert.deepEqual(writes,[0]);
 f.intersect(b,true);f.intersect(b,false);f.document.dispatch('visibilitychange');
 assert.equal(a.pauses,1);assert.deepEqual(writes,[0]);
 f.intersect(a,true);await Promise.resolve();assert.equal(a.paused,false);assert.equal(a.currentTime,0);
 a.currentTime=1;writes.length=0;
 f.body.classList.add('modal-open');f.run('syncFeedVideos();syncFeedVideos()');
 assert.equal(a.paused,true);assert.equal(a.pauses,2);assert.deepEqual(writes,[],'opening a modal pauses without resetting a still-visible preview');
});
