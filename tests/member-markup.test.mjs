import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const html=read('members/ifeoluwa-segun-oludimu.html');
const stills=[...html.matchAll(/<div class="feed-item image-(small|medium|large)" data-image="([^"]+)">\s*(<img[^>]+>)/g)];
const attribute=(tag,name)=>tag.match(new RegExp(name+'="([^"]+)"'))?.[1];
function exactPath(path){let dir=root;for(const part of path.slice(1).split('/')){assert.ok(readdirSync(dir).includes(part),path);dir=new URL(part+'/',dir);}}
const dimensions={gift:[[3840,2160],[3840,2160],[3840,2160],[3840,2160]],fashion:[[2837,4256],[3405,4256],[4319,5399],[3508,4385]]};
test('member stills have correctly sized responsive previews and preserved full-image targets',()=>{
 assert.equal(stills.length,8);
 for(const [,size,original,tag]of stills){
  const [,kind,n]=original.match(/(gift|fashion)-still-(\d)\.webp/),[width,height]=dimensions[kind][Number(n)-1];
  assert.equal(Number(attribute(tag,'width')),width);assert.equal(Number(attribute(tag,'height')),height);
  assert.equal(attribute(tag,'loading'),'lazy');assert.equal(attribute(tag,'decoding'),'async');assert.equal(attribute(tag,'fetchpriority'),'low');
  assert.match(size,/small|medium|large/);assert.match(attribute(tag,'sizes'),/max\(calc\(/,'cover-crop and hover width must be accounted for');
  const candidates=attribute(tag,'srcset').split(',').map(s=>s.trim().split(/\s+/));
  assert.deepEqual(candidates.map(([,w])=>parseInt(w)),[720,1440,2160,width]);
  assert.deepEqual(candidates.at(-1),[original,`${width}w`]);
  candidates.forEach(([path])=>exactPath(path));exactPath(attribute(tag,'src'));
 }
});
test('both member pages preserve every full-film target and original preview route',()=>{
 const members=[['ashleigh-cooper-creative-director',['gabzy','grime','note','reem']],['ifeoluwa-segun-oludimu',['gift','fashion','brand']]];
 for(const [route,names]of members){const page=read(`members/${route}.html`);
  assert.deepEqual([...page.matchAll(/data-video="([^"]+)"/g)].map(m=>m[1]),names.map(n=>`/videos/${n}.mp4`));
  assert.deepEqual([...page.matchAll(/<source src="([^"]+)"/g)].map(m=>m[1]),names.map(n=>`/videos/${n[0].toUpperCase()+n.slice(1)}-Preview.mp4`));
 }
});
