// Saving the journey in localStorage: the team (species, level, experience, evolved form),
// acts opened and beaten, the current area, the bag, quest gold and the app-gold bookkeeping.
import { ACTS, areaDef } from './world';

export const SAVE_KEY = 'pokescan_quest_v1';
export const SAVE_VERSION = 1;

/** Plain data of the current journey (JSON-safe). */
export function toSave(state) {
  return {
    v: SAVE_VERSION,
    seed: state.worldSeed,
    act: state.act,
    // Boss lairs and dungeons are saved as the area itself; the game starts at its entrance
    area: state.areaIdx,
    lead: state.lead,
    unlocked: state.unlocked,
    beaten: [...state.beaten],
    gold: Math.floor(state.gold),
    inventory: { ...state.inventory },
    charms: { ...state.charms },
    reward: { earned: state.reward.earned, paid: state.reward.paid, playSeconds: Math.round(state.reward.playSeconds) },
    stats: { ...state.stats },
    party: state.party.map((m) => ({
      key: m.key,
      name: m.name,
      species: m.species,
      dex: m.dex,
      image: m.image,
      types: [...m.types],
      power: m.power,
      level: m.level,
      xp: Math.floor(m.xp),
      stage: m.stage,
      plan: m.plan,
      hpFrac: m.fainted ? 0 : Math.round((m.hp / m.maxHp) * 100) / 100,
      fainted: m.fainted,
    })),
    savedAt: Date.now(),
  };
}

function valid(data) {
  if (!data || data.v !== SAVE_VERSION || !Array.isArray(data.party) || !data.party.length) return false;
  if (!Number.isInteger(data.act) || data.act < 0 || data.act >= ACTS.length) return false;
  if (!areaDef(data.act, data.area)) return false;
  return data.party.every((m) => m && typeof m.name === 'string' && Number.isFinite(m.level));
}

export function loadQuest(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return valid(data) ? data : null;
  } catch {
    return null;
  }
}

export function saveQuest(state, storage = globalThis.localStorage) {
  try {
    const data = toSave(state);
    // A journey saved while everyone had fainted continues healed in town
    if (state.wipe) {
      data.area = 0;
      for (const m of data.party) {
        m.fainted = false;
        m.hpFrac = 1;
      }
    }
    storage?.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearQuest(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

/** Short description for the "continue" button. */
export function describeSave(data) {
  if (!data) return null;
  const act = ACTS[data.act];
  return {
    actName: act.name,
    actNumber: data.act + 1,
    areaName: areaDef(data.act, data.area)?.name || '',
    party: data.party.map((m) => ({ name: m.name, image: m.image, level: m.level })),
    beaten: data.beaten?.length || 0,
  };
}
