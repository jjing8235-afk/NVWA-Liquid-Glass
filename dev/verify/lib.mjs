// 无头 Edge 打开正在运行的酒馆（8090）的共用部分：open(宽, 高, 端口) → { ev, shot, click, sleep, logs, close }
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

export const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = new URL('./out/', import.meta.url);
mkdirSync(OUT, { recursive: true });

export async function open(W, H, port = 9340, url = 'http://127.0.0.1:8090/') {
    const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
        '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TEMP}/ilg-edge-${port}`,
        '--no-first-run', '--hide-scrollbars', `--window-size=${W},${H}`,
    ], { stdio: 'ignore' });
    for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await sleep(250); } }
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    let id = 0; const pend = new Map(); const logs = [];
    ws.addEventListener('message', e => {
        const m = JSON.parse(e.data);
        if (m.id) { pend.get(m.id)?.(m); pend.delete(m.id); return; }
        if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('error ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    });
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); return r.result.result?.value ?? r.result.exceptionDetails?.exception?.description; };
    const shot = async n => writeFileSync(new URL(`${W}-${n}.png`, OUT), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
    // 真实鼠标点击（走 pointerdown，能触发“点外面收起”）
    const click = async (x, y) => {
        for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    };
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: W < 768 ? 2 : 1, mobile: W < 768 });
    if (W < 768) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    if (url) { await send('Page.navigate', { url }); await sleep(14000); }
    return { ev, shot, click, send, sleep, logs, close: () => { ws.close(); edge.kill(); } };
}
