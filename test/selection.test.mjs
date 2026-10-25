import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startSelection, extendSelection, matchWord } from '../src/selection.js';

// 3x3 grid:
// 0 1 2
// 3 4 5
// 6 7 8
const none = new Set();

test('start: free cell picks, taken cell does not', () => {
  assert.deepEqual(startSelection(4, none), [4]);
  assert.deepEqual(startSelection(4, new Set([4])), []);
});

test('extend: neighbours only, no diagonals, no repeats', () => {
  assert.deepEqual(extendSelection([0], 1, 3, none), [0, 1]);
  assert.deepEqual(extendSelection([0], 4, 3, none), [0], 'diagonal');
  assert.deepEqual(extendSelection([0], 2, 3, none), [0], 'jump');
  assert.deepEqual(extendSelection([0, 1, 4, 3], 0, 3, none), [0, 1, 4, 3], 'already picked');
  assert.deepEqual(extendSelection([0], 1, 3, new Set([1])), [0], 'taken');
});

test('extend: sliding back un-picks the last cell', () => {
  assert.deepEqual(extendSelection([0, 1, 2], 1, 3, none), [0, 1]);
});

test('extend: row wrap is not adjacency', () => {
  assert.deepEqual(extendSelection([2], 3, 3, none), [2]);
});

test('matchWord: exact cells in order, skips found words', () => {
  const words = [{ cells: [0, 1, 2] }, { cells: [5, 4, 3] }];
  assert.equal(matchWord([0, 1, 2], words, none), 0);
  assert.equal(matchWord([3, 4, 5], words, none), -1, 'reversed');
  assert.equal(matchWord([5, 4, 3], words, new Set([1])), -1, 'already found');
});
