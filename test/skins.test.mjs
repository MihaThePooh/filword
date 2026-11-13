import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buySkin, wearSkin, skinsOf, keepSkins, trySkin, CAT_ROSTER, CELL_SKINS, shuffleCats, catMarkup } from '../src/skins.js';
import { buy } from '../src/shop.js';
test('each of 64 cats costs 500; buying one preserves wallpaper and does not grant other cats',()=>{
 assert.equal(CELL_SKINS.length,64);assert.ok(CELL_SKINS.every(c=>c.price===500));
 const original={coins:1500,solved:12,shop:{owned:['roses'],active:'roses'}};
 const a=buySkin(original,'c01');assert.equal(a.coins,1000);assert.deepEqual(a.skins.owned,['c01']);assert.deepEqual(a.shop,original.shop);assert.equal(original.coins,1500);
 const b=buySkin(a,'c02');assert.equal(b.coins,500);assert.deepEqual(b.skins.owned,['c01','c02']);assert.equal(buySkin(b,'c01'),null);
 assert.equal(buySkin({coins:499},'c01'),null);assert.equal(buySkin(original,'junk'),null);assert.equal(trySkin({coins:450},'c01').short,50);
 assert.deepEqual(buy(b,'rug'),null);
});
test('classic cells are free and do not remove purchased cats',()=>{
 const a=buySkin({coins:500},'c01'),classic=wearSkin(a,null);
 assert.equal(classic.coins,0);assert.deepEqual(skinsOf(classic),{owned:['c01'],active:null});
 assert.equal(wearSkin(classic,'c01').skins.active,'cats');assert.equal(wearSkin(classic,'c02'),classic);
});
test('sync keeps purchased cats; legacy preview bundle remains compatible',()=>{
 const a=buySkin({coins:500},'c01'),remote={coins:50,solved:10};
 assert.deepEqual(keepSkins(remote,a).skins,{owned:['c01'],active:null});
 assert.equal(skinsOf({skins:{owned:['ginger-cats'],active:'ginger-cats'}}).owned.length,64);
});
test('full roster shuffles uniquely; owned subset repeats only bought cats',()=>{
 assert.equal(new Set(CAT_ROSTER.map(c=>c.id)).size,64);
 const full=shuffleCats(64,()=>.314159);assert.deepEqual([...full].sort((a,b)=>a-b),Array.from({length:64},(_,i)=>i));
 const partial=shuffleCats(64,()=>.314159,[1,5]);assert.deepEqual(new Set(partial),new Set([1,5]));assert.equal(partial.filter(i=>i===1).length,32);
 assert.equal(new Set(shuffleCats(25)).size,25);
 for(let i=0;i<64;i++){assert.ok(catMarkup(i).includes(`data-cat="${CAT_ROSTER[i].id}"`));for(const k of ['x','y','w','h'])assert.ok(CAT_ROSTER[i].disc[k]>0);}
});


test('shop separates related base portraits horizontally and vertically', async () => {
  const {catShopOrder, CAT_ROSTER} = await import('../src/skins.js');
  const order = catShopOrder();
  assert.equal(new Set(order).size,64);
  assert.deepEqual(catShopOrder(),order);
  order.forEach((index,slot) => {
    if (CAT_ROSTER[index].src) return;
    for (const neighbour of [slot+1,slot+2]) {
      if (neighbour < order.length) assert.ok(CAT_ROSTER[order[neighbour]].src);
    }
  });
});
