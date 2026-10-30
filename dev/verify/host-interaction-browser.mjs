// Optional browser regression for host UI state changes; no packages or browsers are installed by this test.
// NVWA_PLAYWRIGHT_MODULE and NVWA_EDGE_EXECUTABLE can select existing dependencies.
// NVWA_EXTENSION_ROOT selects a comparison build; NVWA_EXPECT_BASELINE=1 records its operation counts.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
const moduleName = process.env.NVWA_PLAYWRIGHT_MODULE || 'playwright';
const tools = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const root = path.resolve(process.env.NVWA_EXTENSION_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
const baseline = process.env.NVWA_EXPECT_BASELINE === '1';
const browserType = process.env.NVWA_BROWSER || 'chromium';
const original = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
let instrumented = original;
const hooks = [
    ['const items = new Map();', 'const items = new window.HostAuditMap();'],
    ['function scan() {', 'function scan() { window.audit.scans++;'],
    ['function paint(el) {', 'function paint(el) { if (el.matches?.("#chat .mes")) { window.audit.messagePaints++; window.paintedMessages.add(el.getAttribute("mesid")); }'],
    ['function buildPhysical(it, el, w, h, r) {', 'function buildPhysical(it, el, w, h, r) { if (it.kind === "mes") window.filterRadii.set(el.getAttribute("mesid"), r);']
];
for (const [from, to] of hooks) { assert(instrumented.includes(from), 'Missing audit hook: ' + from); instrumented = instrumented.replace(from, to); }
const fixture = count => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Isolated host interaction regression</title>
<link rel="stylesheet" href="/extension/style.css">
<style>
:root{--topBarBlockSize:56px;--sheldWidth:100vw;--SmartThemeBodyColor:#eee;--SmartThemeBlurTintColor:#171d29;--SmartThemeBorderColor:#555}
body{margin:0;background:#24344a;color:#eee;font:16px system-ui}#top-bar{position:fixed;inset:0 0 auto;height:56px}#top-settings-holder{display:flex;height:56px}.drawer-icon{width:34px;height:34px}.drawer-content{display:none}
#sheld{position:fixed;inset:64px 0 90px}#chat{height:100%;overflow:auto;padding:0 15px}.mes{box-sizing:border-box;height:180px;min-height:180px;padding:18px;margin:12px 0;border-radius:22px!important}
body.fixture-panel-open .mes{border-radius:30px!important}
#form_sheld{position:fixed;bottom:10px;left:12px;right:12px}#nonQRFormItems{height:56px;display:flex;border-radius:28px}#send_textarea{width:70%;height:30px}
#extensions_settings2{display:none}#fixture-open{position:fixed;top:8px;right:8px;z-index:500}#fixture-panel{position:fixed;inset:100px 20px auto;padding:20px;background:#eee;color:#111;z-index:400}#fixture-panel[hidden]{display:none}
</style></head><body class="bubblechat">
<div id="top-bar"><div id="top-settings-holder"><div id="ai-config-button" class="drawer"><div class="drawer-icon"></div></div><div id="persona-management-button" class="drawer"><div class="drawer-icon"></div></div><div id="rightNavHolder" class="drawer"><div class="drawer-icon"></div></div></div></div>
<div id="extensions_settings2"></div><div id="sheld"><div id="chat">${Array.from({ length: count }, (_, i) => `<div class="mes${i === count - 1 ? ' last_mes' : ''}" mesid="${i}" is_user="false"><div class="mes_text"><p>History fixture ${i}</p></div></div>`).join('')}</div><form id="form_sheld"><div id="nonQRFormItems"><div id="leftSendForm"></div><textarea id="send_textarea"></textarea></div></form></div>
<button type="button" id="fixture-open">Settings</button><section id="fixture-panel" role="dialog" hidden>Settings fixture</section>
<script>
window.audit={scans:0,messagePaints:0,registryEntries:0};window.paintedMessages=new Set();window.filterRadii=new Map();
window.HostAuditMap=class extends Map{forEach(fn,receiver){for(const [key,value] of this){audit.registryEntries++;fn.call(receiver,value,key,this);}}};
window.fixtureEvents={};const settings={v:9,enabled:true,home:false,orb:false,islands:false,fold:false,follow:false,wallsReady:true,tone:'dark'};
const context={extensionSettings:{iosLiquidGlass:settings},powerUserSettings:{auto_scroll_chat_to_bottom:false},chatMetadata:{},getCurrentChatId:()=> 'isolated-fixture',eventSource:{on(name,fn){(fixtureEvents[name]||=[]).push(fn)}},eventTypes:{APP_READY:'ready',CHAT_CHANGED:'chat-changed'},saveSettingsDebounced(){},getRequestHeaders:()=>({})};
window.SillyTavern={getContext:()=>context};window.toastr={warning(){},info(){},success(){},error(){}};
window.fixtureReady=false;window.fixtureFailure=null;
window.settle=async()=>{await new Promise(r=>setTimeout(r,350));for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);};
window.resetAudit=()=>{audit={scans:0,messagePaints:0,registryEntries:0};paintedMessages.clear();};
document.getElementById('fixture-open').onclick=()=>{document.getElementById('fixture-panel').hidden=false;document.body.classList.add('fixture-panel-open');};
</script><script type="module">try{await import('/extension/index.js');fixtureReady=true;}catch(error){fixtureFailure=String(error.stack||error);throw error;}</script></body></html>`;
const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/') { res.setHeader('Content-Type', 'text/html;charset=utf-8'); res.end(fixture(Number(new URL(req.url, 'http://localhost').searchParams.get('floors')) || 4)); return; }
    if (pathname.startsWith('/extension/')) {
        const file = path.resolve(root, pathname.slice(11));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
        res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
        res.end(file === path.join(root, 'index.js') ? instrumented : fs.readFileSync(file)); return;
    }
    res.writeHead(pathname === '/favicon.ico' ? 204 : 404); res.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const results = [], errors = [];
try {
    browser = await tools[browserType].launch({ headless: true, ...(browserType === 'chromium' && process.env.NVWA_EDGE_EXECUTABLE ? { executablePath: process.env.NVWA_EDGE_EXECUTABLE } : {}) });
    for (const floors of [4, 80, 240]) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port + '/?floors=' + floors);
        await page.waitForFunction(() => fixtureReady || fixtureFailure);
        assert.equal(await page.evaluate(() => fixtureFailure), null);
        await page.evaluate(() => settle());
        assert.equal(await page.locator('#chat .mes.ilg-glass').count(), floors);
        await page.evaluate(() => resetAudit());
        await page.locator('#fixture-open').click();
        const opened = await page.evaluate(async () => { await settle(); return { ...audit, paintedFloors: [...paintedMessages] }; });
        assert(await page.locator('#fixture-panel').isVisible());
        const physical = await page.locator('#chat .mes').first().evaluate(el => el.classList.contains('ilg-phys'));
        if (physical) assert.equal(await page.evaluate(() => filterRadii.get('0')), 30, 'Visible radius updates for host classes');
        await page.evaluate(() => { resetAudit(); document.body.classList.remove('fixture-panel-open'); document.getElementById('fixture-panel').hidden = true; });
        const closed = await page.evaluate(async () => { await settle(); return { ...audit, paintedFloors: [...paintedMessages] }; });
        if (physical) assert.equal(await page.evaluate(() => filterRadii.get('0')), 22);
        if (!baseline) for (const sample of [opened, closed]) { assert.equal(sample.scans, 0); assert.equal(sample.registryEntries, 0); assert(sample.messagePaints <= 8, 'Only near-viewport messages should repaint'); }
        const lifecycle = await page.evaluate(async count => {
            const chat = document.getElementById('chat');
            document.body.classList.add('fixture-panel-open'); await settle();
            chat.scrollTop = chat.scrollHeight; await settle();
            const last = chat.lastElementChild;
            const enteringViewport = paintedMessages.has(String(count - 1));
            const radiusRestored = !last.classList.contains('ilg-phys') || filterRadii.get(String(count - 1)) === 30;
            document.body.classList.add('no-blur'); await settle();
            const blurDisabled = last.style.backdropFilter === 'none' && last.style.webkitBackdropFilter === 'none';
            document.body.classList.remove('no-blur'); await settle();
            const blurRestored = last.style.backdropFilter !== 'none';
            document.body.classList.remove('bubblechat'); await settle();
            const plainModeClean = !chat.querySelector('.ilg-glass');
            document.body.classList.add('bubblechat'); await settle();
            const bubbleModeRestored = chat.querySelectorAll('.mes.ilg-glass').length === count;
            const fresh = document.createElement('div'); fresh.className = 'mes'; fresh.setAttribute('mesid', String(count)); fresh.innerHTML = '<div class="mes_text"><p>New message</p></div>';
            chat.append(fresh); await settle(); const insertedTracked = fresh.classList.contains('ilg-glass');
            fresh.remove(); await settle(); const removedClean = !fresh.classList.contains('ilg-glass');
            document.getElementById('ilg-opt-enabled').click(); await settle();
            const disabledClean = !chat.querySelector('.ilg-glass');
            document.getElementById('ilg-opt-enabled').click(); await settle();
            const enabledRestored = chat.querySelectorAll('.mes.ilg-glass').length === count;
            return { enteringViewport, radiusRestored, blurDisabled, blurRestored, plainModeClean, bubbleModeRestored, insertedTracked, removedClean, disabledClean, enabledRestored };
        }, floors);
        assert(Object.values(lifecycle).every(Boolean), JSON.stringify(lifecycle));
        results.push({ floors, physical, opened, closed, lifecycle });
        await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ kind: 'isolated-host-interaction-operation-counts', browser: browserType, baseline, results, errors, limitations: ['Synthetic host, fixed-size messages, desktop browser at mobile viewport', 'Operation counts are not phone latency, INP, or real-card acceptance'] }, null, 2));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
