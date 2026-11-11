// Upgrade only recognized stock presets; preserve custom tuning, unknown fields and settings version.
export function migrateClearOptics(settings, previous, presets) {
    if (settings.opticsRevision === 1) return { changed: false, preset: null, keys: [] };
    const oldDefaults = { barBlur: 1, mesBlur: 3, panelBlur: 8, mesTint: .5, tint: .05, highlight: .55, scrim: .35, saturate: 1.6, brightness: 1.05 };
    const current = { barBlur: .25, mesBlur: .5, panelBlur: 1.5, mesTint: .12, tint: .05, highlight: .28, scrim: .12, saturate: 1.1, brightness: 1.02 };
    const common = new Set(Object.keys(oldDefaults));
    const match = Object.entries(previous).find(([, [, values]]) => Object.entries(values).every(([key, value]) => settings[key] === value));
    const changed = [];
    if (match && settings.engine !== 'legacy') {
        for (const [key, value] of Object.entries(presets[match[0]][1])) {
            if (common.has(key) || settings[key] === value) continue;
            settings[key] = value; changed.push(key);
        }
        for (const [key, old] of Object.entries(oldDefaults)) {
            if (settings[key] === old && settings[key] !== current[key]) { settings[key] = current[key]; changed.push(key); }
        }
    }
    settings.opticsRevision = 1;
    return { changed: true, preset: match?.[0] || null, keys: changed };
}

// Repair only exact stock local.8 optics. Custom values and clarity controls stay user-owned.
export function restoreOriginalRefraction(settings, altered, original) {
    if (settings.materialRevision === 1) return { changed: false, preset: null, keys: [] };
    const shapeKeys = ['profile', 'pMagnify', 'pStrength', 'pThickness', 'pBezel', 'pIor', 'pAberration'];
    const matches = Object.entries(altered).find(([, [, values]]) => Object.entries(values)
        .filter(([key]) => key === 'profile' || /^p[A-Z]/.test(key)).every(([key, value]) => settings[key] === value));
    const changed = [];
    if (matches && settings.engine !== 'legacy') {
        const prior = original[matches[0]][1];
        for (const key of shapeKeys) if (key in prior && settings[key] !== prior[key]) { settings[key] = prior[key]; changed.push(key); }
    }
    settings.materialRevision = 1;
    return { changed: true, preset: matches?.[0] || null, keys: changed };
}
