import { describe, it, expect } from 'vitest';
import { createCans, stepCans, throwBall, nextLevel, cansStars, buildTower, standingCans, LEVELS, BALLS, CAN_H, CAN_POINTS, CLEAR_BONUS } from './cans';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

function untilAim(s) {
  let guard = 0;
  while ((s.status === 'fly' || s.status === 'settle') && guard++ < 2000) {
    stepCans(s, DT);
  }
}

/** Play all levels: `pick(s, hand)` returns where the ball is thrown. */
function play(seed, pick) {
  const s = createCans({ random: seeded(seed) });
  const hand = seeded(seed + 77);
  while (s.status !== 'done') {
    if (s.status === 'levelEnd') nextLevel(s);
    throwBall(s, pick(s, hand));
    untilAim(s);
    s.events.length = 0;
  }
  return s;
}

/** A good thrower aims low at the middle of what is still standing. */
const goodAim = (s, hand) => {
  const up = standingCans(s);
  const low = Math.min(...up.map((c) => c.y));
  const base = up.filter((c) => c.y === low);
  const mid = base.reduce((a, c) => a + c.x, 0) / base.length;
  // The middle of the bottom row, or the can nearest to it when the middle is empty
  const near = base.reduce((a, c) => (Math.abs(c.x - mid) < Math.abs(a.x - mid) ? c : a));
  const x = Math.abs(near.x - mid) < 0.6 ? mid : near.x;
  return { x: x + (hand() - 0.5) * 0.3, y: low + CAN_H * 0.45 + (hand() - 0.5) * 0.3 };
};

describe('knock down the cans', () => {
  it('CN-01 towers of 6, 10 and 10 cans that stand by themselves', () => {
    expect(LEVELS.map((_, i) => buildTower(i).length)).toEqual([6, 10, 10]);
    const s = createCans({ random: seeded(1) });
    for (let i = 0; i < 120; i++) stepCans(s, DT);
    expect(standingCans(s)).toHaveLength(6);
    // The tall one is taller than the wide one
    const top = (i) => Math.max(...buildTower(i).map((c) => c.y));
    expect(top(2)).toBeGreaterThan(top(1));
  });

  it('CN-02 a miss knocks nothing; a hit at the bottom knocks cans and the ones above fall; points and balls count', () => {
    const s = createCans({ random: seeded(2) });
    expect(throwBall(s, { x: 0, y: 7 })).toBe(true);
    expect(throwBall(s, { x: 0, y: 1 })).toBe(false);
    const types = [];
    let guard = 0;
    while (s.status !== 'aim' && guard++ < 2000) {
      stepCans(s, DT);
      types.push(...s.events.splice(0).map((e) => e.type));
    }
    expect(types).toContain('whiff');
    expect(standingCans(s)).toHaveLength(6);
    expect(s.balls).toBe(BALLS - 1);
    throwBall(s, { x: -0.5, y: 0.6 });
    guard = 0;
    while ((s.status === 'fly' || s.status === 'settle') && guard++ < 2000) {
      stepCans(s, DT);
      types.push(...s.events.splice(0).map((e) => e.type));
    }
    expect(types).toContain('hit');
    expect(types).toContain('knock');
    const down = 6 - standingCans(s).length;
    expect(down).toBeGreaterThanOrEqual(3);
    expect(s.knocked).toBe(down);
    const bonus = down === 6 ? CLEAR_BONUS[2] : 0;
    expect(s.score).toBe(down * CAN_POINTS + bonus);
  });

  it('CN-03 the same throws give the same result (deterministic with the same random)', () => {
    const a = play(5, goodAim);
    const b = play(5, goodAim);
    expect(a.score).toBe(b.score);
    expect(a.levelResults).toEqual(b.levelResults);
    expect(a.levelResults).toHaveLength(3);
  });

  it('CN-04 balance: a good thrower gets 3 stars, a careless one fewer, a wild one 1', () => {
    const good = [];
    const careless = [];
    const wild = [];
    let clears = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = play(seed, goodAim);
      good.push(g.score);
      clears += g.clears;
      // Throws somewhere at the tower
      careless.push(play(seed, (s, hand) => ({ x: (hand() - 0.5) * 4, y: hand() * 5 })).score);
      // Mostly too high
      wild.push(play(seed, (s, hand) => ({ x: (hand() - 0.5) * 6, y: 3 + hand() * 4 })).score);
    }
    const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
    const three = good.filter((score) => cansStars({ score }) === 3).length / good.length;
    console.info(`[cans] good avg ${avg(good)} (3 stars ${Math.round(three * 100)}%, clears ${(clears / 20).toFixed(1)}/3), careless avg ${avg(careless)}, wild avg ${avg(wild)}`);
    expect(three).toBeGreaterThanOrEqual(0.7);
    expect(avg(careless)).toBeLessThan(avg(good));
    expect(cansStars({ score: avg(careless) })).toBeLessThan(3);
    expect(cansStars({ score: avg(wild) })).toBe(1);
  });
});
