// Bottom card with a word's definitions.
// Opens by tap on a found word; closes by tap outside or a swipe down.

const CLOSE_DISTANCE = 60; // px of downward swipe that closes the card

export function createSheet() {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const sheet = document.createElement('section');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="grip"></div>
    <div class="word"><span class="dot"></span><span class="title"></span></div>
    <ol class="defs"></ol>
    <div class="src">Толкование: Викисловарь</div>`;
  document.body.append(backdrop, sheet);

  const dot = sheet.querySelector('.dot');
  const title = sheet.querySelector('.title');
  const defs = sheet.querySelector('.defs');

  function open(word, colour, definitions) {
    dot.style.background = colour;
    title.textContent = word;
    defs.innerHTML = '';
    for (const d of definitions ?? []) {
      const li = document.createElement('li');
      li.textContent = d; // textContent, not innerHTML: dictionary text is not trusted markup
      defs.appendChild(li);
    }
    sheet.scrollTop = 0;
    sheet.style.transform = '';
    document.body.classList.add('sheet-open');
  }

  function close() {
    sheet.style.transform = '';
    document.body.classList.remove('sheet-open');
  }

  backdrop.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    close();
  });

  // Swipe down: the card follows the finger, far enough - it closes,
  // not far enough - it springs back.
  let startY = null;
  sheet.addEventListener('pointerdown', (e) => {
    // Let long text scroll; drag only when the card is scrolled to the top.
    if (sheet.scrollTop > 0) return;
    startY = e.clientY;
    sheet.setPointerCapture(e.pointerId);
    sheet.classList.add('dragging');
  });
  sheet.addEventListener('pointermove', (e) => {
    if (startY === null) return;
    const dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = (e) => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    startY = null;
    sheet.classList.remove('dragging');
    if (dy > CLOSE_DISTANCE) close();
    else sheet.style.transform = '';
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);

  return { open, close, isOpen: () => document.body.classList.contains('sheet-open') };
}
