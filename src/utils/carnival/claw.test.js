import { describe, it, expect } from 'vitest';
import { createClaw, stepClawGame, drop, aimAt, setMove, target, clawStars, canMove, PLUSH_KINDS, TRIES, MIN_X, MAX_X, GRAB_R, RAIL_Y } from './claw';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

function run(s, until, max = 30) {
  for (let t = 0; t < max && !until(s); t += DT) {
    stepClawGame(s, DT);
  }
}

/** Play a whole game: `chooser(s)` returns where to drop the claw each try. */
function play(seed, chooser) {
  const s = createClaw({ random: seeded(seed) });
  const log = [];
  while (s.status === 'play') {
    aimAt(s, chooser(s));
    run(s, (g) => g.claw.aim == null);
    drop(s);
    run(s, (g) => g.claw.state === 'idle' || g.status !== 'play');
    run(s, (g) => !g.plushes.some((p) => p.state === 'fall' || p.state === 'chute') || g.status !== 'play');
    for (const e of s.events.splice(0)) log.push(e);
    if (s.tries <= 0) run(s, (g) => g.status !== 'play');
  }
  return { s, log };
}

// Best plush still on the pile (the careful child goes for the rare ones)
const best = (s) => [...s.plushes].filter((p) => p.state === 'rest').sort((a, b) => PLUSH_KINDS[b.kind].points - PLUSH_KINDS[a.kind].points)[0];

describe('claw machine', () => {
  it('CL-01 a pile of 7 plush with one Mew; the claw moves only in its rail and only when idle', () => {
    const s = createClaw({ random: seeded(1) });
    expect(s.plushes).toHaveLength(7);
    expect(s.plushes.filter((p) => p.kind === 'mew')).toHaveLength(1);
    expect(s.tries).toBe(TRIES);
    setMove(s, -1);
    run(s, () => false, 1);
    expect(s.claw.x).toBe(MIN_X);
    setMove(s, 1);
    run(s, () => false, 4);
    expect(s.claw.x).toBe(MAX_X);
    setMove(s, 0);
    aimAt(s, 200);
    run(s, (g) => g.claw.aim == null);
    expect(s.claw.x).toBeCloseTo(200, 0);
    expect(drop(s)).toBe(true);
    expect(canMove(s)).toBe(false);
    expect(drop(s)).toBe(false); // one drop at a time
    expect(s.tries).toBe(TRIES - 1);
  });

  it('CL-02 a centred grab always holds and wins the plush in the chute; an empty drop misses', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createClaw({ random: seeded(seed) });
      const mew = s.plushes.find((p) => p.kind === 'mew');
      s.claw.x = mew.x;
      drop(s);
      run(s, (g) => g.claw.state === 'idle');
      run(s, (g) => !g.plushes.some((p) => p.state === 'chute'));
      const types = s.events.map((e) => e.type);
      expect(types).toContain('grab');
      expect(types).not.toContain('slip');
      expect(s.prizes.map((p) => p.kind)).toEqual(['mew']);
      expect(s.score).toBe(50);
      expect(mew.state).toBe('won');
    }
    // Over the chute there is nothing to grab
    const e = createClaw({ random: seeded(3) });
    drop(e);
    run(e, (g) => g.claw.state === 'idle');
    expect(e.events.some((x) => x.type === 'miss')).toBe(true);
    expect(e.score).toBe(0);
    expect(target(e, MIN_X)).toBe(null);
  });

  it('CL-03 an off-centre grab often slips on the way up and the plush bounces back onto the pile', () => {
    let slips = 0;
    let holds = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = createClaw({ random: seeded(seed) });
      const p = s.plushes.find((q) => q.tier === 0 && q.kind !== 'mew');
      s.claw.x = p.x + GRAB_R * 0.85 * (seed % 2 ? 1 : -1);
      if (target(s)?.p !== p) continue;
      drop(s);
      run(s, (g) => g.claw.state === 'idle');
      run(s, (g) => !g.plushes.some((q) => q.state === 'fall' || q.state === 'chute'));
      if (s.events.some((e) => e.type === 'slip')) {
        slips++;
        expect(p.state).toBe('rest');
        expect(s.events.some((e) => e.type === 'bounce')).toBe(true);
        expect(s.slips).toBe(1);
        expect(s.claw.y).toBe(RAIL_Y);
      } else holds++;
    }
    expect(slips).toBeGreaterThan(holds);
    expect(holds + slips).toBeGreaterThan(10);
  });

  it('CL-04 after 6 tries the game ends; a careful child gets 3 stars, a careless one fewer', () => {
    const sums = { careful: 0, careless: 0, wobbly: 0 };
    const stars = { careful: [], careless: [], wobbly: [] };
    const N = 30;
    for (let seed = 1; seed <= N; seed++) {
      const careful = play(seed, (s) => best(s).x);
      const r = seeded(seed * 97);
      const careless = play(seed, () => MIN_X + r() * (MAX_X - MIN_X));
      const w = seeded(seed * 31);
      const wobbly = play(seed, (s) => best(s).x + (w() - 0.5) * 2 * GRAB_R * 0.8);
      expect(careful.s.status).toBe('done');
      expect(careful.s.tries).toBe(0);
      expect(careful.log.filter((e) => e.type === 'drop')).toHaveLength(TRIES);
      for (const [k, g] of Object.entries({ careful, careless, wobbly })) {
        sums[k] += g.s.score;
        stars[k].push(clawStars(g.s));
      }
    }
    const avg = (k) => Math.round(sums[k] / N);
    const three = (k) => stars[k].filter((x) => x === 3).length;
    console.info(`[claw] avg score careful ${avg('careful')} (3★ ${three('careful')}/${N}), off-centre ${avg('wobbly')} (3★ ${three('wobbly')}/${N}), random ${avg('careless')} (3★ ${three('careless')}/${N})`);
    expect(three('careful')).toBe(N);
    expect(avg('wobbly')).toBeLessThan(avg('careful'));
    expect(three('careless')).toBeLessThan(N / 4);
    expect(avg('careless')).toBeLessThan(avg('careful') * 0.6);
    expect(three('wobbly')).toBeLessThan(N);
  });
});
