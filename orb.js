// 点阵小球：斐波那契球面上均匀撒点，绕竖轴自转、带一点俯角；离你越近的点越大越亮，远的点淡下去，看起来就是一颗在转的点云球
// 所有小球共用一个 requestAnimationFrame 循环，不在页面上（被删掉 / 隐藏）的不画；颜色取画布自身的 color，跟着深浅色走

const N = 96;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const PTS = Array.from({ length: N }, (_, i) => {
    const y = 1 - (i + 0.5) * 2 / N;
    const r = Math.sqrt(1 - y * y);
    return [Math.cos(i * GOLDEN) * r, y, Math.sin(i * GOLDEN) * r];
});

const live = new Set();
let raf = 0;
const still = () => document.body.classList.contains('reduced-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

function draw(c, t) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const size = c.clientWidth || 20;
    const px = Math.round(size * dpr);
    if (c.width !== px) { c.width = px; c.height = px; c._color = null; }
    // 换深浅色时 color 会变，隔一阵重新读一次就够了
    if (!c._color || (c._frame = (c._frame || 0) + 1) % 30 === 0) c._color = getComputedStyle(c).color;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    g.fillStyle = c._color;
    const a = t * 0.0011, tilt = 0.42 + Math.sin(t * 0.0004) * 0.12;
    const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(tilt), st = Math.sin(tilt);
    const R = size * 0.42, mid = size / 2, dot = Math.max(0.55, size / 26);
    for (const [x, y, z] of PTS) {
        const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
        const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
        const near = (z2 + 1) / 2; // 0 最远，1 最近
        g.globalAlpha = 0.14 + near * 0.86;
        g.beginPath();
        g.arc(mid + x1 * R, mid - y2 * R, dot * (0.45 + near * 0.75), 0, Math.PI * 2);
        g.fill();
    }
    g.globalAlpha = 1;
}

function loop(t) {
    raf = 0;
    for (const c of live) {
        if (!c.isConnected) { live.delete(c); continue; }
        if (c.offsetParent) draw(c, t);
    }
    if (live.size && !still()) raf = requestAnimationFrame(loop);
}

export function makeOrb() {
    const c = document.createElement('canvas');
    c.className = 'ilg-orb';
    c.setAttribute('aria-hidden', 'true');
    live.add(c);
    // 先等它挂进页面拿到尺寸再画第一帧；减少动态效果时只画这一帧，球停在一个角度
    requestAnimationFrame(t => { draw(c, t); if (!raf && !still()) raf = requestAnimationFrame(loop); });
    return c;
}
