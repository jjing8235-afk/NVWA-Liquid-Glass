import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.env.NVWA_EXTENSION_ROOT || fileURLToPath(new URL('../../', import.meta.url)));
const modulePath = process.env.NVWA_PLAYWRIGHT_MODULE || 'playwright';
const tools = await import(path.isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath);
const engine = process.env.NVWA_BROWSER_ENGINE || 'chromium';
const style = (await fs.readFile(path.join(root, 'style.css'), 'utf8')).match(/html\.ilg body #chat > \.mes\.ilg-render-away[^{}]*\{[^}]*\}/)?.[0];
assert(style, 'Use the production message containment rule');
const html = '<!doctype html><html class="ilg"><style>*{box-sizing:border-box}body{margin:0;font:16px Arial}#chat{display:flex;flex-direction:column;overflow:auto;width:390px;height:240px;margin:10px}.mes{display:flex;align-items:flex-start;width:100%;padding:12px 10px;border:1px solid #aaa;margin-bottom:8px}.mes_block{width:100%}.mes_text p{margin:6px 0;line-height:1.7}' + style + '</style><body class="bubblechat"><div id="chat"></div></body></html>';
const server = http.createServer(async (req, res) => {
    if (req.url === '/') { res.setHeader('content-type', 'text/html'); res.end(html); return; }
    if (req.url === '/message-rendering.js') { res.setHeader('content-type', 'text/javascript'); res.end(await fs.readFile(path.join(root, 'message-rendering.js'))); return; }
    res.writeHead(404); res.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await tools[engine].launch({ headless: true, ...(process.env.NVWA_BROWSER_EXECUTABLE ? { executablePath: process.env.NVWA_BROWSER_EXECUTABLE } : {}) });
    const page = await browser.newPage({ viewport: { width: 500, height: 600 } });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    const result = await page.evaluate(async () => {
        const resizeErrors = [];
        // Observer loop errors are ErrorEvents; pageerror alone misses them in Chromium.
        window.addEventListener('error', event => { if (/^ResizeObserver loop/.test(event.message)) resizeErrors.push(event.message); });
        const { createMessageRendering } = await import('/message-rendering.js');
        const chat = document.getElementById('chat');
        const message = i => '<div class="mes"><div class="mes_block"><div class="mes_text"><p>' + ('Message ' + i + ' wraps at several widths. ').repeat(7) + '</p></div></div></div>';
        chat.innerHTML = Array.from({ length: 10 }, (_, i) => message(i)).join('');
        let callbacks = 0;
        const ro = new ResizeObserver(entries => { callbacks++; for (const entry of entries) manager.resize(entry.target, entry.contentRect.height, entry.contentRect.width); });
        const io = new IntersectionObserver(entries => { for (const entry of entries) manager.visibility(entry.target, entry.isIntersecting); }, { root: chat, rootMargin: '200px 0px' });
        const manager = createMessageRendering(chat, { onReset(el) { ro.unobserve(el); ro.observe(el); } });
        const list = [...chat.children];
        for (const el of list) { manager.track(el); ro.observe(el); io.observe(el); }
        const frames = async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); };
        const settle = async () => { await new Promise(resolve => setTimeout(resolve, 60)); await frames(); };
        await settle();
        if (manager.status().culled < 4) throw Error('The real offscreen message path was not exercised');
        for (const width of [280, 390, 300, 390]) { chat.style.width = width + 'px'; await settle(); }
        const before = chat.scrollHeight, idleStart = callbacks;
        await settle();
        const idleCallbacks = callbacks - idleStart;
        for (const el of list) { ro.unobserve(el); io.unobserve(el); manager.release(el); }
        io.disconnect(); ro.disconnect();
        const after = chat.scrollHeight;
        if (Math.abs(before - after) > 1) throw Error('Measured scroll height differs from natural height');
        if (idleCallbacks) throw Error('An idle message continues to resize');
        if (resizeErrors.length) return { resizeErrors, messages: 10, widthChanges: 4, naturalHeightPreserved: true, idleCallbacks };

        // Real DOM probes for latest-wins, invalidation and release between a
        // measurement delivery and its delayed containment update.
        const pending = createMessageRendering(chat);
        chat.insertAdjacentHTML('beforeend', message('pending'));
        const target = chat.lastElementChild;
        pending.track(target); pending.visibility(target, false);
        pending.resize(target, 80, 350); pending.resize(target, 160, 350);
        if (target.classList.contains('ilg-render-away')) throw Error('Resize delivery changed layout synchronously');
        await frames();
        if (target.style.getPropertyValue('--ilg-message-height') !== '160px') throw Error('An old size replaced the latest measurement');
        pending.release(target);
        pending.track(target); pending.visibility(target, false); pending.resize(target, 80, 350); pending.invalidate(target);
        await frames();
        if (target.classList.contains('ilg-render-away')) throw Error('A stale measurement survived text invalidation');
        pending.resize(target, 240, 350); await frames();
        if (target.style.getPropertyValue('--ilg-message-height') !== '240px') throw Error('Fresh text measurement was not applied');
        pending.resize(target, 320, 350); pending.release(target); await frames();
        if (target.classList.contains('ilg-render-away') || target.style.getPropertyValue('--ilg-message-height') || pending.status().tracked) throw Error('A delayed update survived release');
        await settle();
        return { resizeErrors, messages: 10, widthChanges: 4, naturalHeightPreserved: true, idleCallbacks, latestMeasurementWins: true, noSynchronousContainmentWrites: true, invalidatedMeasurementDiscarded: true, pendingReleaseClean: true };
    });
    if (process.env.NVWA_RESULT_FILE) await fs.writeFile(process.env.NVWA_RESULT_FILE, JSON.stringify({ engine, ...result, pageErrors }, null, 2));
    assert.deepEqual(result.resizeErrors, [], 'Message resize processing must not emit ResizeObserver loop errors');
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ passed: true, engine, ...result, pageErrors }, null, 2));
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
