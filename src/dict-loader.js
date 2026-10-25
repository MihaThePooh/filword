// Loads the dictionary. The gzip copy is ~4 times smaller (1.2 MB instead
// of 4.6 MB); the browser unpacks it itself with DecompressionStream.
// Old browsers without it get the plain JSON.

// onProgress(fraction) is called as the gzip file arrives; null = size unknown.
export async function loadDictionary(onProgress, base = 'data/words.json') {
  return loadJson(base, onProgress);
}

// Every noun, frequent or not: used to recognise bonus words.
export async function loadBonusWords() {
  return new Set(await loadJson('data/bonus.json'));
}

async function loadJson(base, onProgress) {
  if ('DecompressionStream' in window) {
    try {
      const res = await fetch(`${base}.gz`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      let received = 0;
      const counter = new TransformStream({
        transform(chunk, controller) {
          received += chunk.byteLength;
          onProgress?.(total ? received / total : null);
          controller.enqueue(chunk);
        },
      });
      const stream = res.body.pipeThrough(counter).pipeThrough(new DecompressionStream('gzip'));
      return JSON.parse(await new Response(stream).text());
    } catch (err) {
      console.warn('gzip dictionary failed, falling back to plain JSON', err);
    }
  }
  const res = await fetch(base);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
