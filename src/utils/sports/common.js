// Shared rules for the sports matches against another Pokemon.

/** Berries for the child whatever happens: winning is just a bit better. */
export const MATCH_REWARDS = {
  win: { oran: 1, razz: 1 },
  draw: { oran: 1 },
  lose: { oran: 1 },
};

export function matchResult(playerScore, opponentScore) {
  if (playerScore > opponentScore) return 'win';
  if (playerScore < opponentScore) return 'lose';
  return 'draw';
}

export const RESULT_TEXT = {
  win: 'Chiến thắng! 🏆',
  draw: 'Hòa rồi! 🤝',
  lose: 'Thua mất rồi!',
};

/** A value swinging smoothly between -1 and 1 (aim arrows); `speed` in cycles per second. */
export function swing(t, speed) {
  return Math.sin(t * speed * Math.PI * 2);
}

/** A value going 0 -> 1 -> 0 (power bars); `speed` in cycles per second. */
export function pulse(t, speed) {
  return (1 - Math.cos(t * speed * Math.PI * 2)) / 2;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Normal-ish random number (sum of uniforms), mean 0, roughly -1..1 for spread 1. */
export function jitter(random, spread = 1) {
  return ((random() + random() + random()) / 1.5 - 1) * spread;
}
