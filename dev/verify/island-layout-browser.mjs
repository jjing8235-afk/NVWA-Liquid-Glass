import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.NVWA_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.NVWA_PLAYWRIGHT_MODULE).href : 'playwright');
const candidate = await fs.readFile(new URL('../../index.js', import.meta.url), 'utf8');
const baseline = process.env.NVWA_BACKDROP_BASELINE && await fs.readFile(process.env.NVWA_BACKDROP_BASELINE, 'utf8');
const browser = await chromium.launch({ executablePath: process.env.NVWA_EDGE_EXECUTABLE });

async function exercise(page, source, width) {
    await page.setViewportSize({ width, height: 700 });
    await page.setContent(`<style>
        #top-bar { position: relative; width: 90%; height: 44px; border: 2px solid; }
        #top-settings-holder { display: flex; gap: 3px; width: 100%; }
        .drawer { flex: 0 0 24px; height: 36px; }
        .drawer.ilg-group-start { margin-left: 18px; }
        .fold .drawer.ilg-group-start { margin-left: auto; }
        .ilg-folded, .hidden { display: none; }
        .dock .drawer { flex-basis: clamp(15px, (80dvw - 32px) / var(--ilg-dock-count, 10), 24px); }
        .dock .ilg-dock-sep { margin-left: 8px; }
        .ilg-island { top: 0; height: 38px; pointer-events: none; }
        .ilg-glass { border-radius: 18px; }
    </style><div id="top-bar"><div id="top-settings-holder">${[
        'ilg-fold-button', 'ai-config-button', 'sys-settings-button', 'advanced-formatting-button', 'WI-SP-button',
        'user-settings-button', 'backgrounds-button', 'extensions-settings-button', 'ilg-tone-button',
        'persona-management-button', 'rightNavHolder',
    ].map(id => `<div id="${id}" class="drawer"><div class="drawer-toggle"><div class="drawer-icon"></div></div></div>`).join('')}</div></div>`);
    const start = source.indexOf("const holder = document.getElementById('top-settings-holder');");
    const end = source.indexOf('const FOLD_KEEP =', start);
    const holderObserver = source.match(/^new ResizeObserver\([^\r\n]+\.observe\(holder\);$/m)?.[0];
    assert(start >= 0 && end > start && holderObserver, 'Top layout hooks must still match production code');
    return page.evaluate(({ code, holderObserver }) => {
        const observers = [], pending = new Map();
        const items = new Set();
        const S = { enabled: true, islands: true, fold: false, dock: false, topShortcut1: 'WI-SP-button' };
        const foldBtn = document.getElementById('ilg-fold-button');
        let nextFrame = 0, layouts = 0;
        const ResizeObserver = class {
            constructor(callback) { observers.push(callback); }
            observe() {}
            unobserve() {}
            disconnect() {}
        };
        const requestAnimationFrame = cb => { pending.set(++nextFrame, cb); return nextFrame; };
        const cancelAnimationFrame = id => pending.delete(id);
        const track = node => { items.add(node); node.classList.add('ilg-glass'); getComputedStyle(node).position; };
        const untrack = node => items.delete(node);
        const scheduleAdapt = () => { layouts++; };
        const FOLD_KEEP = ['ilg-tone-button', 'persona-management-button', 'rightNavHolder'];
        const engine = eval(`(() => { ${code}\n${holderObserver}\nreturn { layoutIslands, removeIslands, holder }; })()`);
        const snapshots = [];
        function snapshot() {
            const groupStarts = [...engine.holder.querySelectorAll('.ilg-group-start')].map(el => el.id);
            const separators = [...engine.holder.querySelectorAll('.ilg-dock-sep')].map(el => el.id);
            const islands = [...document.querySelectorAll('.ilg-island')].map(el => [
                el.icons.map(icon => icon.id), el.hidden, el.style.left, el.style.width, el.classList.contains('ilg-glass'),
            ]);
            snapshots.push({ groupStarts, separators, islands });
        }
        const frame = () => {
            for (const id of [...pending.keys()]) {
                const run = pending.get(id);
                pending.delete(id);
                run?.(100);
            }
        };
        const notify = () => observers.forEach(cb => cb());
        engine.layoutIslands();
        snapshot();
        const count = new MutationObserver(() => {});
        count.observe(engine.holder, { attributes: true, attributeFilter: ['class'], subtree: true });
        layouts = 0;
        notify(); notify(); notify();
        frame();
        snapshot();
        const burst = { layouts, classWrites: count.takeRecords().length };
        count.disconnect();

        for (const id of ['user-settings-button', 'backgrounds-button', 'extensions-settings-button', 'ilg-tone-button']) {
            document.getElementById(id).classList.add('hidden');
        }
        engine.layoutIslands();
        snapshot();

        document.body.classList.add('fold');
        S.fold = true;
        for (const el of engine.holder.children) {
            el.classList.remove('hidden');
            el.classList.toggle('ilg-fold-keep', FOLD_KEEP.includes(el.id));
            el.classList.toggle('ilg-fold-shortcut', el.id === S.topShortcut1);
            el.classList.toggle('ilg-folded', el !== foldBtn && !FOLD_KEEP.includes(el.id) && el.id !== S.topShortcut1);
        }
        engine.layoutIslands();
        snapshot();
        layouts = 0;
        notify();
        engine.layoutIslands();
        frame();
        const immediate = layouts;

        S.dock = true;
        document.body.className = 'dock';
        for (const el of engine.holder.children) el.classList.remove('ilg-folded');
        engine.layoutIslands();
        engine.layoutIslands(); // The existing dock slot width settles on a follow-up measurement.
        snapshot();

        notify();
        S.enabled = false;
        engine.removeIslands();
        const paused = pending.size;
        frame();
        snapshot();
        return { burst, immediate, paused, snapshots };
    }, { code: source.slice(start, end), holderObserver });
}

try {
    const page = await browser.newPage();
    const results = [];
    for (const width of [360, 1280]) {
        const after = await exercise(page, candidate, width);
        const { snapshots: [three, stable, hidden, folded, dock, off], ...stats } = after;
        assert.equal(three.islands.length, 3);
        assert.deepEqual(three, stable);
        assert.equal(hidden.islands[1][1], true);
        assert.deepEqual(folded.islands.map(([icons]) => icons), [
            ['ilg-fold-button', 'WI-SP-button'], ['ilg-tone-button', 'persona-management-button', 'rightNavHolder'],
        ]);
        assert.equal(dock.islands.length, 1);
        assert(dock.separators.length > 0);
        assert.deepEqual(off, { groupStarts: [], separators: [], islands: [] });
        let before = null;
        if (baseline) {
            const { snapshots, ...ops } = await exercise(page, baseline, width);
            assert.deepEqual(after.snapshots, snapshots, `Geometry or glass state drift at ${width}px`);
            before = ops;
        }
        assert.deepEqual(stats, { burst: { layouts: 1, classWrites: 0 }, immediate: 1, paused: 0 });
        results.push({ width, before, after: stats });
    }
    console.log(JSON.stringify({ geometryMatchesBaseline: baseline ? true : null, results }, null, 2));
} finally { await browser.close(); }
