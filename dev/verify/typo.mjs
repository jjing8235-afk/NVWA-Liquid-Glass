// 挑一个带正文的聊天，截手机版排版（字号 / 行高 / 段距）
import { open } from './lib.mjs';
const want = process.argv[4] || '牛肉';
const tag = process.argv[2] || 'typo';
const W = Number(process.argv[3] || 380), H = 872;
const b = await open(W, H, 9358);
await b.ev(`document.querySelector('.ilg-home-recent')?.click()`);
await b.sleep(800);
const list = await b.ev(`[...document.querySelectorAll('#chat > .welcomePanel .recentChat')].map(n => n.textContent.trim().slice(0, 20)).join(' | ')`);
const clicked = await b.ev(`(() => { const n = [...document.querySelectorAll('#chat > .welcomePanel .recentChat')].find(x => x.textContent.includes(${JSON.stringify(want)}));
  (n || [...document.querySelectorAll('#chat > .welcomePanel .recentChat')].pop())?.click(); return !!n; })()`);
await b.sleep(7000);
await b.ev(`document.querySelector('#chat').scrollTop = 1e9`);
await b.sleep(800);
const info = await b.ev(`(() => { const m = [...document.querySelectorAll('#chat .mes')].filter(x => x.querySelector('.mes_text p')).pop();
  if (!m) return 'no text mes';
  const t = m.querySelector('.mes_text'); const s = getComputedStyle(t); const p = m.querySelector('.mes_text p'); const ps = getComputedStyle(p);
  const r = n => { const x = n.getBoundingClientRect(); return { l: Math.round(x.left), r: Math.round(innerWidth - x.right) }; };
  return { fs: s.fontSize, lh: s.lineHeight, pLh: ps.lineHeight, pMargin: ps.marginTop + ' / ' + ps.marginBottom,
    text: r(t), mes: r(m), blk: r(m.querySelector('.mes_block')), lines: Math.round(t.getBoundingClientRect().height / parseFloat(ps.lineHeight)) }; })()`);
await b.shot(`${tag}`);
console.log(JSON.stringify({ list, clicked, info }, null, 1));
b.close(); process.exit(0);
