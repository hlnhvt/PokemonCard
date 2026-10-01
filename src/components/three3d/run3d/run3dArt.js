// Canvas-drawn textures and low-poly scenery for "Pokémon Chạy 3 làn" (no downloaded assets).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** A canvas texture drawn by `draw(ctx, w, h)`; null when canvas 2D is unavailable. */
export function canvasTexture(w, h, draw, { repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  return t;
}

/** Tiny deterministic random for scenery layouts. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ textures

export const drawTrack = (ctx, w, h) => {
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < 900; i++) {
    const g = 200 + Math.floor(r() * 50);
    ctx.fillStyle = `rgba(${g - 40},${g - 40},${g - 40},${0.25 + r() * 0.3})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
  }
  // worn lane centres
  for (const u of [1 / 6, 0.5, 5 / 6]) {
    const grd = ctx.createLinearGradient((u - 0.12) * w, 0, (u + 0.12) * w, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.07)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect((u - 0.12) * w, 0, 0.24 * w, h);
  }
  // edges
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, w * 0.035, h);
  ctx.fillRect(w * 0.965, 0, w * 0.035, h);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(w * 0.035, 0, w * 0.012, h);
  ctx.fillRect(w * 0.953, 0, w * 0.012, h);
  // dashed lane dividers
  ctx.fillStyle = '#ffffff';
  for (const u of [1 / 3, 2 / 3]) {
    ctx.fillRect(u * w - 3, h * 0.08, 6, h * 0.42);
  }
};

export const drawGround = (ctx, w, h) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const r = rng(11);
  for (let i = 0; i < 260; i++) {
    const g = 205 + Math.floor(r() * 40);
    ctx.fillStyle = `rgba(${g},${g},${g},0.55)`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, 1 + r() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(r() * w, r() * h, 1, 2 + r() * 3);
  }
};

export const drawGlow = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

export const drawShadow = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

export const drawWarn = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(239,68,68,0.55)');
  g.addColorStop(0.7, 'rgba(239,68,68,0.35)');
  g.addColorStop(1, 'rgba(239,68,68,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = w * 0.05;
  ctx.setLineDash([w * 0.08, w * 0.05]);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
  ctx.stroke();
};

export const drawStar = (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  const cx = w / 2;
  const cy = h / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 ? w * 0.09 : w * 0.48;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
};

export const drawCoinFace = (ctx, w, h) => {
  const cx = w / 2;
  const cy = h / 2;
  const g = ctx.createRadialGradient(cx - w * 0.15, cy - h * 0.15, 2, cx, cy, w / 2);
  g.addColorStop(0, '#fff7c2');
  g.addColorStop(0.5, '#facc15');
  g.addColorStop(1, '#d97706');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = w * 0.05;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.4, 0, Math.PI * 2);
  ctx.stroke();
  // embossed Poké Ball
  ctx.lineWidth = w * 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.26, 0, Math.PI * 2);
  ctx.moveTo(cx - w * 0.26, cy);
  ctx.lineTo(cx - w * 0.09, cy);
  ctx.moveTo(cx + w * 0.09, cy);
  ctx.lineTo(cx + w * 0.26, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.08, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.16, cy - h * 0.2, w * 0.1, h * 0.05, -0.6, 0, Math.PI * 2);
  ctx.fill();
};

export const drawBanner = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7c3aed');
  g.addColorStop(1, '#4c1d95');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // yellow / black hazard edges
  for (const y of [0, h - h * 0.16]) {
    for (let x = -h; x < w + h; x += h * 0.32) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + h * 0.16, y);
      ctx.lineTo(x + h * 0.32, y + h * 0.16);
      ctx.lineTo(x + h * 0.16, y + h * 0.16);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Zubat silhouettes
  const bat = (x, y, s) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c084fc';
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(d * 6, -4);
      ctx.quadraticCurveTo(d * 26, -20, d * 34, -2);
      ctx.lineTo(d * 27, 2);
      ctx.lineTo(d * 22, -2);
      ctx.lineTo(d * 16, 6);
      ctx.lineTo(d * 8, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.ellipse(0, 5, 4, 3, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  };
  bat(w * 0.2, h * 0.52, h / 70);
  bat(w * 0.5, h * 0.48, h / 60);
  bat(w * 0.8, h * 0.52, h / 70);
};

export const drawCrate = (ctx, w, h) => {
  ctx.fillStyle = '#b7793d';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#7c4a1f';
  ctx.lineWidth = w * 0.03;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i * h) / 4);
    ctx.lineTo(w, (i * h) / 4);
    ctx.stroke();
  }
  ctx.lineWidth = w * 0.09;
  ctx.strokeRect(w * 0.045, h * 0.045, w * 0.91, h * 0.91);
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.08);
  ctx.lineTo(w * 0.92, h * 0.92);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#dc2626';
  ctx.font = `900 ${Math.round(w * 0.36)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('R', w / 2, h / 2 + w * 0.02);
};

/** Meowth-face balloon (Team Rocket), wrapped round a sphere: the face is at u = 0.25 (faces +z). */
export const drawBalloon = (ctx, w, h) => {
  ctx.fillStyle = '#f5e6c4';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e9d3a3';
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
  const cx = w * 0.25;
  const cy = h * 0.5;
  const s = h / 256;
  // gold charm
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 58 * s, 16 * s, 20 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // eyes
  for (const d of [-1, 1]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx + d * 26 * s, cy - 10 * s, 13 * s, 17 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.ellipse(cx + d * 24 * s, cy - 8 * s, 4 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // whiskers
    ctx.strokeStyle = '#6b4f2a';
    ctx.lineWidth = 3 * s;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + d * 40 * s, cy + 14 * s);
      ctx.lineTo(cx + d * 80 * s, cy + (14 + k * 10) * s);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10 * s, 6 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6b4f2a';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(cx - 8 * s, cy + 18 * s, 8 * s, 0.2, Math.PI - 0.2);
  ctx.arc(cx + 8 * s, cy + 18 * s, 8 * s, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // big R on the back
  ctx.fillStyle = '#dc2626';
  ctx.font = `900 ${Math.round(90 * s)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('R', w * 0.75, cy);
};

export const drawZzz = (ctx, w, h) => {
  ctx.font = `900 ${Math.round(h * 0.5)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = h * 0.08;
  ctx.strokeStyle = '#1e3a8a';
  ctx.fillStyle = '#e0f2fe';
  const parts = [['Z', 0.3, 0.7, 1], ['z', 0.55, 0.45, 0.8], ['z', 0.78, 0.25, 0.6]];
  for (const [ch, x, y, k] of parts) {
    ctx.save();
    ctx.translate(x * w, y * h);
    ctx.scale(k, k);
    ctx.strokeText(ch, 0, 0);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
};

/** Power-up icons: magnet (Magnemite), shield (Poké Ball), double (Meowth charm), revive, boost (flame). */
export function drawPower(kind) {
  return (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const s = w / 128;
    const halo = ctx.createRadialGradient(cx, cy, 10 * s, cx, cy, 64 * s);
    const col = { magnet: '96,165,250', shield: '125,211,252', double: '250,204,21', revive: '253,224,71', boost: '251,146,60' }[kind] || '255,255,255';
    halo.addColorStop(0, `rgba(${col},0.55)`);
    halo.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.lineJoin = 'round';
    if (kind === 'magnet') {
      // Magnemite: steel ball, one eye, two magnets
      for (const d of [-1, 1]) {
        ctx.strokeStyle = d < 0 ? '#ef4444' : '#3b82f6';
        ctx.lineWidth = 12 * s;
        ctx.beginPath();
        ctx.arc(cx + d * 40 * s, cy, 14 * s, Math.PI / 2, -Math.PI / 2, d > 0);
        ctx.stroke();
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(cx + d * 40 * s - 6 * s, cy - 21 * s, 12 * s, 8 * s);
        ctx.fillRect(cx + d * 40 * s - 6 * s, cy + 13 * s, 12 * s, 8 * s);
      }
      const g = ctx.createRadialGradient(cx - 8 * s, cy - 10 * s, 2, cx, cy, 30 * s);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#94a3b8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 28 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 13 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(cx, cy, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9ca3af';
      ctx.beginPath();
      ctx.moveTo(cx - 4 * s, cy - 28 * s);
      ctx.lineTo(cx + 4 * s, cy - 28 * s);
      ctx.lineTo(cx, cy - 44 * s);
      ctx.fill();
    } else if (kind === 'shield') {
      const r = 34 * s;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(cx - r, cy - 4 * s, r * 2, 8 * s);
      ctx.beginPath();
      ctx.arc(cx, cy, 11 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(186,230,253,0.95)';
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.arc(cx, cy, 48 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(cx - 24 * s, cy - 30 * s, 9 * s, 5 * s, -0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'double') {
      // Meowth charm coin with ears and x2
      ctx.fillStyle = '#f5e6c4';
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + d * 14 * s, cy - 30 * s);
        ctx.lineTo(cx + d * 38 * s, cy - 50 * s);
        ctx.lineTo(cx + d * 34 * s, cy - 14 * s);
        ctx.fill();
      }
      const g = ctx.createRadialGradient(cx - 10 * s, cy - 10 * s, 2, cx, cy, 36 * s);
      g.addColorStop(0, '#fff7c2');
      g.addColorStop(1, '#d97706');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, 34 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 5 * s;
      ctx.stroke();
      ctx.fillStyle = '#7c2d12';
      ctx.font = `900 ${Math.round(34 * s)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x2', cx, cy + 2 * s);
    } else if (kind === 'revive') {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 44 * s);
      ctx.lineTo(cx + 30 * s, cy);
      ctx.lineTo(cx, cy + 44 * s);
      ctx.lineTo(cx - 30 * s, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 5 * s, cy - 18 * s, 10 * s, 36 * s);
      ctx.fillRect(cx - 18 * s, cy - 5 * s, 36 * s, 10 * s);
    } else {
      // flame
      const g = ctx.createLinearGradient(0, cy + 40 * s, 0, cy - 50 * s);
      g.addColorStop(0, '#fde047');
      g.addColorStop(0.5, '#fb923c');
      g.addColorStop(1, '#ef4444');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 50 * s);
      ctx.bezierCurveTo(cx + 40 * s, cy - 10 * s, cx + 34 * s, cy + 40 * s, cx, cy + 40 * s);
      ctx.bezierCurveTo(cx - 34 * s, cy + 40 * s, cx - 40 * s, cy - 10 * s, cx - 8 * s, cy - 30 * s);
      ctx.bezierCurveTo(cx - 6 * s, cy - 14 * s, cx + 2 * s, cy - 20 * s, cx, cy - 50 * s);
      ctx.fill();
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 20 * s, 12 * s, 16 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };
}

/** Placeholder until a Pokémon artwork arrives: a soft coloured blob with a Poké Ball. */
export const drawPlaceholder = (color) => (ctx, w, h) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.58, w * 0.34, h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(w * 0.42, h * 0.48, w * 0.06, 0, Math.PI * 2);
  ctx.arc(w * 0.58, h * 0.48, w * 0.06, 0, Math.PI * 2);
  ctx.fill();
};

// ------------------------------------------------------------------ low-poly scenery

const UNIT = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  ball: new THREE.IcosahedronGeometry(0.5, 1),
  dode: new THREE.DodecahedronGeometry(0.5, 0),
  octa: new THREE.OctahedronGeometry(0.5, 0),
  plane: new THREE.PlaneGeometry(1, 1),
  halfDisc: new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, false, 0, Math.PI),
  disc: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
};
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** One coloured, transformed copy of a unit shape, ready to merge. `shade` jitters the colour a little. */
export function part(kind, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, shade = 0, random = Math.random } = {}) {
  const base = UNIT[kind];
  const g = base.index ? base.toNonIndexed() : base.clone();
  g.deleteAttribute('uv');
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
  g.applyMatrix4(_m);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i += 3) {
    const k = 1 - shade + random() * shade * 2;
    for (let j = 0; j < 3 && i + j < n; j++) {
      arr[(i + j) * 3] = _c.r * k;
      arr[(i + j) * 3 + 1] = _c.g * k;
      arr[(i + j) * 3 + 2] = _c.b * k;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function merge(parts) {
  if (!parts.length) return null;
  const m = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  m.computeBoundingSphere();
  return m;
}

const CH = 40; // chunk length (m); forward is -z in three.js

/** Viridian forest: trees, bushes, wooden fences, far hills. */
function forest(r) {
  const solid = [];
  const glow = [];
  const P = (k, c, o) => solid.push(part(k, c, { random: r, ...o }));
  for (const side of [-1, 1]) {
    // fence
    for (let f = 0; f < CH; f += 4) P('box', 0x8b5a2b, { x: side * 4.3, y: 0.45, z: -f, sx: 0.18, sy: 0.9, sz: 0.18 });
    P('box', 0xb07b46, { x: side * 4.3, y: 0.68, z: -CH / 2, sx: 0.08, sy: 0.12, sz: CH });
    P('box', 0xb07b46, { x: side * 4.3, y: 0.34, z: -CH / 2, sx: 0.08, sy: 0.12, sz: CH });
    // bushes and flowers along the fence
    for (let f = r() * 4; f < CH; f += 3 + r() * 4) {
      const s = 0.8 + r() * 0.8;
      P('ico', [0x3f9e3f, 0x4caf50, 0x358a3a][Math.floor(r() * 3)], { x: side * (5.2 + r() * 1.5), y: s * 0.35, z: -f, sx: s * 1.3, sy: s * 0.9, sz: s * 1.3, shade: 0.12 });
      if (r() < 0.4) P('ball', 0xef4444, { x: side * (4.9 + r() * 0.5), y: s * 0.6, z: -f + 0.3, sx: 0.18, sy: 0.18, sz: 0.18 });
    }
    for (let i = 0; i < 6; i++) P('ico', [0xf472b6, 0xfde047, 0xffffff, 0xa78bfa][i % 4], { x: side * (3.9 + r() * 0.25), y: 0.08, z: -r() * CH, sx: 0.16, sy: 0.12, sz: 0.16 });
    // trees
    for (let f = r() * 3; f < CH; f += 4 + r() * 4) {
      const x = side * (6.5 + r() * 12);
      const s = 0.9 + r() * 0.9;
      P('cyl', 0x7a4a24, { x, y: 0.8 * s, z: -f, sx: 0.4 * s, sy: 1.6 * s, sz: 0.4 * s });
      if (r() < 0.5) {
        for (let k = 0; k < 3; k++) P('cone', [0x2f7d3a, 0x37904a, 0x41a554][k], { x, y: (1.8 + k * 1.05) * s, z: -f, sx: (2.6 - k * 0.6) * s, sy: 1.6 * s, sz: (2.6 - k * 0.6) * s, ry: r(), shade: 0.1 });
      } else {
        P('ico', [0x4caf50, 0x5cbf4a, 0x3d9a40][Math.floor(r() * 3)], { x, y: 2.6 * s, z: -f, sx: 2.6 * s, sy: 2.3 * s, sz: 2.6 * s, ry: r() * 3, shade: 0.12 });
        if (r() < 0.5) P('ico', 0x66c25a, { x: x + side * 0.4, y: 3.3 * s, z: -f + 0.4, sx: 1.5 * s, sy: 1.3 * s, sz: 1.5 * s, shade: 0.1 });
      }
    }
    // far hills
    for (let i = 0; i < 2; i++) P('ico', 0x4f9a4a, { x: side * (34 + r() * 20), y: 0, z: -(i * 20 + r() * 20), sx: 22 + r() * 10, sy: 10 + r() * 8, sz: 18, shade: 0.06 });
  }
  return { solid: merge(solid), glow: merge(glow) };
}

/** City: sidewalks, lamp posts, buildings with lit windows, a Pokémon Center now and then. */
function city(r, withCenter) {
  const solid = [];
  const glow = [];
  const P = (k, c, o) => solid.push(part(k, c, { random: r, ...o }));
  const G = (k, c, o) => glow.push(part(k, c, { random: r, ...o }));
  const colors = [0xf4a6a6, 0x9ecbf0, 0xf6d38b, 0xb7e4c7, 0xd7c3f0, 0xe9e2d6, 0xffc4a3];
  for (const side of [-1, 1]) {
    P('box', 0xcfd3da, { x: side * 5.0, y: 0.09, z: -CH / 2, sx: 1.9, sy: 0.18, sz: CH });
    P('box', 0x9ca3af, { x: side * 4.05, y: 0.11, z: -CH / 2, sx: 0.12, sy: 0.22, sz: CH });
    for (let f = 5; f < CH; f += 10) {
      const x = side * 4.5;
      P('cyl', 0x334155, { x, y: 1.8, z: -f, sx: 0.14, sy: 3.6, sz: 0.14 });
      P('box', 0x334155, { x: x - side * 0.45, y: 3.55, z: -f, sx: 0.9, sy: 0.1, sz: 0.12 });
      P('box', 0x1f2937, { x: x - side * 0.85, y: 3.45, z: -f, sx: 0.5, sy: 0.14, sz: 0.34 });
      G('ball', 0xfff1a8, { x: x - side * 0.85, y: 3.3, z: -f, sx: 0.34, sy: 0.22, sz: 0.3 });
    }
    // buildings
    let f = r() * 2;
    let center = withCenter && side === -1;
    while (f < CH - 3) {
      const depth = 6 + r() * 4;
      const zc = -(f + depth / 2);
      if (center) {
        center = false;
        const x0 = side * 7.2;
        const w = 8;
        P('box', 0xfafafa, { x: x0 + side * (w / 2), y: 3.2, z: zc, sx: w, sy: 6.4, sz: depth });
        P('box', 0xe53935, { x: x0 + side * (w / 2), y: 6.9, z: zc, sx: w + 0.8, sy: 1.2, sz: depth + 0.8 });
        P('box', 0xe53935, { x: x0 + side * 0.1, y: 1.2, z: zc, sx: 0.3, sy: 2.4, sz: depth * 0.9 });
        G('box', 0x9be7ff, { x: x0 - side * 0.02, y: 1.25, z: zc, sx: 0.12, sy: 2.2, sz: 2.4 });
        // Poké Ball sign facing the track
        const sx = x0 - side * 0.12;
        const sy = 4.6;
        G('halfDisc', 0xff3b3b, { x: sx, y: sy, z: zc, rz: side * Math.PI / 2, ry: 0, sx: 2.4, sy: 0.2, sz: 2.4 });
        G('halfDisc', 0xffffff, { x: sx, y: sy, z: zc, rz: side * Math.PI / 2, rx: Math.PI, sx: 2.4, sy: 0.2, sz: 2.4 });
        G('box', 0x111827, { x: sx - side * 0.12, y: sy, z: zc, sx: 0.06, sy: 0.24, sz: 2.4 });
        G('disc', 0x111827, { x: sx - side * 0.13, y: sy, z: zc, rz: Math.PI / 2, sx: 0.8, sy: 0.06, sz: 0.8 });
        G('disc', 0xffffff, { x: sx - side * 0.16, y: sy, z: zc, rz: Math.PI / 2, sx: 0.5, sy: 0.06, sz: 0.5 });
        f += depth + 1.5;
        continue;
      }
      const w = 6 + r() * 5;
      const h = 7 + r() * 16;
      const x0 = side * (7.2 + r() * 1.5);
      const col = colors[Math.floor(r() * colors.length)];
      P('box', col, { x: x0 + side * (w / 2), y: h / 2, z: zc, sx: w, sy: h, sz: depth, shade: 0.03 });
      P('box', 0x6b7280, { x: x0 + side * (w / 2), y: h + 0.2, z: zc, sx: w + 0.3, sy: 0.4, sz: depth + 0.3 });
      // windows on the face toward the track
      for (let wy = 1.8; wy < h - 0.8; wy += 2.1) {
        for (let wz = -depth / 2 + 1.1; wz < depth / 2 - 0.6; wz += 1.7) {
          const lit = r() < 0.55;
          (lit ? G : P)('plane', lit ? [0xffe9a0, 0xfff6d6, 0xffd27a][Math.floor(r() * 3)] : 0x3b4a6b, { x: x0 - side * 0.03, y: wy, z: zc + wz, ry: -side * Math.PI / 2, sx: 0.9, sy: 1.1 });
        }
      }
      f += depth + 0.8 + r() * 1.5;
    }
    // small trees in planters
    for (let k = 0; k < 2; k++) {
      const tz = -(r() * CH);
      P('box', 0x9ca3af, { x: side * 5.4, y: 0.35, z: tz, sx: 0.8, sy: 0.5, sz: 0.8 });
      P('ico', 0x4caf50, { x: side * 5.4, y: 1.5, z: tz, sx: 1.4, sy: 1.6, sz: 1.4, shade: 0.1 });
    }
    // far skyline
    for (let k = 0; k < 4; k++) P('box', 0x59628a, { x: side * (30 + r() * 25), y: 10, z: -(k * 10 + r() * 8), sx: 8 + r() * 6, sy: 20 + r() * 30, sz: 8 });
  }
  return { solid: merge(solid), glow: merge(glow) };
}

/** Rock cave: boulder walls, stalagmites, glowing crystals, a few arches. */
function cave(r) {
  const solid = [];
  const glow = [];
  const P = (k, c, o) => solid.push(part(k, c, { random: r, ...o }));
  const G = (k, c, o) => glow.push(part(k, c, { random: r, ...o }));
  const rock = [0x5b4f72, 0x6a5d84, 0x4a3f5f, 0x7a6b8f];
  const crystal = [0x5ef0ff, 0xff7be5, 0xb57bff, 0x7dffb2];
  for (const side of [-1, 1]) {
    for (let f = 0; f < CH; f += 2.6 + r() * 1.5) {
      const s = 2.2 + r() * 2;
      P('dode', rock[Math.floor(r() * 4)], { x: side * (5.6 + s * 0.4), y: s * 0.35, z: -f, sx: s, sy: s * 1.1, sz: s, rx: r() * 3, ry: r() * 3, shade: 0.1 });
      if (r() < 0.8) P('dode', rock[Math.floor(r() * 4)], { x: side * (7.5 + r() * 2), y: 3 + r() * 2, z: -f - 1, sx: s * 1.2, sy: s * 1.4, sz: s, rx: r() * 3, shade: 0.1 });
      if (r() < 0.6) P('dode', rock[Math.floor(r() * 4)], { x: side * (9 + r() * 3), y: 7 + r() * 3, z: -f, sx: s * 1.6, sy: s * 1.6, sz: s * 1.4, rx: r() * 3, shade: 0.1 });
    }
    for (let k = 0; k < 3; k++) P('cone', 0x6a5d84, { x: side * (4.6 + r() * 0.8), y: 0.9, z: -r() * CH, sx: 0.7, sy: 1.8 + r() * 1.5, sz: 0.7, shade: 0.1 });
    // crystal clusters
    for (let k = 0; k < 4; k++) {
      const cz = -r() * CH;
      const cx = side * (4.5 + r() * 0.9);
      const col = crystal[Math.floor(r() * crystal.length)];
      for (let i = 0; i < 4; i++) {
        const h = 0.8 + r() * 1.4;
        G('octa', col, { x: cx + (r() - 0.5) * 0.7, y: h * 0.4, z: cz + (r() - 0.5) * 0.8, sx: 0.32, sy: h, sz: 0.32, rz: (r() - 0.5) * 0.7, rx: (r() - 0.5) * 0.5 });
      }
    }
    for (let k = 0; k < 2; k++) G('octa', crystal[Math.floor(r() * 4)], { x: side * (6.5 + r()), y: 3 + r() * 3, z: -r() * CH, sx: 0.4, sy: 1.3, sz: 0.4, rz: side * 0.6 });
  }
  // an arch overhead
  if (r() < 0.7) {
    const az = -r() * CH;
    for (let i = -3; i <= 3; i++) P('dode', rock[Math.abs(i) % 4], { x: i * 1.9, y: 9.2 - Math.abs(i) * 0.35 + r(), z: az, sx: 2.6, sy: 2, sz: 2.4, rx: r() * 3, shade: 0.1 });
    for (let i = 0; i < 3; i++) P('cone', 0x4a3f5f, { x: (r() - 0.5) * 8, y: 7.4, z: az + (r() - 0.5), rx: Math.PI, sx: 0.6, sy: 1.6 + r(), sz: 0.6 });
  }
  return { solid: merge(solid), glow: merge(glow) };
}

/** Beach at sunset: sea on the right, palms, umbrellas, sand castles. */
function beach(r) {
  const solid = [];
  const glow = [];
  const P = (k, c, o) => solid.push(part(k, c, { random: r, ...o }));
  // sea and foam
  P('box', 0x2a9fd0, { x: 72, y: 0.02, z: -CH / 2, sx: 128, sy: 0.04, sz: CH });
  P('box', 0x5fd3ea, { x: 8.2, y: 0.04, z: -CH / 2, sx: 2.4, sy: 0.04, sz: CH });
  for (let f = 0; f < CH; f += 3 + r() * 5) P('box', 0xffffff, { x: 7.1 + r() * 0.4, y: 0.07, z: -f, sx: 0.25, sy: 0.03, sz: 2 + r() * 3 });
  for (let k = 0; k < 4; k++) P('box', 0xbfefff, { x: 16 + r() * 40, y: 0.06, z: -r() * CH, sx: 0.2, sy: 0.02, sz: 3 + r() * 4 });
  const palm = (x, f, s, lean) => {
    let px = x;
    let py = 0;
    for (let i = 0; i < 6; i++) {
      P('cyl', i % 2 ? 0xa0703e : 0x8a5a2e, { x: px, y: py + 0.45 * s, z: -f, sx: (0.42 - i * 0.03) * s, sy: 0.95 * s, sz: (0.42 - i * 0.03) * s, rz: -lean * (0.15 + i * 0.05) });
      px += lean * (0.08 + i * 0.05) * s;
      py += 0.9 * s;
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + r();
      const cx = px + Math.cos(a) * 1.1 * s;
      const cz = -f + Math.sin(a) * 1.1 * s;
      P('box', k % 2 ? 0x2e9e4a : 0x3cb55a, { x: cx, y: py - 0.2 * s, z: cz, sx: 2.4 * s, sy: 0.06, sz: 0.55 * s, ry: -a, rz: 0, rx: 0, shade: 0.08 });
      P('box', 0x2a8a43, { x: px + Math.cos(a) * 2.2 * s, y: py - 0.75 * s, z: -f + Math.sin(a) * 2.2 * s, sx: 1.0 * s, sy: 0.06, sz: 0.45 * s, ry: -a, rz: 0 });
    }
    for (let k = 0; k < 3; k++) P('ball', 0x6b3e1e, { x: px + (r() - 0.5) * 0.5, y: py - 0.35 * s, z: -f + (r() - 0.5) * 0.5, sx: 0.32, sy: 0.32, sz: 0.32 });
  };
  for (let f = r() * 4; f < CH; f += 7 + r() * 6) palm(5.4 + r() * 0.8, f, 0.9 + r() * 0.4, 1);
  for (let f = r() * 4; f < CH; f += 6 + r() * 6) palm(-(6.5 + r() * 9), f, 0.9 + r() * 0.5, -1);
  // umbrellas, towels, beach balls, sand castles on the left
  for (let k = 0; k < 2; k++) {
    const f = r() * CH;
    const x = -(5.5 + r() * 4);
    const col = [0xff5a5a, 0x4fc3ff, 0xffd84f, 0xff8ad8][Math.floor(r() * 4)];
    P('cyl', 0xf8fafc, { x, y: 1.1, z: -f, sx: 0.08, sy: 2.2, sz: 0.08 });
    P('cone', col, { x, y: 2.35, z: -f, sx: 3, sy: 0.7, sz: 3 });
    P('cone', 0xffffff, { x, y: 2.5, z: -f, sx: 1.6, sy: 0.42, sz: 1.6 });
    P('box', [0x60a5fa, 0xf472b6, 0x34d399][Math.floor(r() * 3)], { x: x + 1.2, y: 0.03, z: -f, sx: 1, sy: 0.04, sz: 1.9 });
  }
  if (r() < 0.6) {
    const f = r() * CH;
    const x = -(5 + r() * 3);
    P('box', 0xe6c27a, { x, y: 0.35, z: -f, sx: 1.4, sy: 0.7, sz: 1.4 });
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) P('cone', 0xdcb46a, { x: x + dx, y: 1.0, z: -f + dz, sx: 0.4, sy: 0.6, sz: 0.4 });
  }
  for (let k = 0; k < 2; k++) {
    const b = { x: -(4.8 + r() * 4), z: -r() * CH };
    P('ball', [0xff5a5a, 0x4fc3ff, 0xfde047][k % 3], { x: b.x, y: 0.3, z: b.z, sx: 0.6, sy: 0.6, sz: 0.6, shade: 0.3 });
  }
  for (let k = 0; k < 3; k++) P('dode', 0xb9a07a, { x: (r() < 0.5 ? -1 : 1) * (4.6 + r()), y: 0.15, z: -r() * CH, sx: 0.6, sy: 0.4, sz: 0.5 });
  return { solid: merge(solid), glow: merge(glow) };
}

export const CHUNK_LEN = CH;
/** Scenery for one chunk of a world. `variant` picks a layout. */
export function buildChunk(world, variant) {
  const r = rng(1000 * (world + 1) + variant * 77 + 3);
  if (world === 0) return forest(r);
  if (world === 1) return city(r, variant % 2 === 0);
  if (world === 2) return cave(r);
  return beach(r);
}

// ------------------------------------------------------------------ obstacle models

export function barrierGeometry() {
  const parts = [];
  for (const d of [-1, 1]) parts.push(part('box', 0x475569, { x: d * 0.88, y: 0.42, sx: 0.16, sy: 0.84, sz: 0.16 }));
  for (let i = 0; i < 5; i++) parts.push(part('box', i % 2 ? 0xffffff : 0xef4444, { x: -0.76 + i * 0.38, y: 0.58, sx: 0.38, sy: 0.36, sz: 0.14 }));
  for (let i = 0; i < 5; i++) parts.push(part('box', i % 2 ? 0xef4444 : 0xffffff, { x: -0.76 + i * 0.38, y: 0.22, sx: 0.38, sy: 0.16, sz: 0.1 }));
  parts.push(part('box', 0xfacc15, { x: 0, y: 0.8, sx: 1.95, sy: 0.06, sz: 0.16 }));
  return merge(parts);
}

export function barPostsGeometry() {
  const parts = [];
  for (const d of [-1, 1]) {
    parts.push(part('box', 0x334155, { x: d * 1.0, y: 1.35, sx: 0.16, sy: 2.7, sz: 0.16 }));
    parts.push(part('box', 0x1f2937, { x: d * 1.0, y: 0.06, sx: 0.5, sy: 0.12, sz: 0.5 }));
  }
  parts.push(part('box', 0x475569, { x: 0, y: 2.62, sx: 2.16, sy: 0.12, sz: 0.14 }));
  return merge(parts);
}

export function basketGeometry() {
  const parts = [];
  parts.push(part('box', 0x8b5a2b, { y: 0, sx: 1.1, sy: 0.7, sz: 1.1 }));
  parts.push(part('box', 0x6b3e1e, { y: 0.36, sx: 1.2, sy: 0.08, sz: 1.2 }));
  for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) parts.push(part('cyl', 0x4b5563, { x: dx * 0.9, y: 1.2, z: dz * 0.9, sx: 0.04, sy: 1.7, sz: 0.04 }));
  return merge(parts);
}
