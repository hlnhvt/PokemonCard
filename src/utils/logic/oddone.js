// "Cái nào khác loại?": four pictures, three share something, the child finds the odd one.
// Four levels, getting more thoughtful:
//   1. things around the child (fruit, animals, vehicles, red things...)
//   2. Pokemon types (three Fire and one Water)
//   3. numbers (even / odd, bigger than 10)
//   4. evolution families - the odd one often has the SAME type, so colour alone is not enough
// Pure rules; `random` is injectable for tests.
import { artworkUrl } from '../../services/pokemonOnlineService';

export const LEVELS = [
  { id: 'things', title: 'Đồ vật quanh bé', icon: '🧺' },
  { id: 'types', title: 'Hệ Pokémon', icon: '🔥' },
  { id: 'numbers', title: 'Con số', icon: '🔢' },
  { id: 'family', title: 'Họ tiến hóa', icon: '🧬' },
];
export const PER_LEVEL = 3;
export const QUESTIONS = LEVELS.length * PER_LEVEL;

const GROUPS = [
  { tag: 'Trái cây', says: 'đều là trái cây', icon: '🍎', items: ['🍎', '🍌', '🍇', '🍓', '🍉', '🍒', '🍍', '🥝'] },
  { tag: 'Con vật', says: 'đều là con vật', icon: '🐾', items: ['🐶', '🐱', '🐰', '🐻', '🐼', '🦊', '🐯', '🐸'] },
  { tag: 'Xe cộ', says: 'đều là xe cộ', icon: '🚗', items: ['🚗', '🚌', '🚲', '✈️', '🚀', '🚂', '⛵', '🚒'] },
  { tag: 'Quần áo', says: 'đều là quần áo', icon: '👕', items: ['👕', '👖', '🧢', '🧦', '👗', '🧥', '👟', '🧤'] },
  { tag: 'Trên bầu trời', says: 'đều ở trên bầu trời', icon: '☁️', items: ['☀️', '🌙', '⭐', '☁️', '🌈', '⚡'] },
  { tag: 'Rau củ', says: 'đều là rau củ', icon: '🥕', items: ['🥕', '🥦', '🌽', '🍆', '🥔', '🧅'] },
];

// Pokemon with their main type and evolution family (Pokédex numbers)
const P = (name, dex, type, family) => ({ name, dex, type, family });
export const POKEMON = [
  P('Bulbasaur', 1, 'grass', 'bulbasaur'), P('Ivysaur', 2, 'grass', 'bulbasaur'), P('Venusaur', 3, 'grass', 'bulbasaur'),
  P('Charmander', 4, 'fire', 'charmander'), P('Charmeleon', 5, 'fire', 'charmander'), P('Charizard', 6, 'fire', 'charmander'),
  P('Squirtle', 7, 'water', 'squirtle'), P('Wartortle', 8, 'water', 'squirtle'), P('Blastoise', 9, 'water', 'squirtle'),
  P('Pichu', 172, 'electric', 'pikachu'), P('Pikachu', 25, 'electric', 'pikachu'), P('Raichu', 26, 'electric', 'pikachu'),
  P('Gastly', 92, 'ghost', 'gastly'), P('Haunter', 93, 'ghost', 'gastly'), P('Gengar', 94, 'ghost', 'gastly'),
  P('Dratini', 147, 'dragon', 'dratini'), P('Dragonair', 148, 'dragon', 'dratini'), P('Dragonite', 149, 'dragon', 'dratini'),
  P('Geodude', 74, 'rock', 'geodude'), P('Graveler', 75, 'rock', 'geodude'), P('Golem', 76, 'rock', 'geodude'),
  P('Abra', 63, 'psychic', 'abra'), P('Kadabra', 64, 'psychic', 'abra'), P('Alakazam', 65, 'psychic', 'abra'),
  P('Oddish', 43, 'grass', 'oddish'), P('Gloom', 44, 'grass', 'oddish'), P('Vileplume', 45, 'grass', 'oddish'),
  P('Poliwag', 60, 'water', 'poliwag'), P('Poliwhirl', 61, 'water', 'poliwag'), P('Poliwrath', 62, 'water', 'poliwag'),
  P('Vulpix', 37, 'fire', 'vulpix'), P('Growlithe', 58, 'fire', 'growlithe'), P('Ponyta', 77, 'fire', 'ponyta'),
  P('Psyduck', 54, 'water', 'psyduck'), P('Lapras', 131, 'water', 'lapras'), P('Totodile', 158, 'water', 'totodile'),
  P('Chikorita', 152, 'grass', 'chikorita'), P('Bellsprout', 69, 'grass', 'bellsprout'),
  P('Voltorb', 100, 'electric', 'voltorb'), P('Magnemite', 81, 'electric', 'magnemite'),
  P('Misdreavus', 200, 'ghost', 'misdreavus'), P('Shuppet', 353, 'ghost', 'shuppet'), P('Bagon', 371, 'dragon', 'bagon'), P('Gible', 443, 'dragon', 'gible'),
  P('Drowzee', 96, 'psychic', 'drowzee'), P('Natu', 177, 'psychic', 'natu'),
  P('Onix', 95, 'rock', 'onix'), P('Jigglypuff', 39, 'fairy', 'jigglypuff'), P('Clefairy', 35, 'fairy', 'clefairy'), P('Togepi', 175, 'fairy', 'togepi'),
  P('Vaporeon', 134, 'water', 'eevee'), P('Jolteon', 135, 'electric', 'eevee'), P('Flareon', 136, 'fire', 'eevee'),
];
export const TYPE_TAG = { fire: '🔥 Lửa', water: '💧 Nước', grass: '🌿 Cỏ', electric: '⚡ Điện', ghost: '👻 Ma', dragon: '🐉 Rồng', rock: '🪨 Đá', psychic: '🔮 Siêu linh', fairy: '✨ Tiên' };

const pick = (list, random) => list[Math.floor(random() * list.length)];
function sample(list, n, random) {
  const copy = [...list];
  const out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  return out;
}
const pokeItem = (p, tag) => ({ key: `p-${p.dex}`, kind: 'pokemon', label: p.name, image: artworkUrl(p.dex), tag });

function thingsQuestion(random) {
  const [a, b] = sample(GROUPS, 2, random);
  const item = (e, g) => ({ key: `e-${e}`, kind: 'emoji', label: e, emoji: e, tag: `${g.icon} ${g.tag}` });
  return {
    items: [...sample(a.items, 3, random).map((e) => item(e, a)), item(pick(b.items, random), b)],
    rule: `Ba cái kia ${a.says}`,
  };
}

function typesQuestion(random) {
  const types = Object.keys(TYPE_TAG).filter((t) => POKEMON.filter((p) => p.type === t).length >= 3);
  const [main, other] = sample(types, 2, random);
  // Different families where possible, so the three are only alike by type
  const mains = [];
  for (const p of sample(POKEMON.filter((q) => q.type === main), 20, random)) {
    if (mains.length < 3 && !mains.some((m) => m.family === p.family)) mains.push(p);
  }
  while (mains.length < 3) mains.push(pick(POKEMON.filter((q) => q.type === main && !mains.includes(q)), random));
  const odd = pick(POKEMON.filter((q) => q.type === other), random);
  return { items: [...mains.map((p) => pokeItem(p, TYPE_TAG[main])), pokeItem(odd, TYPE_TAG[other])], rule: `Ba bạn kia đều hệ ${TYPE_TAG[main].split(' ')[1]}` };
}

function numbersQuestion(random) {
  const kind = random() < 0.5 ? 'parity' : 'big';
  const used = new Set();
  const num = (ok) => {
    for (;;) {
      const n = 1 + Math.floor(random() * 20);
      if (!used.has(n) && ok(n)) {
        used.add(n);
        return n;
      }
    }
  };
  if (kind === 'parity') {
    const even = random() < 0.5;
    const same = (n) => (n % 2 === 0) === even;
    const items = [0, 1, 2].map(() => num(same)).map((n) => ({ key: `n-${n}`, kind: 'number', label: String(n), value: n, tag: even ? 'Số chẵn' : 'Số lẻ' }));
    const o = num((n) => !same(n));
    return { items: [...items, { key: `n-${o}`, kind: 'number', label: String(o), value: o, tag: even ? 'Số lẻ' : 'Số chẵn' }], rule: `Ba số kia đều là số ${even ? 'chẵn' : 'lẻ'}` };
  }
  const items = [0, 1, 2].map(() => num((n) => n > 10)).map((n) => ({ key: `n-${n}`, kind: 'number', label: String(n), value: n, tag: 'Lớn hơn 10' }));
  const o = num((n) => n <= 10);
  return { items: [...items, { key: `n-${o}`, kind: 'number', label: String(o), value: o, tag: 'Không lớn hơn 10' }], rule: 'Ba số kia đều lớn hơn 10' };
}

function familyQuestion(random) {
  const families = [...new Set(POKEMON.map((p) => p.family))].filter((f) => POKEMON.filter((p) => p.family === f).length === 3 && f !== 'eevee');
  const fam = pick(families, random);
  const members = POKEMON.filter((p) => p.family === fam);
  // The odd one: same type if possible (so only the family tells them apart)
  const sameType = POKEMON.filter((p) => p.type === members[0].type && p.family !== fam);
  const odd = pick(sameType.length && random() < 0.8 ? sameType : POKEMON.filter((p) => p.family !== fam), random);
  const tag = `🧬 Họ ${members[0].name}`;
  return { items: [...members.map((p) => pokeItem(p, tag)), pokeItem(odd, odd.family === 'eevee' ? '🧬 Họ Eevee' : `🧬 Họ ${POKEMON.find((p) => p.family === odd.family).name}`)], rule: `Ba bạn kia cùng một họ tiến hóa: ${members.map((m) => m.name).join(' → ')}` };
}

const MAKERS = { things: thingsQuestion, types: typesQuestion, numbers: numbersQuestion, family: familyQuestion };

/** One question of a level: 4 items shuffled, `odd` is the index of the odd one. */
export function makeQuestion(levelIndex, random = Math.random) {
  const q = MAKERS[LEVELS[levelIndex].id](random);
  const oddItem = q.items[3];
  const items = sample(q.items, 4, random);
  return { level: levelIndex, items, odd: items.indexOf(oddItem), rule: q.rule, groupTag: q.items[0].tag, oddTag: oddItem.tag };
}

export function createOddGame(random = Math.random) {
  const questions = [];
  LEVELS.forEach((_, lv) => {
    for (let i = 0; i < PER_LEVEL; i++) questions.push(makeQuestion(lv, random));
  });
  return { questions, index: 0, mistakes: 0, tries: 0, wrong: [], status: 'ask' }; // ask | right | done
}

/** The child taps item `i`. Wrong taps are marked and counted; the right one reveals the rule. */
export function answer(game, i) {
  if (game.status !== 'ask' || game.wrong.includes(i)) return { game, result: 'ignored' };
  const q = game.questions[game.index];
  if (i === q.odd) return { game: { ...game, status: 'right' }, result: 'right' };
  return { game: { ...game, mistakes: game.mistakes + 1, wrong: [...game.wrong, i] }, result: 'wrong' };
}

/** On to the next question (or the end). `levelUp` tells the screen to celebrate a new level. */
export function nextQuestion(game) {
  const index = game.index + 1;
  if (index >= game.questions.length) return { game: { ...game, status: 'done' }, levelUp: false };
  return { game: { ...game, index, wrong: [], status: 'ask' }, levelUp: index % PER_LEVEL === 0 };
}

/** 3 stars for 0-2 mistakes, 2 for up to 5, else 1. */
export const oddStars = (mistakes) => (mistakes <= 2 ? 3 : mistakes <= 5 ? 2 : 1);
