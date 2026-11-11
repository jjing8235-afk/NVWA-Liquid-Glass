// A single local appearance bookmark. Only known visual settings are copied;
// credentials, host wallpaper, backups, master power and migration state stay outside it.
const OMIT = new Set(['enabled','customWallpaper','cssCleaned','cssBackup','cssBackupAt','lookBackup','themeBackup']);
const ENUMS = {
    chatBackground:['glass','transparent'], compatibilityMode:['auto','blur'],
    tone:['time','system','auto','light','dark'], avatar:['line','side'],
    ballSide:['left','right'], webPreset:['clear','thin','soft','crystal'],
    glassStyle:['original','liquid-web'], engine:['physical','legacy'],
    customTextTone:['auto','dark','light'], readingStyle:['warm','classic','moon','sunny'],
    profile:['lens','squircle','circle','soft'],
};
const BOUNDS = {chatVeil:[0,100],dayStart:[0,23],dayEnd:[1,24],chatFontSize:[0,32],proseLeading:[0,2.6],proseInset:[0,48],ballY:[0,1],ballFx:[0,1],ballFy:[0,1],pLight:[0,360]};
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function createAppearanceBookmark(defaults, sliders = []) {
    const keys = Object.keys(defaults).filter(key => !OMIT.has(key));
    const bounds = new Map(sliders.map(([key,,min,max]) => [key,[min,max]]));
    function valueOf(key, value) {
        if (typeof value !== typeof defaults[key]) return undefined;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) return undefined;
            const limit = bounds.get(key) || BOUNDS[key];
            if (limit && (value < limit[0] || value > limit[1])) return undefined;
            if (key === 'chatFontSize' && value !== 0 && (value < 12 || !Number.isInteger(value))) return undefined;
            return value;
        }
        if (typeof value === 'string') {
            if (ENUMS[key] && !ENUMS[key].includes(value)) return undefined;
            if (value.length > 120) return undefined;
            return value;
        }
        return undefined;
    }
    function values(settings) {
        const result = {};
        for (const key of keys) {
            const value = valueOf(key, settings[key]);
            result[key] = value === undefined ? defaults[key] : value;
        }
        return result;
    }
    function capture(settings, source = 'saved') {
        return {version:1, savedAt:new Date().toISOString(), source, values:values(settings)};
    }
    function read(snapshot) {
        if (!plain(snapshot) || snapshot.version !== 1 || !plain(snapshot.values) || typeof snapshot.savedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.savedAt))) return null;
        const result = {};
        for (const key of keys) {
            if (!Object.hasOwn(snapshot.values,key)) continue;
            const value = valueOf(key,snapshot.values[key]);
            if (value === undefined) return null;
            result[key] = value;
        }
        if (!Object.keys(result).length || (result.dayStart !== undefined && result.dayEnd !== undefined && result.dayStart >= result.dayEnd)) return null;
        return result;
    }
    function same(settings, patch) { return Object.keys(patch).every(key => settings[key] === patch[key]); }
    return {capture, read, same};
}
