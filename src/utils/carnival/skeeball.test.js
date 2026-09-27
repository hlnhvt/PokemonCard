import { describe, it, expect } from 'vitest';
import {
  createSkee,
  stepSkee,
  rollBall,
  rollFromSwipe,
  landingFor,
  holeAt,
  aimFor,
  reflect,
  skeeStars,
  BALLS,
  HOLES,
  P_RAMP,
  STREAK_BONUS,
  SKEE_TWO,
  SKEE_THREE,
} from './skeeball';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

function settle(s) {
  for (let t = 0; t < 6 && s.status !== 'aim' && s.status !== 'done'; t += DT) stepSkee(s, DT);
  return s.events.splice(0);
}

const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

function play(seed, pick) {
  const s = createSkee({ random: seeded(seed) });
  const r = seeded(seed * 31 + 7);
  while (s.status !== 'done') {
    rollBall(s, pick(s, r));
    settle(s);
  }
  return s;
}

const hole50 = HOLES.find((h) => h.points === 50);
const hole100 = HOLES.find((h) => h.id === 'h100R');
// A good child aims for the 50 (and sometimes tries a 100), with a steady flick
const good = (s, r) => {
  const t = s.rolled % 4 === 3 ? hole100 : hole50;
  const a = aimFor(t.x, t.y);
  return { angle: a.angle + gauss(r) * 0.02, power: a.power + gauss(r) * 0.04 };
};
// A careless child flicks any old way
const careless = (s, r) => ({ angle: (r() - 0.5) * 0.7, power: 0.1 + r() * 0.9 });
// In between: the middle rings, shakier
const average = (s, r) => {
  const a = aimFor(0, 0.6);
  return { angle: a.angle + gauss(r) * 0.06, power: a.power + gauss(r) * 0.12 };
};

describe('skee-ball', () => {
  it('SKB-01 swipes become angle and power; soft ones never clear the ramp, hard ones bonk', () => {
    expect(rollFromSwipe(0, -10, 0.1)).toBeNull();
    const straight = rollFromSwipe(0, -200, 0.12);
    expect(straight.angle).toBeCloseTo(0);
    expect(straight.power).toBeGreaterThan(0.6);
    expect(rollFromSwipe(0, -200, 0.6).power).toBeLessThan(straight.power);
    expect(rollFromSwipe(80, -200, 0.12).angle).toBeGreaterThan(0.3);
    expect(landingFor(0, P_RAMP - 0.05)).toBeNull();
    expect(landingFor(0, 1).over).toBe(true);
    expect(reflect(0.5)).toBeCloseTo(0.5);
    expect(reflect(1.5)).toBeCloseTo(0.5);
    expect(reflect(-1.25)).toBeCloseTo(-0.75);
    // Aiming helper hits what it aims at
    for (const h of HOLES) {
      const a = aimFor(h.x, h.y);
      const l = landingFor(a.angle, a.power);
      expect(holeAt(l.x, l.y).points).toBe(h.points);
    }
    expect(holeAt(0, 0.42).points).toBe(30);
    expect(holeAt(0.95, 0.1).points).toBe(0);
  });

  it('SKB-02 a ball rolls, jumps, drops in and scores; weak rolls and the gutter score 0', () => {
    const s = createSkee({ random: seeded(1) });
    rollBall(s, aimFor(hole50.x, hole50.y));
    expect(rollBall(s, { angle: 0, power: 0.5 })).toBe(false);
    const ev = settle(s);
    expect(ev.map((e) => e.type)).toEqual(['roll', 'ramp', 'land', 'score']);
    expect(s.score).toBe(50);
    rollBall(s, { angle: 0, power: 0.1 });
    expect(settle(s).map((e) => e.type)).toContain('weak');
    expect(s.score).toBe(50);
    rollBall(s, { angle: 0.45, power: 0.35 });
    const g = settle(s);
    expect(g.map((e) => e.type)).toContain('gutter');
    rollBall(s, { angle: 0, power: 1 });
    const bonk = settle(s);
    expect(bonk.map((e) => e.type)).toContain('bonk');
    expect(bonk.find((e) => e.type === 'score').points).toBe(10);
    expect(s.ballsLeft).toBe(BALLS - 4);
  });

  it('SKB-03 50+ holes in a row give a streak bonus; 9 balls then done', () => {
    const s = createSkee({ random: seeded(2) });
    const pts = [];
    for (let i = 0; i < BALLS; i++) {
      rollBall(s, aimFor(hole50.x, hole50.y));
      const e = settle(s).find((x) => x.type === 'score');
      pts.push(e);
    }
    expect(s.status).toBe('done');
    expect(pts[0].bonus).toBe(0);
    expect(pts[1].bonus).toBe(STREAK_BONUS);
    expect(pts[3].bonus).toBe(STREAK_BONUS * 3);
    expect(s.score).toBe(50 * BALLS + s.bonus);
    expect(s.best).toBe(BALLS);
  });

  it('SKB-04 balance: a steady child gets 3 stars, an average one 2, a careless one 1', () => {
    const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
    const g = seeds.map((sd) => play(sd, good));
    const m = seeds.map((sd) => play(sd, average));
    const c = seeds.map((sd) => play(sd, careless));
    const avg = (l) => Math.round(l.reduce((a, s) => a + s.score, 0) / l.length);
    const share = (l, n) => Math.round((l.filter((s) => skeeStars(s) === n).length / l.length) * 100);
    console.info(`[skeeball] steady avg ${avg(g)} (3★ ${share(g, 3)}%), average avg ${avg(m)} (2★ ${share(m, 2)}%, 3★ ${share(m, 3)}%), careless avg ${avg(c)} (1★ ${share(c, 1)}%) · thresholds ${SKEE_TWO}/${SKEE_THREE}`);
    expect(share(g, 3)).toBeGreaterThan(80);
    expect(share(c, 1)).toBeGreaterThan(80);
    expect(share(m, 3)).toBeLessThan(30);
    expect(skeeStars(play(1, good))).toBe(3);
  });
});
