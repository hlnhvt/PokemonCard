import { describe, it, expect } from 'vitest';
import { createObby3D, step, DT, PHY, COURSES, SPECIES, speciesOf, pickRoster, starsForPlace, medalForPlace, resultOf, snap, standings, stickToWorld, floorBelow, buildCourse } from './obby3d';
import { rotMatrix, sphereBox, sphereCyl, topAt, updatePose } from './obby3d/physics';
import { seeded } from '../../test/seeded';

/** A race with only the child (the AI racers are taken out). */
function solo(course = 0, seed = 1) {
  const s = createObby3D(course, { random: seeded(seed), player: { name: 'Pikachu', types: ['Electric'] } });
  s.racers = [s.player];
  return s;
}
const run = (s, seconds, input = {}) => {
  const out = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(s, DT, typeof input === 'function' ? input(s, i) : input);
    out.push(...s.events.splice(0));
  }
  return out;
};
const place = (s, x, y, z) => {
  const p = s.player;
  Object.assign(p, { x, y, z, vx: 0, vy: 0, vz: 0, grounded: false, support: null, stun: 0, knockCd: 0, shield: 0, out: false, outT: 0, diving: false, dived: false });
  return p;
};
const findOb = (s, type) => s.course.obstacles.find((o) => o.type === type);

describe('obby3d physics primitives', () => {
  it('OBY-01 sphere vs rotated box and cylinder: push-out normals and top heights', () => {
    const box = { kind: 'box', x: 0, y: -0.5, z: 0, hx: 2, hy: 0.5, hz: 2, active: true };
    updatePose(box);
    const h = sphereBox(box, 0, 0.3, 0, 0.45);
    expect(h.ny).toBeCloseTo(1);
    expect(h.depth).toBeCloseTo(0.15);
    expect(sphereBox(box, 0, 1, 0, 0.45)).toBeNull();
    const side = sphereBox(box, 2.3, -0.5, 0, 0.45);
    expect(side.nx).toBeCloseTo(1);
    expect(topAt(box, 1, 1)).toBeCloseTo(0);
    expect(topAt(box, 3, 0)).toBeNull();
    // A ramp pitched up towards -z is higher further along
    const ramp = { kind: 'box', x: 0, y: 0, z: 0, hx: 2, hy: 0.5, hz: 5, pitch: 0.3, active: true };
    updatePose(ramp);
    expect(topAt(ramp, 0, -3)).toBeGreaterThan(topAt(ramp, 0, 3));
    const cyl = { kind: 'cyl', x: 0, y: 0, z: 0, r: 2, hy: 0.5, active: true };
    updatePose(cyl);
    expect(sphereCyl(cyl, 0, 0.8, 0, 0.45).ny).toBeCloseTo(1);
    expect(sphereCyl(cyl, 2.3, 0, 0, 0.45).nx).toBeCloseTo(1);
    // rotMatrix is orthonormal
    const m = rotMatrix(0.4, 0.2, -0.3);
    expect(m[0] * m[0] + m[3] * m[3] + m[6] * m[6]).toBeCloseTo(1);
  });
});

describe('obby3d racer movement', () => {
  it('OBY-02 runs at full speed, jumps about 1.6 m, dives faster than running', () => {
    const s = solo();
    run(s, 0.3);
    const p = s.player;
    expect(p.grounded).toBe(true);
    const z0 = p.z;
    run(s, 1, { sy: 1 });
    expect(Math.hypot(p.vx, p.vz)).toBeCloseTo(PHY.speed, 0);
    expect(p.z).toBeLessThan(z0 - 6);
    const y0 = p.y;
    let top = y0;
    const ev = run(s, 0.9, (st, i) => {
      top = Math.max(top, st.player.y);
      return { jump: i < 2 };
    });
    expect(ev.some((e) => e.type === 'jump' && e.id === 0)).toBe(true);
    expect(top - y0).toBeGreaterThan(1.4);
    expect(top - y0).toBeLessThan(1.9);
    expect(p.grounded).toBe(true);
    // Dive: forward lunge faster than running, then a short belly-slide recovery
    const ev2 = run(s, 0.1, { sy: 1, dive: true });
    expect(ev2.some((e) => e.type === 'dive')).toBe(true);
    expect(Math.hypot(p.vx, p.vz)).toBeGreaterThan(PHY.speed + 1.5);
    run(s, 1);
    expect(p.diving).toBe(false);
  });

  it('OBY-03 the joystick is camera-relative and jump presses are buffered', () => {
    expect(stickToWorld(0, 1, 0).mz).toBeCloseTo(-1);
    expect(stickToWorld(1, 0, 0).mx).toBeCloseTo(1);
    const turned = stickToWorld(0, 1, Math.PI / 2);
    expect(turned.mx).toBeCloseTo(-1);
    const s = solo();
    const p = place(s, 0, 1.2, -10);
    // Pressing jump just before landing still jumps once on the ground
    let jumped = false;
    for (let i = 0; i < 60 && !jumped; i++) {
      step(s, DT, { jump: p.y < 0.65 && p.vy < 0 });
      jumped = s.events.splice(0).some((e) => e.type === 'jump');
    }
    expect(jumped).toBe(true);
  });

  it('OBY-04 a dive crosses a gap that a plain jump cannot (course 3 dive gap); diving into a ledge climbs it', () => {
    const s = solo(2);
    const w = s.course.waypoints.find((x) => x.act === 'dive');
    const attempt = (dive) => {
      place(s, w.x, w.y + PHY.R + 0.01, w.z + 4);
      run(s, 0.2);
      let t = 0;
      return run(s, 3, (st) => {
        t += DT;
        const pz = st.player.z;
        const jump = pz < w.z + 0.2 && t < 2;
        return { sy: 1, jump, dive: dive && jump && st.player.vy < 4.2 && !st.player.grounded };
      });
    };
    const plain = attempt(false);
    expect(plain.some((e) => e.type === 'fall')).toBe(true);
    const ev = attempt(true);
    expect(ev.some((e) => e.type === 'dive')).toBe(true);
    expect(ev.some((e) => e.type === 'fall')).toBe(false);
    expect(s.player.z).toBeLessThan(w.z - 5);
    // Ledge catch: a racer slightly below a platform edge is pulled up when diving into it
    const s2 = solo(0);
    const g = s2.course.waypoints.find((x) => x.act === 'jump');
    const p = place(s2, g.x, g.y - 0.1, g.z - 0.9 - 2.2 + 0.7);
    const ev2 = run(s2, 0.4, { sy: 1, dive: true });
    expect(ev2.some((e) => e.type === 'ledge')).toBe(true);
    expect(p.y).toBeGreaterThan(g.y);
  });
});

describe('obby3d obstacles', () => {
  it('OBY-05 a sweeper bar knocks the racer back with "Ối!" stars and a short stun', () => {
    const s = solo(0);
    const ob = findOb(s, 'sweeper');
    let ev = [];
    // Stand in the path of the bar and wait
    for (let k = 0; k < 600 && !ev.some((e) => e.type === 'knock'); k++) {
      if (k === 0) place(s, ob.x + 4, ob.y, ob.z);
      step(s, DT, {});
      ev = ev.concat(s.events.splice(0));
    }
    const hit = ev.find((e) => e.type === 'knock');
    expect(hit).toBeTruthy();
    expect(hit.src).toBe('sweeper');
    expect(s.player.stun).toBeGreaterThan(0);
    expect(Math.hypot(s.player.vx, s.player.vz)).toBeGreaterThan(5);
  });

  it('OBY-06 honeycomb tiles shake, drop, then come back', () => {
    const s = solo(2);
    const ob = findOb(s, 'honey');
    const tile = ob.tiles[0];
    place(s, tile.x, tile.y + 0.8, tile.z);
    const ev = run(s, 1.2);
    expect(ev.some((e) => e.type === 'tileShake' && e.id === tile.id)).toBe(true);
    expect(ev.some((e) => e.type === 'tileDrop' && e.id === tile.id)).toBe(true);
    expect(tile.active).toBe(false);
    const ev2 = run(s, 4);
    expect(ev2.some((e) => e.type === 'fall')).toBe(true);
    expect(ev2.some((e) => e.type === 'tileBack' && e.id === tile.id)).toBe(true);
    expect(tile.active).toBe(true);
  });

  it('OBY-07 a conveyor belt carries a standing racer backwards; a spinning disc carries it round', () => {
    const s = solo(0);
    const belt = s.course.colliders.find((c) => c.belt);
    const p = place(s, belt.x, belt.y + belt.hy + PHY.R, belt.z);
    run(s, 0.2);
    const z0 = p.z;
    run(s, 1);
    expect(p.z - z0).toBeCloseTo(belt.belt.z, 0);
    const s2 = solo(1);
    const disc = s2.course.colliders.find((c) => c.role === 'spinner');
    const q = place(s2, disc.x + 3, disc.y + disc.hy + PHY.R, disc.z);
    run(s2, 0.2);
    const a0 = Math.atan2(q.z - disc.z, q.x - disc.x);
    run(s2, 1);
    const a1 = Math.atan2(q.z - disc.z, q.x - disc.x);
    expect(Math.abs(a1 - a0)).toBeGreaterThan(0.3);
    expect(Math.hypot(q.x - disc.x, q.z - disc.z)).toBeCloseTo(3, 0);
  });

  it('OBY-08 a mushroom pad launches the racer high and forward', () => {
    const s = solo(0);
    const pad = findOb(s, 'pad').collider;
    place(s, pad.x, pad.y + 1.5, pad.z);
    let top = -Infinity;
    const ev = run(s, 0.8, (st) => {
      top = Math.max(top, st.player.y);
      return {};
    });
    expect(ev.some((e) => e.type === 'bounce')).toBe(true);
    expect(top).toBeGreaterThan(pad.y + 3.5);
    expect(s.player.z).toBeLessThan(pad.z - 2);
  });

  it('OBY-09 door dash: breakable doors burst open, solid doors block', () => {
    const s = solo(1);
    const ob = findOb(s, 'doors');
    const fake = ob.doors.find((d) => d.door.breakable);
    const solid = ob.doors.find((d) => !d.door.breakable);
    place(s, fake.x, fake.y - 1.1, fake.z + 3);
    const ev = run(s, 1.2, { sy: 1 });
    expect(ev.some((e) => e.type === 'doorBreak' && e.door === fake.id)).toBe(true);
    expect(fake.door.broken).toBe(true);
    expect(s.player.z).toBeLessThan(fake.z - 1);
    place(s, solid.x, solid.y - 1.1, solid.z + 3);
    const ev2 = run(s, 1.2, { sy: 1 });
    expect(ev2.some((e) => e.type === 'doorSolid')).toBe(true);
    expect(solid.active).toBe(true);
    expect(s.player.z).toBeGreaterThan(solid.z);
  });

  it('OBY-10 a seesaw tips under a racer standing on one side', () => {
    const s = solo(0);
    const ob = findOb(s, 'seesaw');
    const c = ob.collider;
    place(s, c.x + 2.5, c.y + 1, c.z);
    run(s, 1.2);
    expect(ob.angle).toBeLessThan(-0.1);
  });

  it('OBY-11 hammers and rolling Voltorbs knock racers', () => {
    const s = solo(1);
    const h = findOb(s, 'hammer');
    let ev = [];
    for (let k = 0; k < 400 && !ev.some((e) => e.type === 'knock'); k++) {
      if (k % 120 === 0) place(s, h.px, h.py - h.len + 0.2, h.pz);
      step(s, DT, {});
      ev = ev.concat(s.events.splice(0));
    }
    expect(ev.find((e) => e.type === 'knock')?.src).toBe('hammer');
    const s2 = solo(4);
    const balls = findOb(s2, 'balls');
    let ev2 = [];
    for (let k = 0; k < 900 && !ev2.some((e) => e.type === 'knock'); k++) {
      // stand still in front of the next ball
      const b = balls.list[0];
      if (b && !b.watched) {
        b.watched = true;
        place(s2, b.x, b.y, b.z + 2.6);
      }
      step(s2, DT, {});
      ev2 = ev2.concat(s2.events.splice(0));
    }
    expect(ev2.find((e) => e.type === 'knock')?.src).toBe('ball');
  });
});

describe('obby3d race rules', () => {
  it('OBY-12 falling off respawns at the last checkpoint after about 1 s with a sparkle shield', () => {
    const s = solo(0);
    const cp1 = s.course.checkpoints[1];
    const p = place(s, cp1.x, cp1.y + PHY.R + 0.05, cp1.z - 1);
    run(s, 0.2);
    expect(p.cp).toBe(1);
    place(s, 30, 2, cp1.z - 5); // over the void
    const ev = run(s, 2.2);
    const fall = ev.findIndex((e) => e.type === 'fall');
    const back = ev.findIndex((e) => e.type === 'respawn');
    expect(fall).toBeGreaterThanOrEqual(0);
    expect(back).toBeGreaterThan(fall);
    expect(Math.abs(p.z - cp1.z)).toBeLessThan(3);
    expect(p.out).toBe(false);
    expect(snap(s).falls).toBe(1);
  });

  it('OBY-13 after many falls in one place the next respawn moves on a checkpoint (assist)', () => {
    const s = solo(0);
    const p = s.player;
    for (let k = 0; k < PHY.assistFalls; k++) {
      place(s, 40, 0, -30);
      run(s, 2.4);
    }
    expect(p.cp).toBe(1);
    expect(p.assists).toBe(1);
  });

  it('OBY-14 finish order gives places, stars and medals', () => {
    expect([1, 2, 3, 4, 6, 7, 10, 0].map(starsForPlace)).toEqual([3, 3, 3, 2, 2, 1, 1, 0]);
    expect([1, 2, 3, 5, 0].map(medalForPlace)).toEqual(['gold', 'silver', 'bronze', 'ribbon', null]);
    const s = createObby3D(0, { random: seeded(2), player: { name: 'Eevee' } });
    const [a, b] = s.racers.slice(1, 3);
    [a, b, s.player].forEach((r, i) => Object.assign(r, { x: i * 2 - 2, y: s.course.finishY + 0.5, z: s.course.finishZ + 0.3 + i * 0.5 }));
    const ev = run(s, 0.6, { sy: 1 });
    const order = ev.filter((e) => e.type === 'finish').map((e) => e.id);
    expect(order[0]).toBe(a.id);
    expect(s.player.place).toBeGreaterThanOrEqual(2);
    expect(standings(s)[0]).toBe(a);
    const res = resultOf(s);
    expect(res.stars).toBe(3);
    expect(['silver', 'bronze']).toContain(res.medal);
    // the race ends a few seconds after the child finishes
    const ev2 = run(s, 3.5);
    expect(ev2.some((e) => e.type === 'raceEnd')).toBe(true);
    expect(s.status).toBe('done');
  });

  it('OBY-15 roster: nine opponents, never the child species first, shiny repeats fill up', () => {
    expect(speciesOf('Pikachu V')).toBe('pikachu');
    expect(speciesOf('Raichu')).toBeNull();
    expect(speciesOf('Dark Psyduck')).toBe('psyduck');
    const r = pickRoster('pikachu', seeded(1));
    expect(r).toHaveLength(9);
    expect(r.filter((x) => x.species === 'pikachu')).toHaveLength(0);
    expect(new Set(r.filter((x) => !x.shiny).map((x) => x.species)).size).toBe(7);
    expect(r.filter((x) => x.shiny)).toHaveLength(2);
    const g = pickRoster(null, seeded(2));
    expect(new Set(g.filter((x) => !x.shiny).map((x) => x.species)).size).toBe(SPECIES.length);
    const s = createObby3D(0, { random: seeded(3), player: { name: 'Mewtwo', types: ['Psychic'] } });
    expect(s.player.species).toBe('generic');
    expect(s.player.type).toBe('Psychic');
  });

  it('OBY-16 the same seed gives the same race; courses get longer and harder', () => {
    const go = () => {
      const s = createObby3D(1, { random: seeded(9), player: { name: 'Squirtle' }, bot: true });
      run(s, 20);
      return s.racers.map((r) => `${r.x.toFixed(3)},${r.z.toFixed(3)}`).join('|');
    };
    expect(go()).toBe(go());
    const len = COURSES.map((_, i) => buildCourse(i, seeded(1)).length);
    expect(len[4]).toBeGreaterThan(len[0]);
    expect(COURSES[4].ai.speed[0]).toBeGreaterThan(COURSES[0].ai.speed[0]);
    for (let i = 0; i < COURSES.length; i++) {
      const c = buildCourse(i, seeded(1));
      expect(c.checkpoints.length).toBeGreaterThanOrEqual(4);
      expect(floorBelow({ index: createObby3D(i, { random: seeded(1) }).index, tmp: [] }, 0, -5, 3)).toBeCloseTo(0);
      // waypoints always run forward
      for (let k = 1; k < c.waypoints.length; k++) expect(c.waypoints[k].z).toBeLessThan(c.waypoints[k - 1].z + 0.01);
    }
  });
});

describe('obby3d bot simulation (balance)', () => {
  it('OBY-17 a scripted bot finishes every course in time: top 3 on courses 1-2, top 6 on 3-5; all AI finish', () => {
    const CAP = 200;
    for (let ci = 0; ci < COURSES.length; ci++) {
      const rows = [];
      for (const seed of [1, 2, 3]) {
        const s = createObby3D(ci, { random: seeded(seed * 7 + ci), player: { name: 'Pikachu' }, bot: true, waitAll: true });
        let aiFalls = 0;
        while (s.status !== 'done' && s.t < CAP) {
          step(s, DT);
          for (const e of s.events.splice(0)) if (e.type === 'fall' && e.id !== 0) aiFalls += 1;
        }
        const p = s.player;
        const ai = s.racers.slice(1);
        const aiTimes = ai.map((r) => r.finishTime);
        rows.push({ place: p.place, time: p.finishTime, falls: p.falls, knocks: p.knocks, aiMin: Math.min(...aiTimes), aiMax: Math.max(...aiTimes), aiFalls });
        expect(p.finished).toBe(true);
        expect(p.finishTime).toBeLessThan(90);
        expect(p.assists).toBe(0);
        expect(p.place).toBeLessThanOrEqual(ci < 2 ? 3 : 6);
        expect(ai.every((r) => r.finished)).toBe(true);
        expect(Math.max(...aiTimes)).toBeLessThan(CAP);
      }
      const f = (k, d = 1) => rows.map((r) => r[k].toFixed(d)).join('/');
      console.info(`[obby3d] course ${ci + 1} "${COURSES[ci].name}" len=${buildCourse(ci, seeded(1)).length.toFixed(0)}m bot place ${f('place', 0)} time ${f('time')}s falls ${f('falls', 0)} knocks ${f('knocks', 0)} | AI first ${f('aiMin')}s last ${f('aiMax')}s falls ${f('aiFalls', 0)}`);
    }
  }, 60000);
});
