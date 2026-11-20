// Match each glass header card to the image actually underneath it.
// Only colour/shadow change: no geometry, opacity or animation-frame polling.
const linear = value => {
  const c = value / 255;
  return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]) => .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);

export function headerInk(samples) {
  if (!samples.length) return 'dark';
  // The existing white glass is kept at 30% opacity. A lower quantile protects
  // patterned areas rather than choosing from the wallpaper's average colour.
  const light = samples.map(rgb => luminance(rgb.map(c => .3 * 255 + .7 * c)));
  const score = value => {
    const contrasts = light.map(l => ratio(l, value)).sort((a, b) => a - b);
    return contrasts[Math.floor((contrasts.length - 1) * .15)];
  };
  return score(1) > score(luminance([16, 16, 16])) * 1.08 ? 'light' : 'dark';
}

let revision = 0, queued = false, observer, resizeObserver;
let loadedUrl = '', pixels;
const cards = () => [...document.querySelectorAll('header > .burger, header > div, header > .shop, header > .action')];
function paint(card, mode) {
  card.dataset.headerInk = mode;
}
function sampleCard(card, image) {
  const body = document.body.getBoundingClientRect(), box = card.getBoundingClientRect();
  const scale = Math.max(body.width / image.width, body.height / image.height);
  const ox = (body.width - image.width * scale) / 2;
  const oy = (body.height - image.height * scale) / 2;
  const samples = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 13; x++) {
    const ix = Math.max(0, Math.min(image.width - 1, Math.floor((box.left - body.left + box.width * (x + .5) / 13 - ox) / scale)));
    const iy = Math.max(0, Math.min(image.height - 1, Math.floor((box.top - body.top + box.height * (y + .5) / 5 - oy) / scale)));
    const i = (iy * image.width + ix) * 4;
    samples.push([image.data[i], image.data[i + 1], image.data[i + 2]]);
  }
  return samples;
}
async function refresh() {
  const token = ++revision;
  const value = getComputedStyle(document.body).getPropertyValue('--bgimg');
  const url = document.body.classList.contains('themed') && value.match(/url\(["']?(.*?)["']?\)/)?.[1];
  if (!url) { cards().forEach(card => delete card.dataset.headerInk); return; }
  try {
    let image = pixels;
    if (url !== loadedUrl) {
      const art = new Image(); art.src = url; await art.decode();
      if (token !== revision) return;
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = Math.round(art.height / art.width * 256);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(art, 0, 0, canvas.width, canvas.height);
      image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      loadedUrl = url; pixels = image;
    }
    if (token === revision) cards().forEach(card => paint(card, headerInk(sampleCard(card, image))));
  } catch {
    // Keep the existing glass and readable outline if an image cannot load.
    if (token === revision) cards().forEach(card => paint(card, 'dark'));
  }
}
export function updateHeaderContrast() {
  if (typeof document === 'undefined' || queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; refresh(); });
}
export function setupHeaderContrast() {
  if (observer) return;
  const header = document.querySelector('header');
  observer = new MutationObserver(updateHeaderContrast);
  observer.observe(header, { childList: true, characterData: true, subtree: true });
  resizeObserver = new ResizeObserver(updateHeaderContrast);
  resizeObserver.observe(document.body);
  cards().forEach(card => resizeObserver.observe(card));
  document.fonts?.ready.then(updateHeaderContrast);
  updateHeaderContrast();
}
