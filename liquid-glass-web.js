import { controlCoreFilter } from './control-material.js';
import { webPresetOf, normalizeWebPreset } from './web-presets.js';
/* Liquid Glass Web adapter.
 * Displacement fragment, normalization, filter chain, shadow and jelly spring follow
 * xiaofangstudio/liquid-glass-web @ 3094add905e60ee5aeb45e806751beb94425dd73 (MIT declared in README).
 * Refraction engine: Copyright (c) 2025 Shu Ding, MIT; see LICENSE-liquid-glass.txt.
 * Upstream's volumetric light, press glow and mutual illumination are intentionally not ported: no highlights.
 * NVWA owns lifecycle, bounded resources, host geometry and conservative fallback.
 */
const NS = 'http://www.w3.org/2000/svg';
export const FILTER_TAIL = 'contrast(1.2) brightness(1.05) saturate(1.1)';
const PRESS_STRENGTH = 1.3;
const maps = new Map();
let cachedPixels = 0;
const smoothStep = (a, b, t) => { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
function roundedRectSDF(x, y, w, h, r) {
    const qx = Math.abs(x) - w + r, qy = Math.abs(y) - h + r;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}
// Long capsules: upstream normalizes by the whole width, so a 374x52 pill gets a 75 px ring and up to
// ~117 px end displacement. NVWA caps the normalized length at END_ASPECT x the short side; the extra
// length becomes a flat middle (only the top/bottom ring bends there). Shapes up to 3:1 are unchanged.
const END_ASPECT = 3;
// Upstream fragment on whole-element normalized coordinates: flat centre, strongly bent ring.
// bendY > 1 thickens only the top/bottom ring (the input pill uses it); 1 = upstream.
// Returns the CSS-pixel offset from (x, y) to the sampled source point.
export function sampleWebDisplacement(x, y, width, height, recipe = webPresetOf('clear'), strength = 1, bendY = 1) {
    const vw = Math.min(width, height * END_ASPECT), vh = Math.min(height, width * END_ASPECT);
    // Fold the real position into the virtual box: ends keep their own offset, the middle maps to its centre line.
    const fold = (p, real, virtual) => p < virtual / 2 ? p : p > real - virtual / 2 ? p - (real - virtual) : virtual / 2;
    const vx = fold(x, width, vw), vy = fold(y, height, vh);
    const ix = vx / vw - .5, iy = vy / vh - .5;
    const d = roundedRectSDF(ix, iy, .3, .2, recipe.rad);
    const s = smoothStep(0, 1, smoothStep(.8, 0, d - .15 / recipe.edge / strength));
    const sy = bendY === 1 ? s : smoothStep(0, 1, smoothStep(.8, 0, d - .15 / (recipe.edge * bendY) / strength));
    return [(ix * s + .5) * vw - vx, (iy * sy + .5) * vh - vy];
}
// Pure displacement samples are also usable inside the ball worker.
export function sampleWebMap(width, height, preset, strength = 1, bendY = 1) {
    const recipe = webPresetOf(preset);
    const w = Math.max(2, Math.round(width)), h = Math.max(2, Math.round(height));
    // At most one texel per CSS pixel (upstream canvasDPI = 1) and a bounded total; the map stretches to the element.
    const resolution = Math.min(1, 2048 / w, 768 / h, Math.sqrt(393216 / (w * h)));
    const tw = Math.max(2, Math.round(w * resolution)), th = Math.max(2, Math.round(h * resolution));
    const raw = new Float32Array(tw * th * 2); let max = 0;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
        const [dx, dy] = sampleWebDisplacement((x + .5) * w / tw, (y + .5) * h / th, w, h, recipe, strength, bendY);
        const i = (y * tw + x) * 2; raw[i] = dx; raw[i + 1] = dy;
        max = Math.max(max, Math.abs(dx), Math.abs(dy));
    }
    // Upstream normalization: halve the peak, encode raw / half + 0.5, let the byte clamp the far tails.
    const half = Math.max(.0001, max * .5);
    return { raw, tw, th, half };
}
function displacement(width, height, preset, strength, bendY) {
    const w = Math.max(2, Math.round(width)), h = Math.max(2, Math.round(height));
    const key = w + 'x' + h + ':' + normalizeWebPreset(preset) + ':' + strength + ':' + bendY;
    if (maps.has(key)) { const value = maps.get(key); maps.delete(key); maps.set(key, value); return value; }
    const { raw, tw, th, half } = sampleWebMap(w, h, preset, strength, bendY);
    const image = new ImageData(tw, th);
    for (let i = 0, p = 0; i < image.data.length; i += 4, p += 2) {
        image.data[i] = (raw[p] / half + .5) * 255;
        image.data[i + 1] = (raw[p + 1] / half + .5) * 255;
        image.data[i + 2] = 0; image.data[i + 3] = 255;
    }
    const canvas = document.createElement('canvas'); canvas.width = tw; canvas.height = th;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Liquid Glass Web requires a 2D canvas.');
    context.putImageData(image, 0, 0);
    const result = { url: canvas.toDataURL('image/png'), scale: half, width: tw, height: th, pixels: tw * th };
    canvas.width = canvas.height = 0;
    while (maps.size && (maps.size >= 20 || cachedPixels + result.pixels > 1572864)) { const first = maps.keys().next().value; cachedPixels -= maps.get(first).pixels; maps.delete(first); }
    maps.set(key, result); cachedPixels += result.pixels; return result;
}
// 悬浮小球融合形状要和单独那颗球用同一个归一化系数，才不会一融合就变强 / 变弱（ball-glass.js）
export function webMapHalf(width, height, preset, strength = 1, bendY = 1) { return displacement(width, height, preset, strength, bendY).scale; }
export function createLiquidGlassWeb() {
    const known = new Map(), animations = new Map();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let enabled = false, active = null, failed = false;
    const reduced = () => motion.matches || document.body.classList.contains('reduced-motion');
    const usable = () => enabled && !document.body.classList.contains('no-blur');
    // 顶栏的岛和悬浮小球按下会果冻回弹；输入框不变形
    const isIsland = el => el.classList.contains('ilg-island') || el.id === 'ilg-ball';
    function stopAnimation(el) { animations.get(el)?.cancel(); animations.delete(el); }
    function setStrength(el, value) {
        const item = known.get(el);
        if (!item || (item.webStrength || 1) === value) return;
        item.webStrength = value;
        if (item.webOptions) paint(el, item, item.webOptions);
    }
    function reset(el) {
        stopAnimation(el);
        el.classList.remove('ilg-web-pressed');
        setStrength(el, 1);
    }
    function clearFeedback() {
        active = null;
        known.forEach((_, el) => reset(el));
    }
    function release(el) {
        if (!known.has(el)) return;
        if (active?.el === el) active = null;
        stopAnimation(el); el.classList.remove('ilg-web-pressed', 'ilg-web-glass');
        el.style.removeProperty('--ilg-web-tint');
        const item = known.get(el);
        if (item.web?.filter) item.web.filter.remove();
        item.webFilter = null;
        item.web = null; item.webOptions = null; item.webStrength = 1;
        known.delete(el);
    }
    function paint(el, item, options) {
        known.set(el, item); el.classList.add('ilg-web-glass');
        item.webOptions = options;
        const { width, height, refract } = options;
        const preset = normalizeWebPreset(options.preset), recipe = webPresetOf(preset);
        const strength = item.webStrength || 1, bendY = options.bendY || 1, refractionScale = options.refractionScale ?? 1;
        const control = options.controlCore === true;
        const tone = control ? 'contrast(1.04) brightness(1.02) saturate(1.12)' : FILTER_TAIL;
        el.style.setProperty('--ilg-web-tint', recipe.tint);
        if (refract && !failed) {
            try {
                const key = Math.round(width) + 'x' + Math.round(height) + ':' + preset + ':' + strength + ':' + bendY + ':' + control + ':' + options.radius + ':' + options.controlBlur + ':' + refractionScale;
                if (!item.web || item.web.key !== key) {
                    const map = displacement(width, height, preset, strength, bendY), filter = options.filter();
                    filter.setAttribute('x', '0'); filter.setAttribute('y', '0');
                    filter.setAttribute('width', width); filter.setAttribute('height', height);
                    filter.replaceChildren();
                    const image = document.createElementNS(NS, 'feImage');
                    for (const [k, v] of Object.entries({ href: map.url, x: 0, y: 0, width, height, preserveAspectRatio: 'none', result: 'ilg-web-map' })) image.setAttribute(k, v);
                    image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', map.url);
                    const disp = document.createElementNS(NS, 'feDisplacementMap');
                    for (const [k, v] of Object.entries({ in: 'SourceGraphic', in2: 'ilg-web-map', scale: map.scale * recipe.ref * refractionScale, xChannelSelector: 'R', yChannelSelector: 'G' })) disp.setAttribute(k, v);
                    if (control) disp.setAttribute('result', 'ilg-control-refracted');
                    filter.append(image, disp);
                    if (control) filter.insertAdjacentHTML('beforeend', controlCoreFilter('ilg-control-refracted', width, height, options.radius, options.controlBlur));
                    item.web = { key, filter };
                }
                const value = `url(#${item.web.filter.id}) blur(${control ? Math.max(1.1, recipe.blur) : recipe.blur}px) ${tone}`;
                el.style.backdropFilter = value; el.style.webkitBackdropFilter = value;
                return;
            } catch (error) {
                failed = true;
                console.warn('[NVWA Liquid Glass Web] Displacement unavailable; retaining the filter chain without refraction.', error);
            }
        }
        const value = `blur(${control ? Math.max(3.5, recipe.blur) : recipe.blur}px) ${tone}`;
        el.style.backdropFilter = value; el.style.webkitBackdropFilter = value;
    }
    function resolve(target) {
        if (!(target instanceof Element) || target.closest('[disabled], [aria-disabled="true"]')) return null;
        for (const el of known.keys()) {
            if (!el.isConnected || el.hidden || !isIsland(el)) continue;
            if (el.contains(target) || el.icons?.some(icon => icon.contains(target))) return el;
        }
        return null;
    }
    // Upstream press: squash to scale(1.1, .955) (CSS), thicken refraction, then a 500 ms jelly
    // spring 1 - exp(-5t)·cos(9t) on release. Only top-bar islands deform; inputs never transform.
    function press(el, pointer, key) {
        stopAnimation(el); active = { el, pointer, key };
        el.classList.add('ilg-web-pressed');
        setStrength(el, PRESS_STRENGTH);
    }
    function spring(el) {
        el.classList.remove('ilg-web-pressed');
        setStrength(el, 1);
        if (reduced() || !el.animate) return;
        stopAnimation(el);
        const frames = Array.from({ length: 31 }, (_, i) => {
            const t = i / 30, k = .1 * Math.exp(-5 * t) * Math.cos(9 * t);
            return { transform: `scale(${1 + k}, ${1 - k * .45})`, offset: t };
        });
        frames[frames.length - 1].transform = 'none';
        const animation = el.animate(frames, { duration: 500, easing: 'linear' });
        animations.set(el, animation);
        animation.onfinish = () => { if (animations.get(el) === animation) animations.delete(el); };
    }
    function down(e) {
        if (!usable() || active || e.button > 0) return;
        const el = resolve(e.target); if (el) press(el, e.pointerId);
    }
    function up(e) {
        if (!active || active.pointer !== e.pointerId) return;
        const el = active.el; active = null;
        if (e.type === 'pointerup') spring(el); else reset(el);
    }
    function keyDown(e) {
        if (!usable() || active || e.repeat || !['Enter', ' '].includes(e.key)) return;
        const el = resolve(e.target); if (el) press(el, 'keyboard', e.key);
    }
    function keyUp(e) {
        if (active?.pointer !== 'keyboard' || active.key !== e.key) return;
        const el = active.el; active = null; spring(el);
    }
    function out(e) { if (!e.relatedTarget && active) clearFeedback(); }
    function visibility() { if (document.hidden) clearFeedback(); }
    const events = [['pointerdown', down], ['pointerup', up], ['pointercancel', up], ['pointerout', out], ['keydown', keyDown], ['keyup', keyUp], ['visibilitychange', visibility]];
    function setEnabled(on) {
        if (on === enabled) { if (!usable()) clearFeedback(); return; }
        enabled = on;
        events.forEach(([event, handler]) => document[on ? 'addEventListener' : 'removeEventListener'](event, handler, { passive: true }));
        window[on ? 'addEventListener' : 'removeEventListener']('blur', clearFeedback);
        if (!on) { clearFeedback(); [...known.keys()].forEach(release); maps.clear(); cachedPixels = 0; }
    }
    return { paint, release, setEnabled, clearFeedback, destroy() { setEnabled(false); } };
}
