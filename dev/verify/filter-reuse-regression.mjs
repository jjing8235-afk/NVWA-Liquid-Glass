import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const source = fs.readFileSync(new URL('index.js', root), 'utf8').replace(/\r\n/g, '\n');
const engine = fs.readFileSync(new URL('glass2.js', root), 'utf8').replace(/\r\n/g, '\n');
const passed = [];
const api = vm.runInNewContext(engine.replace(/^export /gm, '') + '\n({physicalFilter,resizePhysicalFilter})');
const options = { profile: 'lens', strength: 1, magnify: 3, blur: 8, saturate: 1.15,
    brightness: 1.02, contrast: 1, aberration: 3, edgeShade: 0.2, specular: 1,
    sharp: 4, fresnel: 0.1, caustic: 0.2 };
function filterFrom(html) {
    const images = [...html.matchAll(/<feImage\s+([^>]+)\/>/g)].map(match => {
        const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
        return { attrs, getAttribute(name) { return attrs[name]; }, setAttribute(name, value) { attrs[name] = value; } };
    });
    return { images, querySelectorAll() { return images; } };
}
const tiled = { C: 40, scale: 80, tiles: Object.fromEntries(['t', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br'].map(k => [k, { d: 'displacement-' + k, n: 'normal-' + k }])) };
const full = { full: { d: 'full-displacement', n: 'full-normal' }, scale: 12 };
for (const maps of [tiled, full]) {
    const f = filterFrom(api.physicalFilter(maps, options, 374, 240, 135));
    const nodes = [...f.images];
    for (const [w, h] of [[374, 717], [624, 545], [374, 240]]) {
        api.resizePhysicalFilter(f, maps, w, h);
        const rebuilt = filterFrom(api.physicalFilter(maps, options, w, h, 135));
        assert.deepEqual(f.images.map(x => x.attrs), rebuilt.images.map(x => x.attrs), 'Resized map geometry must equal a fresh filter');
        assert(f.images.every((node, i) => node === nodes[i]), 'Keep existing image nodes');
    }
}
passed.push('Full and nine-slice geometry matches fresh filters across resize and back; nodes and image sources retained');

const body = source.match(/function buildPhysical\(it, el, w, h, r\) \{([\s\S]*?)\n\}/)?.[1];
assert(body);
let builds = 0, sizes = 0, bounds = 0, currentMap = tiled, angle = 135;
const settings = { profile: 'lens', pIor: 1.5, pMagnify: 3, pBezel: 40, pThickness: 30,
    pStrength: 1, pAberration: 3, pSaturate: 1.15, pBrightness: 1.02, pContrast: 1,
    pSpecular: 0, pSharp: 4, pEdgeShade: 0, pFresnel: 0, pCaustic: 0 };
let lightWrites = 0;
const lights = [{ dataset: { light: '1' }, setAttribute() { lightWrites++; } }];
const it = { kind: 'panel' };
const build = vm.runInNewContext('(function(it,el,w,h,r){' + body + '})', {
    S: settings, KIND: { panel: { blur: () => 8, k: 0.7, bezelK: 1.1, thickK: 1.5 } },
    getMaps: () => currentMap, lightAngle: () => angle, lightRow: () => 'matrix',
    physicalFilter() { builds++; return '<filter/>'; },
    resizePhysicalFilter() { sizes++; },
    filterOf(item) { bounds++; return item.filter ||= { querySelectorAll: () => lights }; },
});
build(it, {}, 374, 717, 20);
const filter = it.filter;
build(it, {}, 374, 717, 20);
assert.equal(builds, 1); assert.equal(sizes, 0); assert.equal(bounds, 1);
build(it, {}, 374, 600, 20);
assert.equal(builds, 1); assert.equal(sizes, 1); assert.equal(bounds, 2); assert.equal(it.filter, filter);
it.lights = null;
build(it, {}, 374, 600, 20);
assert.equal(it.lights, lights); assert.equal(builds, 1);
angle = 90;
build(it, {}, 374, 600, 20);
assert.equal(lightWrites, 1); assert.equal(it.angle, 90); assert.equal(builds, 1);
settings.pAberration = 0;
build(it, {}, 374, 600, 20);
assert.equal(builds, 2);
currentMap = full;
build(it, {}, 374, 600, 20);
assert.equal(builds, 3);
it.physical = null;
build(it, {}, 374, 600, 20);
assert.equal(builds, 4);
passed.push('Unchanged material reuses nodes; resize only patches bounds; parameter, map and engine changes rebuild; lighting survives reuse');

const paintBody = source.match(/function paint\(el\) \{([\s\S]*?)\n\}/)?.[1];
let painted = 0;
const element = { isConnected: true, offsetWidth: 0, offsetHeight: 0, style: {}, classList: { toggle() {} } };
const hiddenItem = { kind: 'bar' };
vm.runInNewContext('(function(el){' + paintBody + '})(el)', {
    el: element, items: new Map([[element, hiddenItem]]), trackable: () => true,
    document: { body: { classList: { contains: () => false } } },
    KIND: { bar: { blur: () => 1 } }, S: { saturate: 1, brightness: 1 },
    setPhys() { painted++; },
});
assert.equal(painted, 0); assert.deepEqual(element.style, {});
assert(source.includes('it.physical = null;'), 'Legacy path must invalidate the physical-node cache');
passed.push('Zero-size hidden surfaces keep their valid filter untouched; legacy path invalidates physical cache');

const observerBody = source.match(/new MutationObserver\(muts => \{\n    if \(!S.enabled \|\| !S.fold\) return;([\s\S]*?)\n\}\)\.observe\(holder,/)?.[1];
assert(observerBody);
let folds = 0, layouts = 0, syncs = 0;
const holder = {};
const drawer = { parentElement: holder, classList: { contains: k => k === 'drawer' } };
const panel = { parentElement: drawer, closest: () => null };
const internal = { parentElement: panel, closest: () => null };
const process = vm.runInNewContext('(function(muts){' + observerBody + '})', {
    holder, applyFold() { folds++; }, requestAnimationFrame(callback) { callback(); },
    layoutIslands() { layouts++; }, syncFold() { syncs++; },
});
process([{ type: 'childList', target: internal }, { type: 'attributes', target: internal }]);
assert.deepEqual([folds, layouts, syncs], [0, 0, 0]);
process([{ type: 'attributes', target: panel }]);
assert.deepEqual([folds, layouts, syncs], [0, 0, 1]);
process([{ type: 'childList', target: holder }]);
process([{ type: 'childList', target: drawer }]);
assert.deepEqual([folds, layouts, syncs], [2, 2, 1]);
passed.push('Drawer internal changes do not regroup navbar; direct icon/panel additions and open-state changes still update');

console.log(JSON.stringify({ passed }, null, 2));
