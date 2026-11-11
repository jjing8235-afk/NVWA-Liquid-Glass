// One worker and one replaceable pending task for NVWA-owned glass work.
// This queue never patches host timers, animation frames, workers or settings.
export function createGlassPerformance({ computeSync, onResult, onError = () => {}, isBusy = () => false, workerFactory } = {}) {
    let worker = null, mode = 'idle', reason = '', active = null, pending = null;
    let serial = 0, generation = 0, startupTimer = 0, workTimer = 0, deferTimer = 0, suspended = false, permanent = false;
    let busyUntil = 0;
    const counts = { workerFrames: 0, syncFrames: 0, coalesced: 0, stale: 0, failures: 0, peakTasks: 0 };
    const clock = () => performance.now();
    const clearTimers = () => { clearTimeout(startupTimer); clearTimeout(workTimer); clearTimeout(deferTimer); startupTimer = workTimer = deferTimer = 0; };
    const stopWorker = () => { if (worker) { worker.onmessage = worker.onerror = worker.onmessageerror = null; worker.terminate(); worker = null; } };
    function deliver(task, frame) {
        if (task.generation !== generation || suspended) { counts.stale++; return; }
        onResult(task.job, frame);
    }
    function sync(task) {
        const frame = computeSync(task.job); counts.syncFrames++;
        deliver(task, frame);
    }
    function fail(why) {
        const latest = pending || active;
        clearTimers(); stopWorker(); active = pending = null;
        mode = 'sync'; reason = why; permanent = true; counts.failures++;
        if (latest && !suspended) { try { sync(latest); } catch (error) { onError(error); } }
    }
    function ready() {
        if (suspended || mode !== 'idle') return mode;
        if (permanent || workerFactory === null || (workerFactory === undefined && typeof Worker !== 'function')) {
            mode = 'sync'; reason = reason || 'unsupported'; return mode;
        }
        mode = 'starting';
        try {
            worker = workerFactory ? workerFactory() : new Worker(new URL('./glass-worker.js', import.meta.url), { type: 'module', name: 'nvwa-glass' });
            const instance = worker;
            worker.onmessage = event => {
                if (worker !== instance) return;
                const message = event.data;
                if (message?.type === 'ready' && mode === 'starting') {
                    clearTimeout(startupTimer); startupTimer = 0;
                    if (!message.ok) { fail('canvas-unavailable'); return; }
                    mode = 'worker'; drain(); return;
                }
                if (!active || message?.id !== active.id) return;
                if (message.type === 'error') { fail('render-failed'); return; }
                if (message.type !== 'result') return;
                const task = active; active = null; clearTimeout(workTimer); workTimer = 0;
                counts.workerFrames++;
                try { deliver(task, message.frame); } catch (error) { onError(error); }
                drain();
            };
            worker.onerror = event => { event.preventDefault?.(); if (worker === instance) fail('worker-error'); };
            worker.onmessageerror = () => { if (worker === instance) fail('message-error'); };
            startupTimer = setTimeout(() => fail('startup-timeout'), 2500);
        } catch { fail('worker-blocked'); }
        return mode;
    }
    function drain() {
        if (suspended || active || !pending || mode === 'starting') return;
        clearTimeout(deferTimer); deferTimer = 0;
        if (pending.notBefore > clock()) { deferTimer = setTimeout(drain, pending.notBefore - clock()); return; }
        const task = pending; pending = null;
        if (mode === 'sync') { sync(task); return; }
        if (mode !== 'worker' || !worker) return;
        active = task;
        try {
            worker.postMessage({ type: 'render', id: task.id, job: task.job });
            workTimer = setTimeout(() => fail('render-timeout'), 1500);
        } catch { fail('post-failed'); }
    }
    function request(job) {
        if (suspended) return;
        ready();
        if (active?.job.key === job.key) {
            if (pending) { counts.coalesced++; pending = null; clearTimeout(deferTimer); deferTimer = 0; }
            return;
        }
        if (pending?.job.key === job.key) { pending.job = job; return; }
        const task = { id: ++serial, generation, job, notBefore: !job.low && (clock() < busyUntil || isBusy()) ? clock() + 80 : 0 };
        // Preserve the existing immediate first paint while the worker's capability probe runs.
        if (mode === 'sync' || mode === 'starting') { sync(task); return; }
        if (pending) counts.coalesced++;
        pending = task;
        counts.peakTasks = Math.max(counts.peakTasks, Number(!!active) + 1);
        drain();
    }
    function stop() {
        generation++; pending = active = null; clearTimers(); stopWorker();
        mode = permanent ? 'sync' : 'idle';
    }
    return {
        prepare: ready, request,
        dropPending() { pending = null; clearTimeout(deferTimer); deferTimer = 0; },
        markBusy(ms = 140) { busyUntil = Math.max(busyUntil, clock() + ms); },
        pause() { suspended = true; stop(); },
        resume() { suspended = false; },
        stop,
        status: () => ({ mode, reason, suspended, active: Number(!!active), pending: Number(!!pending), ...counts }),
    };
}
