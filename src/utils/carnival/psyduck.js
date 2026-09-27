// "Bắn vịt Psyduck" (shooting gallery): 3 rows of Psyduck targets glide along rails (rows go
// opposite ways, at different speeds). Tap to shoot a water ball; a hit flips the duck down.
// Golden Psyduck (+30) and small fast ones (+20) are special; a Pikachu balloon must NOT be hit.
// 40 seconds, faster and faster; hits in a row build a combo, a shot that hits nothing breaks it.
// Pure rules in the canvas' own coordinates (360 x 560); `random` is injectable.
import { starsFor } from './tickets';

export const W = 360;
export const H = 560;
export const DURATION = 40;
export const RAILS = [180, 300, 420]; // y of each rail (back to front)
export const SCALE = [0.78, 0.9, 1]; // back rows look smaller
export const NOZZLE = { x: 180, y: 540 };
export const POINTS = { duck: 10, small: 20, gold: 30, pikachu: -20 };
const BASE_SPEED = [62, 84, 72];
const SHOT_SPEED = 1500; // px per second
const MARGIN = 50;

/** Size (hit radius) and centre height above the rail of each kind. */
export const LOOK = {
  duck: { r: 30, lift: 42 },
  small: { r: 21, lift: 34 },
  gold: { r: 30, lift: 42 },
  pikachu: { r: 27, lift: 62 },
};

const pace = (s) => Math.min(1, s.time / DURATION);
export const timeLeft = (s) => Math.max(0, DURATION - s.time);

export function createGallery({ random = Math.random } = {}) {
  const s = {
    random,
    time: 0,
    status: 'play',
    targets: [],
    shots: [],
    rows: RAILS.map((y, i) => ({ y, dir: i % 2 ? -1 : 1, next: 0.2 + i * 0.35 })),
    nextId: 1,
    score: 0,
    combo: 0,
    best: 0,
    hits: 0,
    misses: 0,
    oops: 0,
    events: [],
  };
  // Start with a few targets already on the rails
  s.rows.forEach((row, i) => {
    for (let k = 0; k < 2; k++) spawn(s, i, 70 + k * 170 + random() * 40);
  });
  return s;
}

function pickKind(s) {
  const roll = s.random();
  const p = pace(s);
  if (roll < 0.08 + p * 0.03) return 'gold';
  if (roll < 0.22 + p * 0.04) return 'small';
  if (roll < 0.4 + p * 0.04) return 'pikachu';
  return 'duck';
}

function spawn(s, rowIndex, atX) {
  const row = s.rows[rowIndex];
  const kind = pickKind(s);
  const speedUp = kind === 'gold' ? 1.55 : kind === 'small' ? 1.35 : 1;
  const x = atX != null ? (row.dir > 0 ? atX : W - atX) : row.dir > 0 ? -MARGIN : W + MARGIN;
  s.targets.push({ id: s.nextId++, row: rowIndex, kind, x, y: row.y, speedUp, down: 0, hit: false, bob: s.random() * 6 });
}

export const speedOf = (s, t) => BASE_SPEED[t.row] * (1 + pace(s) * 0.75) * t.speedUp;

/** Where a target's round face is (for aiming and drawing). */
export function centreOf(t) {
  const look = LOOK[t.kind];
  const sc = SCALE[t.row];
  return { x: t.x, y: t.y - look.lift * sc, r: look.r * sc };
}

/** The standing target under a point (front rows first), or null. */
export function targetAt(s, x, y, slack = 8) {
  let best = null;
  for (const t of s.targets) {
    if (t.hit) continue;
    const c = centreOf(t);
    if (Math.hypot(x - c.x, y - c.y) > c.r + slack) continue;
    if (!best || t.row > best.row) best = t;
  }
  return best;
}

/** Shoot a water ball at (x, y). It flies from the nozzle; the target under the point is hit when it arrives. */
export function shoot(s, x, y) {
  if (s.status !== 'play') return null;
  const target = targetAt(s, x, y);
  const dist = Math.hypot(x - NOZZLE.x, y - NOZZLE.y);
  const shot = { id: s.nextId++, x0: NOZZLE.x, y0: NOZZLE.y, tx: x, ty: y, x: NOZZLE.x, y: NOZZLE.y, t: 0, dur: Math.max(0.08, dist / SHOT_SPEED), target: target ? target.id : null, dx: target ? x - target.x : 0, dy: target ? y - target.y : 0 };
  if (target) target.claimed = true;
  s.shots.push(shot);
  s.events.push({ type: 'shot', x, y });
  return shot;
}

function resolve(s, shot) {
  const t = shot.target != null ? s.targets.find((q) => q.id === shot.target) : null;
  if (t && t.hit) {
    // A second ball on a duck already down: just a splash, no harm done
    s.events.push({ type: 'splash', x: shot.x, y: shot.y });
    return;
  }
  if (!t) {
    s.combo = 0;
    s.misses += 1;
    s.events.push({ type: 'miss', x: shot.x, y: shot.y });
    return;
  }
  t.hit = true;
  const c = centreOf(t);
  if (t.kind === 'pikachu') {
    s.score = Math.max(0, s.score + POINTS.pikachu);
    s.combo = 0;
    s.oops += 1;
    s.events.push({ type: 'pikachu', x: c.x, y: c.y, points: POINTS.pikachu });
    return;
  }
  s.combo += 1;
  s.best = Math.max(s.best, s.combo);
  s.hits += 1;
  // Every 5 in a row adds 5 more per hit (up to +10)
  const points = POINTS[t.kind] + Math.min(10, Math.floor(s.combo / 5) * 5);
  s.score += points;
  s.events.push({ type: 'hit', kind: t.kind, x: c.x, y: c.y, points, combo: s.combo });
}

export function stepGallery(s, dt) {
  if (s.status !== 'play') return s;
  s.time += dt;
  // Rails
  for (const t of s.targets) {
    t.x += speedOf(s, t) * s.rows[t.row].dir * dt;
    t.bob += dt;
    if (t.hit) t.down = Math.min(1, t.down + dt * 4.5);
  }
  s.targets = s.targets.filter((t) => t.x > -MARGIN - 10 && t.x < W + MARGIN + 10);
  s.rows.forEach((row, i) => {
    row.next -= dt;
    if (row.next <= 0) {
      spawn(s, i);
      // Space between two targets (px), shrinking a little as it speeds up
      const gap = (150 + s.random() * 110) * (1 - pace(s) * 0.25);
      row.next = gap / (BASE_SPEED[i] * (1 + pace(s) * 0.75));
    }
  });
  // Water balls
  for (const shot of s.shots) {
    shot.t += dt;
    const target = shot.target != null ? s.targets.find((q) => q.id === shot.target) : null;
    // The ball follows its target a little, so a good shot always lands
    if (target && !target.hit) {
      shot.tx = target.x + shot.dx;
      shot.ty = target.y + shot.dy;
    }
    const k = Math.min(1, shot.t / shot.dur);
    shot.x = shot.x0 + (shot.tx - shot.x0) * k;
    shot.y = shot.y0 + (shot.ty - shot.y0) * k;
    if (k >= 1) {
      shot.done = true;
      resolve(s, shot);
    }
  }
  s.shots = s.shots.filter((q) => !q.done);
  if (s.time >= DURATION) {
    s.status = 'done';
    s.shots = [];
    s.events.push({ type: 'end' });
  }
  return s;
}

export const galleryStars = (s) => starsFor(s.score, 400, 800);
