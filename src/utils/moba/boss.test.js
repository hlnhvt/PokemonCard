import { describe, it, expect } from 'vitest';
import { step, summary, fighterById } from './engine';
import { decide } from './ai';
import { createBossMatch, bossOf, BOSSES, ATTACKS, insideWarning, bossDamage, DIFFICULTY } from './boss';
import { BASES, MAPS, OBSTACLES, BUSHES, laneDistance, selectMap, WORLD } from './map';
import { OPPONENT_POOL } from '../battle/opponentPool';
import { seeded } from '../../test/seeded';

const team = (names) => names.map((n) => {
  const p = OPPONENT_POOL.find((x) => x.name === n);
  return { name: p.name, image: '', types: p.types, power: p.bst };
});
const TEAM = team(['Pikachu', 'Charmander', 'Squirtle', 'Bulbasaur', 'Eevee']);
const DT = 1 / 30;

function raid(seed, { difficulty = 'normal', boss = BOSSES[0], duration = 180, mapId = 'forest' } = {}) {
  const s = createBossMatch({ team: TEAM, boss, difficulty, duration, random: seeded(seed), mapId });
  const mem = {};
  let bossInBase = false;
  while (!s.over) {
    const inputs = {};
    for (const f of s.fighters) if (!f.dead && !f.boss) inputs[f.id] = decide(s, f, (mem[f.id] ||= {}));
    step(s, DT, inputs);
    const b = bossOf(s);
    if (Math.hypot(b.x - BASES.blue.x, b.y - BASES.blue.y) < BASES.blue.r) bossInBase = true;
    s.events.length = 0;
  }
  return { s, bossInBase };
}

describe('maps', () => {
  it('BM-01 every map: mirrored, lanes completely clear of obstacles and bushes, bases free', () => {
    expect(MAPS.length).toBeGreaterThanOrEqual(4);
    for (const m of MAPS) {
      selectMap(m.id);
      for (const o of OBSTACLES) {
        expect(OBSTACLES.some((q) => Math.abs(q.x - (WORLD.w - o.x)) < 0.01 && q.y === o.y && q.kind === o.kind)).toBe(true);
        expect(laneDistance(o.x, o.y)).toBeGreaterThanOrEqual(o.r + 45);
        for (const b of Object.values(BASES)) expect(Math.hypot(o.x - b.x, o.y - b.y)).toBeGreaterThan(b.r + o.r + 20);
      }
      for (const bush of BUSHES) expect(laneDistance(bush.x, bush.y)).toBeGreaterThanOrEqual(bush.r + 30);
    }
    selectMap('forest');
  });
});

describe('boss raid', () => {
  it('BM-02 the boss is huge, has no base, and its warnings hit only children standing inside', () => {
    const s = createBossMatch({ team: TEAM, random: seeded(1) });
    const b = bossOf(s);
    expect(b.id).toBe('red0');
    expect(b.maxHp).toBeGreaterThan(fighterById(s, 'blue0').maxHp * 3);
    // Put one child inside the slam and one outside, then let the slam land
    const [inside, outside] = [fighterById(s, 'blue0'), fighterById(s, 'blue1')];
    Object.assign(inside, { x: b.x - 100, y: b.y });
    Object.assign(outside, { x: b.x - 260, y: b.y });
    for (const f of s.fighters.slice(2)) if (!f.boss) Object.assign(f, { x: 150, y: 450 });
    b.cds.slam = 0;
    b.cds.charge = b.cds.meteor = b.cds.ring = 99;
    step(s, DT, {});
    expect(s.telegraphs).toHaveLength(1);
    expect(insideWarning(inside, s.telegraphs[0])).toBe(true);
    expect(insideWarning(outside, s.telegraphs[0])).toBe(false);
    const hpIn = inside.hp;
    const hpOut = outside.hp;
    for (let t = 0; t < ATTACKS.slam.warn + 0.1; t += DT) step(s, DT, {});
    expect(inside.hp).toBeLessThan(hpIn);
    expect(outside.hp).toBe(hpOut);
    expect(s.telegraphs).toHaveLength(0);
  });

  it('BM-03 knocking the boss out wins at once; the time running out means the boss wins', () => {
    const s = createBossMatch({ team: TEAM, random: seeded(2), duration: 5 });
    const b = bossOf(s);
    b.hp = 1;
    const me = fighterById(s, 'blue0');
    Object.assign(me, { x: b.x - 120, y: b.y });
    me.cd.basic = 0;
    for (let i = 0; i < 40 && !s.over; i++) step(s, DT, { blue0: { basic: true, forceBasic: true } });
    expect(s.over).toBe(true);
    expect(s.winner).toBe('blue');
    expect(summary(s).boss.hp).toBe(0);
    const t = createBossMatch({ team: TEAM, random: seeded(3), duration: 2 });
    for (let i = 0; i < 90 && !t.over; i++) step(t, DT, {});
    expect(t.winner).toBe('red');
  });

  it('BM-04 bot raids: the boss never enters the children base; normal is winnable but not easy, hard is harder', () => {
    const rates = {};
    for (const difficulty of ['easy', 'normal', 'hard']) {
      let wins = 0;
      let dmg = 0;
      let time = 0;
      let deaths = 0;
      const N = 8;
      for (let i = 0; i < N; i++) {
        const { s, bossInBase } = raid(i + 1, { difficulty, boss: BOSSES[i % BOSSES.length], mapId: MAPS[i % MAPS.length].id });
        expect(bossInBase).toBe(false);
        if (s.winner === 'blue') {
          wins++;
          time += s.time;
        }
        dmg += bossDamage(s);
        deaths += s.score.red;
      }
      rates[difficulty] = wins / N;
      console.info(`[boss] ${DIFFICULTY[difficulty].label}: wins ${wins}/${N}, boss HP taken ${Math.round((dmg / N) * 100)}%, win time ${wins ? Math.round(time / wins) : '-'} s, children knocked out ${(deaths / N).toFixed(1)}`);
    }
    expect(rates.easy).toBeGreaterThanOrEqual(0.75);
    expect(rates.normal).toBeGreaterThanOrEqual(0.4);
    expect(rates.normal).toBeLessThanOrEqual(0.9);
    expect(rates.hard).toBeLessThanOrEqual(rates.normal);
    selectMap('forest');
  }, 120000);
});
