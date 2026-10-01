import { describe, it, expect, beforeEach } from 'vitest';
import { LEVELS, ENEMIES, TD_W, TD_H, distToPath, waveSpawns, pointAt } from './levels';
import { LINES, LINE_IDS, typeMult, heroType, ENERGY_NEED, EVOLVE_COST } from './towers';
import { createGame, step, build, evolve, sell, callWave, collectCandy, feedCandy, energyNeed, energyFull, canEvolve, starsFor, sellValue, snap } from './engine';
import { loadProgress, saveResult, levelOpen, goldFor, STORAGE_KEY } from './progress';
import { runBot } from './bots';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Eevee', image: 'eevee.png', types: ['normal'] };

const run = (s, seconds, dt = 0.05) => {
  for (let t = 0; t < seconds && s.status !== 'won' && s.status !== 'lost'; t += dt) step(s, dt);
};

/** Distance along the road closest to a point (to park an enemy next to a tower). */
const nearDist = (lv, x, y) => {
  let best = 0;
  let bd = Infinity;
  for (let d = 0; d <= lv.path.length; d += 2) {
    const p = pointAt(lv.path, d);
    const k = Math.hypot(p.x - x, p.y - y);
    if (k < bd) {
      bd = k;
      best = d;
    }
  }
  return best;
};

beforeEach(() => localStorage.removeItem(STORAGE_KEY));

describe('maps', () => {
  it('TD-01 8 levels, 6 to 15 waves, pads beside the road and inside the map', () => {
    expect(LEVELS).toHaveLength(8);
    expect(LEVELS[0].waves).toHaveLength(6);
    expect(LEVELS[7].waves).toHaveLength(15);
    for (const lv of LEVELS) {
      expect(lv.pads.length).toBeGreaterThanOrEqual(7);
      for (const p of lv.pads) {
        expect(p.x).toBeGreaterThanOrEqual(20);
        expect(p.x).toBeLessThanOrEqual(TD_W - 20);
        expect(p.y).toBeGreaterThanOrEqual(30);
        expect(p.y).toBeLessThanOrEqual(TD_H - 30);
        expect(distToPath(lv.path, p.x, p.y)).toBeGreaterThanOrEqual(30);
        for (const q of lv.pads) if (q !== p) expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(50);
      }
      for (let w = 0; w < lv.waves.length; w++) for (const sp of waveSpawns(lv.index, w)) expect(ENEMIES[sp.kind]).toBeTruthy();
    }
    // Final level ends with Mewtwo
    expect(LEVELS[7].waves[14].some(([k]) => k === 'mewtwo')).toBe(true);
  });
});

describe('rules', () => {
  it('TD-02 type advantage multiplier (soft chart, never immune)', () => {
    expect(typeMult('water', 'fire')).toBeGreaterThan(1);
    expect(typeMult('fire', 'water')).toBeLessThan(1);
    expect(typeMult('psychic', 'poison')).toBeGreaterThan(1);
    expect(typeMult('electric', 'flying')).toBeGreaterThan(1);
    expect(typeMult('electric', 'ground')).toBe(0.5);
    expect(typeMult('fire', 'normal')).toBe(1);
    expect(heroType({ types: ['Fire'] })).toBe('fire');
    expect(heroType({})).toBe('normal');
    expect(heroType({ types: ['???'] })).toBe('normal');
  });

  it('TD-03 a super effective hit does more damage than a weak one', () => {
    const dealt = (line, kind) => {
      const s = createGame({ level: 2, random: seeded(1) });
      s.coins = 999;
      const pad = s.lv.pads[0];
      const t = build(s, 0, line);
      callWave(s);
      s.spawns = [];
      s.enemies = [];
      // One enemy parked right next to the tower
      s.enemies.push({ id: 999, kind, dex: 1, name: kind, type: ENEMIES[kind].type, hp: 5000, maxHp: 5000, speed: 0, reward: 1, lives: 1, fly: false, boss: false, size: 30, wave: 0, dist: nearDist(s.lv, pad.x, pad.y), lane: 0, x: pad.x, y: pad.y, angle: 0, slowT: 0, slowF: 1, poisonT: 0, poisonDps: 0, flash: 0 });
      s.waveLeft[0] = 99;
      for (let i = 0; i < 40; i++) {
        step(s, 0.05);
      }
      return t.damage;
    };
    // Water vs rock (Geodude) is super effective; fire vs rock is not very effective
    expect(dealt('water', 'geodude')).toBeGreaterThan(dealt('water', 'rattata'));
    expect(dealt('fire', 'geodude')).toBeLessThan(dealt('fire', 'rattata'));
  });

  it('TD-04 building costs coins; pads hold one tower; Abra unlocks from level 3', () => {
    const s = createGame({ level: 0, player: PLAYER });
    const c = s.coins;
    expect(build(s, 0, 'fire')).toBeTruthy();
    expect(s.coins).toBe(c - LINES.fire.cost);
    expect(build(s, 0, 'water')).toBeNull();
    expect(build(s, 1, 'psychic')).toBeNull();
    const s3 = createGame({ level: 2 });
    expect(build(s3, 0, 'psychic')).toBeTruthy();
    const poor = createGame({ level: 0 });
    poor.coins = 10;
    expect(build(poor, 0, 'fire')).toBeNull();
  });

  it('TD-05 energy builds up from fighting; evolving needs a full bar and the coins', () => {
    const s = createGame({ level: 0, player: PLAYER, random: seeded(3) });
    const t = build(s, s.lv.pads.slice().sort((a, b) => b.score - a.score)[0].id, 'fire');
    expect(t.energy).toBe(0);
    expect(evolve(s, t.id)).toBe(false);
    callWave(s);
    run(s, 25);
    expect(t.energy).toBeGreaterThan(0);
    // Not full yet -> no evolution even with coins
    t.energy = energyNeed(s, t) - 1;
    s.coins = 999;
    expect(energyFull(s, t)).toBe(false);
    expect(evolve(s, t.id)).toBe(false);
    // Full but too poor
    t.energy = energyNeed(s, t);
    s.coins = EVOLVE_COST[0] - 1;
    expect(canEvolve(s, t)).toBe(false);
    expect(evolve(s, t.id)).toBe(false);
    // Full and enough coins
    s.coins = EVOLVE_COST[0];
    expect(evolve(s, t.id)).toBe(true);
    expect(t.name).toBe('Charmeleon');
    expect(t.stage).toBe(1);
    expect(t.energy).toBe(0);
    expect(s.coins).toBe(0);
    expect(energyNeed(s, t)).toBe(ENERGY_NEED[1]);
    expect(s.events.some((e) => e.type === 'evolve' && e.from === 'Charmander' && e.to === 'Charmeleon')).toBe(true);
    // Last stage: Charizard, and no more evolving
    t.energy = energyNeed(s, t);
    s.coins = 999;
    expect(evolve(s, t.id)).toBe(true);
    expect(t.name).toBe('Charizard');
    expect(energyFull(s, t)).toBe(false);
    expect(evolve(s, t.id)).toBe(false);
  });

  it('TD-06 every line evolves through its 3 forms', () => {
    const names = {};
    for (const line of LINE_IDS) {
      const s = createGame({ level: 2 });
      s.coins = 9999;
      const t = build(s, 0, line);
      const seen = [t.name];
      for (let i = 0; i < 2; i++) {
        t.energy = energyNeed(s, t);
        evolve(s, t.id);
        seen.push(t.name);
      }
      names[line] = seen.join('>');
    }
    expect(names).toEqual({
      fire: 'Charmander>Charmeleon>Charizard',
      water: 'Squirtle>Wartortle>Blastoise',
      grass: 'Bulbasaur>Ivysaur>Venusaur',
      electric: 'Pichu>Pikachu>Raichu',
      psychic: 'Abra>Kadabra>Alakazam',
    });
  });

  it('TD-07 Rare Candy drops from a boss; tapping collects it and it fills a tower\'s energy', () => {
    const s = createGame({ level: 0, player: PLAYER, random: seeded(4) });
    const t = build(s, 0, 'water');
    expect(feedCandy(s, t.id)).toBe(false); // no candy yet
    callWave(s);
    s.spawns = [];
    s.wave = 6;
    s.waveLeft[0] = 1;
    // A boss right next to the tower, with 1 HP left
    s.enemies.push({ id: 500, kind: 'arbok', dex: 24, name: 'Arbok', type: 'poison', hp: 1, maxHp: 700, speed: 0, reward: 40, lives: 5, fly: false, boss: true, size: 58, wave: 0, dist: nearDist(s.lv, t.x, t.y), lane: 0, x: t.x, y: t.y, angle: 0, slowT: 0, slowF: 1, poisonT: 0, poisonDps: 0, flash: 0 });
    run(s, 3);
    expect(s.drops).toHaveLength(1);
    expect(collectCandy(s, s.drops[0].id)).toBe(true);
    expect(s.candies).toBe(1);
    expect(s.drops).toHaveLength(0);
    t.energy = 0;
    expect(feedCandy(s, t.id)).toBe(true);
    expect(t.energy).toBe(energyNeed(s, t));
    expect(s.candies).toBe(0);
  });

  it('TD-08 selling refunds 70% of what was spent (build + evolutions)', () => {
    const s = createGame({ level: 0 });
    s.coins = 1000;
    const t = build(s, 0, 'fire');
    t.energy = energyNeed(s, t);
    evolve(s, t.id);
    const spent = LINES.fire.cost + EVOLVE_COST[0];
    expect(sellValue(t)).toBe(Math.floor(spent * 0.7));
    const before = s.coins;
    expect(sell(s, t.id)).toBe(Math.floor(spent * 0.7));
    expect(s.coins).toBe(before + Math.floor(spent * 0.7));
    expect(s.towers).toHaveLength(0);
  });

  it('TD-09 the child\'s Pokémon is a free hero tower, once per level; it levels up ★1→★3', () => {
    const s = createGame({ level: 0, player: { name: 'Pikachu', image: 'p.png', types: ['electric'] } });
    const c = s.coins;
    const h = build(s, 0, 'hero');
    expect(h).toBeTruthy();
    expect(h.name).toBe('Pikachu');
    expect(h.type).toBe('electric');
    expect(s.coins).toBe(c);
    expect(build(s, 1, 'hero')).toBeNull();
    sell(s, h.id);
    expect(build(s, 1, 'hero')).toBeNull(); // still used up this level
    expect(snap(s).heroUsed).toBe(true);
    const s2 = createGame({ level: 0, player: PLAYER });
    const h2 = build(s2, 0, 'hero');
    s2.coins = 999;
    h2.energy = energyNeed(s2, h2);
    expect(evolve(s2, h2.id)).toBe(true);
    expect(h2.stage).toBe(1);
    expect(h2.name).toBe('Eevee');
    // No player -> no hero
    expect(build(createGame({ level: 0 }), 0, 'hero')).toBeNull();
  });

  it('TD-10 stars by hearts left: 3★ at 80%+, 2★ at 40%+, 1★ for a win, 0 for a loss', () => {
    expect(starsFor(20, 20)).toBe(3);
    expect(starsFor(16, 20)).toBe(3);
    expect(starsFor(15, 20)).toBe(2);
    expect(starsFor(8, 20)).toBe(2);
    expect(starsFor(7, 20)).toBe(1);
    expect(starsFor(1, 20)).toBe(1);
    expect(starsFor(0, 20)).toBe(0);
    expect(starsFor(20, 20, false)).toBe(0);
  });

  it('TD-11 waves: the first waits for the child; calling the next early pays bonus coins', () => {
    const s = createGame({ level: 0, random: seeded(5) });
    run(s, 10);
    expect(s.status).toBe('build');
    expect(s.enemies).toHaveLength(0);
    expect(callWave(s)).toBe(true);
    expect(s.wave).toBe(1);
    expect(callWave(s)).toBe(false); // still spawning
    run(s, 12);
    expect(s.spawns).toHaveLength(0);
    const coins = s.coins;
    expect(callWave(s)).toBe(true);
    expect(s.wave).toBe(2);
    expect(s.coins).toBeGreaterThan(coins);
    expect(s.events.some((e) => e.type === 'early')).toBe(true);
  });

  it('TD-12 enemies that reach the Pokémon Center cost hearts; 0 hearts loses', () => {
    const s = createGame({ level: 0, random: seeded(6) });
    callWave(s);
    run(s, 3000);
    expect(s.status).toBe('lost');
    expect(s.lives).toBe(0);
    expect(s.events.some((e) => e.type === 'end' && e.status === 'lost')).toBe(true);
  });

  it('TD-13 progress: stars saved under pokescan_towerdef_v1, next level unlocks, gold by stars', () => {
    let p = loadProgress();
    expect(levelOpen(p, 0)).toBe(true);
    expect(levelOpen(p, 1)).toBe(false);
    const r = saveResult(0, 2);
    expect(r.improved).toBe(true);
    p = loadProgress();
    expect(JSON.parse(localStorage.getItem('pokescan_towerdef_v1')).stars['0']).toBe(2);
    expect(levelOpen(p, 1)).toBe(true);
    expect(saveResult(0, 1).improved).toBe(false);
    expect(loadProgress().stars[0]).toBe(2);
    expect(goldFor({ stars: 3, won: true, improved: true })).toBeGreaterThan(goldFor({ stars: 1, won: true, improved: true }));
    expect(goldFor({ stars: 1, won: true, improved: true })).toBeGreaterThan(goldFor({ stars: 0, won: false, wavesHeld: 3 }));
    expect(goldFor({ stars: 3, won: true, improved: false })).toBeLessThan(goldFor({ stars: 3, won: true, improved: true }));
  });
});

describe('balance (bot simulations)', () => {
  it('TD-14 smart bot wins every level (3★ early, 2★+ on most); doing nothing loses; never evolving fails late', () => {
    const smart = [];
    const none = [];
    const basic = [];
    for (let l = 0; l < LEVELS.length; l++) {
      const a = runBot(l, 'smart', { random: seeded(100 + l) });
      const b = runBot(l, 'none', { random: seeded(100 + l) });
      const c = runBot(l, 'noevolve', { random: seeded(100 + l) });
      smart.push(a);
      none.push(b);
      basic.push(c);
      console.info(`[towerdef] level ${l + 1} ${LEVELS[l].name}: smart ${a.won ? 'won' : 'lost'} ${a.stars}★ hearts ${a.lives}/20 evolutions ${a.evolutions} candy ${a.candy} (${a.time}s) | no-evolve ${c.won ? 'won' : 'lost'} ${c.stars}★ wave ${c.wave}/${c.waves} | nothing ${b.won ? 'won' : 'lost'} wave ${b.wave}/${b.waves}`);
    }
    // (a) sensible play wins everything
    for (const r of smart) expect(r.won).toBe(true);
    expect(smart[0].stars).toBe(3);
    expect(smart[1].stars).toBe(3);
    expect(smart[2].stars).toBe(3);
    expect(smart.filter((r) => r.stars >= 2).length).toBeGreaterThanOrEqual(6);
    expect(smart.every((r) => r.evolutions > 0)).toBe(true);
    // (b) building nothing loses every level
    for (const r of none) expect(r.won).toBe(false);
    // (c) basic towers only: lose or at most 1★ on levels 6-8
    for (const r of basic.slice(5)) expect(r.stars).toBeLessThanOrEqual(1);
    // ...while the first level is still fine without evolving (gentle start)
    expect(basic[0].won).toBe(true);
  }, 120000);

  it('TD-15 the smart bot also wins with a hero of another type', () => {
    for (const types of [['fire'], ['water'], ['psychic']]) {
      for (const l of [0, 4, 7]) {
        const r = runBot(l, 'smart', { random: seeded(7 + l), player: { name: 'X', types } });
        expect(r.won).toBe(true);
      }
    }
  }, 120000);
});
