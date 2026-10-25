// Converts a wordfreq data file (msgpack, "cBpack" format) into "<word> <zipf>" lines.
// Usage: node scripts/wordfreq-to-txt.mjs raw/large_ru.msgpack.gz > raw/wordfreq_ru.txt
//
// Minimal msgpack decoder: enough for cBpack files (arrays, maps, strings, ints).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const buf = gunzipSync(readFileSync(process.argv[2]));
let p = 0;
const td = new TextDecoder();
function str(n) { const s = td.decode(buf.subarray(p, p + n)); p += n; return s; }
function arr(n) { const a = []; for (let i = 0; i < n; i++) a.push(read()); return a; }
function map(n) { const o = {}; for (let i = 0; i < n; i++) { const k = read(); o[k] = read(); } return o; }
function read() {
  const b = buf[p++];
  if (b <= 0x7f) return b;
  if (b >= 0x80 && b <= 0x8f) return map(b & 0x0f);
  if (b >= 0x90 && b <= 0x9f) return arr(b & 0x0f);
  if (b >= 0xa0 && b <= 0xbf) return str(b & 0x1f);
  if (b >= 0xe0) return b - 256;
  switch (b) {
    case 0xc0: return null;
    case 0xc2: return false;
    case 0xc3: return true;
    case 0xcc: return buf[p++];
    case 0xcd: { const v = buf.readUInt16BE(p); p += 2; return v; }
    case 0xce: { const v = buf.readUInt32BE(p); p += 4; return v; }
    case 0xd9: return str(buf[p++]);
    case 0xda: { const n = buf.readUInt16BE(p); p += 2; return str(n); }
    case 0xdb: { const n = buf.readUInt32BE(p); p += 4; return str(n); }
    case 0xdc: { const n = buf.readUInt16BE(p); p += 2; return arr(n); }
    case 0xdd: { const n = buf.readUInt32BE(p); p += 4; return arr(n); }
    case 0xde: { const n = buf.readUInt16BE(p); p += 2; return map(n); }
    default: throw new Error('msgpack type 0x' + b.toString(16) + ' at ' + p);
  }
}
const data = read();
console.error(JSON.stringify(data[0]), 'buckets', data.length - 1);
// Bucket i (1-based) holds words with frequency 10^(-(i-1)/100); zipf = 9 - (i-1)/100.
const out = [];
for (let i = 1; i < data.length; i++) for (const w of data[i]) out.push(w + ' ' + (9 - (i - 1) / 100).toFixed(2));
process.stdout.write(out.join('\n') + '\n');
