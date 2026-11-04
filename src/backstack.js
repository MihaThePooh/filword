// The phone's Back button closes what is open on top of the game - the word
// card, the menu, a panel, a try-on - instead of leaving the game.
//
// While anything is open the game keeps one extra history step. Back pops it:
// popstate closes the top layer, and if more stay open the step is put back.
// A layer closed by a tap removes itself; when nothing is left open the step
// is taken back with history.back(), and that popstate is ignored.
// Opening and closing in one go (menu -> shop) settles a tick later, so the
// history is touched once, not pushed and popped at the same time.
// Safe without a browser: then it only keeps the list.

const stack = []; // { key, close } - bottom first
let armed = false; // our history step is there
let skip = 0; // popstates caused by our own history.back()
let pending = false;

const hasHistory = () => typeof history !== 'undefined' && typeof addEventListener === 'function';

function sync() {
  pending = false;
  if (!hasHistory()) return;
  if (stack.length && !armed) {
    history.pushState({ layer: true }, '');
    armed = true;
  } else if (!stack.length && armed) {
    armed = false;
    skip++;
    history.back();
  }
}

function later() {
  if (pending) return;
  pending = true;
  setTimeout(sync, 0);
}

// key - anything that names the layer (its element); close - how Back closes it.
export function opened(key, close) {
  const i = stack.findIndex((x) => x.key === key);
  if (i >= 0) stack.splice(i, 1);
  stack.push({ key, close });
  later();
}

// The layer was closed by the game itself (a tap, a button).
export function closed(key) {
  const i = stack.findIndex((x) => x.key === key);
  if (i < 0) return;
  stack.splice(i, 1);
  later();
}

export const openLayers = () => stack.map((x) => x.key);

// What Back does; exported for tests.
export function onBack() {
  if (skip) { skip--; return; }
  armed = false;
  const top = stack.pop();
  if (top) top.close();
  later();
}

if (hasHistory()) addEventListener('popstate', onBack);
