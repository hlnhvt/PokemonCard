// Items of the quest: healing, revives, Rare Candy, evolution stones and charms (small
// permanent bonuses for the whole team). Loot drops on the ground with a light beam in the
// colour of its rarity; walking over it picks it up.

export const RARITY = {
  common: { label: 'Thường', color: '#e2e8f0' },
  uncommon: { label: 'Tốt', color: '#4ade80' },
  rare: { label: 'Hiếm', color: '#60a5fa' },
  epic: { label: 'Quý', color: '#c084fc' },
  legendary: { label: 'Huyền thoại', color: '#fbbf24' },
};

export const ITEMS = {
  berry: { name: 'Quả Oran', desc: 'Hồi 30% máu cả đội', rarity: 'common', heal: 0.3, price: 10 },
  potion: { name: 'Thuốc hồi máu', desc: 'Hồi 55% máu cả đội', rarity: 'common', heal: 0.55, price: 25 },
  superPotion: { name: 'Siêu thuốc', desc: 'Hồi đầy máu cả đội', rarity: 'uncommon', heal: 1, price: 60 },
  revive: { name: 'Hồi sinh', desc: 'Gọi lại Pokémon đã mệt (một nửa máu)', rarity: 'uncommon', revive: 0.5, price: 70 },
  candy: { name: 'Kẹo hiếm', desc: 'Pokémon dẫn đầu lên 1 cấp', rarity: 'rare', price: 250 },
  stone: { name: 'Đá tiến hóa', desc: 'Pokémon dẫn đầu tiến hóa ngay', rarity: 'epic', price: null },
  charmAtk: { name: 'Vòng Sức Mạnh', desc: '+5% sức đánh cả đội', rarity: 'epic', charm: 'atk', price: null },
  charmHp: { name: 'Bùa Hộ Thân', desc: '+5% máu cả đội', rarity: 'epic', charm: 'hp', price: null },
  charmSpeed: { name: 'Lông Vũ Gió', desc: '+3% tốc độ cả đội', rarity: 'rare', charm: 'speed', price: null },
};

export const SHOP = ['berry', 'potion', 'superPotion', 'revive', 'candy'];
export const HEAL_ORDER = ['berry', 'potion', 'superPotion'];
export const MAX_CHARMS = 10;
export const STARTING_ITEMS = { berry: 3, potion: 2, revive: 1 };

/** Loot of a knocked-out wild Pokemon: [{ kind: 'coin', amount } | { kind: 'item', item }]. */
export function rollDrops(enemy, rnd) {
  const out = [];
  const lv = enemy.level;
  if (enemy.boss) {
    out.push({ kind: 'coin', amount: 30 + lv * 3 });
    out.push({ kind: 'coin', amount: 20 + lv * 2 });
    out.push({ kind: 'coin', amount: 20 + lv * 2 });
    out.push({ kind: 'item', item: 'candy' }, { kind: 'item', item: 'candy' }, { kind: 'item', item: 'stone' });
    out.push({ kind: 'item', item: rnd() < 0.5 ? 'charmAtk' : 'charmHp' });
    out.push({ kind: 'item', item: 'superPotion' }, { kind: 'item', item: 'revive' });
    return out;
  }
  if (enemy.elite) {
    out.push({ kind: 'coin', amount: 6 + Math.round(lv * 0.8) });
    const r = rnd();
    if (r < 0.1) out.push({ kind: 'item', item: 'candy' });
    else if (r < 0.18) out.push({ kind: 'item', item: ['charmAtk', 'charmHp', 'charmSpeed'][Math.floor(rnd() * 3)] });
    else if (r < 0.5) out.push({ kind: 'item', item: lv > 12 && rnd() < 0.5 ? 'superPotion' : 'potion' });
    else if (r < 0.62) out.push({ kind: 'item', item: 'revive' });
    return out;
  }
  if (rnd() < 0.5) out.push({ kind: 'coin', amount: 1 + Math.round(lv / 4 + rnd() * 2) });
  const r = rnd();
  if (r < 0.07) out.push({ kind: 'item', item: 'berry' });
  else if (r < 0.11) out.push({ kind: 'item', item: 'potion' });
  else if (r < 0.125 && lv > 12) out.push({ kind: 'item', item: 'superPotion' });
  else if (r < 0.135) out.push({ kind: 'item', item: 'revive' });
  else if (r < 0.14) out.push({ kind: 'item', item: 'candy' });
  else if (r < 0.1425) out.push({ kind: 'item', item: 'charmSpeed' });
  return out;
}

/** Loot of a treasure chest. */
export function rollChest(level, rnd) {
  const out = [{ kind: 'coin', amount: 8 + level * 1.5 }, { kind: 'coin', amount: 5 + level }];
  out.push({ kind: 'item', item: rnd() < 0.5 ? 'berry' : 'potion' });
  const r = rnd();
  if (r < 0.22) out.push({ kind: 'item', item: 'candy' });
  else if (r < 0.34) out.push({ kind: 'item', item: ['charmAtk', 'charmHp', 'charmSpeed'][Math.floor(rnd() * 3)] });
  else if (r < 0.4) out.push({ kind: 'item', item: 'stone' });
  else if (r < 0.7) out.push({ kind: 'item', item: 'revive' });
  return out.map((d) => (d.kind === 'coin' ? { ...d, amount: Math.round(d.amount) } : d));
}

export const rarityOf = (drop) => (drop.kind === 'coin' ? 'legendary' : ITEMS[drop.item]?.rarity || 'common');

// ---------- the app's own gold (a small reward for playing, never a gold mine) ----------

export const GOLD_PER_HOUR = 150;
const LOCAL_TO_REWARD = 0.1; // 10 quest gold picked up = 1 app gold
const ACT_CLEAR_REWARD = 12;
const ALLOWANCE = 5; // a little is allowed at once so the first batch is not zero

/** Quest gold was picked up: part of it becomes app gold, paid later in batches. */
export function earnReward(reward, localGold) {
  reward.earned += localGold * LOCAL_TO_REWARD;
}
export function earnActClear(reward) {
  reward.earned += ACT_CLEAR_REWARD;
}

/**
 * How much app gold can be paid now (whole coins): what was earned and not paid yet, but
 * never more than GOLD_PER_HOUR for each hour played. Marks it as paid.
 */
export function claimReward(reward) {
  const cap = Math.floor((GOLD_PER_HOUR * reward.playSeconds) / 3600) + ALLOWANCE;
  const owed = Math.floor(reward.earned) - reward.paid;
  const pay = Math.max(0, Math.min(owed, cap - reward.paid));
  reward.paid += pay;
  return pay;
}
