// Statistics: lifetime counters shown on the «Статистика» screen and, later,
// the source of truth for achievements. Kept pure and side-effect free so the
// numbers can be tested without a browser; the game bumps the fields on stats
// directly (markFound, bonus, hint, purchase) and they ride along the save.

import { shopOf } from './shop.js';
import { fmtClock, fmtGap, fmtSpan } from './timer.js';

// 1 слово, 2 слова, 5 слов.
export function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// Every counter starts at zero; older saves without a field read as zero.
export const STAT_DEFAULTS = {
  solved: 0, wordsFound: 0, bonusFound: 0, maxWords: 0,
  hintsUsed: 0, coinsEarned: 0, coinsSpent: 0, shuffles: 0,
};

const n = (v) => (typeof v === 'number' && v > 0 ? Math.floor(v) : 0);

// A time record, or a dash until there is one.
const timeOr = (ms, fmt) => (n(ms) ? fmt(ms) : '—');

// The longest word ever found: its length, and the word itself under the label.
function longestRow(word) {
  const w = typeof word === 'string' ? word : '';
  const len = [...w].length;
  return {
    label: 'Самое длинное слово',
    sub: w ? w.toLowerCase() : '',
    value: len ? `${len} ${plural(len, 'буква', 'буквы', 'букв')}` : '—',
  };
}

// Rows for the screen: label, value and an optional small line, in display order.
export function statRows(stats) {
  const s = stats || {};
  return [
    { label: 'Полей пройдено', value: n(s.solved) },
    { label: 'Слов отгадано', value: n(s.wordsFound) },
    { label: 'Бонусных слов', value: n(s.bonusFound) },
    { label: 'Рекорд слов на поле', value: n(s.maxWords) },
    longestRow(s.longestWord),
    { label: 'Подсказок взято', value: n(s.hintsUsed) },
    { label: 'Монет заработано', value: n(s.coinsEarned) },
    { label: 'Монет потрачено', value: n(s.coinsSpent) },
    { label: 'Шафлов сделано', value: n(s.shuffles) },
    { label: 'Время на полях', value: n(s.totalMs) ? fmtSpan(s.totalMs) : '—' },
    { label: 'Самое быстрое поле', value: timeOr(s.fastestBoard, fmtClock) },
    { label: 'Самое быстрое поле без подсказок', value: timeOr(s.fastestClean, fmtClock) },
    { label: 'Самое долгое поле', value: timeOr(s.slowestBoard, fmtClock) },
    { label: 'Самая короткая пауза между словами', value: timeOr(s.fastestGap, fmtGap) },
    { label: 'Самая долгая пауза между словами', value: timeOr(s.slowestGap, fmtGap) },
    { label: 'Фонов куплено', value: shopOf(s).owned.length },
  ];
}
