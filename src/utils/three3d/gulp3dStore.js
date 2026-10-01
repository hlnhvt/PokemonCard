// Best score per town of "Snorlax nuốt cả thành phố", kept on this device (stars live in progress.js).
export const GULP3D_KEY = 'pokescan_gulp3d_v1';

export function loadGulp3d() {
  try {
    const v = JSON.parse(localStorage.getItem(GULP3D_KEY) || 'null');
    if (v && typeof v === 'object' && v.best && typeof v.best === 'object') {
      const best = {};
      for (const [k, n] of Object.entries(v.best)) best[k] = Math.max(0, Math.floor(Number(n) || 0));
      return { best, rounds: Math.max(0, Math.floor(Number(v.rounds) || 0)) };
    }
  } catch {
    // ignore broken storage
  }
  return { best: {}, rounds: 0 };
}

/** Record a finished round; returns the saved record and whether the score is a new best. */
export function saveGulp3d(mapId, score) {
  const prev = loadGulp3d();
  const before = prev.best[mapId] || 0;
  const next = { best: { ...prev.best, [mapId]: Math.max(before, Math.floor(score)) }, rounds: prev.rounds + 1 };
  try {
    localStorage.setItem(GULP3D_KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: the round still counts on screen
  }
  return { ...next, isNew: Math.floor(score) > before };
}
