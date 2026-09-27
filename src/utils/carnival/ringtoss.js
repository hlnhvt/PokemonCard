// "Ném vòng Pokéball" (ring toss): a 3x3 field of pegs, each with a little Pokemon doll on top.
// The child throws 8 rings at a point on the field (x across, z away); the ring flies in an arc
// with a little wobble and, if it lands close enough to a peg, drops over it. Back pegs are worth
// more. Pure rules and flight; `random` is injectable.
import { starsFor } from './tickets';

export const RINGS = 8;
export const ROWS_Z = [3, 2, 1]; // back, middle, front (distance from the child)
export const ROW_POINTS = [30, 20, 10];
export const COL_X = [-0.9, 0, 0.9];
export const PEG_H = 0.42; // height of a peg top
export const TOL_X = 0.27; // how close the ring centre must land to a peg (an ellipse)
export const TOL_Z = 0.32;
export const Z_MIN = 0.5;
export const Z_MAX = 3.8;
export const X_MAX = 1.6;
// A throw is never perfect
const WOBBLE_X = 0.44;
const WOBBLE_Z = 0.56;
// The doll Pokemon (dex numbers), back row first
export const DOLLS = [25, 133, 39, 1, 4, 7, 175, 35, 143];

export function createToss({ random = Math.random } = {}) {
  const pegs = [];
  ROWS_Z.forEach((z, row) =>
    COL_X.forEach((x, col) => pegs.push({ id: row * 3 + col, row, col, x, z, points: ROW_POINTS[row], dex: DOLLS[row * 3 + col], rings: 0, hop: 0 }))
  );
  return { random, pegs, ringsLeft: RINGS, thrown: 0, score: 0, hits: 0, streak: 0, best: 0, ring: null, rested: [], status: 'aim', time: 0, events: [] };
}

/** Power (0..1) of the swipe to the distance it throws. */
export const zForPower = (p) => Z_MIN + Math.max(0, Math.min(1, p)) * (Z_MAX - Z_MIN);
export const powerForZ = (z) => (z - Z_MIN) / (Z_MAX - Z_MIN);

/** The peg the ring centre (x, z) lands on, or null. */
export function pegAt(s, x, z) {
  let best = null;
  let bestD = 1;
  for (const p of s.pegs) {
    const d = ((x - p.x) / TOL_X) ** 2 + ((z - p.z) / TOL_Z) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Throw a ring at the field point (x, z). Returns false when a ring is still flying or none left. */
export function throwRing(s, { x, z }) {
  if (s.status !== 'aim' || s.ringsLeft <= 0) return false;
  const r = s.random;
  const tz = Math.max(Z_MIN, Math.min(Z_MAX, z));
  const tx = Math.max(-X_MAX, Math.min(X_MAX, x));
  const far = tz / Z_MAX; // longer throws wobble a bit more
  const lx = tx + (r() - 0.5) * WOBBLE_X * (0.6 + far * 0.6);
  const lz = tz + (r() - 0.5) * WOBBLE_Z * (0.6 + far * 0.6);
  s.ringsLeft -= 1;
  s.thrown += 1;
  s.status = 'fly';
  const dur = 0.62 + far * 0.3;
  s.ring = {
    id: s.thrown,
    phase: 'fly', // fly | drop | bounce
    t: 0,
    dur,
    from: { x: 0, z: 0.15, h: 0.55 },
    to: { x: lx, z: lz },
    top: 0.9 + far * 0.9, // arc height
    x: 0,
    z: 0.15,
    h: 0.55,
    spin: 0,
    tilt: 0,
    alpha: 1,
    peg: null,
  };
  s.events.push({ type: 'throw', x: lx, z: lz });
  return true;
}

function land(s, ring) {
  const peg = pegAt(s, ring.x, ring.z);
  if (peg) {
    ring.phase = 'drop';
    ring.t = 0;
    ring.peg = peg.id;
    ring.x = peg.x;
    ring.z = peg.z;
    s.streak += 1;
    s.best = Math.max(s.best, s.streak);
    s.hits += 1;
    // Three in a row and more: +5 each
    const points = peg.points + (s.streak >= 3 ? 5 : 0);
    s.score += points;
    peg.rings += 1;
    peg.hop = 0.6;
    s.events.push({ type: 'ringed', peg: peg.id, points, streak: s.streak, x: peg.x, z: peg.z });
    return;
  }
  // A miss: clank off the nearest peg if close, else bounce and roll away
  s.streak = 0;
  let near = null;
  let nd = 9;
  for (const p of s.pegs) {
    const d = Math.hypot(ring.x - p.x, ring.z - p.z);
    if (d < nd) {
      nd = d;
      near = p;
    }
  }
  const clank = near && nd < 0.7;
  ring.phase = 'bounce';
  ring.t = 0;
  if (clank) {
    const dx = (ring.x - near.x) / (nd || 1);
    const dz = (ring.z - near.z) / (nd || 1);
    ring.vx = dx * 1.3 + (s.random() - 0.5) * 0.4;
    ring.vz = dz * 1.1 + 0.2;
    ring.vh = 1.6;
    ring.h = PEG_H;
  } else {
    ring.vx = (ring.to.x - ring.from.x) * 0.25 + (s.random() - 0.5) * 0.5;
    ring.vz = 0.7;
    ring.vh = 1.2;
    ring.h = 0;
  }
  s.events.push({ type: clank ? 'clank' : 'miss', x: ring.x, z: ring.z, peg: clank ? near.id : null });
}

function settle(s) {
  const ring = s.ring;
  if (ring.phase === 'drop') s.rested.push({ id: ring.id, peg: ring.peg, x: ring.x, z: ring.z, level: s.pegs[ring.peg].rings - 1, spin: ring.spin });
  s.ring = null;
  if (s.ringsLeft <= 0) {
    s.status = 'done';
    s.events.push({ type: 'end' });
  } else {
    s.status = 'aim';
  }
}

export function stepToss(s, dt) {
  s.time += dt;
  for (const p of s.pegs) p.hop = Math.max(0, p.hop - dt);
  const ring = s.ring;
  if (!ring) return s;
  ring.t += dt;
  if (ring.phase === 'fly') {
    const k = Math.min(1, ring.t / ring.dur);
    ring.x = ring.from.x + (ring.to.x - ring.from.x) * k;
    ring.z = ring.from.z + (ring.to.z - ring.from.z) * k;
    // Arc from the hand down to the ground (peg tops are a little above it)
    ring.h = ring.from.h * (1 - k) + 4 * ring.top * k * (1 - k);
    ring.spin += dt * 14;
    ring.tilt = Math.sin(ring.t * 9) * 0.12;
    if (k >= 1) land(s, ring);
  } else if (ring.phase === 'drop') {
    // Slides down the peg and wobbles to rest
    const k = Math.min(1, ring.t / 0.35);
    const rest = 0.04 + (s.pegs[ring.peg].rings - 1) * 0.06;
    ring.h = PEG_H + (rest - PEG_H) * k * k;
    ring.tilt = Math.sin(ring.t * 26) * 0.35 * Math.exp(-ring.t * 5);
    ring.spin += dt * 4 * (1 - k);
    if (ring.t >= 0.9) settle(s);
  } else if (ring.phase === 'bounce') {
    ring.vh -= 7 * dt;
    ring.h += ring.vh * dt;
    if (ring.h < 0) {
      ring.h = 0;
      ring.vh = Math.abs(ring.vh) * 0.4;
      ring.vx *= 0.7;
      ring.vz *= 0.7;
    }
    ring.x += ring.vx * dt;
    ring.z += ring.vz * dt;
    ring.spin += dt * 8;
    ring.tilt = Math.sin(ring.t * 12) * 0.5;
    ring.alpha = Math.max(0, 1 - Math.max(0, ring.t - 0.7) / 0.4);
    if (ring.t >= 1.1) settle(s);
  }
  return s;
}

export const tossStars = (s) => starsFor(s.score, 100, 190);
