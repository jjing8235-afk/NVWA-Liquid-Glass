// Opt-in cold entry / re-entry comparison. Keep times and rendering metadata only.
const ARM_KEY = 'ilg-flicker-capture-once';
const WINDOW_MS = 200;
const LIMIT_MS = 60000;
const MAX_STATES = 100;
const MAX_MARKS = 8;
const MAX_ATTRIBUTE_TARGETS = 120;
const rounded = n => Math.round(n * 10) / 10;

export function armFlickerCapture(win) {
    try { win.sessionStorage.setItem(ARM_KEY, String(Date.now())); }
    catch { return false; }
    win.location.reload();
    return true;
}

export function takeFlickerArm(win) {
    let value;
    try {
        value = win.sessionStorage.getItem(ARM_KEY);
        if (value === null) return false;
        win.sessionStorage.removeItem(ARM_KEY);
    } catch { return false; }
    const age = Date.now() - Number(value);
    return age >= 0 && age <= 120000;
}

export function filterFamily(style) {
    const filter = style?.backdropFilter || style?.webkitBackdropFilter;
    return !filter ? 'unset' : filter === 'none' ? 'none' : filter.includes('url(') ? 'svg' : 'css';
}

export function createFlickerCapture({win=window, doc=document, chat, form, describe, currentChat, environment, scriptOwner, onFinish}) {
    const now = () => win.performance.now();
    const started = now();
    const relative = t => Math.round(t - started);
    const windowAt = (phase, at) => {
        const index = Math.max(0, Math.min(LIMIT_MS / WINDOW_MS, Math.floor((at - phase.startedAtMs) / WINDOW_MS)));
        return phase.windows[index] ||= {atMs:phase.startedAtMs + index * WINDOW_MS};
    };
    const phases = [];
    const makePhase = name => {
        const phase = {name, startedAtMs:relative(now()), hostChanges:[], windows:[], states:[], marks:[], droppedStates:0, droppedMarks:0};
        phases.push(phase);
        return phase;
    };
    let phase = makePhase('first'), firstId, lastState = null, previousFrame = null, dirty = true;
    let active = true, raf, timer;
    const numbers = new WeakMap(), geometry = new WeakMap(), intersections = new WeakMap();
    let nextNumber = 0;
    const nodeNumber = el => {
        if (!numbers.has(el)) numbers.set(el, ++nextNumber);
        return numbers.get(el);
    };
    const supportedTiming = [];
    const observers = [];
    const viewport = () => [win.innerWidth, win.innerHeight, win.devicePixelRatio, rounded(win.visualViewport?.height ?? win.innerHeight), rounded(win.visualViewport?.scale ?? 1)];
    const navigation = win.performance.getEntriesByType('navigation')[0];
    function snapshot(force = false) {
        const state = {viewport:viewport(), ...describe(nodeNumber, el => geometry.get(el), el => intersections.get(el))};
        const key = JSON.stringify(state);
        if (!force && key === lastState) return;
        lastState = key;
        const entry = {atMs:relative(now()), ...state};
        // Preserve the entry sequence and keep the latest transitions if very busy.
        if (phase.states.length === MAX_STATES) { phase.states.splice(MAX_STATES / 2, 1); phase.droppedStates++; }
        phase.states.push(entry);
    }
    const increment = (key, count = 1) => {
        const bucket = windowAt(phase, relative(now()));
        bucket[key] = (bucket[key] || 0) + count;
    };
    function frame(time) {
        const bucket = windowAt(phase, relative(time));
        bucket.frames = (bucket.frames || 0) + 1;
        if (previousFrame !== null) bucket.maxFrameGapMs = rounded(Math.max(bucket.maxFrameGapMs || 0, time - previousFrame));
        previousFrame = time;
        if (dirty) { dirty = false; snapshot(); }
        raf = win.requestAnimationFrame(frame);
    }
    // Old values can be large in preset HTML (e.g. inline media URLs). Request
    // them only for class/style on message roots, not the entire subtree.
    const attributeTargets = new WeakSet();
    let attributeTargetCount = 0, attributeTargetsCapped = false;
    function compareAttributes(records) {
        if (!records.length) return;
        const bucket = windowAt(phase, relative(now()));
        const summary = bucket.messageAttributeValues ||= {};
        const next = new WeakMap();
        // Walk backwards so A -> B -> A counts as two real changes even
        // when both mutations arrive in one observer delivery.
        for (let i = records.length - 1; i >= 0; i--) {
            const {target, attributeName:name, oldValue} = records[i];
            let values = next.get(target);
            if (!values) next.set(target, values = new Map());
            const after = values.has(name) ? values.get(name) : target.getAttribute(name);
            values.set(name, oldValue);
            const totals = summary[name] ||= {same:0, changed:0};
            totals[after === oldValue ? 'same' : 'changed']++;
        }
    }
    const floorAttributes = new win.MutationObserver(compareAttributes);
    function observeFloorAttributes(el) {
        if (attributeTargets.has(el)) return;
        if (attributeTargetCount >= MAX_ATTRIBUTE_TARGETS) { attributeTargetsCapped = true; return; }
        attributeTargets.add(el); attributeTargetCount++;
        floorAttributes.observe(el, {attributes:true, attributeFilter:['class','style'], attributeOldValue:true});
    }
    for (const el of chat.children) if (el.matches('.mes')) observeFloorAttributes(el);
    function mutations(records) {
        let added = 0, removed = 0, content = 0, messageAttrs = 0, shellAttrs = 0;
        for (const m of records) {
            if (m.target === chat && m.type === 'childList') {
                for (const node of m.addedNodes) if (node.nodeType === 1 && node.matches('.mes')) { added++; observeFloorAttributes(node); }
                for (const node of m.removedNodes) if (node.nodeType === 1 && node.matches('.mes')) removed++;
            } else if (m.type === 'attributes' && m.target.matches('.mes')) messageAttrs++;
            else if (m.target === chat || m.target === doc.body || m.target === doc.documentElement || m.target.id === 'form_sheld') shellAttrs++;
            else content++;
        }
        if (added) {
            increment('messageMounts', added);
            phase.firstMountMs ??= relative(now());
            if (phase.name === 'first' && firstId == null) firstId = currentChat();
        }
        if (removed) increment('messageRemovals', removed);
        if (messageAttrs) increment('messageAttrChanges', messageAttrs);
        if (shellAttrs) increment('shellAttrChanges', shellAttrs);
        if (content) increment('descendantMutations', content);
        dirty = true;
    }
    const dom = new win.MutationObserver(mutations);
    dom.observe(chat, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['style','class','hidden','open','src']});
    for (const target of [doc.documentElement, doc.body, form]) {
        if (target) dom.observe(target, {attributes:true, attributeFilter:['class','style','hidden']});
    }

    // Observe only the two layout containers not already measured by NVWA surfaces.
    const shell = new win.ResizeObserver(entries => {
        for (const {target, contentRect:r} of entries) geometry.set(target, [rounded(r.width), rounded(r.height)]);
        increment('layoutBoxUpdates', entries.length);
        dirty = true;
    });
    shell.observe(chat); shell.observe(form);

    function timings(type, entries) {
        for (const e of entries) {
            if (e.startTime < started && !(type === 'resource' && e.responseEnd >= started)) continue;
            const at = relative(type === 'resource' ? e.responseEnd : e.startTime);
            const p = phases.findLast(p => p.startedAtMs <= at) || phases[0];
            const bucket = windowAt(p, at);
            if (type === 'layout-shift') {
                // No attribution nodes, coordinates or recent input payload.
                bucket.layoutShifts = (bucket.layoutShifts || 0) + 1;
                bucket.shiftScore = rounded((bucket.shiftScore || 0) * 1000 + e.value * 1000) / 1000;
            } else if (type === 'resource') {
                const source = ['img','css','link','script','iframe','video','audio'].includes(e.initiatorType) ? e.initiatorType : null;
                if (source) { const assets = bucket.assetCompletions ||= {}; assets[source] = (assets[source] || 0) + 1; }
            } else {
                const key = type === 'longtask' ? 'mainThreadTasks' : 'longAnimationFrames';
                const stats = bucket[key] ||= {count:0,maxMs:0};
                stats.count++; stats.maxMs = Math.max(stats.maxMs, rounded(e.duration));
                if (type === 'long-animation-frame') for (const script of Array.from(e.scripts || []).slice(0,24)) {
                    const owner = scriptOwner(script.sourceURL);
                    const row = (bucket.scriptOwners ||= {})[owner] ||= {count:0, totalMs:0, forcedLayoutMs:0};
                    row.count++;
                    row.totalMs = rounded(row.totalMs + (script.duration || 0));
                    row.forcedLayoutMs = rounded(row.forcedLayoutMs + (script.forcedStyleAndLayoutDuration || 0));
                }
            }
        }
    }
    for (const type of ['longtask','long-animation-frame','layout-shift','resource']) {
        if (!win.PerformanceObserver?.supportedEntryTypes?.includes(type)) continue;
        const observer = new win.PerformanceObserver(list => timings(type, list.getEntries()));
        observer.observe({type, buffered:type === 'resource'});
        observers.push([type, observer]); supportedTiming.push(type);
    }
    const scroll = () => { increment('scrolls'); dirty = true; };
    const resize = () => { increment('viewportChanges'); dirty = true; };
    const font = () => { increment('fontEvents'); dirty = true; };
    const asset = event => {
        const key = {IMG:'image',IFRAME:'iframe',VIDEO:'video',AUDIO:'audio',LINK:'link'}[event.target?.tagName];
        if (key) increment(event.type === 'error' ? 'assetErrors' : key + 'Loads');
    };
    const error = e => increment(e.type === 'unhandledrejection' ? 'rejections' : /^ResizeObserver loop/.test(e.message || '') ? 'resizeObserverLoops' : 'runtimeErrors');
    const hidden = () => { if (doc.hidden) finish('hidden'); };
    const pagehide = () => finish('pagehide');
    const listeners = [[chat,'scroll',scroll],[win,'resize',resize],[win.visualViewport,'resize',resize],[doc.fonts,'loading',font],[doc.fonts,'loadingdone',font],[doc.fonts,'loadingerror',font],[chat,'load',asset],[chat,'error',asset],[win,'error',error],[win,'unhandledrejection',error],[doc,'visibilitychange',hidden],[win,'pagehide',pagehide]];
    for (const [target,event,fn] of listeners) target?.addEventListener(event,fn,{capture:true,passive:true});
    const hadMessagesAtStart = !!chat.querySelector(':scope > .mes');
    if (hadMessagesAtStart) firstId = currentChat();
    const boot = {startedAtNavigationMs:Math.round(started), navigation:navigation?.type === 'reload' ? 'reload' : 'other', hadMessagesAtStart};
    function chatChanged() {
        const id = currentChat();
        if (phase.name === 'first' && id != null && firstId == null) firstId = id;
        if (phase.hostChanges.length < 24) phase.hostChanges.push({atMs:relative(now()), match:id == null ? 'no-chat-id' : firstId == null ? 'unknown' : id === firstId ? 'same-as-first' : 'different-chat'});
        dirty = true;
    }
    function finish(reason = 'exported') {
        if (!active) return;
        mutations(dom.takeRecords()); compareAttributes(floorAttributes.takeRecords()); snapshot(true);
        active = false;
        win.cancelAnimationFrame(raf); win.clearTimeout(timer); dom.disconnect(); floorAttributes.disconnect(); shell.disconnect();
        for (const [type, observer] of observers) { timings(type, observer.takeRecords()); observer.disconnect(); }
        for (const [target,event,fn] of listeners) target?.removeEventListener(event,fn,true);
        firstId = null;
        const coverage = phases.map(p => ({phase:p.name, mounted:p.firstMountMs !== undefined, presentAtStart:p.name === 'first' && hadMessagesAtStart, scrolled:p.windows.some(w => w?.scrolls > 0), marked:p.marks.length > 0, sameChatEvent:p.hostChanges.some(e => e.match === 'same-as-first')}));
        onFinish({format:'nvwa-flicker-comparison-2', environment, boot, durationMs:relative(now()), reason, windowMs:WINDOW_MS, supportedTiming, coverage,
            attributeSample:{targets:attributeTargetCount, capped:attributeTargetsCapped},
            phases:phases.map(p => ({...p,windows:p.windows.filter(Boolean)})),
            limits:['Manual markers indicate when the user pressed the button, not the exact missing frame.','Page timings and DOM state cannot observe compositor output or display pixels.','Attribute comparison covers class and style on sampled message roots after attachment; writes from the initial mount can be missed.','No chat text, IDs, URLs, resource names, errors, attribute values or screen images are exported.']});
    }
    snapshot(true);
    raf = win.requestAnimationFrame(frame);
    timer = win.setTimeout(() => finish('timeout'), LIMIT_MS);
    return {
        chatChanged,
        widthFeedback(reason) {
            const bucket = windowAt(phase, relative(now()));
            const counts = bucket.offscreenWidthFeedback ||= {};
            counts[reason] = (counts[reason] || 0) + 1;
        },
        messagePaints(reason, count) {
            if (!count) return;
            const bucket = windowAt(phase, relative(now()));
            const counts = bucket.messagePaints ||= {};
            counts[reason] = (counts[reason] || 0) + count;
        },
        geometry(entries) {
            for (const [el,{w,h}] of entries) geometry.set(el, [w,h]);
            dirty = true;
        },
        intersections(entries) {
            for (const e of entries) {
                // NVWA prewarms 200px outside the chat; distinguish that margin from visible pixels.
                const r = e.intersectionRect, b = e.rootBounds;
                const visible = !!(b && r.width > 0 && Math.min(r.bottom, b.bottom - 200) > Math.max(r.top, b.top + 200));
                intersections.set(e.target, visible ? 'visible' : e.isIntersecting ? 'near' : 'outside');
            }
            dirty = true;
        },
        mark() {
            if (phase.marks.length === MAX_MARKS) { phase.droppedMarks++; return; }
            phase.marks.push(relative(now()));
            snapshot(true);
        },
        next() {
            if (phase.name !== 'first') return false;
            const pending = dom.takeRecords(); if (pending.length) mutations(pending);
            compareAttributes(floorAttributes.takeRecords());
            snapshot(true); phase = makePhase('reentry'); lastState = null;
            snapshot(true);
            return true;
        },
        finish,
    };
}
