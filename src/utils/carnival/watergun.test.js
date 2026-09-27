import { describe, it, expect } from 'vitest';
import {
  createWaterGun,
  stepWaterGun,
  setAim,
  setSpray,
  placeOf,
  placePoints,
  waterStars,
  wins,
  RACES,
  TARGET_SPEED,
  INTRO_TIME,
  FILL_TIME,
  WATER_TWO,
  WATER_THREE,
} from './watergun';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

/** Play a whole game: the child sees the target `lag` seconds late and shakes by `shake`. */
function play(seed, { lag = 0.12, shake = 0.05, sprayShare = 1, fixed = null } = {}) {
  const s = createWaterGun({ random: seeded(seed), playerName: 'Squirtle' });
  const r = seeded(seed * 13 + 5);
  const seen = [];
  let wobble = 0;
  let guard = 0;
  while (s.phase !== 'done' && guard++ < 60 * 200) {
    seen.push(s.target.x);
    const back = Math.round(lag / DT);
    const x = seen[Math.max(0, seen.length - 1 - back)];
    wobble += (r() - 0.5) * shake * 0.6 - wobble * 0.05;
    setAim(s, fixed ?? x + wobble);
    setSpray(s, s.phase === 'race' && (sprayShare >= 1 || (s.time % 2) / 2 < sprayShare));
    stepWaterGun(s, DT);
    s.events.length = 0;
  }
  return s;
}

describe('Squirtle water gun race', () => {
  it('WTR-01 three rivals (never the child), intro then race; holding on the target fills the balloon', () => {
    const s = createWaterGun({ random: seeded(1), playerName: 'Pikachu' });
    expect(s.rivals).toHaveLength(3);
    expect(s.rivals.map((r) => r.name)).not.toContain('Pikachu');
    expect(s.phase).toBe('intro');
    for (let t = 0; t < INTRO_TIME + 0.05; t += DT) stepWaterGun(s, DT);
    expect(s.phase).toBe('race');
    // Not spraying: nothing grows
    stepWaterGun(s, DT);
    expect(s.fill[0]).toBe(0);
    // Spraying right at the target
    setSpray(s, true);
    for (let i = 0; i < 60; i++) {
      setAim(s, s.target.x);
      s.impact = s.target.x;
      stepWaterGun(s, DT);
    }
    expect(s.hitting).toBe(true);
    expect(s.fill[0]).toBeGreaterThan(0.9 / FILL_TIME);
    expect(s.target.spin).toBeGreaterThan(1);
    // Aiming far away misses
    setAim(s, s.target.x > 0 ? -1 : 1);
    for (let i = 0; i < 30; i++) stepWaterGun(s, DT);
    expect(s.hitting).toBe(false);
  });

  it('WTR-02 the first balloon to pop wins; 3 races, the target is faster each race', () => {
    expect(TARGET_SPEED[2]).toBeGreaterThan(TARGET_SPEED[0]);
    const s = createWaterGun({ random: seeded(2) });
    const finishes = [];
    const moves = [0, 0, 0];
    let prev = s.target.x;
    while (s.phase !== 'done') {
      setAim(s, s.target.x);
      setSpray(s, s.phase === 'race');
      stepWaterGun(s, DT);
      if (s.phase === 'race') moves[s.race] += Math.abs(s.target.x - prev);
      prev = s.target.x;
      for (const e of s.events.splice(0)) if (e.type === 'finish') finishes.push(e);
    }
    expect(finishes).toHaveLength(RACES);
    expect(s.places).toHaveLength(RACES);
    finishes.forEach((f) => expect(f.place).toBeGreaterThanOrEqual(1));
    expect(placeOf({ fill: [0.5, 0.9, 0.2, 0.6] })).toBe(3);
    expect(placePoints({ places: [1, 2, 4] })).toBe(5);
    expect(waterStars({ places: [2, 3, 3] })).toBe(2);
    expect(waterStars({ places: [1, 1, 2] })).toBe(3);
    expect(waterStars({ places: [4, 3, 4] })).toBe(1);
  });

  it('WTR-03 balance: a quick child wins most races (3 stars), a slow one fewer, one who sprays anywhere 1 star', () => {
    const seeds = Array.from({ length: 50 }, (_, i) => i + 1);
    const good = seeds.map((sd) => play(sd, { lag: 0.12, shake: 0.05 }));
    const mid = seeds.map((sd) => play(sd, { lag: 0.35, shake: 0.12, sprayShare: 0.8 }));
    const bad = seeds.map((sd) => play(sd, { fixed: 0, sprayShare: 0.7 }));
    const share = (l, n) => l.filter((s) => waterStars(s) === n).length / l.length;
    const avgWins = (l) => (l.reduce((a, s) => a + wins(s), 0) / l.length).toFixed(2);
    const hit = (l) => Math.round((l.reduce((a, s) => a + s.hitTime, 0) / l.reduce((a, s) => a + s.sprayTime, 0)) * 100);
    console.info(
      `[watergun] quick: 3★ ${Math.round(share(good, 3) * 100)}%, wins ${avgWins(good)}/3, on target ${hit(good)}% · slow: 3★ ${Math.round(share(mid, 3) * 100)}% 2★ ${Math.round(share(mid, 2) * 100)}%, wins ${avgWins(mid)}/3, on target ${hit(mid)}% · sprays anywhere: 1★ ${Math.round(share(bad, 1) * 100)}%, wins ${avgWins(bad)}/3, on target ${hit(bad)}% · thresholds ${WATER_TWO}/${WATER_THREE} place points`
    );
    expect(share(good, 3)).toBeGreaterThan(0.8);
    expect(share(mid, 3)).toBeLessThan(share(good, 3));
    expect(share(bad, 1)).toBeGreaterThan(0.7);
    expect(waterStars(play(1))).toBe(3);
  });
});
