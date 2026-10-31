// Two versions of the game on one page: the grown-up one (8x8, the full
// dictionary) and the kids one (5x5, ~1100 simple nouns, no rare words).
// The choice belongs to the device, not the account: a parent and a child
// may share one sign-in on different phones. Switching reloads the page.

export const MODE_KEY = 'filword-mode';

export const MODES = {
  adult: {
    size: 8,
    dict: 'data/words.json',
    stateKey: 'filword-state',
    statsKey: 'filword-stats',
    // 30 simulated playthroughs gave 2116-2122 boards (scripts/simulate.mjs)
    cycle: 2110,
    // [row, first column, text], left-aligned like a poster
    phrase: [[2, 0, 'ФИЛВОРД'], [3, 0, 'БЕЗ'], [4, 0, 'РЕКЛАМЫ!']],
  },
  kids: {
    size: 5,
    dict: 'data/kids.json',
    stateKey: 'filword-kids-state',
    statsKey: 'filword-kids-stats',
    // 200 playthroughs gave 226-252 boards (scripts/simulate.mjs 200 kids)
    cycle: 220,
    phrase: [[1, 0, 'ИГРА'], [2, 0, 'ДЛЯ'], [3, 0, 'ДЕТЕЙ']],
  },
};

export function currentMode() {
  try { return localStorage.getItem(MODE_KEY) === 'kids' ? 'kids' : 'adult'; } catch { return 'adult'; }
}

export function setMode(name) {
  try { localStorage.setItem(MODE_KEY, name); } catch { /* private mode */ }
}
