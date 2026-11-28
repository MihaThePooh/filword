import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {isExcludedWord,containsExcludedText,repairSavedWords} from '../src/word-policy.js';
import {indexDictionary} from '../src/board.js';
import {isGoodWord} from '../scripts/build-dict.mjs';
import {isBonusWord} from '../src/rewards.js';

test('a neutral homonym does not admit excluded spelling at build or play time',()=>{
 for(const word of ['блядь','БЛЯДЬ','бля́дь','говно','хуи','хули','гондон','шлюхоёб']){
  assert.equal(isExcludedWord(word),true,word);
  assert.equal(isGoodWord(word),false,word);
  assert.equal(isBonusWord(word,new Set([word]),[],[]),false,word);
 }
 assert.deepEqual(indexDictionary([{w:'блядь',r:1,d:['пустословие, пустяки']}]),{});
 for(const word of ['команда','мандарин','небо','нёбо','небоскрёб','учёба','гребля','скипидар','собака','передок'])assert.equal(isExcludedWord(word),false,word);
});
test('all shipped dictionaries and their gzip copies exclude the same spellings',()=>{
 for(const name of ['words','kids','bonus','bonus-defs']){
  const path=new URL('../data/'+name+'.json',import.meta.url),plain=readFileSync(path);
  assert.deepEqual(gunzipSync(readFileSync(new URL('../data/'+name+'.json.gz',import.meta.url))),plain);
  const data=JSON.parse(plain),words=Array.isArray(data)?data.map(e=>typeof e==='string'?e:e.w):Object.keys(data);
  assert.ok(words.every(w=>!isExcludedWord(w)),name);
  const entries = Array.isArray(data) ? data.filter(e=>typeof e==='object') : Object.values(data);
  assert.ok(entries.every(e=>(e.d??[]).every(d=>!containsExcludedText(d))),name+' definitions');
 }
});
test('repair replaces only an excluded saved path, preserving completion, hints, cats and money',()=>{
 const saved={board:{size:2,letters:['х','у','и','к'],words:[{word:'хуи',cells:[0,1,2],defs:['bad']},{word:'к',cells:[3],defs:['safe']}]},found:[[0,'green']],hint:{words:{0:1}},cats:{placed:[[0,'v04']]},time:{ms:123},bonus:['блядь','кот'],log:[{i:0},{b:'блядь'},{b:'кот'}]};
 const original=structuredClone(saved),used=new Set(['дом']);
 const fixed=repairSavedWords(saved,[{w:'дом',d:['дом']},{w:'кот',d:['кот']}],used);
 assert.deepEqual(saved,original);assert.equal(fixed.board.words[0].word,'кот');assert.deepEqual(fixed.board.letters,['к','о','т','к']);assert.deepEqual(fixed.found,saved.found);assert.deepEqual(fixed.cats,saved.cats);assert.deepEqual(fixed.hint,saved.hint);assert.deepEqual(fixed.time,saved.time);assert.deepEqual(fixed.bonus,['кот']);assert.deepEqual(fixed.log,[{i:0},{b:'кот'}]);assert.ok(used.has('кот'));
 assert.deepEqual(fixed.board.words[1],saved.board.words[1]);
});
