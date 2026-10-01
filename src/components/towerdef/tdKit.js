// Thủ thành Pokémon: small 2.5D drawing helpers (colours, soft shadows, boxes, cylinders, glow and outlined sprites).
// Light comes from the top-left; shadows fall down-right.
import { imageReady } from '../sports/sportsKit';

export const TAU = Math.PI * 2;
/** Shadow direction (per unit of object height). */
export const SH = { x: 0.42, y: 0.16 };
/** Oblique depth vector for 2.5D boxes (per unit of depth): back faces go up-right. */
export const DEPTH = { x: 0.5, y: -0.62 };

export function seededRnd(seed) {
  let a = seed % 2147483647;
  if (a <= 0) a += 2147483646;
  return () => ((a = (a * 16807) % 2147483647) - 1) / 2147483646;
}

const hexCache = new Map();
function rgbOf(hex) {
  let c = hexCache.get(hex);
  if (!c) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(hex, c);
  }
  return c;
}

/** Mix two hex colours (k = 0 → a, 1 → b). */
export function mix(a, b, k) {
  const x = rgbOf(a);
  const y = rgbOf(b);
  const r = (i) => Math.round(x[i] + (y[i] - x[i]) * k)
    .toString(16)
    .padStart(2, '0');
  return `#${r(0)}${r(1)}${r(2)}`;
}
export const lighten = (c, k) => mix(c, '#ffffff', k);
export const darken = (c, k) => mix(c, '#000000', k);
export const rgba = (hex, a) => {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
};

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Soft elliptical shadow / ambient occlusion blob. */
export function softShadow(ctx, x, y, rx, ry, a = 0.3) {
  if (rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.55, `rgba(0,0,0,${a * 0.65})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Shadow cast by an object of footprint radius r and height h standing at (x, y). */
export function castShadow(ctx, x, y, r, h, a = 0.28) {
  softShadow(ctx, x + h * SH.x * 0.5, y + 1 + h * SH.y * 0.4, r + h * 0.28, Math.max(3, r * 0.45 + h * 0.06), a);
  softShadow(ctx, x + 1, y + 1, r * 0.85, r * 0.32, a * 0.9);
}

/** Ball with a top-left highlight (canopies, bushes, snowballs). */
export function ball(ctx, x, y, r, base, hi = 0.45, lo = 0.35) {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, lighten(base, hi));
  g.addColorStop(0.55, base);
  g.addColorStop(1, darken(base, lo));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/**
 * 2.5D box standing on (x, y) = middle of the front-bottom edge.
 * w = width, h = height, d = depth. cols = { top, front, side } (side = right face, in shade).
 */
export function box(ctx, x, y, w, h, d, cols, edge = 'rgba(0,0,0,0.28)') {
  const dx = d * DEPTH.x;
  const dy = d * DEPTH.y;
  const l = x - w / 2;
  const r = x + w / 2;
  const t = y - h;
  // side
  ctx.fillStyle = cols.side;
  ctx.beginPath();
  ctx.moveTo(r, y);
  ctx.lineTo(r, t);
  ctx.lineTo(r + dx, t + dy);
  ctx.lineTo(r + dx, y + dy);
  ctx.closePath();
  ctx.fill();
  // top
  ctx.fillStyle = cols.top;
  ctx.beginPath();
  ctx.moveTo(l, t);
  ctx.lineTo(r, t);
  ctx.lineTo(r + dx, t + dy);
  ctx.lineTo(l + dx, t + dy);
  ctx.closePath();
  ctx.fill();
  // front
  ctx.fillStyle = cols.front;
  ctx.fillRect(l, t, w, h);
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(l, y);
    ctx.lineTo(l, t);
    ctx.lineTo(l + dx, t + dy);
    ctx.lineTo(r + dx, t + dy);
    ctx.lineTo(r + dx, y + dy);
    ctx.lineTo(r, y);
    ctx.closePath();
    ctx.stroke();
    // lit top edge
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(l + 0.5, t + 0.5);
    ctx.lineTo(r - 0.5, t + 0.5);
    ctx.stroke();
  }
  return { l, r, t, dx, dy };
}

/** Upright cylinder whose bottom ellipse is centred at (x, y). */
export function cylinder(ctx, x, y, rx, ry, h, top, side, edge = 'rgba(0,0,0,0.25)') {
  const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, lighten(side, 0.18));
  g.addColorStop(0.35, side);
  g.addColorStop(1, darken(side, 0.38));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(x - rx, y - h);
  ctx.ellipse(x, y - h, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.ellipse(x, y - h, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(x, y - h, rx - 0.6, ry - 0.4, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

export function makeCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext?.('2d');
  return ctx ? [c, ctx] : null;
}

const glowCache = new Map();
/** A soft round glow sprite (64 px), drawn with 'lighter' for light sources. */
export function glowSprite(color) {
  if (!glowCache.has(color)) {
    const m = makeCanvas(64, 64);
    if (!m) return null;
    const [c, x] = m;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, rgba(color, 0.9));
    g.addColorStop(0.35, rgba(color, 0.45));
    g.addColorStop(1, rgba(color, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    glowCache.set(color, c);
  }
  return glowCache.get(color);
}

export function drawGlow(ctx, color, x, y, r, a = 1) {
  const g = glowSprite(color);
  if (!g || a <= 0) return;
  const prevA = ctx.globalAlpha;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalAlpha = prevA * Math.min(1, a);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(g, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}

const outlineCache = new Map();
/** Pokémon artwork with a solid rim around it, cached per image, size and pixel ratio. */
export function outlinedSprite(img, size, dpr, color = '#ffffff', w = 1.6, solid = false) {
  if (!imageReady(img)) return null;
  const s = Math.round(size);
  const key = `${img.src}|${s}|${dpr}|${color}|${w}|${solid}`;
  let hit = outlineCache.get(key);
  if (hit) return hit;
  const pad = w + 1;
  const m = makeCanvas((s + pad * 2) * dpr, (s + pad * 2) * dpr);
  if (!m) return null;
  const [c, x] = m;
  x.scale(dpr, dpr);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    x.drawImage(img, pad + Math.cos(a) * w, pad + Math.sin(a) * w, s, s);
  }
  x.drawImage(img, pad, pad, s, s);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, s + pad * 2, s + pad * 2);
  x.globalCompositeOperation = 'source-over';
  if (!solid) x.drawImage(img, pad, pad, s, s);
  hit = { canvas: c, pad, size: s };
  if (outlineCache.size > 120) outlineCache.clear();
  outlineCache.set(key, hit);
  return hit;
}

/** Draw an outlined sprite centred at (x, y); falls back to a plain circle while loading. */
export function drawOutlined(ctx, img, x, y, size, dpr, { flip = false, rotate = 0, color = '#fbbf24', rim = '#ffffff', rimW = 1.6, alpha = 1, solid = false } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  if (flip) ctx.scale(-1, 1);
  const o = outlinedSprite(img, size, dpr, rim, rimW, solid);
  if (o) {
    const k = size / o.size;
    const full = (o.size + o.pad * 2) * k;
    ctx.drawImage(o.canvas, -full / 2, -full / 2, full, full);
  } else if (!solid) {
    ball(ctx, 0, 0, size * 0.33, color);
  }
  ctx.restore();
}

/** Rounded health/energy bar with a dark border and a shine. */
export function pillBar(ctx, x, y, w, h, k, fill) {
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  roundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, (h + 3) / 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (k > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, Math.max(h, w * k), h, h / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    roundRect(ctx, x + 1, y + 0.6, Math.max(h - 2, w * k - 2), h * 0.35, h * 0.2);
    ctx.fill();
  }
}
