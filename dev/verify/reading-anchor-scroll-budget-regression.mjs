// Execute the real reading-anchor controller with deterministic gesture frames.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {externalScrollControl} from '../../chat-compat.js';
const source=fs.readFileSync(new URL('../../viewport.js',import.meta.url),'utf8');
let now=1000,uid=0,reads=0;const frames=new Map(),timers=new Map(),listeners=new Map();
const heights=Array(16).fill(300);
const chat={classList:{contains:()=>false},scrollTop:900,clientHeight:400,get scrollHeight(){reads++;return heights.reduce((a,b)=>a+b,0)},getBoundingClientRect(){reads++;return {top:0}},addEventListener(type,fn){listeners.set(type,fn)},removeEventListener(type){listeners.delete(type)}};
chat.children=heights.map((_,i)=>({isConnected:true,classList:{contains:c=>c==='mes'},getBoundingClientRect(){reads++;const top=heights.slice(0,i).reduce((a,b)=>a+b,0)-chat.scrollTop;return {top,bottom:top+heights[i]}}}));
const context={chat,externalScrollControl,MutationObserver:class{observe(){}disconnect(){}},performance:{now:()=>now},getComputedStyle:()=>({paddingTop:'0'}),requestAnimationFrame:fn=>{const id=++uid;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,delay)=>{const id=++uid;timers.set(id,{fn,at:now+delay});return id},clearTimeout:id=>timers.delete(id),ResizeObserver:class{observe(){}disconnect(){}},onViewportChange:()=>()=>{}};
vm.runInNewContext(source.slice(source.indexOf('export function createReadingAnchor')).replace('export function','function')+';globalThis.controller=createReadingAnchor({chat,enabled:()=>true});',context);
function frame(ms=16){now+=ms;for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn()}const pending=[...frames];frames.clear();for(const [,fn]of pending)fn();}
listeners.get('touchstart')({type:'touchstart'});reads=0;
for(let i=0;i<100;i++){chat.scrollTop=1000+i*10;listeners.get('scroll')({type:'scroll'});frame();}
const gestureReads=reads;
assert.equal(gestureReads,0,'Reading anchor forces geometry reads during every active scroll frame');
frame(400);assert(context.controller.anchor,'Capture the new reading point once the gesture settles');
const anchored=context.controller.anchor,oldOffset=anchored.offset,before=chat.scrollTop;heights[0]+=80;
listeners.get('load')({target:{tagName:'IMG'}});frame();
assert.equal(chat.scrollTop,before+80,'Stationary image growth must preserve the settled reading point');
assert.equal(anchored.el.getBoundingClientRect().top,oldOffset);
frame();listeners.get('touchstart')({type:'touchstart'});listeners.get('scroll')({type:'scroll'});context.controller.destroy();reads=0;frame(500);assert.equal(reads,0,'Destroy cancels the deferred reading capture');
console.log(JSON.stringify({passed:true,gestureFrames:100,geometryReadsDuringGesture:gestureReads,idleCapture:true,stationaryImageGrowth:true,destroyCancelsIdleCapture:true}));
