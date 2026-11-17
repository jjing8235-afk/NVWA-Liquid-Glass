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
    const S = { chatBackground: 'glass', mesBlur: 8, mesTint: .7, chatVeil: 60 };
    const calls = [];
    vm.runInNewContext('(function(){' + change + '})()', {
        S, e: { target: { value } }, sync() { calls.push('sync'); },
        syncChatVeil() { calls.push('veil'); }, scheduleAdapt() { calls.push('adapt'); }, applySurfaceSettings() { calls.push('surface'); }, repaintAll() { calls.push('paint'); },
        ctx: { saveSettingsDebounced() { calls.push('save'); } },
    });
    assert.equal(S.chatBackground, value === 'transparent' ? 'transparent' : 'glass');
    assert.equal(S.mesBlur, 8);
    assert.equal(S.mesTint, .7);
    assert.equal(S.chatVeil, 60);
    assert.deepEqual(calls, value === 'invalid' ? ['sync'] : ['veil', 'surface', 'adapt', 'paint', 'save']);
}

const normalizeVeil = vm.runInNewContext(bodyOf('normalizeChatVeil') + ';normalizeChatVeil');
assert.equal(defaults.chatVeil,45);assert.equal(Object.hasOwn(defaults,'cardSolid'),false);
for (const [input,expected] of [[undefined,45],[null,45],['60',45],[NaN,45],[Infinity,45],[-10,0],[0,0],[44.6,45],[100,100],[130,100]]) assert.equal(normalizeVeil(input),expected);
const bookmarkSource=fs.readFileSync(new URL('../../appearance-bookmark.js',import.meta.url),'utf8').replace(/^export /gm,'');
const bookmark=vm.runInNewContext(bookmarkSource+';createAppearanceBookmark')(defaults);
const captured=bookmark.capture({...defaults,chatVeil:38,cardSolid:true});assert.equal(captured.values.chatVeil,38);assert(!Object.hasOwn(captured.values,'cardSolid'));
assert.equal(bookmark.read(captured).chatVeil,38);assert.equal(bookmark.read({...captured,values:{...captured.values,chatVeil:101}}),null);
const legacy=bookmark.read({...captured,values:{chatBackground:'glass',cardSolid:true}});assert.equal(legacy.chatBackground,'glass');assert(!Object.hasOwn(legacy,'cardSolid'));assert(!Object.hasOwn(legacy,'chatVeil'));
for(const mode of ['glass','transparent'])for(const enabled of[true,false])for(const level of[0,45,100]){
    const S={...defaults,enabled,chatBackground:mode,chatVeil:level},classes=new Set(),props={};
    const root={style:{setProperty(k,v){props[k]=v}},classList:{toggle(k,on){if(on)classes.add(k);else classes.delete(k)}}};
    vm.runInNewContext(bodyOf('applySurfaceSettings')+';applySurfaceSettings()',{S,root,lightBg:false,normalizeChatVeil:normalizeVeil});
    assert.equal(classes.has('ilg-chat-reading'),enabled&&mode==='glass'&&level>0);assert.equal(props['--ilg-reading-level'],level/100);
}
const strengthChange=source.match(/veilRange.addEventListener\('input', \(\) => \{([^]*?)\n    \}\);/)[1];
const actions=[],strength={chatVeil:45};vm.runInNewContext('(function(){'+strengthChange+'})()',{S:strength,veilRange:{value:'74'},normalizeChatVeil:normalizeVeil,applySurfaceSettings(){actions.push('surface')},syncChatVeil(){actions.push('sync')},scheduleAdapt(){actions.push('adapt')},ctx:{saveSettingsDebounced(){actions.push('save')}}});assert.equal(strength.chatVeil,74);assert.deepEqual(actions,['surface','sync','adapt','save'],'Strength changes must not request glass-map rebuilds');

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
        for (const engine of ['physical', 'legacy', 'css']) {
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
                        canRefract: () => allowed, isIOS: false, androidWebView:false, devicePixelRatio:1,largeWebViewMessage:()=>false,iosMaterialActive:()=>false, radiusOf: () => 22,
                        setPhys(node, _item, on) { node.classList.toggle('ilg-phys', on); },
                        measure: () => ({ w: 300, h: 120, r: 22 }),
                        cssGlassActive: () => engine === 'css', webStyleEnabled: () => false, controlSurface: () => false, controlReadable: () => false,
                        iosWallpaperRequested:()=>false, iosWallpaper:{release(){}}, webGlass: { release() {}, paint() {} }, reflections: { release() {}, paint() {} },
                        foldedMenuSurface: () => false,
                        buildPhysical() { calls.push('physical'); }, buildFilter() { calls.push('legacy'); },
                    };
                    const api = vm.runInNewContext(bodyOf('messageSurface') + '\n' + bodyOf('surfaceBlur') + '\n' + bodyOf('paint') + '\n({paint,messageSurface})', sandbox);
                    api.paint(el);
                    const surface = it.backdrop || el;
                    assert.equal(!!it.backdrop, kind !== 'plain');
                    if (kind !== 'plain') assert.equal(el.style.backdropFilter, 'none');
                    if (noBlur) {
                        assert.equal(surface.style.backdropFilter, 'none');
                        assert.deepEqual(calls, []);
                    } else if (engine === 'css') {
                        assert.deepEqual(calls, []);
                        assert.match(surface.style.backdropFilter, /var\(--ilg-reading-filter/);
                    } else if (allowed) {
                        assert.deepEqual(calls, [engine]);
                        assert(surface.style.backdropFilter.includes('url(#test-filter)'));
                    } else {
                        assert(surface.style.backdropFilter.startsWith('blur(' + (mode === 'transparent' ? 0 : 3) + 'px)'), mode + ' ' + kind + ' got ' + surface.style.backdropFilter);
                    }
                    if (!noBlur) assert.match(surface.style.backdropFilter, /var\(--ilg-reading-filter/, 'Every message engine carries the same CSS reading filter');
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
const build = vm.runInNewContext(bodyOf('surfaceBlur') + '\n' + physical + '\n buildPhysical', {
    S: settings,
    KIND: { mes: { blur: () => settings.mesBlur, bezelK: 1, thickK: 1, k: 1 }, bar: { blur: () => 1, bezelK: 1, thickK: 1, k: 1 } },
    ARC_ONLY: {},
    getMaps: () => ({}), lightAngle: () => 135, controlReadable: () => false, foldedMenuSurface: () => false,
    resizePhysicalFilter: () => false,
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
    'Reading strength is bounded, restores through bookmarks and ignores retired saved options',
    'Mode/disable/zero gate message-local reading treatment; strength updates avoid glass-map rebuilds',
    'Plain, card and fixed-overlay messages use the selected full engine in both modes',
    'Transparent removes message blur without disabling refraction or changing input blur',
    'Card layers are reused and removed when the message stops owning a card',
    'Host no-blur disables both rendering paths',
] }, null, 2));

const css = fs.readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
assert(!css.includes('#sheld::before'), 'No reading layer may cover the chat shell');
assert(css.includes('.mes.ilg-glass {\n    --ilg-reading-alpha:'), 'Reading tint belongs to each message');
assert(!source.includes('layout.veil ='), 'Top foreground sampling must use the original wallpaper');
