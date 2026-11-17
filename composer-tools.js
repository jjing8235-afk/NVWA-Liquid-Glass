// One launcher for native chat, extension and quick-reply menus. Host action nodes stay in place.
export function createComposerTools({root}) {
    const doc=root.ownerDocument, win=doc.defaultView, bars=new Map(), ownedRows=new Set(), ownedGroups=new Set();
    const panes=['chat','tools','quick'], labels={chat:'聊天',tools:'扩展',quick:'快捷'};
    let enabled=false,pane='chat',routing=false,plus=null,wand=null,saved=[],focusFrame=0,rowsFrame=0;
    const menu=kind=>doc.getElementById(kind==='chat'?'options':kind==='tools'?'extensionsMenu':'qr--bar');
    const content=kind=>kind==='chat'?doc.querySelector('#options .options-content'):menu(kind);
    const trigger=kind=>kind==='chat'?plus:kind==='tools'?wand:doc.getElementById('ilg-qr-toggle');
    const visible=kind=>kind==='quick'?root.classList.contains('ilg-qr-open')&&!!menu(kind):!!menu(kind)&&menu(kind).style.display!=='none'&&!menu(kind).hidden;
    const available=kind=>!!menu(kind)&&!!trigger(kind)&&(kind!=='quick'||root.classList.contains('ilg-qrfold'));
    const observer=new MutationObserver(refresh);
    const toolObserver=new MutationObserver(()=>{if(!rowsFrame)rowsFrame=win.requestAnimationFrame(()=>{rowsFrame=0;if(enabled&&visible('tools'))classifyTools();});});
    const author=el=>!!el.closest('[data-nvwa-style="author"],#catgod-oracle-qrbar');
    const simpleRow=el=>el.matches('.list-group-item')&&!author(el)&&!el.querySelector('input,select,textarea,button,iframe,details,svg,img,video,canvas,[contenteditable="true"],[role="dialog"],[data-nvwa-style="author"]')&&!/background|font|color|border|padding|position|filter/i.test(el.getAttribute('style')||'');
    function clearToolLayout(){for(const el of ownedRows)el.classList.remove('ilg-tool-row','ilg-tool-wide');for(const el of ownedGroups)el.classList.remove('ilg-tool-group');ownedRows.clear();ownedGroups.clear();}
    function classifyTools(){
        const host=menu('tools');if(!host)return;
        const rows=new Set(),groups=new Set();
        for(const child of host.children){
            if(simpleRow(child))rows.add(child);
            else if(child.matches('.extension_container')&&!author(child)){
                const children=[...child.children];
                if(children.length&&children.every(simpleRow)){groups.add(child);for(const el of children)rows.add(el);}
            }
        }
        for(const el of ownedRows)if(!rows.has(el))el.classList.remove('ilg-tool-row','ilg-tool-wide');
        for(const el of ownedGroups)if(!groups.has(el))el.classList.remove('ilg-tool-group');
        ownedRows.clear();ownedGroups.clear();
        for(const el of groups){el.classList.add('ilg-tool-group');ownedGroups.add(el);}
        for(const el of rows){el.classList.add('ilg-tool-row');const length=[...(el.textContent||'').trim()].reduce((n,c)=>n+(/[⺀-鿿]/u.test(c)?1:.55),0);el.classList.toggle('ilg-tool-wide',length>13);ownedRows.add(el);}
    }
    function finishAnimations(){const jq=win.jQuery;if(typeof jq==='function')for(const kind of ['chat','tools'])jq(menu(kind)).stop?.(true,true);}
    function nativeClick(kind){const button=trigger(kind);if(!button)return;routing=true;try{button.click();}finally{routing=false;}}
    function focusLauncher(){plus?.focus({preventScroll:true});}
    function updateBar(el,bar){const active=el.id==='extensionsMenu'?'tools':el.id==='qr--bar'?'quick':'chat';for(const b of bar.children){const selected=b.dataset.pane===active;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;b.disabled=!available(b.dataset.pane);b.title=b.disabled?'当前没有可用的'+labels[b.dataset.pane]+'入口':'';}}
    function refresh(){
        if(!enabled||!plus)return;
        for(const kind of panes)menu(kind)?.classList.toggle('ilg-composer-open',visible(kind));
        const expanded=panes.some(visible);if(plus.getAttribute('aria-expanded')!==String(expanded))plus.setAttribute('aria-expanded',String(expanded));
        for(const [el,bar]of bars)updateBar(el,bar);
        toolObserver.disconnect();
        if(visible('tools')){classifyTools();toolObserver.observe(menu('tools'),{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-nvwa-style','style']});}
    }
    function select(kind,{toggle=false,focus=false}={}){
        if(!enabled||!available(kind))return;
        cancelAnimationFrame(focusFrame);focusFrame=0;finishAnimations();
        if(toggle&&visible(kind)){nativeClick(kind);finishAnimations();focusLauncher();refresh();return;}
        for(const other of panes)if(other!==kind&&visible(other)){nativeClick(other);finishAnimations();}
        pane=kind;focusLauncher();if(!visible(kind))nativeClick(kind);finishAnimations();
        const el=content(kind);if(el)decorate(el);refresh();
        if(focus)focusFrame=win.requestAnimationFrame(()=>{focusFrame=0;bars.get(content(kind))?.querySelector('[aria-selected="true"]')?.focus({preventScroll:true});});
    }
    function launcherClick(event){if(routing||!enabled)return;event.preventDefault();event.stopImmediatePropagation();select(available(pane)?pane:'chat',{toggle:true});}
    function toolsClick(event){if(routing||!enabled)return;event.preventDefault();event.stopImmediatePropagation();select('tools',{toggle:true});}
    function keydown(event){
        if(event.key!=='Escape'||event.isComposing||event.keyCode===229||!enabled||!panes.some(visible))return;
        const target=event.target;
        if(!panes.some(kind=>visible(kind)&&(menu(kind)?.contains(target)||trigger(kind)?.contains(target)||plus?.contains(target))))return;
        if(target.closest?.('dialog,[role="dialog"],[role="alertdialog"],[data-nvwa-style="author"],.ctx-menu,.select2-container'))return;
        event.preventDefault();event.stopPropagation();cancelAnimationFrame(focusFrame);focusFrame=0;finishAnimations();
        for(const kind of panes)if(visible(kind))nativeClick(kind);finishAnimations();focusLauncher();refresh();
    }
    function decorate(el){
        if(!enabled||!el.matches('#options .options-content,#extensionsMenu,#qr--bar')||author(el))return;
        let bar=bars.get(el);
        if(!bar){
            bar=doc.createElement('div');bar.className='ilg-composer-tabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','输入工具');
            for(const kind of panes){const b=doc.createElement('button');b.type='button';b.dataset.pane=kind;b.textContent=labels[kind];b.setAttribute('role','tab');b.id='ilg-composer-tab-'+(el.id==='extensionsMenu'?'tools':el.id==='qr--bar'?'quick':'chat')+'-'+kind;b.setAttribute('aria-controls',kind==='chat'?'options':kind==='tools'?'extensionsMenu':'qr--bar');b.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();select(kind,{focus:true});});bar.append(b);}
            bar.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const choices=panes.filter(available),active=el.id==='extensionsMenu'?'tools':el.id==='qr--bar'?'quick':'chat',i=choices.indexOf(active);select(event.key==='Home'?choices[0]:event.key==='End'?choices.at(-1):choices[(i+(event.key==='ArrowLeft'?-1:1)+choices.length)%choices.length],{focus:true});});bars.set(el,bar);
        }
        updateBar(el,bar);if(bar.parentElement!==el)el.prepend(bar);
    }
    function release(el){bars.get(el)?.remove();bars.delete(el);if(el===menu('tools')){toolObserver.disconnect();clearToolLayout();}}
    function ownAttribute(el,name,value){saved.push({el,name,before:el.getAttribute(name),value});el.setAttribute(name,value);}
    function setEnabled(value){
        if(value===enabled){if(value)refresh();return;}
        if(!value){
            observer.disconnect();toolObserver.disconnect();cancelAnimationFrame(focusFrame);cancelAnimationFrame(rowsFrame);focusFrame=rowsFrame=0;
            plus?.removeEventListener('click',launcherClick,true);wand?.removeEventListener('click',toolsClick,true);doc.removeEventListener('keydown',keydown,true);
            finishAnimations();for(const kind of panes)if(visible(kind))nativeClick(kind);finishAnimations();enabled=false;root.classList.remove('ilg-merged-tools');
            for(const el of [...bars.keys()])release(el);for(const kind of panes)menu(kind)?.classList.remove('ilg-composer-open');clearToolLayout();
            for(const item of saved)if(item.el.getAttribute(item.name)===item.value||item.name==='aria-expanded'){if(item.before===null)item.el.removeAttribute(item.name);else item.el.setAttribute(item.name,item.before);}saved=[];plus=null;wand=null;return;
        }
        plus=doc.getElementById('options_button');wand=doc.getElementById('extensionsMenuButton');
        if(!plus||!wand||!menu('chat')||!menu('tools'))return;
        enabled=true;root.classList.add('ilg-merged-tools');
        ownAttribute(plus,'title','聊天、扩展与快捷工具');ownAttribute(plus,'aria-label','聊天、扩展与快捷工具');ownAttribute(plus,'aria-haspopup','true');ownAttribute(plus,'aria-expanded','false');ownAttribute(wand,'aria-hidden','true');ownAttribute(wand,'tabindex','-1');
        plus.addEventListener('click',launcherClick,true);wand.addEventListener('click',toolsClick,true);doc.addEventListener('keydown',keydown,true);
        for(const kind of ['chat','tools']){ownAttribute(menu(kind),'role','tabpanel');ownAttribute(menu(kind),'aria-labelledby','ilg-composer-tab-'+kind+'-'+kind);observer.observe(menu(kind),{attributes:true,attributeFilter:['style','hidden']});decorate(content(kind));}
        observer.observe(root,{attributes:true,attributeFilter:['class']});refresh();
    }
    return {setEnabled,decorate,release,refresh,focusLauncher};
}
