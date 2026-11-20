import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCats, revealCat, syncCats } from '../src/cat-collection.js';
const words = Array.from({ length: 8 }, (_, i) => ({ cells: Array.from({ length: 8 }, (_, j) => i * 8 + j) }));
const cats = Array.from({ length: 64 }, (_, i) => 'cat-' + i);
let seed = 1;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

test('every owned cat gets a distinct random cell; full collection fills every letter', () => {
  for (const count of [0, 1, 7, 39, 63, 64]) {
    const state = syncCats(words, cats.slice(0, count), null, [], random);
    assert.equal(state.plan.length, count);
    assert.equal(state.placed.length, 0);
    words.forEach((w, i) => revealCat(state, i, w.cells));
    assert.equal(state.placed.length, count);
    assert.equal(new Set(state.placed.map(x => x[0])).size, count);
    assert.equal(new Set(state.placed.map(x => x[1])).size, count);
    words.forEach((w, i) => revealCat(state, i, w.cells));
    assert.equal(state.placed.length, count);
  }
  const full = syncCats(words, cats, null, [], random);
  revealCat(full, 0, words[0].cells);
  assert.equal(full.placed.length, 8);
});
test('new boards randomize while reload preserves hidden and revealed placements', () => {
  const first = syncCats(words, cats, null, [], random);
  const next = planCats(words, cats, random);
  assert.notDeepEqual(first.plan, next);
  revealCat(first, 2, words[2].cells);
  const restored = syncCats(words, cats, JSON.parse(JSON.stringify(first)), [2], random);
  assert.deepEqual(new Map(restored.plan.map(([, cell, id]) => [cell,id])), new Map(first.plan.map(([,cell,id])=>[cell,id])));
  assert.deepEqual(restored.placed, first.placed);
});
test('legacy saves and mid-board purchases retain visible cats and reach the new total', () => {
  const legacy = { plan: [[1, cats[0]]], placed: [[8, cats[0]]] };
  const state = syncCats(words, cats.slice(0, 5), legacy, [1], random);
  assert.deepEqual(state.placed[0], [8, cats[0]]);
  assert.equal(state.plan.length, 5);
  const expanded = syncCats(words, cats, state, [1], random);
  assert.equal(expanded.plan.length, 64);
  assert.equal(expanded.placed.length, 8);
  assert.ok(expanded.placed.some(([cell,id])=>cell===8&&id===cats[0]));
  words.forEach((w,i)=>revealCat(expanded,i,w.cells));
  assert.equal(expanded.placed.length,64);
});
test('kids board capacity, duplicate inventory, and no cats', () => {
  const small = words.slice(0,3).concat([{cells:[24]}]);
  assert.equal(planCats(small,cats,random).length,25);
  assert.equal(planCats(words,[cats[0],cats[0]],random).length,1);
  assert.deepEqual(planCats(words,[],random),[]);
});
