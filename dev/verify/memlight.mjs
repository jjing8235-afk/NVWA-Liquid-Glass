// 真浅色背景（只在页面里换 #bg1 的图，不点缩略图、不存设置）下看记忆窗口 / 确认框 / 预设列表：node memlight.mjs
import { open } from './lib.mjs';
const b = await open(390, 844, 9356);
await b.ev(`document.querySelector('.ilg-home-recent')?.click()`); await b.sleep(600);
await b.ev(`document.querySelector('#chat > .welcomePanel .recentChat')?.click()`); await b.sleep(6000);
await b.ev(`(() => { document.getElementById('bg1').style.backgroundImage = 'url("/backgrounds/' + encodeURIComponent('liquid glass porcelain.png') + '")'; document.documentElement.classList.add('ilg-light'); })()`);
await b.sleep(1200);
for (const tab of ['剧情', '设置']) {
    await b.ev(`[...document.querySelectorAll('.qr--button, button, .menu_button')].find(n => n.textContent.trim() === '记忆')?.click()`);
    await b.sleep(2500);
    await b.ev(`[...document.querySelectorAll('#nvwa-memory .m-tab')].find(n => n.textContent.trim() === '${tab}')?.click()`);
    await b.sleep(700);
    await b.shot(`ml-mem-${tab}`);
    await b.ev(`document.querySelector('dialog.popup[open] > .ilg-popup-x')?.click()`);
    await b.sleep(900);
}
await b.ev(`void SillyTavern.getContext().callGenericPopup('确定要删除这条消息吗？', SillyTavern.getContext().POPUP_TYPE.CONFIRM)`);
await b.sleep(900);
await b.shot('ml-confirm');
await b.ev(`document.querySelector('dialog.popup[open] > .ilg-popup-x')?.click()`);
await b.sleep(600);
console.log(JSON.stringify({ logs: b.logs, left: await b.ev(`document.querySelectorAll('dialog.popup[open]').length`) }));
b.close(); process.exit(0);
