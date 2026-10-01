import { describe, it, expect } from 'vitest';
import { LEVELS, FLIGHT, DT, RING_BONUS, GOLD_BONUS, BUMP_PENALTY, createSky3D, step, run, autopilot, buildCourse, heightAt, floorAt, ringPos, starsFor, forwardOf, snap, mulberry } from './sky3d';
import { seeded } from '../../test/seeded';

const fresh = (i = 0) => createSky3D(i, { random: seeded(7) });
/** Put the player just in front of ring k, flying straight at it. */
function lineUp(s, k, { dx = 0, dy = 0, back = 6 } = {}) {
  const r = s.rings[k];
  const c = ringPos(r, s.t);
  s.x = c.x - r.nx * back + r.nz * dx;
  s.z = c.z - r.nz * back - r.nx * dx;
  s.y = c.y + dy;
  s.yaw = Math.atan2(-r.nx, -r.nz);
  s.pitch = 0;
  s.bank = 0;
  return s;
}

describe('sky3d flight physics', () => {
  it('SKY-01 holding right turns right (heading decreases) and banks; left does the opposite', () => {
    const s = fresh();
    const yaw0 = s.yaw;
    run(s, 1, { turn: 1 });
    expect(s.bank).toBeGreaterThan(0.9);
    expect(s.yaw).toBeLessThan(yaw0 - 0.8);
    const t = fresh();
    run(t, 1, { turn: -1 });
    expect(t.yaw).toBeGreaterThan(yaw0 + 0.8);
    // Releasing the stick levels the wings again
    run(t, 1.5, {});
    expect(Math.abs(t.bank)).toBeLessThan(0.05);
  });

  it('SKY-02 pulling up climbs, pushing down dives; pitch is limited', () => {
    const s = fresh();
    const y0 = s.y;
    run(s, 2, { climb: 1 });
    expect(s.y).toBeGreaterThan(y0 + 15);
    expect(s.pitch).toBeLessThanOrEqual(FLIGHT.maxPitch + 1e-9);
    const d = fresh();
    d.y = 80;
    run(d, 1, { climb: -1 });
    expect(d.y).toBeLessThan(75);
    expect(d.pitch).toBeGreaterThanOrEqual(-FLIGHT.maxPitch - 1e-9);
  });

  it('SKY-03 speed stays between the limits; boost is faster and drains the meter, which refills', () => {
    const s = fresh();
    s.y = 90;
    run(s, 2, {});
    expect(s.speed).toBeGreaterThan(FLIGHT.baseSpeed - 2);
    expect(s.speed).toBeLessThan(FLIGHT.baseSpeed + 2);
    run(s, 1.5, { boost: true });
    expect(s.boosting).toBe(true);
    expect(s.speed).toBeGreaterThan(FLIGHT.baseSpeed + 8);
    expect(s.boost).toBeLessThan(0.5);
    for (let i = 0; i < 300 && !s.boostLocked; i++) step(s, DT, { boost: true });
    expect(s.boost).toBe(0);
    expect(s.boostLocked).toBe(true);
    expect(s.events.some((e) => e.type === 'boostEmpty')).toBe(true);
    const fast = s.speed;
    run(s, 0.5, { boost: true });
    expect(s.boosting).toBe(false); // empty: no boost until it refills a bit
    expect(s.speed).toBeLessThan(fast);
    run(s, 3, {});
    expect(s.boost).toBeGreaterThan(FLIGHT.boostRestart);
    run(s, 0.1, { boost: true });
    expect(s.boosting).toBe(true);
    for (let i = 0; i < 600; i++) {
      step(s, DT, { boost: true, climb: -1 });
      expect(s.speed).toBeLessThanOrEqual(FLIGHT.maxSpeed);
      expect(s.speed).toBeGreaterThanOrEqual(FLIGHT.minSpeed);
    }
  });
});

describe('sky3d rings', () => {
  it('SKY-04 flying through the next ring counts it, adds time, rises the chime index and starts a combo', () => {
    const s = fresh();
    lineUp(s, 0);
    const before = s.timeLeft;
    run(s, 0.5, {});
    expect(s.hits).toBe(1);
    expect(s.next).toBe(1);
    expect(s.rings[0].state).toBe('hit');
    expect(s.timeLeft).toBeGreaterThan(before + RING_BONUS - 1);
    expect(s.events.find((e) => e.type === 'ring')).toMatchObject({ index: 0, count: 1, combo: 1 });
    lineUp(s, 1);
    run(s, 0.5, {});
    expect(s.hits).toBe(2);
    expect(s.combo).toBe(2);
    expect(s.events.some((e) => e.type === 'combo' && e.n === 2)).toBe(true);
  });

  it('SKY-05 passing beside a ring (outside the disc) skips it as missed; rings further ahead are not counted early', () => {
    const s = fresh();
    lineUp(s, 0, { dx: RING_RADIUS_OUTSIDE(s, 0) });
    run(s, 0.5, {});
    expect(s.hits).toBe(0);
    expect(s.rings[0].state).toBe('miss');
    expect(s.missed).toBe(1);
    expect(s.next).toBe(1);
    // Far from everything: nothing happens
    const t = fresh();
    t.y = 120;
    run(t, 1, {});
    expect(t.hits + t.missed).toBe(0);
  });

  it('SKY-06 flying through a later ring skips the ones before it (in order: no going back for points)', () => {
    const s = fresh();
    lineUp(s, 2);
    run(s, 0.5, {});
    expect(s.rings[0].state).toBe('miss');
    expect(s.rings[1].state).toBe('miss');
    expect(s.rings[2].state).toBe('hit');
    expect(s.next).toBe(3);
    // An old ring does not count any more
    lineUp(s, 0);
    run(s, 0.5, {});
    expect(s.hits).toBe(1);
  });

  it('SKY-07 golden rings give more time; moving rings move and are still hit where they are', () => {
    const lv = LEVELS.findIndex((l) => l.gold > 0 && l.moving > 0);
    const s = createSky3D(lv, { random: seeded(1) });
    const g = s.rings.findIndex((r) => r.gold);
    s.next = g;
    lineUp(s, g);
    const before = s.timeLeft;
    run(s, 0.5, {});
    expect(s.rings[g].state).toBe('hit');
    expect(s.timeLeft).toBeGreaterThan(before + GOLD_BONUS - 1);
    const m = s.rings.findIndex((r) => r.move);
    const a = ringPos(s.rings[m], 0);
    const b = ringPos(s.rings[m], 2);
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(0.5);
    s.next = m;
    s.t = 1.3;
    lineUp(s, m, { back: 3 });
    run(s, 0.25, {});
    expect(s.rings[m].state).toBe('hit');
  });

  it('SKY-08 every course is a valid flight: rings in the air, above the ground, inside the boundary', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const c = buildCourse(i);
      expect(c.rings.length).toBe(LEVELS[i].rings);
      for (const r of c.rings) {
        expect(r.y - floorAt(c, r.x, r.z)).toBeGreaterThan(10);
        expect(Math.hypot(r.x - c.bounds.cx, r.z - c.bounds.cz)).toBeLessThan(c.bounds.r - 50);
      }
      expect(c.timeLimit).toBeGreaterThan(20);
      // Same course every time (the scene builds the same terrain)
      expect(buildCourse(i).rings[3].x).toBe(c.rings[3].x);
    }
  });
});

describe('sky3d assists', () => {
  it('SKY-09 diving at the ground or the sea never goes below it: pull-up assist and a hard floor', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const s = createSky3D(i, { random: seeded(i) });
      const rnd = mulberry(i + 3);
      let assisted = false;
      for (let k = 0; k < 60 * 40 && s.status === 'play'; k++) {
        step(s, DT, { climb: -1, turn: Math.sin(k / 90) * (rnd() < 0.5 ? 1 : 0.4), boost: k % 200 < 60 });
        s.timeLeft = 99; // keep flying
        const floor = floorAt(s.course, s.x, s.z);
        expect(s.y).toBeGreaterThanOrEqual(floor + FLIGHT.clearance - 1e-6);
        assisted ||= s.assist;
      }
      expect(assisted).toBe(true);
    }
  });

  it('SKY-10 skimming the water makes splashes', () => {
    const s = fresh(1);
    // Find sea near the start
    let spot = null;
    for (let a = 0; a < 60 && !spot; a++) {
      for (let d = 60; d < 400 && !spot; d += 20) {
        const x = s.course.bounds.cx + Math.cos(a) * d;
        const z = s.course.bounds.cz + Math.sin(a) * d;
        if (heightAt(s.course, x, z) < -6 && heightAt(s.course, x + 30, z) < -6) spot = { x, z };
      }
    }
    expect(spot).toBeTruthy();
    s.x = spot.x;
    s.z = spot.z;
    s.y = 5;
    s.yaw = Math.PI / 2; // towards -x
    s.x += 30;
    run(s, 0.6, { climb: -1 });
    expect(s.events.some((e) => e.type === 'splash')).toBe(true);
    expect(s.y).toBeGreaterThanOrEqual(FLIGHT.clearance - 1e-6);
  });

  it('SKY-11 flying out of the course: the wind turns the rider back without any input', () => {
    const s = fresh();
    const c = s.course.bounds;
    s.x = c.cx + c.r + 20;
    s.z = c.cz;
    s.y = 60;
    s.yaw = Math.atan2(-1, 0); // flying further out (+x)
    run(s, 0.1, {});
    expect(s.outside).toBe(true);
    expect(s.events.some((e) => e.type === 'wind')).toBe(true);
    run(s, 8, {});
    expect(Math.hypot(s.x - c.cx, s.z - c.cz)).toBeLessThan(c.r);
    expect(s.outside).toBe(false);
  });

  it('SKY-12 Team Rocket balloons and storm clouds only cost a few seconds (no crash) once per bump', () => {
    const lv = LEVELS.findIndex((l) => l.balloons > 0 && l.storms > 0);
    const s = createSky3D(lv, { random: seeded(2) });
    const h = s.hazards[0];
    s.t = 0;
    s.x = h.x;
    s.z = h.z + 3;
    s.y = h.y + Math.sin(h.phase) * h.bob;
    s.yaw = 0;
    const before = s.timeLeft;
    step(s, DT, {});
    expect(s.bumps).toBe(1);
    expect(s.timeLeft).toBeCloseTo(before - DT - BUMP_PENALTY, 3);
    expect(s.status).toBe('play');
    step(s, DT, {});
    expect(s.bumps).toBe(1);
    expect(s.hazards.some((x) => x.kind === 'storm')).toBe(true);
  });
});

describe('sky3d stars', () => {
  it('SKY-13 stars by rings and time left', () => {
    const c = buildCourse(0);
    const n = c.rings.length;
    expect(starsFor(c, { hits: n, timeLeft: c.star3, finished: true })).toBe(3);
    expect(starsFor(c, { hits: n, timeLeft: c.star3 - 1, finished: true })).toBe(2);
    expect(starsFor(c, { hits: n - 1, timeLeft: 99, finished: true })).toBe(2);
    expect(starsFor(c, { hits: 1, timeLeft: 99, finished: true })).toBe(1);
    expect(starsFor(c, { hits: Math.ceil(n / 2), timeLeft: 0, finished: false })).toBe(1);
    expect(starsFor(c, { hits: 1, timeLeft: 0, finished: false })).toBe(0);
  });

  it('SKY-14 the timer runs out: the flight ends', () => {
    const s = fresh();
    s.y = 100;
    s.timeLeft = 1;
    run(s, 2, {});
    expect(s.status).toBe('timeout');
    expect(s.events.some((e) => e.type === 'timeout')).toBe(true);
    expect(snap(s).status).toBe('timeout');
    expect(forwardOf(s).y).toBeLessThanOrEqual(1);
  });
});

describe('sky3d bot simulation', () => {
  it('SKY-15 an autopilot to each next ring gets 3 stars on every level within time; flying straight fails', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const s = createSky3D(i, { random: seeded(11 + i) });
      let minClear = Infinity;
      run(s, 300, (st) => {
        minClear = Math.min(minClear, st.y - floorAt(st.course, st.x, st.z));
        return autopilot(st);
      });
      const b = createSky3D(i, { random: seeded(11 + i) });
      run(b, 300, {});
      // A slower, wobbly flier (reacts every 0.35 s, 70% stick, noise, never boosts)
      const k = createSky3D(i, { random: seeded(11 + i) });
      const rnd = seeded(99 + i);
      let held = {};
      let cd = 0;
      run(k, 300, (st) => {
        cd -= DT;
        if (cd <= 0) {
          cd = 0.35;
          const a = autopilot(st, { boost: false });
          held = { turn: a.turn * 0.7 + (rnd() - 0.5) * 0.5, climb: a.climb * 0.7 + (rnd() - 0.5) * 0.5 };
        }
        return held;
      });
      const c = s.course;
      console.info(
        `[sky3d] L${i + 1} ${LEVELS[i].name}: rings=${c.rings.length} len=${c.length.toFixed(0)}m limit=${c.timeLimit}s star3>=${c.star3}s | autopilot ${s.status} in ${s.t.toFixed(1)}s, left ${s.timeLeft.toFixed(1)}s, rings ${s.hits}/${c.rings.length}, items ${s.stars + s.balls}/${c.items.length}, bumps ${s.bumps}, trail ${s.trailSeconds}s, ${s.earned}★ (min clearance ${minClear.toFixed(1)}m) | wobbly ${k.status} ${k.t.toFixed(1)}s rings ${k.hits} ${k.earned}★ | straight ${b.status} rings ${b.hits} ${b.earned}★`
      );
      expect(s.status).toBe('done');
      expect(s.earned).toBe(3);
      expect(s.t).toBeLessThan(c.timeLimit);
      expect(k.status).toBe('done');
      expect(k.earned).toBeGreaterThanOrEqual(2);
      expect(b.earned).toBeLessThanOrEqual(1);
    }
  });
});

function RING_RADIUS_OUTSIDE(s, k) {
  return s.rings[k].r + 4;
}
