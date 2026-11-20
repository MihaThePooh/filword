import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headerInk } from '../src/header-contrast.js';

test('header ink accounts for the unchanged white glass on light and dark pictures', () => {
  assert.equal(headerInk([[255,255,255],[240,230,210]]), 'dark');
  assert.equal(headerInk([[0,0,0],[15,10,20]]), 'light');
  assert.equal(headerInk([]), 'dark');
  assert.equal(headerInk(Array.from({length:40},(_,i)=>i%2?[0,0,0]:[255,255,255])), 'dark');
});
