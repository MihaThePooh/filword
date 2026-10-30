// Sign-in through the hub and the player's save on the server.
//
// The game still plays from localStorage: it is the working copy and what
// keeps the game going offline. The server keeps the real save of the account,
// so progress survives a new phone or a cleared browser. Playing requires an
// account: no pass and no session - the page goes to the hub sign-in.
//
// Two devices may play the same account. Every save carries the number of the
// server version it is based on; the server refuses a save made on top of an
// old version (409). Then the save with more progress wins - a week of play on
// one phone is never wiped by an evening on another.

export const STATE_KEY = 'filword-state';
export const STATS_KEY = 'filword-stats';
const OWNER_KEY = 'filword-owner';     // account the local copy belongs to
const VERSION_KEY = 'filword-version'; // server version the local copy is based on
const DIRTY_KEY = 'filword-dirty';     // '1' - local changes not on the server yet
const PUSH_DELAY = 1500;

// --- the decision, kept pure so it can be tested without a browser ---

// Which save went further: boards solved first, then words found overall.
export function progressOf(stats) {
  const s = stats || {};
  return [s.solved || 0, (s.used || []).length, s.coins || 0];
}

export function moreProgress(a, b) {
  const x = progressOf(a);
  const y = progressOf(b);
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
}

// local:  { owner, version, dirty, state, stats } from localStorage
// server: { save: { state, stats, version } | null, owner }
// Returns { act: 'adopt' | 'push' | 'fresh' | 'none', version }
export function decide(local, server) {
  const hasLocal = Boolean(local.state || local.stats);
  const save = server.save;
  if (local.owner && local.owner !== server.owner) {
    // The copy on this device belongs to another account.
    return save ? { act: 'adopt' } : { act: 'fresh' };
  }
  // A copy without an owner was played before sign-in existed: it is unsynced.
  const dirty = local.dirty || (hasLocal && !local.owner);
  if (!save) return hasLocal ? { act: 'push', version: 0 } : { act: 'none' };
  if (!hasLocal) return { act: 'adopt' };
  if (local.version === save.version) {
    return dirty ? { act: 'push', version: save.version } : { act: 'none' };
  }
  if (!dirty && local.version !== undefined && local.version < save.version) return { act: 'adopt' };
  // Both sides changed: keep the one that went further.
  return moreProgress(save.stats, local.stats) ? { act: 'adopt' } : { act: 'push', version: save.version };
}

// --- browser part ---

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function write(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* private mode: the game still works */ }
}

function localCopy() {
  return {
    owner: read(OWNER_KEY) ?? undefined,
    version: read(VERSION_KEY) ?? undefined,
    dirty: read(DIRTY_KEY) === 1,
    state: read(STATE_KEY),
    stats: read(STATS_KEY),
  };
}

// Hub addresses: from <meta name="hub-id"> / "hub-home" when the page sets
// them (the test stand does), else filword.example.com -> id.example.com.
function hubUrl(name, sub) {
  if (typeof document === 'undefined') return ''; // unit tests run without a page
  const meta = document.querySelector(`meta[name="${name}"]`);
  if (meta && meta.content) return meta.content.replace(/\/$/, '');
  return `${location.protocol}//${location.hostname.replace(/^[^.]+/, sub)}`;
}
export const ID_URL = hubUrl('hub-id', 'id');
export const HOME_URL = hubUrl('hub-home', 'hub');

function loginUrl() {
  return `${HOME_URL}/?app=filword&next=${encodeURIComponent(location.href)}`;
}

// Several requests hitting an expired pass at once wait for one renewal.
let renewing = null;
function renewPass() {
  if (!renewing) {
    renewing = fetch(`${ID_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => { renewing = null; return r.ok; }, () => { renewing = null; return false; });
  }
  return renewing;
}

class SignInNeeded extends Error {}

// Request to our own API. 401 - the short pass expired; 403 - the pass was
// issued before this game joined the hub and does not list it. Both are
// cured by a new pass: get one and repeat once. Without that, 403 sent the
// page to the hub, the hub (session alive) sent it straight back, and round
// it went until the old pass expired on its own (30.10.2026).
// Still 401 or 403 after a renewal - a sign-in is needed.
async function api(method, body) {
  const opts = { method, credentials: 'same-origin', cache: 'no-store', headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let r = await fetch('/api/save', opts);
  if ((r.status === 401 || r.status === 403) && await renewPass()) r = await fetch('/api/save', opts);
  if (r.status === 401 || r.status === 403) throw new SignInNeeded();
  return r;
}

let owner = null;
let timer = null;
let pushing = null;
let onReplaced = () => location.reload();

function adopt(save) {
  write(STATE_KEY, save.state);
  write(STATS_KEY, save.stats);
  write(VERSION_KEY, save.version);
  write(DIRTY_KEY, null);
}

async function push(version) {
  const local = localCopy();
  const r = await api('PUT', { state: local.state || {}, stats: local.stats || {}, version });
  if (r.status === 409) {
    const { save } = await r.json();
    if (save && moreProgress(save.stats, read(STATS_KEY))) {
      adopt(save);
      onReplaced();
      return;
    }
    await push(save ? save.version : 0);
    return;
  }
  if (!r.ok) throw new Error(`save failed: ${r.status}`);
  const { version: saved } = await r.json();
  write(VERSION_KEY, saved);
  // Changed again while the request was on its way - it goes with the next push.
  if (!timer) write(DIRTY_KEY, null);
}

function flush() {
  timer = null;
  if (!owner || pushing) return pushing;
  pushing = push(read(VERSION_KEY) ?? 0)
    .catch((err) => {
      if (err instanceof SignInNeeded) location.replace(loginUrl());
      // Offline or the server is down: the copy stays dirty, the next change
      // or coming back online sends it.
    })
    .finally(() => {
      pushing = null;
      // Changed while this push was running and its timer already fired.
      if (read(DIRTY_KEY) === 1 && !timer && navigator.onLine) timer = setTimeout(flush, PUSH_DELAY);
    });
  return pushing;
}

// Before the game reads localStorage: bring it in line with the server.
// Resolves when the game may start; never resolves while leaving for sign-in.
export async function start({ replaced } = {}) {
  if (replaced) onReplaced = replaced;
  window.addEventListener('online', () => { if (read(DIRTY_KEY) === 1) flush(); });
  let server;
  try {
    const r = await api('GET');
    if (!r.ok) throw new Error(`load failed: ${r.status}`);
    server = await r.json();
  } catch (err) {
    if (err instanceof SignInNeeded) {
      location.replace(loginUrl());
      return new Promise(() => { /* the page is leaving */ });
    }
    // Offline: play the local copy, it goes to the server later.
    owner = read(OWNER_KEY);
    return;
  }
  owner = server.owner;
  const choice = decide(localCopy(), server);
  if (choice.act === 'adopt') adopt(server.save);
  if (choice.act === 'fresh') {
    [STATE_KEY, STATS_KEY, VERSION_KEY, DIRTY_KEY].forEach((k) => write(k, null));
  }
  write(OWNER_KEY, owner);
  if (choice.act === 'push') {
    write(DIRTY_KEY, 1);
    write(VERSION_KEY, choice.version);
    await flush();
  }
}

// The game saved locally: send it to the server a moment later, in one go.
export function changed() {
  write(DIRTY_KEY, 1);
  clearTimeout(timer);
  timer = setTimeout(flush, PUSH_DELAY);
}

// Sign-in is shared by all hub apps. Unsent progress goes first; then the
// local copy is wiped, so the next person on this device does not see it.
export async function logout() {
  clearTimeout(timer);
  timer = null;
  if (read(DIRTY_KEY) === 1) await flush();
  if (read(DIRTY_KEY) !== 1) {
    [STATE_KEY, STATS_KEY, VERSION_KEY, DIRTY_KEY, OWNER_KEY].forEach((k) => write(k, null));
  }
  await fetch(`${ID_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  location.replace(`${HOME_URL}/`);
}
