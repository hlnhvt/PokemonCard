// Memory order: Pokemon appear one after another; the child taps them in the same order.
// Rounds get longer (2 -> 6 Pokemon). A mistake costs a heart and replays that length.

export const START_LENGTH = 2;
export const MAX_LENGTH = 6;
export const HEARTS = 3;

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** A round: the order to remember and the cards to choose from (the sequence plus 2 extra). */
export function makeRound(pool, length, random = Math.random) {
  const picked = shuffle(pool, random).slice(0, Math.min(pool.length, length + 2));
  const sequence = picked.slice(0, length);
  return { sequence, cards: shuffle(picked, random), progress: 0 };
}

export function createMemoryGame(pool, random = Math.random) {
  return { length: START_LENGTH, hearts: HEARTS, best: 0, round: makeRound(pool, START_LENGTH, random), status: 'show' };
}

/**
 * The child taps a card (its `key`). Returns the next state; `status` is
 * 'input' (keep going) | 'roundWon' | 'wrong' | 'won' (all lengths done) | 'over' (no hearts).
 */
export function tapCard(state, key) {
  const { round } = state;
  const expected = round.sequence[round.progress];
  if (!expected) return state;
  if (expected.key !== key) {
    const hearts = state.hearts - 1;
    return { ...state, hearts, status: hearts <= 0 ? 'over' : 'wrong' };
  }
  const progress = round.progress + 1;
  if (progress < round.sequence.length) return { ...state, round: { ...round, progress }, status: 'input' };
  const best = Math.max(state.best, state.length);
  return { ...state, best, round: { ...round, progress }, status: state.length >= MAX_LENGTH ? 'won' : 'roundWon' };
}

/** After 'roundWon' the sequence grows; after 'wrong' the same length is tried with a new order. */
export function nextRound(state, pool, random = Math.random) {
  const length = state.status === 'roundWon' ? state.length + 1 : state.length;
  return { ...state, length, round: makeRound(pool, length, random), status: 'show' };
}

export function memoryStars(best) {
  if (best >= MAX_LENGTH) return 3;
  if (best >= 4) return 2;
  return 1;
}
