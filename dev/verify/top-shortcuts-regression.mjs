import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../index.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const fn=source.match(/function normalizeTopStyleSettings\([^]*?\n\}/)[0];
const normalize=vm.runInNewContext(fn+';normalizeTopStyleSettings');
for(const islands of[undefined,false,true])for(const fold of[undefined,false,true])for(const dock of[undefined,false,true]){const s={islands,fold,dock,other:123};normalize(s);assert.equal(s.islands,true);assert.equal(s.fold,true);assert.equal(s.dock,false);assert.equal(s.other,123);assert.equal(normalize(s),false)}
for(const [first,second,expected]of[
['WI-SP-button','extensions-settings-button',['WI-SP-button','extensions-settings-button']],
['WI-SP-button','WI-SP-button',['WI-SP-button','']],
['','fixture-plugin23',['','fixture-plugin23']],
['missing-plugin','',['missing-plugin','']],
['persona-management-button','ilg-fold-button',['','']],
['rightNavHolder','ilg-tone-button',['','']],
['x"><img','x #evil',['','']],
[null,{},['','']],
['x'.repeat(121),42,['','']],
]){const s={topShortcut1:first,topShortcut2:second};normalize(s);assert.deepEqual([s.topShortcut1,s.topShortcut2],expected)}
const defaults=vm.runInNewContext('('+source.match(/const DEFAULTS = (\{[^]*?\n\});/)[1]+')',{PRESETS:{depth:['',{}],natural:['',{}]}});
const bookmarkSrc=fs.readFileSync(new URL('../../appearance-bookmark.js',import.meta.url),'utf8').replace(/^export /gm,'');const bookmark=vm.runInNewContext(bookmarkSrc+';createAppearanceBookmark')(defaults);
const snapshot=bookmark.capture({...defaults,topShortcut1:'WI-SP-button',topShortcut2:'extensions-settings-button'});const restored=bookmark.read(snapshot);normalize(restored);assert.equal(restored.topShortcut1,'WI-SP-button');assert.equal(restored.topShortcut2,'extensions-settings-button');
const legacy=bookmark.read({...snapshot,values:{dock:true,fold:false,islands:true}});normalize(legacy);assert(legacy.fold&&!legacy.dock);
assert(!source.includes('name="ilg-top-style"'));assert(!source.includes('TOP_STYLES'));assert(!source.includes('applyTopStyle'));
console.log(JSON.stringify({passed:true,checks:['27 legacy layout migrations are idempotent','At most two unique safe IDs; unavailable plugins retained','Two shortcuts round-trip through appearance bookmarks','Legacy bookmarks cannot restore expanded mode','No expanded layout controls remain']}));
