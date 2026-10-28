import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES, phraseCells, litCount } from '../src/loader.js';

test('loader phrase reads ФИЛВОРД БЕЗ РЕКЛАМЫ! and fits the 8x8 board', () => {
  assert.deepEqual(LINES.map(([, , text]) => text), ['ФИЛВОРД', 'БЕЗ', 'РЕКЛАМЫ!']);
  for (const [row, col, text] of LINES) {
    assert.ok(row >= 0 && row < 8 && col >= 0 && col + text.length <= 8, text);
  }
  const cells = phraseCells(8).map((l) => l.cell);
  assert.equal(new Set(cells).size, cells.length, 'no two letters share a cell');
  assert.equal(phraseCells(8).map((l) => l.ch).join(''), 'ФИЛВОРДБЕЗРЕКЛАМЫ!');
});

test('letters light up in step with the download', () => {
  assert.equal(litCount(0, 18), 0);
  assert.equal(litCount(0.5, 18), 9);
  assert.equal(litCount(1, 18), 18);
  assert.equal(litCount(1.3, 18), 18, 'never more than the phrase');
});
