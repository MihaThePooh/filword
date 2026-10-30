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
  const close = () => { menu.hidden = true; };
  let offer = null;

  document.getElementById('burger').addEventListener('click', () => { menu.hidden = !menu.hidden; });
  // A tap past the sheet closes it - no separate cross needed.
  menu.addEventListener('click', (e) => { if (e.target === menu) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.getElementById('hub').addEventListener('click', () => { location.href = HUB_URL; });

  // The item is always there: when the game is installed it says so instead
  // of vanishing. "Installed" is only a guess: the icon can be removed from
  // the phone without the page knowing. So the guess is dropped once Chrome
  // offers to install again, and where Chrome can tell (Android, by
  // related_applications in the manifest) it answers itself.
  const refresh = () => {
    const done = (standalone() || remembered()) && !offer;
    item.disabled = done;
    item.classList.toggle('done', done);
    item.innerHTML = `${done ? 'Игра установлена' : 'Установить игру'}<small>Иконка «Филворд» на экране телефона</small>`;
  };
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
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps()
      .then((list) => { if (list.length) markInstalled(); })
      .catch(() => { /* not supported - stay with the guess */ });
  }
  item.addEventListener('click', () => {
    if (!offer) {
      item.querySelector('small').textContent =
        'Chrome сейчас не предлагает сам: ⋮ в углу → «Добавить на главный экран». Открыто из хаба — сначала ⋮ → «Открыть в Chrome».';
      return;
    }
    close();
    offer.prompt();
    offer.userChoice.then((r) => {
      offer = null;
      if (r.outcome === 'accepted') markInstalled();
      else refresh();
    });
  });
}
