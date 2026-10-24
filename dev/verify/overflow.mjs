// 时间栏溢出验证：插一条假消息，爱心画到框外，数 x < .mes_block 左边界处有没有颜色
import { open } from './lib.mjs';
const tag = process.argv[2] || 'ovf';
const b = await open(380, 872, 9357);
await b.ev(`document.querySelector('.ilg-home-recent')?.click()`);
await b.sleep(600);
await b.ev(`document.querySelector('#chat > .welcomePanel .recentChat')?.click()`);
await b.sleep(6000);

await b.ev(`(() => {
  document.getElementById('ovf-mes')?.remove();
  const wrap = document.createElement('div'); wrap.id = 'ovf-mes';
  wrap.innerHTML = '<div class="mes" is_user="false"><div class="mes_block"><div class="mes_text">'
    + '<div class="nvt-bar"><div class="nvt-side nvt-l"><svg viewBox="0 0 32 32" preserveAspectRatio="none" style="overflow:visible"><rect x="-9" y="6" width="24" height="22" fill="#ff00ff"/></svg></div>'
    + '<div class="nvt-mid">申时三刻 ◆ 星期日</div>'
    + '<div class="nvt-side nvt-r"><svg viewBox="0 0 32 32" preserveAspectRatio="none" style="overflow:visible"><rect x="17" y="6" width="24" height="22" fill="#ff00ff"/></svg></div></div>'
    + '<p>海风吹过半空，卷走最后一点硫磺余味。这一段是测试正文，用来量左右留白。</p>'
    + '</div></div></div>';
  const css = document.createElement('style');
  css.textContent = '.nvt-bar{display:flex;align-items:center;gap:.8em;margin:.2em 0 .6em}.nvt-side{flex:1 1 0;min-width:1.5em;height:40px;position:relative}.nvt-side svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.nvt-mid{flex:0 1 auto;text-align:center;font-size:14px}';
  document.head.appendChild(css);
  document.getElementById('chat').appendChild(wrap);
  wrap.scrollIntoView({ block: 'center' });
})()`);
await b.sleep(600);
const geo = await b.ev(`(() => { const blk = document.querySelector('#ovf-mes .mes_block'); const r = blk.getBoundingClientRect();
  return { blockLeft: Math.round(r.left), blockRight: Math.round(r.right), overflow: getComputedStyle(blk).overflowX }; })()`);
await b.shot(`${tag}-on`);
await b.ev(`(() => { const s = document.createElement('style'); s.id = 'ovf-off'; s.textContent = 'html.ilg body #chat .mes:has(.nvt-bar) .mes_block { overflow-x: hidden !important; }'; document.head.appendChild(s); })()`);
await b.sleep(400);
await b.shot(`${tag}-off`);
console.log(JSON.stringify(geo));
b.close(); process.exit(0);
