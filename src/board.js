// Builds a board: one random path through the whole grid, cut into pieces,
// each piece filled with a dictionary word of the same length.
//
// Because every cell belongs to exactly one word, any words fit -
// there are no shared letters to match, so generation never gets stuck.

import { createRng, pick } from './rng.js';
import { randomPath } from './path.js';
import { splitLengths } from './split.js';

export const COMMON_RANK = 60000; // words more frequent than this are "common"
const RARE_CHANCE = 0.15; // sometimes take a rarer word like "коромысло"

// dict: [{ w, r, d }] -> { common: {len: [entry]}, all: {len: [entry]} }
export function indexDictionary(dict) {
  const index = { common: {}, all: {} };
  for (const entry of dict) {
    const len = [...entry.w].length;
    (index.all[len] ??= []).push(entry);
    if (entry.r <= COMMON_RANK) (index.common[len] ??= []).push(entry);
  }
  return index;
}

function pickWord(index, len, used, rng) {
  const pools = rng() < RARE_CHANCE
    ? [index.all[len], index.common[len]]
    : [index.common[len], index.all[len]];
  for (const pool of pools) {
    if (!pool?.length) continue;
    // A few tries to avoid repeating a word on one board.
    for (let t = 0; t < 20; t++) {
      const entry = pick(rng, pool);
      if (!used.has(entry.w)) return entry;
    }
  }
  throw new Error(`no free word of length ${len}`);
}

export function generateBoard(index, { size = 8, seed = Date.now() } = {}) {
  const rng = createRng(seed);
  const path = randomPath(size, rng);
  const lengths = splitLengths(size * size, rng);

  const letters = new Array(size * size);
  const words = [];
  const used = new Set();
  let k = 0;
  for (const len of lengths) {
    const entry = pickWord(index, len, used, rng);
    used.add(entry.w);
    const cells = path.slice(k, k + len);
    [...entry.w].forEach((ch, i) => { letters[cells[i]] = ch; });
    words.push({ word: entry.w, cells, defs: entry.d });
    k += len;
  }
  return { size, seed, letters, words };
}
