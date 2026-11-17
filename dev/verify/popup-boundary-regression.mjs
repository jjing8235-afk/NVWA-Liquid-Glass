import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const source=fs.readFileSync(new URL('index.js',root),'utf8').replace(/\r\n/g,'\n');
const css=fs.readFileSync(new URL('style.css',root),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const passed=[];
const selector=source.match(/const NATIVE_POPUP_SEL = '([^']+)'/)[1];
const nativeBody=source.match(/function isNativePopup\(el\) \{([\s\S]*?)\n\}/)[1];
const trackBody=source.match(/function trackable\(el\) \{([\s\S]*?)\n\}/)[1];
const registry=[]; const ctx={Popup:{util:{popups:registry}}};
const ownedBody=source.match(/function popupOwnsStyle\(el\) \{([\s\S]*?)\n\}/)[1];
const panelSelector=source.match(/const ADAPTED_PANEL_SEL = '([^']+)'/)[1];
const panelBody=source.match(/function adaptedPanel\(el\) \{([\s\S]*?)\n\}/)[1];
function adapted(el){return vm.runInNewContext('(function(el){'+panelBody+'})(el)',{el,isNativePopup:native,ADAPTED_PANEL_SEL:panelSelector});}
function ownsStyle(el){return vm.runInNewContext('(function(el){'+ownedBody+'})(el)',{el,adaptedPanel:adapted});}
function native(el,host=ctx){return vm.runInNewContext('(function(el){'+nativeBody+'})(el)',{el,ctx:host,NATIVE_POPUP_SEL:selector});}
function popup(matches=true){return {matches(s){assert.equal(s,selector);return matches;},querySelector(){return null;}};}
const standard=popup();registry.push({dlg:standard});assert(native(standard));
assert(!native(popup()),'An unregistered look-alike is not a host popup');
const transparent=popup(false);registry.push({dlg:transparent});assert(!native(transparent));
assert(!native(standard,{}),'Absent host capability must not claim ownership');
passed.push('Only registered non-transparent host Popup instances qualify; look-alikes and absent API fail closed');
function track({id='',container=null,inDrawer=false}={}){return vm.runInNewContext('(function(el){'+trackBody+'})(el)',{el:{id,closest:()=>container},isNativePopup:native,popupOwnsStyle:ownsStyle,inDrawer:()=>inDrawer});}
assert(track({container:standard}));assert(!track({container:popup()}));
assert(!track({id:'world_popup',inDrawer:true}));assert(track({id:'nonQRFormItems'}));
passed.push('Host confirmation is trackable; custom dialogs and worldbook double-glass are not');
for(const token of ['data-ilg-preserve','preserveForeign','OWN_BODY','addPopupClose']) assert(!source.includes(token),token+' must not be present');
for(const token of ['data-ilg-preserve','ilg-popup-x']) assert(!css.includes(token),token+' must not be present');
assert(source.includes("track(floorChip, 'bar')"));assert(!source.includes("track(floorChip, 'toast')"));
assert(css.includes('dialog.popup.ilg-glass > .popup-body > .popup-controls > .menu_button'));
assert(css.includes('.popup-content, .popup-content *'));
assert(css.includes(':where(#top-bar, #top-bar *, #top-settings-holder,'));
const controlScope=source.match(/function ownsHostControl\(el\) \{[^]*?\n\}/)[0];
const paintRange = vm.runInNewContext(controlScope+';'+source.match(/function paintRange\(el\) \{[^]*?\n\}/)[0] + ';paintRange', {HOST_UI_SEL:'host',AUTHORED_CONTROL_SEL:'foreign',RANGE_THUMB:20});
for (const [workbench,host,foreign,allowed] of [[false,true,false,true],[false,true,true,false],[false,false,true,false],[true,false,true,true],[false,false,false,false]]) {
    let fill = '', writes = 0;
    const el = {min:'0',max:'100',value:'45',closest(selector){return selector === '#ilg-studio' ? workbench : selector === 'host' ? host : foreign;},style:{getPropertyValue(){return fill;},setProperty(key,value){assert.equal(key,'--ilg-fill');fill=value;writes++;}}};
    paintRange(el);paintRange(el);assert.equal(writes,allowed?1:0,'Only owned ranges receive an idempotent progress update');
    if (allowed) {assert.equal(fill,'calc(0.4500 * (100% - 20px) + 10px)');el.value='100';paintRange(el);assert.equal(fill,'calc(1.0000 * (100% - 20px) + 10px)');}
}
passed.push('Progress includes the owned workbench and host controls; foreign dialog ranges remain untouched');
passed.push('No preserve markers or injected close button; content boundary and shared-control scopes are explicit');
function contentPopup(registered,root,authored=false){const el=popup();el.querySelector=s=>{if(s===':scope > .popup-body > .popup-content')return{matches:()=>false,querySelector:()=>authored?{}:null};assert.equal(s,':scope > .popup-body > .popup-content > :is(#nvwa-panel, #nvwa-memory)');return root;};if(registered)registry.push({dlg:el});return el;}
assert(adapted(contentPopup(true,{id:'nvwa-panel'})));
assert(adapted(contentPopup(true,{id:'nvwa-memory'})));
assert(!adapted(contentPopup(false,{id:'nvwa-panel'})),'A foreign preset look-alike must not be adapted');
assert(!adapted(contentPopup(false,{id:'nvwa-memory'})),'A foreign memory look-alike must not be adapted');
assert(!adapted(contentPopup(true,null)),'Unrelated native content is not a compatible NVWA panel');
for(const id of ['nvwa-panel','nvwa-memory']){const authored=contentPopup(true,{id},true);assert(!ownsStyle(authored),'Explicit NVWA roots retain their requested glass despite embedded styles');assert(adapted(authored));assert(track({container:authored}));const lookalike=contentPopup(false,{id},true);assert(ownsStyle(lookalike));assert(!adapted(lookalike));assert(!track({container:lookalike}));}
const foreignAuthored=contentPopup(true,null,true);assert(ownsStyle(foreignAuthored));assert(!adapted(foreignAuthored));assert(!track({container:foreignAuthored}),'Other authored popups retain their own shell');
passed.push('Other registered authored popups keep their shell; explicitly supported NVWA roots retain glass');
const scopedRules=[...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].filter(m=>/#nvwa-(panel|memory)/.test(m[1]));
assert(scopedRules.length>=7);
assert(scopedRules.every(m=>m[1].trim().startsWith('html.ilg')&&m[1].includes('dialog.popup.ilg-adapted > .popup-body > .popup-content > ')));
assert(!source.includes("track(tabbar,"), 'Compatible tabbars share their registered popup shell instead of owning a second filter');
assert(css.includes('    backdrop-filter: none;'), 'Shared tabbar material must not add another backdrop filter');
assert(source.includes("'ilg-phys', 'ilg-adapted'"));
assert(source.includes('class="ilg-presets"'),'Keep the existing material preset controls layout');
assert(!source.includes('ilg-adapteds'),'Adaptation class must not rename unrelated controls');
passed.push('Only explicitly compatible preset and memory roots in registered Popup instances are adapted; foreign look-alikes and unrelated content remain untouched');
const material=source.match(/const KIND = (\{[\s\S]*?\n\});/)[1];
const kinds=vm.runInNewContext('('+material+')',{S:{barBlur:1,mesBlur:3,panelBlur:8}});
assert.equal(kinds.bar.blur(),1);assert.equal(kinds.toast.blur(),10);
passed.push('Floor shares input bar material, not toast blur');

const menuSelector=source.match(/const HOST_MENU_SEL = '([^']+)'/)[1];
const surfaceBlurSource=source.match(/function surfaceBlur\(it, el\) \{[^]*?\n\}/)[0];
const blurSettings={barBlur:.25,mesBlur:.5,panelBlur:1.5,panelRead:false,chatBackground:'glass',qrFold:true};
const blurKinds=vm.runInNewContext('('+material+')',{S:blurSettings});
const composerSource=source.match(/const composerGlassSurface = el =>[^]*?;\n/)[0];
const getSurfaceBlur=vm.runInNewContext(composerSource+surfaceBlurSource+';surfaceBlur',{S:blurSettings,KIND:blurKinds,HOST_MENU_SEL:menuSelector,controlReadable:()=>false});
const surface=(menu=false,quick=false,authored=false)=>({matches(selector){return selector===menuSelector?menu:selector==='#form_sheld #qr--bar'?quick:false;},closest(){return authored?{}:null;}});
assert.equal(getSurfaceBlur({kind:'panel'},surface(true)),6);
assert.equal(getSurfaceBlur({kind:'panel'},surface(false)),1.5);
assert.equal(getSurfaceBlur({kind:'clearPanel'},surface(false)),1.25);
assert.equal(getSurfaceBlur({kind:'panel'},surface(false,true)),6);
assert.equal(getSurfaceBlur({kind:'panel'},surface(false,true,true)),1.5);
blurSettings.qrFold=false;assert.equal(getSurfaceBlur({kind:'panel'},surface(false,true)),1.5);
blurSettings.panelBlur=18;assert.equal(getSurfaceBlur({kind:'panel'},surface(true)),6);assert.equal(getSurfaceBlur({kind:'panel'},surface()),18);
passed.push('Native composer menus and the owned folded quick tray use a stable liquid-glass blur; other panels, authored quick bars and explicit NVWA material retain their settings');
console.log(JSON.stringify({passed},null,2));
