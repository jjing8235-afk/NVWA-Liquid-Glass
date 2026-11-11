// Preserve exact contour pixels while large native overlays rasterise off the UI thread.
import {reflectionPixel,reflectionGeometry,rasterReflection} from './reflection-raster.js';
import {createGlassPerformance} from './glass-performance.js';
const cache = new Map();
let pixels = 0;
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
function rememberReflection(key,url,count) {
    if(cache.has(key)){pixels-=cache.get(key).pixels;cache.delete(key);}
    while(cache.size&&(cache.size>=24||pixels+count>2097152)){
        const first=cache.keys().next().value;pixels-=cache.get(first).pixels;cache.delete(first);
    }
    cache.set(key,{url,pixels:count});pixels+=count;
    return url;
}
function roundedReflection(width,height,radius,dpr=window.devicePixelRatio||1) {
    const geometry=reflectionGeometry(width,height,radius,dpr);
    const {key,cw,ch}=geometry;
    if(cache.has(key)){const item=cache.get(key);cache.delete(key);cache.set(key,item);return item.url;}
    const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
    const ctx=canvas.getContext('2d');if(!ctx)return null;
    const image=ctx.createImageData(cw,ch);
    rasterReflection(width,height,radius,dpr,image.data);
    ctx.putImageData(image,0,0);
    const url=canvas.toDataURL('image/png');canvas.width=canvas.height=0;
    return rememberReflection(key,url,cw*ch);
}
export function createGlassReflections() {
    const known = new Set(), motion = matchMedia('(prefers-reduced-motion: reduce)');
    let enabled = false, active = null;
    const reduced = () => motion.matches || document.body.classList.contains('reduced-motion');
    function reset() { active?.el.classList.remove('ilg-reflection-pressed'); active = null; }
    function release(el) {
        if (active?.el === el) reset();
        const key=wanted.get(el);jobs.get(key)?.clients.delete(el);wanted.delete(el);
        known.delete(el); el.classList.remove('ilg-reflection', 'ilg-reflection-pressed');
        for (const key of ['--ilg-reflection-map', '--ilg-reflection-x', '--ilg-reflection-y']) el.style.removeProperty(key);
    }
    const wanted=new Map(),jobs=new Map();
    let activeKey='',waitTimer=0;
    function apply(el,key,url) {
        if(!enabled||!el.isConnected||wanted.get(el)!==key)return;
        const image='url("'+url+'")';
        if(el.style.getPropertyValue('--ilg-reflection-map')!==image)el.style.setProperty('--ilg-reflection-map',image);
        if(!el.classList.contains('ilg-reflection'))el.classList.add('ilg-reflection');
        known.add(el);
    }
    function pump() {
        clearTimeout(waitTimer);waitTimer=0;
        if(!enabled||activeKey||!jobs.size)return;
        if(background.status().mode==='starting'){waitTimer=setTimeout(pump,24);return;}
        for(const [key,entry] of jobs){
            if(!entry.clients.size){jobs.delete(key);continue;}
            activeKey=key;background.request(entry.job);return;
        }
    }
    const background=createGlassPerformance({
        computeSync:job=>({url:roundedReflection(job.width,job.height,job.radius,job.dpr)}),
        onResult(job,frame){
            const entry=jobs.get(job.key);jobs.delete(job.key);activeKey='';
            if(frame?.url){
                const geometry=reflectionGeometry(job.width,job.height,job.radius,job.dpr);
                rememberReflection(job.key,frame.url,geometry.cw*geometry.ch);
                for(const el of entry?.clients||[])apply(el,job.key,frame.url);
            }
            pump();
        },
        onError(){const entry=jobs.get(activeKey);jobs.delete(activeKey);activeKey='';for(const el of entry?.clients||[])release(el);pump();},
    });
    function paint(el,width,height,radius) {
        try {
            const dpr=window.devicePixelRatio||1,{key}=reflectionGeometry(width,height,radius,dpr);
            const previous=wanted.get(el);
            if(previous!==key)jobs.get(previous)?.clients.delete(el);
            wanted.set(el,key);known.add(el);
            const item=cache.get(key);
            if(item){cache.delete(key);cache.set(key,item);apply(el,key,item.url);return;}
            const overlay=el.matches('#options .options-content, #extensionsMenu, #qr--bar, dialog.popup.ilg-adapted');
            if(overlay&&width*height>=16000){
                let entry=jobs.get(key);
                if(!entry){entry={job:{kind:'reflection',key,width,height,radius,dpr},clients:new Set()};jobs.set(key,entry);}
                entry.clients.add(el);background.prepare();pump();return;
            }
            const url=roundedReflection(width,height,radius);
            if(url)apply(el,key,url);else release(el);
        } catch { release(el); }
    }
    function press(event) {
        if (!enabled || reduced() || document.body.classList.contains('no-blur') || active) return;
        if (event.type === 'pointerdown' && event.button > 0) return;
        if (event.type === 'keydown' && (event.repeat || !['Enter', ' '].includes(event.key))) return;
        const target = event.target;
        if (!(target instanceof Element) || target.closest('[disabled], [aria-disabled="true"], textarea, input, select, [contenteditable="true"]')) return;
        for (const el of known) {
            if (!el.matches('.ilg-control-surface, #ilg-ball') || !el.isConnected || el.hidden || !el.offsetWidth) continue;
            if (!el.contains(target) && !el.icons?.some(icon => icon.contains(target))) continue;
            const r = el.getBoundingClientRect(), pointer = event.type === 'pointerdown';
            el.style.setProperty('--ilg-reflection-x', `${pointer ? clamp(event.clientX - r.left, 0, r.width) : r.width / 2}px`);
            el.style.setProperty('--ilg-reflection-y', `${pointer ? clamp(event.clientY - r.top, 0, r.height) : r.height / 2}px`);
            el.classList.add('ilg-reflection-pressed'); active = {el, id:pointer ? event.pointerId : event.key}; return;
        }
    }
    function up(event) { if (active && active.id === (event.type.startsWith('pointer') ? event.pointerId : event.key)) reset(); }
    function visibility() { if (document.hidden) reset(); }
    function out(event) { if (!event.relatedTarget) reset(); }
    const events = [['pointerdown', press], ['pointerup', up], ['pointercancel', up], ['pointerout', out], ['keydown', press], ['keyup', up], ['visibilitychange', visibility]];
    function setEnabled(on) {
        if (enabled === on) return;
        enabled = on;
        for (const [name, listener] of events) document[on ? 'addEventListener' : 'removeEventListener'](name, listener, {passive:true});
        window[on ? 'addEventListener' : 'removeEventListener']('blur', reset);
        if (on) { background.resume(); background.prepare(); }
        else { clearTimeout(waitTimer);waitTimer=0;background.pause();jobs.clear();activeKey='';reset(); [...known].forEach(release);cache.clear();pixels=0; }
    }
    motion.addEventListener('change', reset);
    return {paint, release, setEnabled,status:()=>({...background.status(),queued:jobs.size,waitingSurfaces:wanted.size,cacheEntries:cache.size})};
}

export {reflectionPixel};
