import { describe, it, expect } from 'vitest';
import { fetchBattlePokemon } from '../../src/services/battleData';

// Real PokeAPI: every Pokemon gets 4 usable damaging moves including a same-type one
describe('battle data from PokeAPI', () => {
  it.each(['pikachu', 'charizard', 'eevee', 'gengar', 'magikarp', 'snorlax'])('%s', async (name) => {
    const p = await fetchBattlePokemon(name);
    console.info(`${p.name}: ${p.moves.map((m) => `${m.name} (${m.type} ${m.power})`).join(', ')}`);
    expect(p.moves).toHaveLength(4);
    for (const m of p.moves) {
      expect(m.power).toBeGreaterThan(0);
      expect(m.accuracy).toBeGreaterThan(0);
    }
    expect(p.moves.some((m) => p.types.includes(m.type))).toBe(true);
  });
});
