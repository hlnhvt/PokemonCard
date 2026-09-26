// Pokemon League: 8 gyms one after another, then the Champion. Each is a 5 vs 5 team battle
// against the gym's team (its ace comes last); opponents grow stronger along the road.
import { ARENAS } from './team/arenas';

// level: on top of the team battle's own opponent strength (x1.16), from easy to a hard final
// team: PokeAPI names (checked against PokeAPI on 2026-09-26), the ace last
export const GYMS = [
  { id: 'rock', name: 'Nhà thi đấu Đá', type: 'rock', team: ['geodude', 'omanyte', 'kabuto', 'graveler', 'onix'], badge: '🪨', color: 'from-stone-400 to-stone-600', level: 0.8 },
  { id: 'water', name: 'Nhà thi đấu Nước', type: 'water', team: ['goldeen', 'psyduck', 'staryu', 'seaking', 'starmie'], badge: '💧', color: 'from-sky-400 to-blue-600', level: 0.84 },
  { id: 'electric', name: 'Nhà thi đấu Điện', type: 'electric', team: ['voltorb', 'magnemite', 'electabuzz', 'jolteon', 'raichu'], badge: '⚡', color: 'from-yellow-300 to-amber-500', level: 0.87 },
  { id: 'grass', name: 'Nhà thi đấu Cỏ', type: 'grass', team: ['oddish', 'bellsprout', 'tangela', 'weepinbell', 'vileplume'], badge: '🌿', color: 'from-lime-400 to-green-600', level: 0.9 },
  { id: 'poison', name: 'Nhà thi đấu Độc', type: 'poison', team: ['ekans', 'koffing', 'grimer', 'muk', 'weezing'], badge: '☠️', color: 'from-fuchsia-400 to-purple-700', level: 0.93 },
  { id: 'psychic', name: 'Nhà thi đấu Siêu linh', type: 'psychic', team: ['abra', 'drowzee', 'kadabra', 'hypno', 'alakazam'], badge: '🔮', color: 'from-pink-400 to-rose-600', level: 0.96 },
  { id: 'fire', name: 'Nhà thi đấu Lửa', type: 'fire', team: ['vulpix', 'ponyta', 'growlithe', 'rapidash', 'arcanine'], badge: '🔥', color: 'from-orange-400 to-red-600', level: 0.99 },
  { id: 'ground', name: 'Nhà thi đấu Đất', type: 'ground', team: ['diglett', 'sandshrew', 'cubone', 'sandslash', 'rhydon'], badge: '⛰️', color: 'from-amber-600 to-yellow-800', level: 1.02 },
];
export const CHAMPION = { id: 'champion', name: 'Nhà Vô địch Liên minh', type: 'dragon', team: ['dratini', 'aerodactyl', 'dragonair', 'gyarados', 'dragonite'], badge: '🏆', color: 'from-amber-300 via-yellow-400 to-orange-500', level: 1.05 };
export const LEAGUE = [...GYMS, CHAMPION];

export const aceOf = (gym) => gym.team[gym.team.length - 1];
/** Battle ground of a gym: the one that powers up its type, else the Pokemon stadium. */
export const arenaForGym = (gym) => ARENAS.find((a) => a.id !== 'stadium' && a.boost.includes(gym.type)) || ARENAS.find((a) => a.id === 'stadium');

// Gold for each win: gyms get more valuable along the road; the Champion pays the most
export const goldForGym = (index, difficulty = 'normal') => Math.round((index >= GYMS.length ? 80 : 20 + index * 3) * ({ easy: 0.8, normal: 1, hard: 1.4 }[difficulty] ?? 1));

export const createLeague = () => ({ index: 0, badges: [], losses: 0, done: false });

/** Record the result of the current battle. A loss keeps the child at the same gym. */
export function recordGym(state, won) {
  if (state.done) return state;
  if (!won) return { ...state, losses: state.losses + 1 };
  const badges = [...state.badges, LEAGUE[state.index].id];
  const index = state.index + 1;
  return { ...state, badges, index, done: index >= LEAGUE.length };
}
