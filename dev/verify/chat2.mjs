// 聊天正文样式检查：在页面里临时克隆几条消息（只改 DOM，不存进聊天），塞进对白、心理、引用、用户消息，深浅各截一张：node chat2.mjs [宽] [高]
import { open } from './lib.mjs';
const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 844);
const b = await open(W, H, 9346);
await b.ev(`document.querySelector('.ilg-home-recent')?.click()`);
await b.sleep(600);
await b.ev(`document.querySelector('#chat > .welcomePanel .recentChat')?.click()`);
await b.sleep(5000);
const made = await b.ev(`(() => {
  const chat = document.getElementById('chat'); const src = chat.querySelector('.mes'); if (!src) return 'no mes';
  const add = (user, name, html) => { const m = src.cloneNode(true); m.classList.add('ilg-fake'); m.setAttribute('is_user', String(user)); m.removeAttribute('mesid');
    m.querySelector('.name_text').textContent = name; m.querySelector('.mes_text').innerHTML = html; chat.appendChild(m); };
  add(true, '你', '<p>推开门，雨声一下子大了起来。<q>“有人在吗？”</q></p>');
  add(false, '绯夜', '<p>灯只亮了一半。她靠在柜台后面，指尖慢慢转着一只空杯子，<q>“这么晚了，还有人敢进来。”</q></p><p><em>（又是一个迷路的。）</em>她抬眼看你，笑意没到眼底。</p><blockquote>店规第一条：进门的人，要留下一个故事。</blockquote><p>她把杯子推过来，<q>“说吧，<strong>你想要什么</strong>？”</q></p>');
  add(true, '你', '<p>嗯。</p>');
  chat.scrollTop = chat.scrollHeight; return chat.querySelectorAll('.ilg-fake').length; })()`);
await b.sleep(1200);
const probe = `(() => { const q = s => [...document.querySelectorAll('#chat .ilg-fake ' + s)]; const c = (el, ...p) => el ? Object.fromEntries(p.map(k => [k, getComputedStyle(el)[k]])) : null;
  const u = document.querySelectorAll('#chat .ilg-fake[is_user="true"]'); const r = el => { const x = el.getBoundingClientRect(); return [x.left, x.width].map(Math.round); };
  return { q: c(q('q')[0], 'color', 'backgroundImage'), em: c(q('em')[0], 'color'), bq: c(q('blockquote')[0], 'borderLeftColor', 'backgroundColor'),
    user: [...u].map(r), ai: r(document.querySelector('#chat .ilg-fake[is_user="false"]')), chatW: document.getElementById('chat').clientWidth }; })()`;
const out = { made };
for (const tone of ['dark', 'light']) {
    await b.ev(`document.documentElement.classList.toggle('ilg-light', ${tone === 'light'})`);
    await b.sleep(800);
    await b.ev(`(() => { const c = document.getElementById('chat'); c.scrollTop = c.scrollHeight; })()`);
    await b.sleep(600);
    await b.shot(`fake-${tone}`);
    out[tone] = await b.ev(probe);
}
out.ring = await b.ev(`(() => { document.body.dataset.generating = 'true'; return [...document.querySelectorAll('#chat .mes.last_mes')].map(a => [a.getAttribute('is_user'), getComputedStyle(a.querySelector('.avatar'), '::before').animationName]); })()`);
delete out.none;
await b.ev(`(() => { delete document.body.dataset.generating; document.querySelectorAll('.ilg-fake').forEach(n => n.remove()); })()`);
out.logs = b.logs;
console.log(JSON.stringify(out, null, 1));
b.close(); process.exit(0);
