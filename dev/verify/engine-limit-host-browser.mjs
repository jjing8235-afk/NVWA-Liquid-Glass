// Benchmarks the local installation in a new data root. Never serves the user's profile.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const host = process.env.NVWA_HOST_ROOT;
const dataParent = process.env.NVWA_ENGINE_DATA;
const variants = (process.env.NVWA_ENGINE_VARIANTS || 'installed,candidate,off').split(',');
const reps = Number(process.env.NVWA_ENGINE_REPS || 3);
const scenes = (process.env.NVWA_ENGINE_SCENES || 'plain,cards,pressure').split(',');
const mountOnly = process.env.NVWA_ENGINE_MOUNT_ONLY === '1';
const traceDir = process.env.NVWA_ENGINE_TRACE;
const pixelDir = process.env.NVWA_ENGINE_PIXELS;
const traceInvalidations = !!traceDir && process.env.NVWA_ENGINE_TRACE_INVALIDATIONS === '1';
const headless = process.env.NVWA_ENGINE_HEADED !== '1';
assert(host && dataParent, 'Set NVWA_HOST_ROOT and NVWA_ENGINE_DATA (scratch parent directory)');
const tools = await import(process.env.NVWA_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.NVWA_PLAYWRIGHT_MODULE).href : 'playwright');
const relative = 'scripts/extensions/third-party/ios-liquid-glass';
const disk = path.join(host, 'public', relative);
const roots = { installed: disk, round1: disk, round3: process.env.NVWA_ENGINE_ROUND3, candidate: root, off: root, fixedink: root };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const round1 = process.env.NVWA_ENGINE_ROUND1 && await fs.readFile(process.env.NVWA_ENGINE_ROUND1, 'utf8');
const verifyMaterial = process.env.NVWA_REQUIRE_SCROLL_STYLE_STABLE === '1';
const builds = {}, hashes = {}, assetHashes = {};
for (const variant of variants) {
    const dir = roots[variant];
    assert(dir, `Missing asset root: ${variant}`);
    const assets = (await fs.readdir(dir)).filter(name => /\.(?:js|css|json)$/.test(name));
    builds[variant] = variant === 'round1' ? round1 : await fs.readFile(path.join(dir, 'index.js'), 'utf8');
    assert(builds[variant], `Missing build: ${variant}`);
    hashes[variant] = hash(builds[variant]);
    assetHashes[variant] = Object.fromEntries(await Promise.all(assets.map(async name => [name, hash(await fs.readFile(path.join(dir, name)))])));
}
const data = await fs.mkdtemp(path.join(path.resolve(dataParent), 'nvwa-engine-'));
await fs.mkdir(path.join(data, 'default-user'));
await fs.writeFile(path.join(data, 'default-user/settings.json'), JSON.stringify({ firstRun: false, power_user: { fast_ui_mode: false }, extension_settings: {
    disabledExtensions: ['third-party/ios26-crystal', 'third-party/ls26-glass'], autoConnect: false,
    iosLiquidGlass: { v: 9, enabled: true, wallsReady: true, tone: 'dark', follow: false, home: false,
        float: true, islands: true, fold: true, topShortcut1: 'WI-SP-button', topShortcut2: 'extensions-settings-button',
        engine: 'physical', glassStyle: 'original', refract: true, refractMes: true, chatBackground: 'glass', composerLayout: 'split' },
} }));
const socket = net.createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.js', '--dataRoot', data, '--port', String(port), '--listen', 'false', '--browserLaunchEnabled', 'false'],
    { cwd: host, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { log = (log + chunk).slice(-1400); });

function instrument(source, variant) {
    const call = /^    (?:trackMessages\(added\);|added\.forEach\(n => track\(n, 'mes'\)\);)\r?$/m;
    assert(call.test(source), 'Message mount hook');
    source = source.replace(call, line => '    const benchMountAt = performance.now();\n' + line.trimEnd() + '\n    if (added.length > 2) window.__nvwaMountMs = performance.now()-benchMountAt;');
    const marker = source.indexOf('function queueCards(');
    const mounted = source.indexOf('    }, 200);', marker);
    assert(marker >= 0 && mounted > marker, 'Card pass end hook');
    source = source.slice(0, marker) + source.slice(marker, mounted).replace(
        'cardTimer = setTimeout(() => {', 'cardTimer = setTimeout(() => { const passStart = performance.now();')
        + '        window.__nvwaCardPasses?.push(performance.now() - passStart);\n' + source.slice(mounted);
    const start = source.indexOf('function scheduleAdapt(');
    const end = source.indexOf("chatEl.addEventListener('scroll', scheduleAdapt", start);
    assert(start >= 0 && end > start);
    const pass = source.slice(start, end);
    assert(pass.includes('const bars = S.islands') && pass.includes('            for (const sample of samples)'));
    return source.slice(0, start) + pass
        .replace('const bars = S.islands', (variant === 'fixedink' ? 'if (window.__nvwaAudit) return;\n            ' : '') + 'const auditStart = performance.now();\n            const bars = S.islands')
        .replace('            for (const sample of samples)', '            window.__nvwaAudit?.sample.push(performance.now() - auditStart);\n            for (const sample of samples)')
        + source.slice(end) + `\nctx.eventSource.on(ctx.eventTypes.APP_READY, () => { window.__nvwaEngineReady = true; });\nwindow.__nvwaEngineBench = {
            setEnabled(enabled){ if (S.enabled !== enabled) { S.enabled = enabled; applyRoot(); } },
            async wall(){ await applyTone(); },
            sample(points, bar) {
                const lumAt = createBackdropSampler(readWallpaperBackdrop());
                return points.map(([x,y]) => { let rgb = null; const lum = lumAt(x,y,bar,c => { rgb = c; }); return [lum,rgb]; });
            },
        };`;
}

function stats(samples) {
    const ordered = [...samples].sort((a, b) => a - b);
    const at = p => +(ordered[Math.floor((ordered.length - 1) * p)] ?? 0).toFixed(2);
    return { n: ordered.length, p50: at(.50), p95: at(.95), p99: at(.99), max: at(1) };
}
const cdpMetrics = async cdp => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));

// Separate diagnostic traces from timing runs: invalidation logging adds overhead.
async function startTrace(cdp) {
    if (!traceDir) return;
    await cdp.send('Tracing.start', { transferMode: 'ReturnAsStream', traceConfig: {
        recordMode: 'recordUntilFull',
        traceBufferSizeInKb: 131072,
        includedCategories: ['devtools.timeline', 'blink.user_timing',
            ...(traceInvalidations ? ['disabled-by-default-devtools.timeline.invalidationTracking'] : [])],
    } });
}
async function stopTrace(cdp, name) {
    if (!traceDir) return;
    const done = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end');
    const { stream, dataLossOccurred } = await done;
    if (dataLossOccurred) console.warn(`Incomplete trace: ${name}`);
    await fs.mkdir(traceDir, { recursive: true });
    const out = await fs.open(path.join(traceDir, name + '.json'), 'w');
    try {
        for (;;) {
            const { data, base64Encoded, eof } = await cdp.send('IO.read', { handle: stream, size: 1024 * 1024 });
            await out.write(Buffer.from(data, base64Encoded ? 'base64' : 'utf8'));
            if (eof) break;
        }
    } finally {
        await out.close();
        await cdp.send('IO.close', { handle: stream });
    }
}

async function verifyBoundedCards(page) {
    await page.evaluate(() => {
        const chat = document.getElementById('chat');
        const layers = '<div style="position:absolute;inset:0"></div>'.repeat(8);
        const normal = `<section style="position:relative;background:#ecd9aa">${layers}<p>NVWA_BOUNDED_CARD_NEEDLE</p></section>`;
        const other = [
            '<iframe srcdoc="<body style=background:navy>Local frame</body>"></iframe>',
            '<iframe sandbox srcdoc="<body style=background:salmon>Isolated frame</body>"></iframe>',
            '<div style="position:fixed;top:84px;left:58px">Fixed escape</div>',
            '<aside style="position:sticky;top:0">Sticky escape</aside>',
            '<div style="position:absolute;top:-820px">Out of bounds</div>',
            '<div style="transform:translateY(-300px)">Transformed escape</div>',
            '<button type="button">Authored control</button>',
            '<div style="clip-path:circle(20%)">Authored clipping</div>',
            '<p id="authored-anchor">Author selector contract</p>',
        ];
        const row = (id, html) => `<div class="mes" mesid="${id}"><div class="mes_block"><div class="mes_text">${html}</div></div></div>`;
        chat.innerHTML = Array.from({ length: 68 }, (_, i) => row(i, i < 55 || i > 63 ? normal : normal + other[i-55])).join('');
        chat.scrollTop = 0;
    });
    const row = id => page.locator(`#chat > .mes[mesid="${id}"]`);
    await row(45).and(page.locator('.ilg-bounded-hit')).waitFor({ state:'attached' });
    assert.equal(await page.locator('#chat > .ilg-bounded-hit').count(), 59);
    for (let id = 55; id <= 63; id++) {
        assert(!await row(id).evaluate(el => el.classList.contains('ilg-bounded-hit')), `Complex card ${id} must keep the native path`);
    }
    const remote = row(45);
    assert.notEqual(await remote.evaluate(el => getComputedStyle(el).clipPath), 'none');
    const fixed = row(57).locator('.mes_text div[style*="fixed"]');
    const fixedBox = await fixed.evaluate(el => { const r = el.getBoundingClientRect(); return [r.x,r.y]; });
    assert.deepEqual(fixedBox, [58,84]);
    await row(61).locator('button').evaluate(el => el.addEventListener('click', () => { el.dataset.clicked = 'true'; }));
    await row(61).locator('button').scrollIntoViewIfNeeded();
    await row(61).locator('button').click();
    assert.equal(await row(61).locator('button').getAttribute('data-clicked'), 'true');
    await remote.evaluate(el => el.scrollIntoView({ block:'center' }));
    await remote.and(page.locator('.ilg-phys')).waitFor({ state:'attached' });
    assert.equal(await remote.evaluate(el => getComputedStyle(el).clipPath), 'none', 'Prewarmed/visible rows are never clipped');
    assert(await page.evaluate(() => { const found = window.find('NVWA_BOUNDED_CARD_NEEDLE'); getSelection().removeAllRanges(); return found; }));
    const lifecycle = row(37);
    await lifecycle.locator('section').evaluate(el => el.style.transform = 'translateY(-500px)');
    await lifecycle.and(page.locator(':not(.ilg-bounded-hit)')).waitFor({ state:'attached' });
    await lifecycle.locator('section').evaluate(el => el.style.removeProperty('transform'));
    await lifecycle.and(page.locator('.ilg-bounded-hit')).waitFor({ state:'attached' });
    await lifecycle.evaluate(el => el.style.transform = 'translateY(-500px)');
    await lifecycle.and(page.locator(':not(.ilg-bounded-hit)')).waitFor({ state:'attached' });
    await lifecycle.evaluate(el => el.style.removeProperty('transform'));
    // A released row's next content change asks the normal gate to admit it again.
    await lifecycle.locator('p').evaluate(el => { el.textContent += '.'; });
    await lifecycle.and(page.locator('.ilg-bounded-hit')).waitFor({ state:'attached' });
    const css = await page.addStyleTag({ content:'#chat > [mesid="37"] .mes_text section {transform:translateY(-500px)}' });
    await lifecycle.and(page.locator(':not(.ilg-bounded-hit)')).waitFor({ state:'attached' });
    await css.evaluate(el => el.remove());
    await lifecycle.and(page.locator('.ilg-bounded-hit')).waitFor({ state:'attached' });
    await page.evaluate(() => __nvwaEngineBench.setEnabled(false));
    assert.equal(await page.locator('#chat > .ilg-bounded-hit').count(), 0);
    return { bounded:59, richNativeFallbacks:9, visibleGlassUnclipped:true, fixedPosition:true, authorClick:true, findInPage:true, inlineInvalidation:true, rowInvalidation:true, stylesheetInvalidation:true, disabledCleanup:true };
}

async function trial(browser, variant, rep) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    const errors = [];
    try {
        await context.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.origin !== origin) return route.abort();
            if (url.pathname === '/api/settings/save') return route.fulfill({ json: { result: 'ok' } });
            if (url.pathname === `/${relative}/index.js`) return route.fulfill({ contentType: 'application/javascript', body: instrument(builds[variant], variant) });
            if (url.pathname.startsWith('/' + relative + '/')) {
                const asset = decodeURIComponent(url.pathname.slice(relative.length + 2));
                if (!asset.split('/').every(part => part && !/[:\\]/.test(part) && part !== '.' && part !== '..')) return route.abort();
                const file = path.join(roots[variant], asset);
                if (!await fs.stat(file).then(info => info.isFile(), () => false)) return route.fulfill({ status: 404 });
                return route.fulfill({ path: file });
            }
            return route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin);
        await page.waitForFunction(() => window.__nvwaEngineReady === true && !document.querySelector('#loading_screen'));
        assert.equal(await page.locator('dialog[open]').count(), 0, 'A startup dialog would invalidate scrolling measurements');
        await page.evaluate(enabled => __nvwaEngineBench.setEnabled(enabled), variant !== 'off');
        // Use the shipped wallpaper and authored local DOM; no real characters, models or chats.
        await page.evaluate(async relative => {
            const wallpaper = `/${relative}/walls/liquid%20glass%20ink.png?nvwa-bench=1`;
            const image = new Image(); image.src = wallpaper; await image.decode();
            const bg = document.getElementById('bg1');
            bg.style.backgroundImage = `url('${wallpaper}')`;
            bg.style.backgroundSize = 'cover';
            await __nvwaEngineBench.wall();
            document.body.classList.add('bubblechat');
            const css = document.createElement('style');
            css.textContent = `#chat > .bench-message { min-height: 185px; box-sizing: border-box; }
                #chat .bench-card { position:relative; padding:12px; border-radius:13px; }
                #chat .bench-card p { margin:3px; }
                #chat .bench-layer { position:absolute; inset:0; }
                #chat .bench-copy { position:relative; }
                #chat { scroll-behavior:auto!important; }`;
            document.head.append(css);
        }, relative);
        const cdp = await context.newCDPSession(page);
        await cdp.send('Performance.enable');
        const runs = [];
        for (const scene of scenes) {
            const count = scene.endsWith('pressure') ? 600 : 180;
            const beforeMount = await cdpMetrics(cdp);
            await page.evaluate(({ count, scene }) => {
                const chat = document.getElementById('chat');
                const source = [], nativeShell = scene.startsWith('native-') ? document.querySelector('#message_template .mes') : null;
                for (let i = 0; i < count; i++) {
                    const layerCount = scene.endsWith('pressure') ? 28 : 2;
                    const overlay = '<div class="bench-layer"></div>'.repeat(layerCount);
                    const card = scene === 'plain' ? '<p>风把窗纸吹得一响。<q>等等，灯还亮着。</q></p>' : `<section class="bench-card" style="background-color:${i % 2 ? '#f8e0b5' : '#172236'};color:${i % 2 ? '#302b21' : '#e7efff'}">${overlay}<div class="bench-copy"><p>测试楼层 ${i + 1}：风把窗纸吹得一响。</p><p><q>等等，灯还亮着。</q><em> Now the glass catches the light. </em></p></div></section>`;
                    if (nativeShell) {
                        const row = nativeShell.cloneNode(true);
                        row.classList.add('bench-message');
                        row.classList.toggle('last_mes', i === count - 1);
                        row.setAttribute('mesid', String(i));
                        row.setAttribute('is_user', 'false');
                        row.querySelector('.avatar img').removeAttribute('src');
                        row.querySelector('.name_text').textContent = '测试角色';
                        row.querySelector('.mes_text').innerHTML = card;
                        source.push(row.outerHTML);
                        continue;
                    }
                    source.push(`<div class="mes bench-message${i === count - 1 ? ' last_mes' : ''}" mesid="${i}" is_user="false"><div class="mes_block"><div class="mes_text">${card}<p>只读对照场景 · Synthetic offline fixture</p></div></div></div>`);
                }
                window.__nvwaMountMs = null;
                window.__nvwaCardPasses = [];
                chat.innerHTML = source.join('');
                chat.scrollTop = 0;
            }, { count, scene });
            if (variant !== 'off') {
                const attached = await page.evaluate(() => ({ mounted: document.querySelectorAll('#chat > .bench-message').length, tracked: document.querySelectorAll('#chat > .bench-message.ilg-glass').length, bubble: document.body.classList.contains('bubblechat'), active: document.documentElement.classList.contains('ilg'), mountMs: window.__nvwaMountMs }));
                assert.equal(attached.tracked, count, JSON.stringify(attached));
            }
            const afterMount = await cdpMetrics(cdp);
            const mount = { pluginMs: await page.evaluate(() => window.__nvwaMountMs), layouts: afterMount.LayoutCount - beforeMount.LayoutCount };
            if (mountOnly) { runs.push({ scene, count, mount }); continue; }
            await page.waitForTimeout(850);
            const bounded = await page.locator('#chat > .ilg-bounded-hit').count();
            mount.cardPasses = await page.evaluate(() => { const times = window.__nvwaCardPasses; window.__nvwaCardPasses = null; return times; });
            mount.cardPassMs = mount.cardPasses.length ? Math.max(...mount.cardPasses) : null;
            if (variant === 'candidate' && process.env.NVWA_ENGINE_REQUIRE_BOUNDS === '1' && scene.endsWith('pressure')) {
                assert(bounded >= count - 3, `${scene}: only ${bounded} / ${count} static panels admitted`);
            }
            const frameBase = await page.evaluate(async () => {
                const gaps = [];
                let prev = await new Promise(requestAnimationFrame);
                for (let i = 0; i < 42; i++) { const now = await new Promise(requestAnimationFrame); gaps.push(now - prev); prev = now; }
                return gaps;
            });
            const cadence = stats(frameBase).p50;
            const prev = await cdpMetrics(cdp);
            await startTrace(cdp);
            const sample = await page.evaluate(async duration => {
                const chat = document.getElementById('chat');
                const hit = document.elementsFromPoint;
                const audit = { hitTests: 0, hitMs: 0, sample: [] };
                window.__nvwaAudit = audit;
                document.elementsFromPoint = function (...args) {
                    const start = performance.now();
                    try { return hit.apply(this, args); } finally { audit.hitTests++; audit.hitMs += performance.now() - start; }
                };
                const gaps = [];
                const loaf = [], scriptCounts = {};
                const observer = new PerformanceObserver(list => loaf.push(...list.getEntries()));
                if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) observer.observe({ type: 'long-animation-frame' });
                const start = await new Promise(requestAnimationFrame);
                let prev = start;
                // Same 5400px travel and wall-clock duration even when the refresh rate differs.
                for (;;) {
                    const now = await new Promise(requestAnimationFrame);
                    const progress = Math.min(1, (now - start) / duration);
                    chat.scrollTop = Math.round(2700 * (progress < .5 ? progress * 2 : (1 - progress) * 2));
                    gaps.push(now - prev); prev = now;
                    if (progress === 1) break;
                }
                loaf.push(...observer.takeRecords()); observer.disconnect();
                for (const frame of loaf) for (const script of frame.scripts) {
                    const name = (script.sourceURL || '').split('/').pop().split('?')[0] || script.invokerType;
                    scriptCounts[name] = (scriptCounts[name] || 0) + script.duration;
                }
                document.elementsFromPoint = hit;
                window.__nvwaAudit = null;
                return { gaps, ...audit, loaf: loaf.length, blockingMs: loaf.reduce((n, frame) => n + frame.blockingDuration, 0), scriptCounts };
            }, traceInvalidations ? 360 : 2200);
            const hitBudget = Number(process.env.NVWA_ENGINE_HIT_BUDGET || Infinity);
            assert(sample.hitMs <= hitBudget, `${variant}/${scene}: ${sample.hitMs.toFixed(1)}ms native hit testing exceeds ${hitBudget}ms`);
            const next = await cdpMetrics(cdp);
            await stopTrace(cdp, `${variant}-${scene}-${rep}`);
            if (verifyMaterial && scene === 'cards' && variant === 'candidate') {
                const mutations = await page.evaluate(async () => {
                    const chat = document.querySelector('#chat');
                    const styled = e => e.matches('.bench-message, .ilg-message-glass');
                    const travel = async () => {
                        for (const top of [540, 1090, 540, 0]) {
                            chat.scrollTop = top;
                            for (let i = 0; i < 5; i++) await new Promise(requestAnimationFrame);
                        }
                    };
                    await travel(); // First visit may need to build a map for this geometry.
                    let count = 0;
                    const countChanges = records => { count += records.filter(r => styled(r.target)).length; };
                    const observer = new MutationObserver(countChanges);
                    observer.observe(chat, { subtree: true, attributes: true, attributeFilter: ['style'] });
                    await travel();
                    countChanges(observer.takeRecords()); observer.disconnect();
                    return count;
                });
                assert.equal(mutations, 0, 'Revisiting cards must not rewrite the glass or reflection inline styles');
            }
            const visual = [];
            for (const top of [64, 278, 619, 1238]) {
                await page.locator('#chat').evaluate((chat, top) => { chat.scrollTop = top; }, top);
                await page.waitForTimeout(190);
                // A busy frame can consume that entire wall-clock wait before the
                // intersection observer installs the just-entered row's material.
                if (variant !== 'off') await page.waitForFunction(() => {
                    const chat = document.getElementById('chat');
                    const { top, bottom } = chat.getBoundingClientRect();
                    return [...chat.querySelectorAll('.bench-message')].every(el => {
                        const rect = el.getBoundingClientRect();
                        return rect.bottom <= top || rect.top >= bottom || el.classList.contains('ilg-phys');
                    });
                });
                const state = await page.evaluate(() => {
                    const chat = document.getElementById('chat');
                    const form = document.getElementById('form_sheld');
                    const box = el => [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight];
                    const strip = s => s.replace(/url\([^)]*\)/gi, 'url(#local-filter)');
                    // Ignore generated filter IDs; keep geometry, filter kind/values, and all tone bits.
                    const controls = [...document.querySelectorAll('.ilg-island, #ilg-floor, #top-settings-holder > .drawer, #leftSendForm > div, #rightSendForm > div, #nonQRFormItems > .ilg-composer-glass')];
                    const edge = chat.getBoundingClientRect();
                    const rows = [];
                    for (const el of chat.querySelectorAll('.bench-message')) {
                        const rect = el.getBoundingClientRect();
                        if (rect.bottom <= edge.top || rect.top >= edge.bottom) continue;
                        const surface = el.querySelector(':scope > .ilg-message-glass') || el;
                        const filter = getComputedStyle(surface).backdropFilter;
                        const filterId = filter.match(/#([\w-]+)["']?\)/)?.[1];
                        const def = filterId && document.getElementById(filterId);
                        const shine = getComputedStyle(el, '::after');
                        rows.push({ id: el.getAttribute('mesid'), box: box(el), filter: strip(filter),
                            rim: [shine.backgroundImage, shine.opacity],
                            svg: def ? [def.getAttribute('width'), def.getAttribute('height'), def.getAttribute('filterUnits'), def.innerHTML] : null });
                    }
                    const grid = y => Array.from({ length: 7 }, (_, i) => [335 + i * 100, y]);
                    const points = [__nvwaEngineBench.sample([...grid(24), ...grid(39)], document.getElementById('ilg-floor')),
                        __nvwaEngineBench.sample([...grid(816), ...grid(837)], form)];
                    return { rows, points, chat: box(chat), form: box(form), controls: controls.map(el => [el.id, el.hidden, box(el), strip(getComputedStyle(el).backdropFilter), el.dataset.ilgTopTone, el.dataset.ilgInputTone]),
                        physical: chat.querySelector('.ilg-phys')?.classList.contains('ilg-phys') || false };
                });
                if (pixelDir && variant !== 'off') {
                    await fs.mkdir(pixelDir, { recursive: true });
                    const png = await page.screenshot({ clip: { x: 331, y: 80, width: 610, height: 700 } });
                    await fs.writeFile(path.join(pixelDir, `${variant}-${scene}-${rep}-${top}.png`), png);
                    state.chatPixels = hash(png);
                }
                for (const row of state.rows) {
                    row.rim[0] = createHash('sha256').update(row.rim[0]).digest('hex');
                    if (row.svg) row.svg = createHash('sha256').update(JSON.stringify(row.svg)).digest('hex');
                }
                visual.push(state);
            }
            if (variant !== 'off') assert(visual.every(s => s.physical), 'Actual physical refraction must be on');
            const ms = key => +((next[key] - prev[key]) * 1000).toFixed(2);
            runs.push({ scene, count, mount, bounded, cadence, frames: stats(sample.gaps), above1_5x: sample.gaps.filter(gap => gap > cadence * 1.5).length,
                over16ms: sample.gaps.filter(gap => gap > 17).length, over33ms: sample.gaps.filter(gap => gap > 34).length,
                sampling: stats(sample.sample), hitTests: sample.hitTests, hitMs: +sample.hitMs.toFixed(2), layoutMs: ms('LayoutDuration'),
                styleMs: ms('RecalcStyleDuration'), taskMs: ms('TaskDuration'), scriptMs: ms('ScriptDuration'),
                loaf: sample.loaf, blockingMs: sample.blockingMs, loafScripts: sample.scriptCounts, visual });
        }
        const interaction = variant === 'candidate' && process.env.NVWA_ENGINE_VERIFY_BOUNDS === '1' ? await verifyBoundedCards(page) : null;
        assert.deepEqual(errors, []);
        return { variant, rep, runs, interaction };
    } catch (error) {
        console.error(JSON.stringify({ variant, rep, errors }));
        throw error;
    } finally { await context.close(); }
}

let browser;
try {
    const deadline = Date.now() + 45000;
    while (true) {
        try { if ((await fetch(origin)).ok) break; } catch {}
        if (server.exitCode !== null || Date.now() > deadline) throw Error(log);
        await new Promise(r => setTimeout(r, 250));
    }
    browser = await tools.chromium.launch({ headless, executablePath: process.env.NVWA_EDGE_EXECUTABLE });
    const cdp = await browser.newBrowserCDPSession();
    const sys = await cdp.send('SystemInfo.getInfo');
    const gpu = { devices: sys.gpu.devices.map(d => [d.vendorString, d.deviceString]), glRenderer: sys.gpu.auxAttributes?.glRenderer,
        compositor: sys.gpu.featureStatus?.gpu_compositing, raster: sys.gpu.featureStatus?.rasterization, webgl: sys.gpu.featureStatus?.webgl };
    console.log(JSON.stringify({ browser: browser.version(), headless, gpu, hashes }));
    const trials = [];
    for (let rep = 0; rep < reps; rep++) {
        for (const variant of rep % 2 ? [...variants].reverse() : variants) {
            const result = await trial(browser, variant, rep);
            trials.push(result);
            console.log(JSON.stringify({ ...result, runs: result.runs.map(({ visual, ...run }) => run) }));
            if (process.env.NVWA_ENGINE_RESULT) await fs.writeFile(process.env.NVWA_ENGINE_RESULT, JSON.stringify({ browser: browser.version(), headless, gpu, hashes, assetHashes, trials }, null, 2));
        }
    }
} catch (error) {
    console.error('Disposable host:', log);
    throw error;
} finally {
    await browser?.close();
    server.kill();
}
