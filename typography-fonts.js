// Local font bytes stay in this browser's IndexedDB. Profiles store filenames only.
const FORMATS = new Map([['woff2','wOF2'], ['woff','wOFF'], ['otf','OTTO'], ['ttf','\x00\x01\x00\x00']]);
const MAX_BYTES = 16 * 1024 * 1024;
export const FILE_LIMIT = 8;
export const validFontFile = name => typeof name === 'string' && name.length <= 96
    && !/[\p{C}<>:"/\\|?*]/u.test(name) && FORMATS.has(name.split('.').pop().toLowerCase());
const familyOf = name => 'NVWAUserFont' + [...name].map(c => c.codePointAt(0).toString(16)).join('_');

export function createTypographyFonts(onChange) {
    let opening, names = [];
    const loaded = new Map();
    const pending = new Map(), unusable = new Set();
    let wanted = new Set();
    function database() {
        if (!opening) opening = new Promise((resolve, reject) => {
            const req = indexedDB.open('nvwa-typography-fonts', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('fonts');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            req.onblocked = () => reject(new Error('字库被其他页面占用，请关闭重复打开的酒馆页面。'));
        });
        return opening;
    }
    async function request(mode, action) {
        const db = await database();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('fonts', mode);
            const req = action(tx.objectStore('fonts'));
            tx.oncomplete = () => resolve(req.result);
            tx.onabort = () => reject(tx.error);
        });
    }
    async function init() {
        names = await request('readonly', store => store.getAllKeys());
        names = names.filter(validFontFile).sort((a,b) => a.localeCompare(b,'zh'));
        return names;
    }
    async function decode(name, file) {
        const source = await file.arrayBuffer();
        const face = new FontFace(familyOf(name), source, { weight: '100 900' });
        await face.load();
        return face;
    }
    async function add(file) {
        const {name, size} = file;
        if (!validFontFile(name)) throw new Error('请选择名称不超过 96 字的 WOFF2、WOFF、TTF 或 OTF 字体文件。');
        if (size < 12 || size > MAX_BYTES) throw new Error('单个字体文件不能超过 16 MB，且不能是空文件。');
        const signature = String.fromCharCode(...new Uint8Array(await file.slice(0,4).arrayBuffer()));
        if (signature !== FORMATS.get(name.split('.').pop().toLowerCase())) throw new Error('文件内容和字体格式不符。');
        await init();
        if (names.includes(name)) throw new Error('字库里已有同名文件，可在字体下拉框中直接选择。');
        if (names.length >= FILE_LIMIT) throw new Error('最多保存 8 个字体，请先移除一个。');
        try { await decode(name, file); }
        catch { throw new Error('浏览器无法读取这个字体。请换一个文件再试。'); }
        await request('readwrite', store => store.add(file, name));
        unusable.delete(name);
        names = [...names, name].sort((a,b) => a.localeCompare(b,'zh'));
    }
    async function remove(name) {
        await pending.get(name);
        await request('readwrite', store => store.delete(name));
        names = names.filter(x => x !== name);
        if (loaded.has(name)) document.fonts.delete(loaded.get(name));
        loaded.delete(name);
    }
    function use(references) {
        wanted = new Set(references);
        for (const [name, face] of loaded) {
            if (!wanted.has(name)) { document.fonts.delete(face); loaded.delete(name); }
        }
        for (const name of wanted) {
            if (!names.includes(name) || loaded.has(name) || pending.has(name) || unusable.has(name)) continue;
            const job = request('readonly', store => store.get(name)).then(file => decode(name, file)).then(face => {
                if (wanted.has(name) && names.includes(name)) { document.fonts.add(face); loaded.set(name, face); }
            }).catch(() => { unusable.add(name); }).finally(() => { pending.delete(name); onChange(); });
            pending.set(name, job);
        }
    }
    return {init, add, remove, use, names:()=>names, loaded:name=>loaded.has(name), unavailable:name=>!names.includes(name)||unusable.has(name), familyOf};
}
