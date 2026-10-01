import { describe, it, expect } from 'vitest';
import {
  LEVELS,
  WORLDS,
  DT,
  BERRY_R,
  createSnorlax,
  stepOnce,
  stepSnorlax,
  replay,
  cutRope,
  swipe,
  tapAt,
  popBubble,
  puff,
  hintFor,
  applyAction,
  starAt,
  levelKinds,
  segmentsCross,
} from './snorlax';
import { seeded } from '../../test/seeded';

const base = (extra = {}) => ({ id: 0, world: 0, berry: { x: 180, y: 200 }, ropes: [{ x: 180, y: 80 }], stars: [], mouth: { x: 180, y: 470 }, solution: [{ t: 0.2, cut: 0 }], ...extra });

/** Random play: the same number of actions as the solution, random kinds, targets and times. */
function randomPlay(lv, rnd) {
  const ropes = lv.ropes.length + (lv.webs?.length || 0);
  return lv.solution.map(() => {
    const r = rnd();
    const t = Math.round((0.2 + rnd() * 4) * 20) / 20;
    if (r < 0.2 && lv.bubbles?.length) return { t, pop: Math.floor(rnd() * lv.bubbles.length) };
    if (r < 0.4 && lv.puffers?.length) return { t, puff: Math.floor(rnd() * lv.puffers.length) };
    return { t, cut: Math.floor(rnd() * ropes) };
  });
}

describe('snorlax engine rules', () => {
  it('SNX-01 a hanging berry stays on its rope; cut it and it falls straight into the mouth', () => {
    const s = createSnorlax(base());
    stepSnorlax(s, 1);
    expect(s.status).toBe('play');
    expect(s.berry.y).toBeCloseTo(200, 0);
    expect(cutRope(s, 0)).toBe(true);
    expect(cutRope(s, 0)).toBe(false);
    stepSnorlax(s, 3);
    expect(s.status).toBe('won');
    expect(s.earned).toBe(1); // a win is always worth at least one star
  });

  it('SNX-02 a swipe that crosses the rope cuts it; one that misses does nothing', () => {
    const s = createSnorlax(base());
    expect(swipe(s, 100, 140, 150, 140)).toEqual([]);
    expect(swipe(s, 120, 140, 240, 140)).toEqual([0]);
    expect(s.ropes[0].attached).toBe(false);
    expect(s.events.some((e) => e.type === 'cut')).toBe(true);
    expect(segmentsCross(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true);
    expect(segmentsCross(0, 0, 10, 0, 0, 5, 10, 5)).toBe(false);
  });

  it('SNX-03 stars are collected when the berry touches them (moving ones too)', () => {
    const s = createSnorlax(base({ stars: [{ x: 180, y: 300 }, { x: 180, y: 380 }, { x: 300, y: 300 }] }));
    cutRope(s, 0);
    stepSnorlax(s, 3);
    expect(s.status).toBe('won');
    expect(s.collected).toBe(2);
    expect(s.earned).toBe(2);
    const mv = { x: 100, y: 100, move: { ax: 30, w: 2 } };
    expect(starAt(mv, 0).x).toBeCloseTo(100);
    expect(starAt(mv, Math.PI / 4).x).toBeCloseTo(130);
  });

  it('SNX-04 a bubble catches the berry and floats it up; popping drops it again', () => {
    const s = createSnorlax(base({ bubbles: [{ x: 180, y: 300 }] }));
    cutRope(s, 0);
    stepSnorlax(s, 0.6);
    expect(s.berry.bubble).toBe(0);
    const y = s.berry.y;
    stepSnorlax(s, 0.6);
    expect(s.berry.y).toBeLessThan(y);
    expect(tapAt(s, s.bubbles[0].x, s.bubbles[0].y)).toEqual({ kind: 'pop', index: 0 });
    expect(s.berry.bubble).toBe(-1);
    expect(popBubble(s, 0)).toBe(false);
    stepSnorlax(s, 3);
    expect(s.status).toBe('won');
  });

  it('SNX-05 a bubble left alone carries the berry off the top: lost', () => {
    const s = createSnorlax(base({ bubbles: [{ x: 180, y: 300 }] }));
    cutRope(s, 0);
    stepSnorlax(s, 8);
    expect(s.status).toBe('lost');
    expect(s.reason).toBe('flew');
  });

  it('SNX-06 Jigglypuff pushes the berry only when it is in front and in range', () => {
    const s = createSnorlax(base({ puffers: [{ x: 60, y: 200, angle: 0 }, { x: 300, y: 500, angle: Math.PI }] }));
    cutRope(s, 0);
    puff(s, 1); // berry is not in front of this one
    expect(s.berry.x - s.berry.px).toBeCloseTo(0, 5);
    puff(s, 0);
    expect((s.berry.x - s.berry.px) / DT).toBeGreaterThan(150);
    expect(tapAt(s, 60, 200)).toEqual({ kind: 'puff', index: 0 });
    expect(tapAt(s, 10, 10)).toBe(null);
  });

  it('SNX-07 a bounce pad throws the berry back up, thorns burst it, falling off is lost', () => {
    const pad = createSnorlax(base({ mouth: { x: 40, y: 120 }, pads: [{ x1: 140, y1: 400, x2: 220, y2: 400 }] }));
    cutRope(pad, 0);
    let bounced = false;
    for (let i = 0; i < 240 && !bounced; i++) {
      stepOnce(pad);
      bounced = pad.events.some((e) => e.type === 'bounce');
      pad.events.length = 0;
    }
    expect(bounced).toBe(true);
    expect(pad.berry.y - pad.berry.py).toBeLessThan(0);
    const thorn = createSnorlax(base({ spikes: [{ x1: 140, y1: 360, x2: 220, y2: 360 }] }));
    cutRope(thorn, 0);
    stepSnorlax(thorn, 2);
    expect(thorn.status).toBe('lost');
    expect(thorn.reason).toBe('spike');
    const off = createSnorlax(base({ mouth: { x: 40, y: 120 } }));
    cutRope(off, 0);
    stepSnorlax(off, 3);
    expect(off.reason).toBe('fell');
  });

  it('SNX-08 a Spinarak web throws a new rope when the berry passes near, and that rope can be cut', () => {
    const s = createSnorlax(base({ mouth: { x: 40, y: 120 }, webs: [{ x: 230, y: 300 }] }));
    expect(s.ropes).toHaveLength(2);
    expect(s.ropes[1].attached).toBe(false);
    cutRope(s, 0);
    stepSnorlax(s, 1);
    expect(s.webs[0].used).toBe(true);
    expect(s.ropes[1].attached).toBe(true);
    expect(Math.hypot(s.berry.x - 230, s.berry.y - 300)).toBeLessThanOrEqual(s.ropes[1].len + 0.5);
    expect(cutRope(s, 1)).toBe(true);
  });

  it('SNX-09 physics is deterministic: the same actions give exactly the same result', () => {
    const lv = LEVELS[LEVELS.length - 1];
    const a = replay(lv, lv.solution);
    const b = replay(lv, lv.solution);
    expect(a.t).toBe(b.t);
    expect(a.berry.x).toBe(b.berry.x);
    expect(a.status).toBe('won');
  });

  it('SNX-10 the hint points at the next action of the solution not done yet', () => {
    const s = createSnorlax(0);
    const h = hintFor(s);
    expect(h.kind).toBe('cut');
    expect(h.x).toBeCloseTo(180, 0);
    expect(h.y).toBeGreaterThan(70);
    expect(h.y).toBeLessThan(190);
    expect(h.t).toBe(LEVELS[0].solution[0].t);
    cutRope(s, 0);
    expect(hintFor(s)).toBe(null);
    const multi = LEVELS.findIndex((lv) => lv.solution.length >= 3);
    const m = createSnorlax(multi);
    const [a0, a1] = LEVELS[multi].solution;
    expect(hintFor(m).t).toBe(a0.t);
    stepSnorlax(m, a0.t);
    applyAction(m, a0);
    expect(hintFor(m).t).toBe(a1.t);
  });
});

describe('snorlax levels', () => {
  it('SNX-11 30 levels in 5 worlds of 6, elements introduced one world at a time', () => {
    expect(LEVELS).toHaveLength(30);
    expect(WORLDS).toHaveLength(5);
    LEVELS.forEach((lv, i) => {
      expect(lv.id).toBe(i + 1);
      expect(lv.world).toBe(Math.floor(i / 6));
      expect(lv.stars).toHaveLength(3);
      expect(lv.ropes.length).toBeGreaterThan(0);
      expect(lv.solution.length).toBeGreaterThan(0);
    });
    const firstWorld = (kind) => Math.min(...LEVELS.filter((lv) => levelKinds(lv).includes(kind)).map((lv) => lv.world));
    expect(LEVELS.filter((lv) => lv.world === 0).every((lv) => levelKinds(lv).length === 0)).toBe(true);
    expect(firstWorld('bubble')).toBe(1);
    expect(firstWorld('puffer')).toBe(2);
    expect(firstWorld('pad')).toBe(3);
    expect(firstWorld('spike')).toBe(4);
    expect(firstWorld('web')).toBe(4);
    // later levels mix things and move stars and Snorlax around
    expect(LEVELS.filter((lv) => lv.stars.some((st) => st.move)).length).toBeGreaterThanOrEqual(5);
    expect(LEVELS.filter((lv) => lv.mouth.y < 440).length).toBeGreaterThanOrEqual(3);
    expect(new Set(LEVELS.map((lv) => Math.round(lv.mouth.x / 40))).size).toBeGreaterThanOrEqual(5);
    // everything is inside the play field and the berry never starts next to Snorlax
    for (const lv of LEVELS) {
      expect(lv.mouth.x).toBeGreaterThan(50);
      expect(lv.mouth.x).toBeLessThan(310);
      expect(Math.hypot(lv.berry.x - lv.mouth.x, lv.berry.y - lv.mouth.y)).toBeGreaterThan(120);
      for (const st of lv.stars) expect(st.y).toBeGreaterThan(BERRY_R);
    }
  });

  it('SNX-12 every level is solvable: its solution replays to a win with all 3 stars; idling never wins; random play mostly fails', () => {
    const rows = LEVELS.map((lv, i) => {
      const s = replay(lv, lv.solution);
      const idle = replay(lv, [], 12);
      // every action of the solution is needed
      const needed = lv.solution.every((_, k) => replay(lv, lv.solution.filter((__, j) => j !== k)).status !== 'won');
      const rnd = seeded(1000 + i);
      let wins = 0;
      const tries = 30;
      for (let k = 0; k < tries; k++) if (replay(lv, randomPlay(lv, rnd)).status === 'won') wins++;
      return { level: i + 1, status: s.status, stars: s.earned, t: s.t, idle: idle.status, needed, rate: wins / tries };
    });
    for (const r of rows) {
      expect(r.status, `level ${r.level}`).toBe('won');
      expect(r.idle, `level ${r.level} idle`).not.toBe('won');
      expect(r.needed, `level ${r.level} every action needed`).toBe(true);
    }
    const threeStar = rows.filter((r) => r.stars === 3).length;
    expect(threeStar).toBeGreaterThanOrEqual(20);
    expect(threeStar).toBe(30);
    const later = rows.slice(12);
    const laterRate = later.reduce((a, r) => a + r.rate, 0) / later.length;
    expect(laterRate).toBeLessThan(0.2);
    for (const r of rows.slice(18)) expect(r.rate, `level ${r.level} random`).toBeLessThanOrEqual(0.4);
    const avgT = rows.reduce((a, r) => a + r.t, 0) / rows.length;
    console.info(
      `[snorlax] ${rows.length} levels solvable, ${threeStar}/30 three-star solutions, idle wins 0, avg solve ${avgT.toFixed(1)}s, actions ${Math.min(...LEVELS.map((l) => l.solution.length))}-${Math.max(...LEVELS.map((l) => l.solution.length))}, random-play win rate L1-12 ${(rows.slice(0, 12).reduce((a, r) => a + r.rate, 0) / 12).toFixed(2)} / L13-30 ${laterRate.toFixed(2)}`
    );
  });
});
