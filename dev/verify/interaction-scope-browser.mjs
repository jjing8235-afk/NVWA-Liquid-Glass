// Optional browser regression: provide an existing Playwright module and browser via environment variables.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.NVWA_PLAYWRIGHT_MODULE || 'playwright');
const source = fs.readFileSync(process.env.NVWA_CLARITY_SOURCE || new URL('../../card-clarity.js', import.meta.url), 'utf8');
const server = http.createServer((req, res) => {
    if (req.url === '/clarity.js') { res.setHeader('Content-Type', 'text/javascript'); res.end('const Map = window.AuditMap || window.Map;\n' + source); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><body></body>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, ...(process.env.NVWA_EDGE_EXECUTABLE ? { executablePath: process.env.NVWA_EDGE_EXECUTABLE } : {}) });
const results = [], errors = [];
try {
    for (const floors of [4, 80, 240]) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url);
        await page.evaluate(async count => {
            document.body.innerHTML = '<style>*{text-shadow:0 0 2px #000}.portal{position:fixed;inset:20px;background:white}.mes_text{height:32px}iframe{width:100%;height:30px}</style><button id="show">Open panel</button><div id="portal" class="portal" role="dialog" hidden>Settings</div><main id="chat"></main>';
            const chat = document.getElementById('chat'), waits = [];
            for (let i = 0; i < count; i++) {
                const message = document.createElement('div'); message.className = 'mes_text';
                const frame = document.createElement('iframe'); frame.srcdoc = '<html><head></head><body><button>Choice</button><p>Card fixture</p></body></html>';
                waits.push(new Promise(resolve => frame.addEventListener('load', resolve, { once: true })));
                message.append(frame); chat.append(message);
            }
            await Promise.all(waits);
            window.work = { frameProbes: 0, rootQueries: 0, registryEntries: 0 };
            window.AuditMap = class extends Map {
                *[Symbol.iterator]() { for (const entry of super[Symbol.iterator]()) { work.registryEntries++; yield entry; } }
                *keys() { for (const key of super.keys()) { work.registryEntries++; yield key; } }
            };
            const getDocument = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument').get;
            for (const frame of chat.querySelectorAll('iframe')) Object.defineProperty(frame, 'contentDocument', { get() { work.frameProbes++; return getDocument.call(this); } });
            const query = chat.querySelectorAll.bind(chat);
            chat.querySelectorAll = selector => { if (selector === '.mes_text iframe') work.rootQueries++; return query(selector); };
            const { createCardTextClarity } = await import('/clarity.js');
            window.component = createCardTextClarity(chat); component.setEnabled(true);
            window.settle = async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); };
            await settle();
            document.getElementById('show').onclick = () => { document.getElementById('portal').hidden = false; };
        }, floors);
        const portal = await page.evaluate(async () => {
            work = { frameProbes: 0, rootQueries: 0, registryEntries: 0 };
            const start = performance.now(); document.getElementById('show').click(); await settle();
            return { ...work, sampledTurnaroundMs: performance.now() - start, styled: document.getElementById('portal').classList.contains('ilg-floating-clarity') };
        });
        const message = await page.evaluate(async () => {
            work = { frameProbes: 0, rootQueries: 0, registryEntries: 0 };
            const node = document.createElement('span'); node.textContent = 'Local choice changed';
            document.querySelector('#chat .mes_text:last-child').append(node); await settle();
            return { ...work };
        });
        const lifecycle = await page.evaluate(async () => {
            const last = document.querySelector('#chat .mes_text:last-child');
            const frame = document.createElement('iframe'); frame.srcdoc = '<html><head></head><body>New nested frame</body></html>';
            await new Promise(resolve => { frame.onload = resolve; last.append(frame); }); await settle();
            const insertedStyled = !!frame.contentDocument.querySelector('style[data-ilg-card-clarity]');
            frame.srcdoc = '<html><head></head><body>Reloaded frame</body></html>';
            await new Promise(resolve => { frame.onload = resolve; }); await settle();
            const reloadedStyled = !!frame.contentDocument.querySelector('style[data-ilg-card-clarity]');
            const doc = frame.contentDocument; frame.remove(); await settle();
            const detachedClean = !doc.querySelector('style[data-ilg-card-clarity]');
            component.setEnabled(false);
            const disabledClean = !document.querySelector('.ilg-floating-clarity') && [...document.querySelectorAll('#chat iframe')].every(f => !f.contentDocument.querySelector('style[data-ilg-card-clarity]'));
            component.setEnabled(true); await settle();
            const enabledRestored = [...document.querySelectorAll('#chat iframe')].every(f => !!f.contentDocument.querySelector('style[data-ilg-card-clarity]'));
            component.destroy();
            return { insertedStyled, reloadedStyled, detachedClean, disabledClean, enabledRestored };
        });
        results.push({ floors, portal, message, lifecycle });
        await page.close();
    }
    console.log(JSON.stringify({ kind: 'isolated-browser-operation-counts', results, errors,
        limitations: ['Turnaround includes four animation frames; it is not INP or a phone latency measurement', 'Synthetic card fixtures; original card and real Android still require acceptance'] }, null, 2));
    assert.deepEqual(errors, []);
    for (const row of results) {
        assert(row.portal.styled); assert(Object.values(row.lifecycle).every(Boolean));
        assert.equal(row.portal.frameProbes, 0, 'Opening an external panel must not probe historical card frames');
        assert.equal(row.portal.rootQueries, 0, 'Opening an external panel must not query all message frames');
        assert.equal(row.portal.registryEntries, 0, 'Opening an external panel must not iterate the historical frame registry');
        assert.equal(row.message.frameProbes, 0, 'A local text change must not probe historical frames');
        assert.equal(row.message.rootQueries, 0, 'A local text change must not query all message frames');
        assert.equal(row.message.registryEntries, 0, 'A local text change must not iterate the historical frame registry');
    }
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
