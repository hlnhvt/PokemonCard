// "Xổ số trứng Pokémon": spend a ticket, pick an egg, tap (or shake) it until it hatches a baby Pokémon.
// Pure rules: the odds, the cracking, the gold and the sticker album (kept in localStorage).

export const COLLECTION_KEY = 'pokescan_egg_collection_v1';

/** Weight of each rarity (per Pokémon) and its label. */
export const RARITY = {
  common: { weight: 10, label: 'Thường' },
  rare: { weight: 4, label: 'Hiếm' },
};

/** The baby Pokémon that can hatch (dex numbers for artworkUrl). */
export const BABIES = [
  { dex: 172, name: 'Pichu', rarity: 'common' },
  { dex: 173, name: 'Cleffa', rarity: 'common' },
  { dex: 174, name: 'Igglybuff', rarity: 'common' },
  { dex: 175, name: 'Togepi', rarity: 'rare' },
  { dex: 236, name: 'Tyrogue', rarity: 'common' },
  { dex: 238, name: 'Smoochum', rarity: 'common' },
  { dex: 239, name: 'Elekid', rarity: 'common' },
  { dex: 240, name: 'Magby', rarity: 'common' },
  { dex: 298, name: 'Azurill', rarity: 'common' },
  { dex: 360, name: 'Wynaut', rarity: 'common' },
  { dex: 406, name: 'Budew', rarity: 'common' },
  { dex: 433, name: 'Chingling', rarity: 'common' },
  { dex: 438, name: 'Bonsly', rarity: 'common' },
  { dex: 439, name: 'Mime Jr.', rarity: 'rare' },
  { dex: 440, name: 'Happiny', rarity: 'rare' },
  { dex: 446, name: 'Munchlax', rarity: 'rare' },
  { dex: 447, name: 'Riolu', rarity: 'rare' },
  { dex: 458, name: 'Mantyke', rarity: 'rare' },
];

export const TOTAL_WEIGHT = BABIES.reduce((a, b) => a + RARITY[b.rarity].weight, 0);
export const SHINY_CHANCE = 0.03;
export const GOLD = { new: 10, duplicate: 5, shinyDuplicate: 20 };

/** The six decorated eggs on the shelf. */
export const EGG_STYLES = ['tri', 'spots', 'zigzag', 'zap', 'stars', 'waves'];
/** Crack steps drawn before the egg bursts. */
export const CRACK_STAGES = 4;
export const MIN_TAPS = 6;
export const MAX_TAPS = 8;

export const babyByDex = (dex) => BABIES.find((b) => b.dex === dex) || null;

/** Chance of each Pokémon (by dex). */
export function hatchChances() {
  const out = {};
  for (const b of BABIES) out[b.dex] = RARITY[b.rarity].weight / TOTAL_WEIGHT;
  return out;
}

/** Roll a baby by weight, then the shiny chance. Uses `random` twice. */
export function rollBaby(random = Math.random) {
  let r = random() * TOTAL_WEIGHT;
  let pick = BABIES[BABIES.length - 1];
  for (const b of BABIES) {
    r -= RARITY[b.rarity].weight;
    if (r < 0) {
      pick = b;
      break;
    }
  }
  return { ...pick, shiny: random() < SHINY_CHANCE };
}

/** A picked egg: what is inside is decided now, the child then taps it `need` times. */
export function createHatch({ random = Math.random, egg = 0 } = {}) {
  const baby = rollBaby(random);
  const need = MIN_TAPS + Math.min(MAX_TAPS - MIN_TAPS, Math.floor(random() * (MAX_TAPS - MIN_TAPS + 1)));
  return { egg, baby, need, taps: 0, hatched: false };
}

/** One tap (or one shake). Returns a new hatch state. */
export function tapHatch(h, n = 1) {
  if (h.hatched) return h;
  const taps = Math.min(h.need, h.taps + Math.max(0, n));
  return { ...h, taps, hatched: taps >= h.need };
}

/** How many crack lines show: 0 (whole) .. CRACK_STAGES (about to burst). The first tap already cracks it. */
export function crackStage(h) {
  if (h.hatched) return CRACK_STAGES;
  if (h.taps <= 0) return 0;
  return Math.min(CRACK_STAGES, Math.ceil((h.taps / h.need) * CRACK_STAGES));
}

/** What a hatched baby gives, given the album before it. */
export function hatchOutcome(collection, baby) {
  const had = collection?.[baby.dex];
  const isNew = !had || !(had.count > 0);
  const gold = isNew ? GOLD.new : baby.shiny ? GOLD.shinyDuplicate : GOLD.duplicate;
  return { isNew, duplicate: !isNew, gold, firstShiny: !!baby.shiny && !(had && had.shiny) };
}

/** A new album with the baby added (counts per Pokémon, and whether a shiny was ever hatched). */
export function addToCollection(collection, baby) {
  const had = collection?.[baby.dex];
  return { ...(collection || {}), [baby.dex]: { count: (had?.count || 0) + 1, shiny: !!(had?.shiny || baby.shiny) } };
}

/** Keep only well-formed entries of known Pokémon. */
export function cleanCollection(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const b of BABIES) {
    const e = raw[b.dex];
    const count = Math.floor(Number(e?.count));
    if (Number.isFinite(count) && count > 0) out[b.dex] = { count, shiny: !!e.shiny };
  }
  return out;
}

export function loadCollection(storage = globalThis.localStorage) {
  try {
    return cleanCollection(JSON.parse(storage?.getItem(COLLECTION_KEY) || '{}'));
  } catch {
    return {};
  }
}

export function saveCollection(collection, storage = globalThis.localStorage) {
  const clean = cleanCollection(collection);
  try {
    storage?.setItem(COLLECTION_KEY, JSON.stringify(clean));
  } catch {
    // storage blocked: the album is not kept
  }
  return clean;
}

/** Hatch a baby into the stored album: returns the outcome and the saved album. */
export function recordHatch(baby, storage = globalThis.localStorage) {
  const before = loadCollection(storage);
  const outcome = hatchOutcome(before, baby);
  const collection = saveCollection(addToCollection(before, baby), storage);
  return { ...outcome, collection };
}

export function collectionProgress(collection) {
  const c = cleanCollection(collection);
  const owned = BABIES.filter((b) => c[b.dex]).length;
  const shinies = BABIES.filter((b) => c[b.dex]?.shiny).length;
  return { owned, total: BABIES.length, shinies, complete: owned === BABIES.length };
}

// ---- Shaking the phone counts as a tap ----
export const SHAKE_THRESHOLD = 12; // m/s² away from rest
export const SHAKE_COOLDOWN = 0.22; // s between two counted shakes

export const createShakeDetector = () => ({ last: -Infinity });

/**
 * Feed a devicemotion reading. `a` is `acceleration` (gravity removed) when the phone has it,
 * otherwise `accelerationIncludingGravity` with `gravity: true`. Returns true for a counted shake.
 */
export function shakeHit(det, a, now, { gravity = false } = {}) {
  if (!a) return false;
  const x = Number(a.x) || 0;
  const y = Number(a.y) || 0;
  const z = Number(a.z) || 0;
  let force = Math.hypot(x, y, z);
  if (gravity) force = Math.abs(force - 9.81);
  if (force < SHAKE_THRESHOLD || now - det.last < SHAKE_COOLDOWN) return false;
  det.last = now;
  return true;
}
