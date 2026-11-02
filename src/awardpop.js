// A small celebration for an achievement star: a banner over the board (where
// «Собери слово по-другому» shows) with the name, three stars - the new ones
// pop in one by one with sparkles - and the reward pill, from which the coins
// fly to the counter. Several at once wait in a queue, one banner at a time.
// Timings doubled on 02.11.2026: at first it flew by too fast to follow.

const queue = [];
let busy = false;

const POP_IN = 700; // banner bounces in, then the first new star
const STAR_GAP = 640; // between new stars
const COINS_AFTER = 600; // reward pill shows, then the coins take off
const STAY = 3000; // after the coins leave, before the banner fades
const FADE = 500;

// item: { name, from, star, coins } from mergeAwards; anchor: the board slot;
// onCoins(el): called once, when the coins should fly out of el.
export function showAward(item, anchor, onCoins) {
  queue.push({ item, anchor, onCoins });
  if (!busy) next();
}

function next() {
  const job = queue.shift();
  if (!job) {
    busy = false;
    document.body.classList.remove('awarding');
    return;
  }
  busy = true;
  document.body.classList.add('awarding');
  play(job, next);
}

function play({ item, anchor, onCoins }, done) {
  const el = document.createElement('div');
  el.className = 'award';
  el.setAttribute('role', 'status');
  const fresh = Math.max(1, item.star - item.from);
  const stars = [0, 1, 2].map((k) => {
    const cls = k < item.from ? 'got' : k < item.star ? 'new' : '';
    const delay = k < item.from || k >= item.star ? 0 : POP_IN + (k - item.from) * STAR_GAP;
    const rays = cls === 'new' ? '<i></i>'.repeat(8) : '';
    return `<span class="award-star ${cls}" style="--d:${delay}ms">★${rays}</span>`;
  }).join('');
  const pillAt = POP_IN + fresh * STAR_GAP;
  el.innerHTML = `<div class="award-cap">Достижение!</div>`
    + `<div class="award-name">${item.name}</div>`
    + `<div class="award-stars">${stars}</div>`
    + `<div class="award-gain" style="--d:${pillAt}ms"><span class="coin"></span>+${item.coins}</div>`;
  const box = anchor.getBoundingClientRect();
  el.style.left = `${box.left + box.width / 2}px`;
  el.style.top = `${box.top + box.height / 2}px`;
  document.body.appendChild(el);

  const pill = el.querySelector('.award-gain');
  let sent = false;
  const send = () => {
    if (sent) return;
    sent = true;
    onCoins(pill);
  };
  const flyAt = pillAt + COINS_AFTER;
  setTimeout(send, flyAt);
  setTimeout(() => el.classList.add('leaving'), flyAt + STAY);
  setTimeout(() => {
    send(); // never leave coins held, whatever happened
    el.remove();
    done();
  }, flyAt + STAY + FADE);
}
