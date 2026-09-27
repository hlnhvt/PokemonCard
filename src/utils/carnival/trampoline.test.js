import { describe, it, expect } from 'vitest';
import {
  createTrampoline,
  stepTrampoline,
  tapBounce,
  swipeTrick,
  timeToLand,
  tapQuality,
  nextApex,
  layerAt,
  press,
  trampolineStars,
  TRICKS,
  CONTACT,
  PERFECT,
  DURATION,
  MAX_APEX,
  MIN_APEX,
  START_APEX,
} from './trampoline';
import { seeded } from '../../test/seeded';

const DT = 1 / 120;

function run(s, until, max = 10) {
  for (let t = 0; t < max && !until(s) && s.status === 'play'; t += DT) stepTrampoline(s, DT);
}
const toContact = (s) => run(s, (g) => g.phase === 'contact');
const toMiddle = (s) => run(s, (g) => g.phase === 'contact' && g.contactT >= CONTACT / 2 - DT / 2);
const toAir = (s) => run(s, (g) => g.phase === 'air');

describe('trampoline: the rules', () => {
  it('TR-01 it falls onto the mat, presses it down, and bounces; tapping at the bottom of the press is "perfect" and goes higher', () => {
    const s = createTrampoline({ random: seeded(1) });
    expect(s.phase).toBe('air');
    expect(timeToLand(s)).toBeCloseTo(Math.sqrt((2 * START_APEX) / 40), 3);
    expect(tapBounce(s)).toBe('air'); // high up: nothing
    toContact(s);
    expect(s.events.map((e) => e.type)).toContain('land');
    toMiddle(s);
    expect(press(s)).toBeGreaterThan(0.95);
    expect(tapBounce(s)).toBe('perfect');
    expect(tapBounce(s)).toBe('done'); // one tap per landing
    toAir(s);
    const b = s.events.find((e) => e.type === 'bounce');
    expect(b).toMatchObject({ quality: 'perfect', points: 15 });
    expect(s.apex).toBeCloseTo(START_APEX * 1.22 + 1.5, 5);
    // It really reaches that height, and gets height points at the top
    let top = 0;
    run(s, (g) => {
      top = Math.max(top, g.y);
      return g.vy < 0;
    });
    expect(top).toBeGreaterThan(s.apex - 0.2);
    expect(s.events.find((e) => e.type === 'apex').points).toBe(Math.round(top));
  });

  it('TR-02 early, late or no tap loses height; there is a floor and a ceiling', () => {
    expect(tapQuality(0.01)).toBe('early');
    expect(tapQuality(CONTACT / 2 + PERFECT - 0.001)).toBe('perfect');
    expect(tapQuality(CONTACT / 2 + 0.1)).toBe('good');
    expect(tapQuality(CONTACT - 0.01)).toBe('late');
    expect(nextApex(10, 'early')).toBeLessThan(10);
    expect(nextApex(10, 'late')).toBeLessThan(10);
    expect(nextApex(10, 'none')).toBeLessThan(10);
    expect(nextApex(10, 'good')).toBeGreaterThan(10);
    expect(nextApex(MAX_APEX, 'perfect')).toBe(MAX_APEX);
    expect(nextApex(MIN_APEX, 'late')).toBe(MIN_APEX);
    // A tap just before the mat counts as early (and blocks a later good tap)
    const s = createTrampoline({ random: seeded(2) });
    run(s, (g) => g.vy < 0 && timeToLand(g) < 0.2);
    expect(tapBounce(s)).toBe('early');
    toMiddle(s);
    expect(tapBounce(s)).toBe('done');
    toAir(s);
    expect(s.apex).toBeCloseTo(Math.max(MIN_APEX, START_APEX * 0.72), 5);
  });

  it('TR-03 tricks in the air score, more for each different trick in a jump; one still going at landing makes it dizzy', () => {
    const s = createTrampoline({ random: seeded(3) });
    expect(swipeTrick(s, 'down')).toBe('no');
    // Climb high first
    for (let i = 0; i < 6; i++) {
      toContact(s);
      toMiddle(s);
      tapBounce(s);
      toAir(s);
    }
    expect(s.apex).toBeGreaterThan(20);
    expect(swipeTrick(s, 'right')).toBe('flip');
    expect(swipeTrick(s, 'left')).toBe('busy');
    run(s, (g) => !g.trick);
    expect(swipeTrick(s, 'left')).toBe('spin');
    run(s, (g) => !g.trick);
    expect(swipeTrick(s, 'left')).toBe('spin');
    run(s, (g) => !g.trick);
    const done = s.events.filter((e) => e.type === 'trick');
    expect(done.map((e) => e.points)).toEqual([TRICKS.flip.points, Math.round(TRICKS.spin.points * 1.25), Math.round(TRICKS.spin.points * 1.5 * 0.5)]);
    // Start a flip just before the mat: dizzy, weak bounce, a tap does not help
    run(s, (g) => g.vy < 0 && timeToLand(g) < 0.2);
    expect(swipeTrick(s, 'right')).toBe('flip');
    toContact(s);
    expect(s.dizzy).toBe(true);
    expect(s.events.some((e) => e.type === 'dizzy')).toBe(true);
    toMiddle(s);
    expect(tapBounce(s)).toBe('dizzy');
    const before = s.apex;
    toAir(s);
    expect(s.apex).toBeCloseTo(before * 0.6, 5);
    expect(s.dizzies).toBe(1);
    expect(swipeTrick(s, 'up')).toBe('star');
  });

  it('TR-04 sky layers by height; the game ends after 60 s', () => {
    expect(layerAt(0)).toBe(0);
    expect(layerAt(15)).toBe(1);
    expect(layerAt(60)).toBe(4);
    const s = createTrampoline({ random: seeded(4) });
    run(s, () => false, DURATION + 1);
    expect(s.status).toBe('done');
    expect(s.events[s.events.length - 1].type).toBe('end');
    expect(s.best).toBe(START_APEX);
  });
});

/** A whole game. The bot taps with a timing error and does tricks when it thinks there is time. */
function play(seed, { tapError, tapChance = 1, trickMargin, trickEvery = 0.05, noTricks = false }) {
  const rnd = seeded(seed);
  const s = createTrampoline({ random: rnd });
  let aimAt = null;
  let wait = 0;
  const kinds = ['right', 'left', 'up'];
  let k = Math.floor(rnd() * 3);
  while (s.status === 'play') {
    stepTrampoline(s, DT);
    s.events.length = 0;
    if (s.phase === 'contact') {
      if (aimAt == null) aimAt = rnd() < tapChance ? CONTACT / 2 + (rnd() * 2 - 1) * tapError : Infinity;
      if (s.contactT >= aimAt) tapBounce(s);
      continue;
    }
    aimAt = null;
    if (noTricks || s.trick) continue;
    wait -= DT;
    if (wait > 0) continue;
    wait = trickEvery;
    const next = TRICKS[['flip', 'spin', 'star'][k]];
    if (timeToLand(s) > next.dur + trickMargin) {
      swipeTrick(s, kinds[k]);
      k = (k + 1) % 3;
    }
  }
  return s;
}

describe('trampoline: balance', () => {
  it('TR-05 good timing and tricks that finish get 3 stars; sloppy taps or tricks at the last moment get fewer', () => {
    const N = 20;
    const bots = {
      good: { tapError: 0.05, trickMargin: 0.08 },
      okay: { tapError: 0.1, trickMargin: 0.1, trickEvery: 0.4 },
      noTricks: { tapError: 0.05, noTricks: true },
      careless: { tapError: 0.18, tapChance: 0.7, trickMargin: -0.25 },
      idle: { tapError: 0, tapChance: 0, noTricks: true },
    };
    const sum = {};
    const three = {};
    const twoPlus = {};
    let best = 0;
    for (const name of Object.keys(bots)) {
      sum[name] = 0;
      three[name] = 0;
      twoPlus[name] = 0;
      for (let seed = 1; seed <= N; seed++) {
        const s = play(seed, bots[name]);
        sum[name] += s.score;
        if (name === 'good') best = Math.max(best, s.best);
        if (trampolineStars(s) === 3) three[name]++;
        if (trampolineStars(s) >= 2) twoPlus[name]++;
      }
    }
    const avg = (k) => Math.round(sum[k] / N);
    console.info(
      `[trampoline] avg score good ${avg('good')} (3★ ${three.good}/${N}, top ${best.toFixed(0)} m), okay ${avg('okay')} (3★ ${three.okay}/${N}, 2★+ ${twoPlus.okay}/${N}), perfect taps no tricks ${avg('noTricks')} (3★ ${three.noTricks}/${N}, 2★+ ${twoPlus.noTricks}/${N}), careless ${avg('careless')} (3★ ${three.careless}/${N}, 2★+ ${twoPlus.careless}/${N}), never taps ${avg('idle')} (2★+ ${twoPlus.idle}/${N})`
    );
    expect(three.good).toBeGreaterThanOrEqual(N * 0.9);
    expect(twoPlus.okay).toBeGreaterThanOrEqual(N * 0.6);
    expect(three.noTricks).toBe(0);
    expect(three.careless).toBe(0);
    expect(avg('careless')).toBeLessThan(avg('okay'));
    expect(twoPlus.idle).toBe(0);
    expect(twoPlus.noTricks).toBeGreaterThanOrEqual(N * 0.6); // good timing alone is worth 2 stars
  });
});
