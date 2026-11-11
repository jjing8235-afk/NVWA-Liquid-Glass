// Manual, bounded local capture. Never retain event text, keys, URLs or error messages.
const SCENARIOS = ['general', 'appearance', 'rendering', 'keyboard'];
const MARKERS = new Set(['appearance-request', 'appearance-result', 'wallpaper-recovery']);
const ENUMS = {
    mode: ['light', 'dark', 'custom'],
    route: ['thumbnail', 'host-settings'],
    outcome: ['dispatched', 'unavailable', 'superseded'],
    phase: ['idle', 'checking', 'uploading', 'verifying', 'refreshing', 'ready', 'failed'],
};
const ERROR_NAMES = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'AbortError']);
const EVENTS = { composerFocuses:0, composerBlurs:0, ballDrags:0, ballMoves:0, chatScrolls:0, composerInputs:0,
    windowResizes:0, orientationChanges:0, visualResizes:0, visualScrolls:0, appearanceClicks:0,
    compositionStarts:0, compositionEnds:0, runtimeErrors:0, unhandledRejections:0 };
const cleanDetails = details => {
    const out = {};
    for (const [key, values] of Object.entries(ENUMS)) if (values.includes(details?.[key])) out[key] = details[key];
    if (/^(?:inventory|asset|upload)-http-\d{3}$|^(?:inventory-shape|asset-empty|verification-missing|request-timeout|request-failed|refresh-unavailable|chat-background-locked|native-api-unavailable|background-not-applied|native-selection-failed)$/.test(details?.code || '')) out.code = details.code;
    return out;
};
export function createInteractionDiagnostics({snapshot=()=>({}),onFinish=()=>{},onProgress=()=>{},durationMs=15000,win=window,doc=document}={}) {
    const limit = Math.max(1000, Math.min(15000, Number(durationMs)||15000));
    let active=null, last=null, raf=0, timer=0, observers=[];
    const now = () => win.performance.now();
    const elapsed = data => Math.max(0, Math.round(now()-data.started));
    const notify = (fn, value) => { try { fn(value); } catch { /* UI must not break capture cleanup. */ } };
    const safeSnapshot = () => { try { return snapshot(); } catch { return {unavailable:true}; } };
    const percentile = (hist,n,p) => { if(!n)return null;let sum=0;for(let i=0;i<hist.length;i++){sum+=hist[i];if(sum>=Math.ceil(n*p))return i===255?'255+':i;}return null; };
    function bucket(data, at=elapsed(data)) {
        const second=Math.min(14,Math.floor(at/1000));
        return data.windows[second] ||= {second,frames:{samples:0,totalMs:0,maxMs:0,over50ms:0},events:{},longTasks:{count:0,maxMs:0}};
    }
    function record(type, details={}) {
        if(!active)return false;
        if(active.timeline.length<80)active.timeline.push({atMs:elapsed(active),type,...details});else active.droppedMarkers++;
        return true;
    }
    function checkpoint() {
        if(!active||active.checkpoints.length>=17)return;
        const start=now(),data=active,state=safeSnapshot();
        data.snapshotCostMs+=Math.max(0,now()-start);
        data.checkpoints.push({atMs:elapsed(data),state});
    }
    const count = key => { if(active){active.events[key]++;const events=bucket(active).events;events[key]=(events[key]||0)+1;} };
    function viewport() {
        if(!active)return;
        for(const [key,value] of Object.entries({width:win.innerWidth,height:win.innerHeight,visualHeight:win.visualViewport?.height,visualOffsetTop:win.visualViewport?.offsetTop,visualScale:win.visualViewport?.scale})) {
            if(!Number.isFinite(value))continue;
            const range=active.viewportRange[key];
            if(range){range.min=Math.min(range.min,value);range.max=Math.max(range.max,value);}else active.viewportRange[key]={min:value,max:value};
        }
    }
    function finishDrag(reason) {
        if(!active?.drag)return;
        const drag=active.drag;active.drag=null;
        const value={startMs:drag.startMs,durationMs:Math.max(0,elapsed(active)-drag.startMs),moves:drag.moves,reason};
        if(active.drags.length<12)active.drags.push(value);else active.droppedDrags++;
        record('ball-drag-end',{reason});
    }
    const role = target => {
        for(const [selector,name] of [['#ilg-ball','ball'],['#send_textarea','composer'],['#ilg-tone-button, #ilg-appearance-panel','appearance'],['#ilg-capture-badge, #ilg-interaction-diagnostics','capture'],['#chat','chat']]) {
            if(target?.closest?.(selector))return name;
        }
        return 'other';
    };
    function processLongTasks(entries) {
        if(!active)return;
        for(const e of entries){if(!Number.isFinite(e.duration)||!Number.isFinite(e.startTime)||e.startTime<active.started)continue;
            active.longCount++;active.longMax=Math.max(active.longMax,e.duration);
            const b=bucket(active,e.startTime-active.started);b.longTasks.count++;b.longTasks.maxMs=Math.max(b.longTasks.maxMs,e.duration);
        }
    }
    function processEventTiming(entries) {
        if(!active)return;
        for(const e of entries){if(!Number.isFinite(e.startTime)||e.startTime<active.started||!Number.isFinite(e.duration)||!Number.isFinite(e.processingStart))continue;
            const delay=Math.max(0,e.processingStart-e.startTime),handler=Math.max(0,(Number(e.processingEnd)||e.processingStart)-e.processingStart);
            active.inputTiming.count++;active.inputTiming.maxDelayMs=Math.max(active.inputTiming.maxDelayMs,delay);active.inputTiming.maxDurationMs=Math.max(active.inputTiming.maxDurationMs,e.duration);
            const sample={atMs:Math.round(e.startTime-active.started),role:role(e.target),durationMs:Math.round(e.duration),inputDelayMs:Math.round(delay),handlerMs:Math.round(handler)};
            active.inputTiming.slowest.push(sample);active.inputTiming.slowest.sort((a,b)=>b.durationMs-a.durationMs);active.inputTiming.slowest.length=Math.min(8,active.inputTiming.slowest.length);
        }
    }
    function cleanup() {
        if(raf)win.cancelAnimationFrame(raf);raf=0;win.clearTimeout(timer);timer=0;
        for(const {observer} of observers)observer.disconnect();observers=[];
        for(const [target,name,fn] of listeners)target?.removeEventListener(name,fn,true);
    }
    function finish(reason='manual') {
        if(!active)return last;
        for(const {observer,process} of observers){try{process(observer.takeRecords());}catch{ /* Some observers have no pending-record API. */ }}
        finishDrag(reason);viewport();checkpoint();
        const data=active;active=null;cleanup();
        const duration=elapsed(data),observed={chatScroll:data.events.chatScrolls>0,ballDrag:data.events.ballDrags>0,composerInput:data.events.composerInputs>0,visualViewportChange:data.events.visualResizes>0,appearanceAttempt:data.events.appearanceClicks>0||data.appearanceAttempts>0,wallpaperRecovery:data.wallpaperAttempts>0};
        const expected={general:['chatScroll','ballDrag','composerInput'],appearance:['appearanceAttempt'],rendering:['chatScroll'],keyboard:['composerInput','ballDrag','visualViewportChange']}[data.scenario];
        const notes=[];if(reason!=='timeout')notes.push('ended-early');if(data.frames<5)notes.push('too-few-frame-samples');
        if(!data.longTaskSupport)notes.push('longtask-api-unavailable');if(!data.inputTiming.supported)notes.push('event-timing-api-unavailable');
        last={format:'nvwa-interaction-2',scenario:data.scenario,reason,durationMs:duration,
            frameIntervals:{samples:data.frames,meanMs:data.frames?+(data.sum/data.frames).toFixed(2):null,p50Ms:percentile(data.hist,data.frames,.5),p95Ms:percentile(data.hist,data.frames,.95),maxMs:+data.max.toFixed(2),over34ms:data.over34,over50ms:data.over50,over100ms:data.over100},
            events:{...data.events},viewportRange:data.viewportRange,longTasks:{supported:data.longTaskSupport,count:data.longCount,maxMs:+data.longMax.toFixed(2)},inputTiming:data.inputTiming,
            start:data.start,end:data.checkpoints.at(-1)?.state||safeSnapshot(),checkpoints:data.checkpoints,timeline:data.timeline,
            windows:data.windows.filter(Boolean).map(b=>({...b,frames:{...b.frames,meanMs:b.frames.samples?+(b.frames.totalMs/b.frames.samples).toFixed(2):null}})),stalls:data.stalls,drags:data.drags,
            coverage:{observed,missing:expected.filter(key=>!observed[key])},quality:{fullDuration:reason==='timeout'&&duration>=limit-100,notes,droppedMarkers:data.droppedMarkers,droppedDrags:data.droppedDrags,snapshots:data.checkpoints.length,snapshotCostMs:+data.snapshotCostMs.toFixed(2)},
            interpretation:'Page callback gaps and optional slow event timings; not display refresh rate, flicker detection, GPU frames, end-to-end touch latency or INP. Snapshot overhead is included.'};
        notify(onFinish,last);return last;
    }
    function frame(t) {
        if(!active)return;
        const data=active;
        if(data.previous!==null){const gap=t-data.previous;if(gap>=0&&Number.isFinite(gap)){
            data.frames++;data.sum+=gap;data.max=Math.max(data.max,gap);data.hist[Math.min(255,Math.round(gap))]++;
            if(gap>34)data.over34++;if(gap>50)data.over50++;if(gap>100)data.over100++;
            const b=bucket(data);b.frames.samples++;b.frames.totalMs+=gap;b.frames.maxMs=Math.max(b.frames.maxMs,gap);if(gap>50)b.frames.over50ms++;
            if(gap>50){data.stalls.push({atMs:elapsed(data),gapMs:+gap.toFixed(2),during:data.drag?'ball-drag':data.composing?'composition':data.focused?'composer':'page'});data.stalls.sort((a,b)=>b.gapMs-a.gapMs);data.stalls.length=Math.min(8,data.stalls.length);}
        }}
        data.previous=t;
        if(elapsed(data)>=data.nextCheckpoint){checkpoint();data.nextCheckpoint=(Math.floor(elapsed(data)/1000)+1)*1000;notify(onProgress,{elapsedMs:elapsed(data),remainingMs:Math.max(0,limit-elapsed(data))});}
        raf=win.requestAnimationFrame(frame);
    }
    const focused=e=>{if(e.target?.id==='send_textarea'){count('composerFocuses');if(active)active.focused=true;record('composer-focus');}viewport();};
    const blurred=e=>{if(e.target?.id==='send_textarea'){count('composerBlurs');if(active)active.focused=false;record('composer-blur');}viewport();};
    const pointerDown=e=>{if(active&&e.target?.closest?.('#ilg-ball')){finishDrag('replaced');active.drag={id:e.pointerId,startMs:elapsed(active),moves:0};count('ballDrags');record('ball-drag-start');}};
    const pointerMove=e=>{if(active?.drag&&active.drag.id===e.pointerId){active.drag.moves++;count('ballMoves');}};
    const pointerUp=e=>{if(active?.drag&&active.drag.id===e.pointerId)finishDrag(e.type==='pointercancel'?'cancel':'up');};
    const scroll=e=>{if(e.target?.id==='chat'){if(active&&!active.events.chatScrolls)record('chat-scroll');count('chatScrolls');}};
    const input=e=>{if(e.target?.id==='send_textarea'){if(active&&!active.events.composerInputs)record('composer-input');count('composerInputs');}};
    const composition=e=>{if(active&&e.target?.id==='send_textarea'){active.composing=e.type==='compositionstart';count(active.composing?'compositionStarts':'compositionEnds');record(active.composing?'composition-start':'composition-end');}};
    const clicked=e=>{if(e.target?.closest?.('#ilg-tone-button')){count('appearanceClicks');record('appearance-click');}};
    const runtimeError=e=>{if(!active)return;count(e.type==='unhandledrejection'?'unhandledRejections':'runtimeErrors');const name=(e.type==='unhandledrejection'?e.reason:e.error)?.name;record('page-error',{kind:ERROR_NAMES.has(name)?name:'Other',source:e.type==='unhandledrejection'?'rejection':'error'});};
    const listeners=[[doc,'pointerdown',pointerDown],[doc,'pointermove',pointerMove],[doc,'pointerup',pointerUp],[doc,'pointercancel',pointerUp],[doc,'scroll',scroll],[doc,'input',input],[doc,'click',clicked],[doc,'compositionstart',composition],[doc,'compositionend',composition],
        [doc,'visibilitychange',()=>{if(doc.hidden)finish('hidden');}],[doc,'focusin',focused],[doc,'focusout',blurred],
        [win,'pagehide',()=>finish('pagehide')],[win,'error',runtimeError],[win,'unhandledrejection',runtimeError],
        [win,'resize',()=>{count('windowResizes');viewport();}],[win,'orientationchange',()=>{count('orientationChanges');record('orientation-change');viewport();}],
        [win.visualViewport,'resize',()=>{count('visualResizes');viewport();}],[win.visualViewport,'scroll',()=>{count('visualScrolls');viewport();}]];
    return {
        start({scenario='general'}={}) {
            if(active||doc.hidden)return false;
            last=null;active={scenario:SCENARIOS.includes(scenario)?scenario:'general',started:now(),previous:null,nextCheckpoint:1000,frames:0,sum:0,max:0,hist:new Uint32Array(256),over34:0,over50:0,over100:0,drag:null,drags:[],droppedDrags:0,focused:false,composing:false,
                longTaskSupport:false,longCount:0,longMax:0,inputTiming:{supported:false,thresholdMs:40,count:0,maxDelayMs:0,maxDurationMs:0,slowest:[]},viewportRange:{},events:{...EVENTS},windows:[],stalls:[],timeline:[],droppedMarkers:0,appearanceAttempts:0,wallpaperAttempts:0,checkpoints:[],snapshotCostMs:0};
            checkpoint();active.start=active.checkpoints[0].state;viewport();record('capture-start');
            for(const [target,name,fn] of listeners)target?.addEventListener(name,fn,{capture:true,passive:true});
            for(const [type,process] of [['longtask',processLongTasks],['event',processEventTiming]]){
                let observer;
                try{if(win.PerformanceObserver?.supportedEntryTypes?.includes(type)){observer=new win.PerformanceObserver(list=>process(list.getEntries()));observer.observe({type,buffered:false,...(type==='event'?{durationThreshold:40}:{})});observers.push({observer,process});if(type==='longtask')active.longTaskSupport=true;else active.inputTiming.supported=true;}}catch{observer?.disconnect();}
            }
            raf=win.requestAnimationFrame(frame);timer=win.setTimeout(()=>finish('timeout'),limit);notify(onProgress,{elapsedMs:0,remainingMs:limit});return true;
        },
        mark(type,details={}) {if(!active||!MARKERS.has(type))return false;if(type==='appearance-request')active.appearanceAttempts++;if(type==='wallpaper-recovery')active.wallpaperAttempts++;return record(type,cleanDetails(details));},
        stop:finish,report:()=>active?{recording:true,scenario:active.scenario,elapsedMs:elapsed(active)}:last,
        status:()=>({recording:!!active,hasResult:!!last,durationMs:limit}),
        destroy(){if(active){active=null;cleanup();}last=null;}
    };
}
