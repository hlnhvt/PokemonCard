// Thủ thành Pokémon: best stars per level (which also unlocks the next one) and the gold paid.

export const STORAGE_KEY = 'pokescan_towerdef_v1';

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const stars = raw && typeof raw.stars === 'object' && raw.stars ? raw.stars : {};
    return { stars };
  } catch {
    return { stars: {} };
  }
}

/** Save a finished level. Returns { best, improved, progress }. */
export function saveResult(levelIndex, stars) {
  const progress = loadProgress();
  const before = Number(progress.stars[levelIndex]) || 0;
  const improved = stars > before;
  const next = { stars: { ...progress.stars, [levelIndex]: Math.max(before, stars) } };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode: progress just is not kept
  }
  return { best: Math.max(before, stars), improved, progress: next };
}

/** Level 1 is open; each next one opens once the one before is won (1+ star). */
export const levelOpen = (progress, i) => i === 0 || (Number(progress.stars[i - 1]) || 0) > 0;

export const totalStars = (progress) => Object.values(progress.stars).reduce((a, b) => a + (Number(b) || 0), 0);

/**
 * Gold for a finished level: a win pays 10 + 5 per star (more on later levels), half that
 * when replaying without beating the best; a loss still pays a little for the waves held.
 */
export function goldFor({ stars, won, improved, level = 0, wavesHeld = 0 }) {
  if (!won) return Math.min(8, 3 + Math.floor(wavesHeld / 2));
  const full = 10 + 5 * stars + level * 2;
  return improved ? full : Math.ceil(full / 2);
}
