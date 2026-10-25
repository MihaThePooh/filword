// Game screen: draws the board, follows the finger, colours found words.

import {
  indexDictionary, generateBoard, OutOfWordsError, totalWords,
} from './board.js';
import { startSelection, extendSelection, matchWord } from './selection.js';

const PALETTE = ['#f6c8b8', '#c9e4c5', '#bcd7ee', '#f3e2a9', '#e2cdee', '#f7d1e0',
  '#cfe8e6', '#f9dcb6', '#d6dcf3', '#e3ecc0', '#f2c9c9', '#d3e9d8'];
const STORAGE_KEY = 'filword-state';
const STATS_KEY = 'filword-stats';
// Only the middle part of a cell reacts to the finger. Crossing a corner
// between cells would otherwise pick a diagonal neighbour by accident.
const HIT_ZONE = 0.8;

const gridEl = document.getElementById('grid');
const countEl = document.getElementById('count');
const solvedEl = document.getElementById('solved');

let index;
let board;
let found = new Map(); // word index -> colour
let selection = [];
let cellEls = [];
let stats = { solved: 0, used: [] };
let used = new Set(); // every word ever found - never shown again

async function init() {
  try {
    const res = await fetch('data/words.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    index = indexDictionary(await res.json());
  } catch (err) {
    countEl.textContent = 'Не удалось загрузить словарь';
    console.error(err);
    return;
  }
  stats = { solved: 0, used: [], ...loadJson(STATS_KEY) };
  used = new Set(stats.used);
  const saved = loadJson(STORAGE_KEY);
  // The whole board is saved, not just its seed: the next board depends on
  // which words are used up, so a seed alone would not rebuild the same one.
  if (saved?.board?.letters) showBoard(saved.board, saved.found);
  else newBoard();
  document.getElementById('new').addEventListener('click', () => newBoard());
  gridEl.addEventListener('pointerdown', onDown);
  gridEl.addEventListener('pointermove', onMove);
  gridEl.addEventListener('pointerup', onUp);
  gridEl.addEventListener('pointercancel', onUp);
}

function newBoard() {
  let next;
  try {
    next = generateBoard(index, { seed: Date.now(), used });
  } catch (err) {
    if (!(err instanceof OutOfWordsError)) throw err;
    // Every word has been played. Offer to start the dictionary over.
    if (!confirm('Все слова словаря пройдены! Начать заново?')) return;
    used = new Set();
    saveStats();
    next = generateBoard(index, { seed: Date.now(), used });
  }
  showBoard(next, []);
}

function showBoard(nextBoard, savedFound) {
  board = nextBoard;
  found = new Map(savedFound);
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
  selection = startSelection(cell, takenCells());
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

function onUp() {
  if (!selection.length) return;
  const i = matchWord(selection, board.words, new Set(found.keys()));
  if (i >= 0) {
    found.set(i, PALETTE[found.size % PALETTE.length]);
    used.add(board.words[i].word);
    selection = [];
    // A word can be found only once, so this fires once per board.
    if (found.size === board.words.length) stats.solved++;
    saveStats();
    saveState();
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

function render() {
  const colour = new Array(board.letters.length);
  for (const [i, c] of found) board.words[i].cells.forEach((cell) => { colour[cell] = c; });
  const picked = new Set(selection);
  cellEls.forEach((el, cell) => {
    el.classList.toggle('picked', picked.has(cell));
    el.style.background = picked.has(cell) ? '' : (colour[cell] ?? '');
  });
  const total = board.words.length;
  countEl.innerHTML = found.size === total
    ? '<b>Поле пройдено!</b>'
    : `Найдено <b>${found.size}</b> из ${total}`;
  solvedEl.textContent = `Полей: ${stats.solved} · слов: ${used.size} из ${totalWords(index)}`;
}

function saveState() {
  saveJson(STORAGE_KEY, { board, found: [...found] });
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
