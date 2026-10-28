import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { shuffle, cycleDone, CYCLE_BOARDS } from '../src/progress.js';

test('shuffle restarts the dictionary and raises the rank', () => {
  const before = { solved: 1700, used: ['кот', 'дом'], coins: 9000 };
  const after = shuffle(before);
  assert.deepEqual(after.used, []);
  assert.equal(after.solved, 0);
  assert.equal(after.shuffles, 1);
  assert.equal(after.totalSolved, 1700);
  assert.equal(after.coins, 9000, 'coins are kept');
  assert.equal(shuffle(after).shuffles, 2);
});

test('a cycle ends after CYCLE_BOARDS boards', () => {
  assert.ok(!cycleDone({ solved: CYCLE_BOARDS - 1 }));
  assert.ok(cycleDone({ solved: CYCLE_BOARDS }));
  assert.ok(!cycleDone({}));
  assert.ok(!cycleDone(shuffle({ solved: CYCLE_BOARDS })), 'a shuffle starts a new cycle');
});

test('the dictionary has words for a whole cycle', async () => {
  const { readFileSync } = await import('node:fs');
  const dict = JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url), 'utf8'));
  // One rare word per board, the rest of the 64 cells - common words.
  const rare = dict.filter((e) => e.x === 1);
  const common = dict.filter((e) => e.x !== 1).reduce((n, e) => n + [...e.w].length, 0);
  assert.ok(rare.length >= CYCLE_BOARDS, `${rare.length} rare words`);
  assert.ok(common >= CYCLE_BOARDS * 56, `${common} common letters`);
});

test('bonus definitions cover rare bonus words, not the main list', () => {
  const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
  const main = new Set(read('words.json').map((e) => e.w));
  const bonus = new Set(read('bonus.json'));
  const defs = read('bonus-defs.json');
  assert.ok(defs['манилла']?.d.length > 0, 'манилла has a definition');
  for (const [w, e] of Object.entries(defs)) {
    assert.ok(bonus.has(w) && !main.has(w), w);
    assert.ok(e.d.length > 0, w);
  }
});
