// Loading screen: while the dictionary downloads, a tiny filword solves itself.
// An invisible finger runs along a snake path, each finished word gets its
// colour - the same thing the player will do in a moment.

// Snake through a 6x3 grid: ФИЛВОРД · БЕЗ · РЕКЛАМЫ, and a "!" at the end.
export const LETTERS = 'ФИЛВОРДБЕЗРЕКЛАМЫ!';
export const WORDS = [[0, 7], [7, 10], [10, 17]]; // [start, end) in LETTERS
const COLS = 6;
const COLOURS = ['#f6c8b8', '#c9e4c5', '#bcd7ee'];
const STEP_MS = 150; // finger moves one cell
const PAUSE_MS = 900; // the solved board stays a moment before the next round

const QUIPS = [
  'Завариваю буквы…',
  'Пересчитываю 20 тысяч слов…',
  'Прячу коромысло…',
  'Выгоняю рекламу…',
  'Расставляю ударения…',
  'Бужу Викисловарь…',
  'Перемешиваю гласные…',
];

// Snake order: rows go left to right, then right to left.
export function cellPosition(i) {
  const row = Math.floor(i / COLS);
  const col = row % 2 ? COLS - 1 - (i % COLS) : i % COLS;
  return { row, col };
}

export function showLoader(root = document.body) {
  const el = document.createElement('div');
  el.className = 'loader';
  el.innerHTML = `
    <div class="loader-grid"></div>
    <div class="loader-bar"><div class="loader-fill"></div></div>
    <div class="loader-quip"></div>`;
  const grid = el.querySelector('.loader-grid');
  const fill = el.querySelector('.loader-fill');
  const quip = el.querySelector('.loader-quip');
  const cells = [...LETTERS].map((ch, i) => {
    const cell = document.createElement('div');
    cell.className = 'loader-cell';
    cell.textContent = ch;
    const { row, col } = cellPosition(i);
    cell.style.gridRow = row + 1;
    cell.style.gridColumn = col + 1;
    grid.appendChild(cell);
    return cell;
  });
  root.appendChild(el);
  const shownAt = performance.now();

  let quipIndex = Math.floor(Math.random() * QUIPS.length);
  quip.textContent = QUIPS[quipIndex];
  const quipTimer = setInterval(() => {
    quipIndex = (quipIndex + 1) % QUIPS.length;
    quip.textContent = QUIPS[quipIndex];
  }, 1600);

  // One finger step per tick. A word is coloured when the finger leaves its last letter.
  let step = 0;
  let timer = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function paintWord(w) {
    const [from, to] = WORDS[w];
    for (let i = from; i < to; i++) {
      cells[i].classList.remove('picked');
      cells[i].style.background = COLOURS[w];
    }
  }
  function tick() {
    if (step === LETTERS.length) {
      timer = setTimeout(() => {
        for (const c of cells) { c.style.background = ''; c.classList.remove('picked'); }
        step = 0;
        tick();
      }, PAUSE_MS);
      return;
    }
    cells[step].classList.add('picked');
    const w = WORDS.findIndex(([, to]) => to === step + 1);
    step++;
    timer = setTimeout(() => {
      if (w >= 0) paintWord(w);
      tick();
    }, STEP_MS);
  }
  if (reduced) WORDS.forEach((_, w) => paintWord(w));
  else tick();

  return {
    // fraction 0..1, or null when the size is unknown (stripes instead of a bar)
    progress(fraction) {
      el.classList.toggle('unknown', fraction == null);
      if (fraction != null) fill.style.width = `${Math.round(Math.min(1, fraction) * 100)}%`;
    },
    // Fades out. "?loader" in the address keeps it for a while - to look at it.
    done() {
      fill.style.width = '100%';
      const hold = new URLSearchParams(location.search).has('loader') ? 8000 : 0;
      const wait = Math.max(0, shownAt + hold - performance.now());
      return new Promise((resolve) => setTimeout(() => {
        el.classList.add('hide');
        setTimeout(() => {
          clearTimeout(timer);
          clearInterval(quipTimer);
          el.remove();
          resolve();
        }, 350);
      }, wait));
    },
  };
}
