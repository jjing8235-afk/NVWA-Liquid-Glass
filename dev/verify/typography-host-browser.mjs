import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import net from 'node:net';

const root=fileURLToPath(new URL('../../',import.meta.url));
const host=process.env.NVWA_HOST_ROOT;
const data=process.env.NVWA_TYPO_TEST_DATA;
const out=process.env.NVWA_TYPO_PROOFS;
assert(host && data,'Set NVWA_HOST_ROOT and a new NVWA_TYPO_TEST_DATA path for the disposable host.');
await fs.mkdir(data,{recursive:false});
await fs.mkdir(path.join(data,'default-user'));
await fs.writeFile(path.join(data,'default-user','settings.json'),JSON.stringify({extension_settings:{disabledExtensions:[],autoConnect:false,iosLiquidGlass:{v:9,enabled:true,wallsReady:true,tone:'dark',home:false,refract:false,follow:false,proseLeading:2.45,proseInset:14}}}));
const {chromium}=await import(process.env.NVWA_PLAYWRIGHT_MODULE?pathToFileURL(process.env.NVWA_PLAYWRIGHT_MODULE).href:'playwright');
const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const origin='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['server.js','--dataRoot',data,'--port',String(port),'--listen','false','--browserLaunchEnabled','false'],{cwd:host,windowsHide:true,stdio:['ignore','pipe','pipe']});
let serverLog=''; for (const stream of [child.stdout,child.stderr]) stream.on('data',data=>{serverLog=(serverLog+data).slice(-4000);});
let browser;const errors=[];
try {
    const deadline=Date.now()+60000;
    for (;;) {
        try { if ((await fetch(origin)).ok) break; } catch {}
        if (Date.now()>deadline || child.exitCode!==null) throw Error(serverLog);
        await new Promise(r=>setTimeout(r,250));
    }
    browser=await chromium.launch({headless:true,executablePath:process.env.NVWA_EDGE_EXECUTABLE});
    const ctx=await browser.newContext({viewport:{width:1280,height:860},acceptDownloads:true});
    await ctx.route('**/*', async route=>{
        const url=new URL(route.request().url());
        if (url.origin!==origin) return route.abort();
        const prefix='/scripts/extensions/third-party/ios-liquid-glass/';
        if (!url.pathname.startsWith(prefix)) return route.continue();
        const file=path.resolve(root,decodeURIComponent(url.pathname.slice(prefix.length)));
        if (!file.startsWith(path.resolve(root)+path.sep)) return route.abort();
        return route.fulfill({path:file});
    });
    const page=await ctx.newPage();
    page.on('pageerror',e=>errors.push(e.stack));
    const ready=async()=>{ await page.waitForSelector('#ilg-studio .ilg-type-studio',{state:'attached'}); };
    await page.goto(origin); await ready();
    async function open() {
        await page.evaluate(()=>document.querySelector('.ilg-studio-entry button').click());
        await page.locator('#ilg-studio [data-studio-tab="text"]').click();
    }
    async function seed() {
        await page.evaluate(()=>{
            const chat=document.querySelector('#chat');
            chat.innerHTML=`<div class="mes last_mes" is_user="false" mesid="0" style="width:100%;max-width:none"><div class="mes_block"><div class="mes_text">
              <p data-check="plain">月光亮在旧书店里。<q>“留下来。”</q> <em>她没有说话。</em> <strong>不急。</strong> <a href="#">书签</a></p>
              <blockquote data-check="block">Handwritten note · 页角批注</blockquote>
              <p data-check="code">Use <code>printf()</code> for code.</p>
              <p class="author-owned" style="color:rgb(17,82,33);font:19px serif" data-check="owned">Card-specified paragraph</p>
              <div class="card-own"><p style="color:rgb(66,77,88);padding-inline:7px 19px">Author panel</p></div>
              <iframe title="Authored frame" srcdoc="<p style='color:rgb(77, 88, 99)'>Own frame</p>"></iframe>
            </div></div></div><div class="mes" mesid="1" is_system="true"><div class="mes_text"><p data-check="system">System message</p></div></div>`;
        });
        await page.waitForSelector('[data-check="plain"].ilg-type-prose',{state:'attached'});
    }
    await seed();
    const css=async (selector,prop)=>page.locator(selector).evaluate((node,prop)=>getComputedStyle(node)[prop],prop);
    const fill=(key,value)=>page.locator('#ilg-type-'+key).fill(value);
    const select=(key,value)=>page.locator('#ilg-type-'+key).selectOption(value);
    const button=action=>page.locator('[data-type-action="'+action+'"]');
    const body='[data-check="plain"]';
    const baseFont=await css(body,'fontSize');
    const protectedStyles=async()=>await Promise.all(['[data-check="owned"]','.card-own p','[data-check="code"]','[data-check="system"]','#send_textarea'].map(async x=>[await css(x,'fontSize'),await css(x,'color'),await css(x,'fontFamily')]));
    const protectedBefore=await protectedStyles();
    await open();
    assert.equal(await page.locator('.ilg-studio-meta span').first().textContent(),'字体工坊 · 应用后生效');
    const preset=key=>page.locator('.ilg-type-presets label[data-reading-style="'+key+'"]');
    const presetInput=key=>preset(key).locator('input');
    const controlValue=key=>page.locator('#ilg-type-'+key).inputValue();
    assert.deepEqual(await page.locator('.ilg-type-presets .ilg-style-name').allTextContents(),['青瓷','栖暖','笺月','晴笺']);
    assert.deepEqual(await page.locator('.ilg-type-presets q').allTextContents(),Array(4).fill('故事慢慢说'));
    const proofQuote='.ilg-type-page q';
    assert.equal(await page.locator(proofQuote).textContent(),'“把这一页留给明天，好不好？”');
    await page.locator('[data-type-sample]').selectOption('mixed');
    assert.match(await page.locator(proofQuote).textContent(),/Meet me at dawn/);
    assert.deepEqual(await page.locator('.ilg-type-presets q').allTextContents(),Array(4).fill('故事慢慢说'));
    await page.locator('[data-type-sample]').selectOption('chinese');
    const presetRows=()=>page.locator('.ilg-reading-choice > label').evaluateAll(nodes=>new Set(nodes.map(n=>n.getBoundingClientRect().top)).size);
    await preset('warm').waitFor({state:'visible'});
    assert.equal(await presetRows(),1);
    const common=page.locator('.ilg-type-common');
    for (const key of ['leading','inset']) assert(await common.locator('#ilg-type-'+key).isVisible());
    assert.equal(await controlValue('leading'),'2.45'); assert.equal(await controlValue('inset'),'14');
    assert.equal(await css(body,'paddingInlineEnd'),'14px');
    const gutters = selector => page.locator(selector).evaluate(el => {
        const style = getComputedStyle(el), outer = getComputedStyle(el.parentElement);
        const parent = el.parentElement.getBoundingClientRect(), box = el.getBoundingClientRect();
        return {
            start: parseFloat(style.paddingInlineStart), end: parseFloat(style.paddingInlineEnd), width: box.width, parentWidth: parent.width, max: style.maxInlineSize,
            left: box.left - parent.left - parseFloat(outer.paddingLeft) - parseFloat(outer.borderLeftWidth),
            right: parent.right - box.right - parseFloat(outer.paddingRight) - parseFloat(outer.borderRightWidth),
        };
    });
    for (const width of [360, 691, 1000]) {
        await page.setViewportSize({width,height:840});
        const {start,end} = await gutters(body);
        assert.deepEqual([start,end],[14,14],`Migrated mobile inset is symmetric at ${width}px`);
    }
    await page.setViewportSize({width:1280,height:860});
    const beforeLine=await css(body,'lineHeight');
    await select('body-face','serif');
    await preset('classic').click();
    assert.equal(await controlValue('body-face'),'serif','Choosing a preset preserves unrelated typography');
    assert.equal(await controlValue('leading'),''); assert.equal(await controlValue('inset'),'');
    assert.equal(await page.locator('[data-type-range="leading"]').getAttribute('aria-valuetext'),'跟随风格');
    assert.equal(await css(body,'paddingInlineEnd'),'14px'); assert.equal(await css(body,'lineHeight'),beforeLine);
    await fill('leading','2.4'); await fill('inset','12'); await preset('classic').click();
    assert.equal(await controlValue('leading'),''); assert.equal(await controlValue('inset'),'');
    await presetInput('classic').focus(); await page.keyboard.press('ArrowRight');
    assert(await presetInput('moon').isChecked());
    assert.equal(await page.locator('.ilg-type-page').getAttribute('data-ilg-reading-style'),'moon');
    assert.equal(await page.locator('html').getAttribute('data-ilg-reading-style'),'warm');
    await button('apply').click();
    assert.equal(await page.locator('html').getAttribute('data-ilg-reading-style'),'moon');
    assert.equal(await css(body,'paddingInlineEnd'),'0px'); assert.notEqual(await css(body,'lineHeight'),beforeLine);
    await fill('size','22'); await fill('leading','2.35');
    await page.getByText('细调排版与字色',{exact:true}).click();
    for (const key of ['body-weight','tracking','word','gap','indent','measure','align']) {
        const id='ilg-type-hint-'+key;
        assert.equal(await page.locator('#ilg-type-'+key).getAttribute('aria-describedby'),id);
        assert(await page.locator('#'+id).isVisible());
    }
    await fill('tracking','.045'); await fill('gap','.7');
    await fill('inset','6'); await fill('indent','1'); await fill('measure','16'); await select('align','start');
    await select('body-face','serif'); await fill('body-weight','450'); await fill('body-day','#203841'); await fill('body-night','#dfeae4');
    const pick = (role, key) => page.locator('[data-type-marks="'+role+'"] .ilg-type-mark-tile').filter({has:page.locator('[data-type-mark][value="'+key+'"]')}).click();
    const markRole = role => page.locator('.ilg-type-mark-tabs label').filter({has:page.locator('[name="ilg-type-mark-role"][value="'+role+'"]')}).click();
    const quick=(role,kind)=>page.locator('[data-type-quick-role="'+role+'"][data-type-quick="'+kind+'"]');
    const textShape=async selector=>Promise.all(['fontStyle','fontWeight','fontSize'].map(key=>css(selector,key)));
    const quoteSamples={wash:['backgroundColor','rgba(0, 0, 0, 0)'],highlight:['backgroundImage','none'],frame:['boxShadow','none']};
    for (const [mark,[prop,plain]] of Object.entries(quoteSamples)) {
        await pick('quote',mark); assert.notEqual(await css('.ilg-type-page q',prop),plain);
    }
    for (const [mark,stroke] of [['dotted','dotted'],['wave','wavy'],['double','double']]) {
        await pick('quote',mark); assert.equal(await css('.ilg-type-page q','textDecorationStyle'),stroke);
    }
    await pick('quote','underline');
    const quoteBefore=await textShape(body+' q');
    for (const kind of ['style','weight','scale']) await quick('quote',kind).click();
    assert.deepEqual(await textShape(proofQuote),['italic','700','25.3px']);
    assert.deepEqual(await textShape(body+' q'),quoteBefore,'Quick styles remain in the draft');
    await markRole('body');
    const paragraph='.ilg-type-page p.ilg-type-line:nth-of-type(1)';
    for (const [mark,prop] of [['paper','backgroundColor'],['frame','boxShadow'],['rule','boxShadow'],['dotrule','backgroundImage'],['margin','backgroundImage'],['fade','backgroundImage']]) {
        await pick('body',mark); assert.notEqual(await css(paragraph,prop),prop==='backgroundColor'?'rgba(0, 0, 0, 0)':'none');
    }
    await pick('body','plain'); assert.equal(await css(paragraph,'boxShadow'),'none');
    await pick('body','rail'); assert.notEqual(await css(paragraph,'boxShadow'),'none');
    assert.equal(await css(body,'boxShadow'),'none','Prose marks stay in the draft before apply');
    for (const kind of ['style','weight','scale']) await quick('body',kind).click();
    assert.deepEqual(await textShape(paragraph),['italic','700','25.3px']);
    assert.deepEqual(await textShape(proofQuote),['italic','700','25.3px'],'Relative boosts do not multiply');
    await markRole('quote');
    for (const kind of ['style','weight','scale']) await quick('quote',kind).click();
    assert.deepEqual(await textShape(proofQuote),['normal','400','22px'],'Body boosts do not override dialogue');
    for (const kind of ['style','weight','scale']) await quick('quote',kind).click();
    await markRole('body');
    for (const kind of ['style','weight','scale']) await quick('body',kind).click();
    await fill('body-weight','450');
    assert.equal(await quick('body','weight').getAttribute('aria-pressed'),'false');
    await fill('body-weight','800');
    assert.equal(await quick('body','weight').getAttribute('aria-pressed'),'true');
    await fill('body-weight','450');
    await select('role','quote'); await select('quote-face','kai'); await fill('quote-day','#465486'); await fill('quote-night','#b7caef');
    await select('role','em'); await select('em-style','italic'); await fill('em-night','#cbb6af');
    assert.equal(await css(body,'fontSize'),baseFont,'Draft edits do not apply to chat');
    const proofFirst='.ilg-type-page p.ilg-type-line:nth-of-type(1)';
    assert.equal(await css(proofFirst,'fontSize'),'22px');
    assert.equal(await css('.ilg-type-page q','textDecorationLine'),'underline');
    await page.locator('[data-type-tone]').selectOption('day');
    assert.equal(await css(proofFirst,'color'),'rgb(32, 56, 65)');
    await page.locator('[data-type-tone]').selectOption('night');
    assert.equal(await css(proofFirst,'color'),'rgb(223, 234, 228)');
    await page.locator('[data-type-tone]').selectOption('auto');
    await button('apply').click();
    assert.equal(await css(body,'fontSize'),'22px');
    assert.equal(await css(body,'lineHeight'),'51.7px');
    assert.equal(await css(body+' q','textDecorationLine'),'underline');
    assert.deepEqual(await textShape(body+' q'),['italic','700','25.3px']);
    assert.deepEqual(await textShape(body),['normal','450','22px']);
    assert.notEqual(await css(body,'boxShadow'),'none');

    for (const width of [360, 691, 1000, 1280]) {
        await page.setViewportSize({width,height:860});
        const metrics = await gutters(body);
        const {start,end,left,right} = metrics;
        assert(start > 6 && start === end, `Marked prose keeps even inner padding at ${width}px: ${start}/${end}`);
        assert(Math.abs(left - right) < 1, `Capped prose stays centered at ${width}px: ${left}/${right}`);
        if (width === 1000) assert(left > 10, JSON.stringify(metrics));
        assert.equal(await css(body,'textIndent'),'22px','Paragraph inset does not remove first-line indent');
        const author = await gutters('.card-own > p');
        assert.deepEqual([author.start,author.end],[7,19],'Card-owned padding stays untouched');
    }
    const proofGutters = await gutters(proofFirst);
    assert.equal(proofGutters.start,proofGutters.end,'The proof sheet uses the same symmetric mark padding');
    assert.equal(await css('[data-check="code"]','boxShadow'),'none');
    assert.equal(await css('[data-check="owned"]','boxShadow'),'none');
    assert.equal(await css(body+' q','color'),'rgb(183, 202, 239)');
    assert.equal(await css(body+' em','fontStyle'),'italic');
    assert.equal(await css(body+' em','color'),'rgb(203, 182, 175)');
    await page.evaluate(()=>document.documentElement.classList.add('ilg-light'));
    assert.equal(await css(body,'color'),'rgb(32, 56, 65)');
    assert.equal(await css(body+' q','color'),'rgb(70, 84, 134)');
    await page.evaluate(()=>document.documentElement.classList.remove('ilg-light'));
    assert.deepEqual((await protectedStyles()).map((x,i)=>i===2?[x[0]]:x),protectedBefore.map((x,i)=>i===2?[x[0]]:x),'DIY changes are not inherited by code, authored UI, system text or the composer');
    assert.equal(await page.frameLocator('iframe[title="Authored frame"]').locator('p').evaluate(el=>getComputedStyle(el).color),'rgb(77, 88, 99)');
    for (const kind of ['style','weight','scale']) await quick('body',kind).click();
    await button('apply').click();
    assert.deepEqual(await textShape(body),['italic','700','25.3px']);
    assert.deepEqual(await textShape(body+' q'),['italic','700','25.3px']);
    for (const kind of ['style','weight','scale']) await quick('body',kind).click();
    await fill('body-weight','450'); await button('apply').click();
    await fill('size','999'); assert.equal(await page.locator('#ilg-type-size').getAttribute('aria-invalid'),'true');
    await fill('size','22'); assert.equal(await page.locator('#ilg-type-size').getAttribute('aria-invalid'),null);
    await page.getByText('本机字库',{exact:true}).click();
    const asset='noto-sans-sc-100-wght-normal.woff2';
    const assetPath=(await fs.readdir(path.join(root,'fonts'),{recursive:true})).find(x=>x.endsWith(asset));
    await page.locator('#ilg-type-upload').setInputFiles({name:'fake.woff2',mimeType:'font/woff2',buffer:Buffer.from('this is not a font file')});
    await page.waitForFunction(()=>document.querySelector('.ilg-type-feedback').textContent.includes('格式不符'));
    await page.locator('#ilg-type-upload').setInputFiles(path.join(root,'fonts',assetPath));
    await page.waitForFunction(name=>document.querySelector('[data-type-files]').textContent.includes(name),asset);
    await select('body-face','file:'+asset);
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ilg-type-line')).fontFamily.includes('NVWAUserFont'));
    await button('apply').click();
    assert((await css(body,'fontFamily')).includes('NVWAUserFont'));
    await page.getByText('我的排版',{exact:true}).click();
    await fill('profile-name','笺月 · 夜航'); await button('save').click();
    const [download] = await Promise.all([page.waitForEvent('download'),button('export').click()]);
    const dataJson=await fs.readFile(await download.path()); const exported=JSON.parse(dataJson);
    assert.equal(exported.values['quote-style'],'italic'); assert.equal(exported.values['quote-weight'],700); assert.equal(exported.values['quote-scale'],1.15);
    assert.equal(exported.version,1);assert.equal(exported.base,'moon');assert.equal(exported.values['body-mark'],'rail');assert.equal(exported.values['quote-mark'],'underline');assert.equal(exported.values['body-face'],'file:'+asset);
    await button('clear').click(); assert.equal(await css(body,'fontSize'),baseFont); assert.equal(await css(body,'boxShadow'),'none');
    await button('load').click(); assert.equal(await css(body,'fontSize'),baseFont);
    await button('apply').click(); assert.equal(await css(body,'fontSize'),'22px');
    await page.locator('[data-type-import]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exported,values:{'quote-day':'url(evil)'}}))});
    await page.waitForFunction(()=>document.querySelector('.ilg-type-feedback').textContent.includes('不是有效'));
    assert.equal(await css(proofFirst,'fontSize'),'22px');
    await page.locator('[data-type-import]').setInputFiles({name:'read.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exported,base:'sunny',values:{...exported.values,size:24}}))});
    await page.waitForFunction(()=>document.querySelector('.ilg-type-page').dataset.ilgReadingStyle==='sunny');
    assert.equal(await css(proofFirst,'fontSize'),'24px'); assert.equal(await css(body,'fontSize'),'22px');
    await button('revert').click(); assert.equal(await css(proofFirst,'fontSize'),'22px');
    const stored=path.join(data,'default-user','settings.json');
    for (let i=0; i<60; i++) {
        const state=JSON.parse(await fs.readFile(stored,'utf8')).extension_settings?.iosLiquidGlass;
        if (state?.typography?.['body-face']==='file:'+asset && state.typeProfiles?.length===1) break;
        if (i===59) throw Error('Host did not persist active typography and profile');
        await new Promise(r=>setTimeout(r,250));
    }
    await page.reload(); await ready(); await seed();
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-check="plain"]')).fontFamily.includes('NVWAUserFont'));
    assert.equal(await css(body,'fontSize'),'22px');
    await open();
    assert.deepEqual(await textShape(body+' q'),['italic','700','25.3px']);
    for (const kind of ['style','weight','scale']) assert.equal(await quick('quote',kind).getAttribute('aria-pressed'),'true');
    await page.getByText('本机字库',{exact:true}).click();
    await page.getByRole('button',{name:'移除字体 '+asset,exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-type-missing]').textContent.includes('暂缺'));
    assert(!(await css(body,'fontFamily')).includes('NVWAUserFont'));
    assert.equal(await css(body,'fontSize'),'22px');
    await select('body-face','serif'); await button('apply').click();
    await fill('size','18'); await fill('leading','1.9'); await markRole('quote'); await pick('quote','highlight');
    assert.equal(await page.locator('.ilg-type-feedback').textContent(),'');
    await page.getByText('本机字库',{exact:true}).click();
    const desktopBody=page.locator('#ilg-studio .ilg-studio-body');
    if (out) {
        await fs.mkdir(out,{recursive:true});
        await page.getByText('NVWA 配套主题',{exact:true}).first().waitFor({state:'hidden',timeout:20000});
        await page.locator('.ilg-type-studio').evaluate(n=>n.scrollIntoView({block:'start'}));
        await page.screenshot({path:path.join(out,'字体工坊-预设与文字格式-桌面.png')});
    }
    for (const width of [360,600,1100]) {
        await page.setViewportSize({width,height:840});
        const metrics=await desktopBody.evaluate(el=>({w:el.clientWidth,scroll:el.scrollWidth}));
        assert(metrics.scroll<=metrics.w+1,`Horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
        assert.equal(await css(proofFirst,'fontSize'),'18px');
        if (width===360) assert.equal(await presetRows(),2);
        if (out && width===360) { await page.locator('[data-type-tone]').selectOption('day'); await markRole('body'); await page.locator('.ilg-type-mark-section').evaluate(n=>n.scrollIntoView({block:'start'})); await page.screenshot({path:path.join(out,'字体工坊-文字样式-窄屏.png')}); }
    }
    if (out) {
        await page.setViewportSize({width:390,height:844});
        await page.getByText('细调排版与字色',{exact:true}).click();
        await page.locator('.ilg-type-role-list').evaluate(n=>n.scrollIntoView({block:'start'}));
        await page.screenshot({path:path.join(out,'字体工坊-细调说明-窄屏.png')});
    }
    assert.deepEqual(errors,[]);
    console.log('Isolated SillyTavern + desktop Edge passed: four keyboard-accessible presets, automatic spacing inheritance, legacy spacing migration, field hints, draft/day/night, independent quick styles and marks, protected renderers, file validation/IndexedDB reload/removal, profile JSON/save/reload, paired mobile insets and capped paragraph centering, responsive layouts.');
} catch (error) {
    console.error('Isolated host log:', serverLog,'\nBrowser errors:',errors);
    throw error;
} finally { await browser?.close(); child.kill(); }
