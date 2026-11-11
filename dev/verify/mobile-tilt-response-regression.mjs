// Deterministic pose-response contract: small deliberate tilts are visible, resting noise is quiet,
// large tilts remain bounded, motion settles, and permission/lifecycle gates retain authority.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const root=process.env.NVWA_EXTENSION_ROOT||new URL('../../',import.meta.url);
const source=fs.readFileSync(typeof root==='string'?root+'/glass-lighting.js':new URL('glass-lighting.js',root),'utf8').replace(/^export /gm,'');
function events(){const map=new Map();return {addEventListener(k,fn){if(!map.has(k))map.set(k,new Set());map.get(k).add(fn)},removeEventListener(k,fn){map.get(k)?.delete(fn)},dispatch(k,e={}){for(const fn of map.get(k)||[])fn(e)},count(k){return map.get(k)?.size||0}}}
let now=0,id=0;const rafs=new Map(),timers=new Map(),points=[],statuses=[],classes=new Set();
const media={...events(),matches:false},orientation={...events(),angle:0};
const window={...events(),screen:{orientation},isSecureContext:true,DeviceOrientationEvent:class{}};
const document={...events(),hidden:false,body:{classList:{contains:k=>classes.has(k)}}};
const factory=vm.runInNewContext(source+';createGlassLighting',{window,document,matchMedia:()=>media,MutationObserver:class{observe(){}disconnect(){}},performance:{now:()=>now},requestAnimationFrame:fn=>{const n=++id;rafs.set(n,fn);return n},cancelAnimationFrame:n=>rafs.delete(n),setTimeout:fn=>{const n=++id;timers.set(n,fn);return n},clearTimeout:n=>timers.delete(n)});
const c=factory({onPoint:p=>points.push(p),onStatus:text=>statuses.push(text)}),emit=(beta,gamma)=>window.dispatch('deviceorientation',{beta,gamma});
function flush(){for(let k=0;rafs.size&&k<200;k++){now+=16;const jobs=[...rafs.values()];rafs.clear();for(const fn of jobs)fn(now)}assert.equal(rafs.size,0,'At rest there must be no permanent animation loop')}
const last=()=>points.at(-1);
c.sync(true,true);emit(45,0);flush();assert.equal(last().x,0);assert.equal(last().y,0);
for(const noise of [.1,-.2,.4,-.4]){emit(45,noise);flush();assert.equal(Math.abs(last().x),0,'Small sensor noise must stay at rest')}
let start=points.length;emit(45,6);flush();const response=last().x;
emit(45,6);assert.match(statuses.at(-1),/左右 6\.0°/,'Live readout must expose delivered hand movement');
const count=statuses.length;for(let k=0;k<10;k++)emit(45,6+k/10);assert.equal(statuses.length,count,'Sensor status must be throttled');emit(45,6);flush();
assert(response<-.4&&response>-.62,'A 6-degree hand tilt should have a perceptible, restrained response');
const steps=points.slice(start).filter(Boolean).map(p=>p.x);for(let i=1;i<steps.length;i++){assert(steps[i]<=steps[i-1]+.001,'Response should settle monotonically');assert(Math.abs(steps[i]-steps[i-1])<.15,'No sudden light jump')}
emit(45,90);flush();assert.equal(last().x,-1);emit(45,0);flush();assert.equal(last().x,0);
emit(45,.46);flush();assert(Math.abs(last().x)<.005,'Crossing the quiet zone must not create a step');
c.calibrate();orientation.angle=90;emit(45,0);flush();emit(51,0);flush();assert(last().x<-.4);assert(Math.abs(last().y)<.001);
media.matches=true;media.dispatch('change');assert.equal(window.count('deviceorientation'),0);assert.equal(last(),null);
media.matches=false;media.dispatch('change');assert.equal(window.count('deviceorientation'),1);emit(60,12);flush();assert.equal(last().x,0,'Resume must establish a fresh holding pose');
classes.add('no-blur');c.sync(true,true);assert.equal(window.count('deviceorientation'),0);assert.equal(last(),null);classes.delete('no-blur');c.sync(true,true);
document.hidden=true;document.dispatch('visibilitychange');assert.equal(window.count('deviceorientation'),0);assert.equal(last(),null);document.hidden=false;document.dispatch('visibilitychange');
c.destroy();assert.equal(window.count('deviceorientation'),0);assert.equal(rafs.size,0);assert.equal(timers.size,0);
let requested=0;window.DeviceOrientationEvent.requestPermission=()=>{requested++;return Promise.resolve('denied')};const denied=factory({onPoint(){}});denied.sync(true,false);assert.equal(requested,0,'Default-off loading must not ask for sensor permission');denied.sync(true,true);assert.equal(window.count('deviceorientation'),0);assert.equal(await denied.requestTilt(),false);assert.equal(requested,1);assert.equal(window.count('deviceorientation'),0);denied.destroy();
console.log(JSON.stringify({passed:true,sixDegreeResponse:response,checks:['Resting noise and continuous dead zone','Small-angle response and bounded extremes','Monotonic smoothing and no idle animation loop','Orientation-aware calibration and neutral return','Reduced motion, no-blur, hidden and destroy cleanup','Default-off privacy, saved-on restoration and denial fallback','Bounded live angle readout']},null,2));
