// Builds data/words.json: common Russian nouns with their definitions.
//
// Inputs (downloaded into raw/, not committed):
//   raw/ru.jsonl.gz  - Russian Wiktionary extracted by wiktextract (kaikki.org)
//   raw/ru_full.txt   - word frequency list (hermitdave/FrequencyWords, OpenSubtitles 2018)
//
// Usage: node scripts/build-dict.mjs [maxRank]

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
  const clean = text.replace(/\s*\[\d+\]/g, '').replace(/\u00ad/g, '').trim();
  return clean.length >= 3 ? clean : null;
}

export function isGoodWord(word) {
  const re = new RegExp(`^[а-яё]{${MIN_LEN},${MAX_LEN}}$`);
  return re.test(word);
}

export function isBadEntry(categories = []) {
  return categories.some((c) => BAD_CATEGORY_PARTS.some((p) => c.includes(p)));
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
  const maxRank = Number(process.argv[2] ?? 300000);
  const root = fileURLToPath(new URL('..', import.meta.url));

  let rank;
  try {
    rank = parseFrequency(readFileSync(`${root}raw/ru_full.txt`, 'utf8'));
  } catch (err) {
    console.error('Cannot read raw/ru_full.txt - download it first:', err.message);
    process.exit(1);
  }

  const senses = new Map(); // word -> [definition, ...]
  const lines = createInterface({
    input: createReadStream(`${root}raw/ru.jsonl.gz`).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  let broken = 0;
  for await (const line of lines) {
    // Cheap string check first: parsing all ~1M lines as JSON is slow.
    if (!line.includes('"lang_code": "ru"') || !line.includes('"pos": "noun"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      broken++;
      continue;
    }
    const word = entry.word;
    if (entry.lang_code !== 'ru' || entry.pos !== 'noun') continue;
    if (!isGoodWord(word) || isBadEntry(entry.categories)) continue;
    const r = rank.get(word);
    if (!r || r > maxRank) continue;

    const list = senses.get(word) ?? [];
    for (const s of entry.senses ?? []) {
      if (s.tags?.includes('form-of')) continue;
      const def = cleanSense(s.glosses?.[0]);
      if (def && !list.includes(def) && list.length < MAX_SENSES) list.push(def);
    }
    if (list.length) senses.set(word, list);
  }

  // Most frequent words first - handy for picking easier words later.
  const words = [...senses.keys()].sort((a, b) => rank.get(a) - rank.get(b));
  // r = frequency rank (smaller = more common), d = definitions.
  const out = words.map((w) => ({ w, r: rank.get(w), d: senses.get(w) }));
  writeFileSync(`${root}data/words.json`, JSON.stringify(out));
  console.log(`words: ${words.length}, broken lines skipped: ${broken}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
