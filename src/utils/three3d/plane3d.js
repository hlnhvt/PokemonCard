// "Đua máy bay Pokémon": pure engine (no three.js, no DOM).
// The plane flies along +z (metres) at a fixed height; lanes are x = -1, 0, 1 times LANE_W.
// The whole level is generated at the start: rows of obstacles (every row keeps a free lane that can be
// reached in time from wherever the child could be), coin lines / arcs, star rings and power-ups,
// then the finish gate at `length`.
import { OBST, LEVELS, DIFFS, speedFor, lengthFor } from './plane3d/levels';

export { OBST, LEVELS, DIFFS, DIFF_IDS, LIVERIES, speedFor, lengthFor, secondsFor } from './plane3d/levels';

export const LANE_W = 3.4;
export const PLANE = { hw: 0.95, hz: 1.2 };
export const LANE_K = 160; // lane spring stiffness (critically damped)
export const HEARTS = 3;
export const CONTINUE_TIME = 6;
export const FINISH_TIME = 2.4; // flying on through the gate before the result
export const WARMUP = 3.4; // seconds before the first row
export const FINISH_CLEAR = 2.6; // seconds of empty sky before the gate
export const COIN_STEP = 3.2; // metres between coins in a line
export const MAGNET_RANGE = 20;
export const COMBO_GAP = 0.5;
export const POWER = {
  shield: { time: 18, label: 'Khiên' },
  magnet: { time: 9, label: 'Nam châm' },
  boost: { time: 3, mult: 1.55, label: 'Tăng tốc' },
};
export const MAX_BOOSTS = 2;
export const RING_VALUE = 5;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LANES = [-1, 0, 1];

function weighted(list, random) {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let r = random() * total;
  for (const [k, w] of list) {
    r -= w;
    if (r <= 0) return k;
  }
  return list[list.length - 1][0];
}
const pick = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

/** Lanes a child can move in `t` seconds at a difficulty (planning budget). */
export const maxMoves = (t, diff) => clamp(Math.floor((t - DIFFS[diff].react) / DIFFS[diff].laneTime), 0, 2);

/** From every lane in `reach`, a free lane must be within `moves` lanes. */
export const noTrap = (reach, free, moves) => reach.length > 0 && reach.every((l) => free.some((f) => Math.abs(f - l) <= moves));
const expand = (reach, moves) => LANES.filter((l) => reach.some((r) => Math.abs(r - l) <= moves));

/** Worst-case flying time (s): the track at base speed minus what every boost could save. */
export function minSeconds(levelIndex, diff) {
  const v = speedFor(levelIndex, diff);
  return lengthFor(levelIndex, diff) / v - MAX_BOOSTS * POWER.boost.time * (POWER.boost.mult - 1);
}

// ---------------------------------------------------------------- generator

/**
 * Build a whole level. Returns { rows, obstacles, coins, rings, pickups, length, speed }.
 * Each row: { z, lanes: { [lane]: kind }, free: [...], moves, gapT, reach: [...] (lanes the child can be in after it) }.
 */
export function generateLevel(levelIndex, diff, random = Math.random) {
  const lv = LEVELS[levelIndex];
  const D = DIFFS[diff];
  const v = speedFor(levelIndex, diff);
  const length = lengthFor(levelIndex, diff);
  const ids = { n: 0 };
  const rows = [];
  const obstacles = [];
  const kinds = lv.obstacles;
  let reach = [...LANES];
  let prevEnd = 0;
  let z = WARMUP * v;
  const lastZ = length - FINISH_CLEAR * v;
  let rowN = 0;
  while (z < lastZ) {
    const gapT = Math.max(0.01, (z - prevEnd - PLANE.hz) / v);
    const moves = maxMoves(gapT, diff);
    let lanes = null;
    for (let tries = 0; tries < 40 && !lanes; tries++) {
      const two = rowN > 1 && random() < D.two;
      const n = two ? 2 : 1;
      const pool = [...LANES];
      const cand = {};
      for (let i = 0; i < n; i++) cand[pool.splice(Math.floor(random() * pool.length), 1)[0]] = weighted(kinds, random);
      const free = LANES.filter((l) => !cand[l]);
      if (noTrap(reach, free, moves)) lanes = cand;
    }
    if (!lanes) {
      // Fallback: one obstacle in a lane that keeps every reachable lane safe (or an empty row)
      lanes = {};
      for (const l of LANES) {
        const free = LANES.filter((f) => f !== l);
        if (noTrap(reach, free, moves)) {
          lanes = { [l]: kinds[0][0] };
          break;
        }
      }
    }
    const free = LANES.filter((l) => !lanes[l]);
    let half = 0.6;
    for (const [ls, kind] of Object.entries(lanes)) {
      const lane = Number(ls);
      half = Math.max(half, OBST[kind].hz);
      obstacles.push({ id: ++ids.n, kind, lane, x: lane * LANE_W, z, hw: OBST[kind].hw, hz: OBST[kind].hz, row: rowN, hit: false, gone: null, passed: false, seed: random() });
    }
    reach = expand(reach, moves).filter((l) => free.includes(l));
    rows.push({ z, lanes, free, moves, gapT, reach: [...reach], half });
    prevEnd = z + half;
    const breather = rowN > 0 && rowN % 7 === 6;
    const gap = breather ? D.gap[1] + 0.7 : D.gap[0] + random() * (D.gap[1] - D.gap[0]);
    z = prevEnd + gap * v;
    rowN++;
  }

  // Coins, star rings and power-ups in the gaps (warm-up stretch, between rows, after the last row)
  const coins = [];
  const rings = [];
  const pickups = [];
  const addCoin = (x, cz, y = 0) => coins.push({ id: ++ids.n, x, y, z: cz, x0: x, taken: false, mag: false });
  let nextPower = 9 * v;
  let nextRing = 6 * v;
  let boosts = 0;
  for (let i = 0; i <= rows.length; i++) {
    const prev = rows[i - 1];
    const next = rows[i];
    const start = (prev ? prev.z + prev.half : 0) + 2.4;
    const end = next ? next.z - next.half - 2.4 : lastZ;
    if (end - start < COIN_STEP * 2) continue;
    const from = prev ? prev.reach : [0];
    const to = next ? next.reach.filter((l) => next.free.includes(l)) : LANES;
    const shared = from.filter((l) => to.includes(l));
    const n = Math.min(14, Math.floor((end - start) / COIN_STEP) + 1);
    const pattern = random();
    let lane;
    let laneB;
    if (shared.length && (pattern < 0.55 || !next)) {
      lane = pick(shared, random);
      laneB = lane;
    } else {
      lane = pick(from, random);
      const opts = to.filter((l) => Math.abs(l - lane) <= Math.max(1, next ? next.moves : 2) && l !== lane);
      laneB = opts.length ? pick(opts, random) : pick(to.filter((l) => Math.abs(l - lane) <= (next ? next.moves : 2)), random) ?? lane;
    }
    // Line (gentle bob) or an S-curve arc across lanes from `lane` to `laneB`
    const arc = laneB !== lane;
    for (let k = 0; k < n; k++) {
      const t = n > 1 ? k / (n - 1) : 0;
      const cz = start + t * (end - start);
      const s = arc ? clamp((t - 0.15) / 0.6, 0, 1) : 0;
      const e = s * s * (3 - 2 * s);
      addCoin((lane + (laneB - lane) * e) * LANE_W, cz, arc ? Math.sin(e * Math.PI) * 1.1 : Math.sin(t * Math.PI) * 0.5);
    }
    const mid = (start + end) / 2;
    if (mid >= nextRing && end - start > 14) {
      // A golden star ring on the coin line (the coins around it move aside); on an arc it waits at the end
      const rz = arc ? end - 1 : mid;
      for (let k = coins.length - 1; k >= coins.length - n; k--) if (Math.abs(coins[k].z - rz) < 3.5) coins.splice(k, 1);
      rings.push({ id: ++ids.n, x: laneB * LANE_W, y: 0.3, z: rz, lane: laneB, taken: false });
      nextRing = mid + (9 + random() * 5) * v;
    } else if (mid >= nextPower && end - start > 12 && next) {
      let kind = weighted([['shield', 3], ['magnet', 3], ['boost', 2.5]], random);
      if (kind === 'boost' && boosts >= MAX_BOOSTS) kind = 'magnet';
      if (kind === 'boost') boosts++;
      // In a lane free in the next row, off the coin line
      const plane = pick(to, random);
      const pz = arc ? end - 1.5 : mid;
      for (let k = coins.length - 1; k >= coins.length - n && k >= 0; k--) if (Math.abs(coins[k].z - pz) < 3 && Math.abs(coins[k].x - plane * LANE_W) < 1.5) coins.splice(k, 1);
      pickups.push({ id: ++ids.n, kind, x: plane * LANE_W, y: 0.2, z: pz, lane: plane, taken: false });
      nextPower = mid + (10 + random() * 5) * v;
    }
  }
  return { rows, obstacles, coins, rings, pickups, length, speed: v };
}

// ---------------------------------------------------------------- flight state

export function createFlight({ level = 0, diff = 'easy', random = Math.random } = {}) {
  const g = generateLevel(level, diff, random);
  return {
    random,
    level,
    diff,
    phase: 'ready', // ready | fly | down | finish | done | over
    t: 0,
    d: 0,
    length: g.length,
    baseSpeed: g.speed,
    speed: g.speed,
    lane: 0,
    fromLane: 0,
    laneChangeT: -9,
    x: 0,
    vx: 0,
    bank: 0,
    yaw: 0,
    prop: 0, // propeller spin 0..1 (spins up in the countdown)
    hearts: HEARTS,
    coins: 0,
    coinsTotal: g.coins.length,
    rings: 0,
    ringsTotal: g.rings.length,
    combo: 0,
    bestCombo: 0,
    lastCoinT: -9,
    power: { shield: 0, magnet: 0, boost: 0 },
    invuln: 0,
    wobble: 0,
    hits: 0,
    nearMiss: 0,
    dodges: 0,
    continueUsed: false,
    pending: null,
    offerT: 0,
    downT: 0,
    finishT: 0,
    finished: false,
    stars: 0,
    rows: g.rows,
    obstacles: g.obstacles,
    coinList: g.coins,
    ringList: g.rings,
    pickups: g.pickups,
    events: [],
  };
}

const emit = (s, type, data = {}) => s.events.push({ type, ...data });

/** Countdown: the propeller spins up (call every frame while the 3-2-1 shows). */
export function spinUp(s, dt) {
  s.prop = Math.min(1, s.prop + dt / 2.1);
}

export function startFlight(s) {
  if (s.phase !== 'ready') return false;
  s.phase = 'fly';
  s.prop = 1;
  emit(s, 'go');
  return true;
}

/** 'left' | 'right'. Returns true when the plane starts changing lane. */
export function input(s, action) {
  if (s.phase !== 'fly') return false;
  if (action !== 'left' && action !== 'right') return false;
  const to = clamp(s.lane + (action === 'left' ? -1 : 1), -1, 1);
  if (to === s.lane) {
    emit(s, 'wall', { dir: action });
    return false;
  }
  s.fromLane = s.lane;
  s.lane = to;
  s.laneChangeT = s.t;
  emit(s, 'lane', { lane: to, dir: action });
  return true;
}

export const invincible = (s) => s.invuln > 0 || s.power.boost > 0;

/** Plane box overlaps obstacle o. */
export const overlaps = (s, o) => Math.abs(s.x - o.x) < o.hw + PLANE.hw && Math.abs(o.z - s.d) < o.hz + PLANE.hz;

/** Stars for a finished flight: 1, 2 with ≥ 2 hearts, 3 with ≥ 2 hearts and ≥ 70 % of the coins. */
export function starsFor(s) {
  if (!s.finished) return 0;
  if (s.hearts < 2) return 1;
  return s.coins >= Math.ceil(s.coinsTotal * 0.7) ? 3 : 2;
}

function hitPlane(s, o) {
  o.hit = true;
  s.hits++;
  s.hearts = Math.max(0, s.hearts - 1);
  s.invuln = 1.5;
  s.wobble = 1;
  s.combo = 0;
  emit(s, 'hit', { kind: o.kind, x: o.x, z: o.z, hearts: s.hearts });
  if (s.hearts <= 0) {
    s.phase = 'down';
    s.downT = 0;
    if (!s.continueUsed) {
      s.pending = 'offer';
      s.offerT = CONTINUE_TIME;
    } else s.pending = 'over';
    emit(s, 'down', { pending: s.pending });
  }
}

function over(s) {
  s.phase = 'over';
  s.pending = null;
  s.stars = 0;
  emit(s, 'over', { finished: false, coins: s.coins });
}

/** "Hồi sinh": once per level, 1 heart back, the sky just ahead is cleared. */
export function acceptContinue(s) {
  if (s.phase !== 'down' || s.pending !== 'offer') return false;
  s.continueUsed = true;
  s.pending = null;
  s.phase = 'fly';
  s.hearts = 1;
  s.invuln = 2.2;
  s.wobble = 0;
  for (const o of s.obstacles) if (!o.gone && !o.hit && o.z > s.d - 3 && o.z < s.d + s.baseSpeed * 2.2) o.gone = 'clear';
  emit(s, 'continue');
  return true;
}

export function declineContinue(s) {
  if (s.phase !== 'down' || s.pending !== 'offer') return false;
  s.pending = 'over';
  s.downT = Math.max(s.downT, 0.6);
  return true;
}

function collectPower(s, p) {
  p.taken = true;
  s.power[p.kind] = POWER[p.kind].time;
  if (p.kind === 'boost') s.wobble = 0;
  emit(s, 'power', { kind: p.kind, x: p.x, y: p.y, z: p.z });
}

/** Advance the flight by dt seconds. */
export function step(s, dt) {
  if (s.phase === 'ready' || s.phase === 'done' || s.phase === 'over') return s;
  if (s.phase === 'down') {
    // The plane glides on gently while the offer shows
    s.downT += dt;
    s.d += s.baseSpeed * 0.25 * dt;
    s.wobble = Math.max(0, s.wobble - dt);
    if (s.pending === 'offer') {
      s.offerT = Math.max(0, s.offerT - dt);
      if (s.offerT <= 0) {
        s.pending = 'over';
        s.downT = 0.6;
      }
    } else if (s.pending === 'over' && s.downT > 1.4) over(s);
    return s;
  }
  s.t += dt;
  const boosting = s.power.boost > 0;
  s.speed = s.baseSpeed * (boosting ? POWER.boost.mult : 1);
  s.d += s.speed * dt;

  // Lane spring (critically damped), bank into the turn and a little yaw
  const tx = s.lane * LANE_W;
  const c = 2 * Math.sqrt(LANE_K);
  const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
  for (let i = 0; i < sub; i++) {
    const h = dt / sub;
    s.vx += (LANE_K * (tx - s.x) - c * s.vx) * h;
    s.x += s.vx * h;
  }
  if (Math.abs(tx - s.x) < 0.005 && Math.abs(s.vx) < 0.02) {
    s.x = tx;
    s.vx = 0;
  }
  s.bank = clamp(-s.vx * 0.048, -0.75, 0.75);
  s.yaw = clamp(-s.vx * 0.018, -0.3, 0.3);
  s.invuln = Math.max(0, s.invuln - dt);
  s.wobble = Math.max(0, s.wobble - dt * 1.1);
  for (const k of Object.keys(s.power)) {
    if (s.power[k] > 0) {
      s.power[k] = Math.max(0, s.power[k] - dt);
      if (s.power[k] === 0) {
        emit(s, 'powerEnd', { kind: k });
        if (k === 'boost') s.invuln = Math.max(s.invuln, 1);
      }
    }
  }

  if (s.phase === 'finish') {
    s.finishT += dt;
    if (s.finishT >= FINISH_TIME) {
      s.phase = 'done';
      emit(s, 'done', { stars: s.stars });
    }
  }

  // Obstacles
  if (s.phase === 'fly') {
    for (const o of s.obstacles) {
      if (o.hit || o.gone) continue;
      if (o.z - s.d > 30) break; // sorted by z
      if (!overlaps(s, o)) continue;
      // Sliding into an obstacle that is already alongside: bounce back, no harm
      const sideways = s.fromLane !== s.lane && o.lane === s.lane && Math.abs(o.z - s.d) < o.hz + PLANE.hz - s.speed * dt * 2.5 && Math.abs(s.x - tx) > 0.6;
      if (sideways && !invincible(s)) {
        const dir = Math.sign(o.x - s.x) || 1;
        s.lane = s.fromLane;
        s.laneChangeT = -9;
        s.x = o.x - dir * (o.hw + PLANE.hw + 0.02);
        s.vx = -dir * 3;
        emit(s, 'bump', { kind: o.kind });
        continue;
      }
      if (s.power.boost > 0) {
        o.gone = 'smash';
        emit(s, 'smash', { kind: o.kind, x: o.x, z: o.z, id: o.id });
        continue;
      }
      if (s.invuln > 0) continue;
      if (s.power.shield > 0) {
        s.power.shield = 0;
        s.invuln = 1.2;
        o.gone = 'pop';
        emit(s, 'shieldBreak', { kind: o.kind, x: o.x, z: o.z, id: o.id });
        continue;
      }
      hitPlane(s, o);
      if (s.phase === 'down') return s;
    }
    // Passed rows: dodges and near misses
    for (const o of s.obstacles) {
      if (o.passed) continue;
      if (o.z + o.hz >= s.d - PLANE.hz) break;
      o.passed = true;
      if (o.hit || o.gone) continue;
      s.dodges++;
      if (o.lane !== s.lane && Math.abs(o.lane - s.lane) === 1 && o.lane === s.fromLane && s.t - s.laneChangeT < 0.9) {
        s.nearMiss++;
        s.fromLane = s.lane; // one near miss per lane change
        emit(s, 'nearMiss', { kind: o.kind });
      }
    }
  }

  // Coins (the magnet pulls them in from every lane)
  for (const c2 of s.coinList) {
    if (c2.taken) continue;
    const dz = c2.z - s.d;
    if (dz > MAGNET_RANGE + 5) break;
    if (dz < -4) continue;
    if (s.power.magnet > 0 && !c2.mag && dz < MAGNET_RANGE && dz > -1) c2.mag = true;
    if (c2.mag) {
      const k = Math.min(1, dt * 9);
      c2.x += (s.x - c2.x) * k;
      c2.y += (0 - c2.y) * k;
      c2.z += (s.d + 0.4 - c2.z) * Math.min(1, dt * 7);
    }
    if (Math.abs(c2.z - s.d) < 1.4 && Math.abs(c2.x - s.x) < 1.45) {
      c2.taken = true;
      s.combo = s.t - s.lastCoinT < COMBO_GAP ? s.combo + 1 : 1;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      s.lastCoinT = s.t;
      s.coins++;
      emit(s, 'coin', { x: c2.x, y: c2.y, z: c2.z, combo: s.combo, mag: c2.mag });
    }
  }
  if (s.t - s.lastCoinT > COMBO_GAP + 0.1) s.combo = 0;
  for (const r of s.ringList) {
    if (r.taken || Math.abs(r.z - s.d) > 1.6) continue;
    if (Math.abs(r.x - s.x) < 1.6) {
      r.taken = true;
      s.rings++;
      emit(s, 'ring', { x: r.x, y: r.y, z: r.z });
    }
  }
  for (const p of s.pickups) {
    if (p.taken || Math.abs(p.z - s.d) > 1.5) continue;
    if (Math.abs(p.x - s.x) < 1.5) collectPower(s, p);
  }

  // The finish gate
  if (s.phase === 'fly' && s.d >= s.length) {
    s.phase = 'finish';
    s.finished = true;
    s.finishT = 0;
    s.stars = starsFor(s);
    emit(s, 'finish', { stars: s.stars, hearts: s.hearts, coins: s.coins, coinsTotal: s.coinsTotal });
  }
  return s;
}

/** Fraction of the track flown (0..1). */
export const progressOf = (s) => clamp(s.d / s.length, 0, 1);

/** Plain copy for the HUD. */
export function snap(s) {
  return {
    phase: s.phase,
    level: s.level,
    diff: s.diff,
    progress: progressOf(s),
    dist: Math.floor(s.d),
    length: s.length,
    t: s.t,
    lane: s.lane,
    hearts: s.hearts,
    coins: s.coins,
    coinsTotal: s.coinsTotal,
    rings: s.rings,
    ringsTotal: s.ringsTotal,
    combo: s.combo,
    power: { ...s.power },
    pending: s.pending,
    offerT: s.offerT,
    continueUsed: s.continueUsed,
    finished: s.finished,
    stars: s.stars,
    hits: s.hits,
    nearMiss: s.nearMiss,
  };
}

// ---------------------------------------------------------------- bot (tests, autopilot)

const BOT_LANE_T = 0.2; // seconds the plane needs per lane (lane spring, with margin)

/** Times (s from now) a lane is unsafe: [[t0, t1], ...]. */
function laneDanger(s, lane, look) {
  const out = [];
  const v = Math.max(1, s.speed);
  for (const o of s.obstacles) {
    if (o.hit || o.gone || o.lane !== lane) continue;
    const t0 = (o.z - o.hz - PLANE.hz - s.d) / v;
    const t1 = (o.z + o.hz + PLANE.hz - s.d) / v;
    if (t1 < 0) continue;
    if (t0 > look) break;
    out.push([t0 - 0.06, t1 + 0.06]);
  }
  return out;
}
const clash = (spans, a, b) => spans.some(([t0, t1]) => t0 < b && t1 > a);

/**
 * A reacting bot: picks the lane with the most value it can reach without touching an obstacle
 * (coins, rings and power-ups count). Returns the target lane, or null to stay.
 */
export function botAction(s, { look = 2.4, greedy = true } = {}) {
  if (s.phase !== 'fly') return null;
  if (Math.abs(s.x - s.lane * LANE_W) > LANE_W * 0.3) return null;
  const v = Math.max(1, s.speed);
  const invul = invincible(s);
  const danger = Object.fromEntries(LANES.map((l) => [l, invul ? [] : laneDanger(s, l, look + 0.5)]));
  let best = s.lane;
  let bestScore = -Infinity;
  for (const target of LANES) {
    const steps = Math.abs(target - s.lane);
    const dir = Math.sign(target - s.lane);
    let ok = true;
    // leaving the current lane, crossing the middle lane, arriving
    if (steps > 0 && clash(danger[s.lane], 0, 0.08)) ok = false;
    for (let j = 1; j < steps && ok; j++) if (clash(danger[s.lane + dir * j], (j - 1) * BOT_LANE_T + 0.03, j * BOT_LANE_T + 0.12)) ok = false;
    if (ok && clash(danger[target], Math.max(0, (steps - 1) * BOT_LANE_T + 0.03), look)) ok = false;
    let score = ok ? 100 : -100;
    if (!ok) {
      const first = danger[target].length ? danger[target][0][0] : look;
      score += first * 10; // if nothing is safe, the latest danger
    }
    if (greedy) {
      for (const c of s.coinList) {
        if (c.taken) continue;
        const dz = c.z - s.d;
        if (dz > v * 1.6) break;
        if (dz > 1 && Math.abs(c.x0 - target * LANE_W) < 1.2) score += 1;
      }
      for (const r of s.ringList) if (!r.taken && r.lane === target && r.z - s.d > 1 && r.z - s.d < v * 1.8) score += 6;
      for (const p of s.pickups) if (!p.taken && p.lane === target && p.z - s.d > 1 && p.z - s.d < v * 1.8) score += 5;
    }
    score -= steps * 0.4;
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = target;
    }
  }
  return best === s.lane ? null : best;
}

/** Steer to a lane right away (one input per lane, like a quick double swipe). */
export function steerTo(s, lane) {
  while (lane != null && s.lane !== lane) if (!input(s, lane < s.lane ? 'left' : 'right')) break;
}

/** Run a whole level with a bot (tests / balance). Returns the summary. */
export function simulate(level, diff, random, { bot = 'react', dt = 1 / 60, every = 0.15, maxT = 200, continueOnDown = false } = {}) {
  const s = createFlight({ level, diff, random });
  startFlight(s);
  let next = 0;
  while (s.phase !== 'done' && s.phase !== 'over' && s.t < maxT) {
    if (bot === 'react' && s.t >= next) {
      next = s.t + every;
      steerTo(s, botAction(s));
    }
    step(s, dt);
    if (s.phase === 'down' && s.pending === 'offer') {
      if (continueOnDown) acceptContinue(s);
      else declineContinue(s);
    }
    s.events.length = 0;
  }
  return { finished: s.finished, stars: s.stars, hearts: s.hearts, coins: s.coins, coinsTotal: s.coinsTotal, rings: s.rings, hits: s.hits, t: s.t, d: s.d, length: s.length, rows: s.rows.length };
}
