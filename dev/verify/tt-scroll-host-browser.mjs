import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import os from 'node:os';
// Requires a disposable settings fixture with NVWA enabled; never uses the live host data root.
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const host=process.env.NVWA_HOST_ROOT, settingsFile=process.env.NVWA_LAYOUT_SETTINGS;
assert(host&&settingsFile,'Set NVWA_HOST_ROOT and NVWA_LAYOUT_SETTINGS to the host source and an isolated fixture');
const out=path.resolve(process.env.NVWA_LAYOUT_OUT||await fs.mkdtemp(path.join(os.tmpdir(),'nvwa-layout-results-')));
await fs.mkdir(out,{recursive:true});
const dataRoot=await fs.mkdtemp(path.join(os.tmpdir(),'nvwa-layout-host-'));
await fs.mkdir(path.join(dataRoot,'default-user'),{recursive:true});
const fixture=JSON.parse(await fs.readFile(settingsFile,'utf8'));
fixture.extension_settings.autoConnect=false;
await fs.writeFile(path.join(dataRoot,'default-user/settings.json'),JSON.stringify(fixture));
const port=Number(process.env.NVWA_LAYOUT_PORT||8129),origin='http://127.0.0.1:'+port;
const occupied=await new Promise(resolve=>{const s=net.createConnection({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));});assert(!occupied,'Refusing to share an existing server');
const child=spawn(process.execPath,['server.js','--dataRoot',dataRoot,'--port',String(port),'--listen','false','--browserLaunchEnabled','false'],{cwd:host,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',()=>{});child.stderr.on('data',d=>console.error(d.toString().slice(0,1600)));
let browser,page;
let stage="host-startup";
const errors=[],consoleNotes=[];
try{
 const deadline=Date.now()+60000;while(true){try{const response=await fetch(origin);if(response.ok)break;}catch{}if(child.exitCode!==null)throw Error('Owned isolated host exited');if(Date.now()>deadline)throw Error('Owned isolated host did not start');await new Promise(r=>setTimeout(r,250));}
 const tools=await import(process.env.NVWA_PLAYWRIGHT_MODULE?pathToFileURL(process.env.NVWA_PLAYWRIGHT_MODULE).href:'playwright');browser=await tools[process.env.NVWA_BROWSER||'chromium'].launch({headless:true,...((process.env.NVWA_BROWSER||'chromium')==='chromium'?{...(process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})}:{})});
 page=await browser.newPage({viewport:process.env.NVWA_FOLDABLE_HOST==='1'?{width:691,height:716}:{width:350,height:758},deviceScaleFactor:3.25,hasTouch:true,isMobile:true,userAgent:process.env.NVWA_ANDROID_HOST==='native'?'Mozilla/5.0 (Linux; Android 17; PLP110) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.8103.38 Mobile Safari/537.36':'Mozilla/5.0 (Linux; Android 17; PLP110 Build/BP2A.250605.015; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/157.0.8103.38 Mobile Safari/537.36'});const served=new Map();page.on('response',r=>{if(r.status()>=500)console.log('HTTP FAILURE',r.status(),r.url());});page.on('pageerror',e=>errors.push({message:e.message,stack:e.stack,stage}));page.on('console',m=>{if(/app_ready|Error in event listener|NVWA|theme/i.test(m.text()))consoleNotes.push(m.text());});
 await page.addInitScript(()=>{window.__poseResizeErrors=[];window.__poseCalls=0;window.addEventListener('error',e=>{if(/^ResizeObserver loop/.test(e.message))__poseResizeErrors.push(e.message);});});
 const savedSettings=[];await page.route('**/api/horde/**',route=>route.fulfill({contentType:'application/json',body:route.request().url().endsWith('/status')?'{}':'[]'}));await page.route('**/api/settings/save',async route=>{savedSettings.push(route.request().postDataJSON());await route.fulfill({contentType:'application/json',body:'{"result":"ok"}'});});
 await page.route('**/scripts/extensions/third-party/ios-liquid-glass/**',async route=>{const name=decodeURIComponent(new URL(route.request().url()).pathname.split('/ios-liquid-glass/')[1]||''),file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){await route.abort();return;}let bytes;try{bytes=await fs.readFile(file);}catch{await route.abort();return;}if(name==='index.js'&&process.env.NVWA_BASELINE_INDEX)bytes=await fs.readFile(process.env.NVWA_BASELINE_INDEX);served.set(name,createHash('sha256').update(bytes).digest('hex'));if(name==='index.js'){let source=bytes.toString('utf8');assert.equal(source.split('onPoint(point) {').length,2);source=source.replace('onPoint(point) {','onPoint: window.__nvwaResearchPose = function(point) { if(point)window.__poseCalls++;');source+='\nSillyTavern.getContext().eventSource.on(SillyTavern.getContext().eventTypes.APP_READY,()=>{window.__nvwaHostReady=true;});\nwindow.__nvwaMapProbe={configure(options){Object.assign(S,options);clearAll();applyRoot();},think(){syncThink();},snapshot(){return{pose:{calls:window.__poseCalls,scope:lightScope.status(),overlays:document.querySelectorAll(".ilg-pose-overlay").length,ballLayer:!!document.querySelector("#ilg-ball-glass > .ilg-pose-overlay"),dragging:document.getElementById("ilg-ball").classList.contains("ilg-ball-drag"),position:document.getElementById("ilg-ball").style.translate || document.getElementById("ilg-ball").style.transform,resizeErrors:window.__poseResizeErrors},maps:webGlass.status(),reflections:reflections.status(),ball:ballGlass.status(),messages:document.querySelectorAll("#chat .mes").length,tracked:items.size,web:[...items].filter(([el,it])=>it.web).map(([el,it])=>({id:el.id||el.className,key:it.web.key,wanted:it.webWanted,hasImage:!!it.web.filter.querySelector("feImage"),hasDisplacement:!!it.web.filter.querySelector("feDisplacementMap"),style:el.style.backdropFilter}))};}};';source+='\nwindow.__ttReadingProbe={capture(){readingAnchor.capture();},status(){return readingAnchor.status();},diagnostic(){return viewportDiagnostic();},surface(selector){const el=document.querySelector(selector),it=items.get(el);return{path:it?.renderPath,reason:it?.fallbackReason,id:it?.id,hasFilter:!!it?.filter,filterExists:!!document.getElementById(it?.id),rect:el.getBoundingClientRect().toJSON(),backdropRect:(it?.backdrop||el).getBoundingClientRect().toJSON(),chatRect:document.getElementById("chat").getBoundingClientRect().toJSON(),clipCount:el.querySelectorAll(".ilg-message-clip").length,style:(it?.backdrop||el).style.backdropFilter};}};';source+='\nwindow.__menuSurface=selector=>{const el=document.querySelector(selector),it=items.get(el);return {tracked:!!it,kind:it?.kind,path:it?.renderPath,blur:it?surfaceBlur(it,el):null,displacement:!!it?.filter?.querySelector("feDisplacementMap")||!!it?.webFilter?.querySelector("feDisplacementMap")};};';await route.fulfill({body:source,contentType:'text/javascript'});}else await route.fulfill({body:bytes,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':undefined});});


 stage='host-ready';await page.goto(origin);await page.waitForFunction(()=>window.__nvwaMapProbe&&window.__nvwaHostReady,null,{timeout:60000});

 const engine=process.env.NVWA_BROWSER||'chromium',checks=[];
 const check=(name,passed,detail)=>{stage=name;checks.push({name,passed,detail});assert(passed,name+' '+JSON.stringify(detail));};
 await page.evaluate(()=>{for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();__nvwaMapProbe.configure({enabled:true,home:false,floatBall:false,fold:true,orb:false,refract:true,refractMes:true,glassStyle:'original',engine:'physical',compatibilityMode:'auto',composerLayout:'split',tone:'light',customTextTone:'dark'});const chat=document.getElementById('chat');chat.innerHTML='<div class="mes" id="small-message" mesid="0" is_user="false" style="height:240px;min-height:240px;width:349px;box-sizing:border-box"><div class="mes_block"><div class="mes_text"><p>Small message fixture.</p></div></div></div><div class="mes last_mes" id="large-message" mesid="1" is_user="false" style="height:3000px;min-height:3000px;width:349px;box-sizing:border-box"><div class="mes_block"><div class="mes_text">'+Array.from({length:80},(_,i)=>'<p>Long message rendering fixture '+i+'.</p>').join('')+'</div></div></div><img id="late-image" hidden>';chat.scrollTop=0;});
 await page.waitForFunction(()=>__ttReadingProbe.surface('#large-message').path==='blur'&&__ttReadingProbe.surface('#large-message').reason==='large-android-message');
 const large=await page.evaluate(()=>__ttReadingProbe.surface('#large-message'));
 check('recorded-size-uses-css-fallback',large.rect.height>=3000&&!large.style.includes('url(')&&!large.filterExists&&!(await page.locator('#large-message').evaluate(el=>el.classList.contains('ilg-reflection'))),large);
 const small=await page.evaluate(()=>__ttReadingProbe.surface('#small-message'));check('ordinary-message-retains-physical-material',small.path==='physical'&&small.hasFilter,small);
 for(const selector of ['#ilg-composer-plus-glass','#ilg-composer-input-glass']){const control=await page.evaluate(selector=>__ttReadingProbe.surface(selector),selector);check('control-material-'+selector,control.path==='physical'&&control.hasFilter,control);}
 await page.evaluate(()=>{const chat=document.getElementById('chat');chat.scrollTop=900;});await page.waitForTimeout(100);await page.evaluate(()=>__ttReadingProbe.capture());
 const position=await page.evaluate(()=>{const chat=document.getElementById('chat');chat.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:1,clientX:100,clientY:200,isPrimary:true}));chat.scrollTop=1200;chat.dispatchEvent(new Event('scroll'));document.getElementById('late-image').dispatchEvent(new Event('load'));return chat.scrollTop;});await page.waitForTimeout(100);const after=await page.locator('#chat').evaluate(e=>e.scrollTop);check('real-host-late-image-does-not-snap-scroll',position===1200&&after===1200,{position,after});
 const motion=await page.evaluate(async()=>{const chat=document.getElementById('chat'),image=document.getElementById('late-image'),samples=[];chat.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:1,clientX:100,clientY:200,isPrimary:true}));for(let i=0;i<12;i++){chat.scrollTop=1200+i*18;chat.dispatchEvent(new Event('scroll'));image.dispatchEvent(new Event('load'));await new Promise(requestAnimationFrame);samples.push(chat.scrollTop);}return samples;});check('repeated-loads-yield-to-scroll',motion.every((v,i)=>Math.abs(v-(1200+i*18))<1),motion);
 await page.evaluate(()=>{const chat=document.getElementById('chat');chat.scrollTop=0;const el=document.getElementById('large-message');el.style.height='400px';el.style.minHeight='400px';el.querySelector('.mes_text').textContent='The message shrank.';});await page.waitForFunction(()=>__ttReadingProbe.surface('#large-message').path==='physical');check('shrink-restores-physical-refraction',await page.evaluate(()=>__ttReadingProbe.surface('#large-message').hasFilter));
 await page.evaluate(()=>{const el=document.getElementById('large-message');el.style.height='3000px';el.style.minHeight='3000px';});await page.waitForFunction(()=>__ttReadingProbe.surface('#large-message').reason==='large-android-message');check('growth-releases-previous-svg-filter',await page.evaluate(()=>!__ttReadingProbe.surface('#large-message').filterExists));
 await page.evaluate(()=>__nvwaMapProbe.configure({engine:'legacy'}));await page.waitForFunction(()=>__ttReadingProbe.surface('#large-message').path==='blur');const legacy=await page.evaluate(()=>__ttReadingProbe.surface('#large-message'));check('legacy-setting-also-respects-large-surface-guard',legacy.reason==='large-android-message'&&!legacy.style.includes('url('),legacy);
 if(process.env.NVWA_FOLDABLE_HOST==='1'){
  await page.locator('#large-message').evaluate(el=>{el.style.width='100%';});
  for(const width of [360,691,900,360,691]){
   await page.setViewportSize({width,height:716});
   for(const top of [0,1200,2400]){
    await page.locator('#chat').evaluate((el,top)=>{el.scrollTop=top},top);await page.waitForTimeout(80);
    const frame=await page.evaluate(()=>__ttReadingProbe.surface('#large-message'));
    check('foldable-'+width+'-'+top,width<600?frame.backdropRect.height===frame.rect.height:frame.backdropRect.height<=717&&frame.backdropRect.top<=Math.max(frame.rect.top,frame.chatRect.top)+2&&frame.backdropRect.bottom>=Math.min(frame.rect.bottom,frame.chatRect.bottom)-2,frame);
   }
  }
 }
 await page.evaluate(()=>{
  const panel=document.createElement('section');panel.id='preset-host-panel';panel.style.cssText='background:rgb(26,29,36);color:rgb(210,215,225);padding:12px;border:2px solid #ff7eb6';
  panel.innerHTML='<p>Preset-owned status panel</p><button id="preset-host-choice" style="background:#ff7eb6;color:#201a23">Choice</button><button id="preset-host-fixed" style="position:fixed;left:100px;top:80px;z-index:3000">Fixed preset window</button>';
  document.querySelector('#large-message .mes_text').append(panel);window.__presetHostClicks=0;
  document.getElementById('preset-host-choice').addEventListener('click',()=>__presetHostClicks++);
 });
 await page.waitForFunction(()=>document.getElementById('large-message').classList.contains('ilg-card-renderer'));
 for(const width of [360,691,900]){
  await page.setViewportSize({width,height:716});await page.waitForTimeout(100);
  const preset=await page.evaluate(()=>{const message=document.getElementById('large-message'),block=message.querySelector('.mes_block'),panel=document.getElementById('preset-host-panel'),fixed=document.getElementById('preset-host-fixed').getBoundingClientRect();return{isolation:getComputedStyle(message).isolation,contentZ:getComputedStyle(block).zIndex,contentTransform:getComputedStyle(block).transform,panelBackground:getComputedStyle(panel).backgroundColor,panelColour:getComputedStyle(panel).color,fixed:{x:fixed.x,y:fixed.y}};});
  check('preset-content-layer-'+width,preset.isolation===(width>=600?'auto':'isolate')&&preset.contentTransform==='none',preset);
  check('preset-style-and-fixed-position-'+width,preset.panelBackground==='rgb(26, 29, 36)'&&preset.panelColour==='rgb(210, 215, 225)'&&preset.fixed.x===100&&preset.fixed.y===80,preset);
 }
 await page.locator('#preset-host-choice').click();check('preset-native-action-click',await page.evaluate(()=>__presetHostClicks===1));
 await page.locator('#preset-host-fixed').evaluate(el=>el.remove());
 await page.evaluate(()=>{document.getElementById('large-message').querySelector('.mes_text').style.cssText='height:100%;background:repeating-linear-gradient(90deg,#344b73 0 20px,#f4cd8e 20px 40px)';});
 await page.evaluate(()=>{
  const pattern=document.createElement('div');pattern.id='compositor-test-pattern';
  pattern.style.cssText='position:absolute;inset:0;z-index:39;pointer-events:none;background:repeating-linear-gradient(90deg,#344b73 0 20px,#f4cd8e 20px 40px)';
  document.getElementById('form_sheld').before(pattern);
 });
 const composerTrials=[];
 for(const width of [394,691]) for(const mode of ['physical','css']) for(const floating of [true,false]){
  await page.setViewportSize({width,height:716});
  await page.evaluate(({mode,floating})=>__nvwaMapProbe.configure({engine:'physical',font:false,compatibilityMode:mode==='css'?'blur':'auto',float:floating}),{mode,floating});
  await page.waitForTimeout(250);
  const trial=await page.evaluate(async()=>{
   const chat=document.getElementById('chat'),plane=document.getElementById('ilg-composer-input-glass'),input=document.getElementById('send_textarea'),samples=[];
   window.__inputPaints=0;chat.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',isPrimary:true}));
   for(let i=0;i<100;i++){
    chat.scrollTop=700+i*8;await new Promise(requestAnimationFrame);
    const r=plane.getBoundingClientRect(),c=chat.getBoundingClientRect(),t=input.getBoundingClientRect(),css=getComputedStyle(plane);
    samples.push({x:r.x,y:r.y,w:r.width,h:r.height,chatBottom:c.bottom,inputY:t.y,filter:css.backdropFilter,paints:window.__inputPaints,requested:700+i*8,scrollTop:chat.scrollTop});
   }
   return{samples,readingAnchor:__ttReadingProbe.status(),form:document.getElementById('form_sheld').getBoundingClientRect().toJSON()};
  });
  const distinct=key=>[...new Set(trial.samples.map(s=>s[key]))];
  await page.screenshot({path:out+'/composer-'+width+'-'+mode+'-'+floating+'.png'});
  const material=await page.locator('#ilg-composer-input-glass').evaluate(el=>{const cs=getComputedStyle(el),id=cs.backdropFilter.match(/#(ilg-f[0-9]+)/)?.[1],filter=id?document.getElementById(id):null;return {transform:cs.transform,filter:cs.backdropFilter,regionHeight:filter?.getAttribute('height'),h:el.offsetHeight,displacement:!!filter?.querySelector('feDisplacementMap')};});
  check('composer-preserved-'+width+'-'+mode+'-'+floating,mode==='css'?material.filter.includes('blur('):material.displacement,material);
  if(!process.env.NVWA_BASELINE_INDEX)check('composer-bounded-'+width+'-'+mode+'-'+floating,material.transform!=='none'&&(mode==='css'||Number(material.regionHeight)===material.h),material);
  composerTrials.push({width,mode,floating,material,summary:{x:distinct('x'),y:distinct('y'),w:distinct('w'),h:distinct('h'),filter:distinct('filter'),chatBottom:distinct('chatBottom'),paints:trial.samples.at(-1).paints,scrollDrift:Math.max(...trial.samples.map(s=>Math.abs(s.requested-s.scrollTop)))},...trial});
 }
 await fs.writeFile(out+'/composer-scroll.json',JSON.stringify({engine,version:JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8')).version,composerTrials,scope:'Desktop Edge with native Android identity, real isolated SillyTavern, no physical-phone compositor claim.'},null,2));
 console.log(JSON.stringify({composerTrials:composerTrials.map(t=>({floating:t.floating,...t.summary}))}));
 await page.evaluate(()=>__nvwaMapProbe.configure({float:true,font:true,compatibilityMode:'auto'}));await page.waitForTimeout(250);

 await page.setViewportSize({width:691,height:716});await page.waitForTimeout(300);
 const diagnostic=await page.evaluate(()=>__ttReadingProbe.diagnostic());check('diagnostic-snapshot-still-works',!!diagnostic);if(process.env.NVWA_FOLDABLE_HOST==='1')check('foldable-backdrop-diagnostic',diagnostic.rendering.boundedMessageBackdrops>=1&&diagnostic.rendering.surfaces.some(s=>s.boundedBackdrop&&s.backdropHeight<=716),diagnostic.rendering);check('native-typography-and-guard-diagnostics',diagnostic.typography?.mode==='system'&&typeof diagnostic.typography.loadingCycles==='number'&&diagnostic.rendering.largeAndroidMessages>=1&&diagnostic.rendering.largeWebViewMessages===diagnostic.rendering.largeAndroidMessages,{typography:diagnostic.typography,largeAndroidMessages:diagnostic.rendering.largeAndroidMessages});
 check('no-runtime-errors',errors.length===0&&await page.evaluate(()=>__poseResizeErrors.length===0),errors);
 const identity=(process.env.NVWA_ANDROID_HOST==='native'?'android-native':'android-webview')+(process.env.NVWA_FOLDABLE_HOST==='1'?'-foldable':'');const result={engine,identity,checks,scope:'Real local SillyTavern with '+identity+' UA and recorded geometry; desktop browser, not physical TT'};await fs.writeFile(out+'/'+engine+'-'+identity+'-tt-fix-host.json',JSON.stringify(result,null,2));console.log(JSON.stringify({engine,passed:checks.length,scope:result.scope}));
}catch(error){console.error('STAGE',stage);console.error('PAGE ERRORS',JSON.stringify(errors));await page?.screenshot({path:out+'/tt-fix-failure.png'});throw error;}finally{await browser?.close();if(child.exitCode===null&&!child.killed){child.kill();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,5000).unref();});}}
