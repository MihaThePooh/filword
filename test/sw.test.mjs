import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('service worker pre-caches every module in src/', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const modules = readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.js'));
  for (const m of modules) assert.ok(sw.includes(`'src/${m}'`), `src/${m} missing in sw.js CORE`);
});
