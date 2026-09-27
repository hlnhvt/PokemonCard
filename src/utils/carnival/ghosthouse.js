// "Nhà ma Gengar": the child's Pokemon rides a mine cart through a dark (friendly!) haunted
// house that scrolls past. A flashlight follows the finger; ghosts peek from windows, slide out
// from curtains and float out of paintings. In the dark only their eyes glow: shine the light on
// them to see who it is, then tap a ghost to catch it. Friendly Pokemon hide there too - tapping
// them costs points. Lightning now and then lights everything up. 45 seconds.
// Pure rules (canvas 360x560); `random` is injectable.
import { starsFor } from './tickets';

export const GH_W = 360;
export const GH_H = 560;
export const DURATION = 45;
export const SCROLL = 38; // px per second the house slides past
export const LIGHT_R = 74; // flashlight circle radius
export const HIT_R = 42;
export const REVEAL_TIME = 0.16; // seconds in the light before we see who it is
export const CAUGHT_TIME = 0.9; // the capture animation
export const FADE = 0.35;
export const FRIEND_COST = 30;
export const CART = { x: 84, y: 468 };
export const LAMP = { x: 124, y: 418 }; // where the flashlight beam starts

export const KINDS = {
  gastly: { dex: 92, name: 'Gastly', points: 10, weight: 44, life: 3.3, size: 66, ghost: true },
  haunter: { dex: 93, name: 'Haunter', points: 20, weight: 27, life: 2.8, size: 74, ghost: true },
  gengar: { dex: 94, name: 'Gengar', points: 50, weight: 10, life: 2.0, size: 80, ghost: true, fast: true },
  clefairy: { dex: 35, name: 'Clefairy', points: -FRIEND_COST, weight: 12, life: 3.0, size: 62 },
  togepi: { dex: 175, name: 'Togepi', points: -FRIEND_COST, weight: 11, life: 3.0, size: 56 },
};
const KIND_LIST = Object.keys(KINDS);

// Where ghosts can appear, along the wall
export const SPOT_KINDS = {
  window: { w: 76, h: 100, y: [176, 196] },
  curtain: { w: 70, h: 160, y: [236, 252] },
  painting: { w: 70, h: 84, y: [198, 300] },
};
const SPOT_LIST = Object.keys(SPOT_KINDS);

const pace = (s) => Math.min(1, s.time / DURATION);
const gap = (s) => 1.2 - pace(s) * 0.45;
const maxActive = (s) => (pace(s) < 0.3 ? 2 : 3);

function pickKind(random) {
  const total = KIND_LIST.reduce((n, k) => n + KINDS[k].weight, 0);
  let r = random() * total;
  for (const k of KIND_LIST) {
    r -= KINDS[k].weight;
    if (r < 0) return k;
  }
  return 'gastly';
}

function addSpots(s) {
  // Keep the wall filled a screen ahead
  while (s.spotEnd < s.scroll + GH_W + 160) {
    const r = s.random;
    const prev = s.spots[s.spots.length - 1];
    let kind = SPOT_LIST[Math.floor(r() * SPOT_LIST.length)];
    if (prev && prev.kind === kind) kind = SPOT_LIST[(SPOT_LIST.indexOf(kind) + 1) % SPOT_LIST.length];
    const k = SPOT_KINDS[kind];
    const y = k.y[0] + r() * (k.y[1] - k.y[0]);
    const x = s.spotEnd + k.w / 2 + 36 + r() * 26;
    s.spots.push({ id: s.nextId++, kind, x, y, w: k.w, h: k.h, busy: 0, side: r() < 0.5 ? -1 : 1 });
    s.spotEnd = x + k.w / 2;
  }
  // Forget the ones far behind
  while (s.spots.length && s.spots[0].x + 120 < s.scroll) s.spots.shift();
}

export function createGhostHouse({ random = Math.random } = {}) {
  const s = {
    random,
    time: 0,
    scroll: 0,
    spots: [],
    spotEnd: -20,
    ghosts: [],
    nextId: 1,
    nextSpawn: 0.8,
    nextLightning: 6 + random() * 3,
    flash: 0,
    aim: { x: GH_W / 2, y: 260 },
    light: { x: GH_W / 2, y: 260 },
    score: 0,
    catches: 0,
    caught: { gastly: 0, haunter: 0, gengar: 0 },
    friends: 0,
    missed: 0,
    darkTaps: 0,
    status: 'play',
    events: [],
  };
  addSpots(s);
  return s;
}

export const timeLeft = (s) => Math.max(0, DURATION - s.time);
export const spotScreenX = (s, spot) => spot.x - s.scroll;

/** How much a ghost is showing (0 .. 1): fades in, fades out at the end of its life. */
export function appear(g) {
  if (g.caught) return 1;
  const up = Math.min(1, g.t / FADE);
  const down = Math.min(1, Math.max(0, (g.life - g.t) / FADE));
  return Math.min(up, down);
}

/** Where a ghost is on screen now. */
export function ghostPos(s, g) {
  const spot = g.spot;
  const sx = spot.x - s.scroll;
  const k = appear(g);
  const t = g.t;
  const fast = KINDS[g.kind].fast ? 1.8 : 1;
  let x = sx;
  let y = spot.y;
  if (spot.kind === 'window') {
    // Rises up behind the window sill and sways
    x = sx + Math.sin(t * 1.6 * fast + g.phase) * 9 * fast;
    y = spot.y + (1 - Math.min(1, t / 0.45)) * 34 + Math.sin(t * 2.4 + g.phase) * 5;
  } else if (spot.kind === 'curtain') {
    // Slides out from behind the curtain
    const out = Math.min(1, t / 0.5);
    x = sx + spot.side * (out * 34 + Math.sin(t * 1.3 * fast + g.phase) * 8 * fast);
    y = spot.y - 20 + Math.sin(t * 2 + g.phase) * 7;
  } else {
    // Floats out of the painting into the hall, drifting down
    const drift = Math.min(t, 2.2);
    x = sx + Math.sin(t * 1.2 * fast + g.phase) * 26 * Math.min(1, t) * fast;
    y = spot.y + drift * 22 + Math.sin(t * 2.2 + g.phase) * 7;
  }
  return { x: Math.max(30, Math.min(GH_W - 30, x)), y: Math.max(110, Math.min(410, y)), k };
}

function spawn(s) {
  const r = s.random;
  const active = s.ghosts.filter((g) => !g.caught).length;
  if (active >= maxActive(s)) return;
  // A free spot fully on screen, with room to drift
  const free = s.spots.filter((p) => !p.busy && p.x - s.scroll > 70 && p.x - s.scroll < GH_W - 50);
  if (!free.length) return;
  const spot = free[Math.floor(r() * free.length)];
  let kind = pickKind(r);
  // Never two friends at the same time; at least one ghost out
  if (!KINDS[kind].ghost && s.ghosts.some((g) => !g.caught && !KINDS[g.kind].ghost)) kind = 'gastly';
  const life = KINDS[kind].life * (1 - pace(s) * 0.15) * (0.9 + r() * 0.2);
  spot.busy = 1;
  const g = { id: s.nextId++, kind, spot, t: 0, life, seen: 0, revealed: false, caught: false, caughtAt: 0, bumped: false, phase: r() * 6.28 };
  s.ghosts.push(g);
  s.events.push({ type: 'peek', id: g.id, kind });
}

function reveal(s, g, why) {
  if (g.revealed) return;
  g.revealed = true;
  // Once we can see it, there is time to tap it
  g.life = Math.max(g.life, g.t + (KINDS[g.kind].fast ? 1.0 : 1.35));
  const p = ghostPos(s, g);
  s.events.push({ type: 'reveal', id: g.id, kind: g.kind, ghost: !!KINDS[g.kind].ghost, x: p.x, y: p.y, why });
}

export function stepGhostHouse(s, dt) {
  if (s.status !== 'play') return s;
  s.time += dt;
  s.scroll += SCROLL * dt;
  addSpots(s);
  // The flashlight follows the finger smoothly
  const f = Math.min(1, dt * 16);
  s.light.x += (s.aim.x - s.light.x) * f;
  s.light.y += (s.aim.y - s.light.y) * f;
  s.flash = Math.max(0, s.flash - dt * 2.2);
  s.nextLightning -= dt;
  if (s.nextLightning <= 0) {
    s.flash = 1;
    s.nextLightning = 7 + s.random() * 5;
    s.events.push({ type: 'lightning' });
    for (const g of s.ghosts) if (!g.caught && appear(g) > 0.3) reveal(s, g, 'lightning');
  }
  s.nextSpawn -= dt;
  if (s.nextSpawn <= 0) {
    spawn(s);
    s.nextSpawn = gap(s) * (0.7 + s.random() * 0.6);
  }
  for (let i = s.ghosts.length - 1; i >= 0; i--) {
    const g = s.ghosts[i];
    g.t += dt;
    if (g.caught) {
      if (g.t - g.caughtAt >= CAUGHT_TIME) s.ghosts.splice(i, 1);
      continue;
    }
    const p = ghostPos(s, g);
    if (!g.revealed && p.k > 0.4 && Math.hypot(p.x - s.light.x, p.y - s.light.y) < LIGHT_R) {
      g.seen += dt;
      if (g.seen >= REVEAL_TIME) reveal(s, g, 'light');
    }
    if (g.t >= g.life) {
      if (KINDS[g.kind].ghost) {
        s.missed += 1;
        s.events.push({ type: 'escape', id: g.id, kind: g.kind });
      }
      g.spot.busy = 0;
      s.ghosts.splice(i, 1);
    }
  }
  if (s.time >= DURATION) {
    s.status = 'done';
    s.events.push({ type: 'end' });
  }
  return s;
}

/** The finger moves (drag): the flashlight follows. */
export function aimLight(s, x, y) {
  s.aim.x = Math.max(0, Math.min(GH_W, x));
  s.aim.y = Math.max(60, Math.min(GH_H, y));
}

/** The nearest ghost (showing, not caught) under a point, or null. */
export function ghostAt(s, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const g of s.ghosts) {
    if (g.caught || g.bumped) continue;
    const p = ghostPos(s, g);
    if (p.k < 0.25) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < HIT_R + KINDS[g.kind].size * 0.12 && d < bestD) {
      best = g;
      bestD = d;
    }
  }
  return best;
}

/**
 * The child taps at (x, y). The light goes there too.
 * Returns { result: 'catch' | 'friend' | 'dark' | 'empty', points, kind }.
 * 'dark': something is there but we can't see who yet - shine the light first.
 */
export function tapGhost(s, x, y) {
  if (s.status !== 'play') return { result: 'empty', points: 0 };
  aimLight(s, x, y);
  const g = ghostAt(s, x, y);
  if (!g) return { result: 'empty', points: 0 };
  const p = ghostPos(s, g);
  if (!g.revealed) {
    s.darkTaps += 1;
    s.events.push({ type: 'dark', id: g.id, x: p.x, y: p.y });
    return { result: 'dark', points: 0, kind: g.kind };
  }
  const k = KINDS[g.kind];
  if (!k.ghost) {
    // A friend! Oops - they wave and go
    g.bumped = true;
    g.life = Math.min(g.life, g.t + 0.7);
    s.friends += 1;
    s.score = Math.max(0, s.score - FRIEND_COST);
    s.events.push({ type: 'friend', id: g.id, kind: g.kind, x: p.x, y: p.y, points: -FRIEND_COST });
    return { result: 'friend', points: -FRIEND_COST, kind: g.kind };
  }
  g.caught = true;
  g.caughtAt = g.t;
  g.caughtPos = { x: p.x, y: p.y };
  g.spot.busy = 0;
  s.score += k.points;
  s.catches += 1;
  s.caught[g.kind] += 1;
  s.events.push({ type: 'catch', id: g.id, kind: g.kind, x: p.x, y: p.y, points: k.points });
  return { result: 'catch', points: k.points, kind: g.kind };
}

export const STAR_TWO = 260;
export const STAR_THREE = 540;
export const ghostStars = (s) => starsFor(s.score, STAR_TWO, STAR_THREE);
