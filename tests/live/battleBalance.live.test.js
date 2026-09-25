import { describe, it, expect } from 'vitest';
import { fetchBattlePokemon } from '../../src/services/battleData';
import { createFighter, createBattle, playTurn, playCombo, canUseCombo, opponentLevel } from '../../src/utils/battle/engine';
import { effectiveness } from '../../src/utils/battle/typeChart';
import { POPULAR_POKEMON } from '../../src/utils/guessGame';
import { pickOpponent } from '../../src/utils/battle/matchmaking';

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

const smart = (b) => {
  let best = 0;
  let value = -1;
  b.player.moves.forEach((m, i) => {
    const v = m.power * (b.player.types.includes(m.type) ? 1.5 : 1) * effectiveness(m.type, b.opponent.types) * (m.accuracy / 100);
    if (v > value) {
      value = v;
      best = i;
    }
  });
  return best;
};
const tapper = (b, r) => Math.floor(r() * 4);

// Pokemon a child is likely to have scanned
const PLAYERS = ['pichu', 'magikarp', 'bulbasaur', 'charmander', 'squirtle', 'pikachu', 'eevee', 'gengar', 'charizard', 'snorlax'];

describe('battle balance with real PokeAPI data', () => {
  it('reports win rates per Pokemon', async () => {
    const pool = await Promise.all(POPULAR_POKEMON.map((p) => fetchBattlePokemon(p.name)));
    const players = await Promise.all(PLAYERS.map((n) => fetchBattlePokemon(n)));
    const lines = [];
    const rates = [];
    for (const pd of players) {
      const result = { smart: 0, tapper: 0 };
      const N = 200;
      for (const [label, chooser] of [['smart', smart], ['tapper', tapper]]) {
        for (let s = 0; s < N; s++) {
          const random = seeded(s * 31 + pd.id);
          const od = pickOpponent(pd, pool, random);
          const player = createFighter(pd, { isPlayer: true, friendship: 30 });
          const opponent = createFighter(od, { level: opponentLevel(pd.stats, od.stats) });
          const b = createBattle({ player, opponent, random });
          for (let t = 0; t < 80 && b.status === 'choosing'; t++) {
            if (canUseCombo(b)) playCombo(b);
            else playTurn(b, chooser(b, random));
          }
          if (b.status === 'won') result[label]++;
        }
        result[label] /= N;
      }
      rates.push(result);
      lines.push(`${pd.name.padEnd(11)} smart ${Math.round(result.smart * 100)}%  random ${Math.round(result.tapper * 100)}%`);
    }
    console.info(lines.join('\n'));
    for (const r of rates) {
      expect(r.smart).toBeGreaterThanOrEqual(0.65);
      expect(r.tapper).toBeGreaterThanOrEqual(0.35);
    }
  }, 300000);
});
