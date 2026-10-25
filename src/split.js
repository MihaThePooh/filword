// Cut `total` cells into word lengths between min and max.
// Never leaves a remainder that is too short to become a word.

import { pick } from './rng.js';

// Favourite lengths appear more often: 4-7 letter words are the nicest to look for.
const WEIGHTS = { 3: 1, 4: 3, 5: 4, 6: 4, 7: 3, 8: 2, 9: 1, 10: 1 };

export function splitLengths(total, rng, min = 3, max = 10) {
  const lengths = [];
  let rest = total;
  while (rest > 0) {
    const options = [];
    for (let len = min; len <= Math.min(max, rest); len++) {
      const left = rest - len;
      if (left !== 0 && left < min) continue;
      for (let w = 0; w < (WEIGHTS[len] ?? 1); w++) options.push(len);
    }
    if (!options.length) throw new Error(`cannot split ${total} into ${min}-${max}`);
    const len = pick(rng, options);
    lengths.push(len);
    rest -= len;
  }
  return lengths;
}
