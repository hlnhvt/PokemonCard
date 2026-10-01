// Thủ thành Pokémon: the 8 maps (path, build pads, theme) and their waves of Team Rocket Pokémon.

export const TD_W = 360;
export const TD_H = 600;

/** Wild Pokémon sent by Team Rocket. hp is the level-1 base; speed in px/s; lives = hearts lost if it reaches the Center. */
export const ENEMIES = {
  rattata: { dex: 19, name: 'Rattata', type: 'normal', hp: 34, speed: 44, reward: 4, lives: 1, size: 34 },
  zubat: { dex: 41, name: 'Zubat', type: 'poison', hp: 26, speed: 56, reward: 4, lives: 1, size: 34, fly: true },
  ekans: { dex: 23, name: 'Ekans', type: 'poison', hp: 50, speed: 38, reward: 5, lives: 1, size: 36 },
  koffing: { dex: 109, name: 'Koffing', type: 'poison', hp: 66, speed: 32, reward: 6, lives: 1, size: 38, fly: true },
  meowth: { dex: 52, name: 'Meowth', type: 'normal', hp: 46, speed: 50, reward: 5, lives: 1, size: 36 },
  grimer: { dex: 88, name: 'Grimer', type: 'poison', hp: 96, speed: 27, reward: 7, lives: 1, size: 40 },
  geodude: { dex: 74, name: 'Geodude', type: 'rock', hp: 150, speed: 22, reward: 8, lives: 2, size: 40 },
  pidgey: { dex: 16, name: 'Pidgey', type: 'flying', hp: 30, speed: 72, reward: 5, lives: 1, size: 36, fly: true },
  arbok: { dex: 24, name: 'Arbok', type: 'poison', hp: 700, speed: 26, reward: 40, lives: 5, size: 58, boss: true },
  weezing: { dex: 110, name: 'Weezing', type: 'poison', hp: 900, speed: 24, reward: 45, lives: 5, size: 60, boss: true, fly: true },
  persian: { dex: 53, name: 'Persian', type: 'normal', hp: 820, speed: 34, reward: 45, lives: 5, size: 58, boss: true },
  mewtwo: { dex: 150, name: 'Mewtwo', type: 'psychic', hp: 1100, speed: 20, reward: 80, lives: 10, size: 70, boss: true },
};

export const THEMES = {
  forest: { name: '🌳 Rừng xanh', ground: ['#86efac', '#4ade80'], road: '#c2894b', edge: '#8b5a2b', deco: 'tree', sky: '#14532d' },
  beach: { name: '🏖️ Bãi biển', ground: ['#fde68a', '#fcd34d'], road: '#e7c38a', edge: '#b4864a', deco: 'palm', sky: '#0ea5e9' },
  cave: { name: '🪨 Hang đá', ground: ['#78716c', '#57534e'], road: '#a8a29e', edge: '#44403c', deco: 'crystal', sky: '#1c1917' },
  city: { name: '🏙️ Thành phố', ground: ['#a3e635', '#65a30d'], road: '#94a3b8', edge: '#475569', deco: 'house', sky: '#334155' },
  volcano: { name: '🌋 Núi lửa', ground: ['#7c2d12', '#431407'], road: '#d6a36b', edge: '#7c2d12', deco: 'lava', sky: '#450a0a' },
  snow: { name: '❄️ Núi tuyết', ground: ['#f1f5f9', '#cbd5e1'], road: '#bfdbfe', edge: '#93c5fd', deco: 'pine', sky: '#e0f2fe' },
  rocket: { name: '🚀 Căn cứ Rocket', ground: ['#475569', '#1e293b'], road: '#cbd5e1', edge: '#991b1b', deco: 'crate', sky: '#0f172a' },
  indigo: { name: '🏆 Cao nguyên Indigo', ground: ['#c4b5fd', '#7c3aed'], road: '#fde68a', edge: '#a16207', deco: 'pillar', sky: '#2e1065' },
};

// Each wave is a list of groups [enemy, count, gap seconds]
const L = (id, name, theme, path, pads, startCoins, hp, waves) => ({ id, name, theme, path, padCount: pads, startCoins, hpStart: hp[0], hpEnd: hp[1], hpMul: (hp[0] + hp[1]) / 2, waves });

const RAW_LEVELS = [
  L('forest', 'Rừng Viridian', 'forest', [[-20, 90], [250, 90], [250, 250], [90, 250], [90, 420], [270, 420], [270, 560]], 7, 150, [1, 1.3], [
    [['rattata', 6, 1.4]],
    [['rattata', 8, 1.1]],
    [['zubat', 6, 1.1], ['rattata', 4, 1]],
    [['ekans', 6, 1.3], ['rattata', 5, 0.9]],
    [['zubat', 8, 0.9], ['ekans', 5, 1.1]],
    [['rattata', 8, 0.8], ['ekans', 6, 1], ['arbok', 1, 1]],
  ]),
  L('beach', 'Bãi biển Cerulean', 'beach', [[380, 70], [70, 70], [70, 200], [290, 200], [290, 330], [70, 330], [70, 470], [250, 470], [250, 560]], 8, 170, [1.2, 1.9], [
    [['meowth', 6, 1.3]],
    [['rattata', 8, 0.9], ['meowth', 4, 1]],
    [['pidgey', 7, 1]],
    [['ekans', 7, 1], ['meowth', 5, 0.9]],
    [['zubat', 10, 0.7], ['pidgey', 5, 0.9]],
    [['meowth', 8, 0.8], ['ekans', 6, 0.9]],
    [['pidgey', 8, 0.7], ['meowth', 8, 0.7], ['persian', 1, 1]],
  ]),
  L('cave', 'Hang Núi Trăng', 'cave', [[180, -20], [180, 100], [300, 100], [300, 230], [60, 230], [60, 380], [300, 380], [300, 500], [120, 500], [120, 565]], 8, 200, [1.4, 2.7], [
    [['zubat', 8, 1]],
    [['geodude', 4, 2], ['zubat', 6, 0.8]],
    [['ekans', 8, 0.9]],
    [['geodude', 6, 1.6], ['rattata', 8, 0.7]],
    [['zubat', 12, 0.6], ['koffing', 4, 1.2]],
    [['grimer', 5, 1.4], ['geodude', 4, 1.5]],
    [['zubat', 10, 0.6], ['ekans', 8, 0.8]],
    [['geodude', 6, 1.2], ['grimer', 5, 1], ['arbok', 1, 1]],
  ]),
  L('city', 'Thành phố Celadon', 'city', [[-20, 60], [300, 60], [300, 170], [60, 170], [60, 290], [300, 290], [300, 410], [60, 410], [60, 540], [220, 540]], 9, 240, [1.6, 3.6], [
    [['meowth', 8, 1]],
    [['rattata', 10, 0.7], ['koffing', 4, 1.2]],
    [['pidgey', 10, 0.7]],
    [['grimer', 6, 1.2], ['meowth', 6, 0.8]],
    [['koffing', 8, 1], ['ekans', 8, 0.8]],
    [['meowth', 10, 0.6], ['pidgey', 8, 0.6], ['weezing', 1, 1]],
    [['geodude', 6, 1.2], ['grimer', 6, 1]],
    [['rattata', 14, 0.5], ['meowth', 10, 0.6]],
    [['koffing', 8, 0.8], ['grimer', 8, 0.9]],
    [['pidgey', 10, 0.6], ['meowth', 10, 0.6], ['persian', 1, 1]],
  ]),
  L('volcano', 'Núi lửa Cinnabar', 'volcano', [[380, 520], [90, 520], [90, 400], [280, 400], [280, 270], [80, 270], [80, 140], [270, 140], [270, 45]], 9, 340, [1.6, 4.6], [
    [['geodude', 6, 1.5]],
    [['koffing', 8, 1], ['ekans', 6, 0.9]],
    [['grimer', 8, 1.1]],
    [['zubat', 14, 0.5], ['pidgey', 8, 0.6]],
    [['geodude', 8, 1.1], ['grimer', 6, 1]],
    [['meowth', 12, 0.6], ['koffing', 8, 0.8], ['weezing', 1, 1]],
    [['ekans', 12, 0.6], ['grimer', 8, 0.9]],
    [['pidgey', 14, 0.5], ['zubat', 12, 0.5]],
    [['geodude', 10, 1], ['koffing', 10, 0.8]],
    [['grimer', 10, 0.8], ['meowth', 12, 0.5], ['arbok', 2, 3]],
    [['geodude', 10, 0.9], ['grimer', 10, 0.8], ['weezing', 1, 1], ['persian', 1, 2]],
  ]),
  L('snow', 'Núi tuyết Silver', 'snow', [[-20, 300], [80, 300], [80, 80], [290, 80], [290, 500], [80, 500], [80, 400], [200, 400], [200, 220]], 10, 420, [1.8, 6], [
    [['pidgey', 10, 0.8]],
    [['geodude', 8, 1.2]],
    [['ekans', 10, 0.7], ['koffing', 6, 0.9]],
    [['grimer', 10, 0.9]],
    [['zubat', 16, 0.45], ['pidgey', 10, 0.5]],
    [['meowth', 14, 0.5], ['persian', 1, 1]],
    [['geodude', 10, 0.9], ['grimer', 8, 0.8]],
    [['koffing', 12, 0.7], ['ekans', 12, 0.6]],
    [['pidgey', 16, 0.45], ['meowth', 12, 0.5]],
    [['grimer', 12, 0.7], ['weezing', 1, 1]],
    [['geodude', 12, 0.8], ['koffing', 10, 0.7]],
    [['rattata', 20, 0.35], ['meowth', 14, 0.45], ['arbok', 2, 3], ['persian', 1, 2]],
  ]),
  L('rocket', 'Căn cứ Team Rocket', 'rocket', [[380, 90], [60, 90], [60, 200], [300, 200], [300, 310], [60, 310], [60, 420], [300, 420], [300, 540], [140, 540]], 10, 480, [2, 7.5], [
    [['meowth', 12, 0.7]],
    [['koffing', 10, 0.8], ['ekans', 8, 0.7]],
    [['zubat', 16, 0.45]],
    [['grimer', 10, 0.8], ['geodude', 6, 1]],
    [['pidgey', 14, 0.45], ['meowth', 12, 0.5]],
    [['arbok', 2, 3], ['ekans', 12, 0.6]],
    [['koffing', 14, 0.6], ['grimer', 10, 0.7]],
    [['geodude', 12, 0.8], ['rattata', 16, 0.4]],
    [['zubat', 18, 0.4], ['pidgey', 14, 0.4]],
    [['weezing', 2, 3], ['koffing', 12, 0.6]],
    [['meowth', 18, 0.4], ['grimer', 10, 0.7]],
    [['geodude', 14, 0.7], ['ekans', 14, 0.5]],
    [['persian', 2, 2.5], ['meowth', 16, 0.4], ['arbok', 1, 1], ['weezing', 1, 1]],
  ]),
  L('indigo', 'Cao nguyên Indigo', 'indigo', [[180, -20], [180, 90], [50, 90], [50, 230], [310, 230], [310, 370], [50, 370], [50, 510], [310, 510], [310, 565]], 11, 550, [2.2, 9], [
    [['rattata', 14, 0.6]],
    [['zubat', 16, 0.45], ['ekans', 8, 0.7]],
    [['geodude', 10, 1]],
    [['koffing', 12, 0.7], ['grimer', 8, 0.8]],
    [['pidgey', 18, 0.4]],
    [['meowth', 16, 0.45], ['persian', 1, 1]],
    [['grimer', 12, 0.7], ['geodude', 8, 0.9]],
    [['zubat', 20, 0.35], ['koffing', 10, 0.6]],
    [['ekans', 16, 0.5], ['arbok', 2, 3]],
    [['geodude', 14, 0.7], ['grimer', 12, 0.6]],
    [['pidgey', 20, 0.35], ['meowth', 16, 0.4]],
    [['weezing', 2, 3], ['koffing', 14, 0.5]],
    [['grimer', 16, 0.5], ['geodude', 12, 0.6]],
    [['persian', 2, 2], ['arbok', 2, 2], ['meowth', 16, 0.4]],
    [['zubat', 16, 0.35], ['grimer', 10, 0.6], ['mewtwo', 1, 1]],
  ]),
];

// ---------- Path geometry ----------

/** Polyline with cumulative lengths, for walking along it. */
export function buildPath(points) {
  const pts = points.map(([x, y]) => ({ x, y }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, length: cum[cum.length - 1] };
}

/** Point (and walking angle) at distance d along the path. */
export function pointAt(path, d) {
  const { pts, cum } = path;
  if (d <= 0) return { x: pts[0].x, y: pts[0].y, angle: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) };
  for (let i = 1; i < pts.length; i++) {
    if (d <= cum[i] || i === pts.length - 1) {
      const seg = cum[i] - cum[i - 1] || 1;
      const k = Math.min(1, (d - cum[i - 1]) / seg);
      const a = pts[i - 1];
      const b = pts[i];
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
  }
  return { ...pts[pts.length - 1], angle: 0 };
}

/** Shortest distance from (x, y) to the path. */
export function distToPath(path, x, y) {
  let best = Infinity;
  const { pts } = path;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(a.x + dx * t - x, a.y + dy * t - y));
  }
  return best;
}

/** How much of the path (px) lies within `range` of a point – the bigger, the better the spot. */
export function coverage(path, x, y, range) {
  let n = 0;
  const step = 6;
  for (let d = 0; d <= path.length; d += step) {
    const p = pointAt(path, d);
    if (p.x < -5 || p.x > TD_W + 5 || p.y < -5 || p.y > TD_H + 5) continue;
    if (Math.hypot(p.x - x, p.y - y) <= range) n += step;
  }
  return n;
}

export const PAD_RANGE = 85;
const PAD_SPACING = 56;

/** Build pads: spots beside the road with the best view of it, spread out. Deterministic. */
function makePads(path, count) {
  const end = path.pts[path.pts.length - 1];
  const cands = [];
  for (let y = 40; y <= TD_H - 40; y += 8) {
    for (let x = 26; x <= TD_W - 26; x += 8) {
      const d = distToPath(path, x, y);
      if (d < 34 || d > 46) continue;
      if (Math.hypot(x - end.x, y - end.y) < 60) continue;
      cands.push({ x, y, score: coverage(path, x, y, PAD_RANGE) });
    }
  }
  cands.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
  const pads = [];
  for (const c of cands) {
    if (pads.length >= count) break;
    if (pads.every((p) => Math.hypot(p.x - c.x, p.y - c.y) >= PAD_SPACING)) pads.push({ id: pads.length, x: c.x, y: c.y, score: c.score });
  }
  return pads;
}

export const LEVELS = RAW_LEVELS.map((lv, index) => {
  const path = buildPath(lv.path);
  return { ...lv, index, path, pads: makePads(path, lv.padCount), lives: 20 };
});

/** HP scale of wave w: grows from hpStart (first wave) to hpEnd (last wave). */
export function waveHp(level, w) {
  const lv = LEVELS[level];
  const k = lv.waves.length > 1 ? w / (lv.waves.length - 1) : 1;
  return lv.hpStart + (lv.hpEnd - lv.hpStart) * Math.pow(k, 1.5);
}

/** Waves of a level, expanded into spawn lists: [{ kind, at }] with `at` seconds after the wave starts. */
export function waveSpawns(level, w) {
  const out = [];
  let t = 0;
  for (const [kind, count, gap] of LEVELS[level].waves[w]) {
    for (let i = 0; i < count; i++) {
      out.push({ kind, at: t });
      t += gap;
    }
    t += 1.2;
  }
  return out;
}
