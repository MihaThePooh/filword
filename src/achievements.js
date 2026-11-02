// Achievements: ranked goals with three stars each, paid in coins. They read
// the same lifetime counters as the statistics screen (stats.js), so there is
// one source of truth. Pure and side-effect free: the game calls evaluate after
// a counter changes, pays for anything newly earned, and saves.
//
// stats.awardCoins maps an achievement id -> coins already paid for it. Paying
// by coins, not by stars, lets goals and prices change: a player gets the
// difference between what the stars reached are worth now and what was paid,
// and nothing is ever taken back.

import { shopOf } from './shop.js';
import { plural } from './stats.js';

const form = (forms) => (n) => `${n} ${plural(n, ...forms)}`;

export const ACHIEVEMENTS = [
  { id: 'marathon', name: 'Марафонец', goal: form(['поле', 'поля', 'полей']),
    about: 'Проходи поля до конца: засчитывается каждое закрытое поле.',
    read: (s) => s.solved || 0, stars: [100, 350, 1000], coins: [300, 500, 1000] },
  { id: 'hunter', name: 'Охотник', goal: (n) => `${form(['слово', 'слова', 'слов'])(n)} на одном поле`,
    about: 'Найди много слов на одном поле: загаданные и бонусные считаются вместе. '
      + 'Рекорд держится на бонусных словах — ищи их.',
    read: (s) => s.maxWords || 0, stars: [15, 17, 20], coins: [200, 300, 500] },
  { id: 'bonus', name: 'Собиратель', goal: form(['бонусное слово', 'бонусных слова', 'бонусных слов']),
    about: 'Бонусное слово — настоящее слово из словаря, которое не загадано на поле. '
      + 'За каждое ещё и монеты сверху.',
    read: (s) => s.bonusFound || 0, stars: [25, 100, 300], coins: [50, 100, 150] },
  { id: 'erudite', name: 'Эрудит', goal: form(['толкование', 'толкования', 'толкований']),
    about: 'Нажимай на найденные слова и читай, что они значат.',
    read: (s) => s.defsOpened || 0, stars: [20, 100, 300], coins: [50, 100, 150] },
  { id: 'clean', name: 'Чистое поле', goal: (n) => `${form(['поле', 'поля', 'полей'])(n)} без подсказок`,
    about: 'Закрой поле, ни разу не нажав подсказку.',
    read: (s) => s.cleanBoards || 0, stars: [1, 10, 50], coins: [50, 250, 700] },
  { id: 'rich', name: 'Богач', goal: form(['монета', 'монеты', 'монет']),
    about: 'Считается общее количество заработанных монет за всё время.',
    read: (s) => s.coinsEarned || 0, stars: [1000, 5000, 15000], coins: [50, 500, 1000] },
  { id: 'collector', name: 'Коллекционер', goal: form(['фон', 'фона', 'фонов']),
    about: 'Покупай фоны в магазине.',
    read: (s) => shopOf(s).owned.length, stars: [3, 10, 30], coins: [100, 300, 1000] },
  { id: 'veteran', name: 'Ветеран', goal: form(['шафл', 'шафла', 'шафлов']),
    about: 'Пройди весь круг полей: слова перемешаются, и круг начнётся заново — это шафл.',
    read: (s) => s.shuffles || 0, stars: [1, 5, 30], coins: [1000, 5000, 30000] },
];

// What each star used to pay, for saves made before awardCoins existed:
// they recorded stars paid (stats.awards), priced by the first catalogue.
const LEGACY_COINS = {
  marathon: [50, 100, 150], hunter: [50, 100, 150], bonus: [50, 100, 150],
  erudite: [50, 100, 150], clean: [100, 250, 500], rich: [50, 100, 150],
  collector: [100, 250, 500],
};

const sum = (list, count) => list.slice(0, count).reduce((a, b) => a + b, 0);

// Coins already paid per achievement, converting an old stars-paid record.
function paidOf(s) {
  if (s.awardCoins) return { ...s.awardCoins };
  const paid = {};
  for (const [id, stars] of Object.entries(s.awards || {})) {
    if (LEGACY_COINS[id]) paid[id] = sum(LEGACY_COINS[id], Math.min(stars, 3));
  }
  return paid;
}

// How many stars (0..3) the current value reaches.
export function starsFor(a, stats) {
  const v = a.read(stats || {});
  return a.stars.reduce((count, t) => count + (v >= t ? 1 : 0), 0);
}

// Pay what newly reached stars are worth. Never mutates the input.
// Returns { stats, awarded }: awarded is empty when nothing changed, so the
// same object is handed back and the caller can skip a save.
export function evaluate(stats) {
  const s = stats || {};
  const paid = paidOf(s);
  let coins = s.coins || 0;
  const awarded = [];
  for (const a of ACHIEVEMENTS) {
    const now = starsFor(a, s);
    const due = sum(a.coins, now) - (paid[a.id] || 0);
    if (due > 0) {
      coins += due;
      paid[a.id] = (paid[a.id] || 0) + due;
      awarded.push({ id: a.id, name: a.name, star: now, coins: due });
    }
  }
  if (!awarded.length) return { stats: s, awarded };
  return { stats: { ...s, coins, awardCoins: paid }, awarded };
}

// Rows for the screen: what to show folded (name, stars, progress bar) and
// unfolded (description, progress text, each star's goal and reward).
// pct is the way to the next star; 100 once all three are collected.
export function achievementRows(stats) {
  const s = stats || {};
  return ACHIEVEMENTS.map((a) => {
    const stars = starsFor(a, s);
    const value = a.read(s);
    const next = stars < 3 ? a.stars[stars] : null;
    return {
      id: a.id,
      name: a.name,
      about: a.about,
      stars,
      value,
      next,
      coins: a.coins,
      goals: a.stars.map(a.goal),
      progress: next === null ? 'Все три звезды собраны' : `${value} / ${a.goal(next)}`,
      pct: next === null ? 100 : Math.min(100, Math.floor((value / next) * 100)),
    };
  });
}
