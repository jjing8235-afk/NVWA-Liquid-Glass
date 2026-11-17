import assert from 'node:assert/strict';import {wallpaperPlacement} from '../../ios-wallpaper-refraction.js';
const base={width:400,height:300,imageWidth:200,imageHeight:200};
assert.deepEqual(wallpaperPlacement({...base,size:'cover'}),{width:400,height:400,x:0,y:-50});
assert.deepEqual(wallpaperPlacement({...base,size:'contain'}),{width:300,height:300,x:50,y:0});
assert.deepEqual(wallpaperPlacement({...base,size:'100% 100%'}),{width:400,height:300,x:0,y:0});
assert.deepEqual(wallpaperPlacement({...base,size:'50% auto',position:'left top'}),{width:200,height:200,x:0,y:0});
assert.deepEqual(wallpaperPlacement({...base,size:'auto 100%',position:'right bottom'}),{width:300,height:300,x:100,y:0});
assert.equal(wallpaperPlacement({...base,width:0}),null);assert.equal(wallpaperPlacement({...base,size:'calc(100% - 2px) auto'}),null);assert.equal(wallpaperPlacement({...base,position:'right 10px top 20px'}),null);
console.log('PASS wallpaper foreground cover/contain/stretch/position geometry and unsupported-layout fallback');
