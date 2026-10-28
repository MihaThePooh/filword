import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRng } from '../src/rng.js';
import { randomPath, neighbours } from '../src/path.js';
import { splitLengths, SplitError } from '../src/split.js';
import {
  indexDictionary, generateBoard, OutOfWordsError, totalWords,
} from '../src/board.js';

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

test('splitLengths respects how many words of each length are left', () => {
  const available = { 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 8, 9: 0, 10: 0 };
  assert.deepEqual(splitLengths(64, createRng(1), { available }), [8, 8, 8, 8, 8, 8, 8, 8]);
  assert.throws(() => splitLengths(64, createRng(1), { available: { 8: 7 } }), SplitError);
});

// Play a small dictionary to the end: no word may ever appear twice.
test('words never repeat across boards until the dictionary is used up', () => {
  const small = indexDictionary(dict.slice(0, 1500));
  const used = new Set();
  let boards = 0;
  for (;;) {
    let board;
    try {
      board = generateBoard(small, { seed: boards + 1, used });
    } catch (err) {
      assert.ok(err instanceof OutOfWordsError, err.message);
      break;
    }
    for (const { word } of board.words) {
      assert.ok(!used.has(word), `repeat: ${word}`);
      used.add(word);
    }
    boards++;
  }
  assert.ok(boards > 100, `only ${boards} boards`);
  // Almost the whole dictionary gets played; a few odd lengths may stay.
  assert.ok(used.size / totalWords(small) > 0.9, `used ${used.size} of ${totalWords(small)}`);
});

test('boards move from common words to rarer ones', () => {
  const used = new Set();
  const rankOf = new Map(dict.map((e) => [e.w, e.r]));
  // Median, not mean: rare "surprise" words would swamp an average.
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const early = [];
  const late = [];
  for (let i = 0; i < 200; i++) {
    const board = generateBoard(index, { seed: i + 1, used });
    board.words.forEach((w) => used.add(w.word));
    if (i < 20) early.push(...board.words.map((w) => rankOf.get(w.word)));
    if (i >= 180) late.push(...board.words.map((w) => rankOf.get(w.word)));
  }
  const first = median(early);
  const last = median(late);
  assert.ok(last > first, `first ${first}, last ${last}`);
});

test('every board has exactly one rare word, all the way through a cycle', () => {
  const rare = new Set(dict.filter((e) => e.x === 1).map((e) => e.w));
  assert.ok(rare.size >= 2000, 'a rare word for every board of the cycle');
  const used = new Set();
  for (let i = 0; i < 2000; i++) {
    const board = generateBoard(index, { seed: 777 + i, used });
    const count = board.words.filter((w) => rare.has(w.word)).length;
    assert.equal(count, 1, `board ${i + 1}: ${count} rare words`);
    for (const w of board.words) used.add(w.word);
  }
});

test('a dictionary without a rare tier still builds boards', () => {
  const plain = indexDictionary(dict.filter((e) => e.x !== 1).map(({ x, ...e }) => e));
  const board = generateBoard(plain, { seed: 5 });
  assert.equal(board.letters.filter(Boolean).length, 64);
});
