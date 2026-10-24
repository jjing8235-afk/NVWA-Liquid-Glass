// 思考小球检查：假装在生成（只改 DOM 和 body 标记，不发请求），依次看 浮动胶囊 → 流式占位 → 思维链标题 → 出字后消失，深浅各截一张：node think.mjs [宽] [高]
import { open } from './lib.mjs';
const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 844);
const b = await open(W, H, 9351);
await b.ev(`document.querySelector('.ilg-home-recent')?.click()`);
await b.sleep(600);
await b.ev(`document.querySelector('#chat > .welcomePanel .recentChat')?.click()`);
await b.sleep(5000);
const bottom = `(() => { const c = document.getElementById('chat'); c.scrollTop = c.scrollHeight; })()`;
const state = String.raw`(() => {
  const r = s => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return [x.left, x.top, x.width, x.height].map(Math.round); };
  const orbs = [...document.querySelectorAll('.ilg-orb')];
  // 两次取像素比较，证明球在转
  const sig = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 3; i < d.length; i += 4) h = (h * 31 + d[i]) >>> 0; return h; };
  return { float: r('#ilg-think-float'), await: document.querySelectorAll('#chat .mes.ilg-await').length, pill: r('#chat .ilg-think'),
    head: r('#chat .mes[data-reasoning-state="thinking"] .mes_reasoning_header'), headOrb: !!document.querySelector('.mes_reasoning_header > .ilg-orb'),
    orbs: orbs.map(c => [c.width, c.clientWidth, getComputedStyle(c).color, sig(c)]), t: [...document.querySelectorAll('.ilg-think-t')].map(n => n.textContent) };
})()`;
const out = {};
out.made = await b.ev(String.raw`(() => {
  const chat = document.getElementById('chat'); const src = chat.querySelector('.mes'); if (!src) return 'no mes';
  chat.querySelectorAll('.mes.last_mes').forEach(m => m.classList.remove('last_mes'));
  const m = src.cloneNode(true); m.classList.add('ilg-fake', 'last_mes'); m.setAttribute('is_user', 'true'); m.removeAttribute('mesid');
  m.classList.remove('reasoning'); delete m.dataset.reasoningState;
  m.querySelector('.name_text').textContent = '你'; m.querySelector('.mes_text').innerHTML = '<p>推开门。<q>“有人在吗？”</q></p>'; chat.appendChild(m);
  document.body.dataset.generating = 'true'; return 'ok'; })()`);
await b.sleep(1700);
await b.ev(bottom);
out.a = await b.ev(state);
await b.sleep(300);
out.a2 = (await b.ev(state)).orbs;
await b.shot('think-float');
// 流式：酒馆插进来一条正文是“...”的角色消息
await b.ev(String.raw`(() => {
  const chat = document.getElementById('chat'); const src = chat.querySelector('.mes[is_user="false"]') || chat.querySelector('.mes');
  chat.querySelectorAll('.mes.last_mes').forEach(m => m.classList.remove('last_mes'));
  const m = src.cloneNode(true); m.classList.add('ilg-fake', 'last_mes', 'ilg-fake-ai'); m.setAttribute('is_user', 'false'); m.removeAttribute('mesid');
  m.classList.remove('reasoning'); delete m.dataset.reasoningState; m.querySelector('.mes_reasoning').textContent = '';
  m.querySelector('.name_text').textContent = '绯夜'; m.querySelector('.mes_text').innerHTML = '<p>...</p>'; chat.appendChild(m); })()`);
await b.sleep(1300);
await b.ev(bottom);
await b.sleep(300);
out.b = await b.ev(state);
await b.shot('think-await');
// 推理模型开始吐思维链
await b.ev(String.raw`(() => { const m = document.querySelector('.ilg-fake-ai'); m.classList.add('reasoning'); m.dataset.reasoningState = 'thinking';
  m.querySelector('.mes_reasoning_details').dataset.state = 'thinking';
  m.querySelector('.mes_reasoning_header_title').textContent = '思考中……'; m.querySelector('.mes_reasoning').innerHTML = '<p>她会怎么接这句话呢……</p>'; })()`);
await b.sleep(900);
await b.ev(bottom);
await b.sleep(300);
out.c = await b.ev(state);
for (const tone of ['dark', 'light']) {
    await b.ev(`document.documentElement.classList.toggle('ilg-light', ${tone === 'light'})`);
    await b.sleep(900);
    await b.shot(`think-cot-${tone}`);
}
out.cLight = (await b.ev(state)).orbs;
// 想完、出字
await b.ev(String.raw`(() => { const m = document.querySelector('.ilg-fake-ai'); m.dataset.reasoningState = 'done';
  m.querySelector('.mes_reasoning_header_title').textContent = '思考了 4 秒'; m.querySelector('.mes_text').innerHTML = '<p>她抬眼看你。</p>'; })()`);
await b.sleep(700);
out.d = await b.ev(state);
await b.ev(`delete document.body.dataset.generating`);
await b.sleep(700);
out.e = await b.ev(state);
await b.ev(`document.querySelectorAll('.ilg-fake').forEach(n => n.remove())`);
out.logs = b.logs;
console.log(JSON.stringify(out, null, 1));
b.close(); process.exit(0);
