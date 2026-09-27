import { describe, it, expect } from 'vitest';
import { createFishing, stepFishing, tapPond, engaged, inPond, fishingStars, FISH_KINDS, DURATION, POND, CAST_TIME, REEL_TIME } from './fishing';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

function run(s, until, max = 20) {
  for (let t = 0; t < max && !until(s) && s.status === 'play'; t += DT) stepFishing(s, DT);
}

/** One fish of a kind, alone in the pond, next to the bobber spot. */
function lonely(kind, seed = 1) {
  const s = createFishing({ random: seeded(seed) });
  s.fish = [s.fish[0]];
  Object.assign(s.fish[0], { kind, x: POND.x + 40, y: POND.y, state: 'swim', shy: 0, fade: 1 });
  return s;
}

describe('fishing: the rules', () => {
  it('FI-01 cast into the water, a fish comes, nibbles, then bites; tapping the bite hooks and reels it in', () => {
    const s = lonely('goldeen');
    expect(tapPond(s, 20, 540)).toBe('land'); // on the grass
    expect(s.bobber).toBe(null);
    expect(tapPond(s, POND.x, POND.y)).toBe('cast');
    expect(tapPond(s, POND.x, POND.y)).toBe('busy'); // still flying
    stepFishing(s, CAST_TIME + 0.01);
    expect(s.bobber.state).toBe('float');
    expect(s.events.map((e) => e.type)).toEqual(['cast', 'splash']);
    run(s, (g) => engaged(g)?.state === 'nibble');
    const f = engaged(s);
    expect(f.kind).toBe('goldeen');
    run(s, (g) => g.fish[0].state === 'bite');
    const types = s.events.map((e) => e.type);
    expect(types).toContain('approach');
    expect(types).toContain('nibble');
    expect(types[types.length - 1]).toBe('bite');
    expect(s.bobber.dip).toBe(1);
    expect(tapPond(s, 0, 0)).toBe('hook'); // anywhere on the screen
    expect(s.bobber.state).toBe('reel');
    stepFishing(s, REEL_TIME / 2);
    expect(f.y).toBeLessThan(POND.y); // up in the air on an arc
    run(s, (g) => !g.bobber);
    expect(s.score).toBe(FISH_KINDS.goldeen.points);
    expect(s.catches).toEqual(['goldeen']);
    expect(s.events.find((e) => e.type === 'catch')).toMatchObject({ kind: 'goldeen', points: 20 });
  });

  it('FI-02 tapping on a nibble scares the fish; waiting too long lets it go; rarer fish bite for less time', () => {
    const s = lonely('magikarp', 2);
    tapPond(s, POND.x, POND.y);
    run(s, (g) => g.events.some((e) => e.type === 'nibble'));
    expect(tapPond(s, POND.x, POND.y)).toBe('early');
    expect(s.fish[0].state).toBe('flee');
    expect(s.early).toBe(1);
    expect(engaged(s)).toBe(null);
    // The shy fish comes back later; this time let the bite pass
    run(s, (g) => g.fish[0].state === 'bite', 30);
    expect(s.fish[0].state).toBe('bite');
    run(s, (g) => g.fish[0].state !== 'bite');
    expect(s.fish[0].state).toBe('flee');
    expect(s.missed).toBe(1);
    expect(s.score).toBe(0);
    expect(FISH_KINDS.gyarados.window).toBeLessThan(FISH_KINDS.goldeen.window);
    expect(FISH_KINDS.goldeen.window).toBeLessThan(FISH_KINDS.magikarp.window);
    expect(FISH_KINDS.boot.points).toBe(0);
  });

  it('FI-03 fish stay in the pond, caught ones are replaced, and the game ends after 60 s', () => {
    const s = createFishing({ random: seeded(4) });
    const kinds = new Set();
    let spawned = s.fish.length;
    while (s.status === 'play') {
      stepFishing(s, DT);
      for (const f of s.fish) {
        kinds.add(f.kind);
        if (f.state === 'swim') expect(inPond(f.x, f.y, -10)).toBe(true);
      }
      if (!s.bobber) tapPond(s, s.fish[0].x, s.fish[0].y);
      const f = engaged(s);
      if (f?.state === 'bite' && f.t > 0.2) tapPond(s, 0, 0);
      spawned = Math.max(spawned, s.fish.length);
      s.events.length = 0;
    }
    expect(s.time).toBeGreaterThanOrEqual(DURATION);
    expect(s.catches.length).toBeGreaterThan(5);
    expect(s.fish.length).toBeGreaterThanOrEqual(4);
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });
});

/** A whole game. `bot` decides where to cast and when to tap. */
function play(seed, { aim, reaction, early = false, rnd }) {
  const s = createFishing({ random: seeded(seed) });
  let twitchAt = null;
  while (s.status === 'play') {
    stepFishing(s, DT);
    for (const e of s.events.splice(0)) if (e.type === 'nibble' || e.type === 'bite') twitchAt = s.time;
    if (!s.bobber) {
      const at = aim(s, rnd);
      tapPond(s, at.x, at.y);
      continue;
    }
    const f = engaged(s);
    if (early) {
      // Taps soon after anything moves the bobber
      if (twitchAt != null && s.time - twitchAt >= reaction) {
        tapPond(s, 0, 0);
        twitchAt = null;
      }
    } else if (f?.state === 'bite' && f.t >= reaction) tapPond(s, 0, 0);
  }
  return s;
}

// Cast just ahead of the best fish in the pond
const smartAim = (s) => {
  const free = s.fish.filter((f) => f.state === 'swim' && f.shy <= 0 && !FISH_KINDS[f.kind].junk);
  const best = free.sort((a, b) => FISH_KINDS[b.kind].points - FISH_KINDS[a.kind].points)[0] || s.fish[0];
  const k = FISH_KINDS[best.kind];
  const x = best.x + Math.cos(best.heading) * k.speed * 0.5;
  const y = best.y + Math.sin(best.heading) * k.speed * 0.5;
  return inPond(x, y, 16) ? { x, y } : { x: best.x, y: best.y };
};
const randomAim = (s, rnd) => {
  for (;;) {
    const x = POND.x + (rnd() * 2 - 1) * POND.rx;
    const y = POND.y + (rnd() * 2 - 1) * POND.ry;
    if (inPond(x, y, 16)) return { x, y };
  }
};

describe('fishing: balance', () => {
  it('FI-04 a child who aims well and taps on the bite gets 3 stars; tapping at every twitch or too slowly gets fewer', () => {
    const N = 20;
    const sum = { good: 0, okay: 0, slow: 0, jumpy: 0 };
    const three = { good: 0, okay: 0, slow: 0, jumpy: 0 };
    const two = { okay: 0 };
    for (let seed = 1; seed <= N; seed++) {
      const good = play(seed, { aim: smartAim, reaction: 0.3 });
      const okay = play(seed, { aim: smartAim, reaction: 0.55 });
      if (fishingStars(okay) >= 2) two.okay++;
      const slow = play(seed, { aim: smartAim, reaction: 0.85 });
      const jumpy = play(seed, { aim: randomAim, reaction: 0.3, early: true, rnd: seeded(seed * 13) });
      for (const [k, s] of Object.entries({ good, okay, slow, jumpy })) {
        sum[k] += s.score;
        if (fishingStars(s) === 3) three[k]++;
      }
    }
    const avg = (k) => Math.round(sum[k] / N);
    console.info(`[fishing] avg score good ${avg('good')} (3★ ${three.good}/${N}), half-second taps ${avg('okay')} (3★ ${three.okay}/${N}, 2★+ ${two.okay}/${N}), slow to tap ${avg('slow')} (3★ ${three.slow}/${N}), taps every twitch ${avg('jumpy')} (3★ ${three.jumpy}/${N})`);
    expect(three.good).toBeGreaterThanOrEqual(N * 0.9);
    expect(avg('slow')).toBeLessThan(avg('okay'));
    expect(avg('okay')).toBeLessThan(avg('good'));
    expect(two.okay).toBeGreaterThanOrEqual(N * 0.8);
    expect(three.slow).toBeLessThan(N / 3);
    expect(three.jumpy).toBeLessThan(N / 10);
  });
});
