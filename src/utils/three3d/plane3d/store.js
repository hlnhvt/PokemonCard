// Saved settings of "Đua máy bay Pokémon" (plane livery, difficulty) and level stars.
import { getProgress, recordStars } from '../../progress';
import { LEVELS, DIFF_IDS, LIVERIES } from './levels';

export const PLANE3D_GAME = 'plane3d';
export const PLANE3D_KEY = 'pokescan_plane3d_v1';

const DEFAULTS = { livery: LIVERIES[0].id, diff: 'easy' };

export function loadSettings() {
  try {
    const v = JSON.parse(localStorage.getItem(PLANE3D_KEY) || 'null');
    if (v && typeof v === 'object') {
      return {
        livery: LIVERIES.some((l) => l.id === v.livery) ? v.livery : DEFAULTS.livery,
        diff: DIFF_IDS.includes(v.diff) ? v.diff : DEFAULTS.diff,
      };
    }
  } catch {
    // broken storage: defaults
  }
  return { ...DEFAULTS };
}

export function saveSettings(next) {
  const v = { ...loadSettings(), ...next };
  try {
    localStorage.setItem(PLANE3D_KEY, JSON.stringify(v));
  } catch {
    // storage blocked: still works for this visit
  }
  return v;
}

/** Progress key of a level at a difficulty, e.g. "L3-easy". */
export const progressKey = (levelId, diff) => `${levelId}-${diff}`;

export const loadProgress = () => getProgress(PLANE3D_GAME);

/** Save stars of a finished level. Returns { best, improved, progress }. */
export const saveLevelStars = (levelId, diff, stars) => recordStars(PLANE3D_GAME, progressKey(levelId, diff), stars);

/** Best stars of a level at one difficulty. */
export const starsOf = (progress, levelId, diff) => Number(progress[progressKey(levelId, diff)]) || 0;

/** Finished on any difficulty? */
export const finishedLevel = (progress, levelId) => DIFF_IDS.some((d) => starsOf(progress, levelId, d) > 0);

/** Level 1 is open; the next one opens when the one before is finished on any difficulty. */
export const levelUnlocked = (progress, index) => index === 0 || finishedLevel(progress, LEVELS[index - 1].id);
