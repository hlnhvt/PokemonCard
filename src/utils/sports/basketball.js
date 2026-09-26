// Basketball shooting: projectile physics with rim and backboard bounces.
// World units: x right (0..10), y up (0 = floor). The child's ball starts low on the left.
import { clamp } from './common';

export const G = 9.8;
export const START = { x: 1.8, y: 1.6 };
export const HOOP = { x: 7.6, y: 4.2, r: 0.7 };
export const BALL_R = 0.22;
export const RIM_R = 0.06;
export const BOARD = { x: 8.45, bottom: 3.9, top: 5.7 };
export const SHOTS = 5;
export const POINTS = 2;
export const MAX_SPEED = 12;
// How much of the flight the dotted aiming guide shows (a hint, not the whole answer)
export const GUIDE_TIME = 0.5;

/** Launch from a slingshot drag (dx, dy in world units, pulled back from the ball). */
export function launchFromDrag(dx, dy, strength = 3.2) {
  let vx = -dx * strength;
  let vy = -dy * strength;
  const speed = Math.hypot(vx, vy);
  if (speed > MAX_SPEED) {
    vx *= MAX_SPEED / speed;
    vy *= MAX_SPEED / speed;
  }
  return { vx, vy };
}

export function createShot({ vx, vy }) {
  return {
    ball: { x: START.x, y: START.y, vx, vy, spin: 0 },
    time: 0,
    made: false,
    rimTouched: false,
    boardTouched: false,
    done: false,
    events: [],
  };
}

function bounceOff(ball, px, py, restitution) {
  const dx = ball.x - px;
  const dy = ball.y - py;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot >= 0) return false; // already moving away
  ball.vx = (ball.vx - 2 * dot * nx) * restitution;
  ball.vy = (ball.vy - 2 * dot * ny) * restitution;
  ball.x = px + nx * (BALL_R + RIM_R + 0.001);
  ball.y = py + ny * (BALL_R + RIM_R + 0.001);
  return true;
}

export function stepShot(s, dt) {
  if (s.done) return s;
  const b = s.ball;
  const prevY = b.y;
  s.time += dt;
  b.vy -= G * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.spin += b.vx * dt * 2;

  // Rim edges (front and back)
  for (const px of [HOOP.x - HOOP.r, HOOP.x + HOOP.r]) {
    if (Math.hypot(b.x - px, b.y - HOOP.y) < BALL_R + RIM_R && bounceOff(b, px, HOOP.y, 0.55)) {
      s.rimTouched = true;
      s.events.push('rim');
    }
  }

  // Backboard
  if (b.x + BALL_R > BOARD.x && b.x < BOARD.x + 0.3 && b.y > BOARD.bottom && b.y < BOARD.top && b.vx > 0) {
    b.vx = -Math.abs(b.vx) * 0.6;
    b.x = BOARD.x - BALL_R;
    s.boardTouched = true;
    s.events.push('board');
  }

  // Through the hoop from above
  if (!s.made && prevY >= HOOP.y && b.y < HOOP.y && b.vy < 0 && Math.abs(b.x - HOOP.x) < HOOP.r - BALL_R * 0.4) {
    s.made = true;
    s.events.push(s.rimTouched || s.boardTouched ? 'score' : 'swish');
  }

  // Floor
  if (b.y < BALL_R) {
    b.y = BALL_R;
    b.vy = Math.abs(b.vy) * 0.5;
    b.vx *= 0.7;
    if (Math.abs(b.vy) < 1) s.done = true;
  }
  if (b.x > 11 || b.x < -1 || s.time > 5) s.done = true;
  return s;
}

export function simulateShot(v) {
  const s = createShot(v);
  for (let i = 0; i < 5 * 240 && !s.done; i++) stepShot(s, 1 / 240);
  return s;
}

/** Points of the aiming guide for a launch. */
export function guidePoints(v, count = 9) {
  const points = [];
  for (let i = 1; i <= count; i++) {
    const t = (GUIDE_TIME * i) / count;
    points.push({ x: START.x + v.vx * t, y: START.y + v.vy * t - 0.5 * G * t * t });
  }
  return points;
}

/** Launch velocity that drops the ball through the hoop centre at a given angle (degrees). */
export function perfectLaunch(angleDeg = 55) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = HOOP.x - START.x;
  const dy = HOOP.y + 0.05 - START.y;
  const denom = 2 * Math.cos(a) ** 2 * (dx * Math.tan(a) - dy);
  const speed = Math.sqrt((G * dx * dx) / denom);
  return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
}

export const AI_ACCURACY = 0.4;

/** The computer's shot: a perfect launch, or one a little too short/long. */
export function aiLaunch(random = Math.random) {
  const v = perfectLaunch(54 + random() * 10);
  if (random() < AI_ACCURACY) return v;
  // Short misses drop in front of the rim; long ones sail over the board (small long errors bank in)
  const error = random() < 0.5 ? -(0.08 + random() * 0.1) : 0.32 + random() * 0.1;
  return { vx: v.vx * (1 + error), vy: v.vy * (1 + error * 0.6) };
}

export const clampDrag = (dx, dy) => ({ dx: clamp(dx, -4, 0.5), dy: clamp(dy, -4, 0.5) });
