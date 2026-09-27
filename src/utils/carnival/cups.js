// "Đoán cốc" (shell game): a Pokeball is hidden under one cup, the cups swap places along
// arcs (one over, one under), then the child taps the cup with the ball. 6 rounds, more and
// faster swaps each round, a 4th cup from round 4. Pure rules; `random` is injectable.
import { starsFor } from './tickets';

export const ROUNDS = [
  { cups: 3, swaps: 3, speed: 0.95 }, // seconds per swap
  { cups: 3, swaps: 4, speed: 0.8 },
  { cups: 3, swaps: 6, speed: 0.65 },
  { cups: 4, swaps: 6, speed: 0.58 },
  { cups: 4, swaps: 8, speed: 0.48 },
  { cups: 4, swaps: 9, speed: 0.4 },
];
export const SHOW_TIME = 1.4; // ball visible, its cup up
export const COVER_TIME = 0.55; // the cup comes down over it
export const WAIT_TIME = 0.45;
export const REVEAL_TIME = 2.1;
export const LIFT_TIME = 0.3;
export const BASE_POINTS = 10;
export const STREAK_BONUS = 5; // per correct round in a row before this one
export const MAX_BONUS = 20;

/**
 * Swaps for one round, as pairs of slots [a, b]. About 6 in 10 involve the ball's slot so
 * there is something to follow; never the same pair twice in a row.
 */
export function makeSwaps(n, count, ballSlot, random = Math.random) {
  const swaps = [];
  let slot = ballSlot;
  let last = '';
  for (let i = 0; i < count; i++) {
    let a;
    let b;
    for (let tries = 0; tries < 6; tries++) {
      a = random() < 0.6 ? slot : Math.floor(random() * n);
      b = Math.floor(random() * (n - 1));
      if (b >= a) b += 1;
      if ([a, b].sort().join() !== last) break;
    }
    last = [a, b].sort().join();
    swaps.push([a, b]);
    if (slot === a) slot = b;
    else if (slot === b) slot = a;
  }
  return swaps;
}

/** Swap two slots of an order (slot -> cup id), returning a new order. */
export function applySwap(order, [a, b]) {
  const next = [...order];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** Where the ball ends up (a slot) when it starts in `slot` and the cups swap. */
export function trackBall(slot, swaps) {
  return swaps.reduce((at, [a, b]) => (at === a ? b : at === b ? a : at), slot);
}

function startRound(s, index) {
  const cfg = ROUNDS[index];
  s.round = index;
  // A new cup joins at the right end
  while (s.order.length < cfg.cups) s.order.push(s.order.length);
  s.n = cfg.cups;
  s.ball = Math.floor(s.random() * s.n);
  s.swaps = makeSwaps(s.n, cfg.swaps, s.order.indexOf(s.ball), s.random);
  s.swapIndex = 0;
  s.speed = cfg.speed;
  s.phase = 'show';
  s.t = 0;
  s.picked = null;
  s.last = null;
  s.events.push({ type: 'round', round: index, cups: s.n, added: index > 0 && cfg.cups > ROUNDS[index - 1].cups });
}

export function createCups({ random = Math.random } = {}) {
  const s = { random, order: [], n: 0, round: 0, ball: 0, swaps: [], swapIndex: 0, speed: 1, phase: 'show', t: 0, score: 0, streak: 0, best: 0, correct: 0, picked: null, last: null, status: 'play', events: [] };
  startRound(s, 0);
  return s;
}

export const ballSlot = (s) => s.order.indexOf(s.ball);
export const cupsStars = (s) => starsFor(s.score, 45, 100);

export function stepCups(s, dt) {
  if (s.status !== 'play') return s;
  s.t += dt;
  switch (s.phase) {
    case 'show':
      if (s.t >= SHOW_TIME) {
        s.phase = 'cover';
        s.t = 0;
        s.events.push({ type: 'cover' });
      }
      break;
    case 'cover':
      if (s.t >= COVER_TIME) {
        s.phase = 'wait';
        s.t = 0;
        s.events.push({ type: 'covered' });
      }
      break;
    case 'wait':
      if (s.t >= WAIT_TIME) {
        s.phase = 'shuffle';
        s.t = 0;
        s.events.push({ type: 'swap', index: 0 });
      }
      break;
    case 'shuffle':
      while (s.phase === 'shuffle' && s.t >= s.speed) {
        s.t -= s.speed;
        s.order = applySwap(s.order, s.swaps[s.swapIndex]);
        s.swapIndex += 1;
        if (s.swapIndex >= s.swaps.length) {
          s.phase = 'pick';
          s.t = 0;
          s.events.push({ type: 'pick-now' });
        } else s.events.push({ type: 'swap', index: s.swapIndex });
      }
      break;
    case 'reveal':
      if (s.t >= REVEAL_TIME) {
        if (s.round + 1 >= ROUNDS.length) {
          s.status = 'done';
          s.phase = 'done';
          s.events.push({ type: 'end' });
        } else startRound(s, s.round + 1);
      }
      break;
    default:
      break;
  }
  return s;
}

/** The child taps cup `id`. Returns { result: 'right' | 'wrong' | 'wait', points }. */
export function pickCup(s, id) {
  if (s.status !== 'play' || s.phase !== 'pick' || id < 0 || id >= s.n) return { result: 'wait', points: 0 };
  s.picked = id;
  s.phase = 'reveal';
  s.t = 0;
  if (id === s.ball) {
    const points = BASE_POINTS + Math.min(MAX_BONUS, s.streak * STREAK_BONUS);
    s.streak += 1;
    s.best = Math.max(s.best, s.streak);
    s.correct += 1;
    s.score += points;
    s.last = { result: 'right', points, streak: s.streak };
  } else {
    s.streak = 0;
    s.last = { result: 'wrong', points: 0, streak: 0 };
  }
  s.events.push({ type: 'pick', id, ...s.last });
  return s.last;
}

const ease = (k) => k * k * (3 - 2 * k);

/**
 * Where each cup is drawn: `x` in slots (may be between two while swapping), `arc` from -1
 * (up, passing over) to 1 (down, passing in front), `lift` 0 (on the table) to 1 (raised).
 */
export function cupLayout(s) {
  const out = [];
  const swap = s.phase === 'shuffle' ? s.swaps[s.swapIndex] : null;
  const k = swap ? ease(Math.min(1, s.t / s.speed)) : 0;
  for (let slot = 0; slot < s.n; slot++) {
    const id = s.order[slot];
    let x = slot;
    let arc = 0;
    if (swap && (slot === swap[0] || slot === swap[1])) {
      const to = slot === swap[0] ? swap[1] : swap[0];
      x = slot + (to - slot) * k;
      // Alternate which cup goes over, so it does not look the same each time
      const over = (slot === swap[0]) === (s.swapIndex % 2 === 0);
      arc = (over ? -1 : 1) * Math.sin(Math.PI * k);
    }
    let lift = 0;
    if (s.phase === 'show' && id === s.ball) lift = 1;
    else if (s.phase === 'cover' && id === s.ball) lift = 1 - ease(Math.min(1, s.t / COVER_TIME));
    else if (s.phase === 'reveal' || s.phase === 'done') {
      const t = s.phase === 'done' ? REVEAL_TIME : s.t;
      if (id === s.picked) lift = ease(Math.min(1, t / LIFT_TIME));
      else if (id === s.ball) lift = ease(Math.min(1, Math.max(0, t - 0.6) / LIFT_TIME));
      if (t > REVEAL_TIME - LIFT_TIME) lift = Math.min(lift, ease(Math.max(0, REVEAL_TIME - t) / LIFT_TIME));
    }
    out.push({ id, slot, x, arc, lift });
  }
  return out.sort((a, b) => a.id - b.id);
}
