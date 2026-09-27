import { describe, it, expect } from 'vitest';
import {
  createFerris,
  stepFerris,
  tapView,
  askHint,
  makeRide,
  placeAt,
  heightAt,
  cameraY,
  onScreen,
  targetsLeft,
  ferrisStars,
  COVERS,
  RIDES,
  TARGETS,
  VIEW_W,
  VIEW_H,
  WORLD_H,
  BOARD_TIME,
  BREAK_TIME,
  FOUND_POINTS,
  WRONG_COST,
  HINT_COST,
} from './ferris';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

function run(s, until, max = 60) {
  for (let t = 0; t < max && !until(s) && s.status === 'play'; t += DT) stepFerris(s, DT);
}
const tapSpot = (s, p) => tapView(s, p.hx, p.hy - cameraY(s));

describe('ferris: the rules', () => {
  it('FE-01 each ride hides 5 targets and some decoys, all different, never the player; later rides are smaller and better hidden', () => {
    for (let r = 0; r < RIDES.length; r++) {
      const ride = makeRide(r, seeded(r + 1), 'Pikachu');
      expect(ride.spots).toHaveLength(TARGETS + RIDES[r].decoys);
      expect(ride.targets).toHaveLength(TARGETS);
      expect(new Set(ride.spots.map((p) => p.name)).size).toBe(ride.spots.length);
      expect(new Set(ride.spots.map((p) => p.cover)).size).toBe(ride.spots.length);
      expect(ride.spots.map((p) => p.name)).not.toContain('Pikachu');
      for (const p of ride.spots) {
        expect(COVERS[p.cover].peek).toContain(p.dir);
        expect(p.hx).toBeGreaterThan(150);
        expect(p.hx).toBeLessThan(VIEW_W);
        expect(p.hy).toBeGreaterThan(0);
        expect(p.hy).toBeLessThan(WORLD_H);
      }
    }
    expect(RIDES[2].size).toBeLessThan(RIDES[0].size);
    expect(RIDES[2].hide).toBeGreaterThan(RIDES[0].hide);
    // Peeking: the visible part is outside the cover, the hidden part behind it
    const c = { x: 200, y: 300, r: 30 };
    const right = placeAt(c, 'right', 40, 0.25);
    expect(right.x - 20).toBeCloseTo(c.x + c.r - 10, 5); // a quarter (10 px) behind
    expect(right.hx).toBeGreaterThan(c.x + c.r);
    const top = placeAt(c, 'top', 40, 0.5);
    expect(top.y).toBeCloseTo(c.y - c.r, 5);
  });

  it('FE-02 the cabin goes up and down once a ride; the view pans from the ground to the sky and back', () => {
    const s = createFerris({ random: seeded(2) });
    expect(s.stage).toBe('board');
    expect(tapView(s, 200, 200).result).toBe('wait');
    run(s, (g) => g.stage === 'ride');
    expect(heightAt(s)).toBeCloseTo(0, 3);
    expect(cameraY(s)).toBeCloseTo(WORLD_H - VIEW_H, 0);
    const T = RIDES[0].time;
    run(s, (g) => g.rideT >= T / 2);
    expect(heightAt(s)).toBeGreaterThan(0.99);
    expect(cameraY(s)).toBeLessThan(5);
    // Every hidden Pokemon comes into view during the ride
    const s2 = createFerris({ random: seeded(3) });
    run(s2, (g) => g.stage === 'ride');
    run(s2, (g) => g.stage !== 'ride');
    for (const p of s2.ride.spots) expect(p.seenAt).not.toBe(null);
  });

  it('FE-03 tapping a target finds it; a decoy or empty sky costs ride time; finding all 5 ends the ride with a time bonus', () => {
    const s = createFerris({ random: seeded(4) });
    run(s, (g) => g.stage === 'ride');
    const decoy = s.ride.spots.find((p) => !p.target);
    run(s, (g) => onScreen(g, decoy, 20));
    const t0 = s.rideT;
    expect(tapSpot(s, decoy).result).toBe('decoy');
    expect(s.rideT).toBeCloseTo(t0 + WRONG_COST, 5);
    expect(tapView(s, 20, 20).result).toBe('miss');
    expect(s.wrong).toBe(2);
    expect(s.score).toBe(0);
    for (const id of s.ride.targets) {
      const p = s.ride.spots[id];
      run(s, (g) => onScreen(g, p, 20));
      expect(tapSpot(s, p).result).toBe('found');
    }
    expect(s.found).toBe(TARGETS);
    expect(s.stage).toBe('break');
    const end = s.events.find((e) => e.type === 'ride-end');
    expect(end).toMatchObject({ found: 5, all: true });
    expect(end.bonus).toBeGreaterThan(0);
    expect(s.score).toBe(TARGETS * FOUND_POINTS + end.bonus);
    // Next ride
    run(s, (g) => g.stage === 'board');
    expect(s.rideIndex).toBe(1);
    expect(s.ride.spots).toHaveLength(TARGETS + RIDES[1].decoys);
  });

  it('FE-04 a hint costs points and marks one target (on screen if possible); a ride runs out; three rides end the game', () => {
    const s = createFerris({ random: seeded(5) });
    run(s, (g) => g.stage === 'ride');
    s.score = 100;
    const id = askHint(s);
    expect(id).not.toBe(null);
    expect(s.ride.spots[id].target).toBe(true);
    expect(s.score).toBe(100 - HINT_COST);
    expect(askHint(s)).toBe(null); // one at a time
    const visible = targetsLeft(s).filter((p) => onScreen(s, p, 30));
    if (visible.length) expect(onScreen(s, s.ride.spots[id], 30)).toBe(true);
    run(s, (g) => g.stage !== 'ride');
    expect(s.events.find((e) => e.type === 'ride-end')).toMatchObject({ found: 0, bonus: 0, all: false });
    run(s, () => false, (BOARD_TIME + RIDES[0].time + BREAK_TIME) * 3);
    expect(s.status).toBe('done');
    expect(s.rideResults).toHaveLength(3);
  });
});

/** A whole game: the bot spots a target `notice` seconds after it shows, and taps randomly `spam` times a second. */
function play(seed, { notice, spam = 0, hintAfter = Infinity, miss = 0 }) {
  const rnd = seeded(seed * 17);
  const s = createFerris({ random: seeded(seed) });
  let lastFind = 0;
  while (s.status === 'play') {
    stepFerris(s, DT);
    s.events.length = 0;
    if (s.stage !== 'ride') {
      lastFind = s.time;
      continue;
    }
    if (spam && rnd() < spam * DT) tapView(s, 150 + rnd() * 210, rnd() * VIEW_H);
    if (s.stage !== 'ride') continue;
    for (const p of targetsLeft(s)) {
      if (!onScreen(s, p, 20) || p.seenAt == null) continue;
      if (!p.noticeIn) p.noticeIn = notice * (0.6 + rnd() * 0.8);
      const since = s.time - Math.max(p.seenAt, p.backAt || 0);
      if (since >= p.noticeIn || (s.hint?.id === p.id && since > 0.6)) {
        if (rnd() < miss) tapView(s, p.hx + 60, p.hy - cameraY(s));
        tapSpot(s, p);
        lastFind = s.time;
        break;
      }
    }
    // Gone off screen: the next time it comes back needs noticing again
    for (const p of s.ride.spots) if (!onScreen(s, p, 20)) p.backAt = s.time;
    if (s.stage === 'ride' && s.time - lastFind > hintAfter) {
      askHint(s);
      lastFind = s.time;
    }
  }
  return s;
}

describe('ferris: balance', () => {
  it('FE-05 a sharp-eyed child gets 3 stars; slow looking or tapping everywhere gets fewer', () => {
    const N = 20;
    const bots = {
      good: { notice: 1.4 },
      okay: { notice: 3.5, hintAfter: 12, miss: 0.2 },
      slow: { notice: 7 },
      spammer: { notice: 5, spam: 2 },
    };
    const res = {};
    for (const [name, cfg] of Object.entries(bots)) {
      res[name] = { sum: 0, found: 0, three: 0, two: 0 };
      for (let seed = 1; seed <= N; seed++) {
        const s = play(seed, cfg);
        res[name].sum += s.score;
        res[name].found += s.found;
        if (ferrisStars(s) === 3) res[name].three++;
        if (ferrisStars(s) >= 2) res[name].two++;
      }
    }
    const line = Object.entries(res)
      .map(([k, r]) => `${k} ${Math.round(r.sum / N)} (found ${(r.found / N).toFixed(1)}/15, 3★ ${r.three}/${N}, 2★+ ${r.two}/${N})`)
      .join(', ');
    console.info(`[ferris] avg score ${line}`);
    expect(res.good.three).toBeGreaterThanOrEqual(N * 0.9);
    expect(res.okay.two).toBeGreaterThanOrEqual(N * 0.6);
    expect(res.okay.three).toBeLessThan(res.good.three);
    expect(res.slow.three).toBe(0);
    expect(res.spammer.three).toBe(0);
  });
});
