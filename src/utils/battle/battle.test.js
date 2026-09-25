import { describe, it, expect } from 'vitest';
import { typeMultiplier, effectiveness, effectivenessLabel, TYPES, TYPE_VI, TYPE_COLORS } from './typeChart';
import { parseMove, levelUpCandidates, selectMoves, fallbackMoves } from './moves';
import {
  calcStat,
  calcDamage,
  createFighter,
  createBattle,
  playTurn,
  playCombo,
  canUseCombo,
  chooseAiMove,
  opponentLevel,
  COMBO_MAX,
  CHAIN_MULTIPLIERS,
} from './engine';
import { pickOpponent, hasTypeAdvantage } from './matchmaking';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mv = (name, type, power, extra = {}) => ({ name, type, power, accuracy: 100, damageClass: 'special', priority: 0, minHits: 1, maxHits: 1, ...extra });

const PIKACHU = {
  name: 'Pikachu', id: 25, types: ['electric'],
  stats: { hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 },
  moves: [mv('Quick Attack', 'normal', 40, { damageClass: 'physical', priority: 1 }), mv('Thunder Shock', 'electric', 40), mv('Iron Tail', 'steel', 100, { damageClass: 'physical', accuracy: 75 }), mv('Thunderbolt', 'electric', 90)],
};
const SQUIRTLE = {
  name: 'Squirtle', id: 7, types: ['water'],
  stats: { hp: 44, attack: 48, defense: 65, spAttack: 50, spDefense: 64, speed: 43 },
  moves: [mv('Tackle', 'normal', 40, { damageClass: 'physical' }), mv('Water Gun', 'water', 40), mv('Bite', 'dark', 60, { damageClass: 'physical' }), mv('Aqua Tail', 'water', 90, { damageClass: 'physical', accuracy: 90 })],
};
const GEODUDE = {
  name: 'Geodude', id: 74, types: ['rock', 'ground'],
  stats: { hp: 40, attack: 80, defense: 100, spAttack: 30, spDefense: 30, speed: 20 },
  moves: [mv('Tackle', 'normal', 40, { damageClass: 'physical' }), mv('Rock Throw', 'rock', 50, { damageClass: 'physical', accuracy: 90 }), mv('Magnitude', 'ground', 70, { damageClass: 'physical' }), mv('Rock Slide', 'rock', 75, { damageClass: 'physical', accuracy: 90 })],
};

describe('type chart', () => {
  it('BT-01 multipliers, dual types and labels', () => {
    expect(TYPES).toHaveLength(18);
    expect(typeMultiplier('fire', 'grass')).toBe(2);
    expect(typeMultiplier('electric', 'ground')).toBe(0);
    expect(typeMultiplier('Water', 'FIRE')).toBe(2);
    expect(effectiveness('water', ['rock', 'ground'])).toBe(4);
    expect(effectiveness('electric', ['water', 'flying'])).toBe(4);
    expect(effectiveness('fire', ['water', 'rock'])).toBe(0.25);
    expect(effectivenessLabel(4)).toBe('Siêu hiệu quả!');
    expect(effectivenessLabel(0.5)).toBe('Không hiệu quả lắm...');
    expect(effectivenessLabel(0)).toBe('Không có tác dụng...');
    expect(effectivenessLabel(1)).toBeNull();
    for (const t of TYPES) {
      expect(TYPE_VI[t]).toBeTruthy();
      expect(TYPE_COLORS[t]).toMatch(/^#/);
    }
  });
});

describe('moves', () => {
  it('BT-02 parses PokeAPI moves and skips status moves', () => {
    expect(parseMove({ name: 'thunderbolt', power: 90, accuracy: 100, priority: 0, type: { name: 'electric' }, damage_class: { name: 'special' }, names: [{ language: { name: 'en' }, name: 'Thunderbolt' }], meta: {} })).toMatchObject({ name: 'Thunderbolt', type: 'electric', power: 90, damageClass: 'special', minHits: 1 });
    expect(parseMove({ name: 'double-kick', power: 30, accuracy: 100, type: { name: 'fighting' }, damage_class: { name: 'physical' }, meta: { min_hits: 2, max_hits: 2 } })).toMatchObject({ name: 'Double Kick', minHits: 2, maxHits: 2 });
    expect(parseMove({ name: 'growl', power: null, damage_class: { name: 'status' } })).toBeNull();
    expect(parseMove(null)).toBeNull();
  });

  it('BT-03 level-up moves learned last come first', () => {
    const list = levelUpCandidates([
      { move: { name: 'a', url: 'u/a' }, version_group_details: [{ move_learn_method: { name: 'level-up' }, level_learned_at: 5 }] },
      { move: { name: 'b', url: 'u/b' }, version_group_details: [{ move_learn_method: { name: 'machine' }, level_learned_at: 0 }] },
      { move: { name: 'c', url: 'u/c' }, version_group_details: [{ move_learn_method: { name: 'level-up' }, level_learned_at: 40 }] },
    ]);
    expect(list.map((m) => m.name)).toEqual(['c', 'a']);
  });

  it('BT-04 picks same-type moves, coverage and a priority move; weakest first', () => {
    const moves = selectMoves(
      [mv('Thunderbolt', 'electric', 90), mv('Spark', 'electric', 65), mv('Iron Tail', 'steel', 100, { accuracy: 75 }), mv('Quick Attack', 'normal', 40, { priority: 1 }), mv('Hyper Beam', 'normal', 150), mv('Growl', 'normal', 0), null],
      ['electric']
    );
    expect(moves).toHaveLength(4);
    expect(moves.map((m) => m.name)).toEqual(expect.arrayContaining(['Thunderbolt', 'Iron Tail', 'Quick Attack']));
    expect(moves.some((m) => m.name === 'Hyper Beam')).toBe(false);
    expect(moves.map((m) => m.power)).toEqual([...moves.map((m) => m.power)].sort((a, b) => a - b));
  });

  it('BT-05 falls back to the offline move set', () => {
    expect(selectMoves([null, null], ['fire']).map((m) => m.name)).toEqual(expect.arrayContaining(['Ember', 'Flamethrower']));
    const dual = fallbackMoves(['grass', 'poison']);
    expect(dual).toHaveLength(4);
    expect(new Set(dual.map((m) => m.type))).toEqual(new Set(['grass', 'poison']));
    expect(fallbackMoves(['unknown'])).toHaveLength(3);
  });
});

describe('damage and stats', () => {
  it('BT-06 level 50 stats follow the standard formula', () => {
    expect(calcStat(35, 50, true)).toBe(95);
    expect(calcStat(90, 50)).toBe(95);
    const p = createFighter(PIKACHU, { isPlayer: true });
    expect(p.maxHp).toBe(Math.round(95 * 1.15));
    expect(createFighter(PIKACHU).maxHp).toBe(95);
  });

  it('BT-07 damage: same-type bonus, effectiveness, critical and immunity', () => {
    const p = createFighter(PIKACHU);
    const s = createFighter(SQUIRTLE);
    const g = createFighter(GEODUDE);
    const max = () => 0.999999; // highest random roll
    const tb = calcDamage(p, s, PIKACHU.moves[3], max);
    // (floor(floor(22*90*55/69)/50)+2)=33 -> x1.5 STAB x2 super effective
    expect(tb.damage).toBe(Math.floor(33 * 1.5 * 2 * (0.85 + 0.999999 * 0.15)));
    expect(tb.effectiveness).toBe(2);
    expect(calcDamage(p, s, PIKACHU.moves[3], max, { crit: true }).damage).toBeGreaterThan(tb.damage);
    expect(calcDamage(p, g, PIKACHU.moves[3], max)).toEqual({ damage: 0, effectiveness: 0 });
    expect(calcDamage(p, s, PIKACHU.moves[3], () => 0).damage).toBeLessThan(tb.damage);
  });

  it('BT-08 friendship makes the child\'s Pokemon a bit stronger', () => {
    const s = createFighter(SQUIRTLE);
    const r = () => 0.5;
    const none = calcDamage(createFighter(PIKACHU, { isPlayer: true, friendship: 0 }), s, PIKACHU.moves[3], r).damage;
    const best = calcDamage(createFighter(PIKACHU, { isPlayer: true, friendship: 100 }), s, PIKACHU.moves[3], r).damage;
    expect(best).toBeGreaterThan(none);
    expect(best / none).toBeLessThanOrEqual(1.12);
  });

  it('BT-09 opponents are levelled to a fair match', () => {
    expect(opponentLevel(GEODUDE.stats, GEODUDE.stats)).toBe(48);
    expect(opponentLevel(PIKACHU.stats, { hp: 106, attack: 90, defense: 130, spAttack: 90, spDefense: 154, speed: 110 })).toBeLessThan(40);
    expect(opponentLevel({ hp: 255, attack: 255, defense: 255, spAttack: 255, spDefense: 255, speed: 255 }, PIKACHU.stats)).toBe(65);
  });
});

describe('turns', () => {
  const battle = (random, player = PIKACHU, opponent = SQUIRTLE) =>
    createBattle({ player: createFighter(player, { isPlayer: true }), opponent: createFighter(opponent), random });

  it('BT-10 a turn: faster Pokemon acts first, events describe everything', () => {
    const b = battle(() => 0.3);
    const events = playTurn(b, 3);
    expect(events[0]).toMatchObject({ kind: 'attack', side: 'player', move: { name: 'Thunderbolt' } });
    const hit = events.find((e) => e.kind === 'hit');
    expect(hit).toMatchObject({ side: 'opponent', effectiveness: 2, hit: 1, hits: 1 });
    expect(events.find((e) => e.kind === 'effect').label).toBe('Siêu hiệu quả!');
    expect(events.some((e) => e.kind === 'attack' && e.side === 'opponent')).toBe(true);
    expect(events.at(-1).kind).toBe('turn-end');
    expect(b.opponent.hp).toBe(b.opponent.maxHp - hit.damage);
  });

  it('BT-11 priority moves go first even when slower', () => {
    const b = battle(() => 0.3, SQUIRTLE, PIKACHU);
    b.player.moves = [mv('Aqua Jet', 'water', 40, { priority: 1 }), ...SQUIRTLE.moves.slice(1)];
    expect(playTurn(b, 0)[0]).toMatchObject({ kind: 'attack', side: 'player' });
  });

  it('BT-12 misses, immunity and multi-hit moves', () => {
    const miss = battle(() => 0.999);
    miss.player.moves[2] = mv('Iron Tail', 'steel', 100, { accuracy: 75 });
    expect(playTurn(miss, 2).some((e) => e.kind === 'miss' && e.side === 'player')).toBe(true);

    const immune = battle(() => 0.3, PIKACHU, GEODUDE);
    const events = playTurn(immune, 3);
    expect(events.find((e) => e.kind === 'effect' && e.side === 'opponent').label).toBe('Không có tác dụng...');

    const multi = battle(() => 0.99);
    multi.player.moves[0] = mv('Double Kick', 'fighting', 30, { accuracy: 100, minHits: 2, maxHits: 2 });
    multi.player.accuracyBonus = 0;
    const hits = playTurn(multi, 0).filter((e) => e.kind === 'hit' && e.side === 'opponent');
    expect(hits.map((h) => h.hit)).toEqual([1, 2]);
  });

  it('BT-13 fainting ends the battle and stops the other attack', () => {
    const b = battle(() => 0.3);
    b.opponent.hp = 1;
    const events = playTurn(b, 3);
    expect(events.at(-1)).toEqual({ kind: 'faint', side: 'opponent' });
    expect(b.status).toBe('won');
    expect(events.some((e) => e.kind === 'attack' && e.side === 'opponent')).toBe(false);
    expect(playTurn(b, 0)).toEqual([]);
  });

  it('BT-14 combo energy builds up and unlocks the chained finisher', () => {
    const b = battle(seeded(4));
    expect(canUseCombo(b)).toBe(false);
    b.combo = COMBO_MAX;
    b.opponent.hp = b.opponent.maxHp = 5000;
    const events = playCombo(b);
    expect(events[0]).toEqual({ kind: 'combo-start' });
    const chained = events.filter((e) => e.kind === 'attack' && e.side === 'player');
    expect(chained.map((e) => e.chain)).toEqual([1, 2, 3, 4]);
    expect(events.filter((e) => e.kind === 'miss' && e.side === 'player')).toHaveLength(0);
    const end = events.find((e) => e.kind === 'combo-end');
    expect(end.total).toBe(5000 - b.opponent.hp);
    expect(b.combo).toBeLessThan(COMBO_MAX);
    expect(CHAIN_MULTIPLIERS[3]).toBeGreaterThan(CHAIN_MULTIPLIERS[0]);
  });

  it('BT-15 the AI usually, but not always, picks its best move', () => {
    const p = createFighter(PIKACHU, { isPlayer: true });
    const g = createFighter(GEODUDE);
    const random = seeded(8);
    const picks = Array.from({ length: 400 }, () => chooseAiMove(g, p, random));
    const best = picks.filter((i) => i === 2).length / picks.length; // Magnitude: ground vs electric
    expect(best).toBeGreaterThan(0.55);
    expect(best).toBeLessThan(0.9);
  });
});

describe('matchmaking', () => {
  const pool = [
    { name: 'Pichu', bst: 205, types: ['electric'] },
    { name: 'Togepi', bst: 245, types: ['fairy'] },
    { name: 'Jigglypuff', bst: 270, types: ['normal', 'fairy'] },
    { name: 'Rowlet', bst: 320, types: ['grass', 'flying'] },
    { name: 'Eevee', bst: 325, types: ['normal'] },
    { name: 'Squirtle', bst: 314, types: ['water'] },
    { name: 'Charmander', bst: 309, types: ['fire'] },
    { name: 'Mewtwo', bst: 680, types: ['psychic'] },
    { name: 'Dragonite', bst: 600, types: ['dragon', 'flying'] },
  ];
  const pickAll = (player) => new Set(Array.from({ length: 200 }, (_, i) => pickOpponent(player, pool, seeded(i + 1)).name));

  it('BT-17 opponents have similar strength and never the same species', () => {
    const picks = pickAll({ name: 'Charmander', bst: 309, types: ['fire'] });
    expect(picks.has('Mewtwo')).toBe(false);
    expect(picks.has('Dragonite')).toBe(false);
    expect(picks.has('Charmander')).toBe(false);
    expect(picks.size).toBeGreaterThan(2);
  });

  it('BT-18 opponents that beat the child by type are avoided', () => {
    // Water is weak to electric and grass: Pichu and Rowlet should not be picked for Magikarp
    const picks = pickAll({ name: 'Magikarp', bst: 200, types: ['water'] });
    expect(picks.has('Pichu')).toBe(false);
    expect(picks.has('Rowlet')).toBe(false);
    expect(hasTypeAdvantage({ types: ['electric'] }, { types: ['water'] })).toBe(true);
    expect(hasTypeAdvantage({ types: ['normal'] }, { types: ['water'] })).toBe(false);
  });

  it('BT-19 very strong Pokemon still get the closest opponents', () => {
    const picks = pickAll({ name: 'Arceus', bst: 720, types: ['normal'] });
    expect([...picks].every((n) => ['Mewtwo', 'Dragonite', 'Eevee', 'Rowlet', 'Squirtle', 'Charmander'].includes(n))).toBe(true);
    expect(picks.has('Mewtwo')).toBe(true);
  });

  it('BT-20 very weak Pokemon face lower-level opponents', () => {
    const weak = { hp: 20, attack: 10, defense: 55, spAttack: 15, spDefense: 20, speed: 80 }; // Magikarp, 200
    const normalPlayer = { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 }; // Bulbasaur, 318
    const same = (s) => opponentLevel(s, s);
    expect(same(weak)).toBeLessThan(same(normalPlayer));
    expect(same(normalPlayer)).toBe(48);
  });
});

describe('difficulty for children', () => {
  function simulate(chooser, seeds = 400) {
    let wins = 0;
    const pairs = [[PIKACHU, SQUIRTLE], [SQUIRTLE, GEODUDE], [GEODUDE, PIKACHU], [PIKACHU, GEODUDE]];
    for (let s = 0; s < seeds; s++) {
      const [pd, od] = pairs[s % pairs.length];
      const random = seeded(s + 1);
      const player = createFighter(pd, { isPlayer: true, friendship: 30 });
      const opponent = createFighter(od, { level: opponentLevel(pd.stats, od.stats) });
      const b = createBattle({ player, opponent, random });
      for (let turn = 0; turn < 60 && b.status === 'choosing'; turn++) {
        if (canUseCombo(b)) playCombo(b);
        else playTurn(b, chooser(b, random));
      }
      if (b.status === 'won') wins++;
    }
    return wins / seeds;
  }

  const smart = (b) => {
    let best = 0;
    let value = -1;
    b.player.moves.forEach((m, i) => {
      const v = m.power * (b.player.types.includes(m.type) ? 1.5 : 1) * effectiveness(m.type, b.opponent.types) * (m.accuracy / 100);
      if (v > value) { value = v; best = i; }
    });
    return best;
  };

  it('BT-16 choosing sensible moves wins most battles, random tapping still wins some', () => {
    const smartRate = simulate(smart);
    const randomRate = simulate((b, r) => Math.floor(r() * 4));
    console.info(`[difficulty] sensible moves win ${Math.round(smartRate * 100)}%, random tapping wins ${Math.round(randomRate * 100)}%`);
    expect(smartRate).toBeGreaterThan(0.75);
    expect(randomRate).toBeGreaterThan(0.3);
    expect(randomRate).toBeLessThan(smartRate);
  });
});
