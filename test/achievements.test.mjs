import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, starsFor, evaluate, achievementRows, mergeAwards } from '../src/achievements.js';

const marathon = ACHIEVEMENTS.find((a) => a.id === 'marathon');

test('catalog: three rising goals and three coin tiers each', () => {
  for (const a of ACHIEVEMENTS) {
    assert.equal(a.stars.length, 3, a.id);
    assert.equal(a.coins.length, 3, a.id);
    // «at least» goals rise, «at most» (time) goals fall
    const [x, y, z] = a.less ? [...a.stars].reverse() : a.stars;
    assert.ok(x < y && y < z, a.id);
    assert.ok(a.about && a.goal, a.id);
  }
});

test('goals and prices as agreed on 02.11.2026 (second round)', () => {
  const by = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
  assert.deepEqual([by.marathon.stars, by.marathon.coins], [[100, 350, 1000], [300, 500, 1000]]);
  assert.deepEqual([by.hunter.stars, by.hunter.coins], [[25, 30, 35], [200, 300, 500]]);
  assert.deepEqual([by.clean.stars, by.clean.coins], [[10, 150, 500], [100, 300, 1000]]);
  assert.deepEqual([by.rich.stars, by.rich.coins], [[5000, 15000, 30000], [300, 700, 1000]]);
  assert.deepEqual([by.bonus.stars, by.bonus.coins], [[100, 350, 1000], [300, 700, 1500]]);
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
  const s = { coins: 0, maxWords: 26, solved: 22, awards: { hunter: 1, marathon: 1 } };
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
  const r = evaluate({ coins: 0, coinsEarned: 5000, shuffles: 1,
    shop: { owned: ['roses', 'rug', 'chintz'], active: null } });
  assert.equal(r.stats.awardCoins.collector, 100);
  assert.equal(r.stats.awardCoins.rich, 300);
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

test('Молния: the faster clean board, the more stars; no record - no star', () => {
  const l = ACHIEVEMENTS.find((a) => a.id === 'lightning');
  assert.equal(starsFor(l, {}), 0);
  assert.equal(starsFor(l, { fastestClean: 400000 }), 0); // 6:40
  assert.equal(starsFor(l, { fastestClean: 200000 }), 1); // 3:20
  assert.equal(starsFor(l, { fastestClean: 100000 }), 2); // 1:40
  assert.equal(starsFor(l, { fastestClean: 80000 }), 3); // 1:20
  const row = achievementRows({ fastestClean: 200000 }).find((r) => r.id === 'lightning');
  assert.equal(row.progress, 'Лучшее: 3:20 · цель 3:00');
  assert.equal(row.pct, 90);
  assert.equal(row.goals[2], 'поле за 1:30 без подсказок');
  const none = achievementRows({}).find((r) => r.id === 'lightning');
  assert.equal(none.pct, 0);
});

test('Усидчивый counts hours on the boards', () => {
  const rows = achievementRows({ totalMs: 2 * 3600000 });
  const p = rows.find((r) => r.id === 'patient');
  assert.equal(p.stars, 1);
  assert.equal(p.progress, '2 ч 00 мин / 10 часов на полях');
  assert.deepEqual(p.goals, ['1 час на полях', '10 часов на полях', '50 часов на полях']);
});

test('awarded tells the stars before and after', () => {
  const r = evaluate({ coins: 0, solved: 400 });
  const m = r.awarded.find((x) => x.id === 'marathon');
  assert.deepEqual([m.from, m.star, m.coins], [0, 2, 800]);
  const r2 = evaluate({ ...r.stats, solved: 1000 });
  const m2 = r2.awarded.find((x) => x.id === 'marathon');
  assert.deepEqual([m2.from, m2.star, m2.coins], [2, 3, 1000]);
});

test('mergeAwards joins passes of one achievement', () => {
  const m = mergeAwards([
    { id: 'rich', name: 'Богач', from: 0, star: 1, coins: 50 },
    { id: 'hunter', name: 'Охотник', from: 0, star: 3, coins: 1000 },
    { id: 'rich', name: 'Богач', from: 1, star: 2, coins: 500 },
  ]);
  assert.equal(m.length, 2);
  assert.deepEqual(m[0], { id: 'rich', name: 'Богач', from: 0, star: 2, coins: 550 });
});

test('erudite: 100/500/1000 definitions for 300/700/1500', () => {
  const by = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
  assert.deepEqual([by.erudite.stars, by.erudite.coins], [[100, 500, 1000], [300, 700, 1500]]);
  assert.equal(evaluate({ coins: 0, defsOpened: 99 }).awarded.length, 0);
  assert.equal(evaluate({ coins: 0, defsOpened: 100 }).stats.coins, 300);
});

test('Снайпер: boards without bonus words, 1/3/7 for 300/500/700', () => {
  const a = ACHIEVEMENTS.find((x) => x.id === 'sniper');
  assert.deepEqual([a.stars, a.coins], [[1, 3, 7], [300, 500, 700]]);
  assert.equal(starsFor(a, {}), 0);
  assert.equal(starsFor(a, { sniperBoards: 3 }), 2);
  const { stats, awarded } = evaluate({ coins: 0, sniperBoards: 7 });
  const got = awarded.find((x) => x.id === 'sniper');
  assert.equal(got.coins, 1500);
  assert.ok(stats.coins >= 1500);
});
