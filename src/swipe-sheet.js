// Touch scrolling stays native; only a downward pull at the top owns the gesture.
const attached = new WeakMap();
let ignoreClickUntil = 0;
if (typeof document !== 'undefined') document.addEventListener('click', event => {
  if (event.detail && performance.now() < ignoreClickUntil) {
    event.preventDefault(); event.stopImmediatePropagation();
  }
}, true);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function shouldDismiss(distance, velocity, height) {
  return distance >= Math.max(64, Math.min(140, height * .25)) || (distance >= 28 && velocity > .55);
}
export function attachSwipe(panel, options) {
  if (attached.has(panel)) { const c = attached.get(panel); c.options = options; return c; }
  const handle = document.createElement('button');
  handle.type = 'button'; handle.className = 'sheet-grip';
  handle.setAttribute('aria-label', 'Закрыть панель');
  handle.title = 'Потяни вниз, чтобы закрыть';
  handle.innerHTML = '<span aria-hidden="true"></span>';
  panel.prepend(handle); panel.classList.add('swipe-panel');
  let gesture = null, animation = null, generation = 0, finishing = false;
  const controller = { options, reset() {
    generation++; gesture = null; finishing = false;
    animation?.cancel(); animation = null;
    panel.style.removeProperty('translate');
    panel.classList.remove('swipe-dragging');
  }};
  attached.set(panel, controller);
  const isOpen = () => controller.options.isOpen?.() !== false && panel.isConnected;
  function settle(distance, close) {
    gesture = null; panel.classList.remove('swipe-dragging');
    const token = ++generation;
    finishing = close;
    const target = close ? innerHeight + panel.getBoundingClientRect().height : 0;
    panel.style.translate = `0 ${target}px`;
    animation = panel.animate([{ translate: `0 ${distance}px` }, { translate: `0 ${target}px` }], {
      duration: reduced() ? 0 : close ? 180 : 220,
      easing: close ? 'cubic-bezier(.3,0,.7,1)' : 'cubic-bezier(.2,.8,.2,1)',
    });
    animation.finished.then(() => {
      if (token !== generation) return;
      animation = null;
      if (close && isOpen()) controller.options.dismiss();
      if (!close) panel.style.removeProperty('translate');
      finishing = false;
    }, () => {});
  }
  function begin(x, y, target, id, kind) {
    if (!isOpen() || finishing || gesture || target.closest('input,select,textarea,[contenteditable="true"]')) return;
    animation?.cancel(); animation = null;
    const grip = Boolean(target.closest('.sheet-grip'));
    gesture = { x, y, distance: 0, id, kind, active: false, blocked: !grip && panel.scrollTop > 1,
      samples: [[performance.now(), y]] };
  }
  function move(x, y, event) {
    const g = gesture;
    if (!g || g.blocked) return;
    const dx = x - g.x, dy = y - g.y;
    if (!g.active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) || dy < -8) { g.blocked = true; return; }
      if (dy < 8 || dy < Math.abs(dx) * 1.25) return;
      g.active = true;
      // Finish entrance animations before taking direct control of the panel.
      panel.getAnimations().forEach(a => { try { a.finish(); } catch {} });
      panel.classList.add('swipe-dragging');
      if (g.kind === 'pointer') panel.setPointerCapture(g.id);
    }
    if (event.cancelable) event.preventDefault();
    g.distance = Math.max(0, dy);
    panel.style.translate = `0 ${g.distance}px`;
    const now = performance.now();
    g.samples.push([now, y]);
    g.samples = g.samples.filter(([at]) => now - at < 100);
  }
  function end(cancel = false) {
    const g = gesture;
    if (!g) return;
    gesture = null;
    if (!g.active) return;
    ignoreClickUntil = performance.now() + 400;
    const now = performance.now(), first = g.samples.find(([at]) => now - at < 100);
    const last = g.samples.at(-1);
    const velocity = first && now - last[0] < 80 && last[0] > first[0] ? (last[1] - first[1]) / (last[0] - first[0]) : 0;
    settle(g.distance, !cancel && shouldDismiss(g.distance, velocity, panel.offsetHeight));
    if (g.kind === 'pointer' && panel.hasPointerCapture(g.id)) panel.releasePointerCapture(g.id);
  }
  panel.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) { end(true); return; }
    const t = event.touches[0]; begin(t.clientX, t.clientY, event.target, t.identifier, 'touch');
  }, { passive: true });
  panel.addEventListener('touchmove', event => {
    if (event.touches.length !== 1) { end(true); return; }
    const t = event.touches[0];
    if (gesture?.kind === 'touch' && t.identifier === gesture.id) move(t.clientX, t.clientY, event);
  }, { passive: false });
  panel.addEventListener('touchend', () => end(), { passive: true });
  panel.addEventListener('touchcancel', () => end(true), { passive: true });
  panel.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    begin(event.clientX, event.clientY, event.target, event.pointerId, 'pointer');
  });
  panel.addEventListener('pointermove', event => { if (gesture?.kind === 'pointer' && gesture.id === event.pointerId) move(event.clientX, event.clientY, event); });
  panel.addEventListener('pointerup', () => { if (gesture?.kind === 'pointer') end(); });
  panel.addEventListener('pointercancel', () => { if (gesture?.kind === 'pointer') end(true); });
  panel.addEventListener('lostpointercapture', () => { if (gesture?.kind === 'pointer') end(true); });
  handle.addEventListener('click', () => { if (isOpen() && !finishing) controller.options.dismiss(); });
  return controller;
}
