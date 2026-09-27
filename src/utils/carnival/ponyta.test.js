import { describe, it, expect } from 'vitest';
import { createPonyta, stepPonyta, gallop, zoneOf, greenHalf, sweepSpeed, placeOf, ponytaStars, playerOf, standings, TRACK, STUMBLE_TIME } from './ponyta';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

/** Run a race; `bot(s, rnd)` returns true to tap this frame. */
function race(seed, bot) {
  const s = createPonyta({ random: seeded(seed) });
  const rnd = seeded(seed + 1000);
  const mem = {};
  while (s.status === 'play' && s.time < 120) {
    stepPonyta(s, DT);
    if (bot(s, rnd, mem)) gallop(s);
    s.events.length = 0;
  }
  return s;
}

// A child who watches the marker: taps once per pass, somewhere inside the green zone
// (sometimes a little early, into the yellow)
const rhythm = (skip) => (s, rnd, mem) => {
  const side = Math.sign(s.marker - 0.5) * s.dir; // < 0 while approaching the centre
  if (side < 0 && !mem.approach) {
    mem.approach = true;
    mem.tapped = false;
    mem.skip = rnd() < skip; // not watching this time
  }
  if (side > 0) mem.approach = false;
  if (mem.tapped || mem.skip) return false;
  if (mem.aim == null) mem.aim = (rnd() - 0.35) * greenHalf(s) * 1.4;
  const reached = s.dir > 0 ? s.marker >= 0.5 + mem.aim : s.marker <= 0.5 - mem.aim;
  if (reached) {
    mem.tapped = true;
    mem.aim = null;
    return true;
  }
  return false;
};
const good = rhythm(0);
const distracted = rhythm(0.5);
// Taps any time, without looking
const careless = (s, rnd, mem) => {
  mem.wait = (mem.wait ?? 0.5) - DT;
  if (mem.wait > 0) return false;
  mem.wait = 0.35 + rnd() * 0.6;
  return true;
};

describe('Ponyta race', () => {
  it('CP-01 the marker sweeps back and forth, zones narrow and the sweep speeds up; taps boost or stumble', () => {
    const s = createPonyta({ random: seeded(1) });
    const g0 = greenHalf(s);
    const v0 = sweepSpeed(s);
    let min = 1;
    let max = 0;
    for (let i = 0; i < 180; i++) {
      stepPonyta(s, DT);
      min = Math.min(min, s.marker);
      max = Math.max(max, s.marker);
    }
    expect(min).toBeLessThan(0.05);
    expect(max).toBeGreaterThan(0.95);
    playerOf(s).dist = TRACK * 0.9;
    expect(greenHalf(s)).toBeLessThan(g0);
    expect(sweepSpeed(s)).toBeGreaterThan(v0);
    // Green tap
    const t = createPonyta({ random: seeded(2) });
    t.marker = 0.5;
    expect(zoneOf(t)).toBe('green');
    expect(gallop(t).result).toBe('green');
    expect(playerOf(t).surge).toBeGreaterThan(0);
    expect(gallop(t).result).toBe('none'); // cooldown
    stepPonyta(t, 0.3);
    t.marker = 0.5 + greenHalf(t) + 0.05;
    expect(gallop(t).result).toBe('yellow');
    stepPonyta(t, 0.3);
    t.marker = 0.02;
    expect(gallop(t).result).toBe('miss');
    expect(playerOf(t).stumble).toBe(STUMBLE_TIME);
    expect(t.taps).toEqual({ green: 1, yellow: 1, miss: 1 });
  });

  it('CP-02 rivals race with surges; the race ends when the child crosses the line, with a place', () => {
    const s = race(3, () => false);
    expect(s.status).toBe('done');
    expect(playerOf(s).dist).toBeGreaterThanOrEqual(TRACK);
    expect(placeOf(s)).toBe(4);
    expect(standings(s)[3]).toBe('player');
    expect([1, 2, 3, 4, 5].map(ponytaStars)).toEqual([3, 2, 1, 1, 1]);
  });

  it('CP-03 balance: a child tapping in rhythm wins, a careless one places lower, doing nothing is last', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const places = (bot) => seeds.map((k) => placeOf(race(k, bot)));
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const g = places(good);
    const d = places(distracted);
    const c = places(careless);
    const idle = places(() => false);
    const goodRace = race(1, good);
    console.info(
      `[ponyta] avg place good ${avg(g).toFixed(2)} (wins ${g.filter((p) => p === 1).length}/${seeds.length}, ${goodRace.time.toFixed(1)}s), taps half the passes ${avg(d).toFixed(2)}, careless ${avg(c).toFixed(2)}, idle ${avg(idle).toFixed(2)}`,
    );
    expect(g.filter((p) => p === 1).length).toBeGreaterThanOrEqual(seeds.length * 0.75);
    expect(avg(d)).toBeGreaterThan(avg(g) + 0.5);
    expect(avg(c)).toBeGreaterThan(avg(d));
    expect(c.every((p) => p >= 2)).toBe(true);
    expect(idle.every((p) => p === 4)).toBe(true);
    expect(goodRace.time).toBeGreaterThan(15);
    expect(goodRace.time).toBeLessThan(35);
  });
});
