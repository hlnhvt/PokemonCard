import { describe, it, expect } from 'vitest';
import { childKick, planAiKick, childSave, columnOf, onTarget, ROUNDS } from './penalty';
import { perfectLaunch, simulateShot, aiLaunch, launchFromDrag, guidePoints, START } from './basketball';
import { createRace, stepRace, steer, placeOf, player, TRACK, LANES } from './racing';
import { seeded } from '../../test/seeded';

const rate = (n, fn) => Array.from({ length: n }, (_, i) => (fn(i) ? 1 : 0)).reduce((a, b) => a + b, 0) / n;

describe('penalty', () => {
  it('PK-01 goal columns and target checks', () => {
    expect([columnOf(-0.8), columnOf(0), columnOf(0.8)]).toEqual(['left', 'center', 'right']);
    expect(onTarget({ x: 0.5, y: 0.5 })).toBe(true);
    expect(onTarget({ x: 1.2, y: 0.5 })).toBe(false);
  });

  it('PK-02 a child shooting anywhere on target scores about 3 in 4; corners score more', () => {
    const r = seeded(1);
    const any = rate(2000, () => childKick({ x: r() * 2 - 1, y: r() }, r).goal);
    const corner = rate(2000, () => childKick({ x: 0.85, y: 0.8 }, r).goal);
    const middle = rate(2000, () => childKick({ x: 0, y: 0.3 }, r).goal);
    console.info(`[penalty] child scores: any ${Math.round(any * 100)}%, corner ${Math.round(corner * 100)}%, middle ${Math.round(middle * 100)}%`);
    expect(any).toBeGreaterThan(0.65);
    expect(any).toBeLessThan(0.88);
    expect(corner).toBeGreaterThan(middle);
  });

  it('PK-03 following the kicker\'s lean saves more than guessing', () => {
    const r = seeded(2);
    const follow = rate(2000, () => {
      const k = planAiKick(r);
      return childSave(k, k.lean, r).saved;
    });
    const guess = rate(2000, () => childSave(planAiKick(r), ['left', 'center', 'right'][Math.floor(r() * 3)], r).saved);
    console.info(`[penalty] child saves: follow lean ${Math.round(follow * 100)}%, guess ${Math.round(guess * 100)}%`);
    expect(follow).toBeGreaterThan(guess + 0.2);
    expect(guess).toBeGreaterThan(0.15);
  });

  it('PK-04 a guessing child still wins a fair share of shoot-outs', () => {
    const r = seeded(3);
    const wins = rate(500, () => {
      let child = 0;
      let cpu = 0;
      for (let i = 0; i < ROUNDS; i++) {
        if (childKick({ x: r() * 2 - 1, y: r() }, r).goal) child++;
        if (childSave(planAiKick(r), ['left', 'center', 'right'][Math.floor(r() * 3)], r).goal) cpu++;
      }
      return child > cpu;
    });
    console.info(`[penalty] guessing child wins ${Math.round(wins * 100)}%`);
    expect(wins).toBeGreaterThan(0.3);
  });
});

describe('basketball', () => {
  it('BB-01 the perfect launch scores at several angles', () => {
    for (const a of [55, 60, 65]) expect(simulateShot(perfectLaunch(a)).made).toBe(true);
  });

  it('BB-02 weak and wild shots miss', () => {
    expect(simulateShot({ vx: 3, vy: 3 }).made).toBe(false);
    expect(simulateShot({ vx: 11, vy: 4 }).made).toBe(false);
  });

  it('BB-03 there is a forgiving window around the perfect shot', () => {
    const v = perfectLaunch(55);
    const made = [-0.03, -0.015, 0.015, 0.03].filter((e) => simulateShot({ vx: v.vx * (1 + e), vy: v.vy * (1 + e) }).made).length;
    expect(made).toBeGreaterThanOrEqual(2);
  });

  it('BB-04 the computer makes roughly half its shots', () => {
    const r = seeded(4);
    const made = rate(300, () => simulateShot(aiLaunch(r)).made);
    console.info(`[basketball] computer makes ${Math.round(made * 100)}%`);
    expect(made).toBeGreaterThan(0.35);
    expect(made).toBeLessThan(0.7);
  });

  it('BB-05 drags launch the opposite way, capped; the guide starts at the ball', () => {
    const v = launchFromDrag(-1, -1);
    expect(v.vx).toBeGreaterThan(0);
    expect(v.vy).toBeGreaterThan(0);
    const big = launchFromDrag(-10, -10);
    expect(Math.hypot(big.vx, big.vy)).toBeCloseTo(12, 5);
    const g = guidePoints(v);
    expect(g[0].x).toBeGreaterThan(START.x);
    expect(g).toHaveLength(9);
  });

  it('BB-06 every shot finishes', () => {
    const r = seeded(5);
    for (let i = 0; i < 100; i++) expect(simulateShot({ vx: r() * 12, vy: r() * 12 }).done).toBe(true);
  });
});

describe('racing', () => {
  function runRace(seed, driver) {
    const r = seeded(seed);
    const race = createRace({ random: r });
    let t = 0;
    while (!race.done && t < 120) {
      driver(race, r);
      stepRace(race, 1 / 30);
      t += 1 / 30;
    }
    return race;
  }
  // A child that dodges obstacles it sees coming, with some mistakes
  const dodger = (skill) => (race, r) => {
    const p = player(race);
    if (race.time < 0 || p.x !== p.lane) return;
    const next = race.items.find((it) => !it.gone && it.y > p.dist + 40 && it.y - p.dist < 110 && it.lane === p.lane);
    if (next && next.type !== 'boost' && !p.hitItems.has(next.id) && r() < skill * 0.1) {
      steer(race, p.lane === 0 ? 1 : p.lane === LANES - 1 ? -1 : r() < 0.5 ? -1 : 1);
    }
  };

  it('RC-01 countdown, then everyone rides to the finish', () => {
    const race = runRace(1, () => {});
    expect(race.done).toBe(true);
    expect(player(race).dist).toBe(TRACK);
    expect(race.events[0].type).toBe('go');
  });

  it('RC-02 steering is clamped to the road', () => {
    const race = createRace({ random: seeded(1) });
    steer(race, -1);
    steer(race, -1);
    expect(player(race).lane).toBe(0);
    steer(race, 5);
    expect(player(race).lane).toBe(2);
  });

  it('RC-03 a child who dodges finishes well; one who never steers still places sometimes', () => {
    const N = 80;
    const good = Array.from({ length: N }, (_, i) => placeOf(runRace(i + 10, dodger(0.9))));
    const idle = Array.from({ length: N }, (_, i) => placeOf(runRace(i + 10, () => {})));
    const podium = (arr) => arr.filter((p) => p <= 3).length / arr.length;
    const first = (arr) => arr.filter((p) => p === 1).length / arr.length;
    console.info(`[racing] dodger: 1st ${Math.round(first(good) * 100)}%, podium ${Math.round(podium(good) * 100)}% | idle: 1st ${Math.round(first(idle) * 100)}%, podium ${Math.round(podium(idle) * 100)}%`);
    expect(first(good)).toBeGreaterThan(0.45);
    expect(first(good)).toBeGreaterThan(first(idle));
    expect(podium(idle)).toBeGreaterThan(0.3);
  });

  it('RC-04 hitting oil slows, boosts speed up', () => {
    const race = createRace({ random: seeded(2) });
    race.items = [{ id: 0, y: 100, lane: 1, type: 'oil' }, { id: 1, y: 600, lane: 1, type: 'boost' }];
    race.time = 0;
    const types = [];
    for (let i = 0; i < 300; i++) {
      stepRace(race, 1 / 30);
      race.events.splice(0).forEach((e) => e.rider === 'player' && types.push(e.type));
    }
    expect(types).toEqual(['oil', 'boost']);
  });
});
