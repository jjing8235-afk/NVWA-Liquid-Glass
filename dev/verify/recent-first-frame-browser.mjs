// Cold/warm recent-list material checks using the real extension and native-list fixture.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const engine=process.env.NVWA_BROWSER||'chromium';
const moduleName=process.env.NVWA_PLAYWRIGHT_MODULE||'playwright';
const tools=await import(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName);
const harness=fs.readFileSync(path.join(root,'dev/verify/home-avatar-browser.mjs'),'utf8');
const template=harness.slice(harness.indexOf('function fixture('),harness.indexOf('const server='));
const fixture=vm.runInNewContext('('+template.trim()+')',{hostCSS:''});
let source=fs.readFileSync(path.join(root,'index.js'),'utf8');
source+='\nwindow.__recentProbe={show:showRecent,configure(options){Object.assign(S,options);applyRoot();},snapshot(){const el=recentPanel,it=items.get(el),style=el&&getComputedStyle(el);return {on:recentOn,display:style?.display,filter:style?.backdropFilter||style?.webkitBackdropFilter||"none",path:it?.renderPath,foreground:style?.color,filterResource:!!it?.filter,reflection:!!el?.classList.contains("ilg-reflection"),height:el?.getBoundingClientRect().height};}};';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('content-type','text/html;charset=utf-8');res.end(fixture(8,true,url.searchParams.get('tone')||'light'));return;}
 if(url.pathname.startsWith('/extension/')){
  const file=path.resolve(root,decodeURIComponent(url.pathname.slice(11)));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');
  res.end(file===path.join(root,'index.js')?source:fs.readFileSync(file));return;
 }
 res.writeHead(url.pathname==='/favicon.ico'?204:404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const results=[],errors=[];
try{
 browser=await tools[engine].launch({headless:true,...(engine==='chromium'&&process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})});
 for(const identity of ['native','webview','desktop'])for(const tone of ['light','dark']){
  const android=identity!=='desktop';
  const userAgent=android?'Mozilla/5.0 (Linux; Android 16; Pixel 9'+(identity==='webview'?'; wv':'')+') AppleWebKit/537.36 (KHTML, like Gecko) '+(identity==='webview'?'Version/4.0 ':'')+'Chrome/145.0.0.0 Mobile Safari/537.36':undefined;
  const p=await browser.newPage({viewport:{width:393,height:759},deviceScaleFactor:3,hasTouch:android,isMobile:android,...(userAgent?{userAgent}:{})});
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/?tone='+tone);
  await p.waitForFunction(()=>fixtureReady||fixtureFailure);assert.equal(await p.evaluate(()=>fixtureFailure),null);
  await p.evaluate(()=>settle(100));
  async function opening(label,action){
   const frames=await p.evaluate(async action=>{
    if(action==='return')__recentProbe.show();else document.querySelector('.ilg-home-recent').click();
    const frames=[];
    if(__recentProbe.snapshot().on)frames.push(__recentProbe.snapshot());
    for(let i=0;i<12;i++){await new Promise(requestAnimationFrame);if(__recentProbe.snapshot().on)frames.push(__recentProbe.snapshot());}
    return frames;
   },action);
   assert(frames.length,label+' must open');
   const settled=frames.at(-1);
   results.push({identity,tone,label,frames});
   assert.notEqual(frames[0].filter,'none',label+' first visible frame lacks its glass material');
   if(android)for(const frame of frames){assert.equal(frame.filter,settled.filter,label+' changes backdrop after becoming visible');assert(!frame.filterResource&&!frame.reflection,label+' allocates an Android displacement/reflection');}
   assert(frames.every(f=>f.display==='flex'&&f.height>0));
  }
  await opening('cold','click');
  if(process.env.NVWA_SCREENSHOT_DIR&&identity==='native'){fs.mkdirSync(process.env.NVWA_SCREENSHOT_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.NVWA_SCREENSHOT_DIR,'recent-'+tone+'.png')});}
  await p.locator('.ilg-recent-close').click();await p.evaluate(()=>settle(80));
  await opening('warm','click');
  await p.locator('.recentChat .pinChat').first().click();await p.evaluate(()=>settle(80));
  assert.equal(await p.locator('.ilg-recent-head').count(),1);
  await p.locator('.recentChat .characterName').first().click();await p.evaluate(()=>settle(80));
  await opening('return-from-chat','return');
  await p.locator('.ilg-recent-close').click();await p.evaluate(()=>settle(80));
  await p.evaluate(()=>__recentProbe.configure({panelBlur:22,saturate:1.3,brightness:1.05}));
  await opening('custom-material','click');
  await p.locator('.ilg-recent-close').click();await p.evaluate(()=>settle(80));
  await p.evaluate(()=>{document.body.classList.add('no-blur');document.querySelector('.ilg-home-recent').click();});
  assert.equal(await p.evaluate(()=>__recentProbe.snapshot().filter),'none','Host no-blur preference must apply on the first frame');
  await p.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,engine,results,errors,scope:'Actual extension in isolated native-list fixture; physical phone GPU requires retest'},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
