// A random path that visits every cell of a size x size grid exactly once,
// moving only up/down/left/right. Cells are numbered row * size + col.
//
// Start from a plain zigzag (row by row) and shuffle it with "backbite" moves:
// the end of the path jumps to one of its grid neighbours, and the part of the
// path before that neighbour is reversed. The path stays valid after every move,
// so after enough moves it twists in all directions.

import { pick } from './rng.js';

export function neighbours(cell, size) {
  const r = Math.floor(cell / size);
  const c = cell % size;
  const out = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

function zigzag(size) {
  const path = [];
  for (let r = 0; r < size; r++) {
    for (let i = 0; i < size; i++) {
      path.push(r * size + (r % 2 ? size - 1 - i : i));
    }
  }
  return path;
}

export function randomPath(size, rng, moves = size * size * 100) {
  let path = zigzag(size);
  const pos = new Array(size * size); // cell -> index in path
  const reindex = () => path.forEach((cell, i) => { pos[cell] = i; });
  reindex();

  for (let m = 0; m < moves; m++) {
    // Work on the head; to move the tail, flip the whole path first.
    if (rng() < 0.5) {
      path.reverse();
      reindex();
    }
    const head = path[0];
    const n = pick(rng, neighbours(head, size));
    const i = pos[n];
    if (i === 1) continue; // already linked to the head
    // Reverse path[0..i-1]: the old head now sits next to cell n.
    const front = path.slice(0, i).reverse();
    path = front.concat(path.slice(i));
    for (let k = 0; k < i; k++) pos[path[k]] = k;
  }
  return path;
}
