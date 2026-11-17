import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(pathToFileURL('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const root=path.resolve(process.env.NVWA_SOURCE_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const out=process.env.NVWA_MAP_OUTPUT;
const probeOnly=process.env.NVWA_MAP_PROBE_ONLY==='1';
const html='<!doctype html><meta charset="utf-8"><style>body{margin:0;background:repeating-conic-gradient(#a3c9dd 0% 25%,#326176 0% 50%) 0/48px 48px}#surface{position:fixed;left:12px;top:12px;border-radius:24px;background:#ffffff15;border:1px solid #fff6;max-width:94vw;max-height:90vh}svg{position:absolute;width:0;height:0}</style><div id="surface"></div><svg><defs id="filters"></defs></svg><script type="module">import {createLiquidGlassWeb,sampleWebMap} from "/liquid-glass-web.js"; window.mapAPI={createLiquidGlassWeb,sampleWebMap};</script>';
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}const target=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!target.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':'text/plain');res.end(await fs.readFile(target));}catch{res.statusCode=404;res.end('missing');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.NVWA_EDGE_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await browser.newPage({viewport:{width:900,height:900},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.mapAPI);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.NVWA_CPU_RATE||4)});
 const result=await page.evaluate(async()=>{
  const {createLiquidGlassWeb,sampleWebMap}=window.mapAPI;const engine=createLiquidGlassWeb();engine.setEnabled(true);
  const el=document.getElementById('surface'),item={};let serial=0,encodes=0,encodeMs=0;
  const oldEncode=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(...args){const start=performance.now();try{encodes++;return oldEncode.apply(this,args);}finally{encodeMs+=performance.now()-start;}};
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const options=(width,height,preset='clear',strength=1)=>({width,height,preset,refract:true,radius:24,filter:()=>{if(!item.webFilter){item.webFilter=document.createElementNS('http://www.w3.org/2000/svg','filter');item.webFilter.id='map-probe-'+(++serial);document.getElementById('filters').append(item.webFilter);}return item.webFilter;}});
  const settle=async prefix=>{const deadline=performance.now()+10000;while(!item.web?.key.startsWith(prefix)){if(performance.now()>deadline)throw Error('Map did not settle: '+prefix);await pause(10);}};
  const paint=async(w,h,preset)=>{el.style.width=w+'px';el.style.height=h+'px';const before={encodes,encodeMs},oldFilter=item.web?.filter.outerHTML,oldStyle=el.style.backdropFilter;await frame();const start=performance.now();engine.paint(el,item,options(w,h,preset));const callMs=performance.now()-start;const immediateMaterial=!!item.web?.filter.querySelector('feDisplacementMap');const isPending=!item.web?.key.startsWith(Math.round(w)+'x'+Math.round(h)+':'+preset+':');const materialRetained=!isPending||(item.web?.filter.outerHTML===oldFilter&&el.style.backdropFilter===oldStyle);await frame();const frameGapMs=performance.now()-start;await settle(Math.round(w)+'x'+Math.round(h)+':'+preset+':');return{callMs,frameGapMs,settledMs:performance.now()-start,immediateMaterial,materialRetained,mainEncodes:encodes-before.encodes,mainEncodeMs:encodeMs-before.encodeMs};};
  const seed=await paint(374,52,'clear');await pause(200);
  const samples=[];for(const [name,w,h]of[['input',374,52],['menu',356,280],['panel',393,600],['wide-panel',768,480]])for(let i=0;i<3;i++)samples.push({name,width:w+i+1,height:h+i+1,...await paint(w+i+1,h+i+1,['clear','soft','crystal'][i])});
  const warm=await paint(771,483,'crystal');const status=engine.status?.()||null;
  engine.destroy();HTMLCanvasElement.prototype.toDataURL=oldEncode;
  return{seed,samples,warm,status,filterReleased:document.querySelectorAll('filter').length===0};
 });
 assert.equal(errors.length,0,JSON.stringify(errors));assert(result.filterReleased);assert(result.seed.immediateMaterial,'First appearance must retain immediate refraction');assert(result.samples.every(s=>s.materialRetained),'A pending update changed the displayed material');assert.equal(result.warm.mainEncodes,0,'A warm map was re-encoded');const record={root,cpuThrottle:Number(process.env.NVWA_CPU_RATE||4),...result,scope:'Desktop Edge callback/frame interval sample; not physical-phone FPS.'};if(out)await fs.writeFile(out,JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));
 if(!probeOnly)assert.equal(result.samples.reduce((sum,s)=>sum+s.mainEncodes,0),0,'Cold updates still synchronously encode displacement maps on the main thread.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
