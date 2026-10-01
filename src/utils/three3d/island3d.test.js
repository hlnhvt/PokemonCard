import { describe, it, expect } from 'vitest';
import {
  W,
  H,
  D,
  AIR,
  GRASS,
  DIRT,
  SAND,
  STONE,
  WOOD,
  WATER,
  LAMP,
  BRICK,
  TREE,
  FLOWER,
  BERRY,
  BED,
  LANTERN,
  STATUE,
  FOUNTAIN,
  WISHES,
  SAVE_KEY,
  MAX_SAVE_CHARS,
  MAX_GUESTS,
  createIsland,
  applyTool,
  undo,
  resetIsland,
  step,
  setNight,
  inviteResident,
  targetFor,
  getCell,
  setCell,
  inBounds,
  idx,
  coords,
  surfaceY,
  starterGrid,
  encodeGrid,
  decodeGrid,
  serialize,
  parseSave,
  saveIsland,
  loadSaved,
  standable,
  neighbours,
  findPath,
  checkWish,
  findRooms,
  largestPond,
  tallestTower,
  longestBridge,
  countItems,
  isSolid,
  snap,
  wishText,
} from './island3d';
import { createGrid } from './island3d/grid';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pika.png' };
const fresh = (seed = 1) => createIsland({ random: seeded(seed), player: PLAYER });
const UP = [0, 1, 0];
const FACES = [
  [0, 1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [0, -1, 0],
];

/** A tap that builds into cell t: on the face of a neighbouring block, or on the sea at y = 0. */
function hitFor(g, [x, y, z]) {
  for (const n of FACES) {
    const c = [x - n[0], y - n[1], z - n[2]];
    const v = getCell(g, ...c);
    if (v && v < 64 && inBounds(...c)) return { cell: c, normal: n };
  }
  return y === 0 ? { sea: [x, z] } : null;
}

function put(s, block, t) {
  const r = applyTool(s, 'place', hitFor(s.grid, t), { block });
  expect(r.ok, `place ${block} at ${t}`).toBe(true);
  expect(r.cell).toEqual(t);
}
function decorOn(s, decor, x, z) {
  const y = surfaceY(s.grid, x, z);
  const r = applyTool(s, 'decor', { cell: [x, y - 1, z], normal: UP }, { decor });
  expect(r.ok, `decor ${decor} at ${x},${z}`).toBe(true);
}

/** Grass columns at height 2, not yet used by the bot. */
function grassSpots(s, used) {
  const out = [];
  for (let z = 2; z < D - 2; z++) for (let x = 2; x < W - 2; x++) if (!used.has(`${x},${z}`) && surfaceY(s.grid, x, z) === 2 && getCell(s.grid, x, 1, z) === GRASS) out.push([x, z]);
  return out;
}
function rectSpot(s, used, w, d) {
  const free = new Set(grassSpots(s, used).map((p) => p.join(',')));
  for (let z = 2; z < D - 2; z++) {
    for (let x = 2; x < W - 2; x++) {
      let ok = true;
      for (let dz = 0; dz < d && ok; dz++) for (let dx = 0; dx < w && ok; dx++) ok = free.has(`${x + dx},${z + dz}`);
      if (ok) {
        for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) used.add(`${x + dx},${z + dz}`);
        return [x, z];
      }
    }
  }
  throw new Error('no space');
}

// Builders (as a child would do it, one block per tap)
const build = {
  flowers(s, used, n = 5) {
    for (const [x, z] of grassSpots(s, used).slice(0, n)) {
      used.add(`${x},${z}`);
      decorOn(s, FLOWER, x, z);
    }
  },
  decor(s, used, id, n) {
    const spots = grassSpots(s, used);
    for (let k = 0; k < n; k++) {
      const [x, z] = spots[k * 3];
      used.add(`${x},${z}`);
      decorOn(s, id, x, z);
    }
  },
  pond(s, used) {
    const [px, pz] = rectSpot(s, used, 3, 2);
    for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 3; dx++) expect(applyTool(s, 'remove', { cell: [px + dx, 1, pz + dz], normal: UP }).ok).toBe(true);
    for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 3; dx++) put(s, WATER, [px + dx, 1, pz + dz]);
  },
  /** 2×2 room, 2-high walls with a door, 4×4 roof. Returns the interior corner. */
  house(s, used) {
    const [bx, bz] = rectSpot(s, used, 4, 5); // the extra row is the space in front of the door
    const ox = bx;
    const oz = bz + 1;
    for (let y = 2; y <= 3; y++) {
      for (let dz = 0; dz < 4; dz++) {
        for (let dx = 0; dx < 4; dx++) {
          const ring = dx === 0 || dz === 0 || dx === 3 || dz === 3;
          const door = dx === 1 && dz === 0;
          if (ring && !door) put(s, WOOD, [ox + dx, y, oz + dz]);
        }
      }
    }
    // Roof: start on the walls, then fill the middle from the sides
    for (const [dx, dz] of [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [0, 1],
      [3, 1],
      [0, 2],
      [3, 2],
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ])
      put(s, BRICK, [ox + dx, 4, oz + dz]);
    return [ox + 1, oz + 1];
  },
  inside(s, [ix, iz], id, dx, dz) {
    const r = applyTool(s, 'decor', { cell: [ix + dx, 1, iz + dz], normal: UP }, { decor: id });
    expect(r.ok).toBe(true);
  },
  bridge(s) {
    for (let z = 0; z < D; z++) {
      let x0 = -1;
      for (let x = W - 1; x >= 0; x--)
        if (isSolid(getCell(s.grid, x, 0, z))) {
          x0 = x;
          break;
        }
      if (x0 < 0 || x0 + 4 >= W || getCell(s.grid, x0, 1, z) !== AIR) continue;
      put(s, STONE, [x0, 1, z]);
      for (let k = 1; k <= 3; k++) put(s, WOOD, [x0 + k, 1, z]);
      put(s, STONE, [x0 + 4, 0, z]);
      put(s, STONE, [x0 + 4, 1, z]);
      return;
    }
    throw new Error('no bridge spot');
  },
  tower(s, used) {
    const [x, z] = rectSpot(s, used, 1, 1);
    for (let y = 2; y < 10; y++) put(s, STONE, [x, y, z]);
  },
};

describe('island3d grid', () => {
  it('ISL-01 set/get and bounds', () => {
    const g = createGrid();
    expect(inBounds(0, 0, 0)).toBe(true);
    expect(inBounds(W, 0, 0)).toBe(false);
    expect(inBounds(0, H, 0)).toBe(false);
    expect(inBounds(0, 0, -1)).toBe(false);
    expect(setCell(g, 3, 4, 5, STONE, 2)).toBe(true);
    expect(getCell(g, 3, 4, 5)).toBe(STONE);
    expect(g.paint[idx(3, 4, 5)]).toBe(2);
    expect(setCell(g, -1, 0, 0, STONE)).toBe(false);
    expect(getCell(g, 99, 0, 0)).toBe(AIR);
    expect(coords(idx(7, 3, 11))).toEqual([7, 3, 11]);
  });

  it('ISL-02 starter island: beach, grass, hill, one tree, no wish already true', () => {
    const g = starterGrid();
    const { blocks, decor } = countItems(g);
    expect(blocks).toBeGreaterThan(300);
    expect(decor).toBe(1);
    expect(getCell(g, 8, 2, 9)).toBe(TREE);
    expect(Math.max(...[...Array(W)].flatMap((_, x) => [...Array(D)].map((__, z) => surfaceY(g, x, z))))).toBe(4);
    // Rocks sit on something
    for (let i = 0; i < g.cells.length; i++) {
      if (g.cells[i] === STONE) expect(isSolid(getCell(g, coords(i)[0], coords(i)[1] - 1, coords(i)[2]))).toBe(true);
    }
    expect(getCell(g, 0, 0, 0)).toBe(AIR); // sea in the corners
    expect([getCell(g, 12, 0, 12), getCell(g, 12, 1, 12)]).toEqual([DIRT, GRASS]);
    expect(getCell(g, 12, 0, 3)).toBe(SAND);
    for (const w of WISHES) expect(checkWish(g, w.id).done, w.id).toBe(false);
  });
});

describe('island3d tools', () => {
  it('ISL-03 place on a face: top, side, sea; not into a filled cell or outside', () => {
    const s = fresh();
    expect(targetFor(s, { cell: [12, 1, 12], normal: UP }, 'place')).toEqual([12, 2, 12]);
    expect(targetFor(s, { cell: [12, 1, 12], normal: [1, 0, 0] }, 'place')).toBeNull(); // grass next door
    expect(applyTool(s, 'place', { cell: [12, 1, 12], normal: UP }, { block: WOOD }).ok).toBe(true);
    expect(getCell(s.grid, 12, 2, 12)).toBe(WOOD);
    expect(applyTool(s, 'place', { cell: [12, 2, 12], normal: [1, 0, 0] }, { block: WOOD }).cell).toEqual([13, 2, 12]);
    expect(applyTool(s, 'place', { sea: [0, 0] }, { block: SAND }).cell).toEqual([0, 0, 0]);
    expect(applyTool(s, 'place', { sea: [0, 0] }, { block: SAND }).ok).toBe(false);
    expect(applyTool(s, 'place', { cell: [0, 0, 0], normal: [-1, 0, 0] }, { block: SAND }).reason).toBe('nowhere');
    // The top of the world
    for (let y = 1; y < H; y++) setCell(s.grid, 2, y, 2, STONE);
    expect(applyTool(s, 'place', { cell: [2, H - 1, 2], normal: UP }, { block: STONE }).ok).toBe(false);
    expect(s.events.filter((e) => e.type === 'place')).toHaveLength(3);
  });

  it('ISL-04 locked blocks and decorations cannot be used yet', () => {
    const s = fresh();
    expect(applyTool(s, 'place', { cell: [12, 1, 12], normal: UP }, { block: LAMP }).reason).toBe('locked');
    expect(applyTool(s, 'decor', { cell: [12, 1, 12], normal: UP }, { decor: BED }).reason).toBe('locked');
    expect(applyTool(s, 'decor', { cell: [12, 1, 12], normal: UP }, { decor: FLOWER }).ok).toBe(true);
    // Decorations go on top of a block only, and nothing is built onto a decoration
    expect(applyTool(s, 'decor', { cell: [11, 1, 12], normal: [0, 0, 1] }, { decor: FLOWER }).ok).toBe(false);
    expect(applyTool(s, 'place', { cell: [12, 2, 12], normal: UP }, { block: WOOD }).ok).toBe(false);
  });

  it('ISL-05 remove (and the decoration on top goes too), paint, multi-step undo', () => {
    const s = fresh();
    applyTool(s, 'decor', { cell: [12, 1, 12], normal: UP }, { decor: FLOWER });
    expect(applyTool(s, 'remove', { cell: [12, 1, 12], normal: UP }).ok).toBe(true);
    expect(getCell(s.grid, 12, 1, 12)).toBe(AIR);
    expect(getCell(s.grid, 12, 2, 12)).toBe(AIR);
    expect(s.events.find((e) => e.type === 'remove').id).toBe(GRASS);
    expect(applyTool(s, 'paint', { cell: [13, 1, 12], normal: UP }, { color: 3 }).ok).toBe(true);
    expect(s.grid.paint[idx(13, 1, 12)]).toBe(3);
    expect(applyTool(s, 'paint', { cell: [13, 1, 12], normal: UP }, { color: 3 }).reason).toBe('same');
    expect(applyTool(s, 'paint', { cell: [5, 5, 5], normal: UP }, { color: 3 }).ok).toBe(false);
    expect(s.undo).toHaveLength(3);
    expect(undo(s)).toBe(true);
    expect(s.grid.paint[idx(13, 1, 12)]).toBe(0);
    expect(undo(s)).toBe(true);
    expect([getCell(s.grid, 12, 1, 12), getCell(s.grid, 12, 2, 12)]).toEqual([GRASS, FLOWER]);
    expect(undo(s)).toBe(true);
    expect(getCell(s.grid, 12, 2, 12)).toBe(AIR);
    expect(undo(s)).toBe(false);
    expect(s.grid.cells).toEqual(starterGrid().cells);
  });

  it('ISL-06 undo keeps at most 60 steps; Đảo mới restores the starter but keeps rewards', () => {
    const s = fresh();
    for (let k = 0; k < 70; k++) applyTool(s, 'paint', { cell: [12, 1, 12], normal: UP }, { color: (k % 8) + 1 });
    expect(s.undo.length).toBe(60);
    s.done.push('garden');
    resetIsland(s);
    expect(s.grid.cells).toEqual(starterGrid().cells);
    expect(s.undo).toHaveLength(0);
    expect(s.done).toContain('garden');
  });
});

describe('island3d save', () => {
  it('ISL-07 RLE round trip with paint; the starter is tiny', () => {
    const s = fresh();
    applyTool(s, 'paint', { cell: [12, 1, 12], normal: UP }, { color: 5 });
    applyTool(s, 'decor', { cell: [10, 1, 12], normal: UP }, { decor: FLOWER });
    const text = encodeGrid(s.grid);
    expect(text.length).toBeLessThan(3000);
    const back = decodeGrid(text);
    expect(back.cells).toEqual(s.grid.cells);
    expect(back.paint).toEqual(s.grid.paint);
    console.info(`[island3d] starter save ${encodeGrid(starterGrid()).length} chars, painted ${text.length} chars`);
  });

  it('ISL-08 worst-case noise still fits; broken or oversized strings are refused', () => {
    const g = createGrid();
    const rnd = seeded(5);
    for (let i = 0; i < g.cells.length; i++) {
      g.cells[i] = 1 + Math.floor(rnd() * 18);
      g.paint[i] = Math.floor(rnd() * 9);
    }
    const text = encodeGrid(g);
    expect(text).not.toBeNull();
    expect(text.length).toBeLessThanOrEqual(MAX_SAVE_CHARS);
    expect(decodeGrid(text).cells).toEqual(g.cells);
    console.info(`[island3d] worst case save ${text.length} chars (limit ${MAX_SAVE_CHARS})`);
    expect(decodeGrid('x'.repeat(MAX_SAVE_CHARS + 1))).toBeNull();
    expect(decodeGrid('0*10')).toBeNull(); // too short
    expect(decodeGrid(`${(50).toString(36)}*${(W * H * D).toString(36)}`)).toBeNull(); // unknown value
    expect(decodeGrid(`0*${(W * H * D + 1).toString(36)}`)).toBeNull();
    expect(parseSave('{bad')).toBeNull();
    expect(parseSave(JSON.stringify({ v: 2, grid: encodeGrid(g) }))).toBeNull();
  });

  it('ISL-09 save/load to localStorage restores grid, wishes, guests and unlocks', () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    const s = fresh();
    build.flowers(s, new Set());
    inviteResident(s, { name: 'Squirtle', dex: 7 });
    applyTool(s, 'place', { cell: [12, 1, 12], normal: UP }, { block: WATER });
    expect(saveIsland(s, storage)).toBe(true);
    expect(store.has(SAVE_KEY)).toBe(true);
    const saved = loadSaved(storage);
    const t = createIsland({ random: seeded(2), player: PLAYER, saved });
    expect(t.grid.cells).toEqual(s.grid.cells);
    expect(t.done).toEqual(['garden']);
    expect(t.unlocked.has(WATER)).toBe(true);
    expect(t.residents.map((r) => r.name)).toEqual(['Pikachu', 'Squirtle']);
    expect(t.residents.map((r) => r.wishId)).toEqual(['pond', 'house']);
    expect(serialize(t).grid).toBe(serialize(s).grid);
  });
});

describe('island3d residents', () => {
  it('ISL-10 pathing: steps only onto standable cells, hops up at most 1, never into water or the sea', () => {
    const g = starterGrid();
    const start = [12, 2, 12];
    expect(standable(g, ...start)).toBe(true);
    for (const n of neighbours(g, ...start)) {
      expect(standable(g, ...n)).toBe(true);
      expect(Math.abs(n[1] - start[1])).toBeLessThanOrEqual(1);
    }
    expect(standable(g, 0, 1, 0)).toBe(false); // over the sea
    setCell(g, 13, 1, 12, WATER);
    expect(standable(g, 13, 2, 12)).toBe(false); // on water
    // A wall of 2 blocks cannot be hopped over; the path goes around
    for (let z = 5; z < 20; z++) {
      setCell(g, 10, 2, z, STONE);
      setCell(g, 10, 3, z, STONE);
    }
    const path = findPath(g, [8, 2, 12], [12, 2, 12], 80);
    expect(path).not.toBeNull();
    let prev = [8, 2, 12];
    for (const c of path) {
      expect(neighbours(g, ...prev).map(String)).toContain(String(c));
      expect(getCell(g, ...c)).toBe(AIR);
      prev = c;
    }
  });

  it('ISL-11 residents wander for minutes while the child builds: never in a block, water or the sea', () => {
    const rnd = seeded(9);
    const s = createIsland({ random: seeded(3), player: PLAYER });
    for (const name of ['Squirtle', 'Bulbasaur', 'Eevee']) inviteResident(s, { name });
    let checks = 0;
    let moved = 0;
    const last = s.residents.map((r) => String(r.cell));
    for (let t = 0; t < 3000; t++) {
      if (t % 20 === 0) {
        // random building and digging near the residents
        const r = s.residents[Math.floor(rnd() * s.residents.length)];
        const [x, y, z] = r.cell;
        const tool = rnd() < 0.5 ? 'place' : 'remove';
        const hit = tool === 'place' ? { cell: [x + Math.floor(rnd() * 3) - 1, y - 1, z + Math.floor(rnd() * 3) - 1], normal: UP } : { cell: [x, y - 1, z], normal: UP };
        applyTool(s, tool, hit, { block: rnd() < 0.3 ? WATER : STONE });
        if (rnd() < 0.2) s.unlocked.add(WATER);
      }
      if (t === 1500) setNight(s, true);
      if (t === 2200) setNight(s, false);
      step(s, 1 / 20);
      s.residents.forEach((r, k) => {
        expect(standable(s.grid, ...r.cell), `${r.name} at ${r.cell}`).toBe(true);
        expect(r.pos.y).toBeGreaterThanOrEqual(1);
        if (String(r.cell) !== last[k]) moved++;
        last[k] = String(r.cell);
        checks++;
      });
    }
    expect(moved).toBeGreaterThan(50);
    console.info(`[island3d] wander sim: ${checks} position checks, ${moved} steps, all on solid ground`);
  });

  it('ISL-12 night: residents fall asleep with Zzz; invite limit and no duplicates', () => {
    const s = fresh();
    setNight(s, true);
    for (let t = 0; t < 400; t++) step(s, 1 / 20);
    expect(s.residents[0].sleeping).toBe(true);
    let zzz = 0;
    for (let t = 0; t < 200; t++) {
      step(s, 1 / 20);
      if (s.residents[0].emote?.kind === 'zzz') zzz++;
    }
    expect(zzz).toBeGreaterThan(0);
    expect(inviteResident(s, { name: 'Pikachu' })).toBe(false);
    for (let k = 0; k < MAX_GUESTS; k++) expect(inviteResident(s, { name: `Mon${k}` })).toBe(true);
    expect(inviteResident(s, { name: 'One too many' })).toBe(false);
    expect(new Set(s.residents.map((r) => r.wishId)).size).toBe(MAX_GUESTS + 1);
  });
});

describe('island3d wishes', () => {
  const g0 = () => starterGrid();

  it('ISL-13 flowers / berries / trees / statue / fountain counters', () => {
    const g = g0();
    expect(checkWish(g, 'trees')).toMatchObject({ done: false, have: 1, need: 3 });
    for (let k = 0; k < 5; k++) setCell(g, 10 + k, 2, 14, FLOWER);
    expect(checkWish(g, 'garden')).toMatchObject({ done: true, have: 5 });
    setCell(g, 14, 2, 14, AIR);
    expect(checkWish(g, 'garden').done).toBe(false);
    for (let k = 0; k < 3; k++) setCell(g, 10 + k, 2, 16, BERRY);
    expect(checkWish(g, 'berries').done).toBe(true);
    expect(checkWish(g, 'statue').done).toBe(false);
    setCell(g, 12, 2, 12, STATUE);
    expect(checkWish(g, 'statue').done).toBe(true);
    expect(checkWish(g, 'fountain').done).toBe(false);
    setCell(g, 13, 2, 12, FOUNTAIN);
    expect(checkWish(g, 'fountain').done).toBe(true);
  });

  it('ISL-14 pond needs 6 touching water blocks', () => {
    const g = g0();
    for (let k = 0; k < 5; k++) setCell(g, 10 + k, 1, 15, WATER);
    expect(largestPond(g)).toBe(5);
    setCell(g, 16, 1, 15, WATER); // not touching
    expect(checkWish(g, 'pond').done).toBe(false);
    setCell(g, 15, 1, 15, WATER);
    expect(checkWish(g, 'pond').done).toBe(true);
  });

  it('ISL-15 tower: 8 stacked blocks above the grass', () => {
    const g = g0();
    for (let y = 2; y < 9; y++) setCell(g, 12, y, 12, STONE);
    expect(tallestTower(g)).toBe(7);
    expect(checkWish(g, 'tower').done).toBe(false);
    setCell(g, 12, 9, 12, WOOD);
    expect(checkWish(g, 'tower').done).toBe(true);
  });

  it('ISL-16 bridge: 3 free blocks held at both ends', () => {
    const g = createGrid();
    setCell(g, 2, 0, 5, STONE);
    setCell(g, 2, 1, 5, STONE);
    for (let x = 3; x < 6; x++) setCell(g, x, 1, 5, WOOD);
    expect(longestBridge(g)).toBe(0); // one end in the air
    setCell(g, 6, 1, 5, STONE);
    expect(longestBridge(g)).toBe(0); // the far end must stand on something too
    setCell(g, 6, 0, 5, STONE);
    expect(longestBridge(g)).toBe(3);
    setCell(g, 4, 0, 5, STONE); // a pillar under the middle splits it
    expect(checkWish(g, 'bridge').done).toBe(false);
  });

  function hut(g, x0, z0, { door = true, roof = true } = {}) {
    for (let x = x0; x < x0 + 4; x++) for (let z = z0; z < z0 + 4; z++) setCell(g, x, 1, z, GRASS);
    for (let y = 2; y <= 3; y++)
      for (let x = x0; x < x0 + 4; x++)
        for (let z = z0; z < z0 + 4; z++) {
          const ring = x === x0 || z === z0 || x === x0 + 3 || z === z0 + 3;
          if (ring && !(door && x === x0 + 1 && z === z0)) setCell(g, x, y, z, WOOD);
        }
    if (roof) for (let x = x0; x < x0 + 4; x++) for (let z = z0; z < z0 + 4; z++) setCell(g, x, 4, z, BRICK);
  }

  it('ISL-17 house: walls, roof and a door; lamp and bed variants', () => {
    let g = createGrid();
    hut(g, 5, 5);
    expect(findRooms(g)).toHaveLength(1);
    expect(checkWish(g, 'house').done).toBe(true);
    expect(checkWish(g, 'houseLamp').done).toBe(false);
    expect(checkWish(g, 'bedroom').done).toBe(false);
    g = createGrid();
    hut(g, 5, 5, { roof: false });
    expect(checkWish(g, 'house').done).toBe(false);
    g = createGrid();
    hut(g, 5, 5, { door: false });
    expect(checkWish(g, 'house').done).toBe(false); // closed box: no door
    g = createGrid();
    hut(g, 5, 5);
    setCell(g, 8, 2, 7, AIR); // a big hole in the wall plus the door
    setCell(g, 8, 2, 6, AIR);
    setCell(g, 8, 3, 6, AIR);
    expect(checkWish(g, 'house').done).toBe(false);
    g = createGrid();
    hut(g, 5, 5);
    setCell(g, 7, 2, 7, LANTERN);
    expect(checkWish(g, 'houseLamp').done).toBe(true);
    g = createGrid();
    hut(g, 5, 5);
    setCell(g, 8, 3, 7, LAMP); // a lamp block in the wall counts
    expect(checkWish(g, 'houseLamp').done).toBe(true);
    setCell(g, 6, 2, 7, BED);
    expect(checkWish(g, 'bedroom').done).toBe(true);
    // A bed outside does not count
    g = createGrid();
    hut(g, 5, 5);
    setCell(g, 12, 0, 12, GRASS);
    setCell(g, 12, 1, 12, BED);
    expect(checkWish(g, 'bedroom').done).toBe(false);
  });

  it('ISL-18 a wish is paid once, unlocks items and gives the next wish', () => {
    const s = fresh();
    expect(s.residents[0].wishId).toBe('garden');
    expect(wishText('Pikachu', 'garden')).toBe('Pikachu muốn 5 bông hoa');
    build.flowers(s, new Set());
    const paid = s.events.filter((e) => e.type === 'wish');
    expect(paid).toHaveLength(1);
    expect(paid[0]).toMatchObject({ wishId: 'garden', gold: 10, unlocks: [WATER, BERRY] });
    expect(s.unlocked.has(WATER)).toBe(true);
    expect(s.residents[0].wishId).toBe('pond');
    // Undo the last flower and put it back: no second payment
    undo(s);
    decorOn(s, FLOWER, 3, 12);
    expect(s.events.filter((e) => e.type === 'wish')).toHaveLength(1);
    expect(snap(s).progress.pond).toMatchObject({ have: 0, need: 6 });
  });
});

describe('island3d bot', () => {
  it('ISL-19 a scripted builder fulfils every wish from the starter island', () => {
    const s = fresh(4);
    const used = new Set(['8,9']);
    let house = null;
    const plan = {
      garden: () => build.flowers(s, used),
      pond: () => build.pond(s, used),
      house: () => (house = build.house(s, used)),
      houseLamp: () => build.inside(s, house, LANTERN, 1, 1),
      berries: () => build.decor(s, used, BERRY, 3),
      bridge: () => build.bridge(s),
      trees: () => build.decor(s, used, TREE, 2),
      tower: () => build.tower(s, used),
      statue: () => build.decor(s, used, STATUE, 1),
      bedroom: () => build.inside(s, house, BED, 0, 1),
      fountain: () => build.decor(s, used, FOUNTAIN, 1),
    };
    const order = [];
    for (let guard = 0; guard < 20 && s.residents[0].wishId; guard++) {
      const id = s.residents[0].wishId;
      plan[id]();
      for (let t = 0; t < 40; t++) step(s, 1 / 20);
      expect(s.done, `wish ${id}`).toContain(id);
      order.push(id);
    }
    const wishes = s.events.filter((e) => e.type === 'wish');
    expect(order).toEqual(WISHES.map((w) => w.id));
    expect(wishes).toHaveLength(WISHES.length);
    const gold = wishes.reduce((a, e) => a + e.gold, 0);
    wishes.forEach((e) => {
      expect(e.gold).toBeGreaterThanOrEqual(10);
      expect(e.gold).toBeLessThanOrEqual(25);
    });
    expect(s.residents[0].home).not.toBeNull();
    expect(snap(s).allDone).toBe(true);
    const blocks = s.stats.placed;
    console.info(`[island3d] bot: ${wishes.length} wishes, ${blocks} blocks placed, ${s.stats.decor} decorations, ${s.stats.removed} removed, ${gold} gold total, save ${encodeGrid(s.grid).length} chars`);
  });
});
