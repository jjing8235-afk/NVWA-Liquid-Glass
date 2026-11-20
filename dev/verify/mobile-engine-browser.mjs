// Android browser / TT-style WebView regression; synthetic cards, not phone FPS.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath, pathToFileURL} from 'node:url';

const candidate = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const baseline = process.env.NVWA_MOBILE_BASELINE;
assert(baseline, 'Set NVWA_MOBILE_BASELINE to a clean test baseline checkout');
const roots = {baseline: path.resolve(baseline), candidate};
const moduleName = process.env.NVWA_PLAYWRIGHT_MODULE || 'playwright';
const {chromium} = await import(path.isAbsolute(moduleName) ? pathToFileURL(moduleName).href : moduleName);
const harness = await fs.readFile(path.join(candidate, 'dev/verify/home-avatar-browser.mjs'), 'utf8');
const template = harness.slice(harness.indexOf('function fixture('), harness.indexOf('const server='));
const fixture = vm.runInNewContext(`(${template.trim()})`, {hostCSS: ''});
const rows = Array.from({length: 240}, (_, i) => `<div class="mes${i === 239 ? ' last_mes' : ''}" mesid="${i}" style="height:218px;min-height:218px;width:100%;flex-shrink:0"><div class="mes_block"><div class="mes_text"><p>Message ${i} · 手机滚动样例</p><section style="background:rgb(35,45,65);color:rgb(210,225,240)">${Array.from({length:16}, (_, j) => `<span style="padding:2px">字段 ${j} </span>`).join('')}<button style="background:#9dd0f9;color:#121820">查看</button></section></div></div></div>`).join('');
const mime = {'.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2'};
const source = {};
for (const [key, dir] of Object.entries(roots)) {
    const index = await fs.readFile(path.join(dir, 'index.js'), 'utf8');
    const hook = /^    (?:trackMessages\(added\);|added\.forEach\(n => track\(n, 'mes'\)\);)\r?$/m;
    assert.match(index, hook);
    source[key] = index.replace(hook, match => `    const mountedAt = performance.now();\n${match.trimEnd()}\n    if (added.length > 200) window.fixtureMountMs = performance.now() - mountedAt;`);
}
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {
        const hostMarker = url.searchParams.get('tt') === '1' ? 'window.__TAURITAVERN_HOST__={platform:"android",kind:"mobile"};' : '';
        const setup = `${hostMarker}activeChat(); Object.assign(settings,{enabled:true,home:false,refract:true,refractMes:true,glassStyle:'original',engine:'physical',tone:'dark'}); document.getElementById('chat').textContent=''; window.fixtureReady=false;`;
        res.setHeader('content-type', 'text/html;charset=utf-8');
        return res.end(fixture(0, false, 'dark').replace('window.fixtureReady=false;', setup));
    }
    const variant = req.headers.cookie?.match(/(?:^|; )nvwa-build=(baseline|candidate)(?:;|$)/)?.[1];
    if (!variant || !url.pathname.startsWith('/extension/')) { res.writeHead(404).end(); return; }
    const dir = roots[variant], relative = decodeURIComponent(url.pathname.slice('/extension/'.length));
    const file = path.resolve(dir, relative);
    if (!file.startsWith(dir + path.sep)) { res.writeHead(404).end(); return; }
    try {
        const body = relative === 'index.js' ? source[variant] : await fs.readFile(file);
        res.setHeader('content-type', mime[path.extname(file)] || 'application/octet-stream');
        res.end(body);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        res.writeHead(404).end();
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
    browser = await chromium.launch({headless:true, executablePath:process.env.NVWA_EDGE_EXECUTABLE});
    const samples = [];
    for (const identity of ['android-browser','tt-webview']) {
        const tt = identity === 'tt-webview';
        const ua = `Mozilla/5.0 (Linux; Android 17; Fixture${tt ? '; wv' : ''}) AppleWebKit/537.36 (KHTML, like Gecko) ${tt ? 'Version/4.0 ' : ''}Chrome/156.0.0.0 Mobile Safari/537.36`;
        for (const variant of ['baseline','candidate','candidate','baseline']) {
            const context = await browser.newContext({viewport:{width:360,height:758}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:ua, serviceWorkers:'block'});
            try {
                await context.addCookies([{name:'nvwa-build',value:variant,url:origin}]);
                const page = await context.newPage(), errors = [];
                page.on('pageerror', error => errors.push(error.message));
                const cdp = await context.newCDPSession(page);
                await cdp.send('Emulation.setCPUThrottlingRate', {rate:4});
                await page.goto(`${origin}/?tt=${Number(tt)}`);
                await page.waitForFunction(() => fixtureReady || fixtureFailure);
                assert.equal(await page.evaluate(() => fixtureFailure), null);
                await page.evaluate(rows => {document.getElementById('chat').innerHTML = rows;}, rows);
                await page.waitForFunction(() => Number.isFinite(window.fixtureMountMs));
                await page.waitForFunction(() => document.querySelectorAll('#chat .ilg-phys').length > 0);
                await page.evaluate(() => settle(500));
                const report = await page.evaluate(async () => {
                    const chat = document.getElementById('chat'), gaps = [];
                    chat.scrollTop = 0;
                    let prior = await new Promise(requestAnimationFrame);
                    for (let i = 1; i <= 100; ++i) {
                        chat.scrollTop = i * 118;
                        const now = await new Promise(requestAnimationFrame);
                        gaps.push(now - prior);
                        prior = now;
                    }
                    await settle(300);
                    const first = chat.querySelector('.mes_text p');
                    const section = chat.querySelector('section');
                    const ordered = gaps.sort((a,b) => a-b);
                    return {mountMs:fixtureMountMs, p95:ordered[94], p99:ordered[98], above33:gaps.filter(x => x > 34).length,
                        scroll:chat.scrollTop, floors:chat.querySelectorAll('.mes').length,
                        physical:chat.querySelectorAll('.ilg-phys').length, first:first.textContent,
                        authored:getComputedStyle(section).color};
                });
                assert.equal(report.floors, 240);
                assert.ok(report.scroll > 11000 && report.physical > 0, 'Scroll reaches the target with active glass');
                assert.equal(report.first, 'Message 0 · 手机滚动样例');
                assert.equal(report.authored, 'rgb(210, 225, 240)');
                assert.deepEqual(errors, []);
                const sample = {identity, variant, ...report};
                samples.push(sample);
                console.error(JSON.stringify(sample));
            } finally { await context.close(); }
        }
    }
    console.log(JSON.stringify({engine:browser.version(), cpuThrottle:4, physicalDevice:false, samples}, null, 2));
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
