// Supply a readability fallback only to unstyled, same-origin message documents.
// Authored documents and external floating windows keep their own visual cascade.
const TEXT_CSS = 'html body { text-shadow: none; }';
const AUTHOR_STYLE = 'style:not([data-ilg-card-clarity]), link[rel~="stylesheet"], [style]';

export function createCardTextClarity(chat) {
    const frames = new Map();
    let enabled = false, observer = null, pending = 0;
    function schedule() {
        if (enabled && !pending) pending = requestAnimationFrame(refresh);
    }
    function detach(entry) {
        entry.observer?.disconnect();
        entry.observer = null;
        entry.style?.remove();
        entry.style = null;
        entry.document = null;
    }
    function dispose(frame, entry) {
        frame.removeEventListener('load', entry.onLoad);
        detach(entry);
        frames.delete(frame);
    }
    function presentationNode(node) {
        return node.nodeType === 1 && !node.matches('[data-ilg-card-clarity]') &&
            (node.matches('style, link, iframe, [style]') || !!node.querySelector('style:not([data-ilg-card-clarity]), link, iframe, [style]'));
    }
    function refresh() {
        pending = 0;
        if (!enabled) return;
        const seen = new Set();
        function visit(frame) {
            if (seen.has(frame)) return;
            seen.add(frame);
            let entry = frames.get(frame);
            if (!entry) {
                entry = { document: null, style: null, observer: null, onLoad: schedule };
                frames.set(frame, entry);
                frame.addEventListener('load', entry.onLoad);
            }
            // Preflight origin and sandbox before a document read; some WebKit
            // builds report blocked reads even when the exception is caught.
            if (frame.hasAttribute('sandbox') && !frame.sandbox.contains('allow-same-origin')) { detach(entry); return; }
            if (!frame.hasAttribute('srcdoc')) {
                let accessible = false;
                try {
                    const url = new URL(frame.getAttribute('src') || 'about:blank', frame.ownerDocument.baseURI);
                    const origin = frame.ownerDocument.defaultView?.origin || frame.ownerDocument.location.origin;
                    accessible = url.href === 'about:blank' || url.origin === origin;
                } catch { /* Malformed or foreign sources stay untouched. */ }
                if (!accessible) { detach(entry); return; }
            }
            let doc = null;
            try { doc = frame.contentDocument; } catch { /* Preserve cross-origin isolation. */ }
            if (!doc?.documentElement) { detach(entry); return; }
            if (entry.document !== doc) {
                detach(entry);
                entry.document = doc;
                entry.observer = new MutationObserver(mutations => {
                    if (mutations.some(mutation => mutation.type === 'attributes' ? !mutation.target.matches('[data-ilg-card-clarity]') :
                        [...mutation.addedNodes, ...mutation.removedNodes].some(presentationNode))) schedule();
                });
                entry.observer.observe(doc, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'rel', 'href'] });
            }
            if (doc.querySelector(AUTHOR_STYLE)) {
                entry.style?.remove(); entry.style = null;
            } else if (!entry.style?.isConnected) {
                const style = doc.createElement('style');
                style.dataset.ilgCardClarity = '1';
                style.textContent = TEXT_CSS;
                entry.style = style;
                (doc.head || doc.documentElement).append(style);
            }
            doc.querySelectorAll('iframe').forEach(visit);
        }
        chat.querySelectorAll('.mes_text iframe, .mes_reasoning iframe').forEach(visit);
        for (const [frame, entry] of frames) if (!seen.has(frame)) dispose(frame, entry);
    }
    function setEnabled(value) {
        const next = value === true;
        if (next === enabled) return;
        enabled = next;
        if (enabled) {
            observer = new MutationObserver(mutations => {
                if (mutations.some(mutation => [...mutation.addedNodes, ...mutation.removedNodes].some(node =>
                    node.nodeType === 1 && (node.matches('iframe') || !!node.querySelector('iframe'))))) schedule();
            });
            observer.observe(chat, { childList: true, subtree: true });
            refresh();
        } else {
            observer?.disconnect(); observer = null;
            if (pending) cancelAnimationFrame(pending);
            pending = 0;
            for (const [frame, entry] of frames) dispose(frame, entry);
        }
    }
    return { setEnabled, destroy: () => setEnabled(false) };
}
