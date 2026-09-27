// Turning the quest team and an expert's team into the shapes the arena match (MobaMatch)
// and the 5 vs 5 team battle (loadTeamBattle) expect.
import { artworkUrl } from '../../services/pokemonOnlineService';

/** Arena strength from the species and the level (a level-50 Pokemon is about 1.45x its species). */
export const powerAt = (bst, level) => Math.round((Number(bst) || 320) * (0.55 + (0.9 * level) / 50));

const leadFirst = (party, lead) => [party[lead], ...party.filter((_, i) => i !== lead)].filter(Boolean);

/** The child's 5 for the arena, the lead first (it is the one the child controls). */
export const arenaTeam = (party, lead) => leadFirst(party, lead).map((m) => ({ name: m.name, image: m.image, types: m.types, power: powerAt(m.power, m.level) }));

export const expertArenaTeam = (expert) => expert.team.map((p) => ({ name: p.name, image: artworkUrl(p.dex), types: p.types, power: powerAt(p.bst, p.level) }));

/** Kind to the youngest: the first acts are easy arenas. */
export const arenaDifficulty = (act) => ['easy', 'easy', 'normal', 'normal', 'hard', 'hard'][act] || 'normal';

/** Team members for loadTeamBattle (battle data looked up by Pokedex number, then name). */
export const teamMembers = (party, lead) =>
  leadFirst(party, lead).map((m) => ({ key: m.key, name: m.name, species: m.species, image: m.image, query: [m.dex, String(m.name).toLowerCase()].filter(Boolean), types: m.types, friendship: 0, power: m.power, source: 'owned' }));

const ARENA_OF_THEME = { forest: 'meadow', cave: 'stadium', tower: 'city', volcano: 'volcano', ice: 'snow', psychic: 'space' };
export const teamArenaFor = (theme) => ARENA_OF_THEME[theme] || 'league';

/** Opponents a little weaker in the first acts, a little stronger at the end. */
export const teamLevelFactor = (act) => [0.8, 0.85, 0.9, 0.95, 1, 1.05][act] || 1;
