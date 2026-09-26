// Saved line-ups: when the parent allows using Pokemon already scanned, the child can keep a
// team and pick it again next time. Only cards from the collection are kept (by card id), so
// a line-up always uses the child's own Pokemon; lent Pokemon are not saved.
import { memberFromCard } from './team/members';

const KEY = 'pokescan_saved_teams_v1';
export const MAX_SAVED_TEAMS = 6;

const cardIdOf = (member) => (String(member?.key || '').startsWith('card-') ? member.key.slice(5) : null);

export function getSavedTeams() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((t) => t && Array.isArray(t.cards) && t.cards.length) : [];
  } catch {
    return [];
  }
}

function store(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage full or blocked: the line-up just is not remembered
  }
  return list;
}

/** Card members of a team that can be saved (in team order). */
export const savableCards = (team) => team.map(cardIdOf).filter(Boolean);

/**
 * Save the team's own Pokemon as a line-up (newest first, at most MAX_SAVED_TEAMS).
 * Returns { list, saved, reason }: reason 'empty' (no own Pokemon) or 'same' (already saved).
 */
export function saveTeam(team, now = Date.now()) {
  const cards = savableCards(team);
  const list = getSavedTeams();
  if (!cards.length) return { list, saved: null, reason: 'empty' };
  const same = list.find((t) => t.cards.join('|') === cards.join('|'));
  if (same) return { list, saved: same, reason: 'same' };
  const first = team.find((m) => cardIdOf(m));
  const name = cards.length > 1 ? `Đội ${first.name} +${cards.length - 1}` : `Đội ${first.name}`;
  const saved = { id: `team-${now}`, name, cards, size: team.length, createdAt: now };
  return { list: store([saved, ...list].slice(0, MAX_SAVED_TEAMS)), saved, reason: null };
}

export const deleteSavedTeam = (id) => store(getSavedTeams().filter((t) => t.id !== id));

/** The saved line-up as team members, using the cards still in the collection. */
export function teamFromSaved(saved, collection, size) {
  const members = [];
  for (const id of saved.cards) {
    const card = collection.find((c) => String(c.id) === String(id));
    if (!card) continue;
    const m = memberFromCard(card, 'owned');
    if (!members.some((x) => x.species === m.species)) members.push(m);
  }
  return members.slice(0, size);
}
