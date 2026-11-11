// DOM presentation stays on the page; pure pixels and PNG encoding can run in one worker.
import { buildBallJob, rasterBall, packBallFrame } from './ball-raster.js';
import { createGlassPerformance } from './glass-performance.js';
import { positionFixed } from './fixed-position.js';
import { FILTER_TAIL } from './liquid-glass-web.js';
const NS = 'http://www.w3.org/2000/svg', SHADE = 18;

export function createBallGlass({ workerFactory, onError = () => {} } = {}) {
    const glass = document.createElement('div'), shade = document.createElement('div');
    const blurBox = document.createElement('div'), shape = document.createElement('div');
    glass.id = 'ilg-ball-glass'; shade.id = 'ilg-ball-glass-shade';
    for (const el of [glass, shade]) { el.setAttribute('aria-hidden', 'true'); el.style.display = 'none'; }
    blurBox.append(shape); shade.append(blurBox);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    // 两个滤镜轮流用：每次重画换一个 id，backdrop-filter 的 url 变了，浏览器一定重新取样
    const filters = [0, 1].map(i => {
        const f = document.createElementNS(NS, 'filter');
        f.id = 'ilg-ball-glass-f' + i;
        for (const [k, v] of Object.entries({ filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB', x: 0, y: 0 })) f.setAttribute(k, v);
        svg.append(f);
        return f;
    });
    const canvas = document.createElement('canvas'), frames = new Map();
    let flip = 0, lastKey = '', litTarget = null, cachedPixels = 0, cachedChars = 0;
    let wanted = null, displayed = null, circle = null, listening = false;
    const engine = createGlassPerformance({ workerFactory, computeSync, onResult: complete, onError, isBusy: () => document.body.dataset?.generating === 'true' });
    function computeSync(job) {
        const result = rasterBall(job);
        const urls = result.images.map(image => {
            canvas.width = image.w; canvas.height = image.h;
            const context = canvas.getContext('2d'), pixels = context.createImageData(image.w, image.h);
            pixels.data.set(image.data); context.putImageData(pixels, 0, 0);
            return canvas.toDataURL('image/png');
        });
        return packBallFrame(result, urls);
    }
    function remember(key, frame) {
        const previous = frames.get(key);
        if (previous) { cachedPixels -= previous.pixels; cachedChars -= previous.chars; frames.delete(key); }
        if (frame.pixels > 524288 || frame.chars > 2097152) return;
        while (frames.size && (frames.size >= 32 || cachedPixels + frame.pixels > 524288 || cachedChars + frame.chars > 2097152)) {
            const first = frames.keys().next().value, old = frames.get(first);
            if (circle?.frame === old) circle = null;
            cachedPixels -= old.pixels; cachedChars -= old.chars; frames.delete(first);
        }
        frames.set(key, frame); cachedPixels += frame.pixels; cachedChars += frame.chars;
    }
    function clearReflection() {
        if (litTarget) for (const key of ['--ilg-fuse-light-x', '--ilg-fuse-light-y', '--ilg-fuse-light-r']) litTarget.style.removeProperty(key);
        litTarget = null;
    }
    const setMask = (el, url) => { el.style.maskImage = el.style.webkitMaskImage = 'url("' + url + '")'; };
    function position(job, at = wanted?.job || job) {
        const L = at.L + at.ox - job.ox, T = at.T + at.oy - job.oy, { W, H, shadow } = job;
        positionFixed(glass, L, T);
        positionFixed(shade, L - SHADE, T - SHADE);
        Object.assign(glass.style, { display: '', width: W + 'px', height: H + 'px' });
        Object.assign(shade.style, { display: shadow ? '' : 'none', width: (W + 2 * SHADE) + 'px', height: (H + 2 * SHADE) + 'px' });
        Object.assign(shape.style, { left: SHADE + 'px', top: SHADE + 'px', width: W + 'px', height: H + 'px' });
    }
    function install(frame, job, target) {
        if (lastKey !== job.key) {
            glass.style.backgroundImage = 'url("' + frame.reflection + '")';
            glass.style.setProperty('--ilg-reflection-map', 'url("' + frame.reflection + '")');
            glass.style.backgroundSize = '100% 100%';
            const f = filters[flip ^= 1];
            f.setAttribute('width', job.W); f.setAttribute('height', job.H); f.innerHTML = frame.html;
            setMask(glass, frame.cover); setMask(shape, frame.cover);
            if (job.shadow) setMask(shade, frame.inv); else shade.style.maskImage = shade.style.webkitMaskImage = '';
            const bd = 'url(#' + f.id + ')' + (job.m.kind === 'web' ? ' blur(' + job.m.recipe.blur + 'px) ' + FILTER_TAIL : '');
            glass.style.backdropFilter = glass.style.webkitBackdropFilter = bd;
            glass.dataset.kind = shade.dataset.kind = job.m.kind;
            if (job.m.kind === 'web') glass.style.setProperty('--ilg-web-tint', job.m.recipe.tint);
            lastKey = job.key;
        }
        displayed = { frame, job, target };
        if (!job.tt) circle = { frame, job };
        position(job);
    }
    function commit() {
        if (!wanted || document.hidden || !glass.isConnected) return;
        const frame = frames.get(wanted.job.key);
        if (frame) install(frame, wanted.job, wanted.target);
    }
    function complete(job, frame) {
        if (!wanted || !glass.isConnected) return;
        remember(job.key, frame);
        if (job.key !== wanted.job.key) return;
        commit();
    }
    function refresh() {
        if (!wanted || document.hidden) return;
        const { job, target } = wanted, frame = frames.get(job.key);
        if (frame) {
            frames.delete(job.key); frames.set(job.key, frame); engine.dropPending();
            install(frame, job, target);
        } else {
            engine.request(job);
            // Keep position responsive while an uncached optical shape is being computed.
            // Never move a neck from one target onto another target or out into free space.
            if (displayed?.job.tt && (displayed.target !== target || !job.tt) && circle?.job.m.key === job.m.key) {
                install(circle.frame, circle.job, null);
            }
            if (displayed) position(displayed.job, job);
        }
    }
    function visibility() {
        if (document.hidden) { engine.pause(); }
        else { engine.resume(); refresh(); }
    }
    const activity = () => engine.markBusy();
    const leavePage = () => engine.pause();
    const enterPage = () => { if (!document.hidden) { engine.resume(); refresh(); } };
    function listen(on) {
        if (on === listening) return;
        listening = on;
        document[on ? 'addEventListener' : 'removeEventListener']('visibilitychange', visibility);
        window[on ? 'addEventListener' : 'removeEventListener']('pagehide', leavePage);
        window[on ? 'addEventListener' : 'removeEventListener']('pageshow', enterPage);
        for (const type of ['input', 'scroll']) document[on ? 'addEventListener' : 'removeEventListener'](type, activity, { capture: true, passive: true });
    }
    function mount() {
        if (!glass.isConnected) document.body.append(svg, shade, glass);
        listen(true); engine.resume();
    }
    function hide() {
        glass.style.display = shade.style.display = 'none'; clearReflection();
        wanted = displayed = null; lastKey = ''; listen(false); engine.pause();
    }
    function remove() {
        hide(); engine.stop(); glass.remove(); shade.remove(); svg.remove();
        canvas.width = canvas.height = 0; frames.clear(); circle = null; cachedPixels = cachedChars = 0;
        for (const filter of filters) filter.innerHTML = '';
        glass.style.backgroundImage = glass.style.backdropFilter = glass.style.webkitBackdropFilter = '';
        glass.style.removeProperty('--ilg-reflection-map');
        for (const el of [glass, shape, shade]) el.style.maskImage = el.style.webkitMaskImage = '';
    }
    function paint(b, t, m, K, low) {
        mount();
        if (litTarget !== t?.el) clearReflection();
        if (t?.el) {
            litTarget = t.el;
            const reach = Math.sqrt(Math.max(0, (b.R + K / 2) ** 2 - (b.cx - t.sx) ** 2 - (b.cy - t.sy) ** 2));
            litTarget.style.setProperty('--ilg-fuse-light-x', (t.sx - t.l) + 'px');
            litTarget.style.setProperty('--ilg-fuse-light-y', (t.sy - t.t) + 'px');
            litTarget.style.setProperty('--ilg-fuse-light-r', Math.max(1, reach) + 'px');
        }
        wanted = { job: buildBallJob(b, t, m, K, low, window.devicePixelRatio, !document.body.classList.contains('noShadows')), target: t?.el || null };
        if (document.hidden) { engine.pause(); return; }
        engine.prepare(); refresh();
    }
    return { paint, hide, remove, status: () => ({ ...engine.status(), cacheEntries: frames.size, cachedPixels, cachedChars, current: lastKey, wanted: wanted?.job.key || '' }) };
}
