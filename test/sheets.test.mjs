import { test } from 'node:test';
import assert from 'node:assert/strict';
import { show, hide, toggle } from '../src/sheets.js';

// A stand-in for an overlay without a draggable child panel.
function fakeEl(hidden = true) {
  const cls = new Set();
  return {
    hidden,
    querySelector: () => null,
    classList: {
      add: (c) => cls.add(c),
      remove: (c) => cls.delete(c),
      contains: (c) => cls.has(c),
    },
  };
}
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

test('show opens at once', () => {
  const el = fakeEl(true);
  show(el);
  assert.equal(el.hidden, false);
});

test('hide plays the leave animation first, then hides', async () => {
  const el = fakeEl(false);
  hide(el);
  assert.equal(el.hidden, false);
  assert.ok(el.classList.contains('closing'));
  await wait(260);
  assert.equal(el.hidden, true);
  assert.ok(!el.classList.contains('closing'));
});

test('show during closing cancels the hide', async () => {
  const el = fakeEl(false);
  hide(el);
  show(el);
  await wait(260);
  assert.equal(el.hidden, false);
  assert.ok(!el.classList.contains('closing'));
});

test('toggle opens a hidden one and closes an open one', async () => {
  const el = fakeEl(true);
  toggle(el);
  assert.equal(el.hidden, false);
  toggle(el);
  await wait(260);
  assert.equal(el.hidden, true);
});
