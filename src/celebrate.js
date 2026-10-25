// Celebration when a board is solved: a ripple over the cells,
// confetti, and a card with praise.

const PRAISE = [
  'Молодец!', 'Блестяще!', 'Ты в ударе!', 'Вот это да!', 'Мастер слова!',
  'Великолепно!', 'Чисто сработано!', 'Словарь трепещет!', 'Браво!', 'Огонь!',
];
const COLOURS = ['#f6c8b8', '#c9e4c5', '#bcd7ee', '#f3e2a9', '#e2cdee', '#f7d1e0',
  '#e0a040', '#7fb3d5', '#e57373', '#81c784'];

// People who turned animations off in the phone settings get a calm version.
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cells pop one after another, like a wave spreading from the last found cell.
export function ripple(cellEls, size, fromCell) {
  if (reducedMotion()) return;
  const r0 = Math.floor(fromCell / size);
  const c0 = fromCell % size;
  cellEls.forEach((el, cell) => {
    const dist = Math.hypot(Math.floor(cell / size) - r0, (cell % size) - c0);
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.18)', filter: 'brightness(1.12)' },
        { transform: 'scale(1)' }],
      { duration: 450, delay: dist * 55, easing: 'ease-out' },
    );
  });
}

// Confetti on a full-screen canvas: two cannons from the lower corners,
// a burst from the middle, then a rain from the top. Pieces are rectangles,
// circles and stars; they fly, fall with gravity, spin and fade.
export function confetti() {
  if (reducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = innerWidth;
  const H = innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const pieces = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  function add(x, y, angle, speed, delay) {
    pieces.push({
      x, y, delay,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: rand(6, 12),
      rot: rand(0, Math.PI),
      spin: rand(-0.3, 0.3),
      shape: ['rect', 'rect', 'circle', 'star'][Math.floor(Math.random() * 4)],
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    });
  }
  // Corner cannons, aimed up and inwards.
  for (let i = 0; i < 110; i++) {
    add(0, H * 0.9, -Math.PI / 2 + rand(0.2, 0.7), rand(12, 22), 0);
    add(W, H * 0.9, -Math.PI / 2 - rand(0.2, 0.7), rand(12, 22), 0);
  }
  // Burst from the middle, in all directions, a moment later.
  for (let i = 0; i < 120; i++) add(W / 2, H * 0.45, rand(0, Math.PI * 2), rand(4, 14), 350);
  // Rain from above the screen.
  for (let i = 0; i < 90; i++) add(rand(0, W), rand(-60, -10), Math.PI / 2, rand(1, 3), rand(500, 1600));

  function star(r) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI) / 5 - Math.PI / 2;
      const rr = k % 2 ? r * 0.45 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  const start = performance.now();
  const DURATION = 4200;
  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - DURATION * 0.65) / (DURATION * 0.35));
    for (const p of pieces) {
      if (t < p.delay) continue;
      p.vy += 0.3; // gravity
      p.vx *= 0.985; // air drag
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      // Squash by the angle: looks like a paper flake flipping over.
      ctx.scale(1, Math.cos(p.rot * 2));
      ctx.fillStyle = p.colour;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        star(p.size * 0.7);
      } else {
        ctx.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7);
      }
      ctx.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

// 1 слово, 2 слова, 5 слов.
export function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// The card in the middle of the screen. Resolves when it is closed;
// onNext is called when the player taps "Следующее поле".
export function showWinCard({ solved, words }, onNext) {
  const overlay = document.createElement('div');
  overlay.className = 'win';
  const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
  overlay.innerHTML = `
    <div class="win-card">
      <div class="win-title"></div>
      <div class="win-stats"></div>
      <button class="win-next" type="button">Следующее поле</button>
      <div class="win-hint">Тапни мимо, чтобы посмотреть слова</div>
    </div>`;
  overlay.querySelector('.win-title').textContent = praise;
  overlay.querySelector('.win-stats').textContent = `Поле №${solved} · ${words} ${plural(words, 'слово', 'слова', 'слов')}`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 250);
  };
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('.win-next')) {
      close();
      onNext();
    } else if (!e.target.closest('.win-card')) {
      close();
    }
  });
}

// The cycle is played. One button: shuffle and start over.
export function showShuffleCard(stats, onShuffle) {
  const overlay = document.createElement('div');
  overlay.className = 'win';
  const next = (stats.shuffles ?? 0) + 1;
  overlay.innerHTML = `
    <div class="win-card">
      <div class="win-title">Круг пройден!</div>
      <div class="win-stats"></div>
      <button class="win-next" type="button">Шафл!</button>
      <div class="win-hint">Слова перемешаются, поля начнутся с первого.<br>Монеты останутся.</div>
    </div>`;
  overlay.querySelector('.win-stats').textContent =
    `Все ${stats.solved} ${plural(stats.solved, 'поле', 'поля', 'полей')} пройдены. Ты получишь ранг «шафл ${next}».`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  overlay.querySelector('.win-next').addEventListener('click', () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 250);
    onShuffle();
  });
}
