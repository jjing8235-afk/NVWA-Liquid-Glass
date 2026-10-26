// 本地 8090 宿主烟测：只打开临时弹窗并取消；不提交聊天或保存业务数据。
import {open} from './lib.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const output=process.env.NVWA_TEST_OUT;
if(output)fs.mkdirSync(output,{recursive:true});
const report=[];
const rectClick=async(b,selector)=>{
 const r=await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
 assert(Array.isArray(r),'Missing click target '+selector);await b.click(...r);await b.sleep(500);
};
for(const [width,height,port] of [[390,844,9458],[1280,900,9459]]){
 const b=await open(width,height,port);
 try{
  assert.equal(await b.ev('!!window.SillyTavern?.getContext().Popup?.util?.popups'),true);
  const before=await b.ev(`JSON.stringify({theme:SillyTavern.getContext().powerUserSettings.theme,css:SillyTavern.getContext().powerUserSettings.custom_css})`);
  const originalLight=await b.ev(`document.documentElement.classList.contains('ilg-light')`);
  for(const tone of ['dark','light']){
   await b.ev(`document.documentElement.classList.toggle('ilg-light',${tone==='light'})`);
   // Independent and host-nested custom fixtures, including a dialog-like impostor.
   const fixture=await b.ev(`(()=>{
    const markup='<div class="menu_button">自带样式按钮</div><textarea class="text_pole">插件内容</textarea><input type="range" value="40"><input type="checkbox">';
    const style=document.createElement('style');style.id='nvwa-popup-test-style';style.textContent='.nvwa-test-ui{color:rgb(203,213,225);background:rgb(24,32,48);font-family:serif;border-radius:7px}.nvwa-test-ui .menu_button{color:rgb(230,210,180);background:rgb(45,60,80);filter:brightness(.91);border-radius:3px;box-shadow:none}.nvwa-test-ui .text_pole{color:rgb(200,210,220);background:rgb(30,42,55);border-color:rgb(50,60,70)}.nvwa-test-ui input[type=range]{height:12px;background:rgb(50,70,90)}';document.head.append(style);
    const mount=(id,parent,tag='section')=>{const el=document.createElement(tag);el.id=id;el.className='nvwa-test-ui';el.innerHTML=markup;parent.append(el);return el};
    mount('nvwa-test-independent',document.body).style.cssText='position:fixed;left:15px;top:90px;width:280px';
    const nested=mount('nvwa-test-nested',document.getElementById('sheld'));nested.setAttribute('role','dialog');nested.hidden=true;
    const fake=mount('nvwa-test-fake',document.body,'dialog');fake.classList.add('popup');fake.dataset.id='test-not-in-host-registry';
    const sample=()=>Object.fromEntries(['nvwa-test-independent','nvwa-test-nested','nvwa-test-fake'].map(id=>[id,[...document.getElementById(id).querySelectorAll('.menu_button,.text_pole,input')].map(x=>{const s=getComputedStyle(x);return {bg:s.backgroundColor,color:s.color,filter:s.filter,shadow:s.boxShadow,radius:s.borderRadius,height:s.height}})]));
    const on=sample();document.documentElement.classList.remove('ilg');const off=sample();document.documentElement.classList.add('ilg');return {on,off};
   })()`);
   assert.deepEqual(fixture.on,fixture.off,'Custom fixture controls must keep their own computed styles');
   await b.sleep(250);
   const untouched=await b.ev(`['nvwa-test-independent','nvwa-test-nested','nvwa-test-fake'].every(id=>!document.getElementById(id).querySelector('.ilg-glass')&&!document.getElementById(id).classList.contains('ilg-glass'))`);
   assert(untouched,'Custom fixtures must not receive glass');
   await b.ev(`for(const id of ['nvwa-test-independent','nvwa-test-nested','nvwa-test-fake','nvwa-popup-test-style'])document.getElementById(id)?.remove()`);
   await b.ev(`(()=>{const c=SillyTavern.getContext();void c.callGenericPopup('<h3>NVWA 原生弹窗</h3><p>这是一条安全的显示测试，点击取消即可返回。</p>',c.POPUP_TYPE.CONFIRM,'',{okButton:'继续',cancelButton:'取消'});})()`);
   await b.sleep(700);
   const native=await b.ev(`(()=>{const d=document.querySelector('dialog.popup[open]');const s=getComputedStyle(d),r=d.getBoundingClientRect(),btn=d.querySelector('.popup-button-cancel');return {light:document.documentElement.classList.contains('ilg-light'),cls:d.className,filter:s.backdropFilter,bg:s.backgroundColor,color:s.color,box:[r.x,r.y,r.width,r.height],okColor:getComputedStyle(d.querySelector('.popup-button-ok')).color,nativeClose:d.querySelectorAll(':scope > .popup-button-close').length,extraClose:d.querySelectorAll('.ilg-popup-x').length,buttonHeight:btn.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth,marked:document.querySelectorAll('[data-ilg-preserve]').length,focusInside:d.contains(document.activeElement)}})()`);
   assert.equal(native.light,tone==='light','Measured mode must match requested mode');
   assert.equal(native.okColor,'rgb(255, 255, 255)');assert(native.cls.includes('ilg-glass'));assert.notEqual(native.filter,'none');assert.equal(native.extraClose,0);assert.equal(native.nativeClose,1);assert(native.buttonHeight>=44);assert(!native.overflow);assert.equal(native.marked,0);assert(native.focusInside);
   assert(native.box[0]>=0&&native.box[0]+native.box[2]<=width);
   if(output){const shot=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/native-${width}-${tone}.png`,Buffer.from(shot.result.data,'base64'));}
   await rectClick(b,'dialog.popup[open] .popup-button-cancel');
   assert.equal(await b.ev(`document.querySelectorAll('dialog.popup[open]').length`),0);
   assert.equal(await b.ev(`SillyTavern.getContext().Popup.util.lastResult.result`),0);
   // Display-only host popup: use its existing close button, no injected control.
   await b.ev(`(()=>{const c=SillyTavern.getContext();void c.callGenericPopup('原生展示弹窗：测试已有关闭按钮。',c.POPUP_TYPE.DISPLAY);})()`);await b.sleep(400);
   await rectClick(b,'dialog.popup[open] > .popup-button-close');
   assert.equal(await b.ev(`document.querySelectorAll('dialog.popup[open]').length`),0);
   // The host's explicit transparent mode must remain transparent and untracked.
   await b.ev(`(()=>{const c=SillyTavern.getContext();void c.callGenericPopup('透明弹窗测试',c.POPUP_TYPE.CONFIRM,'',{transparent:true});})()`);await b.sleep(350);
   assert.equal(await b.ev(`document.querySelector('dialog.popup[open]').classList.contains('ilg-glass')`),false);
   await rectClick(b,'dialog.popup[open] .popup-button-cancel');
   report.push({width,height,tone,native,customControlsUnchanged:true,nativeCancelClosed:true,nativeCloseClosed:true,transparentPreserved:true});
  }
  await b.ev(`document.documentElement.classList.toggle('ilg-light',${originalLight})`);
  const material=await b.ev(`(()=>{const floor=document.getElementById('ilg-floor'),input=document.getElementById('nonQRFormItems');return {floorBg:getComputedStyle(floor).backgroundColor,inputBg:getComputedStyle(input).backgroundColor,floorShadow:getComputedStyle(floor).boxShadow,inputShadow:getComputedStyle(input).boxShadow,marked:document.querySelectorAll('[data-ilg-preserve]').length}})()`);
  assert.equal(material.floorBg,material.inputBg);assert.equal(material.floorShadow,material.inputShadow);assert.equal(material.marked,0);
  report.push({width,floorInputMaterialEqual:true});
  // Real summary extension popout; never edit its textarea or click summarize/save.
  const summaryButton=await b.ev(`(()=>{const e=document.querySelector('#summaryExtensionPopoutButton');if(!e)return null;e.click();return true})()`);
  if(summaryButton){
   await b.sleep(650);
   const summary=await b.ev(`(()=>{const e=document.getElementById('summaryExtensionPopout');if(!e)return null;const sample=()=>[e,...e.querySelectorAll('.text_pole,.menu_button,input[type="range"]')].map(x=>{const s=getComputedStyle(x);return {bg:s.backgroundColor,color:s.color,filter:s.filter,backdrop:s.backdropFilter,radius:s.borderRadius}});const on=sample();document.documentElement.classList.remove('ilg');const off=sample();document.documentElement.classList.add('ilg');return {glass:e.classList.contains('ilg-glass'),marked:e.hasAttribute('data-ilg-preserve'),on,off}})()`);
   assert(summary);assert.equal(summary.glass,false);assert.equal(summary.marked,false);assert.deepEqual(summary.on,summary.off);
   if(output){const shot=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${output}/summary-${width}.png`,Buffer.from(shot.result.data,'base64'));}
   await b.ev(`document.getElementById('summaryExtensionPopoutClose')?.click()`);await b.sleep(600);
   assert.equal(await b.ev(`!!document.getElementById('summaryExtensionPopout')`),false);
   report.push({width,summaryUnchanged:true,summaryOriginalClose:true});
  }else report.push({width,summary:'not available'});
  assert.equal(await b.ev(`JSON.stringify({theme:SillyTavern.getContext().powerUserSettings.theme,css:SillyTavern.getContext().powerUserSettings.custom_css})`),before);
  assert.deepEqual(b.logs,[],'New browser exceptions/errors');
 }finally{b.close();}
}
if(output)fs.writeFileSync(`${output}/runtime-results.json`,JSON.stringify({report},null,2));
console.log(JSON.stringify({report},null,2));
process.exit(0);
