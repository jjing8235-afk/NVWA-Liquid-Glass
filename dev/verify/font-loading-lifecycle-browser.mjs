import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(process.env.NVWA_EXTENSION_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const moduleName=process.env.NVWA_PLAYWRIGHT_MODULE||'playwright';
const tools=await import(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName);
const browserType=process.env.NVWA_BROWSER||'chromium';
const css=fs.readFileSync(path.join(root,'style.css'),'utf8').match(/html\.ilg body #chat > \.mes\.ilg-render-away[^{}]*\{[^}]*\}/)?.[0];assert(css);
const html='<!doctype html><html class="ilg"><head><style>body{margin:0;font:16px Arial}#chat{display:flex;flex-direction:column;overflow:auto;width:390px;height:600px}.mes{padding:12px;border:1px solid #888;flex-shrink:0}.mes_text p{line-height:1.7}'+css+'</style></head><body><div id="chat"></div></body></html>';
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/'){res.setHeader('content-type','text/html;charset=utf-8');res.end(html);}else if(pathname==='/message-rendering.js'){res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(path.join(root,'message-rendering.js')));}else if(pathname==='/probe-font.woff2'){res.setHeader('content-type','font/woff2');res.end(fs.readFileSync(path.join(root,'fonts/noto-sans-sc-latin-wght-normal.woff2')));}else{res.writeHead(204);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await tools[browserType].launch({headless:true,...(browserType==='chromium'&&process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:393,height:759}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);if(browserType==='chromium'){const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
 const result=await page.evaluate(async()=>{
  const {createMessageRendering}=await import('/message-rendering.js');const chat=document.getElementById('chat');
  chat.innerHTML=Array.from({length:600},(_,i)=>'<div class="mes'+(i===599?' last_mes':'')+'"><div class="mes_block"><div class="mes_text"><p>聊天正文 '+i+'。'+('Content repeats without changing geometry. '.repeat(45))+'</p></div></div></div>').join('');
  await document.fonts.ready;const elements=[...chat.children],getter=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');let reads=0,resets=0;
  for(const el of elements)Object.defineProperty(el,'textContent',{configurable:true,get(){reads++;return getter.get.call(this);},set(value){getter.set.call(this,value);}});
  const manager=createMessageRendering(chat,{onReset(el){resets++;ro.unobserve(el);ro.observe(el);}}),ro=new ResizeObserver(es=>es.forEach(e=>manager.resize(e.target,e.contentRect.height,e.contentRect.width))),io=new IntersectionObserver(es=>es.forEach(e=>manager.visibility(e.target,e.isIntersecting)),{root:chat,rootMargin:'200px 0px'});
  for(const el of elements){manager.track(el);ro.observe(el);io.observe(el);}
  const settle=async()=>{await new Promise(r=>setTimeout(r,80));for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);};await settle();
  const cases=[];
  async function sample(label,fontfaces,affects,maxReads){await settle();reads=0;const before=resets,start=performance.now(),event=new Event('loadingdone');if(fontfaces!==undefined)Object.defineProperty(event,'fontfaces',{value:fontfaces});document.fonts.dispatchEvent(event);cases.push({label,duration:performance.now()-start,textReads:reads,resets:resets-before,affects,maxReads});}
  const face=unicodeRange=>({unicodeRange});
  await sample('unknown event',undefined,true,0);
  await sample('malformed range',[face('unknown')],true,0);
  await sample('full font',[face('U+0-10FFFF')],true,0);
  await sample('generated punctuation',[face('U+201C-201D')],true,0);
  await sample('matching first message',[face('U+6B63')],true,1);
  await sample('unrelated menu character',[face('U+8BBE')],false,600);
  const beforeHeight=elements[0].getBoundingClientRect().height;elements[0].querySelector('p').firstChild.data+='设';manager.invalidate(elements[0]);await settle();
  await sample('edited message becomes relevant',[face('U+8BBE')],true,1);
  const afterHeight=elements[0].getBoundingClientRect().height;
  chat.style.fontFamily='NVWA Font Metric Probe, monospace';manager.invalidateAll();await settle();
  const resetsBeforeRealFont=resets;
  const nativeEvents=[],recordFont=event=>nativeEvents.push(...event.fontfaces);document.fonts.addEventListener('loadingdone',recordFont);
  const fontStyle=document.createElement('style');fontStyle.textContent='@font-face{font-family:"NVWA Font Metric Probe";src:url(/probe-font.woff2) format("woff2");unicode-range:U+0-FF}';document.head.append(fontStyle);
  void elements[0].offsetHeight;const loadedFaces=await document.fonts.load('16px "NVWA Font Metric Probe"','Content'),actualFace=loadedFaces[0];await document.fonts.ready;await settle();document.fonts.removeEventListener('loadingdone',recordFont);
  const measuredFontHeight=chat.scrollHeight,actualFontResets=resets-resetsBeforeRealFont;
  for(const el of elements){manager.release(el);ro.unobserve(el);io.unobserve(el);}reads=0;document.fonts.dispatchEvent(new Event('loadingdone'));
  const detachedListenerReads=reads,beforePending=resets;manager.track(elements[0]);document.fonts.dispatchEvent(new Event('loading'));manager.release(elements[0]);await settle();
  const fallbackCancelledOnRelease=resets===beforePending&&manager.status().tracked===0;
  return{cases,fallbackCancelledOnRelease,actualFontDetails:{status:actualFace.status,eventFamilies:nativeEvents.map(face=>face.family),nativeEventProperty:'onloadingdone' in document.fonts,documentStatus:document.fonts.status,measuredFontHeight,naturalFontHeight:chat.scrollHeight},actualFontLoaded:actualFace.status==='loaded',actualFontResets,nativeFontDoneObserved:nativeEvents.includes(actualFace),fontHeightPreserved:Math.abs(measuredFontHeight-chat.scrollHeight)<=1,detachedListenerReads,heightStable:Math.abs(beforeHeight-afterHeight)<=1,trackedAfterRelease:manager.status().tracked,physicalPhone:false};
 });
 console.log(JSON.stringify({browser:browserType,...result,errors},null,2));if(process.env.NVWA_FONT_RESULT){fs.mkdirSync(path.dirname(process.env.NVWA_FONT_RESULT),{recursive:true});fs.writeFileSync(process.env.NVWA_FONT_RESULT,JSON.stringify({browser:browserType,...result,errors},null,2));}
 assert.deepEqual(errors,[]);for(const test of result.cases){assert.equal(test.resets,test.affects?600:0,test.label+' must preserve metric invalidation');assert(test.textReads<=test.maxReads,test.label+' must avoid eagerly reading all messages');}assert.equal(result.detachedListenerReads,0);assert.equal(result.trackedAfterRelease,0);assert(result.heightStable);assert(result.fallbackCancelledOnRelease);assert(result.actualFontLoaded);assert(result.actualFontResets>=600);assert(result.fontHeightPreserved);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
