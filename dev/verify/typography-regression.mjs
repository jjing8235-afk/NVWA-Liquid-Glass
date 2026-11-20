import assert from 'node:assert/strict';
import {migrateProseSpacing,normalizeTypography} from '../../typography.js';
import {validFontFile} from '../../typography-fonts.js';
import {createAppearanceBookmark} from '../../appearance-bookmark.js';

const settings={v:9,readingStyle:'moon',typography:{size:20,'body-face':'file:霜叶.woff2','quote-night':'#FFAA33'}};
assert.deepEqual(normalizeTypography(settings.typography),{size:20,'body-face':'file:霜叶.woff2','quote-night':'#ffaa33'});
assert.deepEqual(normalizeTypography({'body-mark':'rail','quote-mark':'wave'}),{'quote-mark':'wave','body-mark':'rail'});
assert.deepEqual(normalizeTypography({'quote-mark':'wash'}),{'quote-mark':'wash'});
const styled={'body-style':'italic','body-scale':1.15,'quote-weight':700,'quote-style':'normal','quote-scale':1.25};
assert.deepEqual(normalizeTypography(styled),styled);
const rejected=[null,[],{size:'20'},{size:Infinity},{leading:4},{tracking:-.19},{align:'right'},{'quote-mark':'glow'},{'body-mark':'wave'},{'quote-mark':'rail'},
    {'body-style':'oblique 20deg'},{'body-scale':.95},{'quote-scale':'1.15'},{'quote-scale':1.6},
    {'body-face':'system:Arial", url(x)'},{'body-face':'file:../fake.ttf'},{'body-face':'file:unsafe.svg'},
    {'body-day':'rgb(1,2,3)'},{'body-day':'#abcdefgh'},{'font-feature-settings':'anything'},JSON.parse('{"__proto__":{}}')];
for (const value of rejected) assert.equal(normalizeTypography(value),null,JSON.stringify(value));
for (const [file,expected] of [['字型.TTF',true],['a.woff',true],['fake\\folder.otf',false],['fake;data.png',false],['\u0000name.otf',false]]) assert.equal(validFontFile(file),expected);
const bookmark=createAppearanceBookmark({readingStyle:'warm',typography:null});
const oldSettings={readingStyle:'moon',proseLeading:2.4,proseInset:16,typography:{leading:2.2,size:20}};
const migrated={...oldSettings};
migrateProseSpacing(migrated); migrateProseSpacing(migrated);
assert.deepEqual(migrated,{readingStyle:'moon',proseLeading:0,proseInset:0,typography:{size:20,leading:2.2,inset:16}});
const spacingBookmark=createAppearanceBookmark({readingStyle:'warm',proseLeading:0,proseInset:0,typography:null});
assert.deepEqual(spacingBookmark.read(spacingBookmark.capture(oldSettings)),migrated);
const combined=spacingBookmark.read({version:1,savedAt:'2026-11-19T00:00:00Z',values:{proseLeading:2.3,proseInset:9}});
assert.deepEqual(combined,{proseLeading:0,proseInset:0,typography:{leading:2.3,inset:9}});
const snapshot=bookmark.capture(settings);
assert.deepEqual(bookmark.read(snapshot).typography,normalizeTypography(settings.typography));
assert(bookmark.same({...settings,typography:normalizeTypography(settings.typography)},bookmark.read(snapshot)));
assert.deepEqual(bookmark.read({...snapshot,values:{readingStyle:'classic'}}),{readingStyle:'classic',typography:null});
assert.equal(bookmark.read({...snapshot,values:{readingStyle:'classic',typography:{size:999}}}),null);
console.log(`Typography: strict settings and profile boundary (${rejected.length} rejected inputs), local filename checks, legacy spacing migration, legacy and custom appearance bookmarks passed.`);
