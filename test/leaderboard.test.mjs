import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankingRows,ageLabel} from '../src/leaderboard.js';
test('top five, neighbours and self deduplicate and show gaps only where needed',()=>{
 const rows=[1,2,3,4,5,41,42,43].map(rank=>({rank}));
 assert.deepEqual(rankingRows(rows,100).map(r=>r.gap?'…':r.rank),[1,2,3,4,5,'…',41,42,43,'…']);
 assert.deepEqual(rankingRows([1,2,3,4,5,5,6,7].map(rank=>({rank})),7).map(r=>r.rank),[1,2,3,4,5,6,7]);
 assert.deepEqual(rankingRows([],0),[]);
});
test('age never turns the first observed legacy save into a fabricated start date',()=>{
 assert.equal(ageLabel({start_known:false,tracked_since:'2026-11-24T00:00:00Z'}),'Начало игры неизвестно');
 assert.equal(ageLabel({start_known:true,tracked_since:'2026-11-23T00:00:00Z'},Date.parse('2026-11-24T00:00:00Z')),'В игре 2 дня · с 23 ноября 2026 года');
});
