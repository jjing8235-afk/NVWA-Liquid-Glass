// Isolated localhost acceptance: no user profile, ST data, or external network access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const { chromium } = createRequire(import.meta.url)(process.env.NVWA_PLAYWRIGHT_MODULE || 'playwright');
const fixture = JSON.parse(fs.readFileSync(new URL('fixtures/ball-raster-v17.json', import.meta.url), 'utf8'));
fixture.cases = fixture.cases.map(item => ({ ...item, m: fixture.materials[item.material], shape: fixture.shapes[item.shape] }));
const pageHTML = `<!doctype html><html class="ilg"><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"></head><body style="background:linear-gradient(135deg,#13243c,#455661);min-height:100vh"><div id="target" style="position:fixed;left:16px;top:400px;width:358px;height:52px;border-radius:26px;background:#ffffff18"></div><script type="module">import{createBallGlass}from'/ball-glass.js';import{buildBallJob,rasterBall,packBallFrame}from'/ball-raster.js';window.testAPI={createBallGlass,buildBallJob,rasterBall,packBallFrame};</script></body></html>`;
const server = http.createServer((req,res) => {
    const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (name === '/no-reader-worker.js' || name === '/no-canvas-worker.js') { res.writeHead(200,{'Content-Type':'text/javascript'}); res.end('self.'+(name.includes('reader')?'FileReaderSync':'OffscreenCanvas')+'=undefined;await import("/glass-worker.js");');return; }
    if (name === '/') { res.writeHead(200,{'Content-Type':'text/html',...(new URL(req.url,'http://localhost').searchParams.has('csp')?{'Content-Security-Policy':"worker-src 'none'"}:{})});res.end(pageHTML);return; }
    const file = path.resolve(root,'.'+name);
    if (!file.startsWith(root+path.sep) || !/\.(js|css)$/.test(file) || !fs.existsSync(file)) {res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':'text/javascript','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try {
    browser=await chromium.launch({headless:true,...(process.env.NVWA_BROWSER_EXECUTABLE?{executablePath:process.env.NVWA_BROWSER_EXECUTABLE}:{})});
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
    await page.route('**/*',route=>route.request().url().startsWith(origin)||/^(data|blob):/.test(route.request().url())?route.continue():route.abort());
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);await page.waitForFunction(()=>window.testAPI);
    const result=await page.evaluate(async fixture=>{
        const {createBallGlass,buildBallJob,rasterBall,packBallFrame}=window.testAPI;
        const assert=(ok,message)=>{if(!ok)throw Error(message);};
        const wait=ms=>new Promise(r=>setTimeout(r,ms));
        const canvas=document.createElement('canvas');
        const encode=image=>{canvas.width=image.w;canvas.height=image.h;const c=canvas.getContext('2d');c.putImageData(new ImageData(image.data,image.w,image.h),0,0);return canvas.toDataURL();};
        const decode=async url=>{const bitmap=await createImageBitmap(await(await fetch(url)).blob());canvas.width=bitmap.width;canvas.height=bitmap.height;const c=canvas.getContext('2d');c.drawImage(bitmap,0,0);bitmap.close();const hash=await crypto.subtle.digest('SHA-256',c.getImageData(0,0,canvas.width,canvas.height).data);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');};
        const worker=new Worker('/glass-worker.js',{type:'module'});
        await new Promise((resolve,reject)=>{worker.onerror=reject;worker.onmessage=e=>{assert(e.data.type==='ready'&&e.data.ok,'Worker capability probe failed');resolve();};});
        let id=0,comparisons=0;
        for(const item of fixture.cases){
            const {m,shape,low}=item,job=buildBallJob(shape.b,shape.t,m,30,low,2,shape.shadow!==false);
            const main=rasterBall(job),expected=packBallFrame(main,main.images.map(encode));
            const frame=await new Promise((resolve,reject)=>{worker.onerror=reject;worker.onmessage=e=>e.data.type==='result'?resolve(e.data.frame):reject(Error('Worker render failed'));worker.postMessage({type:'render',id:++id,job});});
            const urls=f=>[f.cover,...(f.inv?[f.inv]:[]),f.reflection,f.html.match(/<feImage href="([^"]+)"/)[1]];
            const a=urls(expected),b=urls(frame);assert(a.length===b.length,'PNG count differs');
            for(let i=0;i<a.length;i++){assert(await decode(a[i])===await decode(b[i]),'Worker PNG pixels differ: '+m.key+'/'+shape.name+'/'+low+'/'+i);comparisons++;}
        }
        worker.terminate();
        const alternate=new Worker('/no-reader-worker.js',{type:'module'});
        await new Promise((resolve,reject)=>{alternate.onerror=reject;alternate.onmessage=e=>{assert(e.data.ok,'ArrayBuffer encoder probe failed');resolve();};});
        const sample=fixture.cases.find(c=>c.m.kind==='web'&&c.shape.name==='corner'&&!c.low);
        const j=buildBallJob(sample.shape.b,sample.shape.t,sample.m,30,false,2,true),raw=rasterBall(j),expectedAlt=packBallFrame(raw,raw.images.map(encode));
        const alt=await new Promise((resolve,reject)=>{alternate.onerror=reject;alternate.onmessage=e=>e.data.type==='result'?resolve(e.data.frame):reject(Error('ArrayBuffer encoder failed'));alternate.postMessage({type:'render',id:1,job:j});});
        for(const field of ['cover','inv','reflection'])assert(await decode(expectedAlt[field])===await decode(alt[field]),'ArrayBuffer encoding changed pixels');
        alternate.terminate();
        const unavailable=new Worker('/no-canvas-worker.js',{type:'module'});
        await new Promise((resolve,reject)=>{unavailable.onerror=reject;unavailable.onmessage=e=>{assert(e.data.type==='ready'&&!e.data.ok,'Missing canvas was not detected');resolve();};});unavailable.terminate();
        // Drive the presentation with a controlled worker to force an obsolete result.
        let fake;
        const factory=()=>fake={sent:[],postMessage(m){this.sent.push(m);},terminate(){this.closed=true;},emit(data){this.onmessage?.({data});}};
        const r=createBallGlass({workerFactory:factory});
        const item=fixture.cases[0],m=item.m,b={cx:180,cy:200,R:24};
        r.paint(b,null,m,30,false);fake.emit({type:'ready',ok:true});const seed=r.status().current;
        r.paint({...b,R:25},null,m,30,true);const first=fake.sent.at(-1);
        r.paint({...b,R:26},null,m,30,true);
        const complete=message=>{const raw=rasterBall(message.job);fake.emit({type:'result',id:message.id,frame:packBallFrame(raw,raw.images.map(encode))});};
        complete(first);await wait(40);assert(r.status().current===seed,'An obsolete result replaced the displayed shape');
        complete(fake.sent.at(-1));await wait(40);assert(r.status().current===r.status().wanted,'The newest result was not displayed');
        const savedHandler=fake.onmessage,removedGlass=document.getElementById('ilg-ball-glass'),removedFilters=[...document.querySelectorAll('[id^="ilg-ball-glass-f"]')];r.remove();assert(!removedGlass.style.backgroundImage&&removedFilters.every(f=>!f.innerHTML),'Removal retained detached PNG/filter resources');assert(fake.closed,'Removal did not terminate the worker');assert(!document.getElementById('ilg-ball-glass'),'Removal left a glass layer');
        savedHandler({data:{type:'ready',ok:true}});assert(!document.getElementById('ilg-ball-glass'),'Late worker callback remounted the glass');
        const sync=createBallGlass({workerFactory:null});sync.paint(b,null,m,30,false);assert(sync.status().mode==='sync','Unsupported worker did not retain the sync path');sync.remove();
        const visible=createBallGlass({workerFactory:factory});visible.paint(b,null,m,30,false);fake.emit({type:'ready',ok:true});
        Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));assert(fake.closed&&visible.status().suspended,'Background work did not stop');
        Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));assert(!visible.status().suspended,'Foreground did not resume');window.dispatchEvent(new Event('pagehide'));assert(visible.status().suspended,'Pagehide did not pause');window.dispatchEvent(new Event('pageshow'));assert(!visible.status().suspended,'Pageshow did not resume');visible.remove();delete document.hidden;
        return {rasterCases:fixture.cases.length,decodedPNGComparisons:comparisons,staleResultIgnored:true,latestResultApplied:true,removalTerminates:true,syncFallback:true,backgroundPause:true,pageLifecycle:true,arrayBufferEncoder:true,noCanvasProbe:true};
    },fixture);
    await page.goto(origin+'/?csp=1');await page.waitForFunction(()=>window.testAPI);
    const csp=await page.evaluate(async material=>{const r=window.testAPI.createBallGlass();r.paint({cx:100,cy:100,R:24},null,material,30,false);await new Promise(resolve=>setTimeout(resolve,120));const status=r.status(),shown=document.getElementById('ilg-ball-glass').style.display!=='none';r.remove();return {mode:status.mode,reason:status.reason,shown};},fixture.cases[0].m);
    assert.equal(csp.mode,'sync');assert(csp.shown);assert(['worker-blocked','worker-error'].includes(csp.reason));
    assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({passed:true,...result,cspFallback:true},null,2));
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
