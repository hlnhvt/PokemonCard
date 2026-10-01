// Procedural 16×16 pixel-art textures (canvas) for the island blocks, plus small sprite textures.
import * as THREE from 'three';
import { BLOCKS, GRASS, DIRT, SAND, STONE, WOOD, LEAVES, GLASS, WATER, BRICK, LAMP, WOOL, SNOW, ICE, PINKWOOD, MUSHROOM, GOLD, RAINBOW, CANDY } from '../../../utils/three3d/island3d';

export const TILE = 16;
/** Rows of the atlas: 0 top, 1 side, 2 bottom, then the same three as light grey (for painted blocks). */
export const ROWS = 6;
export const COLS = BLOCKS.length + 1; // column = block id

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (c) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const shade = ([r, g, b], k) => [r * k, g * k, b * k].map((v) => Math.max(0, Math.min(255, Math.round(v))));

/** Fill a tile pixel by pixel with fn(x, y) -> [r, g, b, a?]. */
function paintTile(img, col, row, fn) {
  const W = COLS * TILE;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const [r, g, b, a = 255] = fn(x, y);
      const o = ((row * TILE + y) * W + col * TILE + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = a;
    }
  }
}

const noisy = (base, rand, amt = 0.12) => () => shade(base, 1 - amt + rand() * amt * 2);

/** Pixel function for block `id`, face 'top' | 'side' | 'bottom'. */
function tileFn(id, face, rand) {
  const b = BLOCKS.find((x) => x.id === id);
  const top = hex(b.top);
  const side = hex(b.side);
  switch (id) {
    case GRASS: {
      if (face === 'top') return () => (rand() < 0.12 ? shade(top, 1.18) : shade(top, 0.9 + rand() * 0.16));
      const dirt = hex('#9b6b3f');
      if (face === 'bottom') return () => shade(dirt, 0.85 + rand() * 0.25);
      const edge = Array.from({ length: TILE }, () => 3 + Math.floor(rand() * 3));
      return (x, y) => (y < edge[x] ? shade(top, 0.88 + rand() * 0.18) : rand() < 0.1 ? shade(dirt, 0.7) : shade(dirt, 0.88 + rand() * 0.22));
    }
    case DIRT:
      return () => (rand() < 0.1 ? shade(top, 0.68) : rand() < 0.08 ? shade(top, 1.25) : shade(top, 0.9 + rand() * 0.18));
    case SAND:
      return () => (rand() < 0.08 ? shade(top, 0.86) : shade(top, 0.96 + rand() * 0.08));
    case STONE: {
      const cracks = new Set();
      for (let k = 0; k < 4; k++) {
        let x = Math.floor(rand() * TILE);
        let y = Math.floor(rand() * TILE);
        for (let s = 0; s < 5; s++) {
          cracks.add(`${x},${y}`);
          x = (x + (rand() < 0.5 ? 1 : 0)) % TILE;
          y = (y + 1) % TILE;
        }
      }
      return (x, y) => (cracks.has(`${x},${y}`) ? shade(top, 0.72) : shade(top, 0.92 + rand() * 0.14));
    }
    case WOOD:
    case PINKWOOD: {
      const base = top;
      return (x, y) => {
        const row = Math.floor(y / 4);
        if (y % 4 === 3) return shade(base, 0.7);
        if ((x + row * 5) % 16 === 0) return shade(base, 0.76);
        if (y % 4 === 1 && (x + row * 7) % 16 === 3) return shade(base, 0.62); // nail
        return shade(base, 0.95 + Math.sin(x * 0.9 + row) * 0.04 + rand() * 0.05);
      };
    }
    case LEAVES:
      return () => (rand() < 0.16 ? shade(top, 0.62) : rand() < 0.14 ? shade(top, 1.3) : shade(top, 0.92 + rand() * 0.14));
    case GLASS:
      return (x, y) => {
        if (x === 0 || y === 0 || x === 15 || y === 15) return [235, 250, 255, 255];
        if (x - y === 3 || x - y === 4 || x - y === -6) return [255, 255, 255, 200];
        return [200, 236, 255, 70];
      };
    case WATER:
      return (x, y) => {
        const w = Math.sin((x + y * 0.5) * 0.8) + Math.sin(y * 1.3 - x * 0.4);
        return w > 1.3 ? [170, 225, 255, 210] : [...shade(top, 0.95 + rand() * 0.08), 185];
      };
    case ICE:
      return (x, y) => ((x * 3 + y * 5) % 13 === 0 ? [240, 252, 255, 230] : [...shade(top, 0.96 + rand() * 0.08), 200]);
    case BRICK:
      return (x, y) => {
        const row = Math.floor(y / 4);
        const off = row % 2 ? 4 : 0;
        if (y % 4 === 3 || (x + off) % 8 === 7) return [214, 205, 190];
        return shade(top, 0.9 + rand() * 0.18);
      };
    case LAMP:
      return (x, y) => {
        if (x < 2 || y < 2 || x > 13 || y > 13) return [110, 72, 40];
        if (x === 7 || x === 8 || y === 7 || y === 8) return [150, 100, 50];
        const d = Math.hypot(x - 7.5, y - 7.5);
        return shade(top, 1.15 - d * 0.04);
      };
    case WOOL:
    case SNOW:
      return (x, y) => (id === WOOL && (x + y) % 4 === 0 ? shade(top, 0.92) : rand() < 0.08 ? shade(id === SNOW ? hex('#dbeafe') : top, 0.96) : shade(top, 0.98 + rand() * 0.02));
    case MUSHROOM: {
      if (face === 'top')
        return (x, y) => {
          const spots = [
            [4, 4],
            [11, 6],
            [6, 11],
            [12, 12],
          ];
          return spots.some(([sx, sy]) => Math.hypot(x - sx, y - sy) < 1.9) ? [255, 255, 245] : shade(top, 0.92 + rand() * 0.12);
        };
      return (x, y) => (y < 4 ? shade(top, 0.9 + rand() * 0.12) : shade(side, 0.92 + rand() * 0.1));
    }
    case GOLD:
      return (x, y) => {
        if (x === 0 || y === 0) return shade(top, 1.25);
        if (x === 15 || y === 15) return shade(top, 0.7);
        if ((x === 4 && y < 7) || (y === 4 && x < 7)) return [255, 252, 220];
        return shade(top, 0.95 + rand() * 0.1);
      };
    case RAINBOW: {
      const bands = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#6366f1', '#a855f7', '#ec4899'].map(hex);
      return (x, y) => shade(bands[Math.floor(((face === 'top' ? x + y : y) % 16) / 2)], 0.95 + rand() * 0.08);
    }
    case CANDY:
      return (x, y) => ((x + y) % 8 < 3 ? [255, 255, 255] : shade(top, 0.95 + rand() * 0.08));
    default:
      return noisy(face === 'top' ? top : side, rand);
  }
}

/** The block atlas as a THREE texture (nearest filtering, sRGB). */
export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(canvas.width, canvas.height);
  BLOCKS.forEach((b) => {
    ['top', 'side', 'bottom'].forEach((face, row) => {
      const fn = tileFn(b.id, face, rng(b.id * 97 + row * 13));
      const px = [];
      paintTile(img, b.id, row, (x, y) => {
        const c = fn(x, y);
        px.push(c);
        return c;
      });
      // Light grey copy (keeps the pattern) for painted blocks, tinted by vertex colours
      let k = 0;
      paintTile(img, b.id, row + 3, () => {
        const [r, g, bl, a = 255] = px[k++];
        const l = 0.3 * r + 0.59 * g + 0.11 * bl;
        const v = Math.round(185 + (l / 255) * 70);
        return [v, v, v, a];
      });
    });
  });
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** UV rectangle [u0, v0, u1, v1] of a tile (slightly inset against bleeding). */
export function tileUV(id, row) {
  const e = 0.02 / TILE;
  const u0 = id / COLS + e;
  const u1 = (id + 1) / COLS - e;
  const v1 = 1 - row / ROWS - e;
  const v0 = 1 - (row + 1) / ROWS + e;
  return [u0, v0, u1, v1];
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft dark blob for shadows under the Pokémon. */
export const blobTexture = () =>
  canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

/** Warm round glow (lamps at night, sun, moon). */
export const glowTexture = (inner = 'rgba(255,236,160,1)', outer = 'rgba(255,200,80,0)') =>
  canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

const EMOTES = { heart: ['♥', '#ef4444'], note: ['♪', '#8b5cf6'], zzz: ['Zzz', '#3b82f6'], wow: ['!', '#f59e0b'] };

/** Speech bubble with ♥ / ♪ / Zzz / !. */
export const emoteTexture = (kind) =>
  canvasTexture(96, 96, (ctx) => {
    const [txt, color] = EMOTES[kind] || EMOTES.heart;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(15,23,42,0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(48, 42, 40, 34, 0, 0, Math.PI * 2);
    ctx.moveTo(38, 72);
    ctx.lineTo(46, 92);
    ctx.lineTo(56, 72);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `900 ${txt.length > 1 ? 30 : 50}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, 48, 44);
  });

/** Heart for celebrations. */
export const heartTexture = () =>
  canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(32, 56);
    ctx.bezierCurveTo(2, 34, 6, 6, 32, 20);
    ctx.bezierCurveTo(58, 6, 62, 34, 32, 56);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(20, 22, 6, 4, -0.6, 0, Math.PI * 2);
    ctx.fill();
  });

/** Coloured circle with the first letter, shown until the artwork loads. */
export const placeholderTexture = (name, color = '#fbbf24') =>
  canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(64, 70, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 52px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((name || '?').slice(0, 1).toUpperCase(), 64, 72);
  });

/** Moon with craters. */
export const moonTexture = () =>
  canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
    g.addColorStop(0, 'rgba(226,232,255,0.9)');
    g.addColorStop(0.45, 'rgba(200,210,255,0.35)');
    g.addColorStop(1, 'rgba(200,210,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(64, 64, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dbe2f0';
    for (const [x, y, r] of [
      [56, 58, 5],
      [72, 70, 4],
      [66, 52, 3],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
