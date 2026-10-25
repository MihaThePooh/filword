import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffle } from '../src/progress.js';

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
