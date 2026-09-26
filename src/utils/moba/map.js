// Battle maps for the Pokemon arena (MOBA style). World units; landscape, 1600 x 900.
// Everything on the left half is mirrored on the right, so both teams get the same map.
// Every map keeps the three dirt lanes completely clear: trees, rocks and the rest stand
// only between the lanes and along the edges (checked by `laneDistance` in the tests).

export const WORLD = { w: 1600, h: 900 };
export const CENTER = { x: 800, y: 450 };
export const LANES_Y = [170, 450, 730]; // the three lanes
export const LANE_HALF = 33; // half the painted lane width
export const BASES = {
  blue: { x: 115, y: 450, r: 105 },
  red: { x: WORLD.w - 115, y: 450, r: 105 },
};

// ---- Lanes as polylines (the top and bottom ones curve out of the bases) ----
function quad(p0, c, p1, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x, y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y });
  }
  return pts;
}
const b = BASES.blue;
const r = BASES.red;
export const LANE_PATHS = [
  [{ x: b.x, y: b.y }, { x: r.x, y: r.y }],
  ...[170, 730].map((y) => {
    const s = y < 450 ? -40 : 40;
    return [...quad({ x: b.x + 40, y: b.y + s }, { x: b.x + 90, y }, { x: 330, y }), { x: WORLD.w - 330, y }, ...quad({ x: WORLD.w - 330, y }, { x: r.x - 90, y }, { x: r.x - 40, y: r.y + s })];
  }),
];
const segDist = (px, py, a, c) => {
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - a.x - vx * t, py - a.y - vy * t);
};
/** Distance from a point to the nearest lane's centre line. */
export function laneDistance(x, y) {
  let best = Infinity;
  for (const pts of LANE_PATHS) for (let i = 1; i < pts.length; i++) best = Math.min(best, segDist(x, y, pts[i - 1], pts[i]));
  return best;
}

// ---- The maps: the top-left quarter is written out, then mirrored top/bottom and left/right ----
const mirrorY = (list) => [...list, ...list.filter((o) => o.y !== CENTER.y).map((o) => ({ ...o, y: WORLD.h - o.y }))];
const mirrorX = (list) => [...list, ...list.filter((o) => o.x !== CENTER.x).map((o) => ({ ...o, x: WORLD.w - o.x }))];
const build = (quarter) => mirrorX(mirrorY(quarter));

/**
 * kind: tree, pine, rock (forest) · cactus (desert) · snowpine, ice, snowrock (snow) ·
 * lava (a pool: blocks walking, not shots), basalt, deadtree (volcano).
 */
export const MAPS = [
  {
    id: 'forest',
    name: 'Rừng xanh',
    icon: '🌳',
    card: 'from-emerald-400 to-green-700',
    obstacles: build([
      { x: 330, y: 70, r: 34, kind: 'tree' },
      { x: 420, y: 95, r: 26, kind: 'pine' },
      { x: 560, y: 60, r: 30, kind: 'tree' },
      { x: 650, y: 95, r: 22, kind: 'rock' },
      { x: 300, y: 285, r: 30, kind: 'rock' },
      { x: 440, y: 300, r: 36, kind: 'tree' },
      { x: 540, y: 270, r: 26, kind: 'pine' },
      { x: 640, y: 310, r: 30, kind: 'tree' },
      { x: 520, y: 380, r: 24, kind: 'pine' },
      { x: 95, y: 215, r: 24, kind: 'pine' },
      { x: 240, y: 90, r: 22, kind: 'rock' },
      { x: 800, y: 305, r: 30, kind: 'rock' },
    ]),
    bushes: build([
      { x: 380, y: 372, r: 26 },
      { x: 600, y: 385, r: 24 },
      { x: 480, y: 30, r: 24 },
    ]),
    theme: {
      ground: ['#4ade80', '#22c55e'],
      patches: ['rgba(21,128,61,0.18)', 'rgba(187,247,208,0.18)'],
      tuft: 'rgba(21,128,61,0.55)',
      lane: ['#a16207', '#e7c98a', 'rgba(161,98,7,0.4)'],
      deco: ['#fde047', '#f9a8d4', '#ffffff', '#c4b5fd'],
      bush: ['#15803d', '#166534'],
      mini: '#16a34a',
      miniDot: 'rgba(20,83,45,0.9)',
    },
  },
  {
    id: 'desert',
    name: 'Sa mạc cát',
    icon: '🌵',
    card: 'from-amber-300 to-orange-600',
    obstacles: build([
      { x: 300, y: 75, r: 26, kind: 'cactus' },
      { x: 470, y: 70, r: 30, kind: 'rock' },
      { x: 620, y: 90, r: 24, kind: 'cactus' },
      { x: 320, y: 320, r: 30, kind: 'rock' },
      { x: 470, y: 260, r: 24, kind: 'cactus' },
      { x: 560, y: 350, r: 28, kind: 'rock' },
      { x: 690, y: 280, r: 24, kind: 'cactus' },
      { x: 95, y: 215, r: 24, kind: 'cactus' },
      { x: 800, y: 300, r: 32, kind: 'rock' },
    ]),
    bushes: build([
      { x: 420, y: 360, r: 22 },
      { x: 640, y: 370, r: 22 },
    ]),
    theme: {
      ground: ['#fcd34d', '#f59e0b'],
      patches: ['rgba(180,83,9,0.15)', 'rgba(254,243,199,0.3)'],
      tuft: 'rgba(146,64,14,0.35)',
      lane: ['#92400e', '#d6b48a', 'rgba(120,53,15,0.35)'],
      deco: ['#fef3c7', '#d97706', '#a8a29e', '#ffffff'],
      bush: ['#a16207', '#ca8a04'],
      mini: '#f59e0b',
      miniDot: 'rgba(120,53,15,0.9)',
    },
  },
  {
    id: 'snow',
    name: 'Núi tuyết',
    icon: '❄️',
    card: 'from-sky-200 to-indigo-500',
    obstacles: build([
      { x: 360, y: 80, r: 30, kind: 'snowpine' },
      { x: 520, y: 65, r: 26, kind: 'ice' },
      { x: 660, y: 85, r: 28, kind: 'snowpine' },
      { x: 300, y: 300, r: 26, kind: 'ice' },
      { x: 420, y: 340, r: 32, kind: 'snowpine' },
      { x: 560, y: 275, r: 28, kind: 'snowrock' },
      { x: 680, y: 340, r: 26, kind: 'ice' },
      { x: 240, y: 90, r: 24, kind: 'snowpine' },
      { x: 800, y: 320, r: 28, kind: 'ice' },
    ]),
    bushes: build([
      { x: 500, y: 370, r: 24 },
      { x: 330, y: 380, r: 22 },
    ]),
    theme: {
      ground: ['#f8fafc', '#dbeafe'],
      patches: ['rgba(148,163,184,0.16)', 'rgba(255,255,255,0.55)'],
      tuft: 'rgba(148,163,184,0.35)',
      lane: ['#64748b', '#cbd5e1', 'rgba(71,85,105,0.3)'],
      deco: ['#bae6fd', '#ffffff', '#e0f2fe', '#c4b5fd'],
      bush: ['#e2e8f0', '#cbd5e1'],
      mini: '#e2e8f0',
      miniDot: 'rgba(30,64,175,0.8)',
    },
  },
  {
    id: 'volcano',
    name: 'Núi lửa',
    icon: '🌋',
    card: 'from-orange-500 to-stone-800',
    obstacles: build([
      { x: 330, y: 80, r: 26, kind: 'basalt' },
      { x: 500, y: 75, r: 34, kind: 'lava', low: true },
      { x: 660, y: 90, r: 24, kind: 'deadtree' },
      { x: 330, y: 310, r: 36, kind: 'lava', low: true },
      { x: 480, y: 270, r: 24, kind: 'basalt' },
      { x: 580, y: 350, r: 26, kind: 'deadtree' },
      { x: 700, y: 285, r: 30, kind: 'basalt' },
      { x: 95, y: 215, r: 24, kind: 'basalt' },
      { x: 800, y: 310, r: 38, kind: 'lava', low: true },
    ]),
    bushes: build([
      { x: 450, y: 370, r: 22 },
      { x: 250, y: 380, r: 20 },
    ]),
    theme: {
      ground: ['#57534e', '#292524'],
      patches: ['rgba(0,0,0,0.25)', 'rgba(251,146,60,0.12)'],
      tuft: 'rgba(168,162,158,0.35)',
      lane: ['#1c1917', '#78716c', 'rgba(28,25,23,0.5)'],
      deco: ['#f97316', '#fbbf24', '#dc2626', '#a8a29e'],
      bush: ['#44403c', '#57534e'],
      mini: '#44403c',
      miniDot: 'rgba(249,115,22,0.9)',
    },
  },
];

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];

// The map being played. One match runs at a time, so the engine, the bots and the drawing
// read these shared arrays; `selectMap` swaps their contents in place.
export const OBSTACLES = [];
export const BUSHES = [];
export let currentMap = MAPS[0];
export function selectMap(id) {
  currentMap = mapById(id);
  OBSTACLES.length = 0;
  OBSTACLES.push(...currentMap.obstacles);
  BUSHES.length = 0;
  BUSHES.push(...currentMap.bushes);
  return currentMap;
}
selectMap('forest');

/** Push a circle (x, y, r) out of trees, rocks and the map edge. Mutates `e`. */
export function collide(e) {
  for (const o of OBSTACLES) {
    const dx = e.x - o.x;
    const dy = e.y - o.y;
    const min = e.r + o.r * 0.85;
    const d2 = dx * dx + dy * dy;
    if (d2 < min * min) {
      const d = Math.sqrt(d2);
      // Exactly on the centre: push out sideways rather than getting stuck inside
      const [ux, uy] = d > 0.001 ? [dx / d, dy / d] : [0, 1];
      e.x = o.x + ux * min;
      e.y = o.y + uy * min;
    }
  }
  e.x = Math.max(e.r, Math.min(WORLD.w - e.r, e.x));
  e.y = Math.max(e.r, Math.min(WORLD.h - e.r, e.y));
  return e;
}

/** Is a circle (x, y, r) overlapping a tree or rock? */
export const insideObstacle = (x, y, r) => OBSTACLES.some((o) => Math.hypot(x - o.x, y - o.y) < r + o.r * 0.85);

/** Does a straight shot from a to b fly through a tree or rock? (Shots fly over lava.) */
export function blocked(ax, ay, bx, by, pad = 4) {
  for (const o of OBSTACLES) {
    if (o.low) continue;
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((o.x - ax) * vx + (o.y - ay) * vy) / len2));
    const cx = ax + vx * t - o.x;
    const cy = ay + vy * t - o.y;
    if (cx * cx + cy * cy < (o.r * 0.8 + pad) ** 2) return true;
  }
  return false;
}
