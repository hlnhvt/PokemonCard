import { describe, it, expect } from 'vitest';
import { createHammer, stepHammer, strike, hammerStars, hammerAngle, meterAt, pointsFor, SWINGS, METER_SPEED, BELL_AT, BELL_BONUS } from './hammer';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

/** Play 5 swings; `when(s, rnd, mem)` picks the moment to tap (the meter phase in cycles). */
function play(seed, when) {
  const s = createHammer({ random: seeded(seed) });
  const rnd = seeded(seed + 500);
  let target = null;
  while (s.status === 'play') {
    stepHammer(s, DT);
    if (s.stage === 'aim') {
      if (target == null) target = when(s, rnd);
      if (s.phase >= target) {
        strike(s);
        target = null;
      }
    }
    s.events.length = 0;
  }
  return s;
}

// A child aiming for the top, off by a human reaction time (in seconds)
const aimTop = (err) => (s, rnd) => 0.5 + (rnd() * 2 - 1) * err * METER_SPEED[s.swing] + (rnd() < 0.5 ? 0 : 1);
// Taps whenever, without looking at the meter
const whenever = (s, rnd) => rnd() * 2;

describe('Machop strength tester', () => {
  it('CH-01 the meter rises and falls, faster each swing; a tap sends the puck up; 95% rings the bell', () => {
    expect(meterAt(0)).toBe(0);
    expect(meterAt(0.5)).toBeCloseTo(1);
    expect(METER_SPEED[SWINGS - 1]).toBe(Math.max(...METER_SPEED));
    expect(pointsFor(0.5)).toBe(50);
    expect(pointsFor(BELL_AT)).toBe(95 + BELL_BONUS);
    const s = createHammer({ random: seeded(1) });
    expect(strike(s)).toBe(0); // tapping at once: no power
    const t = createHammer({ random: seeded(1) });
    const events = [];
    let top = 0;
    let angles = [];
    while (t.phase < 0.5) stepHammer(t, DT);
    expect(t.meter).toBeGreaterThan(0.97);
    expect(strike(t)).toBeGreaterThan(0.97);
    expect(strike(t)).toBeNull(); // only once per swing
    while (t.swing === 0 && t.status === 'play') {
      stepHammer(t, DT);
      angles.push(hammerAngle(t));
      top = Math.max(top, t.puck);
      events.push(...t.events.splice(0).map((e) => e.type));
    }
    expect(Math.min(...angles)).toBeLessThan(-1.8); // wound up
    expect(events).toEqual(['swing', 'hit', 'bell', 'land', 'next']);
    expect(top).toBeGreaterThan(0.97);
    expect(t.bells).toBe(1);
    expect(t.best).toBeGreaterThan(0.97);
    expect(t.score).toBeGreaterThan(140);
  });

  it('CH-02 balance: a child who taps at the top gets 3 stars, a slow-reacting one 2, a random tapper 1', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const run = (bot) => seeds.map((k) => play(k, bot));
    const avg = (list, f) => list.reduce((a, s) => a + f(s), 0) / list.length;
    const sharp = run(aimTop(0.07));
    const slow = run(aimTop(0.2));
    const random = run(whenever);
    const line = (name, list) => `${name} ${avg(list, (s) => s.score).toFixed(0)} pts (${avg(list, (s) => s.bells).toFixed(1)} bells, ${avg(list, hammerStars).toFixed(2)}★)`;
    console.info(`[hammer] ${line('sharp', sharp)}, ${line('slow', slow)}, ${line('random', random)}`);
    expect(sharp.every((s) => s.results.length === SWINGS)).toBe(true);
    expect(sharp.filter((s) => hammerStars(s) === 3).length).toBeGreaterThanOrEqual(8);
    expect(avg(slow, hammerStars)).toBeLessThan(avg(sharp, hammerStars));
    expect(avg(slow, hammerStars)).toBeGreaterThanOrEqual(1.5);
    expect(avg(random, hammerStars)).toBeLessThan(1.6);
    expect(avg(random, (s) => s.score)).toBeLessThan(avg(slow, (s) => s.score));
  });
});
