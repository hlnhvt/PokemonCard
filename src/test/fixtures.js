import speciesNames from './fixtures/speciesNames.json';

export { speciesNames };

export function makeCard(overrides = {}) {
  return {
    id: 'charizard',
    pokedexNumber: '006',
    name: 'Charizard',
    japaneseName: 'リザードン',
    species: 'Flame Pokémon',
    types: ['Fire', 'Flying'],
    hp: 234,
    baseHp: 78,
    attack: 84,
    defense: 78,
    speed: 100,
    rarity: 'Holo Rare Secret',
    cardSet: 'Base',
    cardNumber: '4/102',
    illustrator: 'Mitsuhiro Arita',
    themeColor: { primary: '#FF4422', secondary: '#FFAA00', accent: '#FF2200', glow: 'rgba(255, 68, 34, 0.6)' },
    image: 'https://example.test/charizard-card.png',
    fallbackImage: 'https://example.test/charizard-art.png',
    directVideoUrl: 'https://example.test/charizard.mp4',
    youtubeUrl: null,
    youtubeSearchUrl: 'https://www.youtube.com/results?search_query=charizard',
    videoShowcase: { title: 'CHARIZARD BATTLE AWAKENING', duration: 6, soundEffect: 'fire', description: 'Lore', canvasStyle: 'fire' },
    height: '1.7 m',
    weight: '90.5 kg',
    weakness: { type: 'Water', value: '×2' },
    resistance: { type: 'Colorless', value: '-30' },
    retreatCost: 3,
    ability: { name: 'Blaze', type: 'Ability', text: 'Ability text' },
    attacks: [{ name: 'Flamethrower', cost: ['Fire', 'Colorless'], damage: '168', description: 'Burns' }],
    lore: 'It spits fire that is hot enough to melt boulders.',
    isOnlineFetched: true,
    ...overrides,
  };
}

// Minimal PokeAPI /pokemon payload
export function makePokeApiPokemon(overrides = {}) {
  return {
    id: 6,
    name: 'charizard',
    height: 17,
    weight: 905,
    species: { name: 'charizard', url: 'https://pokeapi.co/api/v2/pokemon-species/6/' },
    types: [{ type: { name: 'fire' } }, { type: { name: 'flying' } }],
    stats: [
      { stat: { name: 'hp' }, base_stat: 78 },
      { stat: { name: 'attack' }, base_stat: 84 },
      { stat: { name: 'defense' }, base_stat: 78 },
      { stat: { name: 'speed' }, base_stat: 100 },
    ],
    moves: [{ move: { name: 'mega-punch' } }, { move: { name: 'fire-punch' } }],
    abilities: [{ ability: { name: 'solar-power' } }],
    sprites: {
      front_default: 'https://img.test/6.png',
      other: { 'official-artwork': { front_default: 'https://img.test/art/6.png' } },
    },
    ...overrides,
  };
}

export function makePokeApiSpecies(overrides = {}) {
  return {
    name: 'charizard',
    names: [
      { language: { name: 'ja-Hrkt' }, name: 'リザードン' },
      { language: { name: 'roomaji' }, name: 'Lizardon' },
      { language: { name: 'en' }, name: 'Charizard' },
    ],
    genera: [{ language: { name: 'en' }, genus: 'Flame Pokémon' }],
    flavor_text_entries: [{ language: { name: 'en' }, flavor_text: 'Spits fire\nthat is hot.' }],
    varieties: [{ is_default: true, pokemon: { name: 'charizard' } }],
    ...overrides,
  };
}

export function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
