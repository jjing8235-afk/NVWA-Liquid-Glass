import { createTypographyFonts, validFontFile, FILE_LIMIT } from './typography-fonts.js';

const ROLES = {
    body: ['正文', '整个段落的字形、粗细和颜色。'],
    quote: ['对白', '酒馆已经识别为对白的引号文字。'],
    em: ['心声与斜体', '匹配用单星号标记的强调文字。'],
    strong: ['加粗', '匹配用双星号标记的重点文字。'],
    link: ['链接', '保留下划线与原有链接行为。'],
    block: ['引用块', '匹配以 > 开头的独立引用段。'],
};
const FAMILIES = {
    sans: ['系统黑体', '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'],
    serif: ['宋体 / 衬线', '"Songti SC", "Noto Serif CJK SC", "SimSun", serif'],
    kai: ['楷体 / 手写感', '"Kaiti SC", "STKaiti", "KaiTi", "LXGW WenKai", serif'],
    rounded: ['圆体', '"Yuanti SC", "Hiragino Maru Gothic ProN", "YouYuan", sans-serif'],
    mono: ['等宽', '"SF Mono", Consolas, "Noto Sans Mono CJK SC", monospace'],
};
const number = (label,min,max,step,unit) => ({type:'number',label,min,max,step,unit});
const QUICK_RANGES = {size:16,leading:1.95,inset:0,tracking:.02,gap:.82};
const SPACING = ['leading','inset'];
const FIELD_HINTS = {
    leading:'值越大，上下两行越松。', inset:'正文离左右边缘的距离。',
    'body-weight':'数值越大，笔画越粗。', tracking:'每个字之间的空隙。',
    word:'主要调整英文单词间的空隙。', gap:'两段文字之间的距离。',
    indent:'每段开头空出多少。', measure:'越窄，文字越早换行。',
    align:'决定文字靠左、铺满一行还是居中。',
};
const QUICK_TYPE = {
    style: {icon:'I',label:'斜体',value:'italic',isOn:value=>value==='italic'},
    weight: {icon:'B',label:'加粗',value:700,isOn:value=>value>=700},
    scale: {icon:'A+',label:'放大',value:1.15,isOn:value=>value>1},
};
const ink = strength => `color-mix(in srgb, currentColor ${strength}%, transparent)`;
// The sampler and the real paragraph use the same paint recipes.
const MARKS = {
    quote: {
        plain:['无装饰',{}],
        wash:['淡色圆底',{bg:ink(13),radius:'.30em',pad:'.05em .26em'}],
        underline:['细下划线',{line:'underline',stroke:'solid'}],
        highlight:['半高荧光',{bg:`linear-gradient(transparent 56%, ${ink(26)} 56%, ${ink(26)} 92%, transparent 92%)`,pad:'0 .12em'}],
        dotted:['点状下划线',{line:'underline',stroke:'dotted'}],
        wave:['波浪下划线',{line:'underline',stroke:'wavy'}],
        double:['双下划线',{line:'underline',stroke:'double'}],
        frame:['细线框',{shadow:`inset 0 0 0 1px ${ink(43)}`,radius:'.22em',pad:'.07em .30em'}],
    },
    body: {
        plain:['无装饰',{}],
        paper:['淡色纸底',{bg:ink(8),radius:'.35em',inset:'.55em',block:'.22em'}],
        rail:['左侧细线',{shadow:`inset 1px 0 ${ink(60)}`,inset:'.55em',block:'.10em'}],
        frame:['纸笺细框',{shadow:`inset 0 0 0 1px ${ink(25)}`,radius:'.28em',inset:'.55em',block:'.22em'}],
        rule:['段尾细线',{shadow:`inset 0 -1px ${ink(32)}`,block:'.18em'}],
        dotrule:['段尾点线',{bg:`radial-gradient(circle, ${ink(45)} .75px, transparent 1px) 0 100% / 5px 2px repeat-x`,block:'.20em'}],
        margin:['页边双线',{bg:`linear-gradient(90deg, ${ink(46)} 1px, transparent 1px 3px, ${ink(24)} 3px 4px, transparent 4px)`,inset:'.65em',block:'.10em'}],
        fade:['淡墨渐隐',{bg:`linear-gradient(90deg, ${ink(14)}, transparent 86%)`,radius:'.28em',inset:'.55em',block:'.18em'}],
    },
};
const MARK_DEFAULTS = {bg:'none',shadow:'none',radius:'0',pad:'0',line:'none',stroke:'solid',inset:'0px',block:'0'};
const markPaint = (role, mark) => mark ? {...MARK_DEFAULTS,...MARKS[role][mark][1]} : {};
const choice = (label,options) => ({type:'select',label,options});
const layout = {
    size: number('正文字号',12,40,1,'px'), leading: number('正文行距',1.2,3.2,.05,''),
    tracking: number('字距',-.08,.25,.005,'em'), word: number('词距',0,.6,.01,'em'),
    gap: number('段间距',0,2.5,.05,'em'), indent: number('首行缩进',0,4,.25,'em'),
    inset: number('左右留白',0,48,1,'px'), measure: number('每行最长字宽',16,72,1,'em'),
    align: choice('对齐方式',{start:'左对齐',justify:'两端对齐',center:'居中'}),
};
function roleFields(role) {
    return {
        [`${role}-face`]: {type:'face',label:'字体'}, [`${role}-weight`]: number('字重',100,900,50,''),
        [`${role}-style`]: choice('字姿',{normal:'正体',italic:'斜体'}),
        ...(Object.hasOwn(MARKS,role) ? {[`${role}-scale`]: number('字号倍率',1,1.5,.05,'')} : {}),
        [`${role}-day`]: {type:'color',label:'日间字色'}, [`${role}-night`]: {type:'color',label:'夜间字色'},
    };
}
const fields = {...layout,...Object.assign({},...Object.keys(ROLES).map(roleFields)),
    ...Object.fromEntries(Object.entries(MARKS).map(([role,recipe])=>[`${role}-mark`,{type:'mark',options:recipe}]))};
const layoutKeys = Object.keys(fields).filter(k => !/-(day|night)$/.test(k));
const record = x => x && typeof x === 'object' && !Array.isArray(x);
const namedFont = /^[\p{L}\p{M}\p{N} ._-]{1,64}$/u;
const validName = x => typeof x === 'string' && x.length > 0 && x.length <= 36 && !/\p{C}/u.test(x) && x === x.trim();
const FORMAT = 'NVWA-typography';
const LIMIT = 16;
const clean = value => typeof value === 'string' ? value.trim() : '';
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function normalizeTypography(value) {
    if (!record(value)) return null;
    const result = {};
    for (const [key, rule] of Object.entries(fields)) {
        if (!Object.hasOwn(value,key)) continue;
        const v = value[key];
        if (rule.type === 'number') { if (typeof v !== 'number' || !Number.isFinite(v) || v < rule.min || v > rule.max) return null; }
        else if (typeof v !== 'string') return null;
        else if (rule.type === 'color') { if (!/^#[\da-f]{6}$/i.test(v)) return null; }
        else if (rule.type === 'select' || rule.type === 'mark') { if (!Object.hasOwn(rule.options,v)) return null; }
        else if (!Object.hasOwn(FAMILIES,v) && !(v.startsWith('system:') && namedFont.test(v.slice(7)))
            && !(v.startsWith('file:') && validFontFile(v.slice(5)))) return null;
        result[key] = rule.type === 'color' ? v.toLowerCase() : v;
    }
    return Object.keys(value).length === Object.keys(result).length ? result : null;
}
// Consolidate old appearance settings with the workbench without overwriting newer overrides.
export function migrateProseSpacing(settings) {
    const legacy = {};
    const leading = Number(settings.proseLeading), inset = Number(settings.proseInset);
    if (Number.isFinite(leading) && leading > 0) legacy.leading = Math.min(2.6, Math.max(1.4, Math.round(leading * 20) / 20));
    if (Number.isFinite(inset) && inset > 0) legacy.inset = Math.min(48, Math.max(1, Math.round(inset)));
    if (Object.keys(legacy).length) settings.typography = normalizeTypography({...legacy,...normalizeTypography(settings.typography)});
    if (Object.hasOwn(settings,'proseLeading')) settings.proseLeading = 0;
    if (Object.hasOwn(settings,'proseInset')) settings.proseInset = 0;
}
const normalizeProfiles = values => Array.isArray(values) ? values.slice(0,LIMIT).flatMap(entry => {
    const v = entry && normalizeTypography(entry.values);
    return v && validName(entry.name) && typeof entry.base === 'string' && Object.hasOwn(BASES, entry.base) ? [{name:entry.name,base:entry.base,values:v}] : [];
}) : [];
const BASES = {
    warm:['青瓷','青绿对白 · 留白排版'], classic:['栖暖','柔琥珀色 · 安静叙事'],
    moon:['笺月','宋体优先 · 疏朗书卷'], sunny:['晴笺','清爽黑体 · 蓝调对白'],
};
const asActive = values => Object.keys(values).length ? values : null;
const filesOf = values => Object.keys(ROLES).map(role=>values?.[`${role}-face`]).filter(x=>x?.startsWith('file:')).map(x=>x.slice(5));

function setStyle(el, key, value) {
    const prop = '--ilg-type-' + key;
    if (el.style.getPropertyValue(prop) !== value) {
        if (value) el.style.setProperty(prop,value);
        else el.style.removeProperty(prop);
    }
}
function variables(el, values, fonts) {
    const effective = {};
    for (const [key,rule] of Object.entries(fields)) {
        const v = values?.[key];
        if (rule.type === 'mark') { if (v !== undefined) effective[key]=v; continue; }
        let css = '';
        if (v !== undefined) {
            if (rule.type === 'face') {
                if (v.startsWith('file:')) { if (fonts.loaded(v.slice(5))) css = `"${fonts.familyOf(v.slice(5))}"`; }
                else if (v.startsWith('system:')) css = `"${v.slice(7)}"`;
                else css = FAMILIES[v][1];
                if (css && (v.startsWith('file:') || v.startsWith('system:'))) {
                    const fallback = key === 'body-face' ? '' : 'var(--ilg-type-body-face, ';
                    css += `, ${fallback}var(--ilg-prose-font, var(--mainFontFamily, sans-serif))${fallback ? ')' : ''}`;
                }
            } else css = String(v) + (rule.unit ?? '');
        }
        setStyle(el,key,css);
        if (css) effective[key] = css;
    }
    setStyle(el,'align-last',values?.align === 'justify' ? 'start' : values?.align ? 'auto' : '');
    for (const role of Object.keys(MARKS)) {
        const mark = values?.[`${role}-mark`];
        const paint = markPaint(role,mark);
        for (const part of Object.keys(MARK_DEFAULTS)) setStyle(el,`${role}-mark-${part}`,paint[part] ?? '');
        if (role === 'body') el.toggleAttribute('data-ilg-type-body-mark',!!mark && mark!=='plain');
    }
    el.toggleAttribute('data-ilg-type-measure',values?.measure !== undefined);
    el.toggleAttribute('data-ilg-type-inset',values?.inset !== undefined);
    return values ? layoutKeys.map(k=>effective[k] ?? '').join('|') : '';
}
const options = entries => entries.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
function control(key, rule) {
    const hint = FIELD_HINTS[key];
    const attrs = `data-type-key="${key}" id="ilg-type-${key}"${hint ? ` aria-describedby="ilg-type-hint-${key}"` : ''}`;
    let input;
    if (rule.type === 'number') input = `<div class="ilg-type-input-pair"><input ${attrs} type="number" min="${rule.min}" max="${rule.max}" step="any" inputmode="decimal" placeholder="${SPACING.includes(key)?'跟随风格':'继承'}"><span>${rule.unit || (key.endsWith('weight')?'100–900':'倍')}</span></div>${Object.hasOwn(QUICK_RANGES,key) ? `<input type="range" data-type-range="${key}" aria-label="拖动调整${rule.label}"${hint ? ` aria-describedby="ilg-type-hint-${key}"` : ''} min="${rule.min}" max="${rule.max}" step="${rule.step}" value="${QUICK_RANGES[key]}">` : ''}`;
    if (rule.type === 'select') input = `<select ${attrs}><option value="">继承</option>${options(Object.entries(rule.options))}</select>`;
    if (rule.type === 'color') input = `<div class="ilg-type-color"><input type="color" value="#777777" data-type-swatch="${key}" aria-label="选择${rule.label}"><input ${attrs} type="text" maxlength="7" placeholder="继承" autocomplete="off" spellcheck="false"></div>`;
    if (rule.type === 'face') input = `<div><select ${attrs}><option value="">继承</option>${options(Object.entries(FAMILIES).map(([id,[label]])=>[id,label]))}<option value="system:">输入系统字体名…</option></select><input type="text" data-type-system="${key}" aria-label="${ROLES[key.split('-')[0]][0]}的系统字体名" maxlength="64" placeholder="例如 Microsoft YaHei" autocomplete="off" hidden></div>`;
    return `<div class="ilg-type-field"><label for="ilg-type-${key}">${rule.label}</label>${input}${hint ? `<small class="ilg-type-field-hint" id="ilg-type-hint-${key}">${hint}</small>` : ''}</div>`;
}
const group = fields => Object.entries(fields).map(([key,rule])=>control(key,rule)).join('');
const quickKeys = ['body-face','size',...SPACING];
function presetCards() {
    return `<fieldset class="ilg-reading-choice" aria-describedby="ilg-type-preset-hint"><legend class="ilg-sr-only">预设排版</legend>
        ${Object.entries(BASES).map(([value,[label,detail]])=>`<label data-reading-style="${value}"><input type="radio" name="ilg-reading-style" value="${value}"><span><span class="ilg-style-name">${label}</span><span class="ilg-style-sample" aria-hidden="true"><span>微光落在纸上</span><q>故事慢慢说</q></span><span class="ilg-style-detail">${detail}</span></span></label>`).join('')}
    </fieldset>`;
}
const fieldGroup = keys => group(Object.fromEntries(keys.map(k=>[k,fields[k]])));
function markPicker(role) {
    const title=ROLES[role][0];
    const styles=[['',['跟随底稿',{}]],...Object.entries(MARKS[role])];
    return `<div data-type-style-panel="${role}" ${role==='body'?'hidden':''}>
        <div class="ilg-type-quick" role="group" aria-label="${title}字形">
            ${Object.entries(QUICK_TYPE).map(([key,{icon,label}])=>`<button type="button" aria-pressed="false" data-type-quick="${key}" data-type-quick-role="${role}"><span class="ilg-type-quick-icon" aria-hidden="true">${icon}</span>${label}</button>`).join('')}
        </div>
        <fieldset class="ilg-type-marks" data-type-marks="${role}">
        <legend class="ilg-sr-only">${title}标记样式</legend>
        ${styles.map(([key,[label]])=>`<label class="ilg-type-mark-tile"><input type="radio" name="ilg-type-${role}-mark" data-type-mark="${role}" value="${key}"><span class="ilg-type-mark-label"><span class="ilg-type-mark-sample" aria-hidden="true" style="${Object.entries(markPaint(role,key)).map(([part,value])=>`--sample-${part}:${value}`).join(';')}">${role==='body'?'这一行':'“留下来”'}</span><span>${label}</span></span></label>`).join('')}
        </fieldset></div>`;
}
const SAMPLES = {
    chinese:['风把雨送到书店门口。她合上书，灯下的纸页跟着亮起来。','“把这一页留给明天，好不好？”','她没有说出归期。','夜航手记  ·  第三页'],
    mixed:['夜里 23:47，Room 206 的灯还亮着。ABCDEFGHIJKLMNOPQRSTUVWXYZ / 0123456789','“Meet me at dawn，别忘带伞。”','注：Aa Bb Cc · 214.50 mm','Field notes  ·  第 03 页'],
};
export function createTypographyStudio({root, chat, settings, save, setBase}) {
    settings.typography = asActive(normalizeTypography(settings.typography) ?? {});
    settings.typeProfiles = normalizeProfiles(settings.typeProfiles);
    const ui = document.createElement('section');
    ui.className = 'ilg-type-studio';
    ui.setAttribute('aria-label','字体工坊');
    ui.innerHTML = `<header class="ilg-type-head"><div><h3>字体工坊</h3><p>先在这里试排，满意再应用到聊天。</p></div><span class="ilg-type-state" data-type-state></span></header>
    <section class="ilg-type-presets" aria-labelledby="ilg-type-presets-title"><h4 id="ilg-type-presets-title">预设排版</h4>${presetCards()}<p id="ilg-type-preset-hint" class="ilg-type-hint">选预设后，行距和左右留白自动跟随风格；其他自定义保留。</p></section>
    <div class="ilg-type-desk"><div class="ilg-type-proof-side"><div class="ilg-type-proof"><div class="ilg-type-proof-bar"><strong>试排页</strong><div><select aria-label="预览用字" data-type-sample><option value="chinese">中文长段</option><option value="mixed">中英数字</option></select><select aria-label="预览光线" data-type-tone><option value="auto">跟随日夜</option><option value="day">日间</option><option value="night">夜间</option></select></div></div>
    <article class="ilg-type-page" tabindex="0" data-ilg-typography aria-label="排版预览" lang="zh-CN"><p class="ilg-type-line"><span data-type-copy></span> <strong>故事还很长。</strong></p><p class="ilg-type-line"><q></q> <em></em></p><blockquote class="ilg-type-line"></blockquote><p class="ilg-type-line"><a href="#ilg-typography-proof" id="ilg-typography-proof">链接示例</a></p></article></div>
    <div class="ilg-type-actions"><button type="button" data-type-action="apply" class="ilg-type-primary">应用到聊天</button><button type="button" data-type-action="revert" hidden>撤回试排</button><button type="button" data-type-action="clear" hidden>停用自定义</button></div></div>
    <div class="ilg-type-controls"><section class="ilg-type-common" aria-labelledby="ilg-type-common-title"><h4 id="ilg-type-common-title">文字格式</h4><div class="ilg-type-grid">${fieldGroup(quickKeys)}</div><p class="ilg-type-hint">清空行距或留白的数值，即可跟随风格。</p></section>
    <section class="ilg-type-mark-section" aria-labelledby="ilg-type-marks-title"><div class="ilg-type-mark-head"><h4 id="ilg-type-marks-title">文字样式</h4><fieldset class="ilg-type-mark-tabs"><legend class="ilg-sr-only">要装饰的文字</legend><label><input type="radio" name="ilg-type-mark-role" value="quote" checked><span>对白</span></label><label><input type="radio" name="ilg-type-mark-role" value="body"><span>正文</span></label></fieldset></div>${markPicker('quote')}${markPicker('body')}</section>
    <details><summary><span>细调排版与字色</span></summary><div class="ilg-type-role-list"><div class="ilg-type-grid">${fieldGroup(['body-weight',...Object.keys(layout).filter(k=>!quickKeys.includes(k))])}</div><label for="ilg-type-role">分别调整字形和日夜色</label><select id="ilg-type-role">${options(Object.entries(ROLES).map(([r,[label]])=>[r,label]))}</select>${Object.keys(ROLES).map(role=>`<fieldset data-type-role-panel="${role}" ${role==='body'?'':'hidden'}><div class="ilg-type-grid">${role==='body'?fieldGroup(['body-style','body-scale','body-day','body-night']):group(roleFields(role))}</div></fieldset>`).join('')}<p class="ilg-type-hint">留空跟随预设。1 em 约等于当前一个字的字号。</p></div></details>
    <details><summary><span>本机字库</span></summary><div class="ilg-type-shelf"><label for="ilg-type-upload">导入字体文件</label><input type="file" id="ilg-type-upload" accept=".otf,.ttf,.woff,.woff2"><p class="ilg-type-hint">支持 WOFF2 / WOFF / TTF / OTF，单个 ≤16 MB，最多 ${FILE_LIMIT} 个。文件只存当前浏览器，不上传。</p><div data-type-files></div></div></details>
    <details><summary><span>我的排版</span></summary><div class="ilg-type-shelf"><label for="ilg-type-profile-name">方案名</label><div class="ilg-type-actions"><input id="ilg-type-profile-name" type="text" maxlength="36" placeholder="例如：深夜宋笺" autocomplete="off"><button type="button" data-type-action="save" disabled>另存方案</button></div><label for="ilg-type-profiles">已存方案</label><select id="ilg-type-profiles"></select><div class="ilg-type-actions"><button type="button" data-type-action="load">载入试排</button><button type="button" data-type-action="delete">删除方案</button><button type="button" data-type-action="export">导出 JSON</button><label class="ilg-type-file-button">导入 JSON<input type="file" data-type-import accept=".json,application/json"></label></div><p class="ilg-type-hint">方案保存底稿、参数和字体文件名，不包含字体文件。换浏览器时，重新导入同名原字体即可。</p></div></details>
    <p class="ilg-type-missing" data-type-missing hidden></p><p class="ilg-type-feedback" role="status" aria-live="polite"></p><button type="button" class="ilg-type-back" data-type-action="proof">回到试排页</button></div></div>`;
    const find = selector=>ui.querySelector(selector);
    const page = find('.ilg-type-page'), notice = find('.ilg-type-feedback');
    const profileList = find('#ilg-type-profiles'), nameBox = find('#ilg-type-profile-name');
    const controls = [...ui.querySelectorAll('[data-type-key]')];
    const quickToggles = [...ui.querySelectorAll('[data-type-quick]')];
    const presets = [...ui.querySelectorAll('[name="ilg-reading-style"]')];
    const button = key=>find(`[data-type-action="${key}"]`);
    let draft = {...settings.typography}, base = settings.readingStyle, opened = false, fontWork = Promise.resolve();
    const fonts = createTypographyFonts(render);
    const note = message=>{ notice.textContent = message; };
    function fileReferences() { return [...new Set([...filesOf(draft), ...filesOf(settings.typography)])]; }
    function applyRoot() {
        const active = settings.enabled ? settings.typography : null;
        fonts.use([...(settings.enabled ? filesOf(active) : []), ...(opened ? filesOf(draft) : [])]);
        const key = variables(chat,active,fonts);
        root.toggleAttribute('data-ilg-typography',!!active);
        if (active) { if (root.dataset.ilgTypeLayout !== key) root.dataset.ilgTypeLayout = key; }
        else root.removeAttribute('data-ilg-type-layout');
    }
    function render() {
        applyRoot();
        page.dataset.ilgReadingStyle = base;
        const tone = find('[data-type-tone]').value;
        page.classList.toggle('ilg-light',tone === 'day' || tone === 'auto' && root.classList.contains('ilg-light'));
        variables(page,draft,fonts);
        page.toggleAttribute('data-ilg-type-justify',!!settings.justifyText);
        page.toggleAttribute('data-ilg-type-indent',!!settings.firstLineIndent);
        setStyle(page,'size',draft.size ? draft.size+'px' : settings.chatFontSize ? settings.chatFontSize+'px' : '');
        for (const key of SPACING) {
            const slider = find(`[data-type-range="${key}"]`);
            if (draft[key] !== undefined) { slider.removeAttribute('aria-valuetext'); continue; }
            if (key==='leading' && page.isConnected) {
                const inherited = getComputedStyle(page.querySelector('p'));
                slider.value = parseFloat(inherited.lineHeight) / parseFloat(inherited.fontSize);
            }
            slider.setAttribute('aria-valuetext','跟随风格');
        }
        const dirty = !equal(draft,settings.typography ?? {}) || base !== settings.readingStyle;
        find('[data-type-state]').textContent = settings.enabled === false ? '扩展已暂停' : dirty ? '试排未应用' : settings.typography ? '自定义已应用' : '继承原风格';
        button('apply').disabled = !dirty;
        button('clear').hidden = !settings.typography;
        button('revert').hidden = !dirty;
        for (const toggle of quickToggles) {
            const {typeQuick:kind,typeQuickRole:role} = toggle.dataset;
            toggle.setAttribute('aria-pressed',String(QUICK_TYPE[kind].isOn(draft[`${role}-${kind}`])));
        }
        const missing = fileReferences().filter(fonts.unavailable);
        find('[data-type-missing]').hidden = !missing.length;
        find('[data-type-missing]').textContent = missing.length ? '字库暂缺：'+missing.join('、')+'。目前使用继承字体，可重新导入同名文件。' : '';
    }
    function syncControls() {
        for (const radio of presets) radio.checked = radio.value === base;
        for (const radio of ui.querySelectorAll('[data-type-mark]')) radio.checked = radio.value === (draft[radio.dataset.typeMark+'-mark'] ?? '');
        controls.forEach(syncControl);
    }
    function syncControl(el) {
        const k = el.dataset.typeKey, v = draft[k] ?? '';
        const local = find(`[data-type-system="${k}"]`);
        if (local) {
            const existing = [...el.options].filter(option=>option.value.startsWith('file:')).map(option=>option.value.slice(5));
            const wanted = [...new Set([...fonts.names(), ...(v.startsWith('file:') ? [v.slice(5)] : [])])];
            if (!equal(wanted,existing)) {
                for (const option of [...el.options]) if (option.value.startsWith('file:')) option.remove();
                for (const file of wanted) el.add(new Option('文件 · '+file + (fonts.names().includes(file)?'':'（未导入）'),'file:'+file));
            }
            const isLocal = v.startsWith('system:');
            el.value = isLocal ? 'system:' : v;
            local.hidden = !isLocal; local.value = isLocal ? v.slice(7) : '';
        } else el.value = v;
        el.removeAttribute('aria-invalid');
        const color = find(`[data-type-swatch="${k}"]`);
        if (color) color.value = v || '#777777';
        const range = find(`[data-type-range="${k}"]`);
        if (range) range.value = v === '' ? QUICK_RANGES[k] : v;
    }
    function syncProfiles(selected = profileList.value) {
        profileList.replaceChildren(new Option('选择已存方案',''),...settings.typeProfiles.map(({name},i)=>new Option(name,String(i))));
        profileList.value = [...profileList.options].some(o=>o.value===selected) ? selected : '';
        button('load').disabled = button('delete').disabled = profileList.value === '';
        button('save').disabled = !validName(clean(nameBox.value)) || settings.typeProfiles.length >= LIMIT || settings.typeProfiles.some(p=>p.name===clean(nameBox.value));
    }
    function syncFiles() {
        const list = find('[data-type-files]');
        list.replaceChildren();
        for (const file of fonts.names()) {
            const item = document.createElement('div'); item.className = 'ilg-type-file';
            const name = document.createElement('span'); name.textContent = file;
            const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '移除';
            remove.setAttribute('aria-label','移除字体 '+file);
            remove.addEventListener('click',()=>queueFont(async()=>{ await fonts.remove(file); note('已移除字体 '+file+'；使用它的方案会暂时回退。'); }));
            item.append(name,remove); list.append(item);
        }
        if (!list.children.length) list.textContent = '字库为空，可先用系统字体试排。';
        syncControls(); render();
    }
    function queueFont(action) {
        fontWork = fontWork.then(action).then(syncFiles).catch(error=>note(error instanceof Error ? error.message : '无法访问本机字库，请检查浏览器的存储权限。'));
    }
    function refreshSample() {
        const [body,quote,em,block] = SAMPLES[find('[data-type-sample]').value];
        page.querySelector('[data-type-copy]').textContent = body; page.querySelector('q').textContent = quote;
        page.querySelector('em').textContent = em; page.querySelector('blockquote').textContent = block;
    }
    function changeValue(key, value, control) {
        note('');
        const next = {...draft};
        if (value === '') delete next[key]; else next[key] = value;
        const valid = normalizeTypography(next);
        if (!valid) { control.setAttribute('aria-invalid','true'); return; }
        control.removeAttribute('aria-invalid');
        draft = valid; render();
    }
    ui.addEventListener('input',event=>{
        const el = event.target;
        if (el === nameBox) { syncProfiles(); return; }
        const {typeKey:key,typeSwatch:swatch,typeSystem:system,typeRange:range} = el.dataset;
        if (range) { const text=find(`#ilg-type-${range}`); text.value=el.value; changeValue(range,Number(el.value),text); }
        else if (swatch) { const text=find(`#ilg-type-${swatch}`); text.value=el.value; changeValue(swatch,el.value,text); }
        else if (system) {
            const value=clean(el.value);
            if (value) changeValue(system,'system:'+value,el); else changeValue(system,'',el);
        } else if (key) {
            const custom = find(`[data-type-system="${key}"]`);
            if (custom) {
                custom.hidden = el.value !== 'system:';
                if (!custom.hidden) { custom.focus(); changeValue(key,'',el); return; }
                custom.value = '';
            }
            const value = el.value;
            if (el.validity.badInput) { note(''); el.setAttribute('aria-invalid','true'); return; }
            changeValue(key,fields[key].type==='number' && value!=='' ? Number(value) : value,el);
            const color = find(`[data-type-swatch="${key}"]`);
            if (color && /^#[\da-f]{6}$/i.test(value)) color.value = value;
            const slider = find(`[data-type-range="${key}"]`);
            if (slider) slider.value = value === '' ? QUICK_RANGES[key] : value;
        }
    });
    ui.addEventListener('change',event=>{
        const el = event.target;
        if (el.matches('[name="ilg-type-mark-role"]')) for (const panel of ui.querySelectorAll('[data-type-style-panel]')) panel.hidden=panel.dataset.typeStylePanel!==el.value;
        if (el.matches('[data-type-mark]')) changeValue(el.dataset.typeMark+'-mark',el.value,el);
        if (el.matches('[data-type-tone]')) render();
        if (el.matches('[data-type-sample]')) refreshSample();
        if (el.matches('#ilg-type-role')) ui.querySelectorAll('[data-type-role-panel]').forEach(panel=>{panel.hidden=panel.dataset.typeRolePanel!==el.value;});
        if (el===profileList) syncProfiles();
        if (el.matches('#ilg-type-upload') && el.files.length) {
            const [file]=el.files; el.value='';
            queueFont(async()=>{ await fonts.add(file); note('已导入 '+file.name+'，可在各组的「字体」中选择。'); });
        }
        if (el.matches('[data-type-import]') && el.files.length) {
            const [file]=el.files; el.value='';
            void (async()=>{
                try {
                    if (file.size>16384) throw new Error();
                    const entry=JSON.parse(await file.text());
                    const next=entry?.format===FORMAT && entry.version===1 && Object.hasOwn(BASES,entry.base) && normalizeTypography(entry.values);
                    if (!next) throw new Error();
                    if (validName(entry.name)) nameBox.value=entry.name;
                    base=entry.base; draft=next; syncControls(); syncProfiles(); render(); note('已导入试排，点「应用到聊天」后生效。');
                } catch { note('这不是有效的 NVWA 排版方案，当前试排未改动。'); }
            })();
        }
    });
    function commit(values, nextBase, message) {
        settings.typography=values; settings.readingStyle=nextBase;
        base=nextBase; draft={...values}; setBase(); syncControls(); render(); save(); note(message);
    }
    function usableDraft() {
        const invalid=find('[aria-invalid]');
        if (!invalid) return true;
        const details = invalid.closest('details'); if (details) details.open = true;
        const role = invalid.closest('[data-type-role-panel]');
        if (role?.hidden) { const select=find('#ilg-type-role'); select.value=role.dataset.typeRolePanel; select.dispatchEvent(new Event('change',{bubbles:true})); }
        invalid.focus(); note('请修正标记的值，或清空该项以继承底稿。'); return false;
    }
    ui.addEventListener('click',event=>{
        if (presets.includes(event.target)) {
            base=event.target.value;
            for (const key of SPACING) {
                delete draft[key];
                syncControl(find(`#ilg-type-${key}`));
            }
            note(''); render();
            return;
        }
        const toggle=event.target.closest('[data-type-quick]');
        if (toggle) {
            const {typeQuick:kind,typeQuickRole:role}=toggle.dataset;
            const key=`${role}-${kind}`;
            const preset=QUICK_TYPE[kind];
            const value=preset.isOn(draft[key]) ? '' : preset.value;
            const input=find(`#ilg-type-${key}`);
            input.value=value;
            changeValue(key,value,input);
            return;
        }
        const action=event.target.closest('[data-type-action]')?.dataset.typeAction;
        if (event.target.closest('#ilg-typography-proof')) event.preventDefault();
        if (!action) return;
        const sel=profileList.value, saved=sel===''? null : settings.typeProfiles[Number(sel)];
        if (action==='apply' && usableDraft()) commit(asActive(draft),base,settings.enabled ? '已应用到普通聊天正文。' : '已保存，重新启用扩展后应用到聊天。');
        if (action==='clear') commit(null,settings.readingStyle,'已停用自定义，保留你储存的排版方案。');
        if (action==='proof') { find('[data-type-sample]').focus({preventScroll:true}); find('.ilg-type-proof').scrollIntoView({block:'start'}); }
        if (action==='revert') { draft={...settings.typography}; base=settings.readingStyle; syncControls(); render(); note('已撤回本次试排改动。'); }
        if (action==='save' && usableDraft()) { const name=clean(nameBox.value); settings.typeProfiles=[...settings.typeProfiles,{name,base,values:{...draft}}]; nameBox.value=''; syncProfiles(String(settings.typeProfiles.length-1)); save(); note('已储存方案「'+name+'」。'); }
        if (action==='load' && saved) { draft={...saved.values}; base=saved.base; syncControls(); render(); note('已载入试排「'+saved.name+'」，聊天尚未改动。'); }
        if (action==='delete' && saved) { settings.typeProfiles=settings.typeProfiles.filter((_,i)=>i!==Number(sel)); syncProfiles(''); save(); note('已删除存档「'+saved.name+'」，聊天与试排不变。'); }
        if (action==='export' && usableDraft()) {
            const payload={format:FORMAT,version:1,name:clean(nameBox.value)||(saved?.base===base && equal(saved.values,draft) ? saved.name : '我的排版'),base,values:draft};
            const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
            const link=document.createElement('a'); link.href=url; link.download='NVWA-排版方案.json'; link.click();
            setTimeout(()=>URL.revokeObjectURL(url),1000); note('已导出当前试排（不包含字体文件）。');
        }
    });
    ui.addEventListener('toggle',event=>{ if (event.target.open && event.target.querySelector('#ilg-type-upload')) startFonts(); },true);
    function startFonts() { if (!opened) { opened=true; queueFont(()=>fonts.init()); } }
    function sync({reset=false}={}) {
        if (reset) { draft={...settings.typography}; base=settings.readingStyle; syncControls(); syncProfiles(); }
        if (fileReferences().length) startFonts();
        render();
    }
    refreshSample(); syncControls(); syncProfiles();
    return {ui,sync,applyRoot};
}
