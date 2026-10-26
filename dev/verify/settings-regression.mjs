import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// 只在隔离上下文执行从源码提取的设置逻辑，不连接酒馆、不修改用户设置。
const root = fileURLToPath(new URL('../../', import.meta.url));
const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const passed = [];
const resetBody = source.match(/const reset = \(\) => \{([\s\S]*?)\n    \};/)?.[1];
assert.ok(resetBody, 'Reset handler must be present');
const settings = {
    cssReset: false, cssCleaned: true, cssBackup: 'original-css',
    cssBackupAt: 'date', lookBackup: 'original-look', themeBackup: 'User Theme',
    radius: 5, v: 9, unknown: 'keep',
};
const defaults = {
    cssReset: true, cssCleaned: false, cssBackup: '', cssBackupAt: '',
    lookBackup: '', themeBackup: '', radius: 22,
};
vm.runInNewContext(resetBody, {
    S: settings, DEFAULTS: defaults,
    clearAll() {}, applyRoot() {}, sync() {}, ctx: { saveSettingsDebounced() {} },
});
assert.equal(settings.radius, 22);
assert.equal(settings.cssBackup, 'original-css');
assert.equal(settings.cssBackupAt, 'date');
assert.equal(settings.lookBackup, 'original-look');
assert.equal(settings.themeBackup, 'User Theme');
assert.equal(settings.cssCleaned, true);
assert.equal(settings.cssReset, false);
assert.equal(settings.unknown, 'keep');
assert.equal(settings.v, 9);
passed.push('Reset preserves backups, cleanup preference, migration version and unknown settings');

const statusBody = source.match(/function companionThemeStatus\(\) \{([\s\S]*?)\n\}/)?.[1];
assert.ok(statusBody, 'Companion check must be present');
const theme = JSON.parse(fs.readFileSync(path.join(root, 'install/NVWA 液态玻璃 · 美化主题.json'), 'utf8'));
function checkTheme(select, overrides = {}) {
    const powerUserSettings = { ...theme, ...overrides };
    const before = JSON.stringify(powerUserSettings);
    const result = vm.runInNewContext('(function() {' + statusBody + '})()', {
        document: { getElementById() { return select; } },
        COMPANION_THEME: theme.name, ctx: { powerUserSettings },
    });
    assert.equal(JSON.stringify(powerUserSettings), before, 'Theme checks must not modify settings');
    return result;
}
assert.equal(checkTheme(null), 'pending');
assert.equal(checkTheme({ options: [], value: 'Azure' }), 'missing');
const select = { options: [{ value: theme.name }], value: 'Azure' };
assert.equal(checkTheme(select), 'inactive');
select.value = theme.name;
assert.equal(checkTheme(select), 'ready');
assert.equal(checkTheme(select), 'ready');
for (const overrides of [{ custom_css: 'body { color:red }' }, { avatar_style: 1 }, { chat_display: 0 }, { fast_ui_mode: true }]) {
    assert.equal(checkTheme(select, overrides), 'modified');
}
assert.ok(!source.includes('autoCleanForeign'));
assert.ok(!source.includes('applyThemeByName'));
assert.ok(!source.includes('resetForeignLook'));
assert.equal(theme.custom_css, '');
assert.equal(theme.chat_display, 1);
assert.equal(theme.avatar_style, 3);
passed.push('Companion theme: pending/missing/inactive/modified/ready; repeated checks never change settings');

// 采用安装版本的导入合并函数验证格式；不调用导入/保存 API。
const host = fs.readFileSync(path.join(root, '../../../power-user.js'), 'utf8').replace(/\r\n/g, '\n');
const snapshotBody = host.match(/export function getThemeObject\(name\) \{([\s\S]*?)\n\}/)?.[1];
const mergeBody = host.match(/function getNewTheme\(parsed\) \{([\s\S]*?)\n\}/)?.[1];
assert.ok(snapshotBody && mergeBody, 'Installed host theme contract must exist');
for (const key of Object.keys(theme)) {
    assert.ok(key === 'name' || snapshotBody.includes(key + ':'), 'Unsupported theme key: ' + key);
}
const merged = vm.runInNewContext('(function(parsed) {' + mergeBody + '})(theme)', {
    theme, Object,
    getThemeObject(name) { return Object.fromEntries(Object.keys(theme).map(k => [k, k === 'name' ? name : 'old-setting'])); },
});
assert.equal(JSON.stringify(merged), JSON.stringify(theme));
passed.push('Companion JSON matches installed SillyTavern 1.18 theme import fields and merge logic');

const installer = JSON.parse(fs.readFileSync(
    path.join(root, 'install/NVWA 液态玻璃 · 酒馆助手安装脚本.json'), 'utf8',
));
assert.equal(installer.content, fs.readFileSync(path.join(root, 'install/installer.js'), 'utf8'));
assert.equal(installer.enabled, false);
passed.push('Packaged installer matches source and is disabled by default');
const installSource = fs.readFileSync(path.join(root, 'install/installer.js'), 'utf8');
const installBody = installSource.match(/async function install\(\) \{([\s\S]*?)\n\}/)?.[1];
assert.ok(installBody);
for (const selected of ['Azure', theme.name]) {
    const calls = { popup: 0, install: 0, warning: 0, reload: 0 };
    const fake = {
        TITLE: theme.name, REPO: 'test-only',
        SillyTavern: { getContext() { return {
            powerUserSettings: { theme: selected }, POPUP_TYPE: { CONFIRM: 1 },
            async callGenericPopup() { calls.popup++; return true; },
        }; } },
        toastr: { warning() { calls.warning++; }, info() {}, success() {}, error() {} },
        async installExtension() { calls.install++; return { ok: true }; },
        reload() { calls.reload++; },
    };
    await vm.runInNewContext('(async function() {' + installBody + '})()', fake);
    assert.equal(calls.install, selected === theme.name ? 1 : 0);
    assert.equal(calls.popup, selected === theme.name ? 1 : 0);
    assert.equal(calls.warning, selected === theme.name ? 0 : 1);
}
passed.push('Installer blocks non-companion themes before confirmation/API; prepared path uses stub only');


let references = 0;
const missing = [];
for (const file of ['style.css', 'icons.css', 'fonts/fonts.css']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of text.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) {
        const url = match[1];
        if (/^(data:|https?:|#|\/)/.test(url)) continue;
        references++;
        const target = path.resolve(root, path.dirname(file), decodeURIComponent(url.split(/[?#]/)[0]));
        if (!fs.existsSync(target)) missing.push({ file, url });
    }
}
assert.deepEqual(missing, []);
passed.push(`Local CSS assets: ${references} references exist`);
assert.ok(fs.existsSync(path.join(root, 'fonts/LICENSE-noto-sans-sc-OFL.txt')));
assert.ok(fs.existsSync(path.join(root, 'LICENSE-ionicons.txt')));
passed.push('Font and icon license files present');
console.log(JSON.stringify({ passed, missing }, null, 2));
