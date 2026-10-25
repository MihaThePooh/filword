// Cut `total` cells into word lengths between min and max.
// Never leaves a remainder that is too short to become a word, and never
// asks for more words of a length than are still available.

import { pick } from './rng.js';

// Favourite lengths appear more often: 4-7 letter words are the nicest to look for.
const WEIGHTS = { 3: 1, 4: 3, 5: 4, 6: 4, 7: 3, 8: 2, 9: 1, 10: 1 };

export class SplitError extends Error {}

// available: { length: how many words are left } - omit to allow everything.
export function splitLengths(total, rng, { min = 3, max = 10, available } = {}) {
  const left = available ? { ...available } : null;
  const canUse = (len) => !left || (left[len] ?? 0) > 0;

  // Random greedy split with a few restarts: near the end of the dictionary
  // some lengths run out, and a first attempt may paint itself into a corner.
  for (let attempt = 0; attempt < 200; attempt++) {
    const budget = left ? { ...left } : null;
    const lengths = [];
    let rest = total;
    while (rest > 0) {
      const options = [];
      for (let len = min; len <= Math.min(max, rest); len++) {
        const after = rest - len;
        if (after !== 0 && after < min) continue;
        if (budget ? (budget[len] ?? 0) <= 0 : !canUse(len)) continue;
        for (let w = 0; w < (WEIGHTS[len] ?? 1); w++) options.push(len);
      }
      if (!options.length) break;
      const len = pick(rng, options);
      lengths.push(len);
      if (budget) budget[len]--;
      rest -= len;
    }
    if (rest === 0) return lengths;
  }
  throw new SplitError(`cannot split ${total} into ${min}-${max} with the words left`);
}
