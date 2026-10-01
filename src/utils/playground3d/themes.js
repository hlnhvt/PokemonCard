// Type → 3D look of the playground: which diorama (floating island), sky colours and the
// aura particles shown around the Pokémon. Pure data, shared by the scene and the tests.

/** TCG energy names and game type names → one lower-case game type. */
const TYPE_ALIASES = {
  lightning: 'electric',
  darkness: 'dark',
  metal: 'steel',
  colorless: 'normal',
};

export const GAME_TYPES = [
  'normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

export function normalizeType(type) {
  const t = String(type || '').trim().toLowerCase();
  const n = TYPE_ALIASES[t] || t;
  return GAME_TYPES.includes(n) ? n : 'normal';
}

export const mainType = (pokemon) => normalizeType(Array.isArray(pokemon?.types) ? pokemon.types[0] : pokemon?.types);

/** Aura per type: particle behaviour + colours (hex). */
export const AURAS = {
  fire: { kind: 'embers', colors: ['#ffb347', '#ff6a2b', '#ffe08a'], label: 'than hồng' },
  water: { kind: 'bubbles', colors: ['#bfe8ff', '#6cc4ff', '#ffffff'], label: 'bong bóng nước' },
  grass: { kind: 'leaves', colors: ['#7ed957', '#3fae4a', '#c8f07a'], label: 'lá xoay' },
  electric: { kind: 'sparks', colors: ['#fff27a', '#ffd23a', '#ffffff'], label: 'tia điện' },
  ice: { kind: 'snow', colors: ['#ffffff', '#cdf3ff', '#9fe3ff'], label: 'bông tuyết' },
  psychic: { kind: 'rings', colors: ['#ff8ad8', '#c77dff', '#ffd1f2'], label: 'vòng sáng' },
  ghost: { kind: 'wisps', colors: ['#b48cff', '#7c5cff', '#e2d4ff'], label: 'đốm ma trơi' },
  fairy: { kind: 'sparkles', colors: ['#ffc2e6', '#fff0a8', '#ffffff'], label: 'lấp lánh' },
  rock: { kind: 'dust', colors: ['#d9b98a', '#a9865a', '#efdcb8'], label: 'bụi đá' },
  ground: { kind: 'dust', colors: ['#e2c27a', '#b98d4e', '#f3e1b0'], label: 'bụi đất' },
  dragon: { kind: 'wind', colors: ['#a99bff', '#7ad7ff', '#ffffff'], label: 'gió rồng' },
  flying: { kind: 'wind', colors: ['#ffffff', '#cfe8ff', '#a8d8ff'], label: 'gió' },
  poison: { kind: 'poison', colors: ['#c77dff', '#9d4edd', '#e0aaff'], label: 'bong bóng độc' },
  steel: { kind: 'glints', colors: ['#ffffff', '#d7e3f0', '#a8b8cc'], label: 'ánh kim' },
  dark: { kind: 'shadows', colors: ['#5b4b8a', '#2e2648', '#3d3166'], label: 'bóng tối' },
  bug: { kind: 'fireflies', colors: ['#e9ff70', '#b8f25a', '#fff9c4'], label: 'đom đóm' },
  fighting: { kind: 'impact', colors: ['#ffb08a', '#ff7043', '#fff1d6'], label: 'vòng va chạm' },
  normal: { kind: 'confetti', colors: ['#ff8fab', '#ffd166', '#06d6a0', '#4cc9f0'], label: 'hoa giấy' },
};

/**
 * Dioramas. top/side: island colours, sky: [zenith, horizon], deco: [{ kind, count }],
 * water: a ring of animated water around the island, glow: emissive cracks/pools colour.
 */
export const DIORAMAS = {
  meadow: {
    name: 'Đồng cỏ hoa',
    top: '#7ccf5a', top2: '#a5e07a', side: '#9a6b43', side2: '#6e4a2e',
    sky: ['#5fb4ff', '#d8f1ff'], fog: '#cfeaff', sun: '#fff4d6', hemi: ['#e6f6ff', '#6f8f4a'],
    deco: [{ kind: 'flower', count: 18 }, { kind: 'tree', count: 3 }, { kind: 'rock', count: 3 }],
  },
  beach: {
    name: 'Bãi biển',
    top: '#f3dc9c', top2: '#fbe9b9', side: '#c79a5c', side2: '#8a643a',
    sky: ['#3f9cff', '#c9f1ff'], fog: '#bfe8ff', sun: '#fff6e0', hemi: ['#e0f4ff', '#c9a66b'],
    water: '#3fb6ff',
    deco: [{ kind: 'palm', count: 2 }, { kind: 'shell', count: 6 }, { kind: 'rock', count: 3 }],
  },
  volcano: {
    name: 'Núi lửa',
    top: '#5b4743', top2: '#6f5752', side: '#3d2c2a', side2: '#241817',
    sky: ['#3a1f4a', '#ff9a5a'], fog: '#c0604a', sun: '#ffd0a0', hemi: ['#ffb38a', '#3a2020'],
    glow: '#ff5a1f',
    deco: [{ kind: 'spire', count: 5 }, { kind: 'rock', count: 5 }, { kind: 'lavapool', count: 1 }],
  },
  ice: {
    name: 'Cánh đồng băng',
    top: '#eaf8ff', top2: '#cdeeff', side: '#8fc6e6', side2: '#5a93bf',
    sky: ['#7fb8ff', '#f0fbff'], fog: '#e6f6ff', sun: '#ffffff', hemi: ['#ffffff', '#8fb8d8'],
    deco: [{ kind: 'crystal', count: 7 }, { kind: 'snowball', count: 4 }, { kind: 'pine', count: 3 }],
  },
  night: {
    name: 'Vườn đêm',
    top: '#4b3f7a', top2: '#5d4f94', side: '#3a2e55', side2: '#221a35',
    sky: ['#0c0a2a', '#4a3a8a'], fog: '#3a3170', sun: '#c9c0ff', hemi: ['#9f8cff', '#241c40'],
    glow: '#b48cff', moon: true,
    deco: [{ kind: 'mushroom', count: 7 }, { kind: 'lantern', count: 3 }, { kind: 'rock', count: 3 }],
  },
  crystal: {
    name: 'Hang pha lê',
    top: '#8b6fb8', top2: '#a387cf', side: '#5c4680', side2: '#3a2b55',
    sky: ['#2b1f5c', '#ff9ad8'], fog: '#b98ad8', sun: '#ffe0ff', hemi: ['#ffc8f0', '#3a2b55'],
    glow: '#ff8ad8',
    deco: [{ kind: 'crystal', count: 9 }, { kind: 'rock', count: 4 }, { kind: 'flower', count: 6 }],
  },
  canyon: {
    name: 'Hẻm núi',
    top: '#d9a866', top2: '#e8bf80', side: '#b5743f', side2: '#7a4a28',
    sky: ['#ff9f5a', '#ffe7b8'], fog: '#ffd9a8', sun: '#fff0d0', hemi: ['#ffe8c8', '#8a5a30'],
    deco: [{ kind: 'boulder', count: 5 }, { kind: 'cactus', count: 3 }, { kind: 'pebble', count: 10 }],
  },
  clouds: {
    name: 'Đảo mây',
    top: '#ffffff', top2: '#eaf4ff', side: '#d8e8ff', side2: '#b8cff0',
    sky: ['#4a8cff', '#ffe0f0'], fog: '#f0f4ff', sun: '#ffffff', hemi: ['#ffffff', '#b8c8f0'],
    cloudIsland: true,
    deco: [{ kind: 'cloud', count: 8 }, { kind: 'pillar', count: 3 }, { kind: 'flower', count: 6 }],
  },
  power: {
    name: 'Đồng cỏ sấm',
    top: '#b9d65a', top2: '#d7e87a', side: '#8a6a3a', side2: '#5e4524',
    sky: ['#3d5bd9', '#ffe58a'], fog: '#f5f0c0', sun: '#fff7c0', hemi: ['#fff7d6', '#7a7a3a'],
    glow: '#ffe14d',
    deco: [{ kind: 'bolt', count: 4 }, { kind: 'flower', count: 12 }, { kind: 'rock', count: 3 }],
  },
  dojo: {
    name: 'Võ đài',
    top: '#d8a868', top2: '#e8c088', side: '#8a5a34', side2: '#5a3a20',
    sky: ['#ff7a59', '#ffe2b0'], fog: '#ffd8b0', sun: '#fff0d8', hemi: ['#ffe8d0', '#7a4a2a'],
    deco: [{ kind: 'post', count: 4 }, { kind: 'rock', count: 3 }, { kind: 'flower', count: 6 }],
  },
  steel: {
    name: 'Xưởng thép',
    top: '#b8c4d0', top2: '#cfd8e2', side: '#7a8896', side2: '#4e5a66',
    sky: ['#4a6a9a', '#e0ecf8'], fog: '#d8e4f0', sun: '#ffffff', hemi: ['#f0f6ff', '#5a6676'],
    deco: [{ kind: 'gear', count: 3 }, { kind: 'crystal', count: 4 }, { kind: 'rock', count: 3 }],
  },
};

/** Main type → diorama. */
const TYPE_DIORAMA = {
  normal: 'meadow',
  grass: 'meadow',
  bug: 'meadow',
  fairy: 'clouds',
  water: 'beach',
  fire: 'volcano',
  ice: 'ice',
  ghost: 'night',
  dark: 'night',
  poison: 'night',
  psychic: 'crystal',
  rock: 'canyon',
  ground: 'canyon',
  flying: 'clouds',
  dragon: 'clouds',
  electric: 'power',
  fighting: 'dojo',
  steel: 'steel',
};

export function themeFor(pokemon) {
  const type = mainType(pokemon);
  const dioramaId = TYPE_DIORAMA[type] || 'meadow';
  return { type, dioramaId, diorama: DIORAMAS[dioramaId], aura: AURAS[type] || AURAS.normal };
}
