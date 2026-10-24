// 自动明暗检查：看默认模式、改白天时段让“现在”变成晚上 / 白天，确认壁纸跟着换；量滑块蓝条；最后把时段改回原样：node tone.mjs [宽] [高]
import { open } from './lib.mjs';
const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 844);
const b = await open(W, H, 9345);
const state = `(() => { const S = SillyTavern.getContext().extensionSettings.iosLiquidGlass; const bg = document.getElementById('bg1').style.backgroundImage;
  return { tone: S.tone, v: S.v, day: [S.dayStart, S.dayEnd], light: document.documentElement.classList.contains('ilg-light'),
    wall: decodeURIComponent(bg.split('/').pop() || '').replace(/["')]+$/, ''), locked: !!SillyTavern.getContext().chatMetadata?.custom_background }; })()`;
const out = { start: await b.ev(state) };
const setDay = (a, z) => b.ev(`(() => { for (const [k, v] of [['dayEnd', ${z}], ['dayStart', ${a}]]) { const el = document.getElementById('ilg-opt-' + k); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
const h = new Date().getHours();
// 让现在落在“晚上”：白天时段放到现在之后
await setDay((h + 2) % 22, (h + 2) % 22 + 1);
await b.sleep(2500);
out.night = await b.ev(state);
// 让现在落在“白天”
await setDay(0, 24);
await b.sleep(2500);
out.day = await b.ev(state);
await setDay(out.start.day[0], out.start.day[1]);
await b.sleep(2500);
out.restored = await b.ev(state);
// 设置面板截图 + 滑块
await b.ev(`document.querySelector('#extensions-settings-button .drawer-toggle').click()`);
await b.sleep(900);
await b.ev(`(() => { const d = document.querySelector('.ilg-settings .inline-drawer-content'); if (d && getComputedStyle(d).display === 'none') document.querySelector('.ilg-settings .inline-drawer-toggle').click(); })()`);
await b.sleep(700);
await b.ev(`document.getElementById('ilg-opt-tone').scrollIntoView({ block: 'start' })`);
await b.sleep(300);
await b.shot('tone-panel');
out.ranges = await b.ev(`[...document.querySelectorAll('.ilg-settings input[type=range]')].slice(0, 3).map(r => ({ id: r.id, v: r.value, fill: r.style.getPropertyValue('--ilg-fill') }))`);
out.rows = await b.ev(`[...document.querySelectorAll('.ilg-settings [data-tone]')].map(n => ({ hidden: n.hidden, h: n.getBoundingClientRect().height }))`);
out.status = await b.ev(`document.getElementById('ilg-status').textContent`);
out.logs = b.logs;
console.log(JSON.stringify(out, null, 1));
b.close(); process.exit(0);
