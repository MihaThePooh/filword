import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, starsFor, evaluate, achievementRows } from '../src/achievements.js';

const marathon = ACHIEVEMENTS.find((a) => a.id === 'marathon');

test('catalog: three rising goals and three coin tiers each', () => {
  for (const a of ACHIEVEMENTS) {
    assert.equal(a.stars.length, 3, a.id);
    assert.equal(a.coins.length, 3, a.id);
    assert.ok(a.stars[0] < a.stars[1] && a.stars[1] < a.stars[2], a.id);
    assert.ok(a.about && a.goal, a.id);
  }
});

test('goals and prices as agreed on 02.11.2026', () => {
  const by = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
  assert.deepEqual([by.marathon.stars, by.marathon.coins], [[100, 350, 1000], [300, 500, 1000]]);
  assert.deepEqual([by.hunter.stars, by.hunter.coins], [[15, 17, 20], [200, 300, 500]]);
  assert.deepEqual(by.clean.coins, [50, 250, 700]);
  assert.deepEqual([by.rich.stars, by.rich.coins], [[1000, 5000, 15000], [50, 500, 1000]]);
  assert.deepEqual([by.collector.stars, by.collector.coins], [[3, 10, 30], [100, 300, 1000]]);
  assert.deepEqual([by.veteran.stars, by.veteran.coins], [[1, 5, 30], [1000, 5000, 30000]]);
});

test('starsFor counts reached thresholds', () => {
  assert.equal(starsFor(marathon, { solved: 0 }), 0);
  assert.equal(starsFor(marathon, { solved: 100 }), 1);
  assert.equal(starsFor(marathon, { solved: 400 }), 2);
  assert.equal(starsFor(marathon, { solved: 1000 }), 3);
});

test('evaluate pays once and records coins paid', () => {
  const s0 = { coins: 0, solved: 100 };
  const r1 = evaluate(s0);
  assert.equal(r1.awarded.length, 1);
  assert.equal(r1.stats.coins, 300);
  assert.equal(r1.stats.awardCoins.marathon, 300);
  assert.equal(s0.coins, 0); // input untouched
  const r2 = evaluate(r1.stats);
  assert.equal(r2.awarded.length, 0);
  assert.equal(r2.stats, r1.stats);
});

test('several stars at once are paid together', () => {
  const r = evaluate({ coins: 0, solved: 1000 });
  assert.equal(r.stats.coins, 300 + 500 + 1000);
});

test('old stars-paid saves: the difference is topped up, nothing taken back', () => {
  // Paid under the first catalogue: hunter 1 star = 50, marathon 1 star = 50.
  const s = { coins: 0, maxWords: 16, solved: 22, awards: { hunter: 1, marathon: 1 } };
  const r = evaluate(s);
  // hunter star 1 is worth 200 now -> +150; marathon (22 < 100) owes nothing.
  assert.equal(r.stats.coins, 150);
  assert.equal(r.stats.awardCoins.hunter, 200);
  assert.equal(r.stats.awardCoins.marathon, 50);
  // reaching 100 boards later pays 300 - 50 already paid
  const r2 = evaluate({ ...r.stats, solved: 100 });
  assert.equal(r2.stats.coins - r.stats.coins, 250);
});

test('collector reads the shop, rich reads coins earned, veteran reads shuffles', () => {
  const r = evaluate({ coins: 0, coinsEarned: 1000, shuffles: 1,
    shop: { owned: ['roses', 'rug', 'chintz'], active: null } });
  assert.equal(r.stats.awardCoins.collector, 100);
  assert.equal(r.stats.awardCoins.rich, 50);
  assert.equal(r.stats.awardCoins.veteran, 1000);
});

test('achievementRows: progress text with the right word form, bar, goals', () => {
  const m = achievementRows({ solved: 22 }).find((r) => r.id === 'marathon');
  assert.equal(m.stars, 0);
  assert.equal(m.pct, 22);
  assert.equal(m.progress, '22 / 100 полей');
  assert.deepEqual(m.goals, ['100 полей', '350 полей', '1000 полей']);
  const v = achievementRows({}).find((r) => r.id === 'veteran');
  assert.deepEqual(v.goals, ['1 шафл', '5 шафлов', '30 шафлов']);
  const c = achievementRows({}).find((r) => r.id === 'collector');
  assert.equal(c.goals[0], '3 фона');
  const done = achievementRows({ solved: 5000 }).find((r) => r.id === 'marathon');
  assert.equal(done.pct, 100);
  assert.equal(done.progress, 'Все три звезды собраны');
});
