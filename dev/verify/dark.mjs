// 深色面板截图 + 太阳 / 月亮键在“按时间”下只临时切换、不改设置：node dark.mjs [宽] [高]
import { open } from './lib.mjs';
const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 844);
const b = await open(W, H, 9348);
const st = `(() => ({ tone: SillyTavern.getContext().extensionSettings.iosLiquidGlass.tone, light: document.documentElement.classList.contains('ilg-light'), wall: decodeURIComponent(document.getElementById('bg1').style.backgroundImage.split('/').pop() || '').replace(/["')]+$/, '') }))()`;
const out = { before: await b.ev(st) };
await b.ev(`document.querySelector('#ilg-tone-button .ilg-tone-icon').click()`);
await b.sleep(2500);
out.afterBtn = await b.ev(st);
for (const [n, sel] of [['ai', '#ai-config-button .drawer-toggle'], ['user', '#user-settings-button .drawer-toggle']]) {
    await b.ev(`document.querySelector('${sel}')?.click()`);
    await b.sleep(1000);
    await b.shot(`dark-${n}`);
    await b.ev(`document.querySelector('${sel}')?.click()`);
    await b.sleep(700);
}
await b.shot('dark-home');
await b.ev(`document.querySelector('#ilg-tone-button .ilg-tone-icon').click()`);
await b.sleep(2500);
out.back = await b.ev(st);
out.logs = b.logs;
console.log(JSON.stringify(out, null, 1)); b.close(); process.exit(0);
