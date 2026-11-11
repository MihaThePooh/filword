// The shop: backgrounds for the whole app, bought with coins.
//
// A background is cosmetic and belongs to the account: what you bought and
// which one is on live in stats.shop, so they travel with the save to another
// phone. The picture files are pre-made (data/bg/<id>.webp) and listed here.
//
// Pure functions (catalog, can-buy, buy, set-active) are kept side-effect free
// so the economy can be tested without a browser; applyTheme is the only part
// that touches the page.

const PRICE = 700;
export const BACKGROUNDS = [
  { id: 'blue-floral', name: 'Синие цветы', price: PRICE },
  { id: 'burgundy-damask', name: 'Бордовый дамаск', price: PRICE },
  { id: 'roses', name: 'Винтажные розы', price: PRICE },
  { id: 'rug', name: 'Персидский ковёр', price: PRICE },
  { id: 'chintz', name: 'Ситец в цветочек', price: PRICE },
  { id: 'floral-stripes', name: 'Цветочные дорожки', price: PRICE },
  { id: 'brown-damask', name: 'Коричневый дамаск', price: PRICE },
  { id: 'olive-damask', name: 'Оливковый дамаск', price: PRICE },
  { id: 'green-ornament', name: 'Зелёные вензеля', price: PRICE },
  { id: 'gold-damask', name: 'Золотой дамаск', price: PRICE },
  { id: 'mint-damask', name: 'Мятный дамаск', price: PRICE },
  { id: 'blue-damask', name: 'Голубой дамаск', price: PRICE },
  { id: 'olive-stripes', name: 'Оливковая полоска', price: PRICE },
  { id: 'pistachio-stripes', name: 'Фисташковая полоска', price: PRICE },
  { id: 'teal-stripes', name: 'Бирюзовая полоска', price: PRICE },
  // 02.11.2026: ковры, гжель и вышивка
  { id: 'red-carpet', name: 'Красный ковёр', price: PRICE },
  { id: 'medallion-rug', name: 'Ковёр с медальоном', price: PRICE },
  { id: 'gzhel', name: 'Гжель', price: PRICE },
  { id: 'red-embroidery', name: 'Красная вышивка', price: PRICE },
  { id: 'star-embroidery', name: 'Вышитые звёзды', price: PRICE },
  { id: 'ribbon-embroidery', name: 'Узорные ленты', price: PRICE },
  { id: 'linen-embroidery', name: 'Вышивка на льне', price: PRICE },
  { id: 'black-embroidery', name: 'Вышивка на чёрном', price: PRICE },
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

// Try-on before buying: what the bar under a previewed background shows.
// short - coins still missing (0 when the background can be bought now).
export function tryOn(stats, id) {
  const item = byId.get(id);
  if (!item) return null;
  const coins = stats?.coins ?? 0;
  return { id, name: item.name, price: item.price, owned: isOwned(stats, id),
    short: Math.max(0, item.price - coins) };
}

// --- the one part that touches the page ---

// Paint the chosen background on the whole app, or clear it. Safe without a DOM.
// previewId - a background being tried on, painted instead of the worn one.
export function applyTheme(stats, previewId = null) {
  if (typeof document === 'undefined') return;
  const id = (previewId && byId.has(previewId)) ? previewId : activeId(stats);
  document.body.classList.toggle('themed', Boolean(id));
  if (id) document.body.style.setProperty('--bgimg', `url("${bgSrc(id)}")`);
  else document.body.style.removeProperty('--bgimg');
}
