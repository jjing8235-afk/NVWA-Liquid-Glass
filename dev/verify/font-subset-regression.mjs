import assert from 'node:assert/strict';
import {fontLoadMayChangeText} from '../../message-rendering.js';
const face=unicodeRange=>({unicodeRange});
const cases=[
 [undefined,['正文'],true,'missing event metadata'],
 [[],['正文'],true,'empty event metadata'],
 [[{}],['正文'],true,'missing range'],
 [[face('invalid')],['正文'],true,'malformed range'],
 [[face('U+9000-8000')],['正文'],true,'reversed range'],
 [[face('U+110000')],['正文'],true,'invalid code point'],
 [[face('U+0-10FFFF')],['正文'],true,'universal range'],
 [[face('U+4E00-9FFF')],['正文'],true,'relevant Chinese subset'],
 [[face('U+8BBE')],['聊天正文'],false,'unrelated menu character'],
 [[face('U+6B63')],['聊天正文'],true,'exact prose character'],
 [[face('U+8BBE'),face('U+6B63')],['正文'],true,'one relevant face in a batch'],
 [[face('U+1F6??')],['😀'],true,'astral wildcard'],
 [[face('U+1F6??')],['正文'],false,'irrelevant astral face'],
 [[face(' u+201c, U+201D ')],['正文'],true,'generated quotation marks'],
 [[face('U+0061-007A')],['Header'],true,'header metrics'],
 [[face('U+0300-036F')],['e\u0301'],true,'combining mark'],
];
for(const [faces,texts,expected,label]of cases)assert.equal(fontLoadMayChangeText(faces,texts),expected,label);
console.log(JSON.stringify({passed:true,cases:cases.length,unknownConservative:true,unicodeRanges:true,astralAndCombining:true}));
