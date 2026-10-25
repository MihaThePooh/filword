import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyHint, nextHint, hintedCells, hintsLeft, MAX_HINT_WORDS,
} from '../src/hint.js';

const words = [{ cells: [0, 1, 2] }, { cells: [3, 4, 5, 6] }, { cells: [7, 8, 9] },
  { cells: [10, 11, 12] }, { cells: [13, 14, 15] }];
const first = () => 0; // rng that always picks the first free word

test('letters open one by one, last letter completes the word', () => {
  const found = new Set();
  let { hint, completed } = nextHint(emptyHint(), words, found, first);
  assert.deepEqual(hintedCells(hint, words, found), [0]);
  assert.equal(completed, -1);
  ({ hint, completed } = nextHint(hint, words, found, first));
  assert.deepEqual(hintedCells(hint, words, found), [0, 1]);
  ({ hint, completed } = nextHint(hint, words, found, first));
  assert.equal(completed, 0);
});

test('found words are never picked, a word found by hand ends its hint', () => {
  const found = new Set([0]);
  let { hint } = nextHint(emptyHint(), words, found, first);
  assert.equal(hint.words[0], 1);
  found.add(1); // player found it himself
  assert.deepEqual(hintedCells(hint, words, found), []);
  ({ hint } = nextHint(hint, words, found, first));
  assert.equal(hint.words[1], 2, 'next press starts a new word');
});

test('no more than MAX_HINT_WORDS words per board', () => {
  const found = new Set();
  let hint = emptyHint();
  for (let w = 0; w < MAX_HINT_WORDS; w++) {
    let completed = -1;
    while (completed < 0) ({ hint, completed } = nextHint(hint, words, found, first));
    found.add(completed);
  }
  assert.equal(hintsLeft(hint, found), 0);
  const after = nextHint(hint, words, found, first);
  assert.equal(after.hint, hint);
  assert.equal(after.completed, -1);
});

test('hintsLeft counts the word in progress', () => {
  const found = new Set();
  assert.equal(hintsLeft(emptyHint(), found), 3);
  const { hint } = nextHint(emptyHint(), words, found, first);
  assert.equal(hintsLeft(hint, found), 3, 'current word still has letters');
  found.add(0);
  assert.equal(hintsLeft(hint, found), 2);
});
