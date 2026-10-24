// 浅色模式检查：强制 ilg-light，依次打开几个面板截图 + 量控件对比度：node light.mjs [宽] [高] [前缀]
import { open } from './lib.mjs';
const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 844), tag = process.argv[4] || 'light';
const b = await open(W, H, 9342);
const force = `(() => { const r = document.documentElement; r.classList.add('ilg-light');
  r.style.setProperty('--ilg-tint', 'rgba(255,255,255,0.35)'); return r.classList.contains('ilg-light'); })()`;
const out = { wasLight: await b.ev(`document.documentElement.classList.contains('ilg-light')`), forced: await b.ev(force) };
await b.sleep(600);
await b.shot(`${tag}-chat`);
// 量一下几个控件的实际颜色
const probe = `(() => { const q = s => document.querySelector(s); const c = (el, ...p) => el ? Object.fromEntries(p.map(k => [k, getComputedStyle(el)[k]])) : null;
  return {
    pole: c(q('#openai_max_tokens, #amount_gen, .text_pole'), 'backgroundColor', 'color', 'borderColor'),
    range: c(q('#temp_openai, input[type=range]'), 'backgroundColor', 'backgroundImage', 'filter'),
    check: c(q('#stream_toggle, input[type=checkbox]'), 'backgroundColor', 'borderColor'),
    btn: c(q('#ai-config-button ~ * .menu_button, .drawer-content .menu_button'), 'backgroundColor', 'color', 'borderColor', 'filter'),
    panel: c(q('#left-nav-panel'), 'backgroundColor', 'color'),
  }; })()`;
for (const [n, sel] of [['ai', '#ai-config-button .drawer-toggle'], ['user', '#user-settings-button .drawer-toggle'], ['ext', '#extensions-settings-button .drawer-toggle'], ['char', '#rightNavHolder .drawer-toggle']]) {
    await b.ev(`document.querySelector('${sel}')?.click()`);
    await b.sleep(1000);
    await b.ev(force);
    await b.sleep(300);
    await b.shot(`${tag}-${n}`);
    if (n === 'ai') {
        out.probe = await b.ev(probe);
        await b.ev(`(() => { const p = document.querySelector('#left-nav-panel .scrollableInner, #left-nav-panel'); p.scrollTop = 900; })()`);
        await b.sleep(300);
        await b.shot(`${tag}-ai2`);
    }
    await b.ev(`document.querySelector('${sel}')?.click()`);
    await b.sleep(700);
}
out.logs = b.logs;
console.log(JSON.stringify(out, null, 1));
b.close(); process.exit(0);
