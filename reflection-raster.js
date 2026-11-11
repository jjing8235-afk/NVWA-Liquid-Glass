// DOM-free contour raster shared by main-thread fallback and the glass worker.
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
export function reflectionPixel(depth, nx, ny, out) {
    if (depth < 0 || depth > 7) { out[3] = 0; return out; }
    const facing = -nx * .573576 - ny * .819152;
    const key = Math.pow(Math.max(0, facing), 7);
    const bounce = Math.pow(Math.max(0, -facing), 10);
    const crest = Math.exp(-(((depth - .55) / .43) ** 2));
    const shoulder = Math.exp(-(((depth - 1.65) / 1.1) ** 2));
    const returnBand = Math.exp(-(((depth - 2.5) / .9) ** 2));
    const shine = crest * (.025 + .72 * key + .2 * bounce) + shoulder * (.11 * key + .025 * bounce);
    const cool = returnBand * bounce * .07;
    const shade = Math.exp(-(((depth - 1.45) / .65) ** 2)) * (.025 + .045 * Math.max(0, -facing));
    const total = shine + cool + shade;
    out[0] = total ? (shine * 252 + cool * 216 + shade * 12) / total : 0;
    out[1] = total ? (shine * 254 + cool * 238 + shade * 24) / total : 0;
    out[2] = total ? (shine * 255 + cool * 255 + shade * 38) / total : 0;
    out[3] = clamp(total, 0, .86) * 255;
    return out;
}

export function reflectionGeometry(width,height,radius,dpr=1) {
    const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
    const r=clamp(radius,0,Math.min(w,h)/2),scale=Math.min(2,Math.max(1,dpr||1),1536/w,768/h);
    return {w,h,r,scale,cw:Math.max(2,Math.round(w*scale)),ch:Math.max(2,Math.round(h*scale)),key:[w,h,r,scale].join(':')};
}
export function rasterReflection(width,height,radius,dpr=1,buffer) {
    const {w,h,r,cw,ch}=reflectionGeometry(width,height,radius,dpr);
    const data=buffer||new Uint8ClampedArray(cw*ch*4),out=[0,0,0,0],band=Math.max(7,r);
    let leftEnd=0,rightStart=cw;
    while(leftEnd<cw&&(leftEnd+.5)*w/cw<=band)leftEnd++;
    while(rightStart>leftEnd&&(rightStart-.5)*w/cw>=w-band)rightStart--;
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
        const row=(y+.5)*h/ch;
        if(row>band&&row<h-band&&x===leftEnd)x=rightStart;
        if(x>=cw)break;
        const p=(y*cw+x)*4,px=(x+.5)*w/cw-w/2,py=(y+.5)*h/ch-h/2;
        const qx=Math.abs(px)-w/2+r,qy=Math.abs(py)-h/2+r;
        const ex=Math.max(qx,0),ey=Math.max(qy,0),length=Math.hypot(ex,ey);
        const depth=r-length-Math.min(Math.max(qx,qy),0);
        if(depth<0||depth>7)continue;
        const nx=length?Math.sign(px)*ex/length:qx>qy?Math.sign(px):0;
        const ny=length?Math.sign(py)*ey/length:qy>=qx?Math.sign(py):0;
        reflectionPixel(depth,nx,ny,out);
        for(let c=0;c<4;c++)data[p+c]=out[c];
    }
    return {w:cw,h:ch,data};
}
