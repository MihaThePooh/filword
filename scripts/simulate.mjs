// Plays the whole dictionary board after board, like a player who finds every
// word, and reports how many boards one cycle gives.
// Usage: node scripts/simulate.mjs [runs] [kids]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { indexDictionary, generateBoard, OutOfWordsError } from '../src/board.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const runs = Number(process.argv[2] ?? 3);
// "kids" plays the kids dictionary on the 5x5 board
const kids = process.argv[3] === 'kids';
const dict = JSON.parse(readFileSync(`${root}data/${kids ? 'kids' : 'words'}.json`, 'utf8'));
const index = indexDictionary(dict);
const size = kids ? 5 : 8;

for (let run = 1; run <= runs; run++) {
  const used = new Set();
  let boards = 0;
  for (;;) {
    try {
      const board = generateBoard(index, { size, seed: run * 1e6 + boards, used });
      for (const w of board.words) used.add(w.word);
      boards++;
    } catch (err) {
      if (err instanceof OutOfWordsError) break;
      throw err;
    }
  }
  console.log(`run ${run}: ${boards} boards, ${used.size} of ${dict.length} words used`);
}
