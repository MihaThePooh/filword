// Builds data/kids.json - the dictionary of the kids mode - from the
// hand-picked list in scripts/kids-words.txt.
//
// Only words the main dictionary knows go in: they come with definitions and
// stress from Wiktionary, and the same filters (no names, no case forms) have
// already been applied to them. A word missing there is reported and skipped.
// No rare tier: the "one rare word per board" rule is for grown-ups.
//
// Usage: node scripts/build-kids.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const MIN_LEN = 3;
export const MAX_LEN = 9; // a 5x5 board has 25 cells; a 9-letter word still leaves room for 3-4 more

export function parseList(text) {
  const out = [];
  const seen = new Set();
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('#')) continue;
    for (const raw of line.split(/\s+/)) {
      const w = raw.trim().toLowerCase();
      if (!w || seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

// Senses a child should not meet: Wiktionary lists slang, insults and adult
// meanings next to the plain one («сосиска», «омлет», «белочка»...).
export const ADULT = /секс|половой|полов|минет|оральн|алкогол|пьянств|спиртн|горячк|делири|наркот|бранн|порица|презр|неумн|некультурн|неуклюж|груб|растрёп|неопрятн|опухол|онколог|убийств|смерт|труп|оруж|боеприпас|паразит|болезн|любовни|проститут|тюрьм|воров|жарг|разг\.|прост\.|пренебр|ирон/i;

// Words whose first plain sense is not the one a child means
export const OWN = {
  пирожок: 'маленький пирог с начинкой: с капустой, яблоком, мясом',
  воротник: 'часть одежды вокруг шеи',
  яйцо: 'то, что несут птицы, например курица; из него вылупляется птенец',
  победа: 'успех в игре, споре или соревновании',
  рак: 'речное животное с клешнями и твёрдым панцирем',
  гранат: 'круглый плод с толстой кожурой и множеством красных сочных зёрен',
  кофе: 'напиток из обжаренных и смолотых зёрен кофейного дерева',
};

// One definition is enough for a child: the first plain one.
export function kidDefs(defs) {
  const ok = (defs || []).find((d) => !ADULT.test(d));
  return ok ? [ok] : [];
}

export function buildKids(list, main, extraDefs = {}) {
  const byWord = new Map(main.map((e) => [e.w, e]));
  const kept = [];
  const missing = [];
  for (const w of list) {
    const len = [...w].length;
    if (len < MIN_LEN || len > MAX_LEN) { missing.push(`${w} (длина)`); continue; }
    const e = byWord.get(w);
    const d = OWN[w] ? [OWN[w]] : kidDefs(e?.d ?? extraDefs[w]?.d);
    if (e && d.length) { kept.push({ w, r: e.r, d, s: e.s }); continue; }
    // Rarer nouns are not in the main list but may have a definition in bonus-defs
    const b = extraDefs[w];
    if (!e && d.length) { kept.push({ w, r: 100000 + kept.length, d, s: b?.s }); continue; }
    missing.push(w);
  }
  kept.sort((a, b) => a.r - b.r);
  // Ranks 1..n: early boards still get the most common words first
  kept.forEach((e, i) => { e.r = i + 1; });
  return { kept, missing };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const list = parseList(readFileSync(`${root}scripts/kids-words.txt`, 'utf8'));
  const main = JSON.parse(readFileSync(`${root}data/words.json`, 'utf8'));
  const extra = JSON.parse(readFileSync(`${root}data/bonus-defs.json`, 'utf8'));
  const { kept, missing } = buildKids(list, main, extra);
  writeFileSync(`${root}data/kids.json`, JSON.stringify(kept));
  const byLen = {};
  for (const e of kept) byLen[[...e.w].length] = (byLen[[...e.w].length] ?? 0) + 1;
  console.log(`kids.json: ${kept.length} слов из ${list.length}; по длине`, byLen);
  console.log(`пропущено ${missing.length}:`, missing.join(', '));
}
