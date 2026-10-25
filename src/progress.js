// Progress through the dictionary and the "шафл" (shuffle) prestige.
//
// When every word has been played, the player shuffles: the dictionary starts
// over, the board counter goes back to 1, and the shuffle rank grows by one.
// Coins are kept - they are the reward for everything done so far.

export function shuffle(stats) {
  return {
    ...stats,
    used: [],
    solved: 0,
    shuffles: (stats.shuffles ?? 0) + 1,
    totalSolved: (stats.totalSolved ?? 0) + (stats.solved ?? 0),
  };
}
