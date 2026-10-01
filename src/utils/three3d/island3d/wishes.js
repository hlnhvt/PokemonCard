// Wish checkers: small goals the residents ask for, tested on the voxel grid.
import { W, H, D, AIR, WATER, LAMP, FLOWER, BERRY, TREE, STATUE, BED, LANTERN, FOUNTAIN, isSolid, WISHES } from './catalog';
import { getCell, idx, SIZE, coords } from './grid';

const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function countValue(g, v) {
  let n = 0;
  for (let i = 0; i < SIZE; i++) if (g.cells[i] === v) n++;
  return n;
}

/** Air cell with a 2-high space, a solid floor and a solid roof 2-3 blocks up. */
function roofed(g, x, y, z) {
  if (y < 1 || getCell(g, x, y, z) !== AIR || getCell(g, x, y + 1, z) !== AIR) return false;
  if (!isSolid(getCell(g, x, y - 1, z))) return false;
  return isSolid(getCell(g, x, y + 2, z)) || (getCell(g, x, y + 2, z) === AIR && isSolid(getCell(g, x, y + 3, z)));
}

/**
 * Rooms: connected roofed cells on one level, closed by walls (any block or decoration)
 * except for 1–2 open cells (the door). A one-cell room may only have one door.
 * Returns [{ y, cells: [[x, z]...], doors, inside: Set(idx) }].
 */
export function findRooms(g) {
  const rooms = [];
  const seen = new Uint8Array(SIZE);
  for (let y = 1; y < H - 2; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i0 = idx(x, y, z);
        if (seen[i0] || !roofed(g, x, y, z)) continue;
        const cells = [];
        const inside = new Set();
        const stack = [[x, z]];
        seen[i0] = 1;
        let doors = 0;
        let leaks = false;
        const open = new Set();
        while (stack.length) {
          const [cx, cz] = stack.pop();
          cells.push([cx, cz]);
          inside.add(idx(cx, y, cz));
          for (const [dx, dz] of DIRS4) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (nx < 0 || nz < 0 || nx >= W || nz >= D) {
              leaks = true;
              continue;
            }
            const ni = idx(nx, y, nz);
            if (getCell(g, nx, y, nz) !== AIR) continue; // a wall
            if (roofed(g, nx, y, nz)) {
              if (!seen[ni]) {
                seen[ni] = 1;
                stack.push([nx, nz]);
              }
            } else open.add(ni);
          }
        }
        doors = open.size;
        const maxDoors = cells.length >= 2 ? 2 : 1;
        if (!leaks && doors >= 1 && doors <= maxDoors && cells.length <= 40) rooms.push({ y, cells, doors, inside });
      }
    }
  }
  return rooms;
}

/** Decoration `v` standing inside a room (next to its floor cells, under its roof). */
function decorInRoom(g, room, v) {
  for (const [x, z] of room.cells) {
    for (const [dx, dz] of [[0, 0], ...DIRS4]) {
      const nx = x + dx;
      const nz = z + dz;
      if (getCell(g, nx, room.y, nz) !== v) continue;
      if (isSolid(getCell(g, nx, room.y + 1, nz)) || isSolid(getCell(g, nx, room.y + 2, nz)) || isSolid(getCell(g, nx, room.y + 3, nz))) return true;
    }
  }
  return false;
}

/** A lamp block or lantern in or right next to the room (walls, roof, beside the door). */
function lampByRoom(g, room) {
  for (const [x, z] of room.cells) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = -1; dy <= 3; dy++) {
          const v = getCell(g, x + dx, room.y + dy, z + dz);
          if (v === LAMP || v === LANTERN) return true;
        }
      }
    }
  }
  return false;
}

const roomResult = (rooms, pick) => {
  const room = rooms.find(pick);
  return { done: !!room, have: room ? 1 : 0, need: 1, room: room || null };
};

/** Largest group of touching water blocks. */
export function largestPond(g) {
  const seen = new Uint8Array(SIZE);
  let best = 0;
  for (let i = 0; i < SIZE; i++) {
    if (seen[i] || g.cells[i] !== WATER) continue;
    let n = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const [x, y, z] = coords(stack.pop());
      n++;
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ]) {
        if (getCell(g, x + dx, y + dy, z + dz) !== WATER) continue;
        const ni = idx(x + dx, y + dy, z + dz);
        if (!seen[ni]) {
          seen[ni] = 1;
          stack.push(ni);
        }
      }
    }
    best = Math.max(best, n);
  }
  return best;
}

/** Tallest stack of solid blocks above the grass (counted from y = 2). */
export function tallestTower(g) {
  let best = 0;
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      let run = 0;
      for (let y = 2; y < H; y++) {
        run = isSolid(getCell(g, x, y, z)) ? run + 1 : 0;
        best = Math.max(best, run);
      }
    }
  }
  return best;
}

/**
 * Longest bridge: a straight row of solid blocks (y ≥ 1) with nothing solid under them,
 * held up at both ends by solid blocks.
 */
export function longestBridge(g) {
  let best = 0;
  const free = (x, y, z) => isSolid(getCell(g, x, y, z)) && !isSolid(getCell(g, x, y - 1, z));
  for (let y = 1; y < H; y++) {
    for (const [ax, az] of [
      [1, 0],
      [0, 1],
    ]) {
      for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
          // Start of a run of free blocks
          if (!free(x, y, z) || free(x - ax, y, z - az)) continue;
          let n = 0;
          while (free(x + ax * n, y, z + az * n)) n++;
          const before = getCell(g, x - ax, y, z - az);
          const after = getCell(g, x + ax * n, y, z + az * n);
          if (isSolid(before) && isSolid(after)) best = Math.max(best, n);
        }
      }
    }
  }
  return best;
}

const counter = (v) => (g, need) => {
  const have = countValue(g, v);
  return { done: have >= need, have: Math.min(have, need), need };
};
const measure = (fn) => (g, need) => {
  const have = fn(g);
  return { done: have >= need, have: Math.min(have, need), need };
};

export const CHECKERS = {
  flowers: counter(FLOWER),
  berries: counter(BERRY),
  trees: counter(TREE),
  statue: counter(STATUE),
  fountain: counter(FOUNTAIN),
  pond: measure(largestPond),
  tower: measure(tallestTower),
  bridge: measure(longestBridge),
  house: (g) => roomResult(findRooms(g), () => true),
  houseLamp: (g) => roomResult(findRooms(g), (r) => lampByRoom(g, r)),
  bedroom: (g) => roomResult(findRooms(g), (r) => decorInRoom(g, r, BED)),
};

/** { done, have, need, room? } for a wish id. */
export function checkWish(g, wishId) {
  const w = WISHES.find((x) => x.id === wishId);
  if (!w) return { done: false, have: 0, need: 1 };
  return CHECKERS[w.kind](g, w.need);
}
