// Team members for the 5 vs 5 battle: the same shape whether the Pokemon comes from a
// card scanned just now, one scanned before, or one lent by the game.
import { artworkUrl } from '../../services/pokemonOnlineService';
import { battleQueriesFor } from '../../services/battleData';

const norm = (s) => String(s || '').toLowerCase();

export const SOURCE_BADGE = {
  scan: { text: '📷 Vừa quét', cls: 'bg-rose-500' },
  owned: { text: '⭐ Của bé', cls: 'bg-emerald-500' },
  borrow: { text: '🎲 Mượn', cls: 'bg-amber-500' },
};

export function memberFromCard(card, source = 'owned') {
  const num = Number(card.pokedexNumber);
  return {
    key: `card-${card.id}`,
    name: card.name,
    species: norm(card.speciesName || card.id || card.name),
    image: card.fallbackImage || card.image || (num ? artworkUrl(num) : ''),
    // Pokedex number first: species names fail for Pokemon with forms (giratina, mimikyu...)
    query: battleQueriesFor(card),
    friendship: card.friendship || 0,
    types: (card.types || []).map(norm),
    source,
  };
}

export function memberFromPool(p) {
  return { key: `lend-${norm(p.name)}`, name: p.name, species: norm(p.name), image: artworkUrl(p.id), query: norm(p.name), friendship: 0, bst: p.bst, types: p.types, source: 'borrow' };
}
