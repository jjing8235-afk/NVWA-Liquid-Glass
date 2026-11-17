import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {largeWebViewMessage} from '../../surface-policy.js';
const source=fs.readFileSync(new URL('../../index.js',import.meta.url),'utf8');
const begin=source.indexOf('function paint(el, geo) {'),end=source.indexOf('// .ilg-phys',begin);
assert(begin>=0&&end>begin);const paintSource=source.slice(begin,end);
function run({webView=true,engine='physical',width=349,height=3000,dpr=3.25,kind='mes',refract=true,previous=false}={}){
 const styles={},it={kind,visible:true,largeWebView:previous},calls={physical:0,legacy:0,removed:0};
 const el={id:kind==='mes'?'fixture-message':'fixture-bar',classList:{toggle(){}},matches:()=>false,style:styles};
 const context={items:new Map([[el,it]]),document:{body:{classList:{contains:()=>false}}},S:{engine,refract,saturate:1.1,brightness:1.02},devicePixelRatio:dpr,androidWebView:webView,isIOS:false,
  HOST_MENU_SEL:'#options',messageSurface:()=>el,controlSurface:()=>false,controlReadable:()=>false,composerGlassSurface:()=>false,cssGlassActive:()=>false,webStyleEnabled:()=>false,iosWallpaperRequested:()=>false,
  webGlass:{release(){}},iosWallpaper:{release(){}},reflections:{release(){},paint(){}},lightScope:{visibility(){}},visibleItems:new Set(),surfaceBlur:()=>.5,canRefract:()=>true,iosMaterialActive:()=>false,
  largeWebViewMessage,refractAllowed:()=>refract,setPhys(){},buildPhysical(){calls.physical++},buildFilter(){calls.legacy++},inputGlass:()=>false,
 };
 it.filter={remove(){calls.removed++}};it.id='test-filter';
 vm.runInNewContext(paintSource+';paint(el,geo)',{...context,el,geo:{w:width,h:height,r:22}});
 return {it,calls,styles};
}
const samples=[{width:349,height:3000,dpr:3.25},{width:392,height:5536,dpr:3.25},{width:358,height:3781,dpr:4}];
for(const sample of samples)for(const engine of ['physical','legacy']){
 const result=run({...sample,engine});assert.equal(result.it.renderPath,'blur','Large Android WebView message must use bounded CSS fallback, not legacy displacement');
 assert(!result.styles.backdropFilter.includes('url('),'Guarded surface still references an SVG displacement filter');
 assert.equal(result.calls.legacy+result.calls.physical,0);assert.equal(result.it.fallbackReason,'large-webview-message');assert.equal(result.calls.removed,1,'Release the former large filter when the guard activates');
}
for(const settings of [{height:400},{webView:false},{kind:'bar'}]){const result=run(settings);assert.equal(result.it.renderPath,'physical');assert.equal(result.calls.physical,1);}
assert.equal(run({webView:false,engine:'legacy'}).it.renderPath,'legacy');
assert.equal(run({refract:false}).it.fallbackReason,'');
assert(largeWebViewMessage({webView:true,kind:'mes',width:349,height:2200,dpr:3.25,previous:true}),'Hysteresis retains guard near the boundary');
assert(!largeWebViewMessage({webView:true,kind:'mes',width:349,height:1000,dpr:3.25,previous:true}),'Guard releases after a real size reduction');
console.log(JSON.stringify({passed:true,realSampleSizes:samples,engines:2,ordinaryMessagesPreserved:true,desktopPreserved:true,controlsPreserved:true,oldFilterReleased:true}));
