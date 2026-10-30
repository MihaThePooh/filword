// The menu: burger in the header, a sheet with install, all apps, credits,
// sign-out and the version.
//
// Chrome fires beforeinstallprompt when it is ready to install the game; the
// install dialog may only be opened from a tap. No event (the player declined
// recently, another browser) - the item turns into a hint about Chrome's menu.

import { HOME_URL } from './cloud.js';

const HUB_URL = `${HOME_URL}/`;
const INSTALLED = 'filword.installed';

function standalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function remembered() {
  try { return localStorage.getItem(INSTALLED) === '1'; } catch { return false; }
}

function forget() {
  try { localStorage.removeItem(INSTALLED); } catch { /* private mode */ }
}

export function setupMenu() {
  const menu = document.getElementById('menu');
  const item = document.getElementById('install');
  const hint = item.querySelector('small');
  const close = () => { menu.hidden = true; };
  let offer = null;

  document.getElementById('burger').addEventListener('click', () => { menu.hidden = !menu.hidden; });
  // A tap past the sheet closes it - no separate cross needed.
  menu.addEventListener('click', (e) => { if (e.target === menu) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.getElementById('hub').addEventListener('click', () => { location.href = HUB_URL; });

  // "Installed" is only a guess: the icon can be removed from the phone
  // without the page knowing. So the item stays hidden only while Chrome is
  // silent; once it offers to install, the guess was wrong.
  const refresh = () => { item.hidden = standalone() || (remembered() && !offer); };
  const markInstalled = () => {
    try { localStorage.setItem(INSTALLED, '1'); } catch { /* private mode */ }
    offer = null;
    refresh();
  };
  refresh();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offer = e;
    forget();
    refresh();
  });
  window.addEventListener('appinstalled', markInstalled);
  item.addEventListener('click', () => {
    if (!offer) {
      hint.textContent = 'Chrome сейчас не предлагает сам: ⋮ в углу → «Добавить на главный экран».';
      return;
    }
    close();
    offer.prompt();
    offer.userChoice.then((r) => {
      if (r.outcome === 'accepted') markInstalled();
      offer = null;
    });
  });
}
