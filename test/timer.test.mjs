import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, fmtClock, fmtGap, fmtSpan } from '../src/timer.js';

// A clock driven by hand: t is "now" in ms.
function manual() {
  let t = 0;
  const clock = createClock(() => t);
  return { clock, go: (ms) => { t += ms; } };
}

test('runs only between start and pause', () => {
  const { clock, go } = manual();
  go(5000);
  assert.equal(clock.elapsed(), 0); // not started
  clock.start();
  go(3000);
  assert.equal(clock.elapsed(), 3000);
  assert.equal(clock.pause(), 3000);
  go(10000); // hidden - does not count
  assert.equal(clock.elapsed(), 3000);
  clock.start();
  go(2000);
  assert.equal(clock.elapsed(), 5000);
});

test('lap and pause hand out each millisecond exactly once', () => {
  const { clock, go } = manual();
  clock.start();
  go(1000);
  const a = clock.lap();
  go(500);
  const b = clock.pause();
  assert.equal(a + b, 1500);
  assert.equal(clock.pause(), 0); // already paused
  assert.equal(clock.elapsed(), 1500);
});

test('reset restores a saved board time, paused', () => {
  const { clock, go } = manual();
  clock.reset(42000);
  go(1000);
  assert.equal(clock.elapsed(), 42000);
  assert.equal(clock.running(), false);
});

test('formats', () => {
  assert.equal(fmtClock(187000), '3:07');
  assert.equal(fmtClock(3729000), '1:02:09');
  assert.equal(fmtGap(4230), '4,2 с');
  assert.equal(fmtGap(125000), '2:05');
  assert.equal(fmtSpan(45000), '45 с');
  assert.equal(fmtSpan(14 * 60000), '14 мин');
  assert.equal(fmtSpan(185 * 60000), '3 ч 05 мин');
});
