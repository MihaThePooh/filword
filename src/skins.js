import { CAT_ROSTER } from './cat-roster.js';
export { CAT_ROSTER };
// Cell cosmetics have their own inventory: buying a skin never changes the wallpaper.
export const CELL_SKINS = CAT_ROSTER.map(cat => ({ id: cat.id, name: cat.name, price: 500 }));
const catalog = new Map(CELL_SKINS.map(item => [item.id, item]));
// Spread the related base portraits through the themed cats. Keep this order
// stable when returning from try-on so the catalogue never jumps under a finger.
export function catShopOrder() {
  const themed = [], base = [];
  CAT_ROSTER.forEach((cat,index) => (cat.id.startsWith('c') ? themed : base).push(index));
  const slots = new Map(base.map((_, i) => [Math.floor(i * CAT_ROSTER.length / base.length), base[(i * 7) % base.length]]));
  let next = 0;
  return CAT_ROSTER.map((_,slot) => slots.has(slot) ? slots.get(slot) : themed[(next++ * 19) % themed.length]);
}

let currentPool;
let previewCat = null;
export function skinsOf(stats) {
  const s = stats?.skins;
  const legacy = Array.isArray(s?.owned) && s.owned.includes('ginger-cats');
  const owned = legacy ? CAT_ROSTER.map(c => c.id) : [...new Set((Array.isArray(s?.owned) ? s.owned : []).filter(id => catalog.has(id)))];
  return { owned, active: owned.length && s?.active ? 'cats' : null };
}
export const ownsSkin = (stats, id) => skinsOf(stats).owned.includes(id);
export const activeSkin = stats => skinsOf(stats).active;
export function trySkin(stats, id) {
  const item = catalog.get(id);
  return item ? { ...item, owned: ownsSkin(stats, id), short: Math.max(0, item.price - (stats?.coins ?? 0)) } : null;
}
export function buySkin(stats, id) {
  const item = trySkin(stats, id);
  if (!item || item.owned || item.short) return null;
  return { ...stats, coins: stats.coins - item.price, skins: { owned: [...skinsOf(stats).owned, id], active: 'cats' } };
}
export function wearSkin(stats, id) {
  const skins = skinsOf(stats);
  if (id !== null && !skins.owned.includes(id)) return stats;
  return { ...stats, skins: { ...skins, active: id === null ? null : 'cats' } };
}
export function keepSkins(stats, previous) {
  const remote = skinsOf(stats), local = skinsOf(previous);
  if (!local.owned.length) return stats;
  return { ...stats, skins: { ...remote, owned: [...new Set([...remote.owned, ...local.owned])] } };
}
export function applySkin(stats, preview = undefined) {
  if (typeof document === 'undefined') return;
  const worn = skinsOf(stats);
  const ids = preview === undefined ? (worn.active ? worn.owned : []) : (catalog.has(preview) ? [preview] : []);
  document.body.classList.toggle('cat-skin', ids.length > 0);
  previewCat = preview === undefined ? null : ids[0] ?? null;
}

// All 64 cells get a stable, distinct combination. No randomness on redraw/reload.
const POSES = ['sit', 'curious', 'wink', 'sleepy', 'sleep', 'stretch', 'hang', 'play'];
const COATS = ['ginger', 'cream', 'silver', 'chocolate', 'snow', 'smoke', 'sand', 'cinnamon'];
export function catVariant(index = 0) {
  const n = ((Math.trunc(index) % 64) + 64) % 64;
  const pose = POSES[n % 8];
  const coat = COATS[(Math.floor(n / 8) + n % 8 * 3) % 8];
  return { id: n, pose, coat, illustrated: n % 8 >= 4,
    paws: n % 3, ears: Math.floor(n / 3) % 3, nose: Math.floor(n / 5) % 3 };
}

// Decorative parts never contain text or catch a pointer. The letter and hitbox stay fixed.
function variantMarkup(index = 0) {
  const v = catVariant(index);
  const classes = `kitten pose-${v.pose} coat-${v.coat} paws-${v.paws} ears-${v.ears} nose-${v.nose}`;
  const art = v.illustrated ? '<span class="cat-portrait"></span>'
    : '<span class="cat-tail"></span><span class="cat-body"></span>'
    + '<span class="cat-head"><span class="cat-ear ear-left"></span><span class="cat-ear ear-right"></span><span class="cat-face"></span><span class="cat-eye eye-left"><i></i></span><span class="cat-eye eye-right"><i></i></span><span class="cat-nose"></span></span>';
  return `<span class="${classes}" data-cat="${v.id}" aria-hidden="true">${art}</span>`;
}
export function shuffleCats(count = 64, random = Math.random, pool = currentPool) {
  const available = pool?.length ? pool : CAT_ROSTER.map((_, i) => i);
  const order = Array.from({ length: count }, (_, i) => available[i % available.length]);
  // Shuffle the full catalogue before taking a kids-board subset.
  if (count < available.length) order.splice(0, order.length, ...available);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, count);
}
export function catMarkup(index = 0) {
  const item = CAT_ROSTER[((Math.trunc(index) % CAT_ROSTER.length) + CAT_ROSTER.length) % CAT_ROSTER.length];
  if (item.src) return `<span class="kitten approved-cat" data-cat="${item.id}" aria-hidden="true"><span class="cat-approved-art" style="background-image:url('${item.src}')"></span></span>`;
  return variantMarkup(item.variantIndex).replace(`data-cat="${item.variantIndex}"`, `data-cat="${item.id}"`);
}
const opticalOffsets = new Map();
let fontCanvas;
// Locate the visible glyph so the artwork follows it; never reposition the text.
function glyphMetrics(el, letter) {
  const style = getComputedStyle(el);
  const font = `${style.fontStyle} ${style.fontWeight} 100px ${style.fontFamily}`;
  const glyph = letter.toLocaleUpperCase('ru');
  const key = font + glyph;
  if (!opticalOffsets.has(key)) {
    fontCanvas ||= document.createElement('canvas');
    const ctx = fontCanvas.getContext('2d'); ctx.font = font;
    const m = ctx.measureText(glyph);
    const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
    const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
    opticalOffsets.set(key, { y: (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent - ascent + descent) / 200, x: (m.width - m.actualBoundingBoxRight + m.actualBoundingBoxLeft) / 200, width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent });
  }
  return opticalOffsets.get(key);
}
export function paintLetter(el, letter, catId = null) {
  const id = previewCat ?? catId;
  const cats = document.body.classList.contains('cat-skin') && catalog.has(id);
  el.classList.toggle('cat-cell', cats);
  if (!cats) {
    if (el.querySelector('.cell-letter') || el.textContent !== letter) el.textContent = letter;
    el.removeAttribute('aria-label');
    return;
  }
  const index = CAT_ROSTER.findIndex(cat => cat.id === id);
  el.dataset.catIndex = index;
  const item = CAT_ROSTER[index];
  const expected = item.id;
  el.style.setProperty('--letter-x', item.disc.x + '%');
  el.style.setProperty('--letter-y', item.disc.y + '%');
  el.style.setProperty('--body-disc-x', (item.disc.bodyX ?? 50) + '%');
  el.style.setProperty('--body-disc-y', (item.disc.bodyY ?? 45.94) + '%');
  let text = el.querySelector('.cell-letter');
  if (!text || el.querySelector('.kitten')?.dataset.cat !== expected) {
    el.innerHTML = catMarkup(Number(el.dataset.catIndex) || 0) + '<span class="cell-letter"></span>';
    text = el.querySelector('.cell-letter');
  }
  if (text.textContent !== letter || !el.style.getPropertyValue('--glyph-shift-y')) {
    text.textContent = letter;
    const m = glyphMetrics(text, letter);
    // Keep the original letter baseline; move only the artwork to its visible centre.
    el.style.setProperty('--glyph-shift-x', -m.x * .93 + 'em');
    el.style.setProperty('--glyph-shift-y', -m.y * .93 + 'em');
  }
  el.setAttribute('aria-label', letter);
}

export function paintCatSample(el, index, letter = 'А') {
  el.dataset.catIndex = index;
  const item = CAT_ROSTER[index];
  el.style.setProperty('--letter-x', item.disc.x + '%');
  el.style.setProperty('--letter-y', item.disc.y + '%');
  el.style.setProperty('--body-disc-x', (item.disc.bodyX ?? 50) + '%');
  el.style.setProperty('--body-disc-y', (item.disc.bodyY ?? 45.94) + '%');
  el.innerHTML = catMarkup(index) + '<span class="cell-letter"></span>';
  const text = el.querySelector('.cell-letter'); text.textContent = letter;
  const m = glyphMetrics(text, letter);
  el.style.setProperty('--glyph-shift-x', -m.x * .93 + 'em');
  el.style.setProperty('--glyph-shift-y', -m.y * .93 + 'em');
}
