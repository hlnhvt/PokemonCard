// "Pokémon Chạy 3 làn": pure engine (no three.js, no DOM).
// The track runs along +z (metres). Lanes are x = -1, 0, 1 times LANE_W.
// The generator places "rows" of obstacles; every row keeps at least one lane completely
// free, and the free lane can always be reached in time from any lane the child could be in.

export const LANE_W = 2.2;
export const VIEW = 130; // how far ahead the track is generated (m)
export const WORLD_LEN = 600; // a new world every 600 m
export const WORLD_BLEND = 80; // colours crossfade over the last 80 m of a world
export const WORLDS = ['forest', 'city', 'cave', 'beach'];
export const WORLD_NAMES = { forest: 'Rừng Viridian', city: 'Thành phố', cave: 'Hang đá', beach: 'Bãi biển' };

export const SPEED = { start: 8.5, ramp: 0.005, max: 18, boost: 1.6 };
export const JUMP = { v: 9.5, g: 30 }; // peak 1.5 m, 0.63 s in the air
export const FAST_FALL = 24;
export const SLIDE_T = 0.7;
export const LANE_LERP = 14; // x follows the target lane exponentially
export const PLAYER = { hw: 0.45, hz: 0.4, h: 1.6, slideH: 0.7 };
// Planning margins used by the generator (generous for children)
export const REACT = 0.6; // seconds to notice and react
export const LANE_TIME = 0.3; // seconds budgeted per lane change
export const HIT_X = 1.0; // |player x - obstacle x| below this collides

/** Collision boxes: half depth along z, and the vertical range they fill. `pass` = how to get past in-lane. */
export const OBST = {
  barrier: { hz: 0.3, y0: 0, y1: 0.8, pass: 'jump' },
  bar: { hz: 0.3, y0: 1.05, y1: 3.2, pass: 'slide' },
  snorlax: { hz: 1.3, y0: 0, y1: 2.6, pass: 'lane' },
  geodude: { hz: 0.6, y0: 0, y1: 1.2, pass: 'lane' },
  crate: { hz: 0.65, y0: 0, y1: 1.25, pass: 'lane' },
};
export const GEODUDE_SPEED = 5; // rolls toward the runner (m/s)
export const GEODUDE_SHOW = 45; // becomes active when the meeting point is this close
export const CRATE = { hold: 7.5, g: 26, dropTime: 1.5, warnTime: 2.8, h: 1.25 };

export const POWER = {
  magnet: { time: 10, label: 'Nam châm' },
  shield: { time: 20, label: 'Khiên Poké Ball' },
  boost: { time: 3.5, label: 'Tăng tốc' },
  double: { time: 12, label: 'Xu x2' },
  revive: { time: 0, label: 'Hồi sinh' },
};
export const MAGNET_RANGE = 14;
export const CONTINUE_TIME = 5;

const MISSION_POOL = [
  { kind: 'coins', goals: [50, 80, 120], label: (n) => `Nhặt ${n} xu` },
  { kind: 'jumps', goals: [8, 12], label: (n) => `Nhảy ${n} lần` },
  { kind: 'slides', goals: [5, 8], label: (n) => `Trượt ${n} lần` },
  { kind: 'dist', goals: [500, 1000], label: (n) => `Chạy ${n} m` },
  { kind: 'powers', goals: [2, 3], label: (n) => `Nhặt ${n} vật phẩm` },
  { kind: 'dodges', goals: [15, 30], label: (n) => `Vượt ${n} chướng ngại` },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

export const baseSpeedAt = (d) => Math.min(SPEED.max, SPEED.start + SPEED.ramp * Math.max(0, d));
/** Lanes a child can move in `t` seconds, by the planning budget. */
export const maxMoves = (t) => clamp(Math.floor((t - REACT) / LANE_TIME), 0, 2);

/** Which world is at distance d, and how far the crossfade to the next one has gone (0..1). */
export function worldAt(d) {
  const k = Math.floor(Math.max(0, d) / WORLD_LEN);
  const into = Math.max(0, d) - k * WORLD_LEN;
  const t = clamp((into - (WORLD_LEN - WORLD_BLEND)) / WORLD_BLEND, 0, 1);
  return { index: k % WORLDS.length, next: (k + 1) % WORLDS.length, blend: t * t * (3 - 2 * t), loop: k };
}

export function pickMissions(random = Math.random) {
  const pool = [...MISSION_POOL];
  const out = [];
  while (out.length < 3 && pool.length) {
    const m = pool.splice(Math.floor(random() * pool.length), 1)[0];
    const goal = pick(m.goals, random);
    out.push({ kind: m.kind, goal, label: m.label(goal), progress: 0, done: false });
  }
  return out;
}

/** Gold for a run: distance and coins, 5-40, a little extra for missions. */
export const goldForRun = (dist, coins, missionsDone = 0) => clamp(Math.round(5 + dist / 80 + coins / 10 + missionsDone * 2), 5, 40);

// ---------------------------------------------------------------- generator

/** Fresh generator state. The first row comes after a short warm-up stretch. */
export function createGenerator(startZ = 45) {
  return { nextZ: startZ, prevEnd: 0, reach: [-1, 0, 1], reserved: { '-1': -1, 0: -1, 1: -1 }, row: 0, sincePower: 0, nextPower: 180 };
}

/** Difficulty 0..1 by distance. */
const difficulty = (z) => clamp(z / 1800, 0, 1);

/** Time gap (s) before the next row, shorter as the run goes on. */
function gapTime(z, random) {
  const k = difficulty(z);
  const lo = 1.65 - 0.6 * k; // 1.65 s early, 1.05 s late
  const hi = 2.4 - 0.85 * k;
  return lo + random() * (hi - lo);
}

function obstacleTypes(z) {
  const types = [['barrier', 3], ['bar', 3], ['snorlax', 2]];
  if (z > 250) types.push(['geodude', 2]);
  if (z > 400) types.push(['crate', 2]);
  return types;
}
function weighted(list, random) {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = random() * total;
  for (const [k, w] of list) {
    r -= w;
    if (r <= 0) return k;
  }
  return list[list.length - 1][0];
}

/** A candidate row: { lane: type } for 1 or 2 lanes. */
function candidateRow(z, random, reserved) {
  const k = difficulty(z);
  const two = z > 120 && random() < 0.25 + 0.45 * k;
  const lanes = [-1, 0, 1].filter((l) => reserved[l] < z);
  const n = Math.min(two ? 2 : 1, lanes.length - 0); // never all three
  const row = {};
  const free = [...lanes];
  for (let i = 0; i < n && free.length > 0; i++) {
    const l = free.splice(Math.floor(random() * free.length), 1)[0];
    row[l] = weighted(obstacleTypes(z), random);
  }
  // Never block every lane
  if (Object.keys(row).length >= 3) delete row[Object.keys(row)[0]];
  return row;
}

/** Lanes of a row: free (nothing there) and passable (free, or cleared by a jump / slide). */
export function rowLanes(row) {
  const free = [];
  const pass = [];
  for (const l of [-1, 0, 1]) {
    const t = row[l];
    if (!t) {
      free.push(l);
      pass.push(l);
    } else if (OBST[t].pass !== 'lane') pass.push(l);
  }
  return { free, pass };
}

/** From every lane in `reach`, a free lane of the row must be within `moves` lanes. */
export function noTrap(reach, free, moves) {
  return reach.every((l) => free.some((f) => Math.abs(f - l) <= moves));
}
const expand = (reach, moves) => [-1, 0, 1].filter((l) => reach.some((r) => Math.abs(r - l) <= moves));

const rowHalf = (row) => Math.max(0.3, ...Object.values(row).map((t) => OBST[t].hz));

/**
 * Generate the next row of obstacles (and coins / power-ups in the gap after it).
 * Returns { z, row, obstacles, coins, pickups } and advances `gen`.
 */
export function generateRow(gen, random, ids = { n: 0 }) {
  const z = gen.nextZ;
  const v = baseSpeedAt(z);
  const gapT = Math.max(0.01, (z - gen.prevEnd - PLAYER.hz) / v);
  const moves = maxMoves(gapT);
  let row = null;
  for (let tries = 0; tries < 30 && !row; tries++) {
    const cand = candidateRow(z, random, gen.reserved);
    const { free } = rowLanes(cand);
    if (free.length && noTrap(gen.reach, free, moves)) row = cand;
  }
  if (!row) {
    // Fallback: one obstacle that keeps every reachable lane safe, or nothing at all
    row = {};
    for (const l of [-1, 0, 1]) {
      const cand = { [l]: 'barrier' };
      if (gen.reserved[l] < z && noTrap(gen.reach, rowLanes(cand).free, moves)) {
        row = cand;
        break;
      }
    }
  }
  const { free, pass } = rowLanes(row);
  const half = Object.keys(row).length ? rowHalf(row) : 0.3;
  const obstacles = [];
  for (const [ls, type] of Object.entries(row)) {
    const lane = Number(ls);
    const o = { id: ++ids.n, type, lane, x: lane * LANE_W, z, z0: z, y: 0, state: 'idle', passed: false, hit: false, ...OBST[type] };
    if (type === 'geodude') {
      o.state = 'wait';
      gen.reserved[lane] = Math.max(gen.reserved[lane], z + 32); // nothing else in its rolling path
    }
    if (type === 'crate') {
      o.state = 'hold';
      o.y = CRATE.hold;
    }
    obstacles.push(o);
  }
  gen.reach = expand(gen.reach, moves).filter((l) => pass.includes(l));
  if (!gen.reach.length) gen.reach = free; // cannot happen thanks to noTrap; kept for safety
  // Next gap (a breather now and then)
  const breather = gen.row > 0 && gen.row % 9 === 8;
  const nextGap = (breather ? 2.6 : gapTime(z, random)) * v;
  gen.prevEnd = z + half;
  gen.nextZ = z + half + nextGap;
  gen.row++;

  // Coins in the gap after the row
  const coins = [];
  const addCoin = (x, y, cz) => coins.push({ id: ++ids.n, x, y, z: cz, lane: Math.round(x / LANE_W), taken: false, mag: false });
  const gapStart = z + half + 2.5;
  const gapEnd = gen.nextZ - 3;
  const r = random();
  if (r < 0.75 && gapEnd - gapStart > 4) {
    const lane = pick(free.length ? free : [-1, 0, 1], random);
    const n = Math.min(10, Math.floor((gapEnd - gapStart) / 2.2));
    if (random() < 0.3 && n >= 6) {
      // zig-zag between two lanes
      const other = clamp(lane + (random() < 0.5 ? -1 : 1), -1, 1);
      for (let i = 0; i < n; i++) {
        const t = clamp((i - n / 2 + 1) / 2, 0, 1);
        addCoin((lane + (other - lane) * t) * LANE_W, 0.9, gapStart + i * 2.2);
      }
    } else for (let i = 0; i < n; i++) addCoin(lane * LANE_W, 0.9, gapStart + i * 2.2);
  }
  // A coin arc over a barrier, coins under a high bar
  for (const o of obstacles) {
    if (o.type === 'barrier' && random() < 0.55) {
      const span = v * 0.6;
      for (let i = -3; i <= 3; i++) {
        const dz = (i / 3) * (span / 2);
        addCoin(o.x, 0.9 + 1.5 * (1 - (dz / (span / 2)) ** 2), z + dz);
      }
    } else if (o.type === 'bar' && random() < 0.5) {
      for (let i = -1; i <= 1; i++) addCoin(o.x, 0.4, z + i * 1.4);
    }
  }
  // Power-ups now and then, in a free lane in the middle of the gap
  const pickups = [];
  if (z >= gen.nextPower && gapEnd - gapStart > 6) {
    const kind = weighted([['magnet', 3], ['shield', 2], ['boost', 2], ['double', 2], ['revive', 1.2]], random);
    const lane = pick(free.length ? free : [0], random);
    const pz = (gapStart + gapEnd) / 2;
    // keep it clear of the coin line in that lane
    for (let i = coins.length - 1; i >= 0; i--) if (coins[i].lane === lane && Math.abs(coins[i].z - pz) < 2.5) coins.splice(i, 1);
    pickups.push({ id: ++ids.n, kind, x: lane * LANE_W, y: 1.0, z: pz, lane, taken: false });
    gen.nextPower = z + 220 + random() * 180;
  }
  return { z, row, obstacles, coins, pickups, moves, gapT };
}

// ---------------------------------------------------------------- run state

export function createRun({ random = Math.random, best = 0 } = {}) {
  return {
    random,
    phase: 'ready', // ready | run | crashed | over
    t: 0,
    d: 0,
    speed: SPEED.start,
    baseSpeed: SPEED.start,
    lane: 0,
    x: 0,
    lean: 0,
    y: 0,
    vy: 0,
    slideT: 0,
    slideQueued: false,
    landed: true,
    coins: 0,
    combo: 0,
    lastCoinT: -9,
    laneChangeT: -9,
    fromLane: 0,
    power: { magnet: 0, shield: 0, boost: 0, double: 0 },
    revives: 0,
    continueUsed: false,
    reviveUsed: false,
    invuln: 0,
    pending: null, // after a crash: 'revive' | 'offer' | 'over'
    crashT: 0,
    offerT: 0,
    hits: 0,
    crashedBy: null,
    stats: { jumps: 0, slides: 0, dodges: 0, powers: 0, nearMiss: 0 },
    missions: pickMissions(random),
    gen: createGenerator(),
    ids: { n: 0 },
    obstacles: [],
    coinList: [],
    pickups: [],
    world: 0,
    best,
    events: [],
  };
}

export function startRun(s) {
  if (s.phase === 'ready') s.phase = 'run';
}

const emit = (s, type, data = {}) => s.events.push({ type, ...data });
const onGround = (s) => s.y <= 0 && s.vy <= 0;

/** Player input: 'left' | 'right' | 'jump' | 'slide'. Returns true when it did something. */
export function input(s, action) {
  if (s.phase !== 'run') return false;
  if (action === 'left' || action === 'right') {
    const to = clamp(s.lane + (action === 'left' ? -1 : 1), -1, 1);
    if (to === s.lane) {
      emit(s, 'wall');
      return false;
    }
    s.fromLane = s.lane;
    s.lane = to;
    s.laneChangeT = s.t;
    emit(s, 'lane', { lane: to });
    return true;
  }
  if (action === 'jump') {
    if (!onGround(s)) return false;
    s.vy = JUMP.v;
    s.slideT = 0;
    s.slideQueued = false;
    s.landed = false;
    s.stats.jumps++;
    emit(s, 'jump');
    return true;
  }
  if (action === 'slide') {
    if (!onGround(s)) {
      s.vy = Math.min(s.vy, -FAST_FALL);
      s.slideQueued = true;
      return true;
    }
    if (s.slideT > 0.2) return false;
    s.slideT = SLIDE_T;
    s.stats.slides++;
    emit(s, 'slide');
    return true;
  }
  return false;
}

export const playerHeight = (s) => (s.slideT > 0 ? PLAYER.slideH : PLAYER.h);
export const invincible = (s) => s.invuln > 0 || s.power.boost > 0;

/** Vertical range of an obstacle right now. */
export function obstacleRange(o) {
  if (o.type === 'crate') return [o.y, o.y + CRATE.h];
  return [o.y0, o.y1];
}

/** True when the player box overlaps obstacle `o`. */
export function overlaps(s, o) {
  if (Math.abs(s.x - o.x) >= HIT_X) return false;
  if (Math.abs(o.z - s.d) >= o.hz + PLAYER.hz) return false;
  const [y0, y1] = obstacleRange(o);
  return s.y < y1 && s.y + playerHeight(s) > y0;
}

function addMissionProgress(s) {
  const values = { coins: s.coins, jumps: s.stats.jumps, slides: s.stats.slides, dist: Math.floor(s.d), powers: s.stats.powers, dodges: s.stats.dodges };
  for (const m of s.missions) {
    m.progress = Math.min(m.goal, values[m.kind] ?? 0);
    if (!m.done && m.progress >= m.goal) {
      m.done = true;
      emit(s, 'mission', { label: m.label });
    }
  }
}

function crash(s, o) {
  s.phase = 'crashed';
  s.crashT = 0;
  s.hits++;
  s.crashedBy = o.type;
  s.slideT = 0;
  o.hit = true;
  if (s.revives > 0) s.pending = 'revive';
  else if (!s.continueUsed) {
    s.pending = 'offer';
    s.offerT = CONTINUE_TIME;
  } else s.pending = 'over';
  emit(s, 'crash', { kind: o.type, pending: s.pending });
}

/** Get going again after a crash: obstacles just ahead are cleared, a short safe time. */
function resume(s, how) {
  s.phase = 'run';
  s.pending = null;
  s.invuln = 2.2;
  s.y = 0;
  s.vy = 0;
  s.x = s.lane * LANE_W;
  s.obstacles = s.obstacles.filter((o) => o.z < s.d - 3 || o.z > s.d + 35);
  emit(s, how);
}

export function acceptContinue(s) {
  if (s.phase !== 'crashed' || s.pending !== 'offer') return false;
  s.continueUsed = true;
  resume(s, 'continue');
  return true;
}

export function declineContinue(s) {
  if (s.phase !== 'crashed' || s.pending !== 'offer') return false;
  s.pending = 'over';
  s.crashT = 0.8;
  return true;
}

function finish(s) {
  s.phase = 'over';
  s.pending = null;
  addMissionProgress(s);
  emit(s, 'over', { dist: Math.floor(s.d), coins: s.coins });
}

function collectPower(s, p) {
  p.taken = true;
  s.stats.powers++;
  if (p.kind === 'revive') s.revives = Math.min(1, s.revives + 1);
  else s.power[p.kind] = POWER[p.kind].time;
  emit(s, 'power', { kind: p.kind, x: p.x, y: p.y, z: p.z });
}

/** Advance the run by dt seconds. */
export function step(s, dt) {
  if (s.phase === 'ready' || s.phase === 'over') return s;
  if (s.phase === 'crashed') {
    s.crashT += dt;
    if (s.pending === 'revive' && s.crashT > 1.0) {
      s.revives--;
      s.reviveUsed = true;
      resume(s, 'revive');
    } else if (s.pending === 'offer') {
      s.offerT = Math.max(0, s.offerT - dt);
      if (s.offerT <= 0) {
        s.pending = 'over';
        s.crashT = 0.8;
      }
    } else if (s.pending === 'over' && s.crashT > 1.2) finish(s);
    return s;
  }
  s.t += dt;
  s.baseSpeed = baseSpeedAt(s.d);
  s.speed = s.baseSpeed * (s.power.boost > 0 ? SPEED.boost : 1);
  s.d += s.speed * dt;

  // Lanes: smooth follow with a little lean
  const tx = s.lane * LANE_W;
  s.x += (tx - s.x) * Math.min(1, dt * LANE_LERP);
  if (Math.abs(tx - s.x) < 0.01) s.x = tx;
  s.lean = clamp((tx - s.x) * 0.22, -0.4, 0.4);

  // Jump arc, fast fall, slide
  if (s.y > 0 || s.vy > 0) {
    s.vy -= JUMP.g * dt;
    s.y += s.vy * dt;
    if (s.y <= 0) {
      s.y = 0;
      s.vy = 0;
      emit(s, 'land', { x: s.x, z: s.d });
      if (s.slideQueued) {
        s.slideQueued = false;
        s.slideT = SLIDE_T;
        s.stats.slides++;
        emit(s, 'slide');
      }
    }
  }
  if (s.slideT > 0) s.slideT = Math.max(0, s.slideT - dt);
  s.invuln = Math.max(0, s.invuln - dt);
  for (const k of Object.keys(s.power)) {
    if (s.power[k] > 0) {
      s.power[k] = Math.max(0, s.power[k] - dt);
      if (s.power[k] === 0) {
        emit(s, 'powerEnd', { kind: k });
        if (k === 'boost') s.invuln = Math.max(s.invuln, 1);
      }
    }
  }

  // World changes
  const w = worldAt(s.d);
  if (w.index !== s.world) {
    s.world = w.index;
    emit(s, 'world', { index: w.index, name: WORLD_NAMES[WORLDS[w.index]] });
  }

  // Generate ahead
  while (s.gen.nextZ < s.d + VIEW) {
    const r = generateRow(s.gen, s.random, s.ids);
    s.obstacles.push(...r.obstacles);
    s.coinList.push(...r.coins);
    s.pickups.push(...r.pickups);
  }

  // Moving obstacles
  for (const o of s.obstacles) {
    if (o.type === 'geodude') {
      const ahead = o.z0 - s.d;
      if (o.state === 'wait' && ahead < GEODUDE_SHOW) {
        o.state = 'roll';
        emit(s, 'geodude', { id: o.id });
      }
      // Meets the runner exactly at z0, rolling toward them at GEODUDE_SPEED
      o.z = o.z0 + (GEODUDE_SPEED * Math.min(ahead, GEODUDE_SHOW)) / Math.max(1, s.baseSpeed);
      o.spin = (o.spin || 0) + dt * 6;
    } else if (o.type === 'crate') {
      const tArrive = (o.z - s.d) / Math.max(1, s.speed);
      if (o.state === 'hold' && tArrive < CRATE.warnTime) {
        o.state = 'warn';
        emit(s, 'crateWarn', { id: o.id });
      }
      if (o.state === 'warn' && tArrive < CRATE.dropTime) {
        o.state = 'fall';
        o.vy = 0;
        emit(s, 'crateDrop', { id: o.id });
      }
      if (o.state === 'fall') {
        o.vy -= CRATE.g * dt;
        o.y += o.vy * dt;
        if (o.y <= 0) {
          o.y = 0;
          o.state = 'landed';
          emit(s, 'crateLand', { x: o.x, z: o.z });
        }
      }
    }
  }

  // Collisions
  for (const o of s.obstacles) {
    if (o.hit || o.smashed) continue;
    if (!overlaps(s, o)) continue;
    // Sliding into an obstacle sideways while changing lanes: bounce back, no harm
    // (the obstacle is already alongside: deeper in z than one frame of running could explain)
    const sideways = Math.abs(s.x - tx) > 0.35 && o.lane === s.lane && s.fromLane !== s.lane && Math.abs(o.z - s.d) < o.hz + PLAYER.hz - s.speed * dt * 2;
    if (sideways && !invincible(s)) {
      s.lane = s.fromLane;
      s.laneChangeT = -9;
      emit(s, 'bump', { kind: o.type });
      continue;
    }
    if (invincible(s)) {
      if (s.power.boost > 0) {
        o.smashed = true;
        emit(s, 'smash', { kind: o.type, x: o.x, z: o.z });
      }
      continue;
    }
    if (s.power.shield > 0) {
      s.power.shield = 0;
      s.invuln = 1.2;
      o.smashed = true;
      emit(s, 'shieldBreak', { kind: o.type, x: o.x, z: o.z });
      continue;
    }
    crash(s, o);
    return s;
  }

  // Passed obstacles: dodges and near misses
  for (const o of s.obstacles) {
    if (o.passed || o.z + o.hz >= s.d - PLAYER.hz) continue;
    o.passed = true;
    if (o.hit || o.smashed) continue;
    s.stats.dodges++;
    if (o.lane === s.lane) emit(s, 'clear', { kind: o.type });
    else if (o.lane === s.fromLane && s.t - s.laneChangeT < 0.8 && Math.abs(o.lane - s.lane) === 1) {
      s.stats.nearMiss++;
      emit(s, 'nearMiss', { kind: o.type });
    }
  }

  // Coins (magnet pulls them in)
  const mult = s.power.double > 0 ? 2 : 1;
  const ph = playerHeight(s);
  for (const c of s.coinList) {
    if (c.taken) continue;
    const dz = c.z - s.d;
    if (s.power.magnet > 0 && !c.mag && dz < MAGNET_RANGE && dz > -1) c.mag = true;
    if (c.mag) {
      const k = Math.min(1, dt * 10);
      c.x += (s.x - c.x) * k;
      c.y += (s.y + ph / 2 - c.y) * k;
      c.z += (s.d + 0.3 - c.z) * Math.min(1, dt * 8);
    }
    const near = Math.abs(c.z - s.d) < 0.8 && Math.abs(c.x - s.x) < 0.9 && c.y > s.y - 0.3 && c.y < s.y + ph + 0.3;
    if (near || (c.mag && Math.hypot(c.x - s.x, c.z - s.d) < 0.9)) {
      c.taken = true;
      s.combo = s.t - s.lastCoinT < 0.5 ? s.combo + 1 : 1;
      s.lastCoinT = s.t;
      s.coins += mult;
      emit(s, 'coin', { x: c.x, y: c.y, z: c.z, combo: s.combo, value: mult, mag: c.mag });
    }
  }
  if (s.t - s.lastCoinT > 0.6) s.combo = 0;

  for (const p of s.pickups) {
    if (p.taken) continue;
    if (Math.abs(p.z - s.d) < 1.0 && Math.abs(p.x - s.x) < 1.1 && p.y < s.y + ph + 0.4) collectPower(s, p);
  }

  // Forget what is behind
  const behind = s.d - 12;
  if (s.obstacles.length && s.obstacles[0].z < behind) s.obstacles = s.obstacles.filter((o) => o.z >= behind || (o.type === 'geodude' && o.z0 >= behind));
  if (s.coinList.length && s.coinList[0].z < behind) s.coinList = s.coinList.filter((c) => !c.taken && c.z >= behind);
  else if (s.coinList.length > 120) s.coinList = s.coinList.filter((c) => !c.taken);
  if (s.pickups.length) s.pickups = s.pickups.filter((p) => !p.taken && p.z >= behind);

  addMissionProgress(s);
  return s;
}

/** Plain copy for the HUD. */
export function snap(s) {
  return {
    phase: s.phase,
    dist: Math.floor(s.d),
    coins: s.coins,
    speed: s.speed,
    lane: s.lane,
    combo: s.combo,
    power: { ...s.power },
    revives: s.revives,
    pending: s.pending,
    offerT: s.offerT,
    world: s.world,
    missions: s.missions.map((m) => ({ ...m })),
    missionsDone: s.missions.filter((m) => m.done).length,
    stats: { ...s.stats },
    continueUsed: s.continueUsed,
    best: s.best,
  };
}
