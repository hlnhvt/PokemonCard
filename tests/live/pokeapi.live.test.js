import { describe, it, expect, vi } from 'vitest';
import { fetchPokemonOnline, getAllPokemonNames } from '../../src/services/pokemonOnlineService';

vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('SV-16 live PokeAPI', () => {
  it.each([
    ['Mr. Mime', 'mr-mime', 'Mr. Mime'],
    ['Ho-Oh', 'ho-oh', 'Ho-Oh'],
    ['giratina', 'giratina-altered', 'Giratina'],
    ['25', 'pikachu', 'Pikachu'],
    ['porygon z', 'porygon-z', 'Porygon-Z'],
    ['Farfetch\'d', 'farfetchd', null],
    ['Nidoran♀', 'nidoran-f', null],
  ])('%s resolves to %s', async (query, id, name) => {
    const card = await fetchPokemonOnline(query);
    expect(card.id).toBe(id);
    if (name) expect(card.name).toBe(name);
    expect(card.types.length).toBeGreaterThan(0);
    expect(card.fallbackImage).toMatch(/^https:/);
  });

  it('unknown names are rejected', async () => {
    await expect(fetchPokemonOnline('definitelynotapokemon')).rejects.toThrow('Không tìm thấy');
  });

  it('name list has 1025 species base names', async () => {
    const names = await getAllPokemonNames();
    expect(names).toHaveLength(1025);
    expect(names).toContain('giratina');
  });
});
