// Card with a word's definitions in the middle of the screen.
// Opens by tap on a found word (on the board or in the list under it);
// closes by tap anywhere outside the card or by Escape.

import { opened, closed } from './backstack.js';

const GHOST_CLICK_MS = 400;

export function createSheet() {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const sheet = document.createElement('section');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.innerHTML = `
    <div class="word"><span class="dot"></span><span class="title"></span></div>
    <ol class="defs"></ol>
    <p class="note"></p>
    <a class="src" target="_blank" rel="noopener">Толкование: Викисловарь</a>`;
  document.body.append(backdrop, sheet);

  const dot = sheet.querySelector('.dot');
  const title = sheet.querySelector('.title');
  const defs = sheet.querySelector('.defs');
  const note = sheet.querySelector('.note');
  const src = sheet.querySelector('.src');

  // note: shown instead of definitions when the game has none (bonus words).
  function open(word, colour, definitions, stressed, noteText = '') {
    dot.style.background = colour;
    title.textContent = stressed ?? word; // with the stress mark when known
    // The source article of this very word.
    src.href = `https://ru.wiktionary.org/wiki/${encodeURIComponent(word)}`;
    defs.innerHTML = '';
    for (const d of definitions ?? []) {
      const li = document.createElement('li');
      li.textContent = d; // textContent, not innerHTML: dictionary text is not trusted markup
      defs.appendChild(li);
    }
    note.textContent = noteText;
    sheet.scrollTop = 0;
    document.body.classList.add('sheet-open');
    openedAt = performance.now();
    opened(sheet, close);
  }

  let closedAt = -Infinity;
  let openedAt = -Infinity;
  function close() {
    closed(sheet);
    if (document.body.classList.contains('sheet-open')) closedAt = performance.now();
    document.body.classList.remove('sheet-open');
  }
  // Some phones deliver a late "ghost" click after the card has gone.
  // Taps right after closing are ignored by the game.
  const justClosed = () => performance.now() - closedAt < GHOST_CLICK_MS;

  // Close on click, not on pointerdown: closing at the touch would hide the
  // backdrop before the finger lifts, and the click would land on whatever is
  // under it - another word would open instead of the card just closing.
  backdrop.addEventListener('pointerdown', (e) => e.preventDefault());
  // A tap on the board opens the card when the finger lifts; the browser's
  // click for that same tap follows and would land on the fresh backdrop,
  // closing the card at once. Clicks right after opening are not closes.
  backdrop.addEventListener('click', () => {
    if (performance.now() - openedAt >= GHOST_CLICK_MS) close();
  });
  // The tap that opened the card may lift its finger right over the link
  // (a letter low on the board sits under it): that click must not open
  // Викисловарь. Only a deliberate tap on the open card does.
  src.addEventListener('click', (e) => {
    if (performance.now() - openedAt < GHOST_CLICK_MS) e.preventDefault();
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return { open, close, justClosed, isOpen: () => document.body.classList.contains('sheet-open') };
}
