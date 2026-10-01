import { describe, it, expect } from 'vitest';
import {
  createRun, startRun, step, input, acceptContinue, declineContinue, generateRow, createGenerator, rowLanes, maxMoves, baseSpeedAt,
  worldAt, pickMissions, goldForRun, snap, LANE_W, OBST, PLAYER, JUMP, SLIDE_T, CONTINUE_TIME, CRATE, SPEED, REACT, LANE_TIME, LANE_LERP, HIT_X,
} from './run3d';
import { loadRun3d, saveRun3d, RUN3D_KEY } from './run3dStore';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

/** A running state with no generated track (obstacles placed by the test). */
function emptyRun(seed = 1) {
  const s = createRun({ random: seeded(seed) });
  s.gen.nextZ = Infinity;
  startRun(s);
  return s;
}
let nextId = 1000;
function place(s, type, lane, z, extra = {}) {
  const o = { id: ++nextId, type, lane, x: lane * LANE_W, z, z0: z, y: 0, state: 'idle', passed: false, hit: false, ...OBST[type], ...extra };
  if (type === 'geodude') o.state = 'wait';
  if (type === 'crate') {
    o.state = 'hold';
    o.y = CRATE.hold;
  }
  s.obstacles.push(o);
  return o;
}
function runFor(s, seconds, each) {
  for (let t = 0; t < seconds && s.phase === 'run'; t += DT) {
    each?.(s);
    step(s, DT);
  }
  return s;
}
const allEvents = (s) => s.events.map((e) => e.type);

describe('run3d engine: movement', () => {
  it('RUN-E01 lanes clamp at the edges, x follows smoothly with a lean', () => {
    const s = emptyRun();
    expect(input(s, 'left')).toBe(true);
    expect(input(s, 'left')).toBe(false);
    expect(s.lane).toBe(-1);
    expect(allEvents(s)).toContain('wall');
    step(s, DT);
    expect(s.x).toBeLessThan(0);
    expect(s.x).toBeGreaterThan(-LANE_W);
    expect(s.lean).toBeLessThan(0);
    runFor(s, 0.5);
    expect(s.x).toBeCloseTo(-LANE_W, 2);
    expect(s.lean).toBeCloseTo(0, 2);
    input(s, 'right');
    input(s, 'right');
    runFor(s, 0.5);
    expect(s.lane).toBe(1);
    expect(s.x).toBeCloseTo(LANE_W, 2);
  });

  it('RUN-E02 jump is an arc (~1.5 m, ~0.63 s) and lands with a dust event; no double jump', () => {
    const s = emptyRun();
    expect(input(s, 'jump')).toBe(true);
    expect(input(s, 'jump')).toBe(false);
    let peak = 0;
    let air = 0;
    while (s.y > 0 || s.vy > 0) {
      step(s, DT);
      peak = Math.max(peak, s.y);
      air += DT;
    }
    expect(peak).toBeGreaterThan(1.4);
    expect(peak).toBeLessThan(1.6);
    expect(air).toBeGreaterThan(0.58);
    expect(air).toBeLessThan(0.7);
    expect(allEvents(s)).toContain('land');
    expect(s.stats.jumps).toBe(1);
    expect(peak).toBeLessThanOrEqual((JUMP.v * JUMP.v) / (2 * JUMP.g));
  });

  it('RUN-E03 slide squashes the runner for a moment; sliding in the air falls fast then slides', () => {
    const s = emptyRun();
    input(s, 'slide');
    expect(s.slideT).toBeCloseTo(SLIDE_T);
    runFor(s, SLIDE_T + 0.05);
    expect(s.slideT).toBe(0);
    input(s, 'jump');
    runFor(s, 0.1);
    input(s, 'slide');
    expect(s.vy).toBeLessThan(-20);
    runFor(s, 0.2);
    expect(s.y).toBe(0);
    expect(s.slideT).toBeGreaterThan(0);
    expect(s.stats.slides).toBe(2);
  });

  it('RUN-E04 speed starts slow and ramps gently to a cap', () => {
    expect(baseSpeedAt(0)).toBe(SPEED.start);
    expect(baseSpeedAt(500)).toBeLessThan(12);
    expect(baseSpeedAt(1000)).toBeGreaterThan(baseSpeedAt(500));
    expect(baseSpeedAt(99999)).toBe(SPEED.max);
  });
});

describe('run3d engine: collisions per obstacle', () => {
  // Time the action so the player reaches the obstacle `lead` seconds after it
  const actWhen = (s, o, lead, action) => {
    let done = false;
    return () => {
      if (!done && o.z - s.d < OBST[o.type].hz + PLAYER.hz + lead * s.speed) {
        done = true;
        input(s, action);
      }
    };
  };

  it('RUN-E05 low barrier: standing crashes, a jump clears it', () => {
    let s = emptyRun();
    place(s, 'barrier', 0, 20);
    runFor(s, 4);
    expect(s.phase).toBe('crashed');
    expect(s.crashedBy).toBe('barrier');
    s = emptyRun();
    const o = place(s, 'barrier', 0, 20);
    runFor(s, 4, actWhen(s, o, 0.2, 'jump'));
    expect(s.phase).toBe('run');
    expect(allEvents(s)).toContain('clear');
    expect(s.stats.dodges).toBe(1);
  });

  it('RUN-E06 high bar (Zubat banner): standing or jumping crashes, sliding clears it', () => {
    let s = emptyRun();
    place(s, 'bar', 0, 20);
    runFor(s, 4);
    expect(s.phase).toBe('crashed');
    s = emptyRun();
    let o = place(s, 'bar', 0, 20);
    runFor(s, 4, actWhen(s, o, 0.2, 'jump'));
    expect(s.phase).toBe('crashed');
    s = emptyRun();
    o = place(s, 'bar', 0, 20);
    runFor(s, 4, actWhen(s, o, 0.15, 'slide'));
    expect(s.phase).toBe('run');
    expect(allEvents(s)).toContain('clear');
  });

  it('RUN-E07 sleeping Snorlax: jumping and sliding both crash, changing lane passes (near miss)', () => {
    for (const action of ['jump', 'slide']) {
      const s = emptyRun();
      const o = place(s, 'snorlax', 0, 20);
      runFor(s, 4, actWhen(s, o, 0.2, action));
      expect(s.phase).toBe('crashed');
      expect(s.crashedBy).toBe('snorlax');
    }
    const s = emptyRun();
    const o = place(s, 'snorlax', 0, 20);
    runFor(s, 4, actWhen(s, o, 0.3, 'right'));
    expect(s.phase).toBe('run');
    expect(allEvents(s)).toContain('nearMiss');
  });

  it('RUN-E08 Geodude rolls toward the runner in its lane; stay = crash, other lane = safe', () => {
    let s = emptyRun();
    const g = place(s, 'geodude', 0, 40);
    step(s, DT);
    const z1 = g.z;
    runFor(s, 0.5);
    expect(g.state).toBe('roll');
    expect(g.z).toBeLessThan(z1); // coming closer
    runFor(s, 6);
    expect(s.phase).toBe('crashed');
    expect(s.crashedBy).toBe('geodude');
    expect(Math.abs(s.d - 40)).toBeLessThan(2); // meets the runner where the generator planned it
    s = emptyRun();
    place(s, 'geodude', 1, 40);
    runFor(s, 6);
    expect(s.phase).toBe('run');
  });

  it('RUN-E09 Team Rocket crate: shadow warning first, lands before the runner arrives, blocks the lane', () => {
    const s = emptyRun();
    const c = place(s, 'crate', 0, 40);
    const seen = [];
    runFor(s, 8, () => {
      if (seen[seen.length - 1] !== c.state) seen.push(c.state);
    });
    expect(seen).toEqual(['hold', 'warn', 'fall', 'landed']);
    expect(s.phase).toBe('crashed');
    expect(s.crashedBy).toBe('crate');
    const ev = s.events.map((e) => e.type);
    expect(ev.indexOf('crateWarn')).toBeLessThan(ev.indexOf('crateDrop'));
    expect(ev.indexOf('crateLand')).toBeLessThan(ev.indexOf('crash'));
  });

  it('RUN-E10 changing lane into an obstacle alongside bounces back instead of crashing', () => {
    const s = emptyRun();
    place(s, 'snorlax', 1, 15);
    runFor(s, 15 / s.speed - 0.05); // Snorlax is now right beside the runner
    expect(s.phase).toBe('run');
    input(s, 'right');
    runFor(s, 0.4);
    expect(allEvents(s)).toContain('bump');
    expect(s.lane).toBe(0);
    expect(s.phase).toBe('run');
  });
});

describe('run3d engine: power-ups, revive and continue', () => {
  it('RUN-E11 shield survives exactly one hit', () => {
    const s = emptyRun();
    s.power.shield = 20;
    place(s, 'snorlax', 0, 20);
    place(s, 'barrier', 0, 45);
    runFor(s, 2.6);
    expect(allEvents(s)).toContain('shieldBreak');
    expect(s.power.shield).toBe(0);
    expect(s.phase).toBe('run');
    runFor(s, 6);
    expect(s.phase).toBe('crashed');
  });

  it('RUN-E12 speed boost: faster, smashes through obstacles, then a short safe time', () => {
    const s = emptyRun();
    s.pickups.push({ id: 1, kind: 'boost', x: 0, y: 1, z: 5, lane: 0, taken: false });
    place(s, 'snorlax', 0, 25);
    place(s, 'bar', 0, 35);
    runFor(s, 1);
    expect(s.power.boost).toBeGreaterThan(0);
    expect(s.speed).toBeCloseTo(s.baseSpeed * SPEED.boost);
    runFor(s, 3);
    expect(s.events.filter((e) => e.type === 'smash').length).toBe(2);
    expect(s.phase).toBe('run');
    runFor(s, 1.5);
    expect(s.power.boost).toBe(0);
    expect(allEvents(s)).toContain('powerEnd');
  });

  it('RUN-E13 magnet pulls coins from other lanes; x2 doubles each coin', () => {
    const s = emptyRun();
    s.power.magnet = 10;
    for (let i = 0; i < 5; i++) s.coinList.push({ id: 500 + i, x: LANE_W, y: 0.9, z: 10 + i * 2, lane: 1, taken: false, mag: false });
    runFor(s, 3);
    expect(s.coins).toBe(5);
    const s2 = emptyRun();
    s2.power.double = 10;
    for (let i = 0; i < 4; i++) s2.coinList.push({ id: 600 + i, x: 0, y: 0.9, z: 8 + i * 2, lane: 0, taken: false, mag: false });
    runFor(s2, 3);
    expect(s2.coins).toBe(8);
    expect(Math.max(...s2.events.filter((e) => e.type === 'coin').map((e) => e.combo))).toBe(4);
    // Without a magnet, coins in another lane stay put
    const s3 = emptyRun();
    s3.coinList.push({ id: 700, x: LANE_W, y: 0.9, z: 10, lane: 1, taken: false, mag: false });
    runFor(s3, 3);
    expect(s3.coins).toBe(0);
  });

  it('RUN-E14 a collected Revive is used automatically on the first hit', () => {
    const s = emptyRun();
    s.pickups.push({ id: 2, kind: 'revive', x: 0, y: 1, z: 5, lane: 0, taken: false });
    place(s, 'snorlax', 0, 25);
    runFor(s, 5);
    expect(s.revives).toBe(1);
    expect(s.phase).toBe('crashed');
    expect(s.pending).toBe('revive');
    for (let t = 0; t < 1.2; t += DT) step(s, DT);
    expect(s.phase).toBe('run');
    expect(s.revives).toBe(0);
    expect(allEvents(s)).toContain('revive');
    // The free continue is still there for the next hit
    place(s, 'snorlax', 0, s.d + 40);
    runFor(s, 6);
    expect(s.pending).toBe('offer');
  });

  it('RUN-E15 one free continue per run (5 s to press), then game over', () => {
    const s = emptyRun();
    place(s, 'barrier', 0, 20);
    runFor(s, 4);
    expect(s.pending).toBe('offer');
    expect(s.offerT).toBe(CONTINUE_TIME);
    expect(acceptContinue(s)).toBe(true);
    expect(s.phase).toBe('run');
    expect(s.invuln).toBeGreaterThan(2);
    place(s, 'barrier', 0, s.d + 40);
    runFor(s, 8);
    expect(s.pending).toBe('over');
    expect(acceptContinue(s)).toBe(false);
    for (let t = 0; t < 2; t += DT) step(s, DT);
    expect(s.phase).toBe('over');
    expect(allEvents(s)).toContain('over');
    // Waiting out the 5 s also ends the run; so does "Thôi"
    const s2 = emptyRun();
    place(s2, 'barrier', 0, 20);
    runFor(s2, 4);
    for (let t = 0; t < CONTINUE_TIME + 1.5; t += DT) step(s2, DT);
    expect(s2.phase).toBe('over');
    const s3 = emptyRun();
    place(s3, 'barrier', 0, 20);
    runFor(s3, 4);
    expect(declineContinue(s3)).toBe(true);
    for (let t = 0; t < 1; t += DT) step(s3, DT);
    expect(s3.phase).toBe('over');
  });
});

describe('run3d engine: generator', () => {
  /** Independent check: every row has a free lane, and from every lane the child could be in, a free lane is reachable in time. */
  function fuzz(startZ, rows, seed) {
    const random = seeded(seed);
    const gen = createGenerator(startZ);
    gen.nextPower = startZ;
    let reach = [-1, 0, 1];
    let prevEnd = startZ - 30;
    const counts = {};
    let twoLane = 0;
    const geodudes = [];
    const all = [];
    const bad = [];
    for (let i = 0; i < rows; i++) {
      const r = generateRow(gen, random);
      const types = Object.values(r.row);
      types.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
      if (types.length === 2) twoLane++;
      const { free, pass } = rowLanes(r.row);
      if (types.length > 2 || free.length < 1) bad.push(`no free lane at ${r.z}`);
      const v = baseSpeedAt(r.z);
      const gapT = (r.z - prevEnd - PLAYER.hz) / v;
      const moves = Math.max(0, Math.min(2, Math.floor((gapT - REACT) / LANE_TIME)));
      // Physical check of the planning budget: moving `moves` lanes with the real lane follow takes less than the gap
      if (moves > 0) {
        const tMove = Math.log((moves * LANE_W) / (moves * LANE_W - (LANE_W * (moves - 1) + HIT_X))) / LANE_LERP;
        if (REACT + tMove >= gapT) bad.push('too tight');
      }
      for (const l of reach) if (!free.some((f) => Math.abs(f - l) <= moves)) bad.push(`trap at ${r.z}`);
      reach = [-1, 0, 1].filter((l) => pass.includes(l) && reach.some((q) => Math.abs(q - l) <= moves));
      if (!reach.length) bad.push('unreachable');
      prevEnd = r.z + Math.max(0.3, ...types.map((t) => OBST[t].hz));
      for (const o of r.obstacles) {
        all.push(o);
        if (o.type === 'geodude') geodudes.push(o);
      }
      // Coins never sit inside an obstacle of this row
      for (const c of r.coins) for (const o of r.obstacles) if (c.lane === o.lane && Math.abs(c.z - o.z) < o.hz && o.pass === 'lane') bad.push(`coin in ${o.type}`);
    }
    // Nothing else sits in a Geodude's rolling path
    for (const g of geodudes) for (const o of all) if (o !== g && o.lane === g.lane && o.z > g.z0 && o.z <= g.z0 + 30) bad.push('in geodude path');
    expect(bad).toEqual([]);
    return { counts, twoLane };
  }

  it('RUN-E16 fuzz: 2000 rows at several speeds always leave a reachable free lane', () => {
    const lines = [];
    for (const [startZ, seed] of [[45, 1], [600, 2], [1200, 3], [2400, 4]]) {
      const { counts, twoLane } = fuzz(startZ, 2000, seed);
      expect(Object.keys(counts).length).toBeGreaterThanOrEqual(startZ >= 600 ? 5 : 3);
      lines.push(`from ${startZ} m (${baseSpeedAt(startZ).toFixed(1)}-${SPEED.max} m/s): ${JSON.stringify(counts)}, two-lane rows ${twoLane}`);
    }
    console.info(`[run3d] generator fuzz OK\n  ${lines.join('\n  ')}`);
  }, 30000);

  it('RUN-E17 planning budget: one lane needs 0.9 s, two lanes 1.2 s', () => {
    expect(maxMoves(0.85)).toBe(0);
    expect(maxMoves(0.95)).toBe(1);
    expect(maxMoves(1.25)).toBe(2);
    expect(maxMoves(9)).toBe(2);
  });
});

describe('run3d engine: worlds, missions, gold, storage', () => {
  it('RUN-E18 worlds change every 600 m with a smooth crossfade', () => {
    expect(worldAt(0)).toMatchObject({ index: 0, blend: 0 });
    expect(worldAt(560).blend).toBeGreaterThan(0.3);
    expect(worldAt(560).blend).toBeLessThan(0.7);
    expect(worldAt(610)).toMatchObject({ index: 1, blend: 0 });
    expect(worldAt(1900).index).toBe(3);
    expect(worldAt(2450).index).toBe(0);
  });

  it('RUN-E19 three different missions per run, completed with an event', () => {
    for (let i = 0; i < 20; i++) {
      const m = pickMissions(seeded(i));
      expect(m).toHaveLength(3);
      expect(new Set(m.map((x) => x.kind)).size).toBe(3);
    }
    const s = emptyRun();
    s.missions = [{ kind: 'jumps', goal: 2, label: 'Nhảy 2 lần', progress: 0, done: false }];
    for (let k = 0; k < 2; k++) {
      input(s, 'jump');
      runFor(s, 0.8);
    }
    expect(s.missions[0].done).toBe(true);
    expect(s.events.filter((e) => e.type === 'mission')).toHaveLength(1);
    expect(snap(s).missionsDone).toBe(1);
  });

  it('RUN-E20 gold 5-40 by distance and coins; best distance saved', () => {
    expect(goldForRun(0, 0)).toBe(5);
    expect(goldForRun(200, 20)).toBeGreaterThan(5);
    expect(goldForRun(99999, 9999, 3)).toBe(40);
    localStorage.removeItem(RUN3D_KEY);
    expect(loadRun3d().best).toBe(0);
    expect(saveRun3d(320.7, 40)).toMatchObject({ best: 320, isNew: true, runs: 1 });
    expect(saveRun3d(100, 90)).toMatchObject({ best: 320, bestCoins: 90, isNew: false, runs: 2 });
    localStorage.setItem(RUN3D_KEY, '{oops');
    expect(loadRun3d().best).toBe(0);
  });
});

// ---------------------------------------------------------------- bot simulations

/** A bot that looks ahead like a child who has learned the game. */
function smartBot(s) {
  const H = s.speed * 1.5 + 4;
  // Geodude meets the runner at its planned spot (z0), not where it is now
  const at = (o) => (o.type === 'geodude' ? o.z0 : o.z) - s.d;
  const live = s.obstacles.filter((o) => !o.hit && !o.smashed && o.z + o.hz > s.d - PLAYER.hz && at(o) < H + 10);
  const firstBlock = (l) => {
    const b = live.filter((o) => o.lane === l && o.pass === 'lane').map(at);
    return b.length ? Math.min(...b) : Infinity;
  };
  // A jump / slide obstacle very close in a lane we would move into is too late to handle
  const tooClose = (l) => live.some((o) => o.lane === l && o.pass !== 'lane' && at(o) > -1 && at(o) < 0.45 * s.speed + 1.5);
  const settled = Math.abs(s.x - s.lane * LANE_W) < 0.3;
  if (settled && firstBlock(s.lane) < H) {
    let bestLane = s.lane;
    let bestScore = -Infinity;
    for (const l of [-1, 0, 1]) {
      const mid = Math.abs(l - s.lane) === 2 ? 0 : l;
      const score = Math.min(firstBlock(l), H + 10) - Math.abs(l - s.lane) * 0.5 - (l !== s.lane && (tooClose(l) || (mid !== l && (tooClose(mid) || firstBlock(mid) < 0.5 * s.speed + 2))) ? 100 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestLane = l;
      }
    }
    // Do not step sideways into something that is right beside us
    const next = s.lane + Math.sign(bestLane - s.lane);
    const beside = live.some((o) => o.lane === next && Math.abs(o.z - s.d) < o.hz + PLAYER.hz + 0.5 && o.pass === 'lane');
    if (bestLane !== s.lane && !beside) input(s, bestLane < s.lane ? 'left' : 'right');
  }
  const cur = live.filter((o) => o.lane === s.lane && o.pass !== 'lane').sort((a, b) => a.z - b.z)[0];
  if (!cur) return;
  const gap = cur.z - s.d - (cur.hz + PLAYER.hz);
  if (cur.pass === 'jump' && gap < 0.2 * s.speed && gap > -0.3) input(s, 'jump');
  if (cur.pass === 'slide' && gap < 0.15 * s.speed && gap > -0.3) input(s, 'slide');
}

function simulate(seed, bot, cap = 4000) {
  const s = createRun({ random: seeded(seed) });
  startRun(s);
  let t = 0;
  while (s.phase === 'run' && s.d < cap && t < 600) {
    if (bot) bot(s);
    step(s, DT);
    s.events.length = 0;
    t += DT;
  }
  return { dist: s.d, coins: s.coins, by: s.crashedBy, missions: s.missions.filter((m) => m.done).length };
}

describe('run3d engine: balance (bot simulations)', () => {
  it('RUN-E21 a reacting bot runs far (> 1500 m on average), a bot that never moves stops early (< 200 m)', () => {
    const smart = [];
    const still = [];
    for (let seed = 1; seed <= 12; seed++) {
      smart.push(simulate(seed, smartBot));
      still.push(simulate(seed, null));
    }
    const avg = (list, k) => list.reduce((a, r) => a + r[k], 0) / list.length;
    const smartAvg = avg(smart, 'dist');
    const stillAvg = avg(still, 'dist');
    const deaths = smart.filter((r) => r.by).map((r) => `${Math.round(r.dist)}m:${r.by}`);
    console.info(
      `[run3d] smart bot avg ${Math.round(smartAvg)} m (min ${Math.round(Math.min(...smart.map((r) => r.dist)))}), coins avg ${Math.round(avg(smart, 'coins'))}, gold avg ${Math.round(
        smart.reduce((a, r) => a + goldForRun(r.dist, r.coins, r.missions), 0) / smart.length
      )}, crashes [${deaths.join(', ') || 'none'}]; still bot avg ${Math.round(stillAvg)} m (max ${Math.round(Math.max(...still.map((r) => r.dist)))}), gold avg ${Math.round(
        still.reduce((a, r) => a + goldForRun(r.dist, r.coins, r.missions), 0) / still.length
      )}`
    );
    expect(smartAvg).toBeGreaterThan(1500);
    expect(stillAvg).toBeLessThan(200);
  }, 60000);
});
