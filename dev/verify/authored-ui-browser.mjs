import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(process.env.NVWA_EXTENSION_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
const fixtures = process.env.NVWA_COMPAT_FIXTURES ? JSON.parse(await fs.readFile(process.env.NVWA_COMPAT_FIXTURES, 'utf8')) : { documents: [], pluginCSS: '', sources: [] };
const source = await fs.readFile(path.join(root, 'index.js'), 'utf8');
const rangeSource = source.slice(source.indexOf('const RANGE_THUMB ='), source.indexOf('// 思考小球：'));
assert(rangeSource.includes('function paintRange('), 'Use the actual control handlers');
const harness = `const S={enabled:true},root=document.documentElement,HOST_UI_SEL='#top-settings-holder, #sheld, #options, #extensionsMenu, #ilg-fold-menu',ctx={eventTypes:{},eventSource:{on(){}}};\n${rangeSource}\nwindow.__rangeProbe={paint:paintRanges,enable(value){S.enabled=value;}};`;
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><style>
body{margin:0;font:16px Arial}#sheld{position:relative;width:390px;height:600px}#chat{position:relative;top:60px;height:260px;overflow:auto}.mes_text{font-size:16px}#foreign-inline{padding:10px;background:#212c45;color:#f0d8a0;border:2px solid #896659;border-radius:7px;text-shadow:2px 3px 1px rgb(181,90,60);font:16px Georgia}
#foreign-inline .menu_button{background:#503445;color:#dfbc96;border-radius:5px;padding:5px;box-shadow:1px 2px 3px #74324e}#foreign-inline .text_pole{background:#3b3043;color:#dfbc96;border-radius:4px}#foreign-inline input[type=range]{width:170px;height:12px;background:#735c74}#foreign-inline input[type=checkbox]{width:15px;height:15px;appearance:auto}.acu-window{left:410px;top:20px;width:300px;height:150px}.acu-dialog-layer{position:fixed;left:420px;top:200px;width:290px;height:160px}#generic-foreign{position:fixed;left:420px;top:390px;width:280px;background:#233044;color:#decaaa;text-shadow:1px 2px 1px #885544}#generic-foreign input{width:140px}#catgod-oracle-qrbar .qr--button{font:13px Georgia;background:#503246;color:#e6b3c7;border-radius:6px;padding:3px 7px}#catgod-oracle-qrbar{display:flex}#native-range{width:160px}.mes_text iframe{width:310px;height:180px}
</style></head><body><div id="top-settings-holder"><div class="drawer"><div class="drawer-content"><input id="native-range" type="range" value="25"></div></div></div><div id="sheld"><div id="chat"><div class="mes"><div class="mes_block"><div class="mes_buttons"><span id="native-copy-icon" class="mes_copy">Copy</span></div><div class="mes_text"><details id="foreign-inline" class="ilg-card-surface" open><summary class="mes_reasoning_header">Authored reasoning</summary><span class="mes_copy" style="font-size:15px;line-height:21px">Authored icon label</span><button class="menu_button">Choice</button><select class="text_pole"><option>One</option><option>Two</option></select><input type="range" value="10"><input type="checkbox"></details><div id="frame-fixtures"></div></div></div></div></div><div id="form_sheld"><form id="send_form"><div id="catgod-oracle-qrbar"><button type="button" class="qr--button menu_button">Preset option</button></div></form></div><section id="generic-foreign" role="dialog"><input type="range" value="10"><select><option>One</option><option>Two</option></select></section></div><div class="acu-window-overlay" hidden></div><div class="acu-window"><div class="acu-window-header">Database</div><div class="acu-window-content"><input type="range" value="10"><select><option>One</option><option>Two</option></select></div></div><div class="acu-dialog-layer"><section class="acu-dialog" role="dialog"><header class="acu-dialog__header">Confirmation</header><div class="acu-dialog__actions"><button>Cancel</button></div></section></div><script src="/harness.js" type="module"></script></body></html>`;
const server = http.createServer(async (req, res) => {
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end(html); return; }
    if (req.url === '/harness.js') { res.setHeader('content-type', 'text/javascript'); res.end(harness); return; }
    if (['/style.css', '/card-clarity.js', '/mes-icons.js'].includes(req.url)) { res.setHeader('content-type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(await fs.readFile(path.join(root, req.url.slice(1)))); return; }
    res.writeHead(404); res.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const modulePath = process.env.NVWA_PLAYWRIGHT_MODULE || 'playwright';
const tools = await import(path.isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath);
const engine = process.env.NVWA_BROWSER || 'chromium';
let browser;
try {
    browser = await tools[engine].launch({ headless: true, ...(engine === 'chromium' && process.env.NVWA_EDGE_EXECUTABLE ? { executablePath: process.env.NVWA_EDGE_EXECUTABLE } : {}) });
    const page = await browser.newPage({ viewport: { width: 820, height: 740 }, hasTouch: true, isMobile: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { window.__resizeErrors = []; window.addEventListener('error', event => { if (/^ResizeObserver loop/.test(event.message)) __resizeErrors.push(event.message); }); });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => !!window.__rangeProbe);
    await page.addStyleTag({ content: fixtures.pluginCSS });
    const result = await page.evaluate(async fixtures => {
        const failures = [], checks = [];
        const check = (ok, label, details) => { checks.push({ label, passed: !!ok }); if (!ok) failures.push({ label, details }); };
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const props = ['backgroundColor','backgroundImage','color','borderRadius','borderColor','padding','boxShadow','textShadow','fontFamily','fontSize','height','appearance','filter','backdropFilter','zIndex'];
        const styleOf = el => Object.fromEntries(props.map(name => [name, getComputedStyle(el)[name]]));
        const selectors = ['#foreign-inline','#foreign-inline .menu_button','#foreign-inline .mes_reasoning_header','#foreign-inline .mes_copy','#foreign-inline select','#foreign-inline input[type=range]','#foreign-inline input[type=checkbox]','#catgod-oracle-qrbar .qr--button','.acu-window','.acu-dialog','#generic-foreign'];
        const baseline = Object.fromEntries(selectors.map(selector => [selector, styleOf(document.querySelector(selector))]));
        const shadowHost = document.createElement('div'); document.getElementById('sheld').append(shadowHost); const shadow = shadowHost.attachShadow({mode:'open'}); const shadowStyle = document.createElement('style'); shadowStyle.textContent = fixtures.shadowCSS || ':host{all:initial}button{background:#553344;color:#ddbb99}'; shadow.append(shadowStyle); const shadowPanel = document.createElement('div'); shadowPanel.className = 'pop'; shadowPanel.innerHTML = '<div class="panel"><button class="tab menu_button">Authored shadow choice</button></div>'; shadow.append(shadowPanel); const shadowBaseline = styleOf(shadowPanel.querySelector('button'));
        const container = document.getElementById('frame-fixtures');
        const frames = [];
        const policy = '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src data:; font-src data:">';
        for (const doc of fixtures.documents) {
            const frame = document.createElement('iframe'); frame.setAttribute('sandbox', 'allow-same-origin'); frame.dataset.fixture = doc.key;
            const ready = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
            frame.srcdoc = policy + doc.html; container.append(frame); await ready;
            const sample = frame.contentDocument.createElement('span'); sample.dataset.authoredProbe = '1'; sample.style.cssText = 'text-shadow:2px 3px 1px rgb(99,77,55);color:rgb(177,133,99);font:17px serif'; sample.textContent = 'Authored sample'; frame.contentDocument.body.append(sample);
            frames.push({ frame, key: doc.key, before: styleOf(sample) });
        }
        const plain = document.createElement('iframe'); plain.setAttribute('sandbox', 'allow-same-origin'); const plainReady = new Promise(resolve => plain.addEventListener('load', resolve, { once: true })); plain.srcdoc = policy + '<p>Unstyled document</p>'; container.append(plain); await plainReady;
        const { createCardTextClarity } = await import('/card-clarity.js');
        const manager = createCardTextClarity(document.getElementById('chat'));
        document.documentElement.className = 'ilg ilg-light ilg-font ilg-icons';
        const { installMessageIcons } = await import('/mes-icons.js'); installMessageIcons();
        manager.setEnabled(true); __rangeProbe.paint(); await wait(120);
        check(getComputedStyle(document.getElementById('native-copy-icon')).fontSize === '0px' && getComputedStyle(document.getElementById('native-copy-icon'),'::before').maskImage.includes('data:image/svg+xml'), 'Native message action retains its replacement icon');
        check(JSON.stringify(styleOf(shadowPanel.querySelector('button'))) === JSON.stringify(shadowBaseline), 'Shadow UI keeps its authored cascade');
        for (const selector of selectors) { const after = styleOf(document.querySelector(selector)); check(JSON.stringify(after) === JSON.stringify(baseline[selector]), 'Authored styles preserved: ' + selector, { before: baseline[selector], after }); }
        document.documentElement.classList.remove('ilg-light');
        for (const selector of selectors) check(JSON.stringify(styleOf(document.querySelector(selector))) === JSON.stringify(baseline[selector]), 'Dark-tone authored styles preserved: ' + selector);
        document.documentElement.classList.add('ilg-light');
        for (const entry of frames) { const doc = entry.frame.contentDocument; check(JSON.stringify(styleOf(doc.querySelector('[data-authored-probe]'))) === JSON.stringify(entry.before) && !doc.querySelector('[data-ilg-card-clarity]'), 'Preset frame preserved: ' + entry.key); }
        check(!document.querySelector('.acu-window.ilg-floating-clarity, .acu-dialog-layer.ilg-floating-clarity, #generic-foreign.ilg-floating-clarity'), 'Foreign windows are outside the clarity scanner');
        check(!!plain.contentDocument.querySelector('[data-ilg-card-clarity]'), 'Plain frame keeps the inherited-halo fallback');
        const ownStyle = plain.contentDocument.createElement('style'); ownStyle.textContent = 'p{text-shadow:2px 2px 1px red}'; plain.contentDocument.head.append(ownStyle); const releaseDeadline = performance.now() + 2000; while (plain.contentDocument.querySelector('[data-ilg-card-clarity]') && performance.now() < releaseDeadline) await wait(20);
        check(!plain.contentDocument.querySelector('[data-ilg-card-clarity]') && getComputedStyle(plain.contentDocument.querySelector('p')).textShadow.includes('255, 0, 0'), 'A frame adding its own style releases the fallback');

        ownStyle.remove(); const restoreDeadline = performance.now() + 2000; while (!plain.contentDocument.querySelector('[data-ilg-card-clarity]') && performance.now() < restoreDeadline) await wait(20);
        check(!!plain.contentDocument.querySelector('[data-ilg-card-clarity]'), 'Removing author styles restores only the plain-document fallback');
        const plainDoc = plain.contentDocument; plain.remove(); const detachDeadline = performance.now() + 2000; while (plainDoc.querySelector('[data-ilg-card-clarity]') && performance.now() < detachDeadline) await wait(20);
        check(!plainDoc.querySelector('[data-ilg-card-clarity]'), 'A disconnected frame releases its style and observer');
        const opaque = document.createElement('iframe'); opaque.setAttribute('sandbox',''); let opaqueReads = 0; const frameDoc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument').get; Object.defineProperty(opaque, 'contentDocument', {get(){opaqueReads++;return frameDoc.call(this);}}); const opaqueReady = new Promise(resolve => opaque.addEventListener('load',resolve,{once:true})); opaque.srcdoc=policy+'<p>Opaque-origin content</p>'; container.append(opaque); await opaqueReady; await wait(60);
        check(opaqueReads === 0, 'Opaque-origin frames are skipped before reading their document', {opaqueReads}); opaque.remove();
        const rangeSelectors = ['#foreign-inline input[type=range]','#generic-foreign input[type=range]','.acu-window input[type=range]'];
        const interactions = [];
        for (const selector of rangeSelectors) {
            const range = document.querySelector(selector); let calls = 0; range.addEventListener('input', () => calls++);
            const box = range.getBoundingClientRect(); range.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: box.right - 1 })); range.value = '73'; range.dispatchEvent(new Event('input', { bubbles: true }));
            const state = { selector, value: range.value, calls, fill: range.style.getPropertyValue('--ilg-fill'), tooltip: !document.getElementById('ilg-range-value').hidden };
            interactions.push(state); check(state.value === '73' && calls === 1 && !state.fill && !state.tooltip, 'Third-party range event preserved: ' + selector, state); range.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
        }
        const native = document.getElementById('native-range'); check(!!native.style.getPropertyValue('--ilg-fill'), 'Native host range retains its progress styling');
        let nativeCalls = 0; native.addEventListener('input', () => nativeCalls++); const nb = native.getBoundingClientRect(); native.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: nb.right - 1 })); native.value = '74'; native.dispatchEvent(new Event('input', { bubbles: true }));
        check(native.value === '25' && nativeCalls === 0, 'Native host range retains mobile mis-tap protection'); native.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9 }));
        const select = document.querySelector('#foreign-inline select'); let selects = 0; select.addEventListener('change', () => selects++); select.value = 'Two'; select.dispatchEvent(new Event('change', { bubbles: true }));
        check(select.value === 'Two' && selects === 1, 'Authored select retains its value and change event');
        manager.destroy(); check(![...frames.map(row => row.frame), plain].some(frame => frame.contentDocument?.querySelector('[data-ilg-card-clarity]')), 'Clarity destroy releases its own styles');
        check(__resizeErrors.length === 0, 'No native resize-loop errors', __resizeErrors);
        return { failures, checks, interactions, fixtureDocuments: fixtures.documents.length, resizeErrors: __resizeErrors, authorScriptsExecuted: false, fullThirdPartyRuntimeExecuted: false };
    }, fixtures);
    const report = { passed: result.failures.length === 0 && errors.length === 0, engine, ...result, sources: fixtures.sources, errors, physicalPhone: false };
    if (process.env.NVWA_RESULT_FILE) await fs.writeFile(process.env.NVWA_RESULT_FILE, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, failures: report.failures.map(failure => ({ label: failure.label })) }, null, 2));
    assert(report.passed, 'Authored UI compatibility checks failed');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
