// Cached 48px wallpaper pixels are mapped back to the displayed background crop.
// No DOM, canvas reads or image decoding occur in these per-point helpers.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const anchor=(token,free)=>{if(token==='left'||token==='top')return 0;if(token==='right'||token==='bottom')return free;if(token==='center')return free/2;if(/^[-+]?\d*\.?\d+%$/.test(token))return free*parseFloat(token)/100;if(/^[-+]?\d*\.?\d+px$/.test(token)||token==='0')return parseFloat(token);return null};
const length=(token,extent)=>/^\d*\.?\d+%$/.test(token)?extent*parseFloat(token)/100:/^\d*\.?\d+px$/.test(token)||token==='0'?parseFloat(token):null;
export function wallpaperLayout(sample,rect,size='cover',position='50% 50%') {
    if(!sample||!rect||!(rect.width>0&&rect.height>0&&sample.width>0&&sample.height>0))return null;
    let width,height;const parts=size.trim().split(/\s+/);
    if(size==='cover'||size==='contain'){const scale=Math[size==='cover'?'max':'min'](rect.width/sample.width,rect.height/sample.height);width=sample.width*scale;height=sample.height*scale}
    else if(parts.length<=2){const x=parts[0],y=parts[1]||'auto';width=x==='auto'?null:length(x,rect.width);height=y==='auto'?null:length(y,rect.height);if((x!=='auto'&&width===null)||(y!=='auto'&&height===null))return null;if(width===null&&height===null){width=sample.width;height=sample.height}else if(width===null)width=height*sample.width/sample.height;else if(height===null)height=width*sample.height/sample.width}
    else return null;
    let [x='50%',y='50%',...extra]=position.trim().split(/\s+/);if(extra.length)return null;if(['top','bottom'].includes(x)&&!['top','bottom'].includes(y))[x,y]=[y,x];
    const left=anchor(x,rect.width-width),top=anchor(y,rect.height-height);if(left===null||top===null||!(width>0&&height>0))return null;
    return {sample,rect,left:rect.left+left,top:rect.top+top,width,height};
}
export function wallpaperPoint(layout,x,y) {
    if(!layout)return null;const {sample,rect}=layout;
    if(x<rect.left||y<rect.top||x>=rect.left+rect.width||y>=rect.top+rect.height||x<layout.left||y<layout.top||x>=layout.left+layout.width||y>=layout.top+layout.height)return null;
    const px=clamp(Math.floor((x-layout.left)/layout.width*sample.size),0,sample.size-1),py=clamp(Math.floor((y-layout.top)/layout.height*sample.size),0,sample.size-1),i=(py*sample.size+px)*4;
    if(sample.pixels[i+3]<250)return null;
    let rgb=[sample.pixels[i],sample.pixels[i+1],sample.pixels[i+2]];const v=layout.veil;
    if(v&&x>=v.rect.left&&x<v.rect.left+v.rect.width&&y>=v.rect.top&&y<v.rect.top+v.rect.height){const k=clamp(v.level,0,1),sat=v.noBlur?1:1-k*.4,bright=v.noBlur||v.light?1:1-k*.4,lum=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];rgb=rgb.map(c=>(lum+(c-lum)*sat)*bright);const a=clamp(k*(v.light?1.1:.95),0,1),base=v.light?[247,245,240]:[18,21,28];rgb=rgb.map((c,i)=>c*(1-a)+base[i]*a)}
    return {r:rgb[0],g:rgb[1],b:rgb[2],luminance:(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])/255};
}
const linear=v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const luminance=c=>.2126*linear(c[0])+.7152*linear(c[1])+.0722*linear(c[2]);
const inks={dark:luminance([39,49,61]),light:luminance([241,244,248])};
export function topTone(average,previous,colors=[]) {
    if(!Number.isFinite(average))return null;
    const samples=(colors.length?colors:[[average*255,average*255,average*255]]).map(luminance);
    const score=t=>Math.min(...samples.map(b=>(Math.max(inks[t],b)+.05)/(Math.min(inks[t],b)+.05)));
    const dark=score('dark'),light=score('light');let tone=dark>=light?'dark':'light';
    // Keep the previous ink while its contrast remains close, instead of flickering on edges.
    if((previous==='dark'||previous==='light')&&score(previous)>=Math.max(dark,light)*.88)tone=previous;
    return {tone};
}
