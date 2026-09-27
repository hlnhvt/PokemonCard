// "Câu cá Magikarp": tap the pond to cast; a fish comes, nibbles (the bobber twitches), then
// bites (the bobber dips under). Tap during the bite to hook it; tapping on a nibble scares it
// away. Rarer fish bite for a shorter moment. 60 seconds. Pure rules (canvas 360x560).
import { starsFor } from './tickets';

export const FISH_W = 360;
export const FISH_H = 560;
export const DURATION = 60;
export const POND = { x: 180, y: 262, rx: 172, ry: 166 };
export const ROD_TIP = { x: 118, y: 418 };
export const FISH_COUNT = 5;
export const CAST_TIME = 0.5;
export const REEL_TIME = 1.0;
export const ATTRACT = 130;

export const FISH_KINDS = {
  magikarp: { dex: 129, name: 'Magikarp', points: 10, weight: 50, speed: 34, size: 46, window: 0.9, nibbles: [1, 2] },
  goldeen: { dex: 118, name: 'Goldeen', points: 20, weight: 28, speed: 44, size: 46, window: 0.75, nibbles: [1, 3] },
  gyarados: { dex: 130, name: 'Gyarados', points: 50, weight: 8, speed: 26, size: 78, window: 0.6, nibbles: [2, 3], rare: true },
  boot: { name: 'Chiếc ủng cũ', points: 0, weight: 14, speed: 12, size: 34, window: 1.0, nibbles: [0, 1], junk: true },
};
const KIND_LIST = Object.keys(FISH_KINDS);

/** Inside the pond (with a margin), in canvas coordinates. */
export const inPond = (x, y, margin = 0) => ((x - POND.x) / (POND.rx - margin)) ** 2 + ((y - POND.y) / (POND.ry - margin)) ** 2 <= 1;

function pickKind(random) {
  const total = KIND_LIST.reduce((n, k) => n + FISH_KINDS[k].weight, 0);
  let r = random() * total;
  for (const k of KIND_LIST) {
    r -= FISH_KINDS[k].weight;
    if (r < 0) return k;
  }
  return 'magikarp';
}

function spawnFish(s) {
  const r = s.random;
  let x = POND.x;
  let y = POND.y;
  for (let i = 0; i < 20; i++) {
    x = POND.x + (r() * 2 - 1) * POND.rx;
    y = POND.y + (r() * 2 - 1) * POND.ry;
    if (inPond(x, y, 30)) break;
  }
  // Keep a nicer fish in the pond now and then, so there is always something to aim for
  const nice = s.fish.some((f) => f.kind === 'goldeen' || f.kind === 'gyarados');
  const kind = !nice && r() < 0.6 ? 'goldeen' : pickKind(r);
  const fish = { id: s.nextId++, kind, x, y, heading: r() * Math.PI * 2, turn: 0, state: 'swim', t: 0, fade: 0, shy: 0, nibbles: 0, phase: r() * 6.28 };
  s.fish.push(fish);
  return fish;
}

export function createFishing({ random = Math.random } = {}) {
  const s = { random, time: 0, fish: [], nextId: 1, bobber: null, score: 0, catches: [], early: 0, missed: 0, casts: 0, respawn: [], status: 'play', events: [] };
  for (let i = 0; i < FISH_COUNT; i++) spawnFish(s).fade = 1;
  // Always something nice to see at the start
  if (!s.fish.some((f) => f.kind === 'goldeen' || f.kind === 'gyarados')) s.fish[0].kind = 'goldeen';
  return s;
}

export const timeLeft = (s) => Math.max(0, DURATION - s.time);
export const fishingStars = (s) => starsFor(s.score, 60, 130);
export const engaged = (s) => (s.bobber?.fish ? s.fish.find((f) => f.id === s.bobber.fish) || null : null);

function cast(s, x, y) {
  s.casts += 1;
  s.bobber = { x, y, from: { ...ROD_TIP }, state: 'fly', t: 0, fish: null, wait: 0, lure: 0.4 + s.random() * 0.7, twitch: 0, dip: 0 };
  s.events.push({ type: 'cast', x, y });
}

function release(s, f, type) {
  // The fish swims off and stays shy for a while
  f.state = 'flee';
  f.t = 0;
  f.shy = 3;
  if (s.bobber) f.heading = Math.atan2(f.y - s.bobber.y, f.x - s.bobber.x);
  if (s.bobber) s.bobber.fish = null;
  if (s.bobber) {
    s.bobber.wait = 0;
    s.bobber.lure = 0.6 + s.random() * 0.8;
    s.bobber.dip = 0;
  }
  s.events.push({ type, id: f.id, kind: f.kind });
}

/**
 * The child taps the pond at (x, y). Returns what happened:
 * 'cast' | 'hook' | 'early' | 'busy' | 'land' (tapped outside the water).
 */
export function tapPond(s, x, y) {
  if (s.status !== 'play') return 'busy';
  const b = s.bobber;
  if (b && (b.state === 'fly' || b.state === 'reel')) return 'busy';
  const f = b ? engaged(s) : null;
  if (f && f.state === 'bite') {
    f.state = 'hooked';
    f.t = 0;
    b.state = 'reel';
    b.t = 0;
    b.dip = 0;
    s.events.push({ type: 'hook', id: f.id, kind: f.kind, x: b.x, y: b.y });
    return 'hook';
  }
  if (f && f.state === 'nibble') {
    s.early += 1;
    release(s, f, 'early');
    return 'early';
  }
  if (!inPond(x, y, 14)) return 'land';
  if (f) {
    f.state = 'swim';
    f.shy = 1;
  }
  cast(s, x, y);
  return 'cast';
}

function steer(f, tx, ty, rate, dt) {
  const want = Math.atan2(ty - f.y, tx - f.x);
  let d = want - f.heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  f.heading += Math.max(-rate * dt, Math.min(rate * dt, d));
}

function stepFish(s, f, dt) {
  const k = FISH_KINDS[f.kind];
  const b = s.bobber;
  f.t += dt;
  f.shy = Math.max(0, f.shy - dt);
  f.fade = Math.min(1, f.fade + dt * 1.5);
  let speed = k.speed;
  switch (f.state) {
    case 'swim': {
      f.turn += (s.random() - 0.5) * dt * 3;
      f.turn = Math.max(-0.9, Math.min(0.9, f.turn));
      f.heading += f.turn * dt;
      if (!inPond(f.x, f.y, 34)) steer(f, POND.x, POND.y, 2.5, dt);
      break;
    }
    case 'approach': {
      speed = k.speed * 1.6;
      steer(f, b.x, b.y, 4, dt);
      const d = Math.hypot(b.x - f.x, b.y - f.y);
      if (d < 18) {
        f.state = 'nibble';
        f.t = 0;
        const [lo, hi] = k.nibbles;
        f.nibbles = lo + Math.floor(s.random() * (hi - lo + 1));
        f.next = 0.5 + s.random() * 0.4;
      }
      break;
    }
    case 'nibble':
    case 'bite': {
      // Nose at the bobber, tail waving
      speed = 0;
      steer(f, b.x, b.y, 6, dt);
      const back = 16 + Math.sin(f.t * 10) * 1.5;
      f.x += (b.x - Math.cos(f.heading) * back - f.x) * Math.min(1, dt * 6);
      f.y += (b.y - Math.sin(f.heading) * back - f.y) * Math.min(1, dt * 6);
      if (f.state === 'nibble') {
        f.next -= dt;
        if (f.next <= 0) {
          if (f.nibbles > 0) {
            f.nibbles -= 1;
            f.next = 0.5 + s.random() * 0.5;
            b.twitch = 0.28;
            s.events.push({ type: 'nibble', id: f.id, kind: f.kind, x: b.x, y: b.y });
          } else {
            f.state = 'bite';
            f.t = 0;
            b.dip = 1;
            s.events.push({ type: 'bite', id: f.id, kind: f.kind, x: b.x, y: b.y, window: k.window });
          }
        }
      } else if (f.t >= k.window) {
        s.missed += 1;
        release(s, f, 'escape');
      }
      break;
    }
    case 'flee':
      speed = k.speed * 3;
      if (!inPond(f.x, f.y, 34)) steer(f, POND.x, POND.y, 3, dt);
      if (f.t > 1.2) {
        f.state = 'swim';
        f.t = 0;
      }
      break;
    case 'hooked': {
      // Pulled out along an arc towards the bank
      speed = 0;
      const p = Math.min(1, f.t / REEL_TIME);
      f.x = b.x + (ROD_TIP.x - b.x) * p;
      f.y = b.y + (ROD_TIP.y - 40 - b.y) * p - Math.sin(p * Math.PI) * 110;
      break;
    }
    default:
      break;
  }
  if (speed) {
    f.x += Math.cos(f.heading) * speed * dt;
    f.y += Math.sin(f.heading) * speed * dt;
  }
}

function stepBobber(s, dt) {
  const b = s.bobber;
  if (!b) return;
  b.t += dt;
  b.twitch = Math.max(0, b.twitch - dt);
  if (b.state === 'fly') {
    if (b.t >= CAST_TIME) {
      b.state = 'float';
      b.t = 0;
      s.events.push({ type: 'splash', x: b.x, y: b.y });
    }
    return;
  }
  if (b.state === 'reel') {
    if (b.t >= REEL_TIME) {
      const f = engaged(s);
      const k = FISH_KINDS[f.kind];
      s.score += k.points;
      s.catches.push(f.kind);
      s.fish = s.fish.filter((x) => x !== f);
      s.respawn.push(0.8 + s.random() * 1.2);
      s.bobber = null;
      s.events.push({ type: 'catch', kind: f.kind, points: k.points, rare: !!k.rare, junk: !!k.junk });
    }
    return;
  }
  // Floating: after a moment, a fish nearby gets curious
  if (!b.fish) {
    b.wait += dt;
    if (b.wait >= b.lure) {
      const free = s.fish.filter((f) => f.state === 'swim' && f.shy <= 0 && f.fade >= 1);
      let best = null;
      for (const f of free) {
        const d = Math.hypot(f.x - b.x, f.y - b.y);
        if ((d < ATTRACT || b.wait > 2.5) && (!best || d < best.d)) best = { f, d };
      }
      if (best) {
        best.f.state = 'approach';
        best.f.t = 0;
        b.fish = best.f.id;
        s.events.push({ type: 'approach', id: best.f.id, kind: best.f.kind });
      }
    }
  }
}

/** Advance the pond by dt seconds. */
export function stepFishing(s, dt) {
  if (s.status !== 'play') return s;
  s.time += dt;
  for (const f of s.fish) stepFish(s, f, dt);
  stepBobber(s, dt);
  for (let i = s.respawn.length - 1; i >= 0; i--) {
    s.respawn[i] -= dt;
    if (s.respawn[i] <= 0) {
      s.respawn.splice(i, 1);
      spawnFish(s);
    }
  }
  if (s.time >= DURATION && s.bobber?.state !== 'reel') {
    s.status = 'done';
    s.events.push({ type: 'end' });
  }
  return s;
}
