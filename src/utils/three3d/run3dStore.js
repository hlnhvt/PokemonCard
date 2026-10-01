// Best distance / coins of "Pokémon Chạy 3 làn", kept on this device.
export const RUN3D_KEY = 'pokescan_run3d_v1';

export function loadRun3d() {
  try {
    const v = JSON.parse(localStorage.getItem(RUN3D_KEY) || 'null');
    if (v && typeof v === 'object') return { best: Math.max(0, Math.floor(Number(v.best) || 0)), bestCoins: Math.max(0, Math.floor(Number(v.bestCoins) || 0)), runs: Math.max(0, Math.floor(Number(v.runs) || 0)) };
  } catch {
    // ignore broken storage
  }
  return { best: 0, bestCoins: 0, runs: 0 };
}

/** Record a finished run; returns the saved record and whether the distance is a new best. */
export function saveRun3d(dist, coins) {
  const prev = loadRun3d();
  const next = { best: Math.max(prev.best, Math.floor(dist)), bestCoins: Math.max(prev.bestCoins, Math.floor(coins)), runs: prev.runs + 1 };
  try {
    localStorage.setItem(RUN3D_KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: the run still counts on screen
  }
  return { ...next, isNew: Math.floor(dist) > prev.best };
}
