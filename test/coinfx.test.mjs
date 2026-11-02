import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollStep, rollRate, shares } from '../src/coinfx.js';

test('a small sum runs one coin at a time, readable', () => {
  // 100 -> 105 at 15 numbers a second: one frame of 16 ms moves nothing yet
  let r = rollStep(100, 105, 16);
  assert.equal(r.shown, 100);
  // but the fraction is kept: ~67 ms later the counter shows 101
  for (let i = 0; i < 4; i++) r = rollStep(r.shown, 105, 16, r.carry);
  assert.equal(r.shown, 101);
});

test('the run never overshoots and ends exactly on the target', () => {
  let r = { shown: 0, carry: 0 };
  let frames = 0;
  while (r.shown !== 1000 && frames < 1000) { r = rollStep(r.shown, 1000, 16, r.carry); frames++; }
  assert.equal(r.shown, 1000);
  // +1000 finishes within ~2.5 s of frames
  assert.ok(frames * 16 < 2500, `${frames} frames`);
});

test('the counter can run down too', () => {
  const r = rollStep(50, 40, 1000);
  assert.equal(r.shown, 40);
});

test('rollRate has a floor for small sums', () => {
  assert.equal(rollRate(1), 15);
  assert.equal(rollRate(500), 1500);
});

test('shares split coins over flights without losing any', () => {
  assert.deepEqual(shares(5, 5), [1, 1, 1, 1, 1]);
  const s = shares(500, 8);
  assert.equal(s.reduce((a, b) => a + b, 0), 500);
  assert.equal(s.length, 8);
});
