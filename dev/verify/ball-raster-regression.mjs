import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildBallJob, rasterBall, packBallFrame } from '../../ball-raster.js';
const fixture = JSON.parse(fs.readFileSync(new URL('fixtures/ball-raster-v17.json', import.meta.url), 'utf8'));
fixture.cases = fixture.cases.map(item => ({ ...item, m: fixture.materials[item.material], shape: fixture.shapes[item.shape] }));
for (const { m, shape, low, expected } of fixture.cases) {
    const job = buildBallJob(shape.b, shape.t, m, 30, low, 2, shape.shadow !== false);
    const raster = rasterBall(job);
    const actual = raster.images.map(i => [i.w, i.h, createHash('sha256').update(i.data).digest('hex')]);
    assert.deepEqual(actual, expected, m.key + '/' + shape.name + '/' + low);
    const frame = packBallFrame(raster, actual.map(a => 'data:image/png;base64,' + a[2]));
    assert(!/__ILG_BITMAP_|NaN|undefined/.test(frame.html));
    assert.equal(frame.chars, frame.cover.length + frame.inv.length + frame.reflection.length + frame.html.length);
    assert.equal(frame.pixels, raster.images.reduce((n, image) => n + image.w * image.h, 0));
    assert(job.key.includes(m.key));
}
console.log(JSON.stringify({ passed: true, baseline: fixture.baseline, exactRasterCases: fixture.cases.length }));
