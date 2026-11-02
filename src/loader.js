// Loading screen inside the board itself: ФИЛВОРД / БЕЗ / РЕКЛАМЫ! is written
// in the empty cells, dim at first. Letters light up one by one as the game
// loads (see STAGES); when it is all here the game swaps them for the real
// board with a wave.

import { MODES } from './mode.js';

// [row, first column, text] on the 8x8 board; the kids board has its own (mode.js).
export const LINES = MODES.adult.phrase;
const COLOURS = ['#ff8a65', '#5cc461', '#4fa8e8']; // the game's first three
const LIGHT_MS = 70; // the fastest a letter lights up, so it never just blinks
const CREEP_MS = 250; // size unknown: one letter per this, leaving the last few

// Every letter of the phrase: its cell, the letter and the line it belongs to.
export function phraseCells(size, lines = LINES) {
  return lines.flatMap(([row, col, text], line) =>
    [...text].map((ch, i) => ({ cell: row * size + col + i, ch, line })));
}

// How many letters to light for a fraction of the loading (0..1). The last
// letter waits for the real end: until then something is still loading, and
// a fully lit phrase that just sits there looks like a hang (02.11.2026).
export function litCount(fraction, total) {
  const n = Math.max(0, Math.min(total, Math.round(fraction * total)));
  return fraction < 1 ? Math.min(n, total - 1) : n;
}

// Loading is more than the dictionary download: after it the dictionary is
// unpacked and indexed, and the player's save comes from the server (over a
// VPN that can take seconds). Each stage owns its share of the phrase, so the
// letters stop exactly where the loading stops.
export const STAGES = { download: 0.5, prepare: 0.25, save: 0.25 };

// parts: { stage: 0..1 } -> 0..1 for the whole loading.
export function overall(parts) {
  return Object.entries(STAGES)
    .reduce((sum, [k, w]) => sum + w * Math.max(0, Math.min(1, parts[k] || 0)), 0);
}

export function showLoader(cellEls, size, lines = LINES) {
  const letters = phraseCells(size, lines);
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
