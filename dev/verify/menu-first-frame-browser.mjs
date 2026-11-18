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
const port=Number(process.env.NVWA_LAYOUT_PORT||8127),origin='http://127.0.0.1:'+port;
const occupied=await new Promise(resolve=>{const s=net.createConnection({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));});assert(!occupied,'Refusing to share an existing server');
const child=spawn(process.execPath,['server.js','--dataRoot',dataRoot,'--port',String(port),'--listen','false','--browserLaunchEnabled','false'],{cwd:host,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',()=>{});child.stderr.on('data',d=>console.error(d.toString().slice(0,1600)));
let browser,page;
let stage="host-startup";
const errors=[],consoleNotes=[];
try{
 const deadline=Date.now()+60000;while(true){try{const response=await fetch(origin);if(response.ok)break;}catch{}if(child.exitCode!==null)throw Error('Owned isolated host exited');if(Date.now()>deadline)throw Error('Owned isolated host did not start');await new Promise(r=>setTimeout(r,250));}
 const tools=await import(process.env.NVWA_PLAYWRIGHT_MODULE?pathToFileURL(process.env.NVWA_PLAYWRIGHT_MODULE).href:'playwright');browser=await tools[process.env.NVWA_BROWSER||'chromium'].launch({headless:true,...((process.env.NVWA_BROWSER||'chromium')==='chromium'?{...(process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})}:{})});
 page=await browser.newPage({viewport:{width:393,height:759},deviceScaleFactor:2,hasTouch:true,isMobile:true,...(process.env.NVWA_ANDROID_HOST==='native'?{userAgent:'Mozilla/5.0 (Linux; Android 14; TestDevice) AppleWebKit/537.36 Chrome/157.0.0.0 Mobile Safari/537.36'}:{}),...(process.env.NVWA_WEBVIEW_HOST==='1'?{userAgent:'Mozilla/5.0 (Linux; Android 14; TestDevice; wv) AppleWebKit/537.36 Version/4.0 Chrome/157.0.0.0 Mobile Safari/537.36'}:{}),...((process.env.NVWA_BROWSER||'chromium')==='webkit'?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});const served=new Map();page.on('response',r=>{if(r.status()>=500)console.log('HTTP FAILURE',r.status(),r.url());});page.on('pageerror',e=>errors.push({message:e.message,stack:e.stack,stage}));page.on('console',m=>{if(/app_ready|Error in event listener|NVWA|theme/i.test(m.text()))consoleNotes.push(m.text());});
 await page.addInitScript(()=>{window.__poseResizeErrors=[];window.__poseCalls=0;window.addEventListener('error',e=>{if(/^ResizeObserver loop/.test(e.message))__poseResizeErrors.push(e.message);});});
 const savedSettings=[];await page.route('**/api/horde/**',route=>route.fulfill({contentType:'application/json',body:route.request().url().endsWith('/status')?'{}':'[]'}));await page.route('**/api/settings/save',async route=>{savedSettings.push(route.request().postDataJSON());await route.fulfill({contentType:'application/json',body:'{"result":"ok"}'});});
 await page.route('**/scripts/extensions/third-party/ios-liquid-glass/**',async route=>{const name=decodeURIComponent(new URL(route.request().url()).pathname.split('/ios-liquid-glass/')[1]||''),file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){await route.abort();return;}let bytes;try{bytes=await fs.readFile(file);}catch{await route.abort();return;}if(name==='index.js'&&process.env.NVWA_BASELINE_INDEX)bytes=await fs.readFile(process.env.NVWA_BASELINE_INDEX);served.set(name,createHash('sha256').update(bytes).digest('hex'));if(name==='index.js'){let source=bytes.toString('utf8');assert.equal(source.split('onPoint(point) {').length,2);source=source.replace('onPoint(point) {','onPoint: window.__nvwaResearchPose = function(point) { if(point)window.__poseCalls++;');source+='\nSillyTavern.getContext().eventSource.on(SillyTavern.getContext().eventTypes.APP_READY,()=>{window.__nvwaHostReady=true;});\nwindow.__nvwaMapProbe={configure(options){Object.assign(S,options);clearAll();applyRoot();},think(){syncThink();},snapshot(){return{pose:{calls:window.__poseCalls,scope:lightScope.status(),overlays:document.querySelectorAll(".ilg-pose-overlay").length,ballLayer:!!document.querySelector("#ilg-ball-glass > .ilg-pose-overlay"),dragging:document.getElementById("ilg-ball").classList.contains("ilg-ball-drag"),position:document.getElementById("ilg-ball").style.translate || document.getElementById("ilg-ball").style.transform,resizeErrors:window.__poseResizeErrors},maps:webGlass.status(),reflections:reflections.status(),ball:ballGlass.status(),messages:document.querySelectorAll("#chat .mes").length,tracked:items.size,web:[...items].filter(([el,it])=>it.web).map(([el,it])=>({id:el.id||el.className,key:it.web.key,wanted:it.webWanted,hasImage:!!it.web.filter.querySelector("feImage"),hasDisplacement:!!it.web.filter.querySelector("feDisplacementMap"),style:el.style.backdropFilter}))};}};';source+='\nwindow.__menuSurface=selector=>{const el=document.querySelector(selector),it=items.get(el);return {tracked:!!it,kind:it?.kind,path:it?.renderPath,blur:it?surfaceBlur(it,el):null,displacement:!!it?.filter?.querySelector("feDisplacementMap")||!!it?.webFilter?.querySelector("feDisplacementMap")};};';source+='\nwindow.__panelResources=el=>{const it=items.get(el);return it?{tracked:true,visible:it.visible,path:it.renderPath,fallback:it.fallbackReason,filter:!!it.filter,web:!!it.web,reflection:el.classList.contains("ilg-reflection"),backdrop:el.style.backdropFilter}:null;};';source+=';window.__firstOpenPaints=[];const originalPaint=paint;paint=function(el,geo){originalPaint(el,geo);if(el.dataset?.firstOpenProbe){const it=items.get(el);window.__firstOpenPaints.push({id:el.dataset.firstOpenProbe,visible:it?.visible,path:it?.renderPath,filter:it?.id});}};';await route.fulfill({body:source,contentType:'text/javascript'});}else await route.fulfill({body:bytes,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':undefined});});


 stage='host-ready';await page.goto(origin);await page.waitForFunction(()=>window.__nvwaMapProbe&&window.__nvwaHostReady,null,{timeout:60000});
 const checks=[],captures=[],engine=(process.env.NVWA_BROWSER||'chromium')+(process.env.NVWA_WEBVIEW_HOST==='1'?'-android-webview':process.env.NVWA_ANDROID_HOST==='native'?'-android-native':'');
 await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();__nvwaMapProbe.configure({enabled:true,home:false,fold:true,orb:false,floatBall:false,refract:true,glassStyle:'original',engine:'physical',qrFold:true,tone:'light',composerLayout:'split',chatBackground:'transparent'});document.getElementById('chat').innerHTML='<div class="mes last_mes" mesid="0" is_user="false"><div class="mes_block"><div class="mes_text">'+Array.from({length:35},(_,i)=>'<p>窗边的书页映着微光，阅读和书写都该留一点呼吸。 '+i+'</p>').join('')+'</div></div></div>';const image='radial-gradient(ellipse at 12% 50%,#d0b3a4,transparent 65%),linear-gradient(120deg,#d4c9bf,#98b4b4 60%,#b4a8c6)';for(const id of ['bg1','bg_custom']){const e=document.getElementById(id);e?.style.setProperty('background-image',image,'important');e?.style.setProperty('opacity','1','important');}document.getElementById('send_but').style.display='flex';});


 const result=[];
 for(const layout of ['classic','unified','split']) for(const tone of ['light','dark']) {
 await page.evaluate(({tone,layout})=>__nvwaMapProbe.configure({tone,composerLayout:layout,refract:false,chatVeil:45,customTextTone:tone==='light'?'dark':'light'}),{tone,layout});
 await page.waitForTimeout(500);
 await page.evaluate(()=>{window.__firstMenuFrames=new Promise(resolve=>{document.getElementById('options_button').addEventListener('click',async()=>{
  const menu=document.querySelector('#options .options-content');const frames=[];

  for(let i=0;i<16;i++){
   await new Promise(requestAnimationFrame);const cs=getComputedStyle(menu),r=menu.getBoundingClientRect();
   const front=menu.querySelector('a,li,span');const before=getComputedStyle(menu,'::before');
   frames.push({i,visible:r.width>0&&r.height>0&&cs.display!=='none',opacity:cs.opacity,classes:menu.className,filter:cs.backdropFilter||cs.webkitBackdropFilter,bg:cs.backgroundColor,color:cs.color,foreground:front&&getComputedStyle(front).color,before:{background:before.backgroundColor,filter:before.backdropFilter||before.webkitBackdropFilter,opacity:before.opacity},style:menu.getAttribute('style'),tracking:__menuSurface('#options .options-content')});
  }
  resolve(frames);
 },{once:true,capture:true});});});
 await page.locator('#options_button').click();
 const frames=await page.evaluate(()=>window.__firstMenuFrames);
 assert(frames.some(f=>f.visible),'Menu must actually open');
 await page.screenshot({path:out+'/'+engine+'-'+layout+'-'+tone+'-first-menu.png'});
 result.push({layout,tone,frames});await page.keyboard.press('Escape');await page.waitForTimeout(300);
 }


 const entry=[];
 for(const mode of['glass','transparent']){
  await page.evaluate(mode=>{__nvwaMapProbe.configure({chatBackground:mode,refract:true,refractMes:true});document.body.classList.add('bubblechat');const chat=document.getElementById('chat');chat.innerHTML='';chat.scrollTop=0;window.__firstOpenPaints=[];for(let i=0;i<3;i++){const el=document.createElement('div');el.className='mes';el.setAttribute('mesid',i);el.setAttribute('is_user','false');el.dataset.firstOpenProbe=mode+'-'+i;el.innerHTML='<div class="mes_block"><div class="mes_text"><p>首次进入聊天的可见消息 '+i+'</p></div></div>';chat.append(el);}const ctx=SillyTavern.getContext();ctx.eventSource.emit(ctx.eventTypes.CHAT_CHANGED);},mode);
  await page.waitForTimeout(500);
  const trace=await page.evaluate(()=>__firstOpenPaints);assert(trace.length>0,'Actual host must paint initial history');const firstById=new Map();for(const p of trace)if(!firstById.has(p.id))firstById.set(p.id,p);
  assert([...firstById.values()].some(p=>p.visible),'First visible history paints immediately');for(const p of firstById.values())if(p.visible){const paths=new Set(trace.filter(n=>n.id===p.id&&n.visible).map(n=>n.path));assert(paths.size===1,'A visible message must not switch its material after first paint: '+JSON.stringify([...paths]));}
  assert.equal(await page.evaluate(()=>document.querySelectorAll('#chat .ilg-rise').length),0,'First-entry history has no transform animation');entry.push({mode,trace});
 }
 await fs.writeFile(out+'/'+engine+'-chat-entry.json',JSON.stringify({passed:true,entry,scope:'First-entry message insertion and actual CHAT_CHANGED in an isolated real host; physical phone still needs retest'},null,2));
 const lifecycle=[];
 if(process.env.NVWA_WEBVIEW_HOST==='1'||process.env.NVWA_ANDROID_HOST==='native'){
  for(let round=0;round<3;round++){
   await page.locator('#extensions-settings-button .drawer-icon').first().evaluate(el=>el.click());await page.waitForTimeout(450);
   const shown=await page.locator('#extensions-settings-button .drawer-content').evaluate(el=>({rect:el.getBoundingClientRect().height,state:__panelResources(el)}));
   assert(shown.rect>0&&shown.state?.visible,'Extension drawer opens in real host');assert.equal(shown.state.path,'blur');assert(!shown.state.filter&&!shown.state.web&&!shown.state.reflection);
   await page.locator('#extensions-settings-button .drawer-icon').first().evaluate(el=>el.click());await page.waitForTimeout(450);
   const hidden=await page.locator('#extensions-settings-button .drawer-content').evaluate(el=>__panelResources(el));assert(!hidden?.visible);assert(!hidden?.filter&&!hidden?.web&&!hidden?.reflection);assert.equal(hidden?.backdrop,'');
   await page.evaluate(async()=>{const{Popup,POPUP_TYPE}=await import('/scripts/popup.js');window.__nativeProbePopup=new Popup('<div>测试弹窗：关闭后恢复阅读</div>',POPUP_TYPE.TEXT);__nativeProbePopup.show();});await page.waitForTimeout(300);
   const popupState=await page.evaluate(()=>__panelResources(__nativeProbePopup.dlg));assert.equal(popupState?.path,'blur');assert(!popupState.filter&&!popupState.web&&!popupState.reflection);
   await page.evaluate(async()=>{await __nativeProbePopup.completeAffirmative();});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__panelResources(__nativeProbePopup.dlg)),null);
   await page.locator('#chat').evaluate(el=>el.scrollTop=el.scrollHeight);await page.waitForTimeout(100);lifecycle.push({round,shown,hidden,popupState});
  }
  assert.deepEqual(errors,[]);await fs.writeFile(out+'/'+engine+'-popup-lifecycle.json',JSON.stringify({passed:true,lifecycle,errors,scope:'Real isolated SillyTavern host under Android WebView identity, not a physical Android GPU capture'},null,2));
 }
 await fs.writeFile(out+'/'+engine+'-menu-first-frame.json',JSON.stringify({engine,result,errors},null,2));console.log(JSON.stringify({engine,result,errors},null,2));
 const missing=result.flatMap(r=>r.frames.filter(f=>f.visible&&f.opacity==='1'&&(!f.filter||f.filter==='none')).map(f=>({tone:r.tone,...f})));
 assert.equal(missing.length,0,'Visible menu must have its glass backdrop before any second interaction');
 if(process.env.NVWA_WEBVIEW_HOST==='1'||process.env.NVWA_ANDROID_HOST==='native')for(const item of result){const filters=new Set(item.frames.filter(f=>f.visible).map(f=>f.filter));assert.equal(filters.size,1,'Android menu must not change its filter between first and settled frames');}
}catch(error){console.error('STAGE',stage);console.error('PAGE ERRORS',JSON.stringify(errors));await page?.screenshot({path:out+'/failure-'+(process.env.NVWA_BROWSER||'chromium')+'.png'});throw error;}finally{await browser?.close();if(child.exitCode===null&&!child.killed){child.kill();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,5000).unref();});}}
