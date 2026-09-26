// Level progress for games with many levels (maze, music): best stars per level.
import { goldForStars } from './gold';

const STORAGE_KEY = 'pokescan_progress_v1';
// Playing a level again without beating the best stars still pays a little
export const REPLAY_GOLD = 2;

function readAll() {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return all && typeof all === 'object' ? all : {};
  } catch {
    return {};
  }
}

/** { levelId: bestStars } for one game. */
export function getProgress(game) {
  const p = readAll()[game];
  return p && typeof p === 'object' ? p : {};
}

/** Save a finished level. Returns { best, improved, progress }. */
export function recordStars(game, levelId, stars) {
  const all = readAll();
  const progress = { ...(all[game] || {}) };
  const before = Number(progress[levelId]) || 0;
  const improved = stars > before;
  if (improved) progress[levelId] = stars;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [game]: progress }));
  } catch (err) {
    console.error('Failed to save progress:', err);
  }
  return { best: Math.max(before, stars), improved, progress };
}

/** The first level is open; each next one opens once the one before has a star. */
export const isUnlocked = (levels, progress, index) => index === 0 || (Number(progress[levels[index - 1]?.id]) || 0) > 0;

/** Full gold the first time (or for more stars), a little for replays. */
export const goldForLevel = (stars, improved) => (improved ? goldForStars(stars) : REPLAY_GOLD);

export const totalStars = (progress) => Object.values(progress).reduce((a, b) => a + (Number(b) || 0), 0);
