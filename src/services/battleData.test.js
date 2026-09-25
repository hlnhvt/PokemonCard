import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBattlePokemon, resetBattleCache } from './battleData';

const API = 'https://pokeapi.co/api/v2';
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

const moveEntry = (name, level) => ({
  move: { name, url: `${API}/move/${name}/` },
  version_group_details: [{ move_learn_method: { name: 'level-up' }, level_learned_at: level }],
});
const moveData = (name, type, power, cls = 'special', extra = {}) => ({
  name, power, accuracy: 100, priority: 0, type: { name: type }, damage_class: { name: cls },
  names: [{ language: { name: 'en' }, name: name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') }], meta: {}, ...extra,
});

const PIKACHU = {
  id: 25, name: 'pikachu', types: [{ type: { name: 'electric' } }],
  stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((n, i) => ({ stat: { name: n }, base_stat: [35, 55, 40, 50, 50, 90][i] })),
  sprites: { other: { 'official-artwork': { front_default: 'art.png', front_shiny: 'shiny.png' } } },
  moves: [moveEntry('thunder-shock', 1), moveEntry('quick-attack', 1), moveEntry('growl', 1), moveEntry('spark', 20), moveEntry('thunderbolt', 36), moveEntry('iron-tail', 30)],
};
const MOVES = {
  'thunder-shock': moveData('thunder-shock', 'electric', 40),
  'quick-attack': moveData('quick-attack', 'normal', 40, 'physical', { priority: 1 }),
  growl: moveData('growl', 'normal', null, 'status'),
  spark: moveData('spark', 'electric', 65, 'physical'),
  thunderbolt: moveData('thunderbolt', 'electric', 90),
  'iron-tail': moveData('iron-tail', 'steel', 100, 'physical', { accuracy: 75 }),
};

function mockApi({ pokemonOk = true, movesOk = true } = {}) {
  const fn = vi.fn(async (url) => {
    if (url.endsWith('/pokemon/pikachu')) return pokemonOk ? json(PIKACHU) : json({}, 404);
    const m = /\/move\/([a-z-]+)\/$/.exec(url);
    if (m) {
      if (!movesOk) throw new TypeError('offline');
      return json(MOVES[m[1]]);
    }
    return json({}, 404);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  resetBattleCache();
  vi.unstubAllGlobals();
});

describe('fetchBattlePokemon', () => {
  it('BD-01 loads full stats and picks 4 real damaging moves', async () => {
    mockApi();
    const p = await fetchBattlePokemon('Pikachu');
    expect(p).toMatchObject({ name: 'Pikachu', id: 25, types: ['electric'], image: 'art.png', shinyImage: 'shiny.png' });
    expect(p.stats).toEqual({ hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 });
    expect(p.moves).toHaveLength(4);
    expect(p.moves.map((m) => m.name)).toEqual(expect.arrayContaining(['Thunderbolt', 'Iron Tail', 'Quick Attack']));
    expect(p.moves.some((m) => m.name === 'Growl')).toBe(false);
  });

  it('BD-02 caches in memory and in localStorage for offline rematches', async () => {
    const fn = mockApi();
    await fetchBattlePokemon('pikachu');
    const calls = fn.mock.calls.length;
    await fetchBattlePokemon('pikachu');
    expect(fn.mock.calls.length).toBe(calls);
    resetBattleCache();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect((await fetchBattlePokemon('pikachu')).moves).toHaveLength(4);
  });

  it('BD-03 falls back to the offline move set when moves cannot load', async () => {
    mockApi({ movesOk: false });
    const p = await fetchBattlePokemon('pikachu');
    expect(p.moves.map((m) => m.name)).toEqual(expect.arrayContaining(['Thunder Shock', 'Thunderbolt']));
  });

  it('BD-04 unknown Pokemon without cache is a friendly error', async () => {
    mockApi({ pokemonOk: false });
    await expect(fetchBattlePokemon('pikachu')).rejects.toThrow('Không tải được dữ liệu trận đấu');
    await expect(fetchBattlePokemon('')).rejects.toThrow('Không có Pokémon để đấu');
  });
});
