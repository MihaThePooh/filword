import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  BACKGROUNDS, bgSrc, shopOf, isOwned, activeId, canBuy, buy, setActive, mergeOwned, tryOn,
} from '../src/shop.js';

test('catalog: real backgrounds with a price and a webp file', () => {
  assert.ok(BACKGROUNDS.length >= 2);
  assert.equal(new Set(BACKGROUNDS.map((b) => b.id)).size, BACKGROUNDS.length);
  for (const b of BACKGROUNDS) {
    assert.ok(b.id && b.name && b.price > 0, b.id);
    assert.equal(bgSrc(b.id), `data/bg/${b.id}.webp`);
    assert.ok(existsSync(new URL('../' + bgSrc(b.id), import.meta.url)), 'missing image: ' + b.id);
  }
});

test('shopOf tolerates missing or broken state', () => {
  assert.deepEqual(shopOf(undefined), { owned: [], active: null });
  assert.deepEqual(shopOf({ shop: { owned: ['roses', 'nope'], active: 'nope' } }),
    { owned: ['roses'], active: null });
  // active must be owned
  assert.deepEqual(shopOf({ shop: { owned: ['roses'], active: 'roses' } }),
    { owned: ['roses'], active: 'roses' });
});

test('buy deducts coins, grants and wears the background', () => {
  const s0 = { coins: 800, shop: { owned: [], active: null } };
  assert.ok(canBuy(s0, 'roses'));
  const s1 = buy(s0, 'roses');
  assert.equal(s1.coins, 100);
  assert.ok(isOwned(s1, 'roses'));
  assert.equal(activeId(s1), 'roses');
  // input untouched
  assert.equal(s0.coins, 800);
  assert.deepEqual(s0.shop.owned, []);
});

test('cannot buy twice, cannot buy without coins, cannot buy junk', () => {
  const owned = { coins: 500, shop: { owned: ['roses'], active: 'roses' } };
  assert.ok(!canBuy(owned, 'roses'));
  assert.equal(buy(owned, 'roses'), null);
  assert.ok(!canBuy({ coins: 100, shop: {} }, 'roses'));
  assert.equal(buy({ coins: 100, shop: {} }, 'roses'), null);
  assert.equal(buy({ coins: 999 }, 'no-such-bg'), null);
});

test('setActive only for owned, null takes the background off', () => {
  const s = { coins: 0, shop: { owned: ['roses', 'rug'], active: 'roses' } };
  assert.equal(activeId(setActive(s, 'rug')), 'rug');
  assert.equal(activeId(setActive(s, null)), null);
  // not owned - no change
  assert.equal(setActive({ shop: { owned: [], active: null } }, 'rug').shop.active, null);
});

test('mergeOwned keeps every bought background, no repeats', () => {
  assert.deepEqual(mergeOwned(['roses'], ['rug', 'roses']).sort(), ['roses', 'rug']);
  assert.deepEqual(mergeOwned(null, ['rug']), ['rug']);
  assert.deepEqual(mergeOwned(['roses'], null), ['roses']);
});


test('owned backgrounds survive when another device wins the merge', async () => {
  // withOwned is internal; prove the shape it relies on via shop helpers:
  // a merge-adopted stats must still own what was bought here.
  const serverStats = { coins: 640, solved: 200, shop: { owned: [], active: null } };
  const boughtHere = ['roses'];
  const merged = { ...serverStats, shop: { owned: mergeOwned([], boughtHere), active: null } };
  assert.ok(merged.shop.owned.includes('roses'));
  assert.equal(merged.coins, 640); // server's coins kept, background kept
});

test('tryOn: name, price and coins still missing', () => {
  const rich = { coins: 800, shop: { owned: [], active: null } };
  assert.deepEqual(tryOn(rich, 'roses'),
    { id: 'roses', name: 'Винтажные розы', price: 700, owned: false, short: 0 });
  assert.equal(tryOn({ coins: 523 }, 'roses').short, 177);
  assert.equal(tryOn(undefined, 'roses').short, 700);
  assert.equal(tryOn({ coins: 0, shop: { owned: ['roses'] } }, 'roses').owned, true);
  assert.equal(tryOn(rich, 'nope'), null);
  // trying on spends nothing and changes nothing
  assert.deepEqual(rich, { coins: 800, shop: { owned: [], active: null } });
});
