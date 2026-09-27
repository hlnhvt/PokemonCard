// Carnival tickets: every carnival game pays some, the lucky wheel spends them.
const KEY = 'pokescan_tickets_v1';

export function getTickets() {
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function store(n) {
  const v = Math.max(0, Math.floor(n));
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    // storage blocked: tickets just are not kept
  }
  return v;
}

export const addTickets = (n) => store(getTickets() + Math.max(0, n));

/** Spend one ticket. Returns the tickets left, or -1 when there were none. */
export function spendTicket() {
  const t = getTickets();
  if (t <= 0) return -1;
  return store(t - 1);
}

/** Tickets for a finished game: its stars (1-3), one more for a perfect game. */
export const ticketsForStars = (stars) => Math.max(1, Math.min(3, stars)) + (stars >= 3 ? 1 : 0);

/** Stars from a score and the scores for 2 and 3 stars. */
export const starsFor = (score, two, three) => (score >= three ? 3 : score >= two ? 2 : 1);
