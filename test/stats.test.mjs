import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statRows, STAT_DEFAULTS } from '../src/stats.js';

const byLabel = (rows, label) => rows.find((r) => r.label === label).value;

test('statRows reads counters and tolerates a missing/empty save', () => {
  const rows = statRows(undefined);
  assert.ok(rows.length >= 8);
  for (const r of rows) {
    // records that do not exist yet (longest word, times) show a dash
    assert.ok(r.value === 0 || r.value === '—', r.label);
  }
});

test('statRows reflects the stored counters', () => {
  const s = {
    solved: 12, wordsFound: 80, bonusFound: 7, maxWords: 9,
    hintsUsed: 3, coinsEarned: 200, coinsSpent: 150, shuffles: 1,
    shop: { owned: ['roses', 'rug'], active: 'roses' },
  };
  const rows = statRows(s);
  assert.equal(byLabel(rows, 'Полей пройдено'), 12);
  assert.equal(byLabel(rows, 'Слов отгадано'), 80);
  assert.equal(byLabel(rows, 'Бонусных слов'), 7);
  assert.equal(byLabel(rows, 'Рекорд слов на поле'), 9);
  assert.equal(byLabel(rows, 'Подсказок взято'), 3);
  assert.equal(byLabel(rows, 'Монет заработано'), 200);
  assert.equal(byLabel(rows, 'Монет потрачено'), 150);
  assert.equal(byLabel(rows, 'Шафлов сделано'), 1);
  assert.equal(byLabel(rows, 'Фонов куплено'), 2);
});

test('negative or junk counters read as zero', () => {
  const rows = statRows({ solved: -5, wordsFound: 'x', coinsEarned: 3.9 });
  assert.equal(byLabel(rows, 'Полей пройдено'), 0);
  assert.equal(byLabel(rows, 'Слов отгадано'), 0);
  assert.equal(byLabel(rows, 'Монет заработано'), 3);
});

test('STAT_DEFAULTS are all zero', () => {
  for (const v of Object.values(STAT_DEFAULTS)) assert.equal(v, 0);
});

test('longest word: length with the right form and the word itself', () => {
  const row = statRows({ longestWord: 'ПЕРЕПЛЕТЕНИЕ' }).find((r) => r.label === 'Самое длинное слово');
  assert.equal(row.value, '12 букв');
  assert.equal(row.sub, 'переплетение');
  const two = statRows({ longestWord: 'КОТ' }).find((r) => r.label === 'Самое длинное слово');
  assert.equal(two.value, '3 буквы');
});

test('time rows: total, fastest/slowest board and pauses', () => {
  const rows = statRows({ totalMs: 185 * 60000, fastestBoard: 107000, slowestBoard: 1260000,
    fastestGap: 2300, slowestGap: 95000 });
  assert.equal(byLabel(rows, 'Время на полях'), '3 ч 05 мин');
  assert.equal(byLabel(rows, 'Самое быстрое поле'), '1:47');
  assert.equal(byLabel(rows, 'Самое долгое поле'), '21:00');
  assert.equal(byLabel(rows, 'Самая короткая пауза между словами'), '2,3 с');
  assert.equal(byLabel(rows, 'Самая долгая пауза между словами'), '1:35');
});
