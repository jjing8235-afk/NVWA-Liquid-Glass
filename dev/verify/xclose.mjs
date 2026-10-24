// × 能不能关弹窗、返回什么；人物册这类挂在 body 上的浮窗是不是被标成 .ilg-foreign、字影透明；首页 logo：node xclose.mjs
import { open } from './lib.mjs';
const b = await open(390, 844, 9355);
const out = {};
// 首页 logo（深浅各一张）
for (const tone of ['dark', 'light']) {
    await b.ev(`document.documentElement.classList.toggle('ilg-light', ${tone === 'light'})`);
    await b.sleep(500);
    await b.shot(`home-${tone}`);
    out['logo_' + tone] = await b.ev(`(() => { const l = document.querySelector('.ilg-home-logo'); if (!l) return null; const s = getComputedStyle(l); const r = l.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), filter: s.filter, bg: s.backgroundImage.slice(-30) }; })()`);
}
await b.ev(`document.documentElement.classList.remove('ilg-light')`);
// × 关确认框：结果应是 null（取消）
out.confirm = await b.ev(`(async () => { const c = SillyTavern.getContext(); const p = c.callGenericPopup('测试', c.POPUP_TYPE.CONFIRM);
  await new Promise(r => setTimeout(r, 600)); const x = document.querySelector('dialog.popup[open] > .ilg-popup-x'); if (!x) return 'no x';
  x.click(); const res = await Promise.race([p, new Promise(r => setTimeout(() => r('timeout'), 2000))]);
  return { res, stillOpen: !!document.querySelector('dialog.popup[open]') }; })()`);
// 只有“确定”的文字弹窗
out.text = await b.ev(`(async () => { const c = SillyTavern.getContext(); const p = c.callGenericPopup('只有确定', c.POPUP_TYPE.TEXT);
  await new Promise(r => setTimeout(r, 600)); document.querySelector('dialog.popup[open] > .ilg-popup-x')?.click();
  const res = await Promise.race([p, new Promise(r => setTimeout(() => r('timeout'), 2000))]); return { res, stillOpen: !!document.querySelector('dialog.popup[open]') }; })()`);
// 仿人物册：直接挂 body 的浅色浮窗
await b.ev(`(() => { const d = document.createElement('div'); d.className = 'lgb-rouge'; d.innerHTML = '<section style="position:fixed;left:40px;top:200px;width:300px;padding:14px;background:#fdf9f1;color:#231d18;border-radius:10px;z-index:99999"><b style="color:#8a2629">沈秋棠</b><p>28岁 · 帅府财务管家</p></section>'; document.body.append(d); })()`);
await b.sleep(400);
out.foreign = await b.ev(`(() => { const d = document.querySelector('body > .lgb-rouge'); return { cls: d.className, shadow: getComputedStyle(d.querySelector('p')).textShadow, ownSheld: document.getElementById('sheld').classList.contains('ilg-foreign'), others: [...document.body.children].filter(n => n.classList.contains('ilg-foreign')).map(n => n.tagName + '#' + n.id + '.' + n.className) }; })()`);
await b.shot('foreign');
out.logs = b.logs;
console.log(JSON.stringify(out, null, 1));
b.close(); process.exit(0);
