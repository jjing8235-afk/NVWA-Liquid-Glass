// Actual startup with delayed bundled CJK fonts. Checks rendered glyphs and host-font ownership.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const engine=process.env.NVWA_BROWSER||'chromium';
const moduleName=process.env.NVWA_PLAYWRIGHT_MODULE||'playwright';
const tools=await import(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName);
const harness=fs.readFileSync(path.join(root,'dev/verify/home-avatar-browser.mjs'),'utf8');
const template=harness.slice(harness.indexOf('function fixture('),harness.indexOf('const server='));
const fixture=vm.runInNewContext('('+template.trim()+')',{hostCSS:''});
const text='春日午后，推开窗看见树影，远处传来清楚的脚步声。请保持聊天正文的字体、标点和行距稳定，第一次打开也能连续阅读。这是一段用于验证文字布局的内容。';
let pending=[],released=false,fontRequests=[];
function releaseFonts(){released=true;for(const send of pending.splice(0))send();}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){
  const setup=`activeChat();for(const p of document.querySelectorAll('.mes_text p'))p.textContent=${JSON.stringify(text.repeat(5))};window.fontEvents=[];for(const t of ['loading','loadingdone','loadingerror'])document.fonts.addEventListener(t,e=>fontEvents.push({type:t,count:e.fontfaces?.length||0}));window.fixtureReady=false;`;
  res.setHeader('content-type','text/html;charset=utf-8');
  res.end(fixture(3,false,'light').replace('window.fixtureReady=false;',setup));return;
 }
 if(url.pathname.startsWith('/extension/')){
  const file=path.resolve(root,decodeURIComponent(url.pathname.slice(11)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
  const send=()=>res.end(file===path.join(root,'index.js')?fs.readFileSync(file,'utf8')+'\nwindow.__fontProbe=()=>viewportDiagnostic();':fs.readFileSync(file===path.join(root,'fonts/fonts.css')&&process.env.NVWA_FONT_CSS_SOURCE?process.env.NVWA_FONT_CSS_SOURCE:file));
  if(/\/fonts\/noto-sans-sc-.*\.woff2$/.test(url.pathname)){
   fontRequests.push(path.basename(file));if(!released){pending.push(send);return;}
  }
  send();return;
 }
 res.writeHead(url.pathname==='/favicon.ico'?204:404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const cases=[
 {name:'android-native',android:true,ua:'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 EdgA/157.0.0.0'},
 {name:'android-webview',android:true,ua:'Mozilla/5.0 (Linux; Android 16; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/157.0.0.0 Mobile Safari/537.36'},
 {name:'desktop',android:false},
 {name:'ios',android:false,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'}
];
let browser;const results=[],errors=[];
try{
 browser=await tools[engine].launch({headless:true,...(engine==='chromium'&&process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})});
 for(const config of cases){
  released=false;fontRequests=[];pending=[];
  const p=await browser.newPage({viewport:{width:691,height:716},deviceScaleFactor:3.25,...(config.ua?{userAgent:config.ua}:{})});
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>fixtureReady||fixtureFailure);assert.equal(await p.evaluate(()=>fixtureFailure),null);
  const measure=()=>p.evaluate(()=>{
   const el=document.querySelector('.mes_text p'),range=document.createRange();
   range.setStart(el.firstChild,0);range.setEnd(el.firstChild,12);
   const r=range.getBoundingClientRect(),cs=getComputedStyle(el),canvas=document.createElement('canvas');
   canvas.width=800;canvas.height=48;
   const ctx=canvas.getContext('2d');ctx.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
   ctx.fillStyle='#111';ctx.fillText(el.textContent.slice(0,30)+' ABCxyz0123',0,32);
   return {glyphRaster:canvas.toDataURL(),font:cs.fontFamily,lineHeight:cs.lineHeight,width:r.width,height:el.getBoundingClientRect().height,fontStatus:document.fonts.status};
  });
  const first=await measure();
  // CDP captures the visible frame without Playwright waiting for held font requests.
  await p.evaluate(()=>{
   const source=document.querySelector('.mes_text p'),cs=getComputedStyle(source),probe=document.createElement('div');
   probe.textContent=source.textContent.slice(0,30)+' ABCxyz0123';
   probe.style.cssText='position:fixed;left:0;top:0;width:650px;height:100px;z-index:2147483647;background:white;color:black;line-height:32px;overflow:hidden';
   probe.style.fontFamily=cs.fontFamily;probe.style.fontSize=cs.fontSize;probe.style.fontWeight=cs.fontWeight;
   document.body.append(probe);
  });
  await p.waitForTimeout(180);
  const clip={x:0,y:0,width:650,height:100};
  const cdp=engine==='chromium'?await p.context().newCDPSession(p):null;
  const pixels=async()=>cdp?(await cdp.send('Page.captureScreenshot',{format:'png',clip:{...clip,scale:1}})).data:null;
  const firstPixels=await pixels();releaseFonts();
  await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>settle(120));
  const settled=await measure(),sameGlyphs=first.glyphRaster===settled.glyphRaster;
  for(const x of [first,settled]){x.glyphHash=createHash('sha256').update(x.glyphRaster).digest('hex');delete x.glyphRaster;}
  const settledPixels=await pixels();
  const sameRenderedText=cdp?firstPixels===settledPixels:null;
  if(cdp)assert(sameRenderedText,config.name+': already-visible text changed after delayed font subsets arrived');
  const diagnostic=await p.evaluate(()=>__fontProbe());
  if(config.android){
   assert(Math.abs(first.width-settled.width)<.1&&Math.abs(first.height-settled.height)<.1,'Android text metrics change after first display');
   assert(sameGlyphs,'The first visible Android glyphs are replaced after the bundled font loads');
   assert.equal(fontRequests.length,0,'Android unified typography waits for CJK font subsets');
   assert.equal(diagnostic.typography.mode,'system');
  }else{
   assert(first.font.includes('Noto Sans SC Variable'),'Non-Android unified font stack changed');
   assert.equal(diagnostic.typography.mode,'unified');
  }
  for(const key of ['loadingCycles','loadedFaces','failedFaces'])assert.equal(typeof diagnostic.typography[key],'number');
  const events=await p.evaluate(()=>fontEvents);
  await p.evaluate(()=>{
   document.body.style.setProperty('--mainFontFamily','monospace');
   const input=document.getElementById('ilg-opt-font');input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  assert.equal(await p.locator('.mes_text p').first().evaluate(el=>getComputedStyle(el).fontFamily),'monospace','Disabling unified fonts must restore the host font');
  assert.equal(await p.evaluate(()=>__fontProbe().typography.mode),'host');
  await p.evaluate(()=>{
   const input=document.getElementById('ilg-opt-font');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));
   document.querySelector('.mes_text p').style.fontFamily='serif';
  });
  assert.equal(await p.locator('.mes_text p').first().evaluate(el=>getComputedStyle(el).fontFamily),'serif','Authored card typography must remain owned by the card');
  results.push({identity:config.name,first,settled,sameGlyphs,sameRenderedText,bundledRequests:fontRequests.length,events,typography:diagnostic.typography,hostFontRestored:true,authoredFontPreserved:true});
  await p.close();
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,engine,results,errors,scope:'Actual NVWA startup, delayed real bundled font bytes and canvas glyph comparison; physical-phone flicker needs retest'},null,2));
}finally{releaseFonts();await browser?.close();await new Promise(r=>server.close(r));}
