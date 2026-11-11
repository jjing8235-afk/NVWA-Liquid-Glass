// 消息按钮栏的图标：NVWA 自己画的一套细线图标（24 格、1.8 线宽、圆头圆角），一眼能认出是干什么的。
// 只换酒馆自带的那些（按 class 对应）；第三方插件加的按钮不换图标，只统一大小、颜色和悬停样式（style.css 里），
// 所以柏宝绘这类插件塞进来的小图标照样显示。跟“简洁图标”开关走（html.ilg-icons）。
const A = 'fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
    // 翻译：“文 / A”两张卡叠在一起
    mes_translate: `<path d="M3.5 6.5h8M7.5 4.5v2M5 6.5c.6 2.6 2.4 4.6 5 5.6M10 6.5c-.6 2.6-2.4 4.6-5 5.6"/><path d="m12.5 20 3.5-8.5 3.5 8.5M13.7 17.2h4.6"/>`,
    // 生图：一张画 + 角上一颗小星（和“编辑”的笔区分开）
    sd_message_gen: `<rect x="3.5" y="6" width="14" height="13.5" rx="3"/><path d="m3.5 16 4-4 4.5 4.5M12.5 14.5l1.5-1.5 3.5 3.5"/><path d="M19 2.5v4M17 4.5h4"/>`,
    // 朗读：小喇叭 + 两道声波
    mes_narrate: `<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>`,
    // 查看提示词：一页纸，上面三行字
    mes_prompt: `<rect x="5" y="3.5" width="14" height="17" rx="3"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>`,
    // 隐藏 / 取消隐藏：睁眼 / 闭眼
    mes_hide: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>`,
    mes_unhide: `<path d="M4 4l16 16M9.8 6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.4 7.6A16.4 16.4 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4.1-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>`,
    // 媒体：相框叠两层 / 四宫格
    mes_media_gallery: `<rect x="3.5" y="6.5" width="14" height="13" rx="3"/><path d="M7 3.5h10.5a3 3 0 0 1 3 3V17"/><path d="m3.5 16 4-4 4 4M13 14.5l1.5-1.5 3 3"/>`,
    mes_media_list: `<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>`,
    // 附件：回形针
    mes_embed: `<path d="M20 11.5 12.2 19.3a4.6 4.6 0 0 1-6.5-6.5l8-8a3 3 0 0 1 4.3 4.3l-8 8a1.5 1.5 0 0 1-2.1-2.1l7.3-7.3"/>`,
    // 换一条回复：一张卡 + 左右箭头
    mes_swipe_picker: `<rect x="7.5" y="4.5" width="9" height="15" rx="2.5"/><path d="m4.5 9.5-2 2.5 2 2.5M19.5 9.5l2 2.5-2 2.5"/>`,
    // 存档点：旗子；开分支：一根枝杈
    mes_create_bookmark: `<path d="M5.5 21V4.5"/><path d="M5.5 5h11l-2.5 4 2.5 4h-11"/>`,
    mes_bookmark: `<path d="M5.5 21V4.5"/><path d="M5.5 5h11l-2.5 4 2.5 4h-11" fill="#000"/>`,
    mes_create_branch: `<circle cx="7" cy="5.5" r="2"/><circle cx="7" cy="18.5" r="2"/><circle cx="17" cy="8" r="2"/><path d="M7 7.5v9M17 10c0 4-10 2.5-10 6.5"/>`,
    // 复制：两张叠着的卡；编辑：笔
    mes_copy: `<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5"/><path d="M15.5 8.5V6.5a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2"/>`,
    mes_edit: `<path d="M15 4.5a2.1 2.1 0 0 1 3 0l1.5 1.5a2.1 2.1 0 0 1 0 3L9 19.5l-4.5 1 1-4.5z"/><path d="m13.5 6 4.5 4.5"/>`,
    // 更多：三个点（实心）
    extraMesButtonsHint: `<circle cx="6" cy="12" r="1.6" fill="#000" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="#000" stroke="none"/><circle cx="18" cy="12" r="1.6" fill="#000" stroke="none"/>`,
    // 编辑模式那一排
    mes_edit_done: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
    mes_edit_copy: null, // 和 mes_copy 一样，下面补
    mes_edit_add_reasoning: `<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3.5z"/>`,
    mes_edit_delete: `<path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/><path d="M6.5 7l.8 11.2A2.5 2.5 0 0 0 9.8 20.5h4.4a2.5 2.5 0 0 0 2.5-2.3L17.5 7M10 11v5.5M14 11v5.5"/>`,
    mes_edit_up: `<path d="m6 14.5 6-6 6 6"/>`,
    mes_edit_down: `<path d="m6 9.5 6 6 6-6"/>`,
    mes_edit_cancel: `<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>`,
};
ICONS.mes_edit_copy = ICONS.mes_copy;

const uri = body => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${A}>${body}</svg>`)}")`;
export function installMessageIcons() {
    if (document.getElementById('ilg-mes-icons')) return;
    const scope = 'html.ilg.ilg-icons body #chat .mes';
    const rows = Object.entries(ICONS).map(([cls, body]) => `${scope} .${cls} { --ilg-mes-icon: ${uri(body)}; }`);
    const list = Object.keys(ICONS).map(cls => `${scope} .${cls}`).join(',\n');
    const css = `${rows.join('\n')}
/* 换成遮罩画的图标：字体图标那个字形不要了，::before 用 --ilg-mes-icon 涂成当前文字色 */
${list.replace(/,\n/g, '::before,\n')}::before {
    content: "" !important;
    display: block;
    width: 17px;
    height: 17px;
    margin: 5.5px auto;
    background-color: currentColor;
    -webkit-mask: var(--ilg-mes-icon) center / contain no-repeat;
    mask: var(--ilg-mes-icon) center / contain no-repeat;
}
/* 不碰 display：酒馆自己用 display:none 藏书签、媒体切换这些按钮，改了就会露出来 */
${list} { font-size: 0 !important; line-height: 1 !important; }`;
    const style = document.createElement('style');
    style.id = 'ilg-mes-icons';
    style.textContent = css;
    document.head.append(style);
}
