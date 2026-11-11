// Isolated browser acceptance. Reuses the existing host fixture; never connects to user data.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=path.resolve(process.env.NVWA_EXTENSION_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const moduleName=process.env.NVWA_PLAYWRIGHT_MODULE||'playwright';
const tools=await import(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName);
const harness=fs.readFileSync(path.join(root,'dev/verify/home-avatar-browser.mjs'),'utf8');
const template=harness.slice(harness.indexOf('function fixture('),harness.indexOf('const server='));
assert(template.includes('window.fixtureReady=false'));
const fixture=vm.runInNewContext('('+template.trim()+')',{hostCSS:''});
const setup=String.raw`
const bg=document.createElement('div');bg.id='bg1';bg.style.cssText='position:fixed;inset:0;z-index:-1;background-size:cover;background-position:center';bg.style.backgroundImage='url("'+(localStorage.getItem('appearance-bg')||'/wallpapers/market.jpg')+'")';document.body.prepend(bg);
const catalog=document.createElement('div');catalog.id='bg_menu_content';catalog.hidden=true;
for(const [file,url] of [['liquid glass porcelain.png','/wallpapers/liquid%20glass%20porcelain.png'],['liquid glass ink.png','/wallpapers/liquid%20glass%20ink.png'],['market.jpg','/wallpapers/market.jpg'],['bright.svg','/wallpapers/bright.svg'],['night.svg','/wallpapers/night.svg'],['missing.svg','/wallpapers/missing.svg']]){const thumb=document.createElement('button');thumb.className='bg_example';thumb.setAttribute('bgfile',file);thumb.onclick=()=>{bg.style.backgroundImage='url("'+url+'")';localStorage.setItem('appearance-bg',url);window.nativeBackgroundClicks=(window.nativeBackgroundClicks||0)+1;};catalog.append(thumb)}document.body.append(catalog);
const picker=document.createElement('div');picker.id='backgrounds-button';picker.className='drawer';picker.innerHTML='<div class="drawer-icon" role="button" tabindex="0">背景</div>';picker.onclick=()=>{window.pickerOpened=true};document.getElementById('top-settings-holder').append(picker);
Object.assign(settings,{tone:'auto',refract:false,chatBackground:'transparent'},JSON.parse(localStorage.getItem('appearance-settings')||'{}'));
context.saveSettingsDebounced=()=>{localStorage.setItem('appearance-settings',JSON.stringify(context.extensionSettings.iosLiquidGlass))};
window.setWallpaper=file=>{document.querySelector('.bg_example[bgfile="'+file+'"]').click()};
`;
function html(){return fixture(0,true,'dark').replace('</head>',(process.env.NVWA_HOST_USER_CSS?'<link rel="stylesheet" href="/host-user.css">':'')+'</head>').replace('window.fixtureReady=false;',setup+'\nwindow.fixtureReady=false;')}
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),p=decodeURIComponent(u.pathname);
 if(p==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html());return}
 if(p==='/host-user.css'&&process.env.NVWA_HOST_USER_CSS){res.setHeader('Content-Type','text/css;charset=utf-8');res.end(fs.readFileSync(process.env.NVWA_HOST_USER_CSS));return}
 if(p.startsWith('/extension/')){const f=path.resolve(root,p.slice(11));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(f)]||'application/octet-stream');res.end(f===path.join(root,'index.js')?fs.readFileSync(f,'utf8'):fs.readFileSync(f));return}
 if(p.startsWith('/wallpapers/')){
  if(p.endsWith('missing.svg')){res.writeHead(404);res.end();return}
  const market=process.env.NVWA_MARKET_IMAGE;
  if(p.endsWith('market.jpg')&&market&&fs.existsSync(market)){res.setHeader('Content-Type','image/jpeg');res.end(fs.readFileSync(market));return}
  const color=/ink|night/.test(p)?'#182431':/market/.test(p)?'#c3b69d':'#f3eee6';
  res.setHeader('Content-Type','image/svg+xml');res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="${color}"/></svg>`);return
 }
 res.writeHead(p==='/favicon.ico'?204:404);res.end();
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const out=path.join(root,'dev/verify/out/appearance');fs.mkdirSync(out,{recursive:true});
const browser=await tools.chromium.launch({headless:true,...(process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})});
const errors=[],results=[];
const check=async(p,fn)=>{await p.waitForFunction(fn,null,{timeout:10000})};
const open=async p=>{if(await p.locator('#ilg-appearance-panel').isVisible())return;await p.getByRole('button',{name:/^外观：/}).click();await p.locator('#ilg-appearance-panel').waitFor({state:'visible'});await p.waitForFunction(()=>document.getElementById('ilg-appearance-panel').getAnimations().every(a=>a.playState==='finished'));};
try{
 for(const width of [390,1280]){
  const p=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(`http://127.0.0.1:${server.address().port}/`);await check(p,()=>window.fixtureReady||window.fixtureFailure);
  assert.equal(await p.evaluate(()=>window.fixtureFailure),null);
  await check(p,()=>document.documentElement.classList.contains('ilg-custom-wallpaper'));
  const original=await p.evaluate(()=>getComputedStyle(document.getElementById('bg1')).backgroundImage);
  assert(await p.evaluate(()=>[...document.querySelectorAll('.ilg-scrim')].every(e=>getComputedStyle(e).display==='none')),'custom wallpaper has no full-column scrims');
  await open(p);
  const r=await p.locator('#ilg-appearance-panel').boundingBox();assert(r.x>=10&&r.x+r.width<=width-10,'popover fits viewport');
  assert.equal(await p.locator('input[name="ilg-appearance-mode"]:checked').inputValue(),'custom');
  assert.equal(await p.locator('html').getAttribute('data-ilg-reading-style'),'warm','new typography is the safe default');
  assert.equal(await p.locator('[name="ilg-reading-style"]').count(),2);
  assert(!await p.locator('#ilg-tone-button svg').evaluate(e=>e.querySelector('rect')),'custom toolbar icon uses the new sliders');
  await p.screenshot({path:path.join(out,`${width}-custom-menu.png`)});
  await p.getByText('白天',{exact:true}).click();await check(p,()=>document.documentElement.classList.contains('ilg-light'));
  assert((await p.evaluate(()=>getComputedStyle(document.getElementById('bg1')).backgroundImage)).includes('porcelain'));
  assert.equal(await p.locator('#ilg-appearance-panel').isVisible(),true,'appearance choices stay open for comparison');
  await open(p);await p.getByText('黑夜',{exact:true}).click();await check(p,()=>!document.documentElement.classList.contains('ilg-light'));
  assert((await p.evaluate(()=>getComputedStyle(document.getElementById('bg1')).backgroundImage)).includes('ink'));
  await open(p);await p.getByText('自定义',{exact:true}).click();await check(p,()=>getComputedStyle(document.getElementById('bg1')).backgroundImage.includes('market'));
  assert.equal(await p.evaluate(()=>getComputedStyle(document.getElementById('bg1')).backgroundImage),original,'last custom wallpaper restored');
  await open(p);await p.locator('.ilg-text-choice').getByText('深色',{exact:true}).click();await check(p,()=>document.documentElement.classList.contains('ilg-light'));
  const color=await p.locator('#ilg-home h1').evaluate(e=>getComputedStyle(e).color);
  await p.evaluate(()=>window.dispatchEvent(new Event('scroll')));assert.equal(await p.locator('#ilg-home h1').evaluate(e=>getComputedStyle(e).color),color,'scroll keeps text color stable');
  await p.locator('.ilg-text-choice').getByText('浅色',{exact:true}).click();await check(p,()=>!document.documentElement.classList.contains('ilg-light'));
  await p.keyboard.press('Escape');assert.equal(await p.locator('#ilg-appearance-panel').isVisible(),false);
  assert(await p.getByRole('button',{name:/^外观：/}).evaluate(e=>e===document.activeElement),'Escape returns focus');
  await p.reload();await check(p,()=>window.fixtureReady||window.fixtureFailure);await check(p,()=>!document.documentElement.classList.contains('ilg-light'));
  assert.equal(await p.evaluate(()=>SillyTavern.getContext().extensionSettings.iosLiquidGlass.customTextTone),'light','manual text preference survives reload');
  await open(p);await p.locator('.ilg-text-choice').getByText('自动',{exact:true}).click();
  await p.evaluate(()=>setWallpaper('bright.svg'));await check(p,()=>document.documentElement.classList.contains('ilg-light'));
  await p.evaluate(()=>setWallpaper('night.svg'));await check(p,()=>!document.documentElement.classList.contains('ilg-light'));
  await p.evaluate(()=>setWallpaper('missing.svg'));await check(p,()=>SillyTavern.getContext().extensionSettings.iosLiquidGlass.customWallpaper.endsWith('missing.svg'));
  await open(p);await p.locator('.ilg-text-choice').getByText('深色',{exact:true}).click();await check(p,()=>document.documentElement.classList.contains('ilg-light'));
  await p.keyboard.press('Escape');await open(p);await p.locator('#fixture-outside').click();assert.equal(await p.locator('#ilg-appearance-panel').isVisible(),false);
  await p.getByRole('button',{name:/^外观：/}).focus();await p.keyboard.press('ArrowDown');assert(await p.locator('#ilg-appearance-panel').isVisible());await p.keyboard.press('Escape');
  await p.evaluate(()=>{SillyTavern.getContext().extensionSettings.iosLiquidGlass.customWallpaper='';setWallpaper('liquid glass ink.png')});await check(p,()=>!document.documentElement.classList.contains('ilg-custom-wallpaper'));
  await open(p);await p.getByText('自定义',{exact:true}).click();assert.equal(await p.evaluate(()=>window.pickerOpened),true,'missing custom wallpaper opens native chooser');
  await p.evaluate(()=>setWallpaper('market.jpg'));await check(p,()=>document.documentElement.classList.contains('ilg-custom-wallpaper'));
  await open(p);await p.locator('.ilg-text-choice').getByText('自动',{exact:true}).click();await p.keyboard.press('Escape');

  await p.waitForFunction(()=>document.querySelector('#ilg-home .ilg-home-title').getAnimations().every(a=>a.playState==='finished'));
  const homeType=await p.locator('#ilg-home .ilg-home-title').evaluate(e=>({color:getComputedStyle(e).color,weight:getComputedStyle(e).fontWeight}));
  assert.equal(homeType.color,'rgb(245, 245, 247)','photographic welcome stays pearl white');assert.equal(homeType.weight,'500','component title weight is actually applied');
  await p.screenshot({path:path.join(out,`${width}-custom-home.png`)});
  await p.evaluate(()=>{
    activeChat();
    document.getElementById('chat').innerHTML='<div class="mes" mesid="0" is_user="false"><div class="mes_block"><div class="ch_name"><span class="name_text">阅读配色样例</span></div><div class="mes_text" id="reading-fixture"><p id="native-one">窗外的天色渐渐暗下来，街上的灯一盏一盏亮起。他合上书，在窗边坐了片刻。文字应该清楚，壁纸仍然可以被看见。</p><p id="native-two"><q>“把故事慢慢说下去。”</q> 她笑了笑，<em>把书签留在这一页</em>，没有再催。<strong>重要的话，只需稍有分量。</strong></p><div id="author-card" style="background:rgb(242,230,210);color:rgb(76,39,47);padding:18px;margin-top:20px"><button id="author-action" class="author-button">卡片原生按钮</button><div id="author-fixed" style="position:fixed;right:14px;bottom:90px;width:70px;height:30px">浮窗</div><iframe title="作者自带内容" srcdoc="<p style=\'color:purple\'>卡片原样保留</p>"></iframe></div><p id="author-styled" style="color:purple">作者指定配色的段落</p></div></div></div>';
    window.authorClicks=0;document.getElementById('author-action').onclick=()=>authorClicks++;
  });

  await p.evaluate(()=>settle(120));
  assert.equal(await p.locator('.ilg-reading-surface').count(),0,'no added reading background');
  assert.equal(await p.locator('[data-ilg-prose]').count(),0,'no mutation of paragraph markup');
  assert.equal(await p.locator('#native-one').evaluate(e=>e.parentElement.id),'reading-fixture');
  assert.equal(await p.locator('#author-styled').getAttribute('style'),'color:purple','authored declarations are retained');assert.equal(await p.locator('#author-card').evaluate(e=>getComputedStyle(e).color),'rgb(76, 39, 47)','authored card palette is intact');
  const authored=await p.locator('#author-card').evaluate(e=>{const c=e.cloneNode(true);for(const n of c.querySelectorAll('.ilg-card-surface,.ilg-lit,.ilg-dim')){n.classList.remove('ilg-card-surface','ilg-lit','ilg-dim');if(!n.className)n.removeAttribute('class');}return c.innerHTML});
  await p.waitForFunction(()=>Array.from(document.querySelectorAll('#chat .mes')).every(e=>e.getAnimations({subtree:true}).every(a=>a.playState==='finished')));
  await check(p,()=>document.getElementById('author-fixed').classList.contains('ilg-card-surface'));
  const fixedBefore=await p.locator('#author-fixed').boundingBox();
  await p.locator('#author-action').click();assert.equal(await p.evaluate(()=>authorClicks),1);
  const glassBefore=await p.evaluate(()=>{const s=SillyTavern.getContext().extensionSettings.iosLiquidGlass;return {mode:s.chatBackground,blur:s.mesBlur,tint:s.mesTint}});
  const typography=[];
  for (const style of ['classic','warm']) {
    await open(p);await p.locator('.ilg-reading-choice label').filter({has:p.locator('input[value="'+style+'"]')}).click();
    assert.equal(await p.locator('html').getAttribute('data-ilg-reading-style'),style);
    for(const [label,light] of [['深色',true],['浅色',false]]){
      await p.locator('.ilg-text-choice').getByText(label,{exact:true}).click();
      await p.waitForFunction(expected=>document.documentElement.classList.contains('ilg-light')===expected,light);
      const role=await p.evaluate(()=>({body:getComputedStyle(document.getElementById('native-one')).color,weight:getComputedStyle(document.getElementById('native-one')).fontWeight,secondary:getComputedStyle(document.querySelector('#native-two em')).color,dialogue:getComputedStyle(document.querySelector('#native-two q')).color,dialogueWeight:getComputedStyle(document.querySelector('#native-two q')).fontWeight,dialogueDecoration:getComputedStyle(document.querySelector('#native-two q')).textDecorationLine,dialogueFill:getComputedStyle(document.querySelector('#native-two q')).backgroundImage,tracking:getComputedStyle(document.getElementById('native-one')).letterSpacing,paragraphBackground:getComputedStyle(document.getElementById('native-one')).backgroundColor,previewDialogue:getComputedStyle(document.querySelector('.ilg-reading-preview q')).color,previewBody:getComputedStyle(document.querySelector('.ilg-reading-preview')).color}));
      const expected=style==='classic'?(light?{body:'rgba(29, 29, 31, 0.86)',dialogue:'rgb(184, 74, 28)'}:{body:'rgba(242, 242, 247, 0.9)',dialogue:'rgb(255, 196, 140)'}):(light?{body:'rgb(44, 41, 38)',dialogue:'rgb(147, 83, 39)'}:{body:'rgb(232, 229, 224)',dialogue:'rgb(227, 183, 131)'});
      assert.equal(role.body,expected.body);assert.equal(role.dialogue,expected.dialogue);assert.equal(role.weight,'400');assert.equal(role.dialogueWeight,style==='classic'?'400':'500');
      assert.equal(role.previewBody,role.body);assert.equal(role.previewDialogue,role.dialogue,'preview uses the actual prose tokens');
      assert.equal(role.dialogueDecoration,style==='classic'?'none':'underline');assert.equal(role.dialogueFill==='none',style!=='classic');
      assert.equal(role.paragraphBackground,'rgba(0, 0, 0, 0)','font styling does not add paragraph fills');
      const panelBox=await p.locator('#ilg-appearance-panel').boundingBox();assert(panelBox.y>=12&&panelBox.y+panelBox.height<=844-11,'panel fits vertically');
      const clipping=await p.locator('#ilg-appearance-panel').evaluate(e=>e.scrollWidth>e.clientWidth);assert(!clipping,'no horizontal overflow in panel');
      assert.equal(await p.locator('#author-card').evaluate(e=>getComputedStyle(e).color),'rgb(76, 39, 47)','switching preserves the authored card palette');
      assert(await p.locator('#author-action').evaluate(e=>e.classList.contains('author-button')),'authored classes stay in place');
      assert.equal(await p.locator('#author-card').evaluate(e=>{const c=e.cloneNode(true);for(const n of c.querySelectorAll('.ilg-card-surface,.ilg-lit,.ilg-dim')){n.classList.remove('ilg-card-surface','ilg-lit','ilg-dim');if(!n.className)n.removeAttribute('class');}return c.innerHTML}),authored);
      typography.push({style,mode:label,...role});
      await p.screenshot({path:path.join(out,width+'-'+style+'-panel-'+(light?'day':'night')+'.png')});
      await p.keyboard.press('Escape');await p.screenshot({path:path.join(out,width+'-'+style+'-reading-'+(light?'day':'night')+'.png')});await open(p);
    }
  }
  await p.keyboard.press('Escape');
  const glassAfter=await p.evaluate(()=>{const s=SillyTavern.getContext().extensionSettings.iosLiquidGlass;return {mode:s.chatBackground,blur:s.mesBlur,tint:s.mesTint}});assert.deepEqual(glassAfter,glassBefore);
  await p.waitForFunction(()=>Array.from(document.querySelectorAll('#chat .mes')).every(e=>e.getAnimations({subtree:true}).every(a=>a.playState==='finished')));
  const fixedAfter=await p.locator('#author-fixed').boundingBox();assert(Math.abs(fixedAfter.x-fixedBefore.x)<1&&Math.abs(fixedAfter.y-fixedBefore.y)<1,JSON.stringify({fixedBefore,fixedAfter}));
  await p.evaluate(()=>document.getElementById('native-two').append(document.createTextNode(' 新段落延伸时，字体自然沿用当前色板。'.repeat(5))));
  assert.equal(await p.locator('.ilg-reading-surface').count(),0);assert.equal(await p.locator('[data-ilg-prose]').count(),0);
  results.push({width,typography:{homeType,roles:typography,checks:['no added background','no paragraph mutation','authored colors preserved','card events preserved','fixed position preserved','existing background mode/blur/tint unchanged','new text inherits palette']}});
  await p.reload();await check(p,()=>window.fixtureReady||window.fixtureFailure);
  assert.equal(await p.locator('html').getAttribute('data-ilg-reading-style'),'warm','chosen style survives reload');
  await open(p);await p.locator('input[name="ilg-reading-style"][value="classic"]').focus();await p.keyboard.press('Space');
  await p.reload();await check(p,()=>window.fixtureReady||window.fixtureFailure);
  assert.equal(await p.locator('html').getAttribute('data-ilg-reading-style'),'classic','classic style persists too');
  await open(p);await p.locator('input[name="ilg-reading-style"][value="classic"]').focus();await p.keyboard.press('ArrowLeft');
  assert.equal(await p.locator('html').getAttribute('data-ilg-reading-style'),'warm','native radio keyboard behavior changes typography');await p.keyboard.press('Escape');
  await p.evaluate(()=>{const control=document.getElementById('ilg-opt-enabled');control.checked=false;control.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(await p.locator('#ilg-appearance-panel').isVisible(),false);
  assert(!(await p.evaluate(()=>document.documentElement.classList.contains('ilg-custom-wallpaper'))),'disabling clears custom styles');
  assert.equal(await p.locator('html').getAttribute('data-ilg-reading-style'),null,'disable removes typography state');
  assert.equal(await p.locator('#ilg-appearance-panel').count(),1,'one panel instance');
  results.push({width,passed:['three modes','custom background restore','viewport fit','no custom scrims','manual colors','stable on scroll','persistence','bright/dark auto palette','image failure fallback','Escape and focus','outside close','keyboard open','empty custom picker','disable cleanup']});await p.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r))}
