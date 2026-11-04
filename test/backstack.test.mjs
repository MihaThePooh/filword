import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opened, closed, onBack, openLayers } from '../src/backstack.js';

test('Back closes the top layer only, tap-closed layers leave the list', () => {
  const shut = [];
  opened('menu', () => shut.push('menu'));
  closed('menu'); // menu -> shop in one go
  opened('shop', () => shut.push('shop'));
  opened('card', () => shut.push('card'));
  assert.deepEqual(openLayers(), ['shop', 'card']);
  onBack();
  assert.deepEqual(shut, ['card']);
  assert.deepEqual(openLayers(), ['shop']);
  closed('shop');
  assert.deepEqual(openLayers(), []);
  onBack(); // nothing open: nothing to close, no error
  assert.deepEqual(shut, ['card']);
});

test('opening the same layer twice keeps one entry, on top', () => {
  opened('a', () => {});
  opened('b', () => {});
  opened('a', () => {});
  assert.deepEqual(openLayers(), ['b', 'a']);
  closed('a'); closed('b');
});
