import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const source = fs.readFileSync(new URL('index.js', root), 'utf8').replace(/\r\n/g, '\n');
const engine = fs.readFileSync(new URL('glass2.js', root), 'utf8').replace(/^export /gm, '');
const passed = [];

// Exercise actual scheduling under a deterministic busy-scroll clock, including its final update.
let now = 0, sequence = 0, samples = 0;
const tasks = new Map(), events = [];
const later = (fn, delay) => { const id = ++sequence; tasks.set(id, { at: now + delay, fn }); return id; };
function advance(end) {
    while (true) {
        const next = [...tasks].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        tasks.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = end;
}
function surface(name) {
    const classes = new Set();
    return { name, hidden: false, icons: [], classes,
        getBoundingClientRect() { events.push(['read', now]); return { top: 0, left: 0, width: 300, height: 40 }; },
        classList: { toggle(key, on) { events.push(['write', now]); if (on) classes.add(key); else classes.delete(key); } } };
}
const bar = surface('bar'), pill = surface('pill'), settings = { enabled: true, islands: false };
let luminance = 0.9;
const adapt = source.slice(source.indexOf('function adaptBar(bar) {'), source.indexOf("chatEl.addEventListener('scroll', scheduleAdapt"));
const adaptEnv = {
    S: settings, islands: [], PILL_SEL: '#pill', lightBg: false,
    document: { getElementById: () => bar, querySelector: () => pill },
    lumAt() { samples++; return luminance; }, performance: { now: () => now },
    requestAnimationFrame: fn => later(fn, 16), setTimeout: later,
};
const schedule = vm.runInNewContext(adapt + ';scheduleAdapt', adaptEnv);
for (let t = 0; t <= 960; t += 16) { advance(t); schedule(); schedule(); }
advance(980); luminance = 0.1; schedule(); advance(1200);
assert(samples <= 12 * 16, 'Continuous scrolling must not sample every frame');
assert(!bar.classes.has('ilg-over-light'), 'Final background change must be sampled after scrolling stops');
for (const t of new Set(events.map(e => e[1]))) {
    const phase = events.filter(e => e[1] === t).map(e => e[0]).join(',');
    assert(!phase.includes('write,read'), 'Read all surfaces before changing their classes');
}
const beforeDisable = samples;
schedule(); settings.enabled = false; advance(1500); schedule(); advance(1700);
assert.equal(samples, beforeDisable, 'Disabled extension must not run queued sampling');
settings.enabled = true; schedule(); advance(1800);
assert(samples > beforeDisable, 'Sampling must recover after re-enabling');
const island = surface('island'), icon = surface('icon');
island.icons = [icon]; adaptEnv.islands = [island]; settings.islands = true;
luminance = 0.9; schedule(); advance(2000);
assert(island.classes.has('ilg-over-light') && icon.classes.has('ilg-icon-over-light'));
adaptEnv.lightBg = true; luminance = 0.1; schedule(); advance(2200);
assert(island.classes.has('ilg-over-dark') && !island.classes.has('ilg-over-light'));
assert(!icon.classes.has('ilg-icon-over-light'), 'Island icons must reset when background brightness changes');
passed.push('100ms coalescing, trailing sample, disable/re-enable, islands, both tones and read-before-write ordering');

// Compare real floor lookup with a linear oracle across a long chronological chat.
let reads = 0, queries = 0;
const messages = Array.from({ length: 2048 }, (_, id) => ({ id, nodeType: 1,
    getAttribute() { return String(this.id); },
    getBoundingClientRect() { reads++; return this.hidden ? { bottom: 0, width: 0, height: 0 } : { bottom: this.id * 80 + 75 - chat.scrollTop, width: 300, height: 75 }; },
}));
const chat = { scrollTop: 0, clientHeight: 800, scrollHeight: 2048 * 80,
    querySelectorAll() { queries++; return messages; } };
let mutation;
const floorStart = source.indexOf('let floorRaf = 0;');
const floorCode = source.slice(floorStart, source.indexOf('function paintFloor() {', floorStart));
const floorObserver = source.match(/new MutationObserver\(muts => \{\n    if \(muts.some\(m => m.target === chatEl[\s\S]*?\n\}\)\.observe\(chatEl, [^\n]+/)[0];
const lookup = vm.runInNewContext(floorCode + '\n' + floorObserver + ';visibleFloor', {
    chatEl: chat, document: { getElementById: id => id === 'chat' ? chat : { getBoundingClientRect: () => ({ bottom: 43 }) } },
    MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} },
    scheduleFloor() {},
});
let maxReads = 0;
for (let i = 0; i < 300; i++) {
    chat.scrollTop = (i * 7919) % (chat.scrollHeight - chat.clientHeight + 1);
    reads = 0;
    const expected = chat.scrollTop + chat.clientHeight >= chat.scrollHeight - 8 ? messages.at(-1).id
        : messages.find(m => m.id * 80 + 75 - chat.scrollTop > 49)?.id ?? messages.at(-1).id;
    assert.equal(lookup(), expected, 'Cached binary lookup must match the previous linear definition');
    maxReads = Math.max(maxReads, reads);
}
assert(maxReads <= 12, 'Geometry reads must grow logarithmically with message count');
assert.equal(queries, 1, 'Scrolling must reuse the message list');
mutation([{ target: {}, type: 'childList', addedNodes: [{ nodeType: 3 }], removedNodes: [] }]);
lookup(); assert.equal(queries, 1, 'Streaming text must not rebuild the message index');
mutation([{ target: chat, type: 'childList', addedNodes: [], removedNodes: [] }]);
lookup(); assert.equal(queries, 2, 'Root message changes must rebuild the index');
mutation([{ target: messages[0], type: 'attributes', addedNodes: [], removedNodes: [] }]);
lookup(); assert.equal(queries, 3, 'Message ID changes must invalidate membership');
mutation([{ target: {}, type: 'childList', addedNodes: [{ nodeType: 1, matches: () => true }], removedNodes: [] }]);
lookup(); assert.equal(queries, 4, 'Nested message insertion must invalidate membership');
// Hidden rows have zero rectangles and do not preserve binary ordering.
for (const m of messages) m.hidden = m.id % 7 === 0;
for (let i = 0; i < 60; i++) {
    chat.scrollTop = (i * 1739) % (chat.scrollHeight - chat.clientHeight);
    const expected = messages.find(m => !m.hidden && m.id * 80 + 75 - chat.scrollTop > 49)?.id ?? messages.at(-1).id;
    assert.equal(lookup(), expected, 'Hidden-message fallback must match the linear definition');
}
messages.length = 0;
mutation([{ target: chat, type: 'childList', addedNodes: [], removedNodes: [] }]);
assert.equal(lookup(), null, 'Empty chat must hide the floor indicator');
passed.push('300 long-chat positions match the linear oracle; at most 12 geometry reads; mutation invalidation and hidden-row fallback');

// Rasterize into deterministic canvas buffers to check map precision and lighting cache changes.
let canvases = 0, encodes = 0;
const browser = { devicePixelRatio: 2 };
const document = { createElement(type) {
    assert.equal(type, 'canvas'); canvases++;
    let image;
    const canvas = { width: 0, height: 0,
        getContext() { return { createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
            putImageData(value) { image = value; } }; },
        toDataURL() { encodes++; return createHash('sha256').update(Buffer.from(image.data)).digest('hex'); },
    };
    return canvas;
} };
const api = vm.runInNewContext(engine + ';({getMaps,clearMaps,physicalFilter})', { document, window: browser });
const plain = { profile: 'lens', ior: 1.5, magnify: 3, bezel: 24, thickness: 40,
    strength: 1, aberration: 3, blur: 3, saturate: 1.15, brightness: 1.02, contrast: 1,
    specular: 0, sharp: 4, edgeShade: 0, fresnel: 0, caustic: 0 };
const mapCases = [];
for (const [w, h, r] of [[390, 1200, 22], [100, 36, 18]]) {
    api.clearMaps(); canvases = 0; encodes = 0;
    const unlit = api.getMaps(w, h, r, plain);
    const savedEncodes = encodes, parts = unlit.full ? [unlit.full] : Object.values(unlit.tiles);
    assert(parts.every(p => p.d && !p.n));
    assert.equal(canvases, parts.length); assert.equal(encodes, parts.length);
    const unlitHtml = api.physicalFilter(unlit, plain, w, h, 135);
    assert(!unlitHtml.includes('nmap') && !unlitHtml.includes('undefined'));
    assert.equal((unlitHtml.match(/<feDisplacementMap/g) || []).length, 3, 'Existing color dispersion must remain');
    for (const field of ['specular', 'edgeShade', 'fresnel', 'caustic']) {
        const lit = { ...plain, [field]: 0.5 }, m = api.getMaps(w, h, r, lit);
        const litParts = m.full ? [m.full] : Object.values(m.tiles);
        assert(litParts.every(p => p.n));
        assert.deepEqual(litParts.map(p => p.d), parts.map(p => p.d), 'Lighting gate must not change displacement pixels');
        assert.equal(m.scale, unlit.scale);
        const html = api.physicalFilter(m, lit, w, h, 135);
        assert(html.includes('nmap') && !html.includes('undefined'), 'Each enabled lighting feature gets valid normal maps');
    }
    assert.equal(api.getMaps(w, h, r, plain), unlit, 'Turning lighting off must recover the unlit cached maps');
    mapCases.push({ shape: unlit.full ? 'full' : 'tiled', parts: parts.length, unlitPngEncodes: savedEncodes, maxFloorReads: maxReads });
}
passed.push('Full/tiled displacement pixels and scale unchanged; unlit PNG work halved; all lighting features restored correctly');
console.log(JSON.stringify({ passed, longChatSamples: 300, maxFloorReads: maxReads, samplingReads: samples, mapCases }, null, 2));
