import { describe, it, expect } from 'vitest';
import {
  createGhostHouse,
  stepGhostHouse,
  tapGhost,
  aimLight,
  ghostPos,
  ghostStars,
  timeLeft,
  KINDS,
  DURATION,
  REVEAL_TIME,
  FRIEND_COST,
  GH_W,
} from './ghosthouse';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

/**
 * A bot plays a whole ride. Each frame `brain(s, memo)` may return { aim: {x,y} } to drag the
 * light and/or { tap: {x,y} } to tap.
 */
function play(seed, brain) {
  const s = createGhostHouse({ random: seeded(seed) });
  const memo = { r: seeded(seed + 100) };
  while (s.status === 'play') {
    stepGhostHouse(s, DT);
    const out = brain(s, memo) || {};
    if (out.aim) aimLight(s, out.aim.x, out.aim.y);
    if (out.tap) tapGhost(s, out.tap.x, out.tap.y);
    s.events.length = 0;
  }
  return s;
}

const live = (s) => s.ghosts.filter((g) => !g.caught && !g.bumped && ghostPos(s, g).k > 0.4);

/** Sweeps the light over each ghost; taps ghosts it can see, leaves friends alone. */
function careful(reaction = 0.2) {
  return (s, memo) => {
    const list = live(s);
    let target = list.find((g) => g.id === memo.target);
    if (!target || (target.revealed && !KINDS[target.kind].ghost)) {
      target = list.find((g) => !g.revealed) || list.find((g) => g.revealed && KINDS[g.kind].ghost);
      memo.target = target?.id;
      memo.seenAt = null;
    }
    if (!target) return null;
    const p = ghostPos(s, target);
    if (target.revealed && KINDS[target.kind].ghost) {
      memo.seenAt ??= s.time;
      if (s.time - memo.seenAt >= reaction) {
        memo.target = null;
        return { tap: p };
      }
    }
    return { aim: p };
  };
}

/** Taps everything it sees lit up, friends included. */
const careless = () => (s) => {
  const lit = live(s).find((g) => g.revealed);
  if (lit) return { tap: ghostPos(s, lit) };
  const dark = live(s)[0];
  return dark ? { aim: ghostPos(s, dark) } : null;
};

/** Barely moves the light; taps only what lightning or luck shows, and slowly. */
const dreamy = () => (s, memo) => {
  const lit = live(s).find((g) => g.revealed && KINDS[g.kind].ghost && g.t > 1.2);
  if (lit && memo.r() < 0.012) return { tap: ghostPos(s, lit) };
  return { aim: { x: GH_W / 2, y: 250 } };
};

describe('ghost house', () => {
  it('GH-01 ghosts peek from the wall, the house scrolls, it ends after 45 s', () => {
    const s = createGhostHouse({ random: seeded(1) });
    const kinds = new Set();
    let lightning = 0;
    let maxOut = 0;
    while (s.status === 'play') {
      stepGhostHouse(s, DT);
      for (const e of s.events) {
        if (e.type === 'peek') kinds.add(e.kind);
        if (e.type === 'lightning') lightning++;
      }
      s.events.length = 0;
      maxOut = Math.max(maxOut, s.ghosts.length);
      for (const g of s.ghosts) {
        const p = ghostPos(s, g);
        expect(p.x).toBeGreaterThanOrEqual(30);
        expect(p.x).toBeLessThanOrEqual(GH_W - 30);
      }
    }
    expect(s.time).toBeGreaterThanOrEqual(DURATION);
    expect(timeLeft(s)).toBe(0);
    expect(s.scroll).toBeGreaterThan(1500);
    expect([...kinds].sort()).toEqual(Object.keys(KINDS).sort());
    expect(lightning).toBeGreaterThanOrEqual(3);
    expect(maxOut).toBeLessThanOrEqual(4);
    expect(s.missed).toBeGreaterThan(0);
  });

  it('GH-02 in the dark a tap only points the light; lit up, a ghost is caught and a friend costs points', () => {
    const s = createGhostHouse({ random: seeded(2) });
    while (!s.ghosts.length) stepGhostHouse(s, DT);
    const g = s.ghosts[0];
    g.kind = 'haunter';
    // Keep the light away while it fades in
    aimLight(s, 0, 540);
    s.light = { x: 0, y: 540 };
    for (let i = 0; i < 30; i++) stepGhostHouse(s, DT);
    expect(g.revealed).toBe(false);
    const p = ghostPos(s, g);
    expect(tapGhost(s, p.x, p.y).result).toBe('dark');
    expect(s.score).toBe(0);
    // The light glides over; after a moment we see it
    for (let i = 0; i < Math.ceil((REVEAL_TIME + 0.3) / DT); i++) {
      const q = ghostPos(s, g);
      aimLight(s, q.x, q.y);
      stepGhostHouse(s, DT);
    }
    expect(g.revealed).toBe(true);
    const q = ghostPos(s, g);
    expect(tapGhost(s, q.x, q.y)).toMatchObject({ result: 'catch', points: 20, kind: 'haunter' });
    expect(s.score).toBe(20);
    expect(s.caught.haunter).toBe(1);
    expect(tapGhost(s, q.x, q.y).result).not.toBe('catch'); // caught already
    // A friend
    const t = createGhostHouse({ random: seeded(3) });
    while (!t.ghosts.length) stepGhostHouse(t, DT);
    const f = t.ghosts[0];
    f.kind = 'togepi';
    for (let i = 0; i < 30; i++) stepGhostHouse(t, DT);
    f.revealed = true;
    t.score = 50;
    const fp = ghostPos(t, f);
    expect(tapGhost(t, fp.x, fp.y)).toMatchObject({ result: 'friend', points: -FRIEND_COST });
    expect(t.score).toBe(50 - FRIEND_COST);
    expect(t.friends).toBe(1);
    expect(tapGhost(t, fp.x, fp.y).result).toBe('empty'); // it waves goodbye
    expect(tapGhost(t, 5, 540).result).toBe('empty');
  });

  it('GH-03 lightning shows every ghost at once', () => {
    const s = createGhostHouse({ random: seeded(4) });
    s.light = { x: 0, y: 560 };
    aimLight(s, 0, 560);
    while (s.ghosts.filter((g) => g.t > 0.5).length < 1) stepGhostHouse(s, DT);
    s.nextLightning = 0;
    stepGhostHouse(s, DT);
    expect(s.flash).toBeGreaterThan(0.9);
    expect(s.ghosts.filter((g) => g.t > 0.5).every((g) => g.revealed)).toBe(true);
  });

  it('GH-04 balance: a careful child gets 3 stars; tapping friends too gets fewer; a dreamy one 1', () => {
    const seeds = [5, 6, 7, 8, 9];
    const avg = (fn) => Math.round(seeds.reduce((n, seed) => n + play(seed, fn()).score, 0) / seeds.length);
    const good = seeds.map((seed) => play(seed, careful(0.2)));
    const bad = seeds.map((seed) => play(seed, careless()));
    const slow = seeds.map((seed) => play(seed, dreamy()));
    const g = avg(() => careful(0.2));
    const b = avg(careless);
    const d = avg(dreamy);
    const caught = Math.round(good.reduce((n, s) => n + s.catches, 0) / seeds.length);
    const friends = Math.round(bad.reduce((n, s) => n + s.friends, 0) / seeds.length);
    const gengar = good.reduce((n, s) => n + s.caught.gengar, 0);
    console.info(`[ghosthouse] scores ${good.map((s) => s.score)} / ${bad.map((s) => s.score)} / ${slow.map((s) => s.score)}; careful avg ${g} (${caught} caught, ${gengar} Gengar over ${seeds.length}), taps friends ${b} (${friends} friends), dreamy ${d}; stars ${good.map(ghostStars)} / ${bad.map(ghostStars)} / ${slow.map(ghostStars)}`);
    for (const s of good) expect(ghostStars(s)).toBe(3);
    for (const s of bad) expect(ghostStars(s)).toBeLessThan(3);
    for (const s of slow) expect(ghostStars(s)).toBe(1);
    expect(b).toBeLessThan(g);
    expect(gengar).toBeGreaterThan(0);
  });
});
