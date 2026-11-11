// 手机视口协调：一处监听窗口尺寸变化，分发给各模块；键盘弹出时只补“浏览器没让出来”的那部分高度；
// 阅读位置在布局变化（转屏、键盘、输入框变高、图片加载）前后保持在同一条消息上。
//
// 与宿主的分工（改这里前先看）：
// - 酒馆的 <meta viewport> 写了 interactive-widget=resizes-content。支持它的安卓 Chrome / WebView 里，
//   键盘弹出会直接缩小布局视口，100dvh 跟着变小，我们什么都不用补；此时 keyboardInset() 恒为 0。
// - iOS Safari / 旧 WebView 不缩布局视口，只缩 visualViewport，输入框会被键盘盖住。只有这种情况才写
//   --ilg-kb（键盘挡住的高度），CSS 把输入区往上抬这么多。不用 innerHeight 差值猜键盘：双指缩放、
//   地址栏收起也会改 innerHeight。只认 visualViewport 底边离布局视口底边的距离，且缩放比例为 1 时才算。
// - 自动滚到底由酒馆的 scrollLock 决定（用户往上翻就锁住）。这里不替它滚到底，只在“用户本来不在底部”时
//   把视线钉在原来那条消息上，避免两套逻辑同时改 scrollTop。

const handlers = new Set();
let raf = 0, lastW = 0, lastH = 0;

/** 窗口尺寸变化（含转屏、键盘、visualViewport 变化）合并到下一帧，一次性通知所有订阅者。 */
export function onViewportChange(fn) { handlers.add(fn); return () => handlers.delete(fn); }

function flush() {
    raf = 0;
    const w = innerWidth, h = innerHeight;
    const info = { width: w, height: h, widthChanged: w !== lastW, heightChanged: h !== lastH };
    lastW = w; lastH = h;
    for (const fn of handlers) { try { fn(info); } catch (e) { console.error('[NVWA 液态玻璃] viewport handler', e); } }
}
function schedule() { if (!raf) raf = requestAnimationFrame(flush); }

addEventListener('resize', schedule, { passive: true });
addEventListener('orientationchange', schedule, { passive: true });
const vv = window.visualViewport;
if (vv) vv.addEventListener('resize', schedule, { passive: true });

/** 键盘挡住布局视口底部的像素数；浏览器已经自己缩了布局视口（resizes-content）时返回 0。 */
export function keyboardInset() {
    if (!vv) return 0;
    // 双指放大时 visualViewport 也会变小，那不是键盘
    if (Math.abs(vv.scale - 1) > 0.01) return 0;
    const hidden = innerHeight - (vv.height + vv.offsetTop);
    // 小于 80px 的差多半是地址栏/工具栏动画，不当键盘
    return hidden > 80 ? Math.round(hidden) : 0;
}

/**
 * 键盘协调：写 --ilg-kb 与 html.ilg-kb-open。enabled() 为 false 时清掉。
 * 输入框是否聚焦也要算进去：iOS 关掉键盘后 visualViewport 有时晚一帧才恢复。
 */
export function createKeyboard({ root, enabled, input }) {
    let last = -1;
    const apply = () => {
        const focused = document.activeElement === input();
        const kb = enabled() && focused ? keyboardInset() : 0;
        if (kb === last) return;
        last = kb;
        root.style.setProperty('--ilg-kb', kb + 'px');
        root.classList.toggle('ilg-kb-open', kb > 0);
    };
    onViewportChange(apply);
    if (vv) vv.addEventListener('scroll', () => requestAnimationFrame(apply), { passive: true });
    document.addEventListener('focusin', () => requestAnimationFrame(apply));
    document.addEventListener('focusout', () => setTimeout(apply, 60));
    return { refresh: apply, clear: () => { last = -1; root.style.removeProperty('--ilg-kb'); root.classList.remove('ilg-kb-open'); } };
}

/**
 * 阅读锚点：用户不在底部时，记住视口顶部那条消息和它离顶部的距离；
 * 聊天区尺寸变了（转屏、键盘、输入框长高、上方图片加载完）就把那条消息放回原位。
 * 在底部时什么都不做，交给酒馆的自动滚动。
 */
export function createReadingAnchor({ chat, enabled }) {
    let anchor = null, restoring = false, lastH = chat.clientHeight, lastSH = chat.scrollHeight;
    const atBottom = () => chat.scrollHeight - chat.scrollTop - chat.clientHeight < 8;
    const capture = () => {
        if (restoring || !enabled() || atBottom()) { anchor = null; return; }
        const top = chat.getBoundingClientRect().top;
        const pad = parseFloat(getComputedStyle(chat).paddingTop) || 0;
        // 从中间往上找，比从头遍历快：只看可见范围附近
        const list = chat.children;
        let lo = 0, hi = list.length - 1, pick = null;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1, el = list[mid];
            const r = el.getBoundingClientRect();
            if (r.bottom <= top + pad) lo = mid + 1;
            else { pick = el; hi = mid - 1; }
        }
        if (!pick || !pick.classList?.contains('mes')) { anchor = null; return; }
        anchor = { el: pick, offset: pick.getBoundingClientRect().top - top };
    };
    const restore = () => {
        if (!anchor || !enabled() || !anchor.el.isConnected) return;
        const top = chat.getBoundingClientRect().top;
        const drift = anchor.el.getBoundingClientRect().top - top - anchor.offset;
        if (Math.abs(drift) < 1) return;
        restoring = true;
        chat.scrollTop += drift;
        requestAnimationFrame(() => { restoring = false; });
    };
    let captureQueued = false, settleUntil = 0;
    chat.addEventListener('scroll', () => {
        // 尺寸刚变过的这一小段时间里，scroll 事件来自酒馆自己的“保持底边不动”补偿，不是用户在翻，不能重记锚点
        if (restoring || captureQueued || performance.now() < settleUntil) return;
        captureQueued = true;
        requestAnimationFrame(() => { captureQueued = false; capture(); });
    }, { passive: true });
    // 聊天区本身变高/变矮（键盘、转屏、输入框）或内容在锚点上方变高（图片加载）都要复位。
    // 酒馆（RossAscends-mods.js）有自己的 ResizeObserver：不在底部时按高度差改 scrollTop，让“底边”不动。
    // 那样顶部正在读的那条会被推走，所以等它改完（下一帧）再按锚点放回原位，最终以“顶部那条不动”为准。
    const ro = new ResizeObserver(() => {
        const h = chat.clientHeight, sh = chat.scrollHeight;
        if (h === lastH && sh === lastSH) return;
        lastH = h; lastSH = sh;
        if (!anchor) return;
        settleUntil = performance.now() + 250;
        requestAnimationFrame(restore);
    });
    ro.observe(chat);
    // 图片加载完会改变上方高度但不触发 chat 的 ResizeObserver（它只看自己的盒子）
    chat.addEventListener('load', e => { if (e.target?.tagName === 'IMG') restore(); }, true);
    onViewportChange(() => { if (anchor) { settleUntil = performance.now() + 250; requestAnimationFrame(restore); } });
    return { capture, restore, get anchor() { return anchor; } };
}
