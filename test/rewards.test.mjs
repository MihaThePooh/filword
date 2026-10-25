import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBonusWord } from '../src/rewards.js';

const bonus = new Set(['просадка', 'кот', 'ток']);

test('isBonusWord: a real word that is not hidden here', () => {
  assert.ok(isBonusWord('просадка', bonus, ['кот'], []));
});

test('isBonusWord: hidden words, repeats and non-words do not count', () => {
  assert.ok(!isBonusWord('кот', bonus, ['кот'], []), 'hidden word');
  assert.ok(!isBonusWord('ток', bonus, ['кот'], ['ток']), 'already counted on this board');
  assert.ok(!isBonusWord('ткр', bonus, [], []), 'not a word');
});
