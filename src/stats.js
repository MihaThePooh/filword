// Statistics: lifetime counters shown on the «Статистика» screen and, later,
// the source of truth for achievements. Kept pure and side-effect free so the
// numbers can be tested without a browser; the game bumps the fields on stats
// directly (markFound, bonus, hint, purchase) and they ride along the save.

import { shopOf } from './shop.js';

// Every counter starts at zero; older saves without a field read as zero.
export const STAT_DEFAULTS = {
  solved: 0, wordsFound: 0, bonusFound: 0, maxWords: 0,
  hintsUsed: 0, coinsEarned: 0, coinsSpent: 0, shuffles: 0,
};

const n = (v) => (typeof v === 'number' && v > 0 ? Math.floor(v) : 0);

// Rows for the screen: label and value, in display order.
export function statRows(stats) {
  const s = stats || {};
  return [
    { label: 'Полей пройдено', value: n(s.solved) },
    { label: 'Слов отгадано', value: n(s.wordsFound) },
    { label: 'Бонусных слов', value: n(s.bonusFound) },
    { label: 'Рекорд слов на поле', value: n(s.maxWords) },
    { label: 'Подсказок взято', value: n(s.hintsUsed) },
    { label: 'Монет заработано', value: n(s.coinsEarned) },
    { label: 'Монет потрачено', value: n(s.coinsSpent) },
    { label: 'Перетасовок', value: n(s.shuffles) },
    { label: 'Фонов куплено', value: shopOf(s).owned.length },
  ];
}
