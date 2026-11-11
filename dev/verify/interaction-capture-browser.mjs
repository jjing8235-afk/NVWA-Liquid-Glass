// Full extension, real 15-second timeout and TXT download; isolated synthetic host only.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(process.env.NVWA_EXTENSION_ROOT||fileURLToPath(new URL('../../',import.meta.url)));
const moduleName=process.env.NVWA_PLAYWRIGHT_MODULE||'playwright';
const tools=await import(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName);
const engine=process.env.NVWA_BROWSER||'chromium';
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version;
const source=fs.readFileSync(path.join(root,'dev/verify/home-avatar-browser.mjs'),'utf8');
const template=source.slice(source.indexOf('function fixture('),source.indexOf('const server='));
const fixture=vm.runInNewContext('('+template.trim()+')',{hostCSS:''});
const files=['liquid glass porcelain.png','liquid glass ink.png'];
const setup=`
Object.assign(settings,{enabled:true,home:false,floatBall:true,tone:'auto',engine:'physical'});activeChat();document.body.classList.add('bubblechat');
window.__TAURITAVERN_HOST__={platform:'${engine==='webkit'?'ios':'android'}',kind:'mobile'};
const bg=document.createElement('div');bg.id='bg1';bg.style.backgroundImage='url(/backgrounds/liquid%20glass%20porcelain.png)';document.body.prepend(bg);
const library=document.createElement('div');library.id='bg_menu_content';document.body.append(library);
for(const file of ${JSON.stringify(files)}){const el=document.createElement('button');el.className='bg_example';el.setAttribute('bgfile',file);el.onclick=()=>{bg.style.backgroundImage='url('+JSON.stringify('/backgrounds/'+encodeURIComponent(file))+')';};library.append(el);}
`;
const html=fixture(0,true,'light').replace('window.fixtureReady=false;',setup+'\nwindow.fixtureReady=false;');
const server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://localhost');
    if(u.pathname==='/'){res.setHeader('content-type','text/html;charset=utf-8');res.end(html);return;}
    if(u.pathname==='/api/backgrounds/all'){res.setHeader('content-type','application/json');res.end(JSON.stringify({images:files.map(filename=>({filename}))}));return;}
    if(u.pathname==='/scripts/backgrounds.js'){res.setHeader('content-type','text/javascript');res.end('export async function getBackgrounds(){}');return;}
    if(u.pathname.startsWith('/backgrounds/')){res.setHeader('content-type','image/png');res.end(fs.readFileSync(path.join(root,'walls',decodeURIComponent(u.pathname.slice(13)))));return;}
    if(u.pathname.startsWith('/extension/')){
        const file=path.resolve(root,decodeURIComponent(u.pathname.slice(11)));
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
        res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));return;
    }
    res.writeHead(u.pathname==='/favicon.ico'?204:404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
    browser=await tools[engine].launch({headless:true,...(engine==='chromium'&&process.env.NVWA_EDGE_EXECUTABLE?{executablePath:process.env.NVWA_EDGE_EXECUTABLE}:{})});
    const context=await browser.newContext({acceptDownloads:true,viewport:{width:394,height:806},deviceScaleFactor:3.25,isMobile:true,hasTouch:true,
        userAgent:engine==='webkit'?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148':'Mozilla/5.0 (Linux; Android 17; wv) AppleWebKit/537.36 Version/4.0 Chrome/156.0.8078.47 Mobile Safari/537.36'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>fixtureReady||fixtureFailure);
    assert.equal(await page.evaluate(()=>fixtureFailure),null);
    assert.equal(await page.locator('#ilg-capture-badge').count(),0,'No capture UI before manual start');
    await page.evaluate(()=>{document.getElementById('ilg-open-settings').click();document.getElementById('ilg-studio-tab-diagnostics').click();});
    await page.locator('#ilg-capture-scenario').selectOption('appearance');
    await page.locator('#ilg-capture-start').click();
    assert.equal(await page.locator('#ilg-studio').evaluate(e=>e.open),false);
    await page.locator('#ilg-tone-button .drawer-icon').click();await page.waitForFunction(()=>document.getElementById('bg1').style.backgroundImage.includes('ink.png'));
    await page.locator('#ilg-tone-button .drawer-icon').click();await page.waitForFunction(()=>document.getElementById('bg1').style.backgroundImage.includes('porcelain.png'));
    await page.locator('#send_textarea').fill('PRIVATE_DRAFT_FIXTURE');
    await page.evaluate(()=>{
        const composer=document.getElementById('send_textarea');composer.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'PRIVATE_COMPOSITION'}));composer.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'PRIVATE_COMPOSITION'}));
        const chat=document.getElementById('chat');chat.dispatchEvent(new Event('scroll'));
        const ball=document.getElementById('ilg-ball');for(const type of ['pointerdown','pointermove','pointercancel'])ball.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:37,clientX:40,clientY:100}));
        window.dispatchEvent(new ErrorEvent('error',{error:new TypeError('PRIVATE_ERROR_MESSAGE'),message:'PRIVATE_ERROR_MESSAGE',filename:'PRIVATE_URL'}));
        const until=performance.now()+110;while(performance.now()<until){} // Known synthetic stall for the diagnostic signal.
    });
    await page.setViewportSize({width:394,height:700});
    await page.waitForFunction(()=>document.querySelector('#ilg-capture-badge [data-action="main"]')?.textContent==='导出诊断',null,{timeout:20000});
    const out=path.join(root,'dev/verify/out/interaction-capture');fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,engine+'-completed.png'),scale:'css'});
    const downloadPromise=page.waitForEvent('download');await page.locator('#ilg-capture-badge [data-action="main"]').click();const download=await downloadPromise;
    const text=fs.readFileSync(await download.path(),'utf8').replace(/^\uFEFF/,'');assert.equal(text,await page.locator('#ilg-opt-iosReport').inputValue());
    const line=text.split('\n').find(x=>x.startsWith('短时交互采集: '));assert(line);const capture=JSON.parse(line.slice('短时交互采集: '.length));
    assert(text.startsWith('NVWA 液态玻璃 '+version));assert.equal(capture.format,'nvwa-interaction-2');assert.equal(capture.reason,'timeout');assert(capture.quality.fullDuration);
    assert(capture.checkpoints.length>=10&&capture.checkpoints.length<=17);assert.equal(capture.scenario,'appearance');assert.deepEqual(capture.coverage.missing,[]);
    assert(capture.timeline.some(x=>x.type==='appearance-request'&&x.mode==='dark'));assert(capture.timeline.some(x=>x.type==='appearance-result'&&x.outcome==='dispatched'));
    assert(capture.checkpoints.some(x=>x.state.appearance.lightThumbnail&&x.state.appearance.darkThumbnail));
    assert(capture.stalls.some(x=>x.gapMs>80));assert.equal(capture.events.runtimeErrors,1);assert.equal(capture.events.compositionStarts,1);assert.equal(capture.drags[0].reason,'cancel');
    assert.equal(text.split('nvwa-interaction-2').length-1,1,'Combined TXT includes the capture exactly once');assert(!/PRIVATE_|filename|PRIVATE_URL/.test(JSON.stringify(capture)));
    assert(JSON.stringify(capture).length<100000);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    await page.locator('#ilg-capture-badge [data-action="close"]').click();assert.equal(await page.locator('#ilg-capture-badge').count(),0);assert.deepEqual(errors,[]);
    const result={engine,version,passed:true,fullRealTimeout:true,durationMs:capture.durationMs,checkpoints:capture.checkpoints.length,timeline:capture.timeline.length,captureBytes:Buffer.byteLength(JSON.stringify(capture)),singleTxt:true,privacy:true,physicalDevice:false};
    fs.writeFileSync(path.join(out,engine+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await context.close();
} finally {await browser?.close();await new Promise(r=>server.close(r));}
