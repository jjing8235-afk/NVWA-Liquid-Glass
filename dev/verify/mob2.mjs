// 手机排版回归：正文左右留白、停止键居中、时间栏两侧爱心是否被裁、正文字号
// node mob2.mjs [宽] [高] [前缀]
import { open } from './lib.mjs';
const W = Number(process.argv[2] || 380), H = Number(process.argv[3] || 872), tag = process.argv[4] || 'mob2';
const b = await open(W, H, 9355);
await b.ev(`document.querySelector('.ilg-home-recent')?.click()`);
await b.sleep(600);
await b.ev(`document.querySelector('#chat > .welcomePanel .recentChat')?.click()`);
await b.sleep(6000);

const box = `const bx = el => { if (!el) return null; const x = el.getBoundingClientRect(); return { l: Math.round(x.left), r: Math.round(innerWidth - x.right), w: Math.round(x.width), t: Math.round(x.top) }; };`;
const out = {};

// —— 正文左右留白（两种头像排版）
const chatProbe = `(() => { ${box}
  const ms = [...document.querySelectorAll('#chat .mes')].filter(m => m.querySelector('.mes_text') && !m.classList.contains('smallSysMes'));
  const m = ms.find(x => x.getAttribute('is_user') !== 'true') || ms[0];
  const t = m && m.querySelector('.mes_text'), blk = m && m.querySelector('.mes_block');
  const s = t && getComputedStyle(t);
  return { mes: bx(m), block: bx(blk), text: bx(t), fs: s && s.fontSize, lh: s && s.lineHeight, ls: s && s.letterSpacing,
    blockPad: blk && getComputedStyle(blk).paddingLeft + ' / ' + getComputedStyle(blk).paddingRight }; })()`;
out.avlineOn = await b.ev(chatProbe);
await b.shot(`${tag}-chat`);
await b.ev(`document.documentElement.classList.remove('ilg-avline')`);
await b.sleep(500);
out.avlineOff = await b.ev(chatProbe);
await b.shot(`${tag}-chat-noavline`);
await b.ev(`document.documentElement.classList.add('ilg-avline')`);

// —— 输入栏：左右是否对称、停止键和左边按钮是否同尺寸
await b.ev(`(() => { document.getElementById('mes_stop').style.display = 'flex'; document.getElementById('send_but').classList.add('displayNone'); })()`);
await b.sleep(300);
out.input = await b.ev(`(() => { ${box}
  const g = id => document.getElementById(id);
  const s = g('mes_stop'), ic = s.querySelector('i'), cb = s.getBoundingClientRect(), ib = ic.getBoundingClientRect();
  const left = [...g('leftSendForm').children].filter(k => getComputedStyle(k).display !== 'none');
  return { capsule: bx(g('nonQRFormItems')), left: bx(g('leftSendForm')), right: bx(g('rightSendForm')),
    stop: bx(s), stopIcon: { cx: +(ib.left + ib.width / 2).toFixed(1), cy: +(ib.top + ib.height / 2).toFixed(1) },
    stopCenter: { cx: +(cb.left + cb.width / 2).toFixed(1), cy: +(cb.top + cb.height / 2).toFixed(1) },
    leftKids: left.map(k => ({ id: k.id, r: bx(k) })), radius: getComputedStyle(s).borderRadius }; })()`);
await b.shot(`${tag}-input`);

// —— 时间栏：塞一条仿「凝嘤嘤」，爱心故意画到框外，看左侧 x<block 的地方有没有像素
await b.ev(`(() => {
  const m = [...document.querySelectorAll('#chat .mes')].pop(); const t = m.querySelector('.mes_text');
  if (document.getElementById('nvt-test-css')) return;
  const css = document.createElement('style'); css.id = 'nvt-test-css';
  css.textContent = \`
   .nvt-bar{display:flex;align-items:center;gap:.8em;margin:.5em 0 1em;}
   .nvt-side{flex:1 1 0;min-width:1.5em;height:40px;position:relative;pointer-events:none;}
   .nvt-side svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}
   .nvt-l svg{transform:scaleX(-1);}
   .nvt-mid{flex:0 1 auto;display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:.1em .55em;text-align:center;letter-spacing:.14em;font-weight:500;font-size:.98em;}
  \`;
  document.head.appendChild(css);
  const heart = '<svg viewBox="0 0 32 32" shape-rendering="crispEdges"><rect x="-6" y="8" width="24" height="16" fill="#ff2d94"/><rect x="0" y="22" width="14" height="6" fill="#ff2d94"/></svg>';
  const bar = '<div class="nvt-bar"><div class="nvt-side nvt-l">' + heart + '</div><div class="nvt-mid"><span class="nvt-seg">申时三刻</span><span class="nvt-dot">◆</span><span class="nvt-seg">星期日</span></div><div class="nvt-side nvt-r">' + heart + '</div></div>';
  t.insertAdjacentHTML('afterbegin', bar);
  m.scrollIntoView({ block: 'start' });
})()`);
await b.sleep(600);
out.nvt = await b.ev(`(() => { ${box}
  const bar = document.querySelector('.nvt-bar'); const m = bar.closest('.mes'); const blk = m.querySelector('.mes_block');
  const svg = bar.querySelector('.nvt-l svg'); const r = svg.getBoundingClientRect();
  return { bar: bx(bar), block: bx(blk), blockOverflow: getComputedStyle(blk).overflow, svg: { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } }; })()`);
await b.shot(`${tag}-nvt`);
await b.ev(`document.querySelectorAll('.nvt-bar').forEach(n => n.remove())`);
await b.sleep(300);
await b.shot(`${tag}-nvt-off`);
out.logs = b.logs;
console.log(JSON.stringify(out, null, 1));
b.close(); process.exit(0);
