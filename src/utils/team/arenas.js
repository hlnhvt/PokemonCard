// Battle grounds for the 5 vs 5 team battle. Each one powers up some move types by
// ARENA_BOOST (for both teams), so choosing the ground is part of the plan.

export const ARENA_BOOST = 1.2;

export const ARENAS = [
  {
    id: 'stadium',
    name: 'Sân vận động Pokémon',
    emoji: '🏟️',
    boost: ['fighting', 'normal'],
    ambient: 'flashes',
    sky: 'from-indigo-950 via-blue-900 to-sky-800',
    ground: 'from-emerald-500 to-green-700',
    platform: '#f8fafc',
  },
  {
    id: 'meadow',
    name: 'Đồng cỏ xanh',
    emoji: '🌿',
    boost: ['grass', 'bug', 'normal'],
    ambient: 'leaves',
    sky: 'from-sky-300 via-sky-200 to-lime-200',
    ground: 'from-lime-400 to-green-600',
    platform: '#16a34a',
  },
  {
    id: 'volcano',
    name: 'Núi lửa rực cháy',
    emoji: '🌋',
    boost: ['fire', 'ground', 'rock'],
    ambient: 'embers',
    sky: 'from-stone-900 via-red-900 to-orange-700',
    ground: 'from-stone-700 to-stone-900',
    platform: '#7c2d12',
  },
  {
    id: 'ocean',
    name: 'Bãi biển nắng',
    emoji: '🏖️',
    boost: ['water', 'flying'],
    ambient: 'bubbles',
    sky: 'from-cyan-300 via-sky-300 to-blue-500',
    ground: 'from-amber-200 to-amber-400',
    platform: '#0284c7',
  },
  {
    id: 'snow',
    name: 'Núi băng tuyết',
    emoji: '🏔️',
    boost: ['ice', 'fairy'],
    ambient: 'snow',
    sky: 'from-slate-300 via-sky-100 to-white',
    ground: 'from-sky-100 to-slate-300',
    platform: '#7dd3fc',
  },
  {
    id: 'city',
    name: 'Thành phố đêm',
    emoji: '🌃',
    boost: ['electric', 'steel', 'dark'],
    ambient: 'neon',
    sky: 'from-indigo-950 via-purple-900 to-fuchsia-800',
    ground: 'from-slate-700 to-slate-950',
    platform: '#a21caf',
  },
  {
    id: 'space',
    name: 'Vũ trụ huyền bí',
    emoji: '🪐',
    boost: ['psychic', 'dragon', 'ghost'],
    ambient: 'stars',
    sky: 'from-slate-950 via-indigo-950 to-violet-900',
    ground: 'from-violet-900 to-slate-950',
    platform: '#6d28d9',
  },
];

export const arenaById = (id) => ARENAS.find((a) => a.id === id) || ARENAS[0];

/** Moves of the arena's types hit harder there (marked `boosted` for the move buttons). */
export function applyArena(data, arena) {
  if (!arena) return data;
  return {
    ...data,
    moves: data.moves.map((m) => (arena.boost.includes(m.type) ? { ...m, power: Math.round(m.power * ARENA_BOOST), boosted: true } : m)),
  };
}
