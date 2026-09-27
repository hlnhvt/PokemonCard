// Ways to play the arena: one match, a league of 5 matches (points) or a knock-out cup
// (quarter-final, semi-final, final). In the league and the cup every match is a little
// harder than the one before. Pure rules.
import { ARENA_DIFFICULTY } from './engine';

export const ARENA_MODES = {
  single: { label: 'Trận lẻ', icon: '⚔️', hint: 'Một trận, tự chọn độ khó' },
  league: { label: 'Giải đấu', icon: '🏅', hint: '5 trận tính điểm, khó dần', schedule: ['easy', 'normal', 'normal', 'hard', 'expert'] },
  cup: { label: 'Cúp', icon: '🏆', hint: 'Loại trực tiếp: thua là dừng', schedule: ['normal', 'hard', 'expert'], rounds: ['Tứ kết', 'Bán kết', 'Chung kết'] },
};

// Opposing clubs, one per match
export const CLUBS = [
  { name: 'Đội Lửa Đỏ', emblem: '🔥' },
  { name: 'Đội Sóng Xanh', emblem: '🌊' },
  { name: 'Đội Sấm Sét', emblem: '⚡' },
  { name: 'Đội Rừng Già', emblem: '🌲' },
  { name: 'Đội Bóng Đêm', emblem: '🌙' },
  { name: 'Đội Băng Giá', emblem: '❄️' },
  { name: 'Đội Rồng Thiêng', emblem: '🐉' },
];

export const POINTS = { win: 3, draw: 1, lose: 0 };
// League medal by points (5 matches, at most 15)
export const MEDALS = [
  { min: 12, id: 'gold', label: 'Cúp Vàng', icon: '🥇', gold: 60 },
  { min: 8, id: 'silver', label: 'Huy chương Bạc', icon: '🥈', gold: 35 },
  { min: 5, id: 'bronze', label: 'Huy chương Đồng', icon: '🥉', gold: 20 },
  { min: 0, id: 'none', label: 'Cố gắng lên nhé', icon: '🎖️', gold: 5 },
];
export const medalOf = (points) => MEDALS.find((m) => points >= m.min);
export const CUP_GOLD = { champion: 80, final: 40, semi: 20, quarter: 5 };

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createTournament(mode, random = Math.random) {
  const m = ARENA_MODES[mode];
  const clubs = shuffle(CLUBS, random);
  return {
    mode,
    matches: m.schedule.map((difficulty, i) => ({ difficulty, club: clubs[i % clubs.length], round: m.rounds?.[i] || `Trận ${i + 1}`, result: null, score: null })),
    index: 0,
    points: 0,
    status: 'playing', // playing | finished (league done / cup won) | out (cup lost)
  };
}

export const currentMatch = (t) => t.matches[t.index];
export const difficultyLabel = (id) => ARENA_DIFFICULTY[id]?.label || '';

/**
 * Record the match just played. In the cup a draw is settled by damage dealt (like extra
 * time): `dealt` = { blue, red } total damage of each team.
 */
export function recordMatch(t, { winner, score, dealt = { blue: 0, red: 0 } }) {
  if (t.status !== 'playing') return t;
  let result = winner === 'blue' ? 'win' : winner === 'red' ? 'lose' : 'draw';
  let decided = null;
  if (t.mode === 'cup' && result === 'draw') {
    result = dealt.blue >= dealt.red ? 'win' : 'lose';
    decided = 'damage';
  }
  const matches = t.matches.map((m, i) => (i === t.index ? { ...m, result, score, decided } : m));
  const points = t.points + (t.mode === 'league' ? POINTS[result] : 0);
  const last = t.index === t.matches.length - 1;
  let status = 'playing';
  if (t.mode === 'cup' && result === 'lose') status = 'out';
  else if (last) status = 'finished';
  return { ...t, matches, points, status, index: status === 'playing' ? t.index + 1 : t.index };
}

/** Bonus gold at the end: the league medal, or how far the cup run went. */
export function tournamentBonus(t) {
  if (t.mode === 'league') return medalOf(t.points).gold;
  if (t.mode === 'cup') {
    if (t.status === 'finished') return CUP_GOLD.champion;
    return [CUP_GOLD.quarter, CUP_GOLD.semi, CUP_GOLD.final][t.index] ?? 0;
  }
  return 0;
}

/** Headline for the end of a league or cup. */
export function tournamentTitle(t) {
  if (t.mode === 'league') return `${medalOf(t.points).icon} ${medalOf(t.points).label} · ${t.points} điểm`;
  if (t.status === 'finished') return '🏆 VÔ ĐỊCH CÚP!';
  return `Dừng bước ở ${t.matches[t.index].round}`;
}
