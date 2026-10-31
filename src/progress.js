// Progress through the dictionary and the "шафл" (shuffle) prestige.
//
// One cycle is CYCLE_BOARDS boards. Then the player shuffles: the dictionary
// starts over, the board counter goes back to 1, and the shuffle rank grows by one.
// Coins are kept - they are the reward for everything done so far.

import { MODES } from './mode.js';

// As many boards as the dictionary gives for sure, a few spare for unlucky
// splits. Per mode: see mode.js.
export const CYCLE_BOARDS = MODES.adult.cycle;

export function cycleDone(stats, cycle = CYCLE_BOARDS) {
  return (stats.solved ?? 0) >= cycle;
}

export function shuffle(stats) {
  return {
    ...stats,
    used: [],
    solved: 0,
    shuffles: (stats.shuffles ?? 0) + 1,
    totalSolved: (stats.totalSolved ?? 0) + (stats.solved ?? 0),
  };
}
