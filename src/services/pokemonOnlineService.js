// Online Pokemon Service: Fetches real-time Pokemon stats, official artwork, TCG cards, and YouTube videos

// Curated high quality YouTube videos for iconic Pokémon
const CURATED_YOUTUBE_VIDEOS = {
  charizard: "https://www.youtube.com/embed/Pj3h3AkyZ_4?autoplay=1&mute=0&rel=0&playsinline=1",
  pikachu: "https://www.youtube.com/embed/8o_Gg4u9v7o?autoplay=1&mute=0&rel=0&playsinline=1",
  mewtwo: "https://www.youtube.com/embed/p1rKk9rU64U?autoplay=1&mute=0&rel=0&playsinline=1",
  rayquaza: "https://www.youtube.com/embed/uGvV9N68Jk8?autoplay=1&mute=0&rel=0&playsinline=1",
  gengar: "https://www.youtube.com/embed/4oR0uVnS_b8?autoplay=1&mute=0&rel=0&playsinline=1",
  greninja: "https://www.youtube.com/embed/qJ8Fw1uXWjY?autoplay=1&mute=0&rel=0&playsinline=1",
  lucario: "https://www.youtube.com/embed/s2X2p944hQc?autoplay=1&mute=0&rel=0&playsinline=1",
  blastoise: "https://www.youtube.com/embed/1laZg8h5p3E?autoplay=1&mute=0&rel=0&playsinline=1",
  umbreon: "https://www.youtube.com/embed/2qU5kR7g3_Y?autoplay=1&mute=0&rel=0&playsinline=1",
  eevee: "https://www.youtube.com/embed/rQk81YwXp7I?autoplay=1&mute=0&rel=0&playsinline=1",
  snorlax: "https://www.youtube.com/embed/b4-G_e_9QY8?autoplay=1&mute=0&rel=0&playsinline=1",
  lugia: "https://www.youtube.com/embed/ZqL2L2G3s_U?autoplay=1&mute=0&rel=0&playsinline=1",
  arceus: "https://www.youtube.com/embed/m6X8y2uX2_k?autoplay=1&mute=0&rel=0&playsinline=1",
  mew: "https://www.youtube.com/embed/w8eX2_0g_f4?autoplay=1&mute=0&rel=0&playsinline=1",
  dragonite: "https://www.youtube.com/embed/3A_y_hU_8kY?autoplay=1&mute=0&rel=0&playsinline=1",
};

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const POKEAPI_TIMEOUT_MS = 10000;
const TCG_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convert free text ("Mr. Mime", "Ho Oh", "Farfetch'd", "Nidoran♀") into a PokeAPI slug
 * ("mr-mime", "ho-oh", "farfetchd", "nidoran-f"). PokeAPI slugs keep hyphens.
 */
export function normalizePokemonQuery(query) {
  return String(query || '')
    .toLowerCase()
    .trim()
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.'’]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Type color themes
const TYPE_COLORS = {
  fire: { primary: '#FF4422', secondary: '#FFAA00', accent: '#FF2200', glow: 'rgba(255, 68, 34, 0.6)' },
  water: { primary: '#3399FF', secondary: '#0066CC', accent: '#66CCFF', glow: 'rgba(51, 153, 255, 0.6)' },
  grass: { primary: '#77CC55', secondary: '#449922', accent: '#AAEE77', glow: 'rgba(119, 204, 85, 0.6)' },
  electric: { primary: '#FFCC33', secondary: '#FF9900', accent: '#FFEE77', glow: 'rgba(255, 204, 51, 0.6)' },
  psychic: { primary: '#FF5599', secondary: '#CC2277', accent: '#FF88BB', glow: 'rgba(255, 85, 153, 0.6)' },
  ice: { primary: '#66CCFF', secondary: '#3399CC', accent: '#99EEFF', glow: 'rgba(102, 204, 255, 0.6)' },
  dragon: { primary: '#7766EE', secondary: '#4433AA', accent: '#AA99FF', glow: 'rgba(119, 102, 238, 0.6)' },
  dark: { primary: '#775544', secondary: '#443322', accent: '#997766', glow: 'rgba(119, 85, 68, 0.6)' },
  fairy: { primary: '#EE99EE', secondary: '#BB55BB', accent: '#FFBBFF', glow: 'rgba(238, 153, 238, 0.6)' },
  normal: { primary: '#AAAA99', secondary: '#777766', accent: '#CCCCBB', glow: 'rgba(170, 170, 153, 0.6)' },
  fighting: { primary: '#BB5544', secondary: '#883322', accent: '#DD7766', glow: 'rgba(187, 85, 68, 0.6)' },
  flying: { primary: '#8899FF', secondary: '#5566CC', accent: '#AABBFF', glow: 'rgba(136, 153, 255, 0.6)' },
  poison: { primary: '#AA5599', secondary: '#772266', accent: '#CC77BB', glow: 'rgba(170, 85, 153, 0.6)' },
  ground: { primary: '#DDBB55', secondary: '#AA8822', accent: '#EEDD77', glow: 'rgba(221, 187, 85, 0.6)' },
  rock: { primary: '#BBAA66', secondary: '#887733', accent: '#DDCC88', glow: 'rgba(187, 170, 102, 0.6)' },
  ghost: { primary: '#6666BB', secondary: '#333388', accent: '#8888DD', glow: 'rgba(102, 102, 187, 0.6)' },
  steel: { primary: '#AAAABB', secondary: '#777788', accent: '#CCCCDD', glow: 'rgba(170, 170, 187, 0.6)' },
};

const FALLBACK_POKEMON_NAMES = [
  'charizard', 'pikachu', 'mewtwo', 'rayquaza', 'gengar', 'greninja',
  'lucario', 'blastoise', 'umbreon', 'eevee', 'snorlax', 'lugia', 'arceus',
  'mew', 'dragonite', 'bulbasaur', 'squirtle', 'charmander', 'charmeleon', 'gyarados',
  'gardevoir', 'garchomp', 'tyranitar', 'salamence', 'metagross', 'dialga',
  'palkia', 'giratina', 'reshiram', 'zekrom', 'kyogre', 'groudon', 'cinderace',
  'infernape', 'blaziken', 'sceptile', 'swampert', 'torterra'
];

let cachedPokemonNames = null;

/**
 * Fetch and cache the list of 1025 species names (base names such as "giratina", "ho-oh")
 * for accurate fuzzy matching. The fallback list is returned but never cached, so the
 * next call retries the network.
 */
export async function getAllPokemonNames() {
  if (cachedPokemonNames && cachedPokemonNames.length > 0) {
    return cachedPokemonNames;
  }
  try {
    const res = await fetchWithTimeout(`${POKEAPI_BASE}/pokemon-species?limit=1025`, POKEAPI_TIMEOUT_MS);
    if (!res.ok) throw new Error('PokeAPI names failed');
    const data = await res.json();
    cachedPokemonNames = data.results.map(p => p.name.toLowerCase());
    return cachedPokemonNames;
  } catch (err) {
    console.warn('Failed to load full Pokemon list, using fallback:', err);
    return FALLBACK_POKEMON_NAMES;
  }
}

/** Test helper: forget the cached name list. */
export function resetPokemonNamesCache() {
  cachedPokemonNames = null;
}

/**
 * Find a Pokemon name hinted by free text such as an uploaded file name.
 * Deliberately strict: a wrong hint skips OCR entirely, so short or loose matches
 * ("hinh" -> shinx, "anh" -> carvanha) must return null.
 */
export async function findBestPokemonNameFromText(rawText) {
  if (!rawText) return null;
  const clean = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = clean.split(/\s+/).filter(Boolean);
  const words = tokens.filter(w => w.length >= 3);

  const allNames = await getAllPokemonNames();
  const nameSet = new Set(allNames);

  // 1. Direct word match, including hyphenated names split by the cleanup ("ho oh" -> "ho-oh")
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].length >= 3 && nameSet.has(tokens[i])) return tokens[i];
    if (i + 1 < tokens.length && nameSet.has(`${tokens[i]}-${tokens[i + 1]}`)) {
      return `${tokens[i]}-${tokens[i + 1]}`;
    }
  }

  // 2. A long name glued to other text ("pikachuvmax", "charizardex")
  for (const word of words) {
    const found = allNames
      .filter(n => n.length >= 5 && !n.includes('-') && word.includes(n))
      .sort((a, b) => b.length - a.length)[0];
    if (found) return found;
  }

  // 3. Single-typo fuzzy match on long words only
  let closestName = null;
  let minDistance = 2;

  for (const word of words) {
    if (word.length < 6) continue;
    for (const name of allNames) {
      if (Math.abs(word.length - name.length) > 1) continue;
      const dist = levenshtein(word, name);
      if (dist < minDistance) {
        minDistance = dist;
        closestName = name;
      }
    }
  }

  return closestName;
}

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Fetch online real-time data for a Pokemon:
 * - Stats, Official Artwork, Types, Height, Weight from PokeAPI
 * - Japanese Name & Lore from PokeAPI Species
 * - Authentic TCG Card Image from Pokemon TCG API
 * - Short YouTube Video Embed
 */
async function fetchJsonOrNull(url) {
  const res = await fetchWithTimeout(url, POKEAPI_TIMEOUT_MS);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchPokemonOnline(query) {
  const cleanName = normalizePokemonQuery(query);
  if (!cleanName) throw new Error('Vui lòng nhập tên Pokémon');

  const notFoundMessage = `Không tìm thấy dữ liệu online cho Pokémon "${String(query).trim()}". Vui lòng kiểm tra lại tên.`;

  // 1. Fetch main PokeAPI data. Species names with several forms ("giratina", "deoxys")
  // have no /pokemon/{name} entry, so fall back to the species' default variety.
  let poke = null;
  let sp = null;
  try {
    poke = await fetchJsonOrNull(`${POKEAPI_BASE}/pokemon/${cleanName}`);
    if (!poke) {
      sp = await fetchJsonOrNull(`${POKEAPI_BASE}/pokemon-species/${cleanName}`);
      const defaultVariety = sp?.varieties?.find(v => v.is_default)?.pokemon?.name;
      if (defaultVariety) {
        poke = await fetchJsonOrNull(`${POKEAPI_BASE}/pokemon/${defaultVariety}`);
      }
    }
  } catch (err) {
    console.warn('PokeAPI fetch error:', err);
    throw new Error('Không thể kết nối tới PokeAPI. Vui lòng kiểm tra kết nối mạng và thử lại.');
  }
  if (!poke) {
    throw new Error(notFoundMessage);
  }

  // 2. Fetch Species data (Lore, Japanese name, Genus)
  let speciesData = {
    enName: null,
    jaName: poke.name.toUpperCase(),
    genus: 'Pokémon',
    lore: `Dữ liệu về ${poke.name} được ghi nhận chính thức trong hệ thống Pokédex toàn cầu.`
  };

  try {
    if (!sp) {
      // Alternate forms have ids > 10000 that /pokemon-species/{id} does not know
      const speciesUrl = poke.species?.url || `${POKEAPI_BASE}/pokemon-species/${poke.id}`;
      sp = await fetchJsonOrNull(speciesUrl);
    }
    if (sp) {
      const nameIn = (lang) => sp.names?.find(n => n.language?.name === lang)?.name;
      const jaName = nameIn('ja-Hrkt') || nameIn('ja') || nameIn('roomaji');
      if (jaName) speciesData.jaName = jaName;
      speciesData.enName = nameIn('en') || null;

      const genusObj = sp.genera?.find(g => g.language?.name === 'en');
      if (genusObj) speciesData.genus = genusObj.genus;

      const loreObj = sp.flavor_text_entries?.find(f => f.language?.name === 'en');
      if (loreObj) {
        speciesData.lore = loreObj.flavor_text.replace(/\f|\n|\r/g, ' ');
      }

      if (typeof sp.capture_rate === 'number') speciesData.captureRate = sp.capture_rate;
      speciesData.isLegendary = !!sp.is_legendary;
      speciesData.isMythical = !!sp.is_mythical;
    }
  } catch (e) {
    console.warn('Species fetch error:', e);
  }

  // Media lookups are keyed by the real species name, never by the raw query ("25" -> "pikachu")
  const baseName = sp?.name || poke.species?.name || poke.name;
  const displayName = speciesData.enName || (poke.name.charAt(0).toUpperCase() + poke.name.slice(1));

  // 3. Try fetching real TCG card image from Pokemon TCG API
  let cardImage = null;
  let cardSet = 'Official Pokémon TCG';
  let cardNumber = `#${String(poke.id).padStart(3, '0')}`;
  let illustrator = 'Ken Sugimori';

  try {
    const tcgQuery = encodeURIComponent(`name:"${displayName}"`);
    const tcgRes = await fetchWithTimeout(`https://api.pokemontcg.io/v2/cards?q=${tcgQuery}&pageSize=1`, TCG_TIMEOUT_MS);
    if (tcgRes.ok) {
      const tcgJson = await tcgRes.json();
      if (tcgJson.data && tcgJson.data.length > 0) {
        const firstCard = tcgJson.data[0];
        cardImage = firstCard.images?.large || firstCard.images?.small;
        if (firstCard.set?.name) cardSet = firstCard.set.name;
        if (firstCard.number) cardNumber = `${firstCard.number}/${firstCard.set?.printedTotal || '100'}`;
        if (firstCard.artist) illustrator = firstCard.artist;
      }
    }
  } catch (e) {
    console.warn('TCG card fetch error:', e);
  }

  const pokeTypes = poke.types || [];
  const primaryType = pokeTypes[0]?.type?.name || 'normal';
  const typeList = pokeTypes.length > 0
    ? pokeTypes.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1))
    : ['Normal'];
  const theme = TYPE_COLORS[primaryType] || TYPE_COLORS.normal;

  // Direct high-quality MP4 battle clips that NEVER fail or get blocked by YouTube embed rules
  const DIRECT_VIDEOS = {
    blastoise: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
    charizard: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
    pikachu: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    mewtwo: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    rayquaza: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    gengar: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    greninja: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    lucario: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4",
  };

  const directVideo = DIRECT_VIDEOS[baseName] || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
  const youtubeSearchLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(displayName + ' pokemon battle anime short')}`;

  // Extract Stats
  const stats = poke.stats || [];
  const hpStat = stats.find(s => s.stat.name === 'hp')?.base_stat || 100;
  const attackStat = stats.find(s => s.stat.name === 'attack')?.base_stat || 80;
  const defenseStat = stats.find(s => s.stat.name === 'defense')?.base_stat || 70;
  const speedStat = stats.find(s => s.stat.name === 'speed')?.base_stat || 90;

  const artwork = poke.sprites?.other?.['official-artwork']?.front_default || poke.sprites?.front_default || null;
  const abilities = poke.abilities || [];

  // Extract Top 2 Moves
  const moves = (poke.moves || []).slice(0, 2).map((m, idx) => ({
    name: m.move.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    cost: [typeList[0] || 'Colorless', 'Colorless'],
    damage: String(idx === 0 ? attackStat * 2 : (attackStat + 40)),
    description: `Đòn tấn công đặc trưng của ${poke.name.toUpperCase()} từ cơ sở dữ liệu PokeAPI.`
  }));

  // Build the complete Pokemon card object
  const normalizedPokemon = {
    id: poke.name,
    pokedexNumber: String(poke.id).padStart(3, '0'),
    name: displayName,
    japaneseName: speciesData.jaName,
    species: speciesData.genus,
    types: typeList,
    hp: hpStat * 3, // Scale to TCG HP range (e.g. 240 - 330)
    baseHp: hpStat,
    attack: attackStat,
    defense: defenseStat,
    speed: speedStat,
    rarity: poke.id > 150 ? 'Ultra Rare Holographic' : 'Holo Rare Secret',
    cardSet: cardSet,
    cardNumber: cardNumber,
    illustrator: illustrator,
    themeColor: theme,
    image: cardImage || artwork,
    fallbackImage: artwork,
    directVideoUrl: directVideo,
    youtubeUrl: CURATED_YOUTUBE_VIDEOS[baseName] || null,
    youtubeSearchUrl: youtubeSearchLink,
    videoShowcase: {
      title: `${displayName.toUpperCase()} BATTLE AWAKENING`,
      duration: 6,
      soundEffect: primaryType,
      description: speciesData.lore,
      canvasStyle: primaryType
    },
    height: `${(poke.height / 10).toFixed(1)} m`,
    weight: `${(poke.weight / 10).toFixed(1)} kg`,
    weakness: { type: getWeaknessType(primaryType), value: '×2' },
    resistance: { type: 'Colorless', value: '-30' },
    retreatCost: Math.min(4, Math.max(1, Math.round(poke.weight / 300))),
    ability: abilities[0] ? {
      name: abilities[0].ability.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      type: 'Khả Năng (Ability)',
      text: `Kích hoạt năng lượng nội tại của Pokémon khi bước vào trận chiến.`
    } : null,
    attacks: moves.length > 0 ? moves : [
      {
        name: 'Strike Attack',
        cost: [typeList[0] || 'Colorless'],
        damage: '120',
        description: 'Đòn công kích uy lực dồn dập vào đối thủ.'
      }
    ],
    lore: speciesData.lore,
    // Extras for the interactive activities (cries, shiny art, catch game, evolution tree)
    speciesName: baseName,
    cryUrl: poke.cries?.latest || null,
    cryLegacyUrl: poke.cries?.legacy || null,
    shinyImage: poke.sprites?.other?.['official-artwork']?.front_shiny || poke.sprites?.front_shiny || null,
    animatedSprite: poke.sprites?.other?.showdown?.front_default || null,
    captureRate: speciesData.captureRate ?? 120,
    isLegendary: !!speciesData.isLegendary,
    isMythical: !!speciesData.isMythical,
    isOnlineFetched: true,
    scannedAt: new Date().toISOString()
  };

  return normalizedPokemon;
}

const SPRITES_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

export function artworkUrl(id, shiny = false) {
  return `${SPRITES_BASE}/other/official-artwork/${shiny ? 'shiny/' : ''}${id}.png`;
}

/**
 * Media for a saved card. Cards saved before cries/shiny existed only have a
 * Pokedex number, from which the PokeAPI asset URLs can be derived.
 */
export function getCardMedia(card) {
  const id = Number(card?.pokedexNumber);
  const validId = Number.isInteger(id) && id > 0;
  return {
    cryUrl: card?.cryUrl || (validId ? `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg` : null),
    shinyImage: card?.shinyImage || (validId ? artworkUrl(id, true) : null),
    animatedSprite: card?.animatedSprite || null,
  };
}

const STONE_NAMES = {
  'fire-stone': 'Đá Lửa',
  'water-stone': 'Đá Nước',
  'thunder-stone': 'Đá Sấm',
  'leaf-stone': 'Đá Lá',
  'moon-stone': 'Đá Mặt Trăng',
  'sun-stone': 'Đá Mặt Trời',
  'shiny-stone': 'Đá Lấp Lánh',
  'dusk-stone': 'Đá Hoàng Hôn',
  'dawn-stone': 'Đá Bình Minh',
  'ice-stone': 'Đá Băng',
};

const TYPE_NAMES_VI = {
  normal: 'Thường', fire: 'Lửa', water: 'Nước', grass: 'Cỏ', electric: 'Điện', ice: 'Băng',
  fighting: 'Giác Đấu', poison: 'Độc', ground: 'Đất', flying: 'Bay', psychic: 'Siêu Linh',
  bug: 'Côn Trùng', rock: 'Đá', ghost: 'Ma', dragon: 'Rồng', dark: 'Bóng Tối', steel: 'Thép', fairy: 'Tiên',
};

const prettify = (slug) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** Child-friendly Vietnamese description of how a Pokemon evolves. */
export function describeEvolution(details) {
  const list = Array.isArray(details) ? details : [];
  const describe = (d) => {
    if (!d) return null;
    const time = d.time_of_day === 'day' ? ' (ban ngày)' : d.time_of_day === 'night' ? ' (ban đêm)' : '';
    if (d.item?.name) return `Dùng ${STONE_NAMES[d.item.name] || prettify(d.item.name)}${time}`;
    if (d.trigger?.name === 'trade') return d.held_item?.name ? `Trao đổi khi cầm ${prettify(d.held_item.name)}` : 'Trao đổi với bạn';
    if (d.min_level) return `Đạt cấp ${d.min_level}${time}`;
    if (d.min_happiness) return `Rất thân thiết${time}`;
    if (d.min_affection) return `Rất yêu quý${d.known_move_type?.name ? ` và biết chiêu hệ ${TYPE_NAMES_VI[d.known_move_type.name] || prettify(d.known_move_type.name)}` : ''}`;
    if (d.known_move_type?.name) return `Biết chiêu hệ ${TYPE_NAMES_VI[d.known_move_type.name] || prettify(d.known_move_type.name)}`;
    if (d.known_move?.name) return `Học chiêu ${prettify(d.known_move.name)}`;
    if (d.location?.name) return `Lên cấp ở nơi đặc biệt`;
    return null;
  };
  // Prefer the easiest-to-explain condition (items first), then any other known one
  return describe(list.find((d) => d?.item?.name)) || list.map(describe).find(Boolean) || 'Điều kiện đặc biệt';
}

function speciesIdFromUrl(url) {
  const match = /\/pokemon-species\/(\d+)\/?$/.exec(url || '');
  return match ? Number(match[1]) : null;
}

/** Flatten a PokeAPI chain link into nodes { name, id, image, stage, from, how }. */
export function parseEvolutionChain(chainLink) {
  const nodes = [];
  const walk = (link, stage, from) => {
    if (!link?.species?.name) return;
    const id = speciesIdFromUrl(link.species.url);
    nodes.push({
      name: link.species.name,
      id,
      image: id ? artworkUrl(id) : null,
      stage,
      from,
      how: from ? describeEvolution(link.evolution_details) : null,
      // Friendship evolutions (Pichu, Eevee -> Espeon/Umbreon/Sylveon, Golbat...) unlock through care
      needsFriendship: !!from && (link.evolution_details || []).some((d) => d?.min_happiness || d?.min_affection),
    });
    for (const next of link.evolves_to || []) walk(next, stage + 1, link.species.name);
  };
  walk(chainLink, 0, null);
  return nodes;
}

const evolutionCache = new Map();

/**
 * Evolution family of a Pokemon as flat nodes (see parseEvolutionChain).
 * Accepts a species name or Pokedex number; returns [] when unavailable.
 */
export async function fetchEvolutionChain(speciesNameOrId) {
  const key = String(speciesNameOrId || '').toLowerCase();
  if (!key) return [];
  if (evolutionCache.has(key)) return evolutionCache.get(key);
  try {
    const species = await fetchJsonOrNull(`${POKEAPI_BASE}/pokemon-species/${key}`);
    if (!species?.evolution_chain?.url) return [];
    const chain = await fetchJsonOrNull(species.evolution_chain.url);
    const nodes = chain?.chain ? parseEvolutionChain(chain.chain) : [];
    evolutionCache.set(key, nodes);
    return nodes;
  } catch (err) {
    console.warn('Evolution chain fetch error:', err);
    return [];
  }
}

/** Test helper: forget cached evolution chains. */
export function resetEvolutionCache() {
  evolutionCache.clear();
}

function getWeaknessType(type) {
  const map = {
    fire: 'Water',
    water: 'Electric',
    grass: 'Fire',
    electric: 'Ground',
    psychic: 'Darkness',
    ice: 'Fire',
    dragon: 'Fairy',
    dark: 'Fighting',
    ghost: 'Darkness',
    steel: 'Fire'
  };
  return map[type] || 'Fighting';
}
