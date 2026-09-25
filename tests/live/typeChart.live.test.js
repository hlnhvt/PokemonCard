import { describe, it, expect } from 'vitest';
import { TYPES, typeMultiplier } from '../../src/utils/battle/typeChart';

// Compares the embedded type chart with PokeAPI's damage relations for all 18 types
describe('type chart matches PokeAPI', () => {
  it('all 18 x 18 multipliers are identical', async () => {
    const mismatches = [];
    for (const attacking of TYPES) {
      const res = await fetch(`https://pokeapi.co/api/v2/type/${attacking}`);
      const { damage_relations: r } = await res.json();
      const expected = Object.fromEntries(TYPES.map((t) => [t, 1]));
      for (const { name } of r.double_damage_to) expected[name] = 2;
      for (const { name } of r.half_damage_to) expected[name] = 0.5;
      for (const { name } of r.no_damage_to) expected[name] = 0;
      for (const defending of TYPES) {
        if (typeMultiplier(attacking, defending) !== expected[defending]) {
          mismatches.push(`${attacking}->${defending}: ours ${typeMultiplier(attacking, defending)} api ${expected[defending]}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  }, 60000);
});
