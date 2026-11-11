import assert from'node:assert/strict';import{createInteractionDiagnostics}from'../../interaction-diagnostics.js';
const target=()=>{const listeners=new Map();return{addEventListener(k,f){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f)},removeEventListener(k,f){listeners.get(k)?.delete(f)},emit(k,event={}){for(const fn of [...listeners.get(k)||[]])fn(event)},count:()=>[...listeners.values()].reduce((n,s)=>n+s.size,0)}};
let now=0,serial=0,finished=0;const frames=new Map(),timers=new Map(),doc=Object.assign(target(),{hidden:false}),vv=Object.assign(target(),{height:778,offsetTop:0,scale:1}),win=Object.assign(target(),{innerWidth:402,innerHeight:778,visualViewport:vv,performance:{now:()=>now},requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id),setTimeout:fn=>{const id=++serial;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)}),capture=createInteractionDiagnostics({win,doc,snapshot:()=>({fixedNumericField:42}),onFinish:()=>finished++});
assert.equal(doc.count()+win.count()+vv.count()+frames.size+timers.size,0,'No passive background sampling before opt-in');assert(capture.start());assert.equal(capture.start(),false);const advance=ms=>{now+=ms;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now))};advance(10);advance(16);advance(20);advance(60);const ball={closest:s=>s==='#ilg-ball'},event={pointerId:4,target:ball,text:'PRIVATE_SAMPLE_TEXT',url:'PRIVATE_URL'};doc.emit('pointerdown',event);doc.emit('pointermove',event);doc.emit('pointermove',{...event,pointerId:5});doc.emit('pointerup',event);doc.emit('scroll',{target:{id:'chat'}});doc.emit('input',{target:{id:'send_textarea',value:'PRIVATE_DRAFT'}});doc.emit('focusin',{target:{id:'send_textarea'}});vv.height=410;vv.emit('resize');vv.offsetTop=40;vv.emit('scroll');vv.height=778;vv.emit('resize');const result=capture.stop();assert.equal(result.frameIntervals.samples,3);assert.equal(result.frameIntervals.maxMs,60);assert.equal(result.frameIntervals.over50ms,1);assert.equal(result.frameIntervals.p95Ms,60);assert.equal(result.events.ballDrags,1);assert.equal(result.events.ballMoves,1);assert.equal(result.events.composerInputs,1);assert.equal(result.events.composerFocuses,1);assert.equal(result.events.visualResizes,2);assert.deepEqual(result.viewportRange.visualHeight,{min:410,max:778});assert.equal(result.longTasks.supported,false);assert(!/PRIVATE/.test(JSON.stringify(result)));assert.equal(doc.count()+win.count()+vv.count()+frames.size+timers.size,0,'Finish removes all capture work');assert.equal(finished,1);assert.equal(capture.stop(),result);capture.start();advance(20);doc.hidden=true;doc.emit('visibilitychange');assert.equal(capture.report().reason,'hidden');assert.equal(frames.size+timers.size,0);assert.equal(capture.start(),false);doc.hidden=false;capture.start();const end=[...timers.values()][0];now+=15000;end();assert.equal(capture.report().reason,'timeout');assert.equal(frames.size+timers.size,0);capture.start();capture.destroy();assert.equal(capture.report(),null);assert.equal(doc.count()+win.count()+vv.count()+frames.size+timers.size,0);console.log(JSON.stringify({passed:true,optInOnly:true,boundedHistogram:true,manualAndTimeout:true,hiddenStops:true,viewportRange:true,dragCounts:true,noTextOrURLs:true,unsupportedLongTasks:true,cleanup:true}));

// A capture must retain the action/state surrounding a stall, without event payloads.
doc.hidden=false;let state=0;
const detail=createInteractionDiagnostics({win,doc,snapshot:()=>({stage:state})});
assert(detail.start({scenario:'appearance'}));
advance(16);state=1;advance(1100);
assert.equal(typeof detail.mark,'function','Appearance and recovery need structured capture markers');
assert.equal(detail.mark('appearance-request',{mode:'dark',url:'PRIVATE_URL',text:'PRIVATE_TEXT'}),true);
doc.emit('click',{target:{closest:s=>s==='#ilg-tone-button'}});
advance(120);detail.mark('appearance-result',{mode:'dark',outcome:'dispatched'});
const v2=detail.stop();assert.equal(v2.format,'nvwa-interaction-2');assert.equal(v2.scenario,'appearance');
assert(v2.checkpoints.some(x=>x.state.stage===1),'Intermediate state is retained');
assert(v2.timeline.some(x=>x.type==='appearance-request'&&x.mode==='dark'));
assert(v2.windows.some(x=>x.frames.maxMs>=1100),'The slow second remains identifiable');
assert(v2.coverage.observed.appearanceAttempt);assert(!v2.coverage.observed.composerInput);
assert(v2.stalls.length>0);assert(!/PRIVATE/.test(JSON.stringify(v2)));
assert.equal(doc.count()+win.count()+vv.count()+frames.size+timers.size,0);
console.log('PASS time-correlated checkpoints, stalls, coverage and safe markers');

// Bounded logs, interrupted drags, and observer records still waiting at stop.
const caps=createInteractionDiagnostics({win,doc});caps.start({scenario:'PRIVATE_SCENARIO'});
for(let i=0;i<300;i++)caps.mark('appearance-request',{mode:'light',url:'PRIVATE_URL'});
assert.equal(caps.mark('PRIVATE_EVENT',{mode:'dark'}),false);
doc.emit('pointerdown',{pointerId:9,target:ball});advance(24);doc.emit('pointercancel',{type:'pointercancel',pointerId:9});
win.emit('error',{type:'error',error:new TypeError('PRIVATE_ERROR_MESSAGE'),filename:'PRIVATE_URL'});
win.emit('unhandledrejection',{type:'unhandledrejection',reason:new Error('PRIVATE_REJECTION')});
doc.emit('compositionstart',{type:'compositionstart',target:{id:'send_textarea'},data:'PRIVATE_INPUT'});
doc.emit('compositionend',{type:'compositionend',target:{id:'send_textarea'},data:'PRIVATE_INPUT'});
win.emit('pagehide');const bounded=caps.report();assert.equal(bounded.scenario,'general');assert.equal(bounded.reason,'pagehide');assert.equal(bounded.timeline.length,80);assert(bounded.quality.droppedMarkers>0);assert.equal(bounded.drags[0].reason,'cancel');assert.equal(bounded.events.runtimeErrors,1);assert.equal(bounded.events.unhandledRejections,1);assert(!/PRIVATE/.test(JSON.stringify(bounded)));
let disconnected=0;const pending=[];win.PerformanceObserver=class{static supportedEntryTypes=['longtask','event'];constructor(cb){this.cb=cb;pending.push(this)}observe(options){this.options=options;this.rows=[]}takeRecords(){const rows=this.rows;this.rows=[];return rows}disconnect(){disconnected++}};
const observers=createInteractionDiagnostics({win,doc});observers.start();
pending.find(x=>x.options.type==='longtask').rows.push({startTime:now+1,duration:99,attribution:'PRIVATE_ATTRIBUTION'});
pending.find(x=>x.options.type==='event').rows.push({startTime:now+1,duration:80,processingStart:now+25,processingEnd:now+40,name:'PRIVATE_EVENT_NAME',target:{closest:()=>false},key:'PRIVATE_KEY'});
advance(120);const observed=observers.stop();assert.equal(observed.longTasks.count,1);assert.equal(observed.longTasks.maxMs,99);assert.equal(observed.inputTiming.count,1);assert.equal(observed.inputTiming.maxDelayMs,24);assert.equal(disconnected,2);assert(!/PRIVATE/.test(JSON.stringify(observed)));delete win.PerformanceObserver;
assert.equal(doc.count()+win.count()+vv.count()+frames.size+timers.size,0);
console.log('PASS capped records, error privacy, composition, cancellation, pagehide and observer draining');
