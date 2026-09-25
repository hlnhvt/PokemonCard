// Choosing a Pokemon's 4 battle moves from PokeAPI data, with an offline fallback set.

// Used when move data cannot be downloaded: a reliable set per type (real move stats)
const FALLBACK_BY_TYPE = {
  normal: [['Tackle', 40, 100, 'physical'], ['Body Slam', 85, 100, 'physical']],
  fire: [['Ember', 40, 100, 'special'], ['Flamethrower', 90, 100, 'special']],
  water: [['Water Gun', 40, 100, 'special'], ['Surf', 90, 100, 'special']],
  electric: [['Thunder Shock', 40, 100, 'special'], ['Thunderbolt', 90, 100, 'special']],
  grass: [['Vine Whip', 45, 100, 'physical'], ['Energy Ball', 90, 100, 'special']],
  ice: [['Ice Shard', 40, 100, 'physical'], ['Ice Beam', 90, 100, 'special']],
  fighting: [['Karate Chop', 50, 100, 'physical'], ['Brick Break', 75, 100, 'physical']],
  poison: [['Poison Sting', 15, 100, 'physical'], ['Sludge Bomb', 90, 100, 'special']],
  ground: [['Mud-Slap', 20, 100, 'special'], ['Earthquake', 100, 100, 'physical']],
  flying: [['Gust', 40, 100, 'special'], ['Air Slash', 75, 95, 'special']],
  psychic: [['Confusion', 50, 100, 'special'], ['Psychic', 90, 100, 'special']],
  bug: [['Bug Bite', 60, 100, 'physical'], ['X-Scissor', 80, 100, 'physical']],
  rock: [['Rock Throw', 50, 90, 'physical'], ['Rock Slide', 75, 90, 'physical']],
  ghost: [['Lick', 30, 100, 'physical'], ['Shadow Ball', 80, 100, 'special']],
  dragon: [['Dragon Breath', 60, 100, 'special'], ['Dragon Pulse', 85, 100, 'special']],
  dark: [['Bite', 60, 100, 'physical'], ['Crunch', 80, 100, 'physical']],
  steel: [['Metal Claw', 50, 95, 'physical'], ['Flash Cannon', 80, 100, 'special']],
  fairy: [['Fairy Wind', 40, 100, 'special'], ['Moonblast', 95, 100, 'special']],
};

const toMove = ([name, power, accuracy, damageClass], type) => ({
  name, type, power, accuracy, damageClass, priority: 0, minHits: 1, maxHits: 1,
});

/** Four moves built from the offline set: the Pokemon's own types plus Tackle. */
export function fallbackMoves(types = ['normal']) {
  const list = [];
  for (const type of types) for (const m of FALLBACK_BY_TYPE[type] || []) list.push(toMove(m, type));
  if (list.length < 4) list.push(toMove(FALLBACK_BY_TYPE.normal[0], 'normal'));
  if (list.length < 4) list.push(toMove(FALLBACK_BY_TYPE.normal[1], 'normal'));
  if (list.length < 4) list.push(toMove(['Quick Attack', 40, 100, 'physical'], 'normal'));
  return dedupe(list).slice(0, 4);
}

function dedupe(moves) {
  const seen = new Set();
  return moves.filter((m) => (seen.has(m.name) ? false : seen.add(m.name)));
}

/** Convert a PokeAPI /move payload into a battle move, or null for status moves. */
export function parseMove(data) {
  if (!data || !data.power || data.damage_class?.name === 'status') return null;
  const en = data.names?.find((n) => n.language?.name === 'en')?.name;
  return {
    name: en || data.name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    type: data.type?.name || 'normal',
    power: data.power,
    accuracy: data.accuracy || 100,
    damageClass: data.damage_class?.name === 'special' ? 'special' : 'physical',
    priority: data.priority || 0,
    minHits: data.meta?.min_hits || 1,
    maxHits: data.meta?.max_hits || 1,
  };
}

/**
 * Level-up moves, strongest-learned-last first: these are the candidates worth downloading.
 * `pokemonMoves` is PokeAPI's pokemon.moves array.
 */
export function levelUpCandidates(pokemonMoves = [], limit = 14) {
  return pokemonMoves
    .map((m) => {
      const levels = (m.version_group_details || [])
        .filter((d) => d.move_learn_method?.name === 'level-up')
        .map((d) => d.level_learned_at || 0);
      return levels.length ? { name: m.move.name, url: m.move.url, level: Math.max(...levels) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.level - a.level)
    .slice(0, limit);
}

// Moves that are too weak, too wild or need a recharge turn make poor picks for children
const effectivePower = (m) => m.power * Math.max(1, (m.minHits + m.maxHits) / 2) * (m.accuracy / 100);

/**
 * Pick 4 moves: the best same-type (STAB) moves, then coverage of other types,
 * then the strongest remaining. Falls back to the offline set when fewer than 2 are usable.
 */
export function selectMoves(candidates, types) {
  const usable = dedupe(candidates.filter(Boolean)).filter((m) => m.power >= 20 && m.power <= 130);
  if (usable.length < 2) return fallbackMoves(types);

  const score = (m) => effectivePower(m) * (types.includes(m.type) ? 1.5 : 1);
  const sorted = [...usable].sort((a, b) => score(b) - score(a));
  const picked = [];
  const add = (m) => m && !picked.includes(m) && picked.length < 4 && picked.push(m);

  // Up to two STAB moves of different types first (or two of the same single type)
  for (const type of types) add(sorted.find((m) => m.type === type));
  // Then one move of a new type for coverage
  add(sorted.find((m) => !picked.some((p) => p.type === m.type)));
  // Then a quick priority move if there is one (fun for kids: "goes first!")
  add(sorted.find((m) => m.priority > 0));
  for (const m of sorted) add(m);

  if (picked.length < 4) {
    for (const m of fallbackMoves(types)) if (!picked.some((p) => p.name === m.name)) add(m);
  }
  // Weakest first so the strongest move sits in the bottom-right button
  return picked.slice(0, 4).sort((a, b) => a.power - b.power);
}
