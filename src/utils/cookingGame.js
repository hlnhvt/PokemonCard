// Rules of "Bếp Pokémon": customers order a dish, the child adds the ingredients in the
// recipe's order, stirs the pot and serves. Pure functions, `random` injectable for tests.

export const RECIPES = [
  { id: 'poffin', name: 'Bánh Poffin', dish: '🧁', color: '#f9a8d4', ingredients: ['flour', 'milk', 'berry'] },
  { id: 'smoothie', name: 'Sinh tố quả mọng', dish: '🥤', color: '#f472b6', ingredients: ['strawberry', 'banana', 'milk'] },
  { id: 'sandwich', name: 'Bánh sandwich', dish: '🥪', color: '#fcd34d', ingredients: ['bread', 'lettuce', 'tomato', 'cheese'] },
  { id: 'curry', name: 'Cà ri Pokémon', dish: '🍛', color: '#f59e0b', ingredients: ['rice', 'carrot', 'potato', 'chili'] },
  { id: 'pancake', name: 'Bánh pancake', dish: '🥞', color: '#fbbf24', ingredients: ['egg', 'flour', 'milk', 'honey'] },
  { id: 'soup', name: 'Súp rau củ', dish: '🍲', color: '#86efac', ingredients: ['carrot', 'corn', 'potato', 'onion'] },
];

export const INGREDIENTS = {
  flour: { name: 'Bột mì', emoji: '🌾' },
  milk: { name: 'Sữa', emoji: '🥛' },
  berry: { name: 'Quả Oran', emoji: '🫐' },
  strawberry: { name: 'Dâu tây', emoji: '🍓' },
  banana: { name: 'Chuối', emoji: '🍌' },
  bread: { name: 'Bánh mì', emoji: '🍞' },
  lettuce: { name: 'Rau xà lách', emoji: '🥬' },
  tomato: { name: 'Cà chua', emoji: '🍅' },
  cheese: { name: 'Phô mai', emoji: '🧀' },
  rice: { name: 'Cơm', emoji: '🍚' },
  carrot: { name: 'Cà rốt', emoji: '🥕' },
  potato: { name: 'Khoai tây', emoji: '🥔' },
  chili: { name: 'Ớt', emoji: '🌶️' },
  egg: { name: 'Trứng', emoji: '🥚' },
  honey: { name: 'Mật ong', emoji: '🍯' },
  corn: { name: 'Bắp', emoji: '🌽' },
  onion: { name: 'Hành tây', emoji: '🧅' },
};

export const ORDERS_PER_SESSION = 5;
export const SHELF_SIZE = 8;
// Wrong taps before the right ingredient starts glowing as a hint
export const HINT_AFTER_MISTAKES = 2;
// Stirring: three full circles around the pot, or taps as an easier alternative
export const STIR_TURNS = 3;
export const STIR_PER_TAP = 0.12;

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Orders for a session: short 3-ingredient recipes first, then longer ones, no repeats in a row. */
export function planOrders(random = Math.random, count = ORDERS_PER_SESSION) {
  const easy = shuffle(RECIPES.filter((r) => r.ingredients.length <= 3), random);
  const hard = shuffle(RECIPES.filter((r) => r.ingredients.length > 3), random);
  const ordered = [...easy, ...hard];
  const orders = [];
  for (let i = 0; i < count; i++) orders.push(ordered[i % ordered.length].id);
  return orders;
}

export const recipeById = (id) => RECIPES.find((r) => r.id === id);

/** The shelf always holds every ingredient of the recipe plus distractors, shuffled. */
export function shelfFor(recipe, random = Math.random, size = SHELF_SIZE) {
  const others = shuffle(Object.keys(INGREDIENTS).filter((k) => !recipe.ingredients.includes(k)), random);
  return shuffle([...recipe.ingredients, ...others.slice(0, Math.max(0, size - recipe.ingredients.length))], random);
}

export function createKitchen({ random = Math.random, orders } = {}) {
  const plan = orders || planOrders(random);
  return { plan, index: 0, results: [], order: newOrder(plan[0], random), random };
}

function newOrder(recipeId, random) {
  const recipe = recipeById(recipeId);
  return { recipe, shelf: shelfFor(recipe, random), added: [], mistakes: 0, wrongStreak: 0, stir: 0, phase: 'adding' };
}

/** The ingredient the recipe needs next, or null once everything is in the pot. */
export function nextIngredient(order) {
  return order.recipe.ingredients[order.added.length] || null;
}

/**
 * The child tapped an ingredient. Returns 'added' | 'wrong' | 'ignored'.
 * After the last ingredient the order moves on to stirring.
 */
export function addIngredient(state, ingredient) {
  const order = state.order;
  if (order.phase !== 'adding') return 'ignored';
  if (ingredient !== nextIngredient(order)) {
    order.mistakes += 1;
    order.wrongStreak += 1;
    return 'wrong';
  }
  order.added.push(ingredient);
  order.wrongStreak = 0;
  if (!nextIngredient(order)) order.phase = 'stirring';
  return 'added';
}

export function showHint(order) {
  return order.phase === 'adding' && order.wrongStreak >= HINT_AFTER_MISTAKES;
}

/** Add stirring progress (0..1 of the whole stir). Returns true when stirring is complete. */
export function stir(state, amount) {
  const order = state.order;
  if (order.phase !== 'stirring') return false;
  order.stir = Math.min(1, order.stir + Math.max(0, amount));
  if (order.stir >= 1) order.phase = 'cooking';
  return order.stir >= 1;
}

/** Progress for an angle swept around the pot (radians). */
export function stirFromAngle(radians) {
  return Math.abs(radians) / (STIR_TURNS * 2 * Math.PI);
}

/** Signed smallest angle between two directions, for accumulating circular swipes. */
export function angleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function starsForMistakes(mistakes) {
  if (mistakes === 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}

export function markCooked(state) {
  if (state.order.phase === 'cooking') state.order.phase = 'serving';
}

/** Customer served: record the stars and prepare the next order. Returns true when the session ends. */
export function serve(state) {
  const order = state.order;
  if (order.phase !== 'serving') return false;
  state.results.push({ recipe: order.recipe.id, stars: starsForMistakes(order.mistakes) });
  state.index += 1;
  if (state.index >= state.plan.length) {
    order.phase = 'done';
    return true;
  }
  state.order = newOrder(state.plan[state.index], state.random);
  return false;
}

/** Berries earned for a session: one per 5 stars (15 stars max -> 3 berries), at least 1. */
export function sessionBerries(results) {
  const stars = results.reduce((a, r) => a + r.stars, 0);
  return Math.max(1, Math.floor(stars / 5));
}
