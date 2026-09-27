import { describe, it, expect } from 'vitest';
import { createCups, stepCups, pickCup, makeSwaps, applySwap, trackBall, cupLayout, ballSlot, cupsStars, ROUNDS, SHOW_TIME, COVER_TIME, WAIT_TIME } from './cups';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

function until(s, phase, max = 60) {
  for (let t = 0; t < max && s.phase !== phase && s.status === 'play'; t += DT) stepCups(s, DT);
}

/** Play all rounds: `chooser(s, round)` picks a cup id when it is time. */
function play(seed, chooser) {
  const s = createCups({ random: seeded(seed) });
  while (s.status === 'play') {
    until(s, 'pick');
    if (s.status !== 'play') break;
    pickCup(s, chooser(s, s.round));
    until(s, 'show');
    s.events.length = 0;
  }
  return s;
}

describe('cups: swaps and the ball', () => {
  it('CU-01 swaps come from `random` deterministically, are real swaps and never repeat back to back', () => {
    const a = makeSwaps(4, 30, 1, seeded(9));
    const b = makeSwaps(4, 30, 1, seeded(9));
    expect(a).toEqual(b);
    expect(makeSwaps(4, 30, 1, seeded(10))).not.toEqual(a);
    a.forEach(([x, y], i) => {
      expect(x).not.toBe(y);
      for (const v of [x, y]) expect(v >= 0 && v < 4).toBe(true);
      if (i) expect([x, y].sort().join()).not.toBe([...a[i - 1]].sort().join());
    });
    // Most swaps move the ball so there is something to follow
    let slot = 1;
    let moved = 0;
    for (const sw of a) {
      const next = trackBall(slot, [sw]);
      if (next !== slot) moved++;
      slot = next;
    }
    expect(moved).toBeGreaterThan(a.length / 2);
  });

  it('CU-02 tracking the ball through the swaps matches moving the cups', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = seeded(seed);
      const n = 3 + (seed % 2);
      let order = Array.from({ length: n }, (_, i) => i);
      const ball = Math.floor(r() * n);
      const swaps = makeSwaps(n, 9, order.indexOf(ball), r);
      for (const sw of swaps) order = applySwap(order, sw);
      expect(order[trackBall(ball, swaps)]).toBe(ball);
      expect([...order].sort()).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it('CU-03 a round: show, cover, shuffle along arcs, pick; the game follows the ball the whole time', () => {
    const s = createCups({ random: seeded(5) });
    expect(s.n).toBe(3);
    expect(s.phase).toBe('show');
    expect(cupLayout(s).find((c) => c.id === s.ball).lift).toBe(1);
    expect(pickCup(s, s.ball).result).toBe('wait'); // not yet
    stepCups(s, SHOW_TIME + 0.01);
    stepCups(s, COVER_TIME / 2);
    const mid = cupLayout(s).find((c) => c.id === s.ball).lift;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    stepCups(s, COVER_TIME / 2 + 0.01);
    stepCups(s, WAIT_TIME + 0.01);
    expect(s.phase).toBe('shuffle');
    const expected = trackBall(ballSlot(s), s.swaps);
    // Half way through the first swap two cups are between slots, one over and one under
    stepCups(s, s.speed / 2 - 0.02);
    const moving = cupLayout(s).filter((c) => c.arc !== 0);
    expect(moving).toHaveLength(2);
    expect(Math.sign(moving[0].arc)).toBe(-Math.sign(moving[1].arc));
    moving.forEach((c) => expect(c.x % 1).not.toBe(0));
    until(s, 'pick');
    expect(ballSlot(s)).toBe(expected);
    expect(pickCup(s, s.ball)).toMatchObject({ result: 'right', points: 10 });
    expect(cupLayout(s).every((c) => c.lift === 0 || c.id === s.ball)).toBe(true);
    until(s, 'show');
    expect(s.round).toBe(1);
    until(s, 'pick');
    const wrong = (s.ball + 1) % s.n;
    expect(pickCup(s, wrong)).toMatchObject({ result: 'wrong', points: 0 });
    expect(s.streak).toBe(0);
    // Both the picked cup and the ball's cup lift
    stepCups(s, 1.2);
    const lay = cupLayout(s);
    expect(lay.find((c) => c.id === wrong).lift).toBe(1);
    expect(lay.find((c) => c.id === s.ball).lift).toBe(1);
  });

  it('CU-04 rounds get harder, a 4th cup joins; the streak adds a bonus; a tracker gets 3 stars, a guesser fewer', () => {
    const counts = ROUNDS.map((r) => r.swaps);
    expect(ROUNDS).toHaveLength(10);
    for (let i = 1; i < ROUNDS.length; i++) {
      expect(ROUNDS[i].swaps).toBeGreaterThanOrEqual(ROUNDS[i - 1].swaps);
      expect(ROUNDS[i].speed).toBeLessThanOrEqual(ROUNDS[i - 1].speed);
    }
    expect(counts[9]).toBeGreaterThan(counts[0]);
    expect(ROUNDS.map((r) => r.cups)).toEqual([3, 3, 3, 4, 4, 4, 4, 5, 5, 5]);
    const N = 40;
    const sum = { tracker: 0, guesser: 0, tired: 0 };
    const three = { tracker: 0, guesser: 0, tired: 0 };
    for (let seed = 1; seed <= N; seed++) {
      const g = seeded(seed * 7);
      const tracker = play(seed, (s) => s.ball);
      const guesser = play(seed, (s) => Math.floor(g() * s.n));
      // Follows the slow rounds, loses track when it gets fast
      const tired = play(seed, (s) => (s.speed >= 0.55 ? s.ball : Math.floor(g() * s.n)));
      expect(tracker.status).toBe('done');
      expect(tracker.n).toBe(5);
      expect(tracker.correct).toBe(10);
      expect(tracker.best).toBe(10);
      for (const [k, s] of Object.entries({ tracker, guesser, tired })) {
        sum[k] += s.score;
        if (cupsStars(s) === 3) three[k]++;
      }
    }
    const avg = (k) => Math.round(sum[k] / N);
    console.info(`[cups] avg score tracker ${avg('tracker')} (3★ ${three.tracker}/${N}), loses track when fast ${avg('tired')} (3★ ${three.tired}/${N}), guesser ${avg('guesser')} (3★ ${three.guesser}/${N})`);
    expect(avg('tracker')).toBe(10 + 15 + 20 + 25 + 30 * 6);
    expect(three.tracker).toBe(N);
    expect(three.tired).toBeLessThan(N / 2);
    expect(avg('tired')).toBeGreaterThan(avg('guesser'));
    expect(three.guesser).toBeLessThan(N / 10);
  });
});
