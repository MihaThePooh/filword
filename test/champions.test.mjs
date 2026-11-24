import {test} from 'node:test';
import assert from 'node:assert/strict';
import {equipPrize,equippedCats,replacePlannedCat} from '../src/champions.js';
import {mergeChampions} from '../src/cloud.js';
import {skinsOf,CAT_ROSTER} from '../src/skins.js';
const regular=CAT_ROSTER.map(c=>c.id);
test('full collection remains owned and one selected cat is replaced',()=>{
 const stats={skins:{owned:regular,active:'cats'},champions:{owned:['prize-bronze'],credit:10000}};
 assert.equal(equipPrize(stats,regular,'prize-bronze'),null);
 const next=equipPrize(stats,regular,'prize-bronze',regular[7]);
 assert.equal(equippedCats(next,regular).length,64);
 assert.equal(equippedCats(next,regular)[7],'prize-bronze');
 assert.equal(skinsOf(next).owned.length,64);
 assert.equal(equippedCats(stats,regular)[7],regular[7]);
 const plan={version:2,plan:[[0,1,regular[7]],[1,2,regular[8]]],placed:[[1,regular[7]]]};
 const changed=replacePlannedCat(plan,regular[7],'prize-bronze');
 assert.deepEqual(changed.plan,[[0,1,'prize-bronze'],[1,2,regular[8]]]);
 assert.deepEqual(changed.placed,[[1,'prize-bronze']]);
 assert.equal(plan.placed[0][1],regular[7]);
});
test('kids roster respects capacity and does not destroy ownership',()=>{
 const stats={skins:{owned:regular},champions:{owned:['prize-gold']}};
 const next=equipPrize(stats,regular,'prize-gold',regular[0],25);
 assert.equal(equippedCats(next,regular,25).length,25);
 assert.equal(skinsOf(next).owned.length,64);
});
test('server receipt credits delta once and preserves in-flight local spending',()=>{
 const award={credit:55000,owned:['prize-bronze','prize-silver','prize-gold']};
 const stats={coins:17,coinsSpent:20,champions:{credit:10000,owned:['prize-bronze']}};
 const result=mergeChampions(stats,award);
 assert.equal(result.coins,45017);assert.equal(result.coinsSpent,20);
 assert.deepEqual(mergeChampions(result,award),result);
});

test('prize cats cannot be bought through the ordinary shop',async()=>{
 const {buySkin}=await import('../src/skins.js');
 assert.equal(buySkin({coins:999999},'prize-gold'),null);
});

test('championship cats never count toward buying all 64 regular cats',()=>{
 assert.equal(skinsOf({skins:{owned:[...regular.slice(0,63),'prize-gold']}}).owned.length,63);
});
