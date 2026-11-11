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
