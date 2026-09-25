// Pokemon type effectiveness (generation 6+ chart), attacking type -> defending type.
// Verified against PokeAPI /type damage relations by tests/live/typeChart.live.test.js.

export const TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

// Only entries that differ from x1
const CHART = {
  normal: { rock: 0.5, steel: 0.5, ghost: 0 },
  fire: { grass: 2, ice: 2, bug: 2, steel: 2, fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5 },
  water: { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0 },
  grass: { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5 },
  ice: { grass: 2, ground: 2, flying: 2, dragon: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
  poison: { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
  flying: { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
  bug: { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost: { psychic: 2, ghost: 2, dark: 0.5, normal: 0 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel: { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy: { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 },
};

export const TYPE_VI = {
  normal: 'Thường', fire: 'Lửa', water: 'Nước', electric: 'Điện', grass: 'Cỏ', ice: 'Băng',
  fighting: 'Giác Đấu', poison: 'Độc', ground: 'Đất', flying: 'Bay', psychic: 'Siêu Linh',
  bug: 'Côn Trùng', rock: 'Đá', ghost: 'Ma', dragon: 'Rồng', dark: 'Bóng Tối', steel: 'Thép', fairy: 'Tiên',
};

// Button / effect colours per type
export const TYPE_COLORS = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030', grass: '#78c850', ice: '#98d8d8',
  fighting: '#c03028', poison: '#a040a0', ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848', steel: '#b8b8d0', fairy: '#ee99ac',
};

const normalise = (t) => String(t || '').toLowerCase();

/** Multiplier of one attacking type against one defending type. */
export function typeMultiplier(attacking, defending) {
  const row = CHART[normalise(attacking)];
  if (!row) return 1;
  const value = row[normalise(defending)];
  return value === undefined ? 1 : value;
}

/** Multiplier against a Pokemon with one or two types (products, e.g. x4 or x0.25). */
export function effectiveness(attacking, defendingTypes) {
  return (defendingTypes || []).reduce((m, t) => m * typeMultiplier(attacking, t), 1);
}

/** Child-friendly label for a multiplier. */
export function effectivenessLabel(multiplier) {
  if (multiplier === 0) return 'Không có tác dụng...';
  if (multiplier >= 2) return 'Siêu hiệu quả!';
  if (multiplier < 1) return 'Không hiệu quả lắm...';
  return null;
}
