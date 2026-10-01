// "Tiệm Pizza Pokémon" – the persistent shop (money, upgrades, menu, staff) and what it buys.
// Pure functions: every change returns a new shop object.
import { RECIPES, START_RECIPES, START_MONEY, UPGRADES, ROLES, ROLE_IDS, STAFF_MAX_LEVEL, SPECIES, upgradeById, levelUpCost, salaryOf, speciesById } from './data';

export function newShop() {
  return {
    v: 1,
    day: 1,
    money: START_MONEY,
    up: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
    recipes: [...START_RECIPES],
    staff: [],
    nextStaffId: 1,
    rep: 2, // satisfaction stars of recent days (0..3)
    history: [],
    totals: { served: 0, earned: 0, days: 0 },
  };
}

const lvl = (shop, id) => shop.up[id] || 0;
export const hasExpand = (shop) => lvl(shop, 'expand') > 0;
export const registerCount = (shop) => 1 + lvl(shop, 'register2');
export const ovenCount = (shop) => 1 + lvl(shop, 'oven2');
export const tableCount = (shop) => lvl(shop, 'tables');
export const queueCap = (shop) => (hasExpand(shop) ? 7 : 5);
/** Bake time in seconds by oven level. */
export const bakeTime = (shop) => [8.5, 7, 5.6, 4.4][lvl(shop, 'oven')] ?? 4.4;
export const decorPoints = (shop) => UPGRADES.reduce((n, u) => n + (u.decor ? u.decor * lvl(shop, u.id) : 0), 0);
export const staffMax = (shop, role) => (role === 'cashier' ? registerCount(shop) : hasExpand(shop) ? 2 : 1);
export const salaries = (shop) => shop.staff.reduce((n, m) => n + salaryOf(m), 0);
export const menuOf = (shop) => RECIPES.filter((r) => shop.recipes.includes(r.id));
export const toppingsOf = (shop) => [...new Set(menuOf(shop).flatMap((r) => r.toppings))];

/** Customers per minute multiplier from decor, menu size, days open and reputation. */
export function crowdOf(shop) {
  const decor = decorPoints(shop);
  return 1 + 0.08 * decor + 0.06 * Math.max(0, shop.recipes.length - 2) + 0.025 * Math.min(12, shop.day - 1) + 0.08 * (shop.rep - 2) + (hasExpand(shop) ? 0.15 : 0);
}

/** Everything on sale right now, with prices and why it is locked. */
export function shopItems(shop) {
  const out = [];
  for (const u of UPGRADES) {
    const level = lvl(shop, u.id);
    const max = u.costs.length;
    let locked = null;
    if (u.maxBefore != null && level >= u.maxBefore && !hasExpand(shop) && level < max) locked = 'Cần mở rộng tiệm';
    out.push({ key: `up:${u.id}`, tab: 'up', id: u.id, name: u.name, icon: u.icon, desc: u.desc, level, max, cost: level < max ? u.costs[level] : null, owned: level >= max, locked });
  }
  for (const r of RECIPES) {
    if (START_RECIPES.includes(r.id)) continue;
    const owned = shop.recipes.includes(r.id);
    const locked = r.needs === 'expand' && !hasExpand(shop) ? 'Cần mở rộng tiệm' : null;
    out.push({ key: `menu:${r.id}`, tab: 'menu', id: r.id, name: r.name, icon: r.icon, desc: `Giá bán ${r.price} xu`, cost: owned ? null : r.cost, owned, locked, toppings: r.toppings, price: r.price });
  }
  for (const role of ROLE_IDS) {
    const R = ROLES[role];
    const have = shop.staff.filter((m) => m.role === role).length;
    const max = staffMax(shop, role);
    const locked = have < max ? null : have >= 2 ? 'Đủ người rồi' : role === 'cashier' ? 'Cần quầy thu ngân 2' : 'Cần mở rộng tiệm';
    out.push({ key: `hire:${role}`, tab: 'staff', id: role, name: `Thuê ${R.name.toLowerCase()}`, icon: R.icon, desc: `${R.desc} · lương ${R.salary} xu/ngày`, cost: R.hire, owned: false, locked, have, max });
  }
  for (const m of shop.staff) {
    const owned = m.level >= STAFF_MAX_LEVEL;
    out.push({ key: `level:${m.id}`, tab: 'staff', id: m.id, staff: m, name: `${m.name} · ${ROLES[m.role].name}`, icon: ROLES[m.role].icon, desc: `Cấp ${m.level} · lương ${salaryOf(m)} xu/ngày`, cost: owned ? null : levelUpCost(m.level), owned, locked: null, level: m.level, max: STAFF_MAX_LEVEL });
  }
  return out;
}

/** Species for a new staff member: one that is not the child's and not already working here if possible. */
function pickStaffLook(shop, random, playerSpecies) {
  const used = new Set([playerSpecies, ...shop.staff.map((m) => m.species)]);
  const pool = SPECIES.filter((s) => !used.has(s.id));
  const list = pool.length ? pool : SPECIES;
  return list[Math.floor(random() * list.length) % list.length];
}

/**
 * Buy an item by key ('up:oven', 'menu:veggie', 'hire:chef', 'level:3').
 * Returns { ok, shop, reason, item }.
 */
export function buy(shop, key, { random = Math.random, playerSpecies = null } = {}) {
  const item = shopItems(shop).find((i) => i.key === key);
  if (!item) return { ok: false, shop, reason: 'unknown' };
  if (item.owned || item.cost == null) return { ok: false, shop, reason: 'owned', item };
  if (item.locked) return { ok: false, shop, reason: 'locked', item };
  if (shop.money < item.cost) return { ok: false, shop, reason: 'money', item };
  const next = { ...shop, money: shop.money - item.cost, up: { ...shop.up }, recipes: [...shop.recipes], staff: shop.staff.map((m) => ({ ...m })) };
  if (item.tab === 'up') next.up[item.id] = (next.up[item.id] || 0) + 1;
  else if (item.tab === 'menu') next.recipes.push(item.id);
  else if (key.startsWith('hire:')) {
    const sp = pickStaffLook(shop, random, playerSpecies);
    next.staff.push({ id: next.nextStaffId, role: item.id, level: 1, species: sp.id, name: sp.name });
    next.nextStaffId += 1;
  } else if (key.startsWith('level:')) {
    const m = next.staff.find((x) => x.id === item.id);
    m.level += 1;
  }
  return { ok: true, shop: next, item };
}

/** Sanitise a loaded shop (bad storage never crashes the game). */
export function cleanShop(raw) {
  const base = newShop();
  if (!raw || typeof raw !== 'object') return base;
  const num = (v, d, min = 0) => (Number.isFinite(Number(v)) ? Math.max(min, Math.floor(Number(v))) : d);
  const up = { ...base.up };
  for (const u of UPGRADES) up[u.id] = Math.min(u.costs.length, num(raw.up?.[u.id], 0));
  const recipes = [...new Set([...START_RECIPES, ...(Array.isArray(raw.recipes) ? raw.recipes : [])])].filter((id) => RECIPES.some((r) => r.id === id));
  const staff = (Array.isArray(raw.staff) ? raw.staff : [])
    .filter((m) => m && ROLES[m.role] && speciesById(m.species))
    .slice(0, 6)
    .map((m, i) => ({ id: num(m.id, i + 1, 1), role: m.role, level: Math.min(STAFF_MAX_LEVEL, num(m.level, 1, 1)), species: m.species, name: String(m.name || speciesById(m.species).name).slice(0, 24) }));
  const history = (Array.isArray(raw.history) ? raw.history : []).slice(-30).map((h) => ({ day: num(h?.day, 0), served: num(h?.served, 0), profit: Math.floor(Number(h?.profit) || 0), stars: Math.min(3, num(h?.stars, 0)) }));
  return {
    ...base,
    day: num(raw.day, 1, 1),
    money: num(raw.money, START_MONEY),
    up,
    recipes,
    staff,
    nextStaffId: Math.max(num(raw.nextStaffId, 1, 1), ...staff.map((m) => m.id + 1)),
    rep: Math.min(3, Math.max(0, Number(raw.rep) || 2)),
    history,
    totals: { served: num(raw.totals?.served, 0), earned: num(raw.totals?.earned, 0), days: num(raw.totals?.days, 0) },
  };
}

export { upgradeById, salaryOf, levelUpCost };
