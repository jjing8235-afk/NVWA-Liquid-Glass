import { createGlassPerformance } from './glass-performance.js';
import { normalizeWebPreset } from './web-presets.js';
import { rasterWebMap } from './web-map-raster.js';

const maps = new Map();
let cachedPixels = 0;
const MAX_MAPS = 20, MAX_PIXELS = 1572864;
export function webMapJob(width, height, preset, strength = 1, bendY = 1) {
    width = Math.max(2, Math.round(width)); height = Math.max(2, Math.round(height));
    preset = normalizeWebPreset(preset);
    return { kind: 'web-map', key: width + 'x' + height + ':' + preset + ':' + strength + ':' + bendY, width, height, preset, strength, bendY };
}
export function cachedWebMap(job) {
    const value = maps.get(job.key);
    if (value) { maps.delete(job.key); maps.set(job.key, value); }
    return value;
}
function remember(job, result) {
    const previous = maps.get(job.key);
    if (previous) { cachedPixels -= previous.pixels; maps.delete(job.key); }
    while (maps.size && (maps.size >= MAX_MAPS || cachedPixels + result.pixels > MAX_PIXELS)) {
        const first = maps.keys().next().value;
        cachedPixels -= maps.get(first).pixels; maps.delete(first);
    }
    maps.set(job.key, result); cachedPixels += result.pixels;
    return result;
}
function renderSync(job) {
    const image = rasterWebMap(job), canvas = document.createElement('canvas');
    canvas.width = image.w; canvas.height = image.h;
    try {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Liquid Glass Web requires a 2D canvas.');
        context.putImageData(new ImageData(image.data, image.w, image.h), 0, 0);
        return { url: canvas.toDataURL('image/png'), scale: image.scale, width: image.w, height: image.h, pixels: image.w * image.h };
    } finally { canvas.width = canvas.height = 0; }
}
export function getWebMap(width, height, preset, strength = 1, bendY = 1) {
    const job = webMapJob(width, height, preset, strength, bendY);
    return cachedWebMap(job) || remember(job, renderSync(job));
}
export function clearWebMaps() { maps.clear(); cachedPixels = 0; }

// One bounded queue feeds the existing worker scheduler. Each surface retains only
// its latest request; matching maps share one computation and fan out on completion.
export function createWebMapPreparation({ workerFactory } = {}) {
    const pending = new Map(), tasks = new Map(), owners = new Map();
    let enabled = false, suspended = false, active = null, finishing = false, drainTimer = 0, peakPending = 0;
    const engine = createGlassPerformance({ workerFactory, deferStartup: true, computeSync: renderSync,
        onResult: complete, onError: () => { if (active) complete(active.job, null); } });
    function cancel(owner) {
        const entry = owners.get(owner);
        if (!entry) return;
        owners.delete(owner); entry.listeners.delete(owner);
        if (!entry.listeners.size && entry !== active) { pending.delete(entry.job.key); tasks.delete(entry.job.key); }
    }
    function drain() {
        if (!enabled || suspended || finishing || active || !pending.size) return;
        clearTimeout(drainTimer); drainTimer = 0;
        const entry = pending.values().next().value;
        pending.delete(entry.job.key); active = entry;
        engine.request(entry.job);
    }
    function complete(job, frame) {
        if (!enabled || suspended || active?.job.key !== job.key) return;
        const entry = active;
        const result = frame ? remember(job, frame) : null;
        active = null; tasks.delete(job.key); finishing = true;
        const listeners = [...entry.listeners]; entry.listeners.clear();
        try {
            for (const [owner, listener] of listeners) {
                if (owners.get(owner) !== entry) continue;
                owners.delete(owner); listener(result);
            }
        } finally {
            finishing = false;
            if (engine.status().mode === 'sync' && pending.size) drainTimer = setTimeout(drain, 0);
            else drain();
        }
    }
    function request(job, owner, listener) {
        if (!enabled || suspended) return false;
        const mode = engine.prepare();
        if (mode !== 'worker' && mode !== 'starting') return false;
        const previous = owners.get(owner);
        if (previous?.job.key === job.key) { previous.listeners.set(owner, listener); return true; }
        cancel(owner);
        let entry = tasks.get(job.key);
        if (!entry) {
            if (pending.size >= MAX_MAPS) return false;
            entry = { job, listeners: new Map() }; tasks.set(job.key, entry); pending.set(job.key, entry);
            peakPending = Math.max(peakPending, pending.size);
        }
        owners.set(owner, entry); entry.listeners.set(owner, listener); drain();
        return true;
    }
    function clear() {
        clearTimeout(drainTimer); drainTimer = 0;
        active = null; pending.clear(); tasks.clear(); owners.clear();
    }
    return {
        request, cancel,
        start() { enabled = true; suspended = false; engine.resume(); engine.prepare(); },
        stop() { enabled = false; clear(); engine.stop(); },
        pause() { suspended = true; clear(); engine.pause(); },
        resume() { if (enabled) { suspended = false; engine.resume(); engine.prepare(); } },
        status: () => ({ ...engine.status(), queuedMaps: pending.size, waitingSurfaces: owners.size, peakPending, cachedMaps: maps.size, cachedPixels }),
    };
}
