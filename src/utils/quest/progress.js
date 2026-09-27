// Levels, experience and stats of the quest. Tuned with the bot simulation in
// quest.sim.test.js: act 1 takes a starter from level 5 to about 16 (first evolution).

export const MAX_LEVEL = 50;
export const START_LEVEL = 5;

/** Experience needed to go from `level` to the next one. */
export const xpToNext = (level) => (level >= MAX_LEVEL ? Infinity : Math.round(16 + 6 * level + 0.5 * level * level + 0.018 * level ** 3));

/** How strong a species is (base stat total), squeezed so every Pokemon is fun: 0.85 .. 1.35. */
export const powerFactor = (power) => Math.max(0.85, Math.min(1.35, 1 + ((Number(power) || 320) - 320) / 800));

/** Stats of a party member at its level (evolutions add a little on top of the stronger species). */
export function memberStats(m, charms = {}) {
  const k = powerFactor(m.power) * (1 + 0.06 * (m.stage || 0));
  const hpBonus = 1 + 0.05 * (charms.hp || 0);
  const atkBonus = 1 + 0.05 * (charms.atk || 0);
  return {
    maxHp: Math.round((58 + m.level * 13) * k * hpBonus),
    atk: (9 + m.level * 2.3) * k * atkBonus,
    speed: 212 * (1 + 0.03 * (charms.speed || 0)),
  };
}

/** Wild Pokemon stats: elites ("đầu đàn") are tougher, bosses are set per act. */
export function enemyStats(level, power = 320, { elite = false } = {}) {
  const k = 0.9 + (powerFactor(power) - 1) * 0.5;
  return {
    maxHp: Math.round((32 + level * 21) * k * (elite ? 3 : 1)),
    atk: (2.8 + level * 1.15) * k * (elite ? 1.3 : 1),
  };
}

/** Experience given by a knocked-out wild Pokemon (before the level gap). */
export const xpForKo = (level, { elite = false, boss = false } = {}) => Math.round((3 + level * 1.4) * (elite ? 3 : 1) * (boss ? 20 : 1));

/**
 * Share for one member: much weaker wild Pokemon give less, stronger ones a little more
 * (so a Pokemon behind catches up). The ones who hit it get half as much again;
 * the Pokemon resting in their balls get a smaller share.
 */
export function xpShare(base, memberLevel, enemyLevel, { hit = false, fainted = false, benched = false } = {}) {
  const gap = memberLevel - enemyLevel;
  let k = 1;
  if (gap > 3) k = Math.max(0.2, 1 - 0.14 * (gap - 3));
  else if (gap < 0) k = Math.min(1.6, 1 - 0.07 * gap);
  if (hit) k *= 1.5;
  if (fainted) k *= 0.5;
  // Resting in its Pokeball: a smaller share (it still learns by watching)
  else if (benched) k *= 0.45;
  return Math.max(1, Math.round(base * k));
}
