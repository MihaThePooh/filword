// Smooth open and close for the menu and the bottom panels.
//
// They are switched with the hidden attribute, and display:none cannot be
// animated away: opening plays a CSS animation by itself, but closing would
// cut off at once. So hide() first adds .closing (the "leave" animation in
// style.css) and sets hidden only when it has played.

import { opened, closed } from './backstack.js';

const LEAVE_MS = 200; // must match the closing animations in style.css

const reduced = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

// onBack - what the phone's Back button does while it is open (default: hide).
export function show(el, onBack = () => hide(el)) {
  clearTimeout(el._leave);
  el.classList.remove('closing');
  el.hidden = false;
  opened(el, onBack);
}

export function hide(el) {
  closed(el);
  if (el.hidden || el.classList.contains('closing')) return;
  if (reduced()) { el.hidden = true; return; }
  el.classList.add('closing');
  el._leave = setTimeout(() => {
    el.hidden = true;
    el.classList.remove('closing');
  }, LEAVE_MS);
}

export const toggle = (el) => (el.hidden || el.classList.contains('closing') ? show(el) : hide(el));
