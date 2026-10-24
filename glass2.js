/* 液态玻璃 v2 物理引擎（从液态玻璃实验台 glass2.js 移植，去掉了实验台专用的水滴/放大镜/降级高光图）
   折射：按玻璃截面（边缘弧面 + 厚度 + 折射率）用斯涅尔定律算出每个像素该往哪偏，生成位移贴图
   高光：同一个弧面的法线生成法线贴图，滤镜里拿光源方向做点乘；换光源只改颜色矩阵，不用重画贴图 */

// 截面形状：x=0 是玻璃最外沿，x=1 进入中间平坦区；返回 [相对高度, 斜率]
const PROFILES = {
    squircle: x => { const a = 1 - x, b = 1 - a ** 4; return [b ** 0.25, a ** 3 * b ** -0.75]; },
    circle: x => { const a = 1 - x, b = 1 - a * a; return [Math.sqrt(b), a / Math.sqrt(b)]; },
    soft: x => { const a = 1 - x; return [1 - a * a, 2 * a]; },
};
const LUT_N = 256;
const luts = new Map();
/* 放大镜截面：不按物理折射算，直接规定“屏幕上离边缘 s 处取样离边缘 u(s) 处”。
   u 的斜率从边缘的 1/mag 平滑升到弧带内侧的 1（smoothstep），斜率始终在 0~1 之间：
   边缘处内容被放大 mag 倍，往里逐渐恢复原样，永远不会翻转或折叠，所以不会出现扭曲的镜像 */
function lensLut(bezel, mag) {
    const d = new Float32Array(LUT_N + 1), s = new Float32Array(LUT_N + 1), inv = 1 / Math.max(1, mag);
    for (let i = 0; i <= LUT_N; i++) {
        const t = i / LUT_N, G = 0.5 - (t ** 3 - t ** 4 / 2);
        const u = bezel - (bezel - t * bezel) * inv - (1 - inv) * bezel * G;
        d[i] = u - t * bezel;
        s[i] = (1 - t) ** 2;
    }
    return { d, s };
}
function lut(profile, bezel, thick, ior, mag) {
    const key = [profile, bezel, thick, ior, mag].join('|');
    if (luts.has(key)) return luts.get(key);
    if (profile === 'lens') {
        if (luts.size > 40) luts.clear();
        luts.set(key, lensLut(bezel, mag));
        return luts.get(key);
    }
    const f = PROFILES[profile] || PROFILES.squircle, eta = 1 / ior;
    const d = new Float32Array(LUT_N + 1), s = new Float32Array(LUT_N + 1);
    for (let i = 0; i <= LUT_N; i++) {
        const hs = f(Math.max(i / LUT_N, 0.002));
        const h = thick * hs[0], slope = thick / bezel * hs[1];
        // 表面法线向外倾；视线竖直往下，按斯涅尔定律折进玻璃
        const len = Math.hypot(slope, 1), nr = slope / len, nz = 1 / len;
        const a = eta * nz - Math.sqrt(1 - eta * eta * (1 - nz * nz));
        // 折射光走到玻璃底面时，往玻璃中心方向横移了多少像素
        d[i] = h * (a * nr) / (-eta + a * nz);
        s[i] = nr;
    }
    if (luts.size > 40) luts.clear();
    luts.set(key, { d, s });
    return luts.get(key);
}
// 圆角矩形的有向距离（内部为负）
function rrDist(ax, ay, hw, hh, r) {
    const qx = ax - hw + r, qy = ay - hh + r;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}

// 一个像素的取样偏移和法线：写进 out = [偏移x, 偏移y, 法线x×倾斜度, 法线y×倾斜度, 倾斜度]，返回偏移量大小
function sampler(w, h, r, bez, L) {
    const hw = w / 2, hh = h / 2, Rn = Math.max(r, bez);
    return (x, y, out) => {
        const px = x - hw, py = y - hh, ax = Math.abs(px), ay = Math.abs(py);
        const depth = -rrDist(ax, ay, hw, hh, r);
        out[0] = out[1] = out[2] = out[3] = out[4] = 0;
        if (!(depth > 0 && depth < bez)) return 0;
        // 法线按“半径不小于边缘宽度”的参考圆角来算，边缘比圆角宽时也不会在对角线上出现折痕
        const cx = ax - (hw - Rn), cy = ay - (hh - Rn);
        let nx, ny;
        if (cx > 0 && cy > 0) { const cl = Math.hypot(cx, cy); nx = cx / cl; ny = cy / cl; }
        else if (cx > cy) { nx = 1; ny = 0; } else { nx = 0; ny = 1; }
        if (px < 0) nx = -nx;
        if (py < 0) ny = -ny;
        const f = depth / bez * LUT_N, f0 = f | 0, fr = f - f0, f1 = Math.min(f0 + 1, LUT_N);
        const dd = L.d[f0] + (L.d[f1] - L.d[f0]) * fr, wv = L.s[f0] + (L.s[f1] - L.s[f0]) * fr;
        out[0] = -nx * dd; out[1] = -ny * dd; out[2] = nx * wv; out[3] = ny * wv; out[4] = wv;
        return Math.abs(dd);
    };
}
// 在元素坐标 (x0, y0) 起取一块 cw×ch 的贴图，每个贴图像素对应 sx×sy 个 CSS 像素
function raster(sample, x0, y0, cw, ch, sx, sy) {
    const buf = new Float32Array(cw * ch * 5), out = [0, 0, 0, 0, 0];
    let max = 0;
    for (let j = 0; j < ch; j++) {
        for (let i = 0; i < cw; i++) {
            const m = sample(x0 + (i + 0.5) * sx, y0 + (j + 0.5) * sy, out);
            if (m > max) max = m;
            buf.set(out, (j * cw + i) * 5);
        }
    }
    return { buf, cw, ch, max };
}
// 两张贴图：位移贴图（R/G=取样偏移）和法线贴图（R/G=朝外法线×倾斜度，B=倾斜度）
function encode({ buf, cw, ch }, maxO) {
    const dc = document.createElement('canvas'), nc = document.createElement('canvas');
    dc.width = nc.width = cw; dc.height = nc.height = ch;
    const dctx = dc.getContext('2d'), nctx = nc.getContext('2d');
    const di = dctx.createImageData(cw, ch), ni = nctx.createImageData(cw, ch), D = di.data, N = ni.data;
    for (let p = 0, n = cw * ch; p < n; p++) {
        const b4 = p * 4, b5 = p * 5;
        D[b4] = 128 + buf[b5] / maxO * 127; D[b4 + 1] = 128 + buf[b5 + 1] / maxO * 127; D[b4 + 2] = 128; D[b4 + 3] = 255;
        N[b4] = 128 + buf[b5 + 2] * 127; N[b4 + 1] = 128 + buf[b5 + 3] * 127; N[b4 + 2] = buf[b5 + 4] * 255; N[b4 + 3] = 255;
    }
    dctx.putImageData(di, 0, 0); nctx.putImageData(ni, 0, 0);
    return { d: dc.toDataURL('image/png'), n: nc.toDataURL('image/png') };
}
// feDisplacementMap 的偏移 = scale × (通道值 − 0.5)，所以 scale 取最大偏移 × 255/127
const scaleOf = maxO => maxO * 255 / 127;

// 小玻璃（短边放不下两个圆角）：整张贴图
function buildFull(w, h, r, bez, L, dpr) {
    const k = Math.min(dpr, Math.sqrt(200000 / (w * h)));
    const cw = Math.max(2, Math.round(w * k)), ch = Math.max(2, Math.round(h * k));
    const t = raster(sampler(w, h, r, bez, L), 0, 0, cw, ch, w / cw, h / ch), maxO = Math.max(t.max, 0.001);
    return { full: encode(t, maxO), scale: scaleOf(maxO), max: maxO };
}
/* 大玻璃：九宫格。中间是平的不用画；直边上的贴图沿着边方向不变，取 1 像素宽的条拉伸；只有四个角要整块算。
   所以贴图大小和玻璃尺寸无关：长消息卡片也是按屏幕分辨率画的，边缘高光不糊，流式输出变高时也不用重画 */
function buildTiles(r, bez, L, dpr) {
    const C = Math.ceil(Math.max(r, bez)), W = 2 * C + 4, mid = W / 2 - 0.5, n = Math.max(1, Math.round(C * dpr)), s = C / n;
    const f = sampler(W, W, r, bez, L);
    const parts = {
        t: raster(f, mid, 0, 1, n, 1, s), b: raster(f, mid, W - C, 1, n, 1, s),
        l: raster(f, 0, mid, n, 1, s, 1), r: raster(f, W - C, mid, n, 1, s, 1),
        tl: raster(f, 0, 0, n, n, s, s), tr: raster(f, W - C, 0, n, n, s, s),
        bl: raster(f, 0, W - C, n, n, s, s), br: raster(f, W - C, W - C, n, n, s, s),
    };
    const maxO = Math.max(0.001, ...Object.values(parts).map(p => p.max));
    const tiles = {};
    for (const [k, p] of Object.entries(parts)) tiles[k] = encode(p, maxO);
    return { tiles, C, scale: scaleOf(maxO), max: maxO };
}

const cache = new Map();
export function getMaps(w, h, r, o) {
    // 弧面最宽占短边的 30%（放大镜截面 40%），小玻璃中间留出平坦区；厚度同比缩小，边缘的“坡度”和大玻璃一致
    const lens = o.profile === 'lens';
    const bez = Math.max(2, Math.min(o.bezel, Math.min(w, h) * (lens ? 0.4 : 0.3))), thick = o.thickness * bez / o.bezel;
    const mag = lens ? o.magnify : 0;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const tiled = Math.min(w, h) >= 2 * Math.ceil(Math.max(r, bez)) + 4;
    const key = [tiled ? 'T' : `${w}x${h}`, Math.round(r), o.profile, bez, thick, o.ior, mag, dpr].join('|');
    let m = cache.get(key);
    if (!m) {
        const L = lut(o.profile, bez, thick, o.ior, mag);
        m = tiled ? buildTiles(Math.round(r), bez, L, dpr) : buildFull(w, h, r, bez, L, dpr);
        if (cache.size > 80) cache.clear();
        cache.set(key, m);
    }
    return m;
}
export function clearMaps() { cache.clear(); }

// 光源方向 → 颜色矩阵：输出白色，透明度 = 法线 · 光源方向（sign=-1 时取对面那条反光）。0=右，90=上，135=左上
export function lightRow(deg, sign) {
    const a = deg * Math.PI / 180, lx = Math.cos(a) * sign, ly = -Math.sin(a) * sign;
    return `0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 ${(2 * lx).toFixed(4)} ${(2 * ly).toFixed(4)} 0 0 ${(-(lx + ly)).toFixed(4)}`;
}
const num = v => (+v).toFixed(3).replace(/\.?0+$/, '');
const disp = (src, sc, res) => `<feDisplacementMap in="${src}" in2="dmap" scale="${num(sc)}" xChannelSelector="R" yChannelSelector="G" result="${res}"/>`;
const ONLY = { r: '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0', g: '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0', b: '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0' };
// 色散：红/绿/蓝三个通道偏移量略有不同，弯折处出现细彩边
const aberr = (src, sc, spread, res) => disp(src, sc * (1 + spread), 'ar') + disp(src, sc, 'ag') + disp(src, sc * (1 - spread), 'ab') +
    `<feColorMatrix in="ar" type="matrix" values="${ONLY.r}" result="cr"/>` +
    `<feColorMatrix in="ag" type="matrix" values="${ONLY.g}" result="cg"/>` +
    `<feColorMatrix in="ab" type="matrix" values="${ONLY.b}" result="cb"/>` +
    '<feComposite in="cr" in2="cg" operator="arithmetic" k2="1" k3="1" result="crg"/>' +
    `<feComposite in="crg" in2="cb" operator="arithmetic" k2="1" k3="1" result="${res}"/>`;
const gammaA = (res, src, amp, exp) => `<feComponentTransfer in="${src}" result="${res}"><feFuncA type="gamma" amplitude="${num(amp)}" exponent="${num(exp)}" offset="0"/></feComponentTransfer>`;
// 内部聚光的位置曲线：横轴是表面倾斜度（最外沿≈1，往里变 0），峰值在弧边往里一点的地方
const CAUSTIC_TABLE = '0 0.6 1 0.7 0.3 0';
// 带光源的颜色矩阵加 data-light，跟随鼠标时只改它们的 values
const lightNode = (res, angle, sign) => `<feColorMatrix in="nmap" type="matrix" data-light="${sign}" values="${lightRow(angle, sign)}" result="${res}"/>`;

/* 滤镜：磨砂 → 材质调色（饱和/亮度/对比）→ 折射（可选色散）→ 厚度阴影 → 高光层（迎光边、背光边、细亮边、边缘反光、内部聚光）
   滤镜区域比贴图高（消息流式输出时卡片会先变高），贴图外面垫中性色：不偏移、不发光 */
// 把贴图铺到元素上：整张直接拉满；九宫格先铺四条边（往角里多伸 1 像素，盖住拼缝），再铺四个角
function mapLayer(m, ch, w, h, neutral, res) {
    const img = (href, x, y, iw, ih, id) => `<feImage href="${href}" x="${x}" y="${y}" width="${iw}" height="${ih}" preserveAspectRatio="none" result="${id}"/>`;
    let html = `<feFlood flood-color="${neutral}" result="${res}0"/>`;
    if (m.full) return html + img(m.full[ch], 0, 0, w, h, `${res}i`) + `<feComposite in="${res}i" in2="${res}0" operator="over" result="${res}"/>`;
    const C = m.C, T = m.tiles, L = w - 2 * C + 2, H = h - 2 * C + 2;
    const parts = [
        [T.t, C - 1, 0, L, C], [T.b, C - 1, h - C, L, C], [T.l, 0, C - 1, C, H], [T.r, w - C, C - 1, C, H],
        [T.tl, 0, 0, C, C], [T.tr, w - C, 0, C, C], [T.bl, 0, h - C, C, C], [T.br, w - C, h - C, C, C],
    ];
    parts.forEach(([t, x, y, iw, ih], i) => { html += img(t[ch], x, y, iw, ih, `${res}${i + 1}`); });
    return html + `<feMerge result="${res}"><feMergeNode in="${res}0"/>${parts.map((_, i) => `<feMergeNode in="${res}${i + 1}"/>`).join('')}</feMerge>`;
}

export function physicalFilter(m, o, w, h, angle) {
    // 放大镜截面再乘折射强度时，超过 1/(1 − 1/放大倍数) 边缘就会折叠成镜像，所以封顶在它的 95%
    const k = o.profile === 'lens' ? Math.min(o.strength, 0.95 / (1 - 1 / Math.max(1.01, o.magnify))) : o.strength;
    const sc = m.scale * k, sp = o.specular, g = o.sharp;
    let out = 'refr', src = 'SourceGraphic';
    let html = mapLayer(m, 'd', w, h, 'rgb(128,128,128)', 'dmap') + mapLayer(m, 'n', w, h, 'rgb(128,128,0)', 'nmap') +
        // tb：白色，透明度 = 表面倾斜度。细亮边、边缘反光、内部聚光、厚度阴影都从它来
        '<feColorMatrix in="nmap" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 1 0 0" result="tb"/>';
    if (o.blur > 0) { html += `<feGaussianBlur in="SourceGraphic" stdDeviation="${num(o.blur)}" edgeMode="duplicate" result="pre"/>`; src = 'pre'; }
    if (o.saturate !== 1) { html += `<feColorMatrix in="${src}" type="saturate" values="${num(o.saturate)}" result="sat"/>`; src = 'sat'; }
    if (o.brightness !== 1 || o.contrast !== 1) {
        // 亮度 × 对比度合成一步：out = 亮度 × (对比 × (in − 0.5) + 0.5)
        const fn = `type="linear" slope="${num(o.brightness * o.contrast)}" intercept="${num(o.brightness * (0.5 - 0.5 * o.contrast))}"`;
        html += `<feComponentTransfer in="${src}" result="bri"><feFuncR ${fn}/><feFuncG ${fn}/><feFuncB ${fn}/></feComponentTransfer>`;
        src = 'bri';
    }
    html += o.aberration > 0 ? aberr(src, sc, o.aberration / 100, out) : disp(src, sc, out);
    if (o.edgeShade > 0) {
        // 厚度阴影：弧边越陡越暗，像厚玻璃边缘把四周的暗色折进来
        html += '<feComponentTransfer in="tb" result="shd"><feFuncR type="linear" slope="0"/><feFuncG type="linear" slope="0"/><feFuncB type="linear" slope="0"/>' +
            `<feFuncA type="gamma" amplitude="${num(o.edgeShade)}" exponent="2" offset="0"/></feComponentTransfer>` +
            `<feComposite in="shd" in2="${out}" operator="over" result="shaded"/>`;
        out = 'shaded';
    }
    const hl = [];
    if (sp > 0) {
        // 迎光边 + 对面一条弱反光 + 不分方向的细亮边
        // 细亮边在实验台是 0.22：酒馆的深色壁纸上它会变成一圈均匀的白描边，看着像 CSS border，所以压到 0.06 只留轮廓
        html += lightNode('l1', angle, 1) + gammaA('s1', 'l1', sp, g) +
            lightNode('l2', angle, -1) + gammaA('s2', 'l2', sp * 0.45, g) +
            gammaA('s3', 'tb', sp * 0.06, 10);
        hl.push('s1', 's2', 's3');
    }
    if (o.fresnel > 0) {
        // 边缘反光（菲涅尔效应）：整圈弧边微微发亮，不分光源方向
        html += gammaA('s4', 'tb', o.fresnel, 3);
        hl.push('s4');
    }
    if (o.caustic > 0) {
        // 内部聚光：光穿过弧边后汇聚到背光那一侧的里面，形成一道柔和的亮带
        html += lightNode('l4', angle, -1) +
            `<feComponentTransfer in="tb" result="cb"><feFuncA type="table" tableValues="${CAUSTIC_TABLE}"/></feComponentTransfer>` +
            `<feComposite in="l4" in2="cb" operator="arithmetic" k1="${num(o.caustic)}" result="s5"/>`;
        hl.push('s5');
    }
    if (hl.length) {
        let acc = hl[0];
        for (let i = 1; i < hl.length; i++) {
            html += `<feComposite in="${acc}" in2="${hl[i]}" operator="arithmetic" k2="1" k3="1" result="sum${i}"/>`;
            acc = `sum${i}`;
        }
        html += `<feBlend in="${acc}" in2="${out}" mode="screen"/>`;
    }
    return html;
}
