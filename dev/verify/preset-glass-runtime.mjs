import {open} from './lib.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Real NVWA preset script inside the installed host; no Save or Reset actions.
const out=process.env.NVWA_TEST_OUT;
if(out)fs.mkdirSync(out,{recursive:true});
const presetDir='D:/SillyTavern/data/default-user/OpenAI Settings';
const diskState=()=>Object.fromEntries(fs.readdirSync(presetDir).filter(n=>n.includes('NVWA')).map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(presetDir,n))).digest('hex')]));
const diskBefore=diskState();
const reports=[];
const getFrame=`[...document.querySelectorAll('iframe')].find(f=>f.id.includes('NVWA 预设面板'))?.contentWindow`;
const sample=`(()=>{
 const p=document.querySelector('dialog.ilg-adapted #nvwa-panel'),d=p?.closest('dialog');if(!p)return null;
 const style=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {class:e.className,background:s.backgroundColor,image:s.backgroundImage,color:s.color,filter:s.backdropFilter,radius:s.borderRadius,box:[r.x,r.y,r.width,r.height],scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}};
 const tab=p.querySelector('.nvp-tabbar'),section=p.querySelector('.nvp-sec-inner');
 return {light:document.documentElement.classList.contains('ilg-light'),registered:SillyTavern.getContext().Popup.util.popups.some(x=>x.dlg===d),dialog:style(d),panel:style(p),tabbar:style(tab),section:style(section),note:style(p.querySelector('.nvp-foot')),focusInside:d.contains(document.activeElement),extraClose:d.querySelectorAll('.ilg-popup-x').length,save:d.querySelector('.popup-button-ok')?.textContent.trim(),cancel:d.querySelector('.popup-button-cancel')?.textContent.trim(),overflow:document.documentElement.scrollWidth>innerWidth};
})()`;
const rectClick=async(b,selector)=>{
 const r=await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
 assert(Array.isArray(r),'Missing visible control '+selector);await b.click(...r);await b.sleep(220);
};
for(const [width,height,port] of [[390,844,9471],[1280,900,9472]]){
 const b=await open(width,height,port);
 try{
  assert.equal(await b.ev(`!!(${getFrame})?.eventEmit`),true,'Real preset helper script must be loaded');
  // Closing the original panel normally saves view-only tab state. Keep this test browser-local.
  await b.ev(`(()=>{const original=window.fetch;window.__nvwaPresetSaveMocks=0;window.fetch=function(input,init){const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin===location.origin&&url.pathname==='/api/settings/save'){window.__nvwaPresetSaveMocks++;return Promise.resolve(new Response(JSON.stringify({result:'ok'}),{status:200,headers:{'Content-Type':'application/json'}}));}return original.call(this,input,init);};})()`);
  const stateBefore=await b.ev(`JSON.stringify({theme:SillyTavern.getContext().powerUserSettings.theme,css:SillyTavern.getContext().powerUserSettings.custom_css,prompts:SillyTavern.getContext().chatCompletionSettings.prompts})`);
  for(const tone of ['light','dark']){
   await b.ev(`(()=>{document.documentElement.classList.toggle('ilg-light',${tone==='light'});document.getElementById('bg1').style.backgroundImage='url("/backgrounds/'+encodeURIComponent(${JSON.stringify(tone==='light'?'liquid glass porcelain.png':'liquid glass ink.png')})+'")'})()`);
   await b.ev(`(()=>{const select=document.getElementById('ilg-opt-tone');select.value=${JSON.stringify(tone)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   await b.sleep(450);
   await b.ev(`(()=>{const w=${getFrame};void w.eventEmit(w.getButtonEvent('预设面板'));})()`);
   await b.sleep(900);
   const value=await b.ev(sample);
   assert(value,'Scoped preset marker must exist');
   assert.equal(value.light,tone==='light');assert(value.registered);
   assert(value.dialog.class.includes('ilg-phys'));assert(value.dialog.filter.includes('url('));
   assert(value.tabbar.class.includes('ilg-glass'));assert(value.tabbar.filter.includes('url('));
   assert(!value.tabbar.image.includes('linear-gradient'),'Opaque stacked gradients must not cover the tab glass');
   assert.equal(value.section.background,tone==='light'?'rgba(255, 255, 255, 0.38)':'rgba(10, 8, 20, 0.38)');
   assert(!value.overflow);assert(value.dialog.box[0]>=0&&value.dialog.box[0]+value.dialog.box[2]<=width);
   assert(value.dialog.box[1]>=0&&value.dialog.box[1]+value.dialog.box[3]<=height+1);
   assert(value.focusInside);assert.equal(value.extraClose,0);assert.equal(value.save,'保存');assert.equal(value.cancel,'取消');
   if(out){const shot=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${out}/preset-${width}-${tone}.png`,Buffer.from(shot.result.data,'base64'));}
   // Real pointer tab and section actions are view-only; never touch preset option switches.
   await rectClick(b,'#nvwa-panel .nvp-tab:nth-of-type(2)');
   const tabChanged=await b.ev(`(()=>{const t=document.querySelector('#nvwa-panel .nvp-tab:nth-of-type(2)');return t?.getAttribute('aria-selected')==='true'||t?.classList.contains('on')})()`);
   assert(tabChanged,'Preset tab action must still work');
   const scroll=await b.ev(`(()=>{const d=document.querySelector('dialog.ilg-adapted');const boxes=[d,d.querySelector('.popup-content')];const s=boxes.find(e=>e&&e.scrollHeight>e.clientHeight);if(!s)return {needed:false};const max=s.scrollHeight-s.clientHeight;s.scrollTop=Math.min(100,max);return {needed:true,works:s.scrollTop>0};})()`);
   assert(!scroll.needed||scroll.works,'Preset must remain scrollable');
   // In-place theme change, no reopen, must recolor the already tracked glass.
   await b.ev(`document.documentElement.classList.toggle('ilg-light',${tone!=='light'})`);await b.sleep(180);
   const switched=await b.ev(sample);assert.equal(switched.light,tone!=='light');assert(switched.tabbar.filter.includes('url('));
   await b.ev(`document.documentElement.classList.toggle('ilg-light',${tone==='light'})`);
   // Reduced-effects fallbacks and extension-off CSS must restore original preset styling.
   await b.ev(`document.body.classList.add('no-blur','reduced-motion')`);await b.sleep(200);
   const fallback=await b.ev(sample);assert.equal(fallback.dialog.filter,'none');assert.equal(fallback.tabbar.filter,'none');
   await b.ev(`document.body.classList.remove('no-blur','reduced-motion')`);await b.sleep(200);
   const restored=await b.ev(sample);assert(restored.tabbar.filter.includes('url('));
   const off=await b.ev(`(()=>{document.documentElement.classList.remove('ilg');const p=document.querySelector('#nvwa-panel');return {bg:getComputedStyle(p.querySelector('.nvp-sec-inner')).backgroundColor,tab:getComputedStyle(p.querySelector('.nvp-tabbar')).backgroundImage}})()`);
   assert.equal(off.bg,'rgba(0, 0, 0, 0.3)');assert(off.tab.includes('linear-gradient'));
   await b.ev(`document.documentElement.classList.add('ilg')`);
   const filterIds=await b.ev(`[...document.querySelectorAll('dialog.ilg-adapted,dialog.ilg-adapted .ilg-glass')].map(e=>e.style.backdropFilter.match(/#([^"\)]+)/)?.[1]).filter(Boolean)`);
   await rectClick(b,'dialog.ilg-adapted .popup-button-cancel');await b.sleep(350);
   assert.equal(await b.ev(`!!document.querySelector('#nvwa-panel')`),false);
   assert.equal(await b.ev(`(${JSON.stringify(filterIds)}).every(id=>!document.getElementById(id))`),true,'Closed panel filters must be removed');
   reports.push({width,height,tone,...value,tabChanged,scroll,themeSwitch:true,noBlur:true,extensionOff:true,cancelClosed:true,filterCleanup:true});
  }
  // ID alone, even inside a nested native content area, is not the approved direct panel root.
  const boundary=await b.ev(`(()=>{const e=document.createElement('dialog');e.className='popup';e.dataset.id='not-registered';e.innerHTML='<div class="popup-body"><div class="popup-content"><div id="nvwa-panel"><div class="nvp-tabbar"></div></div></div></div>';document.body.append(e);const s=getComputedStyle(e.querySelector('#nvwa-panel'));const result={adapted:e.classList.contains('ilg-adapted'),presetVariable:s.getPropertyValue('--nvp-surface')};e.remove();return result})()`);
  assert.equal(boundary.adapted,false);assert.equal(boundary.presetVariable,'');
  await b.ev(`(()=>{const c=SillyTavern.getContext();void c.callGenericPopup('<section><div id="nvwa-panel">Nested fixture, not the compatible panel.</div></section>',c.POPUP_TYPE.CONFIRM)})()`);await b.sleep(500);
  assert.equal(await b.ev(`document.querySelector('dialog.popup[open]').classList.contains('ilg-adapted')`),false);
  await rectClick(b,'dialog.popup[open] .popup-button-cancel');
  assert.equal(await b.ev(`JSON.stringify({theme:SillyTavern.getContext().powerUserSettings.theme,css:SillyTavern.getContext().powerUserSettings.custom_css,prompts:SillyTavern.getContext().chatCompletionSettings.prompts})`),stateBefore,'Preset prompts and theme must remain unchanged');
  assert.deepEqual(b.logs,[],'No runtime exceptions or error logs');
  reports.push({width,foreignLookalikeUntouched:true,nestedContentUntouched:true,promptsAndThemeUnchanged:true,browserLocalViewSaveMocks:await b.ev('window.__nvwaPresetSaveMocks'),unexpectedErrors:b.logs.length});
 }finally{b.close();}
}
assert.deepEqual(diskState(),diskBefore,'NVWA preset source files must not change');
if(out)fs.writeFileSync(`${out}/runtime-results.json`,JSON.stringify({host:'SillyTavern 1.18.0',helper:'4.9.5',presetFilesUnchanged:true,reports},null,2));
console.log(JSON.stringify({presetFilesUnchanged:true,reports},null,2));
process.exit(0);
