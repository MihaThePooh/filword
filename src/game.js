// Game screen: draws the board, follows the finger, colours found words.

import {
  indexDictionary, generateBoard, OutOfWordsError,
} from './board.js';
import {
  startSelection, extendSelection, matchWord, rightWordWrongPath,
} from './selection.js';
import { emptyHint, nextHint, hintedCells, hintsLeft } from './hint.js';
import { createSheet } from './sheet.js';
import { loadDictionary, loadBonusWords, loadBonusDefs } from './dict-loader.js';
import { showLoader } from './loader.js';
import { REWARD, isBonusWord } from './rewards.js';
import { shuffle, cycleDone, CYCLE_BOARDS } from './progress.js';
import { ripple, confetti, showWinCard, showShuffleCard } from './celebrate.js';
import { setupMenu } from './install.js';
import * as cloud from './cloud.js';

// Bright, so found words stand out from the grey cells still in play.
// Dark letters stay readable on each of them (contrast 3.8+ for large text).
const PALETTE = ['#ff8a65', '#5cc461', '#4fa8e8', '#f7c51e', '#b98ae6', '#f377a6',
  '#2fc7b8', '#ffa53a', '#8494f5', '#a9d63f', '#f26b6b', '#45d095'];
// The old pastel palette, same order: boards saved before the change get repainted.
const OLD_PALETTE = ['#f6c8b8', '#c9e4c5', '#bcd7ee', '#f3e2a9', '#e2cdee', '#f7d1e0',
  '#cfe8e6', '#f9dcb6', '#d6dcf3', '#e3ecc0', '#f2c9c9', '#d3e9d8'];
const brighter = (c) => PALETTE[OLD_PALETTE.indexOf(c)] ?? c;
// Bonus words in the list under the board: grey, as dark as the colours above.
const BONUS_GREY = '#b5b3ab';
const STORAGE_KEY = cloud.STATE_KEY;
const BOARD_SIZE = 8;
// Shown in the menu, so it is easy to tell which version a phone runs.
// Must match CACHE in sw.js (a test checks it).
export const VERSION = 28;
const STATS_KEY = cloud.STATS_KEY;
// Only the middle part of a cell reacts to the finger. Crossing a corner
// between cells would otherwise pick a diagonal neighbour by accident.
const HIT_ZONE = 0.8;
// A finger that moved less than this is a tap, not a swipe.
const TAP_SLOP = 10;

const gridEl = document.getElementById('grid');
const countEl = document.getElementById('count');
const solvedEl = document.getElementById('solved');
const actionEl = document.getElementById('action');
const coinEl = document.getElementById('coin-count');
// Space between the header and the board: short messages live here.
const slotEl = document.getElementById('slot');
const wordsEl = document.getElementById('words');

let index;
let board;
let found = new Map(); // word index -> colour
let selection = [];
let hint = emptyHint();
let cellEls = [];
let tap = null; // { cell, x, y } when a press starts on a found word
const sheet = createSheet();
let stats = { solved: 0, used: [], coins: 0 };
let bonusWords = new Set(); // filled in the background, the game starts without it
let bonusFound = []; // bonus words already counted on this board
// Found words of this board in the order they were found: { i } for a hidden
// word (index in board.words), { b } for a bonus word. Shown under the board.
let wordLog = [];
let dictByWord = new Map(); // word -> dictionary entry, for bonus definitions
let shownCoins = 0; // what the counter shows; lags behind while coins fly
let used = new Set(); // every word ever found - never shown again

async function init() {
  document.getElementById('version').textContent = `Версия ${VERSION}`;
  setupMenu();
  document.getElementById('logout').addEventListener('click', (e) => { e.preventDefault(); cloud.logout(); });
  // The save is fetched while the dictionary loads; the board waits for both.
  const synced = cloud.start();
  // Ask the browser not to evict the offline copy when the phone runs low on space.
  navigator.storage?.persist?.().catch(() => {});
  // The cells live for the whole session: boards change only their letters.
  cellEls = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => {
    const el = document.createElement('div');
    el.className = 'cell';
    gridEl.appendChild(el);
    return el;
  });
  const loader = showLoader(cellEls, BOARD_SIZE);
  try {
    const dict = await loadDictionary((f) => loader.progress(f));
    index = indexDictionary(dict);
    dictByWord = new Map(dict.map((e) => [e.w, e]));
  } catch (err) {
    await loader.done();
    countEl.textContent = 'Не удалось загрузить словарь';
    console.error(err);
    return;
  }
  await loader.done();
  await synced;
  stats = { solved: 0, used: [], coins: 0, ...loadJson(STATS_KEY) };
  shownCoins = stats.coins;
  coinEl.textContent = shownCoins;
  countEl.textContent = '';
  loadBonusWords().then((set) => { bonusWords = set; }).catch((err) => console.warn('no bonus words', err));
  used = new Set(stats.used);
  const saved = loadJson(STORAGE_KEY);
  // The whole board is saved, not just its seed: the next board depends on
  // which words are used up, so a seed alone would not rebuild the same one.
  if (saved?.board?.letters) showBoard(saved.board, saved.found, saved.hint, saved.bonus, saved.log);
  else newBoard();
  actionEl.addEventListener('click', onAction);
  gridEl.addEventListener('pointerdown', onDown);
  gridEl.addEventListener('pointermove', onMove);
  gridEl.addEventListener('pointerup', onUp);
  gridEl.addEventListener('pointercancel', onUp);
}

function newBoard() {
  if (cycleDone(stats)) {
    showShuffleCard(stats, doShuffle);
    return;
  }
  let next;
  try {
    next = generateBoard(index, { size: BOARD_SIZE, seed: Date.now(), used });
  } catch (err) {
    if (!(err instanceof OutOfWordsError)) throw err;
    // Should not happen with CYCLE_BOARDS below the dictionary size, but just in case.
    showShuffleCard(stats, doShuffle);
    return;
  }
  showBoard(next, []);
}

function doShuffle() {
  stats = shuffle({ ...stats, used: [...used] });
  used = new Set();
  saveStats();
  confetti();
  showBoard(generateBoard(index, { size: BOARD_SIZE, seed: Date.now(), used }), []);
}

// The new board arrives with a wave from a random cell: each cell swaps its
// letter as the ring lifts it, so the old board leaves the same way.
// Taps wait until the wave has passed.
let busy = false;
let busyTimer;
function showBoard(nextBoard, savedFound, savedHint, savedBonus, savedLog) {
  sheet.close();
  bonusFound = savedBonus ?? [];
  board = nextBoard;
  found = new Map([...(savedFound ?? [])].map(([i, c]) => [i, brighter(c)]));
  // Boards saved before the list existed: hidden words first, then bonus ones.
  wordLog = savedLog ?? [...found.keys()].map((i) => ({ i })).concat(bonusFound.map((b) => ({ b })));
  renderWords();
  hint = savedHint?.words ? savedHint : emptyHint();
  selection = [];
  saveState();
  renderHeader();
  const shown = board;
  const paint = cellPainter();
  busy = true;
  const wave = ripple(cellEls, board.size, undefined, (cell) => { if (board === shown) paint(cell); });
  clearTimeout(busyTimer);
  busyTimer = setTimeout(() => {
    busy = false;
    render();
  }, wave);
}

// Cells that already belong to found words cannot be picked again.
function takenCells() {
  const taken = new Set();
  for (const i of found.keys()) board.words[i].cells.forEach((c) => taken.add(c));
  return taken;
}

// Finger position -> cell number, or -1 if outside the hit zone.
// zone: the share of a cell that reacts. Moves use HIT_ZONE; the first touch
// takes the whole cell, so a tap near a cell's edge is not lost.
function cellAt(x, y, zone = HIT_ZONE) {
  const rect = gridEl.getBoundingClientRect();
  const size = board.size;
  const fx = ((x - rect.left) / rect.width) * size;
  const fy = ((y - rect.top) / rect.height) * size;
  const col = Math.floor(fx);
  const row = Math.floor(fy);
  if (col < 0 || row < 0 || col >= size || row >= size) return -1;
  const margin = (1 - zone) / 2;
  const dx = fx - col;
  const dy = fy - row;
  if (dx < margin || dx > 1 - margin || dy < margin || dy > 1 - margin) return -1;
  return row * size + col;
}

function onDown(e) {
  // No text selection, no "tap to search" from the browser: the board is a game, not text.
  e.preventDefault();
  if (busy || sheet.justClosed()) return;
  const cell = cellAt(e.clientX, e.clientY, 1);
  if (cell < 0) return;
  // Keep receiving moves even if the finger leaves the grid.
  gridEl.setPointerCapture(e.pointerId);
  const taken = takenCells();
  // A press on a found word may be a tap that opens its definition.
  tap = taken.has(cell) ? { cell, x: e.clientX, y: e.clientY } : null;
  selection = startSelection(cell, taken);
  render();
}

function onMove(e) {
  if (!selection.length) return;
  const cell = cellAt(e.clientX, e.clientY);
  if (cell < 0) return;
  const next = extendSelection(selection, cell, board.size, takenCells());
  if (next !== selection) {
    selection = next;
    render();
  }
}

function onUp(e) {
  if (tap) {
    const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
    const cell = tap.cell;
    tap = null;
    if (moved < TAP_SLOP) openDefinition(cell);
    return;
  }
  if (!selection.length) return;
  const i = matchWord(selection, board.words, new Set(found.keys()));
  if (i >= 0) {
    selection = [];
    markFound(i);
  } else if (isBonusWord(selection.map((c) => board.letters[c]).join(''), bonusWords,
    board.words.map((w) => w.word), bonusFound)) {
    // A real word that is not hidden here: reward it.
    const word = selection.map((c) => board.letters[c]).join('');
    const lastCell = selection.at(-1);
    bonusFound.push(word);
    wordLog.push({ b: word });
    renderWords(true);
    selection = [];
    addCoins(REWARD.bonus, cellEls[lastCell]);
    toast(`Бонусное слово «${word}» +${REWARD.bonus}`);
    saveState();
    render();
  } else if (rightWordWrongPath(selection, board.letters, board.words, new Set(found.keys())) >= 0) {
    // The word is right, but it hides in other cells.
    toast('Собери слово по-другому');
    selection = [];
    render();
  } else if (selection.length > 1) {
    // Wrong word: shake the picked cells, then clear.
    gridEl.classList.add('miss');
    setTimeout(() => {
      gridEl.classList.remove('miss');
      selection = [];
      render();
    }, 300);
  } else {
    selection = [];
    render();
  }
}

function openDefinition(cell) {
  const i = board.words.findIndex((w, k) => found.has(k) && w.cells.includes(cell));
  if (i >= 0) showWord({ i });
}

// Definition card for a hidden word or a bonus word from the list.
function showWord(entry) {
  if (entry.b === undefined) {
    const w = board.words[entry.i];
    sheet.open(w.word, found.get(entry.i), w.defs, w.stress);
    return;
  }
  // Bonus words from the main dictionary are at hand; the rest come from
  // a separate file, loaded on the first such tap.
  const known = dictByWord.get(entry.b);
  if (known) {
    sheet.open(entry.b, BONUS_GREY, known.d, known.s);
    return;
  }
  sheet.open(entry.b, BONUS_GREY, [], undefined, 'Загружаю толкование…');
  loadBonusDefs().then((defs) => {
    const e = defs[entry.b];
    if (sheet.isOpen()) sheet.open(entry.b, BONUS_GREY, e?.d, e?.s, e ? '' : 'Толкования нет, загляни в Викисловарь.');
  }).catch(() => {
    if (sheet.isOpen()) sheet.open(entry.b, BONUS_GREY, [], undefined, 'Не удалось загрузить толкование: нет связи?');
  });
}

// Found words under the board, each on the colour it has on the board.
// fresh: the last one has just been found - it pops in.
function renderWords(fresh = false) {
  wordsEl.innerHTML = '';
  wordLog.forEach((entry, k) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = entry.b ?? board.words[entry.i].word;
    chip.style.background = entry.b === undefined ? found.get(entry.i) : BONUS_GREY;
    if (fresh && k === wordLog.length - 1) chip.classList.add('new');
    chip.addEventListener('click', () => {
      if (!sheet.justClosed()) showWord(entry); // a tap that closed the card opens nothing
    });
    wordsEl.appendChild(chip);
  });
  if (fresh) wordsEl.scrollTop = wordsEl.scrollHeight;
  updateFades();
}

// Fade the list's top or bottom edge when words hide beyond it.
function updateFades() {
  const { scrollTop, clientHeight, scrollHeight } = wordsEl;
  wordsEl.classList.toggle('more-above', scrollTop > 1);
  wordsEl.classList.toggle('more-below', scrollTop + clientHeight < scrollHeight - 1);
}
wordsEl.addEventListener('scroll', updateFades, { passive: true });
addEventListener('resize', updateFades);

function markFound(i) {
  found.set(i, PALETTE[found.size % PALETTE.length]);
  wordLog.push({ i });
  renderWords(true);
  used.add(board.words[i].word);
  // A word can be found only once, so this fires once per board.
  const solvedNow = found.size === board.words.length;
  if (solvedNow) stats.solved++;
  addCoins(REWARD.word + (solvedNow ? REWARD.board : 0), cellEls[board.words[i].cells.at(-1)]);
  saveStats();
  saveState();
  render();
  if (solvedNow) celebrate();
}

// The last word settles, a ripple runs over the board from a random cell,
// half a second of quiet - and then the fireworks.
function celebrate() {
  const solvedBoard = board;
  setTimeout(() => {
    if (board !== solvedBoard) return; // "next board" was pressed meanwhile
    const wave = ripple(cellEls, board.size);
    setTimeout(() => {
      if (board !== solvedBoard) return;
      confetti();
      showWinCard({ solved: stats.solved, words: board.words.length }, () => newBoard());
    }, wave + 500);
  }, 250); // the colour of the last word settles first
}

// One button, two jobs: a hint while the board is in play,
// "next board" once every word is found.
function onAction() {
  if (busy) return;
  if (found.size === board.words.length) {
    newBoard();
    return;
  }
  const res = nextHint(hint, board.words, new Set(found.keys()));
  hint = res.hint;
  if (res.completed >= 0) markFound(res.completed);
  else {
    saveState();
    render();
  }
}

// Coins fly from the cell to the counter in the header.
function addCoins(amount, fromEl) {
  stats.coins += amount;
  saveStats();
  const counter = document.getElementById('coins');
  const target = counter.getBoundingClientRect();
  const from = fromEl?.getBoundingClientRect();
  const sync = () => {
    shownCoins = stats.coins;
    coinEl.textContent = shownCoins;
  };
  if (!from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    sync();
    return;
  }
  const flights = Math.min(amount, 8);
  for (let k = 0; k < flights; k++) {
    const coin = document.createElement('span');
    coin.className = 'coin flying';
    document.body.appendChild(coin);
    const x0 = from.left + from.width / 2;
    const y0 = from.top + from.height / 2;
    const x1 = target.left + 10;
    const y1 = target.top + target.height / 2;
    coin.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
      { transform: `translate(${x0 + (Math.random() - 0.5) * 60}px, ${y0 - 40}px) scale(1.2)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${x1}px, ${y1}px) scale(0.8)`, opacity: 1 },
    ], { duration: 700, delay: k * 70, easing: 'ease-in' }).finished.then(() => {
      coin.remove();
      // Each landed coin ticks the counter; the last tick lands on the exact total.
      shownCoins = k === flights - 1 ? stats.coins : Math.min(stats.coins, shownCoins + 1);
      coinEl.textContent = shownCoins;
      counter.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], 200);
    });
  }
  // Safety net: even if an animation is interrupted, end with the exact number.
  setTimeout(sync, 700 + flights * 70 + 100);
}

let toastTimer;
function toast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    slotEl.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

function render() {
  const paint = cellPainter();
  cellEls.forEach((_, cell) => paint(cell));
  renderHeader();
}

// Returns a function that draws one cell from the current state.
function cellPainter() {
  const colour = new Array(board.letters.length);
  for (const [i, c] of found) board.words[i].cells.forEach((cell) => { colour[cell] = c; });
  const picked = new Set(selection);
  const hintList = hintedCells(hint, board.words, new Set(found.keys()));
  const hinted = new Set(hintList);
  return (cell) => {
    const el = cellEls[cell];
    if (el.textContent !== board.letters[cell]) el.textContent = board.letters[cell];
    el.classList.remove('dim');
    el.classList.toggle('picked', picked.has(cell));
    el.classList.toggle('hinted', hinted.has(cell));
    el.classList.toggle('hint-start', cell === hintList[0]);
    el.style.background = picked.has(cell) ? '' : (colour[cell] ?? '');
  };
}

function renderHeader() {
  const total = board.words.length;
  countEl.innerHTML = found.size === total
    ? '<b>Готово!</b>'
    : `Слова <b>${found.size}</b>/${total}`;
  if (found.size === total) {
    actionEl.textContent = 'Новое поле';
    actionEl.disabled = false;
  } else {
    const left = hintsLeft(hint, new Set(found.keys()));
    actionEl.textContent = left > 0 ? `Подсказка · ${left}` : 'Подсказок нет';
    actionEl.disabled = left === 0;
  }
  coinEl.textContent = shownCoins;
  const rank = stats.shuffles ? ` · шафл ${stats.shuffles}` : '';
  solvedEl.textContent = `Полей ${stats.solved}/${CYCLE_BOARDS}${rank}`;
}

function saveState() {
  saveJson(STORAGE_KEY, { board, found: [...found], hint, bonus: bonusFound, log: wordLog });
}

function saveStats() {
  stats.used = [...used];
  saveJson(STATS_KEY, stats);
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    cloud.changed();
  } catch {
    // Private mode or full storage: the game still works, just without saving.
  }
}

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

init();

// Offline support: the service worker keeps a copy of the game and dictionary.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('no offline mode', err));
}
