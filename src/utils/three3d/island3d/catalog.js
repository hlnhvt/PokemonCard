// Blocks, decorations, paints and wishes of "Đảo nhà Pokémon" (pure data, no three.js).

/** Island size in blocks: W (x) × H (y, up) × D (z). */
export const W = 24;
export const H = 12;
export const D = 24;

/** Cell values: 0 = air, 1..63 = blocks, 64.. = decorations. */
export const AIR = 0;
export const DECOR_BASE = 64;

// Block ids
export const GRASS = 1;
export const DIRT = 2;
export const SAND = 3;
export const STONE = 4;
export const WOOD = 5;
export const LEAVES = 6;
export const GLASS = 7;
export const WATER = 8;
export const BRICK = 9;
export const LAMP = 10;
export const WOOL = 11;
export const SNOW = 12;
export const ICE = 13;
export const PINKWOOD = 14;
export const MUSHROOM = 15;
export const GOLD = 16;
export const RAINBOW = 17;
export const CANDY = 18;

/**
 * Block palette. `top`/`side` are the main colours (palette swatches and the pixel-art textures),
 * `see` = see-through (drawn in the transparent pass), `glow` = shines at night.
 */
export const BLOCKS = [
  { id: GRASS, name: 'Cỏ', top: '#6cc24a', side: '#9b6b3f' },
  { id: DIRT, name: 'Đất', top: '#9b6b3f', side: '#8a5d35' },
  { id: SAND, name: 'Cát', top: '#f2dc9b', side: '#e8cd85' },
  { id: STONE, name: 'Đá', top: '#9ca3af', side: '#8b929c' },
  { id: WOOD, name: 'Gỗ', top: '#c99a5b', side: '#b5844a' },
  { id: LEAVES, name: 'Lá cây', top: '#3f9d48', side: '#3a8f42' },
  { id: GLASS, name: 'Kính', top: '#d6f3ff', side: '#c4ecff', see: true },
  { id: WATER, name: 'Nước', top: '#3aa7e8', side: '#2f95d6', see: true },
  { id: BRICK, name: 'Gạch', top: '#c8553d', side: '#b9472f' },
  { id: LAMP, name: 'Đèn', top: '#ffe58a', side: '#ffd34d', glow: true },
  { id: WOOL, name: 'Len màu', top: '#f8fafc', side: '#eef2f7' },
  { id: SNOW, name: 'Tuyết', top: '#ffffff', side: '#e9f1f8' },
  { id: ICE, name: 'Băng', top: '#a5dcf7', side: '#93d0f0', see: true },
  { id: PINKWOOD, name: 'Gỗ hồng', top: '#f4a6c4', side: '#e88fb2' },
  { id: MUSHROOM, name: 'Nấm', top: '#e5484d', side: '#f3e6d0' },
  { id: GOLD, name: 'Vàng', top: '#facc15', side: '#eab308', glow: true },
  { id: RAINBOW, name: 'Cầu vồng', top: '#a78bfa', side: '#60a5fa' },
  { id: CANDY, name: 'Kẹo', top: '#fb7185', side: '#fda4af' },
];
export const BLOCK_BY_ID = Object.fromEntries(BLOCKS.map((b) => [b.id, b]));

// Decoration ids
export const TREE = 64;
export const FLOWER = 65;
export const LANTERN = 66;
export const FENCE = 67;
export const BED = 68;
export const TABLE = 69;
export const STATUE = 70;
export const BERRY = 71;
export const FOUNTAIN = 72;

export const DECOR = [
  { id: TREE, name: 'Cây xanh', icon: '🌳', color: '#3f9d48' },
  { id: FLOWER, name: 'Hoa', icon: '🌸', color: '#f472b6' },
  { id: LANTERN, name: 'Đèn lồng', icon: '🏮', color: '#fbbf24', glow: true },
  { id: FENCE, name: 'Hàng rào', icon: '🪵', color: '#b5844a' },
  { id: BED, name: 'Giường', icon: '🛏️', color: '#ef4444' },
  { id: TABLE, name: 'Bàn', icon: '🪑', color: '#c99a5b' },
  { id: STATUE, name: 'Tượng Poké Ball', icon: '⚪', color: '#ef4444' },
  { id: BERRY, name: 'Bụi quả mọng', icon: '🫐', color: '#6366f1' },
  { id: FOUNTAIN, name: 'Đài phun nước', icon: '⛲', color: '#38bdf8' },
];
export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d]));

/** Paint colours (index 1..8; 0 = no paint). */
export const PAINTS = [null, '#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#6366f1', '#ec4899', '#1f2937'];
export const PAINT_NAMES = [null, 'Đỏ', 'Cam', 'Vàng', 'Xanh lá', 'Xanh trời', 'Tím', 'Hồng', 'Đen'];

export const isBlock = (v) => v > 0 && v < DECOR_BASE;
export const isDecor = (v) => v >= DECOR_BASE;
/** Blocks you can stand on / build walls and roofs with (water is not solid). */
export const isSolid = (v) => isBlock(v) && v !== WATER;
export const itemName = (v) => BLOCK_BY_ID[v]?.name || DECOR_BY_ID[v]?.name || '';

/** Unlocked at the start. */
export const STARTER_UNLOCKS = [GRASS, DIRT, SAND, STONE, WOOD, LEAVES, TREE, FLOWER];

/**
 * Wishes in the order the residents get them. `text` follows the Pokémon's name.
 * `kind` picks the checker (wishes.js), `need` its target, `reward` the gold, `unlocks` the new items.
 */
export const WISHES = [
  { id: 'garden', kind: 'flowers', need: 5, text: 'muốn 5 bông hoa', reward: 10, unlocks: [WATER, BERRY] },
  { id: 'pond', kind: 'pond', need: 6, text: 'muốn một cái hồ (6 khối Nước)', reward: 12, unlocks: [BRICK, FENCE] },
  { id: 'house', kind: 'house', need: 1, text: 'muốn một ngôi nhà có mái và cửa', reward: 15, unlocks: [LAMP, LANTERN, BED], home: true },
  { id: 'houseLamp', kind: 'houseLamp', need: 1, text: 'muốn một ngôi nhà có mái và đèn', reward: 18, unlocks: [GLASS, WOOL, TABLE], home: true },
  { id: 'berries', kind: 'berries', need: 3, text: 'muốn 3 bụi quả mọng', reward: 12, unlocks: [SNOW, ICE] },
  { id: 'bridge', kind: 'bridge', need: 3, text: 'muốn một cây cầu ra biển', reward: 20, unlocks: [STATUE, PINKWOOD] },
  { id: 'trees', kind: 'trees', need: 3, text: 'muốn 3 cây xanh', reward: 12, unlocks: [MUSHROOM] },
  { id: 'tower', kind: 'tower', need: 8, text: 'muốn một tòa tháp cao 8 khối', reward: 22, unlocks: [GOLD, FOUNTAIN] },
  { id: 'statue', kind: 'statue', need: 1, text: 'muốn một tượng Poké Ball', reward: 15, unlocks: [RAINBOW] },
  { id: 'bedroom', kind: 'bedroom', need: 1, text: 'muốn ngủ trong nhà có giường', reward: 20, unlocks: [CANDY], home: true },
  { id: 'fountain', kind: 'fountain', need: 1, text: 'muốn một đài phun nước', reward: 25, unlocks: [] },
];
export const WISH_BY_ID = Object.fromEntries(WISHES.map((w) => [w.id, w]));

/** The item a wish needs that may still be locked (to show a hint). */
export const WISH_NEEDS = { pond: WATER, houseLamp: LAMP, berries: BERRY, statue: STATUE, bedroom: BED, fountain: FOUNTAIN };

export const MAX_GUESTS = 6;
