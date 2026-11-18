// Checks content/glass ownership in a tall preset-styled message. Synthetic content only.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const tools=await import(pathToFileURL(process.env.NVWA_PLAYWRIGHT_MODULE).href);
const harness=fs.readFileSync(path.join(root,'dev/verify/home-avatar-browser.mjs'),'utf8');
const fixture=vm.runInNewContext('('+harness.slice(harness.indexOf('function fixture('),harness.indexOf('const server=')).trim()+')',{hostCSS:''});
const baseline=process.env.NVWA_EXPECT_PRESET_BASELINE==='1';
const css=fs.readFileSync(process.env.NVWA_PRESET_STYLE||path.join(root,'style.css'),'utf8');
const sentence='Preset rendering sample. Keep the same text, panel colours and controls while scrolling. ';
const messages=Array.from({length:3},(_,i)=>'<div class="mes '+(i===2?'last_mes':'')+'" mesid="'+i+'"><div class="mesAvatarWrapper"><div class="avatar">A</div></div><div class="mes_block"><div class="mes_text">'+Array.from({length:32},(_,j)=>'<p>'+sentence.repeat(3)+'</p>'+(j===5?'<section class="preset-panel"><header>Preset status panel</header><article><p>'+sentence+'</p><button class="preset-action">Choice '+i+'</button><span class="preset-negative">Negative decoration</span></article></section>':'')).join('')+'</div></div></div>').join('');
const authoredStyle='<style>.mes{flex-shrink:0}.preset-panel{border:2px solid #ff7eb6;border-radius:9px;box-shadow:0 0 14px #ff7eb633;margin:14px 0;position:relative}.preset-panel header{background:#ff7eb6;color:#201a23;padding:5px}.preset-panel article{background:#1a1d24;color:#d8dde6;padding:12px;position:relative;isolation:isolate}.preset-action{background:#ff7eb6;color:#201a23;border:0;padding:6px 12px;border-radius:4px}.preset-negative{position:absolute;z-index:-1;left:0;top:0;background:#31435a}.preset-floating{position:fixed;left:100px;top:80px;z-index:2000;background:#135;color:white}</style>';
const source=fs.readFileSync(process.env.NVWA_PRESET_INDEX||path.join(root,'index.js'),'utf8')+'\nwindow.__presetLayer={repaint:repaintAll,configure(options){Object.assign(S,options);clearAll();applyRoot();},snapshot(){const el=document.querySelector(\'.mes\'),it=items.get(el),surface=it.backdrop||el,block=el.querySelector(\'.mes_block\'),panel=el.querySelector(\'.preset-panel\'),fixed=document.querySelector(\'.preset-floating\'),r=fixed.getBoundingClientRect();return{rootIsolation:getComputedStyle(el).isolation,blockPosition:getComputedStyle(block).position,blockZ:getComputedStyle(block).zIndex,contentTransform:getComputedStyle(block).transform,backdropFilter:getComputedStyle(surface).backdropFilter,glassColor:getComputedStyle(surface).backgroundColor,panelColor:getComputedStyle(panel.querySelector(\'article\')).backgroundColor,glassZ:getComputedStyle(it.backdropClip||surface).zIndex,rimZ:getComputedStyle(el,\'::after\').zIndex,rimMask:getComputedStyle(el,\'::after\').maskImage,filterNodes:it.filter?.querySelectorAll(\'feDisplacementMap\').length||0,rootClasses:el.className,rootHeight:el.offsetHeight,glassHeight:surface.offsetHeight,fixed:{x:r.x,y:r.y},tracked:items.has(el)};}};';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){
  const setup='activeChat();window.fixtureReady=false;document.getElementById("chat").innerHTML='+JSON.stringify(messages)+';window.originalMessage=document.querySelector(".mes");window.originalPanel=document.querySelector(".preset-panel");window.originalTextarea=document.getElementById("send_textarea");document.querySelector(".preset-panel article").insertAdjacentHTML("beforeend",\'<button class="preset-floating">Fixed popup</button>\');window.choiceClicks=0;document.querySelector(".preset-action").addEventListener("click",()=>choiceClicks++);';
  res.setHeader('content-type','text/html;charset=utf-8');res.end(fixture(3,false,'light').replace('window.fixtureReady=false;',setup).replace('</head>',authoredStyle+'</head>'));return;
 }
 if(url.pathname.startsWith('/extension/')){
  const file=path.resolve(root,decodeURIComponent(url.pathname.slice(11)));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
  res.end(file===path.join(root,'index.js')?source:file===path.join(root,'style.css')?css:fs.readFileSync(file));return;
 }
 res.writeHead(204);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const checks=[],errors=[],captures=[];const check=(name,ok,detail)=>{checks.push({name,passed:!!ok,detail});assert(ok,name+' '+JSON.stringify(detail));};
try{
 browser=await tools.chromium.launch({headless:true,executablePath:process.env.NVWA_EDGE_EXECUTABLE});
 for(const identity of ['native','webview','desktop']){
  const ua=identity==='desktop'?undefined:identity==='native'?'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 EdgA/157.0.0.0':'Mozilla/5.0 (Linux; Android 16; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/157.0.0.0 Mobile Safari/537.36';
  const p=await browser.newPage({viewport:{width:691,height:716},deviceScaleFactor:3.25,...(ua?{userAgent:ua}:{})});p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>fixtureReady||fixtureFailure);assert.equal(await p.evaluate(()=>fixtureFailure),null);
  await p.evaluate(()=>__presetLayer.configure({enabled:true,home:false,font:false,islands:true,refract:true,refractMes:true,engine:'physical',compatibilityMode:'auto',float:true}));
  await p.waitForFunction(()=>document.querySelector('.mes').classList.contains('ilg-card-renderer'));
  if(identity==='native'&&!baseline){
   const stable=await p.evaluate(async()=>{
    const frames=async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);};
    await frames();
    const before=__presetLayer.snapshot(), records=[];
    const monitor=new MutationObserver(ms=>records.push(...ms));
    for(const floor of document.querySelectorAll('#chat > .mes'))monitor.observe(floor,{attributes:true,attributeFilter:['class','style']});
    // Exercise the paint path even if scroll/resize hasn't changed anything.
    for(let i=0;i<4;i++)__presetLayer.repaint();
    records.push(...monitor.takeRecords());monitor.disconnect();
    return {writes:records.length,unchanged:JSON.stringify(before)===JSON.stringify(__presetLayer.snapshot())};
   });
   check('native-repaint-stable-message-attributes',stable.writes===0&&stable.unchanged,stable);
  }
  // An inline author panel may declare its foreground in a stylesheet, not on style="".
  await p.waitForFunction(()=>document.querySelector('.preset-panel article').classList.contains('ilg-dim'));
  const foreground=await p.locator('.preset-panel article').first().evaluate(el=>getComputedStyle(el).color);
  check(identity+'-authored-foreground-wins-over-contrast-fallback',foreground==='rgb(216, 221, 230)',foreground);
  const fixedAtTop=await p.locator('.preset-floating').evaluate(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y}));
  check(identity+'-fixed-before-scroll',fixedAtTop.x===100&&fixedAtTop.y===80,fixedAtTop);
  for(const width of [691,360,900,691]){
   await p.setViewportSize({width,height:716});await p.waitForTimeout(120);
   for(const tone of ['light','dark'])for(const background of ['glass','transparent']){
    await p.evaluate(({tone,background})=>__presetLayer.configure({tone,chatBackground:background}),{tone,background});await p.waitForTimeout(60);
    const sample=await p.evaluate(()=>__presetLayer.snapshot()),name=identity+'-'+width+'-'+tone+'-'+background;
    check(name+'-authored-ui',sample.panelColor==='rgb(26, 29, 36)'&&sample.fixed.x===100&&sample.fixed.y===80,sample);
    check(name+'-no-content-transform',sample.contentTransform==='none',sample.contentTransform);
    const separated=identity!=='desktop'&&width>=600;
    if(separated&&!baseline){
     check(name+'-content-not-isolated-with-glass',sample.rootIsolation==='auto',sample);
     check(name+'-glass-below-content',Number(sample.blockZ)>Number(sample.glassZ)&&Number(sample.blockZ)>Number(sample.rimZ),sample);
     check(name+'-glass-and-rim-preserved',sample.backdropFilter!=='none'&&sample.rimMask!=='none'&&sample.glassHeight<=716,sample);
    }else check(name+'-original-stacking-retained',sample.rootIsolation==='isolate',sample);
    if(background==='transparent')check(name+'-clear-background',sample.glassColor==='rgba(0, 0, 0, 0)',sample.glassColor);
   }
  }
  await p.evaluate(()=>__presetLayer.configure({tone:'light',chatBackground:'glass'}));
  await p.locator('.preset-action').first().click();check(identity+'-native-choice-click',await p.evaluate(()=>choiceClicks)===1);
  const scroll=await p.evaluate(async()=>{const chat=document.getElementById('chat'),frames=[];chat.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',isPrimary:true}));for(let i=0;i<60;i++){const desired=600+i*9;chat.scrollTop=desired;await new Promise(requestAnimationFrame);frames.push({desired,actual:chat.scrollTop});}return frames;});
  check(identity+'-scroll-stability',scroll.every(x=>Math.abs(x.desired-x.actual)<1),scroll.slice(-2));
  if(process.env.NVWA_PRESET_CAPTURE_DIR){fs.mkdirSync(process.env.NVWA_PRESET_CAPTURE_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.NVWA_PRESET_CAPTURE_DIR,identity+'.png')});captures.push(identity);}
  check(identity+'-nodes-preserved',await p.evaluate(()=>originalMessage===document.querySelector('.mes')&&originalPanel===document.querySelector('.preset-panel')&&originalTextarea===document.getElementById('send_textarea')));
  if(identity!=='desktop'&&!baseline){
   await p.evaluate(()=>__presetLayer.configure({enabled:true,tone:'light',chatBackground:'glass'}));
   const first=await p.evaluate(async messages=>{
    const chat=document.getElementById('chat');
    chat.replaceChildren();
    await new Promise(requestAnimationFrame);
    const start=performance.now();
    // Recreate the same chat with no markers from an earlier visit.
    chat.innerHTML=messages;
    chat.querySelector('.preset-panel article').insertAdjacentHTML('beforeend','<button class="preset-floating">Fixed popup</button>');
    chat.scrollTop=400;
    const sample=()=>{
     const state=__presetLayer.snapshot();
     return {ms:Math.round(performance.now()-start),isolation:state.rootIsolation,classes:state.rootClasses,filter:state.backdropFilter,glassHeight:state.glassHeight,fixed:state.fixed};
    };
    const frames=[];
    for(let i=0;i<3;i++){
     await new Promise(requestAnimationFrame);
     frames.push(sample());
    }
    await new Promise(r=>setTimeout(r,260));
    return {frames,settled:sample()};
   },messages);
   check(identity+'-cold-entry-first-frames-use-final-preset-stacking',first.frames.every(x=>x.isolation==='auto'&&x.classes.includes('ilg-card-renderer')&&x.classes.includes('ilg-message-viewport')&&x.filter!=='none'&&x.glassHeight<=716&&x.fixed.x===100&&x.fixed.y===80),first);
   check(identity+'-late-color-pass-does-not-change-stacking-or-glass',first.frames.every(x=>x.isolation===first.settled.isolation&&x.filter===first.settled.filter&&x.glassHeight===first.settled.glassHeight),first);
  }
  await p.evaluate(()=>{const el=document.querySelector('.mes');el.querySelector('.mes_text').innerHTML='<div style="background:#1a1d24;height:120px">Short preset panel</div>';});
  await p.waitForFunction(()=>!document.querySelector('.mes').classList.contains('ilg-message-viewport'));
  check(identity+'-shrink-restores-original-stacking',await p.locator('.mes').first().evaluate(el=>getComputedStyle(el).isolation)==='isolate');
  const unstyledPanel=p.locator('.mes').first().locator('.mes_text > div');
  await p.waitForFunction(()=>document.querySelector('.mes .mes_text > div').classList.contains('ilg-dim'));
  const fallback=await unstyledPanel.evaluate(el=>getComputedStyle(el).color);
  check(identity+'-unstyled-panel-retains-contrast-fallback',fallback==='rgba(242, 242, 247, 0.9)',fallback);
  await p.evaluate(()=>__presetLayer.configure({enabled:false}));
  check(identity+'-disable-cleanup',await p.locator('.ilg-message-glass,.ilg-message-clip').count()===0);
  await p.close();
 }
 check('no-runtime-errors',errors.length===0,errors);
 const result={passed:true,checks:checks.length,results:checks,captures,scope:'Synthetic preset UI, actual extension and Windows Edge with Android identities. Proves layering, visual ownership and interactions; OPPO disappearance must be accepted on the phone.'};
 if(process.env.NVWA_PRESET_RESULT)fs.writeFileSync(process.env.NVWA_PRESET_RESULT,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,checks:checks.length,errors}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
