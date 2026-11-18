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
const engine=process.env.NVWA_BROWSER||'chromium', flicker=process.env.NVWA_FLICKER_FLOW==='1';
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
const flickerSetup=`
    const captureEvents=new Map();
    context.eventTypes.CHAT_CHANGED='chat-changed';
    context.eventSource.on=(name,fn)=>{const callbacks=captureEvents.get(name)||[];callbacks.push(fn);captureEvents.set(name,callbacks);};
    const captureChat=document.getElementById('chat');
    captureChat.replaceChildren();fixtureChatId=undefined;
    window.flickerFixture=(open)=>{
        fixtureChatId=open?'PRIVATE_CHAT_ID':undefined;
        if(open)captureChat.innerHTML='<div class="mes last_mes" mesid="PRIVATE_MESSAGE_ID" style="min-height:2500px"><div class="mes_block"><div class="mes_text"><section class="PRIVATE_PRESET_CLASS" style="background:#2e4156"><button>PRIVATE_MESSAGE_TEXT</button><iframe src="/PRIVATE_FRAME_URL"></iframe></section></div></div></div>';
        else captureChat.replaceChildren();
        for(const fn of captureEvents.get('chat-changed')||[])fn(fixtureChatId);
    };
`;
const html=fixture(0,true,'light').replace('window.fixtureReady=false;',setup+(flicker?flickerSetup:'')+'\nwindow.fixtureReady=false;');
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
    const context=await browser.newContext({acceptDownloads:true,viewport:flicker?{width:691,height:716}:{width:394,height:806},deviceScaleFactor:3.25,isMobile:true,hasTouch:true,
        userAgent:engine==='webkit'?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148':'Mozilla/5.0 (Linux; Android 17; wv) AppleWebKit/537.36 Version/4.0 Chrome/156.0.8078.47 Mobile Safari/537.36'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>fixtureReady||fixtureFailure);
    assert.equal(await page.evaluate(()=>fixtureFailure),null);
    if(flicker){
        let downloads=0;page.on('download',()=>downloads++);
        const badge=page.locator('#ilg-flicker-badge'), start=page.locator('#ilg-flicker-start');
        assert.equal(await badge.count(),0,'No diagnostic overlay before opt-in');
        await page.evaluate(()=>{document.getElementById('ilg-open-settings').click();document.getElementById('ilg-studio-tab-diagnostics').click();});
        assert.equal(await start.count(),1,'Opt-in cold/reentry diagnostic is present');
        assert(await start.isVisible());
        await Promise.all([page.waitForEvent('load'),start.click()]);
        await page.waitForFunction(()=>fixtureReady||fixtureFailure); assert.equal(await page.evaluate(()=>fixtureFailure),null);
        await badge.waitFor();
        const badgeStyle=await badge.evaluate(el=>{const s=getComputedStyle(el);return {position:s.position,filter:s.backdropFilter,transform:s.transform,fit:el.getBoundingClientRect().right<=innerWidth};});
        assert.deepEqual(badgeStyle,{position:'fixed',filter:'none',transform:'none',fit:true});
        for(const [phase,mark] of [['first',true],['reentry',false]]){
            if(phase==='reentry'){
                await badge.locator('[data-action="next"]').click();
                await page.evaluate(()=>flickerFixture(false));
                await page.waitForFunction(()=>!document.querySelector('#chat .mes'));
            }
            await page.evaluate(()=>flickerFixture(true));
            await page.waitForFunction(()=>document.querySelector('#chat .mes')?.classList.contains('ilg-card-renderer'));
            await page.locator('#chat').evaluate(chat=>{chat.scrollTop=200;chat.dispatchEvent(new Event('scroll'));});
            if(phase==='reentry'){
                // The tall first message places the second beyond the prewarm margin.
                await page.evaluate(()=>{
                    document.head.append(Object.assign(document.createElement('style'), {
                        textContent:'#chat > .width-feedback { width:90%; min-height:120px } #chat > .width-feedback.ilg-render-away { width:80% }',
                    }));
                    document.querySelector('#chat').insertAdjacentHTML('beforeend', '<div class="mes width-feedback" mesid="1"><div class="mes_block"><div class="mes_text"><p>Plain message with offscreen width feedback.</p></div></div></div>');
                });
                // Two real widths and a fresh natural measurement pass through
                // production observers before the report download.
                await page.evaluate(async()=>{for(let i=0;i<12;i++)await new Promise(requestAnimationFrame);});
                assert.equal(await page.locator('#chat > .width-feedback.ilg-render-away').count(),0);
            }
            if(mark){
                await page.evaluate(()=>{
                    document.querySelector('.mes_text button').hidden=true;
                    const floor = document.querySelector('#chat > .mes');
                    floor.setAttribute('class', floor.className); // MutationRecord without a value change.
                    floor.style.setProperty('--PRIVATE_FIXTURE_KEY', 'PRIVATE_FIXTURE_VALUE');
                    floor.style.removeProperty('--PRIVATE_FIXTURE_KEY'); // Reversal in the same observer batch.
                    window.dispatchEvent(new ErrorEvent('error',{message:'PRIVATE_ERROR_MESSAGE',filename:'PRIVATE_ERROR_FILE'}));
                    const until=performance.now()+70;while(performance.now()<until){} // Inject main-thread evidence, not visual flicker.
                });
                await badge.locator('[data-action="mark"]').click();
            }
        }
        const out=process.env.NVWA_FLICKER_TEST_OUT;
        if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'fixture-reentry.png'),scale:'css'});}
        assert.equal(downloads,0,'Do not export without a click');
        const pending=page.waitForEvent('download');await badge.locator('[data-action="export"]').click();const download=await pending;
        const text=fs.readFileSync(await download.path(),'utf8').replace(/^﻿/,'');
        assert(!/PRIVATE_/.test(text),'Do not export chat IDs, CSS selectors, frame URLs, text, or errors');
        assert(text.length<100000);
        const report=JSON.parse(text);
        assert.equal(report.format,'nvwa-flicker-comparison-2');
        assert(report.attributeSample.targets>=2&&!report.attributeSample.capped);
        assert.equal(report.environment.version,version);
        assert.equal(report.boot.navigation,'reload');
        assert.equal(report.boot.hadMessagesAtStart,false);
        assert.equal(report.reason,'exported');
        assert.deepEqual(report.coverage.map(x=>[x.phase,x.mounted,x.scrolled,x.marked,x.sameChatEvent]),[['first',true,true,true,true],['reentry',true,true,false,true]]);
        for(const sample of report.phases){
            assert(sample.states.some(state=>state.messages.some(m=>m.card&&m.guarded&&m.presetSplit&&m.iframe&&m.size?.[1]>=2400&&m.filter==='css')));
            assert(sample.states.some(state=>state.controls.composer));
            assert(sample.windows.some(w=>w.frames>0));
        }
        const sum=(p,k)=>p.windows.reduce((n,w)=>n+(w[k]||0),0);
        assert(report.phases[0].windows.some(w=>w.messageAttributeValues?.class?.same>=1&&w.messageAttributeValues?.style?.changed>=2));
        assert(report.phases[0].windows.some(w=>w.messagePaints?.mount>0));
        assert(sum(report.phases[0],'runtimeErrors')===1);
        assert(sum(report.phases[0],'descendantMutations')>0);
        assert(sum(report.phases[1],'messageRemovals')>0);
        const widthEvents=report.phases[1].windows.reduce((counts,w)=>{
            counts.retry+=w.offscreenWidthFeedback?.retry||0;
            counts.keptRendered+=w.offscreenWidthFeedback?.keptRendered||0;
            return counts;
        },{retry:0,keptRendered:0});
        assert.deepEqual(widthEvents,{retry:1,keptRendered:1});
        assert(report.phases[0].windows.some(w=>w.maxFrameGapMs>50||w.mainThreadTasks?.maxMs>50));
        assert(report.phases[0].states.some(s=>s.viewport[0]===691));
        await badge.locator('[data-action="dismiss"]').click();
        await page.reload();await page.waitForFunction(()=>fixtureReady||fixtureFailure);
        assert.equal(await badge.count(),0,'Opt-in is consumed once; subsequent reload runs no capture');
        await page.evaluate(()=>{document.getElementById('ilg-open-settings').click();document.getElementById('ilg-studio-tab-diagnostics').click();});
        await Promise.all([page.waitForEvent('load'),start.click()]);
        await page.waitForFunction(()=>fixtureReady||fixtureFailure);await badge.waitFor();
        await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
        assert(await badge.locator('[data-action="mark"]').isHidden());
        await page.evaluate(()=>flickerFixture(true)); // Must not affect the finished report.
        const stopped=page.waitForEvent('download');await badge.locator('[data-action="export"]').click();
        const stoppedFile=await (await stopped).path();
        const stoppedReport=JSON.parse(fs.readFileSync(stoppedFile,'utf8').replace(/^\uFEFF/,''));
        assert.equal(stoppedReport.reason,'pagehide');
        assert.equal(stoppedReport.phases.length,1);
        assert.equal(stoppedReport.coverage[0].mounted,false);
        assert.deepEqual(errors,[]);
        if(out)fs.writeFileSync(path.join(out,'synthetic-report.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify({passed:true,engine,version,coverage:report.coverage,bytes:Buffer.byteLength(text),truth:'Synthetic Android viewport, not an OPPO GPU trace'}));
        await context.close();
    }else{
    assert.equal(await page.locator('#ilg-capture-badge').count(),0,'No capture UI before manual start');
    await page.evaluate(()=>{document.getElementById('ilg-open-settings').click();document.getElementById('ilg-studio-tab-diagnostics').click();});
    await page.locator('#ilg-studio').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
    await page.addStyleTag({content:'button {background:#efefef;color:#eee;border:2px outset #aaa}'});
    for(const width of [320,394])for(const tone of ['dark','light']){
        await page.setViewportSize({width,height:806});
        await page.locator('#ilg-studio').evaluate((el,tone)=>el.dataset.tone=tone,tone);
        const visual=await page.locator('#ilg-capture-start').evaluate(button=>{
            const cs=getComputedStyle(button),rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number),lum=a=>a.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
            const a=lum(rgb(cs.color)),b=lum(rgb(cs.backgroundColor));return{contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),height:button.getBoundingClientRect().height,overflow:document.getElementById('ilg-studio').scrollWidth>document.getElementById('ilg-studio').clientWidth+2};
        });
        assert(visual.contrast>=4.5,'Capture button text needs contrast in '+tone+' at '+width+'px');assert(visual.height>=44);assert(!visual.overflow);
    }
    await page.setViewportSize({width:394,height:806});
    for(const [scenario,phrase] of [['general','上下滑动'],['appearance','右上角'],['rendering','静止约 3 秒'],['keyboard','键盘挡住']]){
        await page.locator('#ilg-capture-scenario').selectOption(scenario);
        assert.equal(await page.locator('#ilg-capture-steps li').count(),3);
        assert((await page.locator('#ilg-capture-steps').innerText()).includes(phrase));
    }
    await page.locator('#ilg-capture-scenario').selectOption('appearance');
    assert.equal(await page.locator('#ilg-capture-steps li').count(),3);
    assert((await page.locator('#ilg-capture-steps').innerText()).includes('右上角'));
    const uiOut=path.join(root,'dev/verify/out/interaction-capture');fs.mkdirSync(uiOut,{recursive:true});
    for(const tone of ['dark','light']){await page.locator('#ilg-studio').evaluate((el,tone)=>el.dataset.tone=tone,tone);await page.locator('#ilg-interaction-diagnostics').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(uiOut,engine+'-controls-'+tone+'.png'),scale:'css'});}
    if(process.env.NVWA_CAPTURE_UI_ONLY==='1'){console.log(JSON.stringify({engine,passed:true,themes:2,widths:[320,394],buttonContrast:true,steps:true}));await context.close();}else{

    await page.locator('#ilg-capture-start').click();
    assert.equal(await page.locator('#ilg-capture-scenario').isDisabled(),true);
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
    assert.equal(await page.locator('#ilg-capture-scenario').isDisabled(),false);
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
    fs.writeFileSync(path.join(out,engine+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await context.close();}
    }
} finally {await browser?.close();await new Promise(r=>server.close(r));}
