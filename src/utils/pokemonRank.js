// How "strong" a Pokemon card is decides which games it can play.
// Power = base HP + Attack + Defense + Speed (the stats saved on every card).
// Measured on real PokeAPI data (2026-09-26): Pichu 135, Pikachu 220, Charmeleon 260,
// Gengar 295, Charizard 340, Snorlax 365, Dragonite 400, Mewtwo 436, Arceus 480.
import { FRIENDSHIP_TO_EVOLVE } from './friendship';

export const RANKS = [
  { level: 1, name: 'Đồng', icon: '🥉', min: 0, color: 'from-amber-600 to-orange-800' },
  { level: 2, name: 'Bạc', icon: '🥈', min: 250, color: 'from-slate-300 to-slate-500' },
  { level: 3, name: 'Vàng', icon: '🥇', min: 330, color: 'from-yellow-300 to-amber-500' },
  { level: 4, name: 'Huyền thoại', icon: '💎', min: 400, color: 'from-cyan-300 via-fuchsia-400 to-violet-500' },
];

// Cards saved before the stats were stored count as Bạc (they are not punished)
const UNKNOWN_POWER = 280;

/**
 * Minimum rank for each game (ids as in the game picker). Learning games are open to every
 * Pokemon; the most exciting matches need a strong one.
 */
export const GAME_RANK = {
  catch: 1,
  runner: 1,
  maze: 1,
  math: 1,
  english: 1,
  pairs: 1,
  cooking: 2,
  shop: 2,
  memory: 2,
  music: 2,
  rhythm: 2,
  battle: 3,
  bowling: 3,
  penalty: 3,
  basketball: 4,
  racing: 4,
};

export function powerOf(card) {
  const stats = [card?.baseHp, card?.attack, card?.defense, card?.speed].map(Number);
  if (stats.some((n) => !Number.isFinite(n) || n <= 0)) return UNKNOWN_POWER;
  return stats.reduce((a, b) => a + b, 0);
}

/**
 * The card's rank: from its power, +1 for a shiny card, +1 once friendship reaches "Tri kỷ"
 * (so a child can raise a favourite weak Pokemon by caring for it). Max Huyền thoại.
 * Returns { ...rank, power, base, bonuses: ['shiny' | 'friendship'] }.
 */
export function rankOf(card) {
  const power = powerOf(card);
  let base = 1;
  for (const r of RANKS) if (power >= r.min) base = r.level;
  const bonuses = [];
  if (card?.shinyUnlocked || card?.isShiny) bonuses.push('shiny');
  if ((Number(card?.friendship) || 0) >= FRIENDSHIP_TO_EVOLVE) bonuses.push('friendship');
  const level = Math.min(RANKS.length, base + bonuses.length);
  return { ...RANKS[level - 1], power, base, bonuses };
}

export const canPlay = (card, gameId) => rankOf(card).level >= (GAME_RANK[gameId] || 1);
export const rankFor = (level) => RANKS[Math.max(0, Math.min(RANKS.length, level) - 1)];
export const gamesForRank = (level) => Object.keys(GAME_RANK).filter((id) => GAME_RANK[id] <= level);
