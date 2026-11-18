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

import { externalScrollControl } from './chat-compat.js';

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
    let last=-1,pending=0,blurTimer=0,destroyed=false;
    const apply=()=>{
        if(destroyed)return;
        if(pending){cancelAnimationFrame(pending);pending=0;}
        const focused=document.activeElement===input();
        const kb=enabled()&&focused?keyboardInset():0;
        if(kb===last)return;
        last=kb;root.style.setProperty('--ilg-kb',kb+'px');root.classList.toggle('ilg-kb-open',kb>0);
    };
    const schedule=()=>{if(!destroyed&&!pending)pending=requestAnimationFrame(()=>{pending=0;apply();});};
    const focusIn=()=>{clearTimeout(blurTimer);blurTimer=0;schedule();};
    const focusOut=()=>{clearTimeout(blurTimer);blurTimer=setTimeout(()=>{blurTimer=0;schedule();},60);};
    const unsubscribe=onViewportChange(apply);
    vv?.addEventListener('scroll',schedule,{passive:true});
    document.addEventListener('focusin',focusIn);document.addEventListener('focusout',focusOut);
    const clear=()=>{if(pending)cancelAnimationFrame(pending);pending=0;clearTimeout(blurTimer);blurTimer=0;last=-1;root.style.removeProperty('--ilg-kb');root.classList.remove('ilg-kb-open');};
    return{refresh:apply,clear,status:()=>({inset:Math.max(0,last),pending:!!pending}),destroy(){destroyed=true;unsubscribe();vv?.removeEventListener('scroll',schedule);document.removeEventListener('focusin',focusIn);document.removeEventListener('focusout',focusOut);clear();}};
}

/**
 * 阅读锚点：用户不在底部时，记住视口顶部那条消息和它离顶部的距离；
 * 聊天区尺寸变了（转屏、键盘、输入框长高、上方图片加载完）就把那条消息放回原位。
 * 在底部时什么都不做，交给酒馆的自动滚动。
 */
export function createReadingAnchor({ chat, enabled }) {
    const active = () => enabled() && !externalScrollControl(chat);
    let anchor = null, restoring = false, destroyed = false;
    let lastH = chat.clientHeight, lastSH = chat.scrollHeight;
    let captureFrame = 0, captureTimer = 0, restoreFrame = 0, releaseFrame = 0, settleUntil = 0, inputUntil = 0;
    let restores = 0, yielded = 0, lastRestoreDelta = 0;
    const atBottom = () => chat.scrollHeight - chat.scrollTop - chat.clientHeight < 8;
    const cancelRestore = () => { if (restoreFrame) cancelAnimationFrame(restoreFrame); restoreFrame = 0; };
    const capture = () => {
        if (destroyed || !active() || atBottom()) { anchor = null; return; }
        if (restoring) return;
        const top = chat.getBoundingClientRect().top;
        const pad = parseFloat(getComputedStyle(chat).paddingTop) || 0;
        const list = chat.children;
        let lo = 0, hi = list.length - 1, pick = null;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1, el = list[mid];
            if (el.getBoundingClientRect().bottom <= top + pad) lo = mid + 1;
            else { pick = el; hi = mid - 1; }
        }
        if (!pick || !pick.classList?.contains('mes')) { anchor = null; return; }
        anchor = { el: pick, offset: pick.getBoundingClientRect().top - top };
    };
    const restore = () => {
        if (destroyed || !active()) { anchor = null; return; }
        if (!anchor || !anchor.el.isConnected) return;
        // Manual movement owns the reading position, including momentum after a touch.
        if (performance.now() < inputUntil || captureFrame) { yielded++; return; }
        const top = chat.getBoundingClientRect().top;
        const drift = anchor.el.getBoundingClientRect().top - top - anchor.offset;
        if (Math.abs(drift) < 1) return;
        restoring = true; restores++; lastRestoreDelta = drift;
        chat.scrollTop += drift;
        if (releaseFrame) cancelAnimationFrame(releaseFrame);
        releaseFrame = requestAnimationFrame(() => { releaseFrame = 0; restoring = false; });
    };
    const queueRestore = () => {
        if (destroyed || !active()) { anchor = null; return; }
        if (!anchor || performance.now() < inputUntil) return;
        settleUntil = performance.now() + 250;
        if (!restoreFrame) restoreFrame = requestAnimationFrame(() => { restoreFrame = 0; restore(); });
    };
    const onIntent = event => {
        if (event.type === 'keydown' && (!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)
            || event.target?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]'))) return;
        inputUntil = performance.now() + 350;
        anchor = null; settleUntil = 0; restoring = false;
        cancelRestore();
        if (releaseFrame) cancelAnimationFrame(releaseFrame); releaseFrame = 0;
        if (captureFrame) cancelAnimationFrame(captureFrame); captureFrame = 0;
        if (captureTimer) clearTimeout(captureTimer); captureTimer = 0;
    };
    const onScroll = () => {
        if (!active()) { anchor = null; return; }
        if (destroyed || restoring || captureFrame) return;
        if (performance.now() < settleUntil && performance.now() >= inputUntil) return;
        // Geometry reads during momentum can force the whole chat to lay out.
        // Record one reading point after the final gesture frame instead.
        if (performance.now() < inputUntil) {
            inputUntil = performance.now() + 350;
            if (captureTimer) clearTimeout(captureTimer);
            captureTimer = setTimeout(() => { captureTimer = 0; capture(); }, 350);
            return;
        }
        captureFrame = requestAnimationFrame(() => { captureFrame = 0; capture(); });
    };
    const onResize = () => {
        if (!active()) { anchor = null; return; }
        const h = chat.clientHeight, sh = chat.scrollHeight;
        if (h === lastH && sh === lastSH) return;
        lastH = h; lastSH = sh; queueRestore();
    };
    const onLoad = event => { if (event.target?.tagName === 'IMG') queueRestore(); };
    const intentEvents = ['touchstart','touchmove','pointerdown','wheel','keydown'];
    for (const type of intentEvents) chat.addEventListener(type, onIntent, { passive: true, capture: true });
    chat.addEventListener('scroll', onScroll, { passive: true });
    chat.addEventListener('load', onLoad, true);
    const ro = new ResizeObserver(onResize); ro.observe(chat);
    let external = externalScrollControl(chat);
    const ownerObserver = new MutationObserver(() => {
        const next = externalScrollControl(chat);
        if (next === external) return;
        external = next; anchor = null; settleUntil = 0;
        cancelRestore();
        if (captureFrame) cancelAnimationFrame(captureFrame);
        if (captureTimer) clearTimeout(captureTimer);
        captureFrame = captureTimer = 0;
        if (!next) captureFrame = requestAnimationFrame(() => { captureFrame = 0; capture(); });
    });
    ownerObserver.observe(chat, { attributes: true, attributeFilter: ['class'] });
    const unsubscribe = onViewportChange(queueRestore);
    return {
        capture, restore, get anchor() { return anchor; },
        status: () => ({ owner: externalScrollControl(chat) ? 'baibai' : 'nvwa', pendingRestore: !!restoreFrame, pendingCapture: !!(captureFrame || captureTimer), userScrolling: performance.now() < inputUntil, restores, yielded, lastRestoreDelta }),
        destroy() {
            destroyed = true; anchor = null; cancelRestore();
            if (captureFrame) cancelAnimationFrame(captureFrame);
            if (releaseFrame) cancelAnimationFrame(releaseFrame);
            if (captureTimer) clearTimeout(captureTimer);
            captureFrame = captureTimer = releaseFrame = 0; ro.disconnect(); ownerObserver.disconnect(); unsubscribe();
            for (const type of intentEvents) chat.removeEventListener(type, onIntent, true);
            chat.removeEventListener('scroll', onScroll); chat.removeEventListener('load', onLoad, true);
        },
    };
}
