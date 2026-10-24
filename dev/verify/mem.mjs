// 记忆窗口 / 预设面板 / 普通弹窗：截图 + 关闭按钮位置；body 直接子节点清单：node mem.mjs [宽] [高] [前缀]
import { open } from './lib.mjs';
const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 844), tag = process.argv[4] || 'mem';
const b = await open(W, H, 9351);
const out = {};
await b.ev(`document.querySelector('.ilg-home-recent')?.click()`); await b.sleep(600);
await b.ev(`document.querySelector('#chat > .welcomePanel .recentChat')?.click()`); await b.sleep(6000);
out.body = await b.ev(`[...document.body.children].map(n => n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''))`);
out.btns = await b.ev(`[...document.querySelectorAll('button, .qr--button, .menu_button')].filter(n => /记忆|预设面板/.test(n.textContent) && n.offsetParent).map(n => n.className + '|' + n.textContent.trim().slice(0, 10))`);
const closeProbe = `(() => { const d = [...document.querySelectorAll('dialog.popup[open]')].pop(); if (!d) return null; const r = el => el ? (x => [x.left, x.top, x.width, x.height].map(Math.round))(el.getBoundingClientRect()) : null;
  const c = d.querySelector('.ilg-popup-x'); return { dlg: r(d), close: r(c), closeDisp: c && getComputedStyle(c).display, closeHit: c && (() => { const x = c.getBoundingClientRect(); const h = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return h && (h.className || h.tagName); })(),
    first: r(d.querySelector('.popup-content > *')), bg: getComputedStyle(d).backgroundColor }; })()`;
for (const tone of ['dark', 'light']) {
    await b.ev(`document.documentElement.classList.toggle('ilg-light', ${tone === 'light'})`);
    await b.sleep(400);
    for (const name of ['记忆', '预设面板']) {
        await b.ev(`(() => { const n = [...document.querySelectorAll('.qr--button, button, .menu_button')].find(n => n.textContent.trim() === '${name}'); n?.click(); return !!n; })()`);
        await b.sleep(2500);
        out[`${tone}-${name}`] = await b.ev(closeProbe);
        await b.shot(`${tag}-${tone}-${name}`);
        // 只用取消 / Esc 关，不点保存
        await b.ev(`(() => { const d = [...document.querySelectorAll('dialog.popup[open]')].pop(); if (!d) return; const c = d.querySelector('.popup-button-cancel'); if (c && getComputedStyle(c).display !== 'none') c.click(); else d.querySelector('.popup-button-ok')?.click(); })()`);
        await b.sleep(900);
    }
    // 普通确认弹窗
    await b.ev(`void SillyTavern.getContext().callGenericPopup('这是一个测试确认框，看看右上角的关闭按钮。', SillyTavern.getContext().POPUP_TYPE.CONFIRM)`);
    await b.sleep(900);
    out[`${tone}-confirm`] = await b.ev(closeProbe);
    await b.shot(`${tag}-${tone}-confirm`);
    await b.ev(`document.querySelector('dialog.popup[open] .popup-button-cancel')?.click()`);
    await b.sleep(700);
}
out.logs = b.logs;
console.log(JSON.stringify(out, null, 1));
b.close(); process.exit(0);
