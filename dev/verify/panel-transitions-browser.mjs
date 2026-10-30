import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const moduleName=process.env.NVWA_PLAYWRIGHT_MODULE||'playwright';
const tools=await import(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName);
const root=path.resolve(process.env.NVWA_EXTENSION_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const baseline=process.env.NVWA_EXPECT_BASELINE==='1',engine=process.env.NVWA_BROWSER||'chromium';
let source=fs.readFileSync(path.join(root,'index.js'),'utf8');
for(const [a,b] of [
 ['function paint(el) {','function paint(el) { if(!el.matches?.("#chat .mes")) audit.paints[el.id||el.className]=(audit.paints[el.id||el.className]||0)+1; else audit.messagePaints++;'],
 ['function buildPhysical(it, el, w, h, r) {','function buildPhysical(it, el, w, h, r) { if(it.kind!=="mes")audit.physical++;'],
 ['function scan() {','function scan() { audit.fullScans++;']
]){assert(source.includes(a));source=source.replace(a,b)}
let glass=fs.readFileSync(path.join(root,'glass2.js'),'utf8').replace('if (!m) {','if (!m) { audit.maps++;');
const jquery=process.env.NVWA_JQUERY_FILE?fs.readFileSync(process.env.NVWA_JQUERY_FILE):null;
const presetCSS=process.env.NVWA_PRESET_CSS?fs.readFileSync(process.env.NVWA_PRESET_CSS,'utf8'):'';
const drawers=['ai-config-button','sys-settings-button','advanced-formatting-button','WI-SP-button','user-settings-button','backgrounds-button','extensions-settings-button','persona-management-button','rightNavHolder'];
function fixture(floors,mode,tone){return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Panel transition regression fixture</title><style>
:root{--animation-duration:125ms;--animation-duration-2x:250ms;--topBarBlockSize:56px;--sheldWidth:100vw;--mainFontSize:16px;--mainFontFamily:system-ui;--SmartThemeBodyColor:${tone==='light'?'#252731':'#eee'};--SmartThemeBlurTintColor:#243040;--SmartThemeBorderColor:#888;--SmartThemeQuoteColor:#cb6a30;--SmartThemeBlurStrength:12px}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(40deg,#7088a0,#c5a98a);font:16px/1.5 system-ui;color:var(--SmartThemeBodyColor)}button,input{font:inherit}button{cursor:pointer}#top-bar{position:fixed;inset:0 0 auto;height:56px;z-index:200}#top-settings-holder{display:flex;height:56px}.drawer-icon{width:38px;height:38px}.drawer-content{position:fixed;display:none;height:0;inset:64px 10px auto;overflow:hidden;padding:12px;background:#213044;transition-property:height,display;transition-duration:var(--animation-duration-2x);transition-timing-function:ease-in-out;transition-behavior:allow-discrete}.drawer-content.openDrawer{display:block;height:auto;height:calc-size(auto,size);overflow-y:auto}@starting-style{.drawer-content.openDrawer{height:0}}.settings-fixture{height:480px}#extensions_settings2{display:none}#sheld{position:fixed;inset:64px 0 90px}#chat{height:100%;overflow:auto;padding:0 12px}.mes{padding:18px;min-height:180px;margin:12px 0;border-radius:22px}#form_sheld{position:fixed;bottom:10px;left:12px;right:12px}#nonQRFormItems{height:64px;display:flex;align-items:center;border-radius:28px}#leftSendForm{display:flex}#send_textarea{height:32px;width:120px}#options,#extensionsMenu{position:fixed;bottom:88px;left:12px;display:none;z-index:1000;background:rgba(30,40,60,.5);backdrop-filter:blur(12px)}.options-content{display:block;width:220px}#extensionsMenu{width:230px}.menu-item{display:block;width:100%;padding:10px}
dialog.popup{border:0;padding:14px;max-height:82dvh;width:min(740px,calc(100vw - 32px));color:var(--SmartThemeBodyColor);background:#24344a;border-radius:28px}dialog.popup .popup-body{display:flex;flex-direction:column;max-height:75dvh}.popup-content{overflow:auto;min-height:0}.popup-controls{display:flex;gap:8px;margin-top:10px}.popup-controls button{flex:1}.nvp-head{margin:0 0 14px;font-size:20px;font-weight:700}
#nvwa-panel{--nvp-d:125ms;--nvp-ease:ease}#nvwa-panel .nvp-tabbar{position:sticky;top:0;z-index:3;background:rgba(120,130,150,.25);backdrop-filter:blur(12px)}#nvwa-panel .nvp-tabs{display:flex;gap:4px}#nvwa-panel .nvp-tab{flex:1;padding:9px 3px}#nvwa-panel .nvp-page{display:none}#nvwa-panel .nvp-page.on{display:block;animation:fixture-page calc(var(--nvp-d)*3) ease}#nvwa-panel .nvp-sec{margin-bottom:8px;animation:fixture-rise calc(var(--nvp-d)*3) ease both;animation-delay:calc(var(--nvp-i,0)*var(--nvp-d)*.6)}#nvwa-panel .nvp-sec-h{padding:12px;background:rgba(110,120,140,.3)}#nvwa-panel .nvp-sec-b{display:grid;grid-template-rows:0fr;opacity:0;visibility:hidden;transition:grid-template-rows calc(var(--nvp-d)*3) ease,opacity calc(var(--nvp-d)*3) ease,visibility 0s linear calc(var(--nvp-d)*3)}#nvwa-panel .nvp-sec.open .nvp-sec-b{grid-template-rows:1fr;opacity:1;visibility:visible;transition:grid-template-rows calc(var(--nvp-d)*3) ease,opacity calc(var(--nvp-d)*3) ease,visibility 0s}#nvwa-panel .nvp-sec-clip{overflow:hidden;min-height:0}.nvp-sec-inner{padding:14px}.test-rows{height:180px}@keyframes fixture-page{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:none}}@keyframes fixture-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
</style><link rel="stylesheet" href="/extension/style.css"><style>${presetCSS}</style></head><body class="bubblechat">
<div id="top-bar"><div id="top-settings-holder">${drawers.map(id=>`<div id="${id}" class="drawer"><div class="drawer-toggle"><div class="drawer-icon fa-solid fa-gear" title="${id}"></div></div><div class="drawer-content" id="panel-${id}"><div class="settings-fixture">Settings ${id}</div></div></div>`).join('')}</div></div><div id="extensions_settings2"></div>
<div id="sheld"><div id="chat">${Array.from({length:floors},(_,i)=>`<div class="mes${i===floors-1?' last_mes':''}" mesid="${i}" is_user="false"><div class="mes_text"><p>Long chat ${i}: readable background for rendering checks.</p><p>Test content.</p></div></div>`).join('')}</div><form id="form_sheld"><div id="nonQRFormItems"><div id="leftSendForm"><button type="button" id="options_button">+</button><button type="button" id="extensionsMenuButton">Wand</button></div><textarea id="send_textarea"></textarea></div></form></div>
<div id="options"><div class="options-content">${['New chat','Regenerate','Continue','History'].map(x=>'<button type="button" class="menu-item">'+x+'</button>').join('')}</div></div><div id="extensionsMenu">${['Preset','Memory','Tools'].map(x=>'<button type="button" class="menu-item">'+x+'</button>').join('')}</div>
${jquery?'<script src="/host-jquery.js"></script>':''}<script>
window.audit={paints:{},physical:0,maps:0,encodes:0,messagePaints:0,fullScans:0};window.resetAudit=()=>{audit={paints:{},physical:0,maps:0,encodes:0,messagePaints:0,fullScans:0}};
const encode=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(...args){audit.encodes++;return encode.apply(this,args)};
const settings={v:9,enabled:true,home:false,orb:false,islands:false,fold:true,follow:false,wallsReady:true,tone:'${tone}',compatibilityMode:'${mode}'};const registry=[];
const context={extensionSettings:{iosLiquidGlass:settings},Popup:{util:{popups:registry}},powerUserSettings:{auto_scroll_chat_to_bottom:false},chatMetadata:{},getCurrentChatId:()=> 'isolated-panels',eventSource:{on(){}},eventTypes:{},saveSettingsDebounced(){},getRequestHeaders:()=>({})};window.SillyTavern={getContext:()=>context};window.toastr={warning(){},info(){},success(){},error(){}};
window.settle=async(ms=650)=>{await new Promise(r=>setTimeout(r,ms));for(let i=0;i<3;i++)await new Promise(requestAnimationFrame)};
for(const d of document.querySelectorAll('.drawer'))d.querySelector('.drawer-toggle').onclick=()=>{const p=d.querySelector('.drawer-content');p.classList.toggle('openDrawer');p.classList.toggle('closedDrawer',!p.classList.contains('openDrawer'))};
window.fixtureActions={tabs:0,toggles:0,saved:0,cancelled:0};
window.openPreset=(registered=true,rootId='nvwa-panel')=>{const dlg=document.createElement('dialog');dlg.className='popup';dlg.dataset.id='fixture-'+Math.random();dlg.innerHTML='<div class="popup-body"><div class="popup-content"><div id="'+rootId+'"><div class="nvp-head">NVWA fixture panel</div><div class="nvp-tabbar"><div class="nvp-tabs" role="tablist">'+['Style','Correction','Model','Plan'].map((x,i)=>'<div tabindex="0" class="nvp-tab" role="tab" data-tab="'+i+'">'+x+'</div>').join('')+'</div></div>'+[0,1,2,3].map((t)=>'<div class="nvp-page'+(!t?' on':'')+'" data-page="'+t+'">'+Array.from({length:t%2?5:2},(_,i)=>'<section class="nvp-sec" style="--nvp-i:'+i+'"><div class="nvp-sec-h" role="button" tabindex="0" aria-expanded="false">Section '+i+'</div><div class="nvp-sec-b"><div class="nvp-sec-clip"><div class="nvp-sec-inner"><label><input type="checkbox" class="preset-feature"> Feature</label><div class="test-rows">Function fixture</div></div></div></div></section>').join('')+'</div>').join('')+'</div></div><div class="popup-controls"><button type="button" class="menu_button popup-button-ok">Save</button><button type="button" class="menu_button cancel">Cancel</button></div></div>';if(registered)registry.push({dlg});document.body.append(dlg);dlg.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{fixtureActions.tabs++;dlg.querySelectorAll('[data-page]').forEach(p=>p.classList.toggle('on',p.dataset.page===b.dataset.tab))});dlg.querySelectorAll('.nvp-sec-h').forEach(h=>h.onclick=()=>{fixtureActions.toggles++;const open=h.parentElement.classList.toggle('open');h.setAttribute('aria-expanded',String(open))});dlg.querySelector('.popup-button-ok').onclick=()=>{fixtureActions.saved++;dlg.close();dlg.remove()};dlg.querySelector('.cancel').onclick=()=>{fixtureActions.cancelled++;dlg.close();dlg.remove()};dlg.showModal();return dlg;};
window.fade=(id,open)=>{const el=document.getElementById(id);if(window.jQuery){jQuery(el)[open?'fadeIn':'fadeOut'](125);return}el.getAnimations().forEach(a=>a.cancel());if(open)el.style.display='block';const a=el.animate([{opacity:open?0:1},{opacity:open?1:0}],{duration:125});a.onfinish=()=>{if(!open)el.style.display='none'};};
for(const [button,id] of [['options_button','options'],['extensionsMenuButton','extensionsMenu']])document.getElementById(button).onclick=()=>fade(id,getComputedStyle(document.getElementById(id)).display==='none');
window.fixtureReady=false;window.fixtureFailure=null;
</script><script type="module">try{await import('/extension/index.js');fixtureReady=true}catch(e){fixtureFailure=String(e.stack||e);throw e}</script></body></html>`;}
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),p=decodeURIComponent(u.pathname);if(p==='/host-jquery.js'&&jquery){res.setHeader('Content-Type','text/javascript');res.end(jquery);return}if(p==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fixture(Number(u.searchParams.get('floors'))||4,u.searchParams.get('mode')||'auto',u.searchParams.get('tone')||'dark'));return}if(p.startsWith('/extension/')){const file=path.resolve(root,p.slice(11));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(file===path.join(root,'index.js')?source:file===path.join(root,'glass2.js')?glass:fs.readFileSync(file));return}res.writeHead(p==='/favicon.ico'?204:404);res.end()});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const errors=[],results=[];
try{browser=await tools[engine].launch({headless:true,...(engine==='chromium'&&process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})});
for(const config of [{floors:4,mode:'auto',width:390,tone:'dark'},{floors:240,mode:'auto',width:390,tone:'light'},{floors:240,mode:'blur',width:390,tone:'dark'},{floors:240,mode:'auto',width:1280,tone:'light'}]){
 const p=await browser.newPage({viewport:{width:config.width,height:844},deviceScaleFactor:2});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/?'+new URLSearchParams(config));await p.waitForFunction(()=>fixtureReady||fixtureFailure);assert.equal(await p.evaluate(()=>fixtureFailure),null);await p.evaluate(()=>settle());
 const run=async(action,ms=650)=>{await p.evaluate(()=>resetAudit());await action();return await p.evaluate(async(ms)=>{await settle(ms);return structuredClone(audit)},ms)};
 const native=await run(()=>p.locator('#ai-config-button > .drawer-toggle').dispatchEvent('click'));
 assert(await p.locator('#panel-ai-config-button').isVisible());
 const close=await run(()=>p.locator('#ai-config-button > .drawer-toggle').dispatchEvent('click'));assert(!(await p.locator('#panel-ai-config-button').isVisible()));
 const reopen=await run(()=>p.locator('#ai-config-button > .drawer-toggle').dispatchEvent('click'));
 const closeAgain=await run(()=>p.locator('#ai-config-button > .drawer-toggle').dispatchEvent('click'));
 const menus=[];
 for(const [button,id] of [['options_button','options'],['extensionsMenuButton','extensionsMenu']]){const open=await run(()=>p.locator('#'+button).click());assert(await p.locator('#'+id).isVisible());const layers=await p.locator('#'+id).evaluate(el=>({animation:getComputedStyle(el).animationName,childAnimation:el.querySelector('.options-content')?getComputedStyle(el.firstElementChild).animationName:null}));const closed=await run(()=>p.locator('#'+button).click());assert(!(await p.locator('#'+id).isVisible()));menus.push({button,open,closed,layers})}
 const popup=await run(()=>p.evaluate(()=>openPreset()));assert.equal(await p.locator('dialog.ilg-adapted').count(),1);
 const tabbar=await p.locator('#nvwa-panel > .nvp-tabbar').evaluate(el=>({tracked:el.classList.contains('ilg-glass'),filter:getComputedStyle(el).backdropFilter||getComputedStyle(el).webkitBackdropFilter}));
 const tab=await run(()=>p.locator('[data-tab="1"]').click());assert.equal(await p.locator('[data-page="1"].on').count(),1);
 const section=await run(()=>p.locator('[data-page="1"] .nvp-sec-h').first().click());assert.equal(await p.locator('[data-page="1"] .nvp-sec-h').first().getAttribute('aria-expanded'),'true');
 const sectionClose=await run(()=>p.locator('[data-page="1"] .nvp-sec-h').first().click());
 await p.locator('[data-page="1"] .nvp-sec-h').first().click();await p.locator('[data-page="1"] .preset-feature').first().check();assert(await p.locator('[data-page="1"] .preset-feature').first().isChecked());
 if(process.env.NVWA_SCREENSHOT_DIR){fs.mkdirSync(process.env.NVWA_SCREENSHOT_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.NVWA_SCREENSHOT_DIR,`preset-${engine}-${config.width}-${config.mode}-${config.tone}.png`)})}
 await p.locator('.popup-button-ok').click();await p.evaluate(()=>settle(150));assert.equal(await p.evaluate(()=>fixtureActions.saved),1);assert.equal(await p.locator('dialog.popup').count(),0);
 await p.evaluate(()=>openPreset(false));await p.evaluate(()=>settle(150));assert.equal(await p.locator('dialog.ilg-glass').count(),0);await p.locator('dialog .cancel').click();
 const work={native,close,reopen,closeAgain,popup,tab,section,sectionClose,menus};
 if(!baseline){for(const value of [native,close,reopen,closeAgain,tab,section,sectionClose,...menus.flatMap(x=>[x.open,x.closed])]){assert.equal(value.fullScans,0);assert.equal(value.messagePaints,0)}assert(native.physical<=2,JSON.stringify(native));assert(section.physical<=2,JSON.stringify(section));assert.equal(tabbar.tracked,false);for(const m of menus){assert.equal(m.layers.animation,'none');if(m.layers.childAnimation)assert.equal(m.layers.childAnimation,'none')}}
 const lifecycle={};
 if(!baseline && config.floors===4){
  for(const id of drawers.slice(0,7)){
   await p.locator('#'+id+' > .drawer-toggle').dispatchEvent('click');
   await p.evaluate(()=>settle(30));
   assert(await p.locator('#panel-'+id).isVisible());
   await p.locator('#'+id+' > .drawer-toggle').dispatchEvent('click');
  }
  for(let i=0;i<7;i++)await p.locator('#ai-config-button > .drawer-toggle').dispatchEvent('click');
  assert(await p.locator('#panel-ai-config-button').isVisible());
  await p.locator('#ai-config-button > .drawer-toggle').dispatchEvent('click');
  lifecycle.allNativeDrawersAndRapidToggles=true;
  await p.evaluate(()=>openPreset());await p.evaluate(()=>settle(150));
  const filters=await p.locator('svg defs > filter').count();
  await p.locator('#nvwa-panel > .nvp-tabbar').evaluate(el=>el.replaceWith(el.cloneNode(true)));
  await p.evaluate(()=>settle(150));assert.equal(await p.locator('#nvwa-panel .ilg-glass').count(),0);assert.equal(await p.locator('svg defs > filter').count(),filters);
  lifecycle.replacedTabbarDoesNotLeakFilters=true;
  const enabled=p.locator('#ilg-opt-enabled');
  await enabled.evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}))});await p.evaluate(()=>settle(150));
  assert.equal(await p.locator('html.ilg').count(),0);assert.equal(await p.locator('dialog.ilg-adapted').count(),0);
  assert((await p.locator('#panel-ai-config-button').evaluate(el=>getComputedStyle(el).transitionProperty)).includes('height'));
  assert((await p.locator('#nvwa-panel .nvp-tabbar').evaluate(el=>getComputedStyle(el).backdropFilter||getComputedStyle(el).webkitBackdropFilter)).includes('blur'));
  await enabled.evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}))});await p.evaluate(()=>settle());assert.equal(await p.locator('dialog.ilg-adapted').count(),1);
  assert.equal(await p.locator('#nvwa-panel .nvp-tabbar').evaluate(el=>getComputedStyle(el).backdropFilter||getComputedStyle(el).webkitBackdropFilter),'none');
  lifecycle.disableRestoresHostAndEnableRestoresAdaptation=true;
  await p.evaluate(()=>document.body.classList.add('no-blur'));await p.evaluate(()=>settle(150));assert.equal(await p.locator('dialog.ilg-adapted').evaluate(el=>getComputedStyle(el).backdropFilter||getComputedStyle(el).webkitBackdropFilter),'none');
  await p.evaluate(()=>document.body.classList.remove('no-blur'));await p.locator('dialog .cancel').click();
  await p.evaluate(()=>openPreset(true,'nvwa-memory'));await p.evaluate(()=>settle(150));assert.equal(await p.locator('dialog.ilg-adapted').count(),1);assert.equal(await p.locator('#nvwa-memory .ilg-glass').count(),0);await p.locator('dialog .cancel').click();
  lifecycle.noBlurAndMemoryBoundary=true;
 }
 results.push({...config,tabbar,work,lifecycle,actions:await p.evaluate(()=>fixtureActions),nativeHeightAnimationSupported:await p.evaluate(()=>CSS.supports('height','calc-size(auto,size)'))});await p.close();
}
assert.deepEqual(errors,[]);console.log(JSON.stringify({kind:'isolated-panel-transitions',engine,baseline,actualPresetCSS:!!presetCSS,hostFadeDriver:jquery?'jquery':'web-animations',results,errors,limitations:['Synthetic host with actual native drawer height/display transition model and preset section structure','Original preset script and phone runtime are not executed; figures are work counts, not input latency']},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r))}
