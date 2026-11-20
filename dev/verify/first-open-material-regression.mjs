import fs from 'node:fs/promises';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=await fs.readFile(process.env.NVWA_FIRST_OPEN_SOURCE||new URL('../../index.js',import.meta.url),'utf8');
const trackSource=source.slice(source.indexOf('function nearMessageViewport('),source.indexOf('function untrack(el) {'));
function initial(top,{hiddenChat=false}={}){const rect={top,bottom:top+100,left:0,right:344,width:344,height:100};const el={classList:{add(){}},getBoundingClientRect:()=>rect,style:{}};const items=new Map();let firstVisible;const context={uid:0,items,trackable:()=>true,document:{getElementById:()=>({getBoundingClientRect:()=>({top:0,bottom:hiddenChat?0:500,left:0,right:344,width:344,height:hiddenChat?0:500})})},getComputedStyle:()=>({position:'relative'}),visibleItems:new Set(),flickerCapture:null,isNativePopup:()=>false,ro:{observe(){}},io:{observe(){}},messageRendering:{track(){}},paint(e){firstVisible=items.get(e).visible},el};vm.runInNewContext(trackSource+';track(el,"mes")',context);return firstVisible;}
assert.equal(initial(20),true,'An onscreen message starts in its visible material');assert.equal(initial(600),true,'Match the 200px observer prewarm margin');assert.equal(initial(800),false,'Distant history remains lazy');assert.equal(initial(20,{hiddenChat:true}),false,'A hidden chat does not rasterise history');
let begin=source.indexOf('ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => {'),end=source.indexOf('\n});',begin)+4;assert(begin>0&&end>begin);const handler=source.slice(begin,end);for(const enabled of[true,false]){const calls=[];const c={S:{enabled},ctx:{eventTypes:{CHAT_CHANGED:'chat'},eventSource:{on(_,fn){fn()}}},performance:{now:()=>100},requestAnimationFrame:fn=>fn()};for(const name of['applyRoot','syncInputMaterial','syncHome','scan','applyTone','queueThink','scheduleFloor'])c[name]=()=>calls.push(name);vm.runInNewContext(handler,c);assert(!calls.includes('applyRoot'),'Entering a chat must not repaint the entire interface');assert.equal(calls.includes('scan'),enabled);assert.equal(calls.includes('applyTone'),enabled);}
const observerStart=source.indexOf('new MutationObserver(muts => {',source.indexOf('let riseQuietUntil'));const observerEnd=source.indexOf('}).observe(chatEl, { childList: true });',observerStart)+'}).observe(chatEl, { childList: true });'.length;const observer=source.slice(observerStart,observerEnd);for(const androidHost of[true,false]){let callback,animated=false;const el={nodeType:1,matches:()=>true,classList:{add(name){if(name==='ilg-rise')animated=true}},addEventListener(){}};const c={S:{enabled:true},androidHost,riseQuietUntil:0,performance:{now:()=>10000},document:{body:{classList:{contains:()=>true}}},MutationObserver:class{constructor(fn){callback=fn}observe(){}},chatEl:{},MES_SEL:'.mes',items:new Map(),trackMessages(){},untrack(){}};vm.runInNewContext(observer,c);callback([{removedNodes:[],addedNodes:[el]}]);assert.equal(animated,!androidHost,'Android avoids transform animation on new filtered messages');}
// The same first-paint geometry with at most one layout per write phase, not per row.
const items = new Map(), visibleItems = new Set(), firstPaints = new Map();
let writesPending = false, layoutFlushes = 0, viewportReads = 0;
const readLayout = () => { if (writesPending) { layoutFlushes++; writesPending = false; } };
const writeLayout = () => { writesPending = true; };
const rows = Array.from({ length: 64 }, (_, i) => ({
    classList: { add: writeLayout }, style: { set position(value) { assert.equal(value, 'relative'); writeLayout(); } },
    getBoundingClientRect() { readLayout(); return { left: 0, right: 344, top: i * 100, bottom: (i + 1) * 100, width: 344, height: 100 }; },
}));
const batch = vm.runInNewContext(trackSource + ';trackMessages', {
    items, visibleItems, uid: 0, trackable: () => true, isNativePopup: () => false, flickerCapture: null,
    document: { getElementById: () => ({ getBoundingClientRect() { viewportReads++; readLayout(); return { left: 0, right: 344, top: 0, bottom: 500, width: 344, height: 500 }; } }) },
    getComputedStyle: () => { readLayout(); return { position: 'static' }; },
    ro: { observe() {} }, io: { observe() {} }, messageRendering: { track() {} },
    measure(el) { readLayout(); const box = el.getBoundingClientRect(); return { w: box.width, h: box.height, r: 20 }; },
    paint(el, geo) { assert(!firstPaints.has(el)); firstPaints.set(el, { visible: items.get(el).visible, geo }); writeLayout(); },
});
batch([...rows, rows[0]]);
assert.equal(firstPaints.size, 64);
assert.equal(viewportReads, 1);
assert.equal(layoutFlushes, 2);
assert.deepEqual([...visibleItems], rows.slice(0, 7));
for (const [i, row] of rows.entries()) {
    assert.equal(firstPaints.get(row).visible, i < 7);
    assert.deepEqual(firstPaints.get(row).geo, { w: 344, h: 100, r: 20 });
}

console.log(JSON.stringify({passed:true,batchRows:64,batchLayoutFlushes:layoutFlushes,visibleMessageStartsReady:true,offscreenHistoryStaysLazy:true,chatChangePreservesGlobalMaterial:true,androidTransformEntrySuppressed:true,scope:'Actual track, chat-change handler and message observer; physical-phone flashing needs retest'}));
