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
import { showLoader, overall } from './loader.js';
import { REWARD, PRICE, isBonusWord } from './rewards.js';
import { shuffle, cycleDone } from './progress.js';
import { MODES, currentMode, setMode } from './mode.js';
import { ripple, confetti, showWinCard, showShuffleCard } from './celebrate.js';
import { setupMenu } from './install.js';
import * as cloud from './cloud.js';
import {
  BACKGROUNDS, bgSrc, isOwned, activeId, canBuy, buy, setActive, applyTheme, tryOn,
} from './shop.js';
import { statRows } from './stats.js';
import { evaluate, achievementRows, mergeAwards } from './achievements.js';
import { createCoinFx } from './coinfx.js';
import { showAward } from './awardpop.js';
import { show, hide } from './sheets.js';
import { createClock } from './timer.js';

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
// Hint button is a lightbulb with the number of hints left.
const BULB_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.4 1 2.5h6c0-1.1.3-1.9 1-2.5A6 6 0 0 0 12 3Z"/></svg>`;
// Grown-up or kids version: board size, dictionary, save and cycle (mode.js).
const MODE = currentMode();
const CFG = MODES[MODE];
const STORAGE_KEY = CFG.stateKey;
const BOARD_SIZE = CFG.size;
// Shown in the menu, so it is easy to tell which version a phone runs.
// Must match CACHE in sw.js (a test checks it).
export const VERSION = 50;
const STATS_KEY = CFG.statsKey;
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
let coinFx; // the header counter: runs up coin by coin, waits for coins in the air
let used = new Set(); // every word ever found - never shown again

async function init() {
  document.getElementById('version').textContent = `Версия ${VERSION}`;
  setupMenu();
  setupModeSwitch();
  setupShop();
  setupTryOn();
  setupStats();
  setupAchievements();
  document.getElementById('logout').addEventListener('click', (e) => { e.preventDefault(); cloud.logout(); });
  // The save is fetched while the dictionary loads; the board waits for both.
  const synced = cloud.start();
  // Ask the browser not to evict the offline copy when the phone runs low on space.
  navigator.storage?.persist?.().catch(() => {});
  gridEl.style.setProperty('--size', BOARD_SIZE);
  // The cells live for the whole session: boards change only their letters.
  cellEls = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => {
    const el = document.createElement('div');
    el.className = 'cell';
    gridEl.appendChild(el);
    return el;
  });
  const loader = showLoader(cellEls, BOARD_SIZE, CFG.phrase);
  // The phrase shows the whole loading, not just the download (loader.js STAGES).
  const parts = { download: 0, prepare: 0, save: 0 };
  const report = () => loader.progress(overall(parts));
  synced.then(() => { parts.save = 1; report(); });
  try {
    const dict = await loadDictionary((f) => {
      // Size unknown: count it half done once bytes flow.
      parts.download = f ?? Math.max(parts.download, 0.5);
      report();
    }, CFG.dict);
    parts.download = 1;
    parts.prepare = 0.5; // unpacked and parsed
    report();
    // Let the letters paint before indexing holds the page for a moment.
    await new Promise((resolve) => setTimeout(resolve, 0));
    index = indexDictionary(dict);
    dictByWord = new Map(dict.map((e) => [e.w, e]));
    parts.prepare = 1;
    report();
  } catch (err) {
    await loader.done();
    countEl.textContent = 'Не удалось загрузить словарь';
    console.error(err);
    return;
  }
  // The save first, then the last letters: the phrase is lit to the end only
  // when the game can really start.
  await synced;
  await loader.done();
  stats = { solved: 0, used: [], coins: 0, ...loadJson(STATS_KEY) };
  // «Монет заработано» is counted only since 02.11.2026. Whatever is in the
  // wallet plus what was spent must have been earned, so older saves start
  // from that floor instead of zero.
  const earnedFloor = (stats.coins || 0) + (stats.coinsSpent || 0);
  if ((stats.coinsEarned || 0) < earnedFloor) stats.coinsEarned = earnedFloor;
  coinFx = createCoinFx({ counter: document.getElementById('coins'), number: coinEl, total: () => stats.coins });
  coinFx.reset();
  applyTheme(stats);
  warmBackgrounds();
  countEl.textContent = '';
  // Kids get bonus coins only for words of their own dictionary: the full
  // list of nouns has words a child should not meet.
  if (MODE === 'kids') bonusWords = new Set(dictByWord.keys());
  else loadBonusWords().then((set) => { bonusWords = set; }).catch((err) => console.warn('no bonus words', err));
  used = new Set(stats.used);
  const saved = loadJson(STORAGE_KEY);
  // The whole board is saved, not just its seed: the next board depends on
  // which words are used up, so a seed alone would not rebuild the same one.
  if (saved?.board?.letters) showBoard(saved.board, saved.found, saved.hint, saved.bonus, saved.log,
    saved.time ?? { ms: 0, last: null, timed: false });
  else newBoard();
  // Pay out anything already earned (progress from before achievements, or a
  // save synced from another phone) so stars and coins are up to date at once.
  // After the board exists: runAchievements redraws the header.
  runAchievements();
  actionEl.addEventListener('click', onAction);
  gridEl.addEventListener('pointerdown', onDown);
  gridEl.addEventListener('pointermove', onMove);
  gridEl.addEventListener('pointerup', onUp);
  gridEl.addEventListener('pointercancel', onUp);
}

// Menu item: the other version. Each keeps its own board, coins and progress.
function setupModeSwitch() {
  const item = document.getElementById('mode');
  item.innerHTML = MODE === 'kids'
    ? 'Взрослая версия<small>Поле 8×8, все слова</small>'
    : 'Детская версия<small>Поле 5×5, простые слова</small>';
  item.addEventListener('click', () => {
    setMode(MODE === 'kids' ? 'adult' : 'kids');
    location.reload();
  });
}

// Shop: backgrounds for the whole app. Opens from the cart in the header and
// from the menu; the catalogue and the economy live in shop.js.
// A board solved without a single hint counts toward the «Чистое поле» award.
let hintUsedThisBoard = false;

// Board time (timer.js): runs while the board is in play and on screen.
// lastFindAt - board time of the previous hidden word, for pauses between words.
// boardTimed - false for a board resumed from a save made before the timer:
// its earlier time is unknown, so it cannot set speed records.
const clock = createClock();
let lastFindAt = null;
let boardTimed = true;

// Fold the time run so far into «Время на полях».
function tickClock() { stats.totalMs = (stats.totalMs || 0) + clock.lap(); }
function stopClock() { stats.totalMs = (stats.totalMs || 0) + clock.pause(); }
function runClock() {
  if (board && found.size < board.words.length && document.visibilityState === 'visible') clock.start();
}

// Leaving the screen pauses the board and saves the time; coming back resumes.
function onScreenChange() {
  if (document.visibilityState === 'visible') { runClock(); return; }
  if (!clock.running()) return;
  stopClock();
  saveStats();
  saveState();
}
document.addEventListener('visibilitychange', onScreenChange);
addEventListener('pagehide', onScreenChange);

const keepMin = (key, v) => { if (!(stats[key] > 0) || v < stats[key]) stats[key] = v; };
const keepMax = (key, v) => { if (!(stats[key] > v)) stats[key] = v; };

// Pay out any newly earned achievement stars and tell the player. Safe to call
// as often as we like: evaluate pays only what is not paid yet (awardCoins).
// Rewards are earned coins too, so they count toward «Богач» - which may unlock
// a star of its own, hence a few passes.
function runAchievements() {
  const awarded = [];
  for (let pass = 0; pass < 3; pass++) {
    const res = evaluate(stats);
    if (!res.awarded.length) break;
    stats = res.stats;
    const got = res.awarded.reduce((n, x) => n + x.coins, 0);
    stats.coinsEarned = (stats.coinsEarned || 0) + got;
    awarded.push(...res.awarded);
  }
  if (!awarded.length) return;
  saveStats();
  renderHeader();
  // The counter waits: each banner sends its coins flying when it is shown.
  for (const item of mergeAwards(awarded)) {
    coinFx.hold(item.coins);
    showAward(item, slotEl, (from) => coinFx.fly(item.coins, from, { isHeld: true }));
  }
}

// A word already found on this board: a bonus word or a hidden one.
function alreadyFound(word) {
  if (bonusFound.includes(word)) return true;
  for (const i of found.keys()) if (board.words[i].word === word) return true;
  return false;
}

// The longest word ever found, hidden or bonus.
function noteLongest(word) {
  if ([...word].length > [...(stats.longestWord || '')].length) stats.longestWord = word;
}

// Record of words on one board: hidden and bonus words found here together.
function noteBoardRecord() {
  const onBoard = found.size + bonusFound.length;
  if (onBoard > (stats.maxWords || 0)) stats.maxWords = onBoard;
}

// Achievements: ranked goals from achievements.js, opened from the menu.
// Folded, a row shows the name, the stars and a green bar of the way to the
// next star. A tap unfolds it like an accordion: what it is, how to get it,
// and three stars - a tap on a star tells its goal and reward.
let achRows = [];

function setupAchievements() {
  const wrap = document.getElementById('achwrap');
  const list = document.getElementById('achlist');
  document.getElementById('achItem').addEventListener('click', () => {
    hide(document.getElementById('menu'));
    renderAchievements();
    show(wrap);
  });
  wrap.addEventListener('click', (e) => { if (e.target === wrap) hide(wrap); });
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.arow');
    if (!row) return;
    const star = e.target.closest('.astar');
    if (star) {
      showStarInfo(row, Number(star.dataset.k));
      return;
    }
    if (e.target.closest('.ahead')) row.classList.toggle('open');
  });
}

function renderAchievements() {
  achRows = achievementRows(stats);
  document.getElementById('achlist').innerHTML = achRows.map((r) => {
    const stars = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
    const starBtns = r.goals.map((_, k) => `<button type="button" class="astar${k < r.stars ? ' got' : ''}" `
      + `data-k="${k}" aria-label="Звезда ${k + 1}">${k < r.stars ? '★' : '☆'}</button>`).join('');
    return `<div class="arow" data-id="${r.id}">`
      + `<button type="button" class="ahead"><b>${r.name}</b><span class="astars">${stars}</span></button>`
      + `<div class="abar"><i style="width:${r.pct}%"></i></div>`
      + '<div class="abody"><div class="ainner">'
      + `<p class="aabout">${r.about}</p>`
      + `<div class="aprog">${r.progress}</div>`
      + `<div class="astarbtns">${starBtns}</div>`
      + '<div class="astarinfo">Нажми на звезду — покажу, за что она и сколько даёт.</div>'
      + '</div></div></div>';
  }).join('');
}

function showStarInfo(row, k) {
  const r = achRows.find((x) => x.id === row.dataset.id);
  if (!r) return;
  row.querySelectorAll('.astar').forEach((el, i) => el.classList.toggle('sel', i === k));
  row.querySelector('.astarinfo').innerHTML = `<b>${'★'.repeat(k + 1)}</b> — ${r.goals[k]}`
    + ` · <span class="acoin"><span class="coin"></span>+${r.coins[k]}</span>`;
}

// Statistics: lifetime counters from stats.js, opened from the menu.
function setupStats() {
  const wrap = document.getElementById('statwrap');
  document.getElementById('statsItem').addEventListener('click', () => {
    hide(document.getElementById('menu'));
    renderStats();
    show(wrap);
  });
  wrap.addEventListener('click', (e) => { if (e.target === wrap) hide(wrap); });
}

function renderStats() {
  document.getElementById('statlist').innerHTML = statRows(stats)
    .map((r) => `<div class="strow"><span>${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}</span>`
      + `<b>${r.value}</b></div>`).join('');
}

function setupShop() {
  const wrap = document.getElementById('shopwrap');
  const open = () => { renderShop(); show(wrap); };
  document.getElementById('shop').addEventListener('click', open);
  document.getElementById('shopItem').addEventListener('click', () => {
    hide(document.getElementById('menu'));
    open();
  });
  wrap.addEventListener('click', (e) => { if (e.target === wrap) hide(wrap); });
}

function renderShop() {
  const shelf = document.getElementById('shelf');
  shelf.innerHTML = '';
  const active = activeId(stats);
  for (const b of BACKGROUNDS) {
    const owned = isOwned(stats, b.id);
    const on = active === b.id;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `sitem${owned ? ' owned' : ''}${on ? ' on' : ''}`;
    const price = owned
      ? `<div class="spr have">${on ? 'стоит' : 'надеть'}</div>`
      : `<div class="spr${canBuy(stats, b.id) ? '' : ' cant'}"><span class="coin"></span>${b.price}</div>`;
    tile.innerHTML = `<div class="sthumb" style="background-image:url('${bgSrc(b.id)}')"></div>`
      + `<div class="snm">${b.name}</div>${price}`;
    tile.addEventListener('click', () => onShopTile(b.id));
    shelf.appendChild(tile);
  }
  // Own photo with a soft filter - a later feature, shown so the shop feels whole.
  const photo = document.createElement('button');
  photo.type = 'button';
  photo.className = 'sitem photo-item';
  photo.innerHTML = '<div class="sthumb"></div><div class="snm">Поставить своё фото</div>'
    + '<div class="spr">Скоро</div>';
  photo.addEventListener('click', () => shopNote(photo, 'Свои фото — скоро'));
  shelf.appendChild(photo);
}

// Tap a background: wear or take off an owned one; a new one is tried on first.
function onShopTile(id) {
  if (!isOwned(stats, id)) { startTryOn(id); return; }
  stats = setActive(stats, activeId(stats) === id ? null : id);
  saveStats();
  applyTheme(stats);
  render();
  renderShop();
}

// Try-on: the shop steps aside, the background goes on the whole game and a bar
// at the bottom offers «Купить» or «Назад». Nothing is saved until bought, so a
// reload or leaving the game simply drops the try-on. The phone's Back button
// works as «Назад» (backstack.js through show).
let trying = null; // id of the background on try, or null
let shopScroll = 0; // where the shop was scrolled, to come back to the same card
function startTryOn(id) {
  const info = tryOn(stats, id);
  if (!info || trying) return;
  trying = id;
  shopScroll = document.querySelector('#shopwrap .shoppanel').scrollTop;
  hide(document.getElementById('shopwrap'));
  applyTheme(stats, id);
  const bar = document.getElementById('tryon');
  bar.querySelector('.tname').textContent = info.name;
  bar.querySelector('.tprice').innerHTML = `<span class="coin"></span>${info.price}`;
  const buyBtn = document.getElementById('tryBuy');
  buyBtn.disabled = info.short > 0;
  buyBtn.textContent = info.short > 0 ? `Не хватает ${info.short}` : 'Купить';
  show(bar, () => endTryOn(false));
}

// Leave the try-on. bought - the background stays and the game goes on;
// otherwise the old background comes back and the shop opens where it was.
function endTryOn(bought) {
  if (!trying) return;
  trying = null;
  hide(document.getElementById('tryon'));
  applyTheme(stats);
  if (bought) return;
  show(document.getElementById('shopwrap'));
  // display:none may forget the scroll; put the shop back at the tried card.
  document.querySelector('#shopwrap .shoppanel').scrollTop = shopScroll;
}

function buyTried() {
  const id = trying;
  const next = id && buy(stats, id);
  if (!next) return;
  stats.coinsSpent = (stats.coinsSpent || 0) + (stats.coins - next.coins);
  next.coinsSpent = stats.coinsSpent;
  showSpend(stats.coins - next.coins);
  stats = next;
  runAchievements();
  saveStats();
  render();
  renderShop();
  endTryOn(true);
  toast(`Фон «${tryOn(stats, id).name}» теперь твой`);
}

function setupTryOn() {
  document.getElementById('tryBuy').addEventListener('click', buyTried);
  document.getElementById('tryBack').addEventListener('click', () => endTryOn(false));
}

// A short message centred over a shop card, above the shop sheet.
function shopNote(tile, text) {
  const box = (tile.querySelector('.sthumb') ?? tile).getBoundingClientRect();
  const note = document.createElement('div');
  note.className = 'shopnote';
  note.textContent = text;
  note.style.left = `${box.left + box.width / 2}px`;
  note.style.top = `${box.top + box.height / 2}px`;
  document.body.appendChild(note);
  note.addEventListener('animationend', () => note.remove());
}

// Warm up the shop in the background: once the game is up, quietly fetch every
// background so the service worker caches it. Then the shop opens instantly and
// works fully offline, without slowing the game's own start or bloating install.
function warmBackgrounds() {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  idle(() => { for (const b of BACKGROUNDS) new Image().src = bgSrc(b.id); });
}

function newBoard() {
  if (cycleDone(stats, CFG.cycle)) {
    showShuffleCard(stats, doShuffle);
    return;
  }
  let next;
  try {
    next = generateBoard(index, { size: BOARD_SIZE, seed: Date.now(), used });
  } catch (err) {
    if (!(err instanceof OutOfWordsError)) throw err;
    // Should not happen with the cycle below the dictionary size, but just in case.
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
function showBoard(nextBoard, savedFound, savedHint, savedBonus, savedLog, savedTime) {
  if (board) stopClock(); // the board being left keeps its time in the total
  hintUsedThisBoard = savedTime?.hinted ?? false;
  clock.reset(savedTime?.ms ?? 0);
  lastFindAt = savedTime?.last ?? null;
  boardTimed = savedTime ? savedTime.timed !== false : true;
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
    runClock();
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
    stats.bonusFound = (stats.bonusFound || 0) + 1;
    noteLongest(word);
    noteBoardRecord();
    runAchievements();
    wordLog.push({ b: word });
    renderWords(true);
    selection = [];
    addCoins(REWARD.bonus, cellEls[lastCell]);
    toast(`Бонусное слово «${word}» +${REWARD.bonus}`);
    saveState();
    render();
  } else if (alreadyFound(selection.map((c) => board.letters[c]).join(''))) {
    // Found before on this board: say so. Without it a repeat just shook,
    // as if the game did not know the word («лом», 02.11.2026).
    toast(`«${selection.map((c) => board.letters[c]).join('')}» уже найдено`);
    selection = [];
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
  stats.defsOpened = (stats.defsOpened || 0) + 1;
  saveStats();
  runAchievements();
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
  stats.wordsFound = (stats.wordsFound || 0) + 1;
  noteLongest(board.words[i].word);
  noteBoardRecord();
  wordLog.push({ i });
  renderWords(true);
  used.add(board.words[i].word);
  // A word can be found only once, so this fires once per board.
  const solvedNow = found.size === board.words.length;
  tickClock();
  const at = clock.elapsed();
  if (lastFindAt !== null) {
    keepMin('fastestGap', at - lastFindAt);
    keepMax('slowestGap', at - lastFindAt);
  }
  lastFindAt = at;
  if (solvedNow) {
    stopClock();
    stats.solved++;
    if (!hintUsedThisBoard) stats.cleanBoards = (stats.cleanBoards || 0) + 1;
    if (!bonusFound.length) stats.sniperBoards = (stats.sniperBoards || 0) + 1;
    if (boardTimed) {
      keepMin('fastestBoard', at);
      keepMax('slowestBoard', at);
      if (!hintUsedThisBoard) keepMin('fastestClean', at);
    }
  }
  addCoins(REWARD.word + (solvedNow ? REWARD.board : 0), cellEls[board.words[i].cells.at(-1)]);
  saveStats();
  saveState();
  render();
  runAchievements();
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
      showWinCard({ solved: stats.solved, words: board.words.length, ms: boardTimed ? clock.elapsed() : 0 },
        () => newBoard());
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
  pulse(actionEl);
  // Every press costs coins; nothing to show - nothing charged.
  if (stats.coins < PRICE.hint) {
    toast(`Подсказка стоит ${PRICE.hint} монет`);
    return;
  }
  const res = nextHint(hint, board.words, new Set(found.keys()));
  if (res.hint === hint) return;
  stats.coins -= PRICE.hint;
  stats.hintsUsed = (stats.hintsUsed || 0) + 1;
  hintUsedThisBoard = true;
  stats.coinsSpent = (stats.coinsSpent || 0) + PRICE.hint;
  showSpend(PRICE.hint);
  saveStats();
  hint = res.hint;
  if (res.completed >= 0) markFound(res.completed);
  else {
    saveState();
    render();
  }
}

// A short squeeze of a button so a press is felt even before coins move.
function pulse(el) {
  el.classList.remove('pressed');
  void el.offsetWidth; // restart the animation on a quick second press
  el.classList.add('pressed');
}

// Coins spent: the counter drops at once and a "-amount" coin pill falls out
// of it and fades, so the price is seen. Call after stats.coins is reduced.
function showSpend(amount) {
  coinFx.spend(amount);
  const counter = document.getElementById('coins');
  pulse(counter);
  const box = counter.getBoundingClientRect();
  const drop = document.createElement('div');
  drop.className = 'coin-loss';
  drop.innerHTML = `<span class="coin"></span><span>−${amount}</span>`;
  drop.style.left = `${box.left + box.width / 2}px`;
  drop.style.top = `${box.bottom + 2}px`;
  document.body.appendChild(drop);
  drop.addEventListener('animationend', () => drop.remove());
}

// Coins fly from the cell to the counter in the header.
function addCoins(amount, fromEl) {
  stats.coins += amount;
  stats.coinsEarned = (stats.coinsEarned || 0) + amount;
  saveStats();
  coinFx.fly(amount, fromEl);
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
    actionEl.innerHTML = `${BULB_SVG}<span>${left}</span>`;
    actionEl.disabled = left === 0;
  }
  const rank = stats.shuffles ? ` · шафл ${stats.shuffles}` : '';
  solvedEl.textContent = `Полей ${stats.solved}/${CFG.cycle}${rank}`;
}

function saveState() {
  const time = { ms: clock.elapsed(), last: lastFindAt, timed: boardTimed, hinted: hintUsedThisBoard };
  saveJson(STORAGE_KEY, { board, found: [...found], hint, bonus: bonusFound, log: wordLog, time });
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
