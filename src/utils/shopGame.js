// Rules of "Cửa hàng Pokémon": customers ask for items, the child fills the basket and
// works out the total price (counting and small additions). Pure, `random` injectable.

export const PRODUCTS = {
  apple: { name: 'Táo', emoji: '🍎', price: 1 },
  banana: { name: 'Chuối', emoji: '🍌', price: 2 },
  cookie: { name: 'Bánh quy', emoji: '🍪', price: 2 },
  juice: { name: 'Nước ép', emoji: '🧃', price: 3 },
  candy: { name: 'Kẹo', emoji: '🍬', price: 1 },
  icecream: { name: 'Kem', emoji: '🍦', price: 4 },
  ball: { name: 'Bóng', emoji: '⚽', price: 5 },
  balloon: { name: 'Bóng bay', emoji: '🎈', price: 3 },
};
export const PRODUCT_IDS = Object.keys(PRODUCTS);
export const CUSTOMERS_PER_SESSION = 6;

// Difficulty by customer number: kinds of items, how many of each, highest total
const LEVELS = [
  { kinds: 1, maxEach: 2, maxTotal: 5 },
  { kinds: 1, maxEach: 3, maxTotal: 6 },
  { kinds: 2, maxEach: 1, maxTotal: 7 },
  { kinds: 2, maxEach: 2, maxTotal: 9 },
  { kinds: 2, maxEach: 2, maxTotal: 10 },
  { kinds: 3, maxEach: 1, maxTotal: 10 },
];

export const levelFor = (customerIndex) => LEVELS[Math.min(customerIndex, LEVELS.length - 1)];

/** Total price of an order or basket: { productId: count }. */
export function totalOf(items) {
  return Object.entries(items).reduce((sum, [id, n]) => sum + (PRODUCTS[id]?.price || 0) * n, 0);
}

export function countOf(items) {
  return Object.values(items).reduce((a, n) => a + n, 0);
}

/** A random order that respects the level's limits. */
export function makeOrder(customerIndex, random = Math.random) {
  const level = levelFor(customerIndex);
  for (let attempt = 0; attempt < 50; attempt++) {
    const pool = [...PRODUCT_IDS];
    const order = {};
    for (let k = 0; k < level.kinds; k++) {
      const id = pool.splice(Math.floor(random() * pool.length), 1)[0];
      order[id] = 1 + Math.floor(random() * level.maxEach);
    }
    if (totalOf(order) <= level.maxTotal) return order;
  }
  return { apple: 1 };
}

/** True when the basket holds exactly what the customer asked for. */
export function basketMatches(order, basket) {
  const ids = new Set([...Object.keys(order), ...Object.keys(basket)]);
  for (const id of ids) if ((order[id] || 0) !== (basket[id] || 0)) return false;
  return true;
}

export function addToBasket(basket, id) {
  return { ...basket, [id]: (basket[id] || 0) + 1 };
}

export function removeFromBasket(basket, id) {
  const next = { ...basket };
  if (next[id] > 1) next[id] -= 1;
  else delete next[id];
  return next;
}

/** Three different answers for "how much?", including the right one, all at least 1. */
export function answerChoices(total, random = Math.random) {
  // Shuffle the offsets once and take the first valid ones: always terminates, whatever
  // `random` returns (a retry loop never finished with a constant random)
  const offsets = [-2, -1, 1, 2, 3];
  for (let i = offsets.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [offsets[i], offsets[j]] = [offsets[j], offsets[i]];
  }
  const wrong = offsets.map((o) => total + o).filter((v) => v >= 1).slice(0, 2);
  const list = [total, ...wrong];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Stars for one customer: wrong basket items and wrong price answers each cost a little. */
export function starsFor({ basketMistakes = 0, priceMistakes = 0 }) {
  const m = basketMistakes + priceMistakes * 2;
  if (m === 0) return 3;
  if (m <= 2) return 2;
  return 1;
}

/** Child-friendly sentence for an order, e.g. "2 Táo và 1 Nước ép". */
export function describeOrder(order) {
  const parts = Object.entries(order).map(([id, n]) => `${n} ${PRODUCTS[id].name}`);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} và ${parts[parts.length - 1]}`;
}

/** Berries for a session: one per 6 stars (18 max -> 3), at least 1. */
export function sessionBerries(results) {
  const stars = results.reduce((a, r) => a + r.stars, 0);
  return Math.max(1, Math.floor(stars / 6));
}
