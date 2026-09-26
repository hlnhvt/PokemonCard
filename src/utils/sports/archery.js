// "Bắn trúng đích": two Pokemon take turns firing their skill at a target board, 5 rounds
// each. The crosshair sways a little, the wind pushes the shot, and from round 3 the board
// slides. Rings score 10 (centre) to 1; the higher total wins. Pure rules.

export const ARCH_W = 360;
export const ARCH_H = 560;
export const ROUNDS = 5;
export const FLIGHT_TIME = 0.7;
export const WIND_PUSH = 28; // pixels of drift at full wind
const RADIUS = [96, 88, 80, 74, 68];
const SLIDE = [0, 0, 55, 75, 90]; // board slides left-right from round 3
const SLIDE_SPEED = [0, 0, 0.9, 1.1, 1.3];
export const TARGET_Y = 235;

const pickWind = (random, round) => {
  const w = (random() * 2 - 1) * Math.min(1, 0.45 + round * 0.14);
  return Math.round(w * 10) / 10;
};

export function targetAt(round, t) {
  const r = Math.min(round, ROUNDS - 1);
  return { x: ARCH_W / 2 + SLIDE[r] * Math.sin(t * SLIDE_SPEED[r] * Math.PI), y: TARGET_Y, r: RADIUS[r] };
}

/** How the crosshair drifts on its own (a steady hand is not perfect): grows each round. */
export function sway(t, round) {
  const a = 5 + round * 1.6;
  return { x: Math.sin(t * 1.9) * a + Math.sin(t * 4.3) * a * 0.3, y: Math.cos(t * 1.5) * a * 0.8 + Math.sin(t * 3.7) * a * 0.25 };
}

export function ringScore(d, r) {
  if (d >= r) return 0;
  return Math.max(1, 10 - Math.floor(d / (r / 10)));
}

export function createArchery({ random = Math.random } = {}) {
  return {
    random,
    round: 0,
    turn: 'player',
    shots: { player: [], rival: [] },
    wind: pickWind(random, 0),
    time: 0,
    flight: null,
    status: 'aim', // aim | flying | done
    events: [],
  };
}

export const totals = (s) => ({
  player: s.shots.player.reduce((a, x) => a + x.score, 0),
  rival: s.shots.rival.reduce((a, x) => a + x.score, 0),
});

/** Fire at `aim` (the crosshair, sway included). The wind pushes it sideways in flight. */
export function shoot(s, aim) {
  if (s.status !== 'aim') return false;
  const to = { x: aim.x + s.wind * WIND_PUSH, y: aim.y + Math.abs(s.wind) * 4 };
  s.flight = { who: s.turn, from: { x: s.turn === 'player' ? ARCH_W * 0.3 : ARCH_W * 0.7, y: ARCH_H - 40 }, to, t: 0, dur: FLIGHT_TIME };
  s.status = 'flying';
  s.events.push({ type: 'shoot', who: s.turn });
  return true;
}

export function stepArchery(s, dt) {
  s.time += dt;
  if (s.status !== 'flying') return s;
  const f = s.flight;
  f.t += dt;
  if (f.t < f.dur) return s;
  const tg = targetAt(s.round, s.time);
  const d = Math.hypot(f.to.x - tg.x, f.to.y - tg.y);
  const score = ringScore(d, tg.r);
  // Where it stuck, relative to the board (so the mark slides with it)
  const shot = { score, dx: f.to.x - tg.x, dy: f.to.y - tg.y, round: s.round };
  s.shots[f.who].push(shot);
  s.events.push({ type: 'hit', who: f.who, score, x: f.to.x, y: f.to.y, bull: score === 10 });
  s.flight = null;
  if (f.who === 'player') {
    s.turn = 'rival';
    s.status = 'aim';
  } else if (s.round + 1 >= ROUNDS) {
    s.status = 'done';
    const t = totals(s);
    s.events.push({ type: 'end', result: t.player > t.rival ? 'win' : t.player < t.rival ? 'lose' : 'draw' });
  } else {
    s.round += 1;
    s.turn = 'player';
    s.wind = pickWind(s.random, s.round);
    s.status = 'aim';
    s.events.push({ type: 'round', round: s.round });
  }
  return s;
}

/**
 * The rival's crosshair: leads a sliding board, corrects most of the wind, and misses by a
 * random amount that grows each round.
 */
export function rivalAim(s) {
  const r = s.random;
  const lead = targetAt(s.round, s.time + FLIGHT_TIME);
  const correct = 0.45 + r() * 0.45;
  const spread = 27 + s.round * 4;
  const g = () => (r() + r() + r() - 1.5) * spread;
  return { x: lead.x - s.wind * WIND_PUSH * correct + g(), y: lead.y + g() };
}
