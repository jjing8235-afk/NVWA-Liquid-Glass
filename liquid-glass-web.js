import { controlCoreFilter } from './control-material.js';
import { webPresetOf, normalizeWebPreset } from './web-presets.js';
import { getWebMap as displacement, cachedWebMap, webMapJob, clearWebMaps, createWebMapPreparation } from './web-map-cache.js';
export { sampleWebDisplacement, sampleWebMap } from './web-map-raster.js';
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
// 悬浮小球融合形状要和单独那颗球用同一个归一化系数，才不会一融合就变强 / 变弱（ball-glass.js）
export function webMapHalf(width, height, preset, strength = 1, bendY = 1) { return displacement(width, height, preset, strength, bendY).scale; }
export function createLiquidGlassWeb({ workerFactory } = {}) {
    const known = new Map(), animations = new Map();
    const preparation = createWebMapPreparation({ workerFactory });
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
        item.web = null; item.webOptions = null; item.webWanted = null; item.webStrength = 1;
        known.delete(el);
    }
    function present(el, options, value) {
        if (options.sourcePlane) {
            if (!options.sourcePlane(value)) return false;
            el.style.backdropFilter = 'none'; el.style.webkitBackdropFilter = 'none';
        } else { el.style.backdropFilter = value; el.style.webkitBackdropFilter = value; }
        return true;
    }
    function paint(el, item, options) {
        known.set(el, item); el.classList.add('ilg-web-glass');
        item.webOptions = options;
        const { width, height, refract } = options;
        const preset = normalizeWebPreset(options.preset), recipe = webPresetOf(preset);
        const strength = item.webStrength || 1, bendY = options.bendY || 1, refractionScale = options.refractionScale ?? 1;
        const control = options.controlCore === true;
        const tone = control ? 'contrast(1.04) brightness(1.02) saturate(1.12)' : FILTER_TAIL;
        if (refract && !failed) {
            try {
                const key = Math.round(width) + 'x' + Math.round(height) + ':' + preset + ':' + strength + ':' + bendY + ':' + control + ':' + options.radius + ':' + options.controlBlur + ':' + refractionScale;
                item.webWanted = key;
                if (!item.web || item.web.key !== key) {
                    const job = webMapJob(width, height, preset, strength, bendY);
                    let map = cachedWebMap(job);
                    if (!map && item.web?.value && item.web.filter.isConnected && preparation.request(job, el, result => {
                        if (!enabled || !usable() || !known.has(el) || !el.isConnected || item.webWanted !== key || item.webOptions !== options) return;
                        if (!result) failed = true;
                        paint(el, item, options);
                    })) {
                        // Retain the complete displayed material while its replacement is prepared.
                        el.style.setProperty('--ilg-web-tint', item.web.tint);
                        if (!present(el, options, item.web.value)) {
                            const fallback = 'blur(' + (control ? Math.max(3.5, recipe.blur) : recipe.blur) + 'px) ' + tone;
                            el.style.backdropFilter = fallback; el.style.webkitBackdropFilter = fallback;
                        }
                        return;
                    }
                    preparation.cancel(el);
                    // A surface's first appearance keeps the original immediate full material.
                    map ||= displacement(width, height, preset, strength, bendY);
                    const filter = options.filter();
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
                    item.web = { key, filter, tint: recipe.tint };
                } else preparation.cancel(el);
                const value = 'url(#' + item.web.filter.id + ') blur(' + (control ? Math.max(1.1, recipe.blur) : recipe.blur) + 'px) ' + tone;
                item.web.value = value;
                el.style.setProperty('--ilg-web-tint', recipe.tint);
                if (present(el, options, value)) return;
            } catch (error) {
                failed = true;
                console.warn('[NVWA Liquid Glass Web] Displacement unavailable; retaining the filter chain without refraction.', error);
            }
        } else { preparation.cancel(el); item.webWanted = null; }
        el.style.setProperty('--ilg-web-tint', recipe.tint);
        const value = 'blur(' + (control ? Math.max(3.5, recipe.blur) : recipe.blur) + 'px) ' + tone;
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
    function pausePreparation() { clearFeedback(); preparation.pause(); }
    function resumePreparation() {
        if (!enabled || document.hidden) return;
        preparation.resume();
        known.forEach((item, el) => { if (el.isConnected && item.webOptions) paint(el, item, item.webOptions); });
    }
    function visibility() { if (document.hidden) pausePreparation(); else resumePreparation(); }
    const events = [['pointerdown', down], ['pointerup', up], ['pointercancel', up], ['pointerout', out], ['keydown', keyDown], ['keyup', keyUp], ['visibilitychange', visibility]];
    function setEnabled(on) {
        if (on === enabled) { if (!usable()) clearFeedback(); return; }
        enabled = on;
        if (on) preparation.start();
        events.forEach(([event, handler]) => document[on ? 'addEventListener' : 'removeEventListener'](event, handler, { passive: true }));
        window[on ? 'addEventListener' : 'removeEventListener']('blur', clearFeedback);
        window[on ? 'addEventListener' : 'removeEventListener']('pagehide', pausePreparation);
        window[on ? 'addEventListener' : 'removeEventListener']('pageshow', resumePreparation);
        if (!on) { clearFeedback(); preparation.stop(); [...known.keys()].forEach(release); clearWebMaps(); }
        else if (document.hidden) preparation.pause();
    }
    return { paint, release, setEnabled, clearFeedback, status: preparation.status, destroy() { setEnabled(false); } };
}
