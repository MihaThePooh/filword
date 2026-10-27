import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plural, waveDelay } from '../src/celebrate.js';

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

test('ripple starts at the drop cell and reaches far cells later', () => {
  assert.equal(waveDelay(27, 8, 27), 0);
  const near = waveDelay(28, 8, 27);
  const far = waveDelay(63, 8, 27);
  assert.ok(near > 0 && far > near);
  assert.equal(waveDelay(26, 8, 27), near, 'a ring: same distance, same moment');
});
