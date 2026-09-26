import { describe, it, expect, beforeEach } from 'vitest';
import { getGold, addGold, spendGold, STARTER_GOLD, goldForMatch, goldForStars } from './gold';
import { ITEMS, CATEGORIES, applyItem, DAILY_TREAT_LIMIT, roomItems, wornItem, itemById } from './shopItems';
import { getBag, buyItem, giveItem } from './inventory';
import { saveCardToPokedex, getSavedCollection } from './storage';
import { MAX_FRIENDSHIP } from './friendship';

const card = (extra = {}) => ({ id: 'pikachu', name: 'Pikachu', pokedexNumber: '025', friendship: 10, ...extra });
const DAY1 = new Date(2026, 8, 26, 10);
const DAY2 = new Date(2026, 8, 27, 10);

beforeEach(() => localStorage.clear());

describe('gold', () => {
  it('GD-01 starter gold, add and spend; never below zero', () => {
    expect(getGold()).toBe(STARTER_GOLD);
    expect(addGold(15)).toBe(STARTER_GOLD + 15);
    expect(spendGold(10)).toBe(STARTER_GOLD + 5);
    expect(spendGold(1000)).toBeNull();
    expect(getGold()).toBe(STARTER_GOLD + 5);
    expect(addGold(-50)).toBe(STARTER_GOLD + 5);
  });

  it('GD-02 rewards: losing still pays, stars pay 5 each (at least 1 star)', () => {
    expect([goldForMatch('win'), goldForMatch('draw'), goldForMatch('lose')]).toEqual([15, 10, 5]);
    expect([goldForStars(0), goldForStars(1), goldForStars(3)]).toEqual([5, 5, 15]);
  });

  it('GD-03 a broken value in storage reads as zero', () => {
    localStorage.setItem('pokescan_gold_v1', 'abc');
    expect(getGold()).toBe(0);
  });
});

describe('shop items', () => {
  it('SI-01 catalogue: 3 categories, unique ids, prices and gains positive', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(['food', 'toy', 'decor']);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const c of CATEGORIES) expect(ITEMS.filter((i) => i.category === c.id).length).toBeGreaterThanOrEqual(5);
    for (const i of ITEMS) {
      expect(i.price).toBeGreaterThan(0);
      expect(i.gain).toBeGreaterThan(0);
    }
  });

  it('SI-02 food raises friendship up to the daily treat limit', () => {
    let c = card();
    for (let n = 0; n < DAILY_TREAT_LIMIT; n++) {
      const out = applyItem(c, 'cookie', DAY1);
      expect(out.result).toBe('ok');
      expect(out.consumes).toBe(true);
      c = out.card;
    }
    expect(c.friendship).toBe(10 + 4 * DAILY_TREAT_LIMIT);
    expect(applyItem(c, 'cake', DAY1).result).toBe('full');
    expect(applyItem(c, 'cake', DAY2).result).toBe('ok');
  });

  it('SI-03 each toy once per day per Pokemon, and toys are not used up', () => {
    const first = applyItem(card(), 'ball', DAY1);
    expect(first).toMatchObject({ result: 'ok', consumes: false, gain: 3 });
    expect(applyItem(first.card, 'ball', DAY1).result).toBe('played');
    expect(applyItem(first.card, 'kite', DAY1).result).toBe('ok');
    expect(applyItem(first.card, 'ball', DAY2).result).toBe('ok');
  });

  it('SI-04 decor: kept for good, bonus only the first time; wearing switches', () => {
    const bow = applyItem(card(), 'bow', DAY1);
    expect(bow).toMatchObject({ result: 'ok', consumes: true, gain: 8 });
    expect(wornItem(bow.card).id).toBe('bow');
    const crown = applyItem(bow.card, 'crown', DAY1);
    expect(wornItem(crown.card).id).toBe('crown');
    const back = applyItem(crown.card, 'bow', DAY1);
    expect(back).toMatchObject({ result: 'ok', consumes: false, gain: 0 });
    expect(wornItem(back.card).id).toBe('bow');
    const bed = applyItem(back.card, 'bed', DAY1);
    expect(roomItems(bed.card).map((i) => i.id)).toEqual(['bed']);
    expect(applyItem(bed.card, 'bed', DAY1).result).toBe('owned');
  });

  it('SI-05 friendship is capped and level-ups are reported', () => {
    const out = applyItem(card({ friendship: 18 }), 'cake', DAY1);
    expect(out.levelUp?.label).toBe('Bạn bè');
    expect(applyItem(card({ friendship: MAX_FRIENDSHIP - 2 }), 'cake', DAY1).gain).toBe(2);
    expect(applyItem(card(), 'nope', DAY1).result).toBe('unknown');
  });
});

describe('bag', () => {
  it('BG-01 buying spends gold; not enough gold buys nothing; toys only once', () => {
    addGold(100); // 120
    expect(buyItem('cake')).toMatchObject({ result: 'ok', gold: 95, bag: { cake: 1 } });
    expect(buyItem('cake').bag).toEqual({ cake: 2 });
    expect(buyItem('ball').result).toBe('ok');
    expect(buyItem('ball').result).toBe('owned');
    const before = getGold();
    expect(buyItem('house').result).toBe(before >= itemById('house').price ? 'ok' : 'poor');
    expect(buyItem('house')).toMatchObject({ result: 'poor' });
  });

  it('BG-02 giving uses up food and decor, keeps toys, and saves the Pokemon', () => {
    saveCardToPokedex(card());
    addGold(200);
    buyItem('cookie');
    buyItem('ball');
    buyItem('bow');
    expect(giveItem('pikachu', 'cookie', DAY1)).toMatchObject({ result: 'ok', gain: 4 });
    expect(giveItem('pikachu', 'ball', DAY1).result).toBe('ok');
    expect(giveItem('pikachu', 'bow', DAY1).result).toBe('ok');
    expect(getBag()).toEqual({ ball: 1 });
    const saved = getSavedCollection()[0];
    expect(saved.friendship).toBe(10 + 4 + 3 + 8);
    expect(saved.wearing).toBe('bow');
    expect(giveItem('pikachu', 'cookie', DAY1).result).toBe('empty');
    expect(giveItem('mew', 'ball', DAY1).result).toBe('notFound');
    expect(giveItem('pikachu', 'ball', DAY1)).toMatchObject({ result: 'played', bag: { ball: 1 } });
  });

  it('BG-03 a broken bag in storage reads as empty; unknown ids are dropped', () => {
    localStorage.setItem('pokescan_bag_v1', '{"cake":2,"ghost":5,"apple":-1}');
    expect(getBag()).toEqual({ cake: 2 });
    localStorage.setItem('pokescan_bag_v1', 'not json');
    expect(getBag()).toEqual({});
  });
});
