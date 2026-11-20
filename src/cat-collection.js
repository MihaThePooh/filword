// Each owned cat gets one random cell, planned once and saved with the board.
const shuffle = (list, random) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

export function planCats(words, owned, random = Math.random) {
  const cells = shuffle(words.flatMap((word, i) => word.cells.map(cell => [i, cell])), random);
  const cats = shuffle([...new Set(owned)], random);
  return cats.slice(0, cells.length).map((id, i) => [...cells[i], id]);
}

export function revealCat(state, word, cells) {
  const valid = new Set(cells);
  const usedCells = new Set(state.placed.map(([cell]) => cell));
  const usedCats = new Set(state.placed.map(([, id]) => id));
  for (const [i, cell, id] of state.plan) {
    if (i !== word || !valid.has(cell) || usedCells.has(cell) || usedCats.has(id)) continue;
    state.placed.push([cell, id]);
    usedCells.add(cell); usedCats.add(id);
  }
}

// Preserve existing placements and hidden plans on reload/purchase. Old saves
// had one cat per word; keep their visible cats and migrate the remaining slots.
export function syncCats(words, owned, saved, found = [], random = Math.random) {
  const owners = new Set(owned);
  const wordByCell = new Map(words.flatMap((word, i) => word.cells.map(cell => [cell, i])));
  const state = { version: 2, plan: [], placed: [] };
  const usedCells = new Set(), usedCats = new Set();
  const keep = (cell, id, visible) => {
    if (!wordByCell.has(cell) || !owners.has(id) || usedCells.has(cell) || usedCats.has(id)) return;
    state.plan.push([wordByCell.get(cell), cell, id]);
    if (visible) state.placed.push([cell, id]);
    usedCells.add(cell); usedCats.add(id);
  };
  for (const [cell, id] of saved?.placed || []) keep(cell, id, true);
  if (saved?.version === 2) for (const [, cell, id] of saved.plan || []) keep(cell, id, false);
  const remaining = words.map(word => ({ cells: word.cells.filter(cell => !usedCells.has(cell)) }));
  state.plan.push(...planCats(remaining, owned.filter(id => !usedCats.has(id)), random));
  for (const i of found) if (words[i]) revealCat(state, i, words[i].cells);
  return state;
}
