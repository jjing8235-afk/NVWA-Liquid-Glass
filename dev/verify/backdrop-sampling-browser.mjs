// Isolated Edge comparison of the actual backdrop sampling pass. No user data or host writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=new URL('../../',import.meta.url);
const before=process.env.NVWA_BACKDROP_BASELINE;
const frameSource=async file=>{
    const text=(await fs.readFile(file,'utf8')).replace(/\r\n/g,'\n');
    const start=text.indexOf('// Top controls sample visible card surfaces first');
    const end=text.indexOf("chatEl.addEventListener('scroll', scheduleAdapt",start);
    assert(start>=0 && end>start,'Backdrop sampling anchors not found');
    return text.slice(start,end);
};
const source=await frameSource(new URL('index.js',root));
const baseline=before ? await frameSource(before) : source;
const optics=(await fs.readFile(new URL('wallpaper-sampling.js',root),'utf8')).replace(/^export /gm,'');
const driver=process.env.NVWA_PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(path.isAbsolute(driver)?pathToFileURL(driver).href:driver);
const browser=await chromium.launch({headless:true,executablePath:process.env.NVWA_EDGE_EXECUTABLE});
const summaries=[];
try {
    for (const width of [390,1280]) {
        const page=await browser.newPage({viewport:{width,height:844}});
        const layers=600;
        await page.setContent(`<!doctype html><style>
            html,body{margin:0;font:16px sans-serif;background:#152138;color:#fff}
            #sheld,#chat{position:fixed;inset:0}#chat{overflow:auto}
            article{height:180px;background:var(--fixture-bg);position:relative}
            article:nth-child(even){--fixture-bg:#eec689}article:nth-child(odd){--fixture-bg:#1c2538}
            .wrap{position:absolute;inset:0;background:rgba(1,2,3,.2)}
            iframe{display:block;position:absolute;left:44%;top:0;width:24%;height:180px;border:0}
            #top-bar,#form_sheld{position:fixed;left:0;right:0;display:flex;justify-content:space-between;pointer-events:auto}
            #top-bar{top:0;height:54px}#form_sheld{bottom:0;height:58px}
            .ilg-island{width:42%;height:46px;display:flex;justify-content:space-around}
            .drawer-icon,#leftSendForm>div,#rightSendForm>div{display:block;width:26px;height:38px}
            #leftSendForm,#rightSendForm{display:flex;align-items:center;gap:3px}
            #ilg-floor{position:absolute;top:3px;left:44%;width:12%;height:32px}
            #bg1{position:absolute;inset:0;pointer-events:none;background:url("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7") center/cover;z-index:-1}
        </style><div id="bg1"></div><div id="sheld"><div id="chat">${Array.from({length:layers},(_,i)=>`<article>${'<div class="wrap">'.repeat(4)}${i===2?`<iframe srcdoc="<style>html,body{margin:0;background:#f8e2b8;color:#222}div{height:180px;background:rgba(0,0,0,.15)}</style><div>Local frame</div>"></iframe>`:i===4?'<iframe sandbox srcdoc="<body style=background:salmon>Unknown frame</body>"></iframe>':''}${'</div>'.repeat(4)}</article>`).join('')}</div></div>
        <div id="top-bar">${'<div class="ilg-island">'+('<div class="icon"><span class="drawer-icon"></span></div>'.repeat(4))+'</div>'}${'<div class="ilg-island">'+('<div class="icon"><span class="drawer-icon"></span></div>'.repeat(4))+'</div>'}<div id="ilg-floor"></div></div>
        <div id="form_sheld"><div id="leftSendForm">${'<div></div>'.repeat(4)}</div><div id="rightSendForm">${'<div></div>'.repeat(4)}</div></div>`,{waitUntil:'load'});
        const result=await page.evaluate(({baseline,source,optics,layers})=>{
            const chat=document.getElementById('chat'), input=document.getElementById('form_sheld');
            const top=document.getElementById('top-bar');
            const bars=[...document.querySelectorAll('.ilg-island')];
            for(const bar of bars) bar.icons=[...bar.querySelectorAll('.icon')];
            top.icons=bars.flatMap(bar=>bar.icons);
            const wallpaperURL=/url\("(.*)"\)/.exec(getComputedStyle(document.getElementById('bg1')).backgroundImage)[1];
            const make=(code,scene)=>new Function('islands','PILL_SEL','S','currentWallpaperSample','scene',`
                ${optics}
                let lightBg=false;
                let nextFrame, now=0;
                const requestAnimationFrame=cb=>(nextFrame=cb,1);
                const setTimeout=()=>{throw Error('Fixture advances past the sampling gap')};
                const performance={now:()=>now};
                ${code}
                return (tone)=>{ lightBg=tone; now+=1000; scheduleAdapt(); nextFrame(); };`)(bars,'#form_sheld',scene,
                    {url:wallpaperURL,raster:{width:2,height:2,size:2,pixels:new Uint8ClampedArray([255,255,255,255,30,30,30,255,245,195,140,255,32,51,70,255])}},scene);
            const frames=[0,34,179,181,355,360,375,445,715,720,905,...Array.from({length:48},(_,i)=>((i*1799+17)%(layers*180-844)))];
            const view=window;
            const iframes=[...document.querySelectorAll('iframe')].map(frame=>frame.contentDocument?.defaultView).filter(Boolean);
            let styleReads=0,hitTests=0;
            const undo=[];
            for (const win of [view,...iframes]) {
                const style=win.getComputedStyle;
                win.getComputedStyle=function(...args){styleReads++;return style.apply(this,args);};
                undo.push(()=>{win.getComputedStyle=style;});
            }
            const hit=document.elementsFromPoint;
            document.elementsFromPoint=function(...args){hitTests++;return hit.apply(this,args);};
            undo.push(()=>{document.elementsFromPoint=hit;});
            const controls=[...new Set([top,...bars,document.getElementById('ilg-floor'),...top.icons,input,...input.querySelectorAll('#leftSendForm>div,#rightSendForm>div')])];
            function run(code) {
                const settings={enabled:true,islands:true};
                const sample=make(code,settings);
                for (const el of controls) { delete el.dataset.ilgTopTone; delete el.dataset.ilgInputTone; el.classList.remove('ilg-over-light','ilg-over-dark','ilg-icon-over-light'); }
                chat.firstElementChild.style.removeProperty('background');
                const outputs=[],timings=[];
                styleReads=hitTests=0;
                for(const [i,scroll] of frames.entries()) {
                    settings.islands=i%13!==0;
                    document.body.classList.toggle('no-blur',i%17===0);
                    if (i===1) chat.firstElementChild.style.background='#f7e7db';
                    chat.scrollTop=scroll;
                    const start=performance.now(); sample(i%2===0); timings.push(performance.now()-start);
                    outputs.push(controls.map(el=>[el.dataset.ilgTopTone??null,el.dataset.ilgInputTone??null,el.className]));
                }
                timings.sort((a,b)=>a-b);
                return {outputs,styleReads,hitTests,p50:timings[Math.floor(timings.length*.5)],p95:timings[Math.floor(timings.length*.95)]};
            }
            try {
                run(baseline); run(source);
                const a=[], b=[];
                for(let i=0;i<5;i++) { if(i%2){b.push(run(source));a.push(run(baseline));} else {a.push(run(baseline));b.push(run(source));} }
                return {a,b,frames:frames.length};
            } finally { undo.reverse().forEach(reset=>reset()); }
        },{baseline,source,optics,layers});
        const {a,b,frames}=result;
        for(let i=0;i<a.length;i++) {
            assert.deepEqual(b[i].outputs,a[i].outputs,'All decisions and tone classes must match');
            assert(b[i].hitTests<=a[i].hitTests,'Exact tone decisions must not require more hit tests');
        }
        assert(new Set(a[0].outputs.map(JSON.stringify)).size>6,'Fixture must exercise real tone transitions');
        const metrics=runs=>{const med=key=>runs.map(r=>r[key]).sort((x,y)=>x-y)[2];return Object.fromEntries(['styleReads','hitTests','p50','p95'].map(k=>[k,+med(k).toFixed(3)]));};
        summaries.push({width,layers,frames,baseline:metrics(a),candidate:metrics(b)});
        await page.close();
    }
    console.log(JSON.stringify({identicalToneDecisions:true,summaries},null,2));
    if(process.env.NVWA_REQUIRE_BACKDROP_REDUCTION==='1') for(const summary of summaries) {
        assert(summary.candidate.hitTests<summary.baseline.hitTests,'Proven threshold shortcuts must omit work');
        assert(summary.candidate.styleReads<=summary.baseline.styleReads,'Expected no increase in style queries');
    }
} finally { await browser.close(); }
