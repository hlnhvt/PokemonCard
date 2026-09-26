// The gift shop: things children buy with gold to make their Pokemon happier.
// - food: eaten once, gives friendship (treat limit per day)
// - toy: kept in the bag; playing gives friendship once per toy per Pokemon per day
// - decor: given to one Pokemon for good (a big friendship bonus the first time);
//   wearables show on the Pokemon, room items around it
import { MAX_FRIENDSHIP, levelFor, dayKey } from './friendship';

export const CATEGORIES = [
  { id: 'food', label: 'Đồ ăn', icon: '🍰' },
  { id: 'toy', label: 'Đồ chơi', icon: '🧸' },
  { id: 'decor', label: 'Vật dụng', icon: '🎀' },
];

export const ITEMS = [
  { id: 'apple', category: 'food', name: 'Táo ngọt', emoji: '🍎', price: 8, gain: 3 },
  { id: 'cookie', category: 'food', name: 'Bánh quy Poké', emoji: '🍪', price: 10, gain: 4 },
  { id: 'honey', category: 'food', name: 'Mật ong', emoji: '🍯', price: 12, gain: 5 },
  { id: 'candy', category: 'food', name: 'Kẹo cầu vồng', emoji: '🍭', price: 15, gain: 6 },
  { id: 'icecream', category: 'food', name: 'Kem mát lạnh', emoji: '🍦', price: 18, gain: 7 },
  { id: 'cake', category: 'food', name: 'Bánh kem', emoji: '🎂', price: 25, gain: 10 },
  { id: 'ball', category: 'toy', name: 'Quả bóng', emoji: '⚽', price: 20, gain: 3 },
  { id: 'balloon', category: 'toy', name: 'Bóng bay', emoji: '🎈', price: 15, gain: 3 },
  { id: 'yoyo', category: 'toy', name: 'Yo-yo', emoji: '🪀', price: 25, gain: 3 },
  { id: 'kite', category: 'toy', name: 'Cánh diều', emoji: '🪁', price: 30, gain: 4 },
  { id: 'teddy', category: 'toy', name: 'Gấu bông', emoji: '🧸', price: 35, gain: 4 },
  { id: 'dice', category: 'toy', name: 'Xúc xắc vui', emoji: '🎲', price: 12, gain: 2 },
  { id: 'bow', category: 'decor', slot: 'wear', name: 'Nơ xinh', emoji: '🎀', price: 30, gain: 8 },
  { id: 'crown', category: 'decor', slot: 'wear', name: 'Vương miện', emoji: '👑', price: 60, gain: 12 },
  { id: 'tophat', category: 'decor', slot: 'wear', name: 'Mũ ảo thuật', emoji: '🎩', price: 45, gain: 10 },
  { id: 'bed', category: 'decor', slot: 'room', name: 'Giường êm', emoji: '🛏️', price: 50, gain: 10 },
  { id: 'plant', category: 'decor', slot: 'room', name: 'Chậu cây', emoji: '🪴', price: 25, gain: 6 },
  { id: 'house', category: 'decor', slot: 'room', name: 'Nhà nhỏ', emoji: '🏠', price: 80, gain: 15 },
];

export const itemById = (id) => ITEMS.find((i) => i.id === id) || null;
export const itemsIn = (category) => ITEMS.filter((i) => i.category === category);

// Treats are on top of the berries' own daily limit
export const DAILY_TREAT_LIMIT = 5;

function withGain(card, gain, patch) {
  const friendship = Number(card.friendship) || 0;
  const next = Math.min(MAX_FRIENDSHIP, friendship + gain);
  const before = levelFor(friendship);
  const after = levelFor(next);
  return {
    card: { ...card, ...patch, friendship: next },
    gain: next - friendship,
    levelUp: after !== before ? after : null,
  };
}

/**
 * Give an item to a saved Pokemon. Pure: returns
 * { result: 'ok' | 'full' | 'played' | 'owned' | 'unknown', card, gain, levelUp, consumes }.
 * `consumes` says whether one item leaves the bag (food and decor do, toys stay).
 */
export function applyItem(card, itemId, now = new Date()) {
  const item = itemById(itemId);
  const none = { card, gain: 0, levelUp: null, consumes: false };
  if (!item) return { ...none, result: 'unknown' };
  const today = dayKey(now);

  if (item.category === 'food') {
    const eaten = card.treats?.day === today ? card.treats.count : 0;
    if (eaten >= DAILY_TREAT_LIMIT) return { ...none, result: 'full' };
    return { ...withGain(card, item.gain, { treats: { day: today, count: eaten + 1 } }), result: 'ok', consumes: true };
  }

  if (item.category === 'toy') {
    const played = card.toyPlay?.day === today ? card.toyPlay.ids : [];
    if (played.includes(item.id)) return { ...none, result: 'played' };
    return { ...withGain(card, item.gain, { toyPlay: { day: today, ids: [...played, item.id] } }), result: 'ok', consumes: false };
  }

  // Decor: kept by this Pokemon; a wearable replaces the one worn before (still owned)
  const owned = card.decor || [];
  if (owned.includes(item.id)) {
    if (item.slot === 'wear' && card.wearing !== item.id) return { ...none, card: { ...card, wearing: item.id }, result: 'ok' };
    return { ...none, result: 'owned' };
  }
  const patch = { decor: [...owned, item.id], ...(item.slot === 'wear' ? { wearing: item.id } : {}) };
  return { ...withGain(card, item.gain, patch), result: 'ok', consumes: true };
}

/** Room items a Pokemon has (for drawing around it). */
export const roomItems = (card) => (card?.decor || []).map(itemById).filter((i) => i && i.slot === 'room');
export const wornItem = (card) => {
  const item = itemById(card?.wearing);
  return item && (card.decor || []).includes(item.id) ? item : null;
};
