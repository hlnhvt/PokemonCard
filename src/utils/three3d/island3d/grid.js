// Voxel grid of the island: indexing, the starter island and the compact (RLE) save format.
import { W, H, D, AIR, GRASS, DIRT, SAND, STONE, TREE, isBlock, isDecor, BLOCK_BY_ID, DECOR_BY_ID } from './catalog';

export const SIZE = W * H * D;
export const inBounds = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;
export const idx = (x, y, z) => x + W * (z + D * y);
export const coords = (i) => {
  const x = i % W;
  const z = Math.floor(i / W) % D;
  const y = Math.floor(i / (W * D));
  return [x, y, z];
};

export function createGrid() {
  return { cells: new Uint8Array(SIZE), paint: new Uint8Array(SIZE) };
}

export const cloneGrid = (g) => ({ cells: g.cells.slice(), paint: g.paint.slice() });

/** Cell value; outside the grid is air. */
export const getCell = (g, x, y, z) => (inBounds(x, y, z) ? g.cells[idx(x, y, z)] : AIR);
export function setCell(g, x, y, z, v, paint = 0) {
  if (!inBounds(x, y, z)) return false;
  const i = idx(x, y, z);
  g.cells[i] = v;
  g.paint[i] = isBlock(v) ? paint : 0;
  return true;
}

/** Height of the top surface at (x, z): one above the highest block, 0 if none. */
export function surfaceY(g, x, z) {
  for (let y = H - 1; y >= 0; y--) if (isBlock(getCell(g, x, y, z))) return y + 1;
  return 0;
}

// A little wobble so the coast is not a perfect circle (deterministic: no random)
const wobble = (x, z) => Math.sin(x * 1.3 + z * 0.7) * 0.45 + Math.cos(z * 1.1 - x * 0.5) * 0.35;

/** The starter island: a sandy beach around a grassy middle, a small hill and one tree. */
export function starterGrid() {
  const g = createGrid();
  const c = (W - 1) / 2;
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      const r = Math.hypot(x - c, z - (D - 1) / 2) + wobble(x, z);
      if (r < 9.2) setCell(g, x, 0, z, SAND);
      if (r < 7.4) {
        setCell(g, x, 0, z, DIRT);
        setCell(g, x, 1, z, GRASS);
      }
      // A hill to one side
      const hr = Math.hypot(x - 15, z - 7.5) + wobble(z, x) * 0.5;
      if (r < 7.4 && hr < 3.3) {
        setCell(g, x, 1, z, DIRT);
        setCell(g, x, 2, z, GRASS);
      }
      if (r < 7.4 && hr < 1.8) {
        setCell(g, x, 2, z, DIRT);
        setCell(g, x, 3, z, GRASS);
      }
    }
  }
  // A couple of rocks on the beach and one tree
  setCell(g, 4, 1, 12, STONE);
  setCell(g, 19, 1, 15, STONE);
  setCell(g, 8, 2, 9, TREE);
  return g;
}

const validValue = (v) => v === AIR || !!BLOCK_BY_ID[v] || !!DECOR_BY_ID[v];

/** Longest save string we write or accept. */
export const MAX_SAVE_CHARS = 120000;

/**
 * Run-length encoding of cells + paint: "code[*count]" in base 36, comma separated,
 * code = cell + 128 × paint. Returns null when it would not fit.
 */
export function encodeGrid(g) {
  const out = [];
  let prev = -1;
  let run = 0;
  const flush = () => {
    if (run) out.push(run > 1 ? `${prev.toString(36)}*${run.toString(36)}` : prev.toString(36));
  };
  for (let i = 0; i < SIZE; i++) {
    const code = g.cells[i] + 128 * (isBlock(g.cells[i]) ? g.paint[i] : 0);
    if (code === prev) run++;
    else {
      flush();
      prev = code;
      run = 1;
    }
  }
  flush();
  const s = out.join(',');
  return s.length > MAX_SAVE_CHARS ? null : s;
}

/** Inverse of encodeGrid; null for anything malformed, too long or of the wrong size. */
export function decodeGrid(s) {
  if (typeof s !== 'string' || !s || s.length > MAX_SAVE_CHARS) return null;
  const g = createGrid();
  let i = 0;
  for (const part of s.split(',')) {
    const [a, b] = part.split('*');
    const code = parseInt(a, 36);
    const run = b == null ? 1 : parseInt(b, 36);
    if (!Number.isFinite(code) || !Number.isFinite(run) || run < 1 || i + run > SIZE) return null;
    const v = code % 128;
    const p = Math.floor(code / 128);
    if (!validValue(v) || p > 8 || (p && !isBlock(v))) return null;
    g.cells.fill(v, i, i + run);
    g.paint.fill(p, i, i + run);
    i += run;
  }
  return i === SIZE ? g : null;
}

/** Number of blocks and decorations (for stats). */
export function countItems(g) {
  let blocks = 0;
  let decor = 0;
  for (let i = 0; i < SIZE; i++) {
    if (isBlock(g.cells[i])) blocks++;
    else if (isDecor(g.cells[i])) decor++;
  }
  return { blocks, decor };
}
