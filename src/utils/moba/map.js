// Battle map for the Pokemon arena (MOBA style). World units; landscape, 1600 x 900.
// Everything on the left half is mirrored on the right, so both teams get the same map.

export const WORLD = { w: 1600, h: 900 };
export const RIVER = { x: 800, half: 40 };
export const BRIDGES = [170, 450, 730]; // y of the three bridges = the three lanes
export const BRIDGE_HALF = 58;
export const BASES = {
  blue: { x: 115, y: 450, r: 105 },
  red: { x: WORLD.w - 115, y: 450, r: 105 },
};

// Left half. kind: tree (round canopy), pine, rock, bush (walkable, just decoration)
const LEFT = [
  // Top jungle
  { x: 330, y: 70, r: 34, kind: 'tree' },
  { x: 420, y: 95, r: 26, kind: 'pine' },
  { x: 560, y: 60, r: 30, kind: 'tree' },
  { x: 650, y: 95, r: 22, kind: 'rock' },
  { x: 300, y: 285, r: 30, kind: 'rock' },
  { x: 440, y: 300, r: 36, kind: 'tree' },
  { x: 540, y: 270, r: 26, kind: 'pine' },
  { x: 640, y: 310, r: 30, kind: 'tree' },
  // Middle (between the lanes)
  { x: 360, y: 450, r: 28, kind: 'rock' },
  { x: 520, y: 380, r: 24, kind: 'pine' },
  { x: 520, y: 520, r: 24, kind: 'pine' },
  { x: 650, y: 450, r: 34, kind: 'tree' },
  // Bottom jungle
  { x: 300, y: 615, r: 30, kind: 'rock' },
  { x: 440, y: 600, r: 36, kind: 'tree' },
  { x: 540, y: 630, r: 26, kind: 'pine' },
  { x: 640, y: 590, r: 30, kind: 'tree' },
  { x: 330, y: 830, r: 34, kind: 'tree' },
  { x: 420, y: 805, r: 26, kind: 'pine' },
  { x: 560, y: 840, r: 30, kind: 'tree' },
  { x: 650, y: 805, r: 22, kind: 'rock' },
  // Near the base
  { x: 150, y: 250, r: 28, kind: 'pine' },
  { x: 150, y: 650, r: 28, kind: 'pine' },
  { x: 250, y: 150, r: 22, kind: 'rock' },
  { x: 250, y: 750, r: 22, kind: 'rock' },
];
const BUSHES_LEFT = [
  { x: 470, y: 195, r: 30 },
  { x: 470, y: 705, r: 30 },
  { x: 700, y: 210, r: 26 },
  { x: 700, y: 690, r: 26 },
  { x: 245, y: 450, r: 26 },
];

const mirror = (o) => ({ ...o, x: WORLD.w - o.x });
export const OBSTACLES = [...LEFT, ...LEFT.map(mirror)];
export const BUSHES = [...BUSHES_LEFT, ...BUSHES_LEFT.map(mirror)];

export const onBridge = (y) => BRIDGES.some((b) => Math.abs(y - b) < BRIDGE_HALF);
export const inRiver = (x, y) => Math.abs(x - RIVER.x) < RIVER.half && !onBridge(y);

/** Push a circle (x, y, r) out of trees, rocks, the river and the map edge. Mutates `e`. */
export function collide(e) {
  for (const o of OBSTACLES) {
    const dx = e.x - o.x;
    const dy = e.y - o.y;
    const min = e.r + o.r * 0.85;
    const d2 = dx * dx + dy * dy;
    if (d2 < min * min) {
      const d = Math.sqrt(d2) || 0.01;
      e.x = o.x + (dx / d) * min;
      e.y = o.y + (dy / d) * min;
    }
  }
  if (Math.abs(e.x - RIVER.x) < RIVER.half + e.r * 0.5 && !onBridge(e.y)) {
    // Out of the water, back to the bank the Pokemon came from
    e.x = e.x < RIVER.x ? RIVER.x - RIVER.half - e.r * 0.5 : RIVER.x + RIVER.half + e.r * 0.5;
  }
  e.x = Math.max(e.r, Math.min(WORLD.w - e.r, e.x));
  e.y = Math.max(e.r, Math.min(WORLD.h - e.r, e.y));
  return e;
}

/** Does a straight shot from a to b fly through a tree or rock? (the river does not block shots) */
export function blocked(ax, ay, bx, by, pad = 4) {
  for (const o of OBSTACLES) {
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

/** Nearest bridge y for crossing the river. */
export const nearestBridge = (y) => BRIDGES.reduce((best, b) => (Math.abs(b - y) < Math.abs(best - y) ? b : best), BRIDGES[0]);
