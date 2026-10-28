// Builds a board: one random path through the whole grid, cut into pieces,
// each piece filled with a dictionary word of the same length.
//
// Because every cell belongs to exactly one word, any words fit -
// there are no shared letters to match, so generation never gets stuck.
//
// Words never repeat across boards: the caller passes the set of words
// already found. Boards start with common words and slowly move to rarer
// ones, because each pick comes from the most frequent words still left.
//
// Every board has exactly one rare word (marked "x" in the dictionary) -
// a rule, not luck: never two puzzles nobody knows, never a board without one.
// The rest are common words. A dictionary without a rare tier gets none.

import { createRng, pick } from './rng.js';
import { randomPath } from './path.js';
import { splitLengths, SplitError } from './split.js';

const TOP = 300; // pick among this many most frequent unused words of a length
const SURPRISE_CHANCE = 0.1; // sometimes any unused word, e.g. an early "коромысло"

export class OutOfWordsError extends Error {}

// dict: [{ w, r, d }] -> { length: [entry, ...] }, each list most frequent first.
export function indexDictionary(dict) {
  const byLength = {};
  for (const entry of dict) {
    (byLength[[...entry.w].length] ??= []).push(entry);
  }
  for (const list of Object.values(byLength)) list.sort((a, b) => a.r - b.r);
  return byLength;
}

const isRare = (entry) => entry.x === 1;

// How many unused words of each length are left in one tier.
function countAvailable(index, used, rare = false) {
  const counts = {};
  for (const [len, list] of Object.entries(index)) {
    counts[len] = list.reduce((n, e) => n + (used.has(e.w) || isRare(e) !== rare ? 0 : 1), 0);
  }
  return counts;
}

function pickWord(list, used, rng, rare = false) {
  const free = [];
  const surprise = rng() < SURPRISE_CHANCE;
  for (const entry of list) {
    if (used.has(entry.w) || isRare(entry) !== rare) continue;
    free.push(entry);
    if (!surprise && free.length >= TOP) break;
  }
  return pick(rng, free);
}

export function generateBoard(index, { size = 8, seed = Date.now(), used = new Set() } = {}) {
  const rng = createRng(seed);
  const path = randomPath(size, rng);
  const { lengths, rareSlot } = planLengths(index, size * size, used, rng);

  const taken = new Set(used); // also blocks repeats inside this board
  const letters = new Array(size * size);
  const words = [];
  let k = 0;
  for (const [slot, len] of lengths.entries()) {
    const entry = pickWord(index[len], taken, rng, slot === rareSlot);
    taken.add(entry.w);
    const cells = path.slice(k, k + len);
    [...entry.w].forEach((ch, i) => { letters[cells[i]] = ch; });
    words.push({ word: entry.w, cells, defs: entry.d, stress: entry.s });
    k += len;
  }
  return { size, seed, letters, words };
}

// Word lengths along the path and which of them is the rare word.
// The rare length is chosen first, the common words share the remaining cells.
function planLengths(index, total, used, rng) {
  const common = countAvailable(index, used);
  const rareLeft = countAvailable(index, used, true);
  const hasRareTier = Object.values(index).some((list) => list.some(isRare));
  const split = (cells) => splitLengths(cells, rng, { available: common });
  try {
    if (!hasRareTier) return { lengths: split(total), rareSlot: -1 };
    // Try the rare lengths in random order, weighted by how many words are left.
    const pool = Object.entries(rareLeft).flatMap(([len, n]) => Array(n).fill(Number(len)));
    const tried = new Set();
    while (tried.size < new Set(pool).size) {
      const len = pick(rng, pool.filter((l) => !tried.has(l)));
      tried.add(len);
      try {
        const lengths = split(total - len);
        const rareSlot = Math.floor(rng() * (lengths.length + 1));
        lengths.splice(rareSlot, 0, len);
        return { lengths, rareSlot };
      } catch (err) {
        if (!(err instanceof SplitError)) throw err;
      }
    }
    throw new SplitError('no rare word fits');
  } catch (err) {
    if (err instanceof SplitError) throw new OutOfWordsError('dictionary is used up');
    throw err;
  }
}

export function totalWords(index) {
  return Object.values(index).reduce((n, list) => n + list.length, 0);
}
