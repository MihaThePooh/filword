// Shared spelling-level exclusions: a clean homonym must not admit a swear word.
const EXCLUDED = new Set(`
блядь бля блядство блядина блядник блядослов
хуй хуи хули хуйня хуерда хуемразь хуйловец
пизда пиздец пиздёж пиздобол
ебля ебало ебальник ебанат еблан ёбля ёбало ёбырь
манда мандёж мудила мудак мудозвон мудень
залупа залупка залупление ползалупы
говно говнецо говнина говнюк говнюшка говнистость
дрочун дрочильня дрочка дрочило
пидор пидорас пидарас пидрила
гондон членосос жопа жопка жопник
йух йухня цветуёчек
`.trim().split(/\s+/));

export function isExcludedWord(word) {
  const normalized = String(word ?? '').normalize('NFC').toLowerCase().replace(/\u0301/g, '');
  return EXCLUDED.has(normalized) || /бляд|пизд|шлюхо[её]б/.test(normalized);
}

export function containsExcludedText(text) {
  return (String(text ?? '').match(/[а-яё\u0301]+/gi) ?? []).some(isExcludedWord);
}

export function cleanDictionaryEntry(entry) {
  if (isExcludedWord(entry.w)) return null;
  const definitions = (entry.d ?? []).filter(d => !containsExcludedText(d));
  return definitions.length ? {...entry, d:definitions} : null;
}

// Replace only the offending path. Keep the rest of the board and all rewards.
export function repairSavedWords(saved, dictionary, used = new Set()) {
  if (!saved?.board?.words) return saved;
  const result = structuredClone(saved);
  const occupied = new Set(result.board.words.filter(w => !isExcludedWord(w.word)).map(w => w.word));
  const found = new Set((result.found ?? []).map(([i]) => i));
  for (const [i, entry] of result.board.words.entries()) {
    entry.defs = (entry.defs ?? []).filter(d => !containsExcludedText(d));
    if (!isExcludedWord(entry.word)) continue;
    const candidates = dictionary.filter(w => !isExcludedWord(w.w) && [...w.w].length === entry.cells.length && !occupied.has(w.w));
    const replacement = candidates.find(w => !used.has(w.w)) ?? candidates[0];
    if (!replacement) throw new Error('No safe replacement for saved word');
    const letters = [...replacement.w];
    entry.cells.forEach((cell, j) => { result.board.letters[cell] = letters[j]; });
    result.board.words[i] = {...entry, word:replacement.w, defs:replacement.d, stress:replacement.s};
    occupied.add(replacement.w);
    if (found.has(i)) used.add(replacement.w);
  }
  result.bonus = (result.bonus ?? []).filter(w => !isExcludedWord(w));
  if (result.log) result.log = result.log.filter(e => e.b === undefined || !isExcludedWord(e.b));
  return result;
}
