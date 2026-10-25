import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plural } from '../src/celebrate.js';

test('plural picks the Russian form for a number', () => {
  const f = (n) => plural(n, 'слово', 'слова', 'слов');
  assert.equal(f(1), 'слово');
  assert.equal(f(3), 'слова');
  assert.equal(f(5), 'слов');
  assert.equal(f(11), 'слов');
  assert.equal(f(12), 'слов');
  assert.equal(f(21), 'слово');
  assert.equal(f(22), 'слова');
});
