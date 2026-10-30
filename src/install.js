// "Install" and "all apps" links in the footer.
//
// Chrome fires beforeinstallprompt when it is ready to install the game; the
// install dialog may only be opened from a tap. No event (the player declined
// recently, another browser) - the link turns into a hint about Chrome's menu.

import { HOME_URL } from './cloud.js';

const HUB_URL = `${HOME_URL}/`;
const INSTALLED = 'filword.installed';

function standalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function remembered() {
  try { return localStorage.getItem(INSTALLED) === '1'; } catch { return false; }
}

export function setupInstall() {
  const link = document.getElementById('install');
  document.getElementById('hub').href = HUB_URL;
  let offer = null;

  const hide = () => { link.hidden = true; };
  const markInstalled = () => {
    try { localStorage.setItem(INSTALLED, '1'); } catch { /* private mode */ }
    hide();
  };
  if (standalone() || remembered()) hide();

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); offer = e; });
  window.addEventListener('appinstalled', markInstalled);
  link.addEventListener('click', () => {
    if (!offer) {
      link.textContent = '⋮ в Chrome → «Добавить на главный экран»';
      return;
    }
    offer.prompt();
    offer.userChoice.then((r) => {
      if (r.outcome === 'accepted') markInstalled();
      offer = null;
    });
  });
}
