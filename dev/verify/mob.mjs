// 手机排查：输入栏按钮能不能点到、聊天区是否偏左、状态栏卡片字迹、预设面板字色：node mob.mjs [宽] [高] [前缀]
import { open } from './lib.mjs';
const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 844), tag = process.argv[4] || 'mob';
const b = await open(W, H, 9348);
const out = {};
await b.ev(`document.querySelector('.ilg-home-recent')?.click()`);
await b.sleep(600);
await b.ev(`document.querySelector('#chat > .welcomePanel .recentChat')?.click()`);
await b.sleep(5000);
// 输入框塞一段长字，看会不会盖住按钮
await b.ev(`(() => { const t = document.getElementById('send_textarea'); t.value = '多久时间是不是睡觉睡觉睡觉睡觉睡觉就是就是'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await b.sleep(500);
const inputProbe = `(() => { const r = el => { if (!el) return null; const x = el.getBoundingClientRect(); return [x.left, x.top, x.width, x.height].map(Math.round); };
  const hit = el => { if (!el) return null; const x = el.getBoundingClientRect(); const h = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return h ? (h.id || h.className || h.tagName) : null; };
  const L = document.getElementById('leftSendForm'), R = document.getElementById('rightSendForm');
  const cs = el => { const s = getComputedStyle(el); return { w: s.width, flex: s.flex, wrap: s.flexWrap, pos: s.position, ow: s.overflow }; };
  return { form: r(document.getElementById('nonQRFormItems')), sendForm: r(document.getElementById('send_form')), sendFormOutline: getComputedStyle(document.getElementById('send_form')).outline + ' / ' + getComputedStyle(document.getElementById('send_form')).border,
    left: r(L), leftCss: cs(L), right: r(R), ta: r(document.getElementById('send_textarea')), taCss: cs(document.getElementById('send_textarea')),
    kids: [...L.children].filter(k => getComputedStyle(k).display !== 'none').map(k => ({ id: k.id, r: r(k), hit: hit(k) })),
    rkids: [...R.children].filter(k => getComputedStyle(k).display !== 'none').map(k => ({ id: k.id, r: r(k), hit: hit(k) })) }; })()`;
out.input = await b.ev(inputProbe);
await b.shot(`${tag}-input`);
// 聊天区左右留白
out.chat = await b.ev(`(() => { const r = el => { if (!el) return null; const x = el.getBoundingClientRect(); return [x.left, x.width, Math.round(innerWidth - x.right)].map(Math.round); };
  const m = document.querySelector('#chat .mes:not([is_user="true"])'); const cs = el => { const s = getComputedStyle(el); return [s.paddingLeft, s.paddingRight, s.marginLeft, s.marginRight].join(' '); };
  return { vw: innerWidth, sheld: r(document.getElementById('sheld')), chat: r(document.getElementById('chat')), chatPad: cs(document.getElementById('chat')), chatSB: document.getElementById('chat').offsetWidth - document.getElementById('chat').clientWidth,
    mes: r(m), mesPad: m && cs(m), block: r(m?.querySelector('.mes_block')), text: r(m?.querySelector('.mes_text')), textPad: m && cs(m.querySelector('.mes_text')),
    btns: r(m?.querySelector('.mes_buttons')), avatar: r(m?.querySelector('.mesAvatarWrapper')), cls: document.body.className }; })()`);
// 塞一个仿状态栏的白底卡片（颜色不全写，靠继承）
await b.ev(`(() => { const m = [...document.querySelectorAll('#chat .mes:not([is_user="true"])')].pop(); const t = m.querySelector('.mes_text');
  t.insertAdjacentHTML('beforeend', '<div class="ilg-fakecard" style="background:#f4f5f8;border-radius:12px;padding:14px;margin:10px 0"><div style="color:#d0607a;font-weight:700;text-align:center">少女们的恋爱进度</div><div style="color:#999;font-size:12px;text-align:center">仅目标可见</div><div style="border-left:4px solid #f07;padding:8px;background:#fff5f7"><b>皇甫明夏</b> <span style="color:#e05a7a">★ 见习恋人 [0/500]</span><p>任务：和他在放学后去一次便利店</p></div><div style="border-left:4px solid #aab;padding:8px"><b>林见月</b> <span style="color:#99a">★ 见习恋人 [0/500]</span><p>任务：暂无</p></div></div>');
  m.scrollIntoView({ block: 'end' }); })()`);
await b.sleep(600);
out.card = await b.ev(`(() => { const c = document.querySelector('.ilg-fakecard'); const s = el => { const x = getComputedStyle(el); return { color: x.color, shadow: x.textShadow }; };
  return { cls: c.className, title: s(c.children[0]), b: s(c.querySelector("b")), p: s(c.querySelector("p")) }; })()`);
await b.shot(`${tag}-card-dark`);
// 预设面板（AI 回复设置）深浅各一张
for (const tone of ['light', 'dark']) {
    await b.ev(`document.documentElement.classList.toggle('ilg-light', ${tone === 'light'})`);
    await b.ev(`document.querySelector('#ai-config-button .drawer-toggle')?.click()`);
    await b.sleep(1200);
    await b.ev(`(() => { const pm = document.getElementById('completion_prompt_manager') || document.querySelector('.range-block:has(#completion_prompt_manager)'); pm?.scrollIntoView({ block: 'start' }); })()`);
    await b.sleep(500);
    await b.shot(`${tag}-pm-${tone}`);
    out['pm_' + tone] = await b.ev(`(() => { const pick = s => { const el = document.querySelector(s); if (!el) return null; const x = getComputedStyle(el); return { txt: el.textContent.trim().slice(0, 30), color: x.color, shadow: x.textShadow, bg: x.backgroundColor, op: x.opacity, filter: x.filter }; };
      return { header: pick('.completion_prompt_manager_header'), tok: pick('.completion_prompt_manager_header div:last-child'), title: pick('.completion_prompt_manager_header > div:first-child'),
        listHead: pick('.completion_prompt_manager_list_head'), item: pick('.completion_prompt_manager_prompt'), itemName: pick('.completion_prompt_manager_prompt_name'), tokcell: pick('.prompt_manager_prompt_tokens'),
        footer: pick('.completion_prompt_manager_footer') }; })()`);
    await b.ev(`document.querySelector('#ai-config-button .drawer-toggle')?.click()`);
    await b.sleep(700);
}
await b.ev(`document.querySelectorAll('.ilg-fakecard').forEach(n => n.remove()); document.getElementById('send_textarea').value = ''`);
out.logs = b.logs;
console.log(JSON.stringify(out, null, 1));
b.close(); process.exit(0);
