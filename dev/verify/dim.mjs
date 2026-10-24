// 浅色模式下的深色小面板会不会被标成 .ilg-dim、字变浅：node dim.mjs
import { open } from './lib.mjs';
const b = await open(390, 844, 9350);
await b.ev(`document.querySelector('.ilg-home-recent')?.click()`); await b.sleep(600);
await b.ev(`document.querySelector('#chat > .welcomePanel .recentChat')?.click()`); await b.sleep(5000);
await b.ev(`document.documentElement.classList.add('ilg-light')`);
await b.ev(`(() => { const t = [...document.querySelectorAll('#chat .mes .mes_text')].pop();
  t.insertAdjacentHTML('beforeend', '<div class="ilg-x1" style="background:#1c1c24;padding:12px;border-radius:10px"><b>暗面板</b><p>正文 <q>“台词”</q></p><div class="ilg-x2" style="background:rgba(255,255,255,.06);padding:6px">半透明内层</div></div><div class="ilg-x3" style="background:rgba(255,255,255,.3)">浅色模式下的淡白底</div>');
  t.closest('.mes').scrollIntoView({ block: 'end' }); })()`);
await b.sleep(700);
console.log(JSON.stringify(await b.ev(`(() => { const q = s => document.querySelector(s); const c = el => getComputedStyle(el).color;
  return { x1: q('.ilg-x1').className, b: c(q('.ilg-x1 b')), p: c(q('.ilg-x1 p')), say: c(q('.ilg-x1 q')), x2: q('.ilg-x2').className, x3: q('.ilg-x3').className }; })()`)));
await b.shot('dim-light');
await b.ev(`document.documentElement.classList.remove('ilg-light'); document.querySelectorAll('.ilg-x1,.ilg-x3').forEach(n => n.remove())`);
b.close(); process.exit(0);
