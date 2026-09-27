// Art of a quest area. The flat ground (grass / stone / snow, paths, shores, ponds and lava,
// small decorations, the shade under walls and cliff faces) and the props deep inside the
// forests / rock walls are painted once into offscreen canvas chunks, lazily, a chunk ahead of
// the camera. Props at the edges (trees, rocks, crystals, lamps, tombstones, houses...) are
// kept as a list so they can be depth-sorted with the trainer and the Pokemon (walk behind a
// tree) and sway. Water shimmer, shoreline foam, lava glow and swaying flowers are drawn live.
import { TILE, THEMES, WALL, LIQUID, BUILDING, FREE } from '../../utils/quest/world';
import { cellNoise } from '../../utils/quest/rng';
import { sprite, stamp } from './questSprites';

export const CHUNK = 512;
const SCALE = 1.25; // offscreen pixels per world unit
const MAX_CHUNKS = 30;
const TAU = Math.PI * 2;

const WALL_BASE = { tree: '#1d4d22', rock: '#4a3b2c', pillar: '#241d3a', basalt: '#1d1311', iceberg: '#8fb8d8', crystal: '#1b1845' };
const LIQUID_COLORS = {
  pond: { shore: '#e9d8a6', rim: '#3f7d2a', deep: '#1d4ed8', main: '#3b82f6', shine: '#dbeafe' },
  water: { shore: '#6b5a44', rim: '#4a3b2c', deep: '#1e3a8a', main: '#2563eb', shine: '#bfdbfe' },
  void: { shore: '#2a2246', rim: '#6d28d9', deep: '#05030d', main: '#150b2b', shine: '#c4b5fd' },
  lava: { shore: '#2a1714', rim: '#3b1b12', deep: '#b91c1c', main: '#f97316', shine: '#fde047' },
  sea: { shore: '#f8fbff', rim: '#bae6fd', deep: '#0c4a6e', main: '#0ea5e9', shine: '#ffffff' },
};
// Which prop grows on a wall tile, by theme: [kind, share]
const WALL_PROPS = {
  forest: [['tree', 0.68], ['pine', 0.24], ['rock', 0.08]],
  cave: [['rock', 0.78], ['stalagmite', 0.14], ['crystal', 0.08]],
  tower: [['pillar', 0.86], ['tomb', 0.14]],
  volcano: [['rock', 0.84], ['obsidian', 0.16]],
  ice: [['crystal', 0.42], ['pine', 0.38], ['rock', 0.2]],
  psychic: [['crystal', 0.72], ['rock', 0.16], ['obelisk', 0.12]],
};
const GLOWS = { lamp: ['#fde68a', 34, -72], candelabra: ['#c084fc', 30, -52], vent: ['#fb923c', 40, -18], orb: ['#f0abfc', 36, -32], obelisk: ['#e879f9', 30, -36], crystalBig: ['#67e8f9', 44, -40] };

function newCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function blob(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

const tile = (area, x, y) => (x < 0 || y < 0 || x >= area.W || y >= area.H ? WALL : area.grid[y * area.W + x]);

function wallKind(theme, n) {
  const list = WALL_PROPS[theme] || WALL_PROPS.forest;
  let acc = 0;
  for (const [k, share] of list) {
    acc += share;
    if (n < acc) return k;
  }
  return list[0][0];
}

/** Props of the area: [{ x, y, kind, v, scale, sway, baked }] sorted by y. */
function buildProps(area) {
  const props = [];
  const { W, H } = area;
  const near = (x, y, r) => {
    for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) if (tile(area, i, j) !== WALL) return true;
    return false;
  };
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (area.grid[ty * W + tx] !== WALL) continue;
      const extra = area.extraAt?.get(ty * W + tx);
      const n = cellNoise(tx, ty, 11);
      const v = cellNoise(tx, ty, 12);
      const kind = extra ? extra.kind : wallKind(area.theme, n);
      const jitter = extra ? 0 : 1;
      props.push({
        x: (tx + 0.5) * TILE + (cellNoise(tx, ty, 13) - 0.5) * 14 * jitter,
        y: (ty + 0.85) * TILE + (cellNoise(tx, ty, 14) - 0.5) * 6 * jitter,
        kind,
        v: extra ? extra.v : v,
        scale: extra ? 1 : 0.9 + cellNoise(tx, ty, 15) * 0.28,
        sway: kind === 'tree' || kind === 'pine',
        phase: n * 20,
        // Deep inside a forest or a rock wall nobody walks near: painted into the ground
        baked: !extra && !near(tx, ty, 2),
      });
    }
  }
  for (const b of area.buildings) props.push({ x: b.x + b.w / 2, y: b.y + b.h, kind: 'building', building: b, v: 0, scale: 1 });
  props.sort((a, b) => a.y - b.y);
  return props;
}

export function drawProp(ctx, p, theme, time = 0) {
  if (p.kind === 'tree') {
    const sc = p.scale;
    const t = sprite('trunk', p.v, theme);
    const c = sprite('canopy', p.v, theme);
    const sway = p.baked ? 0 : Math.sin(time * 1.3 + p.phase) * 1.8;
    drawScaled(ctx, t, p.x, p.y, sc, 0);
    drawScaled(ctx, c, p.x, p.y, sc, sway);
    return;
  }
  const s = p.kind === 'building' ? sprite('building', 0, theme, { id: p.building.id, w: p.building.w, h: p.building.h, v: p.building.x % 2 }) : sprite(p.kind, p.v, theme);
  const sway = p.sway && !p.baked ? Math.sin(time * 1.3 + p.phase) * 1.2 : 0;
  drawScaled(ctx, s, p.x, p.y, p.scale, sway);
}

function drawScaled(ctx, s, x, y, sc, dx) {
  if (!s.canvas) return;
  if (sc === 1) return stamp(ctx, s, x, y, dx);
  ctx.drawImage(s.canvas, x - s.ax * sc + dx, y - s.ay * sc, s.w * sc, s.h * sc);
}

/** Art cache for one area. Returns null when canvases are unavailable (tests). */
export function createArt(area) {
  const mini = newCanvas(area.W, area.H);
  const g = mini?.getContext?.('2d');
  if (!g) return null;
  const th = THEMES[area.theme];
  const colors = { [FREE]: th.mini, [WALL]: th.miniWall, [LIQUID]: area.theme === 'volcano' ? '#f97316' : area.theme === 'tower' || area.theme === 'psychic' ? '#0b0718' : '#3b82f6', [BUILDING]: '#fca5a5' };
  for (let y = 0; y < area.H; y++) {
    for (let x = 0; x < area.W; x++) {
      g.fillStyle = colors[area.grid[y * area.W + x]];
      g.fillRect(x, y, 1, 1);
    }
  }
  g.strokeStyle = th.miniPath;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  area.path.forEach((line, i) => {
    g.lineWidth = (area.pathWidth / TILE) * (i ? 0.45 : 0.6);
    g.beginPath();
    line.forEach((p, k) => (k ? g.lineTo(p.x / TILE, p.y / TILE) : g.moveTo(p.x / TILE, p.y / TILE)));
    g.stroke();
  });
  const props = buildProps(area);
  // Buckets by chunk for the live parts
  const buckets = new Map();
  const put = (map, x, y, item) => {
    const key = Math.floor(y / CHUNK) * 1000 + Math.floor(x / CHUNK);
    let list = map.get(key);
    if (!list) map.set(key, (list = []));
    list.push(item);
  };
  for (const p of props) if (!p.baked) put(buckets, p.x, p.y, p);
  const water = new Map();
  for (let ty = 0; ty < area.H; ty++) {
    for (let tx = 0; tx < area.W; tx++) {
      if (area.grid[ty * area.W + tx] !== LIQUID) continue;
      const shore = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => tile(area, tx + dx, ty + dy) !== LIQUID);
      put(water, (tx + 0.5) * TILE, (ty + 0.5) * TILE, { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, shore, n: cellNoise(tx, ty, 31) });
    }
  }
  const plants = new Map();
  for (const d of area.decorations) if (d.kind === 'flower' || d.kind === 'grass') put(plants, d.x, d.y, d);
  return { area, theme: th, themeId: area.theme, chunks: new Map(), minimap: mini, fog: null, fogVersion: -1, frame: 0, props, buckets, water, plants };
}

// ---------- ground pieces ----------

function drawDecoration(g, d, th) {
  const { x, y, v } = d;
  switch (d.kind) {
    case 'mushroom':
      g.fillStyle = '#fef3c7';
      g.fillRect(x - 1.5, y - 4, 3, 5);
      g.fillStyle = v > 0.5 ? '#ef4444' : '#f97316';
      g.beginPath();
      g.arc(x, y - 4, 5, Math.PI, TAU);
      g.fill();
      blob(g, x - 2, y - 6, 1, '#ffffff');
      blob(g, x + 2, y - 5.5, 0.9, '#ffffff');
      break;
    case 'stone':
    case 'pebble':
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath();
      g.ellipse(x + 1, y + 2, 5 + v * 3, 2.5, 0, 0, TAU);
      g.fill();
      g.fillStyle = th.label === 'Núi lửa' ? '#3a2a25' : th.label === 'Băng' ? '#9fb8cc' : '#a8a29e';
      g.beginPath();
      g.ellipse(x, y, 4 + v * 3, 3 + v * 1.5, v, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.ellipse(x - 1, y - 1, 2, 1, 0, 0, TAU);
      g.fill();
      break;
    case 'crystal': {
      const c = th.label === 'Tâm linh' ? '#a78bfa' : '#67e8f9';
      g.fillStyle = c;
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        const h = 9 + (1 - Math.abs(i)) * 6;
        g.beginPath();
        g.moveTo(x + i * 4 - 2.5, y);
        g.lineTo(x + i * 5, y - h);
        g.lineTo(x + i * 4 + 2.5, y);
        g.closePath();
        g.fill();
        g.stroke();
      }
      break;
    }
    case 'moss':
      blob(g, x, y, 5 + v * 3, 'rgba(74,124,58,0.55)');
      blob(g, x + 4, y + 1, 3, 'rgba(101,163,13,0.5)');
      break;
    case 'candle':
      g.fillStyle = '#e9d5ff';
      g.fillRect(x - 2, y - 8, 4, 8);
      g.fillStyle = 'rgba(253,224,71,0.35)';
      g.beginPath();
      g.arc(x, y - 11, 7, 0, TAU);
      g.fill();
      g.fillStyle = '#fde047';
      g.beginPath();
      g.ellipse(x, y - 11, 1.8, 3.2, 0, 0, TAU);
      g.fill();
      break;
    case 'web':
      g.strokeStyle = 'rgba(226,232,240,0.35)';
      g.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos((i / 6) * TAU) * 12, y + Math.sin((i / 6) * TAU) * 12);
        g.stroke();
      }
      for (const r of [5, 9]) {
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.stroke();
      }
      break;
    case 'tile':
      g.strokeStyle = 'rgba(0,0,0,0.16)';
      g.lineWidth = 1.5;
      g.strokeRect(Math.floor(x / TILE) * TILE + 2, Math.floor(y / TILE) * TILE + 2, TILE - 4, TILE - 4);
      break;
    case 'ember':
      blob(g, x, y, 5, 'rgba(249,115,22,0.3)');
      blob(g, x, y, 2, '#fdba74');
      break;
    case 'crack':
      g.strokeStyle = 'rgba(249,115,22,0.7)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x - 9, y - 2);
      g.lineTo(x - 3, y + 2 + v * 3);
      g.lineTo(x + 2, y - 3);
      g.lineTo(x + 9, y + 1 - v * 3);
      g.stroke();
      break;
    case 'snow':
      blob(g, x, y, 6 + v * 4, '#ffffff');
      blob(g, x + 5, y + 1, 4, '#f8fbff');
      break;
    case 'icicle':
      g.fillStyle = '#bae6fd';
      g.beginPath();
      g.moveTo(x - 4, y);
      g.lineTo(x, y - 12);
      g.lineTo(x + 4, y);
      g.fill();
      break;
    case 'rune':
      g.strokeStyle = 'rgba(167,139,250,0.55)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, 8, 0, TAU);
      g.stroke();
      g.beginPath();
      for (let i = 0; i <= 3; i++) g.lineTo(x + Math.cos((i / 3) * TAU - Math.PI / 2) * 6, y + Math.sin((i / 3) * TAU - Math.PI / 2) * 6);
      g.stroke();
      break;
    default:
      break;
  }
}

function drawLiquid(g, area, x0, y0, x1, y1) {
  const L = LIQUID_COLORS[THEMES[area.theme].liquid];
  const isL = (tx, ty) => tile(area, tx, ty) === LIQUID;
  const each = (fn) => {
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (area.grid[ty * area.W + tx] === LIQUID) fn((tx + 0.5) * TILE, (ty + 0.5) * TILE, tx, ty);
  };
  // A shore band, then the water filling its tiles, rounded where it meets the land
  each((x, y) => blob(g, x, y, TILE * 0.95, L.shore));
  each((x, y) => blob(g, x, y, TILE * 0.8, L.rim));
  each((x, y, tx, ty) => {
    const full = isL(tx - 1, ty) && isL(tx + 1, ty) && isL(tx, ty - 1) && isL(tx, ty + 1);
    g.fillStyle = L.deep;
    if (full) g.fillRect(x - TILE / 2 - 1, y - TILE / 2 - 1, TILE + 2, TILE + 2);
    else {
      g.beginPath();
      g.arc(x, y, TILE * 0.68, 0, TAU);
      g.fill();
      // Fill towards water neighbours so the edge stays smooth
      if (isL(tx + 1, ty)) g.fillRect(x, y - TILE * 0.68, TILE / 2 + 1, TILE * 1.36);
      if (isL(tx - 1, ty)) g.fillRect(x - TILE / 2 - 1, y - TILE * 0.68, TILE / 2 + 1, TILE * 1.36);
      if (isL(tx, ty + 1)) g.fillRect(x - TILE * 0.68, y, TILE * 1.36, TILE / 2 + 1);
      if (isL(tx, ty - 1)) g.fillRect(x - TILE * 0.68, y - TILE / 2 - 1, TILE * 1.36, TILE / 2 + 1);
    }
  });
  // Lighter middle and soft highlights
  g.globalAlpha = 0.55;
  each((x, y, tx, ty) => {
    const full = isL(tx - 1, ty) && isL(tx + 1, ty) && isL(tx, ty - 1) && isL(tx, ty + 1);
    if (!full) return;
    blob(g, x + (cellNoise(tx, ty, 3) - 0.5) * 10, y + (cellNoise(tx, ty, 4) - 0.5) * 10, TILE * 0.62, L.main);
  });
  g.globalAlpha = 1;
}

function renderChunk(art, cx, cy) {
  const c = newCanvas(CHUNK * SCALE, CHUNK * SCALE);
  const g = c?.getContext?.('2d');
  if (!g) return null;
  const { area, theme: th } = art;
  const ox = cx * CHUNK;
  const oy = cy * CHUNK;
  g.scale(SCALE, SCALE);
  g.translate(-ox, -oy);
  g.fillStyle = th.ground;
  g.fillRect(ox, oy, CHUNK, CHUNK);
  const x0 = Math.max(0, Math.floor(ox / TILE) - 2);
  const y0 = Math.max(0, Math.floor(oy / TILE) - 2);
  const x1 = Math.min(area.W - 1, Math.ceil((ox + CHUNK) / TILE) + 2);
  const y1 = Math.min(area.H - 1, Math.ceil((oy + CHUNK) / TILE) + 3);
  // Soft mottled ground with light patches
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const n = cellNoise(tx, ty, 1);
      const x = (tx + cellNoise(tx, ty, 2)) * TILE;
      const y = (ty + cellNoise(tx, ty, 6)) * TILE;
      if (n < 0.3) blob(g, x, y, TILE * 0.85, th.ground2);
      else if (n > 0.84) {
        const grd = g.createRadialGradient(x, y, 2, x, y, TILE * 0.7);
        grd.addColorStop(0, th.ground3);
        grd.addColorStop(1, `${th.ground3}00`);
        g.fillStyle = grd;
        g.fillRect(x - TILE, y - TILE, TILE * 2, TILE * 2);
      }
    }
  }
  // Tiny grass strokes / grain
  g.strokeStyle = 'rgba(0,0,0,0.08)';
  g.lineWidth = 1.2;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (cellNoise(tx, ty, 41) > 0.45) continue;
      const x = (tx + cellNoise(tx, ty, 42)) * TILE;
      const y = (ty + cellNoise(tx, ty, 43)) * TILE;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 2, y - 5);
      g.moveTo(x + 3, y);
      g.lineTo(x + 4, y - 6);
      g.stroke();
    }
  }
  // Paths: an edge, the path, a lighter middle, then pebbles
  g.lineCap = 'round';
  g.lineJoin = 'round';
  area.path.forEach((line, i) => {
    const w = area.pathWidth * (i ? 0.62 : 1);
    for (const [ww, col] of [[w + 12, th.pathEdge], [w, th.path]]) {
      g.strokeStyle = col;
      g.lineWidth = ww;
      g.beginPath();
      line.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
    }
    g.globalAlpha = 0.22;
    g.strokeStyle = '#ffffff';
    g.lineWidth = w * 0.4;
    g.beginPath();
    line.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    g.globalAlpha = 1;
  });
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (cellNoise(tx, ty, 21) > 0.9) blob(g, (tx + cellNoise(tx, ty, 22)) * TILE, (ty + cellNoise(tx, ty, 23)) * TILE, 2.2, 'rgba(0,0,0,0.1)');
  drawLiquid(g, area, x0, y0, x1, y1);
  for (const d of area.decorations) if (d.kind !== 'flower' && d.kind !== 'grass' && d.x > ox - 30 && d.x < ox + CHUNK + 30 && d.y > oy - 30 && d.y < oy + CHUNK + 30) drawDecoration(g, d, th);
  // Under the walls: a dark mass; rock themes get a cliff face along the south edge
  const cliff = th.wall !== 'tree';
  g.fillStyle = WALL_BASE[th.wall];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (area.grid[ty * area.W + tx] !== WALL || area.extraAt?.has(ty * area.W + tx)) continue;
      g.beginPath();
      g.arc((tx + 0.5) * TILE, (ty + 0.5) * TILE, TILE * 0.7, 0, TAU);
      g.fill();
    }
  }
  if (cliff) {
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (area.grid[ty * area.W + tx] !== WALL || area.extraAt?.has(ty * area.W + tx) || tile(area, tx, ty + 1) === WALL) continue;
        const x = tx * TILE;
        const y = (ty + 0.55) * TILE;
        const grd = g.createLinearGradient(0, y, 0, y + TILE * 0.55);
        grd.addColorStop(0, 'rgba(0,0,0,0.05)');
        grd.addColorStop(1, 'rgba(0,0,0,0.45)');
        g.fillStyle = grd;
        g.fillRect(x - 2, y, TILE + 4, TILE * 0.55);
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(x - 2, y, TILE + 4, 2);
      }
    }
  }
  // Soft shadows under the props, then the props deep in the walls
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (const p of art.props) {
    if (p.x < ox - 80 || p.x > ox + CHUNK + 80 || p.y < oy - 20 || p.y > oy + CHUNK + 150) continue;
    if (p.kind !== 'building') {
      g.beginPath();
      g.ellipse(p.x + 6, p.y - 2, 22 * p.scale, 8 * p.scale, 0, 0, TAU);
      g.fill();
    }
  }
  for (const p of art.props) {
    if (!p.baked || p.x < ox - 80 || p.x > ox + CHUNK + 80 || p.y < oy - 20 || p.y > oy + CHUNK + 150) continue;
    drawProp(g, p, art.themeId);
  }
  return c;
}

const visibleChunks = (art, cam, view, margin = 0) => {
  const { area } = art;
  return {
    cx0: Math.max(0, Math.floor(cam.x / CHUNK) - margin),
    cy0: Math.max(0, Math.floor(cam.y / CHUNK) - margin),
    cx1: Math.min(Math.ceil(area.w / CHUNK) - 1, Math.floor((cam.x + view.w) / CHUNK) + margin),
    cy1: Math.min(Math.ceil(area.h / CHUNK) - 1, Math.floor((cam.y + view.h) / CHUNK) + margin),
  };
};

/**
 * Draw the ground under the camera. Chunks inside the view that are missing are painted now;
 * one chunk around the view is painted ahead each frame so walking never waits.
 */
export function drawGround(ctx, art, cam, view) {
  art.frame += 1;
  const { cx0, cy0, cx1, cy1 } = visibleChunks(art, cam, view);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const key = cy * 1000 + cx;
      let c = art.chunks.get(key);
      if (!c) {
        c = { canvas: renderChunk(art, cx, cy), used: 0 };
        art.chunks.set(key, c);
      }
      c.used = art.frame;
      if (c.canvas) ctx.drawImage(c.canvas, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
    }
  }
  const { area } = art;
  outer: for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) {
    for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
      if (cx < 0 || cy < 0 || cx * CHUNK >= area.w || cy * CHUNK >= area.h) continue;
      const key = cy * 1000 + cx;
      if (!art.chunks.has(key)) {
        art.chunks.set(key, { canvas: renderChunk(art, cx, cy), used: art.frame });
        break outer;
      }
    }
  }
  if (art.chunks.size > MAX_CHUNKS) {
    const old = [...art.chunks.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, art.chunks.size - MAX_CHUNKS);
    for (const [k] of old) art.chunks.delete(k);
  }
}

/** Paint the chunks round a point before the area is shown (no pop-in on arrival). */
export function prewarm(art, x, y, w = 1100, h = 700) {
  drawGround({ drawImage() {} }, art, { x: x - w / 2, y: y - h / 2 }, { w, h });
}

function eachInView(map, art, cam, view, margin, fn) {
  const { cx0, cy0, cx1, cy1 } = visibleChunks(art, cam, view, margin);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const list = map.get(cy * 1000 + cx);
    if (list) for (const it of list) fn(it);
  }
}

/** Props standing in view (for depth sorting): tall ones below the view are included too. */
export function visibleProps(art, cam, view) {
  const out = [];
  const x0 = cam.x - 70;
  const x1 = cam.x + view.w + 70;
  const y0 = cam.y - 10;
  const y1 = cam.y + view.h + 260;
  eachInView(art.buckets, art, cam, { w: view.w, h: view.h + 260 }, 1, (p) => {
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) out.push(p);
  });
  return out;
}

/** Live water: moving shimmer, foam along the shore, glowing bubbling lava. */
export function drawWater(ctx, art, cam, view, time) {
  const kind = art.theme.liquid;
  const L = LIQUID_COLORS[kind];
  const x0 = cam.x - 60;
  const x1 = cam.x + view.w + 60;
  const y0 = cam.y - 60;
  const y1 = cam.y + view.h + 60;
  ctx.save();
  eachInView(art.water, art, cam, view, 0, (w) => {
    if (w.x < x0 || w.x > x1 || w.y < y0 || w.y > y1) return;
    const ph = time * 1.6 + w.n * 12;
    if (kind === 'lava') {
      const a = 0.25 + Math.sin(ph) * 0.15;
      ctx.globalAlpha = a;
      ctx.fillStyle = L.shine;
      ctx.beginPath();
      ctx.arc(w.x, w.y, TILE * 0.45, 0, TAU);
      ctx.fill();
      const b = (time * 0.7 + w.n * 5) % 1;
      if (w.n > 0.6) {
        ctx.globalAlpha = 1 - b;
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w.x + (w.n - 0.8) * 30, w.y + (0.5 - w.n) * 20, 3 + b * 7, 0, TAU);
        ctx.stroke();
      }
    } else {
      // Shimmer: a light streak drifting across
      ctx.globalAlpha = 0.25 + Math.sin(ph) * 0.2;
      ctx.strokeStyle = L.shine;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const dx = Math.sin(ph * 0.7) * 8;
      ctx.beginPath();
      ctx.moveTo(w.x - 9 + dx, w.y - 4 + w.n * 8);
      ctx.lineTo(w.x + 5 + dx, w.y - 4 + w.n * 8);
      ctx.stroke();
      if (kind === 'sea' && w.n > 0.8) {
        ctx.globalAlpha = Math.max(0, Math.sin(time * 4 + w.n * 30));
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(w.x + 8, w.y - 6, 2, 0, TAU);
        ctx.fill();
      }
    }
    // Foam (or a glow for lava) running along the shore: a wavy line on each land side
    const sides = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    ctx.strokeStyle = kind === 'lava' ? '#fdba74' : kind === 'void' ? '#c4b5fd' : '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      if (!w.shore[k]) continue;
      const [sx, sy] = sides[k];
      const pulse = 0.5 + Math.sin(time * 2.2 + w.n * 9 + k) * 0.5;
      ctx.globalAlpha = 0.3 + pulse * 0.4;
      const inset = TILE * (0.38 - pulse * 0.06);
      const px = -sy;
      const py = sx;
      ctx.beginPath();
      for (let q = 0; q <= 6; q++) {
        const u = (q / 6 - 0.5) * TILE * 0.9;
        const wave = Math.sin(time * 3 + q * 1.3 + w.n * 7) * 2;
        const x = w.x + sx * (inset + wave) + px * u;
        const y = w.y + sy * (inset + wave) + py * u;
        if (q) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  });
  ctx.restore();
}

/** Flowers and grass tufts swaying in the wind. */
export function drawPlants(ctx, art, cam, view, time) {
  const x0 = cam.x - 20;
  const x1 = cam.x + view.w + 20;
  const y0 = cam.y - 20;
  const y1 = cam.y + view.h + 20;
  eachInView(art.plants, art, cam, view, 0, (d) => {
    if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) return;
    const sway = Math.sin(time * 2 + d.v * 10 + d.x * 0.01) * 2.2;
    if (d.kind === 'grass') {
      ctx.strokeStyle = d.v > 0.5 ? '#3f8f2c' : '#5bb03f';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(d.x + i * 3, d.y);
        ctx.quadraticCurveTo(d.x + i * 4 + sway * 0.5, d.y - 6, d.x + i * 6 + sway, d.y - 11 + Math.abs(i) * 2);
        ctx.stroke();
      }
    } else {
      const c = ['#f472b6', '#facc15', '#ffffff', '#c084fc', '#fb7185'][Math.floor(d.v * 5)];
      ctx.strokeStyle = '#3f8f2c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.quadraticCurveTo(d.x + sway * 0.4, d.y - 5, d.x + sway, d.y - 9);
      ctx.stroke();
      const fx = d.x + sway;
      const fy = d.y - 10;
      ctx.fillStyle = c;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(fx + Math.cos((i / 5) * TAU + time * 0.2) * 3, fy + Math.sin((i / 5) * TAU + time * 0.2) * 3, 2.5, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.8, 0, TAU);
      ctx.fill();
    }
  });
}

/** Glows of lamps, candles, vents and big crystals (flickering, added on top). */
export function drawGlows(ctx, props, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of props) {
    const gl = GLOWS[p.kind];
    if (!gl) continue;
    const [c, r, dy] = gl;
    const f = 0.75 + Math.sin(time * 7 + p.phase) * 0.12 + Math.sin(time * 13 + p.x) * 0.06;
    const grd = ctx.createRadialGradient(p.x, p.y + dy, 1, p.x, p.y + dy, r * f);
    grd.addColorStop(0, `${c}aa`);
    grd.addColorStop(1, `${c}00`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(p.x, p.y + dy, r * f, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Exploration for the minimap only: unexplored parts get a soft tint (never black). */
export function fogCanvas(art, fog) {
  if (!fog) return null;
  if (!art.fog || art.fog.width !== fog.cols) art.fog = newCanvas(fog.cols, fog.rows);
  const fc = art.fog;
  const g = fc?.getContext?.('2d');
  if (!g) return null;
  if (art.fogVersion !== fog.version) {
    art.fogVersion = fog.version;
    const img = g.createImageData(fog.cols, fog.rows);
    for (let i = 0; i < fog.data.length; i++) {
      img.data[i * 4] = 148;
      img.data[i * 4 + 1] = 163;
      img.data[i * 4 + 2] = 184;
      img.data[i * 4 + 3] = fog.data[i] ? 0 : 150;
    }
    g.putImageData(img, 0, 0);
  }
  return fc;
}
