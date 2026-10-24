/* NVWA 液态玻璃 · 边缘折射引擎 + 悬浮布局 + 设置面板
   完整折射依赖 backdrop-filter: url(#svg)，只有 Chromium 内核生效；其他浏览器自动降级为模糊 + 高光
   折射引擎有两套：新版物理折射（glass2.js，实验台 v2 移植）和旧版（本文件里的 makeMap / buildFilter） */
import { getMaps, clearMaps, physicalFilter, lightRow } from './glass2.js';
import { makeOrb } from './orb.js';

// 同一个酒馆里装了两份（比如手动拷的一份 + 从 GitHub 装的一份）时只跑先加载的那份，不然顶栏、面板会出两套
if (window.__ilgLoaded) throw new Error('[NVWA 液态玻璃] 已经有一份在运行，这份跳过');
window.__ilgLoaded = new URL('.', import.meta.url).pathname;

const MODULE = 'iosLiquidGlass';
const NS = 'http://www.w3.org/2000/svg';
const ctx = SillyTavern.getContext();

// 新版引擎的一键预设，数值和实验台一致（p 开头的参数只给新版用，旧版的参数不受影响）
// 自然弧度：不画任何高光，只靠边缘把背景弯过去、挤扁来显出玻璃的弧度（用户给的 iOS 锁屏参考图就是这样）。
// 用户要的是“边缘不扭曲，只放大”：所以用放大镜截面（lens），边缘内容放大 3 倍，往里 40px 内平滑恢复原样，不翻转、不折叠。
// 物理折射截面在弧带里会把内容翻过来（看着像扭曲的镜像），只给其他预设用。放大镜截面的折射强度由引擎封顶，调再大也不会折叠
const NATURAL_V4 = { pStrength: 1.2, pThickness: 50, pBezel: 28, pIor: 1.5, pAberration: 4, pSaturate: 1.15, pBrightness: 1.02, pContrast: 1, pSpecular: 0, pSharp: 4, pEdgeShade: 0, pFresnel: 0, pCaustic: 0, pShadow: 0.5, pSheen: 0 };
const PRESETS = {
    natural: ['自然弧度（边缘放大，无高光）', { profile: 'lens', pMagnify: 3, pStrength: 1, pBezel: 40, pAberration: 3, pSaturate: 1.15, pBrightness: 1.02, pContrast: 1, pSpecular: 0, pEdgeShade: 0, pFresnel: 0, pCaustic: 0, pShadow: 0.6, pSheen: 0 }],
    ultra: ['超清透', { profile: 'squircle', pStrength: 1.1, pThickness: 22, pBezel: 14, pIor: 1.5, pAberration: 0, pSaturate: 1.08, pBrightness: 1, pContrast: 1, pSpecular: 0.75, pSharp: 5, pEdgeShade: 0, pFresnel: 0, pCaustic: 0, pShadow: 0.5, pSheen: 0 }],
    // 清透立体：边缘反光、厚度阴影比实验台低（0.32 → 0.12 / 0.2），深色壁纸上一圈均匀的亮边 + 暗带看着廉价
    depth: ['清透立体', { profile: 'squircle', pStrength: 1.3, pThickness: 36, pBezel: 17, pIor: 1.5, pAberration: 0, pSaturate: 1.25, pBrightness: 1.03, pContrast: 1.05, pSpecular: 1, pSharp: 4, pEdgeShade: 0.2, pFresnel: 0.12, pCaustic: 0.6, pShadow: 0.85, pSheen: 0.45 }],
    thin: ['轻薄', { profile: 'squircle', pStrength: 0.8, pThickness: 20, pBezel: 18, pIor: 1.45, pAberration: 0, pSaturate: 1.3, pBrightness: 1.02, pContrast: 1, pSpecular: 0.6, pSharp: 4, pEdgeShade: 0.1, pFresnel: 0.15, pCaustic: 0.25, pShadow: 0.55, pSheen: 0.25 }],
    standard: ['标准', { profile: 'squircle', pStrength: 1, pThickness: 30, pBezel: 24, pIor: 1.5, pAberration: 0, pSaturate: 1.5, pBrightness: 1.02, pContrast: 1, pSpecular: 0.9, pSharp: 3, pEdgeShade: 0, pFresnel: 0, pCaustic: 0, pShadow: 0.7, pSheen: 0 }],
    thick: ['厚玻璃', { profile: 'squircle', pStrength: 1.4, pThickness: 55, pBezel: 34, pIor: 1.6, pAberration: 4, pSaturate: 1.6, pBrightness: 1.04, pContrast: 1.04, pSpecular: 1.25, pSharp: 2.5, pEdgeShade: 0.4, pFresnel: 0.4, pCaustic: 0.7, pShadow: 1, pSheen: 0.5 }],
    extreme: ['夸张', { profile: 'squircle', pStrength: 1.8, pThickness: 80, pBezel: 44, pIor: 1.8, pAberration: 10, pSaturate: 1.85, pBrightness: 1.06, pContrast: 1.08, pSpecular: 1.7, pSharp: 2, pEdgeShade: 0.5, pFresnel: 0.55, pCaustic: 0.9, pShadow: 1.3, pSheen: 0.6 }],
};

const DEFAULTS = {
    enabled: true, float: true, islands: true, fold: true, qrFold: true, home: true, toneBtn: true, homeName: 'NVWA 用户', icons: true, refract: true, refractMes: true, font: true, tone: 'time', dayStart: 7, dayEnd: 19, avatar: 'line', orb: true,
    engine: 'physical', follow: true, pLight: 135,
    // 自然弧度没写的参数（厚度、折射率等，只给物理折射截面用）沿用清透立体的
    ...PRESETS.depth[1], ...PRESETS.natural[1],
    scale: 95, bevel: 30, curve: 2.2, aberration: 8,
    barBlur: 1, mesBlur: 3, panelBlur: 8, mesTint: 0.5, scrim: 0.35,
    saturate: 1.6, brightness: 1.05, tint: 0.05, highlight: 0.55, radius: 22,
};
// [键, 名称, 最小, 最大, 步长, 单位, 只对哪个引擎显示, 只对哪种截面显示（lens 放大镜 / snell 物理折射）]
const SLIDERS = [
    ['pMagnify', '边缘放大倍数', 1, 6, 0.1, '×', 'physical', 'lens'],
    ['pStrength', '折射强度', 0, 5, 0.05, '×', 'physical'],
    ['pThickness', '玻璃厚度', 4, 150, 1, 'px', 'physical', 'snell'],
    ['pBezel', '边缘弧面宽度', 4, 100, 1, 'px', 'physical'],
    ['pIor', '折射率', 1, 3, 0.01, '', 'physical', 'snell'],
    ['pAberration', '色散彩边', 0, 40, 1, '%', 'physical'],
    ['pSaturate', '饱和度', 0, 3, 0.05, '', 'physical'],
    ['pBrightness', '亮度', 0.6, 1.6, 0.01, '', 'physical'],
    ['pContrast', '对比度', 0.6, 1.6, 0.01, '', 'physical'],
    ['pSpecular', '高光强度', 0, 3, 0.05, '', 'physical'],
    ['pSharp', '高光锐利度', 0.5, 16, 0.5, '', 'physical'],
    ['pEdgeShade', '厚度阴影', 0, 1, 0.01, '', 'physical'],
    ['pFresnel', '边缘反光', 0, 1.5, 0.01, '', 'physical'],
    ['pCaustic', '内部聚光', 0, 2, 0.01, '', 'physical'],
    ['pShadow', '悬浮投影', 0, 2, 0.05, '', 'physical'],
    ['pSheen', '表面光泽', 0, 1.5, 0.05, '', 'physical'],
    ['pLight', '光源角度（不跟随鼠标时）', 0, 359, 1, '°', 'physical'],
    ['scale', '折射强度', 0, 200, 1, '', 'legacy'],
    ['bevel', '边缘弧度宽度', 4, 60, 1, 'px', 'legacy'],
    ['curve', '弧面形状', 0.6, 5, 0.1, '', 'legacy'],
    ['aberration', '色散彩边', 0, 30, 1, '', 'legacy'],
    ['saturate', '饱和度', 0.5, 3, 0.05, '', 'legacy'],
    ['brightness', '亮度', 0.6, 1.5, 0.01, '', 'legacy'],
    ['highlight', '高光强度', 0, 1, 0.01, '', 'legacy'],
    ['barBlur', '顶栏/输入框模糊', 0, 30, 0.5, 'px'],
    ['mesBlur', '消息卡片模糊', 0, 30, 0.5, 'px'],
    ['mesTint', '消息卡片底色浓度（越高字越清楚）', 0, 1, 0.01, ''],
    ['scrim', '顶栏/输入框后的渐暗（防止字和图标叠在一起）', 0, 1, 0.01, ''],
    ['panelBlur', '抽屉/弹窗模糊', 0, 40, 0.5, 'px'],
    ['tint', '顶栏/输入框底色', 0, 0.6, 0.01, ''],
    ['radius', '消息卡片圆角', 0, 40, 1, 'px'],
];
const TOGGLES = [
    ['enabled', '启用液态玻璃美化'],
    ['float', '顶栏和输入框悬浮在聊天内容上方'],
    ['icons', 'iOS 风格图标'],
    ['refract', '边缘折射（只在 Chrome / Edge 生效）'],
    ['refractMes', '消息卡片也折射（长聊天卡顿时关掉）'],
    ['font', '统一字体：思源黑体（苹果设备用苹方）'],
    ['islands', '顶栏拆成三个分组的悬浮岛'],
    ['fold', '顶栏折叠：设置类图标收进左上角菜单'],
    ['qrFold', '快捷回复收进输入框左边的按钮'],
    ['toneBtn', '顶栏显示白 / 黑壁纸切换键'],
    ['home', '首页只显示问候语（按手机时间：早上好 / 晚上好）'],
    ['orb', '模型思考时显示旋转的点阵小球'],
];

ctx.extensionSettings[MODULE] = Object.assign({}, DEFAULTS, ctx.extensionSettings[MODULE]);
const S = ctx.extensionSettings[MODULE];
// v2：玻璃改得更厚、更透。只迁移还停在旧默认值的参数，用户自己调过的不动
if (!S.v || S.v < 2) {
    const OLD = { scale: 70, bevel: 22, aberration: 6, barBlur: 2, mesBlur: 6, panelBlur: 18, tint: 0.08 };
    for (const [k, v] of Object.entries(OLD)) if (S[k] === v) S[k] = DEFAULTS[k];
    S.v = 2;
    ctx.saveSettingsDebounced();
}
// v3：清透立体预设的边缘反光、厚度阴影调低。同样只改还停在旧默认值的
if (S.v < 3) {
    if (S.pFresnel === 0.32) S.pFresnel = PRESETS.depth[1].pFresnel;
    if (S.pEdgeShade === 0.32) S.pEdgeShade = PRESETS.depth[1].pEdgeShade;
    S.v = 3;
    ctx.saveSettingsDebounced();
}
// v4：默认改成“自然弧度”（不要边缘高光，用户给了参考图）。还停在清透立体默认值上的整组换掉，自己调过的不动
if (S.v < 4) {
    if (Object.entries(PRESETS.depth[1]).every(([k, v]) => S[k] === v)) Object.assign(S, PRESETS.natural[1]);
    S.v = 4;
    ctx.saveSettingsDebounced();
}
// v5：自然弧度改成放大镜截面（用户：边缘不扭曲，只放大）。还停在 v4 自然弧度数值上的整组换掉
if (S.v < 5) {
    if (S.profile === 'squircle' && Object.entries(NATURAL_V4).every(([k, v]) => S[k] === v)) Object.assign(S, PRESETS.natural[1]);
    S.v = 5;
    ctx.saveSettingsDebounced();
}
// v7：v6 把消息卡片模糊调到 6，用户反馈看不出液态玻璃了（模糊太重，边缘弧度里没有清楚的内容可折射），改回 3
if (S.v < 7) {
    if (S.mesBlur === 6) S.mesBlur = DEFAULTS.mesBlur;
    S.v = 7;
    ctx.saveSettingsDebounced();
}
// v9（v8 在开发中途存过一次，所以用新号）：明暗默认改成“按时间”（白天瓷白、晚上墨黑，和首页问候一致）。
// 旧版的太阳 / 月亮键每点一次都会把设置写成浅 / 深，存着的浅 / 深多半是点键留下的，不是专门选的，所以一起换过去；想固定的话设置里还能选“一直浅色 / 深色”
if (S.v < 9) {
    S.tone = 'time';
    S.v = 9;
    ctx.saveSettingsDebounced();
}

const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canFull = !isIOS && !!window.chrome && !/Firefox\//.test(ua) && CSS.supports('backdrop-filter', 'blur(1px)');

// 每类表面的模糊来源和折射强度倍率；bezelK / thickK 是新版引擎在全局弧面宽度、厚度上乘的倍数（大块玻璃更厚，小块更薄）
const KIND = {
    bar: { blur: () => S.barBlur, k: 1, bezelK: 1, thickK: 1 },
    mes: { blur: () => S.mesBlur, k: 0.8, bezelK: 1, thickK: 1 },
    panel: { blur: () => S.panelBlur, k: 0.7, bezelK: 1.1, thickK: 1.5 },
    // NVWA 预设面板 / 记忆窗口所在的弹窗：和顶栏同一套清透折射，靠内部的暗色“凹槽”保证文字可读
    clear: { blur: () => S.barBlur + 1, k: 0.9, bezelK: 1.1, thickK: 1.5 },
    // 面板里吸顶的标签栏：内容从它下面滚过时折射
    inner: { blur: () => S.barBlur + 1, k: 0.6, bezelK: 0.75, thickK: 0.8 },
    // 右上角提示：文字压在玻璃上，比顶栏多一点模糊保证可读
    toast: { blur: () => Math.max(S.barBlur, 10), k: 0.6, bezelK: 0.75, thickK: 0.8 },
};
// 输入区的玻璃画在 #nonQRFormItems（只有输入框那一行）上，快捷回复按钮单独浮在胶囊上方
const PILL_SEL = '#nonQRFormItems';
const BAR_SEL = `#top-bar, ${PILL_SEL}`;
const PANEL_SEL = '.drawer-content, #character_popup, #world_popup, .popup, #options .options-content, #extensionsMenu';
const MES_SEL = '.mes:not(.smallSysMes)';

const root = document.documentElement;
const svg = document.createElementNS(NS, 'svg');
svg.setAttribute('aria-hidden', 'true');
svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
svg.innerHTML = '<defs></defs>';
document.body.appendChild(svg);
const defs = svg.firstChild;

const items = new Map();
const cache = new Map();
let uid = 0;
function radiusOf(el, w, h) {
    const r = getComputedStyle(el).borderTopLeftRadius || '0';
    let v = parseFloat(r) || 0;
    if (r.includes('%')) v = v / 100 * Math.min(w, h);
    return Math.min(v, w / 2, h / 2);
}

// 位移贴图：中心灰色=不动；越靠近圆角矩形边缘越向内取样（R=水平，G=垂直）
function makeMap(w, h, r, bevel) {
    const key = [w, h, Math.round(r), bevel, S.curve].join('|');
    if (cache.has(key)) return cache.get(key);
    const area = w * h;
    const k = area > 400000 ? 0.33 : area > 120000 ? 0.5 : 1;
    const cw = Math.max(2, Math.round(w * k)), ch = Math.max(2, Math.round(h * k));
    const R = r * k, B = Math.max(1, Math.min(bevel * k, Math.min(cw, ch) / 2));
    const hw = cw / 2, hh = ch / 2, Rn = Math.max(R, B), curve = S.curve;
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c2 = cv.getContext('2d');
    const img = c2.createImageData(cw, ch), d = img.data;
    for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
            const px = x + 0.5 - hw, py = y + 0.5 - hh;
            const ax = Math.abs(px), ay = Math.abs(py);
            const qx = ax - hw + R, qy = ay - hh + R;
            const depth = -(Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - R);
            const i = (y * cw + x) * 4;
            let dx = 0, dy = 0;
            if (depth > 0 && depth < B) {
                let nx, ny;
                const cx = ax - (hw - Rn), cy = ay - (hh - Rn);
                if (cx > 0 && cy > 0) { const L = Math.hypot(cx, cy) || 1; nx = cx / L; ny = cy / L; }
                else if (cx > cy) { nx = 1; ny = 0; } else { nx = 0; ny = 1; }
                if (px < 0) nx = -nx;
                if (py < 0) ny = -ny;
                const m = Math.pow(1 - depth / B, curve);
                dx = -nx * m; dy = -ny * m;
            }
            d[i] = 128 + dx * 127; d[i + 1] = 128 + dy * 127; d[i + 2] = 128; d[i + 3] = 255;
        }
    }
    c2.putImageData(img, 0, 0);
    const url = cv.toDataURL('image/png');
    if (cache.size > 120) cache.clear();
    cache.set(key, url);
    return url;
}

const disp = (scale, res) => `<feDisplacementMap in="SourceGraphic" in2="map" scale="${scale.toFixed(1)}" xChannelSelector="R" yChannelSelector="G"${res ? ` result="${res}"` : ''}/>`;

function filterOf(it, w, h) {
    const f = it.filter || (it.filter = defs.appendChild(document.createElementNS(NS, 'filter')));
    f.setAttribute('id', it.id);
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('primitiveUnits', 'userSpaceOnUse');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.setAttribute('x', '0'); f.setAttribute('y', '0');
    // 滤镜区域比元素多留 200px：流式输出时卡片变高，下一帧重建前不会露出空洞
    f.setAttribute('width', w); f.setAttribute('height', h + 200);
    return f;
}

// 新版：模糊、调色、折射、高光全在一个 SVG 滤镜里，所以 backdrop-filter 只写 url()
function buildPhysical(it, el, w, h, r) {
    const kind = KIND[it.kind];
    const o = {
        profile: S.profile, ior: S.pIor, magnify: S.pMagnify, bezel: S.pBezel * kind.bezelK, thickness: S.pThickness * kind.thickK,
        strength: S.pStrength * kind.k, aberration: S.pAberration, blur: kind.blur(),
        saturate: S.pSaturate, brightness: S.pBrightness, contrast: S.pContrast,
        specular: S.pSpecular, sharp: S.pSharp, edgeShade: S.pEdgeShade, fresnel: S.pFresnel, caustic: S.pCaustic,
    };
    it.angle = lightAngle(el);
    const f = filterOf(it, w, h);
    f.innerHTML = physicalFilter(getMaps(w, h, r, o), o, w, h, it.angle);
    it.lights = f.querySelectorAll('[data-light]');
}

function buildFilter(it, w, h, r) {
    const sc = S.scale * KIND[it.kind].k, a = S.aberration * KIND[it.kind].k;
    const f = filterOf(it, w, h);
    let html = `<feFlood flood-color="rgb(128,128,128)" result="neutral"/>` +
        `<feImage href="${makeMap(w, h, r, S.bevel * (it.kind === 'bar' ? 1.3 : 1))}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="img"/>` +
        `<feComposite in="img" in2="neutral" operator="over" result="map"/>`;
    if (a > 0.5) {
        html += disp(sc + a, 'dr') + disp(sc, 'dg') + disp(Math.max(0, sc - a), 'db') +
            '<feColorMatrix in="dr" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>' +
            '<feColorMatrix in="dg" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>' +
            '<feColorMatrix in="db" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>' +
            '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>';
    } else {
        html += disp(sc);
    }
    f.innerHTML = html;
}

function refractAllowed(it) {
    if (!S.refract || !canFull || document.body.classList.contains('no-blur')) return false;
    if (it.kind === 'mes') return S.refractMes && it.visible;
    return true;
}

const CLEAR_HOST = '#nvwa-panel, #nvwa-memory';
const INNER_SEL = '#nvwa-panel .nvp-tabbar, #nvwa-memory .m-tabbar';

function paint(el) {
    const it = items.get(el);
    if (!it) return;
    if (!el.isConnected) { untrack(el); return; }
    if (it.kind === 'panel' && el.matches('.popup') && el.querySelector(CLEAR_HOST)) {
        it.kind = 'clear';
        el.classList.add('ilg-clear', 'ilg-sheen');
    }
    if (it.kind === 'clear') el.querySelectorAll(INNER_SEL).forEach(t => track(t, 'inner'));
    if (document.body.classList.contains('no-blur')) {
        setPhys(el, it, false);
        el.style.backdropFilter = 'none';
        return;
    }
    const tail = `blur(${KIND[it.kind].blur()}px) saturate(${S.saturate}) brightness(${S.brightness})`;
    const w = el.offsetWidth, h = el.offsetHeight;
    const phys = refractAllowed(it) && w > 0 && h > 0 && S.engine === 'physical';
    setPhys(el, it, phys);
    if (phys) {
        buildPhysical(it, el, w, h, radiusOf(el, w, h));
        el.style.backdropFilter = `url(#${it.id})`;
    } else if (refractAllowed(it) && w > 0 && h > 0) {
        buildFilter(it, w, h, radiusOf(el, w, h));
        el.style.backdropFilter = `url(#${it.id}) ${tail}`;
    } else {
        el.style.backdropFilter = tail;
        if (!canFull) el.style.webkitBackdropFilter = tail;
    }
}
// .ilg-phys：高光已经在滤镜里画了，CSS 那套亮边/内阴影要让开（见 style.css 的新版引擎部分）
function setPhys(el, it, on) {
    el.classList.toggle('ilg-phys', on);
    if (!on) it.lights = null;
}

// 高光跟随鼠标：鼠标当作光源，每块玻璃朝着鼠标的那段边最亮。只改滤镜里几行颜色矩阵，不重画贴图
let pointer = null, lightRaf = 0;
const reducedMotion = () => document.body.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
function lightAngle(el) {
    if (!S.follow || !pointer || reducedMotion()) return S.pLight;
    const r = el.getBoundingClientRect();
    return Math.atan2(r.top + r.height / 2 - pointer.y, pointer.x - (r.left + r.width / 2)) * 180 / Math.PI;
}
function updateLights() {
    lightRaf = 0;
    items.forEach((it, el) => {
        if (!it.lights) return;
        const a = lightAngle(el);
        // 角度变化不到 1.5° 不动，免得鼠标一动所有玻璃都重绘
        if (Math.abs(((a - it.angle) % 360 + 540) % 360 - 180) < 1.5) return;
        it.angle = a;
        it.lights.forEach(n => n.setAttribute('values', lightRow(a, Number(n.dataset.light))));
    });
}
function scheduleLights() {
    if (!lightRaf && pointer && S.follow && S.engine === 'physical') lightRaf = requestAnimationFrame(updateLights);
}
window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    pointer = { x: e.clientX, y: e.clientY };
    scheduleLights();
}, { passive: true });
// 尺寸变化在绘制前同步重建滤镜，避免一帧错位
const ro = new ResizeObserver(entries => entries.forEach(e => paint(e.target)));
const io = new IntersectionObserver(entries => entries.forEach(e => {
    const it = items.get(e.target);
    if (!it || it.visible === e.isIntersecting) return;
    it.visible = e.isIntersecting;
    paint(e.target);
}), { root: document.getElementById('chat'), rootMargin: '200px 0px' });

function track(el, kind) {
    if (items.has(el)) return;
    const it = { id: `ilg-f${++uid}`, kind, visible: kind !== 'mes' };
    items.set(el, it);
    el.classList.add('ilg-glass');
    // 表面光泽只给不会内部滚动的表面，抽屉这类会滚的容器里光泽会跟着内容跑
    if (kind === 'bar' || kind === 'mes' || kind === 'inner' || kind === 'toast') el.classList.add('ilg-sheen');
    if (getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
        it.posFixed = true;
    }
    ro.observe(el);
    if (kind === 'mes') io.observe(el);
    paint(el);
}

function untrack(el) {
    const it = items.get(el);
    if (!it) return;
    it.filter?.remove();
    ro.unobserve(el);
    io.unobserve(el);
    el.classList.remove('ilg-glass', 'ilg-sheen', 'ilg-clear', 'ilg-phys');
    el.style.backdropFilter = '';
    el.style.webkitBackdropFilter = '';
    if (it.posFixed) el.style.position = '';
    items.delete(el);
}

function scan() {
    if (!S.enabled) return;
    document.querySelectorAll(S.islands ? PILL_SEL : BAR_SEL).forEach(el => track(el, 'bar'));
    document.querySelectorAll(PANEL_SEL).forEach(el => track(el, 'panel'));
    const bubble = document.body.classList.contains('bubblechat');
    document.querySelectorAll(`#chat ${MES_SEL}`).forEach(el => bubble ? track(el, 'mes') : untrack(el));
}

function repaintAll() { items.forEach((_, el) => paint(el)); }
function clearAll() { [...items.keys()].forEach(untrack); cache.clear(); clearMaps(); }

// 顶栏分组悬浮岛：图标按功能分三组，每组后面画一块独立的玻璃。图标和抽屉面板都不动，抽屉是按整个图标区定位的
const holder = document.getElementById('top-settings-holder');
const GROUP_START = ['user-settings-button', 'persona-management-button'];
const islands = [];
const islandRO = new ResizeObserver(() => requestAnimationFrame(layoutIslands));
function iconGroups() {
    const groups = [[]];
    for (const d of holder.children) {
        // 折叠时：菜单键自己一座岛，剩下没收起来的图标一座岛
        const start = d.classList.contains('ilg-fold-keep') ? d.id === FOLD_KEEP[0] : GROUP_START.includes(d.id);
        if (start && groups[groups.length - 1].length) groups.push([]);
        groups[groups.length - 1].push(d);
    }
    return groups.filter(g => !S.fold || g.some(d => !d.classList.contains('ilg-folded')));
}
function layoutIslands() {
    if (!S.enabled || !S.islands) return;
    const bar = document.getElementById('top-bar');
    const groups = iconGroups();
    holder.querySelectorAll(':scope > .ilg-group-start').forEach(d => d.classList.remove('ilg-group-start'));
    groups.slice(1).forEach(g => g[0].classList.add('ilg-group-start'));
    for (const d of holder.children) islandRO.observe(d);
    const br = bar.getBoundingClientRect();
    groups.forEach((g, i) => {
        let isl = islands[i];
        if (!isl) {
            isl = islands[i] = document.createElement('div');
            isl.className = 'ilg-island';
            isl.style.position = 'absolute';
            bar.appendChild(isl);
        }
        isl.icons = g;
        const rects = g.map(d => d.getBoundingClientRect()).filter(r => r.width > 0);
        isl.hidden = !rects.length;
        if (isl.hidden) return;
        const left = Math.min(...rects.map(r => r.left)) - 6;
        const right = Math.max(...rects.map(r => r.right)) + 6;
        isl.style.left = `${left - br.left - bar.clientLeft}px`;
        isl.style.width = `${right - left}px`;
        if (!items.has(isl)) track(isl, 'bar');
    });
    for (let i = groups.length; i < islands.length; i++) { untrack(islands[i]); islands[i].remove(); }
    islands.length = groups.length;
    scheduleAdapt();
}
function removeIslands() {
    islands.forEach(isl => { untrack(isl); isl.remove(); });
    islands.length = 0;
    holder.querySelectorAll(':scope > .ilg-group-start, :scope > .ilg-icon-over-light')
        .forEach(d => d.classList.remove('ilg-group-start', 'ilg-icon-over-light'));
}
// 顶栏折叠（参考支付宝 AI 对话页）：左上角一个菜单键，设置类图标收进它弹出的玻璃菜单；角色卡、人设留在右边。
// 原来的图标和抽屉都不挪位置（抽屉的开关事件绑在原元素上），只是把图标隐藏，菜单里的按钮替它点一下
const FOLD_KEEP = ['ilg-tone-button', 'persona-management-button', 'rightNavHolder'];
const FOLD_LABELS = {
    'ai-config-button': 'AI 回复设置', 'sys-settings-button': 'API 连接', 'advanced-formatting-button': '高级格式',
    'WI-SP-button': '世界书', 'user-settings-button': '用户设置', 'backgrounds-button': '背景', 'extensions-settings-button': '扩展',
};
const foldBtn = document.createElement('div');
foldBtn.id = 'ilg-fold-button';
foldBtn.innerHTML = '<div class="drawer-icon ilg-fold-icon" role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" aria-controls="ilg-fold-menu" title="菜单"></div>';
const foldIcon = foldBtn.firstChild;
const foldMenu = document.createElement('div');
foldMenu.id = 'ilg-fold-menu';
foldMenu.setAttribute('role', 'menu');
foldMenu.setAttribute('aria-label', '设置菜单');
foldMenu.hidden = true;
document.body.appendChild(foldMenu);

const foldedDrawers = () => [...holder.querySelectorAll(':scope > .drawer.ilg-folded')];
const openFolded = () => foldedDrawers().find(d => d.querySelector(':scope > .drawer-content.openDrawer:not(.pinnedOpen)'));
const apiAlert = () => !!document.querySelector('#API-status-top.redOverlayGlow');

function applyFold() {
    const on = S.enabled && S.fold;
    root.classList.toggle('ilg-fold', on);
    if (!on) {
        closeFoldMenu();
        foldBtn.remove();
        holder.querySelectorAll(':scope > .ilg-folded, :scope > .ilg-fold-keep').forEach(d => d.classList.remove('ilg-folded', 'ilg-fold-keep'));
        if (items.has(foldMenu)) untrack(foldMenu);
        syncSheetHeads();
        return;
    }
    if (holder.firstElementChild !== foldBtn) holder.prepend(foldBtn);
    for (const d of holder.children) {
        if (d === foldBtn) continue;
        const keep = FOLD_KEEP.includes(d.id);
        d.classList.toggle('ilg-fold-keep', keep);
        d.classList.toggle('ilg-folded', !keep);
    }
    syncSheetHeads();
    syncFold();
}
// 菜单打开、或者收起来的某个抽屉开着时，菜单键变成蓝色的 ×，再点一下就关掉
function syncFold() {
    const open = !foldMenu.hidden || !!openFolded();
    foldBtn.classList.toggle('ilg-open', open);
    foldIcon.setAttribute('aria-expanded', String(!foldMenu.hidden));
    foldBtn.classList.toggle('ilg-alert', apiAlert());
}
function buildFoldTiles() {
    foldMenu.replaceChildren();
    // 第一行：整行宽的“聊天记录”，下面一行小标题，再下面才是设置图标宫格
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'ilg-fold-row';
    row.setAttribute('role', 'menuitem');
    row.innerHTML = '<span class="ilg-fold-row-icon" aria-hidden="true"></span><span class="ilg-fold-row-text"><b>聊天记录</b><small></small></span><span class="ilg-fold-row-chev" aria-hidden="true"></span>';
    row.querySelector('small').textContent = homeOn ? '最近和谁聊过，点一下接着聊' : '回到首页，看看最近的聊天';
    row.addEventListener('click', () => { closeFoldMenu(); showRecent(); });
    const cap = document.createElement('div');
    cap.className = 'ilg-fold-cap';
    cap.setAttribute('role', 'presentation');
    cap.textContent = '设置';
    foldMenu.append(row, cap);
    for (const d of foldedDrawers()) {
        const toggle = d.querySelector(':scope > .drawer-toggle');
        const icon = toggle?.querySelector('.drawer-icon');
        if (!icon || getComputedStyle(d).display === 'none') continue;
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'ilg-fold-tile';
        tile.setAttribute('role', 'menuitem');
        const glyph = document.createElement('span');
        glyph.className = 'ilg-fold-glyph';
        glyph.setAttribute('aria-hidden', 'true');
        const mask = getComputedStyle(icon).getPropertyValue('--ilg-icon').trim();
        if (S.icons && mask) glyph.style.setProperty('--ilg-icon', mask);
        else glyph.classList.add('ilg-fa', ...[...icon.classList].filter(c => c.startsWith('fa')));
        const label = document.createElement('span');
        label.className = 'ilg-fold-label';
        label.textContent = FOLD_LABELS[d.id] || icon.title || d.id;
        tile.append(glyph, label);
        tile.classList.toggle('ilg-alert', icon.classList.contains('redOverlayGlow'));
        tile.classList.toggle('ilg-on', !!d.querySelector(':scope > .drawer-content.openDrawer'));
        tile.addEventListener('click', () => {
            closeFoldMenu();
            toggle.click();
        });
        foldMenu.appendChild(tile);
    }
}
function openFoldMenu(viaKeyboard) {
    buildFoldTiles();
    const r = foldIcon.getBoundingClientRect();
    foldMenu.style.top = `${r.bottom + 12}px`;
    foldMenu.hidden = false;
    const w = foldMenu.offsetWidth;
    foldMenu.style.left = `${Math.max(8, Math.min(r.left - 6, innerWidth - w - 8))}px`;
    syncFold();
    if (viaKeyboard) foldMenu.querySelector('button')?.focus();
}
function closeFoldMenu(refocus) {
    if (foldMenu.hidden) return;
    foldMenu.hidden = true;
    syncFold();
    if (refocus) foldIcon.focus();
}
function onFoldPress(viaKeyboard) {
    const open = openFolded();
    if (open) { closeFoldMenu(); open.querySelector(':scope > .drawer-toggle').click(); return; }
    if (foldMenu.hidden) openFoldMenu(viaKeyboard); else closeFoldMenu();
}
foldIcon.addEventListener('click', () => onFoldPress(false));
foldIcon.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFoldPress(true); }
});
foldMenu.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeFoldMenu(true); return; }
    // 第 0 个是整行的“聊天记录”，后面是四列宫格：从第一行宫格往上回到它，从它往下进第一个图标
    const tiles = [...foldMenu.querySelectorAll('button')];
    const i = tiles.indexOf(document.activeElement);
    if (i < 0) return;
    let j = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i === 0 ? 1 : i + 4, ArrowUp: i <= 4 ? 0 : i - 4 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    tiles[Math.max(0, Math.min(tiles.length - 1, j))].focus();
});

// 从菜单打开的抽屉（二级页面）：顶上加一条吸顶的标题栏，左边“‹ 菜单”回到菜单，中间是名字，右边 × 关掉
const sheetHeads = new WeakMap();
function sheetHead(d) {
    const panel = d.querySelector(':scope > .drawer-content');
    if (!panel) return;
    let head = sheetHeads.get(panel);
    if (!head) {
        head = document.createElement('div');
        head.className = 'ilg-sheet-head';
        head.innerHTML = '<button type="button" class="ilg-sheet-back"><span aria-hidden="true"></span>菜单</button><h2 class="ilg-sheet-title"></h2>' +
            '<button type="button" class="ilg-sheet-close" title="关闭" aria-label="关闭"></button>';
        const toggle = () => d.querySelector(':scope > .drawer-toggle')?.click();
        head.querySelector('.ilg-sheet-back').addEventListener('click', () => { toggle(); setTimeout(() => openFoldMenu(true), 0); });
        head.querySelector('.ilg-sheet-close').addEventListener('click', toggle);
        sheetHeads.set(panel, head);
    }
    // 只在变了的时候写：改 textContent 也算子节点变化，会再触发顶栏的 MutationObserver，形成死循环
    const title = head.querySelector('.ilg-sheet-title'), label = FOLD_LABELS[d.id] || '';
    if (title.textContent !== label) title.textContent = label;
    if (panel.firstElementChild !== head) panel.prepend(head);
}
function syncSheetHeads() {
    const on = S.enabled && S.fold;
    for (const d of holder.querySelectorAll(':scope > .drawer')) {
        const panel = d.querySelector(':scope > .drawer-content');
        const head = panel && sheetHeads.get(panel);
        if (on && d.classList.contains('ilg-folded')) sheetHead(d);
        else head?.remove();
    }
}
// 点菜单外面就收起
document.addEventListener('pointerdown', e => {
    if (!foldMenu.hidden && !foldMenu.contains(e.target) && !foldBtn.contains(e.target)) closeFoldMenu();
}, true);
// 抽屉开关、API 连接状态变化时同步菜单键；扩展往顶栏里加了新图标时重新分组
new MutationObserver(muts => {
    if (!S.enabled || !S.fold) return;
    if (muts.some(m => m.type === 'childList')) { applyFold(); requestAnimationFrame(layoutIslands); return; }
    if (muts.some(m => !foldBtn.contains(m.target))) syncFold();
}).observe(holder, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
window.addEventListener('resize', () => closeFoldMenu());

// 滚动边缘渐隐：顶栏、输入框后面各垫一层渐变的模糊 + 暗色，文字滚到图标下面之前先淡出，不会和图标叠在一起
const sheld = document.getElementById('sheld');
for (const pos of ['top', 'bottom']) {
    const s = document.createElement('div');
    s.className = `ilg-scrim ilg-scrim-${pos}`;
    s.setAttribute('aria-hidden', 'true');
    sheld.insertBefore(s, document.getElementById('form_sheld'));
}

// 白 / 黑切换：顶栏右边一个太阳 / 月亮键，一键换成瓷白或墨黑壁纸（gen-wallpapers.mjs 生成）。
// 换壁纸走酒馆自己的背景缩略图点击，所以“锁定到本聊天”的背景规则照旧；明暗模式在“自动”下会按新壁纸自己切
const TONE_WALLS = { light: 'liquid glass porcelain.png', dark: 'liquid glass ink.png' };
const toneBtn = document.createElement('div');
toneBtn.id = 'ilg-tone-button';
toneBtn.className = 'ilg-tone-holder';
toneBtn.innerHTML = '<div class="drawer-icon ilg-tone-icon" role="button" tabindex="0"></div>';
const toneIcon = toneBtn.firstChild;
function syncToneBtn() {
    toneBtn.classList.toggle('ilg-is-light', lightBg);
    const label = lightBg ? '切换到墨黑壁纸' : '切换到瓷白壁纸';
    toneIcon.title = label;
    toneIcon.setAttribute('aria-label', label);
}
function applyToneBtn() {
    if (!S.enabled || !S.toneBtn) { toneBtn.remove(); return; }
    const before = document.getElementById('persona-management-button');
    if (toneBtn.nextElementSibling !== before) holder.insertBefore(toneBtn, before);
    syncToneBtn();
}
const wallThumb = tone => [...document.querySelectorAll('#bg_menu_content .bg_example, .bg_example')]
    .find(n => n.getAttribute('bgfile') === TONE_WALLS[tone]);
function switchTone() {
    const target = lightBg ? 'dark' : 'light';
    const thumb = wallThumb(target);
    if (!thumb) { toastr.warning(`没找到壁纸“${TONE_WALLS[target]}”，刷新一下酒馆再试。`); return; }
    thumb.click();
    // 按时间 / 跟随系统时，手动点一下只算“临时换一下”，到下一个白天 / 黑夜交界再自动接管；手动指定了浅 / 深时跟着改设置
    if (S.tone === 'time' || S.tone === 'system') toneOverride = { tone: target, base: wantTone() };
    else if (S.tone !== 'auto') { S.tone = target; ctx.saveSettingsDebounced(); applyTone(); }
}
toneIcon.addEventListener('click', switchTone);
toneIcon.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchTone(); } });

// 快捷回复折叠：输入框左边一个按钮，点开后快捷回复按钮浮在输入胶囊上方的一块玻璃里，点了某个按钮就收起
const qrBar = () => document.getElementById('qr--bar');
const qrToggle = document.createElement('div');
qrToggle.id = 'ilg-qr-toggle';
qrToggle.className = 'interactable';
qrToggle.setAttribute('role', 'button');
qrToggle.setAttribute('tabindex', '0');
qrToggle.setAttribute('title', '快捷回复');
qrToggle.setAttribute('aria-label', '快捷回复');
qrToggle.setAttribute('aria-expanded', 'false');
function applyQrFold() {
    const on = S.enabled && S.qrFold;
    root.classList.toggle('ilg-qrfold', on);
    if (!on) { setQrOpen(false); qrToggle.remove(); return; }
    const left = document.getElementById('leftSendForm');
    if (left && qrToggle.parentElement !== left) left.appendChild(qrToggle);
}
function setQrOpen(open) {
    const bar = qrBar();
    open = open && !!bar;
    if (root.classList.contains('ilg-qr-open') === open) return;
    root.classList.toggle('ilg-qr-open', open);
    qrToggle.setAttribute('aria-expanded', String(open));
    if (!bar) return;
    if (open) track(bar, 'panel'); else untrack(bar);
}
qrToggle.addEventListener('click', () => setQrOpen(!root.classList.contains('ilg-qr-open')));
qrToggle.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setQrOpen(!root.classList.contains('ilg-qr-open')); }
    if (e.key === 'Escape') setQrOpen(false);
});
// 点了某个快捷回复（不是它旁边的小箭头）就收起；点外面也收起
document.getElementById('form_sheld').addEventListener('click', e => {
    if (!root.classList.contains('ilg-qr-open')) return;
    const b = e.target.closest?.('.qr--button');
    if (b && !e.target.closest('.qr--button-expander')) setTimeout(() => setQrOpen(false), 0);
});
document.addEventListener('pointerdown', e => {
    if (!root.classList.contains('ilg-qr-open')) return;
    if (qrBar()?.contains(e.target) || qrToggle.contains(e.target) || e.target.closest?.('.ctx-menu, .list-group')) return;
    setQrOpen(false);
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') setQrOpen(false); });

// 首页（还没打开任何聊天时）：把酒馆的欢迎面板、助手消息藏起来，正中间只留一颗玻璃水滴和一句按手机时间变化的问候。
// 只藏欢迎页那几条（打上 .ilg-home-hide），用户在首页直接发消息后马上退出首页模式，不会把真正的聊天藏掉
const GREETINGS = [
    [5, '早上好', '新的一天，从哪个故事开始？'],
    [11, '中午好', '歇一会儿，听个故事吧。'],
    [14, '下午好', '故事还在原地等你。'],
    [18, '晚上好', '今晚，想走进谁的故事？'],
    [23, '夜深了', '夜还长，故事也是。'],
];
function greetingNow() {
    const h = new Date().getHours();
    let g = GREETINGS[GREETINGS.length - 1];
    for (const x of GREETINGS) if (h >= x[0]) g = x;
    return h < 5 ? GREETINGS[GREETINGS.length - 1] : g;
}
// logo 是透明底的银河图（st-verify/logo-crop.mjs 裁成 512 方图），深色壁纸原样显示，浅色壁纸 CSS 反相
root.style.setProperty('--ilg-logo', `url("${new URL('./logo.png', import.meta.url).href}")`);
const home = document.createElement('div');
home.id = 'ilg-home';
home.innerHTML = '<div class="ilg-home-logo" role="img" aria-label="NVWA"></div><h1 class="ilg-home-title" aria-live="polite"></h1><p class="ilg-home-sub"></p>' +
    '<button type="button" class="ilg-home-recent" aria-haspopup="dialog" aria-expanded="false"><span class="ilg-home-recent-icon" aria-hidden="true"></span><span>聊天记录</span></button>';
const recentBtn = home.querySelector('.ilg-home-recent');
document.getElementById('sheld').insertBefore(home, document.getElementById('form_sheld'));
function paintGreeting() {
    const [, hello, sub] = greetingNow();
    const name = (S.homeName || '').trim();
    home.querySelector('.ilg-home-title').textContent = name ? `${hello}，${name}` : hello;
    home.querySelector('.ilg-home-sub').textContent = sub;
}
let homeOn = false, homeDismissed = false, homeTimer = 0;
const onWelcome = () => {
    const chat = document.getElementById('chat');
    return ctx.getCurrentChatId() === undefined && !!chat?.querySelector(':scope > .welcomePanel');
};
function setHome(on) {
    const chat = document.getElementById('chat');
    if (on === homeOn) return;
    homeOn = on;
    root.classList.toggle('ilg-home', on);
    clearInterval(homeTimer);
    if (on) {
        for (const n of chat.children) n.classList.add('ilg-home-hide');
        paintGreeting();
        homeTimer = setInterval(paintGreeting, 60000);
        if (wantRecent) { wantRecent = false; requestAnimationFrame(() => setRecent(true)); }
    } else {
        setRecent(false);
        chat.querySelectorAll(':scope > .ilg-home-hide').forEach(n => n.classList.remove('ilg-home-hide'));
    }
}
function syncHome() { setHome(S.enabled && S.home && !homeDismissed && onWelcome()); }
new MutationObserver(muts => {
    if (!S.enabled || !S.home) return;
    for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        // 重新回到欢迎页：允许再次进入首页模式
        if (n.classList.contains('welcomePanel')) homeDismissed = false;
        // 在首页直接发了消息（临时聊天）：退出首页模式，后面的消息正常显示
        else if (homeOn && n.matches('.mes[is_user="true"]')) { homeDismissed = true; setHome(false); return; }
        if (homeOn) n.classList.add('ilg-home-hide');
    }
    // 置顶、改名、删除后酒馆会重画整个欢迎面板：聊天记录开着的话，给新面板补上标题栏和玻璃
    if (recentOn) {
        const panel = welcomePanel();
        if (panel && panel !== recentPanel) { untrack(recentPanel); mountRecent(panel); }
    }
    syncHome();
}).observe(document.getElementById('chat'), { childList: true });

// 聊天记录：首页的醒目按钮 / 菜单第一行点开。直接把酒馆欢迎面板里的“最近聊天”列表当成一块浮起来的玻璃卡片显示，
// 打开、置顶、改名、删除、显示更多都还是酒馆自己的按钮和逻辑，这里只负责摆位置、加标题栏
let recentOn = false, recentPanel = null, wantRecent = false;
const welcomePanel = () => document.querySelector('#chat > .welcomePanel');
const recentHead = document.createElement('div');
recentHead.className = 'ilg-recent-head';
recentHead.innerHTML = '<h2 class="ilg-recent-title" id="ilg-recent-title">聊天记录</h2>' +
    '<button type="button" class="ilg-recent-close" title="关闭" aria-label="关闭聊天记录"></button>';
recentHead.querySelector('.ilg-recent-close').addEventListener('click', () => setRecent(false, true));
function mountRecent(panel) {
    recentPanel = panel;
    panel.classList.add('ilg-recent');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'ilg-recent-title');
    if (recentHead.parentElement !== panel) panel.prepend(recentHead);
    track(panel, 'panel');
}
function setRecent(on, refocus) {
    const panel = welcomePanel();
    on = on && homeOn && !!panel;
    if (on === recentOn) return;
    recentOn = on;
    root.classList.toggle('ilg-recent-open', on);
    recentBtn.setAttribute('aria-expanded', String(on));
    if (on) {
        closeFoldMenu();
        mountRecent(panel);
        panel.scrollTop = 0;
        (panel.querySelector('.recentChat:not(.hidden)') || recentHead.querySelector('button')).focus({ preventScroll: true });
    } else if (recentPanel) {
        untrack(recentPanel);
        recentPanel.classList.remove('ilg-recent');
        recentPanel.removeAttribute('role');
        recentHead.remove();
        recentPanel = null;
        if (refocus && homeOn) recentBtn.focus();
    }
}
// 在聊天里点“聊天记录”：先关掉当前聊天（酒馆会自动保存，回到欢迎页），首页出现后自动展开列表
function showRecent() {
    if (homeOn) { setRecent(!recentOn); return; }
    const close = document.getElementById('option_close_chat');
    if (!close || !S.home) { document.getElementById('option_select_chat')?.click(); return; }
    homeDismissed = false;
    wantRecent = true;
    close.click();
    setTimeout(() => { wantRecent = false; }, 5000);
}
recentBtn.addEventListener('click', () => setRecent(!recentOn));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && recentOn) setRecent(false, true); });
// 点卡片外面收起（弹窗、右键菜单、顶栏里的操作不算）
document.addEventListener('pointerdown', e => {
    if (!recentOn || recentPanel?.contains(e.target) || recentBtn.contains(e.target)) return;
    if (e.target.closest?.('.popup, dialog, #top-settings-holder, #ilg-fold-menu, .ctx-menu, #toast-container')) return;
    setRecent(false);
}, true);

new ResizeObserver(() => requestAnimationFrame(layoutIslands)).observe(holder);
window.addEventListener('resize', () => requestAnimationFrame(layoutIslands));

// 明暗判定：浅色壁纸配白字会看不清，所以按壁纸平均亮度切换
let lightBg = false;
function sampleLuminance(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = 32; c.height = 32;
                const g = c.getContext('2d', { willReadFrequently: true });
                g.drawImage(img, 0, 0, 32, 32);
                const d = g.getImageData(0, 0, 32, 32).data;
                let sum = 0;
                for (let i = 0; i < d.length; i += 4) sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
                resolve(sum / (d.length / 4));
            } catch { resolve(0); }
        };
        img.onerror = () => resolve(0);
        img.src = url;
    });
}
function wallpaperUrl() {
    for (const id of ['bg_custom', 'bg1']) {
        const el = document.getElementById(id);
        // 先读行内样式：酒馆给壁纸切换加了 0.375s 渐变，渐变期间 computed 值还是旧图
        const m = el && /url\(["']?(.*?)["']?\)/.exec(el.style.backgroundImage || getComputedStyle(el).backgroundImage || '');
        if (m) return m[1];
    }
    return '';
}
// 自动明暗：默认“按时间”（白天 dayStart–dayEnd 点用瓷白，其余用墨黑），也可以“跟随系统”。
// 只在当前壁纸本来就是瓷白 / 墨黑这两张之一时才替你换壁纸；用的是自己的壁纸，或者本聊天锁定了背景（点缩略图会改写聊天里存的背景），就不碰，明暗照旧按壁纸亮度判断
const sysDark = matchMedia('(prefers-color-scheme: dark)');
let toneOverride = null; // 手动临时换过：{ tone, base }，base 是当时的自动结果，自动结果一变就作废
function wantTone() {
    if (S.tone === 'system') return sysDark.matches ? 'dark' : 'light';
    if (S.tone === 'time') {
        const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
        return h >= S.dayStart && h < S.dayEnd ? 'light' : 'dark';
    }
    return null;
}
function onToneWall() {
    let name = wallpaperUrl().split('/').pop() || '';
    try { name = decodeURIComponent(name); } catch { /* 文件名里有怪字符就按原样比 */ }
    return Object.values(TONE_WALLS).includes(name);
}
// 酒馆每次换聊天都会换一个新的 chat_metadata 对象，开头缓存的 ctx 里那份是旧的，所以每次现取
const chatBgLocked = () => !!SillyTavern.getContext().chatMetadata?.custom_background;
function followTone() {
    const want = wantTone();
    if (!want || !S.enabled) { toneOverride = null; return; }
    if (toneOverride) {
        if (toneOverride.base === want) return;
        toneOverride = null;
    }
    if ((lightBg ? 'light' : 'dark') === want || !onToneWall() || chatBgLocked()) return;
    wallThumb(want)?.click();
}
async function applyTone() {
    if (S.tone === 'light' || S.tone === 'dark') {
        lightBg = S.tone === 'light';
    } else {
        const url = wallpaperUrl();
        lightBg = url ? (await sampleLuminance(url)) > 0.6 : false;
    }
    root.classList.toggle('ilg-light', S.enabled && lightBg);
    syncToneBtn();
    root.style.setProperty('--ilg-tint', `rgba(255, 255, 255, ${lightBg ? Math.min(0.7, S.tint + 0.3) : S.tint})`);
    const st = document.getElementById('ilg-status');
    if (st) st.textContent = statusText();
    scheduleAdapt();
    followTone();
}
setInterval(followTone, 60000);
sysDark.addEventListener('change', followTone);

function applyRoot() {
    root.classList.toggle('ilg', S.enabled);
    root.classList.toggle('ilg-float', S.enabled && S.float);
    root.classList.toggle('ilg-icons', S.enabled && S.icons);
    root.classList.toggle('ilg-font', S.enabled && S.font);
    root.classList.toggle('ilg-islands', S.enabled && S.islands);
    root.classList.toggle('ilg-avline', S.enabled && S.avatar === 'line');
    root.classList.toggle('ilg-orb-on', S.enabled && S.orb);
    applyTone();
    root.style.setProperty('--ilg-hl', S.highlight);
    root.style.setProperty('--ilg-radius', `${S.radius}px`);
    root.style.setProperty('--ilg-shadow-k', S.pShadow);
    root.style.setProperty('--ilg-sheen-k', S.pSheen);
    root.style.setProperty('--ilg-mes-a', S.mesTint);
    root.style.setProperty('--ilg-scrim-a', S.scrim);
    applyToneBtn();
    applyFold();
    applyQrFold();
    syncHome();
    queueThink();
    if (!S.enabled) { clearAll(); removeIslands(); return; }
    scan();
    if (S.fold && !items.has(foldMenu)) track(foldMenu, 'panel');
    // 开关切换时 clearAll 会把这两块玻璃也摘掉，补回来
    if (root.classList.contains('ilg-qr-open') && qrBar()) track(qrBar(), 'panel');
    if (recentOn && recentPanel && !items.has(recentPanel)) track(recentPanel, 'panel');
    if (S.islands) {
        const topBar = document.getElementById('top-bar');
        untrack(topBar);
        topBar.classList.remove('ilg-over-light', 'ilg-over-dark');
        layoutIslands();
    } else {
        removeIslands();
    }
    requestAnimationFrame(repaintAll);
}

// 输入框高度变化（多行、快捷回复栏）时同步聊天区底部留白，并保持贴底
const form = document.getElementById('form_sheld');
const chatEl = document.getElementById('chat');
new ResizeObserver(() => {
    const atBottom = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight < 40;
    root.style.setProperty('--ilg-form-h', `${form.offsetHeight}px`);
    if (atBottom) chatEl.scrollTop = chatEl.scrollHeight;
}).observe(form);

// 新消息、删除消息、切换聊天
// 切换聊天后 1.5 秒内不加入场动画：酒馆是一条条插入消息的，那段时间插进来的都是旧消息
let riseQuietUntil = performance.now() + 4000;
new MutationObserver(muts => {
    if (!S.enabled) return;
    const bubble = document.body.classList.contains('bubblechat');
    const added = [];
    for (const m of muts) {
        m.removedNodes.forEach(n => n.nodeType === 1 && (items.has(n) ? untrack(n) : n.querySelectorAll?.('.ilg-glass').forEach(untrack)));
        if (bubble) m.addedNodes.forEach(n => n.nodeType === 1 && n.matches(MES_SEL) && added.push(n));
    }
    added.forEach(n => track(n, 'mes'));
    if (added.length > 0 && added.length <= 2 && performance.now() > riseQuietUntil) {
        added.forEach(n => {
            n.classList.add('ilg-rise');
            n.addEventListener('animationend', () => n.classList.remove('ilg-rise'), { once: true });
        });
    }
}).observe(chatEl, { childList: true });

// 弹窗是动态插入 body 的；body 的 class 变化代表切换了气泡模式 / 关闭模糊
new MutationObserver(muts => {
    if (!S.enabled) return;
    let rescan = false;
    for (const m of muts) {
        if (m.type === 'attributes') rescan = true;
        m.addedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            if (n.matches?.(PANEL_SEL)) track(n, 'panel');
            if (n.id === 'toast-container') watchToasts(n);
        });
        m.removedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            untrack(n);
            n.querySelectorAll?.('.ilg-glass').forEach(untrack);
        });
    }
    if (rescan) { scan(); repaintAll(); }
}).observe(document.body, { childList: true, attributes: true, attributeFilter: ['class'] });
function fmt(step, unit, v) {
    return (step < 1 ? Number(v).toFixed(step < 0.1 ? 2 : 1) : v) + unit;
}

function statusText() {
    if (!S.enabled) return '美化已关闭。';
    if (document.body.classList.contains('no-blur')) return '你开了酒馆的“关闭模糊”，所以玻璃和折射都暂停了。';
    if (!canFull) return '当前浏览器不支持边缘折射（只有 Chrome / Edge 支持），现在显示的是模糊 + 高光版本。';
    const how = { time: '，按时间自动', system: '，跟随系统' }[S.tone] || '';
    const tone = `${S.engine === 'physical' ? '新版物理折射' : '旧版折射'} · ${lightBg ? '浅色' : '深色'}模式${how}`;
    if (!S.refract) return `边缘折射已关闭，现在只有模糊（${lightBg ? '浅色' : '深色'}模式）。`;
    if (!document.body.classList.contains('bubblechat')) return `折射已开启（${tone}）。消息卡片玻璃只在“气泡”聊天样式下生效。`;
    return `完整折射已开启（${tone}）。`;
}

function buildPanel() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) return;
    const wrap = document.createElement('div');
    wrap.className = 'ilg-settings';
    wrap.innerHTML = `
<div class="inline-drawer">
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>NVWA 液态玻璃</b>
    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
  </div>
  <div class="inline-drawer-content">
    <div class="ilg-status" id="ilg-status" role="status"></div>
    ${TOGGLES.map(([k, label]) => `<label class="checkbox_label" for="ilg-opt-${k}"><input type="checkbox" id="ilg-opt-${k}"><span>${label}</span></label>`).join('')}
    <div class="ilg-row"><label for="ilg-opt-homeName"><span>首页问候里的称呼</span></label>
      <input type="text" id="ilg-opt-homeName" class="text_pole" maxlength="20" placeholder="留空就只显示“晚上好”"></div>
    <div class="ilg-row"><label for="ilg-opt-tone"><span>明暗</span></label>
      <select id="ilg-opt-tone" class="text_pole">
        <option value="time">按时间（白天瓷白，晚上墨黑）</option>
        <option value="system">跟随系统深浅色</option>
        <option value="auto">按壁纸亮度（不自动换壁纸）</option>
        <option value="light">一直浅色（深色文字）</option>
        <option value="dark">一直深色（白色文字）</option>
      </select></div>
    <div class="ilg-row" data-tone="time"><label for="ilg-opt-dayStart"><span>白天时段</span></label>
      <span class="ilg-hours"><input type="number" id="ilg-opt-dayStart" class="text_pole" min="0" max="23" step="1" aria-label="白天从几点开始"> 点到
      <input type="number" id="ilg-opt-dayEnd" class="text_pole" min="1" max="24" step="1" aria-label="白天到几点结束"> 点</span></div>
    <div class="ilg-row"><label for="ilg-opt-avatar"><span>聊天头像</span></label>
      <select id="ilg-opt-avatar" class="text_pole">
        <option value="line">名片式：小头像放进名字那一行，正文占满气泡</option>
        <option value="side">经典：头像在左边单独一列</option>
      </select></div>
    <div class="ilg-row"><label for="ilg-opt-engine"><span>折射引擎</span></label>
      <select id="ilg-opt-engine" class="text_pole">
        <option value="physical">新版：物理折射 + 动态高光（实验）</option>
        <option value="legacy">旧版：之前一直用的这套</option>
      </select></div>
    <hr>
    <div data-engine="physical">
      <div class="ilg-sub">一键预设（从清到重，点完再用下面的滑块细调）</div>
      <div class="ilg-presets">${Object.entries(PRESETS).map(([k, [label]]) => `<button type="button" class="menu_button" data-preset="${k}" aria-pressed="false">${label}</button>`).join('')}</div>
      <div class="ilg-row"><label for="ilg-opt-profile"><span>边缘截面</span></label>
        <select id="ilg-opt-profile" class="text_pole">
          <option value="lens">放大镜（边缘只放大，不扭曲）</option>
          <option value="squircle">超椭圆（苹果式，边上陡、里面平）</option>
          <option value="circle">正圆弧（最强的边缘弯折）</option>
          <option value="soft">缓坡（弯折更宽更柔）</option>
        </select></div>
      <label class="checkbox_label" for="ilg-opt-follow"><input type="checkbox" id="ilg-opt-follow"><span>高光跟随鼠标</span></label>
    </div>
    ${SLIDERS.map(([k, label, min, max, step, , engine, prof]) => `<div class="ilg-row"${engine ? ` data-engine="${engine}"` : ''}${prof ? ` data-profile="${prof}"` : ''}><label for="ilg-opt-${k}"><span>${label}</span><output id="ilg-opt-${k}-v"></output></label><input type="range" id="ilg-opt-${k}" min="${min}" max="${max}" step="${step}"></div>`).join('')}
    <div class="ilg-hint">参数自动保存。新旧两套引擎的参数分开存，切回旧版就是原来的样子。关掉“启用液态玻璃美化”会立即恢复酒馆原样。</div>
    <div class="menu_button" id="ilg-reset" role="button" tabindex="0">恢复默认参数</div>
  </div>
</div>`;
    host.appendChild(wrap);

    // 当前数值正好等于某一档预设时，那个按钮显示为按下
    const markPresets = () => wrap.querySelectorAll('[data-preset]').forEach(b => {
        const p = PRESETS[b.dataset.preset][1];
        b.setAttribute('aria-pressed', String(Object.keys(p).every(k => S[k] === p[k] || Math.abs(S[k] - p[k]) < 1e-6)));
    });
    const sync = () => {
        TOGGLES.forEach(([k]) => { document.getElementById(`ilg-opt-${k}`).checked = !!S[k]; });
        SLIDERS.forEach(([k, , , , step, unit]) => {
            document.getElementById(`ilg-opt-${k}`).value = S[k];
            document.getElementById(`ilg-opt-${k}-v`).textContent = fmt(step, unit, S[k]);
        });
        document.getElementById('ilg-opt-tone').value = S.tone;
        document.getElementById('ilg-opt-dayStart').value = S.dayStart;
        document.getElementById('ilg-opt-dayEnd').value = S.dayEnd;
        wrap.querySelectorAll('[data-tone]').forEach(n => { n.hidden = n.dataset.tone !== S.tone; });
        document.getElementById('ilg-opt-engine').value = S.engine;
        document.getElementById('ilg-opt-avatar').value = S.avatar;
        document.getElementById('ilg-opt-profile').value = S.profile;
        document.getElementById('ilg-opt-follow').checked = !!S.follow;
        document.getElementById('ilg-opt-homeName').value = S.homeName || '';
        wrap.querySelectorAll('[data-engine]').forEach(n => { n.hidden = n.dataset.engine !== S.engine; });
        // 放大镜截面不用厚度、折射率；物理折射截面不用放大倍数
        wrap.querySelectorAll('[data-profile]').forEach(n => {
            if (n.dataset.profile !== (S.profile === 'lens' ? 'lens' : 'snell')) n.hidden = true;
        });
        markPresets();
        document.getElementById('ilg-status').textContent = statusText();
    };
    document.getElementById('ilg-opt-tone').addEventListener('change', e => {
        S.tone = e.target.value;
        toneOverride = null;
        wrap.querySelectorAll('[data-tone]').forEach(n => { n.hidden = n.dataset.tone !== S.tone; });
        applyTone(); ctx.saveSettingsDebounced();
    });
    ['dayStart', 'dayEnd'].forEach(k => document.getElementById(`ilg-opt-${k}`).addEventListener('change', e => {
        const v = Math.round(Number(e.target.value));
        if (!Number.isFinite(v) || e.target.value === '') { e.target.value = S[k]; return; }
        S[k] = k === 'dayStart' ? Math.min(23, Math.max(0, v)) : Math.min(24, Math.max(1, v));
        // 开始不能晚于结束，否则整天都算晚上
        if (S.dayStart >= S.dayEnd) {
            if (k === 'dayStart') S.dayEnd = S.dayStart + 1; else S.dayStart = S.dayEnd - 1;
        }
        document.getElementById('ilg-opt-dayStart').value = S.dayStart;
        document.getElementById('ilg-opt-dayEnd').value = S.dayEnd;
        toneOverride = null;
        followTone(); ctx.saveSettingsDebounced();
    }));
    document.getElementById('ilg-opt-avatar').addEventListener('change', e => {
        S.avatar = e.target.value;
        applyRoot(); ctx.saveSettingsDebounced();
    });
    document.getElementById('ilg-opt-engine').addEventListener('change', e => {
        S.engine = e.target.value;
        clearAll(); applyRoot(); sync(); ctx.saveSettingsDebounced();
    });
    document.getElementById('ilg-opt-profile').addEventListener('change', e => {
        S.profile = e.target.value;
        applyRoot(); sync(); ctx.saveSettingsDebounced();
    });
    document.getElementById('ilg-opt-homeName').addEventListener('input', e => {
        S.homeName = e.target.value;
        paintGreeting(); ctx.saveSettingsDebounced();
    });
    document.getElementById('ilg-opt-follow').addEventListener('change', e => {
        S.follow = e.target.checked;
        applyRoot(); ctx.saveSettingsDebounced();
    });
    wrap.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
        Object.assign(S, PRESETS[b.dataset.preset][1]);
        applyRoot(); sync(); ctx.saveSettingsDebounced();
    }));
    TOGGLES.forEach(([k]) => document.getElementById(`ilg-opt-${k}`).addEventListener('change', e => {
        S[k] = e.target.checked;
        if (!S.enabled || k === 'enabled' || k === 'refract' || k === 'refractMes' || k === 'islands' || k === 'fold') clearAll();
        applyRoot(); sync(); ctx.saveSettingsDebounced();
    }));
    SLIDERS.forEach(([k, , , , step, unit]) => document.getElementById(`ilg-opt-${k}`).addEventListener('input', e => {
        S[k] = parseFloat(e.target.value);
        document.getElementById(`ilg-opt-${k}-v`).textContent = fmt(step, unit, S[k]);
        applyRoot(); markPresets(); ctx.saveSettingsDebounced();
    }));
    const reset = () => { Object.assign(S, DEFAULTS); clearAll(); applyRoot(); sync(); ctx.saveSettingsDebounced(); };
    const btn = document.getElementById('ilg-reset');
    btn.addEventListener('click', reset);
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reset(); } });
    sync();
}

// 顶栏/输入框自适应：采样它们下面滚过的内容，浅色内容滚上来时加深玻璃，白色图标不至于看不见（类似 iOS 26 的自适应玻璃）
function surfaceLuminance(el) {
    const view = el.ownerDocument.defaultView;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        if (n === document.body || n.id === 'chat' || n.id === 'sheld') return null;
        const m = /rgba?\(([^)]+)\)/.exec(view.getComputedStyle(n).backgroundColor);
        if (!m) continue;
        const [r, g, b, a = 1] = m[1].split(',').map(Number);
        if (a < 0.5) continue;
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    return null;
}
function lumAt(x, y, bar) {
    for (const el of document.elementsFromPoint(x, y)) {
        if (bar.contains(el) || el.closest('#top-bar, #top-settings-holder, #form_sheld')) continue;
        if (el.tagName === 'IFRAME') {
            try {
                const r = el.getBoundingClientRect();
                const inner = el.contentDocument?.elementFromPoint(x - r.left, y - r.top);
                if (inner) return surfaceLuminance(inner);
            } catch { /* 跨域 iframe 读不到，跳过 */ }
            return null;
        }
        return surfaceLuminance(el);
    }
    return null;
}
function adaptBar(bar) {
    if (!bar || bar.hidden) return false;
    const r = bar.getBoundingClientRect();
    const ys = [r.top + r.height * 0.35, r.top + r.height * 0.7];
    let sum = 0, n = 0;
    for (const f of [0.15, 0.38, 0.62, 0.85]) for (const y of ys) {
        const l = lumAt(r.left + r.width * f, y, bar);
        if (l !== null) { sum += l; n++; }
    }
    const avg = n ? sum / n : null;
    bar.classList.toggle('ilg-over-light', !lightBg && avg !== null && avg > 0.62);
    bar.classList.toggle('ilg-over-dark', lightBg && avg !== null && avg < 0.38);
    return bar.classList.contains('ilg-over-light');
}
let adaptRaf = 0;
function scheduleAdapt() {
    if (adaptRaf || !S.enabled) return;
    adaptRaf = requestAnimationFrame(() => {
        adaptRaf = 0;
        if (S.islands && islands.length) {
            // 每座岛各自判断；岛下面是浅色内容时，它那几个图标加深阴影
            islands.forEach(isl => {
                const over = adaptBar(isl);
                (isl.icons || []).forEach(d => d.classList.toggle('ilg-icon-over-light', over));
            });
        } else {
            adaptBar(document.getElementById('top-bar'));
        }
        adaptBar(document.querySelector(PILL_SEL));
    });
}
chatEl.addEventListener('scroll', scheduleAdapt, { passive: true });
// 滚动时消息卡片相对鼠标的位置变了，高光方向跟着变
chatEl.addEventListener('scroll', scheduleLights, { passive: true });
new MutationObserver(scheduleAdapt).observe(chatEl, { childList: true, subtree: true });
window.addEventListener('resize', scheduleAdapt);

// 右上角提示：toastr 弹出时才创建容器、最后一条消失就删掉，所以盯着容器给每条提示挂上玻璃
const toastWatched = new WeakSet();
function watchToasts(box) {
    if (toastWatched.has(box)) return;
    toastWatched.add(box);
    const glass = n => { if (S.enabled && n.nodeType === 1 && n.classList.contains('toast')) track(n, 'toast'); };
    box.querySelectorAll(':scope > .toast').forEach(glass);
    new MutationObserver(muts => muts.forEach(m => {
        m.addedNodes.forEach(glass);
        m.removedNodes.forEach(n => n.nodeType === 1 && untrack(n));
    })).observe(box, { childList: true });
}
const existingToasts = document.getElementById('toast-container');
if (existingToasts) watchToasts(existingToasts);

const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = new URL('./fonts/fonts.css', import.meta.url).href;
document.head.appendChild(fontLink);

const iconLink = document.createElement('link');
iconLink.rel = 'stylesheet';
iconLink.href = new URL('./icons.css', import.meta.url).href;
document.head.appendChild(iconLink);

// 滑块左边那段蓝色：CSS 读不到滑块当前值，所以把进度写进 --ilg-fill（按 20px 圆钮的中心算，蓝条正好止于圆钮下面）
function paintRange(el) {
    const min = Number(el.min || 0), max = Number(el.max || 100), v = Number(el.value);
    const p = max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 0;
    const fill = `calc(${p.toFixed(4)} * (100% - 20px) + 10px)`;
    if (el.style.getPropertyValue('--ilg-fill') !== fill) el.style.setProperty('--ilg-fill', fill);
}
const paintRanges = () => document.querySelectorAll('input[type="range"]').forEach(paintRange);
['input', 'change'].forEach(t => document.addEventListener(t, e => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'range') paintRange(e.target);
}, true));
// 酒馆读预设时是直接改 value（不发 input 事件），所以打开抽屉、切预设之后再统一刷一遍
document.addEventListener('click', e => { if (e.target.closest?.('.drawer-toggle, .inline-drawer-toggle')) requestAnimationFrame(paintRanges); }, true);
['APP_READY', 'SETTINGS_LOADED', 'OAI_PRESET_CHANGED_AFTER', 'PRESET_CHANGED'].forEach(t => {
    if (ctx.eventTypes[t]) ctx.eventSource.on(ctx.eventTypes[t], () => setTimeout(paintRanges, 50));
});

// 思考小球：三种“模型在想”的时刻都换成一颗转动的点阵球
// 1. 推理模型在吐思维链：消息带 data-reasoning-state="thinking"，球塞进酒馆自己的“思考中……”标题里，点开照样能看思维链
// 2. 流式回复还没出第一个字：酒馆先插一条正文是“...”的空消息，把那串点换成“思考中 · 3s”的胶囊
// 3. 其余时候（拼提示词、等服务器回第一个包、非流式整段回来）聊天里还没有占位消息，胶囊浮在输入框上方；开头等 0.9 秒，秒回的就不闪了
const thinkPill = () => {
    const p = document.createElement('div');
    p.className = 'ilg-think';
    p.setAttribute('role', 'status');
    p.append(makeOrb(), Object.assign(document.createElement('span'), { className: 'ilg-think-label', textContent: '思考中' }),
        Object.assign(document.createElement('span'), { className: 'ilg-think-t' }));
    return p;
};
// sawReply：这次生成里已经出现过占位 / 思维链 / 正文，之后就算短暂对不上（流刚结束、酒馆还没收尾）也不再弹浮动胶囊
let genSince = 0, sawReply = false, floatPill = null, thinkTimer = 0, thinkQueued = false;
const dotsOnly = m => !(m.querySelector('.mes_text')?.textContent || '').replace(/[.…]/g, '').trim();
const genOn = () => S.enabled && S.orb && document.body.dataset.generating === 'true';
function syncThink() {
    thinkQueued = false;
    const on = S.enabled && S.orb, gen = genOn();
    // 1. 思维链标题
    // 只看正在想的和已经挂了球的，长聊天里不用把每条消息都翻一遍
    chatEl.querySelectorAll('.mes[data-reasoning-state="thinking"] .mes_reasoning_header, .mes_reasoning_header:has(> .ilg-orb)').forEach(head => {
        const want = on && head.closest('.mes').dataset.reasoningState === 'thinking';
        const orb = head.querySelector(':scope > .ilg-orb');
        if (want && !orb) head.prepend(makeOrb());
        else if (!want && orb) orb.remove();
    });
    // 2. 流式占位消息
    const last = chatEl.querySelector('.mes.last_mes') || [...chatEl.querySelectorAll('.mes')].pop();
    // 思维链被模型藏起来（内容为空）时酒馆不显示那个标题，球也就看不见，这种也当占位处理
    const shownThinking = m => m.dataset.reasoningState === 'thinking' && !!m.querySelector('.mes_reasoning')?.textContent.trim();
    const placeholder = gen && last && last.getAttribute('is_user') !== 'true' && !shownThinking(last)
        && dotsOnly(last) ? last : null;
    chatEl.querySelectorAll('.mes.ilg-await').forEach(m => { if (m !== placeholder) { m.classList.remove('ilg-await'); m.querySelector(':scope .ilg-think')?.remove(); } });
    if (placeholder && !placeholder.querySelector('.ilg-think')) {
        placeholder.classList.add('ilg-await');
        placeholder.querySelector('.mes_text')?.before(thinkPill());
    }
    // 思维链在流的时候正文还是那串“...”，藏掉
    chatEl.querySelectorAll('.mes.ilg-dots').forEach(m => { if (!(gen && shownThinking(m) && dotsOnly(m))) m.classList.remove('ilg-dots'); });
    if (gen && last && shownThinking(last) && dotsOnly(last)) last.classList.add('ilg-dots');
    // 3. 聊天里既没占位也没在显示思维链，并且字还没开始往消息里流（续写时没有占位，字直接接在上一条后面）
    const sp = SillyTavern.getContext().streamingProcessor;
    const busy = placeholder || [...chatEl.querySelectorAll('.mes[data-reasoning-state="thinking"]')].some(shownThinking) || (sp && sp.messageId >= 0);
    if (busy) sawReply = true;
    const wantFloat = gen && !busy && !sawReply && performance.now() - genSince > 900;
    if (wantFloat && !floatPill) {
        floatPill = thinkPill();
        floatPill.id = 'ilg-think-float';
        form.append(floatPill);
    } else if (!wantFloat && floatPill) {
        floatPill.remove();
        floatPill = null;
    }
    tickThink();
}
// 胶囊里的秒数从这次生成开始算
function tickThink() {
    const pills = document.querySelectorAll('.ilg-think-t');
    const s = Math.floor((performance.now() - genSince) / 1000);
    pills.forEach(t => { const v = genOn() && s >= 1 ? `${s}s` : ''; if (t.textContent !== v) t.textContent = v; });
    clearTimeout(thinkTimer);
    if (genOn()) thinkTimer = setTimeout(() => { syncThink(); }, 1000 - ((performance.now() - genSince) % 1000) + 20);
}
// 用函数声明：applyRoot（开关切换时）也要调它
function queueThink() { if (!thinkQueued) { thinkQueued = true; requestAnimationFrame(syncThink); } }
new MutationObserver(() => {
    if (genOn() && !genSince) genSince = performance.now();
    if (!genOn()) { genSince = 0; sawReply = false; }
    queueThink();
}).observe(document.body, { attributes: true, attributeFilter: ['data-generating'] });
new MutationObserver(muts => {
    // 自己插胶囊 / 小球引起的变化不用再处理，不然会自己触发自己
    const own = n => n.nodeType === 1 && n.matches('.ilg-think, .ilg-orb');
    if (muts.every(m => m.target.closest?.('.ilg-think') || (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].every(own)))) return;
    queueThink();
}).observe(chatEl, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-reasoning-state'] });

buildPanel();
applyRoot();
paintRanges();
ctx.eventSource.on(ctx.eventTypes.APP_READY, applyRoot);

// 别人第一次装上时背景库里没有瓷白 / 墨黑两张壁纸，按时间切换和太阳 / 月亮键就找不到图；从扩展自带的 walls/ 里补传一次（已经有同名的就不动）
async function ensureWalls() {
    if (S.wallsReady) return;
    try {
        const headers = ctx.getRequestHeaders();
        const res = await fetch('/api/backgrounds/all', { method: 'POST', headers, body: '{}' });
        if (!res.ok) return;
        const have = new Set(((await res.json()).images || []).map(x => x.filename));
        const missing = Object.values(TONE_WALLS).filter(f => !have.has(f));
        for (const file of missing) {
            const img = await fetch(new URL(`./walls/${encodeURIComponent(file)}`, import.meta.url));
            if (!img.ok) return;
            const form = new FormData();
            form.append('avatar', new File([await img.blob()], file, { type: 'image/png' }));
            const up = await fetch('/api/backgrounds/upload', { method: 'POST', headers: ctx.getRequestHeaders({ omitContentType: true }), body: form });
            if (!up.ok) return;
        }
        if (missing.length) {
            (await import('/scripts/backgrounds.js')).getBackgrounds?.();
            toastr.info('已把瓷白、墨黑两张壁纸放进背景库。选其中一张当壁纸，就会按时间自动换深浅色。', 'NVWA 液态玻璃');
        }
        S.wallsReady = true;
        ctx.saveSettingsDebounced();
    } catch (e) { console.warn('[NVWA 液态玻璃] 补传壁纸失败', e); }
}
ctx.eventSource.on(ctx.eventTypes.APP_READY, () => setTimeout(ensureWalls, 1500));
ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, () => {
    riseQuietUntil = performance.now() + 1500;
    requestAnimationFrame(applyRoot);
});
window.addEventListener('resize', () => requestAnimationFrame(repaintAll));
['bg1', 'bg_custom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(() => S.enabled && applyTone()).observe(el, { attributes: true, attributeFilter: ['style'] });
});
