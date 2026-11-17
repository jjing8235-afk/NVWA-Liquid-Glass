import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {rasterWebMap, sampleWebMap} from '../../web-map-raster.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/web-map-204.json',import.meta.url),'utf8'));
assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./fixtures/web-map-204-baseline.mjs',import.meta.url))).digest('hex'),fixture.baselineSourceSha256,'Frozen baseline was edited');
for(const c of fixture.cases){const image=rasterWebMap(c);assert.equal(image.w,c.w);assert.equal(image.h,c.h);assert.equal(image.scale,c.scale);assert.equal(createHash('sha256').update(image.data).digest('hex'),c.sha256,JSON.stringify(c));}
const rounded=sampleWebMap(373.7,51.6,'clear');const integer=sampleWebMap(374,52,'clear');assert.deepEqual(rounded,integer);
assert.deepEqual(sampleWebMap(64,64,'unknown'),sampleWebMap(64,64,'clear'));
console.log(JSON.stringify({passed:true,baselinePixelCases:fixture.cases.length,rounding:true,unknownPreset:true}));
