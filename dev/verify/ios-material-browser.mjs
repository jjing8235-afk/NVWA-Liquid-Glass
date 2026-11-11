// Full-extension iOS policy/material checks in isolated desktop browsers. Not iPhone rendering evidence.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(process.env.NVWA_EXTENSION_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const moduleName=process.env.NVWA_PLAYWRIGHT_MODULE||'playwright';
const tools=await import(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName);
const harness=fs.readFileSync(path.join(root,'dev/verify/home-avatar-browser.mjs'),'utf8');
const template=harness.slice(harness.indexOf('function fixture('),harness.indexOf('const server='));
const fixture=vm.runInNewContext('('+template.trim()+')',{hostCSS:''});
const setup=String.raw`
const config=JSON.parse(new URL(location.href).searchParams.get('config'));
Object.assign(settings,{refract:false,iosSvgTrial:false,islands:true,home:false,tint:.05,chatFontSize:17,chatBackground:'glass',mesBlur:3,mesTint:.5},config.settings||{},JSON.parse(localStorage.getItem('ios-material-settings')||'{}'));
context.saveSettingsDebounced=()=>{localStorage.setItem('ios-material-settings',JSON.stringify(context.extensionSettings.iosLiquidGlass))};
window.__TAURITAVERN_HOST__=config.host||undefined;
if(config.platform)Object.defineProperty(navigator,'platform',{value:config.platform});
if(config.touch!==undefined)Object.defineProperty(navigator,'maxTouchPoints',{value:config.touch});
if(config.probe){const originalSupports=CSS.supports.bind(CSS);CSS.supports=(property,value)=>{if(value==='blur(1px)'&&/backdrop-filter/.test(property))return config.probe==='prefix-only'&&property==='-webkit-backdrop-filter';if(value&&value.startsWith('url(')&&/backdrop-filter/.test(property)&&config.probe==='prefix-only')return property==='-webkit-backdrop-filter';return originalSupports(property,value)};}
const hostStyle=document.createElement('style');hostStyle.textContent='textarea{color:var(--SmartThemeBodyColor)}#fixture-outside{display:none}';document.head.append(hostStyle);
document.body.classList.toggle('bubblechat',!!config.bubble);
const bg=document.createElement('div');bg.id='bg1';bg.style.cssText='position:fixed;inset:0;z-index:-1;background-size:cover;background-position:center';bg.style.backgroundImage='url("/wallpapers/liquid glass '+(config.tone==='light'?'porcelain':'ink')+'.png")';document.body.prepend(bg);
window.materialMount=()=>{fixtureChatId='existing-fixture-chat';document.getElementById('chat').innerHTML='<div class="mes" mesid="0"><div class="mes_block"><div class="ch_name">阅读中的故事</div><div class="mes_text"><p>风掠过窗边，远处的灯一盏一盏亮起。<q>故事还很长，慢慢说。</q></p><div id="authored-card" class="author-card" style="background:rgb(239,228,210);color:rgb(72,49,41);padding:18px"><button id="author-action">原有卡片按钮</button><div id="author-fixed" style="position:fixed;left:20px;bottom:96px;width:80px;height:32px">原有浮窗</div><iframe title="卡片内部样式" srcdoc="<p style=\'color:purple\'>原有前端</p>"></iframe></div><p>留白与文字保持原来的节奏。背景、字号和卡片内容不随材质开关改变。</p></div></div></div>';window.authorClicks=0;document.getElementById('author-action').onclick=()=>authorClicks++;};materialMount();
document.getElementById('send_textarea').placeholder='写下你的下一句话…';
`;
function html(config){return fixture(0,true,config.tone||'dark').replace('window.fixtureReady=false;',setup+'\nwindow.fixtureReady=false;')}
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),p=decodeURIComponent(u.pathname);
 if(p==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html(JSON.parse(u.searchParams.get('config'))));return}
 if(p.startsWith('/extension/')){const f=path.resolve(root,p.slice(11));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));return}
 if(p.startsWith('/wallpapers/')){const photo=process.env.NVWA_MATERIAL_WALLPAPER;if(photo&&fs.existsSync(photo)){res.setHeader('Content-Type','image/jpeg');res.end(fs.readFileSync(photo));return}res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#98afbb"/></svg>');return}
 res.writeHead(p==='/favicon.ico'?204:404);res.end();
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const engine=process.env.NVWA_BROWSER||'chromium';
const browser=await tools[engine].launch({headless:true,...(engine==='chromium'&&process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})});
const out=path.join(root,'dev/verify/out/ios-material');fs.mkdirSync(out,{recursive:true});
const errors=[],results=[];
const userAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const ready=async p=>{await p.waitForFunction(()=>window.fixtureReady||window.fixtureFailure);assert.equal(await p.evaluate(()=>window.fixtureFailure),null);await p.waitForFunction(()=>getComputedStyle(document.getElementById('nonQRFormItems')).backdropFilter!=='none');await p.evaluate(()=>settle(80));};
const state=async p=>p.evaluate(()=>{const e=document.getElementById('nonQRFormItems'),s=getComputedStyle(e),b=getComputedStyle(e,'::before'),a=getComputedStyle(e,'::after'),r=e.getBoundingClientRect();return{root:document.documentElement.className,filter:s.backdropFilter,prefixed:s.webkitBackdropFilter,rim:b.content,rimOpacity:b.opacity,rimMask:b.maskComposite,veil:a.content,veilHeight:a.height,shadow:s.boxShadow,width:r.width,x:r.x,bottom:r.bottom,draft:document.getElementById('send_textarea').value,body:getComputedStyle(document.querySelector('.mes_text>p')).color,authorColor:getComputedStyle(document.getElementById('authored-card')).color,addedReadingSurfaces:document.querySelectorAll('.ilg-reading-surface,[data-ilg-prose]').length}});
const toggle=async(p,key,value)=>{await p.locator('#ilg-opt-'+key).evaluate((el,value)=>{el.checked=value;el.dispatchEvent(new Event('change',{bubbles:true}))},value);await p.evaluate(()=>settle(50));};
try {
 for(const tone of ['light','dark']){
  const c=await browser.newContext({viewport:{width:402,height:778},deviceScaleFactor:3,isMobile:true,hasTouch:true,userAgent});const p=await c.newPage();p.on('pageerror',e=>errors.push(String(e)));
  const config={tone,host:{platform:'ios',kind:'mobile'},settings:{tone}};
  await p.goto('http://127.0.0.1:'+server.address().port+'/?config='+encodeURIComponent(JSON.stringify(config)));await ready(p);
  const initial=await state(p);assert(initial.root.includes('ilg-ios-material'));assert(!initial.filter.includes('url('));assert(initial.filter.includes('blur(1px)'));assert.equal(initial.rim,'""');assert.equal(initial.veil,'""');assert(initial.shadow!=='none');assert(initial.x>=0&&initial.width<=402&&initial.bottom<=778);assert.equal(initial.addedReadingSurfaces,0);assert.equal(initial.authorColor,'rgb(72, 49, 41)');
  assert.equal(await p.locator('#ilg-ios-material-setting').getAttribute('hidden'),null,'iOS setting is available');
  assert.equal(await p.locator('.mes.ilg-glass').count(),0,'non-bubble chats do not acquire message material');
  const settingsBefore=await p.evaluate(()=>{const s=SillyTavern.getContext().extensionSettings.iosLiquidGlass;return{mode:s.chatBackground,blur:s.mesBlur,tint:s.mesTint,font:s.chatFontSize,v:s.v}});
  const fixed=await p.locator('#author-fixed').boundingBox();
  await p.locator('#send_textarea').fill('未发送的输入保留');await p.locator('#send_textarea').focus();assert.equal((await state(p)).rimOpacity,'1','focus brightens the existing rim');
  await p.locator('#send_textarea').blur();
  await p.screenshot({path:path.join(out,engine+'-'+tone+'-compatible.png'),scale:'css'});
  await toggle(p,'iosMaterial',false);const basic=await state(p);assert(!basic.root.includes('ilg-ios-material'));assert.equal(basic.rim,'none');assert.equal(basic.veil,'none');assert.equal(basic.draft,'未发送的输入保留');
  await p.screenshot({path:path.join(out,engine+'-'+tone+'-basic.png'),scale:'css'});
  await p.reload();await ready(p);assert(!((await state(p)).root.includes('ilg-ios-material')),'disabled material survives reload');await toggle(p,'iosMaterial',true);assert((await state(p)).root.includes('ilg-ios-material'));
  await p.evaluate(()=>document.body.classList.add('no-blur'));await p.waitForFunction(()=>getComputedStyle(document.getElementById('nonQRFormItems')).backdropFilter==='none');const paused=await state(p);assert.equal(paused.rim,'none');assert.equal(paused.veil,'none');assert((await p.locator('#ilg-status').textContent()).includes('关闭模糊'));await p.evaluate(()=>document.body.classList.remove('no-blur'));await p.waitForFunction(()=>getComputedStyle(document.getElementById('nonQRFormItems'),'::before').content==='""');
  await p.evaluate(()=>document.body.classList.add('noShadows'));assert.equal((await state(p)).shadow,'none');await p.evaluate(()=>document.body.classList.remove('noShadows'));
  await toggle(p,'refract',true);await toggle(p,'iosSvgTrial',true);assert(!((await state(p)).root.includes('ilg-ios-material')),'experimental SVG does not mix with compatibility light');assert((await state(p)).filter.includes('url('));
  await p.locator('#ilg-opt-compatibilityMode').evaluate(el=>{el.value='blur';el.dispatchEvent(new Event('change',{bubbles:true}))});assert((await state(p)).root.includes('ilg-ios-material'),'explicit blur wins over SVG experiment');assert(!((await state(p)).filter.includes('url(')));
  await p.locator('#ilg-opt-compatibilityMode').evaluate(el=>{el.value='auto';el.dispatchEvent(new Event('change',{bubbles:true}))});await toggle(p,'iosSvgTrial',false);await toggle(p,'refract',false);
  await p.evaluate(()=>{document.getElementById('extensions_settings2').style.cssText='display:block;position:fixed;inset:0;z-index:30000;overflow:auto;background:#fff';});await p.locator('#ilg-opt-iosReportCopy').click();const report=await p.locator('#ilg-opt-iosReport').inputValue();assert(report.includes('1.4.4-local.5'));assert(report.includes('兼容玻璃 / 当前生效: true / true'));assert(report.includes('不做像素位移'));assert(report.includes('未使用气泡样式'));assert(!report.includes('未发送的输入保留'));await p.evaluate(()=>document.getElementById('extensions_settings2').style.display='none');
  await p.locator('#author-action').click();assert.equal(await p.evaluate(()=>authorClicks),1);
  const fixedAfter=await p.locator('#author-fixed').boundingBox();assert(Math.abs(fixedAfter.x-fixed.x)<1&&Math.abs(fixedAfter.y-fixed.y)<1);
  const settingsAfter=await p.evaluate(()=>{const s=SillyTavern.getContext().extensionSettings.iosLiquidGlass;return{mode:s.chatBackground,blur:s.mesBlur,tint:s.mesTint,font:s.chatFontSize,v:s.v}});assert.deepEqual(settingsAfter,settingsBefore);
  await p.setViewportSize({width:402,height:430});await p.waitForFunction(()=>document.getElementById('nonQRFormItems').getBoundingClientRect().bottom<=430);assert((await state(p)).bottom<=430);await p.setViewportSize({width:402,height:778});
  await p.evaluate(()=>document.body.classList.add('bubblechat'));await p.waitForFunction(()=>document.querySelector('.mes.ilg-glass'));assert.equal(await p.locator('#authored-card').evaluate(e=>getComputedStyle(e).color),'rgb(72, 49, 41)');
  await toggle(p,'enabled',false);assert.equal(await p.locator('.ilg-glass').count(),0);assert(!((await state(p)).root.includes('ilg-ios-material')));await toggle(p,'enabled',true);assert((await state(p)).root.includes('ilg-ios-material'));
  results.push({engine,tone,viewport:{width:402,height:778,dpr:3},initial,basic,checks:['user-log refract=false path','non-bubble controls','light/dark','material off and persistence','no-blur pause/resume','noShadows','SVG isolation and explicit blur precedence','diagnostic privacy/version/semantics','authored palette and event','fixed overlay geometry','font/background/blur/tint/version preservation','short viewport','bubble admission','disable and re-enable']});await c.close();
 }
 for(const [label,ua,host,compat] of [['desktop','Windows NT Chrome/130',null,false],['android','Android; wv Chrome/130',{platform:'android',kind:'mobile'},false],['tt-ios-desktop-ua','Macintosh; Intel Mac OS X AppleWebKit/605.1.15',{platform:'ios',kind:'mobile'},true]]){
  const c=await browser.newContext({viewport:{width:768,height:1024},userAgent:ua});const p=await c.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:'+server.address().port+'/?config='+encodeURIComponent(JSON.stringify({tone:'dark',host,settings:{tone:'dark'}})));await ready(p);assert.equal((await state(p)).root.includes('ilg-ios-material'),compat,label);results.push({engine,case:label,compat,pass:true});await c.close();
 }
 for(const config of [
  {name:'iPad desktop identity',platform:'MacIntel',touch:5,expect:true},
  {name:'prefixed-only CSS support',host:{platform:'ios',kind:'mobile'},probe:'prefix-only',expect:true},
  {name:'missing system blur',host:{platform:'ios',kind:'mobile'},probe:'no-blur',expect:false},
  {name:'invalid saved material opt-in',host:{platform:'ios',kind:'mobile'},settings:{iosMaterial:'true'},expect:false}
 ]){
  const c=await browser.newContext({viewport:{width:768,height:1024},userAgent:'Macintosh AppleWebKit/605.1.15'});const p=await c.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto('http://127.0.0.1:'+server.address().port+'/?config='+encodeURIComponent(JSON.stringify({...config,tone:'dark',settings:{tone:'dark',...config.settings}})));await ready(p);assert.equal((await state(p)).root.includes('ilg-ios-material'),config.expect,config.name);results.push({engine,case:config.name,compat:config.expect,pass:true});await c.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,engine+'-results.json'),JSON.stringify({results,errors,limitations:['Desktop browser executes the real extension using simulated iOS identity; not an Apple device','No true background pixel displacement is implemented in compatibility material','Real TT install, keyboard/safe area and sustained phone performance require iPhone acceptance']},null,2));console.log(JSON.stringify({engine,cases:results.length,errors,results},null,2));
} finally {await browser.close();await new Promise(r=>server.close(r));}
