// Game screen: draws the board, follows the finger, colours found words.

import {
  indexDictionary, generateBoard, OutOfWordsError,
} from './board.js';
import {
  startSelection, extendSelection, matchWord, rightWordWrongPath,
} from './selection.js';
import { emptyHint, nextHint, hintedCells, hintsLeft } from './hint.js';
import { createSheet } from './sheet.js';
import { loadDictionary, loadBonusWords } from './dict-loader.js';
import { REWARD, isBonusWord } from './rewards.js';
import { shuffle, cycleDone, CYCLE_BOARDS } from './progress.js';
import { ripple, confetti, showWinCard, showShuffleCard } from './celebrate.js';

const PALETTE = ['#f6c8b8', '#c9e4c5', '#bcd7ee', '#f3e2a9', '#e2cdee', '#f7d1e0',
  '#cfe8e6', '#f9dcb6', '#d6dcf3', '#e3ecc0', '#f2c9c9', '#d3e9d8'];
const STORAGE_KEY = 'filword-state';
const STATS_KEY = 'filword-stats';
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
let shownCoins = 0; // what the counter shows; lags behind while coins fly
let used = new Set(); // every word ever found - never shown again

async function init() {
  try {
    index = indexDictionary(await loadDictionary());
  } catch (err) {
    countEl.textContent = 'Не удалось загрузить словарь';
    console.error(err);
    return;
  }
  stats = { solved: 0, used: [], coins: 0, ...loadJson(STATS_KEY) };
  shownCoins = stats.coins;
  coinEl.textContent = shownCoins;
  countEl.textContent = '';
  loadBonusWords().then((set) => { bonusWords = set; }).catch((err) => console.warn('no bonus words', err));
  used = new Set(stats.used);
  const saved = loadJson(STORAGE_KEY);
  // The whole board is saved, not just its seed: the next board depends on
  // which words are used up, so a seed alone would not rebuild the same one.
  if (saved?.board?.letters) showBoard(saved.board, saved.found, saved.hint, saved.bonus);
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
    next = generateBoard(index, { seed: Date.now(), used });
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
  showBoard(generateBoard(index, { seed: Date.now(), used }), []);
}

function showBoard(nextBoard, savedFound, savedHint, savedBonus) {
  sheet.close();
  bonusFound = savedBonus ?? [];
  board = nextBoard;
  found = new Map(savedFound);
  hint = savedHint?.words ? savedHint : emptyHint();
  selection = [];
  gridEl.innerHTML = '';
  cellEls = board.letters.map((ch) => {
    const el = document.createElement('div');
    el.className = 'cell';
    el.textContent = ch;
    gridEl.appendChild(el);
    return el;
  });
  render();
  saveState();
}

// Cells that already belong to found words cannot be picked again.
function takenCells() {
  const taken = new Set();
  for (const i of found.keys()) board.words[i].cells.forEach((c) => taken.add(c));
  return taken;
}

// Finger position -> cell number, or -1 if outside the hit zone.
function cellAt(x, y) {
  const rect = gridEl.getBoundingClientRect();
  const size = board.size;
  const fx = ((x - rect.left) / rect.width) * size;
  const fy = ((y - rect.top) / rect.height) * size;
  const col = Math.floor(fx);
  const row = Math.floor(fy);
  if (col < 0 || row < 0 || col >= size || row >= size) return -1;
  const margin = (1 - HIT_ZONE) / 2;
  const dx = fx - col;
  const dy = fy - row;
  if (dx < margin || dx > 1 - margin || dy < margin || dy > 1 - margin) return -1;
  return row * size + col;
}

function onDown(e) {
  const cell = cellAt(e.clientX, e.clientY);
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
  if (i < 0) return;
  const w = board.words[i];
  sheet.open(w.word, found.get(i), w.defs, w.stress);
}

function markFound(i) {
  found.set(i, PALETTE[found.size % PALETTE.length]);
  used.add(board.words[i].word);
  // A word can be found only once, so this fires once per board.
  const solvedNow = found.size === board.words.length;
  if (solvedNow) stats.solved++;
  addCoins(REWARD.word + (solvedNow ? REWARD.board : 0), cellEls[board.words[i].cells.at(-1)]);
  saveStats();
  saveState();
  render();
  if (solvedNow) celebrate(board.words[i].cells.at(-1));
}

function celebrate(lastCell) {
  ripple(cellEls, board.size, lastCell);
  // Let the colour of the last word settle before the fireworks.
  setTimeout(() => {
    confetti();
    showWinCard({ solved: stats.solved, words: board.words.length }, () => newBoard());
  }, 350);
}

// One button, two jobs: a hint while the board is in play,
// "next board" once every word is found.
function onAction() {
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
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

function render() {
  const colour = new Array(board.letters.length);
  for (const [i, c] of found) board.words[i].cells.forEach((cell) => { colour[cell] = c; });
  const picked = new Set(selection);
  const foundSet = new Set(found.keys());
  const hintList = hintedCells(hint, board.words, foundSet);
  const hinted = new Set(hintList);
  cellEls.forEach((el, cell) => {
    el.classList.toggle('picked', picked.has(cell));
    el.classList.toggle('hinted', hinted.has(cell));
    el.classList.toggle('hint-start', cell === hintList[0]);
    el.style.background = picked.has(cell) ? '' : (colour[cell] ?? '');
  });
  const total = board.words.length;
  countEl.innerHTML = found.size === total
    ? '<b>Поле пройдено!</b>'
    : `Найдено <b>${found.size}</b> из ${total}`;
  if (found.size === total) {
    actionEl.textContent = 'Следующее поле';
    actionEl.disabled = false;
  } else {
    const left = hintsLeft(hint, foundSet);
    actionEl.textContent = left > 0 ? `Подсказка · ${left}` : 'Подсказок нет';
    actionEl.disabled = left === 0;
  }
  coinEl.textContent = shownCoins;
  const rank = stats.shuffles ? ` · шафл ${stats.shuffles}` : '';
  solvedEl.textContent = `Полей ${stats.solved}/${CYCLE_BOARDS}${rank}`;
}

function saveState() {
  saveJson(STORAGE_KEY, { board, found: [...found], hint, bonus: bonusFound });
}

function saveStats() {
  stats.used = [...used];
  saveJson(STATS_KEY, stats);
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
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
