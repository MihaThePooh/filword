// Builds a board: one random path through the whole grid, cut into pieces,
// each piece filled with a dictionary word of the same length.
//
// Because every cell belongs to exactly one word, any words fit -
// there are no shared letters to match, so generation never gets stuck.
//
// Words never repeat across boards: the caller passes the set of words
// already found. Boards start with common words and slowly move to rarer
// ones, because each pick comes from the most frequent words still left.

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

function countAvailable(index, used) {
  const counts = {};
  for (const [len, list] of Object.entries(index)) {
    counts[len] = list.reduce((n, e) => n + (used.has(e.w) ? 0 : 1), 0);
  }
  return counts;
}

function pickWord(list, used, rng) {
  const free = [];
  const surprise = rng() < SURPRISE_CHANCE;
  for (const entry of list) {
    if (used.has(entry.w)) continue;
    free.push(entry);
    if (!surprise && free.length >= TOP) break;
  }
  return pick(rng, free);
}

export function generateBoard(index, { size = 8, seed = Date.now(), used = new Set() } = {}) {
  const rng = createRng(seed);
  const path = randomPath(size, rng);
  let lengths;
  try {
    lengths = splitLengths(size * size, rng, { available: countAvailable(index, used) });
  } catch (err) {
    if (err instanceof SplitError) throw new OutOfWordsError('dictionary is used up');
    throw err;
  }

  const taken = new Set(used); // also blocks repeats inside this board
  const letters = new Array(size * size);
  const words = [];
  let k = 0;
  for (const len of lengths) {
    const entry = pickWord(index[len], taken, rng);
    taken.add(entry.w);
    const cells = path.slice(k, k + len);
    [...entry.w].forEach((ch, i) => { letters[cells[i]] = ch; });
    words.push({ word: entry.w, cells, defs: entry.d });
    k += len;
  }
  return { size, seed, letters, words };
}

export function totalWords(index) {
  return Object.values(index).reduce((n, list) => n + list.length, 0);
}
