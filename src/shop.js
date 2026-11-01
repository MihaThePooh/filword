// The shop: backgrounds for the whole app, bought with coins.
//
// A background is cosmetic and belongs to the account: what you bought and
// which one is on live in stats.shop, so they travel with the save to another
// phone. The picture files are pre-made (data/bg/<id>.webp) and listed here.
//
// Pure functions (catalog, can-buy, buy, set-active) are kept side-effect free
// so the economy can be tested without a browser; applyTheme is the only part
// that touches the page.

export const BACKGROUNDS = [
  { id: 'roses', name: 'Винтажные розы', price: 700 },
  { id: 'rug', name: 'Персидский ковёр', price: 700 },
];

export const bgSrc = (id) => `data/bg/${id}.webp`;

const byId = new Map(BACKGROUNDS.map((b) => [b.id, b]));
export const catalogItem = (id) => byId.get(id) ?? null;

// stats.shop is { owned: [id…], active: id|null }. Missing or broken - start empty.
export function shopOf(stats) {
  const s = stats?.shop;
  const owned = Array.isArray(s?.owned) ? s.owned.filter((id) => byId.has(id)) : [];
  const active = owned.includes(s?.active) ? s.active : null;
  return { owned, active };
}

export const isOwned = (stats, id) => shopOf(stats).owned.includes(id);
export const activeId = (stats) => shopOf(stats).active;

// Enough coins, a real background, not already owned.
export function canBuy(stats, id) {
  const item = byId.get(id);
  if (!item || isOwned(stats, id)) return false;
  return (stats?.coins ?? 0) >= item.price;
}

// Returns new stats with the coins spent and the background owned and worn,
// or null if the purchase is not allowed. Never mutates the input.
export function buy(stats, id) {
  if (!canBuy(stats, id)) return null;
  const shop = shopOf(stats);
  return {
    ...stats,
    coins: stats.coins - byId.get(id).price,
    shop: { owned: [...shop.owned, id], active: id },
  };
}

// Put a background on (must be owned) or take it off (id = null).
// Returns new stats, or the same object if nothing changes.
export function setActive(stats, id) {
  const shop = shopOf(stats);
  if (id !== null && !shop.owned.includes(id)) return stats;
  if (shop.active === id) return stats;
  return { ...stats, shop: { ...shop, active: id } };
}

// Merge two owned lists into one without repeats: used so a background bought
// on this phone is never lost when a save from another phone is adopted.
export function mergeOwned(a, b) {
  return [...new Set([...(a || []), ...(b || [])])];
}

// --- the one part that touches the page ---

// Paint the chosen background on the whole app, or clear it. Safe without a DOM.
export function applyTheme(stats) {
  if (typeof document === 'undefined') return;
  const id = activeId(stats);
  document.body.classList.toggle('themed', Boolean(id));
  if (id) document.body.style.setProperty('--bgimg', `url("${bgSrc(id)}")`);
  else document.body.style.removeProperty('--bgimg');
}
