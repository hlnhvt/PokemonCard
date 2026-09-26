// Gold coins: every game pays some, the gift shop spends them. Kept on this device.

const STORAGE_KEY = 'pokescan_gold_v1';
// Welcome gift so the shop can be tried straight away
export const STARTER_GOLD = 20;

/** How much each kind of game pays. Losing still pays a little: children always get something. */
export const GOLD_REWARDS = {
  match: { win: 15, draw: 10, lose: 5 },
  perStar: 5, // logic games: 1-3 stars -> 5-15 gold
  catch: 5,
  quizCorrect: 2,
};

/** 5 vs 5 team battle: a big win bonus plus 5 per Pokemon still standing; a loss still pays. */
export const TEAM_GOLD = { win: 30, perSurvivor: 5, lose: 10 };
export const goldForTeam = (won, survivors = 0) => (won ? TEAM_GOLD.win + TEAM_GOLD.perSurvivor * Math.max(0, survivors) : TEAM_GOLD.lose);

/** Pokemon arena: by the result, plus 1 per knock-out of the child's team (max +20). */
export const goldForMoba = (result, teamKills = 0) => ({ win: 40, draw: 25, lose: 15 }[result] ?? 15) + Math.min(20, Math.max(0, teamKills));

export const goldForMatch = (result) => GOLD_REWARDS.match[result] ?? GOLD_REWARDS.match.lose;
/** At least one star's worth, so finishing a game is always rewarded. */
export const goldForStars = (stars) => Math.max(1, Math.round(stars)) * GOLD_REWARDS.perStar;

/** Cooking and shop sessions: one gold per star earned (5-6 customers, up to 3 stars each). */
export const goldForSession = (results) => Math.max(1, results.reduce((a, r) => a + (r.stars || 0), 0));

const clean = (n) => Math.max(0, Math.floor(Number(n) || 0));

export function getGold() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw == null ? STARTER_GOLD : clean(raw);
  } catch {
    return STARTER_GOLD;
  }
}

function save(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
    return true;
  } catch (err) {
    console.error('Failed to save gold:', err);
    return false;
  }
}

/** Add coins. Returns the new balance. */
export function addGold(amount) {
  const next = getGold() + clean(amount);
  save(next);
  return next;
}

/** Spend coins. Returns the new balance, or null when there are not enough (nothing is spent). */
export function spendGold(amount) {
  const cost = clean(amount);
  const balance = getGold();
  if (cost > balance) return null;
  if (!save(balance - cost)) return null;
  return balance - cost;
}

/** Boss raid: a win pays by difficulty; a loss still pays for the damage done (0..1 of the boss HP). */
export const goldForBoss = (won, difficulty = 'normal', damage = 0) =>
  won ? { easy: 35, normal: 55, hard: 80 }[difficulty] ?? 55 : 10 + Math.round(Math.max(0, Math.min(1, damage)) * 20);
