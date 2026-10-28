// Loading screen inside the board itself: ФИЛВОРД / БЕЗ / РЕКЛАМЫ! is written
// in the empty cells, dim at first. Letters light up one by one as the
// dictionary downloads; when it is all here the game swaps them for the real
// board with a wave.

// [row, first column, text] on the 8x8 board, left-aligned like a poster.
export const LINES = [[2, 0, 'ФИЛВОРД'], [3, 0, 'БЕЗ'], [4, 0, 'РЕКЛАМЫ!']];
const COLOURS = ['#ff8a65', '#5cc461', '#4fa8e8']; // the game's first three
const LIGHT_MS = 70; // the fastest a letter lights up, so it never just blinks
const CREEP_MS = 250; // size unknown: one letter per this, leaving the last few

// Every letter of the phrase: its cell, the letter and the line it belongs to.
export function phraseCells(size) {
  return LINES.flatMap(([row, col, text], line) =>
    [...text].map((ch, i) => ({ cell: row * size + col + i, ch, line })));
}

// How many letters to light for a download fraction (0..1).
export function litCount(fraction, total) {
  return Math.max(0, Math.min(total, Math.round(fraction * total)));
}

export function showLoader(cellEls, size) {
  const letters = phraseCells(size);
  for (const { cell, ch } of letters) {
    cellEls[cell].textContent = ch;
    cellEls[cell].classList.add('dim');
  }
  const startedAt = performance.now();
  let target = 0;
  let unknown = false;
  let lit = 0;
  let finished;
  const allLit = new Promise((resolve) => { finished = resolve; });

  function light({ cell, line }) {
    const el = cellEls[cell];
    el.classList.remove('dim');
    el.classList.add('lit');
    el.style.background = COLOURS[line];
  }
  const timer = setInterval(() => {
    if (unknown) {
      const crept = Math.floor((performance.now() - startedAt) / CREEP_MS);
      target = Math.max(target, Math.min(letters.length - 3, crept));
    }
    if (lit < target) light(letters[lit++]);
    if (lit === letters.length) {
      clearInterval(timer);
      finished();
    }
  }, LIGHT_MS);

  return {
    // fraction 0..1, or null when the size is unknown
    progress(fraction) {
      unknown = fraction == null;
      if (!unknown) target = Math.max(target, litCount(fraction, letters.length));
    },
    // Resolves once every letter is lit. "?loader" in the address keeps the
    // phrase for a while - to look at it.
    async done() {
      unknown = false;
      target = letters.length;
      await allLit;
      const hold = new URLSearchParams(location.search).has('loader') ? 8000 : 300;
      await new Promise((resolve) => setTimeout(resolve, hold));
      for (const { cell } of letters) cellEls[cell].classList.remove('lit');
    },
  };
}
