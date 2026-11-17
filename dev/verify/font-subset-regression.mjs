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
 [[face('U+0000')],['\u0000'],true,'null code point'],
 [[face('U+10FFFF')],['\u{10FFFF}'],true,'last Unicode code point'],
 [[face('U+1F600-1F64F')],['\u{1F680}'],false,'astral boundary outside range'],
 [[face('U+005B-005D')],['[content]'],true,'numeric regex metacharacters'],
 [[face('U+4E00'),face('U+1F6??')],['\u{1F680}'],true,'multiple valid ranges'],
];
for(const [faces,texts,expected,label]of cases)assert.equal(fontLoadMayChangeText(faces,texts),expected,label);
const unreadableTexts={*[Symbol.iterator](){throw new Error('Chat must stay unread for an already-known font decision');}};
for(const faces of [undefined,[],[{}],[face('invalid')],[face('U+0-10FFFF')],[face('U+201C')]])assert.equal(fontLoadMayChangeText(faces,unreadableTexts),true);
const firstMatch={*[Symbol.iterator](){yield '正文';throw new Error('A matching first message must stop later reads');}};
assert.equal(fontLoadMayChangeText([face('U+6B63')],firstMatch),true);
console.log(JSON.stringify({passed:true,cases:cases.length,lazyCases:7,unknownConservative:true,unicodeRanges:true,astralAndCombining:true}));
