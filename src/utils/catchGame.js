// Rules of the Pokeball minigame, kept pure so they can be unit tested.
// Tuned for children: every Pokemon can be caught, rarer ones just take a few more tries.

export const BALLS_PER_ROUND = 5;
// Horizontal distance (arena half-widths) within which a throw hits the Pokemon
export const HIT_TOLERANCE = 0.3;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Chance (0..1) that a ball that hit the Pokemon catches it.
 * - captureRate: PokeAPI capture_rate, 3 (hardest) .. 255 (easiest)
 * - ringScale: size of the shrinking target ring when thrown, 0.35 (small) .. 1 (large);
 *   a smaller ring is a better throw
 */
export function catchChance({ captureRate = 120, ringScale = 1, isLegendary = false, isMythical = false } = {}) {
  const ease = clamp(captureRate, 1, 255) / 255;
  let chance = 0.4 + 0.5 * ease;
  chance += (1 - clamp(ringScale, 0.35, 1)) * 0.35;
  if (isLegendary || isMythical) chance -= 0.1;
  return clamp(chance, 0.3, 0.95);
}

/** Praise shown for the throw quality (smaller ring = better). */
export function throwQuality(ringScale) {
  if (ringScale < 0.55) return { label: 'Tuyệt vời!', stars: 3 };
  if (ringScale < 0.8) return { label: 'Tuyệt lắm!', stars: 2 };
  return { label: 'Tốt!', stars: 1 };
}

/** Pokemon position in the arena at time t (seconds): -1 (left) .. 1 (right). */
export function pokemonX(t, speed) {
  return Math.sin(t * speed);
}

/** Target ring size at time t (seconds), pulsing between 0.35 and 1. */
export function ringScaleAt(t) {
  return 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(t * 2.4));
}

/** Legendary Pokemon move faster; common ones slowly. */
export function movementSpeed({ captureRate = 120, isLegendary = false, isMythical = false } = {}) {
  const base = 0.9 + (1 - clamp(captureRate, 1, 255) / 255) * 0.9;
  return isLegendary || isMythical ? base + 0.4 : base;
}

export function isHit(aimX, targetX, tolerance = HIT_TOLERANCE) {
  return Math.abs(aimX - targetX) <= tolerance;
}
