import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createGlassPerformance} from '../../glass-performance.js';
import {reflectionGeometry,reflectionPixel,rasterReflection} from '../../reflection-raster.js';
const root=new URL('../../',import.meta.url);
const source=fs.readFileSync(new URL('glass-reflections.js',root),'utf8').replace(/^import .*$/gm,'').replace(/^export {reflectionPixel};?$/m,'').replace(/^export /gm,'');
const workers=[];class WorkerMock{constructor(){workers.push(this);this.messages=[];}postMessage(m){this.messages.push(m);}terminate(){this.terminated=true;}ready(){this.onmessage?.({data:{type:'ready',ok:true}});}finish(url='data:image/png;base64,fixture'){const m=this.messages.at(-1);this.onmessage?.({data:{type:'result',id:m.id,frame:{url}}});}}
const previous=globalThis.Worker;globalThis.Worker=WorkerMock;
const canvases=[],window={devicePixelRatio:2,addEventListener(){},removeEventListener(){}},body={classList:{contains:()=>false}};
const document={body,addEventListener(){},removeEventListener(){},createElement(tag){assert.equal(tag,'canvas');const canvas={width:0,height:0,getContext(){return{createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}},toDataURL(){canvases.push([this.width,this.height]);return'data:image/png;base64,fallback';}};return canvas;}};
const create=vm.runInNewContext(source+'\ncreateGlassReflections',{reflectionGeometry,reflectionPixel,rasterReflection,createGlassPerformance,document,window,matchMedia:()=>({matches:false,addEventListener(){}}),setTimeout,clearTimeout});
const element=()=>{const values=new Map(),classes=new Set();return{isConnected:true,matches:()=>true,classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:(...keys)=>keys.forEach(k=>classes.delete(k))},style:{getPropertyValue:k=>values.get(k)||'',setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}}};
const wait=()=>new Promise(r=>setTimeout(r,35));
const engine=create();try{
 engine.setEnabled(true);const worker=workers.at(-1),a=element(),b=element();engine.paint(a,320,240,22);engine.paint(b,320,240,22);assert.equal(worker.messages.length,0,'Startup must not synchronously rasterise an overlay');assert.equal(canvases.length,0);worker.ready();await wait();assert.equal(worker.messages.length,1,'Same-shape clients share one job');engine.paint(a,350,240,22);worker.finish();assert(!a.classList.contains('ilg-reflection'),'Stale size cannot reach a resized surface');assert(b.classList.contains('ilg-reflection'));assert.equal(worker.messages.length,2);worker.finish('data:image/png;base64,new-size');assert(a.style.getPropertyValue('--ilg-reflection-map').includes('new-size'));
 const count=worker.messages.length;engine.paint(element(),350,240,22);assert.equal(worker.messages.length,count,'Completed shape is reused');const detached=element();engine.paint(detached,360,250,22);detached.isConnected=false;worker.finish();assert(!detached.classList.contains('ilg-reflection'));
 engine.paint(a,370,260,22);engine.release(a);worker.finish();assert(!a.classList.contains('ilg-reflection'),'Released client cannot be resurrected');engine.paint(b,380,270,22);const late=worker.onmessage,m=worker.messages.at(-1);engine.setEnabled(false);late({data:{type:'result',id:m.id,frame:{url:'late'}}});assert(!b.classList.contains('ilg-reflection'));assert.equal(engine.status().queued,0);assert.equal(engine.status().waitingSurfaces,0);
 engine.setEnabled(true);const fallback=workers.at(-1),c=element();engine.paint(c,330,250,20);const expected=reflectionGeometry(330,250,20,2);window.devicePixelRatio=1;fallback.ready();await wait();fallback.onerror({preventDefault(){}});assert.deepEqual(canvases.at(-1),[expected.cw,expected.ch],'Fallback must use queued DPR');assert(c.classList.contains('ilg-reflection'));assert.equal(engine.status().mode,'sync');
 console.log(JSON.stringify({passed:true,startupWithoutMainRaster:true,deduplication:true,staleSize:true,cacheReuse:true,detachedAndReleased:true,disableLateResult:true,queuedDprFallback:true}));
}finally{engine.setEnabled(false);globalThis.Worker=previous;}
