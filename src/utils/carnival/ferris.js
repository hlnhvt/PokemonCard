// "Đu quay tìm Pokémon" (ferris wheel hide-and-seek): the child's cabin rides a big wheel; as
// it rises, the view pans up from the fairground over the park and lake, the rooftops, into the
// clouds. Pokemon hide behind trees, chimneys, boats and clouds. Find the 5 on the "Tìm" list
// each ride (tap them). Wrong taps cost a little time. 3 rides: smaller, better hidden, more
// decoys, and it gets darker (sunset, then night). Pure rules; `random` is injectable.
import { starsFor } from './tickets';

export const VIEW_W = 360;
export const VIEW_H = 560;
export const WORLD_H = 1500;
export const TARGETS = 5;
export const RIDES = [
  { time: 42, size: 50, hide: 0.3, decoys: 2, sky: 'day' },
  { time: 42, size: 42, hide: 0.42, decoys: 3, sky: 'sunset' },
  { time: 42, size: 36, hide: 0.52, decoys: 4, sky: 'night' },
];
export const BOARD_TIME = 1.6;
export const BREAK_TIME = 2.6;
export const FOUND_POINTS = 100;
export const BONUS_PER_SECOND = 5;
export const WRONG_COST = 1.2; // seconds of ride
export const HINT_COST = 20;
export const HINT_TIME = 4;

/**
 * Hiding places in the world (y grows downwards, 0 = top of the sky).
 * `r` is the half size of the thing a Pokemon hides behind, `peek` where it may peek out.
 */
export const COVERS = [
  // Sky
  { kind: 'cloud', x: 262, y: 104, r: 34, peek: ['left', 'right', 'top'] },
  { kind: 'cloud', x: 196, y: 200, r: 30, peek: ['right', 'top'] },
  { kind: 'cloud', x: 312, y: 300, r: 32, peek: ['left', 'top'] },
  { kind: 'balloon', x: 232, y: 420, r: 30, peek: ['left', 'right'] },
  // Rooftops
  { kind: 'chimney', x: 208, y: 568, r: 16, peek: ['top'] },
  { kind: 'roof', x: 300, y: 640, r: 38, peek: ['left', 'right', 'top'] },
  { kind: 'chimney', x: 330, y: 752, r: 16, peek: ['top'] },
  { kind: 'roof', x: 220, y: 806, r: 36, peek: ['right', 'top'] },
  { kind: 'chimney', x: 288, y: 894, r: 16, peek: ['top'] },
  // Park and lake
  { kind: 'tree', x: 196, y: 1000, r: 34, peek: ['right', 'top'] },
  { kind: 'tree', x: 318, y: 1036, r: 34, peek: ['left', 'right', 'top'] },
  { kind: 'boat', x: 236, y: 1136, r: 30, peek: ['top'] },
  { kind: 'boat', x: 316, y: 1178, r: 28, peek: ['top'] },
  { kind: 'tree', x: 202, y: 1244, r: 32, peek: ['right', 'top'] },
  // Fairground
  { kind: 'bush', x: 316, y: 1300, r: 28, peek: ['left', 'top'] },
  { kind: 'tent', x: 250, y: 1360, r: 34, peek: ['left', 'right'] },
  { kind: 'bush', x: 330, y: 1430, r: 26, peek: ['top', 'left'] },
];

export const POKEMON_POOL = [
  { name: 'Pikachu', dex: 25 },
  { name: 'Bulbasaur', dex: 1 },
  { name: 'Charmander', dex: 4 },
  { name: 'Squirtle', dex: 7 },
  { name: 'Jigglypuff', dex: 39 },
  { name: 'Meowth', dex: 52 },
  { name: 'Psyduck', dex: 54 },
  { name: 'Eevee', dex: 133 },
  { name: 'Snorlax', dex: 143 },
  { name: 'Togepi', dex: 175 },
  { name: 'Clefairy', dex: 35 },
  { name: 'Mew', dex: 151 },
  { name: 'Gengar', dex: 94 },
  { name: 'Ditto', dex: 132 },
  { name: 'Magikarp', dex: 129 },
  { name: 'Vulpix', dex: 37 },
  { name: 'Marill', dex: 183 },
  { name: 'Pichu', dex: 172 },
];

/** Place a Pokemon of `size` behind a cover, `hide` of it hidden, peeking `dir`. */
export function placeAt(cover, dir, size, hide) {
  const out = cover.r + size * (0.5 - hide); // centre distance from the cover centre
  const vis = cover.r + (size * (1 - hide)) / 2; // centre of the part you can see
  if (dir === 'left') return { x: cover.x - out, y: cover.y, hx: cover.x - vis, hy: cover.y };
  if (dir === 'right') return { x: cover.x + out, y: cover.y, hx: cover.x + vis, hy: cover.y };
  return { x: cover.x, y: cover.y - out, hx: cover.x, hy: cover.y - vis };
}

function shuffle(list, random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeRide(index, random = Math.random, playerName = '') {
  const cfg = RIDES[index];
  const pool = shuffle(
    POKEMON_POOL.filter((p) => p.name.toLowerCase() !== String(playerName).toLowerCase()),
    random
  );
  const covers = shuffle(
    COVERS.map((c, i) => ({ ...c, i })),
    random
  );
  const n = TARGETS + cfg.decoys;
  const spots = [];
  for (let k = 0; k < n; k++) {
    const c = covers[k];
    const who = pool[k];
    const dir = c.peek[Math.floor(random() * c.peek.length)];
    const size = cfg.size * (0.92 + random() * 0.16);
    const at = placeAt(c, dir, size, cfg.hide);
    spots.push({ id: k, ...who, target: k < TARGETS, found: false, cover: c.i, dir, size, ...at, hr: Math.max(24, size * 0.55), seenAt: null, wrongAt: -9 });
  }
  return { index, cfg, spots, targets: spots.filter((p) => p.target).map((p) => p.id) };
}

export function createFerris({ random = Math.random, playerName = '' } = {}) {
  const s = {
    random,
    playerName,
    time: 0,
    rideIndex: 0,
    ride: makeRide(0, random, playerName),
    stage: 'board', // board | ride | break | done
    stageT: 0,
    rideT: 0,
    score: 0,
    found: 0,
    wrong: 0,
    hints: 0,
    hint: null, // { id, t }
    bonus: 0,
    rideResults: [],
    status: 'play',
    events: [],
  };
  s.events.push({ type: 'board', ride: 0 });
  return s;
}

/** Cabin height 0 (bottom) .. 1 (top) for the ride clock: once round the wheel per ride. */
export function heightAt(s) {
  if (s.stage !== 'ride') return 0;
  const k = Math.min(1, s.rideT / s.ride.cfg.time);
  return (1 - Math.cos(k * Math.PI * 2)) / 2;
}
/** World y at the top of the view. */
export const cameraY = (s) => (WORLD_H - VIEW_H) * (1 - heightAt(s));
/** The wheel's angle (radians): the child's cabin starts at the bottom. */
export const wheelAngle = (s) => (s.stage === 'ride' ? Math.min(1, s.rideT / s.ride.cfg.time) * Math.PI * 2 : 0);
export const rideLeft = (s) => (s.stage === 'ride' ? Math.max(0, s.ride.cfg.time - s.rideT) : s.stage === 'board' || s.stage === 'break' ? s.ride.cfg.time : 0);

export function onScreen(s, p, margin = 10) {
  const y = p.hy - cameraY(s);
  return y > margin && y < VIEW_H - margin;
}

export const targetsLeft = (s) => s.ride.spots.filter((p) => p.target && !p.found);

function endRide(s, all) {
  const left = Math.max(0, s.ride.cfg.time - s.rideT);
  const bonus = all ? Math.round(left * BONUS_PER_SECOND) : 0;
  s.score += bonus;
  s.bonus += bonus;
  const found = s.ride.spots.filter((p) => p.target && p.found).length;
  s.rideResults.push({ found, bonus });
  s.stage = 'break';
  s.stageT = 0;
  s.hint = null;
  s.events.push({ type: 'ride-end', ride: s.rideIndex, found, bonus, all });
}

/** Tap the view at (x, y) (canvas coordinates); `cam` is the world y at the top of the view shown. */
export function tapView(s, x, y, cam = cameraY(s)) {
  if (s.status !== 'play' || s.stage !== 'ride') return { result: 'wait' };
  const wy = y + cam;
  let best = null;
  let bestD = Infinity;
  for (const p of s.ride.spots) {
    if (p.found) continue;
    const d = Math.hypot(x - p.hx, wy - p.hy);
    if (d <= p.hr && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  if (best && best.target) {
    best.found = true;
    s.found += 1;
    s.score += FOUND_POINTS;
    if (s.hint?.id === best.id) s.hint = null;
    const left = targetsLeft(s).length;
    s.events.push({ type: 'found', id: best.id, name: best.name, x: best.hx, y: best.hy - cam, points: FOUND_POINTS, left });
    if (left === 0) endRide(s, true);
    return { result: 'found', id: best.id, points: FOUND_POINTS };
  }
  // A Pokemon that is not on the list, or nothing: a little "?" and the ride goes on faster
  s.wrong += 1;
  s.rideT = Math.min(s.ride.cfg.time, s.rideT + WRONG_COST);
  if (best) best.wrongAt = s.time;
  s.events.push({ type: 'wrong', x, y, id: best ? best.id : null, decoy: !!best });
  return { result: best ? 'decoy' : 'miss' };
}

/** Make one target shimmer (costs points). Prefers one on screen now. */
export function askHint(s) {
  if (s.status !== 'play' || s.stage !== 'ride' || s.hint) return null;
  const left = targetsLeft(s);
  if (!left.length) return null;
  const cam = cameraY(s);
  const mid = cam + VIEW_H / 2;
  const pick = left.find((p) => onScreen(s, p, 30)) || [...left].sort((a, b) => Math.abs(a.hy - mid) - Math.abs(b.hy - mid))[0];
  s.hint = { id: pick.id, t: HINT_TIME };
  s.hints += 1;
  s.score = Math.max(0, s.score - HINT_COST);
  s.events.push({ type: 'hint', id: pick.id, cost: HINT_COST, up: pick.hy < cam, down: pick.hy > cam + VIEW_H });
  return pick.id;
}

export function stepFerris(s, dt) {
  if (s.status !== 'play') return s;
  s.time += dt;
  s.stageT += dt;
  if (s.hint) {
    s.hint.t -= dt;
    if (s.hint.t <= 0) s.hint = null;
  }
  if (s.stage === 'board' && s.stageT >= BOARD_TIME) {
    s.stage = 'ride';
    s.stageT = 0;
    s.rideT = 0;
    s.events.push({ type: 'go', ride: s.rideIndex });
  } else if (s.stage === 'ride') {
    s.rideT += dt;
    for (const p of s.ride.spots) if (p.seenAt == null && onScreen(s, p, 20)) p.seenAt = s.time;
    if (s.rideT >= s.ride.cfg.time) endRide(s, false);
  } else if (s.stage === 'break' && s.stageT >= BREAK_TIME) {
    if (s.rideIndex + 1 >= RIDES.length) {
      s.stage = 'done';
      s.status = 'done';
      s.events.push({ type: 'end' });
    } else {
      s.rideIndex += 1;
      s.ride = makeRide(s.rideIndex, s.random, s.playerName);
      s.stage = 'board';
      s.stageT = 0;
      s.rideT = 0;
      s.events.push({ type: 'board', ride: s.rideIndex });
    }
  }
  return s;
}

export const ferrisStars = (s) => starsFor(s.score, 1150, 1780);
