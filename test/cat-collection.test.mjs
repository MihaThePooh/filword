import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planCats,revealCat} from '../src/cat-collection.js';
test('plans use unique owned cats and random words, including first and last',()=>{
 let seed=1;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
 const seen=new Set();
 for(let n=0;n<100;n++) {
  const plan=planCats(11,['c01','c02','c01'],random);
  assert.ok(plan.length>=1 && plan.length<=2);
  assert.equal(new Set(plan.map(x=>x[0])).size,plan.length);
  assert.equal(new Set(plan.map(x=>x[1])).size,plan.length);
  plan.forEach(([word,id])=>{seen.add(word);assert.ok(['c01','c02'].includes(id));});
 }
 assert.equal(seen.size,11);assert.deepEqual(planCats(11,[]),[]);
});
test('rewards one cell of the matching word, persists and never duplicates or overwrites',()=>{
 const s={plan:[[2,'c01'],[4,'c02']],placed:[]};
 revealCat(s,1,[0,1,2],()=>0);assert.equal(s.placed.length,0);
 revealCat(s,2,[0,1,2],()=>.9);assert.deepEqual(s.placed,[[2,'c01']]);
 const restored=JSON.parse(JSON.stringify(s));
 revealCat(restored,2,[0,1,2]);assert.equal(restored.placed.length,1);
 revealCat(restored,4,[2,3,4],()=>0);assert.deepEqual(restored.placed,[[2,'c01'],[3,'c02']]);
});
