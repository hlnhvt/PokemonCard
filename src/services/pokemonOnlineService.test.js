import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizePokemonQuery,
  fetchPokemonOnline,
  getAllPokemonNames,
  findBestPokemonNameFromText,
  resetPokemonNamesCache,
  getCardMedia,
  artworkUrl,
  describeEvolution,
  parseEvolutionChain,
  fetchEvolutionChain,
  resetEvolutionCache,
} from './pokemonOnlineService';
import {
  speciesNames,
  makePokeApiPokemon,
  makePokeApiSpecies,
  jsonResponse,
} from '../test/fixtures';

// Route fetch calls by URL; unknown URLs return 404
function mockFetch(routes) {
  const fn = vi.fn(async (url, init) => {
    for (const [pattern, handler] of routes) {
      if (typeof pattern === 'string' ? url === pattern : pattern.test(url)) {
        return typeof handler === 'function' ? handler(url, init) : handler;
      }
    }
    return jsonResponse({}, 404);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const API = 'https://pokeapi.co/api/v2';
const namesResponse = jsonResponse({ results: speciesNames.map((name) => ({ name })) });

beforeEach(() => {
  resetPokemonNamesCache();
  vi.unstubAllGlobals();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('normalizePokemonQuery (SV-01)', () => {
  it.each([
    ['Pikachu ', 'pikachu'],
    ['MR. MIME', 'mr-mime'],
    ['Ho-Oh', 'ho-oh'],
    ['porygon z', 'porygon-z'],
    ["Farfetch'd", 'farfetchd'],
    ['Nidoran♀', 'nidoran-f'],
    ['Nidoran ♂', 'nidoran-m'],
    ['Flabébé', 'flabebe'],
    ['25', '25'],
    ['  --tapu__koko--  ', 'tapu-koko'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePokemonQuery(input)).toBe(expected);
  });
});

describe('fetchPokemonOnline', () => {
  it.each(['', '   ', '!!!', null, undefined])('SV-02 rejects empty query %p without network', async (q) => {
    const fetchFn = mockFetch([]);
    await expect(fetchPokemonOnline(q)).rejects.toThrow('Vui lòng nhập tên Pokémon');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('SV-03 builds a complete card object', async () => {
    mockFetch([
      [`${API}/pokemon/charizard`, jsonResponse(makePokeApiPokemon())],
      ['https://pokeapi.co/api/v2/pokemon-species/6/', jsonResponse(makePokeApiSpecies())],
      [/pokemontcg/, jsonResponse({ data: [{ images: { large: 'https://tcg.test/4.png' }, set: { name: 'Base', printedTotal: 102 }, number: '4', artist: 'Mitsuhiro Arita' }] })],
    ]);
    const card = await fetchPokemonOnline('Charizard');
    expect(card).toMatchObject({
      id: 'charizard',
      name: 'Charizard',
      pokedexNumber: '006',
      types: ['Fire', 'Flying'],
      hp: 234,
      image: 'https://tcg.test/4.png',
      fallbackImage: 'https://img.test/art/6.png',
      cardSet: 'Base',
      cardNumber: '4/102',
      illustrator: 'Mitsuhiro Arita',
      weakness: { type: 'Water', value: '×2' },
      species: 'Flame Pokémon',
      lore: 'Spits fire that is hot.',
    });
    expect(card.themeColor.primary).toBe('#FF4422');
    expect(card.attacks).toHaveLength(2);
    expect(card.retreatCost).toBeGreaterThanOrEqual(1);
  });

  it('SV-04 falls back to the default variety of a species', async () => {
    const fetchFn = mockFetch([
      [`${API}/pokemon/giratina`, jsonResponse({}, 404)],
      [`${API}/pokemon-species/giratina`, jsonResponse(makePokeApiSpecies({
        name: 'giratina',
        names: [{ language: { name: 'en' }, name: 'Giratina' }],
        varieties: [
          { is_default: true, pokemon: { name: 'giratina-altered' } },
          { is_default: false, pokemon: { name: 'giratina-origin' } },
        ],
      }))],
      [`${API}/pokemon/giratina-altered`, jsonResponse(makePokeApiPokemon({
        id: 487, name: 'giratina-altered', species: { name: 'giratina', url: `${API}/pokemon-species/487/` },
        types: [{ type: { name: 'ghost' } }, { type: { name: 'dragon' } }],
      }))],
    ]);
    const card = await fetchPokemonOnline('Giratina');
    expect(card.id).toBe('giratina-altered');
    expect(card.name).toBe('Giratina');
    expect(card.types).toEqual(['Ghost', 'Dragon']);
    // species already known: no second species request
    expect(fetchFn.mock.calls.filter(([u]) => u.includes('pokemon-species'))).toHaveLength(1);
  });

  it('SV-05 throws a not-found error when nothing matches', async () => {
    mockFetch([]);
    await expect(fetchPokemonOnline('notapokemon')).rejects.toThrow('Không tìm thấy dữ liệu online cho Pokémon "notapokemon"');
  });

  it('SV-05b reports network failures distinctly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(fetchPokemonOnline('pikachu')).rejects.toThrow('Không thể kết nối tới PokeAPI');
  });

  it('SV-06 / SV-07 survives species and TCG failures', async () => {
    mockFetch([
      [`${API}/pokemon/charizard`, jsonResponse(makePokeApiPokemon())],
      [/pokemon-species/, () => { throw new TypeError('network'); }],
      [/pokemontcg/, jsonResponse({}, 500)],
    ]);
    const card = await fetchPokemonOnline('charizard');
    expect(card.image).toBe('https://img.test/art/6.png');
    expect(card.species).toBe('Pokémon');
    expect(card.lore).toContain('charizard');
  });

  it('SV-07b aborts a hanging TCG request instead of waiting forever', async () => {
    vi.useFakeTimers();
    try {
      mockFetch([
        [`${API}/pokemon/charizard`, jsonResponse(makePokeApiPokemon())],
        ['https://pokeapi.co/api/v2/pokemon-species/6/', jsonResponse(makePokeApiSpecies())],
        [/pokemontcg/, (_url, init) => new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })],
      ]);
      const promise = fetchPokemonOnline('charizard');
      await vi.advanceTimersByTimeAsync(7000);
      const card = await promise;
      expect(card.image).toBe('https://img.test/art/6.png');
    } finally {
      vi.useRealTimers();
    }
  });

  it('SV-08 prefers Japanese script over romaji', async () => {
    mockFetch([
      [`${API}/pokemon/charizard`, jsonResponse(makePokeApiPokemon())],
      ['https://pokeapi.co/api/v2/pokemon-species/6/', jsonResponse(makePokeApiSpecies({
        names: [
          { language: { name: 'roomaji' }, name: 'Lizardon' },
          { language: { name: 'ja' }, name: 'リザードン' },
        ],
      }))],
    ]);
    expect((await fetchPokemonOnline('charizard')).japaneseName).toBe('リザードン');
  });

  it('SV-09 uses the species URL for alternate forms', async () => {
    const fetchFn = mockFetch([
      [`${API}/pokemon/charizard-mega-x`, jsonResponse(makePokeApiPokemon({
        id: 10034, name: 'charizard-mega-x',
      }))],
      ['https://pokeapi.co/api/v2/pokemon-species/6/', jsonResponse(makePokeApiSpecies())],
    ]);
    const card = await fetchPokemonOnline('charizard mega x');
    expect(card.id).toBe('charizard-mega-x');
    expect(fetchFn.mock.calls.some(([u]) => u.includes('pokemon-species/10034'))).toBe(false);
  });

  it('SV-10 keys media by real name when queried by number', async () => {
    mockFetch([
      [`${API}/pokemon/25`, jsonResponse(makePokeApiPokemon({
        id: 25, name: 'pikachu', species: { name: 'pikachu', url: `${API}/pokemon-species/25/` },
        types: [{ type: { name: 'electric' } }],
      }))],
      [`${API}/pokemon-species/25/`, jsonResponse(makePokeApiSpecies({
        name: 'pikachu', names: [{ language: { name: 'en' }, name: 'Pikachu' }],
      }))],
    ]);
    const card = await fetchPokemonOnline('25');
    expect(card.name).toBe('Pikachu');
    expect(card.youtubeUrl).toContain('youtube.com/embed');
    expect(card.directVideoUrl).toContain('ForBiggerBlazes');
    expect(card.youtubeSearchUrl).toContain('Pikachu');
  });

  it('SV-11 copes with missing artwork', async () => {
    mockFetch([
      [`${API}/pokemon/charizard`, jsonResponse(makePokeApiPokemon({ sprites: { front_default: 'https://img.test/front.png', other: {} } }))],
    ]);
    const card = await fetchPokemonOnline('charizard');
    expect(card.image).toBe('https://img.test/front.png');
    expect(card.fallbackImage).toBe('https://img.test/front.png');

    mockFetch([[`${API}/pokemon/charizard`, jsonResponse(makePokeApiPokemon({ sprites: {} }))]]);
    const bare = await fetchPokemonOnline('charizard');
    expect(bare.image).toBeNull();
  });
});

describe('getAllPokemonNames', () => {
  it('SV-12 does not cache the fallback list', async () => {
    const failing = mockFetch([[/pokemon-species\?limit/, jsonResponse({}, 503)]]);
    const fallback = await getAllPokemonNames();
    expect(fallback).toContain('pikachu');
    expect(failing).toHaveBeenCalledTimes(1);

    const ok = mockFetch([[/pokemon-species\?limit/, namesResponse]]);
    const names = await getAllPokemonNames();
    expect(ok).toHaveBeenCalledTimes(1);
    expect(names).toHaveLength(1025);
  });

  it('SV-13 uses species base names and caches them', async () => {
    const fetchFn = mockFetch([[/pokemon-species\?limit=1025/, namesResponse]]);
    const names = await getAllPokemonNames();
    expect(names).toContain('giratina');
    expect(names).toContain('ho-oh');
    expect(names).not.toContain('giratina-altered');
    await getAllPokemonNames();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('findBestPokemonNameFromText (file name hints)', () => {
  beforeEach(() => {
    mockFetch([[/pokemon-species\?limit/, namesResponse]]);
  });

  it.each([
    ['pikachu_card', 'pikachu'],
    ['Charizard-VMAX', 'charizard'],
    ['PikachuVMAX', 'pikachu'],
    ['my ho oh card', 'ho-oh'],
    ['mew', 'mew'],
    ['charizrd scan', 'charizard'],
  ])('SV-14 %s -> %s', async (text, expected) => {
    expect(await findBestPokemonNameFromText(text)).toBe(expected);
  });

  it.each([
    'anh the bai', 'hinh', 'cat', 'pic_01', 'mon', 'the best', 'IMG_20240101_123456',
    'photo', 'image', 'Screenshot 2024-05-01', 'download', 'zalo_image', 'received_12345',
    'facebook', 'test', 'new', 'card', 'scan', '',
  ])('SV-15 %p gives no hint', async (text) => {
    expect(await findBestPokemonNameFromText(text)).toBeNull();
  });
});

describe('activity data', () => {
  it('SV-17 exposes cries, shiny art, animated sprite and catch data', async () => {
    mockFetch([
      [`${API}/pokemon/charizard`, jsonResponse(makePokeApiPokemon({
        cries: { latest: 'https://c.test/6.ogg', legacy: 'https://c.test/6-old.ogg' },
        sprites: {
          front_default: 'https://img.test/6.png',
          other: {
            'official-artwork': { front_default: 'https://img.test/art/6.png', front_shiny: 'https://img.test/art/shiny/6.png' },
            showdown: { front_default: 'https://img.test/6.gif' },
          },
        },
      }))],
      ['https://pokeapi.co/api/v2/pokemon-species/6/', jsonResponse(makePokeApiSpecies({ capture_rate: 45, is_legendary: false }))],
    ]);
    const card = await fetchPokemonOnline('charizard');
    expect(card).toMatchObject({
      speciesName: 'charizard',
      cryUrl: 'https://c.test/6.ogg',
      cryLegacyUrl: 'https://c.test/6-old.ogg',
      shinyImage: 'https://img.test/art/shiny/6.png',
      animatedSprite: 'https://img.test/6.gif',
      captureRate: 45,
      isLegendary: false,
    });
  });

  it('SV-18 getCardMedia derives URLs for cards saved before these fields existed', () => {
    const media = getCardMedia({ pokedexNumber: '025' });
    expect(media.cryUrl).toBe('https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg');
    expect(media.shinyImage).toBe(artworkUrl(25, true));
    expect(getCardMedia({}).cryUrl).toBeNull();
    expect(getCardMedia({ cryUrl: 'x', pokedexNumber: '1' }).cryUrl).toBe('x');
  });

  it.each([
    [[{ trigger: { name: 'level-up' }, min_level: 16 }], 'Đạt cấp 16'],
    [[{ trigger: { name: 'use-item' }, item: { name: 'thunder-stone' } }], 'Dùng Đá Sấm'],
    [[{ trigger: { name: 'trade' } }], 'Trao đổi với bạn'],
    [[{ trigger: { name: 'level-up' }, min_happiness: 160, time_of_day: 'night' }], 'Rất thân thiết (ban đêm)'],
    [[{ trigger: { name: 'level-up' }, min_affection: 2, known_move_type: { name: 'fairy' } }], 'Rất yêu quý và biết chiêu hệ Tiên'],
    [[{ trigger: { name: 'level-up' }, location: { name: 'x' } }, { trigger: { name: 'use-item' }, item: { name: 'leaf-stone' } }], 'Dùng Đá Lá'],
    [[{ trigger: { name: 'other' } }], 'Điều kiện đặc biệt'],
    [undefined, 'Điều kiện đặc biệt'],
  ])('SV-19 describeEvolution %#', (details, expected) => {
    expect(describeEvolution(details)).toBe(expected);
  });

  const EEVEE_CHAIN = {
    chain: {
      species: { name: 'eevee', url: `${API}/pokemon-species/133/` },
      evolves_to: [
        { species: { name: 'vaporeon', url: `${API}/pokemon-species/134/` }, evolution_details: [{ trigger: { name: 'use-item' }, item: { name: 'water-stone' } }], evolves_to: [] },
        { species: { name: 'umbreon', url: `${API}/pokemon-species/197/` }, evolution_details: [{ trigger: { name: 'level-up' }, min_happiness: 160, time_of_day: 'night' }], evolves_to: [] },
      ],
    },
  };

  it('SV-20 parses branching chains into staged nodes', () => {
    const nodes = parseEvolutionChain(EEVEE_CHAIN.chain);
    expect(nodes.map((n) => [n.name, n.stage, n.from])).toEqual([
      ['eevee', 0, null],
      ['vaporeon', 1, 'eevee'],
      ['umbreon', 1, 'eevee'],
    ]);
    expect(nodes[1]).toMatchObject({ id: 134, image: artworkUrl(134), how: 'Dùng Đá Nước' });
  });

  it('SV-21 fetchEvolutionChain loads, caches and tolerates failures', async () => {
    resetEvolutionCache();
    const fetchFn = mockFetch([
      [`${API}/pokemon-species/eevee`, jsonResponse({ evolution_chain: { url: `${API}/evolution-chain/67/` } })],
      [`${API}/evolution-chain/67/`, jsonResponse(EEVEE_CHAIN)],
    ]);
    expect((await fetchEvolutionChain('Eevee')).map((n) => n.name)).toEqual(['eevee', 'vaporeon', 'umbreon']);
    await fetchEvolutionChain('eevee');
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(await fetchEvolutionChain('unknownmon')).toEqual([]);
    expect(await fetchEvolutionChain('')).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await fetchEvolutionChain('pikachu')).toEqual([]);
  });
});