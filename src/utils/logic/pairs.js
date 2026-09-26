// Memory pairs: turn two cards over, keep them when they belong together.
// Level 1: the same picture twice. Level 2: a Pokemon and its silhouette.
// Level 3: a Pokemon and its type (every Pokemon of a different type, so the answer is clear).
import { OPPONENT_POOL } from '../battle/opponentPool';

export const PAIR_LEVELS = [
  { id: 'same', title: 'Hình giống nhau', pairs: 6, cols: 3 },
  { id: 'shadow', title: 'Hình và bóng', pairs: 8, cols: 4 },
  { id: 'type', title: 'Pokémon và hệ', pairs: 8, cols: 4 },
];

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Pokemon for a level: different species; for the type level, different primary types. */
function pickPokemon(level, random) {
  const pool = shuffle(OPPONENT_POOL, random);
  if (level.id !== 'type') return pool.slice(0, level.pairs);
  const seen = new Set();
  return pool.filter((p) => (seen.has(p.types[0]) ? false : seen.add(p.types[0]))).slice(0, level.pairs);
}

/**
 * A shuffled board. Each card: { uid, pair, face: 'picture' | 'shadow' | 'type', pokemon }.
 * Two cards match when they have the same `pair`.
 */
export function createBoard(levelIndex, random = Math.random) {
  const level = PAIR_LEVELS[levelIndex];
  const picked = pickPokemon(level, random);
  const second = { same: 'picture', shadow: 'shadow', type: 'type' }[level.id];
  const cards = picked.flatMap((p, i) => [
    { pair: i, face: 'picture', pokemon: p },
    { pair: i, face: second, pokemon: p },
  ]);
  return {
    level: levelIndex,
    cards: shuffle(cards, random).map((c, uid) => ({ ...c, uid })),
    open: [], // uids face up waiting to be checked (0-2)
    matched: [],
    moves: 0,
    done: false,
  };
}

/**
 * Turn a card over. Returns { state, result }: result is 'open' (first card),
 * 'match', 'miss' (both stay up until hideMiss) or 'ignored'.
 */
export function flipCard(state, uid) {
  if (state.done || state.open.length >= 2 || state.open.includes(uid) || state.matched.includes(uid)) return { state, result: 'ignored' };
  const open = [...state.open, uid];
  if (open.length === 1) return { state: { ...state, open }, result: 'open' };
  const [a, b] = open.map((id) => state.cards[id]);
  const moves = state.moves + 1;
  if (a.pair === b.pair) {
    const matched = [...state.matched, ...open];
    return { state: { ...state, open: [], matched, moves, done: matched.length === state.cards.length }, result: 'match' };
  }
  return { state: { ...state, open, moves }, result: 'miss' };
}

/** After a miss the two cards turn back over. */
export const hideMiss = (state) => ({ ...state, open: [] });

/** Stars from the number of tries compared with the pairs (a perfect game is one try per pair). */
export function pairStars(moves, pairs) {
  if (moves <= Math.ceil(pairs * 1.6)) return 3;
  if (moves <= pairs * 2.4) return 2;
  return 1;
}
