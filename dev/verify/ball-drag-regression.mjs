import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { lut, getMaps, clearMaps } from '../../glass2.js';
import { webPresetOf } from '../../web-presets.js';
import { createBallGlass } from '../../ball-glass.js';
const root = new URL('../../', import.meta.url);
const main = fs.readFileSync(new URL('index.js', root), 'utf8').replace(/\r\n/g, '\n');
let images = [], bodyNodes = [];
const style = () => ({ setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } });
function node(type) {
    const el = { type, style: style(), dataset: {}, children: [], isConnected: false,
        setAttribute(k,v) { this[k] = String(v); }, append(...children) { this.children.push(...children); children.forEach(e=>{e.isConnected=true;}); },
        remove() { this.isConnected=false; bodyNodes=bodyNodes.filter(e=>e!==this); } };
    if (type === 'canvas') {
        let image;
        Object.assign(el, { width: 0, height: 0, getContext() { return { createImageData(w,h) { return {data:new Uint8ClampedArray(w*h*4)}; }, putImageData(i) { image=i; } }; },
            toDataURL() { const hash=createHash('sha256').update(image.data).digest('hex');images.push({w:this.width,h:this.height,hash});return 'data:image/png;base64,'+hash; } });
    }
    return el;
}
const document = {addEventListener(){},removeEventListener(){},createElement:node,createElementNS:(_ns,type)=>node(type),body:{classList:{contains:()=>false},append(...nodes){bodyNodes.push(...nodes);nodes.forEach(e=>{e.isConnected=true;});}}};
const window = {devicePixelRatio:2,addEventListener(){},removeEventListener(){}};globalThis.document=document;globalThis.window=window;globalThis.cancelAnimationFrame=()=>{};
globalThis.ImageData=class {constructor(w,h){this.data=new Uint8ClampedArray(w*h*4);}};
function renderer() { return createBallGlass({workerFactory:null}); }
const options={profile:'lens',ior:1.5,magnify:3,bezel:40,thickness:40,strength:1,aberration:3,blur:.25,saturate:1.08,brightness:1.01,contrast:1,specular:0,sharp:4,edgeShade:0,fresnel:0,caustic:0};
const phys={key:'natural',kind:'phys',R0:24,angle:135,o:options};
const web={key:'web-clear',kind:'web',R0:24,preset:'clear',recipe:webPresetOf('clear')};
const target=(x=220,vertical=false)=>vertical?{el:{style:style()},l:100,t:-500,r:152,b:1000,rad:26,sx:100,sy:x,nx:-1,ny:0}:{el:{style:style()},l:-500,t:100,r:1000,b:152,rad:26,sx:x,sy:100,nx:0,ny:-1};
const b={cx:220,cy:76,R:24};let r=renderer();images=[];r.paint(b,null,phys,30,true);assert.equal(images.length,4);const preview=images.slice();
images=[];r.paint({...b,cx:226,cy:82},null,phys,30,true);assert.equal(images.length,0,'A translated free ball must not rasterise again');
images=[];r.paint(b,target(),phys,30,true);assert.equal(images.length,4);
images=[];r.paint({...b,cx:226},target(226),phys,30,true);assert.equal(images.length,0,'Straight-edge translation must reuse the SDF');
images=[];r.paint({...b,cx:-480},target(-480),phys,30,true);assert.equal(images.length,4,'A nearby corner changes the shape');
images=[];r.paint(b,target(),phys,30,true);assert.equal(images.length,0,'Returning to a shape must recover its cached textures');
images=[];r.paint(b,target(),phys,30,false);assert.equal(images.length,4);const full=images.slice();assert(full[2].w>=preview[2].w*1.9,'Release restores full optical resolution');
r.paint(b,target(),phys,30,true);images=[];r.paint(b,target(),phys,30,false);assert.equal(images.length,0,'Settled textures survive the preview');
images=[];window.devicePixelRatio=1;r.paint(b,target(),phys,30,false);assert.equal(images.length,4,'DPR participates in the cache key');window.devicePixelRatio=2;
const t=target();r.paint(b,t,phys,30,false);assert(t.el.style['--ilg-fuse-light-r']);r.hide();assert(!t.el.style['--ilg-fuse-light-r']);
document.body.classList.contains=k=>k==='noShadows';images=[];r.paint(b,null,phys,30,true);assert.equal(images.length,3,'Hidden shadows must not generate their inverse mask');
document.body.classList.contains=()=>false;r.remove();images=[];r.paint(b,null,phys,30,true);assert.equal(images.length,4,'Removing the renderer clears cached frames');r.remove();
// Returning to a frequently used shape remains cheap under pressure; storage stays bounded.
r=renderer();for(let i=0;i<50;i++){r.paint(b,null,phys,30,true);r.paint(b,null,{...phys,key:'variant-'+i},30,true);}assert(r.status().cacheEntries<=32);assert(r.status().cachedPixels<=524288);assert(r.status().cachedChars<=2097152);images=[];r.paint(b,null,phys,30,true);assert.equal(images.length,0);r.remove();assert.equal(r.status().cacheEntries,0);
// The real event handler coalesces pointer moves and predicts CSS-rounded movement without reading after writes.
const handler=main.split("ball.addEventListener('pointermove', e => {")[1]?.split('\n});')[0];assert(handler);
let raf,reads=[],geometry,clock=500;
const state={id:1,moved:true,measureUntil:0,x:0,y:0,dx:10,dy:10,bounds:{minX:0,maxX:400,minY:0,maxY:800},material:phys};
const drag=vm.runInNewContext('(e=>{'+handler+'})',{ballDrag:state,dragRaf:0,performance:{now:()=>clock},requestAnimationFrame(fn){raf=fn;return 1;},ball:{getBoundingClientRect(){reads.push('read');return {left:100.25,top:200.25,width:48,height:48};}},fuseList:[],ballSdfOn:()=>true,clampTo:(v,a,b)=>Math.min(b,Math.max(a,v)),ballPos:{x:100.4,y:200.4},setBall(){reads.push('write');},updateFuse(g){geometry=g;}});
for(let i=0;i<10;i++)drag({pointerId:1,clientX:110.7+i*.1,clientY:210.7+i*.1});raf();assert.deepEqual(reads,['read','write']);assert.equal(geometry.left,102.25);assert.equal(geometry.top,202.25);
reads=[];drag({pointerId:1,clientX:112,clientY:212});raf();assert.deepEqual(reads,['write'],'Settled dragging must not read layout again');
state.rect=null;reads=[];drag({pointerId:1,clientX:113,clientY:213});raf();assert.deepEqual(reads,['read','write'],'Invalidated geometry must be measured again');
state.rect=null;state.measureUntil=1000;reads=[];drag({pointerId:1,clientX:114,clientY:214});raf();assert.equal(state.rect.settled,false);
clock=1100;reads=[];drag({pointerId:1,clientX:115,clientY:215});raf();assert.deepEqual(reads,['read','write'],'A final rectangle must be read after the scale transition');assert.equal(state.rect.settled,true);
clock=1200;reads=[];drag({pointerId:1,clientX:116,clientY:216});raf();assert.deepEqual(reads,['write']);
// Exceed the old all-at-once purge thresholds while frequently touching a useful map/table.
clearMaps();let warm=getMaps(80,32,16,options);for(let i=0;i<100;i++){getMaps(80,32,16,options);getMaps(82+i,32,16,{...options,ior:1.3+i*.001});}assert.equal(getMaps(80,32,16,options),warm,'Cache pressure must retain the recently used preset');
const table=lut('squircle',8,12,1.5,0);for(let i=0;i<55;i++){lut('squircle',8,12,1.5,0);lut('squircle',8,12,1.3+i*.002,0);}assert.equal(lut('squircle',8,12,1.5,0),table,'LUT pressure must evict one old entry, not every preset');
console.log(JSON.stringify({passed:true,checks:['translation and corner invalidation','bounded geometry reuse','preview/full/DPR restoration','reflection and removal cleanup','coalesced rounded drag with reads before writes','map and LUT cache pressure']},null,2));
