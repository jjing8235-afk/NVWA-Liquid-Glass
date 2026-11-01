import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../../index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const bodyOf = name => source.match(new RegExp('function ' + name + '\\([^]*?\n\}'))[0];
const defaults = vm.runInNewContext('(' + source.match(/const DEFAULTS = (\{[\s\S]*?\n\});/)[1] + ')', {
    PRESETS: { depth: ['', {}], natural: ['', {}] },
});
assert.equal(defaults.chatBackground, 'glass');
const normalize = source.match(/S.chatBackground = [^;]+;/)[0];
for (const value of [undefined, null, 'invalid', false, 12, 'glass', 'transparent']) {
    const S = { chatBackground: value, chatFontSize: 20 };
    vm.runInNewContext(normalize, { S });
    assert.equal(S.chatBackground, value === 'transparent' ? 'transparent' : 'glass');
    assert.equal(S.chatFontSize, 20);
}
const change = source.match(/document.getElementById\('ilg-opt-chatBackground'\).addEventListener\('change', e => \{([\s\S]*?)\n    \}\);/)[1];
for (const value of ['glass', 'transparent', 'invalid']) {
    const S = { chatBackground: 'glass', mesBlur: 8, mesTint: .7, cardSolid: false };
    const calls = [];
    vm.runInNewContext('(function(){' + change + '})()', {
        S, e: { target: { value } }, sync() { calls.push('sync'); },
        applySurfaceSettings() { calls.push('surface'); }, repaintAll() { calls.push('paint'); },
        ctx: { saveSettingsDebounced() { calls.push('save'); } },
    });
    assert.equal(S.chatBackground, value === 'transparent' ? 'transparent' : 'glass');
    assert.equal(S.mesBlur, 8);
    assert.equal(S.mesTint, .7);
    assert.equal(S.cardSolid, false);
    assert.deepEqual(calls, value === 'invalid' ? ['sync'] : ['surface', 'paint', 'save']);
}

function element(classes = []) {
    const tokens = new Set(classes);
    const node = {
        isConnected: true, offsetWidth: 374, offsetHeight: 240, style: {}, children: [],
        classList: {
            contains: value => tokens.has(value),
            add: value => tokens.add(value), remove: value => tokens.delete(value),
            toggle(value, on) { if (on) tokens.add(value); else tokens.delete(value); },
        },
        setAttribute() {},
        prepend(child) { child.parent = node; node.children.unshift(child); },
        remove() {
            if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1);
            node.isConnected = false;
        },
    };
    return node;
}
let cases = 0;
for (const mode of ['glass', 'transparent']) {
    for (const kind of ['plain', 'card', 'overlay']) {
        for (const engine of ['physical', 'legacy']) {
            for (const allowed of [false, true]) {
                for (const noBlur of [false, true]) {
                    const el = element(kind === 'plain' ? [] : [kind === 'card' ? 'ilg-card-renderer' : 'ilg-content-overlay']);
                    const it = { kind: 'mes', id: 'test-filter', visible: true };
                    const calls = [];
                    const sandbox = {
                        S: { chatBackground: mode, engine, saturate: 1.6, brightness: 1.05 },
                        document: { createElement: () => element(), body: { classList: { contains: () => noBlur } } },
                        items: new Map([[el, it]]), trackable: () => true,
                        KIND: { mes: { blur: () => 3 } }, refractAllowed: () => allowed,
                        canRefract: () => allowed, isIOS: false, radiusOf: () => 22,
                        setPhys(node, _item, on) { node.classList.toggle('ilg-phys', on); },
                        buildPhysical() { calls.push('physical'); }, buildFilter() { calls.push('legacy'); },
                    };
                    const api = vm.runInNewContext(bodyOf('messageSurface') + '\n' + bodyOf('paint') + '\n({paint,messageSurface})', sandbox);
                    api.paint(el);
                    const surface = it.backdrop || el;
                    assert.equal(!!it.backdrop, kind !== 'plain');
                    if (kind !== 'plain') assert.equal(el.style.backdropFilter, 'none');
                    if (noBlur) {
                        assert.equal(surface.style.backdropFilter, 'none');
                        assert.deepEqual(calls, []);
                    } else if (allowed) {
                        assert.deepEqual(calls, [engine]);
                        assert(surface.style.backdropFilter.includes('url(#test-filter)'));
                    } else {
                        assert(surface.style.backdropFilter.startsWith('blur(' + (mode === 'transparent' ? 0 : 3) + 'px)'));
                    }
                    if (kind !== 'plain') {
                        const layer = it.backdrop;
                        api.paint(el);
                        assert.equal(it.backdrop, layer, 'Repeated paints reuse the layer');
                        assert.equal(el.children.length, 1);
                        el.classList.remove('ilg-card-renderer');
                        el.classList.remove('ilg-content-overlay');
                        api.messageSurface(el, it);
                        assert.equal(it.backdrop, null);
                        assert.equal(el.children.length, 0);
                    }
                    cases++;
                }
            }
        }
    }
}

const physical = bodyOf('buildPhysical');
const settings = { chatBackground: 'glass', mesBlur: 3, profile: 'lens' };
const builds = [];
const build = vm.runInNewContext(physical + '\n buildPhysical', {
    S: settings,
    KIND: { mes: { blur: () => settings.mesBlur }, bar: { blur: () => 1 } },
    getMaps: () => ({}), lightAngle: () => 135,
    filterOf: it => it.filter ||= { querySelectorAll: () => [] },
    physicalFilter(_maps, options) { builds.push(options.blur); return ''; },
});
build({ kind: 'mes' }, {}, 374, 240, 22);
settings.chatBackground = 'transparent';
build({ kind: 'mes' }, {}, 374, 240, 22);
build({ kind: 'bar' }, {}, 374, 50, 22);
settings.chatBackground = 'glass';
build({ kind: 'mes' }, {}, 374, 240, 22);
assert.deepEqual(builds, [3, 0, 1, 3]);
assert.equal(settings.mesBlur, 3, 'Transparent mode must not overwrite the user blur preference');

console.log(JSON.stringify({ passed: true, renderingCases: cases, checks: [
    'Settings retain defaults and reject invalid values without overwriting user parameters',
    'Plain, card and fixed-overlay messages use the selected full engine in both modes',
    'Transparent removes message blur without disabling refraction or changing input blur',
    'Card layers are reused and removed when the message stops owning a card',
    'Host no-blur disables both rendering paths',
] }, null, 2));
