import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(process.env.NVWA_EXTENSION_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
const name = process.env.NVWA_PLAYWRIGHT_MODULE || 'playwright';
const tools = await import(path.isAbsolute(name) ? pathToFileURL(name).href : name);
const engine = process.env.NVWA_BROWSER || 'chromium';
const html = '<!doctype html><html class="ilg ilg-clear-optics ilg-liquid-web"><head><link rel="stylesheet" href="/style.css"><style>body{margin:0}#sheld{position:relative;width:390px;height:600px}#nonQRFormItems,#fixture-panel{position:absolute!important;left:20px!important;top:20px!important;width:300px!important;height:70px!important;border-radius:25px!important;border:0!important;margin:0!important;padding:0!important}#fixture-panel{top:120px!important;display:none}#chat{position:absolute;top:250px}.mes_text{font:16px Arial}</style></head><body><div id="sheld"><div id="nonQRFormItems" class="ilg-glass ilg-reflection"><button>Control</button></div><div id="fixture-panel" class="drawer-content ilg-glass ilg-reflection"></div><div id="chat"><div class="mes"><div class="mes_text">Preserved text<iframe srcdoc="<input id=state value=PRESERVED>"></iframe></div></div></div></div></body></html>';
const server = http.createServer(async (req, res) => {
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end(html); return; }
    if (['/style.css', '/light-scope.js'].includes(req.url)) { res.setHeader('content-type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(await fs.readFile(path.join(root, req.url.slice(1)))); return; }
    res.writeHead(404); res.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await tools[engine].launch({ headless: true, ...(engine === 'chromium' && process.env.NVWA_EDGE_EXECUTABLE ? { executablePath: process.env.NVWA_EDGE_EXECUTABLE } : {}) });
    const page = await browser.newPage({ viewport: { width: 420, height: 700 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { window.__poseResizeErrors = []; window.addEventListener('error', event => { if (/^ResizeObserver loop/.test(event.message)) window.__poseResizeErrors.push(event.message); }); });
    await page.goto('http://127.0.0.1:' + server.address().port);
    const result = await page.evaluate(async () => {
        const check = (condition, message) => { if (!condition) throw Error(message); };
        const { createLightScope } = await import('/light-scope.js');
        const root = document.documentElement, bar = document.getElementById('nonQRFormItems'), panel = document.getElementById('fixture-panel');
        const original = bar.getBoundingClientRect(), message = document.querySelector('.mes_text'), frame = message.querySelector('iframe');
        const scope = createLightScope(root); scope.visibility(bar, true); scope.visibility(panel, false); scope.update({ x: .34, y: -.21 });
        check(bar.querySelectorAll(':scope > .ilg-pose-overlay > .ilg-pose-layer').length === 1, 'Visible surfaces must own one local pose layer');
        check(!panel.querySelector('.ilg-pose-overlay'), 'Hidden panels must not allocate pose layers');
        const overlay = bar.querySelector('.ilg-pose-overlay');
        check(overlay.getAttribute('aria-hidden') === 'true' && getComputedStyle(overlay).pointerEvents === 'none', 'A decorative pose layer must not intercept controls');
        check([...overlay.querySelectorAll('*')].every(el => el.tabIndex < 0), 'Pose children must stay outside keyboard focus');
        let parentStyleWrites = 0, repeatedWrites = 0;
        const observer = new MutationObserver(entries => { parentStyleWrites += entries.length; }); observer.observe(bar, { attributes: true, attributeFilter: ['style'] });
        const repeated = new MutationObserver(entries => { repeatedWrites += entries.length; }); repeated.observe(overlay, { attributes: true, childList: true, subtree: true });
        scope.update({ x: .34, y: -.21 }); await new Promise(resolve => setTimeout(resolve, 0)); repeated.disconnect();
        check(repeatedWrites === 0, 'An unchanged point must not rewrite or replace its layer');
        const savedRect = bar.getBoundingClientRect;
        bar.getBoundingClientRect = () => { throw Error('A pose update measured layout'); };
        for (let i = 0; i < 30; i++) scope.update({ x: Math.sin(i) * .7, y: Math.cos(i) * .7 });
        bar.getBoundingClientRect = savedRect; await new Promise(resolve => setTimeout(resolve, 0)); observer.disconnect();
        check(parentStyleWrites === 0, 'Pose changes must not write inherited variables on the native surface');
        check(!root.style.getPropertyValue('--ilg-tilt-x') && !bar.style.getPropertyValue('--ilg-tilt-x'), 'Pose coordinates leaked into unrelated descendants');
        let maxCentreError = 0;
        function centre(el, point) {
            const box = el.querySelector('.ilg-pose-overlay').getBoundingClientRect(), layer = el.querySelector('.ilg-pose-layer').getBoundingClientRect();
            const dx = Math.abs(layer.left + layer.width / 2 - (box.left + box.width * (.5 + point.x * .6)));
            const dy = Math.abs(layer.top + layer.height / 2 - (box.top + box.height * (.32 + point.y * .8)));
            maxCentreError = Math.max(maxCentreError, dx, dy); check(dx < .15 && dy < .15, 'The moving light lost the original ellipse centre');
        }
        for (const point of [{x:0,y:0},{x:1,y:-1},{x:-1,y:1},{x:.34,y:-.21}]) { scope.update(point); centre(bar, point); }
        panel.style.display = 'block'; scope.visibility(panel, true); centre(panel, {x:.34,y:-.21});
        bar.style.setProperty('width', '330px', 'important'); bar.style.setProperty('height', '90px', 'important'); centre(bar, {x:.34,y:-.21});
        bar.style.removeProperty('width'); bar.style.removeProperty('height');
        bar.querySelector('.ilg-pose-overlay').remove(); scope.update({x:.34,y:-.21});
        check(bar.querySelectorAll('.ilg-pose-overlay').length === 1, 'A replaced host child left a stale pose layer');
        scope.visibility(panel, false); check(!panel.querySelector('.ilg-pose-overlay'), 'Closing a panel retained its layer');
        const now = bar.getBoundingClientRect(); check(Math.abs(original.width - now.width) < .01 && Math.abs(original.height - now.height) < .01, 'Pose rendering changed native layout');
        check(message.textContent === 'Preserved text' && frame.contentDocument.getElementById('state').value === 'PRESERVED', 'Message or iframe state changed');
        const floor = document.createElement('div'); floor.id = 'ilg-floor'; document.body.append(floor); scope.visibility(floor, true); scope.update({x:.34,y:-.21});
        check(!floor.querySelector('.ilg-pose-overlay') && !floor.classList.contains('ilg-composited-pose') && floor.style.getPropertyValue('--ilg-tilt-x') === '0.34' && floor.style.getPropertyValue('--ilg-tilt-y') === '-0.21', 'The tiny floor label must retain its original rim');
        scope.visibility(floor, false); check(!floor.classList.contains('ilg-pose-surface') && !floor.style.getPropertyValue('--ilg-tilt-x') && !floor.style.getPropertyValue('--ilg-tilt-y'), 'A hidden floor label retained pose coordinates');
        scope.visibility(floor, true);
        scope.update(null); check(!floor.style.getPropertyValue('--ilg-tilt-x') && !floor.style.getPropertyValue('--ilg-tilt-y'), 'Disabling light retained floor coordinates'); scope.release(floor); floor.remove();
        check(!document.querySelector('.ilg-pose-overlay') && !root.classList.contains('ilg-tilt-light'), 'Disabling light retained layers');
        scope.update({x:0,y:0}); bar.remove(); scope.update({x:.1,y:.2}); check(!bar.querySelector('.ilg-pose-overlay'), 'Disconnected surfaces retained layers');
        scope.release(bar); scope.destroy(); check(scope.status().tracked === 0 && !document.querySelector('.ilg-pose-overlay'), 'Scope cleanup retained resources');
        const supports = CSS.supports; CSS.supports = () => false; const fallback = createLightScope(root); CSS.supports = supports;
        document.getElementById('sheld').append(bar); fallback.visibility(bar, true); fallback.update({x:.34,y:-.21});
        check(bar.style.getPropertyValue('--ilg-tilt-x') === '0.34' && !bar.querySelector('.ilg-pose-overlay'), 'Unsupported-layer fallback lost the original light'); fallback.destroy();
        check(window.__poseResizeErrors.length === 0, 'Pose lifecycle triggered a native size loop');
        return { floorOriginalRimPreserved: true, floorCoordinatesCleaned: true, resizeErrors: window.__poseResizeErrors, localLayers: true, parentStyleWrites, repeatedWrites, poseUpdates: 30, stationaryPanelOpen: true, responsiveCentrePreserved: true, maxCentreError, nativeGeometryPreserved: true, childReplacementRecovered: true, hiddenAndDisconnectedClean: true, inputAndIframePreserved: true, cleanup: true, legacyFallback: true };
    });
    assert.deepEqual(errors, []);
    const report = { passed: true, engine, ...result, errors, physicalPhone: false };
    if (process.env.NVWA_RESULT_FILE) await fs.writeFile(process.env.NVWA_RESULT_FILE, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
