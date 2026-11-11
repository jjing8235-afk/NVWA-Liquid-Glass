import { rasterBall, packBallFrame } from './ball-raster.js';
import { rasterReflection } from './reflection-raster.js';

async function encode(image) {
    const canvas = new OffscreenCanvas(image.w, image.h);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas unavailable');
    context.putImageData(new ImageData(image.data, image.w, image.h), 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    canvas.width = canvas.height = 0;
    if (typeof FileReaderSync === 'function') return new FileReaderSync().readAsDataURL(blob);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return 'data:image/png;base64,' + btoa(binary);
}

const capable = (async () => {
    try {
        if (typeof OffscreenCanvas !== 'function') return false;
        await encode({ w: 2, h: 2, data: new Uint8ClampedArray(16) });
        return true;
    } catch { return false; }
})();
capable.then(ok => self.postMessage({ type: 'ready', ok }));
self.onmessage = async event => {
    const { type, id, job } = event.data || {};
    if (type !== 'render') return;
    try {
        if (!await capable) throw new Error('Canvas unavailable');
        if (job.kind === 'reflection') {
            const image=rasterReflection(job.width,job.height,job.radius,job.dpr);
            self.postMessage({type:'result',id,frame:{url:await encode(image)}});
            return;
        }
        const result = rasterBall(job), urls = [];
        for (const image of result.images) urls.push(await encode(image));
        self.postMessage({ type: 'result', id, frame: packBallFrame(result, urls) });
    } catch {
        self.postMessage({ type: 'error', id });
    }
};
