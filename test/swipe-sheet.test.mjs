import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldDismiss } from '../src/swipe-sheet.js';
test('short pulls return, long pulls and deliberate flicks close', () => {
  assert.equal(shouldDismiss(35,0,600),false);
  assert.equal(shouldDismiss(150,0,600),true);
  assert.equal(shouldDismiss(40,.8,600),true);
  assert.equal(shouldDismiss(12,2,600),false);
  assert.equal(shouldDismiss(60,0,120),false);
  assert.equal(shouldDismiss(65,0,120),true);
});
