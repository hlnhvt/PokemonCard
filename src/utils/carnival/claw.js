// "Máy gắp thú Pokémon" (claw machine): move the claw over a pile of plush Pokemon, drop it,
// and carry a plush to the prize chute on the left. How well the claw holds depends on how
// centred it is: dead centre always holds, off-centre may slip while rising.
// Pure rules (canvas coordinates 360x560); `random` is injectable.
import { starsFor } from './tickets';

export const CLAW_W = 360;
export const CLAW_H = 560;
export const TRIES = 6;
export const RAIL_Y = 132; // claw tip height when it hangs at the top
export const FLOOR_Y = 486; // the floor under the pile
export const CHUTE = { x: 60, left: 28, right: 94, top: 420 }; // prize hole
export const MIN_X = CHUTE.x;
export const MAX_X = 326;
export const PILE_MIN = 116;
export const PILE_MAX = 330;
export const PLUSH_R = 26;
export const GRAB_R = 34; // the claw closes on a plush this close (centre to centre)
export const PERFECT = 0.3; // offset (as a part of GRAB_R) that always holds
export const HOLD_DY = 30; // plush centre below the claw tip while held

const MOVE_SPEED = 150;
const AIM_SPEED = 420;
const DOWN_SPEED = 240;
const UP_SPEED = 175;
const CARRY_SPEED = 150;
const OPEN_TIME = 0.3;
const CLOSE_TIME = 0.5;
const RELEASE_TIME = 0.6;
const GRAVITY = 1500;

export const PLUSH_KINDS = {
  pikachu: { dex: 25, points: 10, name: 'Pikachu' },
  jigglypuff: { dex: 39, points: 10, name: 'Jigglypuff' },
  squirtle: { dex: 7, points: 10, name: 'Squirtle' },
  bulbasaur: { dex: 1, points: 10, name: 'Bulbasaur' },
  charmander: { dex: 4, points: 10, name: 'Charmander' },
  togepi: { dex: 175, points: 15, name: 'Togepi' },
  clefairy: { dex: 35, points: 15, name: 'Clefairy' },
  eevee: { dex: 133, points: 20, name: 'Eevee' },
  snorlax: { dex: 143, points: 25, name: 'Snorlax', size: 1.25, slip: 0.08 },
  mew: { dex: 151, points: 50, name: 'Mew', rare: true, slip: 0.12 },
};
const COMMON = ['pikachu', 'jigglypuff', 'squirtle', 'bulbasaur', 'charmander', 'togepi', 'clefairy'];

// Five on the floor, two sitting on top between them
const FRONT = [128, 174, 220, 266, 312];
const TOP = [197, 289];
const frontY = (size) => FLOOR_Y - PLUSH_R * size;
const topY = (size) => FLOOR_Y - PLUSH_R * 2 * 0.95 - PLUSH_R * size * 0.9;

const radius = (p) => PLUSH_R * (PLUSH_KINDS[p.kind].size || 1);

export function createClaw({ random = Math.random } = {}) {
  // Always a Mew, a Snorlax and an Eevee, plus four commons; shuffled over the spots
  const kinds = ['mew', 'snorlax', 'eevee'];
  const pool = [...COMMON];
  while (kinds.length < FRONT.length + TOP.length) kinds.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const spots = [...FRONT.map((x) => ({ x, tier: 0 })), ...TOP.map((x) => ({ x, tier: 1 }))];
  const plushes = spots.map((sp, i) => {
    const size = PLUSH_KINDS[kinds[i]].size || 1;
    const x = sp.x + (random() - 0.5) * 8;
    const y = sp.tier ? topY(size) : frontY(size);
    return { id: i + 1, kind: kinds[i], x, y, restY: y, tier: sp.tier, vy: 0, state: 'rest', phase: random() * 6.28, tilt: 0 };
  });
  return {
    random,
    time: 0,
    tries: TRIES,
    score: 0,
    prizes: [],
    slips: 0,
    misses: 0,
    plushes,
    claw: { x: MIN_X, y: RAIL_Y, state: 'idle', open: 0.25, t: 0, held: null, stopY: RAIL_Y, slipY: null, dir: 0, aim: null, sway: 0 },
    status: 'play',
    events: [],
  };
}

export const clawStars = (s) => starsFor(s.score, 50, 110);
export const plushById = (s, id) => s.plushes.find((p) => p.id === id) || null;
export const canMove = (s) => s.status === 'play' && s.claw.state === 'idle';

/** Hold an arrow: -1 left, 1 right, 0 stop. */
export function setMove(s, dir) {
  s.claw.dir = dir;
  if (dir) s.claw.aim = null;
}

/** Drag: the claw glides to x. */
export function aimAt(s, x) {
  s.claw.aim = Math.max(MIN_X, Math.min(MAX_X, x));
}

/** The resting plush nearest (in x) to the claw, if the claw can close on it. */
export function target(s, x = s.claw.x) {
  let best = null;
  for (const p of s.plushes) {
    if (p.state !== 'rest') continue;
    const dx = Math.abs(p.x - x);
    if (dx < GRAB_R && (!best || dx < best.dx)) best = { p, dx };
  }
  return best;
}

/** "GẮP!": the claw goes down. Returns true when it started. */
export function drop(s) {
  if (!canMove(s) || s.tries <= 0) return false;
  const c = s.claw;
  s.tries -= 1;
  c.dir = 0;
  c.aim = null;
  const t = target(s);
  c.stopY = t ? t.p.y - HOLD_DY : FLOOR_Y - 56;
  c.state = 'open';
  c.t = 0;
  s.events.push({ type: 'drop', x: c.x });
  return true;
}

function landingY(s, p) {
  // On top of a floor plush when one is under it, else on the floor
  const size = PLUSH_KINDS[p.kind].size || 1;
  const under = s.plushes.some((q) => q !== p && q.state === 'rest' && q.tier === 0 && Math.abs(q.x - p.x) < PLUSH_R * 1.6);
  p.tier = under ? 1 : 0;
  return under ? topY(size) : frontY(size);
}

function stepPlushes(s, dt) {
  for (const p of s.plushes) {
    if (p.state === 'rest') {
      // A plush on top falls when nothing is under it any more
      if (p.tier === 1 && !s.plushes.some((q) => q !== p && q.state === 'rest' && q.tier === 0 && Math.abs(q.x - p.x) < PLUSH_R * 1.9)) {
        p.state = 'fall';
        p.vy = 0;
        p.restY = landingY(s, p);
      }
      continue;
    }
    if (p.state === 'fall') {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      p.tilt *= Math.max(0, 1 - dt * 3);
      if (p.y >= p.restY) {
        p.y = p.restY;
        if (p.vy > 160) {
          s.events.push({ type: 'bounce', id: p.id, x: p.x, y: p.y + radius(p), hard: p.vy > 420 });
          p.vy = -p.vy * 0.38;
        } else {
          p.vy = 0;
          p.tilt = 0;
          p.state = 'rest';
        }
      }
    } else if (p.state === 'chute') {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      p.x += (CHUTE.x - p.x) * Math.min(1, dt * 8);
      if (p.y > CHUTE.top + 70) {
        p.state = 'won';
        const k = PLUSH_KINDS[p.kind];
        s.score += k.points;
        s.prizes.push({ id: p.id, kind: p.kind, points: k.points });
        s.events.push({ type: 'prize', id: p.id, kind: p.kind, points: k.points, rare: !!k.rare });
      }
    }
  }
}

function stepClaw(s, dt) {
  const c = s.claw;
  c.sway *= Math.max(0, 1 - dt * 2.2);
  c.t += dt;
  const held = c.held ? plushById(s, c.held) : null;
  switch (c.state) {
    case 'idle': {
      if (c.aim != null) {
        const d = c.aim - c.x;
        const step = Math.sign(d) * Math.min(Math.abs(d), AIM_SPEED * dt);
        c.x += step;
        if (Math.abs(step) > 0.1) c.sway = Math.max(-0.12, Math.min(0.12, c.sway - step * 0.004));
        if (Math.abs(d) < 0.5) c.aim = null;
      } else if (c.dir) {
        c.x += c.dir * MOVE_SPEED * dt;
        c.sway = Math.max(-0.12, Math.min(0.12, c.sway - c.dir * dt * 0.5));
      }
      c.x = Math.max(MIN_X, Math.min(MAX_X, c.x));
      c.open += (0.25 - c.open) * Math.min(1, dt * 6);
      break;
    }
    case 'open':
      c.open = Math.min(1, 0.25 + (c.t / OPEN_TIME) * 0.75);
      if (c.t >= OPEN_TIME) {
        c.state = 'down';
        c.t = 0;
      }
      break;
    case 'down':
      c.y = Math.min(c.stopY, c.y + DOWN_SPEED * dt);
      if (c.y >= c.stopY) {
        c.state = 'close';
        c.t = 0;
        s.events.push({ type: 'bottom', x: c.x, y: c.y });
      }
      break;
    case 'close':
      c.open = Math.max(0, 1 - c.t / CLOSE_TIME);
      if (c.t >= CLOSE_TIME) {
        const t = target(s);
        c.t = 0;
        c.state = 'up';
        if (t) {
          const offset = t.dx / GRAB_R;
          const k = PLUSH_KINDS[t.p.kind];
          const chance = offset <= PERFECT ? 0 : Math.min(0.95, Math.pow((offset - PERFECT) / (1 - PERFECT), 0.6) + (k.slip || 0));
          const slips = s.random() < chance;
          c.held = t.p.id;
          t.p.state = 'held';
          c.slipY = slips ? RAIL_Y + (c.y - RAIL_Y) * (0.25 + s.random() * 0.5) : null;
          c.open = offset <= PERFECT ? 0 : Math.min(0.45, offset * 0.4);
          c.grip = offset;
          s.events.push({ type: 'grab', id: t.p.id, kind: t.p.kind, offset, perfect: offset <= PERFECT, risky: chance > 0.3 });
        } else {
          c.held = null;
          c.slipY = null;
          s.misses += 1;
          s.events.push({ type: 'miss', x: c.x, y: c.y });
        }
      }
      break;
    case 'up': {
      c.y = Math.max(RAIL_Y, c.y - UP_SPEED * dt);
      if (held && c.slipY != null) c.sway = Math.sin(s.time * 18) * 0.05 * c.grip;
      if (held && c.slipY != null && c.y <= c.slipY) {
        // "Ối!" it slips out and falls back on the pile
        held.state = 'fall';
        held.vy = -60;
        held.tilt = (s.random() - 0.5) * 1.2;
        held.x = Math.max(PILE_MIN, Math.min(PILE_MAX, held.x));
        held.restY = landingY(s, held);
        c.held = null;
        c.slipY = null;
        c.sway = 0.25;
        c.open = 0.6;
        s.slips += 1;
        s.events.push({ type: 'slip', id: held.id, kind: held.kind, x: held.x, y: held.y });
      }
      if (c.y <= RAIL_Y) {
        c.state = 'carry';
        c.t = 0;
      }
      break;
    }
    case 'carry': {
      const d = MIN_X - c.x;
      const step = Math.sign(d) * Math.min(Math.abs(d), CARRY_SPEED * dt);
      c.x += step;
      if (Math.abs(step) > 0.01) c.sway = Math.max(-0.14, Math.min(0.14, c.sway - step * 0.002));
      if (Math.abs(d) < 0.5) {
        c.x = MIN_X;
        c.state = 'release';
        c.t = 0;
        if (held) {
          held.state = 'chute';
          held.vy = 0;
          c.held = null;
          s.events.push({ type: 'release', id: held.id });
        }
      }
      break;
    }
    case 'release':
      c.open = Math.min(1, c.open + dt * 3);
      if (c.t >= RELEASE_TIME) {
        c.state = 'idle';
        c.t = 0;
      }
      break;
    default:
      break;
  }
  if (held && c.held === held.id) {
    held.x = c.x;
    held.y = c.y + HOLD_DY;
  }
}

/** Advance the machine by dt seconds. */
export function stepClawGame(s, dt) {
  if (s.status !== 'play') return s;
  s.time += dt;
  stepClaw(s, dt);
  stepPlushes(s, dt);
  const busy = s.plushes.some((p) => p.state === 'fall' || p.state === 'chute');
  if (s.tries <= 0 && s.claw.state === 'idle' && !busy) {
    s.status = 'done';
    s.events.push({ type: 'end' });
  }
  return s;
}
