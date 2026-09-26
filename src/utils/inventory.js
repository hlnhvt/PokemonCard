// The child's bag of shop items ({ itemId: count }), shared by all their Pokemon.
import { itemById, applyItem } from './shopItems';
import { spendGold, addGold, getGold } from './gold';
import { getSavedCollection } from './storage';

const STORAGE_KEY = 'pokescan_bag_v1';
const SAVED_CARDS_KEY = 'pokescan_saved_cards_v1';

function clean(bag) {
  const result = {};
  for (const [id, n] of Object.entries(bag || {})) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    if (count > 0 && itemById(id)) result[id] = count;
  }
  return result;
}

export function getBag() {
  try {
    return clean(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return {};
  }
}

function saveBag(bag) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean(bag)));
    return true;
  } catch (err) {
    console.error('Failed to save bag:', err);
    return false;
  }
}

/** Toys are bought once; food and decor can be bought again. */
export const canBuyMore = (itemId, bag = getBag()) => itemById(itemId)?.category !== 'toy' || !bag[itemId];

/**
 * Buy one item with gold. Returns { result: 'ok', gold, bag } or
 * { result: 'poor' | 'owned' | 'unknown' | 'error', gold, bag }.
 */
export function buyItem(itemId) {
  const item = itemById(itemId);
  const bag = getBag();
  if (!item) return { result: 'unknown', gold: getGold(), bag };
  if (!canBuyMore(itemId, bag)) return { result: 'owned', gold: getGold(), bag };
  const gold = spendGold(item.price);
  if (gold == null) return { result: 'poor', gold: getGold(), bag };
  const next = { ...bag, [itemId]: (bag[itemId] || 0) + 1 };
  if (!saveBag(next)) {
    addGold(item.price); // refund
    return { result: 'error', gold: getGold(), bag };
  }
  return { result: 'ok', gold, bag: next };
}

/**
 * Give an item from the bag to a saved Pokemon.
 * Returns applyItem's outcome plus `bag`, or { result: 'notFound' | 'empty' | 'error' }.
 */
export function giveItem(cardId, itemId, now = new Date()) {
  const list = getSavedCollection();
  const index = list.findIndex((c) => c.id === cardId);
  if (index < 0) return { result: 'notFound' };
  const bag = getBag();
  if (!bag[itemId]) return { result: 'empty' };
  const outcome = applyItem(list[index], itemId, now);
  if (outcome.result !== 'ok') return { ...outcome, bag };
  const nextBag = outcome.consumes ? { ...bag, [itemId]: bag[itemId] - 1 } : bag;
  if (outcome.consumes && !saveBag(nextBag)) return { result: 'error' };
  try {
    const updated = [...list];
    updated[index] = outcome.card;
    localStorage.setItem(SAVED_CARDS_KEY, JSON.stringify(updated));
    return { ...outcome, bag: clean(nextBag) };
  } catch (err) {
    console.error('Failed to give item:', err);
    if (outcome.consumes) saveBag(bag); // put the item back
    return { result: 'error' };
  }
}
