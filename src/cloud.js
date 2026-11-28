import { keepSkins } from './skins.js';
// Sign-in through the hub and the player's save on the server.
//
// The game still plays from localStorage: it is the working copy and what
// keeps the game going offline. The server keeps the real save of the account,
// so progress survives a new phone or a cleared browser. Playing requires an
// account for cloud sync; local play stays available without a session.
//
// Two devices may play the same account. Every save carries the number of the
// server version it is based on; the server refuses a save made on top of an
// old version (409). Then the save with more progress wins - a week of play on
// one phone is never wiped by an evening on another.

import { MODES, currentMode } from './mode.js';
import { shopOf, mergeOwned } from './shop.js';

// Adopted stats, but with the backgrounds bought on this phone kept too.
function withOwned(stats, boughtHere) {
  const shop = shopOf(stats);
  const owned = mergeOwned(shop.owned, boughtHere);
  if (owned.length === shop.owned.length) return stats;
  return { ...stats, shop: { ...shop, owned } };
}

export const STATE_KEY = MODES.adult.stateKey;
export const STATS_KEY = MODES.adult.statsKey;
// The kids version keeps its own board and progress; on the server both go
// in one save, the kids part under "kids" inside state and stats.
const KIDS_STATE_KEY = MODES.kids.stateKey;
const KIDS_STATS_KEY = MODES.kids.statsKey;
const OWNER_KEY = 'filword-owner';     // account the local copy belongs to
const VERSION_KEY = 'filword-version'; // server version the local copy is based on
const DIRTY_KEY = 'filword-dirty';     // '1' - local changes not on the server yet
const PUSH_DELAY = 1500;

// --- the decision, kept pure so it can be tested without a browser ---

// Grown-up part plus the kids part under "kids" - one object for the server.
export function pack(main, kids) {
  if (!kids) return main ?? null;
  return { ...(main || {}), kids };
}

export function unpack(saved) {
  if (!saved) return [null, null];
  const { kids, ...main } = saved;
  return [Object.keys(main).length ? main : null, kids ?? null];
}

// Which save went further: boards solved first, then words found overall.
// Both versions count: an evening of the kids game is progress too.
export function progressOf(stats) {
  const one = (s) => [(s?.totalSolved || 0) + (s?.solved || 0), (s?.used || []).length, s?.coins || 0];
  const main = one(stats);
  const kids = one(stats?.kids);
  return main.map((v, i) => v + kids[i]);
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


// Recover each mode independently: an empty adult copy must not erase its cloud
// progress, and newer offline kids progress must survive the same sign-in.
export function recoverModes(local,server) {
  if(!server.save || !(local.state||local.stats) || (local.owner && local.owner!==server.owner))return null;
  const localStats=unpack(local.stats),remoteStats=unpack(server.save.stats);
  const localState=unpack(local.state),remoteState=unpack(server.save.state);
  const behind=(a,b)=>{
    const x=progressOf(a),y=progressOf(b);
    return y[0]>x[0] || (y[0]===x[0] && y[1]>x[1]);
  };
  if(!localStats.some((s,i)=>behind(s,remoteStats[i])))return null;
  const chosen=localStats.map((s,i)=>behind(s,remoteStats[i])||!s?1:0);
  return {version:server.save.version,
    stats:pack(...chosen.map((remote,i)=>remote?remoteStats[i]:localStats[i])),
    state:pack(...chosen.map((remote,i)=>remote?remoteState[i]:(localState[i]||remoteState[i])))};
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
    state: pack(read(STATE_KEY), read(KIDS_STATE_KEY)),
    stats: pack(read(STATS_KEY), read(KIDS_STATS_KEY)),
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

const LAST_ENTRY_KEY = 'filword-last-confirmed-entry';
const hasPlayableCopy=()=>Boolean(read(currentMode()==='kids'?KIDS_STATE_KEY:STATE_KEY));
function showSignInNotice(networkProblem=false) {
  if (typeof document === 'undefined' || document.getElementById('cloud-auth-needed')) return;
  const notice=document.createElement('dialog');notice.id='cloud-auth-needed';notice.className='cloud-auth-needed';
  const card=document.createElement('div');card.className='cloud-entry-card';
  const title=document.createElement('h2');title.textContent=networkProblem?'Не удалось загрузить сохранение':'Войди в аккаунт повторно';
  const text=document.createElement('p');text.textContent=networkProblem
    ?'Проверь подключение к интернету и повтори загрузку. Сохранённый прогресс не заменяется новой игрой.'
    :'Нужно подтвердить вход, чтобы загрузить твои поля, статистику и монеты. После входа ты вернёшься в филворд.';
  card.append(title,text);
  const identity=read('filword-account-identity');
  if(identity?.owner===read(OWNER_KEY)&&identity?.email){const mail=document.createElement('p');mail.className='account-email';mail.textContent='Последний аккаунт на устройстве: '+identity.email;card.append(mail);}
  const previous=read(LAST_ENTRY_KEY);
  if(previous?.owner && previous.owner===read(OWNER_KEY) && Number.isFinite(previous.at)) {
    const when=document.createElement('p');when.className='cloud-entry-date';
    when.textContent='Последний подтверждённый вход на этом устройстве: '+new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'long',timeStyle:'short'}).format(previous.at)+' (МСК).';card.append(when);
  }
  if(!networkProblem){const link=document.createElement('a');link.href=loginUrl();link.textContent='Войти в свой аккаунт';card.append(link);}
  const retry=document.createElement('button');retry.type='button';retry.textContent=networkProblem?'Повторить загрузку':'Я уже вошёл — загрузить игру';retry.onclick=()=>location.reload();card.append(retry);
  notice.append(card);notice.addEventListener('cancel',e=>e.preventDefault());document.body.append(notice);notice.showModal();
}

// Several requests hitting an expired pass at once wait for one renewal.
async function boundedFetch(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.arrayBuffer();
    return new Response(body.byteLength ? body : null, { status: response.status, headers: response.headers });
  }
  finally { clearTimeout(timeout); }
}
let renewing = null;
function renewPass() {
  if (!renewing) {
    renewing = boundedFetch(`${ID_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
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
export async function accountApi(path, method='GET', body, timeoutMs = 10000) {
  const prefix=typeof document==='undefined'?'':document.querySelector('meta[name=filword-api-prefix]')?.content||'';
  path=prefix+path;
  const opts = { method, credentials: 'same-origin', cache: 'no-store', headers: {} };
  if(typeof window!=='undefined' && window.filwordPreviewPlayer) opts.headers['X-Preview-Player']=window.filwordPreviewPlayer;
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let r = await boundedFetch(path, opts, timeoutMs);
  if ((r.status === 401 || r.status === 403) && await renewPass()) r = await boundedFetch(path, opts, timeoutMs);
  if (r.status === 401 || r.status === 403) throw new SignInNeeded();
  return r;
}

const api = (method,body) => accountApi('/api/save',method,body);

let owner = null;
let revision = 0;
let watchingConnection = false;
let timer = null;
let pushing = null;
let onReplaced = () => location.reload();

const SAVE_KEYS = [STATE_KEY, STATS_KEY, KIDS_STATE_KEY, KIDS_STATS_KEY];

function adopt(save) {
  // Backgrounds bought on this phone must not vanish when another phone's save
  // wins the merge: the one with more progress may carry fewer of them. So the
  // owned lists are joined, and the server keeps everything else it decided.
  const previous = read(STATS_KEY);
  const previousKids = read(KIDS_STATS_KEY);
  const boughtHere = shopOf(previous).owned;
  const [state, kidsState] = unpack(save.state);
  const [stats, kidsStats] = unpack(save.stats);
  write(STATE_KEY, state);
  write(STATS_KEY, stats && keepSkins(withOwned(stats, boughtHere), previous));
  write(KIDS_STATE_KEY, kidsState);
  write(KIDS_STATS_KEY, kidsStats && keepSkins(withOwned(kidsStats, shopOf(previousKids).owned), previousKids));
  write(VERSION_KEY, save.version);
  write(DIRTY_KEY, null);
}

async function push(version,attempt=0) {
  if(attempt>=3)throw new Error("Сохранение изменилось на другом устройстве. Повтори синхронизацию.");
  const local = localCopy();
  const sentRevision = revision;
  const r = await api('PUT', { state: local.state || {}, stats: local.stats || {}, version, championsVersion:1 });
  if (r.status === 409) {
    const { save } = await r.json();
    const recovered=recoverModes(localCopy(),{owner,save});
    if(recovered){adopt(recovered);write(DIRTY_KEY,1);await push(save.version ,attempt+1);onReplaced();return;}
    if (save && moreProgress(save.stats, localCopy().stats)) {
      adopt(save);
      onReplaced();
      return;
    }
    if (save?.stats?.champions) acceptChampions(save.stats.champions);
    await push(save ? save.version : 0,attempt+1);
    return;
  }
  if (!r.ok) throw new Error(`save failed: ${r.status}`);
  const { version: saved, champions } = await r.json();
  if (champions) acceptChampions(champions);
  write(VERSION_KEY, saved);
  // Changed again while the request was on its way - it goes with the next push.
  if (revision === sentRevision) write(DIRTY_KEY, null);
}

function flush() {
  timer = null;
  if (!owner || pushing) return pushing;
  let signInNeeded = false;
  pushing = push(read(VERSION_KEY) ?? 0)
    .catch((err) => {
      if (err instanceof SignInNeeded) {signInNeeded = true;showSignInNotice();}
      // Keep local play available when sign-in expires.
      // Offline or the server is down: the copy stays dirty, the next change
      // or coming back online sends it.
    })
    .finally(() => {
      pushing = null;
      // Changed while this push was running and its timer already fired.
      if (!signInNeeded && read(DIRTY_KEY) === 1 && !timer && navigator.onLine) timer = setTimeout(flush, PUSH_DELAY);
    });
  return pushing;
}

// Before the game reads localStorage: bring it in line with the server.
// Resolves when the local save is ready; uploads never hold the game open.
export async function start({ replaced } = {}) {
  if (replaced) onReplaced = replaced;
  if (!watchingConnection) {
    watchingConnection = true;
    let checkingSession=false;
    const recheckSession=async()=>{
      if(checkingSession||document.hidden||navigator.onLine===false||document.getElementById('cloud-auth-needed'))return;
      checkingSession=true;
      try{const response=await api('GET');if(response.ok){const data=await response.json();if(data.owner===read(OWNER_KEY))write(LAST_ENTRY_KEY,{owner:data.owner,at:Date.now()})}}catch(err){if(err instanceof SignInNeeded)showSignInNotice()}
      finally{checkingSession=false}
    };
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)recheckSession()});
    window.addEventListener('pageshow',e=>{if(e.persisted)recheckSession()});
    window.addEventListener('online', () => {
      if (owner) { if (read(DIRTY_KEY) === 1) flush(); }
      else start();
    });
  }
  owner = read(OWNER_KEY);
  if (navigator.onLine === false) {
    if(hasPlayableCopy())return;
    showSignInNotice(true);return new Promise(()=>{});
  }
  let server;
  try {
    // A dead connection must not hold the local game on its loading screen.
    let timeout;
    const request=api('GET').catch(err=>{if(err instanceof SignInNeeded)showSignInNotice();throw err;});
    const cached=Boolean(hasPlayableCopy());
    const r = await (cached ? Promise.race([request, new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('cloud timeout')), 6000);
    })]).finally(() => clearTimeout(timeout)) : request);
    if (!r.ok) throw new Error(`load failed: ${r.status}`);
    server = await r.json();
  } catch (err) {
    // Authentication is needed for cloud sync, not for local play.
    // Offline: play the local copy, it goes to the server later.
    owner = read(OWNER_KEY);
    if (err instanceof SignInNeeded) {showSignInNotice();return new Promise(()=>{});}
    if(!hasPlayableCopy()){showSignInNotice(true);return new Promise(()=>{});}
    return;
  }
  document.getElementById('cloud-auth-needed')?.remove();
  owner = server.owner;
  write(LAST_ENTRY_KEY,{owner,at:Date.now()});
  if (read(OWNER_KEY) === owner && server.save?.stats?.champions) acceptChampions(server.save.stats.champions);
  const recovered=recoverModes(localCopy(),server);
  if(recovered){adopt(recovered);write(DIRTY_KEY,1);write(OWNER_KEY,owner);window.dispatchEvent(new Event('filword-account-ready'));flush();return;}
  const choice = decide(localCopy(), server);
  if (choice.act === 'adopt') adopt(server.save);
  if (choice.act === 'fresh') {
    [...SAVE_KEYS, VERSION_KEY, DIRTY_KEY, 'filword-account-identity'].forEach((k) => write(k, null));
  }
  write(OWNER_KEY, owner);
  window.dispatchEvent(new Event('filword-account-ready'));
  if (choice.act === 'push') {
    write(DIRTY_KEY, 1);
    write(VERSION_KEY, choice.version);
    flush();
  }
}

// The game saved locally: send it to the server a moment later, in one go.
export function changed() {
  revision++;
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
    [...SAVE_KEYS, VERSION_KEY, DIRTY_KEY, OWNER_KEY, 'filword-account-identity'].forEach((k) => write(k, null));
  }
  await fetch(`${ID_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  location.replace(`${HOME_URL}/`);
}


// Merge the server's cumulative receipt into the latest local state, including
// changes made while the save request was in flight. Never replace that state.
export function mergeChampions(stats,award) {
  const prior=stats?.champions?.credit||0;
  const delta=Math.max(0,award.credit-prior);
  return {...stats,champions:award,coins:(stats?.coins||0)+delta,
    coinsEarned:(stats?.coinsEarned||0)+delta};
}
function acceptChampions(award) {
  const stats=read(STATS_KEY)||{};
  if(JSON.stringify(stats.champions)===JSON.stringify(award))return;
  write(STATS_KEY,mergeChampions(stats,award));
  window.dispatchEvent(new CustomEvent('champions-updated'));
}
export async function syncNow() {
  clearTimeout(timer);timer=null;
  if(pushing) await pushing;
  // A rival's save may have granted a prize since our last upload.
  if(owner && read(STATS_KEY)) write(DIRTY_KEY,1);
  if(read(DIRTY_KEY)===1) await flush();
  if(read(DIRTY_KEY)===1) throw new Error('Не удалось сохранить игру. Проверь подключение.');
}


// Email is shown only to the account holder, never sent to the ranking API.
export async function accountDetails() {
  const cached=read('filword-account-identity');
  const prior=cached?.owner===read(OWNER_KEY)?cached:null;
  if(navigator.onLine===false)return {email:prior?.email,state:'offline'};
  try{
    const save=await api('GET');if(!save.ok)throw new Error('save_unavailable');
    const data=await save.json();
    const options={credentials:'include',cache:'no-store'};
    let response=await boundedFetch(`${ID_URL}/api/me`,options);
    if(response.status===401 && await renewPass())response=await boundedFetch(`${ID_URL}/api/me`,options);
    if(response.status===401||response.status===403)throw new SignInNeeded();
    if(!response.ok)throw new Error('identity_unavailable');
    const identity=(await response.json()).account;
    if(identity?.id!==data.owner||typeof identity.email!=='string')throw new Error('identity_mismatch');
    write('filword-account-identity',{owner:identity.id,email:identity.email});
    return {email:identity.email,state:read(OWNER_KEY)!==data.owner?'changed':read(DIRTY_KEY)===1||!data.save?'pending':read(VERSION_KEY)!==data.save.version?'newer':'synced'};
  }catch(err){
    if(err instanceof SignInNeeded){showSignInNotice();return {state:'signed-out'}};
    return {email:prior?.email,state:'unavailable'};
  }
}
