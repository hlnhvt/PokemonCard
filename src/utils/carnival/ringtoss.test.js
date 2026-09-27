import { describe, it, expect } from 'vitest';
import { createToss, stepToss, throwRing, tossStars, pegAt, zForPower, powerForZ, RINGS, ROW_POINTS, Z_MAX, X_MAX } from './ringtoss';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

function runOut(s) {
  let guard = 0;
  while (s.status === 'fly' && guard++ < 1000) stepToss(s, DT);
}

/** A whole game: `pick(s, r)` returns where the child throws. */
function play(seed, pick) {
  const s = createToss({ random: seeded(seed) });
  const hand = seeded(seed + 1000);
  while (s.status !== 'done') {
    throwRing(s, pick(s, hand));
    runOut(s);
    s.events.length = 0;
  }
  return s;
}

describe('ring toss', () => {
  it('RT-01 a 3x3 field, back pegs worth more; power maps to distance and back', () => {
    const s = createToss({ random: seeded(1) });
    expect(s.pegs).toHaveLength(9);
    expect(s.pegs.filter((p) => p.row === 0).every((p) => p.points === ROW_POINTS[0])).toBe(true);
    expect(ROW_POINTS[0]).toBeGreaterThan(ROW_POINTS[2]);
    expect(s.pegs[0].z).toBeGreaterThan(s.pegs[8].z);
    expect(powerForZ(zForPower(0.4))).toBeCloseTo(0.4);
    expect(zForPower(5)).toBe(Z_MAX);
    const p = s.pegs[4];
    expect(pegAt(s, p.x + 0.05, p.z - 0.05)).toBe(p);
    expect(pegAt(s, p.x + 0.45, p.z)).toBeNull();
  });

  it('RT-02 a ring flies, lands on a peg, scores and rests; a wild throw misses; 8 rings then done', () => {
    const s = createToss({ random: () => 0.5 }); // no wobble
    const peg = s.pegs[1];
    expect(throwRing(s, { x: peg.x, z: peg.z })).toBe(true);
    expect(throwRing(s, { x: 0, z: 1 })).toBe(false); // still flying
    const types = [];
    let guard = 0;
    while (s.status === 'fly' && guard++ < 500) {
      stepToss(s, DT);
      types.push(...s.events.splice(0).map((e) => e.type));
    }
    expect(types).toContain('ringed');
    expect(s.score).toBe(peg.points);
    expect(peg.rings).toBe(1);
    expect(s.rested).toHaveLength(1);
    expect(s.status).toBe('aim');
    throwRing(s, { x: X_MAX, z: 0.6 });
    guard = 0;
    while (s.status === 'fly' && guard++ < 500) {
      stepToss(s, DT);
      types.push(...s.events.splice(0).map((e) => e.type));
    }
    expect(types.some((t) => t === 'miss' || t === 'clank')).toBe(true);
    expect(s.score).toBe(peg.points);
    expect(s.streak).toBe(0);
    while (s.status !== 'done') {
      throwRing(s, { x: 0, z: 1 });
      runOut(s);
    }
    expect(s.thrown).toBe(RINGS);
    expect(s.ringsLeft).toBe(0);
    expect(throwRing(s, { x: 0, z: 1 })).toBe(false);
  });

  it('RT-03 balance: a good thrower aiming at the back row gets 3 stars, a careless one fewer, a timid one 1', () => {
    const good = [];
    const careless = [];
    const timid = [];
    for (let seed = 1; seed <= 20; seed++) {
      // Aims at a back peg with a small hand shake
      good.push(play(seed, (s, r) => {
        const p = s.pegs[Math.floor(r() * 3)];
        return { x: p.x + (r() - 0.5) * 0.12, z: p.z + (r() - 0.5) * 0.14 };
      }).score);
      // Throws anywhere on the field
      careless.push(play(seed, (s, r) => ({ x: (r() - 0.5) * 2.4, z: 0.6 + r() * 3 })).score);
      // Only the front row, sometimes too short
      timid.push(play(seed, (s, r) => ({ x: s.pegs[6 + Math.floor(r() * 3)].x, z: 1 + (r() - 0.6) * 0.8 })).score);
    }
    const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
    const stars = (a) => a.map((score) => tossStars({ score }));
    const threeRate = stars(good).filter((x) => x === 3).length / good.length;
    console.info(`[ringtoss] good avg ${avg(good)} (3 stars ${Math.round(threeRate * 100)}%), careless avg ${avg(careless)}, front row only avg ${avg(timid)}`);
    expect(threeRate).toBeGreaterThanOrEqual(0.7);
    expect(avg(careless)).toBeLessThan(avg(good));
    expect(tossStars({ score: avg(careless) })).toBeLessThan(3);
    expect(tossStars({ score: avg(timid) })).toBe(1);
  });
});
