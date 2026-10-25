// Progress through the dictionary and the "шафл" (shuffle) prestige.
//
// One cycle is CYCLE_BOARDS boards. Then the player shuffles: the dictionary
// starts over, the board counter goes back to 1, and the shuffle rank grows by one.
// Coins are kept - they are the reward for everything done so far.

// The dictionary is built with a small margin, so words never run out first
// (see scripts/simulate.mjs).
export const CYCLE_BOARDS = 2000;

export function cycleDone(stats) {
  return (stats.solved ?? 0) >= CYCLE_BOARDS;
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
