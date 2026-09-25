// Downloads everything a battle needs for one Pokemon (full base stats + 4 real moves),
// with an in-memory and localStorage cache so rematches work offline.
import { artworkUrl, normalizePokemonQuery } from './pokemonOnlineService';
import { levelUpCandidates, parseMove, selectMoves, fallbackMoves } from '../utils/battle/moves';

const API = 'https://pokeapi.co/api/v2';
const CACHE_KEY = 'pokescan_battle_cache_v1';
const TIMEOUT_MS = 8000;
const memory = new Map();

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? res.json() : null;
  } finally {
    clearTimeout(timer);
  }
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeCache(key, value) {
  try {
    const cache = readCache();
    cache[key] = value;
    // Keep the cache small: at most 60 Pokemon
    const keys = Object.keys(cache);
    if (keys.length > 60) delete cache[keys[0]];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // cache is optional
  }
}

const statOf = (poke, name, fallback) => poke.stats?.find((s) => s.stat?.name === name)?.base_stat || fallback;

/**
 * Battle data for a Pokemon name/slug or Pokedex number:
 * { key, name, id, types, stats: { hp, attack, defense, spAttack, spDefense, speed }, moves, image, shinyImage }
 * Throws when the Pokemon itself cannot be found and nothing is cached.
 */
export async function fetchBattlePokemon(query) {
  const key = normalizePokemonQuery(query);
  if (!key) throw new Error('Không có Pokémon để đấu.');
  if (memory.has(key)) return memory.get(key);
  const cached = readCache()[key];

  let poke = null;
  try {
    poke = await getJson(`${API}/pokemon/${key}`);
  } catch {
    poke = null;
  }
  if (!poke) {
    if (cached) {
      memory.set(key, cached);
      return cached;
    }
    throw new Error('Không tải được dữ liệu trận đấu. Kiểm tra mạng rồi thử lại nhé!');
  }

  const types = (poke.types || []).map((t) => t.type.name);
  let moves;
  try {
    const candidates = levelUpCandidates(poke.moves);
    const details = await Promise.all(candidates.map((c) => getJson(c.url).catch(() => null)));
    moves = selectMoves(details.map(parseMove), types);
  } catch {
    moves = fallbackMoves(types);
  }

  const data = {
    key,
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
  memory.set(key, data);
  writeCache(key, data);
  return data;
}

/** Test helper */
export function resetBattleCache() {
  memory.clear();
}
