import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODES } from '../src/mode.js';
import { phraseCells } from '../src/loader.js';
import { indexDictionary, generateBoard, OutOfWordsError } from '../src/board.js';
import { pack, unpack, progressOf, moreProgress } from '../src/cloud.js';
import { ADULT, kidDefs, buildKids, parseList } from '../scripts/build-kids.mjs';

const kids = JSON.parse(readFileSync(new URL('../data/kids.json', import.meta.url), 'utf8'));

test('kids dictionary: simple nouns with one clean definition, no rare tier', () => {
  assert.ok(kids.length > 1000, `${kids.length} words`);
  for (const e of kids) {
    const len = [...e.w].length;
    assert.ok(len >= 3 && len <= 9, e.w);
    assert.equal(e.d.length, 1, e.w);
    assert.ok(!ADULT.test(e.d[0]), `${e.w}: ${e.d[0]}`);
    assert.equal(e.x, undefined, `${e.w} has no rare mark`);
  }
  assert.equal(new Set(kids.map((e) => e.w)).size, kids.length, 'no duplicates');
});

test('a definition with an adult sense is skipped for the plain one', () => {
  assert.deepEqual(kidDefs(['то же, что секс', 'кондитерское изделие']), ['кондитерское изделие']);
  assert.deepEqual(kidDefs(['белая горячка']), []);
  const main = [{ w: 'кекс', r: 5, d: ['то же, что секс', 'булочка с изюмом'] }, { w: 'белочка', r: 2, d: ['белая горячка'] }];
  const { kept, missing } = buildKids(parseList('# food\nкекс\nбелочка\n'), main);
  assert.deepEqual(kept.map((e) => [e.w, e.d]), [['кекс', ['булочка с изюмом']]]);
  assert.deepEqual(missing, ['белочка']);
});

test('the kids cycle fits in the dictionary on the 5x5 board', () => {
  const index = indexDictionary(kids);
  const used = new Set();
  for (let i = 0; i < MODES.kids.cycle; i++) {
    let board;
    try {
      board = generateBoard(index, { size: 5, seed: 7e6 + i, used });
    } catch (err) {
      if (err instanceof OutOfWordsError) assert.fail(`out of words at board ${i + 1}`);
      throw err;
    }
    assert.equal(board.letters.length, 25);
    for (const w of board.words) used.add(w.word);
  }
});

test('kids loader phrase fits the 5x5 board', () => {
  for (const [row, col, text] of MODES.kids.phrase) {
    assert.ok(row >= 0 && row < 5 && col >= 0 && col + text.length <= 5, text);
  }
  assert.equal(phraseCells(5, MODES.kids.phrase).map((l) => l.ch).join(''), 'ИГРАДЛЯДЕТЕЙ');
});

test('both versions travel in one save and come back apart', () => {
  const main = { solved: 3, used: ['кот'] };
  const kid = { solved: 1, used: ['лужа'] };
  assert.deepEqual(unpack(pack(main, kid)), [main, kid]);
  assert.deepEqual(unpack(pack(main, null)), [main, null]);
  assert.deepEqual(unpack(pack(null, kid)), [null, kid]);
  assert.equal(pack(null, null), null);
  assert.deepEqual(unpack(null), [null, null]);
});

test('kids progress counts when two devices disagree', () => {
  assert.deepEqual(progressOf({ solved: 2, used: ['a'], coins: 5, kids: { solved: 3, used: ['b', 'c'], coins: 1 } }), [5, 3, 6]);
  assert.ok(moreProgress({ solved: 2, kids: { solved: 1 } }, { solved: 2 }));
});
