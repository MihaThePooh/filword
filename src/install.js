// The menu: burger in the header, a sheet with install, all apps, credits,
// sign-out and the version.
//
// Chrome fires beforeinstallprompt when it is ready to install the game; the
// install dialog may only be opened from a tap. No event (the player declined
// recently, another browser) - the item turns into a hint about Chrome's menu.

import { HOME_URL } from './cloud.js';
import { show, hide, toggle } from './sheets.js';

const HUB_URL = `${HOME_URL}/`;
// "Installed" used to be kept in localStorage, and the mark outlived a
// removed icon: in a tab opened from the hub Chrome never offers to install,
// so nothing cleared it (30.10.2026). Now only what is visible right now counts.
try { localStorage.removeItem('filword.installed'); } catch { /* private mode */ }

// Opened from the icon only when the launch came through start_url with the
// ?installed mark (manifest). Another site's page opened from the window of the
// installed hub answers display-mode: standalone too - the window is the hub's,
// and the menu said «установлена» where nothing was installed (30.10.2026).
const LAUNCH = 'filword.launched';
try {
  const url = new URL(location.href);
  if (url.searchParams.has('installed')) {
    sessionStorage.setItem(LAUNCH, '1');
    url.searchParams.delete('installed');
    history.replaceState(history.state, '', url.href);
  }
} catch { /* private mode - not from the icon */ }

function standalone() {
  const app = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  try { return app && sessionStorage.getItem(LAUNCH) === '1'; } catch { return false; }
}

export function setupMenu() {
  const menu = document.getElementById('menu');
  const item = document.getElementById('install');
  const close = () => hide(menu);
  let offer = null;

  document.getElementById('burger').addEventListener('click', () => toggle(menu));
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

  // Came from the hub's "Установить" button (?install): open the menu on the
  // install item and pulse it, so install is one tap away. The native install
  // dialog opens only on a tap, so it cannot be auto-popped from load.
  try {
    const iu = new URL(location.href);
    if (iu.searchParams.has('install')) {
      iu.searchParams.delete('install');
      history.replaceState(history.state, '', iu.href);
      if (!(standalone() || known)) {
        show(menu);
        item.classList.add('pulse');
        setTimeout(() => item.classList.remove('pulse'), 2400);
      }
    }
  } catch { /* private mode - the game just opens */ }

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
