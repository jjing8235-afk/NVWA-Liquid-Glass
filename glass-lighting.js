// Opt-in device pose only. Sensor frames update two inherited light coordinates;
// they never rebuild refraction, measure every glass surface, or track the mouse.
export function createGlassLighting({onPoint, onStatus = () => {}}) {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let enabled = false, wanted = false, authorized = false, attached = false, blurred = false;
    let base = null, target = null, filtered = null, last = null, frame = 0, lastEmit = -Infinity, lastStatus = -Infinity, waitTimer = 0;
    let phase = '手机姿态高光未开启。', failure = '', inFlight = null;
    let attempted = false, waitingGesture = false, armed = false, destroyed = false, choice = 0;
    const clamp = v => Math.max(-1, Math.min(1, v));
    const reduced = () => media.matches || document.body.classList.contains('reduced-motion');
    const quiet = () => document.hidden || blurred || reduced() || document.body.classList.contains('no-blur');
    const available = () => typeof window.DeviceOrientationEvent !== 'undefined' && window.isSecureContext === true;
    const needsPermission = () => typeof window.DeviceOrientationEvent?.requestPermission === 'function';
    const say = text => { if (phase !== text) { phase = text; onStatus(text); } };
    const angle = () => ((Number(window.screen?.orientation?.angle ?? window.orientation ?? 0) % 360) + 360) % 360;
    function clear() {
        if (frame) cancelAnimationFrame(frame);
        clearTimeout(waitTimer); waitTimer = frame = 0;
        target = filtered = last = null; lastEmit = lastStatus = -Infinity; onPoint(null);
    }
    function tick(now) {
        frame = 0;
        if (!attached || quiet() || !target) return;
        const settled = filtered && Math.abs(filtered.x - target.x) + Math.abs(filtered.y - target.y) < .004;
        filtered = !filtered || settled ? {...target} : {x:filtered.x + (target.x - filtered.x) * .18, y:filtered.y + (target.y - filtered.y) * .18};
        // 32ms spans two 60Hz frames; 33ms otherwise skips to a third frame on some devices.
        if (now - lastEmit >= 32 || settled) {
            const point = {x:Math.round(filtered.x * 1000) / 1000, y:Math.round(filtered.y * 1000) / 1000};
            if (!last || Math.abs(last.x - point.x) + Math.abs(last.y - point.y) >= .003 || (settled && point.x === 0 && point.y === 0 && (last.x !== 0 || last.y !== 0))) { onPoint(point); last = point; lastEmit = now; }
        }
        if (!settled) frame = requestAnimationFrame(tick);
    }
    function orientation(event) {
        if (!attached || quiet() || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
        clearTimeout(waitTimer); waitTimer = 0;
        const a = angle();
        if (!base || base.angle !== a) { base = {beta:event.beta, gamma:event.gamma, angle:a}; filtered = last = null; }
        let x = event.gamma - base.gamma, y = ((event.beta - base.beta + 540) % 360) - 180;
        if (a === 90) [x, y] = [y, -x];
        else if (a === 180) [x, y] = [-x, -y];
        else if (a === 270) [x, y] = [-y, x];
        // Suppress resting sensor noise, then respond early and ease into the travel limit.
        // The continuous dead zone avoids a visible jump when a small tilt crosses it.
        const normal = v => {
            const delta = Math.max(0, Math.abs(v) - .45);
            if (delta === 0) return 0;
            return -Math.sign(v) * clamp(Math.tanh(delta / 11.5) / Math.tanh(17.55 / 11.5));
        };
        const next = {x:normal(x), y:normal(y)};
        if (!target || Math.abs(next.x - target.x) + Math.abs(next.y - target.y) > .003) {
            target = next;
            if (!frame) frame = requestAnimationFrame(tick);
        }
        // A bounded live readout distinguishes a subtle render from missing sensor delivery.
        const now = performance.now();
        if (now - lastStatus >= 200) {
            lastStatus = now;
            say('已收到手机姿态 · 左右 ' + x.toFixed(1) + '° / 前后 ' + y.toFixed(1) + '°');
        }
    }
    function stop() { if (attached) window.removeEventListener('deviceorientation', orientation); attached = false; }
    function disarm() {
        if (!armed) return;
        document.removeEventListener('click', gesture);
        document.removeEventListener('keydown', gesture);
        armed = false;
    }
    function gesture(event) {
        if (!event.isTrusted || event.defaultPrevented || (event.type === 'keydown' && !['Enter', ' '].includes(event.key))) return;
        // The explicit controls own their own permission/disable actions.
        const controls = '#ilg-opt-mobileTilt, #ilg-tilt-calibrate, #ilg-opt-enabled';
        if (event.target?.closest?.(controls) || event.target?.closest?.('label')?.control?.matches?.(controls)) return;
        if (enabled && wanted && !quiet() && waitingGesture) requestTilt('gesture');
    }
    function update() {
        if (destroyed) return;
        disarm();
        if (!enabled || !wanted) { stop(); clear(); say(failure || (wanted ? '液态玻璃已关闭；姿态高光暂停。' : '手机姿态高光未开启。')); return; }
        if (!available()) { stop(); clear(); say(window.isSecureContext ? '此浏览器没有提供手机姿态接口；保持固定高光。' : '姿态访问需要 HTTPS 或本机 localhost；当前保持固定高光。'); return; }
        if (quiet()) { stop(); clear(); say(reduced() ? '已开启减少动态效果；姿态高光暂停。' : '页面未在前台或已关闭模糊；姿态高光暂停。'); return; }
        if (needsPermission() && !authorized) {
            stop(); clear();
            if (!attempted) { attempted = true; requestTilt('restore'); return; }
            if (waitingGesture && !inFlight) {
                document.addEventListener('click', gesture);
                document.addEventListener('keydown', gesture);
                armed = true;
            }
            say(inFlight ? '正在恢复手机姿态访问…' : failure || '已记住开启；下次点击页面时自动申请手机姿态访问。');
            return;
        }
        if (!attached) {
            base = null; window.addEventListener('deviceorientation', orientation, {passive:true}); attached = true;
            say('等待手机姿态数据；当前仍为固定高光。');
            waitTimer = setTimeout(() => {waitTimer = 0; if (attached && !base) say('尚未收到姿态数据；请检查浏览器传感器权限，当前保持固定高光。');}, 4500);
        }
    }
    function calibrate() { base = null; clear(); if (attached) say('请保持当前握姿，等待新的姿态数据以居中。'); }
    function visibility() { base = null; clear(); update(); }
    function blur() { blurred = true; visibility(); }
    function focus() { blurred = false; visibility(); }
    const bodyObserver = new MutationObserver(() => update());
    function sync(on, tilt) {
        if (destroyed) return;
        const was = enabled, wasWanted = wanted;
        enabled = on === true; wanted = tilt === true;
        if (was !== enabled || wasWanted !== wanted) { choice++; attempted = false; waitingGesture = false; failure = ''; }
        if (was !== enabled) {
            document[enabled ? 'addEventListener' : 'removeEventListener']('visibilitychange', visibility);
            window[enabled ? 'addEventListener' : 'removeEventListener']('blur', blur);
            window[enabled ? 'addEventListener' : 'removeEventListener']('focus', focus);
            media[enabled ? 'addEventListener' : 'removeEventListener']('change', visibility);
            window.screen?.orientation?.[enabled ? 'addEventListener' : 'removeEventListener']?.('change', calibrate);
            if (enabled) bodyObserver.observe(document.body, {attributes:true, attributeFilter:['class']}); else bodyObserver.disconnect();
        }
        update(); onStatus(phase);
    }
    function requestTilt(mode = 'manual') {
        if (destroyed) return Promise.resolve(false);
        if (inFlight) return inFlight;
        attempted = true; waitingGesture = false; disarm();
        if (!available()) { failure = window.isSecureContext ? '此浏览器没有提供手机姿态接口；保持固定高光。' : '姿态访问需要 HTTPS 或本机 localhost；当前保持固定高光。'; say(failure); return Promise.resolve(false); }
        if (authorized || !needsPermission()) { authorized = true; failure = ''; calibrate(); update(); return Promise.resolve(true); }
        const requestChoice = choice;
        function failed(error) {
            if (destroyed || requestChoice !== choice) return false;
            authorized = false;
            // A missing user gesture is not a denial and must not erase the saved choice.
            waitingGesture = mode === 'restore' && error?.name === 'NotAllowedError';
            failure = waitingGesture ? '' : '手机姿态访问暂未恢复；可点击“以当前握姿居中”重试授权。';
            stop(); clear();
            return false;
        }
        let request;
        // Synchronous in the original trusted click/key handler, before any await.
        try { request = window.DeviceOrientationEvent.requestPermission(); }
        catch (error) { const result = failed(error); update(); return Promise.resolve(result); }
        inFlight = Promise.resolve(request).then(result => {
            if (destroyed || requestChoice !== choice) return false;
            authorized = result === 'granted';
            failure = authorized ? '' : '浏览器未允许姿态访问；已保留开启设置，请检查网站的运动与方向权限。';
            if (authorized) { base = null; clear(); }
            else { stop(); clear(); }
            return authorized;
        }).catch(failed).finally(() => {
            inFlight = null;
            if (requestChoice !== choice) attempted = false;
            if (!destroyed) update();
        });
        return inFlight;
    }
    return {sync, requestTilt, calibrate, status:() => phase, destroy() {sync(false, false); destroyed = true; disarm(); stop(); clear();}};
}
