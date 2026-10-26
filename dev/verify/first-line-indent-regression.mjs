import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
const source=fs.readFileSync(new URL('index.js',root),'utf8').replace(/\r\n/g,'\n');
const css=fs.readFileSync(new URL('style.css',root),'utf8');
const defaults=source.match(/const DEFAULTS = (\{[\s\S]*?\n\});/)[1];
const DEFAULTS=vm.runInNewContext('('+defaults+')',{PRESETS:{depth:['',{}],natural:['',{}]}});
assert.equal(DEFAULTS.firstLineIndent,false);
const merge=source.match(/ctx\.extensionSettings\[MODULE\] = (Object\.assign\([^;]+\));/)[1];
for(const saved of [{},{firstLineIndent:true},{firstLineIndent:false}]){
 const ctx={extensionSettings:{test:{...saved,unknown:'keep'}}};
 const merged=vm.runInNewContext(merge,{ctx,MODULE:'test',DEFAULTS});
 assert.equal(merged.firstLineIndent,saved.firstLineIndent??false);assert.equal(merged.unknown,'keep');
}
assert(source.includes("['firstLineIndent', '普通正文首行缩进两个汉字"));
const handler=source.match(/if \(k === 'firstLineIndent'\) \{([\s\S]*?)\n        \}/)[1];
let saves=0;const classes=new Set();
const fake={classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}};
for(const [enabled,preference,expected] of [[true,true,true],[true,false,false],[false,true,false]]){
 vm.runInNewContext('(function(){'+handler+'})()',{root:fake,S:{enabled,firstLineIndent:preference},ctx:{saveSettingsDebounced(){saves++;}}});
 assert.equal(classes.has('ilg-indent'),expected);
}
assert.equal(saves,3);assert(!/applyRoot|repaintAll|clearAll/.test(handler));
assert(source.includes("root.classList.toggle('ilg-indent', S.enabled && !!S.firstLineIndent)"));
const rule=css.match(/(html\.ilg\.ilg-indent[^{}]+)\{\s*text-indent: 2em;\s*\}/);
assert(rule&&rule[1].includes('.mes_text > p:not([class]):not([style])'));
assert(rule[1].includes(':not(:has(')&&rule[1].includes(':not(.smallSysMes)'));
console.log(JSON.stringify({passed:['New settings default off; old saved true/false and unrelated fields preserved','Preference toggle updates root and saves once without rebuilding glass','Enabled/disabled root gate and conservative paragraph-only CSS boundary present']},null,2));
