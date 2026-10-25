// Loads the dictionary. The gzip copy is ~4 times smaller (1.2 MB instead
// of 4.6 MB); the browser unpacks it itself with DecompressionStream.
// Old browsers without it get the plain JSON.

export async function loadDictionary(base = 'data/words.json') {
  return loadJson(base);
}

// Every noun, frequent or not: used to recognise bonus words.
export async function loadBonusWords() {
  return new Set(await loadJson('data/bonus.json'));
}

async function loadJson(base) {
  if ('DecompressionStream' in window) {
    try {
      const res = await fetch(`${base}.gz`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
      return JSON.parse(await new Response(stream).text());
    } catch (err) {
      console.warn('gzip dictionary failed, falling back to plain JSON', err);
    }
  }
  const res = await fetch(base);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
