import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, moreProgress } from '../src/cloud.js';

const ME = 'me-1';
const st = (solved, used = 0) => ({ solved, used: Array(used).fill('w'), coins: 0 });
const save = (version, solved) => ({ state: { b: 1 }, stats: st(solved), version });

test('more progress: boards first, then words', () => {
  assert.equal(moreProgress(st(5), st(4, 900)), true);
  assert.equal(moreProgress(st(5, 10), st(5, 9)), true);
  assert.equal(moreProgress(st(5, 9), st(5, 9)), false);
  assert.equal(moreProgress(undefined, st(0)), false);
});

test('first sign-in on a device with old progress, server empty: upload it', () => {
  assert.deepEqual(decide({ state: {}, stats: st(30) }, { save: null, owner: ME }), { act: 'push', version: 0 });
});

test('new device, nothing local: take the server save', () => {
  assert.deepEqual(decide({}, { save: save(4, 30), owner: ME }), { act: 'adopt' });
});

test('nothing anywhere: nothing to do', () => {
  assert.deepEqual(decide({}, { save: null, owner: ME }), { act: 'none' });
});

test('first sign-in with progress on both sides: the further one wins', () => {
  assert.deepEqual(decide({ stats: st(10) }, { save: save(3, 30), owner: ME }), { act: 'adopt' });
  assert.deepEqual(decide({ stats: st(40) }, { save: save(3, 30), owner: ME }), { act: 'push', version: 3 });
});

test('in sync: clean - nothing, dirty - push on the same version', () => {
  const local = { owner: ME, version: 4, stats: st(30) };
  assert.deepEqual(decide(local, { save: save(4, 30), owner: ME }), { act: 'none' });
  assert.deepEqual(decide({ ...local, dirty: true }, { save: save(4, 30), owner: ME }), { act: 'push', version: 4 });
});

test('other device saved, this one did not play: take the newer save', () => {
  assert.deepEqual(decide({ owner: ME, version: 4, stats: st(30) }, { save: save(6, 31), owner: ME }), { act: 'adopt' });
});

test('both devices played offline: the further one wins', () => {
  const local = { owner: ME, version: 4, dirty: true, stats: st(35) };
  assert.deepEqual(decide(local, { save: save(6, 31), owner: ME }), { act: 'push', version: 6 });
  assert.deepEqual(decide({ ...local, stats: st(31) }, { save: save(6, 33), owner: ME }), { act: 'adopt' });
});

test("someone else's copy on this device is never uploaded to my account", () => {
  const theirs = { owner: 'other', version: 9, dirty: true, stats: st(99) };
  assert.deepEqual(decide(theirs, { save: save(2, 5), owner: ME }), { act: 'adopt' });
  assert.deepEqual(decide(theirs, { save: null, owner: ME }), { act: 'fresh' });
});
