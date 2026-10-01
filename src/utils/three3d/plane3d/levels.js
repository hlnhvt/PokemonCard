// "Đua máy bay Pokémon": the 10 levels and 3 difficulties (pure data, no three.js).

/** Obstacle kinds: half width (x) / half depth (z) of the collision box, in metres. */
export const OBST = {
  balloon: { hw: 1.25, hz: 1.2, label: 'Khinh khí cầu Meowth' },
  hotair: { hw: 1.35, hz: 1.35, label: 'Khinh khí cầu' },
  storm: { hw: 1.45, hz: 1.6, label: 'Mây giông' },
  pidgey: { hw: 1.3, hz: 1.0, label: 'Đàn Pidgey' },
  spearow: { hw: 1.3, hz: 1.0, label: 'Đàn Spearow' },
  zubat: { hw: 1.3, hz: 1.0, label: 'Đàn Zubat' },
  rock: { hw: 1.35, hz: 1.4, label: 'Đảo đá bay' },
  turbine: { hw: 1.2, hz: 0.6, label: 'Tua-bin gió' },
  ice: { hw: 1.25, hz: 1.2, label: 'Gai băng' },
  lava: { hw: 1.2, hz: 1.2, label: 'Cột đá lửa' },
  crystal: { hw: 1.25, hz: 1.2, label: 'Pha lê' },
  satellite: { hw: 1.4, hz: 0.9, label: 'Vệ tinh' },
  meteor: { hw: 1.3, hz: 1.3, label: 'Thiên thạch' },
};

/**
 * Levels: `obstacles` = [kind, weight]; `secs` = planned flying time (same for every difficulty,
 * the track length is computed from the speed so it always lasts this long).
 */
export const LEVELS = [
  { id: 'L1', n: 1, name: 'Đồng cỏ Pallet', icon: '🌾', color: '#4ade80', secs: 34, obstacles: [['balloon', 3], ['turbine', 3], ['pidgey', 3], ['hotair', 2]] },
  { id: 'L2', n: 2, name: 'Biển xanh', icon: '🌊', color: '#38bdf8', secs: 36, obstacles: [['storm', 3], ['spearow', 3], ['hotair', 2], ['rock', 2]] },
  { id: 'L3', n: 3, name: 'Rừng Viridian', icon: '🌲', color: '#16a34a', secs: 38, obstacles: [['pidgey', 3], ['rock', 3], ['balloon', 2], ['storm', 2]] },
  { id: 'L4', n: 4, name: 'Thành phố Saffron', icon: '🏙️', color: '#a78bfa', secs: 40, obstacles: [['balloon', 3], ['spearow', 3], ['hotair', 2], ['storm', 2]] },
  { id: 'L5', n: 5, name: 'Sa mạc', icon: '🏜️', color: '#f59e0b', secs: 42, obstacles: [['rock', 3], ['hotair', 2], ['spearow', 3], ['turbine', 2]] },
  { id: 'L6', n: 6, name: 'Núi tuyết', icon: '🏔️', color: '#93c5fd', secs: 45, obstacles: [['ice', 4], ['storm', 2], ['pidgey', 2], ['hotair', 2]] },
  { id: 'L7', n: 7, name: 'Núi lửa Cinnabar', icon: '🌋', color: '#f97316', secs: 48, obstacles: [['lava', 4], ['meteor', 2], ['storm', 2], ['spearow', 2]] },
  { id: 'L8', n: 8, name: 'Hang động pha lê', icon: '💎', color: '#c084fc', secs: 50, obstacles: [['crystal', 4], ['zubat', 4], ['rock', 2]] },
  { id: 'L9', n: 9, name: 'Hoàng hôn trên mây', icon: '🌅', color: '#fb7185', secs: 53, obstacles: [['rock', 3], ['hotair', 3], ['balloon', 2], ['storm', 2]] },
  { id: 'L10', n: 10, name: 'Vũ trụ', icon: '🪐', color: '#6366f1', secs: 56, obstacles: [['satellite', 3], ['meteor', 4], ['rock', 2]] },
];

/**
 * Difficulties. speed (m/s), react = seconds to notice a row, laneTime = seconds budgeted per lane change,
 * gap = time between rows (s), two = chance a row blocks two lanes (never on Dễ).
 */
export const DIFFS = {
  easy: { id: 'easy', label: 'Dễ', speed: 15, react: 1.0, laneTime: 0.36, gap: [2.35, 3.1], two: 0, emoji: '🐣' },
  normal: { id: 'normal', label: 'Vừa', speed: 19, react: 0.8, laneTime: 0.3, gap: [1.7, 2.4], two: 0.3, emoji: '🐥' },
  hard: { id: 'hard', label: 'Khó', speed: 23, react: 0.66, laneTime: 0.28, gap: [1.32, 1.9], two: 0.5, emoji: '🦅' },
};
export const DIFF_IDS = ['easy', 'normal', 'hard'];

/** Liveries for the plane (menu, saved). */
export const LIVERIES = [
  { id: 'pika', name: 'Pikachu', body: '#ffd23f', trim: '#e63946', stripe: '#3a2a1a', wing: '#ffc31a', glass: '#9fe3ff' },
  { id: 'char', name: 'Charmander', body: '#ff7a3d', trim: '#ffd166', stripe: '#c1121f', wing: '#ff8c52', glass: '#a5f0ff' },
  { id: 'squirt', name: 'Squirtle', body: '#5ec8f2', trim: '#f4a259', stripe: '#1d5f8a', wing: '#7ad3f5', glass: '#d4f6ff' },
  { id: 'bulba', name: 'Bulbasaur', body: '#58c9a0', trim: '#2f8f6a', stripe: '#ff6b8b', wing: '#6fd6ae', glass: '#c9fff1' },
  { id: 'gengar', name: 'Gengar', body: '#8e6be0', trim: '#ff5d8f', stripe: '#3c2a73', wing: '#9d7ff0', glass: '#ffd0ef' },
  { id: 'jiggly', name: 'Jigglypuff', body: '#ff9ccc', trim: '#5ad1e6', stripe: '#ffffff', wing: '#ffb3d9', glass: '#e2fbff' },
];

/** Speed (m/s) of a level at a difficulty: later levels are a little faster. */
export const speedFor = (levelIndex, diff) => DIFFS[diff].speed * (1 + 0.025 * levelIndex);
/** Planned duration (s) and the track length (m) that gives it. */
export const secondsFor = (levelIndex) => LEVELS[levelIndex].secs;
export const lengthFor = (levelIndex, diff) => Math.round(secondsFor(levelIndex) * speedFor(levelIndex, diff));
