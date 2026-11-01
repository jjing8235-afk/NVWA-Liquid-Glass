import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const parse = source.slice(source.indexOf('const parseRgba ='), source.indexOf('// Computed display metadata only:'));
const block = source.match(/function blockBg\(el, cs = getComputedStyle\(el\)\) \{[\s\S]*?\n\}/)[0];
const card = source.slice(source.indexOf('const cardColors ='), source.indexOf('function queueCards('));
function node(tag, { color = 'rgba(0, 0, 0, 0)', image = 'none', pseudo = false, previous = '' } = {}) {
    const classes = new Set(previous ? ['ilg-solid'] : []);
    const values = new Map(previous ? [['--ilg-card-solid', previous]] : []);
    const el = {
        tag, color, image, pseudo, children: [],
        style: { backgroundColor: color, backgroundImage: image, background: '',
            getPropertyValue: name => values.get(name) || '',
            setProperty: (name, value) => values.set(name, value),
            removeProperty: name => values.delete(name),
        },
        classList: { contains: value => classes.has(value), toggle(value, enabled) { if (enabled) classes.add(value); else classes.delete(value); } },
        matches: selector => selector.split(',').some(part => part.trim() === tag),
        getClientRects: () => [{}], getBoundingClientRect: () => ({ width: 313, height: 590 }),
    };
    Object.defineProperty(el, 'contentDocument', { get() { throw Error('Card frame internals must remain untouched'); } });
    return el;
}
function computed(el, pseudo) {
    if (pseudo) return { content: el.pseudo && pseudo === '::before' ? '""' : 'none', display: 'block',
        backgroundColor: el.pseudo && pseudo === '::before' ? 'rgba(74, 43, 94, 0.8)' : 'rgba(0, 0, 0, 0)', backgroundImage: 'none' };
    const stored = el.style.getPropertyValue('--ilg-card-solid');
    const backing = el.classList.contains('ilg-solid') && stored;
    return { backgroundColor: backing ? (stored === 'var(--ilg-card-fallback)' ? 'rgb(18, 20, 30)' : stored) : el.color,
        backgroundImage: el.image, position: 'static', display: 'block', visibility: 'visible' };
}
const S = { cardSolid: true };
const message = { classList: { contains: () => true, toggle() {} } };
const api = vm.runInNewContext(parse + '\n' + block + '\n' + card + '\n({tagCard})', {
    S, root: { classList: { contains: () => false } }, getComputedStyle: computed, paint() {},
});
const test = children => api.tagCard({ children, closest: () => message });
const frame = node('iframe');
const oldFrame = node('iframe', { previous: 'var(--ilg-card-fallback)' });
const image = node('div', { image: 'url("opaque-resource")' });
const oldImage = node('div', { image: 'url("opaque-resource")', previous: 'var(--ilg-card-fallback)' });
const gradient = node('section', { image: 'linear-gradient(rgb(74, 43, 94), rgba(74, 43, 94, 0))' });
const pseudo = node('section', { pseudo: true });
const opaque = node('section', { color: 'rgb(74, 43, 94)' });
const all = [frame, oldFrame, image, oldImage, gradient, pseudo, opaque];
for (let i = 0; i < 3; i++) {
    test(all);
    for (const el of [frame, oldFrame, image, oldImage]) {
        assert.equal(el.classList.contains('ilg-solid'), false, 'Unknown color must not invent a backing');
        assert.equal(el.style.getPropertyValue('--ilg-card-solid'), '');
        assert.equal(computed(el).backgroundColor, 'rgba(0, 0, 0, 0)');
    }
    for (const el of [gradient, pseudo]) {
        assert.equal(el.style.getPropertyValue('--ilg-card-solid'), 'rgb(74, 43, 94)');
        assert.equal(el.classList.contains('ilg-solid'), true);
    }
    assert.equal(opaque.classList.contains('ilg-solid'), false);
    assert.equal(computed(opaque).backgroundColor, 'rgb(74, 43, 94)');
}
S.cardSolid = false;
test(all);
assert(all.every(el => !el.classList.contains('ilg-solid') && !el.style.getPropertyValue('--ilg-card-solid')));
S.cardSolid = true;
test(all);
assert(gradient.classList.contains('ilg-solid') && pseudo.classList.contains('ilg-solid'));
assert(!frame.classList.contains('ilg-solid') && !image.classList.contains('ilg-solid'));
console.log(JSON.stringify({ passed: true, checks: [
    'Transparent iframe and unknown image backgrounds keep authored transparency',
    'Legacy neutral backings are removed instead of cached forever',
    'Known gradients and pseudo-element colors remain opaque and stable',
    'Opaque authored surfaces stay unchanged',
    'Off/on restores only known-color surfaces without accessing frame contents',
] }, null, 2));
