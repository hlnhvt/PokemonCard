import { describe, it, expect } from 'vitest';
import {
  RECIPES,
  INGREDIENTS,
  planOrders,
  shelfFor,
  createKitchen,
  addIngredient,
  nextIngredient,
  showHint,
  stir,
  stirFromAngle,
  angleDelta,
  markCooked,
  serve,
  starsForMistakes,
  sessionBerries as cookingBerries,
  SHELF_SIZE,
  STIR_PER_TAP,
} from './cookingGame';
import {
  PRODUCTS,
  makeOrder,
  totalOf,
  countOf,
  basketMatches,
  addToBasket,
  removeFromBasket,
  answerChoices,
  starsFor,
  describeOrder,
  levelFor,
  sessionBerries as shopBerries,
  CUSTOMERS_PER_SESSION,
} from './shopGame';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('cooking game', () => {
  it('CK-01 every recipe uses known ingredients; sessions start with short recipes', () => {
    for (const r of RECIPES) for (const i of r.ingredients) expect(INGREDIENTS[i]).toBeTruthy();
    const plan = planOrders(seeded(1));
    expect(plan).toHaveLength(5);
    const lengths = plan.map((id) => RECIPES.find((r) => r.id === id).ingredients.length);
    expect(lengths.slice(0, 2).every((n) => n === 3)).toBe(true);
    expect(new Set(plan).size).toBe(5);
  });

  it('CK-02 the shelf holds every needed ingredient plus distractors, no duplicates', () => {
    for (let s = 0; s < 20; s++) {
      for (const r of RECIPES) {
        const shelf = shelfFor(r, seeded(s));
        expect(shelf).toHaveLength(SHELF_SIZE);
        expect(new Set(shelf).size).toBe(SHELF_SIZE);
        for (const i of r.ingredients) expect(shelf).toContain(i);
      }
    }
  });

  it('CK-03 ingredients must follow the recipe order; mistakes are counted and trigger a hint', () => {
    const k = createKitchen({ random: seeded(2), orders: ['poffin'] });
    expect(nextIngredient(k.order)).toBe('flour');
    expect(addIngredient(k, 'milk')).toBe('wrong');
    expect(showHint(k.order)).toBe(false);
    expect(addIngredient(k, 'banana')).toBe('wrong');
    expect(showHint(k.order)).toBe(true);
    expect(addIngredient(k, 'flour')).toBe('added');
    expect(showHint(k.order)).toBe(false);
    addIngredient(k, 'milk');
    expect(addIngredient(k, 'berry')).toBe('added');
    expect(k.order.phase).toBe('stirring');
    expect(addIngredient(k, 'flour')).toBe('ignored');
    expect(k.order.mistakes).toBe(2);
  });

  it('CK-04 stirring by circles or taps, then cooking and serving', () => {
    const k = createKitchen({ random: seeded(3), orders: ['smoothie', 'poffin'] });
    for (const i of ['strawberry', 'banana', 'milk']) addIngredient(k, i);
    expect(stir(k, stirFromAngle(Math.PI * 2))).toBe(false); // one of three circles
    expect(k.order.stir).toBeCloseTo(1 / 3, 5);
    for (let i = 0; i < 10; i++) stir(k, STIR_PER_TAP);
    expect(k.order.phase).toBe('cooking');
    markCooked(k);
    expect(serve(k)).toBe(false);
    expect(k.results).toEqual([{ recipe: 'smoothie', stars: 3 }]);
    expect(k.order.recipe.id).toBe('poffin');
    expect(k.order.phase).toBe('adding');
  });

  it('CK-05 circular swipe angles wrap correctly', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6, 5);
    expect(angleDelta(-3, 3)).toBeCloseTo(6 - 2 * Math.PI, 5);
    expect(angleDelta(0, 1)).toBe(1);
  });

  it('CK-06 stars and session berries; the session ends after the last order', () => {
    expect([starsForMistakes(0), starsForMistakes(2), starsForMistakes(5)]).toEqual([3, 2, 1]);
    const k = createKitchen({ random: seeded(4), orders: ['poffin'] });
    for (const i of ['flour', 'milk', 'berry']) addIngredient(k, i);
    stir(k, 1);
    markCooked(k);
    expect(serve(k)).toBe(true);
    expect(k.order.phase).toBe('done');
    expect(cookingBerries([{ stars: 3 }, { stars: 3 }, { stars: 3 }, { stars: 3 }, { stars: 3 }])).toBe(3);
    expect(cookingBerries([{ stars: 1 }])).toBe(1);
  });
});

describe('shop game', () => {
  it('SH-01 orders follow the level limits and grow harder', () => {
    for (let s = 0; s < 50; s++) {
      for (let c = 0; c < CUSTOMERS_PER_SESSION; c++) {
        const order = makeOrder(c, seeded(s * 10 + c));
        const level = levelFor(c);
        expect(Object.keys(order)).toHaveLength(level.kinds);
        expect(totalOf(order)).toBeLessThanOrEqual(level.maxTotal);
        for (const n of Object.values(order)) expect(n).toBeLessThanOrEqual(level.maxEach);
      }
    }
    expect(levelFor(0).kinds).toBe(1);
    expect(levelFor(99).kinds).toBe(3);
  });

  it('SH-02 totals, counts, basket matching, add and remove', () => {
    const order = { apple: 2, juice: 1 };
    expect(totalOf(order)).toBe(2 * PRODUCTS.apple.price + PRODUCTS.juice.price);
    expect(countOf(order)).toBe(3);
    let basket = {};
    basket = addToBasket(basket, 'apple');
    basket = addToBasket(basket, 'juice');
    expect(basketMatches(order, basket)).toBe(false);
    basket = addToBasket(basket, 'apple');
    expect(basketMatches(order, basket)).toBe(true);
    basket = addToBasket(basket, 'candy');
    expect(basketMatches(order, basket)).toBe(false);
    basket = removeFromBasket(basket, 'candy');
    expect(basketMatches(order, basket)).toBe(true);
    expect(removeFromBasket({ apple: 1 }, 'apple')).toEqual({});
  });

  it('SH-03 three different answer choices including the right one, never below 1', () => {
    for (let s = 0; s < 100; s++) {
      const total = 1 + (s % 10);
      const choices = answerChoices(total, seeded(s));
      expect(choices).toHaveLength(3);
      expect(new Set(choices).size).toBe(3);
      expect(choices).toContain(total);
      expect(Math.min(...choices)).toBeGreaterThanOrEqual(1);
    }
  });

  // Regression: a retry loop never finished when `random` always returned the same value
  it.each([0, 0.3, 0.999])('SH-03b answer choices finish with a constant random (%s)', (r) => {
    for (const total of [1, 2, 5, 10]) {
      const choices = answerChoices(total, () => r);
      expect(new Set(choices).size).toBe(3);
      expect(choices).toContain(total);
    }
  });

  it('SH-04 stars, sentences and session berries', () => {
    expect(starsFor({})).toBe(3);
    expect(starsFor({ basketMistakes: 2 })).toBe(2);
    expect(starsFor({ priceMistakes: 1 })).toBe(2);
    expect(starsFor({ basketMistakes: 1, priceMistakes: 1 })).toBe(1);
    expect(describeOrder({ apple: 2 })).toBe('2 Táo');
    expect(describeOrder({ apple: 2, juice: 1 })).toBe('2 Táo và 1 Nước ép');
    expect(describeOrder({ apple: 1, juice: 1, candy: 1 })).toBe('1 Táo, 1 Nước ép và 1 Kẹo');
    expect(shopBerries(Array(6).fill({ stars: 3 }))).toBe(3);
    expect(shopBerries([{ stars: 1 }])).toBe(1);
  });
});
