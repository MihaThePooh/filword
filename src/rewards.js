// Coins: the game's currency. Earned for words and boards,
// later spent on themes and other pretty things.

export const REWARD = {
  word: 1, // a hidden word found
  bonus: 3, // a real word that is not hidden on this board
  board: 5, // a whole board solved
};

// A bonus word: any dictionary noun traced on the board that is not one of
// the hidden words and was not already counted on this board.
export function isBonusWord(traced, bonusWords, hiddenWords, alreadyFound) {
  if (traced.length < 3) return false;
  if (!bonusWords.has(traced)) return false;
  if (hiddenWords.includes(traced)) return false;
  return !alreadyFound.includes(traced);
}
