// "Tiệm Pizza Pokémon" – static data: menu, toppings, upgrades, staff roles, shop layout.
// Pure data (no three.js, no DOM). World: x right, y up, z towards the camera; yaw 0 faces -z.

export const PIZZA3D_GAME = 'pizza3d';
export const DAY_LEN = 180; // seconds of opening time per day
export const CLOSING_MAX = 40; // after closing, orders in progress may still be finished for this long
export const START_MONEY = 60;

/** Ingredients the child taps. Base items first, then toppings (unlocked by recipes). */
export const INGREDIENTS = {
  dough: { id: 'dough', name: 'Đế bột', icon: '🫓', color: '#f6d9a0' },
  sauce: { id: 'sauce', name: 'Sốt cà chua', icon: '🍅', color: '#e2412f' },
  cheese: { id: 'cheese', name: 'Phô mai', icon: '🧀', color: '#ffd84a' },
  sausage: { id: 'sausage', name: 'Xúc xích', icon: '🌭', color: '#c8432f' },
  mushroom: { id: 'mushroom', name: 'Nấm', icon: '🍄', color: '#e8d6c0' },
  pepper: { id: 'pepper', name: 'Ớt chuông', icon: '🫑', color: '#3fae4a' },
  pineapple: { id: 'pineapple', name: 'Dứa', icon: '🍍', color: '#ffd23f' },
  oran: { id: 'oran', name: 'Quả Oran', icon: '🫐', color: '#3f6fe0' },
};
export const BASE_ITEMS = ['dough', 'sauce', 'cheese'];
export const TOPPINGS = ['sausage', 'mushroom', 'pepper', 'pineapple', 'oran'];

/** Menu. The first two are known from day 1; the rest are bought in the shop (menu grows, prices rise). */
export const RECIPES = [
  { id: 'cheese', name: 'Pizza phô mai', toppings: [], price: 12, cost: 0, icon: '🧀' },
  { id: 'sausage', name: 'Pizza xúc xích', toppings: ['sausage'], price: 16, cost: 0, icon: '🌭' },
  { id: 'mushroom', name: 'Pizza nấm', toppings: ['mushroom'], price: 19, cost: 140, icon: '🍄' },
  { id: 'veggie', name: 'Pizza rau củ', toppings: ['pepper', 'mushroom'], price: 24, cost: 240, icon: '🫑' },
  { id: 'hawaii', name: 'Pizza Hawaii', toppings: ['pineapple', 'sausage'], price: 29, cost: 360, icon: '🍍' },
  { id: 'oran', name: 'Pizza quả Oran', toppings: ['oran', 'pineapple'], price: 35, cost: 500, icon: '🫐' },
  { id: 'special', name: 'Pizza Pikachu đặc biệt', toppings: ['sausage', 'mushroom', 'pepper', 'oran'], price: 46, cost: 700, icon: '⚡', needs: 'expand' },
];
export const START_RECIPES = ['cheese', 'sausage'];
export const recipeById = (id) => RECIPES.find((r) => r.id === id) || RECIPES[0];
/** What the pizza must contain, in the order the child should tap. */
export const recipeSteps = (recipe) => [...BASE_ITEMS, ...recipe.toppings];

/**
 * Shop upgrades. `costs[i]` buys level i+1. Effects are read through helpers below.
 * decor = points that bring more customers, bigger tips and more patience.
 */
export const UPGRADES = [
  { id: 'oven', name: 'Lò nướng nhanh', icon: '🔥', desc: 'Nướng bánh nhanh hơn', costs: [160, 320, 560] },
  { id: 'oven2', name: 'Lò nướng thứ 2', icon: '🧱', desc: 'Nướng 2 bánh cùng lúc', costs: [420] },
  { id: 'register2', name: 'Quầy thu ngân 2', icon: '🛎️', desc: 'Nhận order 2 khách cùng lúc', costs: [300] },
  { id: 'tables', name: 'Bàn ghế ăn tại chỗ', icon: '🪑', desc: 'Khách ngồi ăn, trả thêm tiền nước', costs: [180, 240, 320, 400, 480, 560], maxBefore: 2 },
  { id: 'lights', name: 'Đèn lồng ấm áp', icon: '🏮', desc: 'Trang trí: khách vui, tip nhiều hơn', costs: [130], decor: 1 },
  { id: 'plants', name: 'Chậu cây xanh', icon: '🪴', desc: 'Trang trí: khách kiên nhẫn hơn', costs: [160], decor: 1 },
  { id: 'posters', name: 'Poster Pokémon', icon: '🖼️', desc: 'Trang trí: nhiều khách ghé hơn', costs: [220], decor: 1 },
  { id: 'sign', name: 'Biển hiệu lấp lánh', icon: '🪧', desc: 'Khách từ xa thấy tiệm, ghé đông hơn', costs: [300], decor: 1.5 },
  { id: 'expand', name: 'Mở rộng tiệm', icon: '🏗️', desc: 'Thêm phòng ăn, hàng chờ dài hơn, thuê thêm người', costs: [1100] },
];
export const upgradeById = (id) => UPGRADES.find((u) => u.id === id);

/** Staff roles: hire price, salary per day (grows with level), work speed by level. */
export const ROLES = {
  cashier: { id: 'cashier', name: 'Thu ngân', icon: '💁', desc: 'Tự nhận order và thu tiền', hire: 240, salary: 25, salaryPerLevel: 8 },
  chef: { id: 'chef', name: 'Đầu bếp', icon: '👨‍🍳', desc: 'Tự làm bánh và nướng bánh', hire: 360, salary: 38, salaryPerLevel: 10 },
  waiter: { id: 'waiter', name: 'Phục vụ', icon: '🧑‍🍳', desc: 'Đóng hộp, giao bánh, dọn bàn', hire: 260, salary: 26, salaryPerLevel: 7 },
};
export const ROLE_IDS = ['cashier', 'chef', 'waiter'];
export const STAFF_MAX_LEVEL = 5;
export const levelUpCost = (level) => 150 * level;
export const salaryOf = (member) => {
  const r = ROLES[member.role];
  return r.salary + r.salaryPerLevel * (member.level - 1);
};
/** Work speed multiplier of a staff level (1 → 1, 5 → 2.2). */
export const speedOf = (level) => 1 + 0.3 * (level - 1);

/** The eight 3D Pokémon models (shared look with obby3d's racers). */
export const SPECIES = [
  { id: 'pikachu', name: 'Pikachu', dex: 25, type: 'Electric' },
  { id: 'jigglypuff', name: 'Jigglypuff', dex: 39, type: 'Fairy' },
  { id: 'psyduck', name: 'Psyduck', dex: 54, type: 'Water' },
  { id: 'bulbasaur', name: 'Bulbasaur', dex: 1, type: 'Grass' },
  { id: 'squirtle', name: 'Squirtle', dex: 7, type: 'Water' },
  { id: 'charmander', name: 'Charmander', dex: 4, type: 'Fire' },
  { id: 'eevee', name: 'Eevee', dex: 133, type: 'Normal' },
  { id: 'piplup', name: 'Piplup', dex: 393, type: 'Water' },
];
export const speciesById = (id) => SPECIES.find((s) => s.id === id) || null;

/** Species id for a card name ("Pikachu V" → pikachu), or null. */
export function speciesOf(name) {
  const n = String(name || '').toLowerCase();
  const hit = SPECIES.find((sp) => new RegExp(`(^|[^a-z])${sp.id}([^a-z]|$)`).test(n));
  return hit ? hit.id : null;
}

// ---------------------------------------------------------------- layout (metres)
// Characters are ~1.1 tall. The room is a cut-away dollhouse: the camera looks in from the front (+z).
export const LAYOUT = {
  room: { x0: -4, x1: 4, z0: -6, z1: 3 },
  expandZ0: -9.4, // back wall after "Mở rộng tiệm"
  counter: { x0: -1.5, x1: 4, z: -1.0, depth: 0.7, h: 0.62 },
  outside: { x: 5.8, z: -4.6 },
  door: { x: 4, z: -4.6 },
  inside: { x: 3.2, z: -4.6 },
  registers: [{ x: 2.7 }, { x: 0.8 }],
  custZ: -1.75, // customers stand here at the counter
  staffZ: -0.4, // staff stand here behind the counter
  pickupX: -0.85,
  prep: [
    { x: -0.3, z: 1.75 },
    { x: 2.3, z: 1.75 },
  ],
  cookZ: 1.05, // cooks stand here, facing the camera, the table in front of them
  ovens: [
    { x: -3.35, z: 0.35 },
    { x: -3.35, z: 2.05 },
  ],
  ovenStandX: -2.45,
  gapK: { x: -2.75, z: -0.35 },
  gapF: { x: -2.75, z: -1.65 },
  queue: [
    { x: 2.7, z: -2.75 },
    { x: 2.35, z: -3.55 },
    { x: 1.7, z: -4.2 },
    { x: 0.9, z: -4.65 },
    { x: 0.05, z: -5.05 },
    { x: -0.8, z: -5.35 },
    { x: -1.6, z: -5.45 },
  ],
  queueBase: 5,
  wait: [
    { x: -0.85, z: -2.35 },
    { x: -0.1, z: -2.65 },
    { x: -1.5, z: -2.85 },
    { x: -0.65, z: -3.25 },
    { x: 0.6, z: -3.05 },
    { x: -1.25, z: -3.65 },
    { x: 0.1, z: -3.75 },
    { x: -2.0, z: -2.2 },
  ],
  tables: [
    { x: -2.8, z: -3.1 },
    { x: -2.8, z: -4.85 },
    { x: -2.6, z: -7.0 },
    { x: -0.2, z: -7.0 },
    { x: 2.2, z: -7.0 },
    { x: -1.4, z: -8.55 },
  ],
};
