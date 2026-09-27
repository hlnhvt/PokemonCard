// "Súng nước Squirtle": a water gun race. Four stations; each one sprays water at a Pokeball
// target that slides left and right, and while the stream hits the target that station's balloon
// grows. The first balloon to pop wins the race. The child holds to spray and drags to aim; three
// rivals spray at their own (random) pace. 3 races, the target moves faster each time.
// Positions along the target's rail are -1..1. Pure rules; `random` is injectable.
import { starsFor } from './tickets';

export const RACES = 3;
export const HIT_W = 0.24; // how close the stream must be to the target's middle
export const FILL_TIME = 5.2; // seconds of hitting to pop a balloon
export const TARGET_SPEED = [0.6, 0.8, 1.0];
export const INTRO_TIME = 1.5;
export const FINISH_TIME = 2.6;
export const RIVAL_POOL = [
  { name: 'Psyduck', dex: 54 },
  { name: 'Bulbasaur', dex: 1 },
  { name: 'Charmander', dex: 4 },
  { name: 'Pikachu', dex: 25 },
  { name: 'Eevee', dex: 133 },
  { name: 'Jigglypuff', dex: 39 },
];
// How often the rivals hit (before a little randomness), a bit better each race
const RIVAL_SKILL = [0.36, 0.44, 0.52];
const RIVAL_BOOST = [0, 0.03, 0.06];
const RIVAL_TICK = 0.14;

const shuffle = (list, r) => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function createWaterGun({ random = Math.random, playerName = '' } = {}) {
  const r = random;
  const pool = RIVAL_POOL.filter((p) => p.name.toLowerCase() !== String(playerName).toLowerCase());
  const skills = shuffle(RIVAL_SKILL, r);
  const rivals = shuffle(pool, r)
    .slice(0, 3)
    .map((p, i) => ({ ...p, skill: skills[i] + (r() - 0.5) * 0.06, hitting: false, tick: r() * RIVAL_TICK, wave: r() * 6, aim: 0 }));
  const s = {
    random,
    time: 0,
    race: 0,
    phase: 'intro', // intro | race | finish | done
    t: 0,
    rivals,
    aim: 0,
    impact: 0,
    spraying: false,
    hitting: false,
    target: { x: 0, a: 0, b: 0, spin: 0 },
    fill: [0, 0, 0, 0], // 0 is the child
    winner: null,
    places: [],
    hitTime: 0,
    sprayTime: 0,
    events: [],
  };
  startRace(s, 0);
  return s;
}

function startRace(s, race) {
  const r = s.random;
  s.race = race;
  s.phase = 'intro';
  s.t = 0;
  s.fill = [0, 0, 0, 0];
  s.winner = null;
  s.target = { x: 0, a: r() * Math.PI * 2, b: r() * Math.PI * 2, spin: 0 };
  s.target.x = targetX(s.target);
  s.impact = s.aim;
  s.events.push({ type: 'intro', race });
}

const targetX = (t) => 0.7 * Math.sin(t.a) + 0.2 * Math.sin(t.b);

/** Drag to aim (-1..1 along the rail). */
export function setAim(s, x) {
  s.aim = Math.max(-1, Math.min(1, x));
}

/** Hold to spray. */
export function setSpray(s, on) {
  if (s.spraying === !!on) return;
  s.spraying = !!on;
  if (on && s.phase === 'race') s.events.push({ type: 'spray' });
}

/** The child's place (1..4) from the balloons now: ties go to the child. */
export function placeOf(s) {
  return 1 + s.fill.slice(1).filter((f) => f > s.fill[0]).length;
}

function finish(s, winner) {
  s.phase = 'finish';
  s.t = 0;
  s.winner = winner;
  const place = winner === 0 ? 1 : placeOf(s);
  s.places.push(place);
  s.events.push({ type: 'pop', who: winner });
  s.events.push({ type: 'finish', race: s.race, place, winner });
}

export function stepWaterGun(s, dt) {
  if (s.phase === 'done') return s;
  s.time += dt;
  s.t += dt;
  const tg = s.target;
  if (s.phase === 'intro') {
    tg.spin *= Math.max(0, 1 - dt * 3);
    if (s.t >= INTRO_TIME) {
      s.phase = 'race';
      s.t = 0;
      s.events.push({ type: 'go', race: s.race });
    }
    return s;
  }
  if (s.phase === 'finish') {
    tg.spin *= Math.max(0, 1 - dt * 2);
    if (s.t >= FINISH_TIME) {
      if (s.race + 1 >= RACES) {
        s.phase = 'done';
        s.events.push({ type: 'end' });
      } else startRace(s, s.race + 1);
    }
    return s;
  }
  // The target slides (two waves so it is not too regular)
  const w = TARGET_SPEED[s.race];
  tg.a += dt * w * 1.6;
  tg.b += dt * w * 2.9;
  tg.x = targetX(tg);
  // Water takes a moment to follow the nozzle
  s.impact += (s.aim - s.impact) * Math.min(1, dt * 20);
  const was = s.hitting;
  s.hitting = s.spraying && Math.abs(s.impact - tg.x) < HIT_W;
  if (s.spraying) s.sprayTime += dt;
  if (s.hitting) {
    s.hitTime += dt;
    tg.spin = Math.min(14, tg.spin + dt * 40);
    const before = s.fill[0];
    s.fill[0] = Math.min(1, s.fill[0] + dt / FILL_TIME);
    const step = Math.floor(s.fill[0] * 4);
    if (step > Math.floor(before * 4) && step < 4) s.events.push({ type: 'grow', who: 0, level: step });
  } else tg.spin *= Math.max(0, 1 - dt * 1.5);
  if (s.hitting && !was) s.events.push({ type: 'hit' });
  // Rivals
  s.rivals.forEach((rv, i) => {
    rv.tick -= dt;
    if (rv.tick <= 0) {
      rv.tick += RIVAL_TICK;
      const f = Math.max(0.1, Math.min(0.95, rv.skill + RIVAL_BOOST[s.race] + 0.2 * Math.sin(s.time * 0.9 + rv.wave)));
      rv.hitting = s.random() < f;
    }
    // Where its stream is, for the picture: on the target when hitting, just off it when not
    const want = rv.hitting ? tg.x : tg.x + (Math.sin(s.time * 3 + rv.wave) > 0 ? 0.45 : -0.45);
    rv.aim += (want - rv.aim) * Math.min(1, dt * 8);
    if (rv.hitting) s.fill[i + 1] = Math.min(1, s.fill[i + 1] + dt / FILL_TIME);
  });
  // First to pop wins (the child wins a tie)
  if (s.fill[0] >= 1) finish(s, 0);
  else {
    const top = s.fill.findIndex((f, i) => i > 0 && f >= 1);
    if (top > 0) finish(s, top);
  }
  return s;
}

/** Points from places: 1st 3, 2nd 2, 3rd 1, 4th 0. */
export const placePoints = (s) => s.places.reduce((a, p) => a + Math.max(0, 4 - p), 0);
export const WATER_TWO = 4;
export const WATER_THREE = 7;
export const waterStars = (s) => starsFor(placePoints(s), WATER_TWO, WATER_THREE);
export const wins = (s) => s.places.filter((p) => p === 1).length;
