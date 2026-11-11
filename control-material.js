// Readable control glass: soften the centre while leaving the refracting rim clear.
// One cached alpha mask is shared by the original and Web material filters.
const masks = new Map();
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function coreMask(width, height, radius) {
    const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
    const r = Math.min(Math.max(0, radius), w / 2, h / 2);
    const key = [w, h, r].join(':');
    if (masks.has(key)) return masks.get(key);
    const scale = Math.min(.5, 512 / w, 256 / h);
    const cw = Math.max(2, Math.round(w * scale)), ch = Math.max(2, Math.round(h * scale));
    const canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Control glass requires a 2D canvas.');
    const image = ctx.createImageData(cw, ch), data = image.data;
    const feather = Math.min(5.5, h * .18), inset = Math.min(.8, h * .03);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const qx = Math.abs((x + .5) * w / cw - w / 2) - w / 2 + r;
        const qy = Math.abs((y + .5) * h / ch - h / 2) - h / 2 + r;
        const depth = r - Math.min(Math.max(qx, qy), 0) - Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
        const i = (y * cw + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.round(255 * smooth((depth - inset) / feather));
    }
    ctx.putImageData(image, 0, 0);
    const url = canvas.toDataURL('image/png'); canvas.width = canvas.height = 0;
    if (masks.size >= 24) masks.delete(masks.keys().next().value);
    masks.set(key, url);
    return url;
}
export function controlCoreFilter(source, width, height, radius, blur = 5.5) {
    return `<feImage href="${coreMask(width, height, radius)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" result="ilg-control-mask"/>` +
        `<feGaussianBlur in="${source}" stdDeviation="${Math.max(0, Math.min(12, Number(blur) || 0))}" result="ilg-control-soft"/>` +
        '<feComposite in="ilg-control-soft" in2="ilg-control-mask" operator="in" result="ilg-control-centre"/>' +
        `<feComposite in="${source}" in2="ilg-control-mask" operator="out" result="ilg-control-rim"/>` +
        '<feMerge><feMergeNode in="ilg-control-rim"/><feMergeNode in="ilg-control-centre"/></feMerge>';
}
