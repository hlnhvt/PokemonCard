// "Đua ngựa Ponyta": the child's Pokemon rides a Ponyta against 3 rivals. A marker sweeps
// across a gauge; tapping in the green zone gives a gallop boost, in the yellow zone a small
// one, outside it the Ponyta stumbles. The green zone narrows and the sweep gets faster as
// the race goes on. Pure rules; `random` is injectable.

export const TRACK = 1500; // race length (track units)
export const BASE_SPEED = 44; // a Ponyta that is never pushed
export const MAX_SURGE = 52;
export const SURGE_DECAY = 1.15; // per second (exponential)
export const IMPULSE = { green: 21, yellow: 11 };
export const STUMBLE_TIME = 0.45;
export const STUMBLE_SLOW = 0.55; // speed multiplier while stumbling
export const TAP_COOLDOWN = 0.18;

/** Rivals: dex numbers for the images, cruise speed and how often they surge. */
export const RIVALS = [
  { id: 'rapidash', name: 'Rapidash', dex: 78, cruise: 60, surge: 15 },
  { id: 'ponyta2', name: 'Ponyta', dex: 77, cruise: 53, surge: 13 },
  { id: 'mudsdale', name: 'Mudsdale', dex: 750, cruise: 45, surge: 14 },
];

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** How far the child is through the race, 0..1 (drives the difficulty). */
export const pace = (s) => clamp01(s.riders[0].dist / TRACK);
/** Half widths of the zones (the gauge goes 0..1, the zones are centred on 0.5). */
export const greenHalf = (s) => 0.15 - 0.07 * pace(s);
export const yellowHalf = (s) => greenHalf(s) + 0.17;
/** Marker speed, gauge widths per second. */
export const sweepSpeed = (s) => 1.05 + 0.85 * pace(s);

export function zoneOf(s, pos = s.marker) {
  const d = Math.abs(pos - 0.5);
  return d <= greenHalf(s) ? 'green' : d <= yellowHalf(s) ? 'yellow' : 'miss';
}

export function createPonyta({ random = Math.random } = {}) {
  const riders = [
    { id: 'player', isPlayer: true, lane: 3, dist: 0, speed: BASE_SPEED, surge: 0, stumble: 0, place: 0, boostT: 0 },
    ...RIVALS.map((r, i) => ({ id: r.id, isPlayer: false, lane: i, dist: 0, speed: r.cruise, surge: 0, stumble: 0, place: 0, boostT: 0, cruise: r.cruise, burst: r.surge, next: 1 + random() * 2 })),
  ];
  return { random, time: 0, status: 'play', marker: 0, dir: 1, cooldown: 0, riders, finished: 0, place: 0, streak: 0, bestStreak: 0, taps: { green: 0, yellow: 0, miss: 0 }, events: [] };
}

export const playerOf = (s) => s.riders[0];

/** Live places: 1 = in front. Finished riders keep their finishing place. */
export function standings(s) {
  return [...s.riders].sort((a, b) => (a.place && b.place ? a.place - b.place : a.place ? -1 : b.place ? 1 : b.dist - a.dist)).map((r) => r.id);
}
export const placeOf = (s) => s.place || standings(s).indexOf('player') + 1;

function moveRival(s, r, dt) {
  const me = playerOf(s);
  r.next -= dt;
  if (r.next <= 0) {
    // A random surge: gallop faster for a moment
    r.boostT = 0.8 + s.random() * 0.9;
    r.next = 1.8 + s.random() * 2.6;
    s.events.push({ type: 'surge', rider: r.id });
  }
  r.boostT = Math.max(0, r.boostT - dt);
  // A little rubber band so the race stays close and exciting
  const gap = r.dist - me.dist;
  const band = me.place ? 1 : 1 - Math.max(-0.1, Math.min(0.1, gap / 900));
  const target = (r.cruise + (r.boostT > 0 ? r.burst : 0)) * band;
  r.speed += (target - r.speed) * Math.min(1, dt * 2.5);
}

export function stepPonyta(s, dt) {
  s.time += dt;
  // The marker sweeps back and forth
  if (s.status === 'play') {
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.marker += s.dir * sweepSpeed(s) * dt;
    if (s.marker >= 1) {
      s.marker = 2 - s.marker;
      s.dir = -1;
    } else if (s.marker <= 0) {
      s.marker = -s.marker;
      s.dir = 1;
    }
  }
  for (const r of s.riders) {
    if (r.isPlayer) {
      r.surge *= Math.exp(-SURGE_DECAY * dt);
      r.stumble = Math.max(0, r.stumble - dt);
      r.boostT = Math.max(0, r.boostT - dt);
      r.speed = (BASE_SPEED + r.surge) * (r.stumble > 0 ? STUMBLE_SLOW : 1) * (r.place ? 0.85 : 1);
    } else moveRival(s, r, dt);
    r.dist += r.speed * dt;
    if (!r.place && r.dist >= TRACK) {
      s.finished += 1;
      r.place = s.finished;
      s.events.push({ type: 'finish', rider: r.id, place: r.place });
      if (r.isPlayer) {
        s.place = r.place;
        s.status = 'done';
        s.events.push({ type: 'end', place: r.place });
      }
    }
  }
  return s;
}

/** The child taps. Returns { result: 'green' | 'yellow' | 'miss' | 'none' }. */
export function gallop(s) {
  if (s.status !== 'play' || s.cooldown > 0) return { result: 'none' };
  const me = playerOf(s);
  const result = zoneOf(s);
  s.cooldown = TAP_COOLDOWN;
  s.taps[result] += 1;
  if (result === 'miss') {
    me.stumble = STUMBLE_TIME;
    me.surge *= 0.7;
    s.streak = 0;
  } else {
    s.streak = result === 'green' ? s.streak + 1 : 0;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    // Three perfect taps in a row gallop a bit harder
    const bonus = result === 'green' && s.streak >= 3 ? 1.15 : 1;
    me.surge = Math.min(MAX_SURGE, me.surge + IMPULSE[result] * bonus);
    me.boostT = result === 'green' ? 0.7 : 0.35;
  }
  s.events.push({ type: 'tap', result, streak: s.streak });
  return { result };
}

/** 1st = 3 stars, 2nd = 2, otherwise 1. */
export const ponytaStars = (place) => (place === 1 ? 3 : place === 2 ? 2 : 1);
