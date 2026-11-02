// Achievements: ranked goals with three stars each, paid in coins. They read
// the same lifetime counters as the statistics screen (stats.js), so there is
// one source of truth. Pure and side-effect free: the game calls evaluate after
// a counter changes, pays for any newly reached star, and saves.
//
// stats.awards maps an achievement id -> how many stars have already been paid,
// so coins are granted once and the check is safe to run as often as we like.

import { shopOf } from './shop.js';

export const ACHIEVEMENTS = [
  { id: 'marathon', name: 'Марафонец', unit: 'полей',
    about: 'Проходи поля до конца: засчитывается каждое закрытое поле.',
    read: (s) => s.solved || 0, stars: [10, 50, 150], coins: [50, 100, 150] },
  { id: 'hunter', name: 'Охотник', unit: 'слов на одном поле',
    about: 'Найди много слов на одном поле: загаданные и бонусные считаются вместе. '
      + 'Рекорд держится на бонусных словах — ищи их.',
    read: (s) => s.maxWords || 0, stars: [15, 20, 30], coins: [50, 100, 150] },
  { id: 'bonus', name: 'Собиратель', unit: 'бонусных слов',
    about: 'Бонусное слово — настоящее слово из словаря, которое не загадано на поле. '
      + 'За каждое ещё и монеты сверху.',
    read: (s) => s.bonusFound || 0, stars: [25, 100, 300], coins: [50, 100, 150] },
  { id: 'erudite', name: 'Эрудит', unit: 'толкований',
    about: 'Нажимай на найденные слова и читай, что они значат.',
    read: (s) => s.defsOpened || 0, stars: [20, 100, 300], coins: [50, 100, 150] },
  { id: 'clean', name: 'Чистое поле', unit: 'полей без подсказок',
    about: 'Закрой поле, ни разу не нажав подсказку. Сложное — и награда больше.',
    read: (s) => s.cleanBoards || 0, stars: [1, 10, 50], coins: [100, 250, 500] },
  { id: 'rich', name: 'Богач', unit: 'монет разом',
    about: 'Накопи столько монет одновременно. Считается рекорд: траты его не отнимают.',
    read: (s) => s.maxCoins || 0, stars: [1000, 5000, 15000], coins: [50, 100, 150] },
  { id: 'collector', name: 'Коллекционер', unit: 'фонов',
    about: 'Покупай фоны в магазине. Редкое — и награда больше.',
    read: (s) => shopOf(s).owned.length, stars: [3, 8, 13], coins: [100, 250, 500] },
];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

// How many stars (0..3) the current value reaches.
export function starsFor(a, stats) {
  const v = a.read(stats || {});
  return a.stars.reduce((count, t) => count + (v >= t ? 1 : 0), 0);
}

// Pay coins for any newly reached stars. Never mutates the input.
// Returns { stats, awarded }: awarded is empty when nothing changed, so the
// same object is handed back and the caller can skip a save.
export function evaluate(stats) {
  const s = stats || {};
  const awards = { ...(s.awards || {}) };
  let coins = s.coins || 0;
  const awarded = [];
  for (const a of ACHIEVEMENTS) {
    const now = starsFor(a, s);
    const paid = Math.min(awards[a.id] || 0, 3);
    for (let star = paid; star < now; star++) {
      coins += a.coins[star];
      awarded.push({ id: a.id, name: a.name, star: star + 1, coins: a.coins[star] });
    }
    if (now > paid) awards[a.id] = now;
  }
  if (!awarded.length) return { stats: s, awarded };
  return { stats: { ...s, coins, awards }, awarded };
}

// Rows for the screen: what to show folded (name, stars, progress bar) and
// unfolded (description, numbers, each star's goal and reward).
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
      unit: a.unit,
      stars,
      value,
      next,
      goals: a.stars,
      coins: a.coins,
      pct: next === null ? 100 : Math.min(100, Math.floor((value / next) * 100)),
    };
  });
}

export const catalogAchievement = (id) => byId.get(id) ?? null;
