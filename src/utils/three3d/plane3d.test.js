import { describe, it, expect, vi } from 'vitest';
import { seeded } from '../../test/seeded';
import {
  LANE_W, PLANE, HEARTS, POWER, CONTINUE_TIME, FINISH_TIME, MAX_BOOSTS, LEVELS, DIFFS, DIFF_IDS, OBST,
  createFlight, startFlight, step, input, acceptContinue, declineContinue, snap, starsFor, overlaps, generateLevel,
  maxMoves, noTrap, minSeconds, lengthFor, speedFor, secondsFor, botAction, simulate, spinUp, progressOf,
} from './plane3d';
import { loadSettings, saveSettings, PLANE3D_KEY, saveLevelStars, loadProgress, levelUnlocked, starsOf } from './plane3d/store';

const DT = 1 / 60;
const run = (s, secs) => {
  for (let t = 0; t < secs; t += DT) step(s, DT);
};
/** A flight with nothing in the sky (for controlled tests). */
function emptyFlight(opts = {}) {
  const s = createFlight({ random: seeded(1), ...opts });
  s.obstacles = [];
  s.coinList = [];
  s.ringList = [];
  s.pickups = [];
  s.coinsTotal = 0;
  startFlight(s);
  s.events.length = 0;
  return s;
}
const obstacle = (kind, lane, z) => ({ id: Math.random(), kind, lane, x: lane * LANE_W, z, hw: OBST[kind].hw, hz: OBST[kind].hz, hit: false, gone: null, passed: false });

describe('plane3d engine – flying and lanes', () => {
  it('PLN-E01 countdown spins the propeller up, the flight starts at the start and moves forward at the level speed', () => {
    const s = createFlight({ level: 0, diff: 'easy', random: seeded(2) });
    expect(s.phase).toBe('ready');
    step(s, 1);
    expect(s.d).toBe(0);
    spinUp(s, 1);
    expect(s.prop).toBeGreaterThan(0.4);
    expect(startFlight(s)).toBe(true);
    expect(s.prop).toBe(1);
    run(s, 1);
    expect(s.d).toBeCloseTo(speedFor(0, 'easy'), 0);
  });

  it('PLN-E02 swipe left / right changes lane smoothly (bank + slide), walls at the edges', () => {
    const s = emptyFlight();
    expect(input(s, 'left')).toBe(true);
    expect(s.lane).toBe(-1);
    step(s, 0.05);
    expect(s.bank).toBeGreaterThan(0.1); // rolls into the left turn
    expect(s.yaw).toBeGreaterThan(0);
    run(s, 0.1);
    expect(s.x).toBeLessThan(-LANE_W * 0.25);
    run(s, 0.3);
    expect(Math.abs(s.x + LANE_W)).toBeLessThan(LANE_W * 0.1); // there within 0.45 s
    run(s, 1);
    expect(s.x).toBe(-LANE_W);
    expect(Math.abs(s.bank)).toBe(0);
    expect(input(s, 'left')).toBe(false);
    expect(s.events.some((e) => e.type === 'wall')).toBe(true);
    input(s, 'right');
    input(s, 'right');
    expect(s.lane).toBe(1);
    run(s, 0.6);
    expect(Math.abs(s.x - LANE_W)).toBeLessThan(0.3);
    expect(input(s, 'up')).toBe(false);
  });
});

describe('plane3d engine – obstacles, hearts and continue', () => {
  it('PLN-E03 every obstacle kind costs a heart when hit in its lane, and is safe from the next lane', () => {
    for (const kind of Object.keys(OBST)) {
      const s = emptyFlight();
      s.obstacles = [obstacle(kind, 0, 20)];
      run(s, 2);
      expect(s.hearts, kind).toBe(HEARTS - 1);
      expect(s.events.some((e) => e.type === 'hit' && e.kind === kind)).toBe(true);
      const t = emptyFlight();
      t.obstacles = [obstacle(kind, 1, 20)];
      run(t, 2);
      expect(t.hearts, kind).toBe(HEARTS);
      // geometry: the next lane is always clear of the box
      expect(OBST[kind].hw + PLANE.hw).toBeLessThan(LANE_W - 0.3);
    }
  });

  it('PLN-E04 a hit wobbles the plane and gives a short safe time (no double hits)', () => {
    const s = emptyFlight();
    s.obstacles = [obstacle('storm', 0, 20), obstacle('storm', 0, 24)];
    run(s, 1.3);
    expect(s.hearts).toBe(2);
    expect(s.wobble).toBeGreaterThan(0);
    run(s, 1);
    expect(s.hearts).toBe(2); // second cloud right behind is inside the safe time
  });

  it('PLN-E05 overlaps uses half sizes on x and z', () => {
    const s = emptyFlight();
    const o = obstacle('rock', 0, 0);
    expect(overlaps(s, o)).toBe(true);
    s.x = o.hw + PLANE.hw + 0.01;
    expect(overlaps(s, o)).toBe(false);
    s.x = 0;
    s.d = -(o.hz + PLANE.hz + 0.01);
    expect(overlaps(s, o)).toBe(false);
  });

  it('PLN-E06 three hits: down, one "Hồi sinh" (1 heart back, sky cleared), then the next loss ends the flight', () => {
    const s = emptyFlight();
    for (let i = 0; i < 6; i++) s.obstacles.push(obstacle('balloon', 0, 30 + i * 40));
    let t = 0;
    while (s.phase === 'fly' && t < 30) {
      step(s, DT);
      t += DT;
    }
    expect(s.phase).toBe('down');
    expect(s.pending).toBe('offer');
    expect(s.offerT).toBe(CONTINUE_TIME);
    expect(acceptContinue(s)).toBe(true);
    expect(s.hearts).toBe(1);
    expect(s.continueUsed).toBe(true);
    expect(acceptContinue(s)).toBe(false);
    t = 0;
    while (s.phase !== 'over' && t < 30) {
      step(s, DT);
      t += DT;
    }
    expect(s.phase).toBe('over');
    expect(s.finished).toBe(false);
    expect(s.stars).toBe(0);
  });

  it('PLN-E07 the continue offer times out, or can be declined', () => {
    const a = emptyFlight();
    a.hearts = 1;
    a.obstacles = [obstacle('ice', 0, 20)];
    run(a, 2);
    expect(a.pending).toBe('offer');
    run(a, CONTINUE_TIME + 2);
    expect(a.phase).toBe('over');
    const b = emptyFlight();
    b.hearts = 1;
    b.obstacles = [obstacle('ice', 0, 20)];
    run(b, 2);
    expect(declineContinue(b)).toBe(true);
    run(b, 1.5);
    expect(b.phase).toBe('over');
  });

  it('PLN-E08 sliding sideways into an obstacle that is alongside bounces back without harm', () => {
    const s = emptyFlight();
    s.obstacles = [obstacle('rock', 1, 5)];
    run(s, 0.3);
    expect(Math.abs(s.obstacles[0].z - s.d)).toBeLessThan(2);
    input(s, 'right');
    run(s, 0.5);
    expect(s.hearts).toBe(HEARTS);
    expect(s.lane).toBe(0);
  });
});

describe('plane3d engine – power-ups, coins, rings, stars', () => {
  it('PLN-E09 shield absorbs exactly one hit', () => {
    const s = emptyFlight();
    s.pickups = [{ id: 1, kind: 'shield', x: 0, y: 0, z: 10, lane: 0, taken: false }];
    s.obstacles = [obstacle('storm', 0, 40), obstacle('storm', 0, 80)];
    run(s, 1);
    expect(s.power.shield).toBeGreaterThan(0);
    run(s, 2.5);
    expect(s.events.some((e) => e.type === 'shieldBreak')).toBe(true);
    expect(s.hearts).toBe(HEARTS);
    expect(s.power.shield).toBe(0);
    run(s, 3);
    expect(s.hearts).toBe(HEARTS - 1);
  });

  it('PLN-E10 magnet pulls coins from other lanes', () => {
    const s = emptyFlight();
    s.power.magnet = POWER.magnet.time;
    s.coinList = [1, -1].flatMap((l) => [30, 34, 38].map((z, i) => ({ id: l * 10 + i, x: l * LANE_W, x0: l * LANE_W, y: 0, z, taken: false, mag: false })));
    s.coinsTotal = 6;
    run(s, 3.5);
    expect(s.coins).toBe(6);
    const t = emptyFlight();
    t.coinList = [{ id: 1, x: LANE_W, x0: LANE_W, y: 0, z: 30, taken: false, mag: false }];
    run(t, 3);
    expect(t.coins).toBe(0);
  });

  it('PLN-E11 boost: faster, invincible (smashes obstacles away), ends with a short safe time', () => {
    const s = emptyFlight({ diff: 'normal' });
    s.pickups = [{ id: 1, kind: 'boost', x: 0, y: 0, z: 5, lane: 0, taken: false }];
    s.obstacles = [obstacle('meteor', 0, 40)];
    run(s, 0.5);
    expect(s.power.boost).toBeGreaterThan(0);
    expect(s.speed).toBeCloseTo(s.baseSpeed * POWER.boost.mult, 5);
    run(s, 2);
    expect(s.hearts).toBe(HEARTS);
    expect(s.obstacles[0].gone).toBe('smash');
    run(s, 1);
    expect(s.power.boost).toBe(0);
    expect(s.invuln).toBeGreaterThan(0);
    expect(s.speed).toBe(s.baseSpeed);
  });

  it('PLN-E12 coins combo up, rings count, the finish gives stars by hearts and coins', () => {
    const s = emptyFlight();
    s.coinList = [10, 12, 14, 16].map((z, i) => ({ id: i, x: 0, x0: 0, y: 0, z, taken: false, mag: false }));
    s.ringList = [{ id: 9, x: 0, y: 0, z: 25, lane: 0, taken: false }];
    s.coinsTotal = 4;
    run(s, 2);
    expect(s.coins).toBe(4);
    expect(s.bestCombo).toBe(4);
    expect(s.rings).toBe(1);
    s.d = s.length - 1;
    run(s, 0.2);
    expect(s.phase).toBe('finish');
    expect(s.stars).toBe(3);
    expect(s.events.some((e) => e.type === 'finish')).toBe(true);
    run(s, FINISH_TIME + 0.1);
    expect(s.phase).toBe('done');
    expect(snap(s).stars).toBe(3);
    expect(progressOf(s)).toBe(1);
    // star rules
    expect(starsFor({ finished: false, hearts: 3, coins: 9, coinsTotal: 9 })).toBe(0);
    expect(starsFor({ finished: true, hearts: 1, coins: 9, coinsTotal: 9 })).toBe(1);
    expect(starsFor({ finished: true, hearts: 2, coins: 6, coinsTotal: 10 })).toBe(2);
    expect(starsFor({ finished: true, hearts: 2, coins: 7, coinsTotal: 10 })).toBe(3);
  });
});

describe('plane3d engine – levels, fairness, balance', () => {
  it('PLN-E13 every level × difficulty lasts at least 30 s (even with every boost)', () => {
    const lines = [];
    for (let i = 0; i < LEVELS.length; i++) {
      const row = [];
      for (const d of DIFF_IDS) {
        const secs = lengthFor(i, d) / speedFor(i, d);
        expect(secs).toBeGreaterThanOrEqual(30);
        expect(minSeconds(i, d)).toBeGreaterThanOrEqual(30);
        expect(secs).toBeCloseTo(secondsFor(i), 0);
        row.push(`${DIFFS[d].label} ${secs.toFixed(1)}s/${lengthFor(i, d)}m`);
      }
      lines.push(`L${i + 1} ${LEVELS[i].name}: ${row.join(' · ')}`);
    }
    console.info(`[plane3d] durations (min with ${MAX_BOOSTS} boosts ≥ 30 s)\n${lines.join('\n')}`);
  });

  it('PLN-E14 generator fairness fuzz: ≥ 2000 rows per level × difficulty, always a reachable free lane', () => {
    for (let li = 0; li < LEVELS.length; li++) {
      for (const d of DIFF_IDS) {
        let rows = 0;
        let seed = 1;
        while (rows < 2000) {
          const g = generateLevel(li, d, seeded(seed++ * 7919 + li * 31));
          let reach = [-1, 0, 1];
          let prevEnd = 0;
          const bad = [];
          for (const r of g.rows) {
            const blocked = Object.keys(r.lanes).length;
            if (blocked > (d === 'easy' ? 1 : 2) || r.free.length === 0) bad.push(`blocked ${blocked}`);
            const gapT = (r.z - prevEnd - PLANE.hz) / g.speed;
            const moves = maxMoves(gapT, d);
            if (moves < 1) bad.push(`moves ${moves}`); // never needs an instant swerve
            if (!noTrap(reach, r.free, moves)) bad.push(`trap at ${r.z}`);
            reach = [-1, 0, 1].filter((l) => reach.some((x) => Math.abs(x - l) <= moves) && r.free.includes(l));
            prevEnd = r.z + r.half;
            rows++;
          }
          // the last row leaves empty sky before the gate; coins/pickups never sit inside an obstacle
          if (g.rows.at(-1).z >= g.length - g.speed * 2) bad.push('no runway');
          for (const o of g.obstacles) {
            for (const c of g.coins) if (Math.abs(c.z - o.z) < o.hz + 0.6 && Math.abs(c.x - o.x) < o.hw + 0.4) bad.push(`coin in ${o.kind}`);
            for (const p of g.pickups) if (Math.abs(p.z - o.z) < o.hz + 1 && Math.abs(p.x - o.x) < o.hw + 0.4) bad.push(`pickup in ${o.kind}`);
            for (const p of g.rings) if (Math.abs(p.z - o.z) < o.hz + 1 && Math.abs(p.x - o.x) < o.hw + 0.4) bad.push(`ring in ${o.kind}`);
          }
          if (g.pickups.filter((p) => p.kind === 'boost').length > MAX_BOOSTS) bad.push('boosts');
          expect(bad, `L${li + 1} ${d} seed ${seed - 1}`).toEqual([]);
        }
      }
    }
  }, 120000);

  it('PLN-E15 bot sims: a reacting bot finishes all 10 levels on every difficulty (≥ 2★ on Dễ); a bot that never moves fails on Vừa/Khó', () => {
    const lines = [];
    for (let li = 0; li < LEVELS.length; li++) {
      for (const d of DIFF_IDS) {
        const runs = [1, 2, 3, 4].map((k) => simulate(li, d, seeded(1000 + k * 17 + li * 101)));
        for (const r of runs) {
          expect(r.finished, `L${li + 1} ${d}`).toBe(true);
          expect(r.t).toBeGreaterThanOrEqual(30);
          if (d === 'easy') expect(r.stars).toBeGreaterThanOrEqual(2);
        }
        const idle = [1, 2, 3].map((k) => simulate(li, d, seeded(500 + k * 13 + li * 7), { bot: 'none' }));
        if (d !== 'easy') for (const r of idle) expect(r.finished, `idle L${li + 1} ${d}`).toBe(false);
        const avg = (k) => runs.reduce((a, r) => a + r[k], 0) / runs.length;
        lines.push(
          `L${li + 1} ${DIFFS[d].label}: ${avg('t').toFixed(1)}s, rows ${avg('rows').toFixed(0)}, coins ${avg('coins').toFixed(0)}/${avg('coinsTotal').toFixed(0)}, rings ${avg('rings').toFixed(1)}, hits ${avg('hits').toFixed(1)}, stars ${runs.map((r) => r.stars).join('')} | idle: ${idle.map((r) => (r.finished ? `ok${r.stars}` : `fail@${r.t.toFixed(0)}s`)).join(' ')}`
        );
      }
    }
    console.info(`[plane3d] bot balance\n${lines.join('\n')}`);
  }, 120000);

  it('PLN-E16 botAction never steers into a blocked lane it cannot pass', () => {
    const s = emptyFlight();
    s.obstacles = [obstacle('rock', 0, 25)];
    s.coinList = [{ id: 1, x: 0, x0: 0, y: 0, z: 22, taken: false, mag: false }];
    const a = botAction(s);
    expect(a === -1 || a === 1).toBe(true);
  });
});

describe('plane3d store', () => {
  it('PLN-E17 settings and level stars are saved; the next level opens after a finish on any difficulty', () => {
    localStorage.clear();
    expect(loadSettings()).toEqual({ livery: 'pika', diff: 'easy' });
    saveSettings({ livery: 'gengar', diff: 'hard' });
    expect(JSON.parse(localStorage.getItem(PLANE3D_KEY))).toEqual({ livery: 'gengar', diff: 'hard' });
    expect(loadSettings().diff).toBe('hard');
    localStorage.setItem(PLANE3D_KEY, '{bad');
    expect(loadSettings().livery).toBe('pika');
    expect(levelUnlocked(loadProgress(), 0)).toBe(true);
    expect(levelUnlocked(loadProgress(), 1)).toBe(false);
    const rec = saveLevelStars('L1', 'hard', 2);
    expect(rec.improved).toBe(true);
    expect(starsOf(loadProgress(), 'L1', 'hard')).toBe(2);
    expect(starsOf(loadProgress(), 'L1', 'easy')).toBe(0);
    expect(levelUnlocked(loadProgress(), 1)).toBe(true);
    expect(saveLevelStars('L1', 'hard', 1).improved).toBe(false);
    vi.restoreAllMocks();
  });
});
