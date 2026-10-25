// Hints: each press reveals one more letter of a word the player has not found.
// The first press picks a random unfound word and shows its first letter,
// next presses show the following letters. When the last letter is shown,
// the word counts as found. At most MAX_HINT_WORDS words per board.

export const MAX_HINT_WORDS = 3;

export function emptyHint() {
  return { words: [], shown: 0 }; // words: indexes of hinted words, last = current
}

function current(hint, found) {
  const i = hint.words[hint.words.length - 1];
  return i === undefined || found.has(i) ? -1 : i;
}

export function hintsLeft(hint, found) {
  // A word in progress still has letters to give, so the button stays active.
  if (current(hint, found) >= 0) return MAX_HINT_WORDS - hint.words.length + 1;
  return MAX_HINT_WORDS - hint.words.length;
}

// Returns { hint, completed } where completed is the index of a word
// fully revealed by this press, or -1.
export function nextHint(hint, words, found, rng = Math.random) {
  const cur = current(hint, found);
  if (cur >= 0) {
    const shown = hint.shown + 1;
    const done = shown >= words[cur].cells.length;
    return { hint: { words: hint.words, shown }, completed: done ? cur : -1 };
  }
  if (hint.words.length >= MAX_HINT_WORDS) return { hint, completed: -1 };
  const free = words.map((_, i) => i).filter((i) => !found.has(i));
  if (!free.length) return { hint, completed: -1 };
  const pickIdx = free[Math.floor(rng() * free.length)];
  const next = { words: [...hint.words, pickIdx], shown: 1 };
  // A one-letter word does not exist (min 3), so the first press never completes.
  return { hint: next, completed: -1 };
}

// Cells to highlight right now.
export function hintedCells(hint, words, found) {
  const cur = current(hint, found);
  return cur < 0 ? [] : words[cur].cells.slice(0, hint.shown);
}
