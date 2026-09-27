// "Ném bóng đổ tháp lon" (knock down the cans): a tower of cans on a shelf, 3 Pokeballs per level.
// The child throws a ball at a point on the tower (x across, y up, in can widths); cans that are hit
// fly back off the shelf, cans left without support fall and knock the ones they land on.
// A can that is no longer standing counts as knocked. Clearing a tower with fewer balls earns a
// bonus. Simple deterministic 2D physics (plus a little depth), `random` is injectable.
import { starsFor } from './tickets';

export const CAN_W = 1;
export const CAN_H = 1.3;
export const BALL_R = 0.46;
export const SHELF_HALF = 3.4;
export const SHELF_DEPTH = 1;
export const BALLS = 3;
export const CAN_POINTS = 10;
export const CLEAR_BONUS = [0, 60, 35, 15]; // by balls used: 1, 2, 3
export const MAX_Y = 7.5; // highest point a ball can be thrown at
const GRAVITY = 16;
const WOBBLE = 0.34;
const FLIGHT = 0.5; // seconds from the hand to the tower

/** Rows of cans from the bottom: [count, x offset of the first can]. */
export const LEVELS = [
  { name: 'Tháp nhỏ', rows: [3, 2, 1] },
  { name: 'Tháp rộng', rows: [4, 3, 2, 1] },
  { name: 'Tháp cao', rows: [3, 2, 2, 2, 1] },
];
// Pokemon printed on the cans (dex numbers)
export const CAN_FACES = [25, 1, 4, 7, 133, 39, 54, 143, 35, 175];

export function buildTower(level) {
  const cans = [];
  let prevX = null;
  LEVELS[level].rows.forEach((count, row) => {
    // Rows sit on the gaps of a wider row below, or straight on a row of the same size
    let xs;
    if (prevX && prevX.length === count) xs = prevX;
    else xs = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * CAN_W);
    xs.forEach((x) => {
      const id = cans.length;
      cans.push({ id, x, y: row * CAN_H, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, vrot: 0, state: 'stand', face: CAN_FACES[id % CAN_FACES.length], row, landed: false, off: false });
    });
    prevX = xs;
  });
  return cans;
}

export function createCans({ random = Math.random } = {}) {
  const s = { random, level: 0, balls: BALLS, score: 0, knocked: 0, clears: 0, perfect: 0, status: 'aim', cans: buildTower(0), ball: null, settle: 0, levelScore: 0, levelResults: [], time: 0, events: [] };
  return s;
}

export const standingCans = (s) => s.cans.filter((c) => c.state === 'stand');
export const ballsUsed = (s) => BALLS - s.balls;

/** A standing can is held up by the shelf, a can straight under it, or two cans under its sides. */
function supported(s, c) {
  if (c.y <= 0.01) return true;
  let left = false;
  let right = false;
  for (const o of s.cans) {
    if (o === c || o.state !== 'stand') continue;
    if (Math.abs(o.y + CAN_H - c.y) > 0.05) continue;
    const dx = o.x - c.x;
    if (Math.abs(dx) < 0.3) return true;
    if (dx < 0 && dx > -0.8) left = true;
    if (dx > 0 && dx < 0.8) right = true;
  }
  return left && right;
}

function knock(s, c, { vx, vy, vz, spin }) {
  c.state = 'fly';
  c.vx = vx;
  c.vy = vy;
  c.vz = vz;
  c.vrot = spin;
  s.events.push({ type: 'knock', id: c.id, x: c.x, y: c.y + CAN_H / 2 });
}

/** Throw a ball at the point (x, y) of the tower's front. */
export function throwBall(s, { x, y }) {
  if (s.status !== 'aim' || s.balls <= 0) return false;
  const r = s.random;
  const tx = Math.max(-SHELF_HALF - 1, Math.min(SHELF_HALF + 1, x)) + (r() - 0.5) * WOBBLE;
  const ty = Math.max(0, Math.min(MAX_Y, y)) + (r() - 0.5) * WOBBLE;
  s.balls -= 1;
  s.status = 'fly';
  s.ball = { x: tx, y: ty, t: 0, dur: FLIGHT, z: -3, vz: 0, vy: 0, hit: false, spin: 0, gone: false };
  s.events.push({ type: 'throw', x: tx, y: ty });
  return true;
}

function ballArrives(s, b) {
  let hits = 0;
  for (const c of s.cans) {
    if (c.state !== 'stand') continue;
    // Circle against the can's box
    const nx = Math.max(c.x - CAN_W / 2, Math.min(b.x, c.x + CAN_W / 2));
    const ny = Math.max(c.y, Math.min(b.y, c.y + CAN_H));
    if (Math.hypot(b.x - nx, b.y - ny) > BALL_R) continue;
    hits += 1;
    const side = c.x - b.x;
    knock(s, c, { vx: side * 1.6 + (s.random() - 0.5) * 0.8, vy: 2.5 + s.random() * 2 + (c.y + CAN_H / 2 - b.y) * 1.5, vz: 2.6 + s.random() * 1.2, spin: (side >= 0 ? 1 : -1) * (6 + s.random() * 6) });
  }
  b.hit = hits > 0;
  // The ball carries on behind the shelf, slower if it hit something
  b.vz = hits ? 1.2 : 4;
  b.vy = hits ? 1.5 : 0.5;
  s.events.push({ type: hits ? 'hit' : 'whiff', x: b.x, y: b.y, cans: hits });
}

function onShelf(c) {
  return c.z < SHELF_DEPTH && Math.abs(c.x) < SHELF_HALF;
}

function stepCan(s, c, dt) {
  c.vy -= GRAVITY * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.z += c.vz * dt;
  c.rot += c.vrot * dt;
  if (c.y <= 0 && !c.off && onShelf(c)) {
    // Lands on the shelf: bounce, slide, roll over on its side
    c.y = 0;
    if (!c.landed) s.events.push({ type: 'clatter', id: c.id, x: c.x, y: 0 });
    c.landed = true;
    c.vy = Math.abs(c.vy) > 2 ? Math.abs(c.vy) * 0.3 : 0;
    c.vx *= 0.82;
    c.vz *= 0.7;
    c.vrot *= 0.7;
    const side = Math.round(c.rot / (Math.PI / 2)) * (Math.PI / 2);
    // Settle on a side (lying down)
    const lie = Math.abs(side) < 0.01 ? (c.vrot >= 0 ? Math.PI / 2 : -Math.PI / 2) : side;
    if (Math.abs(c.vrot) < 3) c.rot += (lie - c.rot) * Math.min(1, dt * 10);
    if (Math.abs(c.vx) < 0.15 && Math.abs(c.vz) < 0.15 && c.vy === 0) {
      c.state = 'rest';
      c.rot = lie;
    }
  } else if (c.y <= 0 && !onShelf(c) && !c.off) {
    c.off = true; // it went over the edge
    s.events.push({ type: 'offShelf', id: c.id, x: c.x });
  }
  if (c.y < -9) {
    c.state = 'gone';
    c.off = true;
  }
}

/** A falling can that comes down on a standing one knocks it when it falls hard and square on it, else slides off its side. */
function collide(s) {
  for (const f of s.cans) {
    if (f.state !== 'fly' || f.z > 0.45 || f.vy > 0) continue;
    for (const c of s.cans) {
      if (c.state !== 'stand') continue;
      const dx = f.x - c.x;
      const top = c.y + CAN_H;
      if (Math.abs(dx) >= CAN_W * 0.95 || f.y >= top || f.y < top - CAN_H * 0.5) continue;
      if (f.vy < -3.2 && Math.abs(dx) < 0.55) {
        const side = -dx || s.random() - 0.5;
        knock(s, c, { vx: Math.sign(side) * (0.8 + s.random()) + f.vx * 0.3, vy: 0.8 + s.random(), vz: 0.3 + s.random() * 1.1, spin: Math.sign(side) * (4 + s.random() * 5) });
        f.vy *= 0.4;
      } else {
        // Lands on it and tips over the side
        f.y = top;
        f.vy = Math.max(f.vy, 0) * 0.2;
        f.vx = Math.sign(dx || s.random() - 0.5) * Math.max(Math.abs(f.vx), 1.8);
        f.vrot = Math.sign(f.vx) * Math.max(Math.abs(f.vrot), 5);
      }
    }
  }
}

export function stepCans(s, dt) {
  s.time += dt;
  if (s.status === 'fly' || s.status === 'settle') {
    const b = s.ball;
    if (b && !b.gone) {
      b.t += dt;
      b.spin += dt * 14;
      if (b.t < b.dur) {
        b.z = -3 * (1 - b.t / b.dur);
      } else {
        if (!b.arrived) {
          b.arrived = true;
          b.z = 0;
          ballArrives(s, b);
          s.status = 'settle';
          s.settle = 0;
        }
        b.vy -= GRAVITY * 0.6 * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        if (b.y < -6) b.gone = true;
      }
    }
    // Physics in small steps
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(1 / 120, left);
      left -= h;
      for (const c of s.cans) if (c.state === 'fly') stepCan(s, c, h);
      collide(s);
      for (const c of s.cans) {
        if (c.state === 'stand' && !supported(s, c)) knock(s, c, { vx: (s.random() - 0.5) * 1.6, vy: 0, vz: s.random() * 0.8, spin: (s.random() - 0.5) * 8 });
      }
    }
    if (s.status === 'settle') {
      s.settle += dt;
      const moving = s.cans.some((c) => c.state === 'fly' && !c.off);
      if ((s.settle > 1.1 && !moving) || s.settle > 3.2) endThrow(s);
    }
  }
  return s;
}

function endThrow(s) {
  // Anything still in the air is counted as down
  for (const c of s.cans) if (c.state === 'fly') c.state = c.off ? 'gone' : 'rest';
  s.ball = null;
  const standing = standingCans(s).length;
  const down = s.cans.length - standing;
  const newly = down - (s.levelDown || 0);
  s.levelDown = down;
  if (newly > 0) {
    s.score += newly * CAN_POINTS;
    s.levelScore += newly * CAN_POINTS;
    s.knocked += newly;
  }
  s.events.push({ type: 'settled', newly, standing });
  if (standing === 0) {
    const used = ballsUsed(s);
    const bonus = CLEAR_BONUS[used] || 0;
    s.score += bonus;
    s.levelScore += bonus;
    s.clears += 1;
    if (used === 1) s.perfect += 1;
    s.levelResults.push({ cleared: true, used, bonus, score: s.levelScore });
    s.events.push({ type: 'clear', used, bonus });
    finishLevel(s);
  } else if (s.balls <= 0) {
    s.levelResults.push({ cleared: false, used: BALLS, bonus: 0, score: s.levelScore });
    s.events.push({ type: 'out', standing });
    finishLevel(s);
  } else {
    s.status = 'aim';
  }
}

function finishLevel(s) {
  if (s.level >= LEVELS.length - 1) {
    s.status = 'done';
    s.events.push({ type: 'end' });
  } else {
    s.status = 'levelEnd';
  }
}

/** Set up the next tower (after a level ended). */
export function nextLevel(s) {
  if (s.status !== 'levelEnd') return false;
  s.level += 1;
  s.cans = buildTower(s.level);
  s.balls = BALLS;
  s.levelScore = 0;
  s.levelDown = 0;
  s.status = 'aim';
  s.events.push({ type: 'level', level: s.level });
  return true;
}

export const cansStars = (s) => starsFor(s.score, 170, 290);
