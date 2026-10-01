// Pure engine for "Snorlax nuốt cả thành phố" (Hole.io / Katamari style, 2-minute rounds).
// No three.js, no DOM. World plane is X/Z (screen right = +X, screen up = -Z), units ~ metres.
// Snorlax is a circle of radius R; it swallows anything with size < R * EAT_K that it touches,
// grows by the swallowed "mass" (size²) and bumps softly into things that are still too big.

export const GULP3D_GAME = 'gulp3d';
export const DT = 1 / 60;
export const ROUND_TIME = 120;
export const EAT_K = 0.92; // edible when size < R * EAT_K
export const BODY_K = 0.9; // collision radius of the body = R * BODY_K
export const SOFT_K = 0.55; // radius that bumps into things still too big (squishy belly)
export const R0 = 0.6; // starting radius
export const GROW = 0.15; // R² = R0² + GROW * Σ size²
export const COMBO_TIME = 1.4; // seconds between bites to keep a combo going
export const COMBO_CALLS = [5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200];
export const POWER_TIME = { gold: 8, speed: 6, magnet: 6 };
export const POWER_NAMES = { gold: 'Quả Mâm Xôi Vàng', speed: 'Giày tốc độ', magnet: 'Nam châm' };
export const MAX_DROPS = 60; // berries dropped by friendly Pokemon per round
export const RIVAL = { R0: 0.45, maxR: 1.5, grow: 0.16, speed: 2.6 };

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;

/** Deterministic PRNG (mulberry32) for the city layout. */
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Everything that can be eaten. size = how big Snorlax must be, r = footprint radius (collisions),
 * pts = points, crumb = particle colour, emoji for the HUD.
 */
export const KINDS = {
  berry: { name: 'Quả Oran', size: 0.18, r: 0.2, pts: 5, crumb: '#3b82f6', emoji: '🫐' },
  apple: { name: 'Quả táo', size: 0.2, r: 0.2, pts: 5, crumb: '#ef4444', emoji: '🍎' },
  pokeball: { name: 'Poké Ball', size: 0.21, r: 0.22, pts: 8, crumb: '#f87171', emoji: '🔴' },
  flower: { name: 'Bông hoa', size: 0.24, r: 0.22, pts: 4, crumb: '#f472b6', emoji: '🌸' },
  coconut: { name: 'Quả dừa', size: 0.24, r: 0.24, pts: 6, crumb: '#a16207', emoji: '🥥' },
  shell: { name: 'Vỏ sò', size: 0.22, r: 0.22, pts: 5, crumb: '#fda4af', emoji: '🐚' },
  mailbox: { name: 'Hộp thư', size: 0.38, r: 0.3, pts: 15, crumb: '#ef4444', emoji: '📮' },
  lamp: { name: 'Cột đèn', size: 0.45, r: 0.22, pts: 18, crumb: '#fde047', emoji: '💡' },
  bench: { name: 'Ghế đá', size: 0.55, r: 0.55, pts: 20, crumb: '#b45309', emoji: '🪑' },
  umbrella: { name: 'Ô bãi biển', size: 0.5, r: 0.45, pts: 18, crumb: '#f97316', emoji: '⛱️' },
  sandcastle: { name: 'Lâu đài cát', size: 0.6, r: 0.55, pts: 22, crumb: '#fcd34d', emoji: '🏰' },
  bush: { name: 'Bụi cây', size: 0.72, r: 0.65, pts: 28, crumb: '#22c55e', emoji: '🌿' },
  tree: { name: 'Cây xanh', size: 1.1, r: 0.75, pts: 55, crumb: '#16a34a', emoji: '🌳' },
  palm: { name: 'Cây dừa', size: 1.1, r: 0.6, pts: 55, crumb: '#65a30d', emoji: '🌴' },
  car: { name: 'Xe hơi', size: 1.35, r: 1.05, pts: 80, crumb: '#60a5fa', emoji: '🚗' },
  boat: { name: 'Thuyền', size: 1.9, r: 1.4, pts: 140, crumb: '#f8fafc', emoji: '⛵' },
  bus: { name: 'Xe buýt', size: 2.0, r: 1.55, pts: 150, crumb: '#facc15', emoji: '🚌' },
  fountain: { name: 'Đài phun nước', size: 2.5, r: 2.1, pts: 220, crumb: '#7dd3fc', emoji: '⛲' },
  hut: { name: 'Nhà chòi', size: 2.8, r: 2.3, pts: 300, crumb: '#d97706', emoji: '🛖' },
  house: { name: 'Ngôi nhà', size: 3.2, r: 2.7, pts: 350, crumb: '#fb923c', emoji: '🏠' },
  mart: { name: 'Poké Mart', size: 4.3, r: 3.6, pts: 650, crumb: '#3b82f6', emoji: '🏪' },
  center: { name: 'Trung tâm Pokémon', size: 4.7, r: 3.9, pts: 750, crumb: '#f43f5e', emoji: '🏥' },
  tower: { name: 'Tháp khổng lồ', size: 6.6, r: 4.4, pts: 1600, crumb: '#a78bfa', emoji: '🗼' },
  lighthouse: { name: 'Ngọn hải đăng', size: 6.5, r: 4.0, pts: 1600, crumb: '#f8fafc', emoji: '🗼' },
};

export const SPECIES = {
  rattata: { name: 'Rattata', dex: 19 },
  pidgey: { name: 'Pidgey', dex: 16 },
  wurmple: { name: 'Wurmple', dex: 265 },
};

/**
 * Three towns. star1..3 are score thresholds (tuned with the greedy bot in gulp3d.test.js).
 * sub: kind substitutions (the tropical island uses palms, huts, boats…).
 */
export const MAPS = [
  {
    id: 'pallet',
    name: 'Thị trấn Pallet',
    icon: '🏡',
    tip: 'Ăn quả mọng nhỏ trước, rồi lớn dần để nuốt cả Tháp chuông!',
    seed: 11,
    half: 44,
    step: 22,
    island: false,
    smalls: 150,
    cars: 10,
    buses: 2,
    blocks: ['forest', 'houses', 'tower', 'houses', 'houses', 'park', 'houses', 'mart', 'houses', 'center', 'fountain', 'forest', 'park', 'houses', 'forest', 'houses'],
    sub: {},
    names: { tower: 'Tháp chuông' },
    species: ['rattata', 'pidgey', 'wurmple'],
    pokemon: 6,
    stars: [2500, 10000, 22000],
  },
  {
    id: 'celadon',
    name: 'Thành phố Celadon',
    icon: '🏙️',
    tip: 'Phố đông xe! Lớn nhanh để nuốt xe buýt và Tòa tháp Celadon.',
    seed: 23,
    half: 48,
    step: 24,
    island: false,
    smalls: 170,
    cars: 18,
    buses: 5,
    blocks: ['houses', 'mart', 'houses', 'tower', 'park', 'houses', 'fountain', 'houses', 'houses', 'forest', 'center', 'houses', 'houses', 'park', 'houses', 'forest'],
    sub: {},
    names: { tower: 'Tòa tháp Celadon' },
    species: ['rattata', 'pidgey', 'wurmple'],
    pokemon: 7,
    stars: [2500, 11000, 24000],
  },
  {
    id: 'island',
    name: 'Đảo nhiệt đới',
    icon: '🏝️',
    tip: 'Dừa, lâu đài cát, thuyền và Ngọn hải đăng đang chờ Snorlax!',
    seed: 37,
    half: 46,
    step: 23,
    island: true,
    grow: 0.2,
    smalls: 170,
    cars: 0,
    buses: 0,
    boats: 10,
    blocks: ['forest', 'houses', 'park', 'forest', 'houses', 'mart', 'tower', 'houses', 'houses', 'fountain', 'center', 'houses', 'forest', 'houses', 'park', 'forest'],
    sub: { tree: 'palm', house: 'hut', apple: 'coconut', mailbox: 'shell', lamp: 'umbrella', bench: 'sandcastle', tower: 'lighthouse' },
    names: {},
    species: ['pidgey', 'wurmple', 'rattata'],
    pokemon: 6,
    stars: [2000, 8000, 16000],
  },
];

export const kindName = (map, kind) => map?.names?.[kind] || KINDS[kind]?.name || kind;

/** Builds the deterministic city of a map: objects, powerup spots, pokemon homes, start points. */
export function buildCity(mapIndex) {
  const map = MAPS[mapIndex];
  const rnd = mulberry(map.seed * 7919 + 13);
  const { half, step } = map;
  const sub = (k) => map.sub[k] || k;
  const objects = [];
  const inside = (x, z, pad = 0) => (map.island ? Math.hypot(x, z) < half - 3 - pad : Math.abs(x) < half - 1.5 - pad && Math.abs(z) < half - 1.5 - pad);
  // Clear circles (start spots) nothing is built on
  const keepClear = [
    { x: 0, z: 0, r: 4.5 },
    { x: step, z: step, r: 3 },
  ];
  const free = (x, z, r) => {
    if (!inside(x, z, r)) return false;
    for (const c of keepClear) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];
      const rr = KINDS[o.kind].r + r + 0.15;
      const dx = o.x - x;
      const dz = o.z - z;
      if (dx * dx + dz * dz < rr * rr) return false;
    }
    return true;
  };
  const put = (kind, x, z, rot = rnd() * TAU, tries = 0) => {
    const k = sub(kind);
    const r = KINDS[k].r;
    for (let t = 0; t <= tries; t++) {
      const px = t === 0 ? x : x + (rnd() - 0.5) * 2.4 * t;
      const pz = t === 0 ? z : z + (rnd() - 0.5) * 2.4 * t;
      if (free(px, pz, r)) {
        objects.push({ id: objects.length, kind: k, x: px, z: pz, rot, variant: Math.floor(rnd() * 4) });
        return true;
      }
    }
    return false;
  };
  // Road centre lines (both axes) — blocks sit between them
  const roads = [];
  for (let v = -half + step; v < half - 1; v += step) roads.push(v);
  const centres = [];
  for (let v = -half + step / 2; v < half; v += step) centres.push(v);
  const inner = step - 6; // usable block width (roads are 5 wide + sidewalk)
  let bi = 0;
  for (const bz of centres) {
    for (const bx of centres) {
      const plan = map.blocks[bi % map.blocks.length];
      bi += 1;
      if (map.island && Math.hypot(bx, bz) > half - 6) continue;
      const h = inner / 2;
      const at = (fx, fz) => [bx + fx * h, bz + fz * h];
      if (plan === 'houses') {
        const slots = [
          [-0.5, -0.5],
          [0.5, -0.5],
          [-0.5, 0.5],
          [0.5, 0.5],
        ];
        for (const [fx, fz] of slots) {
          if (rnd() < 0.15) continue;
          const [x, z] = at(fx, fz);
          const face = fz < 0 ? Math.PI : 0;
          if (!put('house', x, z, face)) continue;
          put('mailbox', x + 2.2, z + (fz < 0 ? -3.2 : 3.2), face, 3);
          put('bush', x - 2.6, z + (fz < 0 ? -3.3 : 3.3), 0, 3);
          if (rnd() < 0.7) put('tree', x + (fx < 0 ? -3.4 : 3.4), z, 0, 3);
          for (let i = 0; i < 3; i++) put('flower', x + (rnd() - 0.5) * 6, z + (fz < 0 ? -3.6 : 3.6), 0, 2);
        }
      } else if (plan === 'park' || plan === 'fountain') {
        if (plan === 'fountain') put('fountain', bx, bz, 0);
        else put('tree', bx, bz, 0);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + 0.3;
          const ring = plan === 'fountain' ? 6.4 : 5.5;
          put(i % 2 ? 'tree' : 'bush', bx + Math.cos(a) * ring, bz + Math.sin(a) * ring, 0, 2);
        }
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU;
          put('bench', bx + Math.cos(a) * 3.6, bz + Math.sin(a) * 3.6, -a + Math.PI / 2, 2);
          put('lamp', bx + Math.cos(a + 0.8) * 3.8, bz + Math.sin(a + 0.8) * 3.8, 0, 2);
        }
        for (let i = 0; i < 10; i++) put('flower', bx + (rnd() - 0.5) * inner, bz + (rnd() - 0.5) * inner, 0, 2);
      } else if (plan === 'forest') {
        for (let i = 0; i < 11; i++) put('tree', bx + (rnd() - 0.5) * inner, bz + (rnd() - 0.5) * inner, 0, 3);
        for (let i = 0; i < 6; i++) put('bush', bx + (rnd() - 0.5) * inner, bz + (rnd() - 0.5) * inner, 0, 3);
        for (let i = 0; i < 10; i++) put(i % 2 ? 'berry' : 'apple', bx + (rnd() - 0.5) * inner, bz + (rnd() - 0.5) * inner, 0, 3);
      } else {
        // Landmark: mart / center / tower in the middle with a little garden
        put(plan, bx, bz - (plan === 'tower' ? 0 : 1), plan === 'tower' ? 0 : 0, 0);
        for (const [fx, fz] of [
          [-0.85, -0.85],
          [0.85, -0.85],
          [-0.85, 0.85],
          [0.85, 0.85],
        ]) {
          const [x, z] = at(fx, fz);
          put(rnd() < 0.5 ? 'tree' : 'bush', x, z, 0, 2);
        }
        put('bench', bx - 2.5, bz + h - 0.8, 0, 2);
        put('lamp', bx + 2.5, bz + h - 0.6, 0, 2);
        for (let i = 0; i < 6; i++) put('flower', bx + (rnd() - 0.5) * inner, bz + h - 0.5 - rnd(), 0, 2);
      }
    }
  }
  // Street furniture along the roads (sidewalk at road ±3.3)
  for (const rv of roads) {
    for (let u = -half + 4; u < half - 3; u += 8.5) {
      if (roads.some((q) => Math.abs(q - u) < 4)) continue; // not on crossings
      const side = Math.floor(u / 8.5) % 2 ? 1 : -1;
      put('lamp', u, rv + side * 3.3, 0);
      put('lamp', rv + side * 3.3, u + 4, 0);
      if (rnd() < 0.35) put(rnd() < 0.5 ? 'bench' : 'mailbox', u + 2.5, rv - side * 3.3, side > 0 ? Math.PI : 0);
    }
  }
  // Cars and buses parked in the lanes, aligned with the road
  const vehicles = [];
  for (let i = 0; i < map.cars; i++) vehicles.push('car');
  for (let i = 0; i < map.buses; i++) vehicles.push('bus');
  for (const v of vehicles) {
    for (let t = 0; t < 30; t++) {
      const rv = roads[Math.floor(rnd() * roads.length)];
      const u = (rnd() - 0.5) * (2 * half - 10);
      if (roads.some((q) => Math.abs(q - u) < 5)) continue;
      const lane = rnd() < 0.5 ? -1.3 : 1.3;
      const alongX = rnd() < 0.5;
      const ok = alongX ? put(v, u, rv + lane, lane > 0 ? Math.PI / 2 : -Math.PI / 2) : put(v, rv + lane, u, lane > 0 ? 0 : Math.PI);
      if (ok) break;
    }
  }
  // Boats pulled up on the beach (island)
  for (let i = 0; i < (map.boats || 0); i++) {
    const a = (i / map.boats) * TAU + 0.4;
    const rr = half - 5.5;
    put('boat', Math.cos(a) * rr, Math.sin(a) * rr, -a, 3);
  }
  // Small snacks everywhere (and a ring around the start so the first seconds are fun)
  const smallKinds = ['berry', 'apple', 'pokeball', 'flower', 'berry', 'pokeball'];
  // two offset rings: whichever way the child walks first, a snack is in the way
  for (let i = 0; i < 32; i++) {
    const a = ((i >> 1) / 16) * TAU + (i % 2 ? TAU / 32 : 0);
    const rr = i % 2 ? 6.6 : 5.2;
    put(smallKinds[i % smallKinds.length], Math.cos(a) * rr, Math.sin(a) * rr, rnd() * TAU);
  }
  for (let i = 0; i < map.smalls; i++) {
    const x = (rnd() - 0.5) * 2 * (half - 3);
    const z = (rnd() - 0.5) * 2 * (half - 3);
    put(smallKinds[Math.floor(rnd() * smallKinds.length)], x, z, rnd() * TAU, 3);
  }
  objects.forEach((o, i) => (o.id = i));
  // Powerup spots and Pokemon homes (on roads, so they are reachable)
  const spots = [];
  for (let i = 0; i < 24; i++) {
    const rv = roads[Math.floor(rnd() * roads.length)];
    const u = (rnd() - 0.5) * (2 * half - 12);
    const p = rnd() < 0.5 ? { x: u, z: rv } : { x: rv, z: u };
    if (inside(p.x, p.z, 2) && Math.hypot(p.x, p.z) > 6) spots.push(p);
  }
  return { objects, roads, spots, start: { x: 0, z: 0 }, rivalStart: { x: step, z: step } };
}

/** New round on map `mapIndex`. `rival` adds Munchlax eating in the same town. */
export function createGulp3D(mapIndex = 0, { random = Math.random, rival = true, time = ROUND_TIME } = {}) {
  const map = MAPS[mapIndex];
  const city = buildCity(mapIndex);
  const objects = city.objects.map((o) => ({ ...o, alive: true, eatenBy: null, jig: 0 }));
  const totalMass = objects.reduce((a, o) => a + KINDS[o.kind].size ** 2, 0);
  // Size tiers: every distinct size in this town is a "level"
  const tiers = [...new Set(objects.map((o) => o.kind))].sort((a, b) => KINDS[a].size - KINDS[b].size);
  const pokemon = [];
  for (let i = 0; i < map.pokemon; i++) {
    const p = city.spots[(i * 3 + 1) % city.spots.length] || { x: 10, z: 10 };
    pokemon.push({ id: i, species: map.species[i % map.species.length], x: p.x + (random() - 0.5) * 4, z: p.z + (random() - 0.5) * 4, vx: 0, vz: 0, heading: random() * TAU, wanderT: 0, cool: 0, fleeing: false, hop: random() * TAU });
  }
  const s = {
    map,
    mapIndex,
    city,
    objects,
    tiers,
    random,
    t: 0,
    timeLeft: time,
    status: 'play',
    x: city.start.x,
    z: city.start.z,
    vx: 0,
    vz: 0,
    heading: 0,
    moving: 0,
    R: R0,
    targetR: R0,
    mass: 0,
    score: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    eaten: 0,
    eatenMass: 0,
    totalMass,
    biggest: null,
    level: 0,
    powers: { gold: 0, speed: 0, magnet: 0 },
    powerups: [],
    nextPowerT: 6,
    powerId: 0,
    bumpCd: 0,
    bumpT: 9,
    drops: 0,
    pokemon,
    rival: rival
      ? { x: city.rivalStart.x, z: city.rivalStart.z, vx: 0, vz: 0, heading: Math.PI, R: RIVAL.R0, targetR: RIVAL.R0, mass: 0, score: 0, eaten: 0, target: -1, retarget: 0, wander: 0, moving: 0 }
      : null,
    events: [],
  };
  s.level = levelOf(s);
  s.level0 = s.level;
  // Three powerups to start with
  for (const type of ['gold', 'speed', 'magnet']) spawnPower(s, type);
  return s;
}

export const edibleBy = (R, kind) => KINDS[kind].size < R * EAT_K;
export const cityPercent = (s) => Math.round((100 * s.eatenMass) / Math.max(1e-6, s.totalMass));
export const starsFor = (score, map) => (score >= map.stars[2] ? 3 : score >= map.stars[1] ? 2 : score >= map.stars[0] ? 1 : 0);

/** Number of size tiers Snorlax can already eat. */
function levelOf(s) {
  let n = 0;
  for (const k of s.tiers) if (edibleBy(s.R, k)) n += 1;
  return n;
}

/** The next kind that is still too big, with the progress (0..1) towards it. */
export function nextGoal(s) {
  const kinds = s.tiers.filter((k) => s.objects.some((o) => o.alive && o.kind === k));
  const prevSize = s.tiers.filter((k) => edibleBy(s.R, k)).reduce((m, k) => Math.max(m, KINDS[k].size), R0 * EAT_K * 0.8);
  for (const k of kinds) {
    if (!edibleBy(s.R, k)) {
      const need = KINDS[k].size / EAT_K;
      const from = prevSize / EAT_K;
      return { kind: k, name: kindName(s.map, k), progress: clamp((s.R - from) / Math.max(1e-6, need - from), 0, 1) };
    }
  }
  return null;
}

function spawnPower(s, type) {
  const spots = s.city.spots;
  if (!spots.length) return;
  for (let t = 0; t < 8; t++) {
    const p = spots[Math.floor(s.random() * spots.length)];
    if (Math.hypot(p.x - s.x, p.z - s.z) < 6) continue;
    if (s.powerups.some((q) => q.alive && Math.hypot(q.x - p.x, q.z - p.z) < 4)) continue;
    s.powerups.push({ id: s.powerId++, type, x: p.x, z: p.z, alive: true });
    return;
  }
}

function inBounds(s, o, pad) {
  const h = s.map.half;
  if (s.map.island) {
    const lim = h - 3 - pad;
    const d = Math.hypot(o.x, o.z);
    if (d > lim) {
      o.x *= lim / d;
      o.z *= lim / d;
    }
  } else {
    const lim = h - 1 - pad;
    o.x = clamp(o.x, -lim, lim);
    o.z = clamp(o.z, -lim, lim);
  }
}

/** Swallow object o (by 'player' or 'rival'). */
function eat(s, o, by) {
  const k = KINDS[o.kind];
  o.alive = false;
  o.eatenBy = by;
  if (by === 'rival') {
    const r = s.rival;
    r.mass += k.size ** 2;
    r.targetR = Math.min(RIVAL.maxR, Math.sqrt(RIVAL.R0 ** 2 + RIVAL.grow * r.mass));
    r.score += k.pts;
    r.eaten += 1;
    s.events.push({ type: 'eat', by, id: o.id, kind: o.kind, x: o.x, z: o.z, pts: k.pts });
    return;
  }
  s.combo = s.comboT > 0 ? s.combo + 1 : 1;
  s.comboT = COMBO_TIME;
  s.bestCombo = Math.max(s.bestCombo, s.combo);
  const mult = (s.powers.gold > 0 ? 2 : 1) * (1 + Math.min(10, s.combo - 1) * 0.1);
  const pts = Math.round(k.pts * mult);
  s.score += pts;
  s.eaten += 1;
  if (!o.dropped) s.eatenMass += k.size ** 2;
  s.mass += k.size ** 2;
  s.targetR = Math.sqrt(R0 * R0 + (s.map.grow || GROW) * s.mass);
  if (!s.biggest || KINDS[s.biggest].size < k.size) s.biggest = o.kind;
  s.events.push({ type: 'eat', by, id: o.id, kind: o.kind, x: o.x, z: o.z, pts, combo: s.combo, gold: s.powers.gold > 0 });
  if (COMBO_CALLS.includes(s.combo)) s.events.push({ type: 'combo', n: s.combo });
}

/** Moves a circle body (player / rival) and resolves eating + bumping. */
function bodyStep(s, b, dt, ix, iz, speed, by) {
  const len = Math.hypot(ix, iz);
  if (len > 1) {
    ix /= len;
    iz /= len;
  }
  const accel = 1 - Math.exp(-9 * dt);
  b.vx += (ix * speed - b.vx) * accel;
  b.vz += (iz * speed - b.vz) * accel;
  b.x += b.vx * dt;
  b.z += b.vz * dt;
  const sp = Math.hypot(b.vx, b.vz);
  b.moving = clamp(sp / Math.max(1, speed), 0, 1);
  if (sp > 0.3) {
    const want = Math.atan2(b.vx, b.vz);
    let d = want - b.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    b.heading += d * (1 - Math.exp(-10 * dt));
  }
  b.R += (b.targetR - b.R) * (1 - Math.exp(-3 * dt));
  const body = b.R * BODY_K;
  let bumped = null;
  for (let i = 0; i < s.objects.length; i++) {
    const o = s.objects[i];
    if (!o.alive) continue;
    const k = KINDS[o.kind];
    const dx = o.x - b.x;
    const dz = o.z - b.z;
    const rr = body + k.r;
    if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr) continue;
    if (edibleBy(b.R, o.kind)) {
      eat(s, o, by);
      continue;
    }
    // Too big: push the body out, softly. The belly is squishy, so it squeezes into narrow gaps.
    const rb = b.R * SOFT_K + k.r * 0.85;
    if (d2 >= rb * rb) continue;
    const d = Math.sqrt(d2) || 1e-3;
    const push = rb - d;
    b.x -= (dx / d) * push;
    b.z -= (dz / d) * push;
    const vn = (b.vx * dx + b.vz * dz) / d;
    if (vn > 0) {
      b.vx -= (dx / d) * vn * 0.8;
      b.vz -= (dz / d) * vn * 0.8;
    }
    bumped = o;
  }
  inBounds(s, b, body * 0.5);
  return bumped;
}

/** Advances the round by dt seconds. input = { x, z } joystick in the world plane (-1..1). */
export function step(s, dt = DT, input = {}) {
  if (s.status !== 'play') return s;
  s.t += dt;
  s.timeLeft = Math.max(0, s.timeLeft - dt);
  for (const k of Object.keys(s.powers)) s.powers[k] = Math.max(0, s.powers[k] - dt);
  s.comboT = Math.max(0, s.comboT - dt);
  if (s.comboT === 0) s.combo = 0;
  s.bumpCd = Math.max(0, s.bumpCd - dt);
  s.bumpT += dt;

  // --- Snorlax
  const speed = (3.6 + 1.5 * s.R) * (s.powers.speed > 0 ? 1.6 : 1);
  const lvl0 = s.level;
  const bumped = bodyStep(s, s, dt, input.x || 0, input.z || 0, speed, 'player');
  if (bumped) {
    bumped.jig = 0.6;
    s.bumpT = 0;
    s.lastBump = { x: bumped.x, z: bumped.z };
    if (s.bumpCd === 0) {
      s.bumpCd = 1.2;
      s.events.push({ type: 'bump', id: bumped.id, kind: bumped.kind, x: bumped.x, z: bumped.z, need: KINDS[bumped.kind].size / EAT_K });
    }
  }
  for (const o of s.objects) if (o.jig > 0) o.jig = Math.max(0, o.jig - dt);
  const lvl = levelOf(s);
  if (lvl > lvl0) {
    s.level = lvl;
    const fresh = s.tiers.slice(lvl0, lvl).map((k) => kindName(s.map, k));
    s.events.push({ type: 'levelup', level: lvl, kinds: fresh, kindIds: s.tiers.slice(lvl0, lvl) });
  }

  // --- Powerups
  const reach = s.R * BODY_K + 0.7;
  for (const p of s.powerups) {
    if (!p.alive) continue;
    if (Math.hypot(p.x - s.x, p.z - s.z) < reach) {
      p.alive = false;
      s.powers[p.type] = POWER_TIME[p.type];
      s.events.push({ type: 'power', power: p.type, id: p.id, x: p.x, z: p.z });
    }
  }
  s.nextPowerT -= dt;
  if (s.nextPowerT <= 0) {
    s.nextPowerT = 12;
    if (s.powerups.filter((p) => p.alive).length < 3) {
      const types = ['gold', 'speed', 'magnet'];
      spawnPower(s, types[Math.floor(s.random() * types.length)]);
    }
  }
  // Magnet: small edible things fly towards Snorlax
  if (s.powers.magnet > 0) {
    const range = 6 + s.R * 4;
    const pull = (7 + s.R * 3) * dt;
    for (const o of s.objects) {
      if (!o.alive || !edibleBy(s.R, o.kind) || KINDS[o.kind].size > s.R * 0.6) continue;
      const dx = s.x - o.x;
      const dz = s.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 1e-3) continue;
      const m = Math.min(d, pull * (1.4 - d / range));
      o.x += (dx / d) * m;
      o.z += (dz / d) * m;
    }
  }

  // --- Friendly Pokemon: flee when Snorlax comes near, drop a berry after a sniff
  const scare = s.R * 2.2 + 3.5;
  for (const p of s.pokemon) {
    p.cool = Math.max(0, p.cool - dt);
    p.hop += dt * (p.fleeing ? 14 : 6);
    const dx = p.x - s.x;
    const dz = p.z - s.z;
    const d = Math.hypot(dx, dz) || 1e-3;
    let tx;
    let tz;
    let sp;
    p.fleeing = d < scare;
    if (p.fleeing) {
      tx = dx / d;
      tz = dz / d;
      sp = 4.2;
    } else {
      p.wanderT -= dt;
      if (p.wanderT <= 0) {
        p.wanderT = 2 + s.random() * 2.5;
        p.wa = s.random() * TAU;
        p.still = s.random() < 0.3;
      }
      tx = Math.sin(p.wa || 0);
      tz = Math.cos(p.wa || 0);
      sp = p.still ? 0 : 1.3;
    }
    const a = 1 - Math.exp(-6 * dt);
    p.vx += (tx * sp - p.vx) * a;
    p.vz += (tz * sp - p.vz) * a;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    if (Math.hypot(p.vx, p.vz) > 0.2) p.heading = Math.atan2(p.vx, p.vz);
    // Not inside buildings / trees
    for (const o of s.objects) {
      if (!o.alive) continue;
      const k = KINDS[o.kind];
      if (k.r < 0.5) continue;
      const ox = p.x - o.x;
      const oz = p.z - o.z;
      const rr = k.r + 0.35;
      if (ox > rr || ox < -rr || oz > rr || oz < -rr) continue;
      const od = Math.hypot(ox, oz);
      if (od < rr && od > 1e-4) {
        p.x = o.x + (ox / od) * rr;
        p.z = o.z + (oz / od) * rr;
        p.wa = (p.wa || 0) + 1.3;
      }
    }
    // Never swallowed: kept just outside Snorlax, who gives a friendly sniff
    const near = s.R * BODY_K + 0.45;
    const nd = Math.hypot(p.x - s.x, p.z - s.z) || 1e-3;
    if (nd < near) {
      p.x = s.x + ((p.x - s.x) / nd) * near;
      p.z = s.z + ((p.z - s.z) / nd) * near;
      if (p.cool === 0) {
        p.cool = 8;
        s.events.push({ type: 'sniff', pid: p.id, species: p.species, x: p.x, z: p.z });
        if (s.drops < MAX_DROPS) {
          s.drops += 1;
          const a2 = s.random() * TAU;
          const bx = p.x + Math.sin(a2) * 1.2;
          const bz = p.z + Math.cos(a2) * 1.2;
          const o = { id: s.objects.length, kind: 'berry', x: bx, z: bz, rot: 0, variant: 0, alive: true, eatenBy: null, jig: 0, dropped: true, born: s.t };
          s.objects.push(o);
          s.events.push({ type: 'drop', id: o.id, x: bx, z: bz, fromX: p.x, fromZ: p.z });
        }
      }
    }
    inBounds(s, p, 0.5);
  }

  // --- Rival Munchlax
  if (s.rival) rivalStep(s, dt);

  if (s.timeLeft <= 0 || !s.objects.some((o) => o.alive && !o.dropped)) {
    s.status = 'done';
    s.events.push({ type: 'finish', score: s.score, stars: starsFor(s.score, s.map), percent: cityPercent(s) });
  }
  return s;
}

function rivalStep(s, dt) {
  const r = s.rival;
  r.retarget -= dt;
  const cur = s.objects[r.target];
  if (r.retarget <= 0 || !cur || !cur.alive) {
    r.retarget = 0.5;
    let best = -1;
    let bd = 26 * 26;
    for (const o of s.objects) {
      if (!o.alive || !edibleBy(r.R, o.kind)) continue;
      const d2 = (o.x - r.x) ** 2 + (o.z - r.z) ** 2;
      // Munchlax stays away from Snorlax's snacks right in front of him
      if ((o.x - s.x) ** 2 + (o.z - s.z) ** 2 < (s.R * 3 + 3) ** 2) continue;
      if (d2 < bd) {
        bd = d2;
        best = o.id;
      }
    }
    r.target = best;
  }
  let ix = 0;
  let iz = 0;
  const t = s.objects[r.target];
  if (t && t.alive) {
    const dx = t.x - r.x;
    const dz = t.z - r.z;
    const d = Math.hypot(dx, dz) || 1;
    ix = dx / d;
    iz = dz / d;
  } else {
    r.wander -= dt;
    if (r.wander <= 0) {
      r.wander = 2;
      r.wa = s.random() * TAU;
    }
    ix = Math.sin(r.wa || 0) * 0.6;
    iz = Math.cos(r.wa || 0) * 0.6;
  }
  bodyStep(s, r, dt, ix, iz, RIVAL.speed + r.R, 'rival');
  // Friendly push from Snorlax
  const dx = r.x - s.x;
  const dz = r.z - s.z;
  const d = Math.hypot(dx, dz) || 1e-3;
  const rr = s.R * BODY_K + r.R * BODY_K;
  if (d < rr) {
    r.x = s.x + (dx / d) * rr;
    r.z = s.z + (dz / d) * rr;
  }
}

/** Advance `seconds` with a constant input or a bot function (tests). */
export function run(s, seconds, input = {}) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n && s.status === 'play'; i++) step(s, DT, typeof input === 'function' ? input(s) : input);
  return s;
}

/** Greedy bot: walks to the nearest thing it can eat (or a powerup); gives up on stuck targets. */
export function greedyBot(s) {
  const b = (s.bot ||= { target: null, retarget: 0, skip: new Map(), best: Infinity, stuck: 0 });
  b.retarget -= DT;
  const tgt = b.target;
  const alive = tgt && (tgt.power ? tgt.ref.alive : tgt.ref.alive && edibleBy(s.R, tgt.ref.kind));
  if (b.retarget <= 0 || !alive) {
    b.retarget = 0.3;
    let best = null;
    let bd = Infinity;
    for (const o of s.objects) {
      if (!o.alive || !edibleBy(s.R, o.kind) || (b.skip.get(o.id) || 0) > s.t) continue;
      const d = (o.x - s.x) ** 2 + (o.z - s.z) ** 2;
      // worth the walk? (big, tasty things pull from further away)
      const w = d / Math.pow(KINDS[o.kind].pts, 1.3);
      if (w < bd) {
        bd = w;
        best = { ref: o };
      }
    }
    for (const p of s.powerups) {
      if (!p.alive) continue;
      const d = ((p.x - s.x) ** 2 + (p.z - s.z) ** 2) / 60;
      if (d < bd) {
        bd = d;
        best = { ref: p, power: true };
      }
    }
    if (best?.ref !== tgt?.ref) {
      b.best = Infinity;
      b.stuck = 0;
    }
    b.target = best;
  }
  if (!b.target) return { x: 0, z: 0 };
  const o = b.target.ref;
  const dx = o.x - s.x;
  const dz = o.z - s.z;
  const d = Math.hypot(dx, dz) || 1;
  if (d < b.best - 0.3) {
    b.best = d;
    b.stuck = 0;
  } else b.stuck += DT;
  if (b.stuck > 1.0) {
    if (!b.target.power) b.skip.set(o.id, s.t + 8);
    b.retarget = 0;
    b.stuck = 0;
    b.best = Infinity;
    // Back away from whatever blocks the way for a moment
    const from = s.lastBump || { x: o.x, z: o.z };
    const ax = s.x - from.x;
    const az = s.z - from.z;
    const al = Math.hypot(ax, az) || 1;
    const side = s.random() < 0.5 ? 1 : -1;
    b.escape = 0.9;
    b.ex = (ax / al) * 0.6 - (az / al) * side * 0.8;
    b.ez = (az / al) * 0.6 + (ax / al) * side * 0.8;
  }
  if (b.escape > 0) {
    b.escape -= DT;
    return { x: b.ex, z: b.ez };
  }
  let x = dx / d;
  let z = dz / d;
  // Slide around whatever we bumped into
  if (s.bumpT < 0.3) {
    const side = Math.sin(o.id * 12.9898) > 0 ? 1 : -1;
    x += -z * side * 0.9;
    z += (dx / d) * side * 0.9;
  }
  return { x, z };
}

/** Wandering bot: a new random direction every 1.5 s (balance check: ≤ 1 star). */
export function wanderBot(s) {
  const b = (s.wbot ||= { t: 0, x: 0, z: 0 });
  b.t -= DT;
  if (b.t <= 0) {
    b.t = 1.5;
    const a = s.random() * TAU;
    b.x = Math.sin(a);
    b.z = Math.cos(a);
  }
  return { x: b.x, z: b.z };
}

/** Plain copy for the React HUD. */
export function snap(s) {
  const goal = nextGoal(s);
  return {
    t: s.t,
    timeLeft: s.timeLeft,
    score: s.score,
    combo: s.combo,
    level: s.level - s.level0 + 1,
    R: s.R,
    percent: cityPercent(s),
    eaten: s.eaten,
    powers: { ...s.powers },
    rival: s.rival ? s.rival.score : null,
    goal: goal ? { name: goal.name, kind: goal.kind, progress: goal.progress } : null,
    status: s.status,
    stars: starsFor(s.score, s.map),
  };
}
