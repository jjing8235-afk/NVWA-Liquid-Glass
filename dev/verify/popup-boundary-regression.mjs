import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const source=fs.readFileSync(new URL('index.js',root),'utf8').replace(/\r\n/g,'\n');
const css=fs.readFileSync(new URL('style.css',root),'utf8');
const passed=[];
const selector=source.match(/const NATIVE_POPUP_SEL = '([^']+)'/)[1];
const nativeBody=source.match(/function isNativePopup\(el\) \{([\s\S]*?)\n\}/)[1];
const trackBody=source.match(/function trackable\(el\) \{([\s\S]*?)\n\}/)[1];
const registry=[]; const ctx={Popup:{util:{popups:registry}}};
function native(el,host=ctx){return vm.runInNewContext('(function(el){'+nativeBody+'})(el)',{el,ctx:host,NATIVE_POPUP_SEL:selector});}
function popup(matches=true){return {matches(s){assert.equal(s,selector);return matches;}};}
const standard=popup();registry.push({dlg:standard});assert(native(standard));
assert(!native(popup()),'An unregistered look-alike is not a host popup');
const transparent=popup(false);registry.push({dlg:transparent});assert(!native(transparent));
assert(!native(standard,{}),'Absent host capability must not claim ownership');
passed.push('Only registered non-transparent host Popup instances qualify; look-alikes and absent API fail closed');
function track({id='',container=null,inDrawer=false}={}){return vm.runInNewContext('(function(el){'+trackBody+'})(el)',{el:{id,closest:()=>container},isNativePopup:native,inDrawer:()=>inDrawer});}
assert(track({container:standard}));assert(!track({container:popup()}));
assert(!track({id:'world_popup',inDrawer:true}));assert(track({id:'nonQRFormItems'}));
passed.push('Host confirmation is trackable; custom dialogs and worldbook double-glass are not');
for(const token of ['data-ilg-preserve','preserveForeign','OWN_BODY','addPopupClose']) assert(!source.includes(token),token+' must not be present');
for(const token of ['data-ilg-preserve','ilg-popup-x']) assert(!css.includes(token),token+' must not be present');
assert(source.includes("track(floorChip, 'bar')"));assert(!source.includes("track(floorChip, 'toast')"));
assert(css.includes('dialog.popup.ilg-glass > .popup-body > .popup-controls > .menu_button'));
assert(css.includes('.popup-content, .popup-content *'));
assert(css.includes(':where(#top-bar, #top-bar *, #top-settings-holder,'));
assert(source.includes("if (!el.closest(HOST_UI_SEL) || el.closest('dialog, .popup, [role=\"dialog\"]:not(.ilg-recent)')) return;"));
passed.push('No preserve markers or injected close button; content boundary and shared-control scopes are explicit');
const panelSelector=source.match(/const ADAPTED_PANEL_SEL = '([^']+)'/)[1];
const panelBody=source.match(/function adaptedPanel\(el\) \{([\s\S]*?)\n\}/)[1];
function adapted(el){return vm.runInNewContext('(function(el){'+panelBody+'})(el)',{el,isNativePopup:native,ADAPTED_PANEL_SEL:panelSelector});}
function contentPopup(registered,root){const el=popup();el.querySelector=s=>{assert.equal(s,':scope > .popup-body > .popup-content > :is(#nvwa-panel, #nvwa-memory)');return root;};if(registered)registry.push({dlg:el});return el;}
assert(adapted(contentPopup(true,{id:'nvwa-panel'})));
assert(adapted(contentPopup(true,{id:'nvwa-memory'})));
assert(!adapted(contentPopup(false,{id:'nvwa-panel'})),'A foreign preset look-alike must not be adapted');
assert(!adapted(contentPopup(false,{id:'nvwa-memory'})),'A foreign memory look-alike must not be adapted');
assert(!adapted(contentPopup(true,null)),'Unrelated native content is not a compatible NVWA panel');
const scopedRules=[...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].filter(m=>/#nvwa-(panel|memory)/.test(m[1]));
assert(scopedRules.length>=7);
assert(scopedRules.every(m=>m[1].trim().startsWith('html.ilg')&&m[1].includes('dialog.popup.ilg-adapted > .popup-body > .popup-content > ')));
assert(source.includes("if (tabbar) track(tabbar, 'panelTab')"));
assert(source.includes("'ilg-phys', 'ilg-adapted'"));
assert(source.includes('class="ilg-presets"'),'Keep the existing material preset controls layout');
assert(!source.includes('ilg-adapteds'),'Adaptation class must not rename unrelated controls');
passed.push('Only explicitly compatible preset and memory roots in registered Popup instances are adapted; foreign look-alikes and unrelated content remain untouched');
const material=source.match(/const KIND = (\{[\s\S]*?\n\});/)[1];
const kinds=vm.runInNewContext('('+material+')',{S:{barBlur:1,mesBlur:3,panelBlur:8}});
assert.equal(kinds.bar.blur(),1);assert.equal(kinds.toast.blur(),10);
passed.push('Floor shares input bar material, not toast blur');
console.log(JSON.stringify({passed},null,2));
