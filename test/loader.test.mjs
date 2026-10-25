import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LETTERS, WORDS, cellPosition } from '../src/loader.js';

test('loader words spell ФИЛВОРД БЕЗ РЕКЛАМЫ', () => {
  assert.deepEqual(WORDS.map(([a, b]) => LETTERS.slice(a, b)), ['ФИЛВОРД', 'БЕЗ', 'РЕКЛАМЫ']);
  assert.equal(LETTERS.length, 18, 'fills the 6x3 grid');
});

test('loader path is a snake: every step goes to a neighbouring cell', () => {
  for (let i = 1; i < LETTERS.length; i++) {
    const a = cellPosition(i - 1);
    const b = cellPosition(i);
    assert.equal(Math.abs(a.row - b.row) + Math.abs(a.col - b.col), 1, `step ${i}`);
  }
  assert.deepEqual(cellPosition(6), { row: 1, col: 5 });
});
