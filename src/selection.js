// Pure logic of a finger swipe over the grid - no DOM here, so it is easy to test.
//
// Rules:
// - a swipe starts on any cell that is not part of an already found word;
// - it grows only to a neighbouring cell (no diagonals) that is free and not yet picked;
// - sliding back onto the previous cell un-picks the last one (finger "rewinds").

import { neighbours } from './path.js';

export function startSelection(cell, taken) {
  return taken.has(cell) ? [] : [cell];
}

export function extendSelection(selection, cell, size, taken) {
  if (!selection.length) return selection;
  const last = selection[selection.length - 1];
  if (cell === last) return selection;
  if (selection.length > 1 && cell === selection[selection.length - 2]) {
    return selection.slice(0, -1);
  }
  if (taken.has(cell) || selection.includes(cell)) return selection;
  if (!neighbours(last, size).includes(cell)) return selection;
  return [...selection, cell];
}

// Index of the word whose cells match the swipe exactly, or -1.
// The same letters traced through other cells do not count:
// every cell must end up in exactly one word.
export function matchWord(selection, words, found) {
  return words.findIndex((w, i) =>
    !found.has(i)
    && w.cells.length === selection.length
    && w.cells.every((c, k) => c === selection[k]));
}

// The swipe spells a hidden word, but through other cells. The word is right,
// the path is not - the player deserves a hint, not a silent "wrong".
// Returns the index of that word, or -1.
export function rightWordWrongPath(selection, letters, words, found) {
  const traced = selection.map((c) => letters[c]).join('');
  return words.findIndex((w, i) => !found.has(i) && w.word === traced);
}
