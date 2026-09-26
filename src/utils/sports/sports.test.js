import { describe, it, expect } from 'vitest';
import { matchResult, swing, pulse, jitter, MATCH_REWARDS } from './common';
import { pinLayout, simulateRoll, knockedIds, standingIds, aiThrow, frameScore, createRoll, stepRoll } from './bowling';

import { seeded } from '../../test/seeded';

describe('sports common', () => {
  it('SP-01 results, rewards and oscillators', () => {
    expect([matchResult(3, 1), matchResult(1, 1), matchResult(0, 2)]).toEqual(['win', 'draw', 'lose']);
    expect(MATCH_REWARDS.win.oran + MATCH_REWARDS.win.razz).toBe(2);
    for (let t = 0; t < 5; t += 0.13) {
      expect(Math.abs(swing(t, 0.5))).toBeLessThanOrEqual(1);
      expect(pulse(t, 0.7)).toBeGreaterThanOrEqual(0);
      expect(pulse(t, 0.7)).toBeLessThanOrEqual(1);
    }
    const r = seeded(1);
    for (let i = 0; i < 100; i++) expect(Math.abs(jitter(r, 1))).toBeLessThanOrEqual(1);
  });
});

describe('bowling', () => {
  it('BW-01 ten pins in a triangle, head pin first', () => {
    const pins = pinLayout();
    expect(pins).toHaveLength(10);
    expect(pins[0].x).toBe(0);
    expect(new Set(pins.map((p) => p.y)).size).toBe(4);
  });

  it('BW-02 hitting the pocket (just off centre) strikes often; head-on knocks most pins', () => {
    const run = (aim) => Array.from({ length: 30 }, (_, s) => knockedIds(simulateRoll({ aim, power: 0.85, random: seeded(s) })).length);
    const pocket = [...run(0.15), ...run(-0.15)];
    const headOn = run(0);
    expect(pocket.filter((n) => n === 10).length / pocket.length).toBeGreaterThan(0.3);
    expect(headOn.reduce((a, b) => a + b, 0) / headOn.length).toBeGreaterThanOrEqual(6.5);
  });

  // Full 5-frame matches: the computer against two kinds of child
  function playMatch(childAim, seed) {
    const r = seeded(seed);
    const frameTotal = (thrower) => {
      const first = simulateRoll({ ...thrower(), random: r });
      const n1 = knockedIds(first).length;
      if (n1 === 10) return frameScore(10).total;
      const second = simulateRoll({ ...thrower(), standing: standingIds(first), random: r });
      return frameScore(n1, knockedIds(second).length - 0).total;
    };
    let child = 0;
    let computer = 0;
    for (let f = 0; f < 5; f++) {
      child += frameTotal(() => ({ aim: childAim(r), power: (1 - Math.cos(r() * Math.PI * 2)) / 2 }));
      computer += frameTotal(() => aiThrow(r));
    }
    return child > computer ? 1 : child === computer ? 0.5 : 0;
  }

  it('BW-08 a child tapping at random wins some matches; a child who times the arrow wins most', () => {
    const N = 150;
    const random = Array.from({ length: N }, (_, i) => playMatch((r) => 0.9 * Math.sin(r() * Math.PI * 2), i + 1)).reduce((a, b) => a + b, 0) / N;
    const timed = Array.from({ length: N }, (_, i) => playMatch((r) => (r() * 2 - 1) * 0.45, i + 1)).reduce((a, b) => a + b, 0) / N;
    console.info(`[bowling] match win rate: random taps ${Math.round(random * 100)}%, timed ${Math.round(timed * 100)}%`);
    expect(random).toBeGreaterThanOrEqual(0.3);
    expect(timed).toBeGreaterThanOrEqual(0.65);
  });

  it('BW-03 the edge of the aim swing knocks only a few pins (no gutter balls for children)', () => {
    const edge = Array.from({ length: 20 }, (_, i) => knockedIds(simulateRoll({ aim: 0.9, power: 0.7, random: seeded(i) })).length);
    const avg = edge.reduce((a, b) => a + b, 0) / edge.length;
    expect(avg).toBeLessThan(4);
    expect(Math.max(...edge)).toBeGreaterThan(0);
  });

  it('BW-04 slight misses still knock some pins; the second roll only has the standing pins', () => {
    const first = simulateRoll({ aim: 0.55, power: 0.6, random: seeded(3) });
    const n = knockedIds(first).length;
    expect(n).toBeGreaterThan(0);
    const second = createRoll({ aim: 0, power: 0.7, standing: standingIds(first), random: seeded(4) });
    expect(second.pins).toHaveLength(10 - n);
  });

  it('BW-05 rolls always finish', () => {
    for (let s = 0; s < 40; s++) {
      const r = seeded(s);
      const roll = createRoll({ aim: r() * 2.6 - 1.3, power: r(), random: r });
      let steps = 0;
      while (!roll.done && steps < 2000) {
        stepRoll(roll, 1 / 120);
        steps++;
      }
      expect(roll.done).toBe(true);
    }
  });

  it('BW-06 frame scores with kid-friendly bonuses', () => {
    expect(frameScore(10)).toMatchObject({ total: 15, mark: 'strike' });
    expect(frameScore(6, 4)).toMatchObject({ total: 13, mark: 'spare' });
    expect(frameScore(5, 3)).toMatchObject({ total: 8, mark: null });
  });

  it('BW-07 the computer bowls decently but beatable', () => {
    const r = seeded(9);
    let total = 0;
    for (let i = 0; i < 60; i++) total += knockedIds(simulateRoll({ ...aiThrow(r), random: r })).length;
    const avg = total / 60;
    console.info(`[bowling] computer first-roll average ${avg.toFixed(1)}`);
    expect(avg).toBeGreaterThan(3);
    expect(avg).toBeLessThan(8.5);
  });
});
