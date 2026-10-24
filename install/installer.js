// NVWA 液态玻璃 · 酒馆助手安装脚本
// 打开这个脚本后：没装美化扩展就问一句要不要装，装好自动刷新；装过了就什么都不做。脚本按钮“检查更新”可以手动更新
// 构建：node install/build.mjs 会把这个文件包成酒馆助手能导入的 JSON
const REPO = 'https://github.com/jjing8235-afk/NVWA-Liquid-Glass';
const ID = 'NVWA-Liquid-Glass';
const TITLE = 'NVWA 液态玻璃';

const reload = () => setTimeout(() => window.parent.location.reload(), 2000);
// 酒馆助手脚本比扩展先跑，等扩展有机会加载完再看
const running = () => !!window.parent.__ilgLoaded;

async function install() {
    const { callGenericPopup, POPUP_TYPE } = SillyTavern.getContext();
    const ok = await callGenericPopup(
        `<h3>${TITLE}</h3><p>要安装美化扩展吗？会从 GitHub 下载到你的酒馆里（只给当前用户装，不需要管理员）。</p><p>装好后页面会自动刷新一次。</p>`,
        POPUP_TYPE.CONFIRM, '', { okButton: '安装', cancelButton: '以后再说' });
    if (!ok) return;
    toastr.info('正在下载，稍等十几秒……', TITLE);
    const res = await installExtension(REPO, 'local');
    if (res.ok) { toastr.success('装好了，马上刷新页面', TITLE); reload(); }
    else toastr.error(`安装失败（${res.status}）：${await res.text()}`, TITLE, { timeOut: 15000 });
}

async function update() {
    if (!isInstalledExtension(ID)) {
        if (running()) toastr.info('你这份美化不是从 GitHub 装的，没法在这里更新。', TITLE);
        else install();
        return;
    }
    toastr.info('正在检查更新……', TITLE);
    const res = await updateExtension(ID);
    if (!res.ok) { toastr.error(`更新失败（${res.status}）：${await res.text()}`, TITLE, { timeOut: 15000 }); return; }
    const info = await res.json();
    if (info.isUpToDate) toastr.success(`已经是最新版（${info.shortCommitHash}）`, TITLE);
    else { toastr.success(`已更新到 ${info.shortCommitHash}，马上刷新页面`, TITLE); reload(); }
}

eventOn(getButtonEvent('检查更新'), update);

setTimeout(() => {
    if (running()) return;
    if (isInstalledExtension(ID)) {
        toastr.warning('美化扩展已经装了，但没在运行：去“扩展 → 管理扩展”里把“NVWA 液态玻璃”打开。', TITLE, { timeOut: 12000 });
        return;
    }
    install();
}, 4000);
