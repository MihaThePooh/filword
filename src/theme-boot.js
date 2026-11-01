// Paints the chosen background before the first frame.
//
// The game module waits for the dictionary and the save, so without this the
// default background showed first and the chosen one replaced it a moment
// later. This small classic script sits at the top of <body> and runs before
// anything is drawn: it reads the saved choice and applies it. Later the game's
// applyTheme (shop.js) does the same, so the two agree.
// Classic script, not a module: modules are deferred and would run too late.
(function () {
  try {
    var kids = localStorage.getItem('filword-mode') === 'kids';
    var key = kids ? 'filword-kids-stats' : 'filword-stats';
    var stats = JSON.parse(localStorage.getItem(key));
    var shop = stats && stats.shop;
    var id = shop && shop.active;
    var owned = (shop && shop.owned) || [];
    if (!id || !/^[a-z0-9-]+$/.test(id) || owned.indexOf(id) < 0) return;
    document.body.classList.add('themed');
    document.body.style.setProperty('--bgimg', 'url("data/bg/' + id + '.webp")');
  } catch (e) {
    // No storage or a broken save: the default background, the game goes on.
  }
}());
