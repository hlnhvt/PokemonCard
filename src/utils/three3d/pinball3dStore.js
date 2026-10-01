// High score and catches of "Pinball Pokémon", kept on this device.
export const PINBALL3D_KEY = 'pokescan_pinball3d_v1';

const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

export function loadPinball3d() {
  try {
    const v = JSON.parse(localStorage.getItem(PINBALL3D_KEY) || 'null');
    if (v && typeof v === 'object') {
      return { best: int(v.best), games: int(v.games), caught: Array.isArray(v.caught) ? v.caught.filter((x) => typeof x === 'string') : [] };
    }
  } catch {
    // ignore broken storage
  }
  return { best: 0, games: 0, caught: [] };
}

/** Records a finished game; returns the saved record and whether the score is a new best. */
export function savePinball3d(score, caught = []) {
  const prev = loadPinball3d();
  const next = { best: Math.max(prev.best, int(score)), games: prev.games + 1, caught: [...new Set([...prev.caught, ...caught])] };
  try {
    localStorage.setItem(PINBALL3D_KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: the game still counts on screen
  }
  return { ...next, isNew: int(score) > prev.best };
}
