// Thủ thành Pokémon: the tower Pokémon (3-stage evolution lines + the child's hero) and the type chart.
import { typeMultiplier, TYPES } from '../battle/typeChart';

/**
 * Small, kid-friendly type chart on top of the real one: super effective x1.6,
 * not very effective x0.6, never fully immune (x0.5).
 */
export function typeMult(attack, defend) {
  const m = typeMultiplier(String(attack || 'normal').toLowerCase(), String(defend || 'normal').toLowerCase());
  if (m === 0) return 0.5;
  if (m > 1) return 1.6;
  if (m < 1) return 0.6;
  return 1;
}

// attack kinds: fireball (splash), cone (flamethrower), bubble (slow), cannon (2 shots + slow),
// leaf (poison), beam (solar beam: line + poison), chain (lightning), psy (ring), psywave (all in range), star (hero)
export const LINES = {
  fire: {
    type: 'fire', role: 'Lửa – nổ lan', cost: 70, color: '#f97316',
    stages: [
      { name: 'Charmander', dex: 4, attack: 'fireball', dmg: 13, rate: 0.8, range: 80, splash: 32 },
      { name: 'Charmeleon', dex: 5, attack: 'fireball', dmg: 32, rate: 0.9, range: 88, splash: 42 },
      { name: 'Charizard', dex: 6, attack: 'cone', dmg: 26, rate: 3, range: 102, cone: 0.5 },
    ],
  },
  water: {
    type: 'water', role: 'Nước – làm chậm', cost: 60, color: '#3b82f6',
    stages: [
      { name: 'Squirtle', dex: 7, attack: 'bubble', dmg: 9, rate: 1.1, range: 82, slow: 0.6, slowT: 1.4 },
      { name: 'Wartortle', dex: 8, attack: 'bubble', dmg: 22, rate: 1.2, range: 90, slow: 0.5, slowT: 1.6 },
      { name: 'Blastoise', dex: 9, attack: 'cannon', dmg: 36, rate: 1.3, range: 102, slow: 0.4, slowT: 1.8, splash: 24 },
    ],
  },
  grass: {
    type: 'grass', role: 'Cỏ – trúng độc', cost: 60, color: '#22c55e',
    stages: [
      { name: 'Bulbasaur', dex: 1, attack: 'leaf', dmg: 7, rate: 1, range: 82, poison: 6, poisonT: 3 },
      { name: 'Ivysaur', dex: 2, attack: 'leaf', dmg: 18, rate: 1.1, range: 90, poison: 15, poisonT: 3 },
      { name: 'Venusaur', dex: 3, attack: 'beam', dmg: 62, rate: 1, range: 108, poison: 30, poisonT: 3 },
    ],
  },
  electric: {
    type: 'electric', role: 'Điện – sét lan', cost: 80, color: '#facc15',
    stages: [
      { name: 'Pichu', dex: 172, attack: 'chain', dmg: 8, rate: 1.6, range: 76, chain: 2 },
      { name: 'Pikachu', dex: 25, attack: 'chain', dmg: 18, rate: 1.8, range: 84, chain: 3 },
      { name: 'Raichu', dex: 26, attack: 'chain', dmg: 38, rate: 2, range: 94, chain: 4 },
    ],
  },
  psychic: {
    type: 'psychic', role: 'Siêu linh – bắn xa', cost: 90, color: '#d946ef', unlock: 2, antiAir: true,
    stages: [
      { name: 'Abra', dex: 63, attack: 'psy', dmg: 18, rate: 0.6, range: 118 },
      { name: 'Kadabra', dex: 64, attack: 'psy', dmg: 42, rate: 0.7, range: 132 },
      { name: 'Alakazam', dex: 65, attack: 'psywave', dmg: 70, rate: 0.8, range: 145 },
    ],
  },
};

export const LINE_IDS = ['fire', 'water', 'grass', 'electric', 'psychic'];

/** The child's own Pokémon: free once per level, levels up ★1 → ★3 instead of evolving. */
export const HERO = {
  role: 'Bạn đồng hành', cost: 0, antiAir: true,
  stages: [
    { attack: 'star', dmg: 15, rate: 1, range: 92 },
    { attack: 'star', dmg: 34, rate: 1.1, range: 98 },
    { attack: 'star', dmg: 70, rate: 1.25, range: 106, splash: 30 },
  ],
};

/** Coins to evolve from stage s to s + 1 (towers) or level the hero up. */
export const EVOLVE_COST = [90, 180];
export const HERO_LEVEL_COST = [60, 120];
/** Evolution energy needed at stage s, before the level's HP scale. */
export const ENERGY_NEED = [300, 1100];
export const SELL_REFUND = 0.7;
export const MAX_STAGE = 2;

/** Normalised hero type from player.types[0] (default normal). */
export function heroType(player) {
  const t = String(player?.types?.[0] || 'normal').toLowerCase();
  return TYPES.includes(t) ? t : 'normal';
}

export const lineUnlocked = (line, levelIndex) => (LINES[line]?.unlock ?? 0) <= levelIndex;
