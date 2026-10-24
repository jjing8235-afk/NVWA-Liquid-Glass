// 手机排版复核：两种聊天样式下的左右留白、字号、行高、对齐方式
import { open } from './lib.mjs';
const tag = process.argv[2] || 'typo2';
const W = Number(process.argv[3] || 380), H = 872;
const b = await open(W, H, 9360);
await b.ev(`document.querySelector('.ilg-home-recent')?.click()`);
await b.sleep(800);
await b.ev(`(() => { const n = [...document.querySelectorAll('#chat > .welcomePanel .recentChat')].find(x => x.textContent.includes('牛肉'))
  || [...document.querySelectorAll('#chat > .welcomePanel .recentChat')].pop(); n?.click(); })()`);
await b.sleep(7000);
await b.ev(`document.querySelector('#chat').scrollTop = 1e9`);
await b.sleep(800);

const probe = `(() => {
  const r = n => { const x = n.getBoundingClientRect(); return { l: Math.round(x.left), r: Math.round(innerWidth - x.right), w: Math.round(x.width) }; };
  const ms = [...document.querySelectorAll('#chat .mes')].filter(m => m.querySelector('.mes_text p'));
  const m = ms[ms.length - 1] || ms[0];
  const t = m.querySelector('.mes_text'); const s = getComputedStyle(t); const p = t.querySelector('p'); const ps = getComputedStyle(p);
  const blk = m.querySelector('.mes_block');
  return { body: document.body.className, mes: r(m), block: r(blk), text: r(t),
    blockPad: getComputedStyle(blk).paddingLeft + ' / ' + getComputedStyle(blk).paddingRight,
    mesPad: getComputedStyle(m).paddingLeft + ' / ' + getComputedStyle(m).paddingRight,
    textRightPad: getComputedStyle(t).paddingRight,
    rightSpacing: getComputedStyle(document.getElementById('chat')).getPropertyValue('--mes-right-spacing'),
    fs: s.fontSize, lh: s.lineHeight, align: s.textAlign, justify: s.textJustify, ls: s.letterSpacing,
    pMargin: ps.marginTop + ' / ' + ps.marginBottom }; })()`;

const out = {};
out.bubble = await b.ev(probe);
await b.shot(`${tag}-bubble`);
await b.ev(`document.body.classList.remove('bubblechat')`);
await b.sleep(600);
out.plain = await b.ev(probe);
await b.shot(`${tag}-plain`);
out.logs = b.logs;
console.log(JSON.stringify(out, null, 1));
b.close(); process.exit(0);
