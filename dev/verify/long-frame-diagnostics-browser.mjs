import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(process.env.NVWA_EXTENSION_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const moduleName=process.env.NVWA_PLAYWRIGHT_MODULE||'playwright',tools=await import(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName),browserType=process.env.NVWA_BROWSER||'chromium';
const probe='export function runProbe(){const box=document.getElementById("probe");for(let i=0;i<8;i++){box.style.width=(100+i)+"px";box.dataset.height=String(box.offsetHeight);}const end=performance.now()+90;while(performance.now()<end){Math.sqrt(performance.now());}}';
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;res.setHeader('content-type','text/javascript');if(pathname==='/'){res.setHeader('content-type','text/html;charset=utf-8');return res.end('<!doctype html><button id="options_button">+</button><button id="extensionsMenuButton">Wand</button><div id="probe">Synthetic content</div>');}if(pathname==='/interaction-diagnostics.js')return res.end(fs.readFileSync(path.join(root,'interaction-diagnostics.js')));if(pathname==='/scripts/extensions/third-party/nvwa-probe/index.js')return res.end(probe);res.writeHead(204);res.end();});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await tools[browserType].launch({headless:true,...(browserType==='chromium'&&process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const {createInteractionDiagnostics}=await import('/interaction-diagnostics.js'),{runProbe}=await import('/scripts/extensions/third-party/nvwa-probe/index.js?PRIVATE_QUERY=1');
  const capture=createInteractionDiagnostics({snapshot:()=>({synthetic:true}),durationMs:1000});
  const before=capture.status();capture.start({scenario:'menus'});document.getElementById('options_button').click();document.getElementById('extensionsMenuButton').click();
  await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);requestAnimationFrame(runProbe);await new Promise(r=>setTimeout(r,400));
  const report=capture.stop(),after=capture.status(),stable=JSON.stringify(report);await new Promise(r=>setTimeout(r,60));const stopped=stable===JSON.stringify(capture.report());capture.destroy();
  return{before,after,stopped,cleared:capture.report()===null,report};
 });
 const frames=result.report.longAnimationFrames;assert.deepEqual(result.report.coverage.missing,[]);assert.equal(result.before.recording,false);assert.equal(result.after.recording,false);assert(result.stopped);assert(result.cleared);assert.equal(result.report.events.optionsClicks,1);assert.equal(result.report.events.extensionMenuClicks,1);assert(!/PRIVATE_QUERY|https?:/.test(JSON.stringify(result.report)));if(frames.supported){assert(frames.count>=1,'A real slow callback must be captured');assert(frames.sources.some(s=>s.module==='nvwa-probe/index.js'),'Real script source must be classified');}assert.deepEqual(errors,[]);
 const output={browser:browserType,passed:true,actualBrowserObserver:true,...result,errors};if(process.env.NVWA_LONG_FRAME_RESULT){fs.mkdirSync(path.dirname(process.env.NVWA_LONG_FRAME_RESULT),{recursive:true});fs.writeFileSync(process.env.NVWA_LONG_FRAME_RESULT,JSON.stringify(output,null,2));}console.log(JSON.stringify({browser:browserType,passed:true,supported:frames.supported,longFrames:frames.count,sources:frames.sources,manualOnly:true,stopped:result.stopped,cleared:result.cleared,errors},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
