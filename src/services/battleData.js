// Downloads everything a battle needs for one Pokemon (full base stats + 4 real moves),
// with an in-memory and localStorage cache so rematches work offline.
import { artworkUrl, normalizePokemonQuery } from './pokemonOnlineService';
import { levelUpCandidates, parseMove, selectMoves, fallbackMoves } from '../utils/battle/moves';

const API = 'https://pokeapi.co/api/v2';
const CACHE_KEY = 'pokescan_battle_cache_v1';
// Per request, counted from when it actually starts (not while waiting for a free slot)
const TIMEOUT_MS = 10000;
// A 5 vs 5 battle needs ~150 requests (10 Pokemon + their move details). Letting them all
// start at once made some time out while still queued in the browser, so at most
// MAX_PARALLEL run together and the Pokemon themselves go ahead of move details.
const MAX_PARALLEL = 6;
const RETRIES = 2;
const memory = new Map();

class NotFoundError extends Error {}

// ---- A small queue: Pokemon requests (priority 0) before move details (priority 1)
let running = 0;
const waiting = [];
function runNext() {
  while (running < MAX_PARALLEL && waiting.length) {
    waiting.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    const job = waiting.shift();
    running += 1;
    job
      .task()
      .then(job.resolve, job.reject)
      .finally(() => {
        running -= 1;
        runNext();
      });
  }
}
let seq = 0;
const queued = (task, priority) =>
  new Promise((resolve, reject) => {
    waiting.push({ task, priority, seq: seq++, resolve, reject });
    runNext();
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** JSON of a PokeAPI url. Throws NotFoundError for 404, other errors for network trouble (after retries). */
async function getJson(url, { priority = 1, retries = RETRIES } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await queued(async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const res = await fetch(url, { signal: controller.signal });
          if (res.status === 404) throw new NotFoundError(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        } finally {
          clearTimeout(timer);
        }
      }, priority);
    } catch (err) {
      if (err instanceof NotFoundError || attempt >= retries) throw err;
      await sleep(400 * (attempt + 1));
    }
  }
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeCache(keys, value) {
  try {
    const cache = readCache();
    for (const key of keys) cache[key] = value;
    // Keep the cache small: at most 80 entries
    const all = Object.keys(cache);
    for (let i = 0; i < all.length - 80; i++) delete cache[all[i]];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // cache is optional
  }
}

const statOf = (poke, name, fallback) => poke.stats?.find((s) => s.stat?.name === name)?.base_stat || fallback;

/**
 * Ways to look a saved card up in PokeAPI, most reliable first. The Pokedex number always
 * works; the species name does not for Pokemon with forms (species "giratina" is the
 * Pokemon "giratina-altered", "mimikyu" is "mimikyu-disguised"...).
 */
export function battleQueriesFor(card) {
  const num = Number(card?.pokedexNumber);
  const list = [num >= 1 && num <= 1025 ? num : null, card?.id, card?.speciesName, card?.name];
  const seen = new Set();
  return list.filter((q) => {
    const key = normalizePokemonQuery(q);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function download(key) {
  const poke = await getJson(`${API}/pokemon/${key}`, { priority: 0 });
  const types = (poke.types || []).map((t) => t.type.name);
  let moves;
  try {
    const candidates = levelUpCandidates(poke.moves);
    // A move that cannot be downloaded is skipped, the others are still used
    const details = await Promise.all(candidates.map((c) => getJson(c.url, { retries: 1 }).catch(() => null)));
    moves = selectMoves(details.map(parseMove), types);
  } catch {
    moves = fallbackMoves(types);
  }
  return {
    key: poke.name,
    name: poke.name.charAt(0).toUpperCase() + poke.name.slice(1),
    id: poke.id,
    types: types.length ? types : ['normal'],
    stats: {
      hp: statOf(poke, 'hp', 60),
      attack: statOf(poke, 'attack', 60),
      defense: statOf(poke, 'defense', 60),
      spAttack: statOf(poke, 'special-attack', 60),
      spDefense: statOf(poke, 'special-defense', 60),
      speed: statOf(poke, 'speed', 60),
    },
    moves,
    image: poke.sprites?.other?.['official-artwork']?.front_default || artworkUrl(poke.id),
    shinyImage: poke.sprites?.other?.['official-artwork']?.front_shiny || null,
  };
}

/**
 * Battle data for a Pokemon: a name/slug, a Pokedex number, a list of those (tried in
 * order), or a saved card (see battleQueriesFor):
 * { key, name, id, types, stats: { hp, attack, defense, spAttack, spDefense, speed }, moves, image, shinyImage }
 * Throws with a message saying whether the Pokemon was not found or the network failed.
 */
export async function fetchBattlePokemon(query) {
  const queries = (Array.isArray(query) ? query : query && typeof query === 'object' ? battleQueriesFor(query) : [query])
    .map(normalizePokemonQuery)
    .filter(Boolean);
  if (!queries.length) throw new Error('Không có Pokémon để đấu.');

  for (const key of queries) if (memory.has(key)) return memory.get(key);
  const cache = readCache();
  let networkError = null;
  for (const key of queries) {
    try {
      const data = await download(key);
      for (const k of new Set([...queries, key, data.key, String(data.id)])) memory.set(k, data);
      writeCache([key, data.key, String(data.id)], data);
      return data;
    } catch (err) {
      if (!(err instanceof NotFoundError)) networkError = err;
      if (cache[key]) {
        memory.set(key, cache[key]);
        return cache[key];
      }
    }
  }
  if (networkError) throw new Error('Không tải được dữ liệu trận đấu. Kiểm tra mạng rồi thử lại nhé!');
  throw new Error(`Không tìm thấy dữ liệu trận đấu cho "${queries[0]}".`);
}

/** Test helper */
export function resetBattleCache() {
  memory.clear();
  waiting.length = 0;
  running = 0;
}
