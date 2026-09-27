// "Ném phi tiêu bóng bay": a board of 5x4 balloons at the back of a stall. The child swipes up to
// throw a dart (the swipe's direction and length give the point it flies to). A popped balloon
// shows what was inside: a Pokemon sticker (10 / 20, the golden balloons 50), a bonus dart, or a
// Voltorb bomb (-15). 10 darts; from the 5th throw some rows start to drift. Pure rules and
// flight; `random` is injectable. Coordinates are the canvas' logical pixels.
import { starsFor } from './tickets';

export const DARTS_W = 360;
export const DARTS_H = 560;
export const DARTS = 10;
export const COLS = 5;
export const ROWS = 4;
export const BOARD = { x0: 60, dx: 60, y0: 118, dy: 64 };
export const BALLOON_R = 23;
export const HIT_R = 26; // a little bigger than the balloon: kind to little hands
export const HAND = { x: 180, y: 470 };
export const FLIGHT = 0.42; // seconds in the air
export const LAND_PAUSE = 0.6; // look at the pop before the next dart
export const DRIFT_FROM = 4; // throws before rows start drifting
export const BOMB = -15;
export const SWIPE_MIN = 24;
export const SWIPE_GAIN = 1.55;
// Wobble of every throw (pixels, total spread)
const WOBBLE_X = 10;
const WOBBLE_Y = 12;

export const STICKERS = {
  10: [16, 19, 10, 43, 60, 129, 52, 41],
  20: [1, 4, 7, 133, 39, 35, 175, 54],
  50: [151, 25],
};
export const VOLTORB = 100;

const shuffle = (list, r) => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function contents(r) {
  const list = [];
  STICKERS[50].forEach((dex) => list.push({ kind: 'sticker', points: 50, rare: true, dex }));
  const mid = shuffle(STICKERS[20], r);
  const small = shuffle(STICKERS[10], r);
  for (let i = 0; i < 6; i++) list.push({ kind: 'sticker', points: 20, dex: mid[i % mid.length] });
  for (let i = 0; i < 7; i++) list.push({ kind: 'sticker', points: 10, dex: small[i % small.length] });
  for (let i = 0; i < 2; i++) list.push({ kind: 'bonus', points: 0 });
  for (let i = 0; i < 3; i++) list.push({ kind: 'bomb', points: BOMB, dex: VOLTORB });
  return shuffle(list, r);
}

export function createDarts({ random = Math.random } = {}) {
  const r = random;
  const inside = contents(r);
  const balloons = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const id = row * COLS + col;
      const c = inside[id];
      balloons.push({
        id,
        row,
        col,
        hx: BOARD.x0 + col * BOARD.dx,
        hy: BOARD.y0 + row * BOARD.dy,
        color: c.rare ? 'gold' : Math.floor(r() * 6),
        phase: r() * Math.PI * 2,
        popped: false,
        content: c,
      });
    }
  }
  return {
    random,
    time: 0,
    balloons,
    // Rows 0 and 2 sway left and right later on (row 1 the other way, a little)
    sway: [0, 0, 0, 0],
    swayPhase: [r() * 6, r() * 6, r() * 6, r() * 6],
    dartsLeft: DARTS,
    thrown: 0,
    score: 0,
    pops: 0,
    bombs: 0,
    bonus: 0,
    rares: 0,
    misses: 0,
    dart: null,
    stuck: [],
    wait: 0,
    status: 'aim', // aim | fly | land | done
    events: [],
  };
}

/** How far the rows sway (pixels) after `thrown` darts. */
export function swayFor(thrown) {
  if (thrown < DRIFT_FROM) return [0, 0, 0, 0];
  const k = Math.min(1, (thrown - DRIFT_FROM + 1) / 4);
  return [18 * k, 8 * k, 22 * k, 0];
}

const SWAY_SPEED = [0.9, 1.3, 1.1, 0];

/** Where a balloon is at `time` (defaults to now). */
export function balloonPos(s, b, time = s.time) {
  const row = b.row;
  const x = b.hx + Math.sin(time * SWAY_SPEED[row] + s.swayPhase[row]) * s.sway[row] * (row === 1 ? -1 : 1);
  const y = b.hy + Math.sin(time * 1.7 + b.phase) * 3;
  return { x, y };
}

/** A swipe (logical pixels, y down) to the point it throws at, or null when too small. */
export function aimFromSwipe(dx, dy) {
  if (-dy < SWIPE_MIN) return null;
  return {
    x: Math.max(12, Math.min(DARTS_W - 12, HAND.x + dx * SWIPE_GAIN)),
    y: Math.max(40, Math.min(420, HAND.y + dy * SWIPE_GAIN)),
  };
}

/** The dart's position part way through its flight (k in 0..1): a slight arc. */
export function dartAt(dart, k) {
  const e = k;
  const x = dart.from.x + (dart.to.x - dart.from.x) * e;
  const y = dart.from.y + (dart.to.y - dart.from.y) * e - Math.sin(k * Math.PI) * dart.arc;
  return { x, y };
}

/** Throw at the point (x, y). Returns false when a dart is already flying or none are left. */
export function throwDart(s, { x, y }) {
  if (s.status !== 'aim' || s.dartsLeft <= 0) return false;
  const r = s.random;
  const to = { x: x + (r() - 0.5) * WOBBLE_X, y: y + (r() - 0.5) * WOBBLE_Y };
  s.dartsLeft -= 1;
  s.thrown += 1;
  s.status = 'fly';
  s.dart = { id: s.thrown, t: 0, from: { ...HAND }, to, arc: 22 + Math.abs(HAND.y - to.y) * 0.08 };
  s.events.push({ type: 'throw', x: to.x, y: to.y });
  return true;
}

/** The balloon (not popped) under the point, or null. */
export function balloonAt(s, x, y, time = s.time) {
  let best = null;
  let bestD = HIT_R;
  for (const b of s.balloons) {
    if (b.popped) continue;
    const p = balloonPos(s, b, time);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function land(s) {
  const { to } = s.dart;
  const b = balloonAt(s, to.x, to.y);
  s.stuck.push({ id: s.dart.id, x: to.x, y: to.y, tilt: (to.x - HAND.x) / 900 });
  s.dart = null;
  s.status = 'land';
  s.wait = LAND_PAUSE;
  if (!b) {
    s.misses += 1;
    s.events.push({ type: 'miss', x: to.x, y: to.y });
    return;
  }
  const p = balloonPos(s, b);
  b.popped = true;
  s.pops += 1;
  const c = b.content;
  if (c.kind === 'bomb') {
    s.bombs += 1;
    const before = s.score;
    s.score = Math.max(0, s.score + BOMB);
    s.events.push({ type: 'pop', id: b.id, x: p.x, y: p.y, color: b.color, content: c, points: s.score - before });
  } else if (c.kind === 'bonus') {
    s.bonus += 1;
    s.dartsLeft += 1;
    s.events.push({ type: 'pop', id: b.id, x: p.x, y: p.y, color: b.color, content: c, points: 0 });
  } else {
    if (c.rare) s.rares += 1;
    s.score += c.points;
    s.events.push({ type: 'pop', id: b.id, x: p.x, y: p.y, color: b.color, content: c, points: c.points });
  }
}

export function stepDarts(s, dt) {
  if (s.status === 'done') return s;
  s.time += dt;
  // Rows ease towards how far they should sway
  const want = swayFor(s.thrown);
  for (let i = 0; i < ROWS; i++) s.sway[i] += (want[i] - s.sway[i]) * Math.min(1, dt * 1.5);
  if (s.status === 'fly' && s.dart) {
    s.dart.t += dt;
    if (s.dart.t >= FLIGHT) land(s);
  } else if (s.status === 'land') {
    s.wait -= dt;
    if (s.wait <= 0) {
      const left = s.balloons.some((b) => !b.popped);
      if (s.dartsLeft <= 0 || !left) {
        s.status = 'done';
        s.events.push({ type: 'end' });
      } else {
        s.status = 'aim';
      }
    }
  }
  return s;
}

export const DARTS_TWO = 85;
export const DARTS_THREE = 140;
export const dartsStars = (s) => starsFor(s.score, DARTS_TWO, DARTS_THREE);
