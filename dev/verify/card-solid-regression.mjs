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
    MutationObserver: class { observe() {} disconnect() {} }, chatEl: { querySelectorAll: () => [] },
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
// The removed option must never replace an authored background, even in an old saved configuration.
const colorBefore = all.map(el => ({color:el.style.backgroundColor,image:el.style.backgroundImage}));
for (const savedValue of [true,false,true]) {
    S.cardSolid = savedValue;
    test(all);
    for (const [i,el] of all.entries()) {
        assert.equal(el.classList.contains('ilg-solid'),false);
        assert.equal(el.style.getPropertyValue('--ilg-card-solid'),'');
        assert.equal(el.style.backgroundColor,colorBefore[i].color);
        assert.equal(el.style.backgroundImage,colorBefore[i].image);
    }
    assert(gradient.classList.contains('ilg-card-surface') && pseudo.classList.contains('ilg-card-surface'),'Authored panels retain compatibility markers');
}
const migration=source.match(/if \(Object.hasOwn\(S, 'cardSolid'\)\) \{[^]*?\}/)[0];
const old={cardSolid:true,chatBackground:'transparent',mesTint:.12};let saves=0;
vm.runInNewContext(migration,{S:old,ctx:{saveSettingsDebounced(){saves++}}});
assert.equal(Object.hasOwn(old,'cardSolid'),false);assert.equal(old.chatBackground,'transparent');assert.equal(old.mesTint,.12);assert.equal(saves,1);
vm.runInNewContext(migration,{S:old,ctx:{saveSettingsDebounced(){saves++}}});assert.equal(saves,1);
console.log(JSON.stringify({passed:true,checks:['Authored gradients, pseudo backgrounds and opaque colors remain unchanged','Transparent iframes and image surfaces keep authored transparency','Old generated backing markers are removed','Retired saved option is removed once without changing other appearance settings','Card compatibility markers remain and frame internals are never accessed']},null,2));
