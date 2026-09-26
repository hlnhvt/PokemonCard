import { describe, it, expect } from 'vitest';
import { rankOf, canPlay, powerOf, gamesForRank, GAME_RANK, RANKS } from './pokemonRank';

// Base HP / Attack / Defense / Speed from PokeAPI
const card = (baseHp, attack, defense, speed, extra = {}) => ({ baseHp, attack, defense, speed, friendship: 0, ...extra });
const PIKACHU = card(35, 55, 40, 90);
const CHARMELEON = card(58, 64, 58, 80);
const CHARIZARD = card(78, 84, 78, 100);
const MEWTWO = card(106, 110, 90, 130);

describe('pokemon rank', () => {
  it('RK-01 real Pokemon land in the expected ranks', () => {
    expect(rankOf(PIKACHU).name).toBe('Đồng');
    expect(rankOf(CHARMELEON).name).toBe('Bạc');
    expect(rankOf(CHARIZARD).name).toBe('Vàng');
    expect(rankOf(MEWTWO).name).toBe('Huyền thoại');
    expect(powerOf(PIKACHU)).toBe(220);
  });

  it('RK-02 shiny and "Tri kỷ" friendship each raise the rank by one, up to the top', () => {
    expect(rankOf({ ...PIKACHU, shinyUnlocked: true })).toMatchObject({ level: 2, bonuses: ['shiny'] });
    expect(rankOf({ ...PIKACHU, shinyUnlocked: true, friendship: 80 }).level).toBe(3);
    expect(rankOf({ ...PIKACHU, friendship: 79 }).level).toBe(1);
    expect(rankOf({ ...MEWTWO, shinyUnlocked: true, friendship: 100 }).level).toBe(4);
  });

  it('RK-03 old cards without stats count as Bạc', () => {
    expect(rankOf({ name: 'Old card' }).level).toBe(2);
  });

  it('RK-04 stronger ranks play more games; learning games are open to all', () => {
    const counts = RANKS.map((r) => gamesForRank(r.level).length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
    expect(counts[counts.length - 1]).toBe(Object.keys(GAME_RANK).length);
    for (const g of ['maze', 'math', 'english', 'catch', 'runner']) expect(canPlay(PIKACHU, g)).toBe(true);
    expect(canPlay(PIKACHU, 'racing')).toBe(false);
    expect(canPlay(CHARIZARD, 'penalty')).toBe(true);
    expect(canPlay(CHARIZARD, 'racing')).toBe(false);
    expect(canPlay(MEWTWO, 'racing')).toBe(true);
    expect(canPlay(PIKACHU, 'unknown-game')).toBe(true);
  });
});
