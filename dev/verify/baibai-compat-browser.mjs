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
const stylesheet = fs.readFileSync(process.env.NVWA_STYLE_SOURCE || path.join(root, 'style.css'), 'utf8');
const nvwaCSS = [
    /html\.ilg body #chat > \.mes\.ilg-render-away[^{}]*\{[^}]*\}/,
    /html\.ilg body #chat\.bai-bai-toolkit-long-chat-render-optimized > \.mes\.bai-bai-toolkit-long-chat-contained\s*\{[^}]*\}/,
].map(rule => stylesheet.match(rule)?.[0] || '').join('\n');
const html='<!doctype html><html class="ilg"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial}#chat{height:600px;width:390px;display:flex;flex-direction:column;overflow:auto;overflow-anchor:none}.mes{display:flex;padding:12px;border:1px solid #888}#chat:not(.fixture-flex-shrink) .mes{flex-shrink:0}.mes_text p{margin:0}'+nvwaCSS+'</style><div id="chat"></div>';
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
  const domPreserved=originals.every(el=>el.isConnected),cleanup=manager.status().tracked===0;
  // Mirror the skewed chat from the real-host repro: almost every floor is
  // short, but both an older floor and the newest reply are very long.
  chat.classList.add('fixture-flex-shrink');
  testMessages.splice(0,testMessages.length,...Array.from({length:12},(_,i)=>({
   mes:i===2||i===11?'Long synthetic message. '.repeat(900):'Short message '+i,
   is_user:i%2===0,
  })));
  chat.innerHTML=testMessages.map((m,i)=>'<div class="mes'+(i===11?' last_mes':'')+'" mesid="'+i+'"><div class="mes_block"><div class="mes_text"><p>'+m.mes+'</p></div></div></div>').join('');
  bai.applyLongChatDomRenderOptimizationStyle();bai.refreshLongChatDomRenderOptimization();
  await frames(8);chat.scrollTop=chat.scrollHeight;await frames(8);
  const contained=chat.querySelector('.bai-bai-toolkit-long-chat-contained');
  const css=()=>({shrink:getComputedStyle(contained).flexShrink,visibility:getComputedStyle(contained).contentVisibility});
  const activeCss=css(),tailShrink=getComputedStyle(chat.querySelector('.last_mes')).flexShrink;
  const tail=chat.querySelector('.last_mes'),beforeDelete=chat.scrollTop;
  testMessages.pop();tail.remove();chat.lastElementChild.classList.add('last_mes');
  const afterDelete={top:chat.scrollTop,range:chat.scrollHeight-chat.clientHeight};
  await frames(8);
  const settledDelete={top:chat.scrollTop,range:chat.scrollHeight-chat.clientHeight};
  document.documentElement.classList.remove('ilg');const withoutNvwa=css();
  document.documentElement.classList.add('ilg');
  chat.scrollTop=0;await frames(3);const manuallyReadHistory=chat.scrollTop===0;
  bai.removeLongChatDomRenderOptimization();const withoutBaiBai=css();
  return{standalone,overlap,external,before,desired,afterRestore,stream,resumed,reenabled,coldExternal,domPreserved,cleanup,
   activeCss,tailShrink,withoutNvwa,withoutBaiBai,beforeDelete,afterDelete,settledDelete,manuallyReadHistory};
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
 assert(result.beforeDelete>600,'Deletion fixture must start well away from the top');
 assert(result.afterDelete.range>600&&result.afterDelete.top>600,'Removing a tall reply collapsed the scroll range and jumped to the top');
 assert(result.settledDelete.top>600,'Deletion left the reader stranded at the top');
 assert.deepEqual(result.activeCss,{shrink:'0',visibility:'auto'},'BaiBai retains offscreen skipping with stable flex sizing');
 assert.equal(result.tailShrink,'1','An uncontained tail must keep native flex sizing');
 assert.deepEqual(result.withoutNvwa,{shrink:'1',visibility:'auto'},'Disabling NVWA removes its sizing override');
 assert.deepEqual(result.withoutBaiBai,{shrink:'1',visibility:'visible'},'Disabling BaiBai restores native sizing');
 assert(result.manuallyReadHistory,'A deliberate scroll to the top must still work');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
