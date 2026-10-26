// 把 installer.js 包成酒馆助手的脚本 JSON：node install/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
const script = {
    type: 'script',
    enabled: false,
    name: 'NVWA 液态玻璃 · 一键安装',
    id: 'nvwa-liquid-glass-installer',
    content: readFileSync(new URL('installer.js', dir), 'utf8'),
    info: '先导出旧主题作备份，再导入并选中配套主题「NVWA 液态玻璃」，最后打开本脚本安装扩展。未选中配套主题时不安装；装好自动刷新。\n脚本按钮“检查更新”可以随时更新到最新版。\n项目地址：https://github.com/jjing8235-afk/NVWA-Liquid-Glass',
    button: { enabled: true, buttons: [{ name: '检查更新', visible: true }] },
    data: {},
    export_with: { data: true, button: true },
};
writeFileSync(new URL('NVWA 液态玻璃 · 酒馆助手安装脚本.json', dir), JSON.stringify(script, null, 2) + '\n');
console.log('ok');
