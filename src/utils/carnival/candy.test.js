import { describe, it, expect } from 'vitest';
import {
  createCandy,
  stepCandy,
  pickColor,
  spin,
  trace,
  traceEnd,
  serve,
  currentOrder,
  colorMatch,
  sizeMatch,
  makeOrders,
  candyStars,
  DRUM,
  COLORS,
  CUSTOMERS,
  ARRIVE_TIME,
  REACT_TIME,
  GROW_PER_TURN,
  MAX_FLUFF,
  SIZES,
} from './candy';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;
const TAU = Math.PI * 2;

function toMake(s) {
  for (let t = 0; t < 5 && s.stage !== 'make'; t += DT) stepCandy(s, DT);
}

/** Draw `turns` circles of radius r around the drum, `steps` points per turn. */
function circle(s, turns, { r = 80, steps = 24, dir = 1, from = 0 } = {}) {
  for (let i = 0; i <= Math.round(turns * steps); i++) {
    const a = from + (dir * i * TAU) / steps;
    trace(s, DRUM.x + Math.cos(a) * r, DRUM.y + Math.sin(a) * r);
  }
}

describe('candy: the rules', () => {
  it('CA-01 six customers with orders; single colours first, then swirls; never the player', () => {
    const orders = makeOrders(seeded(3), 'Pikachu');
    expect(orders).toHaveLength(CUSTOMERS);
    expect(orders.map((o) => o.name)).not.toContain('Pikachu');
    expect(new Set(orders.map((o) => o.name)).size).toBe(CUSTOMERS);
    expect(orders.slice(0, 3).every((o) => o.colors.length === 1)).toBe(true);
    expect(orders.slice(3).every((o) => o.colors.length === 2)).toBe(true);
    for (const o of orders) {
      expect(o.target).toBe(SIZES[o.size]);
      for (const c of o.colors) expect(COLORS).toContain(c);
    }
  });

  it('CA-02 a customer arrives, orders; spinning needs a colour; circles grow the candy, back-and-forth does not', () => {
    const s = createCandy({ random: seeded(1) });
    expect(s.stage).toBe('arrive');
    expect(serve(s).result).toBe('wait');
    stepCandy(s, ARRIVE_TIME + 0.01);
    expect(s.stage).toBe('make');
    expect(s.events.map((e) => e.type)).toEqual(['arrive', 'order']);
    s.events.length = 0;
    circle(s, 1);
    expect(s.fluff).toBe(0);
    expect(s.events.some((e) => e.type === 'need-color')).toBe(true);
    traceEnd(s);
    pickColor(s, 'pink');
    circle(s, 2);
    expect(s.fluff).toBeCloseTo(2 * GROW_PER_TURN, 2);
    expect(s.events.filter((e) => e.type === 'turn')).toHaveLength(2);
    traceEnd(s);
    // Wiggling back and forth over a quarter circle
    const before = s.fluff;
    for (let k = 0; k < 20; k++) {
      trace(s, DRUM.x + 80, DRUM.y);
      trace(s, DRUM.x, DRUM.y + 80);
    }
    expect(s.fluff - before).toBeLessThan(GROW_PER_TURN * 0.3);
    traceEnd(s);
    // The other direction works too; points near the centre are ignored
    const b2 = s.fluff;
    circle(s, 1, { dir: -1 });
    expect(s.fluff - b2).toBeCloseTo(GROW_PER_TURN, 2);
    expect(trace(s, DRUM.x + 3, DRUM.y + 2)).toBe(0);
    // It never grows past the stick's limit
    circle(s, 20);
    expect(s.fluff).toBeCloseTo(MAX_FLUFF, 5);
    expect(s.events.some((e) => e.type === 'full')).toBe(true);
  });

  it('CA-03 colour picks: toggle, at most two, the oldest goes', () => {
    const s = createCandy({ random: seeded(2) });
    toMake(s);
    expect(pickColor(s, 'pink')).toEqual(['pink']);
    expect(pickColor(s, 'blue')).toEqual(['pink', 'blue']);
    expect(pickColor(s, 'yellow')).toEqual(['blue', 'yellow']);
    expect(pickColor(s, 'blue')).toEqual(['yellow']);
    expect(colorMatch(['blue', 'pink'], ['pink', 'blue'])).toBe(1);
    expect(colorMatch(['pink'], ['pink', 'blue'])).toBe(0.5);
    expect(colorMatch(['yellow'], ['pink'])).toBe(0);
    expect(sizeMatch(0.6, 0.6)).toBe(1);
    expect(sizeMatch(0.72, 0.6)).toBe(0.7);
    expect(sizeMatch(1.1, 0.35)).toBe(0.1);
  });

  it('CA-04 serving rates colour and size; a perfect candy makes the customer happy and tips; then the next one comes', () => {
    const s = createCandy({ random: seeded(5) });
    toMake(s);
    expect(serve(s).result).toBe('empty');
    const o = currentOrder(s);
    for (const c of o.colors) pickColor(s, c);
    spin(s, (o.target / GROW_PER_TURN) * TAU);
    const r = serve(s);
    expect(r).toMatchObject({ result: 'served', points: 100, hearts: 3, mood: 'happy', fit: 'ok' });
    expect(r.tip).toBeGreaterThan(10);
    expect(s.score).toBe(100 + r.tip);
    expect(s.stage).toBe('react');
    stepCandy(s, REACT_TIME + 0.01);
    expect(s.index).toBe(1);
    expect(s.fluff).toBe(0);
    expect(s.selected).toEqual([]);
    // Wrong colour and far too big: grumpy, no tip
    toMake(s);
    const o2 = currentOrder(s);
    pickColor(s, COLORS.find((c) => !o2.colors.includes(c)));
    spin(s, 40);
    const bad = serve(s);
    expect(bad.mood).toBe('grumpy');
    expect(bad.tip).toBe(0);
    expect(bad.points).toBeLessThan(35);
    expect(bad.fit).toBe(o2.target > 1 ? 'ok' : 'big');
  });

  it('CA-05 a half-right swirl counts half; after six customers the game ends', () => {
    const s = createCandy({ random: seeded(8) });
    for (let i = 0; i < CUSTOMERS; i++) {
      toMake(s);
      const o = currentOrder(s);
      pickColor(s, o.colors[0]);
      spin(s, (o.target / GROW_PER_TURN) * TAU);
      const r = serve(s);
      expect(r.color).toBe(o.colors.length === 2 ? 0.5 : 1);
      stepCandy(s, REACT_TIME + 0.01);
    }
    expect(s.status).toBe('done');
    expect(s.results).toHaveLength(CUSTOMERS);
    expect(s.events[s.events.length - 1].type).toBe('end');
  });
});

/** A whole game: the bot picks colours, draws circles at `speed` turns/s and stops near the size. */
function play(seed, { think, speed, wrongColor, stopError }) {
  const rnd = seeded(seed * 31);
  const s = createCandy({ random: seeded(seed) });
  let plan = null;
  let a = 0;
  while (s.status === 'play') {
    stepCandy(s, DT);
    s.events.length = 0;
    if (s.stage !== 'make') {
      plan = null;
      continue;
    }
    const o = currentOrder(s);
    if (!plan) {
      const stop = Math.max(0.12, o.target + (rnd() * 2 - 1) * stopError);
      const colors = rnd() < wrongColor ? [COLORS[Math.floor(rnd() * COLORS.length)]] : o.colors;
      plan = { stop, colors, picked: false };
    }
    if (s.makeT < think) continue;
    if (!plan.picked) {
      plan.picked = true;
      for (const c of plan.colors) pickColor(s, c);
      traceEnd(s);
    }
    if (s.fluff < plan.stop - 0.005 && s.fluff < MAX_FLUFF) {
      a += speed * TAU * DT;
      trace(s, DRUM.x + Math.cos(a) * 90, DRUM.y + Math.sin(a) * 70);
    } else {
      traceEnd(s);
      serve(s);
    }
  }
  return s;
}

describe('candy: balance', () => {
  it('CA-06 a careful child gets 3 stars; wrong colours or stopping anywhere gets fewer', () => {
    const N = 30;
    const bots = {
      good: { think: 1.5, speed: 1.2, wrongColor: 0, stopError: 0.04 },
      okay: { think: 2.5, speed: 0.9, wrongColor: 0.15, stopError: 0.12 },
      careless: { think: 1, speed: 1.5, wrongColor: 0.6, stopError: 0.35 },
    };
    const sum = {};
    const three = {};
    const twoPlus = {};
    for (const k of Object.keys(bots)) {
      sum[k] = 0;
      three[k] = 0;
      twoPlus[k] = 0;
      for (let seed = 1; seed <= N; seed++) {
        const s = play(seed, bots[k]);
        sum[k] += s.score;
        if (candyStars(s) === 3) three[k]++;
        if (candyStars(s) >= 2) twoPlus[k]++;
      }
    }
    const avg = (k) => Math.round(sum[k] / N);
    console.info(`[candy] avg score good ${avg('good')} (3★ ${three.good}/${N}), okay ${avg('okay')} (3★ ${three.okay}/${N}, 2★+ ${twoPlus.okay}/${N}), careless ${avg('careless')} (3★ ${three.careless}/${N}, 2★+ ${twoPlus.careless}/${N})`);
    expect(three.good).toBeGreaterThanOrEqual(N * 0.9);
    expect(twoPlus.okay).toBeGreaterThanOrEqual(N * 0.6);
    expect(three.okay).toBeLessThan(three.good);
    expect(three.careless).toBeLessThanOrEqual(N * 0.05);
    expect(avg('careless')).toBeLessThan(avg('okay'));
  });
});
