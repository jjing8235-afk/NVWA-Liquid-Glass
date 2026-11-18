// Runs the upstream long-chat module against NVWA; no private host data.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const upstream=process.env.NVWA_BAIBAI_ROOT;
assert(upstream,'Set NVWA_BAIBAI_ROOT to an inspected ST-BaiBai-Tools checkout');
const tools=await import(pathToFileURL(process.env.NVWA_PLAYWRIGHT_MODULE).href);
const nvwaCSS=fs.readFileSync(path.join(root,'style.css'),'utf8').match(/html\.ilg body #chat > \.mes\.ilg-render-away[^{}]*\{[^}]*\}/)[0];
const html='<!doctype html><html class="ilg"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial}#chat{height:600px;width:390px;display:flex;flex-direction:column;overflow:auto;overflow-anchor:none}.mes{flex-shrink:0;padding:12px;border:1px solid #888}.mes_text p{margin:0}'+nvwaCSS+'</style><div id="chat"></div>';
const scriptStub='export const chat=window.testMessages;export const getCurrentChatId=()=>"compat-fixture";export const isGenerating=()=>document.body.dataset.generating==="true";export const event_types={};export const eventSource={on(){},removeListener(){}};';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 res.setHeader('content-type',url.pathname==='/'?'text/html;charset=utf-8':'text/javascript');
 if(url.pathname==='/'){res.end(html);return;}
 if(url.pathname==='/script.js'){res.end(scriptStub);return;}
 if(url.pathname==='/bai/welcomeRecent.js'){res.end('export const isWelcomePageDisplayed=()=>false;');return;}
 const file=url.pathname.startsWith('/bai/')?path.join(upstream,'src/chat',path.basename(url.pathname)):path.join(root,path.basename(url.pathname));
 if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.end(fs.readFileSync(file,'utf8').replaceAll("'@sillytavern/script'","'/script.js'"));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await tools.chromium.launch({headless:true,executablePath:process.env.NVWA_EDGE_EXECUTABLE});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const chat=document.getElementById('chat'),frames=async(n=4)=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
  window.testMessages=Array.from({length:50},(_,i)=>({mes:('Long chat fixture '+i+' words stay in the original DOM. ').repeat(30),is_user:false}));
  chat.innerHTML=testMessages.map((m,i)=>'<div class="mes'+(i===49?' last_mes':'')+'" mesid="'+i+'"><div class="mes_block"><div class="mes_text"><p>'+m.mes+'</p></div></div></div>').join('');
  const originals=[...chat.children];
  const {createMessageRendering}=await import('/message-rendering.js');
  const {createReadingAnchor}=await import('/viewport.js');
  const manager=createMessageRendering(chat,{onReset(el){ro.unobserve(el);ro.observe(el);}});
  const ro=new ResizeObserver(es=>es.forEach(e=>manager.resize(e.target,e.contentRect.height,e.contentRect.width)));
  const io=new IntersectionObserver(es=>es.forEach(e=>manager.visibility(e.target,e.isIntersecting)),{root:chat,rootMargin:'200px'});
  for(const el of originals){manager.track(el);ro.observe(el);io.observe(el);}
  const anchor=createReadingAnchor({chat,enabled:()=>true});
  await frames(8);
  const standalone=manager.status().culled;
  const state=await import('/bai/state.js'),bai=await import('/bai/longChatRender.js');
  state.configureChatOptimizations({settings:{longChatDomRenderOptimizationEnabled:true,messageCompletionScrollToMiddleEnabled:false},extensionState:{}});
  bai.applyLongChatDomRenderOptimizationStyle();
  bai.refreshLongChatDomRenderOptimization();
  await frames(8);
  const overlap=chat.querySelectorAll('.ilg-render-away.bai-bai-toolkit-long-chat-contained').length;
  const external=chat.querySelectorAll('.bai-bai-toolkit-long-chat-contained').length;
  chat.scrollTop=5000;await frames();anchor.capture();
  const before=chat.scrollTop;
  // Upstream settling moves the scroll position; a layout/image notification
  // in the same frame must not restore NVWA's preceding reading point.
  bai.getLongChatDomRenderState().userScrolledAway=false;
  bai.scheduleLongChatDomRenderScrollToBottom('fixture');
  const desired=chat.scrollTop;anchor.restore();
  const afterRestore=chat.scrollTop;
  const stream=[];document.body.dataset.generating='true';
  for(let i=0;i<12;i++){
   testMessages.at(-1).mes+=' Streaming words. '.repeat(10);
   chat.querySelector('.last_mes p').textContent=testMessages.at(-1).mes;
   bai.refreshLongChatDomRenderOptimization({mode:'incremental',messageIds:[49],reason:'message-updated'});
   await frames(2);
   stream.push({nvwaCulled:manager.status().culled,height:chat.scrollHeight,top:chat.scrollTop});
  }
  document.body.dataset.generating='false';
  bai.removeLongChatDomRenderOptimization();await frames(10);
  const resumed=manager.status().culled;
  // Re-enabling with existing messages must also hand off immediately.
  bai.applyLongChatDomRenderOptimizationStyle();bai.refreshLongChatDomRenderOptimization();await frames(8);
  const reenabled=manager.status().culled;
  const cold=createMessageRendering(chat);
  for(const el of originals){cold.track(el);cold.resize(el,800,390);cold.visibility(el,false);}
  await frames();const coldExternal=cold.status().culled;
  for(const el of originals)cold.release(el);
  bai.removeLongChatDomRenderOptimization();
  anchor.destroy();ro.disconnect();io.disconnect();for(const el of originals)manager.release(el);
  return{standalone,overlap,external,before,desired,afterRestore,stream,resumed,reenabled,coldExternal,domPreserved:originals.every(el=>el.isConnected),cleanup:manager.status().tracked===0};
 });
 console.log(JSON.stringify({result,errors},null,2));
 assert.deepEqual(errors,[]);
 assert(result.standalone>20);
 assert(result.external>20);
 assert.notEqual(result.before,result.desired,'Upstream must actually move the viewport');
 assert.equal(result.overlap,0,'Two renderers own the same offscreen message');
 assert.equal(result.afterRestore,result.desired,'NVWA restored a stale reading point over upstream automatic scrolling');
 assert(result.stream.every(s=>s.nvwaCulled===0),'NVWA must yield throughout streaming');
 assert(result.resumed>20,'Disabling upstream must resume NVWA optimization');
 assert.equal(result.reenabled,0);
 assert.equal(result.coldExternal,0,'NVWA loaded after upstream must also yield');
 assert(result.domPreserved&&result.cleanup);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
