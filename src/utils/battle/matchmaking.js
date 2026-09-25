// Choose a wild opponent of similar strength to the child's Pokemon.
import { baseStatTotal } from './engine';
import { effectiveness } from './typeChart';

const bstOf = (p) => p.bst ?? (p.stats ? baseStatTotal(p.stats) : 400);
const sameSpecies = (a, b) => String(a.name || '').toLowerCase() === String(b.name || '').toLowerCase();

/** True when one of the opponent's own types hits the player super effectively. */
export function hasTypeAdvantage(opponent, player) {
  return (opponent.types || []).some((t) => effectiveness(t, player.types || []) >= 2);
}

/**
 * Candidates within 25% of the player's base stat total; when fewer than 4 exist
 * (very weak or very strong Pokemon), the 6 closest ones. Opponents whose type beats the
 * child's Pokemon are skipped when others remain, so the child is never outmatched by type
 * from the start. Returns one at random.
 */
export function pickOpponent(player, pool, random = Math.random) {
  const target = bstOf(player);
  const others = pool.filter((p) => !sameSpecies(p, player));
  let candidates = others.filter((p) => Math.abs(bstOf(p) - target) / target <= 0.25);
  if (candidates.length < 4) {
    candidates = [...others].sort((a, b) => Math.abs(bstOf(a) - target) - Math.abs(bstOf(b) - target)).slice(0, 6);
  }
  const fair = candidates.filter((p) => !hasTypeAdvantage(p, player));
  if (fair.length > 0) candidates = fair;
  return candidates[Math.floor(random() * candidates.length) % candidates.length];
}
