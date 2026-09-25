// The child's berry bag, shared by all their Pokemon and kept on this device.
import { BERRY_TYPES } from './friendship';

const STORAGE_KEY = 'pokescan_berries_v1';
// Welcome gift so feeding can be tried before playing the runner game
export const STARTER_BERRIES = { oran: 3, razz: 0 };

const empty = () => Object.fromEntries(BERRY_TYPES.map((t) => [t, 0]));

function normalise(bag) {
  const result = empty();
  for (const t of BERRY_TYPES) result[t] = Math.max(0, Math.floor(Number(bag?.[t]) || 0));
  return result;
}

export function getBerries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return normalise(STARTER_BERRIES);
    return normalise(JSON.parse(raw));
  } catch {
    return normalise(STARTER_BERRIES);
  }
}

function save(bag) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bag));
    return true;
  } catch (err) {
    console.error('Failed to save berries:', err);
    return false;
  }
}

/** Add berries, e.g. { oran: 2, razz: 1 } collected in the runner. Returns the new bag. */
export function addBerries(delta) {
  const bag = getBerries();
  for (const t of BERRY_TYPES) bag[t] += Math.max(0, Math.floor(Number(delta?.[t]) || 0));
  save(bag);
  return bag;
}

/** Take one berry out of the bag. Returns the new bag, or null if there is none. */
export function spendBerry(type) {
  const bag = getBerries();
  if (!BERRY_TYPES.includes(type) || bag[type] <= 0) return null;
  bag[type] -= 1;
  if (!save(bag)) return null;
  return bag;
}

export function totalBerries(bag) {
  return BERRY_TYPES.reduce((sum, t) => sum + (bag?.[t] || 0), 0);
}
