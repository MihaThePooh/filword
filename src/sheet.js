// Card with a word's definitions in the middle of the screen.
// Opens by tap on a found word (on the board or in the list under it);
// closes by tap anywhere outside the card or by Escape.

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
  }

  function close() {
    document.body.classList.remove('sheet-open');
  }

  // Close on click, not on pointerdown: closing at the touch would hide the
  // backdrop before the finger lifts, and the click would land on whatever is
  // under it - another word would open instead of the card just closing.
  backdrop.addEventListener('pointerdown', (e) => e.preventDefault());
  backdrop.addEventListener('click', close);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return { open, close, isOpen: () => document.body.classList.contains('sheet-open') };
}
