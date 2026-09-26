import { describe, it, expect } from 'vitest';
import { createMatch, step, act, summary, statsFor, fighterById, RESPAWN_TIME, ULT_MAX, spawnPoint } from './engine';
import { decide, waypoint, steer } from './ai';
import { OBSTACLES, BUSHES, WORLD, BASES, collide, blocked, CENTER } from './map';
import { OPPONENT_POOL } from '../battle/opponentPool';
import { seeded } from '../../test/seeded';

const team = (names) => names.map((n) => {
  const p = OPPONENT_POOL.find((x) => x.name === n);
  return { name: p.name, image: '', types: p.types, power: p.bst };
});
const BLUE = team(['Pikachu', 'Charmander', 'Squirtle', 'Bulbasaur', 'Eevee']);
const RED = team(['Meowth', 'Psyduck', 'Growlithe', 'Chikorita', 'Totodile']);

/** A full match with every fighter (the child's too) played by bots. */
function botMatch(seed, { duration = 180, blue = BLUE, red = RED, dt = 1 / 30 } = {}) {
  const random = seeded(seed);
  const s = createMatch({ blue, red, duration, random });
  const mem = {};
  const moved = {};
  while (!s.over) {
    const inputs = {};
    for (const f of s.fighters) {
      if (f.dead) continue;
      inputs[f.id] = decide(s, f, (mem[f.id] ||= {}));
    }
    step(s, dt, inputs);
    for (const f of s.fighters) moved[f.id] = Math.max(moved[f.id] || 0, Math.abs(f.x - BASES[f.team].x));
    s.events.length = 0;
  }
  return { s, moved };
}

describe('arena map', () => {
  it('MB-01 the map is mirrored with no river; bases are free; trees and rocks block', () => {
    for (const o of OBSTACLES) expect(OBSTACLES.some((m) => Math.abs(m.x - (WORLD.w - o.x)) < 0.01 && m.y === o.y && m.kind === o.kind)).toBe(true);
    expect(BUSHES.length % 2).toBe(0);
    for (const b of Object.values(BASES)) for (const o of OBSTACLES) expect(Math.hypot(o.x - b.x, o.y - b.y)).toBeGreaterThan(b.r * 0.9 + o.r * 0.5);
    // The middle of the lanes is open ground now (nothing pushes a Pokemon back there)
    for (const y of [170, 450, 730]) expect(collide({ x: CENTER.x, y, r: 20 })).toMatchObject({ x: CENTER.x, y });
    const rock = OBSTACLES.find((o) => o.x === CENTER.x);
    const e = collide({ x: rock.x + 5, y: rock.y, r: 20 });
    expect(Math.hypot(e.x - rock.x, e.y - rock.y)).toBeGreaterThanOrEqual(20 + rock.r * 0.85 - 0.01);
    expect(blocked(OBSTACLES[0].x - 100, OBSTACLES[0].y, OBSTACLES[0].x + 100, OBSTACLES[0].y)).toBe(true);
  });

  it('MB-02 bots walk straight across the open middle and round trees', () => {
    expect(waypoint({ x: 500, y: 300, r: 20 }, 1100, 300)).toEqual({ x: 1100, y: 300 });
    const d = steer({ x: OBSTACLES[5].x - 70, y: OBSTACLES[5].y, r: 20 }, { x: OBSTACLES[5].x + 200, y: OBSTACLES[5].y });
    expect(Math.abs(d.y)).toBeGreaterThan(0.1); // turns aside instead of walking into the tree
  });
});

describe('arena engine', () => {
  it('MB-03 stats are squeezed: Magikarp and Mewtwo differ but not hugely', () => {
    const weak = statsFor(200, ['water']);
    const strong = statsFor(680, ['psychic']);
    expect(strong.maxHp).toBeGreaterThan(weak.maxHp);
    expect(strong.maxHp / weak.maxHp).toBeLessThan(1.8);
    expect(statsFor(400, ['electric']).speed).toBeGreaterThan(statsFor(400, ['rock']).speed);
  });

  it('MB-04 skills: bolts hit, the nova knocks back, the ultimate dashes and chains 4 hits; kills respawn after 5 s', () => {
    const s = createMatch({ blue: BLUE, red: RED, duration: 60, random: seeded(1) });
    const me = fighterById(s, 'blue0');
    const foe = fighterById(s, 'red0');
    Object.assign(me, { x: 700, y: 450 });
    Object.assign(foe, { x: 760, y: 450 });
    act(s, me, { cast: 's2' });
    expect(s.events.some((e) => e.kind === 'nova')).toBe(true);
    expect(foe.knock).not.toBeNull();
    expect(foe.hp).toBeLessThan(foe.maxHp);
    for (let i = 0; i < 20; i++) step(s, 1 / 30, {});
    Object.assign(foe, { x: 900, y: 450 });
    Object.assign(me, { x: 700, y: 450 });
    me.ult = ULT_MAX;
    foe.hp = foe.maxHp;
    s.events.length = 0;
    act(s, me, { cast: 'ult' });
    for (let i = 0; i < 40; i++) step(s, 1 / 30, {});
    const hits = s.events.filter((e) => e.kind === 'combo-hit');
    expect(hits.map((e) => e.n)).toEqual([1, 2, 3, 4]);
    expect(hits[3].final).toBe(true);
    // Finish it off and check the respawn
    foe.hp = 1;
    me.cd.basic = 0;
    Object.assign(me, { x: foe.x - 60, y: foe.y });
    act(s, me, { basic: true });
    for (let i = 0; i < 30 && !foe.dead; i++) step(s, 1 / 30, {});
    expect(foe.dead).toBe(true);
    expect(s.score.blue).toBe(1);
    expect(me.kills).toBe(1);
    for (let t = 0; t < RESPAWN_TIME + 0.2; t += 1 / 30) step(s, 1 / 30, {});
    expect(foe.dead).toBe(false);
    expect(foe.hp).toBe(foe.maxHp);
    expect(Math.hypot(foe.x - spawnPoint('red', 0).x, foe.y - spawnPoint('red', 0).y)).toBeLessThan(40);
  });

  it('MB-06 skills 1 and 2 are ready again after 0.5 s; flash teleports and waits 10 s', () => {
    const s = createMatch({ blue: BLUE, red: RED, duration: 60, random: seeded(2) });
    const me = fighterById(s, 'blue0');
    Object.assign(me, { x: 400, y: 450 });
    act(s, me, { cast: 's1' });
    expect(me.cd.s1).toBeCloseTo(0.5, 5);
    for (let t = 0; t < 0.52; t += 1 / 60) step(s, 1 / 60, {});
    expect(me.cd.s1).toBe(0);
    expect(act(s, me, { cast: 's2' })).toBe(true);
    expect(me.cd.s2).toBeCloseTo(0.5, 5);
    // Flash to the right
    s.events.length = 0;
    const x0 = me.x;
    expect(act(s, me, { move: { x: 1, y: 0 }, cast: 'blink' })).toBe(true);
    expect(me.x - x0).toBeCloseTo(170, 0);
    expect(s.events.find((e) => e.kind === 'blink')).toMatchObject({ who: 'blue0' });
    expect(act(s, me, { move: { x: 1, y: 0 }, cast: 'blink' })).toBe(false);
    for (let t = 0; t < 10.05; t += 1 / 60) step(s, 1 / 60, {});
    expect(me.cd.blink).toBe(0);
    // Never lands inside a tree
    const tree = OBSTACLES.find((o) => o.kind === 'tree');
    Object.assign(me, { x: tree.x - 170, y: tree.y });
    act(s, me, { move: { x: 1, y: 0 }, cast: 'blink' });
    expect(Math.hypot(me.x - tree.x, me.y - tree.y)).toBeGreaterThanOrEqual(me.r + tree.r * 0.85 - 0.01);
  });

  it('MB-05 bot matches end on time with plenty of action, nobody gets stuck at home, and the children\'s team usually wins', () => {
    const N = 16;
    let blueWins = 0;
    let totalKills = 0;
    for (let i = 0; i < N; i++) {
      const { s, moved } = botMatch(i + 1);
      expect(s.over).toBe(true);
      expect(s.time).toBeGreaterThanOrEqual(180);
      if (s.winner === 'blue') blueWins++;
      totalKills += s.score.blue + s.score.red;
      for (const f of s.fighters) expect(moved[f.id]).toBeGreaterThan(400); // everyone left the base
      const sum = summary(s);
      expect(sum.rows).toHaveLength(10);
      expect(sum.rows.find((r) => r.id === sum.mvp)).toBeTruthy();
      expect(sum.rows.filter((r) => r.team === 'blue').reduce((a, r) => a + r.kills, 0)).toBe(s.score.blue);
    }
    const avgKills = totalKills / N;
    console.info(`[arena] blue wins ${Math.round((blueWins / N) * 100)}%, kills per 3-minute match ${avgKills.toFixed(1)}`);
    // Lively but readable for children: roughly one knock-out every 5-10 seconds
    expect(avgKills).toBeGreaterThan(15);
    expect(avgKills).toBeLessThan(45);
    expect(blueWins / N).toBeGreaterThanOrEqual(0.5);
    expect(blueWins / N).toBeLessThanOrEqual(0.9);
  }, 60000); // 16 simulated 3-minute matches

  it('MB-07 1 vs 1 and 3 vs 3: spawns centred in front of the base, bots spread over the lanes, matches run and end', () => {
    expect(spawnPoint('blue', 0, 1).y).toBeCloseTo(BASES.blue.y);
    expect(spawnPoint('red', 1, 3).y).toBeCloseTo(BASES.red.y);
    expect(spawnPoint('blue', 0, 3).y).toBeLessThan(BASES.blue.y);
    expect(spawnPoint('blue', 2, 3).y).toBeGreaterThan(BASES.blue.y);
    for (const n of [1, 3]) {
      let kills = 0;
      let blueWins = 0;
      for (let i = 0; i < 6; i++) {
        const { s, moved } = botMatch(i + 11, { duration: 120, blue: BLUE.slice(0, n), red: RED.slice(0, n) });
        expect(s.over).toBe(true);
        expect(s.fighters).toHaveLength(n * 2);
        for (const fi of s.fighters) {
          expect(fi.slots).toBe(n);
          expect(moved[fi.id]).toBeGreaterThan(400);
        }
        const sum = summary(s);
        expect(sum.rows).toHaveLength(n * 2);
        kills += s.score.blue + s.score.red;
        if (s.winner === 'blue') blueWins++;
      }
      console.info(`[arena] ${n} vs ${n}: ${(kills / 6).toFixed(1)} knock-outs per 2-minute match, blue wins ${blueWins}/6`);
      expect(kills / 6).toBeGreaterThan(n === 1 ? 2.5 : 7);
      expect(blueWins).toBeGreaterThanOrEqual(3);
    }
  }, 60000);
});
