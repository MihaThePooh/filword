import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, starsFor, evaluate, achievementRows } from '../src/achievements.js';

const marathon = ACHIEVEMENTS.find((a) => a.id === 'marathon');

test('catalog: three stars and three coin tiers each', () => {
  for (const a of ACHIEVEMENTS) {
    assert.equal(a.stars.length, 3, a.id);
    assert.equal(a.coins.length, 3, a.id);
    assert.ok(a.stars[0] < a.stars[1] && a.stars[1] < a.stars[2], a.id);
  }
});

test('starsFor counts reached thresholds', () => {
  assert.equal(starsFor(marathon, { solved: 0 }), 0);
  assert.equal(starsFor(marathon, { solved: 10 }), 1);
  assert.equal(starsFor(marathon, { solved: 60 }), 2);
  assert.equal(starsFor(marathon, { solved: 200 }), 3);
});

test('evaluate pays coins once per star and records it', () => {
  const s0 = { coins: 0, solved: 10 };
  const r1 = evaluate(s0);
  assert.equal(r1.awarded.length, 1);
  assert.equal(r1.stats.coins, 50); // marathon 1 star
  assert.equal(r1.stats.awards.marathon, 1);
  // input untouched
  assert.equal(s0.coins, 0);
  // running again pays nothing
  const r2 = evaluate(r1.stats);
  assert.equal(r2.awarded.length, 0);
  assert.equal(r2.stats, r1.stats);
});

test('evaluate pays several new stars at once', () => {
  const r = evaluate({ coins: 0, solved: 200 });
  assert.equal(r.stats.awards.marathon, 3);
  assert.equal(r.stats.coins, 50 + 100 + 150);
});

test('collector reads the shop, rich reads max coins', () => {
  const r = evaluate({ coins: 0, maxCoins: 1000,
    shop: { owned: ['roses', 'rug', 'chintz'], active: null } });
  // collector 3 owned -> 1 star (100), rich 1000 -> 1 star (50)
  assert.equal(r.stats.awards.collector, 1);
  assert.equal(r.stats.awards.rich, 1);
  assert.equal(r.stats.coins, 150);
});

test('achievementRows shows stars, value and next goal', () => {
  const rows = achievementRows({ solved: 12 });
  const m = rows.find((r) => r.name === 'Марафонец');
  assert.equal(m.stars, 1);
  assert.equal(m.value, 12);
  assert.equal(m.next, 50);
  // a fully done one reports next === null
  const done = achievementRows({ solved: 200 }).find((r) => r.name === 'Марафонец');
  assert.equal(done.next, null);
});
