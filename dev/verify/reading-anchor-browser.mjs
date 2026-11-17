import fs from 'node:fs/promises';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),engine=process.env.NVWA_BROWSER||'chromium';const tools=await import(process.env.NVWA_PLAYWRIGHT_MODULE?pathToFileURL(process.env.NVWA_PLAYWRIGHT_MODULE).href:'playwright');
const html='<!doctype html><style>*{box-sizing:border-box}body{margin:0}#chat{width:350px;height:400px;overflow:auto;overflow-anchor:none}.mes{height:300px;margin:0;padding:10px}img{width:1px;height:1px}</style><div id="chat">'+Array.from({length:16},(_,i)=>'<div class="mes" data-index="'+i+'">Message '+i+'<img></div>').join('')+'</div>';
const server=http.createServer(async(req,res)=>{res.setHeader('content-type',req.url==='/viewport.js'?'text/javascript':'text/html');res.end(req.url==='/viewport.js'?await fs.readFile(process.env.NVWA_VIEWPORT_SOURCE||path.join(root,'viewport.js'),'utf8'):html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await tools[engine].launch({headless:true,...(engine==='chromium'&&process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})});const page=await browser.newPage({viewport:{width:393,height:759}});await page.goto('http://127.0.0.1:'+server.address().port);const checks=[];
 const result=await page.evaluate(async()=>{
  const {createReadingAnchor}=await import('/viewport.js'),chat=document.getElementById('chat');let enabled=true;const controller=createReadingAnchor({chat,enabled:()=>enabled});
  const frames=async(n=3)=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
  chat.scrollTop=900;await frames();controller.capture();
  chat.dispatchEvent(new Event('touchstart',{bubbles:true}));chat.scrollTop=1200;
  chat.dispatchEvent(new Event('scroll'));chat.querySelector('img').dispatchEvent(new Event('load',{bubbles:false}));
  await frames();const afterImage=chat.scrollTop;
  chat.scrollTop=900;await frames();controller.capture();window.dispatchEvent(new Event('resize'));await frames(1);
  chat.dispatchEvent(new WheelEvent('wheel',{deltaY:260,bubbles:true}));chat.scrollTop=1160;chat.dispatchEvent(new Event('scroll'));await frames(4);const afterViewport=chat.scrollTop;
  await new Promise(r=>setTimeout(r,350));chat.scrollTop=1500;await frames();controller.capture();const anchor=controller.anchor,offset=anchor.el.getBoundingClientRect().top-chat.getBoundingClientRect().top;
  chat.firstElementChild.style.height='380px';chat.querySelector('img').dispatchEvent(new Event('load',{bubbles:false}));await frames();const restoredOffset=anchor.el.getBoundingClientRect().top-chat.getBoundingClientRect().top;
  controller.destroy?.();return{afterImage,afterViewport,stationaryDrift:restoredOffset-offset};
 });
 console.log(JSON.stringify({engine,...result}));assert.equal(result.afterImage,1200,'An image load pulled the user back to a stale reading point');assert.equal(result.afterViewport,1160,'Queued viewport restore fought a new scroll gesture');assert(Math.abs(result.stationaryDrift)<1,'Stationary reading no longer preserves its position');checks.push('image-load gesture race','queued viewport gesture race','stationary image growth');console.log(JSON.stringify({passed:true,engine,checks}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
