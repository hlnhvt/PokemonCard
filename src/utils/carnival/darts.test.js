import { describe, it, expect } from 'vitest';
import {
  createDarts,
  stepDarts,
  throwDart,
  aimFromSwipe,
  balloonPos,
  balloonAt,
  dartsStars,
  swayFor,
  DARTS,
  FLIGHT,
  HAND,
  BOMB,
  DARTS_TWO,
  DARTS_THREE,
} from './darts';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

function run(s, max = 5) {
  for (let t = 0; t < max && s.status !== 'aim' && s.status !== 'done'; t += DT) stepDarts(s, DT);
}

const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/** Play a whole game: `pick(s, r)` returns the point to throw at. */
function play(seed, pick) {
  const s = createDarts({ random: seeded(seed) });
  const r = seeded(seed * 7 + 1);
  let guard = 0;
  while (s.status !== 'done' && guard++ < 50) {
    throwDart(s, pick(s, r));
    run(s);
    s.events.length = 0;
  }
  return s;
}

const alive = (s) => s.balloons.filter((b) => !b.popped);

// A careful child: golden balloons first, leads the drifting rows, small hand shake
const careful = (s, r) => {
  const list = alive(s);
  const gold = list.filter((b) => b.color === 'gold');
  const b = gold.length ? gold[0] : list[Math.floor(r() * list.length)];
  const p = balloonPos(s, b, s.time + FLIGHT);
  return { x: p.x + gauss(r) * 4, y: p.y + gauss(r) * 4 };
};
// A careless child: any balloon, does not lead, shaky
const careless = (s, r) => {
  const list = alive(s);
  const b = list[Math.floor(r() * list.length)];
  const p = balloonPos(s, b);
  return { x: p.x + gauss(r) * 24, y: p.y + gauss(r) * 24 };
};

describe('balloon darts', () => {
  it('DRT-01 20 balloons hold 2 golden 50s, 3 Voltorb, 2 bonus darts and stickers', () => {
    const s = createDarts({ random: seeded(1) });
    expect(s.balloons).toHaveLength(20);
    const kinds = s.balloons.map((b) => b.content);
    expect(kinds.filter((c) => c.rare && c.points === 50)).toHaveLength(2);
    expect(s.balloons.filter((b) => b.color === 'gold')).toHaveLength(2);
    expect(kinds.filter((c) => c.kind === 'bomb')).toHaveLength(3);
    expect(kinds.filter((c) => c.kind === 'bonus')).toHaveLength(2);
    expect(kinds.filter((c) => c.points === 20)).toHaveLength(6);
    expect(kinds.filter((c) => c.points === 10)).toHaveLength(7);
    expect(s.dartsLeft).toBe(DARTS);
  });

  it('DRT-02 a swipe up aims (small swipes do nothing), the dart flies, pops what it lands on', () => {
    expect(aimFromSwipe(0, -10)).toBeNull();
    expect(aimFromSwipe(0, 30)).toBeNull();
    const up = aimFromSwipe(20, -200);
    expect(up.x).toBeGreaterThan(HAND.x);
    expect(up.y).toBeLessThan(HAND.y - 250);
    const s = createDarts({ random: seeded(2) });
    const b = s.balloons[7];
    const p = balloonPos(s, b, s.time + FLIGHT);
    expect(throwDart(s, p)).toBe(true);
    expect(throwDart(s, p)).toBe(false); // one at a time
    expect(s.status).toBe('fly');
    run(s);
    expect(b.popped).toBe(true);
    expect(s.pops).toBe(1);
    expect(s.stuck).toHaveLength(1);
    // Missing: the board between balloons
    const miss = createDarts({ random: seeded(3) });
    throwDart(miss, { x: 180, y: 30 });
    run(miss);
    expect(miss.misses).toBe(1);
    expect(miss.pops).toBe(0);
  });

  it('DRT-03 stickers score, Voltorb costs 15 (never below 0), a bonus dart gives one more', () => {
    const s = createDarts({ random: seeded(4) });
    const find = (fn) => s.balloons.find((b) => !b.popped && fn(b.content));
    const hit = (b) => {
      throwDart(s, balloonPos(s, b, s.time + FLIGHT));
      run(s);
      return s.events.splice(0).find((e) => e.type === 'pop');
    };
    let e = hit(find((c) => c.kind === 'bomb'));
    expect(e.content.kind).toBe('bomb');
    expect(s.score).toBe(0);
    e = hit(find((c) => c.rare));
    expect(e.points).toBe(50);
    expect(s.score).toBe(50);
    e = hit(find((c) => c.kind === 'bomb'));
    expect(s.score).toBe(50 + BOMB);
    const left = s.dartsLeft;
    hit(find((c) => c.kind === 'bonus'));
    expect(s.dartsLeft).toBe(left); // one thrown, one given back
    expect(s.bonus).toBe(1);
  });

  it('DRT-04 rows start to drift after a few throws; the game ends when the darts run out', () => {
    expect(swayFor(0)).toEqual([0, 0, 0, 0]);
    expect(swayFor(DARTS - 1)[0]).toBeGreaterThan(10);
    const s = createDarts({ random: seeded(5) });
    const b = s.balloons[0];
    const x0 = balloonPos(s, b).x;
    let moved = 0;
    for (let i = 0; i < DARTS; i++) {
      throwDart(s, { x: 180, y: 30 }); // misses on purpose
      run(s);
      for (let k = 0; k < 30; k++) {
        stepDarts(s, DT);
        moved = Math.max(moved, Math.abs(balloonPos(s, b).x - x0));
      }
      if (s.status === 'done') break;
    }
    expect(moved).toBeGreaterThan(8);
    expect(s.status).toBe('done');
    expect(s.thrown).toBe(DARTS);
    expect(balloonAt(s, b.hx, b.hy, 0)).toBeTruthy();
  });

  it('DRT-05 balance: a careful child gets 3 stars, a careless one fewer', () => {
    const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
    const good = seeds.map((sd) => play(sd, careful));
    const bad = seeds.map((sd) => play(sd, careless));
    const avg = (l) => Math.round(l.reduce((a, s) => a + s.score, 0) / l.length);
    const share = (l, n) => l.filter((s) => dartsStars(s) === n).length / l.length;
    const hitRate = (l) => l.reduce((a, s) => a + s.pops, 0) / l.reduce((a, s) => a + s.thrown, 0);
    console.info(
      `[darts] careful avg ${avg(good)} (3★ ${Math.round(share(good, 3) * 100)}%, hits ${Math.round(hitRate(good) * 100)}%), careless avg ${avg(bad)} (1★ ${Math.round(share(bad, 1) * 100)}%, 3★ ${Math.round(share(bad, 3) * 100)}%, hits ${Math.round(hitRate(bad) * 100)}%), thresholds ${DARTS_TWO}/${DARTS_THREE}`
    );
    expect(share(good, 3)).toBeGreaterThan(0.8);
    expect(share(bad, 3)).toBeLessThan(0.15);
    expect(avg(bad)).toBeLessThan(DARTS_TWO);
    expect(dartsStars(play(1, careful))).toBe(3);
  });
});
