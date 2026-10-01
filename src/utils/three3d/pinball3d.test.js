import { describe, it, expect, beforeAll } from 'vitest';
import {
  DT, BALL_R, MAX_SPEED, BALLS, SAVE_TIME, CATCH_TIME, STAR2, STAR3, POINTS, TABLE, FLIPPER, RAMP_TIME, CLOYSTER_HOLD, HOLE_HOLD,
  createPinball, startGame, addBall, step, launch, canLaunch, laneBall, flipperPose, snap, starsForScore, goldForGame, simulate,
} from './pinball3d';
import { loadPinball3d, savePinball3d, PINBALL3D_KEY } from './pinball3dStore';
import { seeded } from '../../test/seeded';

/** A game in play with no ball (the test puts its own) and the ball save already used. */
function table(seed = 1) {
  const s = createPinball({ random: seeded(seed) });
  startGame(s);
  s.balls = [];
  s.saveStarted = true;
  s.saveLeft = 0;
  s.events.length = 0;
  return s;
}
const types = (s) => s.events.map((e) => e.type);
function run(s, seconds, input = {}, each) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n && s.status === 'play'; i++) {
    each?.(s, i);
    step(s, DT, typeof input === 'function' ? input(s, i) : input);
  }
  return s;
}

function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return [Math.hypot(px - ax - dx * t, py - ay - dy * t), t];
}
/** Free spots for test balls: not touching any wall, bumper or post. */
function freeSpot(r) {
  for (;;) {
    const x = 0.35 + r() * 8.5;
    const y = 2.6 + r() * 16;
    if (y > 15 && Math.hypot(x - 5, y - 15) > 5 - BALL_R - 0.1) continue;
    if (TABLE.walls.some((w) => distSeg(x, y, w.x1, w.y1, w.x2, w.y2)[0] < BALL_R + 0.05)) continue;
    if ([...TABLE.bumpers, TABLE.center, ...TABLE.posts].some((c) => Math.hypot(x - c.x, y - c.y) < c.r + BALL_R + 0.05)) continue;
    if (TABLE.drops.some((d) => distSeg(x, y, d.x, d.y0, d.x, d.y1)[0] < BALL_R + 0.05)) continue;
    return [x, y];
  }
}
/** Checks one ball movement against every solid thing; returns a problem or null. */
function problem(s, b, px, py) {
  if (b.mode !== 'play') return null;
  if (b.x < BALL_R - 0.03 || b.x > 10 - BALL_R + 0.03 || b.y > 20) return `outside ${b.x},${b.y}`;
  if (b.y > 15 && Math.hypot(b.x - 5, b.y - 15) > 5 - BALL_R + 0.03) return `through the arc ${b.x},${b.y}`;
  for (const w of TABLE.walls) {
    if (w.oneWay) continue;
    if (segCross(px, py, b.x, b.y, w.x1, w.y1, w.x2, w.y2)) return `crossed ${w.kind} ${w.x1},${w.y1}-${w.x2},${w.y2}`;
  }
  for (const c of [...s.bumpers, ...TABLE.posts]) if (Math.hypot(b.x - c.x, b.y - c.y) < c.r + BALL_R - 0.03) return `inside bumper ${c.x},${c.y}`;
  for (const f of s.flippers) {
    const p = flipperPose(f);
    const [d, t] = distSeg(b.x, b.y, f.px, f.py, p.tx, p.ty);
    const rad = FLIPPER.r0 + (FLIPPER.r1 - FLIPPER.r0) * t;
    if (d < rad + BALL_R - 0.06) return `inside flipper ${f.side} d=${d.toFixed(3)}`;
  }
  return null;
}

describe('pinball3d engine: physics', () => {
  it('PIN-E01 fuzz: 400 shots at full speed never go through a wall, bumper or flipper', () => {
    const r = seeded(11);
    let checked = 0;
    let worst = null;
    for (let k = 0; k < 400; k++) {
      const s = table(k + 1);
      const [x, y] = freeSpot(r);
      const a = r() * Math.PI * 2;
      addBall(s, x, y, Math.cos(a) * MAX_SPEED, Math.sin(a) * MAX_SPEED);
      let flipL = false;
      let flipR = false;
      for (let i = 0; i < 240 && s.status === 'play'; i++) {
        if (i % 9 === 0) flipL = r() < 0.5;
        if (i % 7 === 0) flipR = r() < 0.5;
        const prev = new Map(s.balls.map((b) => [b.id, [b.x, b.y]]));
        step(s, DT, { left: flipL, right: flipR });
        for (const b of s.balls) {
          const p = prev.get(b.id);
          if (!p) continue;
          checked += 1;
          const bad = problem(s, b, p[0], p[1]);
          if (bad && !worst) worst = `shot ${k}: ${bad}`;
        }
        s.events.length = 0;
      }
    }
    console.info(`[pinball3d] fuzz: 400 shots at ${MAX_SPEED} u/s, ${checked} ball moves checked, problems: ${worst || 'none'}`);
    expect(worst).toBeNull();
  }, 120000);

  it('PIN-E02 a ball falling at full speed onto a raised flipper bounces off it, never through', () => {
    for (const f0 of [0, 1]) {
      for (let k = 0; k < 7; k++) {
        const s = table(k);
        run(s, 0.2, f0 ? { right: true } : { left: true });
        const f = s.flippers[f0];
        const p = flipperPose(f);
        const t = 0.15 + k * 0.12;
        const x = f.px + (p.tx - f.px) * t;
        const b = addBall(s, x, 6.5, 0, -MAX_SPEED);
        let below = false;
        run(s, 0.4, f0 ? { right: true } : { left: true }, () => {
          const yLine = f.py + (p.ty - f.py) * ((b.x - f.px) / (p.tx - f.px));
          if (b.x > Math.min(f.px, p.tx) && b.x < Math.max(f.px, p.tx) && b.y < yLine) below = true;
        });
        expect(below).toBe(false);
      }
    }
  });

  it('PIN-E03 flipping sends a ball resting on the flipper far up the table', () => {
    const s = table(2);
    const f = s.flippers[0];
    const p = flipperPose(f);
    const t = 0.65;
    const cx = f.px + (p.tx - f.px) * t;
    const cy = f.py + (p.ty - f.py) * t;
    const n = [-Math.sin(p.th), Math.cos(p.th)];
    const rad = FLIPPER.r0 + (FLIPPER.r1 - FLIPPER.r0) * t;
    const b = addBall(s, cx + n[0] * (rad + BALL_R + 0.01), cy + n[1] * (rad + BALL_R + 0.01), 0, 0);
    let top = b.y;
    let vmax = 0;
    let up = 0;
    run(s, 1.2, (st, i) => ({ left: i < 30 }), () => {
      top = Math.max(top, b.y);
      vmax = Math.max(vmax, Math.hypot(b.vx, b.vy));
      up = Math.max(up, b.vy);
    });
    console.info(`[pinball3d] flipper shot from the middle of the flipper: ${vmax.toFixed(1)} u/s (up ${up.toFixed(1)}), reaches y=${top.toFixed(1)}`);
    expect(vmax).toBeGreaterThan(18);
    expect(up).toBeGreaterThan(12);
    expect(top).toBeGreaterThan(8);
    expect(types(s)).toContain('flip');
  });

  it('PIN-E04 pop bumpers kick the ball away and score; Electrode is worth double', () => {
    const s = table(3);
    const bp = TABLE.bumpers[0];
    const b = addBall(s, bp.x, bp.y + bp.r + BALL_R + 0.3, 0, -2);
    run(s, 0.15);
    const e = s.events.find((x) => x.type === 'bumper');
    expect(e).toMatchObject({ i: 0, kind: 'voltorb', points: POINTS.bumper });
    expect(b.vy).toBeGreaterThan(7);
    const s2 = table(3);
    const el = TABLE.bumpers[2];
    addBall(s2, el.x, el.y - el.r - BALL_R - 0.25, 0, 4);
    run(s2, 0.15);
    expect(s2.events.find((x) => x.type === 'bumper')).toMatchObject({ kind: 'electrode', points: POINTS.bumper * 2 });
  });

  it('PIN-E05 slingshots kick the ball back to the middle', () => {
    const s = table(4);
    const [A, , C] = TABLE.slings[0].pts;
    const mx = (A[0] + C[0]) / 2 + 0.6;
    const my = (A[1] + C[1]) / 2 + 0.3;
    const b = addBall(s, mx, my, -5, -2);
    run(s, 0.2);
    expect(types(s)).toContain('sling');
    expect(b.vx).toBeGreaterThan(4);
  });

  it('PIN-E06 the plunger: a weak pull falls back for another try, a strong one reaches the top arc', () => {
    const s = createPinball({ random: seeded(5) });
    startGame(s);
    expect(canLaunch(s)).toBe(true);
    expect(launch(s, 0)).toBe(true);
    let top = 0;
    run(s, 2.5, {}, () => (top = Math.max(top, s.balls[0].y)));
    expect(top).toBeLessThan(13.8);
    expect(canLaunch(s)).toBe(true);
    expect(s.saveLeft).toBe(0);
    launch(s, 1);
    expect(canLaunch(s)).toBe(false);
    top = 0;
    run(s, 1.5, {}, () => s.balls[0] && (top = Math.max(top, s.balls[0].y)));
    expect(top).toBeGreaterThan(17);
    expect(s.saveLeft).toBeGreaterThan(SAVE_TIME - 1.5);
    expect(laneBall(s)).toBeNull();
  });
});

describe('pinball3d engine: rules', () => {
  it('PIN-E07 three Digletts down give the Dugtrio bonus, then they pop back up', () => {
    const s = table(6);
    for (const d of TABLE.drops) {
      addBall(s, 1.4, d.y, -9, 0.4);
      run(s, 0.25);
      s.balls = [];
    }
    expect(s.events.filter((e) => e.type === 'drop')).toHaveLength(3);
    expect(types(s)).toContain('dugtrio');
    expect(s.drops.every((d) => !d.up)).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(3 * POINTS.drop + POINTS.dugtrio);
    s.events.length = 0;
    s.balls = [];
    addBall(s, 2.5, 14, 0, 0).mode = 'cloyster';
    s.balls[0].t = -100;
    run(s, 2.5);
    expect(types(s)).toContain('dropReset');
    expect(s.drops.every((d) => d.up)).toBe(true);
  });

  it('PIN-E08 catch mode: 3 centre hits open the hole, the hole calls a wild Pokémon, 3 hits catch it', () => {
    const s = table(7);
    const c = TABLE.center;
    for (let i = 0; i < 3; i++) {
      s.balls = [];
      addBall(s, c.x, c.y - c.r - BALL_R - 0.4, 0, 10);
      run(s, 0.15);
      s.balls = [];
      run(s, 0.4);
    }
    expect(s.centerHits).toBe(3);
    expect(s.holeOpen).toBe(true);
    expect(types(s)).toContain('holeOpen');
    s.balls = [];
    const h = TABLE.hole;
    const b = addBall(s, h.x - 0.6, h.y, 3, 0);
    run(s, 0.3);
    expect(b.mode).toBe('hole');
    expect(s.catch).toMatchObject({ state: 'wild', hits: 0 });
    expect(types(s)).toContain('catchStart');
    const mon = s.catch.mon.id;
    run(s, HOLE_HOLD);
    expect(b.mode).toBe('play');
    expect(types(s)).toContain('holeEject');
    const w = TABLE.wild;
    for (let i = 0; i < 3; i++) {
      s.balls = [];
      addBall(s, w.x, w.y - w.r - BALL_R - 0.4, 0, 10);
      run(s, 0.25);
      run(s, 0.3);
    }
    expect(types(s)).toContain('caught');
    expect(s.caught).toEqual([mon]);
    expect(s.catch.state).toBe('caught');
    expect(snap(s).caught).toEqual([mon]);
    s.balls = [];
    addBall(s, 2.5, 14).mode = 'cloyster';
    s.balls[0].t = -100;
    run(s, 3);
    expect(s.catch).toBeNull();
    expect(s.centerHits).toBe(0);
    expect(s.holeOpen).toBe(false);
  });

  it('PIN-E09 a wild Pokémon runs away after 30 s; the next one is a different Pokémon', () => {
    const s = table(8);
    s.holeOpen = true;
    const h = TABLE.hole;
    addBall(s, h.x, h.y + 0.05, 0, 0);
    run(s, 0.05);
    expect(s.catch?.state).toBe('wild');
    s.balls[0].mode = 'cloyster';
    s.balls[0].t = -1000;
    run(s, CATCH_TIME + 0.2);
    expect(types(s)).toContain('catchFail');
    run(s, 1.5);
    expect(s.catch).toBeNull();
    expect(s.caught).toEqual([]);
  });

  it('PIN-E10 ball save: a drain in the first 10 s gives the ball back (relaunched), later drains cost a ball', () => {
    const s = createPinball({ random: seeded(9) });
    startGame(s);
    launch(s, 0.9);
    run(s, 1.5);
    expect(s.saveLeft).toBeGreaterThan(8);
    const b = s.balls[0];
    b.x = 4.6;
    b.y = -1;
    b.vy = -5;
    run(s, 0.05);
    expect(types(s)).not.toContain('drain');
    expect(types(s)).toContain('save');
    expect(s.ballNo).toBe(1);
    run(s, 1.2);
    expect(types(s)).toContain('launch');
    run(s, 1.5);
    expect(s.balls.filter((x) => x.mode === 'play')).toHaveLength(1);
    s.saveLeft = 0;
    s.events.length = 0;
    s.balls[0].x = 4.6;
    s.balls[0].y = -1;
    s.balls[0].vy = -5;
    run(s, 0.05);
    expect(types(s)).toContain('drain');
    expect(types(s)).not.toContain('save');
    run(s, 2);
    expect(s.ballNo).toBe(2);
    expect(canLaunch(s)).toBe(true);
  });

  it('PIN-E11 three drains end the game; the score stays', () => {
    const s = createPinball({ random: seeded(10) });
    startGame(s);
    for (let ball = 1; ball <= BALLS; ball++) {
      expect(s.ballNo).toBe(ball);
      launch(s, 0.9);
      run(s, 1);
      s.saveLeft = 0;
      s.score += 1000;
      const b = s.balls[0];
      b.x = 4.6;
      b.y = -1;
      b.vy = -5;
      run(s, 2.2);
    }
    expect(s.status).toBe('over');
    expect(types(s)).toContain('over');
    expect(s.score).toBeGreaterThanOrEqual(3000);
    step(s, DT, { left: true });
    expect(s.status).toBe('over');
  });

  it('PIN-E12 kickback saves a ball from the left outlane once per ball', () => {
    const s = table(12);
    const b = addBall(s, 0.37, 3.6, 0, -6);
    run(s, 0.4);
    expect(types(s)).toContain('kickback');
    expect(s.kickback).toBe(false);
    expect(b.vy).toBeGreaterThan(5);
    s.events.length = 0;
    s.balls = [];
    const b2 = addBall(s, 0.37, 3.6, 0, -6);
    run(s, 0.6);
    expect(types(s)).not.toContain('kickback');
    expect(b2.y < 0 || !s.balls.includes(b2)).toBe(true);
  });

  it('PIN-E13 the ramp: Cloyster eats the ball and spits it into the left inlane; every 3rd ramp starts multiball', () => {
    const s = table(13);
    const shoot = () => {
      s.balls = s.balls.filter((x) => x.mode !== 'play' || x.y > 0);
      const b = addBall(s, 7.9, 9.9, 0, 13);
      run(s, 0.1);
      expect(b.mode).toBe('ramp');
      run(s, RAMP_TIME + 0.02);
      expect(b.mode).toBe('cloyster');
      run(s, CLOYSTER_HOLD);
      expect(b.mode).toBe('play');
      expect(b.x).toBeCloseTo(TABLE.spit.x, 1);
      return b;
    };
    for (let i = 0; i < 2; i++) {
      const b = shoot();
      s.balls = s.balls.filter((x) => x !== b);
    }
    expect(s.ramps).toBe(2);
    expect(types(s)).not.toContain('multiball');
    shoot();
    expect(types(s)).toContain('multiball');
    expect(s.multiball).toBe(true);
    run(s, 2.5);
    expect(s.balls.filter((x) => x.mode === 'play' || x.mode === 'ramp')).toHaveLength(2);
    // Losing one of the two balls is not a drain
    s.saveLeft = 0;
    s.events.length = 0;
    s.balls[0].mode = 'play';
    s.balls[0].y = -1;
    s.balls[0].vy = -5;
    run(s, 0.05);
    expect(types(s)).toContain('multiballEnd');
    expect(types(s)).not.toContain('drain');
    expect(s.multiball).toBe(false);
    s.balls[0].mode = 'play';
    s.balls[0].y = -1;
    s.balls[0].vy = -5;
    run(s, 0.05);
    expect(types(s)).toContain('drain');
  });

  it('PIN-E14 a slow ball rolls back off the ramp; the spinner spins; the top lanes raise the multiplier', () => {
    const s = table(14);
    const slow = addBall(s, 7.9, 9.9, 0, 4);
    run(s, 0.8);
    expect(slow.mode).toBe('play');
    s.balls = [];
    addBall(s, 0.5, 11.6, 0, 16);
    run(s, 0.6);
    expect(s.spinner.spins).toBeGreaterThan(0);
    expect(types(s)).toContain('spin');
    s.balls = [];
    for (const l of TABLE.lanes) {
      addBall(s, l.x, l.y + 0.45, 0, -2);
      run(s, 0.12);
      s.balls = [];
    }
    expect(s.mult).toBe(2);
    expect(types(s)).toContain('mult');
    expect(s.lanes).toEqual([false, false, false]);
  });

  it('PIN-E15 stars, gold and the saved best score', () => {
    expect(starsForScore(0)).toBe(1);
    expect(starsForScore(STAR2)).toBe(2);
    expect(starsForScore(STAR3)).toBe(3);
    expect(goldForGame(1, 0)).toBe(5);
    expect(goldForGame(3, 2)).toBe(19);
    expect(goldForGame(3, 20)).toBe(30);
    localStorage.removeItem(PINBALL3D_KEY);
    expect(loadPinball3d()).toEqual({ best: 0, games: 0, caught: [] });
    expect(savePinball3d(1234, ['pikachu']).isNew).toBe(true);
    const r = savePinball3d(900, ['pikachu', 'meowth']);
    expect(r).toMatchObject({ best: 1234, games: 2, isNew: false, caught: ['pikachu', 'meowth'] });
    localStorage.setItem(PINBALL3D_KEY, '{broken');
    expect(loadPinball3d().best).toBe(0);
  });
});

describe('pinball3d bot simulation (balance)', () => {
  let results;
  beforeAll(() => {
    results = {
      idle: Array.from({ length: 10 }, (_, i) => simulate({ random: seeded(100 + i), idle: true })),
      bot: Array.from({ length: 12 }, (_, i) => simulate({ random: seeded(200 + i), skill: 1 })),
      clumsy: Array.from({ length: 8 }, (_, i) => simulate({ random: seeded(300 + i), skill: 0.4 })),
    };
  }, 300000);
  const summary = (list) => {
    const sc = list.map((s) => s.score).sort((a, b) => a - b);
    const stars = [1, 2, 3].map((k) => list.filter((s) => starsForScore(s.score) === k).length);
    const time = list.reduce((a, s) => a + s.t, 0) / list.length;
    const caught = list.reduce((a, s) => a + s.caught.length, 0) / list.length;
    return { min: sc[0], median: sc[sc.length >> 1], max: sc[sc.length - 1], stars, time: Math.round(time), caught: +caught.toFixed(2) };
  };

  it('PIN-B01 an idle player (only launches) always gets 1 star', () => {
    const r = summary(results.idle);
    console.info(`[pinball3d] idle: median ${r.median} (min ${r.min}, max ${r.max}), stars 1/2/3 = ${r.stars.join('/')}, ${r.time}s per game`);
    expect(r.stars[0]).toBe(results.idle.length);
    expect(r.max).toBeLessThan(STAR2 / 2);
    for (const s of results.idle) expect(s.status).toBe('over');
  });

  it('PIN-B02 a flipper bot keeps the ball alive, catches Pokémon and can reach 3 stars', () => {
    const r = summary(results.bot);
    const c = summary(results.clumsy);
    const stat = (k) => (results.bot.reduce((a, s) => a + s.stats[k], 0) / results.bot.length).toFixed(1);
    console.info(`[pinball3d] bot: median ${r.median} (min ${r.min}, max ${r.max}), stars 1/2/3 = ${r.stars.join('/')}, ${r.time}s per game, caught ${r.caught}/game`);
    console.info(`[pinball3d] bot per game: bumpers ${stat('bumpers')}, drops ${stat('drops')}, ramps ${stat('ramps')}, orbits ${stat('orbits')}, spins ${stat('spins')}, multiballs ${stat('multiballs')}, saves ${stat('saves')}, kickbacks ${stat('kickbacks')}`);
    console.info(`[pinball3d] clumsy bot: median ${c.median} (min ${c.min}, max ${c.max}), stars 1/2/3 = ${c.stars.join('/')}, ${c.time}s per game`);
    console.info(`[pinball3d] thresholds: 2★ ${STAR2}, 3★ ${STAR3}`);
    expect(r.median).toBeGreaterThan(summary(results.idle).max * 2);
    expect(r.stars[2]).toBeGreaterThan(0);
    expect(r.stars[0] + r.stars[1]).toBeGreaterThan(0);
    expect(r.time).toBeGreaterThan(60);
    expect(results.bot.some((s) => s.caught.length > 0)).toBe(true);
  });
});
