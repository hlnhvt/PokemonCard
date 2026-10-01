// The 5 games that suit one Pokemon best: games made for its species first, then games
// matching its types (a Water Pokemon goes fishing, a Fire one shoots fireballs...), then
// favourites everyone likes. Games it can already play come before locked ones.
import { TYPE_VI } from './battle/typeChart';

export const SIGNATURE_COUNT = 5;
/** Always in the list (last): catching this very Pokemon only opens from its card. */
export const PINNED_GAMES = { catch: 'Bắt chính bạn ấy' };

/** Games made for one species (lower-case English name). */
export const SPECIES_GAMES = {
  snorlax: ['gulp3d', 'cooking', 'pizza3d'],
  munchlax: ['gulp3d', 'cooking', 'pizza3d'],
  charizard: ['sky3d', 'archery'],
  charmeleon: ['sky3d', 'archery'],
  dragonite: ['sky3d'],
  pidgeot: ['sky3d'],
  diglett: ['diglett', 'goldminer'],
  dugtrio: ['diglett', 'goldminer'],
  psyduck: ['psyduck', 'fishing'],
  golduck: ['psyduck', 'fishing'],
  ponyta: ['ponyta', 'racing'],
  rapidash: ['ponyta', 'racing'],
  jigglypuff: ['rhythm', 'music'],
  wigglytuff: ['rhythm', 'music', 'trampoline'],
  meowth: ['shop', 'goldminer'],
  persian: ['shop', 'goldminer'],
  magikarp: ['fishing'],
  gyarados: ['fishing'],
  voltorb: ['pinball3d'],
  electrode: ['pinball3d'],
  pikachu: ['obby3d', 'pinball3d'],
  eevee: ['obby3d', 'island3d'],
  bulbasaur: ['obby3d', 'island3d'],
  squirtle: ['obby3d', 'watergun'],
  charmander: ['obby3d', 'archery'],
  piplup: ['obby3d', 'fishing'],
  machop: ['hammer'],
  machamp: ['hammer'],
  gengar: ['ghosthouse'],
  haunter: ['ghosthouse'],
  gastly: ['ghosthouse'],
};

/** Games matching a type, best first. */
export const TYPE_GAMES = {
  fire: ['archery', 'pizza3d', 'cooking', 'battle', 'run3d'],
  water: ['fishing', 'watergun', 'psyduck', 'penalty', 'island3d'],
  grass: ['island3d', 'maze', 'spot', 'cooking', 'runner'],
  electric: ['rhythm', 'pinball3d', 'racing', 'redlight', 'run3d'],
  psychic: ['memory', 'cups', 'oddone', 'math', 'spot'],
  ice: ['skeeball', 'bowling', 'run3d', 'pairs', 'cups'],
  dragon: ['sky3d', 'moba', 'battle', 'archery', 'obby3d'],
  dark: ['ghosthouse', 'cups', 'memory', 'oddone', 'redlight'],
  fairy: ['candy', 'ferris', 'music', 'rhythm', 'island3d'],
  fighting: ['hammer', 'battle', 'penalty', 'basketball', 'obby3d'],
  poison: ['maze', 'ghosthouse', 'oddone', 'pairs', 'cans'],
  ground: ['diglett', 'goldminer', 'bowling', 'cans', 'gulp3d'],
  flying: ['sky3d', 'trampoline', 'ferris', 'darts', 'archery'],
  bug: ['catch', 'spot', 'maze', 'pairs', 'claw'],
  rock: ['goldminer', 'cans', 'bowling', 'hammer', 'weigh'],
  ghost: ['ghosthouse', 'coaster', 'cups', 'memory', 'spot'],
  steel: ['claw', 'pinball3d', 'racing', 'goldminer', 'cans'],
  normal: ['runner', 'run3d', 'cooking', 'shop', 'obby3d'],
};

/** Liked by everyone: fills the list when species and types are not enough. */
export const FAVOURITE_GAMES = ['run3d', 'obby3d', 'catch', 'runner', 'battle', 'pinball3d', 'gulp3d'];

const speciesKey = (pokemon) => String(pokemon?.speciesName || pokemon?.name || '').toLowerCase().split(/[\s-]/)[0];

/**
 * Pick the signature games of `pokemon` from `games` ([{ id, needRank?, ... }]).
 * Each returned game gets a `reason` such as "Hợp hệ Lửa" or "Dành riêng cho Snorlax".
 */
export function signatureGames(pokemon, games, { count = SIGNATURE_COUNT, rankLevel = Infinity } = {}) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const picked = [];
  const reasons = new Map();
  const pinned = Object.keys(PINNED_GAMES).filter((id) => byId.has(id));
  const add = (id, reason) => {
    if (!byId.has(id) || reasons.has(id) || pinned.includes(id)) return;
    reasons.set(id, reason);
    picked.push(id);
  };
  (SPECIES_GAMES[speciesKey(pokemon)] || []).forEach((id) => add(id, `Dành riêng cho ${pokemon.name}`));
  // Types take turns (the main type first) so a dual type gets games from both
  const types = (Array.isArray(pokemon?.types) ? pokemon.types : []).map((t) => String(t).toLowerCase()).filter((t) => TYPE_GAMES[t]);
  const longest = Math.max(0, ...types.map((t) => TYPE_GAMES[t].length));
  for (let i = 0; i < longest; i++) {
    types.forEach((t) => TYPE_GAMES[t][i] && add(TYPE_GAMES[t][i], `Hợp hệ ${TYPE_VI[t] || t}`));
  }
  FAVOURITE_GAMES.forEach((id) => add(id, 'Ai cũng mê'));
  games.forEach((g) => add(g.id, 'Ai cũng mê'));
  // Playable now first, keeping the order within each group
  const open = picked.filter((id) => !((byId.get(id).needRank || 1) > rankLevel));
  const locked = picked.filter((id) => (byId.get(id).needRank || 1) > rankLevel);
  pinned.forEach((id) => reasons.set(id, PINNED_GAMES[id]));
  const chosen = [...open, ...locked].slice(0, Math.max(0, count - pinned.length));
  return [...chosen, ...pinned].map((id) => ({ ...byId.get(id), reason: reasons.get(id) }));
}
