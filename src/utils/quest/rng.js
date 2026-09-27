// Small deterministic random helpers for the quest world (same seed = same map).

/** mulberry32: a fast seeded generator returning numbers in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix several numbers into one 32-bit seed. */
export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const n = Math.floor(Number(p) || 0);
    h = Math.imul(h ^ (n & 0xffff), 16777619) >>> 0;
    h = Math.imul(h ^ (n >>> 16), 16777619) >>> 0;
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** Stable pseudo-random number in [0, 1) for a grid cell (decorations never move). */
export function cellNoise(x, y, salt = 0) {
  return hashSeed(x, y, salt) / 4294967296;
}

export const pick = (rnd, list) => list[Math.floor(rnd() * list.length) % list.length];
export const range = (rnd, a, b) => a + rnd() * (b - a);
export const int = (rnd, a, b) => Math.floor(a + rnd() * (b - a + 1));
