import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitLabels, cleanSense, isGoodWord, isBadEntry, parseFrequency,
} from '../scripts/build-dict.mjs';

test('splitLabels strips leading abbreviations', () => {
  assert.deepEqual(splitLabels('зоол. семейство стрекоз'), {
    labels: ['зоол.'], text: 'семейство стрекоз',
  });
  assert.deepEqual(splitLabels('рег. и спец. отмель').labels, ['рег.', 'спец.']);
  assert.deepEqual(splitLabels('сосуд для воды').labels, []);
});

test('cleanSense drops obsolete and slang senses', () => {
  assert.equal(cleanSense('устар. старая мера длины'), null);
  assert.equal(cleanSense('жарг. деньги'), null);
  assert.equal(cleanSense('ботан. растение семейства тыквенных'), 'растение семейства тыквенных');
  assert.equal(cleanSense(undefined), null);
});

test('cleanSense drops grammar forms, letter names and sense refs', () => {
  assert.equal(cleanSense('форма дательного падежа существительного лицо'), null);
  assert.equal(cleanSense('название десятой буквы греческого алфавита'), null);
  assert.equal(cleanSense(', спорт. нападение'), 'нападение');
  assert.equal(cleanSense('количество, вмещающееся в ведро [1]'), 'количество, вмещающееся в ведро');
  assert.equal(cleanSense('сленг что-либо приятное'), null);
  assert.equal(cleanSense('к банкир'), null);
  assert.equal(cleanSense('сельско\u00adхозяйственный'), 'сельскохозяйственный');
});

test('isGoodWord accepts 3-10 lowercase Cyrillic letters only', () => {
  assert.ok(isGoodWord('кот'));
  assert.ok(isGoodWord('ёжик'));
  assert.ok(!isGoodWord('ум'));
  assert.ok(!isGoodWord('Москва'));
  assert.ok(!isGoodWord('во-первых'));
  assert.ok(!isGoodWord('достопримечательность'));
});

test('isBadEntry skips names and swear words', () => {
  assert.ok(isBadEntry(['Мужские имена', 'Имена собственные/ru']));
  assert.ok(!isBadEntry(['Русские существительные']));
  assert.ok(!isBadEntry(undefined));
});

test('parseFrequency keeps the first rank of a word', () => {
  const rank = parseFrequency('я 10\nкот 5\nкот 3\n');
  assert.equal(rank.get('я'), 1);
  assert.equal(rank.get('кот'), 2);
});
