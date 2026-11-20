import { externalMessageRendering } from './chat-compat.js';

// Conservative unicode-range check; no font metric changes are skipped on unknown metadata.
export function fontLoadMayChangeText(faces, texts) {
    const list = Array.from(faces || []);
    if (!list.length) return true;
    const ranges = [];
    for (const face of list) {
        if (typeof face.unicodeRange !== 'string' || !face.unicodeRange.trim()) return true;
        for (const token of face.unicodeRange.split(',')) {
            const match = /^\s*U\+([0-9a-f?]{1,6})(?:-([0-9a-f]{1,6}))?\s*$/i.exec(token);
            if (!match || (match[2] && match[1].includes('?'))) return true;
            const lo = parseInt(match[1].replace(/\?/g, '0'), 16);
            const hi = parseInt(match[2] || match[1].replace(/\?/g, 'f'), 16);
            if (lo > hi || hi > 0x10ffff) return true;
            ranges.push([lo, hi]);
        }
    }
    // A numeric character class tests whole strings in the browser's regex engine.
    // All endpoints were validated above; no font-provided pattern is executed.
    const glyphs = new RegExp('[' + ranges.map(([lo, hi]) => '\\u{' + lo.toString(16) + '}-\\u{' + hi.toString(16) + '}').join('') + ']', 'u');
    // Check generated glyphs before touching the chat. Broad/unknown fonts can
    // invalidate metrics without reading and copying every message's text.
    if (glyphs.test('0123456789.()•◦▪“”‘’«»')) return true;
    for (const text of texts) if (glyphs.test(text || '')) return true;
    return false;
}

// Preserve message DOM and exact measured heights while the browser skips distant plain text.
const MARK = 'ilg-render-away', SIZE = '--ilg-message-height';
const WIDTH_EPSILON = .25;
const TAGS = new Set('P BR Q EM I B STRONG S DEL U A UL OL LI BLOCKQUOTE H1 H2 H3 H4 H5 H6 HR CODE PRE SPAN'.split(' '));
const OWN_CLASSES = new Set(['ilg-prose', 'ilg-indentable', 'ilg-type-prose']);
export function createMessageRendering(chat, { onReset = () => {}, onWidthFeedback = () => {} } = {}) {
    const doc = chat.ownerDocument, root = doc.documentElement, win = doc.defaultView;
    const supported = !!win.CSS?.supports?.('content-visibility', 'auto') && !!win.CSS?.supports?.('contain-intrinsic-block-size', 'auto 1px');
    const states = new Map(), pendingResizes = new Map();
    let environment = '', fontCycle = 0, handledFontCycle = 0, fontRaf = 0, resizeRaf = 0;
    const excluded = el => el.matches('.last_mes, .smallSysMes, .ilg-content-overlay, .ilg-card-renderer, [is_system="true"]');
    function plain(el) {
        const text = el.querySelector('.mes_text');
        if (!text || text.style.length || el.querySelector('iframe, video, audio, canvas, object, embed, script, style, [popover], .edit_textarea, details[open]')) return false;
        for (const node of text.querySelectorAll('*')) {
            if (!TAGS.has(node.tagName) || node.hasAttribute('style') || node.hasAttribute('id') || node.hasAttribute('role')
                || [...node.classList].some(c => !OWN_CLASSES.has(c)) || [...node.attributes].some(a => /^on/i.test(a.name))) return false;
        }
        return true;
    }
    function reveal(el, state) {
        if (!state.culled) return;
        state.culled = false;
        el.classList.remove(MARK);
    }
    function clear(el, state) {
        reveal(el, state);
        if (state.boundHeight === null) return;
        state.boundHeight = null;
        el.style.removeProperty(SIZE);
    }
    function apply(el, state) {
        if (externalMessageRendering(chat) || excluded(el) || !el.isConnected) { clear(el, state); return; }
        if (state.near !== false || state.height === null) { reveal(el, state); return; }
        if (state.recheckWidth !== null) return;
        if (state.plain === null) state.plain = plain(el);
        if (!state.plain) { clear(el, state); return; }
        if (!state.culled) {
            // The variable is only consumed by MARK. Keep it across viewport
            // crossings: changing inline style can invalidate every host row.
            if (state.boundHeight !== state.height) {
                el.style.setProperty(SIZE, state.height + 'px');
                state.boundHeight = state.height;
            }
            el.classList.add(MARK);
            state.culled = true;
        }
    }
    function forgetResize(el) {
        pendingResizes.delete(el);
        if (!pendingResizes.size && resizeRaf) { win.cancelAnimationFrame(resizeRaf); resizeRaf = 0; }
    }
    function reset(el, state) {
        forgetResize(el); clear(el, state); state.height = null; state.plain = null;
        if (el.isConnected) onReset(el);
    }
    function invalidateAll() { for (const [el, state] of states) reset(el, state); }
    function environmentKey() {
        const vars = ['--mainFontSize', '--mainFontFamily', '--fontScale', '--ilg-prose-leading-user', '--ilg-prose-inset'];
        return [externalMessageRendering(chat), root.dataset.ilgReadingStyle, root.dataset.ilgTypeLayout, ...['ilg-avline', 'ilg-indent', 'ilg-justify', 'ilg-font', 'ilg-prose-inset-on'].map(c => root.classList.contains(c)),
            ...vars.map(k => root.style.getPropertyValue(k)), chat.style.getPropertyValue('--ilg-chat-font-size'),
            doc.body.style.fontFamily, doc.body.style.fontSize, doc.body.style.lineHeight, doc.body.style.letterSpacing, doc.body.style.wordSpacing, doc.body.classList.contains('documentstyle'), doc.body.classList.contains('waifuMode')].join('|');
    }
    const changed = () => { const key = environmentKey(); if (key !== environment) { environment = key; invalidateAll(); } };
    const observer = new win.MutationObserver(changed);
    // A menu can load an unrelated CJK font subset. Only a subset containing
    // message characters can invalidate measured message heights. Missing or
    // malformed range metadata always takes the conservative invalidation path.
    function cancelFontCheck() { if (fontRaf) win.cancelAnimationFrame(fontRaf); fontRaf = 0; }
    const fontsLoading = () => {
        const cycle = ++fontCycle;
        cancelFontCheck();
        // Some engines settle FontFaceSet.ready without delivering loadingdone.
        // Give the normal event its turn first, then remeasure once if it was missed.
        doc.fonts?.ready?.then(() => {
            if (!states.size || cycle !== fontCycle || handledFontCycle === cycle) return;
            fontRaf = win.requestAnimationFrame(() => {
                fontRaf = 0;
                if (!states.size || cycle !== fontCycle || handledFontCycle === cycle) return;
                handledFontCycle = cycle; invalidateAll();
            });
        }, () => {});
    };
    function* messageTexts() { for (const el of states.keys()) yield el.textContent; }
    const fontsChanged = event => {
        handledFontCycle = fontCycle; cancelFontCheck();
        if (fontLoadMayChangeText(event?.fontfaces, messageTexts())) invalidateAll();
    };
    function listen(on) {
        if (on) {
            environment = environmentKey();
            observer.observe(root, { attributes: true, attributeFilter: ['class', 'style', 'data-ilg-reading-style', 'data-ilg-type-layout'] });
            observer.observe(chat, { attributes: true, attributeFilter: ['class', 'style'] });
            observer.observe(doc.body, { attributes: true, attributeFilter: ['class', 'style'] });
            doc.fonts?.addEventListener('loading', fontsLoading);
            doc.fonts?.addEventListener('loadingdone', fontsChanged);
            if (doc.fonts?.status === 'loading') fontsLoading();
        } else {
            observer.disconnect(); fontCycle++; cancelFontCheck();
            doc.fonts?.removeEventListener('loading', fontsLoading);
            doc.fonts?.removeEventListener('loadingdone', fontsChanged);
        }
    }
    function applyResize(el, contentHeight, contentWidth) {
        const state = states.get(el); if (!state) return;
        // The upstream renderer may report an estimated placeholder. Never cache
        // it as our measured height; its release triggers fresh ResizeObservers.
        if (externalMessageRendering(chat)) { clear(el, state); return; }
        if (state.culled && state.width !== null && Number.isFinite(contentWidth) && Math.abs(contentWidth - state.width) > WIDTH_EPSILON) {
            // Re-measure without containment. If width returns to its previous
            // value, reapplying containment at that width would start a loop.
            state.recheckWidth = state.width;
            onWidthFeedback('retry');
            reset(el, state);
            return;
        }
        if (Number.isFinite(contentWidth)) {
            if (state.recheckWidth !== null) {
                if (Math.abs(contentWidth - state.recheckWidth) > WIDTH_EPSILON) state.recheckWidth = null;
                else if (state.height === null) onWidthFeedback('keptRendered');
            }
            state.width = contentWidth;
        }
        if (excluded(el)) {
            clear(el, state);
            if (Number.isFinite(contentHeight) && contentHeight > 0) state.height = contentHeight;
            return;
        }
        if (!state.culled && Number.isFinite(contentHeight) && contentHeight > 0) state.height = contentHeight;
        apply(el, state);
    }
    // ResizeObserver deliveries must not change the measured layout. Keep only
    // the latest size per message and apply containment before the next layout.
    function flushResizes() {
        resizeRaf = 0;
        const updates = [...pendingResizes]; pendingResizes.clear();
        for (const [el, size] of updates) applyResize(el, size.contentHeight, size.contentWidth);
    }
    return {
        track(el) {
            if (!supported || states.has(el)) return;
            if (!states.size) listen(true);
            states.set(el, { near: null, height: null, boundHeight: null, width: null, recheckWidth: null, plain: null, culled: false });
        },
        resize(el, contentHeight, contentWidth) {
            if (!states.has(el)) return;
            pendingResizes.set(el, { contentHeight, contentWidth });
            if (!resizeRaf) resizeRaf = win.requestAnimationFrame(flushResizes);
        },
        visibility(el, near) { const state = states.get(el); if (state) { state.near = near; apply(el, state); } },
        invalidate(el) {
            const state = states.get(el); if (!state) return;
            state.plain = null;
            if (state.culled || pendingResizes.has(el)) reset(el, state);
        },
        release(el) { const state = states.get(el); if (!state) return; forgetResize(el); clear(el, state); states.delete(el); if (!states.size) listen(false); },
        invalidateAll,
        status: () => ({ supported, owner: externalMessageRendering(chat) ? 'baibai' : 'nvwa', tracked: states.size, culled: [...states.values()].filter(s => s.culled).length }),
    };
}
