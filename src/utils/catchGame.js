// Rules of the Pokeball minigame, kept pure so they can be unit tested.
// Tuned for children: every Pokemon can be caught, rarer ones just take a few more tries.

export const BALLS_PER_ROUND = 5;
// Ball flight time; the Pokemon keeps moving meanwhile
export const FLIGHT_MS = 600;
// Share of the distance between where the child aimed and where the Pokemon will be that
// the ball curves on its own. 0.3 (simulated): easy Pokemon ~100% hits, capture rate 45
// ~76%, legendary ~49% when throwing at random moments; better timing hits more often.
export const AIM_ASSIST = 0.3;
// Landing within this distance (in Pokemon travel half-widths) of the Pokemon counts as a hit.
// Its body is drawn about 0.5 wide in these units, so a hit is a ball that visibly lands on it.
export const HIT_TOLERANCE = 0.45;
// The Pokemon moves across +-TRAVEL of the arena width from the centre
export const TRAVEL = 0.32;

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

/** Legendary Pokemon move faster; common ones slowly (child-friendly speeds). */
export function movementSpeed({ captureRate = 120, isLegendary = false, isMythical = false } = {}) {
  const base = 0.6 + (1 - clamp(captureRate, 1, 255) / 255) * 0.7;
  return isLegendary || isMythical ? base + 0.3 : base;
}

export function isHit(landX, targetX, tolerance = HIT_TOLERANCE) {
  return Math.abs(landX - targetX) <= tolerance;
}

/**
 * Decide a throw. aimX: where the child aimed (-1..1); targetX: where the Pokemon will be
 * when the ball arrives. Returns where the ball lands and whether it hits.
 */
export function planThrow(aimX, targetX, assist = AIM_ASSIST) {
  const landX = clamp(aimX + (targetX - aimX) * assist, -1.3, 1.3);
  return { landX, hit: isHit(landX, targetX) };
}

const easeOutCubic = (p) => 1 - (1 - p) ** 3;

/**
 * Ball position during the flight, p = 0..1. from/to are {x, y} centre points in px.
 * The ball rises in an arc, shrinks as it flies away from the child and spins.
 */
export function flightPoint(p, from, to, arcHeight = 90) {
  const q = clamp(p, 0, 1);
  const e = easeOutCubic(q);
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e - arcHeight * Math.sin(Math.PI * q),
    scale: 1 - 0.4 * e,
    rotate: 1080 * e,
  };
}
