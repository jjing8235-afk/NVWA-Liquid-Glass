import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const callback = source.match(/new ResizeObserver\(\(\) => \{\n    const atBottom = chatEl\.scrollHeight[\s\S]*?\n\}\)\.observe\(form\);/)?.[0];
assert(callback, 'Input form resize observer must be present');

function harness(enabled, powerUserSettings, gap, height = 90) {
    const writes = [], dimensions = [];
    let top = 2000 - 800 - gap;
    const chatEl = {
        scrollHeight: 2000,
        clientHeight: 800,
        get scrollTop() { return top; },
        set scrollTop(value) { writes.push(value); top = value; },
    };
    const form = { offsetHeight: height };
    const root = { style: { setProperty(name, value) {
        dimensions.push([name, value]);
        // Reflow changes the scroll range. A permitted scroll must use the new range.
        chatEl.scrollHeight = 2000 + height - 70;
    } } };
    const S = { enabled };
    const ctx = { powerUserSettings };
    let resize;
    class ResizeObserver {
        constructor(fn) { resize = fn; }
        observe(target) { assert.equal(target, form); }
    }
    vm.runInNewContext(callback, { ResizeObserver, chatEl, form, root, S, ctx });
    return { resize, writes, dimensions, chatEl, form, S, ctx };
}

let cases = 0;
for (const enabled of [false, true]) {
    for (const setting of [false, true, undefined]) {
        for (const gap of [0, 30, 40, 180]) {
            for (const height of [34, 90]) {
                const h = harness(enabled, { auto_scroll_chat_to_bottom: setting }, gap, height);
                const previous = h.chatEl.scrollTop;
                h.resize();
                const permitted = enabled && setting === true && gap < 40;
                assert.deepEqual(h.writes, permitted ? [2000 + height - 70] : [],
                    `Unexpected scroll: enabled=${enabled}, auto=${setting}, gap=${gap}, height=${height}`);
                if (!permitted) assert.equal(h.chatEl.scrollTop, previous, 'No explicit scroll may overwrite reading position');
                assert.deepEqual(h.dimensions, [['--ilg-form-h', `${height}px`]], 'Form dimensions must stay current');
                cases++;
            }
        }
    }
}
for (const settings of [undefined, null, {}]) {
    const h = harness(true, settings, 0);
    h.resize();
    assert.deepEqual(h.writes, [], 'Missing host preference must not enable automatic scrolling');
    cases++;
}
// Preference and extension toggles must be read on every resize, without a reload.
const live = harness(true, { auto_scroll_chat_to_bottom: false }, 0);
live.resize();
assert.deepEqual(live.writes, []);
live.ctx.powerUserSettings.auto_scroll_chat_to_bottom = true;
live.resize();
assert.deepEqual(live.writes, [2020]);
live.S.enabled = false;
live.form.offsetHeight = 110;
live.resize();
assert.deepEqual(live.writes, [2020]);
assert.deepEqual(live.dimensions.at(-1), ['--ilg-form-h', '110px']);

console.log(JSON.stringify({ passed: true, matrixCases: cases, liveToggleSequence: true,
    checks: ['Disabled extension never explicitly scrolls', 'Host automatic scrolling preference is respected',
        'Near-bottom reading follows only when permitted', 'Reading farther up and the 40px boundary stay unchanged',
        'Form size stays current even when scrolling is blocked', 'Missing preferences fail closed'] }, null, 2));
