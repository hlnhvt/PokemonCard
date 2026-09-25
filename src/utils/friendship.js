// Pokemon care rules: friendship grows when a child feeds (berries from the runner game)
// or pets their Pokemon. Pure functions; persistence lives in storage.js / berries.js.

export const MAX_FRIENDSHIP = 100;
export const FEED_GAIN = 10;
// Every Pokemon has one favourite berry worth double, for children to discover
export const FAVORITE_MULTIPLIER = 2;
export const DAILY_FEED_LIMIT = 5;
export const PET_GAIN = 1;
export const DAILY_PET_LIMIT = 10;
// Friendship needed for evolutions that require a strong bond (Pichu, Eevee -> Espeon...)
export const FRIENDSHIP_TO_EVOLVE = 80;

export const BERRIES = {
  oran: { name: 'Oran', color: 'bg-blue-500', ring: 'ring-blue-300' },
  razz: { name: 'Razz', color: 'bg-pink-500', ring: 'ring-pink-300' },
};
export const BERRY_TYPES = Object.keys(BERRIES);

export const LEVELS = [
  { min: 0, label: 'Mới quen', hearts: 0 },
  { min: 20, label: 'Bạn bè', hearts: 1 },
  { min: 50, label: 'Bạn thân', hearts: 2 },
  { min: 80, label: 'Tri kỷ', hearts: 3 },
  { min: 100, label: 'Bạn thân nhất', hearts: 4 },
];

export function levelFor(friendship = 0) {
  const value = Math.max(0, Math.min(MAX_FRIENDSHIP, Number(friendship) || 0));
  let level = LEVELS[0];
  for (const l of LEVELS) if (value >= l.min) level = l;
  return level;
}

/** Progress (0..1) from the current level to the next one. */
export function levelProgress(friendship = 0) {
  const value = Math.max(0, Math.min(MAX_FRIENDSHIP, Number(friendship) || 0));
  const index = LEVELS.findIndex((l) => l === levelFor(value));
  const next = LEVELS[index + 1];
  if (!next) return 1;
  return (value - LEVELS[index].min) / (next.min - LEVELS[index].min);
}

/** Stable per species: the favourite berry depends on the Pokedex number. */
export function favoriteBerry(card) {
  const n = Number(card?.pokedexNumber) || 0;
  return BERRY_TYPES[n % BERRY_TYPES.length];
}

export function dayKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function countToday(entry, today) {
  return entry && entry.day === today ? entry.count : 0;
}

export function fedToday(card, now = new Date()) {
  return countToday(card?.fed, dayKey(now));
}

/**
 * Feed one berry. Returns { card, result, gain, favorite, levelUp }:
 * result 'fed' | 'full' (daily limit reached) | 'max' (friendship already 100).
 * The input card is not modified.
 */
export function applyFeed(card, berry, now = new Date()) {
  const today = dayKey(now);
  const friendship = Number(card.friendship) || 0;
  const eaten = countToday(card.fed, today);
  if (friendship >= MAX_FRIENDSHIP) return { card, result: 'max', gain: 0, favorite: false, levelUp: null };
  if (eaten >= DAILY_FEED_LIMIT) return { card, result: 'full', gain: 0, favorite: false, levelUp: null };

  const favorite = favoriteBerry(card) === berry;
  const gain = Math.min(MAX_FRIENDSHIP - friendship, FEED_GAIN * (favorite ? FAVORITE_MULTIPLIER : 1));
  const next = friendship + gain;
  const before = levelFor(friendship);
  const after = levelFor(next);
  return {
    // Once the favourite berry has been tried, the child gets to see which one it is
    card: { ...card, friendship: next, fed: { day: today, count: eaten + 1 }, ...(favorite ? { favoriteFound: true } : {}) },
    result: 'fed',
    gain,
    favorite,
    levelUp: after !== before ? after : null,
  };
}

/** Petting adds a little friendship, up to a daily limit. */
export function applyPet(card, now = new Date()) {
  const today = dayKey(now);
  const friendship = Number(card.friendship) || 0;
  const petted = countToday(card.petted, today);
  if (petted >= DAILY_PET_LIMIT || friendship >= MAX_FRIENDSHIP) return { card, gain: 0, levelUp: null };
  const next = Math.min(MAX_FRIENDSHIP, friendship + PET_GAIN);
  const before = levelFor(friendship);
  const after = levelFor(next);
  return {
    card: { ...card, friendship: next, petted: { day: today, count: petted + 1 } },
    gain: next - friendship,
    levelUp: after !== before ? after : null,
  };
}
