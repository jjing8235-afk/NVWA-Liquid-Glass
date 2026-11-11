// Dedicated settings surface. Control IDs and settings ownership stay in the extension entry module.
// Layout: a left rail (brand, tabs, master switch) and a scrolling body; each page is a stack of titled
// cards (.ilg-group) holding one control per row. On phones the rail becomes a top bar with a tab capsule.
import { WEB_PRESETS } from './web-presets.js';
const icons = {
 glass:'<path d="M4 6h16v12H4zM4 9h16M8 6v12"/>',
 layout:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M9 10h12"/>',
 text:'<path d="M4 5h16M12 5v15M8 20h8M5 10l-2 8m0-3h4m-2-5 2 8"/>',
 diagnostics:'<path d="M12 3 4 6v5c0 5 8 10 8 10s8-5 8-10V6zM9 12l2 2 4-4"/>',
};
const svg = name => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';
export function downloadDiagnostic(text, kind = '兼容诊断') {
 const blob = new Blob([String.fromCharCode(0xfeff)+text], {type:'text/plain;charset=utf-8'}), url = URL.createObjectURL(blob);
 const link = document.createElement('a');link.href=url;link.download='NVWA-'+kind+'-'+new Date().toISOString().slice(0,19).replaceAll(':','-')+'.txt';link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const copy={mobileTilt:['手机姿态高光','开启后自动申请并恢复；倾斜手机时边缘反光随之变化'],enabled:['启用',''],float:['悬浮输入区','顶栏与输入框浮在聊天内容上方'],icons:['简洁图标','使用统一风格的线性图标'],refract:['边缘折射','按当前环境能力启用背景位移'],refractMes:['消息折射','长聊天性能不足时可关闭'],font:['统一字体','思源黑体；Apple 设备使用苹方'],firstLineIndent:['首行缩进','普通段落缩进两个汉字'],justifyText:['两端对齐','只调整普通正文的左右边缘'],islands:['分组悬浮岛','把顶栏按功能分组'],fold:['收起顶栏设置','设置图标归入左上角菜单'],qrFold:['折叠快捷回复','收进输入框左侧按钮'],toneBtn:['显示外观切换','顶栏单击循环白天、黑夜、自定义'],home:['简洁首页','保留问候语与最近聊天入口'],orb:['思考提示','生成时显示点阵小球'],panelRead:['面板加厚','抽屉和弹窗底色更实、模糊更重，花壁纸上也看得清字'],floatBall:['显示悬浮小球','液态玻璃小球，点一下打开本面板；不喜欢就关掉'],ballSnap:['松手吸边','拖到中间松开会回到最近的左 / 右边；关掉就停在原地'],ballFuse:['边缘融合','拖到顶栏或输入框旁边，两块玻璃之间长出液体颈部并贴住'],iosMaterial:['iOS 兼容材质','使用系统模糊，不依赖 SVG 折射'],iosSvgTrial:['iOS 折射实验','依赖 WebKit；实际效果需要真机确认']};
export function createSettingsPanel({host, content, appearance, version, settings, engines = {}}) {
 const dialog=document.createElement('dialog');dialog.id='ilg-studio';dialog.className='ilg-studio';dialog.setAttribute('aria-labelledby','ilg-studio-title');
 dialog.innerHTML='<div class="ilg-studio-layout"><aside class="ilg-studio-rail"><div class="ilg-studio-brand"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 14Q16 1 28 14Q16 27 4 14Zm0 5Q16 6 28 19Q16 32 4 19Z"/></svg><div><h1 id="ilg-studio-title">液态玻璃</h1><p>NVWA 外观工作台</p></div></div><nav class="ilg-studio-nav" role="tablist" aria-label="设置分类"></nav><div class="ilg-studio-power"><span class="ilg-studio-state" role="status"></span><div class="ilg-studio-master"></div></div></aside><main class="ilg-studio-body"></main></div><button type="button" class="ilg-appearance-close ilg-studio-close" aria-label="关闭玻璃设置"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button>';
 dialog.querySelector('.ilg-studio-brand p').textContent='NVWA · '+(engines.performance||'外观工作台');
 const groups=[['glass','外观与材质','选一种玻璃，留一份自己的外观。'],['layout','界面布局','安排顶栏、输入区与首页。'],['text','阅读文字','为长时间阅读留出舒服的节奏。'],['diagnostics','高级与兼容','基础效果、性能与环境适配。']];
 const pages=new Map(), nav=dialog.querySelector('nav'), main=dialog.querySelector('main');
 content.querySelector('.inline-drawer-header')?.remove();const old=content.querySelector('.inline-drawer-content');const oldNodes=[...old.childNodes];old.replaceChildren();content.replaceChildren();content.classList.add('ilg-studio-settings');main.append(content);
 for(const[key,title,description]of groups){const tab=document.createElement('button');tab.type='button';tab.id='ilg-studio-tab-'+key;tab.dataset.studioTab=key;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','ilg-studio-page-'+key);tab.innerHTML=svg(key)+'<span>'+title+'</span>';nav.append(tab);const section=document.createElement('section');section.id='ilg-studio-page-'+key;section.dataset.studioPage=key;section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby',tab.id);section.innerHTML='<div class="ilg-studio-section-heading"><h2>'+title+'</h2><p>'+description+'</p></div>';pages.set(key,section);content.append(section);}
 const meta=document.createElement('p');meta.className='ilg-studio-meta';meta.innerHTML='<span>即时生效，自动保存</span><span>'+version+'</span>';
 const staging=document.createElement('div');oldNodes.forEach(n=>staging.append(n));
 // A control's whole block (row, switch label, or the node itself); null when the host build lacks it.
 const block=id=>{const control=staging.querySelector('#'+id)||dialog.querySelector('#'+id);if(!control)return null;return control.closest('.ilg-row')||control.closest('label.checkbox_label')||control;};
 // Titled card. Rows go inside; an optional note sits under the card.
 const card=(page,title,nodes,note)=>{const list=nodes.filter(Boolean);if(!list.length)return null;const g=document.createElement('div');g.className='ilg-group';if(title){const h=document.createElement('h3');h.className='ilg-group-title';h.textContent=title;g.append(h);}const box=document.createElement('div');box.className='ilg-group-card';box.append(...list);g.append(box);if(note){const p=typeof note==='string'?Object.assign(document.createElement('p'),{textContent:note}):note;p.classList.add('ilg-group-note');g.append(p);}pages.get(page).append(g);return g;};
 const opt=key=>block('ilg-opt-'+key);
 // Infrequent controls keep their original IDs, listeners and saved preferences.
 const disclosure=(page,title,nodes,note)=>{const g=card(page,'',nodes,note);if(!g)return null;const details=document.createElement('details');details.className='ilg-settings-disclosure';const summary=document.createElement('summary');summary.textContent=title;details.append(summary,...g.childNodes);g.append(details);return g;};
 // Select rows put the label left and the control right; their hint becomes the card note.
 const pickHint=(row,id)=>{const hint=row?.querySelector('#'+id);hint?.remove();return hint;};
 const master=staging.querySelector('#ilg-opt-enabled')?.closest('label');if(master)dialog.querySelector('.ilg-studio-master').append(master);
 // Appearance panel (tone modes, material, Web presets, custom wallpaper) keeps its own nodes and sync code.
 appearance.querySelector('.ilg-appearance-heading')?.remove();appearance.hidden=false;appearance.removeAttribute('style');
 const reading=appearance.querySelector('.ilg-reading-section');
 // index.js still writes this status line; keep the node but hide it (the footer says the same).
 const appearanceStatus=appearance.querySelector('.ilg-appearance-status');if(appearanceStatus)appearanceStatus.hidden=true;
 const material=document.createElement('div');material.className='ilg-group ilg-material-group';
 const materialTitle=document.createElement('h3');materialTitle.className='ilg-group-title';materialTitle.textContent='玻璃材质';material.append(materialTitle);
 const glassChoice=appearance.querySelector('.ilg-glass-choice:not(.ilg-web-presets)');glassChoice?.querySelector('legend')?.classList.add('ilg-sr-only');
 const webPresets=appearance.querySelector('.ilg-web-presets');webPresets?.querySelector('legend')?.classList.add('ilg-sr-only');
 const webHint=appearance.querySelector('.ilg-web-style-hint');
 material.append(...[glassChoice,webHint].filter(Boolean));
 // Two small five-step meters per Web preset: refraction (ref) and ring thickness (edge), relative to the strongest preset.
 const most=k=>Math.max(...Object.values(WEB_PRESETS).map(p=>p[k]));
 const meter=(label,value,max)=>{const n=Math.max(1,Math.round(value/max*5));return '<span class="ilg-meter" aria-hidden="true"><em>'+label+'</em>'+Array.from({length:5},(_,i)=>'<i'+(i<n?' class="on"':'')+'></i>').join('')+'</span>';};
 webPresets?.querySelectorAll('input[name="ilg-web-preset"]').forEach(input=>{const p=WEB_PRESETS[input.value];const span=input.nextElementSibling;if(!p||!span)return;const m=document.createElement('span');m.className='ilg-meters';m.innerHTML=meter('折射',p.ref,most('ref'))+meter('厚度',p.edge,most('edge'));span.append(m);});
 appearance.prepend(material);
 const custom=appearance.querySelector('.ilg-appearance-custom');
 if(custom){custom.classList.add('ilg-group');const legend=custom.querySelector('.ilg-text-choice legend');const h=document.createElement('h3');h.className='ilg-group-title';h.textContent=legend?.textContent||'自定义壁纸字色';legend?.classList.add('ilg-sr-only');custom.prepend(h);}
 const renderRow=opt('compatibilityMode'),renderHint=staging.querySelector('#ilg-compat-hint');
 card('glass','渲染方式',[renderRow],renderHint);
 pages.get('glass').append(appearance);
 const toneRow=opt('tone'),hoursRow=opt('dayStart'),modes=appearance.querySelector('.ilg-appearance-modes');
 const legacyTone=document.createElement('div');legacyTone.hidden=true;legacyTone.append(toneRow);
 const policyRow=document.createElement('div');policyRow.className='ilg-row ilg-inline-row';
 policyRow.innerHTML='<label for="ilg-switch-policy">切换方式</label><select id="ilg-switch-policy" class="text_pole"><option value="manual">自选外观</option><option value="time">按时间切换</option><option value="system">跟随系统</option></select>';
 const policy=policyRow.querySelector('select');
 const toneGroup=card('glass','外观切换',[policyRow,hoursRow,modes,legacyTone]);toneGroup.classList.add('ilg-tone-group');
 const policyNote=document.createElement('p');policyNote.className='ilg-group-note';toneGroup.append(policyNote);
 material.after(toneGroup);
 policy.addEventListener('change',()=>{const value=policy.value==='manual'?(modes.querySelector('input:checked')?.value||'custom'):policy.value;const legacy=document.getElementById('ilg-opt-tone');legacy.value=value==='custom'?'auto':value;legacy.dispatchEvent(new Event('change',{bubbles:true}));sync();});
 const bgRow=opt('chatBackground');
 card('text','背景与可读性',[bgRow,opt('chatVeil'),opt('panelRead')],pickHint(bgRow,'ilg-chat-background-hint'));
 const webGroup=card('glass','漾卿 · 弧度',[webPresets]);webGroup?.classList.add('ilg-studio-web-presets');if(webGroup)appearance.append(webGroup);
 const tuning=staging.querySelector('#ilg-fine-tuning');
 if(tuning){const presets=tuning.querySelector('.ilg-presets');if(presets){const g=card('glass','映卿 · 弧度',[presets],'弧度与清透度可以分别调整。');g?.classList.add('ilg-studio-original-presets');presets.previousElementSibling?.classList.contains('ilg-sub')&&presets.previousElementSibling.remove();}tuning.querySelector('.ilg-sub')?.remove();const g=card('glass','',[tuning]);g?.classList.add('ilg-tuning-group');}
 card('glass','光感',[opt('mobileTilt'),staging.querySelector('#ilg-tilt-controls')]);
 const saved=staging.querySelector('#ilg-opt-savedAppearance');saved?.querySelector('.ilg-saved-summary')?.remove();
 card('glass','我的外观',[saved]);
 card('layout','悬浮小球',[opt('floatBall')]);
 const ballDetails=disclosure('layout','拖动与融合',[opt('ballSnap'),opt('ballFuse')]);
 // Folded layout with two optional shortcuts; legacy controls retain saved-look bindings.
 const topChoice=staging.querySelector('#ilg-opt-topStyle');topChoice?.querySelector('legend')?.classList.add('ilg-sr-only');
 const legacyTop=document.createElement('div');legacyTop.hidden=true;[opt('islands'),opt('fold')].filter(Boolean).forEach(n=>legacyTop.append(n));
 card('layout','顶栏',[topChoice,staging.querySelector('#ilg-opt-topShortcuts'),opt('toneBtn'),legacyTop]);
 card('layout','输入区',[opt('qrFold')]);
 card('layout','首页与聊天',[opt('home'),opt('homeName'),opt('avatar'),opt('orb')]);
 if(reading){const style=reading.querySelector('.ilg-reading-choice');style?.querySelector('legend')?.classList.add('ilg-sr-only');const g=card('text','文字风格',[reading]);g?.classList.add('ilg-reading-group');}
 const fontRow=opt('chatFontSize');
 card('text','排版',[opt('firstLineIndent'),opt('justifyText'),fontRow],pickHint(fontRow,'ilg-chat-font-hint'));
 const status=['ilg-status','ilg-opt-themeStatus'].map(id=>staging.querySelector('#'+id));
 disclosure('diagnostics',engines.performance||'基础效果与性能',[opt('refract'),opt('refractMes'),opt('engine'),opt('icons'),opt('float'),opt('font')],'优先响应交互，复用玻璃资源；基础效果和回退选项也可在这里调整。');
 card('diagnostics','当前状态',status);
 card('diagnostics','环境适配',[staging.querySelector('#ilg-ios-material-setting'),opt('iosSvgTrial')]);
 const reportWrap=staging.querySelector('#ilg-opt-iosReportWrap'),cardReport=block('ilg-card-report-copy');
 card('diagnostics','导出诊断',[reportWrap,cardReport]);
 const reset=staging.querySelector('#ilg-reset');if(reset){reset.textContent='恢复扩展默认参数';card('diagnostics','',[reset])?.classList.add('ilg-reset-group');}
 main.append(meta);
 const leftovers=[...staging.children].filter(e=>e.textContent.trim()||e.querySelector('input,select'));if(leftovers.length)card('diagnostics','其他',leftovers);
 dialog.querySelectorAll('.ilg-group-card > .ilg-row').forEach(row=>{if(row.querySelector(':scope > label + select, :scope > label + .ilg-hours'))row.classList.add('ilg-inline-row');});
 for(const label of dialog.querySelectorAll('label.checkbox_label')){const input=label.querySelector('input[type=checkbox]');if(!input)continue;input.setAttribute('role','switch');label.classList.add('ilg-switch-row');const name=input.id.replace('ilg-opt-','');const words=copy[name];const span=label.querySelector('span')||document.createElement('span');span.className='ilg-switch-copy';if(words){span.textContent='';const title=document.createElement('strong');title.textContent=words[0];span.append(title);if(words[1]){const detail=document.createElement('small');detail.textContent=words[1];span.append(detail);}}label.replaceChildren(span,input);const track=document.createElement('i');track.className='ilg-jelly-track';track.setAttribute('aria-hidden','true');track.innerHTML='<i></i>';label.append(track);}
 const launch=document.createElement('div');launch.className='ilg-studio-entry';launch.innerHTML='<div><strong>NVWA 液态玻璃</strong><small>材质、布局、文字与兼容设置</small></div><button type="button" id="ilg-open-settings">打开玻璃设置 <span aria-hidden="true">↗</span></button>';host.append(launch);document.body.append(dialog);
 const MEMO='ilg-studio-memo';let memo={};try{memo=JSON.parse(sessionStorage.getItem(MEMO)||'{}')||{};}catch{memo={};}
let active=typeof memo.tab==='string'?memo.tab:'glass',opener=null;const scrolls=memo.scrolls&&typeof memo.scrolls==='object'?memo.scrolls:{};
const saveMemo=()=>{try{sessionStorage.setItem(MEMO,JSON.stringify({tab:active,scrolls}));}catch{}};
 const originalOnly=[...dialog.querySelectorAll('.ilg-studio-original-presets, .ilg-tuning-group')];
 function select(key){if(!pages.has(key))key='glass';if(dialog.open)scrolls[active]=main.scrollTop;active=key;for(const button of nav.children){const selected=button.dataset.studioTab===key;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}for(const[k,page]of pages)page.hidden=k!==key;main.scrollTop=Number(scrolls[key])||0;saveMemo();}
 // The custom tile previews the last chosen custom wallpaper (or the current one when it isn't a bundled tone wall).
 // Relative url() inside a custom property resolves against settings-panel.css, so pass an absolute URL.
 function wallThumb(){let path=settings.customWallpaper||'';if(!path){const bg=document.getElementById('bg_custom')||document.getElementById('bg1');const m=bg&&/url(["']?(.*?)["']?)/.exec(bg.style.backgroundImage||getComputedStyle(bg).backgroundImage||'');if(m&&!/liquid(%20| )glass/i.test(m[1]))path=m[1];}if(path)dialog.style.setProperty('--s-wall','url('+JSON.stringify(new URL(path,document.baseURI).href)+')');else dialog.style.removeProperty('--s-wall');}
 function sync(){
  const automatic=settings.tone==='time'||settings.tone==='system';policy.value=automatic?settings.tone:'manual';modes.hidden=automatic;hoursRow.hidden=settings.tone!=='time';
  policyNote.textContent=automatic?'在配套壁纸间自动切换；自定义壁纸会保留。':'点选即切换；自定义壁纸会自动匹配字色。';
  if(ballDetails)ballDetails.hidden=!settings.floatBall;
  wallThumb();const enabled=settings.enabled!==false;dialog.querySelector('.ilg-studio-state').textContent=enabled?'已开启':'已暂停';dialog.querySelector('.ilg-studio-state').dataset.on=String(enabled);if(document.documentElement.classList.contains('ilg')||!dialog.dataset.tone)dialog.dataset.tone=document.documentElement.classList.contains('ilg-light')?'light':'dark';const original=settings.glassStyle!=='liquid-web',cssMode=settings.compatibilityMode==='blur';material.hidden=cssMode;originalOnly.forEach(n=>{n.hidden=cssMode||!original;});if(webGroup)webGroup.hidden=cssMode||original;}
 function open(key=active){if(key==='glass'&&!dialog.open)key=active;opener=document.activeElement;sync();select(key);if(!dialog.open)dialog.showModal();nav.querySelector('[aria-selected=true]')?.focus();}
 function close(focus=true){if(!dialog.open)return;scrolls[active]=main.scrollTop;saveMemo();dialog.close();if(focus&&opener?.isConnected)opener.focus();}
 dialog.addEventListener('change',()=>queueMicrotask(sync));launch.querySelector('button').addEventListener('click',()=>open('glass'));dialog.querySelector('.ilg-studio-close').addEventListener('click',()=>close());dialog.addEventListener('cancel',e=>{e.preventDefault();close();});nav.addEventListener('click',e=>{const tab=e.target.closest('[data-studio-tab]');if(tab)select(tab.dataset.studioTab);});nav.addEventListener('keydown',e=>{const keys=groups.map(g=>g[0]);let index=keys.indexOf(active);if(e.key==='ArrowRight'||e.key==='ArrowDown')index=(index+1)%keys.length;else if(e.key==='ArrowLeft'||e.key==='ArrowUp')index=(index+keys.length-1)%keys.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=keys.length-1;else return;e.preventDefault();select(keys[index]);nav.querySelector('[aria-selected=true]').focus();});select(active);sync();return{open,close,sync,dialog};
}
