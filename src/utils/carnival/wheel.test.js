import { describe, it, expect } from 'vitest';
import { SEGMENTS, SEG_ANGLE, TOTAL_WEIGHT, createWheel, startSpin, stepWheel, segmentAt, pickSegment, goldPerTicket, goldOf, angleAt, spinSpeed } from './wheel';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

function spinToStop(s, power) {
  const index = startSpin(s, { power });
  const ticks = [];
  let stop = null;
  while (s.spin) {
    stepWheel(s, DT);
    for (const e of s.events.splice(0)) {
      if (e.type === 'tick') ticks.push(e.speed);
      if (e.type === 'stop') stop = e;
    }
  }
  return { index, ticks, stop };
}

describe('lucky wheel', () => {
  it('CW-01 8-10 segments with every kind of prize; the weights sum to 100', () => {
    expect(SEGMENTS.length).toBeGreaterThanOrEqual(8);
    expect(SEGMENTS.length).toBeLessThanOrEqual(10);
    expect(TOTAL_WEIGHT).toBe(100);
    expect(SEGMENTS.reduce((a, s) => a + s.weight, 0)).toBe(100);
    expect(new Set(SEGMENTS.map((s) => s.kind))).toEqual(new Set(['gold', 'berry', 'ticket', 'jackpot', 'miss']));
    expect(
      SEGMENTS.filter((s) => s.kind === 'gold')
        .map((s) => s.amount)
        .sort((a, b) => a - b),
    ).toEqual([5, 5, 10, 20, 50]);
    expect(SEGMENTS.find((s) => s.kind === 'jackpot').amount).toBe(100);
    expect(
      SEGMENTS.filter((s) => s.kind === 'berry')
        .map((s) => s.berry)
        .sort(),
    ).toEqual(['oran', 'razz']);
    expect(new Set(SEGMENTS.map((s) => s.id)).size).toBe(SEGMENTS.length);
  });

  it('CW-02 the pointer reads the right segment for any rotation', () => {
    expect(segmentAt(0)).toBe(0);
    // Turning the wheel clockwise brings the segments before it under the pointer
    expect(segmentAt(SEG_ANGLE * 0.5)).toBe(SEGMENTS.length - 1);
    expect(segmentAt(-SEG_ANGLE * 1.5)).toBe(1);
    expect(segmentAt(360 * 7 - SEG_ANGLE * 2.5)).toBe(2);
  });

  it('CW-03 every spin lands exactly on the chosen segment, clicks on each peg and slows down', () => {
    const s = createWheel({ random: seeded(4) });
    for (let n = 0; n < 60; n++) {
      const before = s.rotation;
      const { index, ticks, stop } = spinToStop(s, 0.5 + (n % 5) * 0.25);
      expect(stop.index).toBe(index);
      expect(segmentAt(s.rotation)).toBe(index);
      // Never on a peg edge
      const inSeg = (((-s.rotation % 360) + 360) % 360) % SEG_ANGLE;
      expect(inSeg).toBeGreaterThan(SEG_ANGLE * 0.15);
      expect(inSeg).toBeLessThan(SEG_ANGLE * 0.85);
      expect(s.rotation - before).toBeGreaterThanOrEqual(360 * 4);
      expect(ticks.length).toBeGreaterThanOrEqual(Math.floor((s.rotation - before) / SEG_ANGLE) - 1);
      expect(ticks[0]).toBeGreaterThan(ticks[ticks.length - 1]);
    }
    // Only one spin at a time; the ease-out is monotonic and ends at rest
    const w = createWheel({ random: seeded(5) });
    startSpin(w);
    expect(startSpin(w)).toBe(-1);
    const sp = w.spin;
    let last = -Infinity;
    for (let t = 0; t <= sp.duration; t += 0.1) {
      const a = angleAt(sp, t);
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
    expect(angleAt(sp, sp.duration)).toBe(sp.to);
    w.spin.t = sp.duration;
    expect(spinSpeed(w)).toBe(0);
  });

  it('CW-04 odds follow the weights; gold per ticket is fair (8-15)', () => {
    const rnd = seeded(9);
    const counts = SEGMENTS.map(() => 0);
    const N = 20000;
    let gold = 0;
    let tickets = N;
    let spent = 0;
    for (let i = 0; i < N; i++) counts[pickSegment(rnd)]++;
    SEGMENTS.forEach((seg, i) => expect(Math.abs(counts[i] / N - seg.weight / TOTAL_WEIGHT)).toBeLessThan(0.012));
    // Spend N tickets (a "ticket" prize gives one back)
    const r2 = seeded(10);
    while (tickets > 0) {
      tickets--;
      spent++;
      const seg = SEGMENTS[pickSegment(r2)];
      gold += goldOf(seg);
      if (seg.kind === 'ticket') tickets++;
    }
    const perTicket = gold / N;
    console.info(
      `[wheel] expected gold per ticket ${goldPerTicket().toFixed(2)}, simulated ${perTicket.toFixed(2)} over ${spent} spins; jackpot ${((counts[SEGMENTS.findIndex((s) => s.kind === 'jackpot')] / N) * 100).toFixed(1)}%`,
    );
    expect(goldPerTicket()).toBeGreaterThanOrEqual(8);
    expect(goldPerTicket()).toBeLessThanOrEqual(15);
    expect(Math.abs(perTicket - goldPerTicket())).toBeLessThan(1);
  });
});
