// Plays the whole dictionary board after board, like a player who finds every
// word, and reports how many boards one cycle gives.
// Usage: node scripts/simulate.mjs [runs]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { indexDictionary, generateBoard, OutOfWordsError } from '../src/board.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dict = JSON.parse(readFileSync(`${root}data/words.json`, 'utf8'));
const index = indexDictionary(dict);
const runs = Number(process.argv[2] ?? 3);

for (let run = 1; run <= runs; run++) {
  const used = new Set();
  let boards = 0;
  for (;;) {
    try {
      const board = generateBoard(index, { seed: run * 1e6 + boards, used });
      for (const w of board.words) used.add(w.word);
      boards++;
    } catch (err) {
      if (err instanceof OutOfWordsError) break;
      throw err;
    }
  }
  console.log(`run ${run}: ${boards} boards, ${used.size} of ${dict.length} words used`);
}
