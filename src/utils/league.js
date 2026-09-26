// Pokemon League: 8 gyms one after another, then the Champion. Each gym is a 1v1 battle
// against the gym's ace Pokemon; opponents grow stronger along the road.

export const GYMS = [
  { id: 'rock', name: 'Nhà thi đấu Đá', type: 'rock', ace: 'onix', badge: '🪨', color: 'from-stone-400 to-stone-600', level: 0.85 },
  { id: 'water', name: 'Nhà thi đấu Nước', type: 'water', ace: 'starmie', badge: '💧', color: 'from-sky-400 to-blue-600', level: 0.9 },
  { id: 'electric', name: 'Nhà thi đấu Điện', type: 'electric', ace: 'raichu', badge: '⚡', color: 'from-yellow-300 to-amber-500', level: 0.93 },
  { id: 'grass', name: 'Nhà thi đấu Cỏ', type: 'grass', ace: 'vileplume', badge: '🌿', color: 'from-lime-400 to-green-600', level: 0.96 },
  { id: 'poison', name: 'Nhà thi đấu Độc', type: 'poison', ace: 'weezing', badge: '☠️', color: 'from-fuchsia-400 to-purple-700', level: 1.0 },
  { id: 'psychic', name: 'Nhà thi đấu Siêu linh', type: 'psychic', ace: 'alakazam', badge: '🔮', color: 'from-pink-400 to-rose-600', level: 1.03 },
  { id: 'fire', name: 'Nhà thi đấu Lửa', type: 'fire', ace: 'arcanine', badge: '🔥', color: 'from-orange-400 to-red-600', level: 1.06 },
  { id: 'ground', name: 'Nhà thi đấu Đất', type: 'ground', ace: 'rhydon', badge: '⛰️', color: 'from-amber-600 to-yellow-800', level: 1.08 },
];
export const CHAMPION = { id: 'champion', name: 'Nhà Vô địch Liên minh', type: 'dragon', ace: 'dragonite', badge: '🏆', color: 'from-amber-300 via-yellow-400 to-orange-500', level: 1.12 };
export const LEAGUE = [...GYMS, CHAMPION];

// Gold for each win: gyms get more valuable along the road; the Champion pays the most
export const goldForGym = (index) => (index >= GYMS.length ? 60 : 10 + index * 2);

export const createLeague = () => ({ index: 0, badges: [], losses: 0, done: false });

/** Record the result of the current battle. A loss keeps the child at the same gym. */
export function recordGym(state, won) {
  if (state.done) return state;
  if (!won) return { ...state, losses: state.losses + 1 };
  const badges = [...state.badges, LEAGUE[state.index].id];
  const index = state.index + 1;
  return { ...state, badges, index, done: index >= LEAGUE.length };
}
