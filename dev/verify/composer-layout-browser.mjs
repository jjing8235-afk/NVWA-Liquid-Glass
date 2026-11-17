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
 page=await browser.newPage({viewport:{width:393,height:759},deviceScaleFactor:2,hasTouch:true,isMobile:true,...((process.env.NVWA_BROWSER||'chromium')==='webkit'?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});const served=new Map();page.on('response',r=>{if(r.status()>=500)console.log('HTTP FAILURE',r.status(),r.url());});page.on('pageerror',e=>errors.push({message:e.message,stack:e.stack,stage}));page.on('console',m=>{if(/app_ready|Error in event listener|NVWA|theme/i.test(m.text()))consoleNotes.push(m.text());});
 await page.addInitScript(()=>{window.__poseResizeErrors=[];window.__poseCalls=0;window.addEventListener('error',e=>{if(/^ResizeObserver loop/.test(e.message))__poseResizeErrors.push(e.message);});});
 const savedSettings=[];await page.route('**/api/horde/**',route=>route.fulfill({contentType:'application/json',body:route.request().url().endsWith('/status')?'{}':'[]'}));await page.route('**/api/settings/save',async route=>{savedSettings.push(route.request().postDataJSON());await route.fulfill({contentType:'application/json',body:'{"result":"ok"}'});});
 await page.route('**/scripts/extensions/third-party/ios-liquid-glass/**',async route=>{const name=decodeURIComponent(new URL(route.request().url()).pathname.split('/ios-liquid-glass/')[1]||''),file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){await route.abort();return;}let bytes;try{bytes=await fs.readFile(file);}catch{await route.abort();return;}if(name==='index.js'&&process.env.NVWA_BASELINE_INDEX)bytes=await fs.readFile(process.env.NVWA_BASELINE_INDEX);served.set(name,createHash('sha256').update(bytes).digest('hex'));if(name==='index.js'){let source=bytes.toString('utf8');assert.equal(source.split('onPoint(point) {').length,2);source=source.replace('onPoint(point) {','onPoint: window.__nvwaResearchPose = function(point) { if(point)window.__poseCalls++;');source+='\nSillyTavern.getContext().eventSource.on(SillyTavern.getContext().eventTypes.APP_READY,()=>{window.__nvwaHostReady=true;});\nwindow.__nvwaMapProbe={configure(options){Object.assign(S,options);clearAll();applyRoot();},think(){syncThink();},snapshot(){return{pose:{calls:window.__poseCalls,scope:lightScope.status(),overlays:document.querySelectorAll(".ilg-pose-overlay").length,ballLayer:!!document.querySelector("#ilg-ball-glass > .ilg-pose-overlay"),dragging:document.getElementById("ilg-ball").classList.contains("ilg-ball-drag"),position:document.getElementById("ilg-ball").style.translate || document.getElementById("ilg-ball").style.transform,resizeErrors:window.__poseResizeErrors},maps:webGlass.status(),reflections:reflections.status(),ball:ballGlass.status(),messages:document.querySelectorAll("#chat .mes").length,tracked:items.size,web:[...items].filter(([el,it])=>it.web).map(([el,it])=>({id:el.id||el.className,key:it.web.key,wanted:it.webWanted,hasImage:!!it.web.filter.querySelector("feImage"),hasDisplacement:!!it.web.filter.querySelector("feDisplacementMap"),style:el.style.backdropFilter}))};}};';source+='\nwindow.__menuSurface=selector=>{const el=document.querySelector(selector),it=items.get(el);return {tracked:!!it,kind:it?.kind,path:it?.renderPath,blur:it?surfaceBlur(it,el):null,displacement:!!it?.filter?.querySelector("feDisplacementMap")||!!it?.webFilter?.querySelector("feDisplacementMap")};};';await route.fulfill({body:source,contentType:'text/javascript'});}else await route.fulfill({body:bytes,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':undefined});});


 stage='host-ready';await page.goto(origin);await page.waitForFunction(()=>window.__nvwaMapProbe&&window.__nvwaHostReady,null,{timeout:60000});
 const checks=[],captures=[],engine=process.env.NVWA_BROWSER||'chromium';
 await page.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();__nvwaMapProbe.configure({enabled:true,home:false,fold:true,orb:false,floatBall:false,refract:true,glassStyle:'original',engine:'physical',qrFold:true,tone:'light',composerLayout:'split',chatBackground:'transparent'});document.getElementById('chat').innerHTML='<div class="mes last_mes" mesid="0" is_user="false"><div class="mes_block"><div class="mes_text">'+Array.from({length:35},(_,i)=>'<p>窗边的书页映着微光，阅读和书写都该留一点呼吸。 '+i+'</p>').join('')+'</div></div></div>';const image='radial-gradient(ellipse at 12% 50%,#d0b3a4,transparent 65%),linear-gradient(120deg,#d4c9bf,#98b4b4 60%,#b4a8c6)';for(const id of ['bg1','bg_custom']){const e=document.getElementById(id);e?.style.setProperty('background-image',image,'important');e?.style.setProperty('opacity','1','important');}document.getElementById('send_but').style.display='flex';});

 await page.locator('#send_textarea').fill('保留这段草稿，切换后继续写。');
 const check=(name,passed,detail)=>{stage=name;checks.push({name,passed,detail});if(!passed)throw Error(name+' '+JSON.stringify(detail));};
 const sample=async()=>page.evaluate(()=>{document.getElementById('send_but').style.setProperty('display','flex','important');const host=document.getElementById('nonQRFormItems'),plus=document.getElementById('options_button'),input=document.getElementById('send_textarea'),right=document.getElementById('rightSendForm'),lens=document.getElementById('ilg-composer-plus-glass'),glass=document.getElementById('ilg-composer-input-glass'),rect=e=>e?.getBoundingClientRect().toJSON();return{mode:document.documentElement.dataset.ilgComposerLayout,parentFilter:getComputedStyle(host).backdropFilter,parentClass:host.className,plus:rect(plus),input:rect(input),right:rect(right),host:rect(host),lens:rect(lens),glass:rect(glass),sendBg:getComputedStyle(document.getElementById('send_but')).backgroundColor,send:rect(document.getElementById('send_but')),plusFill:lens?getComputedStyle(lens).backgroundColor:null,glassFilter:glass?getComputedStyle(glass).backdropFilter:null,plusFilter:lens?getComputedStyle(lens).backdropFilter:null,layers:host.querySelectorAll(':scope > .ilg-composer-glass').length,merged:document.documentElement.classList.contains('ilg-merged-tools'),wandVisible:getComputedStyle(document.getElementById('extensionsMenuButton')).visibility!=='hidden'&&document.getElementById('extensionsMenuButton').getBoundingClientRect().width>0,hasDraft:input.value==='保留这段草稿，切换后继续写。',overflow:document.documentElement.scrollWidth>innerWidth};});
 for(const viewport of [{width:320,height:640},{width:393,height:759},{width:844,height:390},{width:1280,height:900}]){
  await page.setViewportSize(viewport);
  for(const material of ['original','liquid-web','css']) for(const tone of ['light','dark']) for(const layout of ['classic','unified','split']){
   await page.evaluate(({layout,material,tone})=>__nvwaMapProbe.configure({composerLayout:layout,tone,customTextTone:tone==='light'?'dark':'light',glassStyle:material==='liquid-web'?'liquid-web':'original',compatibilityMode:material==='css'?'blur':'auto'}),{layout,material,tone});await page.waitForTimeout(210);
   await page.waitForFunction(tone=>getComputedStyle(document.getElementById('send_but')).backgroundColor===(tone==='light'?'rgb(23, 25, 30)':'rgb(22, 119, 232)'),tone);
   const state=await sample(),name=viewport.width+'-'+material+'-'+tone+'-'+layout;
   check(name+'-layout',state.mode===layout&&state.hasDraft&&!state.overflow&&state.input.width>=80&&state.host.right<=viewport.width+1,state);
   check(name+'-send-colour',state.sendBg===(tone==='light'?'rgb(23, 25, 30)':'rgb(22, 119, 232)')&&state.send.width===44&&state.send.right<=state.host.right,state);
   if(layout==='split')check(name+'-independent-glass',state.parentFilter==='none'&&state.layers===2&&state.glass.left>=state.lens.right+14&&state.lens.width===48&&state.plus.width===48&&state.glassFilter!=='none'&&state.plusFilter!=='none',state);
   else check(name+'-shared-glass',state.layers===0&&state.parentFilter!=='none'&&(layout==='classic'?state.wandVisible&&!state.merged:!state.wandVisible&&state.merged),state);
   if(viewport.width===393&&material==='original'&&tone==='light'){await page.locator('#nonQRFormItems').screenshot({path:out+'/'+engine+'-'+layout+'-input.png'});}
  }
 }
 await page.setViewportSize({width:393,height:759});await page.evaluate(()=>__nvwaMapProbe.configure({tone:'light',composerLayout:'split',compatibilityMode:'auto',glassStyle:'original'}));
 await page.evaluate(()=>document.getElementById('ilg-open-settings').click());await page.locator('[data-studio-tab="layout"]').click();
 check('picker-has-current-selection',await page.locator('[name="ilg-composer-layout"]:checked').inputValue()==='split');
 check('three-illustrated-choices',await page.locator('[name="ilg-composer-layout"]').count()===3&&await page.locator('.ilg-composer-choice svg').count()===3);
 await page.locator('.ilg-composer-choice').screenshot({path:out+'/'+engine+'-layout-picker.png'});
 for(const layout of ['classic','unified','split']){
  await page.locator('[name="ilg-composer-layout"][value="'+layout+'"]').check({force:true});await page.waitForTimeout(120);check('picker-applies-'+layout,(await sample()).mode===layout&&(await sample()).hasDraft&&await page.locator('[name="ilg-composer-layout"]:checked').inputValue()===layout);
 }
 await page.waitForTimeout(1300);check('layout-saved',savedSettings.some(s=>s.extension_settings?.iosLiquidGlass?.composerLayout==='split'),savedSettings.map(s=>Object.keys(s)));
 await page.locator('[name="ilg-composer-layout"][value="unified"]').check({force:true});await page.waitForTimeout(1300);const persisted=savedSettings.at(-1);check('unified-choice-persisted',persisted.extension_settings?.iosLiquidGlass?.composerLayout==='unified');
 await page.route('**/api/settings/get',async route=>{const response=await route.fetch();const data=await response.json();data.settings=JSON.stringify(persisted);await route.fulfill({response,json:data});});
 await page.reload();await page.waitForFunction(()=>window.__nvwaHostReady&&document.documentElement.dataset.ilgComposerLayout==='unified',null,{timeout:30000});check('reload-restores-selected-layout',await page.locator('html').evaluate(e=>e.dataset.ilgComposerLayout==='unified'));
 await page.evaluate(()=>__nvwaMapProbe.configure({composerLayout:'split',home:false,floatBall:false,tone:'light'}));
 await page.locator('#options_button').click();check('split-menu-opens',await page.locator('#options').isVisible());await page.keyboard.press('Escape');check('menu-closes-and-restores-plus-focus',await page.locator('#options').isHidden()&&await page.locator('#options_button').evaluate(e=>document.activeElement===e));
 for(const tone of ['light','dark']){await page.evaluate(tone=>{__nvwaMapProbe.configure({tone,customTextTone:tone==='light'?'dark':'light'});document.body.classList.add('no-blur');__nvwaMapProbe.configure({});},tone);await page.waitForFunction(()=>getComputedStyle(document.getElementById('ilg-composer-plus-glass')).backdropFilter==='none');check('no-blur-fallback-'+tone,await page.locator('#ilg-composer-plus-glass').evaluate(e=>getComputedStyle(e).backdropFilter==='none'&&parseFloat(getComputedStyle(e).backgroundColor.split(',').at(-1))>=.8));await page.evaluate(()=>document.body.classList.remove('no-blur'));}
 await page.evaluate(()=>__nvwaMapProbe.configure({tone:'light',customTextTone:'dark'}));
 await page.locator('#send_textarea').fill('第一行草稿\n第二行继续写\n第三行也保留\n第四行测试换行\n第五行保持间隙');await page.waitForTimeout(200);
 for(const layout of ['classic','unified','split'])for(const tone of ['light','dark']){
 await page.evaluate(({layout,tone})=>{__nvwaMapProbe.configure({composerLayout:layout,tone,customTextTone:tone==='light'?'dark':'light',compatibilityMode:'auto',glassStyle:'original'});document.getElementById('send_but').style.setProperty('display','none','important');document.getElementById('mes_stop').style.setProperty('display','flex','important');},{layout,tone});await page.waitForTimeout(210);
 await page.waitForFunction(tone=>getComputedStyle(document.getElementById('mes_stop')).backgroundColor===(tone==='light'?'rgb(23, 25, 30)':'rgb(22, 119, 232)'),tone);
 const stop=await page.locator('#mes_stop').evaluate(e=>{const s=getComputedStyle(e),icon=getComputedStyle(e.querySelector('i'),'::before'),r=e.getBoundingClientRect();return{bg:s.backgroundColor,width:r.width,height:r.height,iconW:icon.width,iconH:icon.height,mask:icon.maskImage};});check('stop-state-'+layout+'-'+tone,stop.width===44&&stop.height===44&&stop.iconW==='13px'&&stop.iconH==='13px'&&stop.mask==='none'&&stop.bg===(tone==='light'?'rgb(23, 25, 30)':'rgb(22, 119, 232)'),stop);
 if(layout==='split')await page.locator('#nonQRFormItems').screenshot({path:out+'/'+engine+'-'+tone+'-stop.png'});
}
 await page.evaluate(()=>{__nvwaMapProbe.configure({composerLayout:'split',tone:'light'});document.getElementById('mes_stop').style.removeProperty('display');});
 const multi=await sample();check('multiline-keeps-gap',multi.glass.height>=100&&multi.glass.left>=multi.lens.right+14,multi);await page.locator('#nonQRFormItems').screenshot({path:out+'/'+engine+'-split-multiline.png'});
 await page.evaluate(()=>__nvwaMapProbe.configure({enabled:false}));check('disable-releases-layout',await page.locator('.ilg-composer-glass').count()===0&&!await page.locator('html').evaluate(e=>e.classList.contains('ilg-merged-tools')));
 await page.evaluate(()=>__nvwaMapProbe.configure({enabled:true}));check('reenable-restores-split',await page.locator('.ilg-composer-glass').count()===2);
 check('no-page-errors',errors.length===0,errors);
 await fs.writeFile(out+'/'+engine+'-layout-results.json',JSON.stringify({engine,checks,scope:'Real local SillyTavern in disposable data root; desktop engine, no physical phone'},null,2));console.log(JSON.stringify({engine,passed:checks.length,errors}));
}catch(error){console.error('STAGE',stage);console.error('PAGE ERRORS',JSON.stringify(errors));await page?.screenshot({path:out+'/failure-'+(process.env.NVWA_BROWSER||'chromium')+'.png'});throw error;}finally{await browser?.close();if(child.exitCode===null&&!child.killed){child.kill();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,5000).unref();});}}
