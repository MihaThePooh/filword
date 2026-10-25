import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitLabels, cleanSense, isGoodWord, isBadEntry, parseFrequency, expandSameAs,
  obliqueForms, formScore, rankForCount, parseCounts, isAdjectival, stressedForm,
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
  assert.equal(cleanSense('; калька с англ. they'), 'калька с англ. they');
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
  assert.ok(isBadEntry(['Русские личные местоимения']));
  assert.ok(isBadEntry(['Местоимения в винительном падеже/ru']));
});

test('parseFrequency keeps the first rank of a word', () => {
  const rank = parseFrequency('я 10\nкот 5\nкот 3\n');
  assert.equal(rank.get('я'), 1);
  assert.equal(rank.get('кот'), 2);
});

test('expandSameAs appends the meaning of the referenced word', () => {
  const dict = { врач: 'специалист, занимающийся лечением', сутки: 'то же, что день' };
  const lookup = (w) => dict[w];
  assert.equal(expandSameAs('то же, что врач', lookup), 'то же, что врач — специалист, занимающийся лечением');
  assert.equal(expandSameAs('то же, что шелковица; дерево', lookup), 'то же, что шелковица; дерево', 'already explained');
  assert.equal(expandSameAs('то же, что неведомо', lookup), 'то же, что неведомо', 'unknown target');
  assert.equal(expandSameAs('то же, что сутки', lookup), 'то же, что сутки', 'target is a pointer too');
  assert.equal(expandSameAs('сосуд для воды', lookup), 'сосуд для воды');
  assert.equal(expandSameAs('врач', lookup), 'врач — специалист, занимающийся лечением', 'one-word synonym');
});

test('obliqueForms takes genitive/dative/instrumental without stress marks', () => {
  const entry = { word: 'день', forms: [
    { form: 'де\u0301нь', tags: ['singular', 'nominative'] },
    { form: 'дня\u0301', tags: ['singular', 'genitive'] },
    { form: 'днём', tags: ['singular', 'instrumental'] },
    { form: 'дне', tags: ['singular', 'prepositional'] },
  ] };
  assert.deepEqual(obliqueForms(entry), ['дня', 'днём']);
  assert.deepEqual(obliqueForms({ word: 'кофе' }), []);
});

test('formScore takes the rarest form, ё may be written as е', () => {
  const counts = parseCounts('дал 9000\nдня 5000\nдень 8000\nдала 4000\nднем 3000\nдалу 2\n');
  assert.equal(formScore('день', ['дня', 'днём'], counts), 5000, 'second smallest');
  assert.equal(formScore('дал', ['далу', 'далом'], counts), 2);
  assert.equal(formScore('кофе', [], parseCounts('кофе 700\n')), 700);
});

test('rankForCount maps a count to a position in the frequency list', () => {
  const sorted = [100, 50, 50, 10];
  assert.equal(rankForCount(sorted, 100), 1);
  assert.equal(rankForCount(sorted, 50), 2);
  assert.equal(rankForCount(sorted, 20), 4);
  assert.equal(rankForCount(sorted, 1), 5);
});

test('isAdjectival spots nouns that decline like adjectives', () => {
  assert.ok(isAdjectival('хорошее', [{ form: 'хоро\u0301шего', tags: ['singular', 'genitive'] }]));
  assert.ok(isAdjectival('ванная', [{ form: 'ванной', tags: ['singular', 'genitive'] }]));
  assert.ok(!isAdjectival('герой', [{ form: 'героя', tags: ['singular', 'genitive'] }]));
  assert.ok(!isAdjectival('стол', [{ form: 'стола', tags: ['singular', 'genitive'] }]));
});

test('stressedForm returns the nominative with a stress mark', () => {
  const entry = { word: 'помочь', forms: [
    { form: 'по\u0301мочь I', tags: ['stressed'] },
    { form: 'по\u0301мочь', tags: ['singular', 'nominative'] },
    { form: 'по\u0301мочи', tags: ['plural', 'nominative'] },
  ] };
  assert.equal(stressedForm(entry), 'по\u0301мочь');
  assert.equal(stressedForm({ word: 'ёж', forms: [{ form: 'ёж', tags: ['singular', 'nominative'] }] }), null);
  assert.equal(stressedForm({ word: 'кофе' }), null);
  const plural = { word: 'ножницы', forms: [{ form: 'но\u0301жницы', tags: ['plural', 'nominative'] }] };
  assert.equal(stressedForm(plural), 'но\u0301жницы', 'pluralia tantum');
});
