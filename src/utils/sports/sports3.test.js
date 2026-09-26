import { describe, it, expect } from 'vitest';
import { createMiner, stepMiner, fire, blast, nextLevel, hookDir, makeItems, minerResult, LEVELS, ORIGIN, ITEM_KINDS } from './goldminer';
import { createArchery, stepArchery, shoot, rivalAim, targetAt, sway, ringScore, totals, ROUNDS, WIND_PUSH, FLIGHT_TIME } from './archery';
import { createRedLight, stepRedLight, playerOf, redLightResult, TRACK, GRACE } from './redlight';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

/** Play a gold-miner level with a simple aiming bot. `pick(items)` chooses what to aim at. */
function playLevel(s, pick) {
  let goal = null;
  let prev = null;
  for (let t = 0; t < 400 && s.status === 'play'; t += DT) {
    const h = s.hook;
    if (h.state === 'swing') {
      if (!goal || !s.items.includes(goal)) goal = pick(s.items);
      if (goal === 'now') fire(s);
      else if (goal) {
        // Fire when the swinging claw passes the wanted angle
        const diff = Math.atan2(goal.x - ORIGIN.x, goal.y - ORIGIN.y) - h.angle;
        if (prev != null && Math.sign(diff) !== Math.sign(prev)) fire(s);
        prev = diff;
      }
      if (goal === 'now' || h.state !== 'swing') {
        goal = null;
        prev = null;
      }
    } else if (h.state === 'back' && h.grabbed?.kind.startsWith('rock')) blast(s);
    stepMiner(s, DT);
    s.events.length = 0;
  }
  return s;
}
// Best money per second of reeling, nothing hidden behind it
const greedy = (items) => {
  const open = items.filter((it) => {
    const d = hookDir(Math.atan2(it.x - ORIGIN.x, it.y - ORIGIN.y));
    return !items.some((o) => o !== it && (() => {
      const px = o.x - ORIGIN.x;
      const py = o.y - ORIGIN.y;
      const along = px * d.x + py * d.y;
      return along > 0 && along < Math.hypot(it.x - ORIGIN.x, it.y - ORIGIN.y) && Math.abs(px * d.y - py * d.x) < o.r + 8;
    })());
  });
  return [...open].sort((a, b) => b.value / b.weight - a.value / a.weight)[0] || items[0];
};

describe('gold miner', () => {
  it('GM-01 levels: targets grow, items never overlap, big gold and diamonds lie deep', () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].target).toBeGreaterThan(LEVELS[i - 1].target);
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const items = makeItems(lv, seeded(lv + 1));
      for (const a of items) for (const b of items) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r);
      for (const it of items.filter((x) => x.kind === 'goldL' || x.kind === 'diamond')) expect(it.y).toBeGreaterThan(350);
      // Enough value to reach the level's own share of the target
      const worth = items.reduce((a, x) => a + x.value, 0);
      expect(worth).toBeGreaterThan(LEVELS[lv].target - (lv ? LEVELS[lv - 1].target : 0));
    }
  });

  it('GM-02 the claw swings, shoots, grabs, reels heavy things slowly and pays on return', () => {
    const s = createMiner({ random: seeded(2) });
    s.items = [{ id: 1, kind: 'goldL', x: ORIGIN.x, y: 300, r: 34, weight: ITEM_KINDS.goldL.weight, value: 450 }, { id: 2, kind: 'goldS', x: 40, y: 500, r: 13, weight: 1.2, value: 50 }];
    s.hook.angle = 0;
    s.hook.swingT = 0;
    expect(fire(s)).toBe(true);
    expect(fire(s)).toBe(false); // already out
    let grabbed = 0;
    let back = 0;
    for (let t = 0; t < 10 && s.money === 0; t += DT) {
      stepMiner(s, DT);
      if (s.events.some((e) => e.type === 'grab')) grabbed = t;
      s.events.length = 0;
      back = t;
    }
    expect(s.money).toBe(450);
    expect(back - grabbed).toBeGreaterThan(1.5); // a big nugget takes a while
    expect(s.hook.state).toBe('swing');
  });

  it('GM-03 dynamite blows up a rock on the claw: it comes back empty and fast', () => {
    const s = createMiner({ random: seeded(3) });
    s.items = [{ id: 1, kind: 'rockL', x: ORIGIN.x, y: 320, r: 27, weight: 5.2, value: 40 }, { id: 2, kind: 'goldS', x: 40, y: 500, r: 13, weight: 1.2, value: 50 }];
    s.hook.angle = 0;
    fire(s);
    for (let i = 0; i < 200 && s.hook.state !== 'back'; i++) stepMiner(s, DT);
    expect(blast(s)).toBe(true);
    expect(s.dynamite).toBe(0);
    expect(blast(s)).toBe(false);
    for (let i = 0; i < 60 && s.hook.state !== 'swing'; i++) stepMiner(s, DT);
    expect(s.hook.state).toBe('swing');
    expect(s.money).toBe(0);
  });

  it('GM-04 a careful player clears all 5 levels; firing at random fails early', () => {
    let careful = 0;
    let wild = 0;
    for (let seed = 1; seed <= 6; seed++) {
      let s = createMiner({ random: seeded(seed) });
      let cleared = 0;
      while (true) {
        playLevel(s, greedy);
        if (s.status === 'failed') break;
        cleared++;
        if (s.status === 'won') break;
        s = nextLevel(s);
      }
      careful += cleared;
      const r = seeded(seed + 50);
      let w = createMiner({ random: seeded(seed) });
      let wc = 0;
      while (true) {
        playLevel(w, () => (r() < 0.02 ? 'now' : null)); // taps without aiming
        if (w.status === 'failed') break;
        wc++;
        if (w.status === 'won') break;
        w = nextLevel(w);
      }
      wild += wc;
    }
    console.info(`[goldminer] careful ${(careful / 6).toFixed(1)} levels, random ${(wild / 6).toFixed(1)} levels`);
    expect(careful / 6).toBeGreaterThanOrEqual(4);
    expect(wild / 6).toBeLessThan(careful / 6);
    expect([minerResult(5), minerResult(3), minerResult(1)]).toEqual(['win', 'draw', 'lose']);
  });
});

describe('archery duel', () => {
  it('AR-01 rings score 10 to 1, the board shrinks and slides from round 3', () => {
    expect(ringScore(0, 90)).toBe(10);
    expect(ringScore(45, 90)).toBe(5);
    expect(ringScore(89, 90)).toBe(1);
    expect(ringScore(95, 90)).toBe(0);
    expect(targetAt(4, 0).r).toBeLessThan(targetAt(0, 0).r);
    expect(targetAt(1, 0.5).x).toBe(targetAt(1, 0).x);
    expect(targetAt(3, 0.5).x).not.toBe(targetAt(3, 0).x);
    expect(Math.hypot(sway(1, 4).x, sway(1, 4).y)).toBeGreaterThan(0);
  });

  it('AR-02 turns alternate over 5 rounds; the wind pushes shots; totals decide', () => {
    const s = createArchery({ random: seeded(4) });
    for (let i = 0; i < ROUNDS * 2; i++) {
      expect(s.turn).toBe(i % 2 ? 'rival' : 'player');
      const tg = targetAt(s.round, s.time + FLIGHT_TIME);
      // Perfect aim that cancels the wind
      shoot(s, { x: tg.x - s.wind * WIND_PUSH, y: tg.y - Math.abs(s.wind) * 4 });
      expect(shoot(s, tg)).toBe(false); // one shot at a time
      for (let t = 0; t <= FLIGHT_TIME + 0.05; t += DT) stepArchery(s, DT);
    }
    expect(s.status).toBe('done');
    expect(s.shots.player).toHaveLength(ROUNDS);
    expect(s.shots.player.every((x) => x.score >= 9)).toBe(true);
    expect(totals(s).player).toBeGreaterThanOrEqual(45);
  });

  it('AR-03 a child who aims at the middle and allows for half the wind beats the rival about half the time or more', () => {
    let wins = 0;
    let draws = 0;
    const N = 60;
    for (let seed = 1; seed <= N; seed++) {
      const s = createArchery({ random: seeded(seed) });
      const kid = seeded(seed + 1000);
      while (s.status !== 'done') {
        if (s.turn === 'player') {
          const tg = targetAt(s.round, s.time + FLIGHT_TIME * 0.5);
          const sw = sway(s.time, s.round);
          const err = () => (kid() + kid() - 1) * 14;
          shoot(s, { x: tg.x - s.wind * WIND_PUSH * 0.5 + sw.x + err(), y: tg.y + sw.y + err() });
        } else shoot(s, rivalAim(s));
        for (let t = 0; t <= FLIGHT_TIME + 0.05; t += DT) stepArchery(s, DT);
      }
      const t = totals(s);
      if (t.player > t.rival) wins++;
      else if (t.player === t.rival) draws++;
    }
    console.info(`[archery] child wins ${Math.round((wins / N) * 100)}%, draws ${Math.round((draws / N) * 100)}%`);
    expect(wins / N).toBeGreaterThanOrEqual(0.45);
    expect(wins / N).toBeLessThanOrEqual(0.85);
  });
});

describe('red light, green light', () => {
  const run = (seed, policy) => {
    const s = createRedLight({ random: seeded(seed) });
    let stoppedAt = null;
    for (let t = 0; t < 90 && s.status === 'play'; t += DT) {
      stepRedLight(s, DT, policy(s, t, () => stoppedAt, (v) => (stoppedAt = v)));
      s.events.length = 0;
    }
    return s;
  };
  // A child who lets go when the doll starts turning, a little late
  const child = (reaction) => (s, t, get, set) => {
    if (s.light === 'green') {
      set(null);
      return true;
    }
    if (get() == null) set(t);
    return t - get() < reaction;
  };

  it('RL-01 moving while the doll looks means out; stopping in time is safe', () => {
    const s = createRedLight({ random: seeded(1) });
    s.clock = 0;
    s.light = 'red';
    s.lightT = 3;
    s.redFor = 0;
    for (let t = 0; t < GRACE - 0.05; t += DT) stepRedLight(s, DT, true);
    expect(playerOf(s).out).toBe(false); // the grace moment
    for (let t = 0; t < 0.2; t += DT) stepRedLight(s, DT, true);
    expect(playerOf(s).out).toBe(true);
    expect(s.status).toBe('out');
    expect(redLightResult('out')).toBe('lose');
    expect([redLightResult('won'), redLightResult('finished'), redLightResult('timeout')]).toEqual(['win', 'draw', 'lose']);
  });

  it('RL-02 the light cycles green -> turning -> red -> green; rivals run on green and some get caught', () => {
    const s = createRedLight({ random: seeded(2) });
    const seen = [];
    let outs = 0;
    for (let t = 0; t < 40 && s.status === 'play'; t += DT) {
      stepRedLight(s, DT, false);
      for (const e of s.events) {
        if (e.type === 'light') seen.push(e.light);
        if (e.type === 'out') outs++;
      }
      s.events.length = 0;
    }
    expect(seen.slice(0, 4)).toEqual(['turning', 'red', 'green', 'turning']);
    expect(s.runners.slice(1).some((c) => c.y > 300)).toBe(true);
    expect(playerOf(s).y).toBe(0); // never pressed
    console.info(`[redlight] rivals caught in 40 s: ${outs}`);
  });

  it('RL-03 a child letting go 0.15 s after the turn usually wins; one who never stops is caught', () => {
    let wins = 0;
    let caught = 0;
    const N = 30;
    for (let seed = 1; seed <= N; seed++) {
      const s = run(seed, child(0.15));
      if (s.status === 'won') wins++;
      if (s.status === 'out') caught++;
      expect(run(seed, () => true).status).toBe('out');
    }
    console.info(`[redlight] careful child wins ${Math.round((wins / N) * 100)}%, caught ${caught}`);
    expect(wins / N).toBeGreaterThanOrEqual(0.5);
    expect(caught).toBe(0);
    // A slow child (lets go only after the doll has turned) is caught
    expect(run(3, child(0.55 + GRACE + 0.1)).status).toBe('out');
    expect(TRACK).toBeGreaterThan(500);
  });
});
