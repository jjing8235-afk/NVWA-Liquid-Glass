// iOS wallpaper refraction: refract only the host wallpaper with an ordinary foreground filter.
// This never captures messages or the page framebuffer, and never claims full backdrop refraction.
export function wallpaperPlacement({width,height,imageWidth,imageHeight,size='cover',position='50% 50%'}) {
    if(![width,height,imageWidth,imageHeight].every(x=>Number.isFinite(x)&&x>0))return null;
    let w=imageWidth,h=imageHeight;
    const length=(v,extent)=>v.endsWith('%')?parseFloat(v)*extent/100:v.endsWith('px')?parseFloat(v):v==='0'?0:null;
    if(size==='cover'||size==='contain'){const scale=Math[size==='cover'?'max':'min'](width/w,height/h);w*=scale;h*=scale;}
    else{const parts=size.trim().split(/\s+/);if(parts.length===1)parts.push('auto');if(parts.length!==2)return null;
        const a=parts[0]==='auto'?null:length(parts[0],width),b=parts[1]==='auto'?null:length(parts[1],height);
        if(parts[0]!=='auto'&&a===null||parts[1]!=='auto'&&b===null)return null;
        if(a!==null&&b!==null){w=a;h=b;}else if(a!==null){h=h*a/w;w=a;}else if(b!==null){w=w*b/h;h=b;}
    }
    const parts=position.trim().split(/\s+/);if(parts.length!==2)return null;
    const offset=(v,free)=>({left:0,top:0,center:free/2,right:free,bottom:free})[v]??length(v,free);
    const x=offset(parts[0],width-w),y=offset(parts[1],height-h);
    return [w,h,x,y].every(Number.isFinite)?{width:w,height:h,x,y}:null;
}
export function createIOSWallpaperRefraction({background,onReady=()=>{},win=window,doc=document}={}) {
    const entries=new Map();let enabled=false,source=null,raf=0,listening=false,reason='disabled';
    const events=[[win,'resize'],[win.visualViewport,'resize'],[win.visualViewport,'scroll'],[doc,'scroll']];
    const listen=on=>{if(on===listening)return;listening=on;for(const [target,type]of events)target?.[on?'addEventListener':'removeEventListener'](type,schedule,{capture:true,passive:true});};
    function release(el){const item=entries.get(el);item?.plane.remove();entries.delete(el);el.classList.remove('ilg-ios-wallpaper-host');if(!entries.size){listen(false);if(raf)win.cancelAnimationFrame(raf);raf=0;}}
    function queuePaint(){if(enabled)onReady();}
    function getSource(){
        const el=background?.();if(!el){reason='no-wallpaper';return null;}
        const css=win.getComputedStyle(el),match=/^url\(["']?(.*?)["']?\)$/.exec(css.backgroundImage);
        if(!match){reason='unsupported-wallpaper';return null;}
        const url=match[1];
        if(source?.url!==url){if(source){source.image.onload=source.image.onerror=null;}const image=new win.Image();source={url,image,loaded:false,failed:false};const current=source;
            image.onload=()=>{if(source!==current)return;current.loaded=image.naturalWidth>0&&image.naturalHeight>0;reason=current.loaded?'ready':'image-unavailable';queuePaint();};
            image.onerror=()=>{if(source!==current)return;current.failed=true;reason='image-unavailable';queuePaint();};image.src=url;
        }
        if(!source.loaded){reason=source.failed?'image-unavailable':'loading-wallpaper';return null;}
        return {el,css,...source};
    }
    function update(el,item,src){
        if(!el.isConnected){release(el);return false;}
        const host=el.getBoundingClientRect(),bg=src.el.getBoundingClientRect();
        if(!(host.width>0&&host.height>0)){release(el);return false;}
        const placement=wallpaperPlacement({width:bg.width,height:bg.height,imageWidth:src.image.naturalWidth,imageHeight:src.image.naturalHeight,size:src.css.backgroundSize,position:src.css.backgroundPosition});
        if(!placement){reason='unsupported-background-layout';release(el);return false;}
        const x=bg.left+placement.x-host.left,y=bg.top+placement.y-host.top;
        const key=[src.url,placement.width,placement.height,x,y,src.css.backgroundRepeat,item.filter].join('|');
        if(item.key!==key){item.key=key;item.plane.style.backgroundImage=src.css.backgroundImage;item.plane.style.backgroundSize=placement.width+'px '+placement.height+'px';item.plane.style.backgroundPosition=x+'px '+y+'px';item.plane.style.backgroundRepeat=src.css.backgroundRepeat;item.plane.style.filter=item.filter;}
        reason='ready';return true;
    }
    function schedule(){if(!enabled||raf||!entries.size)return;raf=win.requestAnimationFrame(()=>{raf=0;const src=getSource();if(!src){for(const el of [...entries.keys()])release(el);queuePaint();return;}for(const [el,item]of [...entries])update(el,item,src);});}
    return {
        setEnabled(on){enabled=on===true;if(!enabled){for(const el of [...entries.keys()])release(el);if(source){source.image.onload=source.image.onerror=null;}source=null;reason='disabled';}},
        paint(el,filter){if(!enabled)return false;const src=getSource();if(!src){release(el);return false;}
            let item=entries.get(el);if(!item){if(entries.size>=8){reason='surface-budget';return false;}const plane=doc.createElement('div');plane.className='ilg-ios-wallpaper-plane';plane.setAttribute('aria-hidden','true');el.prepend(plane);el.classList.add('ilg-ios-wallpaper-host');item={plane,key:'',filter};entries.set(el,item);}item.filter=filter;
            const ok=update(el,item,src);if(ok)listen(true);return ok;
        },release,refresh(){if(enabled){if(entries.size)schedule();else queuePaint();}},status:()=>({enabled,mode:'wallpaper-only',reason,surfaces:entries.size,imageLoaded:source?.loaded===true,fullBackdropRefraction:false,phonePixelsConfirmed:false}),
        destroy(){this.setEnabled(false);}
    };
}
