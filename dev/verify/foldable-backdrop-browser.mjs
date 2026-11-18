// Real extension, report geometry and both cold-expanded / fold-unfold paths.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const engine=process.env.NVWA_BROWSER||'chromium',moduleName=process.env.NVWA_PLAYWRIGHT_MODULE||'playwright';
const tools=await import(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName);
const harness=fs.readFileSync(path.join(root,'dev/verify/home-avatar-browser.mjs'),'utf8');
const fixture=vm.runInNewContext('('+harness.slice(harness.indexOf('function fixture('),harness.indexOf('const server=')).trim()+')',{hostCSS:''});
const content='<div class="mes last_mes" id="fold-card" mesid="0" is_user="false" style="width:100%;height:3698px;min-height:3698px;flex-shrink:0"><div class="mes_block"><div class="mes_text"><div id="authored-card" style="background:rgba(30,40,60,.1);color:rgb(12,34,56)">Card-owned typography and controls</div>'+Array.from({length:100},(_,i)=>'<p>Foldable reading fixture '+i+'. 展开与收起时，正文保持原有内容和排版。</p>').join('')+'<button id="authored-fixed" style="position:fixed;left:100px;top:80px">Fixed card control</button></div></div></div>';
let source=fs.readFileSync(process.env.NVWA_FOLD_INDEX||path.join(root,'index.js'),'utf8');
source+='\nwindow.__foldProbe={configure(options){Object.assign(S,options);applyRoot();},snapshot(){const el=document.getElementById("fold-card"),it=items.get(el),layer=it?.backdrop||el,r=layer.getBoundingClientRect(),m=el.getBoundingClientRect(),c=document.getElementById("chat").getBoundingClientRect(),fixed=document.getElementById("authored-fixed").getBoundingClientRect();return {width:innerWidth,height:innerHeight,messageHeight:m.height,backdrop:{w:r.width,h:r.height,top:r.top,bottom:r.bottom},visibleTop:Math.max(m.top,c.top),visibleBottom:Math.min(m.bottom,c.bottom),path:it?.renderPath,reason:it?.fallbackReason,clipCount:el.querySelectorAll(".ilg-message-clip").length,filter:getComputedStyle(layer).backdropFilter||getComputedStyle(layer).webkitBackdropFilter,fixed:{x:fixed.x,y:fixed.y},messageBackground:getComputedStyle(el).backgroundColor,layerBackground:getComputedStyle(layer).backgroundColor,cardColor:getComputedStyle(document.getElementById("authored-card")).color,cardPreserved:window.originalCard===document.getElementById("authored-card")};}};';
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/'){const setup=`activeChat();document.getElementById('chat').innerHTML=${JSON.stringify(content)};window.originalCard=document.getElementById('authored-card');window.fixtureReady=false;`;res.setHeader('content-type','text/html;charset=utf-8');res.end(fixture(3,false,'light').replace('window.fixtureReady=false;',setup));return;}
 if(u.pathname.startsWith('/extension/')){const f=path.resolve(root,decodeURIComponent(u.pathname.slice(11)));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');res.end(f===path.join(root,'index.js')?source:fs.readFileSync(f===path.join(root,'style.css')&&process.env.NVWA_FOLD_STYLE?process.env.NVWA_FOLD_STYLE:f));return;}
 res.writeHead(u.pathname==='/favicon.ico'?204:404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[],errors=[];
try{
 browser=await tools[engine].launch({headless:true,...(engine==='chromium'&&process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})});
 for(const identity of (process.env.NVWA_FOLD_IDENTITY?[process.env.NVWA_FOLD_IDENTITY]:['native','webview','desktop','ios']))for(const coldWidth of (identity==='native'||identity==='webview'?[691,360]:[691])){
  const android=identity==='native'||identity==='webview';
  const ua=identity==='desktop'?undefined:identity==='ios'?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148':identity==='webview'?'Mozilla/5.0 (Linux; Android 16; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/157.0.0.0 Mobile Safari/537.36':'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 EdgA/157.0.0.0';
  const p=await browser.newPage({viewport:{width:coldWidth,height:716},deviceScaleFactor:3.25,...(ua?{userAgent:ua}:{})});
  p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>fixtureReady||fixtureFailure);assert.equal(await p.evaluate(()=>fixtureFailure),null);await p.evaluate(()=>settle(80));
  if(!android)await p.waitForFunction(()=>document.getElementById('fold-card').classList.contains('ilg-card-renderer'));
  let originalTint;
  for(const width of (android?[coldWidth,360,600,691,1100,360,691]:[691])){
   await p.setViewportSize({width,height:716});
   for(const scrollTop of [0,1500,3050]){
    await p.locator('#chat').evaluate((el,top)=>{el.scrollTop=top},scrollTop);
    await p.evaluate(()=>new Promise(requestAnimationFrame));
    const sample=await p.evaluate(()=>__foldProbe.snapshot());results.push({identity,coldWidth,scrollTop,...sample});
    originalTint??=sample.layerBackground;assert.equal(sample.layerBackground,originalTint,'Folding preserves the selected glass tint');
    assert.equal(sample.messageHeight,3698,'Backdrop must not contribute to message height');
    assert(sample.cardPreserved);assert.equal(sample.cardColor,'rgb(12, 34, 56)');assert.deepEqual(sample.fixed,{x:100,y:80},JSON.stringify({identity,width,scrollTop,sample}));
    if(android&&width>=600){
     assert(sample.backdrop.h<=sample.height+1,'Expanded foldable still filters the entire long message instead of one viewport: '+JSON.stringify({viewport:sample.height,backdrop:sample.backdrop.h,width:sample.backdrop.w}));
     assert(sample.backdrop.top<=sample.visibleTop+2&&sample.backdrop.bottom>=sample.visibleBottom-2,'Bounded glass must cover the visible part of the card: '+JSON.stringify(sample));
     assert.equal(sample.clipCount,1,'Folding must reuse exactly one owned backdrop wrapper');
     assert(!sample.filter.includes('url('),'Expanded large card must not keep an SVG backdrop');
    }else assert.equal(sample.backdrop.h,3698,'Folded appearance retains the existing full-message glass');
   }
  }
  if(android){
   if(process.env.NVWA_SCREENSHOT_DIR&&identity==='native'&&coldWidth===691){fs.mkdirSync(process.env.NVWA_SCREENSHOT_DIR,{recursive:true});await p.locator('#chat').evaluate(el=>{el.scrollTop=1500});await p.screenshot({path:path.join(process.env.NVWA_SCREENSHOT_DIR,'expanded-'+engine+'.png')});}
   for(const compatibilityMode of ['auto','blur']){await p.evaluate(mode=>__foldProbe.configure({chatBackground:'transparent',compatibilityMode:mode}),compatibilityMode);await p.evaluate(()=>settle(80));const transparent=await p.evaluate(()=>__foldProbe.snapshot());assert.equal(transparent.messageBackground,'rgba(0, 0, 0, 0)');assert.equal(transparent.layerBackground,'rgba(0, 0, 0, 0)');assert(transparent.backdrop.h<=716);}
   await p.locator('#fold-card').evaluate(el=>{el.style.height=el.style.minHeight='400px'});await p.evaluate(()=>settle(80));assert.equal(await p.evaluate(()=>__foldProbe.snapshot().clipCount),0,'Shrinking removes the unnecessary viewport wrapper');
   await p.locator('#fold-card').evaluate(el=>{el.style.height=el.style.minHeight='3698px'});await p.evaluate(()=>settle(80));assert.equal(await p.evaluate(()=>__foldProbe.snapshot().clipCount),1);
  }else assert.equal(await p.evaluate(()=>__foldProbe.snapshot().clipCount),0,'Desktop and iOS keep their original message layers');
  await p.evaluate(()=>{document.body.classList.add('no-blur');});
  assert.equal(await p.evaluate(()=>__foldProbe.snapshot().filter),'none','No-blur applies to the bounded layer');
  await p.evaluate(()=>__foldProbe.configure({enabled:false}));
  assert.equal(await p.locator('.ilg-message-clip,.ilg-message-glass').count(),0,'Disable releases all owned backdrop nodes');
  assert(await p.evaluate(()=>originalCard===document.getElementById('authored-card')));
  await p.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,engine,results,errors,scope:'Geometry/material/ownership in desktop engines; actual foldable GPU flicker still requires device retest'},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
