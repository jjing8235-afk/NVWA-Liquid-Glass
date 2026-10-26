// 在本地宿主检查自有菜单；只切换临时 DOM 状态，不保存主题或操作世界书内容。
import {open} from './lib.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out=process.env.NVWA_TEST_OUT; if(out)fs.mkdirSync(out,{recursive:true});
const reports=[];
const rgba=s=>{const n=s.match(/[\d.]+/g)?.map(Number);assert(n?.length>=3,s);return [...n.slice(0,3),n[3]??1];};
const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const [width,height,port] of [[320,740,9471],[390,844,9472],[441,850,9473],[1280,900,9474]]){
 const b=await open(width,height,port);
 const key=async k=>{await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:k,code:k===' '?'Space':k});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k===' '?'Space':k});await b.sleep(100);};
 const click=async sel=>{const xy=await b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);assert(Array.isArray(xy),sel);await b.click(...xy);await b.sleep(350);};
 try{
  const settings=await b.ev(`JSON.stringify({theme:SillyTavern.getContext().powerUserSettings.theme,css:SillyTavern.getContext().powerUserSettings.custom_css})`);
  for(const tone of ['light','dark']){
   await b.ev(`document.documentElement.classList.toggle('ilg-light',${tone==='light'});document.querySelector('#ilg-fold-button .ilg-fold-icon').focus()`);await key('Enter');await b.sleep(300);
   const info=await b.ev(`(()=>{const m=document.getElementById('ilg-fold-menu'),r=m.getBoundingClientRect();const samples=[...m.querySelectorAll('.ilg-fold-row-text b,.ilg-fold-row-text small,.ilg-fold-cap,.ilg-fold-label,.ilg-fold-glyph')].map(e=>{const x=getComputedStyle(e);let p=e,backgrounds=[];while(p&&p!==m){backgrounds.unshift(getComputedStyle(p).backgroundColor);p=p.parentElement;}return {color:x.color,opacity:x.opacity,shadow:x.textShadow,backgrounds,icon:e.matches('.ilg-fold-glyph')};});return {light:document.documentElement.classList.contains('ilg-light'),hidden:m.hidden,bg:getComputedStyle(m).backgroundColor,font:getComputedStyle(m).fontFamily,box:[r.x,r.y,r.width,r.height],overflow:document.documentElement.scrollWidth>innerWidth,focused:m.contains(document.activeElement),count:m.querySelectorAll('button').length,samples}})()`);
   assert.equal(info.light,tone==='light');assert(!info.hidden);assert(info.focused);assert(!info.overflow);assert(info.box[0]>=0&&info.box[0]+info.box[2]<=width);assert(info.box[1]+info.box[3]<=height);assert(info.count>=8);
   let minText=100,minIcon=100;
   for(const sample of info.samples){assert.equal(sample.opacity,'1');assert(sample.shadow==='none'||sample.shadow.startsWith('rgba(0, 0, 0, 0)'),'Visible text shadow: '+sample.shadow);for(const backdrop of [[0,0,0],[255,255,255]]){let bg=over(rgba(info.bg),backdrop);for(const color of sample.backgrounds)bg=over(rgba(color),bg);const c=ratio(over(rgba(sample.color),bg),bg);if(sample.icon)minIcon=Math.min(minIcon,c);else minText=Math.min(minText,c);}}
   assert(minText>=4.5,`Text contrast ${minText} at ${width}/${tone}`);assert(minIcon>=3,`Icon contrast ${minIcon}`);
   if(out&&[390,1280].includes(width)){const img=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`${out}/menu-${width}-${tone}.png`,Buffer.from(img.result.data,'base64'));}
   await key('ArrowDown');assert.equal(await b.ev(`document.activeElement.classList.contains('ilg-fold-tile')`),true);await key('Escape');
   assert.equal(await b.ev(`document.getElementById('ilg-fold-menu').hidden&&document.activeElement.matches('#ilg-fold-button .ilg-fold-icon')`),true);
   await click('#ilg-fold-button .ilg-fold-icon');await b.click(width-12,height-120);await b.sleep(150);assert.equal(await b.ev(`document.getElementById('ilg-fold-menu').hidden`),true);
   // Menu -> native worldbook drawer -> back; no book selection or content edits.
   await click('#ilg-fold-button .ilg-fold-icon');const worldIndex=await b.ev(`[...document.querySelectorAll('#ilg-fold-menu .ilg-fold-tile')].findIndex(x=>x.textContent.trim()==='世界书')`);assert(worldIndex>=0);await click(`#ilg-fold-menu .ilg-fold-tile:nth-of-type(${worldIndex+2})`);
   assert.equal(await b.ev(`document.getElementById('ilg-fold-menu').hidden`),true);
   await click('#WorldInfo .ilg-sheet-back');assert.equal(await b.ev(`document.getElementById('ilg-fold-menu').hidden`),false);
   assert.equal(await b.ev(`document.querySelectorAll('#ilg-fold-menu').length`),1);await key('Escape');
   reports.push({width,height,tone,minTextContrast:+minText.toFixed(2),minIconContrast:+minIcon.toFixed(2),count:info.count,box:info.box,keyboard:true,outsideDismiss:true,worldbookBack:true});
  }
  await b.ev(`document.body.classList.add('no-blur','reduced-motion');document.querySelector('#ilg-fold-button .ilg-fold-icon').click()`);await b.sleep(300);
  const reduced=await b.ev(`(()=>{const s=getComputedStyle(document.getElementById('ilg-fold-menu'));return {filter:s.backdropFilter,animation:s.animationName}})()`);
  assert.equal(reduced.filter,'none');assert.equal(reduced.animation,'none');
  reports.push({width,reduced});
  await b.ev(`document.querySelector('#ilg-fold-button .ilg-fold-icon').click();document.body.classList.remove('no-blur','reduced-motion')`);
  assert.equal(await b.ev(`JSON.stringify({theme:SillyTavern.getContext().powerUserSettings.theme,css:SillyTavern.getContext().powerUserSettings.custom_css})`),settings);
  assert.deepEqual(b.logs,[]);
 }finally{b.close();}
}
if(out)fs.writeFileSync(`${out}/menu-runtime-results.json`,JSON.stringify({reports},null,2));
console.log(JSON.stringify({reports},null,2));process.exit(0);
