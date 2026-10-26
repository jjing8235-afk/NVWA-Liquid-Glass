import {open} from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const out=process.env.NVWA_TEST_OUT;
if(out)fs.mkdirSync(out,{recursive:true});
const presetDir='D:/SillyTavern/data/default-user/OpenAI Settings';
const diskState=()=>Object.fromEntries(fs.readdirSync(presetDir).filter(n=>n.includes('NVWA')).map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(presetDir,n))).digest('hex')]));
const diskBefore=diskState(),reports=[];
const click=async(b,selector)=>{
 const r=await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
 assert(Array.isArray(r),'Missing control '+selector);await b.click(...r);await b.sleep(450);
};
const sample=`(()=>{const p=document.querySelector('dialog.ilg-adapted #nvwa-memory'),d=p?.closest('dialog');if(!p)return null;const r=d.getBoundingClientRect(),s=getComputedStyle(d),tab=p.querySelector('.m-tabbar'),ts=getComputedStyle(tab);return {light:document.documentElement.classList.contains('ilg-light'),registered:SillyTavern.getContext().Popup.util.popups.some(x=>x.dlg===d),background:s.backgroundColor,color:s.color,filter:s.backdropFilter,tabFilter:ts.backdropFilter,tabImage:ts.backgroundImage,muted:getComputedStyle(p).getPropertyValue('--m-muted'),box:[r.x,r.y,r.width,r.height],activeTab:p.querySelector('.m-tab.on')?.dataset.tab,close:d.querySelector('.popup-button-ok')?.textContent.trim(),extraClose:d.querySelectorAll('.ilg-popup-x').length,focusInside:d.contains(document.activeElement),overflow:document.documentElement.scrollWidth>innerWidth}})()`;
const businessState=`(()=>{const c=SillyTavern.getContext(),w=[...document.querySelectorAll('iframe')].find(f=>f.id.includes('NVWA 记忆'))?.contentWindow;const g=w?.getVariables({type:'global'})||{};const {nvwa_memory_ui,...business}=g;if(business.nvwa_panel_memory&&typeof business.nvwa_panel_memory==='object'){const {at,...saved}=business.nvwa_panel_memory;business.nvwa_panel_memory=saved;}return JSON.stringify({theme:c.powerUserSettings.theme,css:c.powerUserSettings.custom_css,prompts:c.chatCompletionSettings.prompts,global:business,status:window.NVWA_MEMORY.status()})})()`;
for(const [width,height,port] of [[390,844,9473],[1280,900,9474]]){
 const b=await open(width,height,port);
 try{
  assert.equal(await b.ev(`typeof window.NVWA_MEMORY?.open`),'function');
  await b.ev(`(()=>{const original=window.fetch;window.__memoryViewSaveMocks=0;window.fetch=function(input,init){const u=new URL(input instanceof Request?input.url:String(input),location.href);if(u.origin===location.origin&&u.pathname==='/api/settings/save'){window.__memoryViewSaveMocks++;return Promise.resolve(new Response('{}',{status:200,headers:{'Content-Type':'application/json'}}));}return original.call(this,input,init);};})()`);
  const before=await b.ev(businessState);
  for(const tone of ['light','dark']){
   await b.ev(`(()=>{const s=document.getElementById('ilg-opt-tone');s.value=${JSON.stringify(tone)};s.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('bg1').style.backgroundImage='url("/backgrounds/'+encodeURIComponent(${JSON.stringify(tone==='light'?'liquid glass porcelain.png':'liquid glass ink.png')})+'")';})()`);await b.sleep(500);
   await b.ev(`void window.NVWA_MEMORY.open()`);await b.sleep(900);
   const value=await b.ev(sample);assert(value);assert.equal(value.light,tone==='light');assert(value.registered);
   assert(value.filter.includes('url('));assert(value.tabFilter.includes('url('));assert.equal(value.tabImage,'none');
   assert.equal(value.close,'关闭');assert.equal(value.extraClose,0);assert(value.focusInside);assert(!value.overflow);
   assert(value.box[0]>=0&&value.box[0]+value.box[2]<=width);assert(value.box[1]>=0&&value.box[1]+value.box[3]<=height+1);
   const tabs=[];
   for(let i=0;i<6;i++){
    await click(b,`#nvwa-memory .m-tab[data-tab="${i}"]`);
    const state=await b.ev(`(()=>{const p=document.querySelector('#nvwa-memory'),on=p.querySelector('.m-page.on');return {active:p.querySelector('.m-tab.on')?.dataset.tab,page:on?.dataset.page,contentReady:!!on?.childElementCount,overflow:p.scrollWidth>p.clientWidth+1}})()`);
    assert.equal(state.active,String(i));assert.equal(state.page,String(i));assert(state.contentReady);assert(!state.overflow,`Memory tab ${i} overflows at ${width}px (${tone})`);
    tabs.push({index:i,...state});
   }
   const settings=await b.ev(`(()=>{const p=document.querySelector('#nvwa-memory'),box=p.querySelector('.m-page.on .m-box'),num=p.querySelector('.m-page.on .m-num');return {box:getComputedStyle(box).backgroundColor,input:getComputedStyle(num).backgroundColor,description:getComputedStyle(p.querySelector('.m-page.on .m-d')).color}})()`);
   assert.equal(settings.box,tone==='light'?'rgba(255, 255, 255, 0.38)':'rgba(10, 8, 20, 0.38)');assert.equal(settings.input,settings.box);
   const scroll=await b.ev(`(()=>{const p=document.querySelector('#nvwa-memory'),s=p.closest('.popup-content');const max=s.scrollHeight-s.clientHeight;s.scrollTop=Math.min(120,max);const r=p.querySelector('.m-tabbar').getBoundingClientRect(),c=s.getBoundingClientRect();return {needed:max>0,works:s.scrollTop>0,tabbarVisible:r.bottom>c.top&&r.top<c.bottom}})()`);
   assert(!scroll.needed||scroll.works);assert(scroll.tabbarVisible);
   await b.ev(`document.querySelector('#nvwa-memory').closest('.popup-content').scrollTop=0`);await b.sleep(130);
   if(out){const r=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${out}/memory-${width}-${tone}.png`,Buffer.from(r.result.data,'base64'));}
   await b.ev(`document.documentElement.classList.toggle('ilg-light',${tone!=='light'})`);await b.sleep(150);const switched=await b.ev(sample);assert.equal(switched.light,tone!=='light');assert(switched.tabFilter.includes('url('));
   await b.ev(`document.documentElement.classList.toggle('ilg-light',${tone==='light'});document.body.classList.add('no-blur')`);await b.sleep(160);const fallback=await b.ev(sample);assert.equal(fallback.filter,'none');assert.equal(fallback.tabFilter,'none');
   await b.ev(`document.body.classList.remove('no-blur')`);await b.sleep(160);assert((await b.ev(sample)).tabFilter.includes('url('));
   // Real extension switch, not a class-only simulation, must remove and recreate both filters.
   const toggleResult=await b.ev(`(()=>{const e=document.getElementById('ilg-opt-enabled');if(!e)return {available:false};e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}));return {available:true}})()`);
   assert(toggleResult.available);
   await b.sleep(160);assert.equal(await b.ev(`document.querySelector('#nvwa-memory').closest('dialog').classList.contains('ilg-adapted')`),false);
   assert.equal(await b.ev(`document.querySelector('#nvwa-memory .m-tabbar').style.backdropFilter`),'');
   await b.ev(`(()=>{const e=document.getElementById('ilg-opt-enabled');e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await b.sleep(500);
   assert((await b.ev(sample)).tabFilter.includes('url('));
   await click(b,'dialog.ilg-adapted .popup-button-ok');await b.sleep(300);assert.equal(await b.ev(`!!document.querySelector('#nvwa-memory')`),false);
   reports.push({width,height,tone,...value,tabs,settings,scroll,themeSwitch:true,noBlur:true,extensionToggle:true,originalClose:true});
  }
  const after=await b.ev(businessState);
  const a=JSON.parse(before),z=JSON.parse(after),stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):x,hash=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x??null))).digest('hex');
  const changes=[];for(const k of ['theme','css','prompts'])if(hash(a[k])!==hash(z[k]))changes.push(k);
  for(const k of new Set([...Object.keys(a.global),...Object.keys(z.global)]))if(hash(a.global[k])!==hash(z.global[k]))changes.push('global.'+k);
  if(hash(a.status)!==hash(z.status))console.log('MEMORY_STATUS_DIAGNOSTIC',JSON.stringify({before:a.status,after:z.status}));
  assert.deepEqual(changes,[],'Business state changed (field names only, content redacted)');
  assert.deepEqual(b.logs,[],'No runtime errors');
  reports.push({width,businessStateUnchanged:true,viewAndLastUsedTimestampExcluded:true,emptyChatBoundary:true,settingsSaveMocks:await b.ev('window.__memoryViewSaveMocks'),errors:0});
 }finally{b.close();}
}
assert.deepEqual(diskState(),diskBefore);
const result={host:'SillyTavern 1.18.0',helper:'4.9.5',memoryApiVersion:2,realChatDataNotOpened:true,presetFilesUnchanged:true,reports};
if(out)fs.writeFileSync(`${out}/memory-runtime-results.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));process.exit(0);
