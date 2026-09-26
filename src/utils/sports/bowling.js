// Pokemon bowling: a small 2D physics simulation of one roll, plus the match rules.
// Lane coordinates: x across (-1..1 inside the gutters), y along the lane (0 = foul line).
import { clamp, jitter } from './common';

export const LANE_HALF = 1;
export const LANE_END = 11;
export const HEAD_PIN_Y = 8.5;
export const PIN_R = 0.13;
export const BALL_R = 0.24;
export const FRAMES = 5;
// Kid-friendly bonuses instead of the real strike/spare scoring
export const STRIKE_BONUS = 5;
export const SPARE_BONUS = 3;
// Tuning (measured in tests/sports.test.js): a good centre roll often strikes, off-centre rolls leave pins
const PIN_KICK = 0.55;
const CHAIN_MIN_SPEED = 1.4;
const CHAIN_TRANSFER = 0.5;
const PIN_FRICTION = 0.08;
// The computer's aim spread: about as good as a child tapping at a random moment
export const AI_AIM_SPREAD = 1.1;
export const AIM_TO_LANE = 0.72;

/** 10 pins in the classic triangle, head pin nearest the bowler. */
export function pinLayout() {
  const pins = [];
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) {
      pins.push({ id: pins.length, x: (i - row / 2) * 0.46, y: HEAD_PIN_Y + row * 0.46, vx: 0, vy: 0, down: false, angle: 0, spin: 0 });
    }
  }
  return pins;
}

/**
 * Start a roll. aim: -1..1 (where the ball heads at the pins), power: 0..1.
 * standing: ids of the pins still up (second roll of a frame).
 */
export function createRoll({ aim, power, standing = null, random = Math.random }) {
  const pins = pinLayout().filter((p) => !standing || standing.includes(p.id));
  // Power matters, but even a weak roll reaches the pins with some force (children)
  const speed = 7 + clamp(power, 0, 1) * 4;
  // The aim arrow covers the pins generously, so even the edges of its swing hit something
  const targetX = clamp(aim, -1.5, 1.5) * AIM_TO_LANE;
  const angle = Math.atan2(targetX, HEAD_PIN_Y);
  return {
    ball: { x: 0, y: 0, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed, spin: 0, gutter: false },
    pins,
    time: 0,
    done: false,
    hits: 0,
    random,
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Advance the roll by dt seconds (call with small steps, e.g. 1/120). */
export function stepRoll(state, dt) {
  if (state.done) return state;
  const { ball, pins, random } = state;
  state.time += dt;

  // Ball
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.spin += Math.hypot(ball.vx, ball.vy) * dt * 3;
  if (!ball.gutter && Math.abs(ball.x) > LANE_HALF + 0.05 && ball.y < HEAD_PIN_Y - 0.5) {
    // Into the gutter: slides along it and misses every pin
    ball.gutter = true;
    ball.x = Math.sign(ball.x) * (LANE_HALF + 0.18);
    ball.vx = 0;
  }

  // Ball hits pins
  if (!ball.gutter) {
    for (const p of pins) {
      if (p.down && Math.hypot(p.vx, p.vy) < 0.01) continue;
      if (dist(ball, p) < BALL_R + PIN_R) {
        const nx = (p.x - ball.x) / (dist(ball, p) || 1);
        const ny = (p.y - ball.y) / (dist(ball, p) || 1);
        const speed = Math.hypot(ball.vx, ball.vy);
        if (!p.down) state.hits += 1;
        p.down = true;
        p.vx = nx * speed * PIN_KICK + ball.vx * 0.15 + jitter(random, 0.9);
        p.vy = ny * speed * PIN_KICK + ball.vy * 0.15;
        p.spin = jitter(random, 14);
        // Push the pin out so it does not stay inside the ball
        p.x = ball.x + nx * (BALL_R + PIN_R + 0.01);
        p.y = ball.y + ny * (BALL_R + PIN_R + 0.01);
        ball.vx *= 0.96;
        ball.vy *= 0.96;
      }
    }
  }

  // Flying pins knock others over (chain reaction)
  for (const p of pins) {
    if (!p.down) continue;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > CHAIN_MIN_SPEED) {
      for (const q of pins) {
        if (q === p || q.down) continue;
        if (dist(p, q) < PIN_R * 2) {
          const nx = (q.x - p.x) / (dist(p, q) || 1);
          const ny = (q.y - p.y) / (dist(p, q) || 1);
          q.down = true;
          q.vx = nx * speed * CHAIN_TRANSFER + p.vx * 0.15 + jitter(random, 0.7);
          q.vy = ny * speed * CHAIN_TRANSFER + p.vy * 0.15;
          q.spin = jitter(random, 12);
          p.vx *= 0.5;
          p.vy *= 0.5;
        }
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.spin * dt;
    const friction = Math.pow(PIN_FRICTION, dt);
    p.vx *= friction;
    p.vy *= friction;
    p.spin *= friction;
  }

  const pinsMoving = pins.some((p) => p.down && Math.hypot(p.vx, p.vy) > 0.05);
  if ((ball.y > LANE_END && !pinsMoving) || state.time > 6) state.done = true;
  return state;
}

/** Run a whole roll instantly (AI previews, tests). Returns the finished state. */
export function simulateRoll(options) {
  const s = createRoll(options);
  for (let i = 0; i < 6 * 120 && !s.done; i++) stepRoll(s, 1 / 120);
  return s;
}

export const knockedIds = (state) => state.pins.filter((p) => p.down).map((p) => p.id);
export const standingIds = (state) => state.pins.filter((p) => !p.down).map((p) => p.id);

/** Opponent's aim and power: usually near the middle, sometimes off. */
export function aiThrow(random) {
  // Uniform like a child tapping at a random moment, so a child who times the arrow wins more
  return { aim: (random() * 2 - 1) * AI_AIM_SPREAD, power: 0.2 + random() * 0.6 };
}

/**
 * Score of one frame from the pins knocked by each roll (first, second).
 * Returns { pins, bonus, total, mark: 'strike' | 'spare' | null }.
 */
export function frameScore(first, second = 0) {
  if (first >= 10) return { pins: 10, bonus: STRIKE_BONUS, total: 10 + STRIKE_BONUS, mark: 'strike' };
  if (first + second >= 10) return { pins: 10, bonus: SPARE_BONUS, total: 10 + SPARE_BONUS, mark: 'spare' };
  return { pins: first + second, bonus: 0, total: first + second, mark: null };
}
