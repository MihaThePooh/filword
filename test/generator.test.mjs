import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRng } from '../src/rng.js';
import { randomPath, neighbours } from '../src/path.js';
import { splitLengths } from '../src/split.js';
import { indexDictionary, generateBoard } from '../src/board.js';

const dict = JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url), 'utf8'));
const index = indexDictionary(dict);

function assertValidPath(path, size) {
  assert.equal(path.length, size * size);
  assert.equal(new Set(path).size, size * size, 'every cell exactly once');
  for (let i = 1; i < path.length; i++) {
    assert.ok(neighbours(path[i - 1], size).includes(path[i]), `step ${i} is not adjacent`);
  }
}

test('randomPath visits every cell once with adjacent steps', () => {
  for (let seed = 1; seed <= 50; seed++) assertValidPath(randomPath(8, createRng(seed)), 8);
});

test('randomPath actually leaves the zigzag', () => {
  const path = randomPath(8, createRng(7));
  const zigzagStart = [0, 1, 2, 3, 4, 5, 6, 7];
  assert.notDeepEqual(path.slice(0, 8), zigzagStart);
});

test('splitLengths sums to total and keeps 3..10', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const lengths = splitLengths(64, createRng(seed));
    assert.equal(lengths.reduce((a, b) => a + b, 0), 64);
    assert.ok(lengths.every((l) => l >= 3 && l <= 10), lengths.join(','));
  }
});

test('generateBoard: letters match words, cells are not shared', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const board = generateBoard(index, { seed });
    const seen = new Set();
    for (const { word, cells } of board.words) {
      assert.equal(cells.map((c) => board.letters[c]).join(''), word);
      for (const c of cells) {
        assert.ok(!seen.has(c), 'cell used twice');
        seen.add(c);
      }
    }
    assert.equal(seen.size, 64);
    assert.equal(new Set(board.words.map((w) => w.word)).size, board.words.length, 'no repeats');
  }
});

test('generateBoard is reproducible by seed', () => {
  assert.deepEqual(generateBoard(index, { seed: 42 }), generateBoard(index, { seed: 42 }));
  assert.notDeepEqual(generateBoard(index, { seed: 42 }).letters, generateBoard(index, { seed: 43 }).letters);
});
