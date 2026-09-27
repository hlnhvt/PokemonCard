// The quest world: 6 acts, each with a town, wild areas, a dungeon and a boss lair.
// Every area is generated from a seed (same save = same maps): a tile grid of walls
// (trees / rocks / crystals by theme), liquids (ponds, lava, dark water), buildings (town),
// a winding main path with clearings, side paths to chests, and portals between areas.
import { mulberry32, hashSeed, range, int } from './rng';

export const TILE = 40;
export const FREE = 0;
export const WALL = 1;
export const LIQUID = 2;
export const BUILDING = 3;

export const THEMES = {
  forest: { label: 'Rừng', ground: '#6cbf4a', ground2: '#5aa93c', ground3: '#86d160', path: '#d6b27a', pathEdge: '#b98f55', wall: 'tree', liquid: 'pond', deco: ['flower', 'grass', 'grass', 'mushroom', 'stone', 'flower'], fog: '#0b1f12', mini: '#4d9a38', miniWall: '#1f5a24', miniPath: '#caa56e', bg: '#173d1c' },
  cave: { label: 'Hang', ground: '#9a8468', ground2: '#8a7358', ground3: '#ab967a', path: '#c2ab88', pathEdge: '#8b7556', wall: 'rock', liquid: 'water', deco: ['pebble', 'pebble', 'crystal', 'moss', 'pebble'], fog: '#120d09', mini: '#8a7358', miniWall: '#3b2f22', miniPath: '#c2ab88', bg: '#2a2118' },
  tower: { label: 'Tháp', ground: '#5b4f7a', ground2: '#4e4369', ground3: '#6a5d8c', path: '#8a7fae', pathEdge: '#43395d', wall: 'pillar', liquid: 'void', deco: ['candle', 'web', 'tile', 'candle', 'tile'], fog: '#0c0816', mini: '#4e4369', miniWall: '#1d1730', miniPath: '#8a7fae', bg: '#1a1427' },
  volcano: { label: 'Núi lửa', ground: '#5a4640', ground2: '#4a3833', ground3: '#6b5249', path: '#8c6a57', pathEdge: '#3f2d27', wall: 'basalt', liquid: 'lava', deco: ['ember', 'crack', 'pebble', 'ember'], fog: '#140806', mini: '#4a3833', miniWall: '#1f1310', miniPath: '#8c6a57', bg: '#1e110d' },
  ice: { label: 'Băng', ground: '#dbeefa', ground2: '#c9e3f5', ground3: '#eef8ff', path: '#b3d3ea', pathEdge: '#8fb7d6', wall: 'iceberg', liquid: 'sea', deco: ['snow', 'snow', 'icicle', 'pebble'], fog: '#0a1624', mini: '#c9e3f5', miniWall: '#5a8db5', miniPath: '#9fc4e0', bg: '#1d3450' },
  psychic: { label: 'Tâm linh', ground: '#3d3a6b', ground2: '#34315d', ground3: '#4a4680', path: '#6d66b0', pathEdge: '#2a2750', wall: 'crystal', liquid: 'void', deco: ['rune', 'crystal', 'pebble', 'rune'], fog: '#07061a', mini: '#34315d', miniWall: '#15133a', miniPath: '#6d66b0', bg: '#141233' },
};

// Area kinds: town (Pokemon Center, shop, board), wild, dungeon, lair (boss arena)
// levels: [min, max] of wild Pokemon. enemies / elites: Pokedex numbers. power: later acts hit
// harder (tuned with the bot in quest.sim.test.js).
export const ACTS = [
  {
    id: 'viridian', power: { dmg: 1, hp: 1 }, name: 'Rừng Viridian', theme: 'forest', enemies: [10, 13, 16, 19, 11, 14, 43], elites: [17, 15, 12], ranged: [16, 17, 12, 43],
    areas: [
      { kind: 'town', name: 'Làng Pallet' },
      { kind: 'wild', name: 'Đồng cỏ Tuyến 1', levels: [2, 4], packs: 18, packSize: [2, 3] },
      { kind: 'wild', name: 'Bìa rừng Viridian', levels: [4, 7], packs: 20, packSize: [2, 3] },
      { kind: 'dungeon', name: 'Rừng Sâu Viridian', levels: [7, 10], packs: 22, packSize: [2, 4] },
      { kind: 'lair', name: 'Hang ổ Snorlax', levels: [9, 10] },
    ],
    boss: { dex: 143, name: 'Snorlax', title: 'Snorlax Ngủ Say', level: 12, hp: 26, dmg: 0.5, attacks: ['slam', 'charge'], minions: [19, 16] },
  },
  {
    id: 'mtmoon', power: { dmg: 1.3, hp: 1.1 }, name: 'Hang Mt. Moon', theme: 'cave', enemies: [41, 74, 46, 35, 27, 50], elites: [42, 75, 47], ranged: [41, 42, 35],
    areas: [
      { kind: 'town', name: 'Thành phố Pewter' },
      { kind: 'wild', name: 'Chân núi Mt. Moon', levels: [11, 14], packs: 15, packSize: [2, 4] },
      { kind: 'wild', name: 'Đường hầm Đá', levels: [14, 17], packs: 16, packSize: [3, 4] },
      { kind: 'dungeon', name: 'Hang Pha lê', levels: [17, 20], packs: 18, packSize: [3, 5] },
      { kind: 'lair', name: 'Hang ổ Onix', levels: [19, 20] },
    ],
    boss: { dex: 95, name: 'Onix', title: 'Onix Rắn Đá', level: 22, hp: 30, dmg: 0.8, attacks: ['slam', 'meteor', 'charge'], minions: [74, 41] },
  },
  {
    id: 'lavender', power: { dmg: 1.55, hp: 1.2 }, name: 'Tháp Ma Lavender', theme: 'tower', enemies: [92, 93, 200, 104, 96, 41], elites: [93, 97, 105], ranged: [92, 93, 200, 96, 97],
    areas: [
      { kind: 'town', name: 'Thị trấn Lavender' },
      { kind: 'wild', name: 'Vườn Sương Mù', levels: [20, 23], packs: 15, packSize: [3, 4] },
      { kind: 'wild', name: 'Hành lang Tháp', levels: [23, 26], packs: 16, packSize: [3, 4] },
      { kind: 'dungeon', name: 'Tầng Ma Ám', levels: [26, 29], packs: 18, packSize: [3, 5] },
      { kind: 'lair', name: 'Đỉnh Tháp', levels: [28, 29] },
    ],
    boss: { dex: 94, name: 'Gengar', title: 'Gengar Bóng Đêm', level: 31, hp: 32, dmg: 0.9, attacks: ['ring', 'meteor', 'slam'], minions: [92, 93] },
  },
  {
    id: 'cinnabar', power: { dmg: 1.75, hp: 1.3 }, name: 'Đảo Núi lửa Cinnabar', theme: 'volcano', enemies: [77, 58, 37, 218, 126, 109], elites: [78, 59, 126], ranged: [37, 126, 109, 218],
    areas: [
      { kind: 'town', name: 'Cảng Cinnabar' },
      { kind: 'wild', name: 'Bãi đá nóng', levels: [28, 31], packs: 16, packSize: [3, 4] },
      { kind: 'wild', name: 'Sườn núi lửa', levels: [31, 34], packs: 16, packSize: [3, 5] },
      { kind: 'dungeon', name: 'Lòng núi lửa', levels: [34, 37], packs: 18, packSize: [3, 5] },
      { kind: 'lair', name: 'Miệng núi lửa', levels: [36, 37] },
    ],
    boss: { dex: 146, name: 'Moltres', title: 'Moltres Chim Lửa', level: 39, hp: 34, dmg: 1, attacks: ['meteor', 'ring', 'charge'], minions: [77, 58] },
  },
  {
    id: 'seafoam', power: { dmg: 1.95, hp: 1.4 }, name: 'Hang Băng Seafoam', theme: 'ice', enemies: [86, 90, 116, 124, 220, 361, 120], elites: [87, 91, 124], ranged: [90, 116, 124, 120, 361],
    areas: [
      { kind: 'town', name: 'Làng chài Seafoam' },
      { kind: 'wild', name: 'Bờ biển băng', levels: [36, 39], packs: 16, packSize: [3, 4] },
      { kind: 'wild', name: 'Hang Băng tầng 1', levels: [39, 42], packs: 16, packSize: [3, 5] },
      { kind: 'dungeon', name: 'Hang Băng sâu', levels: [42, 44], packs: 18, packSize: [3, 5] },
      { kind: 'lair', name: 'Hang ổ Articuno', levels: [43, 44] },
    ],
    boss: { dex: 144, name: 'Articuno', title: 'Articuno Chim Băng', level: 46, hp: 36, dmg: 1, attacks: ['ring', 'meteor', 'slam'], minions: [86, 361] },
  },
  {
    id: 'cerulean', power: { dmg: 2.15, hp: 1.5 }, name: 'Hang Động Bí Ẩn', theme: 'psychic', enemies: [63, 64, 55, 101, 67, 112, 132, 137], elites: [65, 112, 68], ranged: [63, 64, 55, 101, 137],
    areas: [
      { kind: 'town', name: 'Trại Cerulean' },
      { kind: 'wild', name: 'Lối vào Hang Bí Ẩn', levels: [43, 45], packs: 16, packSize: [3, 5] },
      { kind: 'wild', name: 'Mê cung Pha lê', levels: [45, 47], packs: 18, packSize: [3, 5] },
      { kind: 'dungeon', name: 'Vực Tâm Linh', levels: [47, 49], packs: 19, packSize: [3, 5] },
      { kind: 'lair', name: 'Phòng của Mewtwo', levels: [48, 49] },
    ],
    boss: { dex: 150, name: 'Mewtwo', title: 'Mewtwo Huyền Thoại', level: 50, hp: 42, dmg: 1.05, attacks: ['slam', 'meteor', 'charge', 'ring'], minions: [64, 65] },
  },
];

export const areaDef = (act, index) => ACTS[act]?.areas[index] || null;

const SIZES = { town: [40, 24], wild: [112, 72], dungeon: [96, 86], lair: [46, 36] };

/** Value noise in [0, 1] from a coarse random lattice (smooth blobs). */
function valueNoise(rnd, W, H, cell) {
  const cw = Math.ceil(W / cell) + 2;
  const ch = Math.ceil(H / cell) + 2;
  const lat = Array.from({ length: cw * ch }, () => rnd());
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / cell;
    const gy = y / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = smooth(gx - x0);
    const fy = smooth(gy - y0);
    const v = (i, j) => lat[Math.min(ch - 1, j) * cw + Math.min(cw - 1, i)];
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * fx;
    const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };
}

function makeGrid(W, H, fill) {
  const g = new Uint8Array(W * H);
  g.fill(fill);
  return g;
}

function carve(grid, W, H, cx, cy, r, value = FREE) {
  const r2 = r * r;
  for (let y = Math.max(1, Math.floor(cy - r)); y <= Math.min(H - 2, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(1, Math.floor(cx - r)); x <= Math.min(W - 2, Math.ceil(cx + r)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) grid[y * W + x] = value;
    }
  }
}

function carveLine(grid, W, H, a, b, r, rnd, wobble = 0.6) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(len * 2));
  const nx = -(b.y - a.y) / (len || 1);
  const ny = (b.x - a.x) / (len || 1);
  const phase = rnd() * 6;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const w = Math.sin(t * Math.PI * 2 + phase) * wobble * Math.sin(t * Math.PI) * 2;
    const x = a.x + (b.x - a.x) * t + nx * w;
    const y = a.y + (b.y - a.y) * t + ny * w;
    carve(grid, W, H, x, y, r);
    if (i % 2 === 0) pts.push({ x, y });
  }
  return pts;
}

/** Flood fill from (sx, sy) over free tiles; returns a visited mask. */
function flood(grid, W, H, sx, sy) {
  const seen = new Uint8Array(W * H);
  const stack = [sy * W + sx];
  seen[sy * W + sx] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W;
    const y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (!seen[j] && grid[j] === FREE) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  return seen;
}

const toWorld = (p) => ({ x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE });

function decorate(area, rnd, density = 0.14) {
  const { W, H, grid } = area;
  const theme = THEMES[area.theme];
  const out = [];
  const n = Math.round(W * H * density);
  for (let k = 0; k < n; k++) {
    const x = int(rnd, 1, W - 2);
    const y = int(rnd, 1, H - 2);
    if (grid[y * W + x] !== FREE) continue;
    out.push({ x: (x + rnd()) * TILE, y: (y + rnd()) * TILE, kind: theme.deco[Math.floor(rnd() * theme.deco.length)], v: rnd() });
  }
  return out;
}

function genTown(area, rnd) {
  const { W, H } = area;
  const grid = makeGrid(W, H, FREE);
  area.grid = grid;
  const road = 10.5; // the main street (tile row)
  // Border of trees / rocks, with a few extra bumps (never on the street)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) grid[y * W + x] = WALL;
  for (let k = 0; k < 16; k++) {
    const side = k % 4;
    const x = side === 0 ? 2 : side === 1 ? W - 3 : int(rnd, 3, W - 4);
    const y = side === 2 ? 2 : side === 3 ? H - 3 : int(rnd, 3, H - 4);
    if (Math.abs(y - road) < 3) continue;
    grid[y * W + x] = WALL;
  }
  const building = (x0, y0, w, h, id, label) => {
    // Houses: the roof leans out over the row north of the walls, nobody stands under it
    const top = id === 'center' || id === 'shop' || id === 'house' ? y0 - 1 : y0;
    for (let y = top; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) grid[y * W + x] = BUILDING;
    area.buildings.push({ id, label, x: x0 * TILE, y: y0 * TILE, w: w * TILE, h: h * TILE });
    return { x: (x0 + w / 2) * TILE, y: (y0 + h) * TILE + 34 };
  };
  const mid = Math.floor(W / 2);
  const center = building(mid - 13, 4, 6, 4, 'center', 'Trung tâm Pokémon');
  const shop = building(mid + 7, 4, 6, 4, 'shop', 'Cửa hàng');
  const board = building(mid - 1, 13, 3, 2, 'board', 'Bảng hành trình');
  building(mid - 15, 15, 4, 3, 'house', '');
  building(mid + 11, 15, 4, 3, 'house', '');
  // Fountain in the square
  for (let y = 5; y < 7; y++) for (let x = mid - 1; x < mid + 1; x++) grid[y * W + x] = BUILDING;
  area.buildings.push({ id: 'fountain', label: '', x: (mid - 1) * TILE, y: 5 * TILE, w: 2 * TILE, h: 2 * TILE });
  // Flower beds and a few trees round the square
  for (const [x, y] of [[mid - 5, 5], [mid + 4, 5], [mid - 6, 14], [mid + 5, 14]]) grid[y * W + x] = WALL;
  area.spots = [
    { id: 'center', x: center.x, y: center.y, r: 46 },
    { id: 'shop', x: shop.x, y: shop.y, r: 46 },
    { id: 'board', x: board.x, y: board.y, r: 46 },
  ];
  area.spawn = { x: mid * TILE, y: 8.8 * TILE };
  const ry = road * TILE;
  area.path = [
    [{ x: 3 * TILE, y: ry }, { x: (W - 2) * TILE, y: ry }],
    [{ x: center.x, y: center.y - 20 }, { x: center.x, y: ry }],
    [{ x: shop.x, y: shop.y - 20 }, { x: shop.x, y: ry }],
    [{ x: board.x, y: ry }, { x: board.x, y: board.y }],
    [{ x: mid * TILE, y: 7.4 * TILE }, { x: mid * TILE, y: ry }],
  ];
  area.pathWidth = 3.2 * TILE;
  area.exits = [{ to: 1, x: (W - 3.2) * TILE, y: ry, label: '' }];
  // Street lamps, fences round the gardens, a signpost to the way out
  const extra = (x, y, kind) => {
    if (grid[y * W + x] !== FREE) return;
    grid[y * W + x] = WALL;
    area.extras.push({ tx: x, ty: y, x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, kind, v: rnd() });
  };
  for (const x of [4, 15, 25, 35]) {
    extra(x, 7, 'lamp');
    extra(x, 13, 'lamp');
  }
  for (let x = mid - 16; x <= mid - 10; x++) extra(x, 19, 'fence');
  for (let x = mid + 10; x <= mid + 16; x++) extra(x, 19, 'fence');
  extra(W - 7, 8, 'sign');
  area.extraAt = new Map(area.extras.map((e) => [e.ty * W + e.tx, e]));
  area.decorations = decorate(area, rnd, 0.1).filter((d) => Math.abs(d.y - ry) > 2 * TILE);
}

// Free-standing props that block their tile (signposts, lamps, tombstones, crystals...)
const EXTRAS = {
  forest: ['sign', 'fence', 'lamp', 'stump', 'fence', 'stump'],
  cave: ['stalagmite', 'crystalBig', 'lamp', 'stalagmite'],
  tower: ['tomb', 'tomb', 'candelabra', 'urn', 'tomb'],
  volcano: ['vent', 'obsidian', 'lamp', 'obsidian'],
  ice: ['snowman', 'iceSpike', 'lamp', 'iceSpike'],
  psychic: ['obelisk', 'crystalBig', 'orb', 'obelisk'],
};
// How many expert trainers wait in each kind of area (5 per act)
export const expertsIn = (index, kind) => (kind === 'dungeon' ? 2 : kind === 'wild' ? (index === 1 ? 1 : 2) : 0);
export const EXPERTS_PER_ACT = 5;

/** Would blocking tile (x, y) cut a way through? (its free neighbours must stay one group) */
function safeToBlock(grid, W, H, x, y) {
  const ring = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const free = ring.map(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < W && ny < H && grid[ny * W + nx] === FREE;
  });
  let runs = 0;
  for (let k = 0; k < 8; k++) if (free[k] && !free[(k + 7) % 8]) runs += 1;
  return runs <= 1 && free.some(Boolean) && !free.every(Boolean);
}

function placeExtras(area, rnd, avoid) {
  const { W, H, grid } = area;
  const kinds = EXTRAS[area.theme];
  const want = Math.round(W * H * 0.0045);
  area.extras = [];
  for (let k = 0; k < want * 12 && area.extras.length < want; k++) {
    const x = int(rnd, 3, W - 4);
    const y = int(rnd, 3, H - 4);
    if (grid[y * W + x] !== FREE) continue;
    const wx = (x + 0.5) * TILE;
    const wy = (y + 0.5) * TILE;
    if (avoid.some((a) => Math.hypot(a.x - wx, a.y - wy) < a.r)) continue;
    if (area.extras.some((e) => Math.abs(e.tx - x) + Math.abs(e.ty - y) < 4)) continue;
    if (!safeToBlock(grid, W, H, x, y)) continue;
    grid[y * W + x] = WALL;
    area.extras.push({ tx: x, ty: y, x: wx, y: wy, kind: kinds[Math.floor(rnd() * kinds.length)], v: rnd() });
  }
  area.extraAt = new Map(area.extras.map((e) => [e.ty * W + e.tx, e]));
}

function genWild(area, rnd, dungeon) {
  const { W, H } = area;
  const grid = makeGrid(W, H, FREE);
  area.grid = grid;
  const noise = valueNoise(rnd, W, H, dungeon ? 5 : 6);
  const noise2 = valueNoise(rnd, W, H, 4);
  const wallAt = dungeon ? 0.5 : 0.56;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x < 2 || y < 2 || x >= W - 2 || y >= H - 2;
      const n = noise(x, y);
      if (edge || n > wallAt) grid[y * W + x] = WALL;
      else if (noise2(x, y) > (dungeon ? 0.86 : 0.8) && n < wallAt - 0.12) grid[y * W + x] = LIQUID;
    }
  }
  // Main path: entrance on the left, exit on the right, winding up and down through waypoints
  const entry = { x: 4, y: int(rnd, 8, H - 9) };
  const exit = { x: W - 5, y: int(rnd, 8, H - 9) };
  const n = dungeon ? 8 : 7;
  const pts = [entry];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const up = i % 2 === (rnd() < 0.5 ? 0 : 1);
    pts.push({ x: Math.round(entry.x + (exit.x - entry.x) * t + range(rnd, -2, 2)), y: up ? int(rnd, 6, Math.floor(H * 0.42)) : int(rnd, Math.ceil(H * 0.58), H - 7) });
  }
  pts.push(exit);
  const path = [];
  for (let i = 1; i < pts.length; i++) path.push(...carveLine(grid, W, H, pts[i - 1], pts[i], dungeon ? 1.9 : 2.3, rnd, 1.2));
  // Clearings on the way (where packs gather)
  const clearings = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const r = range(rnd, 4, 5.8);
    carve(grid, W, H, pts[i].x, pts[i].y, r);
    clearings.push({ ...pts[i], r, main: true });
  }
  carve(grid, W, H, entry.x + 1, entry.y, 3.2);
  carve(grid, W, H, exit.x - 1, exit.y, 3.2);
  const nearestOnPath = (p) => path.reduce((a, q) => (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? q : a), path[0]);
  // Expert trainers wait in their own round glades off the path
  const experts = [];
  const wantExperts = expertsIn(area.index, area.kind);
  for (let k = 0; k < 400 && experts.length < wantExperts; k++) {
    const p = { x: int(rnd, 16, W - 12), y: int(rnd, 7, H - 8) };
    const near = nearestOnPath(p);
    const d = Math.hypot(near.x - p.x, near.y - p.y);
    const band = k < 250 ? [7, 14] : [2, 22];
    if (d < band[0] || d > band[1] || experts.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 18)) continue;
    area.sidePaths.push(carveLine(grid, W, H, near, p, 1.7, rnd, 0.6));
    carve(grid, W, H, p.x, p.y, 4.4);
    experts.push(p);
  }
  // Side paths to little dead-end glades (chests, extra packs)
  const sides = [];
  const wantSides = dungeon ? 8 : 7;
  for (let k = 0; k < 100 && sides.length < wantSides; k++) {
    const p = { x: int(rnd, 8, W - 9), y: int(rnd, 5, H - 6) };
    const near = nearestOnPath(p);
    const d = Math.hypot(near.x - p.x, near.y - p.y);
    if (d < 7 || d > 17 || sides.some((sd) => Math.hypot(sd.x - p.x, sd.y - p.y) < 12) || experts.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 10)) continue;
    const side = carveLine(grid, W, H, near, p, 1.5, rnd, 0.8);
    area.sidePaths.push(side);
    const r = range(rnd, 2.6, 3.6);
    carve(grid, W, H, p.x, p.y, r);
    sides.push({ ...p, r });
  }
  // Tiny puddles look like dots: keep only ponds of a fair size
  const seenL = new Uint8Array(W * H);
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== LIQUID || seenL[i]) continue;
    const cells = [i];
    seenL[i] = 1;
    for (let k = 0; k < cells.length; k++) {
      const c = cells[k];
      const cx = c % W;
      for (const j of [c - 1, c + 1, c - W, c + W]) {
        if (j < 0 || j >= grid.length || seenL[j] || grid[j] !== LIQUID || Math.abs((j % W) - cx) > 1) continue;
        seenL[j] = 1;
        cells.push(j);
      }
    }
    if (cells.length < 7) for (const c of cells) grid[c] = FREE;
  }
  // Nothing unreachable: closed pockets become walls
  const seen = flood(grid, W, H, entry.x + 1, entry.y);
  for (let i = 0; i < grid.length; i++) if (grid[i] === FREE && !seen[i]) grid[i] = WALL;

  area.path = [path.map(toWorld), ...area.sidePaths.map((sp) => sp.map(toWorld))];
  area.pathWidth = (dungeon ? 3.2 : 3.8) * TILE;
  area.spawn = toWorld({ x: entry.x + 2, y: entry.y });
  area.exits = [
    { to: area.index - 1, x: (entry.x + 0.2) * TILE, y: (entry.y + 0.5) * TILE },
    { to: area.index + 1, x: (exit.x + 0.8) * TILE, y: (exit.y + 0.5) * TILE },
  ];
  area.experts = experts.map((p) => toWorld(p));

  // Packs: clearings, glades and spots along the path, never right at the entrance or an expert
  const spots = [];
  const entryW = toWorld(entry);
  const farEnough = (w, min) => Math.hypot(w.x - entryW.x, w.y - entryW.y) > min;
  for (const c of clearings) spots.push({ ...toWorld(c), r: c.r * TILE * 0.5 });
  for (const sd of sides) spots.push({ ...toWorld(sd), r: sd.r * TILE * 0.45, glade: true });
  for (let i = 10; i < path.length; i += 6) if (rnd() < 0.65) spots.push({ ...toWorld(path[i]), r: TILE });
  const want = area.def.packs;
  const chosen = [];
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  for (const sp of spots) {
    if (chosen.length >= want) break;
    if (!farEnough(sp, 14 * TILE)) continue;
    if (chosen.some((c) => Math.hypot(c.x - sp.x, c.y - sp.y) < 6 * TILE)) continue;
    if (area.experts.some((e) => Math.hypot(e.x - sp.x, e.y - sp.y) < 9 * TILE)) continue;
    chosen.push(sp);
  }
  // The very first wild area greets the child with two easy Pokemon close by
  if (area.act === 0 && area.index === 1) {
    const p = path[Math.min(path.length - 1, 9)];
    chosen.unshift({ ...toWorld(p), r: TILE * 0.8, welcome: true });
  }
  area.packs = chosen;
  area.chests = sides.slice(0, dungeon ? 6 : 5).map((sd) => toWorld(sd));
  if (area.chests.length < 2 && clearings.length) area.chests.push(toWorld({ x: clearings[clearings.length - 1].x + 2, y: clearings[clearings.length - 1].y }));
  // Keep the ways, portals and meeting places clear of props
  const avoid = [
    ...area.exits.map((e) => ({ ...e, r: 6 * TILE })),
    { ...area.spawn, r: 6 * TILE },
    ...area.experts.map((e) => ({ ...e, r: 5.5 * TILE })),
    ...area.chests.map((c) => ({ ...c, r: 2.5 * TILE })),
    ...chosen.map((c) => ({ ...c, r: 3 * TILE })),
    ...path.filter((_, k) => k % 2 === 0).map((q) => ({ ...toWorld(q), r: 2.6 * TILE })),
  ];
  placeExtras(area, rnd, avoid);
  area.decorations = decorate(area, rnd, 0.16);
}

function genLair(area, rnd) {
  const { W, H } = area;
  const grid = makeGrid(W, H, WALL);
  area.grid = grid;
  const cx = W * 0.6;
  const cy = H / 2;
  const rx = 13;
  const ry = 11;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const wob = 1 + Math.sin(Math.atan2(y - cy, x - cx) * 5 + 1.3) * 0.06;
      if (((x - cx) / (rx * wob)) ** 2 + ((y - cy) / (ry * wob)) ** 2 <= 1) grid[y * W + x] = FREE;
    }
  }
  const entry = { x: 3, y: Math.round(cy) };
  const path = carveLine(grid, W, H, entry, { x: Math.round(cx - rx + 2), y: Math.round(cy) }, 2.2, rnd, 0.8);
  carve(grid, W, H, entry.x + 1, entry.y, 3);
  // A few pillars in the arena to hide behind
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.6;
    const px = Math.round(cx + Math.cos(a) * rx * 0.62);
    const py = Math.round(cy + Math.sin(a) * ry * 0.62);
    grid[py * W + px] = WALL;
  }
  area.path = [path.map(toWorld)];
  area.pathWidth = 3.4 * TILE;
  area.spawn = toWorld({ x: entry.x + 2, y: entry.y });
  area.exits = [{ to: area.index - 1, x: (entry.x + 0.2) * TILE, y: (entry.y + 0.5) * TILE }];
  area.arena = { x: (cx + 0.5) * TILE, y: (cy + 0.5) * TILE, rx: rx * TILE, ry: ry * TILE };
  area.bossSpawn = { x: (cx + 3.5) * TILE, y: (cy + 0.5) * TILE };
  area.nextActPortal = { x: (cx + rx - 2.5) * TILE, y: (cy + 0.5) * TILE };
  area.packs = [];
  area.chests = [];
  area.decorations = decorate(area, rnd, 0.12);
}

/** Generate one area (deterministic for a world seed). */
export function generateArea(worldSeed, act, index) {
  const def = areaDef(act, index);
  if (!def) throw new Error(`No area ${act}/${index}`);
  const [W, H] = SIZES[def.kind];
  const rnd = mulberry32(hashSeed(worldSeed, act * 31 + index, 7717));
  const area = {
    act,
    index,
    def,
    kind: def.kind,
    name: def.name,
    theme: ACTS[act].theme,
    W,
    H,
    w: W * TILE,
    h: H * TILE,
    grid: null,
    buildings: [],
    spots: [],
    sidePaths: [],
    experts: [],
    extras: [],
    extraAt: new Map(),
    packs: [],
    chests: [],
    decorations: [],
    exits: [],
    seed: hashSeed(worldSeed, act, index),
  };
  if (def.kind === 'town') genTown(area, rnd);
  else if (def.kind === 'lair') genLair(area, rnd);
  else genWild(area, rnd, def.kind === 'dungeon');
  return area;
}

// ---------- collision ----------

export const tileAt = (area, x, y) => {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= area.W || ty >= area.H) return WALL;
  return area.grid[ty * area.W + tx];
};

/** Does a circle at (x, y) touch any blocking tile? */
export function circleBlocked(area, x, y, r) {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = tx < 0 || ty < 0 || tx >= area.W || ty >= area.H ? WALL : area.grid[ty * area.W + tx];
      if (t === FREE) continue;
      const nx = Math.max(tx * TILE, Math.min(x, (tx + 1) * TILE));
      const ny = Math.max(ty * TILE, Math.min(y, (ty + 1) * TILE));
      // Walls are a bit rounder than their tile so sliding along them feels smooth
      if ((nx - x) ** 2 + (ny - y) ** 2 < (r - (t === WALL ? 4 : 2)) ** 2) return true;
    }
  }
  return false;
}

/** Move a circle by (dx, dy), sliding along walls. Returns true when it moved. */
export function moveCircle(area, e, dx, dy, r = e.r) {
  let moved = false;
  if (dx && !circleBlocked(area, e.x + dx, e.y, r)) {
    e.x += dx;
    moved = true;
  }
  if (dy && !circleBlocked(area, e.x, e.y + dy, r)) {
    e.y += dy;
    moved = true;
  }
  return moved;
}

/** Shots fly over water and lava but stop at trees, rocks and buildings. */
export const blocksShot = (area, x, y) => {
  const t = tileAt(area, x, y);
  return t === WALL || t === BUILDING;
};

/** Is the straight line between two points free of walls (for sight and path smoothing)? */
export function lineFree(area, ax, ay, bx, by, pad = 0) {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.ceil(d / (TILE / 3));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (pad ? circleBlocked(area, x, y, pad) : tileAt(area, x, y) !== FREE) return false;
  }
  return true;
}

/** Can a shot fly straight from a to b (over water and lava, not through walls)? */
export function shotClear(area, ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.ceil(d / (TILE / 3));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blocksShot(area, ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

/** Nearest free point to (x, y) (for spawning). */
export function nearestFree(area, x, y, r = 16) {
  if (!circleBlocked(area, x, y, r)) return { x, y };
  for (let d = TILE / 2; d < TILE * 12; d += TILE / 2) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (!circleBlocked(area, px, py, r)) return { x: px, y: py };
    }
  }
  return { x, y };
}

/**
 * A* over the tile grid (8 directions, no corner cutting). Returns world points from `from`
 * to `to` (smoothed), or null.
 */
export function findPath(area, from, to, maxNodes = 6000) {
  const { W, H, grid } = area;
  const sx = Math.floor(from.x / TILE);
  const sy = Math.floor(from.y / TILE);
  let gx = Math.floor(to.x / TILE);
  let gy = Math.floor(to.y / TILE);
  const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && grid[y * W + x] === FREE;
  if (!ok(gx, gy)) {
    const f = nearestFree(area, to.x, to.y, 8);
    gx = Math.floor(f.x / TILE);
    gy = Math.floor(f.y / TILE);
  }
  const start = sy * W + sx;
  const goal = gy * W + gx;
  const g = new Float32Array(W * H).fill(Infinity);
  const came = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const open = [start];
  const f = new Float32Array(W * H);
  g[start] = 0;
  const h = (i) => {
    const x = i % W;
    const y = (i - x) / W;
    return Math.hypot(x - gx, y - gy);
  };
  f[start] = h(start);
  let visited = 0;
  while (open.length && visited++ < maxNodes) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % W;
    const cy = (cur - cx) / W;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (!ok(nx, ny)) continue;
        if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        if (closed[ni]) continue;
        const cost = g[cur] + (dx && dy ? 1.414 : 1);
        if (cost < g[ni]) {
          g[ni] = cost;
          came[ni] = cur;
          f[ni] = cost + h(ni);
          open.push(ni);
        }
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const cells = [];
  for (let i = goal; i !== -1 && i !== start; i = came[i]) cells.push(i);
  cells.reverse();
  const pts = cells.map((i) => ({ x: ((i % W) + 0.5) * TILE, y: (Math.floor(i / W) + 0.5) * TILE }));
  // Smooth: skip points that can be reached in a straight line
  const out = [];
  let anchor = { x: from.x, y: from.y };
  for (let i = 0; i < pts.length; i++) {
    const next = pts[i + 1];
    if (next && lineFree(area, anchor.x, anchor.y, next.x, next.y, 14)) continue;
    out.push(pts[i]);
    anchor = pts[i];
  }
  return out;
}
