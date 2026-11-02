// The coin counter in the header: it never jumps, it runs up one coin at a
// time (100, 101, 102 ... 105), so the player sees coins pile up. Coins still
// in the air are "held": the counter does not count them until they land.
//
// rollStep is pure (tested without a browser); createCoinFx drives the page.

// How many numbers a second the counter runs: small sums slow enough to read
// every number, big ones (+1000) fast so the run stays under two seconds.
export const rollRate = (diff) => Math.max(15, Math.abs(diff) * 3);

// One frame of the run: move `shown` toward `target` by what dt (ms) allows.
// `carry` keeps the fraction of a coin between frames.
export function rollStep(shown, target, dt, carry = 0) {
  const diff = target - shown;
  if (!diff) return { shown, carry: 0 };
  const go = carry + (rollRate(diff) * dt) / 1000;
  const whole = Math.min(Math.abs(diff), Math.floor(go));
  return { shown: shown + Math.sign(diff) * whole, carry: whole === Math.abs(diff) ? 0 : go - whole };
}

// Split `amount` coins over `flights` flying coins: how many each one brings.
export function shares(amount, flights) {
  const out = [];
  for (let k = 0; k < flights; k++) {
    out.push(Math.round((amount * (k + 1)) / flights) - Math.round((amount * k) / flights));
  }
  return out;
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// counter: the .coins box; number: the span with the digits;
// total: () => coins the player really has (stats.coins).
export function createCoinFx({ counter, number, total }) {
  let shown = total();
  let held = 0;
  let frame = 0;
  let carry = 0;
  let last = 0;

  const paint = () => { number.textContent = shown; };
  const target = () => Math.max(0, total() - held);

  function tick(now) {
    const r = rollStep(shown, target(), Math.min(now - last, 100), carry);
    last = now;
    carry = r.carry;
    if (r.shown !== shown) {
      shown = r.shown;
      paint();
    }
    if (shown !== target()) frame = requestAnimationFrame(tick);
    else frame = 0;
  }

  // Run the counter to what is not in the air any more.
  function roll() {
    if (reduced()) {
      shown = target();
      paint();
      return;
    }
    if (frame) return;
    last = performance.now();
    carry = 0;
    frame = requestAnimationFrame(tick);
  }

  function bump() {
    counter.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], 200);
  }

  // Coins already added to stats fly from `from` (an element) to the counter.
  // isHeld: the caller held them earlier (hold()) so the counter waited.
  function fly(amount, from, { isHeld = false } = {}) {
    if (!isHeld) held += amount;
    let left = amount;
    const land = (n) => {
      n = Math.min(n, left);
      left -= n;
      held = Math.max(0, held - n);
      roll();
    };
    const box = from?.isConnected ? from.getBoundingClientRect() : null;
    if (!box || reduced()) {
      land(left);
      return;
    }
    const goal = counter.getBoundingClientRect();
    const flights = Math.min(amount, 8);
    const parts = shares(amount, flights);
    const x0 = box.left + box.width / 2;
    const y0 = box.top + box.height / 2;
    const x1 = goal.left + 10;
    const y1 = goal.top + goal.height / 2;
    parts.forEach((part, k) => {
      const coin = document.createElement('span');
      coin.className = 'coin flying';
      document.body.appendChild(coin);
      coin.animate([
        { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${x0 + (Math.random() - 0.5) * 60}px, ${y0 - 40}px) scale(1.2)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.8)`, opacity: 1 },
      ], { duration: 700, delay: k * 70, easing: 'ease-in' }).finished.then(() => {
        coin.remove();
        land(part);
        bump();
      }, () => coin.remove());
    });
    // Safety net: an interrupted animation must not leave coins held forever.
    setTimeout(() => land(left), 700 + flights * 70 + 150);
  }

  return {
    roll,
    fly,
    // Coins already in stats that will fly later (achievement banner).
    hold(amount) { held += amount; },
    // Coins spent: the counter drops at once, no run.
    spend(amount) {
      shown = Math.max(0, shown - amount);
      paint();
      roll();
    },
    // A whole new number (other version, synced save): show it at once.
    reset() {
      held = 0;
      shown = total();
      paint();
    },
    get shown() { return shown; },
  };
}
