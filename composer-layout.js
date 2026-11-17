// Composer layouts preserve the host's input and action nodes.
export const COMPOSER_LAYOUTS = Object.freeze([
    ['classic', '经典原版', '聊天、扩展、快捷各有入口'],
    ['unified', '一体三合一', '一个＋号，收进同一枚胶囊'],
    ['split', '分体三合一', '独立玻璃圆钮，留出呼吸间隙'],
]);
export const normalizeComposerLayout = value => COMPOSER_LAYOUTS.some(([key]) => key === value) ? value : 'split';
export function composerLayoutPicker() {
    const plus = x => '<path d="M'+(x-4)+' 27h8m-4-4v8"/>';
    const picture = key => {
        const pill = key === 'split' ? '<rect x="36" y="14" width="105" height="26" rx="13"/><circle cx="16" cy="27" r="13"/>' : '<rect x="3" y="14" width="138" height="26" rx="13"/>';
        const marks = key === 'classic' ? plus(15)+'<path d="m28 31 7-8m-8-1 3 1m4 6 3 1"/><circle cx="46" cy="27" r="2"/><circle cx="52" cy="27" r="2"/><path d="M64 27h35"/>' : plus(key === 'split' ? 16 : 18)+'<path d="M'+(key === 'split' ? 48 : 35)+' 27h54"/>';
        return '<svg viewBox="0 0 144 54" aria-hidden="true" fill="none"><g class="ilg-composer-preview-glass">'+pill+'</g><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+marks+'<circle class="ilg-composer-preview-send" cx="125" cy="27" r="8"/><path class="ilg-composer-preview-send-arrow" d="m121 29 4-4 4 4m-4-4v8"/></g></svg>';
    };
    return '<fieldset class="ilg-composer-choice"><legend class="ilg-sr-only">输入框样式</legend>'+COMPOSER_LAYOUTS.map(([key,label,detail]) => '<label><input type="radio" name="ilg-composer-layout" value="'+key+'"><span>'+picture(key)+'<strong>'+label+'</strong><small>'+detail+'</small></span></label>').join('')+'</fieldset>';
}
export function syncComposerLayout({root, enabled, layout, release}) {
    const mode = normalizeComposerLayout(layout), host = root.ownerDocument.getElementById('nonQRFormItems');
    root.classList.toggle('ilg-composer-split', enabled && mode === 'split');
    root.classList.toggle('ilg-composer-unified', enabled && mode === 'unified');
    if (enabled) root.dataset.ilgComposerLayout = mode; else delete root.dataset.ilgComposerLayout;
    if (!host) return;
    if (enabled && mode === 'split') {
        release(host);
        for (const [id,kind] of [['ilg-composer-plus-glass','plus'],['ilg-composer-input-glass','input']]) {
            if (root.ownerDocument.getElementById(id)) continue;
            const plane = root.ownerDocument.createElement('div');
            plane.id = id; plane.className = 'ilg-composer-glass ilg-composer-'+kind+'-glass';
            plane.setAttribute('aria-hidden','true'); host.prepend(plane);
        }
    } else for (const plane of host.querySelectorAll(':scope > .ilg-composer-glass')) { release(plane); plane.remove(); }
}
