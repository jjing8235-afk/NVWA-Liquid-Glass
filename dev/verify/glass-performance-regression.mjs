import assert from 'node:assert/strict';
import { createGlassPerformance } from '../../glass-performance.js';
const saved = { performance: globalThis.performance, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
let now = 0, serial = 0, tasks = new Map(), workers = [], results = [], errors = [];
globalThis.performance = { now: () => now };
globalThis.setTimeout = (fn, delay) => { const id = ++serial; tasks.set(id, { at: now + delay, fn }); return id; };
globalThis.clearTimeout = id => tasks.delete(id);
function advance(ms) {
    const end = now + ms;
    while (true) {
        const next = [...tasks].filter(([, t]) => t.at <= end).sort((a,b)=>a[1].at-b[1].at)[0];
        if (!next) break;
        tasks.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = end;
}
function factory() {
    const worker = { sent: [], closed: false,
        postMessage(message) { this.sent.push(message); },
        emit(message) { this.onmessage?.({ data: message }); },
        finish() { const message = this.sent.at(-1); this.emit({ type:'result', id:message.id, frame:{ key:message.job.key } }); },
        terminate() { this.closed = true; } };
    workers.push(worker); return worker;
}
function make(extra = {}) {
    return createGlassPerformance({ workerFactory: factory, computeSync: job => ({ key:job.key }), onResult: (job,frame) => results.push([job.key,frame.key]), onError: e => errors.push(e), ...extra });
}
const job = (key, low=true) => ({ key, low });
try {
    const e = make(); e.prepare(); assert.equal(e.status().mode,'starting');
    e.request(job('seed')); assert.deepEqual(results.at(-1),['seed','seed']);
    const w = workers.at(-1); w.emit({type:'ready',ok:true}); assert.equal(e.status().mode,'worker');
    e.request(job('A')); e.request(job('B')); e.request(job('C'));
    assert.equal(w.sent.length,1); assert.equal(e.status().pending,1); assert.equal(e.status().peakTasks,2);
    w.finish(); assert.equal(w.sent.at(-1).job.key,'C'); w.finish();
    assert(!results.some(([key])=>key==='B'),'Replaced pending work must never run');
    e.request(job('D')); e.request(job('E')); e.request(job('D')); w.finish(); assert.equal(e.status().pending,0);
    e.request(job('busy',false)); e.markBusy(); w.finish();
    const count = w.sent.length; e.request(job('settled',false)); advance(79); assert.equal(w.sent.length,count); advance(1); assert.equal(w.sent.length,count+1); w.finish();
    e.request(job('old')); const late = w.onmessage, staleId = w.sent.at(-1).id; e.pause(); assert(w.closed); assert.equal(tasks.size,0);
    e.resume(); e.prepare(); const newer = workers.at(-1); late({data:{type:'ready',ok:true}}); assert.equal(e.status().mode,'starting','An old worker cannot activate a new generation');
    newer.emit({type:'ready',ok:true}); late({data:{type:'result',id:staleId,frame:{key:'old'}}}); assert(!results.some(([key])=>key==='old'));
    e.request(job('after')); newer.finish(); assert.deepEqual(results.at(-1),['after','after']);
    e.stop(); assert(newer.closed); assert.equal(tasks.size,0);
    const unsupported = make({workerFactory:null}); unsupported.request(job('fallback')); assert.equal(unsupported.status().mode,'sync'); unsupported.stop();
    const blocked = make({workerFactory:()=>{throw Error('CSP');}}); blocked.request(job('blocked')); assert.equal(blocked.status().reason,'worker-blocked'); blocked.stop();
    const noCanvas = make(); noCanvas.prepare(); workers.at(-1).emit({type:'ready',ok:false}); noCanvas.request(job('no-canvas')); assert.equal(noCanvas.status().reason,'canvas-unavailable'); noCanvas.stop();
    const timeout = make(); timeout.prepare(); advance(2500); assert.equal(timeout.status().reason,'startup-timeout'); timeout.stop();
    const renderTimeout = make(); renderTimeout.prepare(); workers.at(-1).emit({type:'ready',ok:true}); renderTimeout.request(job('timeout')); advance(1500); assert.equal(renderTimeout.status().reason,'render-timeout'); assert.deepEqual(results.at(-1),['timeout','timeout']); renderTimeout.stop();
    const crashed = make(); crashed.prepare(); const doomed = workers.at(-1); doomed.emit({type:'ready',ok:true}); crashed.request(job('obsolete')); crashed.request(job('newest')); doomed.onerror({preventDefault(){}}); assert(doomed.closed); assert.equal(crashed.status().reason,'worker-error'); assert.deepEqual(results.at(-1),['newest','newest']); crashed.stop();
    assert.equal(tasks.size,0); assert.equal(errors.length,0);
    console.log(JSON.stringify({passed:true,checks:['one active and one latest pending','duplicate suppression','bounded busy deferral','generation isolation','pause/restart cleanup','unsupported/CSP/canvas/timeout fallback']}));
} finally { Object.assign(globalThis,saved); }
