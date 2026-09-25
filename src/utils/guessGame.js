// Rules of the "Who's that Pokemon?" silhouette quiz.
import { artworkUrl } from '../services/pokemonOnlineService';

export const ROUNDS = 10;

// Pokemon children are most likely to know, with their National Pokedex numbers
export const POPULAR_POKEMON = [
  ['Bulbasaur', 1], ['Venusaur', 3], ['Charmander', 4], ['Charizard', 6], ['Squirtle', 7], ['Blastoise', 9],
  ['Pikachu', 25], ['Vulpix', 37], ['Jigglypuff', 39], ['Meowth', 52], ['Psyduck', 54], ['Growlithe', 58],
  ['Gengar', 94], ['Magikarp', 129], ['Gyarados', 130], ['Lapras', 131], ['Ditto', 132], ['Eevee', 133],
  ['Snorlax', 143], ['Dragonite', 149], ['Mewtwo', 150], ['Mew', 151], ['Chikorita', 152], ['Cyndaquil', 155],
  ['Totodile', 158], ['Pichu', 172], ['Togepi', 175], ['Marill', 183], ['Umbreon', 197], ['Piplup', 393],
  ['Lucario', 448], ['Greninja', 658], ['Sylveon', 700], ['Rowlet', 722], ['Litten', 725], ['Popplio', 728],
  ['Togedemaru', 777], ['Sprigatito', 906], ['Fuecoco', 909], ['Quaxly', 912],
].map(([name, id]) => ({ key: `p-${id}`, name, pokedexNumber: String(id).padStart(3, '0'), image: artworkUrl(id) }));

/** Build the question pool: the child's own cards first, then well-known Pokemon. */
export function buildPool(collection = []) {
  const seen = new Set();
  const pool = [];
  for (const card of collection) {
    const num = Number(card.pokedexNumber);
    if (!card.name || !(card.fallbackImage || num > 0)) continue;
    const key = `p-${num || card.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({ key, name: card.name, pokedexNumber: card.pokedexNumber, image: card.fallbackImage || artworkUrl(num), owned: true });
  }
  for (const p of POPULAR_POKEMON) {
    if (!seen.has(p.key)) {
      seen.add(p.key);
      pool.push(p);
    }
  }
  return pool;
}

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** One question per round: a target not asked before plus 3 other names, shuffled. */
export function makeQuestion(pool, asked, random = Math.random) {
  const fresh = pool.filter((p) => !asked.has(p.key));
  const candidates = fresh.length > 0 ? fresh : pool;
  // Favour the child's own Pokemon for about half of the questions
  const owned = candidates.filter((p) => p.owned);
  const source = owned.length > 0 && random() < 0.5 ? owned : candidates;
  const target = source[Math.floor(random() * source.length)];
  const others = shuffle(pool.filter((p) => p.key !== target.key && p.name !== target.name), random).slice(0, 3);
  return { target, options: shuffle([target, ...others], random) };
}

export function starsFor(score) {
  if (score >= 8) return 3;
  if (score >= 5) return 2;
  return 1;
}
