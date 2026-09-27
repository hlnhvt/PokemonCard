// "Lăn bóng Skee-ball": swipe up to roll a Pokeball up a lane; it jumps a little ramp onto a
// target board and drops into a ring or hole: rings 10 / 20 / 30, a 50 hole at the top and two
// small 100 holes in the top corners. Outside the rings it falls in the gutter (0); too soft and it
// never clears the ramp (0); too hard and it bounces off the back net into the 10 ring.
// 9 balls; 50+ holes in a row give a bonus. The swipe's direction is the angle, its speed the power.
// Lane: x -1..1 across, z 0..RAMP_Z up. Board: x -1..1, y 0..BOARD_TOP up. Pure rules; `random` injectable.
import { starsFor } from './tickets';

export const BALLS = 9;
export const RAMP_Z = 5;
export const BOARD_TOP = 1.18;
export const P_RAMP = 0.22; // power needed to clear the ramp
export const REACH = 1.3; // board depth reached at full power
export const LATERAL = 0.5; // how much the angle moves the ball sideways
export const BOARD_K = 1.6; // board depth, in lane units, for the sideways drift
export const MAX_ANGLE = 0.5;
export const RING_CENTER = { x: 0, y: 0.42 };
export const RINGS = [
  { points: 30, r: 0.25 },
  { points: 20, r: 0.44 },
  { points: 10, r: 0.64 },
];
export const HOLES = [
  { id: 'h100L', points: 100, x: -0.74, y: 1.02, r: 0.1 },
  { id: 'h100R', points: 100, x: 0.74, y: 1.02, r: 0.1 },
  { id: 'h50', points: 50, x: 0, y: 0.95, r: 0.12 },
];
export const STREAK_BONUS = 20;
// Nobody rolls exactly the same twice
const NOISE_P = 0.025;
const NOISE_A = 0.012;
// Swipe speed (logical px/s) for no power and full power
export const SPEED_MIN = 250;
export const SPEED_FULL = 2400;
export const SWIPE_MIN = 30;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Bounce between the side walls (-1..1). */
export function reflect(v) {
  let m = (((v + 1) % 4) + 4) % 4; // 0..4
  if (m > 2) m = 4 - m;
  return m - 1;
}

export function createSkee({ random = Math.random } = {}) {
  return { random, time: 0, ballsLeft: BALLS, rolled: 0, score: 0, streak: 0, best: 0, bonus: 0, big: 0, ball: null, wait: 0, status: 'aim', history: [], events: [] };
}

/** Swipe (logical px, y down) over `dur` seconds to { angle, power }, or null when too small. */
export function rollFromSwipe(dx, dy, dur) {
  if (-dy < SWIPE_MIN) return null;
  const len = Math.hypot(dx, dy);
  const speed = len / Math.max(0.05, dur);
  return { angle: clamp(Math.atan2(dx, -dy), -MAX_ANGLE, MAX_ANGLE), power: clamp((speed - SPEED_MIN) / (SPEED_FULL - SPEED_MIN), 0.05, 1) };
}

/** Where a roll with this angle and power lands on the board (no noise), or null (too soft). */
export function landingFor(angle, power) {
  if (power < P_RAMP) return null;
  const raw = ((power - P_RAMP) / (1 - P_RAMP)) * REACH;
  const y = Math.min(raw, BOARD_TOP);
  const x = reflect(Math.tan(angle) * LATERAL * (RAMP_Z + y * BOARD_K));
  return { x, y, over: raw > BOARD_TOP };
}

/** The hole or ring a point on the board drops into: { id, points } (gutter: 0). */
export function holeAt(x, y) {
  for (const h of HOLES) if (Math.hypot(x - h.x, y - h.y) < h.r) return { id: h.id, points: h.points, x: h.x, y: h.y };
  const d = Math.hypot(x - RING_CENTER.x, y - RING_CENTER.y);
  for (const ring of RINGS) if (d < ring.r) return { id: `r${ring.points}`, points: ring.points, x, y };
  return { id: 'gutter', points: 0, x, y };
}

/** Angle and power that aim at a board point (for bots and the keyboard helper). */
export function aimFor(x, y) {
  const power = P_RAMP + (y / REACH) * (1 - P_RAMP);
  const angle = Math.atan(x / (LATERAL * (RAMP_Z + y * BOARD_K)));
  return { angle, power };
}

/** Roll the ball. Returns false when a ball is rolling or none are left. */
export function rollBall(s, { angle, power }) {
  if (s.status !== 'aim' || s.ballsLeft <= 0) return false;
  const r = s.random;
  const p = clamp(power + (r() - 0.5) * 2 * NOISE_P, 0.02, 1.05);
  const a = clamp(angle, -MAX_ANGLE, MAX_ANGLE) + (r() - 0.5) * 2 * NOISE_A;
  s.ballsLeft -= 1;
  s.rolled += 1;
  s.status = 'roll';
  const land = landingFor(a, p);
  const ball = { id: s.rolled, phase: 'roll', t: 0, angle: a, power: p, x: 0, z: 0, bx: 0, by: 0, h: 0, spin: 0, scale: 1, rollTime: 1.05 - Math.min(1, p) * 0.4 };
  if (!land) {
    ball.phase = 'weak';
    ball.zMax = RAMP_Z * (0.35 + (0.55 * p) / P_RAMP);
    ball.rollTime = 1.7;
  } else {
    // A too-hard roll bonks the back net and drops into the bottom ring
    const drop = land.over ? { x: clamp(land.x * 0.3 + (r() - 0.5) * 0.2, -0.2, 0.2), y: -0.16 + r() * 0.05 } : { x: clamp(land.x + (r() - 0.5) * 0.04, -1, 1), y: land.y };
    ball.land = { x: land.x, y: land.y };
    ball.over = land.over;
    ball.drop = drop;
    ball.hole = holeAt(drop.x, drop.y);
    ball.rampX = reflect(Math.tan(a) * LATERAL * RAMP_Z);
  }
  s.ball = ball;
  s.events.push({ type: 'roll', power: p, angle: a });
  return true;
}

const JUMP_TIME = 0.5;
const BONK_TIME = 0.45;
const DROP_TIME = 0.55;
const GUTTER_TIME = 0.7;

function score(s, b) {
  const h = b.hole;
  let bonus = 0;
  if (h.points >= 50) {
    s.streak += 1;
    s.big += 1;
    if (s.streak >= 2) bonus = STREAK_BONUS * Math.min(3, s.streak - 1);
  } else s.streak = 0;
  s.best = Math.max(s.best, s.streak);
  s.bonus += bonus;
  s.score += h.points + bonus;
  s.history.push(h.points);
  s.events.push({ type: 'score', points: h.points, bonus, hole: h.id, streak: s.streak, x: b.bx, y: b.by });
}

function settle(s) {
  s.ball = null;
  s.status = 'wait';
  s.wait = 0.45;
}

export function stepSkee(s, dt) {
  if (s.status === 'done') return s;
  s.time += dt;
  const b = s.ball;
  if (s.status === 'wait') {
    s.wait -= dt;
    if (s.wait <= 0) {
      if (s.ballsLeft <= 0) {
        s.status = 'done';
        s.events.push({ type: 'end' });
      } else s.status = 'aim';
    }
    return s;
  }
  if (!b) return s;
  b.t += dt;
  b.spin += dt * (4 + b.power * 16);
  if (b.phase === 'weak') {
    // Up part of the way, then back down to the child
    const k = Math.min(1, b.t / b.rollTime);
    const up = k < 0.55 ? 1 - (1 - k / 0.55) ** 2 : 1 - ((k - 0.55) / 0.45) ** 2;
    b.z = b.zMax * up;
    b.x = reflect(Math.tan(b.angle) * LATERAL * b.z);
    if (k >= 1) {
      s.streak = 0;
      s.history.push(0);
      s.events.push({ type: 'weak' });
      settle(s);
    }
  } else if (b.phase === 'roll') {
    const k = Math.min(1, b.t / b.rollTime);
    // Slows a little as it climbs
    b.z = RAMP_Z * (k * (1.25 - 0.25 * k));
    b.x = reflect(Math.tan(b.angle) * LATERAL * b.z);
    if (k >= 1) {
      b.phase = 'jump';
      b.t = 0;
      s.events.push({ type: 'ramp', x: b.rampX });
    }
  } else if (b.phase === 'jump') {
    const k = Math.min(1, b.t / JUMP_TIME);
    b.bx = b.rampX + (b.land.x - b.rampX) * k;
    b.by = -0.08 + (b.land.y + 0.08) * k;
    b.h = Math.sin(k * Math.PI) * (0.16 + b.land.y * 0.18);
    if (k >= 1) {
      b.t = 0;
      b.h = 0;
      if (b.over) {
        b.phase = 'bonk';
        s.events.push({ type: 'bonk', x: b.bx, y: b.by });
      } else {
        b.phase = b.hole.points > 0 ? 'drop' : 'gutter';
        s.events.push({ type: 'land', x: b.bx, y: b.by });
        if (b.hole.points > 0) score(s, b);
      }
    }
  } else if (b.phase === 'bonk') {
    const k = Math.min(1, b.t / BONK_TIME);
    b.bx = b.land.x + (b.drop.x - b.land.x) * k;
    b.by = b.land.y + (b.drop.y - b.land.y) * k;
    b.h = Math.sin(k * Math.PI) * 0.12;
    if (k >= 1) {
      b.phase = 'drop';
      b.t = 0;
      score(s, b);
    }
  } else if (b.phase === 'drop') {
    // Rolls to the hole and falls in
    const k = Math.min(1, b.t / DROP_TIME);
    const h = b.hole;
    b.bx += (h.x - b.bx) * Math.min(1, dt * 12);
    b.by += (h.y - b.by) * Math.min(1, dt * 12);
    b.scale = 1 - Math.max(0, (k - 0.3) / 0.7) ** 1.5;
    if (k >= 1) settle(s);
  } else if (b.phase === 'gutter') {
    // Rolls down the board into the gutter
    const k = Math.min(1, b.t / GUTTER_TIME);
    b.by = b.drop.y * (1 - k * k) - 0.12 * k;
    b.bx = b.drop.x + Math.sign(b.drop.x || 1) * 0.1 * k;
    if (k >= 1) {
      s.streak = 0;
      s.history.push(0);
      s.events.push({ type: 'gutter' });
      settle(s);
    }
  }
  return s;
}

export const SKEE_TWO = 170;
export const SKEE_THREE = 300;
export const skeeStars = (s) => starsFor(s.score, SKEE_TWO, SKEE_THREE);
