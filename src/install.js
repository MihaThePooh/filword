// The menu: burger in the header, a sheet with install, all apps, credits,
// sign-out and the version.
//
// Chrome fires beforeinstallprompt when it is ready to install the game; the
// install dialog may only be opened from a tap. No event (the player declined
// recently, another browser) - the item turns into a hint about Chrome's menu.

import { HOME_URL } from './cloud.js';

const HUB_URL = `${HOME_URL}/`;
// "Installed" used to be kept in localStorage, and the mark outlived a
// removed icon: in a tab opened from the hub Chrome never offers to install,
// so nothing cleared it (30.10.2026). Now only what is visible right now counts.
try { localStorage.removeItem('filword.installed'); } catch { /* private mode */ }

function standalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
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
  // of vanishing. "Installed" only when it is visible: opened from the icon,
  // Chrome answered by related_applications in the manifest, or just installed.
  let known = false;
  const refresh = () => {
    const done = (standalone() || known) && !offer;
    item.disabled = done;
    item.classList.toggle('done', done);
    item.innerHTML = `${done ? 'Игра установлена' : 'Установить игру'}<small>Иконка «Филворд» на экране телефона</small>`;
  };
  const markInstalled = () => {
    known = true;
    offer = null;
    refresh();
  };
  refresh();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offer = e;
    known = false;
    refresh();
  });
  window.addEventListener('appinstalled', markInstalled);
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps()
      .then((list) => { if (list.length) markInstalled(); })
      .catch(() => { /* not supported - count as not installed */ });
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
