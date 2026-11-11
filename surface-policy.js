// Budget guard for large filtered message surfaces in Android WebView.
// These are conservative NVWA limits, not a detected GPU texture limit.
export function largeWebViewMessage({webView,kind,width,height,dpr=1,previous=false}) {
    if(!webView||kind!=='mes'||![width,height,dpr].every(Number.isFinite)||width<=0||height<=0)return false;
    const scale=Math.max(1,Math.min(4,dpr)),w=Math.ceil(width*scale),h=Math.ceil(height*scale);
    const edge=previous?6144:8192,pixels=previous?6*1024*1024:8*1024*1024;
    return Math.max(w,h)>edge||w*h>pixels;
}
