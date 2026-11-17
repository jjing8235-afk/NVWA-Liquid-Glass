// Sensor math and cadence stay in glass-lighting.js. The moving rim has a
// local layer so a pose sample does not invalidate the surface's descendants.
export function createLightScope(root) {
    const targets = new Map(), doc = root.ownerDocument;
    const layered = !!doc?.createElement && !!doc.defaultView?.CSS?.supports?.('transform', 'translate(1%, 1%)');
    let point = null, active = false;
    function clear(el, state) {
        if (!state.applied) return;
        state.applied = false; state.x = state.y = null;
        state.overlay?.remove(); state.overlay = state.layer = null;
        el.classList.remove('ilg-pose-surface', 'ilg-composited-pose');
        el.style.removeProperty('--ilg-tilt-x'); el.style.removeProperty('--ilg-tilt-y');
    }
    function mount(el, state) {
        if (state.overlay?.parentNode === el && state.layer?.parentNode === state.overlay) return;
        state.overlay?.remove();
        const overlay = doc.createElement('span'), layer = doc.createElement('span');
        overlay.className = 'ilg-pose-overlay'; layer.className = 'ilg-pose-layer';
        overlay.setAttribute('aria-hidden', 'true'); overlay.append(layer); el.append(overlay);
        state.overlay = overlay; state.layer = layer; state.x = state.y = null;
        el.classList.add('ilg-composited-pose');
    }
    function apply(el, state) {
        if (!point || !state.visible || !el.isConnected) { clear(el, state); return; }
        if (!state.applied) { el.classList.add('ilg-pose-surface'); state.applied = true; }
        // The tiny floor label keeps its original rim; an extra raster layer
        // changes its subpixel contour and saves little descendant work.
        if (layered && el.id !== 'ilg-floor') {
            mount(el, state);
            if (state.x !== point.x || state.y !== point.y) {
                // A 64% x 240% layer bounds the original 32% x 120% ellipse.
                // Moving its centre by 60% x 80% preserves the original travel.
                state.layer.style.transform = 'translate(' + (point.x * 93.75) + '%,' + (point.y * 100 / 3) + '%)';
                state.x = point.x; state.y = point.y;
            }
        } else {
            if (state.x !== point.x) { el.style.setProperty('--ilg-tilt-x', point.x); state.x = point.x; }
            if (state.y !== point.y) { el.style.setProperty('--ilg-tilt-y', point.y); state.y = point.y; }
        }
    }
    return {
        update(next) {
            point = next;
            if (active !== !!point) { active = !!point; root.classList.toggle('ilg-tilt-light', active); }
            for (const [el, state] of targets) apply(el, state);
        },
        visibility(el, visible) {
            let state = targets.get(el);
            if (!state) { state = { visible: !!visible, applied: false, x: null, y: null, overlay: null, layer: null }; targets.set(el, state); }
            else state.visible = !!visible;
            apply(el, state);
        },
        release(el) { const state = targets.get(el); if (state) { clear(el, state); targets.delete(el); } },
        destroy() { this.update(null); targets.clear(); },
        status: () => ({ tracked: targets.size, active, applied: [...targets.values()].filter(state => state.applied).length }),
    };
}
