// 最后一条消息：翻页箭头和正文底部是否重叠：node swipe.mjs
import { open } from './lib.mjs';
const b = await open(390, 844, 9349);
await b.ev(`document.querySelector('.ilg-home-recent')?.click()`); await b.sleep(600);
await b.ev(`document.querySelector('#chat > .welcomePanel .recentChat')?.click()`); await b.sleep(5000);
const r = el => { return `(${el} ? (x => [x.left, x.top, x.right, x.bottom].map(Math.round))(${el}.getBoundingClientRect()) : null)`; };
console.log(JSON.stringify(await b.ev(`(() => { const m = document.querySelector('#chat .mes.last_mes'); const q = s => m.querySelector(s);
  const R = el => el ? (x => [x.left, x.top, x.right, x.bottom].map(Math.round))(el.getBoundingClientRect()) : null;
  return { mes: R(m), text: R(q('.mes_text')), block: R(q('.mes_block')), right: R(q('.swipe_right')), counter: R(q('.swipes-counter')), rblock: R(q('.swipeRightBlock')), btns: R(q('.mes_buttons')) }; })()`)));
b.close(); process.exit(0);
