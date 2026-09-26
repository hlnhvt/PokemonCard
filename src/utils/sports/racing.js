// Motorbike race: 4 riders on a 3-lane road. Oil slows you, cones knock you back,
// arrows boost you. Opponents avoid most obstacles and stay close (rubber-banding).
import { clamp } from './common';

export const LANES = 3;
export const TRACK = 4200;
export const PLAYER_SPEED = 155;
export const OPPONENT_SPEEDS = [140, 146, 151];
export const COUNTDOWN = 3;
export const LANE_CHANGE_SPEED = 5; // lanes per second
export const EFFECTS = {
  oil: { factor: 0.55, time: 1.2 },
  cone: { factor: 0.45, time: 0.9 },
  boost: { factor: 1.55, time: 1.4 },
};
// Opponents dodge this share of obstacles and grab this share of boosts
export const AI_AVOID = 0.72;
export const AI_SEEK_BOOST = 0.4;
const HIT_RANGE = 22;
const LOOK_AHEAD = 130;

function makeItems(random) {
  const items = [];
  let y = 320;
  while (y < TRACK - 160) {
    const r = random();
    items.push({ id: items.length, y, lane: Math.floor(random() * LANES), type: r < 0.36 ? 'oil' : r < 0.7 ? 'cone' : 'boost' });
    y += 170 + random() * 110;
  }
  return items;
}

function makeRider(id, lane, baseSpeed, isPlayer) {
  return { id, isPlayer, lane, x: lane, dist: 0, baseSpeed, effect: null, effectLeft: 0, hitItems: new Set(), decided: new Map(), finishedAt: null, wobble: 0 };
}

export function createRace({ random = Math.random } = {}) {
  return {
    random,
    time: -COUNTDOWN,
    items: makeItems(random),
    riders: [
      makeRider('player', 1, PLAYER_SPEED, true),
      ...OPPONENT_SPEEDS.map((s, i) => makeRider(`cpu${i}`, [0, 2, 1][i], s, false)),
    ],
    finished: [],
    done: false,
    events: [],
  };
}

export const player = (race) => race.riders[0];

export function steer(race, direction) {
  const p = player(race);
  p.lane = clamp(p.lane + direction, 0, LANES - 1);
}

function currentSpeed(race, rider) {
  let speed = rider.baseSpeed;
  if (!rider.isPlayer) {
    // Rubber band: opponents far ahead ease off, those far behind push a little
    const gap = player(race).dist - rider.dist;
    speed *= 1 + clamp(gap / 700, -0.14, 0.05);
  }
  if (rider.effect) speed *= EFFECTS[rider.effect].factor;
  return speed;
}

function aiSteer(race, rider) {
  const { random } = race;
  const ahead = race.items.filter((it) => it.y > rider.dist && it.y - rider.dist < LOOK_AHEAD && !it.gone);
  for (const it of ahead) {
    if (!rider.decided.has(it.id)) {
      rider.decided.set(it.id, it.type === 'boost' ? random() < AI_SEEK_BOOST : random() < AI_AVOID);
    }
    const wants = rider.decided.get(it.id);
    if (it.type === 'boost' && wants && it.lane !== rider.lane) rider.lane = it.lane;
    if (it.type !== 'boost' && wants && it.lane === rider.lane) {
      const options = [rider.lane - 1, rider.lane + 1].filter((l) => l >= 0 && l < LANES && !ahead.some((o) => o.lane === l && o.type !== 'boost'));
      if (options.length) rider.lane = options[Math.floor(random() * options.length)];
    }
  }
}

/** Advance the race by dt seconds. Events: 'go', 'oil', 'cone', 'boost', 'finish'. */
export function stepRace(race, dt) {
  if (race.done) return race;
  const before = race.time;
  race.time += dt;
  if (before < 0 && race.time >= 0) race.events.push({ type: 'go' });
  if (race.time < 0) return race;

  for (const r of race.riders) {
    if (r.finishedAt != null) continue;
    if (!r.isPlayer) aiSteer(race, r);
    // Smooth lane change
    const diff = r.lane - r.x;
    r.x += clamp(diff, -LANE_CHANGE_SPEED * dt, LANE_CHANGE_SPEED * dt);
    r.wobble = Math.max(0, r.wobble - dt);

    r.dist += currentSpeed(race, r) * dt;
    if (r.effect) {
      r.effectLeft -= dt;
      if (r.effectLeft <= 0) r.effect = null;
    }

    const laneNow = Math.round(r.x);
    for (const it of race.items) {
      if (it.gone || r.hitItems.has(it.id) || Math.abs(it.y - r.dist) > HIT_RANGE) continue;
      if (it.lane !== laneNow || Math.abs(r.x - laneNow) > 0.35) continue;
      r.hitItems.add(it.id);
      r.effect = it.type;
      r.effectLeft = EFFECTS[it.type].time;
      if (it.type !== 'boost') r.wobble = 0.6;
      if (it.type === 'cone') it.gone = true; // knocked off the road
      race.events.push({ type: it.type, rider: r.id });
    }

    if (r.dist >= TRACK) {
      r.finishedAt = race.time;
      r.dist = TRACK;
      race.finished.push(r.id);
      race.events.push({ type: 'finish', rider: r.id, place: race.finished.length });
    }
  }
  if (player(race).finishedAt != null) race.done = true;
  return race;
}

/** 1-based positions: finished riders by finishing order, then by distance. */
export function standings(race) {
  const order = [...race.riders].sort((a, b) => {
    const fa = race.finished.indexOf(a.id);
    const fb = race.finished.indexOf(b.id);
    if (fa !== -1 || fb !== -1) return (fa === -1 ? 99 : fa) - (fb === -1 ? 99 : fb);
    return b.dist - a.dist;
  });
  return order.map((r) => r.id);
}

export function placeOf(race, id = 'player') {
  return standings(race).indexOf(id) + 1;
}
