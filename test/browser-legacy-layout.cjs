// Real complete download with legacy HTML/CSS, rather than mocked status events.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const legacy = file => execFileSync('git', ['show', 'f2b5429:' + file], { cwd: root });
let hold = true;
const waiting = [];
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://fixture').pathname;
  if (name.startsWith('/api/')) { res.writeHead(503); res.end(); return; }
  const send = () => {
    const file = name === '/' ? 'index.html' : name.slice(1);
    const body = ['index.html', 'style.css'].includes(file) ? legacy(file) : fs.readFileSync(path.join(root, file));
    const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
    res.writeHead(200, { 'content-type': type[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  };
  if (hold && name === '/data/bg/soft-texture.webp') waiting.push(send);
  else { try { send(); } catch { res.writeHead(404); res.end(); } }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.gridFrames = [];
      function frame() {
        const grid = document.querySelector('#grid');
        const status = document.querySelector('#offlineStatus');
        if (grid?.children.length === 64 && status) window.gridFrames.push({ y: grid.getBoundingClientRect().y, visible: !status.hidden });
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => !!localStorage.getItem('filword-state'));
    await page.waitForTimeout(3500);
    hold = false; waiting.splice(0).forEach(send => send());
    await page.waitForFunction(() => document.querySelector('#offlineStatus').hidden);
    await page.waitForTimeout(250);
    const frames = await page.evaluate(() => window.gridFrames);
    assert.ok(frames.some(frame => frame.visible));
    assert.ok(frames.some(frame => !frame.visible));
    assert.ok(Math.max(...frames.map(frame => frame.y)) - Math.min(...frames.map(frame => frame.y)) < .1);
    assert.equal(await page.locator('#offlineStatus').evaluate(e => getComputedStyle(e).position), 'fixed');
    console.log('PASS actual download with legacy59 HTML/CSS: zero per-frame grid movement, frames=' + frames.length);
    await context.close();
  } finally { waiting.splice(0).forEach(send => send()); await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
