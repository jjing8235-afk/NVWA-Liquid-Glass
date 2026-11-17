// Frozen pre-change sampler for per-browser floating-point and canvas comparisons.
// Liquid Glass Web recipes use upstream's five controls (xiaofangstudio/liquid-glass-web showcase):
// ref = refraction scale, edge = refraction ring thickness, rad = shape roundness, tint = white tint, blur = px.
// clear is exactly the upstream default; the others are NVWA adjustments around it.
export const WEB_PRESETS = Object.freeze({
    clear: { label: '原感清透', detail: '上游默认参数', ref: 1, edge: 1, rad: .6, tint: .08, blur: .25 },
    thin: { label: '轻薄', detail: '折射更轻，玻璃更薄', ref: .7, edge: .8, rad: .6, tint: .05, blur: .15 },
    soft: { label: '柔光', detail: '更宽更柔的弧面', ref: .9, edge: 1.35, rad: .75, tint: .1, blur: .6 },
    crystal: { label: '厚边', detail: '更厚、更明显的折射圈', ref: 1.3, edge: 1.5, rad: .6, tint: .08, blur: .25 },
});
export const normalizeWebPreset = value => Object.hasOwn(WEB_PRESETS, value) ? value : 'clear';
export const webPresetOf = value => WEB_PRESETS[normalizeWebPreset(value)];

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

export function baselineWebRaster(job) {
    const {raw,tw,th,half}=sampleWebMap(job.width,job.height,job.preset,job.strength,job.bendY);
    const data=new Uint8ClampedArray(tw*th*4);
    for(let i=0,p=0;i<data.length;i+=4,p+=2){data[i]=(raw[p]/half+.5)*255;data[i+1]=(raw[p+1]/half+.5)*255;data[i+2]=0;data[i+3]=255;}
    return {w:tw,h:th,scale:half,data};
}
