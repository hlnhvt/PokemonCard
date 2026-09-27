// "Đập Diglett" (whack-a-mole): Diglett pop out of 9 holes, tap them before they hide.
// Golden Diglett are worth more; Voltorb (it looks like a Pokeball!) must NOT be tapped.
// It gets faster as time goes on. Pure rules; `random` is injectable.
import { starsFor } from './tickets';

export const HOLES = 9;
export const DURATION = 40;
export const POINTS = { diglett: 10, golden: 30, voltorb: -40 };

const pace = (s) => Math.min(1, s.time / DURATION);
const upTime = (s) => 1.45 - pace(s) * 0.7; // how long one stays up
const gap = (s) => 0.95 - pace(s) * 0.5; // time between two popping up

export function createWhack({ random = Math.random } = {}) {
  return { random, time: 0, holes: Array(HOLES).fill(null), score: 0, combo: 0, best: 0, hits: 0, missed: 0, bombs: 0, nextSpawn: 0.6, nextId: 1, status: 'play', events: [] };
}

export const timeLeft = (s) => Math.max(0, DURATION - s.time);

function spawn(s) {
  const r = s.random;
  const free = s.holes.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0);
  const busy = HOLES - free.length;
  if (!free.length || busy >= 3) return;
  const hole = free[Math.floor(r() * free.length)];
  const roll = r();
  const kind = roll < 0.09 ? 'golden' : roll < 0.23 ? 'voltorb' : 'diglett';
  const life = upTime(s) * (kind === 'golden' ? 0.7 : 1);
  s.holes[hole] = { id: s.nextId++, kind, t: 0, life, hit: false };
  s.events.push({ type: 'up', hole, kind });
}

export function stepWhack(s, dt) {
  if (s.status !== 'play') return s;
  s.time += dt;
  s.nextSpawn -= dt;
  if (s.nextSpawn <= 0) {
    spawn(s);
    // Sometimes two at once later in the game
    if (pace(s) > 0.4 && s.random() < 0.25) spawn(s);
    s.nextSpawn = gap(s) * (0.7 + s.random() * 0.6);
  }
  s.holes.forEach((h, i) => {
    if (!h) return;
    h.t += dt;
    // A hit one stays a moment (dizzy stars), then goes
    if (h.t >= (h.hit ? h.hitAt + 0.35 : h.life)) {
      if (!h.hit && h.kind !== 'voltorb') {
        s.missed += 1;
        s.combo = 0;
        s.events.push({ type: 'escaped', hole: i });
      }
      s.holes[i] = null;
    }
  });
  if (s.time >= DURATION) {
    s.status = 'done';
    s.events.push({ type: 'end' });
  }
  return s;
}

/** The child taps hole `i`. Returns { result: 'hit' | 'boom' | 'empty', points }. */
export function whack(s, i) {
  const h = s.holes[i];
  if (s.status !== 'play' || !h || h.hit) return { result: 'empty', points: 0 };
  h.hit = true;
  h.hitAt = h.t;
  if (h.kind === 'voltorb') {
    s.score = Math.max(0, s.score + POINTS.voltorb);
    s.combo = 0;
    s.bombs += 1;
    s.events.push({ type: 'boom', hole: i });
    return { result: 'boom', points: POINTS.voltorb };
  }
  s.combo += 1;
  s.best = Math.max(s.best, s.combo);
  s.hits += 1;
  // Every 5 in a row adds 5 more per hit (up to +15)
  const points = POINTS[h.kind] + Math.min(15, Math.floor(s.combo / 5) * 5);
  s.score += points;
  s.events.push({ type: 'hit', hole: i, kind: h.kind, points, combo: s.combo });
  return { result: 'hit', points };
}

export const whackStars = (s) => starsFor(s.score, 500, 1050);
