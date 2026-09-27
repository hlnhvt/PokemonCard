import { describe, it, expect } from 'vitest';
import {
  createCoaster,
  stepCoaster,
  setHold,
  climbAt,
  curveAt,
  curveAhead,
  trackAt,
  buildTrack,
  coasterScore,
  coasterStars,
  smoothBonus,
  progress,
} from './coaster';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

function ride(seed, brain) {
  const s = createCoaster({ random: seeded(seed) });
  const memo = { r: seeded(seed + 50) };
  while (s.status === 'play') {
    setHold(s, brain(s, memo));
    stepCoaster(s, DT);
    s.events.length = 0;
  }
  return s;
}

/** Holds going up and on the flat, lets go as soon as the warning sign shows. */
const good = () => (s) => !curveAhead(s.track, s.d) && climbAt(s) > -0.05;
/** Holds all the time. */
const always = () => () => true;
/** Never holds. */
const never = () => () => false;

describe('roller coaster', () => {
  it('CO-01 the track has hills, loops and curves with warning signs and stars; it goes up and down', () => {
    const t = buildTrack(seeded(1));
    const kinds = new Set(t.pieces.map((p) => p.kind));
    for (const k of ['station', 'climb', 'drop', 'hill', 'loop', 'curve', 'brake']) expect(kinds.has(k)).toBe(true);
    expect(t.length).toBeGreaterThan(7000);
    expect(t.curves.length).toBeGreaterThanOrEqual(3);
    for (const c of t.curves) expect(c.sign).toBeLessThan(c.d0);
    expect(t.hills.length).toBeGreaterThanOrEqual(4);
    expect(t.stars.filter((x) => x.high).length).toBe(t.hills.length * 3);
    const d = t.stars.map((x) => x.d);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    // In a loop the rail goes all the way round (travels backwards at the top)
    const loop = t.pieces.find((p) => p.kind === 'loop');
    const top = trackAt(t, (loop.d0 + loop.d1) / 2);
    expect(Math.abs(Math.cos(top.angle) + 1)).toBeLessThan(0.1);
    // The same seed builds the same track
    expect(buildTrack(seeded(1)).length).toBe(t.length);
  });

  it('CO-02 holding boosts, letting a hill beat you rolls back; holding in a curve wobbles and drops a star', () => {
    // Boost
    const a = createCoaster({ random: seeded(2) });
    const b = createCoaster({ random: seeded(2) });
    setHold(a, true);
    for (let i = 0; i < 120; i++) {
      stepCoaster(a, DT);
      stepCoaster(b, DT);
    }
    expect(a.d).toBeGreaterThan(b.d + 20);
    // Roll back on the big lift hill when nobody holds
    const s = createCoaster({ random: seeded(3) });
    let rolled = false;
    let lifted = false;
    while (s.status === 'play' && s.time < 20) {
      stepCoaster(s, DT);
      if (s.events.some((e) => e.type === 'rollback')) rolled = true;
      if (s.lift) lifted = true;
      s.events.length = 0;
    }
    expect(rolled).toBe(true);
    expect(lifted).toBe(true);
    expect(s.rollbacks).toBeGreaterThan(0);
    // A curve
    const c = createCoaster({ random: seeded(4) });
    const curve = c.track.curves[0];
    c.d = curve.d0 + 5;
    c.v = 200;
    c.got = 3;
    c.nextStar = c.track.stars.findIndex((x) => x.d > c.d);
    c.lastHill = 99;
    expect(curveAt(c.track, c.d)).toBe(curve);
    setHold(c, true);
    stepCoaster(c, DT);
    expect(c.wobbles).toBe(1);
    expect(c.got).toBe(2);
    expect(smoothBonus(c)).toBe(88);
  });

  it('CO-03 balance: a good rider gets 3 stars in about 45 s; always holding or never holding gets fewer', () => {
    const seeds = [5, 6, 7, 8, 9];
    const g = seeds.map((seed) => ride(seed, good()));
    const al = seeds.map((seed) => ride(seed, always()));
    const nv = seeds.map((seed) => ride(seed, never()));
    const fmt = (list) => list.map((s) => `${coasterScore(s)}`).join(',');
    const avg = (list, f) => Math.round((list.reduce((n, s) => n + f(s), 0) / list.length) * 10) / 10;
    console.info(
      `[coaster] good ${fmt(g)} (${avg(g, (s) => s.time)} s, ${avg(g, (s) => s.got)}/${g[0].track.stars.length} stars, airs ${avg(g, (s) => s.airs)}, rollbacks ${avg(g, (s) => s.rollbacks)}) · always hold ${fmt(al)} (wobbles ${avg(al, (s) => s.wobbles)}) · never hold ${fmt(nv)} (${avg(nv, (s) => s.time)} s, rollbacks ${avg(nv, (s) => s.rollbacks)})`
    );
    for (const s of g) {
      expect(coasterStars(s)).toBe(3);
      expect(s.time).toBeGreaterThan(38);
      expect(s.time).toBeLessThan(55);
      expect(progress(s)).toBeGreaterThan(0.99);
    }
    for (const s of al) expect(coasterStars(s)).toBeLessThan(3);
    for (const s of nv) {
      expect(coasterStars(s)).toBe(1);
      expect(s.status).toBe('done');
    }
  });
});
