import { describe, it, expect, beforeEach } from 'vitest';
import { MAPS, KINDS, DT, EAT_K, R0, ROUND_TIME, POWER_TIME, buildCity, createGulp3D, step, run, greedyBot, wanderBot, cityPercent, starsFor, edibleBy, nextGoal, snap } from './gulp3d';
import { loadGulp3d, saveGulp3d, GULP3D_KEY } from './gulp3dStore';
import { seeded } from '../../test/seeded';

const fresh = (m = 0, opts = {}) => createGulp3D(m, { random: seeded(5), ...opts });
/** Put an object of `kind` right next to Snorlax (in front, along +x). */
function place(s, kind, dx = 0.2) {
  const o = s.objects.find((q) => q.alive && q.kind === kind);
  o.x = s.x + s.R * 0.9 + KINDS[kind].r + dx;
  o.z = s.z;
  return o;
}
const types = (s) => s.events.map((e) => e.type);

describe('gulp3d city', () => {
  it('GULP-01 every town is deterministic, has snacks to the giant tower and no overlaps', () => {
    for (let m = 0; m < MAPS.length; m++) {
      const a = buildCity(m);
      const b = buildCity(m);
      expect(a.objects.map((o) => [o.kind, o.x, o.z])).toEqual(b.objects.map((o) => [o.kind, o.x, o.z]));
      const kinds = new Set(a.objects.map((o) => o.kind));
      expect(kinds.has('berry')).toBe(true);
      expect(kinds.has('pokeball')).toBe(true);
      expect(kinds.has('mart')).toBe(true);
      expect(kinds.has('center')).toBe(true);
      expect(kinds.has(m === 2 ? 'lighthouse' : 'tower')).toBe(true);
      expect(a.objects.length).toBeGreaterThan(300);
      let overlaps = 0;
      for (let i = 0; i < a.objects.length; i++) {
        for (let j = i + 1; j < a.objects.length; j++) {
          const p = a.objects[i];
          const q = a.objects[j];
          if (Math.hypot(p.x - q.x, p.z - q.z) <= KINDS[p.kind].r + KINDS[q.kind].r) overlaps += 1;
        }
      }
      expect(overlaps).toBe(0);
      // The start spot is clear
      expect(a.objects.every((o) => Math.hypot(o.x, o.z) > 4.5)).toBe(true);
    }
  });
});

describe('gulp3d eating', () => {
  it('GULP-02 touching something smaller swallows it: points, growth, munch event', () => {
    const s = fresh();
    const o = place(s, 'berry', -0.1);
    step(s, DT, {});
    expect(o.alive).toBe(false);
    expect(s.score).toBe(KINDS.berry.pts);
    expect(s.targetR).toBeGreaterThan(R0);
    expect(s.events.find((e) => e.type === 'eat')).toMatchObject({ by: 'player', kind: 'berry', id: o.id });
    run(s, 1, {});
    expect(s.R).toBeGreaterThan(R0); // grows smoothly
    expect(s.R).toBeLessThanOrEqual(s.targetR + 1e-9);
  });

  it('GULP-03 something too big bumps softly: Snorlax is pushed back, the object jiggles, no damage', () => {
    const s = fresh();
    const house = place(s, 'house', -0.6);
    const x0 = s.x;
    for (let i = 0; i < 30; i++) step(s, DT, { x: 1, z: 0 });
    expect(house.alive).toBe(true);
    expect(s.x).toBeLessThan(house.x - KINDS.house.r * 0.8);
    expect(s.events.filter((e) => e.type === 'bump')).toHaveLength(1); // one hint, not a spam
    expect(s.events.find((e) => e.type === 'bump').need).toBeCloseTo(KINDS.house.size / EAT_K);
    expect(house.jig).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(x0)).toBe(true);
  });

  it('GULP-04 combo and golden berry double the points; combo event every 5 bites', () => {
    const s = fresh();
    s.powers.gold = POWER_TIME.gold;
    let pts = 0;
    for (let i = 0; i < 5; i++) {
      place(s, 'pokeball', -0.1);
      step(s, DT, {});
    }
    for (const e of s.events) if (e.type === 'eat') pts += e.pts;
    expect(s.combo).toBe(5);
    expect(pts).toBeGreaterThan(KINDS.pokeball.pts * 2 * 5);
    expect(types(s)).toContain('combo');
    run(s, 2, {});
    expect(s.combo).toBe(0);
  });

  it('GULP-05 growing past a size tier fires a level-up naming what can be eaten now', () => {
    const s = fresh();
    s.mass = 4;
    s.targetR = Math.sqrt(R0 * R0 + 0.15 * s.mass);
    run(s, 3, {});
    const lv = s.events.find((e) => e.type === 'levelup');
    expect(lv).toBeTruthy();
    expect(lv.kinds.length).toBeGreaterThan(0);
    expect(edibleBy(s.R, 'bench')).toBe(true);
    expect(nextGoal(s).progress).toBeGreaterThanOrEqual(0);
  });

  it('GULP-06 powerups: speed is faster, magnet pulls small snacks in', () => {
    const a = fresh();
    const b = fresh();
    b.powers.speed = POWER_TIME.speed;
    run(a, 0.8, { x: 0, z: 1 });
    run(b, 0.8, { x: 0, z: 1 });
    expect(Math.abs(b.z - b.city.start.z)).toBeGreaterThan(Math.abs(a.z - a.city.start.z) * 1.3);
    const m = fresh();
    const o = m.objects.find((q) => q.kind === 'berry');
    o.x = m.x + 4;
    o.z = m.z;
    m.powers.magnet = POWER_TIME.magnet;
    run(m, 1.5, {});
    expect(o.alive).toBe(false);
    // Picking one up starts its timer
    const p = fresh();
    const pw = p.powerups[0];
    pw.x = p.x + 0.5;
    pw.z = p.z;
    step(p, DT, {});
    expect(p.powers[pw.type]).toBeGreaterThan(POWER_TIME[pw.type] - 0.1);
    expect(types(p)).toContain('power');
  });

  it('GULP-07 friendly Pokemon run away and are never eaten; a sniff drops a berry', () => {
    const s = fresh();
    const p = s.pokemon[0];
    p.x = s.x + 0.6;
    p.z = s.z;
    const n0 = s.objects.length;
    step(s, DT, {});
    expect(types(s)).toContain('sniff');
    expect(s.objects.length).toBe(n0 + 1);
    expect(s.objects[n0]).toMatchObject({ kind: 'berry', dropped: true, alive: true });
    run(s, 1, {});
    expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeGreaterThan(s.R);
    expect(p.fleeing).toBe(true);
    expect(s.pokemon).toHaveLength(MAPS[0].pokemon);
  });

  it('GULP-08 the round ends after 2 minutes with a finish event; rival Munchlax eats too', () => {
    const s = fresh(0);
    run(s, ROUND_TIME + 1, {});
    expect(s.status).toBe('done');
    expect(s.timeLeft).toBe(0);
    expect(s.events.filter((e) => e.type === 'finish')).toHaveLength(1);
    expect(s.rival.score).toBeGreaterThan(0);
    expect(s.events.some((e) => e.type === 'eat' && e.by === 'rival')).toBe(true);
    step(s, DT, {});
    expect(snap(s).status).toBe('done');
    expect(starsFor(0, MAPS[0])).toBe(0);
    expect(starsFor(MAPS[0].stars[2], MAPS[0])).toBe(3);
  });
});

describe('gulp3d balance (bot simulation)', () => {
  it('GULP-09 greedy bot gets 3 stars and eats > 70% of every town; a wandering bot gets at most 1 star', () => {
    for (let m = 0; m < MAPS.length; m++) {
      for (const seed of [1, 2]) {
        const g = createGulp3D(m, { random: seeded(seed) });
        run(g, ROUND_TIME + 1, greedyBot);
        const w = createGulp3D(m, { random: seeded(seed) });
        run(w, ROUND_TIME + 1, wanderBot);
        const top = g.objects.find((o) => o.kind === 'tower' || o.kind === 'lighthouse');
        console.info(`[gulp3d] ${MAPS[m].id} seed ${seed}: greedy ${g.score} pts ${cityPercent(g)}% R=${g.R.toFixed(1)} ${starsFor(g.score, g.map)}★ tower ${top.alive ? 'standing' : 'eaten'} rival ${g.rival.score} | wander ${w.score} pts ${cityPercent(w)}% ${starsFor(w.score, w.map)}★ | stars at ${MAPS[m].stars.join('/')}`);
        expect(starsFor(g.score, g.map)).toBe(3);
        expect(cityPercent(g)).toBeGreaterThan(70);
        expect(top.alive).toBe(false);
        expect(starsFor(w.score, w.map)).toBeLessThanOrEqual(1);
      }
    }
  }, 60000);
});

describe('gulp3d store', () => {
  beforeEach(() => localStorage.removeItem(GULP3D_KEY));
  it('GULP-10 keeps the best score per town', () => {
    expect(loadGulp3d()).toEqual({ best: {}, rounds: 0 });
    expect(saveGulp3d('pallet', 1200).isNew).toBe(true);
    expect(saveGulp3d('pallet', 800).isNew).toBe(false);
    expect(loadGulp3d()).toEqual({ best: { pallet: 1200 }, rounds: 2 });
    localStorage.setItem(GULP3D_KEY, '{bad');
    expect(loadGulp3d().best).toEqual({});
  });
});
