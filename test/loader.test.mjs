import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES, phraseCells, litCount, overall, STAGES } from '../src/loader.js';

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

test('the last letter waits for the real end', () => {
  assert.equal(litCount(0.99, 18), 17);
  assert.equal(litCount(0.999, 18), 17);
});

test('overall: each stage owns its share, stalls hold the letters', () => {
  assert.equal(overall({}), 0);
  assert.equal(overall({ download: 1, prepare: 1, save: 1 }), 1);
  // downloaded, but the save from the server still on its way
  assert.equal(overall({ download: 1, prepare: 1 }), 1 - STAGES.save);
  assert.ok(litCount(overall({ download: 1, prepare: 1 }), 18) < 18);
  // junk values are clamped
  assert.equal(overall({ download: 3, prepare: -1, save: 0 }), STAGES.download);
});
