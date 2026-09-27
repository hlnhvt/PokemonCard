import { describe, it, expect } from 'vitest';
import { createMatch, step, ARENA_DIFFICULTY } from './engine';
import { decide } from './ai';
import { ARENA_MODES, createTournament, recordMatch, tournamentBonus, tournamentTitle, medalOf, CUP_GOLD, currentMatch } from './tournament';
import { OPPONENT_POOL } from '../battle/opponentPool';
import { seeded } from '../../test/seeded';

const team = (names) => names.map((n) => {
  const p = OPPONENT_POOL.find((x) => x.name === n);
  return { name: p.name, image: '', types: p.types, power: p.bst };
});
const BLUE = team(['Pikachu', 'Charmander', 'Squirtle', 'Bulbasaur', 'Eevee']);
const REDS = [team(['Meowth', 'Psyduck', 'Growlithe', 'Chikorita', 'Totodile']), team(['Vulpix', 'Jigglypuff', 'Pichu', 'Cyndaquil', 'Piplup']), team(['Rowlet', 'Litten', 'Popplio', 'Marill', 'Togepi'])];

describe('arena difficulty', () => {
  it('MB-09 harder levels give the opposing team more HP and damage; bot matches get harder level by level', () => {
    const plain = createMatch({ blue: BLUE, red: REDS[0], random: seeded(1) });
    const hard = createMatch({ blue: BLUE, red: REDS[0], random: seeded(1), difficulty: 'hard' });
    expect(hard.fighters.find((f) => f.id === 'red0').maxHp).toBeGreaterThan(plain.fighters.find((f) => f.id === 'red0').maxHp);
    expect(hard.fighters.find((f) => f.id === 'blue0').maxHp).toBe(plain.fighters.find((f) => f.id === 'blue0').maxHp);
    expect(hard.redDmg).toBeGreaterThan(1);
    const rate = {};
    for (const d of Object.keys(ARENA_DIFFICULTY)) {
      let wins = 0;
      const N = 18;
      for (let i = 0; i < N; i++) {
        const s = createMatch({ blue: BLUE, red: REDS[i % 3], duration: 120, random: seeded(i + 1), difficulty: d });
        const mem = {};
        while (!s.over) {
          const inputs = {};
          for (const f of s.fighters) if (!f.dead) inputs[f.id] = decide(s, f, (mem[f.id] ||= {}));
          step(s, 1 / 30, inputs);
          s.events.length = 0;
        }
        if (s.winner === 'blue') wins++;
      }
      rate[d] = wins / N;
    }
    console.info(`[arena] children's bots win: ${Object.entries(rate).map(([d, r]) => `${ARENA_DIFFICULTY[d].label} ${Math.round(r * 100)}%`).join(', ')}`);
    expect(rate.easy).toBeGreaterThanOrEqual(0.75);
    expect(rate.easy).toBeGreaterThan(rate.normal);
    expect(rate.normal).toBeGreaterThan(rate.expert);
    expect(rate.hard).toBeLessThan(rate.easy);
    expect(rate.expert).toBeLessThanOrEqual(0.3);
  }, 180000);
});

describe('league and cup', () => {
  it('TR-01 league: 5 matches getting harder, 3 points a win, 1 a draw; medal and bonus by points', () => {
    let t = createTournament('league', seeded(1));
    expect(t.matches.map((m) => m.difficulty)).toEqual(ARENA_MODES.league.schedule);
    expect(new Set(t.matches.map((m) => m.club.name)).size).toBe(5);
    for (const winner of ['blue', 'blue', 'draw', 'red', 'blue']) t = recordMatch(t, { winner, score: { blue: 3, red: 1 } });
    expect(t.status).toBe('finished');
    expect(t.points).toBe(10);
    expect(t.matches.map((m) => m.result)).toEqual(['win', 'win', 'draw', 'lose', 'win']);
    expect(medalOf(10).id).toBe('silver');
    expect(tournamentBonus(t)).toBe(medalOf(10).gold);
    expect(tournamentTitle(t)).toContain('10 điểm');
    expect(recordMatch(t, { winner: 'blue' })).toBe(t);
  });

  it('TR-02 cup: a loss knocks the team out; a draw goes to whoever dealt more damage; three wins lift the cup', () => {
    let t = createTournament('cup', seeded(2));
    expect(t.matches.map((m) => m.round)).toEqual(['Tứ kết', 'Bán kết', 'Chung kết']);
    t = recordMatch(t, { winner: 'draw', score: { blue: 2, red: 2 }, dealt: { blue: 900, red: 700 } });
    expect(t.matches[0]).toMatchObject({ result: 'win', decided: 'damage' });
    expect(currentMatch(t).round).toBe('Bán kết');
    const out = recordMatch(t, { winner: 'red', score: { blue: 1, red: 4 } });
    expect(out.status).toBe('out');
    expect(tournamentBonus(out)).toBe(CUP_GOLD.semi);
    expect(tournamentTitle(out)).toContain('Bán kết');
    let win = recordMatch(t, { winner: 'blue', score: { blue: 5, red: 2 } });
    win = recordMatch(win, { winner: 'blue', score: { blue: 4, red: 3 } });
    expect(win.status).toBe('finished');
    expect(tournamentBonus(win)).toBe(CUP_GOLD.champion);
    expect(tournamentTitle(win)).toContain('VÔ ĐỊCH');
  });
});
