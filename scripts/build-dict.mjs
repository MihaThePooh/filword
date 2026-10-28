// Builds data/words.json: common Russian nouns with their definitions.
//
// Inputs (downloaded into raw/, not committed):
//   raw/ru.jsonl.gz  - Russian Wiktionary extracted by wiktextract (kaikki.org)
//   raw/ru_full.txt   - word frequency list (hermitdave/FrequencyWords, OpenSubtitles 2018)
//   raw/wordfreq_ru.txt - wordfreq list (books, Wikipedia, news, subtitles), see README
//
// Usage: node scripts/build-dict.mjs [boards]
// Takes the most common nouns, just enough for `boards` boards without repeats.

import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export const MIN_LEN = 3;
export const MAX_LEN = 10;
export const MAX_SENSES = 3;

// Senses with these labels are obsolete, regional, slang or rude - not for a casual game.
const BAD_LABELS = new Set([
  'устар.', 'жарг.', 'прост.', 'рег.', 'диал.', 'вульг.', 'бран.', 'обсц.',
  'груб.', 'презр.', 'пренебр.', 'крим.', 'мол.', 'сленг.', 'неодобр.',
  // Substantivized adjectives like "дорогая" - an adjective, not a game noun.
  'субстантивир.',
]);

// Whole entries in these categories are skipped (names, places, swear words).
const BAD_CATEGORY_PARTS = [
  'Имена собственные', 'Топонимы', 'Фамилии', 'Названия букв',
  'Обсценная лексика', 'Бранные выражения', 'Вульгаризмы',
];

// Leading run of abbreviations like "зоол.", "рег. и спец.", "мн. ч. собир.".
const LABELS_RE = /^[\s,;]*((?:[а-яё-]+\.[\s,]*(?:и\s+)?)+)/;

export function splitLabels(gloss) {
  const m = gloss.match(LABELS_RE);
  if (!m) return { labels: [], text: gloss.trim() };
  return {
    labels: m[1].match(/[а-яё-]+\./g),
    text: gloss.slice(m[0].length).trim(),
  };
}

// Returns a clean definition, or null if the sense should not be shown.
export function cleanSense(gloss) {
  if (typeof gloss !== 'string') return null;
  const { labels, text } = splitLabels(gloss);
  if (labels.some((l) => BAD_LABELS.has(l))) return null;
  // Grammar forms ("форма винительного падежа...") and letter names are not game words.
  if (/^форма\s/.test(text) || /^название .*буквы/.test(text)) return null;
  // Labels sometimes come without a dot ("сленг что-либо приятное").
  if (/^(сленг|жарг|устар|прост|бран|вульг)[\s.,]/.test(text)) return null;
  // "к банкир" - a bare pointer to another word, says nothing on its own.
  if (/^к\s+[а-яё]+$/.test(text)) return null;
  // Drop references to sense numbers like "[1]".
  // Also drop soft hyphens (U+00AD) that Wiktionary uses for line breaking.
  const clean = text.replace(/\s*\[\d+\]/g, '').replace(/\u00ad/g, '')
    .replace(/^[\s,;:]+/, '').trim();
  return clean.length >= 3 ? clean : null;
}

// "то же, что порнография" says nothing if you do not know the other word.
// When the definition is only such a pointer, append the target's own meaning.
const SAME_AS_RE = /^то же,? что\s+([^;,()]+?)\s*$/;

// A one-word definition ("помочь: подтяжки") is a synonym - same problem.
const SYNONYM_RE = /^([а-яё-]+)$/;

export function expandSameAs(def, lookup) {
  const m = def.match(SAME_AS_RE) ?? def.match(SYNONYM_RE);
  if (!m) return def;
  const target = lookup(m[1].trim());
  if (!target || SAME_AS_RE.test(target) || SYNONYM_RE.test(target)) return def;
  return `${def} — ${target}`;
}

// The nominative singular as written in the dictionary, with the stress mark:
// "по́мочь", "коромы́сло". Only kept when it really carries a stress mark.
export function stressedForm(entry) {
  const f = (entry.forms ?? []).find((x) => x.tags?.includes('nominative')
    && (x.tags.includes('singular') || !entry.forms.some((y) => y.tags?.includes('singular'))));
  const form = f?.form?.trim();
  if (!form || !form.includes('\u0301')) return null;
  return form.replace(/\u0301/g, '') === entry.word ? form : null;
}

// Parts of speech that make a noun reading misleading in the frequency list:
// "нет" is counted as the particle, not as the slang noun for the internet.
const OTHER_POS = new Set(['particle', 'adv', 'verb', 'pron', 'conj', 'prep', 'intj', 'num', 'predicative']);

export function isGoodWord(word) {
  const re = new RegExp(`^[а-яё]{${MIN_LEN},${MAX_LEN}}$`);
  return re.test(word);
}

export function isBadEntry(categories = []) {
  return categories.some((c) => BAD_CATEGORY_PARTS.some((p) => c.includes(p))
    // Pronouns ("она", "себя") are sometimes filed as nouns in the dump.
    || c.toLowerCase().includes('местоимени'));
}

// Case forms used to double-check a noun's frequency.
const OBLIQUE = ['genitive', 'dative', 'instrumental'];

// Indeclinable words are trusted no higher than this (zipf, see scoreOf).
const INDECLINABLE_ZIPF = 3;
// Below this a word is exotic, however many boards we need: ~1 use per 100M words.
const MIN_ZIPF = 1;
// Two tiers: every board is common words plus exactly one rare word.
// Common letters per board: 64 cells minus one rare word (~7.5 letters), plus
// a margin - the last boards cannot use every word.
export const COMMON_LETTERS_PER_BOARD = 60;
// Rare words per board, with a reserve: a board needs a rare word of a length
// that fits, and near the end some lengths run out.
const RARE_PER_BOARD = 1.3;
const DEFAULT_BOARDS = 2000;

// Genitive/dative/instrumental forms of a noun entry, without stress marks.
export function obliqueForms(entry) {
  const out = new Set();
  // Singular forms when the word has them; plural only for words like "ножницы".
  const hasSingular = (entry.forms ?? []).some((f) => f.tags?.includes('singular'));
  const number = hasSingular ? 'singular' : 'plural';
  for (const f of entry.forms ?? []) {
    if (!f.tags?.some((t) => OBLIQUE.includes(t)) || !f.tags.includes(number)) continue;
    const form = f.form?.replace(/\u0301/g, '');
    if (form && form !== entry.word && /^[а-яё]+$/.test(form)) out.add(form);
  }
  // "водою" is an old variant of "водой": rare by nature, it must not sink the word.
  return [...out].filter((f) => !/[ое]ю$/.test(f) || !out.has(f.slice(0, -1) + 'й'));
}

// Texts often write "е" for "ё", so "ёлка" also counts "елка". But not when the
// "е" spelling is a word of its own: "лёт" must not count "лет", nor "падёж" "падеж".
// Values are zipf. The "е" spelling may add at most YO_BOOST to what the "ё"
// spelling shows by itself: "отёл" (4 times) must not borrow "отел" (74 times,
// a misspelt "отель").
const YO_BOOST = 1;
function yoCounter(counts, canFold = () => true) {
  return (f) => {
    const own = counts.get(f) ?? 0;
    const plain = f.replace(/ё/g, 'е');
    if (plain === f || !own || !canFold(plain)) return own;
    return Math.max(own, Math.min(counts.get(plain) ?? 0, own + YO_BOOST));
  };
}

// A noun is about as frequent as its rare forms. "день" is frequent: "дня",
// "дню", "днём" are frequent too. "дал" (an Indian dish) only looks frequent
// because of the verb "дал"; its "далу", "далом" are rare and expose it.
// Second-smallest, not the smallest: one odd form should not sink a word.
export function formScore(word, forms, counts, canFold) {
  const countOf = yoCounter(counts, canFold);
  const values = [word, ...forms].map(countOf).sort((a, b) => a - b);
  return values.length > 2 ? values[1] : values[0];
}

// For words with no other reading the strict check is too strict: "тушканчик"
// is a normal word, but "тушканчику" is rare in any text. One frequent form is
// enough to show the word is really used as this noun.
export function looseScore(word, forms, counts, canFold) {
  const countOf = yoCounter(counts, canFold);
  return Math.min(countOf(word), Math.max(0, ...forms.map(countOf)));
}

export function isAdjectival(word, forms = []) {
  if (!/(ое|ее|ая|яя|ый|ий|ой)$/.test(word)) return false;
  const gen = forms.find((f) => f.tags?.includes('genitive') && f.tags.includes('singular'));
  return Boolean(gen && /(ого|его|ой|ей)$/.test(gen.form.replace(/\u0301/g, '')));
}

export function parseCounts(text) {
  const counts = new Map();
  for (const line of text.split('\n')) {
    const [word, n] = line.split(' ');
    if (word && !counts.has(word)) counts.set(word, Number(n) || 0);
  }
  return counts;
}

// Frequency list line: "<word> <count>". Rank = line number, first occurrence wins.
export function parseFrequency(text) {
  const rank = new Map();
  text.split('\n').forEach((line, i) => {
    const word = line.split(' ')[0];
    if (word && !rank.has(word)) rank.set(word, i + 1);
  });
  return rank;
}

async function main() {
  const boards = Number(process.argv[2] ?? DEFAULT_BOARDS);
  const root = fileURLToPath(new URL('..', import.meta.url));

  let rank;
  let counts;
  try {
    const freqText = readFileSync(`${root}raw/ru_full.txt`, 'utf8');
    rank = parseFrequency(freqText);
    counts = parseCounts(freqText);
  } catch (err) {
    console.error('Cannot read raw/ru_full.txt - download it first:', err.message);
    process.exit(1);
  }
  const lookalikes = new Set(readFileSync(`${root}scripts/proper-lookalikes.txt`, 'utf8')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')));
  let zipf;
  try {
    zipf = parseCounts(readFileSync(`${root}raw/wordfreq_ru.txt`, 'utf8'));
  } catch (err) {
    console.error('Cannot read raw/wordfreq_ru.txt - see README:', err.message);
    process.exit(1);
  }

  const senses = new Map(); // word -> [definition, ...]
  const firstSense = new Map(); // any Russian entry -> its first clean definition
  const otherPos = new Set(); // words that are also particles, verbs, adverbs...
  const ownWords = new Set(); // every spelling that is a word or a form in its own right
  const verbForms = new Set(); // "дал", "день" (of "деть"): checked strictly, not demoted
  const names = new Set(); // "джек", "крис": frequent only as first names
  const forms = new Map(); // noun -> its oblique case forms
  const indeclinable = new Set(); // "кофе", "такси": no forms to cross-check
  const bonus = new Set(); // every clean noun, any frequency: bonus words in the game
  const stress = new Map(); // word -> Set of spellings with a stress mark ("му́ка", "мука́")
  const formOf = new Map(); // "ягодицы" -> "ягодица": forms point to their dictionary word
  const lines = createInterface({
    input: createReadStream(`${root}raw/ru.jsonl.gz`).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  let broken = 0;
  for await (const line of lines) {
    // Cheap string check first: parsing all ~1M lines as JSON is slow.
    if (!line.includes('"lang_code": "ru"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      broken++;
      continue;
    }
    const word = entry.word;
    if (entry.lang_code !== 'ru') continue;
    // "елка" is only a pointer to "ёлка"; "лет" is also a form of "лето".
    if (!entry.senses?.every((s) => s.glosses?.[0]?.startsWith('неёфицированн'))) ownWords.add(word);
    // Verb forms do not count: "день" is also an imperative of "деть", a rare word.
    // Pronoun forms do: "том", "ним" are counted as forms of "тот", "он".
    const isForm = entry.senses?.every((s) => s.tags?.includes('form-of'));
    if (OTHER_POS.has(entry.pos) && !(isForm && entry.pos === 'verb')) otherPos.add(word);
    if (isForm && entry.pos === 'verb') verbForms.add(word);
    // "новая" (a star) is counted as the adjective; "стен" as the genitive of "стена".
    if (entry.pos === 'adj' || (entry.pos === 'noun' && isForm)) otherPos.add(word);
    // Nouns that decline like adjectives ("хорошее" -> "хорошего"): their
    // frequency mostly comes from the adjective itself.
    if (entry.pos === 'noun' && isAdjectival(word, entry.forms)) otherPos.add(word);
    if (entry.pos === 'name') names.add(word.toLowerCase());
    // Frequency lists are lower-cased: "пермь" counts the city "Пермь".
    const target = entry.senses?.[0]?.form_of?.[0]?.word;
    if (target && !formOf.has(word)) formOf.set(word, target);
    if (!firstSense.has(word) && !entry.senses?.[0]?.tags?.includes('form-of')) {
      const def = cleanSense(entry.senses?.[0]?.glosses?.[0]);
      if (def) firstSense.set(word, def);
    }
    if (entry.pos !== 'noun') continue;
    if (!isGoodWord(word) || isBadEntry(entry.categories)) continue;
    if (lookalikes.has(word)) continue;
    // Any real noun counts as a bonus word, even "просадка" seen 3 times in subtitles.
    if ((entry.senses ?? []).some((x) => !x.tags?.includes('form-of') && cleanSense(x.glosses?.[0]))) {
      bonus.add(word);
    }

    forms.set(word, [...new Set([...(forms.get(word) ?? []), ...obliqueForms(entry)])]);
    if (stressedForm(entry)) stress.set(word, (stress.get(word) ?? new Set()).add(stressedForm(entry)));
    if (entry.categories?.some((c) => c.startsWith('Несклоняемые существительные'))) indeclinable.add(word);
    const list = senses.get(word) ?? [];
    for (const s of entry.senses ?? []) {
      if (s.tags?.includes('form-of')) continue;
      const def = cleanSense(s.glosses?.[0]);
      if (def && !list.includes(def) && list.length < MAX_SENSES) list.push(def);
    }
    if (list.length) senses.set(word, list);
  }

  const canFold = (plain) => !ownWords.has(plain);
  // Homographs go last: their frequency partly belongs to the other word.
  const isHomograph = (w) => otherPos.has(w) || names.has(w);
  // Both lists on one scale: zipf = log10 of uses per billion words.
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const subZipf = (n) => (n > 0 ? Math.log10((n * 1e9) / total) : 0);
  const sub = new Map([...counts].map(([w, n]) => [w, subZipf(n)]));
  const scoreIn = (list, w, sparse = false) => {
    const f = forms.get(w) ?? [];
    // Nothing to cross-check. Indeclinable words ("кофе", but also "томми")
    // are trusted a bit less, words with unknown declension much less.
    if (!f.length) {
      const bare = yoCounter(list, canFold)(w);
      return indeclinable.has(w) ? Math.min(bare, INDECLINABLE_ZIPF) : bare - 1;
    }
    // Verb forms ("дал") and other homographs need the strict check.
    if (isHomograph(w) || verbForms.has(w)) return formScore(w, f, list, canFold);
    // Subtitles are a small corpus: "торшер" is there, "торшера" is not.
    // A word with no other reading may go on its own count there.
    if (sparse) return yoCounter(list, canFold)(w);
    return Math.max(formScore(w, f, list, canFold), looseScore(w, f, list, canFold));
  };
  // Average of both lists: subtitles know everyday words ("зевок"), wordfreq
  // knows book words ("коромысло"); a word only Wikipedia knows ("менархе")
  // gets half the score.
  const scoreOf = (w) => (scoreIn(sub, w, true) + scoreIn(zipf, w)) / 2;
  const score = new Map([...senses.keys()].map((w) => [w, scoreOf(w)]));
  const byScore = [...senses.keys()].filter((w) => score.get(w) >= MIN_ZIPF)
    .sort((a, b) => score.get(b) - score.get(a));
  // Common tier: the most frequent words, enough letters for every board.
  const common = [];
  let letters = 0;
  let k = 0;
  for (; k < byScore.length && letters < boards * COMMON_LETTERS_PER_BOARD; k++) {
    common.push(byScore[k]);
    letters += byScore[k].length;
  }
  // Rare tier: the next words down the list, one per board.
  const rare = byScore.slice(k, k + Math.ceil(boards * RARE_PER_BOARD));
  if (letters < boards * COMMON_LETTERS_PER_BOARD || rare.length < boards) {
    console.error(`Not enough words above zipf ${MIN_ZIPF} for ${boards} boards`);
  }
  const rareSet = new Set(rare);
  // Most frequent words first - the game picks easier words first.
  // Common before rare; inside a tier homographs go last.
  const words = [...common, ...rare].sort((a, b) => rareSet.has(a) - rareSet.has(b)
    || isHomograph(a) - isHomograph(b) || score.get(b) - score.get(a));
  const rankOf = new Map(words.map((w, i) => [w, i + 1]));
  // A synonym may be a form ("ягодицы"): then explain its dictionary word.
  const lookup = (w) => firstSense.get(w) ?? firstSense.get(formOf.get(w));
  // r = place in the queue (smaller = more common), d = definitions.
  // s = the word with a stress mark, when the dictionary has it.
  // x = rare tier: the generator puts exactly one such word on every board.
  const out = words.map((w) => ({
    w, r: rankOf.get(w), d: senses.get(w).map((d) => expandSameAs(d, lookup)),
    ...(rareSet.has(w) ? { x: 1 } : {}),
    // Homonyms may differ only by stress: "му́ка · мука́".
    ...(stress.has(w) ? { s: [...stress.get(w)].join(' · ') } : {}),
  }));
  const homographs = words.filter(isHomograph).length;
  writeFileSync(`${root}data/words.json`, JSON.stringify(out));
  writeFileSync(`${root}data/bonus.json`, JSON.stringify([...bonus].sort()));
  // Definitions of bonus words that are not in the main list: a separate file,
  // loaded only when the player opens such a word.
  const inMain = new Set(words);
  const bonusDefs = {};
  for (const w of [...bonus].sort()) {
    if (inMain.has(w) || !senses.has(w)) continue;
    bonusDefs[w] = {
      d: senses.get(w).map((d) => expandSameAs(d, lookup)),
      ...(stress.has(w) ? { s: [...stress.get(w)].join(' · ') } : {}),
    };
  }
  writeFileSync(`${root}data/bonus-defs.json`, JSON.stringify(bonusDefs));
  const zipfOf = (w) => score.get(w).toFixed(2);
  console.log(`common: ${common.length} words, ${letters} letters, down to ${common.at(-1)} (zipf ${zipfOf(common.at(-1))})`);
  console.log(`rare: ${rare.length} words, from ${rare[0]} (zipf ${zipfOf(rare[0])}) to ${rare.at(-1)} (zipf ${zipfOf(rare.at(-1))})`);
  console.log(`with stress: ${words.filter((w) => stress.has(w)).length}`);
  console.log(`bonus definitions: ${Object.keys(bonusDefs).length}`);
  console.log(`words: ${words.length}, bonus words: ${bonus.size}, homographs moved to rare: ${homographs}, broken lines skipped: ${broken}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
