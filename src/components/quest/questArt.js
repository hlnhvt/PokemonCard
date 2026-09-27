// Static art of a quest area: the ground, paths, ponds / lava, decorations, walls (trees,
// rocks, crystals by theme) and town buildings are painted once into offscreen canvas
// chunks (lazily, a few per frame ahead of the camera). Also the minimap and the fog canvas.
import { TILE, THEMES, WALL, LIQUID, BUILDING, FREE } from '../../utils/quest/world';
import { cellNoise } from '../../utils/quest/rng';

export const CHUNK = 512;
const SCALE = 1.25; // offscreen pixels per world unit (sharp on phones, bounded memory)
const MAX_CHUNKS = 28;
const TAU = Math.PI * 2;

const WALL_BASE = { tree: '#1d4d22', rock: '#4a3b2c', pillar: '#2b2342', basalt: '#221614', iceberg: '#7fb0d6', crystal: '#1d1a46' };
const LIQUID_COLORS = {
  pond: { rim: '#3f7d2a', deep: '#1d4ed8', main: '#3b82f6', shine: '#bfdbfe' },
  water: { rim: '#5b4a37', deep: '#1e3a8a', main: '#2563eb', shine: '#93c5fd' },
  void: { rim: '#6d28d9', deep: '#05030d', main: '#120a24', shine: '#a78bfa' },
  lava: { rim: '#3b1b12', deep: '#b91c1c', main: '#f97316', shine: '#fde047' },
  sea: { rim: '#e0f2fe', deep: '#0c4a6e', main: '#0ea5e9', shine: '#f0f9ff' },
};

function newCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
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
  return { area, theme: th, chunks: new Map(), minimap: mini, fog: null, fogVersion: -1, frame: 0 };
}

// ---------- ground pieces ----------

function blob(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

function drawDecoration(g, d, th) {
  const { x, y, v } = d;
  switch (d.kind) {
    case 'flower': {
      const c = ['#f472b6', '#facc15', '#ffffff', '#c084fc', '#fb7185'][Math.floor(v * 5)];
      for (let i = 0; i < 5; i++) blob(g, x + Math.cos((i / 5) * TAU) * 3.2, y + Math.sin((i / 5) * TAU) * 3.2, 2.6, c);
      blob(g, x, y, 1.9, '#f59e0b');
      break;
    }
    case 'grass':
      g.strokeStyle = v > 0.5 ? '#3f8f2c' : '#4ea637';
      g.lineWidth = 2;
      g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(x + i * 3, y);
        g.quadraticCurveTo(x + i * 4, y - 6, x + i * 6, y - 10 + Math.abs(i) * 2);
        g.stroke();
      }
      break;
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
      g.strokeStyle = 'rgba(0,0,0,0.18)';
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
      g.lineTo(x - 3, y + 2);
      g.lineTo(x + 2, y - 3);
      g.lineTo(x + 9, y + 1);
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
  const each = (fn) => {
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (area.grid[ty * area.W + tx] === LIQUID) fn((tx + 0.5) * TILE, (ty + 0.5) * TILE, tx, ty);
  };
  each((x, y) => blob(g, x, y, TILE * 0.86, L.rim));
  each((x, y) => blob(g, x, y, TILE * 0.72, L.deep));
  each((x, y, tx, ty) => blob(g, x + (cellNoise(tx, ty, 3) - 0.5) * 6, y + (cellNoise(tx, ty, 4) - 0.5) * 6, TILE * 0.55, L.main));
  g.strokeStyle = L.shine;
  g.lineWidth = 2;
  g.globalAlpha = 0.55;
  each((x, y, tx, ty) => {
    if (cellNoise(tx, ty, 5) > 0.55) return;
    g.beginPath();
    g.arc(x, y, TILE * 0.3, 3.6, 4.6);
    g.stroke();
  });
  g.globalAlpha = 1;
}

function drawWallProp(g, area, tx, ty) {
  const th = THEMES[area.theme];
  const n = cellNoise(tx, ty, 11);
  const n2 = cellNoise(tx, ty, 12);
  const x = (tx + 0.5) * TILE + (n - 0.5) * 12;
  const y = (ty + 0.5) * TILE + (n2 - 0.5) * 10;
  const r = TILE * (0.62 + n * 0.22);
  switch (th.wall) {
    case 'tree': {
      if (n2 > 0.72) {
        // Pine
        g.fillStyle = '#5b3716';
        g.fillRect(x - 3, y + r * 0.3, 6, r * 0.45);
        for (let i = 0; i < 3; i++) {
          const w = r * (1.05 - i * 0.27);
          const top = y - r * (0.1 + i * 0.42);
          g.fillStyle = ['#14532d', '#166534', '#1f7a3a'][i];
          g.beginPath();
          g.moveTo(x, top - r * 0.62);
          g.lineTo(x + w, top + r * 0.38);
          g.lineTo(x - w, top + r * 0.38);
          g.closePath();
          g.fill();
        }
        break;
      }
      g.fillStyle = '#6b3f1d';
      g.fillRect(x - 4, y, 8, r * 0.55);
      const parts = [[0, 0, 1], [-0.42, 0.18, 0.68], [0.42, 0.18, 0.68], [0, -0.38, 0.7]];
      for (const [dx, dy, s] of parts) {
        const cx = x + dx * r;
        const cy = y + dy * r - r * 0.25;
        const grd = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, 2, cx, cy, r * s);
        grd.addColorStop(0, n > 0.5 ? '#6ee05a' : '#4ade80');
        grd.addColorStop(1, '#166534');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(cx, cy, r * s, 0, TAU);
        g.fill();
      }
      if (n > 0.7) {
        g.fillStyle = n2 > 0.4 ? '#ef4444' : '#f472b6';
        for (let i = 0; i < 3; i++) blob(g, x + Math.cos(i * 2.1 + n * 9) * r * 0.5, y - r * 0.3 + Math.sin(i * 2.1 + n * 9) * r * 0.35, 3, g.fillStyle);
      }
      break;
    }
    case 'rock':
    case 'basalt': {
      const lava = th.wall === 'basalt';
      const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.45, 2, x, y, r * 1.1);
      grd.addColorStop(0, lava ? '#6b5a55' : '#d6c7b0');
      grd.addColorStop(0.6, lava ? '#3a2c28' : '#8f7a62');
      grd.addColorStop(1, lava ? '#1a1110' : '#4a3b2c');
      g.fillStyle = grd;
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const rr = r * (0.8 + cellNoise(tx + i, ty, 13) * 0.3);
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85 - r * 0.15);
      }
      g.closePath();
      g.fill();
      if (lava && n > 0.62) {
        // A glowing crack, different on every rock
        const a = cellNoise(tx, ty, 14) * TAU;
        g.strokeStyle = 'rgba(251,146,60,0.9)';
        g.lineWidth = 1.8;
        g.shadowColor = '#f97316';
        g.shadowBlur = 6;
        g.beginPath();
        g.moveTo(x + Math.cos(a) * r * 0.55, y - r * 0.15 + Math.sin(a) * r * 0.4);
        g.lineTo(x + Math.cos(a + 2) * r * 0.12, y - r * 0.2 + Math.sin(a + 2) * r * 0.12);
        g.lineTo(x + Math.cos(a + 3.3) * r * 0.5, y - r * 0.15 + Math.sin(a + 3.3) * r * 0.35);
        g.stroke();
        g.shadowBlur = 0;
      } else if (!lava && n > 0.8) {
        g.fillStyle = '#7dd3fc';
        g.beginPath();
        g.moveTo(x - 4, y - r * 0.2);
        g.lineTo(x, y - r * 0.9);
        g.lineTo(x + 4, y - r * 0.2);
        g.fill();
      }
      break;
    }
    case 'pillar': {
      // Old stone columns of the tower; some carry a purple ghost flame
      const w = r * 0.62;
      g.fillStyle = '#2e2547';
      g.fillRect(x - w - 4, y + r * 0.2, (w + 4) * 2, r * 0.4);
      const sg = g.createLinearGradient(x - w, 0, x + w, 0);
      sg.addColorStop(0, '#3d3360');
      sg.addColorStop(0.45, '#6b5d96');
      sg.addColorStop(1, '#2f2750');
      g.fillStyle = sg;
      g.fillRect(x - w, y - r * 0.95, w * 2, r * 1.2);
      g.strokeStyle = 'rgba(20,14,36,0.45)';
      g.lineWidth = 1.2;
      for (let k = 1; k < 3; k++) {
        g.beginPath();
        g.moveTo(x - w, y - r * 0.95 + k * r * 0.4);
        g.lineTo(x + w, y - r * 0.95 + k * r * 0.4);
        g.stroke();
      }
      g.fillStyle = '#7c6fae';
      g.fillRect(x - w - 5, y - r * 1.05, (w + 5) * 2, r * 0.22);
      if (n > 0.72) {
        const fg = g.createRadialGradient(x, y - r * 1.3, 1, x, y - r * 1.3, r * 0.8);
        fg.addColorStop(0, 'rgba(233,213,255,0.95)');
        fg.addColorStop(0.4, 'rgba(192,132,252,0.6)');
        fg.addColorStop(1, 'rgba(192,132,252,0)');
        g.fillStyle = fg;
        g.beginPath();
        g.arc(x, y - r * 1.3, r * 0.8, 0, TAU);
        g.fill();
        g.fillStyle = '#e9d5ff';
        g.beginPath();
        g.moveTo(x, y - r * 1.75);
        g.quadraticCurveTo(x + r * 0.25, y - r * 1.25, x, y - r * 1.08);
        g.quadraticCurveTo(x - r * 0.25, y - r * 1.25, x, y - r * 1.75);
        g.fill();
      }
      break;
    }
    case 'iceberg': {
      if (n2 > 0.7) {
        // Snowy pine
        for (let i = 0; i < 3; i++) {
          const w = r * (1 - i * 0.27);
          const top = y - r * (0.1 + i * 0.42);
          g.fillStyle = ['#14532d', '#166534', '#1f7a3a'][i];
          g.beginPath();
          g.moveTo(x, top - r * 0.6);
          g.lineTo(x + w, top + r * 0.36);
          g.lineTo(x - w, top + r * 0.36);
          g.closePath();
          g.fill();
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.moveTo(x, top - r * 0.6);
          g.lineTo(x + w * 0.45, top - r * 0.1);
          g.lineTo(x - w * 0.45, top - r * 0.1);
          g.closePath();
          g.fill();
        }
        break;
      }
      for (let i = -1; i <= 1; i++) {
        const h = r * (1.1 + (1 - Math.abs(i)) * 0.5) * (0.8 + n * 0.4);
        const grd = g.createLinearGradient(x + i * r * 0.4, y - h, x + i * r * 0.4, y);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(1, '#7dd3fc');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(x + i * r * 0.45 - r * 0.35, y + r * 0.3);
        g.lineTo(x + i * r * 0.5, y - h);
        g.lineTo(x + i * r * 0.45 + r * 0.35, y + r * 0.3);
        g.closePath();
        g.fill();
      }
      break;
    }
    default: {
      // Psychic crystals
      for (let i = -1; i <= 1; i++) {
        const h = r * (1 + (1 - Math.abs(i)) * 0.6) * (0.8 + n * 0.4);
        const grd = g.createLinearGradient(x, y - h, x, y);
        grd.addColorStop(0, '#f5d0fe');
        grd.addColorStop(0.5, '#a78bfa');
        grd.addColorStop(1, '#4c1d95');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(x + i * r * 0.42 - r * 0.28, y + r * 0.3);
        g.lineTo(x + i * r * 0.55, y - h);
        g.lineTo(x + i * r * 0.42 + r * 0.28, y + r * 0.3);
        g.closePath();
        g.fill();
      }
    }
  }
}

function roofed(g, b, roof, roofDark, wall, sign) {
  const { x, y, w, h } = b;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x + 8, y + h - 6, w, 14);
  g.fillStyle = wall;
  g.fillRect(x, y + h * 0.35, w, h * 0.65);
  // Roof
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(x - 10, y + h * 0.42);
  g.lineTo(x + w * 0.12, y - h * 0.1);
  g.lineTo(x + w * 0.88, y - h * 0.1);
  g.lineTo(x + w + 10, y + h * 0.42);
  g.closePath();
  g.fill();
  g.fillStyle = roofDark;
  g.fillRect(x - 10, y + h * 0.38, w + 20, 8);
  // Door and windows
  g.fillStyle = '#7dd3fc';
  g.fillRect(x + w / 2 - 16, y + h - 34, 32, 34);
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillRect(x + w / 2 - 1, y + h - 34, 2, 34);
  g.fillStyle = '#bae6fd';
  g.fillRect(x + 16, y + h * 0.52, 30, 22);
  g.fillRect(x + w - 46, y + h * 0.52, 30, 22);
  if (sign) sign(x + w / 2, y + h * 0.18);
}

function drawBuilding(g, b) {
  if (b.id === 'center') {
    roofed(g, b, '#ef4444', '#b91c1c', '#fff7ed', (cx, cy) => {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx, cy, 20, 0, TAU);
      g.fill();
      g.fillStyle = '#ef4444';
      g.beginPath();
      g.arc(cx, cy, 20, Math.PI, TAU);
      g.fill();
      g.fillStyle = '#1f2937';
      g.fillRect(cx - 20, cy - 2.5, 40, 5);
      g.beginPath();
      g.arc(cx, cy, 7, 0, TAU);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx, cy, 4, 0, TAU);
      g.fill();
    });
  } else if (b.id === 'shop') {
    roofed(g, b, '#3b82f6', '#1d4ed8', '#f8fafc', (cx, cy) => {
      g.fillStyle = '#1d4ed8';
      g.beginPath();
      g.roundRect(cx - 40, cy - 14, 80, 28, 8);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = '900 15px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('SHOP', cx, cy + 1);
    });
  } else if (b.id === 'house') {
    roofed(g, b, '#f97316', '#c2410c', '#fef3c7', null);
  } else if (b.id === 'board') {
    const { x, y, w, h } = b;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x + 6, y + h - 8, w, 10);
    g.fillStyle = '#78350f';
    g.fillRect(x + 12, y + 20, 8, h - 20);
    g.fillRect(x + w - 20, y + 20, 8, h - 20);
    g.fillStyle = '#b45309';
    g.beginPath();
    g.roundRect(x - 4, y - 6, w + 8, 50, 6);
    g.fill();
    g.fillStyle = '#92400e';
    g.fillRect(x - 4, y - 6, w + 8, 6);
    g.fillStyle = '#fef3c7';
    for (let i = 0; i < 3; i++) g.fillRect(x + 8 + i * 36, y + 4, 26, 30);
    for (let i = 0; i < 3; i++) blob(g, x + 21 + i * 36, y + 6, 3, '#ef4444');
    g.strokeStyle = 'rgba(120,53,15,0.5)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) for (let l = 0; l < 3; l++) {
      g.beginPath();
      g.moveTo(x + 12 + i * 36, y + 14 + l * 7);
      g.lineTo(x + 30 + i * 36, y + 14 + l * 7);
      g.stroke();
    }
  } else if (b.id === 'fountain') {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath();
    g.ellipse(cx + 6, cy + 14, b.w * 0.66, b.w * 0.36, 0, 0, TAU);
    g.fill();
    // Stone rim (eight sides), water with ripples, a spout in the middle
    g.fillStyle = '#94a3b8';
    g.beginPath();
    for (let i = 0; i < 8; i++) g.lineTo(cx + Math.cos((i / 8) * TAU + 0.39) * b.w * 0.66, cy + Math.sin((i / 8) * TAU + 0.39) * b.w * 0.5);
    g.closePath();
    g.fill();
    g.fillStyle = '#cbd5e1';
    g.beginPath();
    for (let i = 0; i < 8; i++) g.lineTo(cx + Math.cos((i / 8) * TAU + 0.39) * b.w * 0.6, cy - 4 + Math.sin((i / 8) * TAU + 0.39) * b.w * 0.44);
    g.closePath();
    g.fill();
    const wg = g.createRadialGradient(cx - 8, cy - 10, 4, cx, cy - 4, b.w * 0.5);
    wg.addColorStop(0, '#bae6fd');
    wg.addColorStop(1, '#2563eb');
    g.fillStyle = wg;
    g.beginPath();
    g.ellipse(cx, cy - 4, b.w * 0.5, b.w * 0.34, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 2;
    for (const r of [0.2, 0.34]) {
      g.beginPath();
      g.ellipse(cx, cy - 4, b.w * r, b.w * r * 0.65, 0, 0, TAU);
      g.stroke();
    }
    g.fillStyle = '#e2e8f0';
    g.fillRect(cx - 5, cy - 30, 10, 26);
    g.fillStyle = '#bfdbfe';
    g.beginPath();
    g.ellipse(cx, cy - 34, 12, 7, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#ffffff';
    for (const dx of [-9, 0, 9]) blob(g, cx + dx, cy - 38, 3, '#ffffff');
  }
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
  // Soft mottled ground
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const n = cellNoise(tx, ty, 1);
      const x = (tx + cellNoise(tx, ty, 2)) * TILE;
      const y = (ty + cellNoise(tx, ty, 6)) * TILE;
      if (n < 0.28) blob(g, x, y, TILE * 0.8, th.ground2);
      else if (n > 0.86) blob(g, x, y, TILE * 0.55, th.ground3);
    }
  }
  // Paths
  g.lineCap = 'round';
  g.lineJoin = 'round';
  area.path.forEach((line, i) => {
    const w = area.pathWidth * (i ? 0.62 : 1);
    for (const [ww, col] of [[w + 10, th.pathEdge], [w, th.path]]) {
      g.strokeStyle = col;
      g.lineWidth = ww;
      g.beginPath();
      line.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
    }
    g.globalAlpha = 0.25;
    g.strokeStyle = '#ffffff';
    g.lineWidth = w * 0.35;
    g.beginPath();
    line.forEach((p, k) => (k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    g.globalAlpha = 1;
  });
  // Pebbles on the path
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (cellNoise(tx, ty, 21) > 0.93) blob(g, (tx + 0.5) * TILE, (ty + 0.5) * TILE, 2, 'rgba(0,0,0,0.08)');
  drawLiquid(g, area, x0, y0, x1, y1);
  for (const d of area.decorations) if (d.x > ox - 30 && d.x < ox + CHUNK + 30 && d.y > oy - 30 && d.y < oy + CHUNK + 30) drawDecoration(g, d, th);
  // Walls: a dark mass first, then one prop per tile from back to front
  g.fillStyle = WALL_BASE[th.wall];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (area.grid[ty * area.W + tx] !== WALL) continue;
      g.beginPath();
      g.arc((tx + 0.5) * TILE, (ty + 0.5) * TILE, TILE * 0.66, 0, TAU);
      g.fill();
    }
  }
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (area.grid[ty * area.W + tx] === WALL) {
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath();
        g.ellipse((tx + 0.5) * TILE + 6, (ty + 0.9) * TILE, TILE * 0.6, TILE * 0.25, 0, 0, TAU);
        g.fill();
        drawWallProp(g, area, tx, ty);
      }
    }
  }
  for (const b of area.buildings) if (b.x < ox + CHUNK + 60 && b.x + b.w > ox - 60 && b.y < oy + CHUNK + 60 && b.y + b.h > oy - 60) drawBuilding(g, b);
  return c;
}

/**
 * Draw the ground under the camera. Chunks inside the view that are missing are painted now;
 * one chunk around the view is painted ahead each frame so walking never waits.
 */
export function drawGround(ctx, art, cam, view) {
  const { area } = art;
  art.frame += 1;
  const cx0 = Math.max(0, Math.floor(cam.x / CHUNK));
  const cy0 = Math.max(0, Math.floor(cam.y / CHUNK));
  const cx1 = Math.min(Math.ceil(area.w / CHUNK) - 1, Math.floor((cam.x + view.w) / CHUNK));
  const cy1 = Math.min(Math.ceil(area.h / CHUNK) - 1, Math.floor((cam.y + view.h) / CHUNK));
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
  // Paint one more chunk ahead
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

/** Fog of war: one pixel per fog cell, drawn scaled up (smoothing gives soft edges). */
export function drawFog(ctx, art, fog) {
  if (!fog) return;
  if (!art.fog || art.fog.width !== fog.cols) art.fog = newCanvas(fog.cols, fog.rows);
  const fc = art.fog;
  const g = fc?.getContext?.('2d');
  if (!g) return;
  if (art.fogVersion !== fog.version) {
    art.fogVersion = fog.version;
    const img = g.createImageData(fog.cols, fog.rows);
    const hex = art.theme.fog;
    const r = parseInt(hex.slice(1, 3), 16);
    const gg = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    for (let i = 0; i < fog.data.length; i++) {
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = gg;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = fog.data[i] ? 0 : 245;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(fc, 0, 0, fog.cols * fog.cell, fog.rows * fog.cell);
}
