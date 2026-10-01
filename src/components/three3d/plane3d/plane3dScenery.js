// Scenery of the 10 levels of "Đua máy bay Pokémon": sky / fog / light palettes and recycled scenery chunks.
// A chunk covers CHUNK m of track (forward f = 0..CHUNK maps to three.js z = 0..-CHUNK) and ±150 m sideways;
// it is ONE merged vertex-coloured geometry (terrain + decorations) plus a few spinning parts (windmills).
// The ground is at y = 0, the plane flies at y = ALT. Terrain heights are periodic so chunks join seamlessly.
import { part, merge, placeAll, box, rbox, cyl, sph, ico, cone, torus, slab, lumpy, shade, mix, rng, TAU } from './plane3dGeo';
import * as THREE from 'three';

export const CHUNK = 90;
const HALF_W = 150;
const NX = 64;
const NF = 18;
const CELL_X = (HALF_W * 2) / NX;
const CELL_F = CHUNK / NF;

/**
 * Per-level look. sky = [top, middle, horizon]; sun = { dir, color, size, glow }; fog = [color, near, far];
 * hemi = [sky, ground, intensity]; dir = [color, intensity]; ground: terrain | water | clouds | none;
 * particles: pollen | sea | leaves | dust | sand | snow | embers | sparkle | petals | space; puffs: cloud puff colours.
 */
export const THEMES = [
  {
    key: 'meadow', sky: ['#2f8fe8', '#8fd0ff', '#e9f8ff'], sun: { dir: [-0.35, 0.55, -1], color: '#fff6d8', size: 0.035, glow: 0.5 },
    fog: ['#cfe9ff', 95, 330], hemi: ['#eaf6ff', '#6f9f4a', 1.15], dir: ['#fff2d6', 1.6], ground: 'terrain', particles: 'pollen',
    puffs: { color: '#ffffff', shadow: '#dbe7f7', glow: 0.08 }, backdrop: { kind: 'hills', colors: ['#9fd0a6', '#c7e6ef'], h: 34 }, rock: 'grass', hotair: 0,
  },
  {
    key: 'sea', sky: ['#1f7fe0', '#7fd3ff', '#eafcff'], sun: { dir: [0.4, 0.5, -1], color: '#fffbe6', size: 0.03, glow: 0.6 },
    fog: ['#cdeefb', 95, 340], hemi: ['#e6f9ff', '#2a8fb8', 1.15], dir: ['#fff5e0', 1.6], ground: 'water', water: { deep: '#1597c9', shallow: '#4fd2ee', foam: '#e8fdff' }, particles: 'sea',
    puffs: { color: '#ffffff', shadow: '#d6e9f5', glow: 0.08 }, backdrop: { kind: 'islands', colors: ['#7fbfa8', '#cbecf2'], h: 22 }, rock: 'tropic', hotair: 1,
  },
  {
    key: 'forest', sky: ['#3b8fd0', '#a6dcc8', '#e6f6dc'], sun: { dir: [-0.2, 0.62, -1], color: '#fff0c8', size: 0.03, glow: 0.45 },
    fog: ['#c6e4cc', 70, 300], hemi: ['#e8f6e0', '#2f5a2a', 1.05], dir: ['#ffeec4', 1.5], ground: 'terrain', particles: 'leaves',
    puffs: { color: '#f6fff6', shadow: '#d3e6d6', glow: 0.06 }, backdrop: { kind: 'forest', colors: ['#5f9f6a', '#b9dcc6'], h: 40 }, rock: 'grass', hotair: 2,
  },
  {
    key: 'city', sky: ['#2c2f7a', '#b57ad6', '#ffb88a'], sun: { dir: [0.25, 0.12, -1], color: '#ffcf9a', size: 0.06, glow: 0.9 },
    fog: ['#e3a2a8', 90, 330], hemi: ['#ffd9c8', '#4a4870', 1.0], dir: ['#ffc59a', 1.35], ground: 'terrain', particles: 'dust',
    puffs: { color: '#ffd9e2', shadow: '#c79bc6', glow: 0.12 }, backdrop: { kind: 'skyline', colors: ['#6d5a99', '#d796b8'], h: 46 }, rock: 'grass', hotair: 1, windows: true,
  },
  {
    key: 'desert', sky: ['#3a8fe0', '#9ed6f5', '#fff0cc'], sun: { dir: [0.1, 0.75, -1], color: '#fffbe8', size: 0.045, glow: 0.8 },
    fog: ['#f6deb0', 95, 330], hemi: ['#fff6e2', '#c98a4a', 1.1], dir: ['#fff0d2', 1.75], ground: 'terrain', particles: 'sand',
    puffs: { color: '#ffffff', shadow: '#f2e1c6', glow: 0.1 }, backdrop: { kind: 'mesas', colors: ['#d79a6a', '#f6d7b0'], h: 40 }, rock: 'sand', hotair: 2,
  },
  {
    key: 'snow', sky: ['#4a7fd8', '#a9cfff', '#f2f8ff'], sun: { dir: [-0.4, 0.4, -1], color: '#ffffff', size: 0.03, glow: 0.45 },
    fog: ['#e2edfa', 80, 320], hemi: ['#f4f9ff', '#8ea7c4', 1.15], dir: ['#ffffff', 1.5], ground: 'terrain', particles: 'snow',
    puffs: { color: '#ffffff', shadow: '#d5e2f2', glow: 0.1 }, backdrop: { kind: 'peaks', colors: ['#9cb6d8', '#e8f1fb'], h: 80 }, rock: 'grass', hotair: 1,
  },
  {
    key: 'volcano', sky: ['#2a0f1f', '#8a2b2b', '#ff8a3d'], sun: { dir: [0.0, 0.08, -1], color: '#ff7a3a', size: 0.07, glow: 1.0 },
    fog: ['#8a3a2a', 55, 260], hemi: ['#ffb08a', '#3a1a1a', 0.85], dir: ['#ffb27a', 1.2], ground: 'terrain', particles: 'embers',
    puffs: { color: '#6a5560', shadow: '#3f3038', glow: 0.0 }, backdrop: { kind: 'volcano', colors: ['#3a1e24', '#9a3b2a'], h: 70 }, rock: 'grass', hotair: 0, glowBoost: 1.3,
  },
  {
    key: 'cave', sky: ['#0b0618', '#1d1238', '#2e1d4f'], sun: { dir: [0, 0.6, -1], color: '#b38cff', size: 0.0, glow: 0.0 },
    fog: ['#22163f', 30, 180], hemi: ['#b49cff', '#2a1a4a', 0.9], dir: ['#c7b2ff', 0.7], ground: 'terrain', particles: 'sparkle',
    puffs: null, backdrop: null, rock: 'cave', hotair: 0, cave: true, glowBoost: 1.4,
  },
  {
    key: 'sunset', sky: ['#3b2a7a', '#ff7aa8', '#ffd08a'], sun: { dir: [0.0, 0.06, -1], color: '#ffe0a0', size: 0.09, glow: 1.2 },
    fog: ['#ffc2a8', 110, 340], hemi: ['#ffe2d0', '#b0608a', 1.05], dir: ['#ffc8a0', 1.4], ground: 'clouds', particles: 'petals',
    puffs: { color: '#ffe6ee', shadow: '#e7a3c0', glow: 0.18 }, backdrop: { kind: 'cloudsea', colors: ['#f2a3b8', '#ffd3b8'], h: 18 }, rock: 'sunset', hotair: 0,
  },
  {
    key: 'space', sky: ['#05030f', '#120a35', '#2a1458'], sun: { dir: [0.5, 0.3, -1], color: '#fff2c8', size: 0.025, glow: 0.5 },
    fog: ['#120a30', 90, 420], hemi: ['#c8c2ff', '#2a1d5a', 0.95], dir: ['#fff4e0', 1.4], ground: 'none', particles: 'space',
    puffs: null, backdrop: null, rock: 'asteroid', hotair: 0, stars: true, nebula: true,
  },
];

// ---------------------------------------------------------------- terrain heights (periodic in f)
const S = (k, f) => Math.sin((Math.PI * k * f) / CHUNK); // zero at both chunk ends
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Ground height (m) at sideways x and forward f inside a chunk of a level / variant. */
export function heightAt(level, variant, x, f) {
  const ax = Math.abs(x);
  const v = variant * 1.7 + 0.3;
  const wob = (a, k1, k2) => a * S(k1, f) * Math.cos(x * 0.05 * k2 + v) + a * 0.6 * S(k2, f) * Math.sin(x * 0.083 + v * 2);
  switch (THEMES[level].key) {
    case 'meadow':
      return smooth(14, 70, ax) * (9 + 5 * Math.sin(x * 0.04 + v)) + smooth(70, 150, ax) * 14 + wob(1.6, 2, 3) * smooth(6, 30, ax) + 0.4 * S(4, f) * Math.sin(x * 0.2);
    case 'forest':
      return smooth(16, 80, ax) * 7 + wob(1.4, 2, 4) * smooth(8, 30, ax);
    case 'city':
      return smooth(60, 150, ax) * 4;
    case 'desert':
      return 1.2 * Math.sin(x * 0.12 + v) * S(2, f) + 2.2 * Math.sin(x * 0.045) * smooth(8, 22, ax) + smooth(26, 34, ax) * (16 + 6 * Math.sin(x * 0.07 + v)) + wob(2.2, 3, 2) * smooth(26, 40, ax);
    case 'snow':
      return smooth(18, 60, ax) * 10 + smooth(55, 140, ax) * 42 * (0.7 + 0.3 * Math.sin(x * 0.03 + v)) + wob(4, 2, 3) * smooth(30, 80, ax) + wob(0.8, 4, 5) * (1 - smooth(10, 20, ax));
    case 'volcano':
      return smooth(16, 70, ax) * 8 + wob(2.4, 2, 3) * smooth(6, 40, ax) + smooth(70, 150, ax) * 20;
    case 'cave':
      return smooth(16, 26, ax) * 26 + wob(1.2, 3, 5) + smooth(16, 30, ax) * wob(3, 2, 4);
    default:
      return 0;
  }
}

/** Cave roof height (m). */
const roofAt = (variant, x, f) => 25 - smooth(10, 26, Math.abs(x)) * 6 + 1.6 * S(3, f) * Math.cos(x * 0.21 + variant) + 1.2 * S(5, f) * Math.sin(x * 0.13);

// ---------------------------------------------------------------- terrain colours
function terrainColor(level, variant, x, f, y) {
  const ax = Math.abs(x);
  const n = Math.sin(x * 0.31 + f * 0.17) * Math.sin(x * 0.11 - f * 0.23);
  switch (THEMES[level].key) {
    case 'meadow': {
      // patchwork fields aligned to the terrain grid (cells of CELL_X × CELL_F) so their edges are crisp
      const cx = Math.floor((x + HALF_W) / CELL_X);
      const cf = Math.floor(f / CELL_F);
      const fx = Math.floor(cx / 3);
      const ff = Math.floor(cf / 3);
      if (y > 16) return n > 0.2 ? '#6fb84e' : '#7cc45a';
      if (ax < CELL_X * 1.5) return cf % 2 ? '#e9d49c' : '#e2ca8c'; // a country path under the lanes
      const fields = ['#7ccf5a', '#a8dc68', '#f0d45a', '#62bf4e', '#93d461', '#e6bd4c', '#8ad87a'];
      return fields[(fx * 3 + ff * 5 + variant + ((fx * 7 + ff * 3) % 4)) % fields.length];
    }
    case 'forest':
      return n > 0.3 ? '#3e7f3a' : n < -0.3 ? '#2f6a33' : '#467f3c';
    case 'city': {
      // blocks of 5 × 6 cells: one cell of road around each, a sidewalk ring, then a park or a plaza
      const cx = Math.floor((x + HALF_W) / CELL_X);
      const cf = Math.floor(f / CELL_F);
      const bx = ((cx % 5) + 5) % 5;
      const bf = cf % 6;
      if (bx === 0 || bf === 0) return '#565a6e';
      if (bx === 1 || bx === 4 || bf === 1 || bf === 5) return '#c4bfcf';
      return (Math.floor(cx / 5) + Math.floor(cf / 6)) % 3 === 0 ? '#6fb35f' : '#9b96ad';
    }
    case 'desert':
      if (y > 9) return ['#d9874e', '#c46a3c', '#e8a066', '#b65c34'][Math.floor(y / 3.2) % 4];
      return n > 0.25 ? '#f5d39a' : n < -0.25 ? '#e9bd7c' : '#f0c98a';
    case 'snow':
      if (y > 34) return '#ffffff';
      if (y > 18) return n > 0.1 ? '#8c96a8' : '#ffffff';
      if (ax < 14) return n > 0 ? '#bfe6f7' : '#d4effa'; // frozen river
      return n > 0.3 ? '#e2ecf7' : '#f6fbff';
    case 'volcano':
      return n > 0.2 ? '#3a2c30' : n < -0.3 ? '#2b2125' : '#4a383a';
    case 'cave':
      return y > 12 ? (n > 0 ? '#3d2f5c' : '#33274f') : n > 0.2 ? '#4a3a6e' : '#3a2d5a';
    default:
      return '#888888';
  }
}

/** Lava rivers and pools (glowing). */
const lavaAt = (variant, x, f) => {
  const cx = 26 * Math.sin(f * 0.07 + variant * 2) + (variant % 2 ? -40 : 40);
  return Math.abs(x - cx) < 3.2 + 1.2 * Math.sin(f * 0.3) || Math.abs(x + cx * 0.6 + 70) < 2.4;
};

function terrain(level, variant) {
  const g = new THREE.PlaneGeometry(HALF_W * 2, CHUNK, NX, NF).rotateX(-Math.PI / 2).translate(0, 0, -CHUNK / 2);
  const p = g.attributes.position;
  const key = THEMES[level].key;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const f = -p.getZ(i);
    let y = heightAt(level, variant, x, f);
    if (key === 'volcano' && lavaAt(variant, x, f)) y -= 0.8;
    p.setY(i, y);
  }
  g.computeVertexNormals();
  const lava = key === 'volcano';
  return part(g, (tri, pos, i, c) => (lava && lavaAt(variant, c.x, -c.z) ? '#ff7a1a' : terrainColor(level, variant, c.x, -c.z, c.y)), {
    outline: 'none',
    glow: lava ? (c) => (lavaAt(variant, c.x, -c.z) ? 1.1 : 0) : 0,
    flicker: lava ? (c) => (lavaAt(variant, c.x, -c.z) ? 0.5 : 0) : 0,
  });
}

function caveRoof(variant) {
  const g = new THREE.PlaneGeometry(64, CHUNK, 20, 14).rotateX(Math.PI / 2).translate(0, 0, -CHUNK / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, roofAt(variant, p.getX(i), -p.getZ(i)));
  g.computeVertexNormals();
  return part(g, (tri, pos, i, c) => (Math.sin(c.x * 0.4 + c.z * 0.2) > 0.3 ? '#2c2148' : '#362a58'), { outline: 'none' });
}

// ---------------------------------------------------------------- decorations (built at the origin)
const sway = 0.12;
function roundTree(R, pal = ['#4fb35a', '#66c46a', '#3e9a4c'], s = 1) {
  const o = [];
  o.push(part(cyl(0.32, 0.5, 3.2, 8), '#8a5a33', { p: [0, 1.6, 0] }));
  const n = 3 + Math.floor(R() * 2);
  for (let k = 0; k < n; k++) {
    const r = (1.5 + R() * 0.9) * (k ? 0.85 : 1.15);
    o.push(part(lumpy(ico(r, 1), 0.08, R() * 9), pal[k % pal.length], { p: [(R() - 0.5) * 1.6, 4.2 + R() * 1.4 + (k ? 0.4 : 0), (R() - 0.5) * 1.6], flap: sway, outline: 'radial' }));
  }
  if (R() < 0.35) for (let k = 0; k < 3; k++) o.push(part(sph(0.18, 8, 6), '#ef4444', { p: [(R() - 0.5) * 2.6, 3.6 + R() * 1.6, 1.0 + R() * 0.6], outline: 'none' }));
  return placeAll(o, { s });
}
function pine(R, snow = false, s = 1) {
  const o = [];
  o.push(part(cyl(0.25, 0.4, 2, 7), '#7a4a2a', { p: [0, 1, 0] }));
  const greens = ['#2f7d4a', '#3a8f55', '#46a060'];
  for (let k = 0; k < 3; k++) {
    const r = 2.3 - k * 0.6;
    const y = 2.2 + k * 1.7;
    o.push(part(cone(r, 2.8, 9), (tri, pos, i, c) => (snow && c.y > y + 0.35 ? '#ffffff' : greens[k]), { p: [0, y + 1.4, 0], flap: sway * 0.6 }));
  }
  return placeAll(o, { s, r: [0, R() * TAU, 0] });
}
function palm(R, s = 1) {
  const o = [];
  const lean = (R() - 0.5) * 0.5;
  for (let k = 0; k < 8; k++) o.push(part(cyl(0.22, 0.28, 0.9, 7), k % 2 ? '#9a6b3e' : '#b5834f', { p: [lean * k * 0.35, 0.45 + k * 0.85, 0], r: [0, 0, -lean * 0.3] }));
  const top = [lean * 2.8, 7.2, 0];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU;
    o.push(part(sph(1.6, 10, 6), k % 2 ? '#3fae5a' : '#2f9a4c', { p: [top[0] + Math.cos(a) * 1.4, top[1] - 0.3, Math.sin(a) * 1.4], s: [1.3, 0.12, 0.42], r: [0, -a, -0.4], flap: 0.15 }));
  }
  for (let k = 0; k < 3; k++) o.push(part(sph(0.28, 8, 6), '#7a4a22', { p: [top[0] + Math.cos(k * 2) * 0.4, top[1] - 0.5, Math.sin(k * 2) * 0.4] }));
  return placeAll(o, { s, r: [0, R() * TAU, 0] });
}
function cactus(R, s = 1) {
  const o = [];
  const rib = (tri, pos, i, c) => (Math.floor(((Math.atan2(c.z, c.x) + TAU) / TAU) * 16) % 2 ? '#4f9a4a' : '#5fb058');
  o.push(part(cyl(0.6, 0.7, 6.5, 16), rib, { p: [0, 3.25, 0] }));
  o.push(part(sph(0.6, 16, 8), '#5fb058', { p: [0, 6.5, 0] }));
  for (const sx of [-1, 1]) {
    const h = 2.4 + R() * 1.6;
    o.push(part(cyl(0.38, 0.42, 1.6, 12), rib, { p: [sx * 1.0, h, 0], r: [0, 0, Math.PI / 2] }));
    o.push(part(cyl(0.38, 0.42, 2.2, 12), rib, { p: [sx * 1.6, h + 1.0, 0] }));
    o.push(part(sph(0.38, 12, 8), '#5fb058', { p: [sx * 1.6, h + 2.1, 0] }));
  }
  if (R() < 0.6) o.push(part(sph(0.3, 10, 6), '#ff7aa8', { p: [0, 7.0, 0] }));
  return placeAll(o, { s, r: [0, R() * TAU, 0] });
}
function gable(w, h, d) {
  return slab([[-w / 2, 0], [w / 2, 0], [0, h]], d, 0.05, 1);
}
const dome = (r) => new THREE.SphereGeometry(r, 16, 8, 0, TAU, 0, Math.PI / 2);
function barn() {
  const o = [];
  o.push(part(rbox(6, 4, 8, 0.15), '#d64545', { p: [0, 2, 0] }));
  o.push(part(gable(6.8, 2.6, 8.6).rotateY(Math.PI / 2), '#6b4a3a', { p: [0, 4, 0] }));
  o.push(part(rbox(2.4, 2.8, 0.2, 0.05), '#ffffff', { p: [0, 1.4, 4.05] }));
  o.push(part(box(0.25, 3.3, 0.1), '#ffffff', { p: [0, 1.4, 4.15], r: [0, 0, 0.7], outline: 'none' }));
  o.push(part(box(0.25, 3.3, 0.1), '#ffffff', { p: [0, 1.4, 4.15], r: [0, 0, -0.7], outline: 'none' }));
  o.push(part(cyl(1.6, 1.6, 8, 14), (tri, pos, i, c) => (Math.floor(c.y / 1.3) % 2 ? '#e8e2d4' : '#cfc7b5'), { p: [5, 4, -1] }));
  o.push(part(dome(1.65), '#8aa0b8', { p: [5, 8, -1] }));
  return o;
}
function house(R, pal) {
  const o = [];
  const roof = pal || ['#ef6b5a', '#4f8fe0', '#f2a93b', '#8b6fd0'][Math.floor(R() * 4)];
  o.push(part(rbox(4, 3, 4, 0.12), '#fff3dc', { p: [0, 1.5, 0] }));
  o.push(part(gable(4.6, 2.2, 4.6), roof, { p: [0, 3, 0] }));
  o.push(part(rbox(0.9, 1.6, 0.15, 0.05), '#8a5a33', { p: [0, 0.8, 2.02] }));
  for (const sx of [-1, 1]) o.push(part(rbox(0.8, 0.8, 0.12, 0.04), '#9fd6ff', { p: [sx * 1.2, 1.9, 2.02], glow: 0.15 }));
  o.push(part(rbox(0.6, 1.4, 0.6, 0.05), '#b0a090', { p: [1.2, 4.2, -0.6] }));
  return placeAll(o, { r: [0, Math.floor(R() * 4) * (Math.PI / 2), 0] });
}
function windmillBody() {
  const o = [];
  o.push(part(cyl(1.5, 2.3, 9, 8), (tri, pos, i, c) => (Math.floor(c.y / 1.5) % 2 ? '#f4efe4' : '#e6dccb'), { p: [0, 4.5, 0] }));
  o.push(part(cone(1.9, 2.4, 8), '#c0583e', { p: [0, 10.2, 0] }));
  o.push(part(rbox(1.0, 1.7, 0.2, 0.05), '#7a4a2a', { p: [0, 0.85, 2.15] }));
  o.push(part(torus(1.9, 0.12, 6, 16), '#7a4a2a', { p: [0, 4.6, 0], r: [Math.PI / 2, 0, 0] }));
  return o;
}
export function windmillSails() {
  const o = [];
  o.push(part(cyl(0.35, 0.35, 0.6, 10), '#7a4a2a', { r: [Math.PI / 2, 0, 0] }));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU;
    const P = [];
    P.push(part(box(0.25, 5.2, 0.15), '#7a4a2a', { p: [0, 2.8, 0] }));
    P.push(part(box(1.3, 4.0, 0.06), (tri, pos, i, c) => (Math.floor(c.y * 1.4) % 2 ? '#fff6e8' : '#f0e2c8'), { p: [0.75, 3.1, 0.05] }));
    o.push(...placeAll(P, { r: [0, 0, a] }));
  }
  return merge(o);
}
function fence(len) {
  const o = [];
  const n = Math.floor(len / 2.2);
  for (let k = 0; k <= n; k++) o.push(part(box(0.18, 1.1, 0.18), '#f5f0e6', { p: [k * 2.2 - len / 2, 0.55, 0], outline: 'none' }));
  o.push(part(box(len, 0.14, 0.1), '#f5f0e6', { p: [0, 0.8, 0], outline: 'none' }));
  o.push(part(box(len, 0.14, 0.1), '#f5f0e6', { p: [0, 0.45, 0], outline: 'none' }));
  return o;
}
function lighthouse() {
  const o = [];
  o.push(part(lumpy(ico(5, 1), 0.12, 2), '#8a8478', { p: [0, -1.5, 0], s: [1.3, 0.5, 1.3] }));
  o.push(part(cyl(1.2, 1.9, 14, 16, 7), (tri, pos, i, c) => (Math.floor(c.y / 2) % 2 ? '#ef4444' : '#ffffff'), { p: [0, 7.5, 0] }));
  o.push(part(cyl(1.7, 1.7, 0.3, 16), '#3a3a48', { p: [0, 14.6, 0] }));
  o.push(part(cyl(0.95, 0.95, 1.6, 12), '#fff3a0', { p: [0, 15.6, 0], glow: 1.0, flicker: 0.3 }));
  o.push(part(cone(1.3, 1.4, 12), '#ef4444', { p: [0, 17.1, 0] }));
  return o;
}
function boat(R) {
  const o = [];
  const hull = ['#ffffff', '#ef4444', '#2563eb'][Math.floor(R() * 3)];
  o.push(part(rbox(2.2, 1.1, 6, 0.4), (tri, pos, i, c) => (c.y > 0.9 ? '#8a5a33' : hull), { p: [0, 0.5, 0] }));
  o.push(part(cone(1.1, 1.8, 4), hull, { p: [0, 0.5, -3.6], r: [-Math.PI / 2, Math.PI / 4, 0], s: [1, 1, 0.5] }));
  o.push(part(cyl(0.1, 0.12, 6, 6), '#8a5a33', { p: [0, 4, 0.3] }));
  o.push(part(slab([[0, 0], [0, 5], [2.6, 0]], 0.06, 0.02, 1).rotateY(Math.PI / 2), (tri, pos, i, c) => (Math.floor(c.y) % 2 ? '#ffffff' : '#fde68a'), { p: [0, 1.4, 0.5], flap: 0.1 }));
  return placeAll(o, { r: [0, R() * TAU, 0] });
}
function island(R, size = 1) {
  const o = [];
  o.push(part(lumpy(cyl(7, 8, 2.4, 16), 0.08, R() * 9), (tri, pos, i, c) => (c.y > 0.6 ? '#7cc95a' : '#f2d79a'), { p: [0, 0.2, 0], s: [1, 1, 0.85] }));
  o.push(part(cyl(8.8, 9.6, 0.25, 18), '#f2d79a', { p: [0, -0.2, 0], outline: 'none' }));
  for (let k = 0; k < 3; k++) o.push(...placeAll(palm(R, 0.8 + R() * 0.3), { p: [(R() - 0.5) * 8, 1.2, (R() - 0.5) * 6] }));
  o.push(part(lumpy(ico(1.6, 1), 0.15, R() * 9), '#9a9184', { p: [4.5, 1, 3] }));
  return placeAll(o, { s: size });
}
function giantTree(R) {
  const o = [];
  o.push(part(cyl(2.4, 3.6, 30, 12, 4), (tri, pos, i, c) => (Math.sin(Math.atan2(c.z, c.x) * 7) > 0.4 ? '#6b4426' : '#7a5030'), { p: [0, 15, 0] }));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    o.push(part(cone(1.4, 5, 6), '#6b4426', { p: [Math.cos(a) * 3, 1.6, Math.sin(a) * 3], r: [Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8] }));
  }
  const greens = ['#2f7d3a', '#3a8f45', '#4aa352', '#2a6e35'];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU + R();
    const r = 6 + R() * 3;
    o.push(part(lumpy(ico(r, 1), 0.1, R() * 9), greens[k % 4], { p: [Math.cos(a) * 6, 31 + R() * 6, Math.sin(a) * 6], flap: 0.25, outline: 'radial' }));
  }
  o.push(part(lumpy(ico(8, 1), 0.1, R() * 9), '#3a8f45', { p: [0, 37, 0], flap: 0.25, outline: 'radial' }));
  return o;
}
function mushroom(R) {
  const o = [];
  const h = 1.6 + R() * 1.4;
  o.push(part(cyl(0.35, 0.5, h, 10), '#f7ecd8', { p: [0, h / 2, 0] }));
  o.push(part(dome(1.3), (tri, pos, i, c) => (Math.sin(c.x * 4.2) * Math.sin(c.z * 4.2 + 1) > 0.5 ? '#ffffff' : '#e8483f'), { p: [0, h, 0], s: [1, 0.75, 1], glow: 0.08 }));
  return placeAll(o, { s: 0.8 + R() * 0.7 });
}
function skyscraper(R, h, w, d) {
  const o = [];
  const pal = [['#6f7fb8', '#3a4a7a'], ['#c9b8e8', '#6a5a9a'], ['#e8c4a8', '#8a5a5a'], ['#8fd0e0', '#3a6a8a'], ['#f0e0c0', '#8a7a5a']][Math.floor(R() * 5)];
  // the walls carry a window texture (see windowTextures): one window per 2 m × 3 m, 8 × 8 windows per tile
  o.push(part(box(w, h, d), pal[0], { p: [0, h / 2, 0], uv: [w / 16, h / 24, Math.floor(R() * 8) / 8, Math.floor(R() * 8) / 8], outline: 'none' }));
  o.push(part(box(w + 0.6, 0.6, d + 0.6), pal[1], { p: [0, h + 0.3, 0] }));
  const roof = R();
  if (roof < 0.35) {
    o.push(part(cyl(0.12, 0.2, 6, 6), '#c8ccd8', { p: [0, h + 3.6, 0] }));
    o.push(part(sph(0.3, 8, 6), '#ff4d6d', { p: [0, h + 6.7, 0], glow: 1, flicker: 1 }));
  } else if (roof < 0.6) {
    o.push(part(cyl(1.2, 1.2, 2, 12), '#b0a08a', { p: [w * 0.2, h + 2.6, d * 0.2] }));
    o.push(part(cone(1.4, 1, 12), '#8a7a6a', { p: [w * 0.2, h + 4.1, d * 0.2] }));
    for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) o.push(part(cyl(0.08, 0.08, 1.6, 4), '#8a7a6a', { p: [w * 0.2 + x, h + 0.9, d * 0.2 + z], outline: 'none' }));
  } else if (roof < 0.8) {
    o.push(part(box(w * 0.6, 3, d * 0.6), pal[0], { p: [0, h + 2.1, 0] }));
    o.push(part(box(w * 0.3, 2.5, d * 0.3), pal[1], { p: [0, h + 4.8, 0] }));
  }
  return o;
}
function mesa(R) {
  const o = [];
  const h = 12 + R() * 10;
  const strata = (tri, pos, i, c) => ['#d9874e', '#c46a3c', '#e8a066', '#b65c34'][Math.floor(c.y / 2.6) % 4];
  o.push(part(lumpy(cyl(5 + R() * 3, 7 + R() * 3, h, 12, 6), 0.06, R() * 9), strata, { p: [0, h / 2, 0] }));
  o.push(part(lumpy(cyl(5.2, 5.4, 0.8, 12), 0.05, 3), '#e9b070', { p: [0, h + 0.2, 0] }));
  return o;
}
function rockArch(R) {
  const o = [];
  o.push(part(lumpy(torus(6, 1.6, 8, 18, Math.PI), 0.08, R() * 9), (tri, pos, i, c) => ['#d9874e', '#c46a3c', '#e8a066'][Math.floor(c.y / 2) % 3], { p: [0, 0, 0] }));
  return o;
}
function mountain(R, h, r, snowLine = 0.62) {
  const o = [];
  o.push(part(lumpy(cone(r, h, 10, 1), 0.07, R() * 9, 0.08), (tri, pos, i, c) => (c.y > h * snowLine ? '#ffffff' : c.y > h * (snowLine - 0.15) ? '#c9d6e8' : '#8c96a8'), { p: [0, h / 2, 0], outline: 'radial' }));
  return o;
}
function iceberg(R) {
  return [part(lumpy(ico(3 + R() * 2, 1), 0.2, R() * 9), (tri, pos, i, c) => (c.y > 0.5 ? '#ffffff' : '#bfefff'), { p: [0, 0.6, 0], s: [1.3, 0.8, 1.1], glow: 0.08 })];
}
function volcanoCone(R) {
  const o = [];
  const h = 46;
  const lavaLine = (c) => Math.abs(Math.sin(Math.atan2(c.z, c.x) * 5 + c.y * 0.08)) < 0.09 && c.y > 8;
  o.push(part(lumpy(cyl(8, 48, h, 18, 6, true), 0.06, R() * 9, 0.06), (tri, pos, i, c) => (lavaLine(c) ? '#ff8a2a' : c.y > 30 ? '#3a2c30' : '#4a383a'), { p: [0, h / 2, 0], glow: (c) => (lavaLine(c) ? 1.1 : 0), flicker: (c) => (lavaLine(c) ? 0.6 : 0), outline: 'none' }));
  o.push(part(cyl(8, 8, 0.6, 18), '#ffb347', { p: [0, h - 2, 0], glow: 1.4, flicker: 0.8, outline: 'none' }));
  return o;
}
function lavaRock(R) {
  return [part(lumpy(ico(1.5 + R() * 2, 1), 0.2, R() * 9), '#2b2125', { p: [0, 0.5, 0], s: [1, 0.7 + R() * 0.6, 1] })];
}
function crystals(R, s = 1) {
  const o = [];
  const cols = ['#e879f9', '#67e8f9', '#a78bfa', '#f0abfc'];
  const n = 3 + Math.floor(R() * 3);
  for (let k = 0; k < n; k++) {
    const h = 2 + R() * 5;
    const r = 0.4 + R() * 0.5;
    const P = [part(cyl(r, r, h, 6), cols[k % 4], { p: [0, h / 2, 0], glow: 0.6 }), part(cone(r, r * 2, 6), mix(cols[k % 4], '#ffffff', 0.5), { p: [0, h + r, 0], glow: 0.8 })];
    o.push(...placeAll(P, { p: [(R() - 0.5) * 2.4, 0, (R() - 0.5) * 2.4], r: [(R() - 0.5) * 0.8, 0, (R() - 0.5) * 0.8] }));
  }
  o.push(part(lumpy(ico(1.6, 1), 0.15, R() * 9), '#2e2346', { p: [0, 0, 0], s: [1, 0.5, 1] }));
  return placeAll(o, { s });
}
function stalactite(R, roof) {
  const h = 4 + R() * 7;
  return [part(lumpy(cone(1 + R() * 1.2, h, 8), 0.07, R() * 9), (tri, pos, i, c) => (Math.floor(c.y) % 2 ? '#4a3a6e' : '#3d2f5c'), { p: [0, roof - h / 2 + 0.5, 0], r: [Math.PI, 0, 0] })];
}
function cloudBank(R, colors, s = 1) {
  const o = [];
  const n = 4 + Math.floor(R() * 4);
  for (let k = 0; k < n; k++) {
    const r = 3 + R() * 4;
    o.push(part(sph(r, 12, 8), (tri, pos, i, c) => (c.y < -r * 0.2 ? colors[1] : colors[0]), { p: [(k - n / 2) * 4.5 + R() * 2, (R() - 0.3) * 2, (R() - 0.5) * 6], glow: 0.18, outline: 'none' }));
  }
  return placeAll(o, { s });
}
function bigIsland(R) {
  const o = [];
  o.push(part(lumpy(cone(9, 14, 12), 0.1, R() * 9), (tri, pos, i, c) => ['#b5869a', '#93667e', '#714b61'][Math.min(2, Math.floor(-c.y / 4))], { p: [0, -7, 0], r: [Math.PI, 0, 0] }));
  o.push(part(lumpy(cyl(9.4, 9, 1.4, 16), 0.05, R() * 9), '#a8e07a', { p: [0, 0.5, 0] }));
  for (let k = 0; k < 3; k++) o.push(...placeAll(roundTree(R, ['#ff9fb8', '#ffc2d1', '#ff8fab']), { p: [(R() - 0.5) * 10, 1, (R() - 0.5) * 10], s: 0.9 }));
  o.push(part(box(1.6, 14, 0.4), '#d8f3ff', { p: [6, -6, 7.5], glow: 0.45, outline: 'none' }));
  o.push(...placeAll(house(R, '#8b6fd0'), { p: [-3, 1.1, -2] }));
  return o;
}
function asteroid(R, s = 1) {
  return [part(lumpy(ico(2 + R() * 3, 1), 0.22, R() * 9), (tri, pos, i, c) => (Math.sin(c.x * 2 + c.y * 3) > 0.5 ? '#5d5967' : '#8a8594'), { s: [s, s * (0.7 + R() * 0.5), s] })];
}
function spaceStation() {
  const o = [];
  o.push(part(torus(9, 1.1, 10, 40), (tri, pos, i, c) => (Math.sin(Math.atan2(c.y, c.x) * 12) > 0.6 ? '#9fd6ff' : '#d8dce8'), { glow: (c) => (Math.sin(Math.atan2(c.y, c.x) * 12) > 0.6 ? 0.8 : 0) }));
  o.push(part(cyl(1.6, 1.6, 6, 12), '#c8ccd8', { r: [Math.PI / 2, 0, 0] }));
  for (let k = 0; k < 4; k++) o.push(part(cyl(0.3, 0.3, 17, 6), '#a0a6b8', { r: [0, 0, (k / 4) * Math.PI] }));
  for (const sx of [-1, 1]) o.push(part(box(8, 0.2, 3), (tri, pos, i, c) => ((Math.abs(c.x) * 2) % 1 < 0.15 ? '#9cc3ff' : '#1f3c88'), { p: [sx * 6, 0, 3.5], glow: 0.2 }));
  return o;
}

// ---------------------------------------------------------------- chunk layout per level
/**
 * Build one scenery chunk. Returns { geo, spinners: [{ kind, p: [x, y, z], s, ry }] }.
 * Decorations under the lanes stay low (|x| < 14: below the plane); tall ones stand farther out.
 */
export function buildChunk(level, variant, { rich = true } = {}) {
  const T = THEMES[level];
  const R = rng(level * 1000 + variant * 37 + 11);
  const parts = [];
  const spinners = [];
  const H = (x, f) => heightAt(level, variant, x, f);
  const put = (list, x, f, { s = 1, ry = 0, dy = 0 } = {}) => parts.push(...placeAll(list, { p: [x, H(x, f) + dy, -f], r: [0, ry, 0], s }));
  const side = () => (R() < 0.5 ? -1 : 1);
  const density = rich ? 1 : 0.55;
  const count = (n) => Math.round(n * density);

  if (T.ground === 'terrain') parts.push(terrain(level, variant));

  switch (T.key) {
    case 'meadow': {
      for (let k = 0; k < count(26); k++) {
        const x = side() * (8 + R() * 120);
        put(roundTree(R), x, R() * CHUNK, { s: 0.8 + R() * 0.6 });
      }
      for (let k = 0; k < 2; k++) {
        const x = side() * (24 + R() * 40);
        const f = 10 + k * 45 + R() * 20;
        put(barn(), x, f, { ry: R() * TAU });
      }
      for (let k = 0; k < count(4); k++) put(house(R), side() * (12 + R() * 60), R() * CHUNK);
      for (let k = 0; k < 2; k++) {
        const x = (k ? 1 : -1) * (30 + R() * 30);
        const f = 20 + k * 40 + R() * 10;
        const y = H(x, f);
        put(windmillBody(), x, f);
        spinners.push({ kind: 'sails', p: [x, y + 8.2, -f + 2.4], s: 1 });
      }
      for (let k = 0; k < count(4); k++) put(fence(10 + R() * 10), side() * (10 + R() * 40), R() * CHUNK, { ry: R() < 0.5 ? 0 : Math.PI / 2 });
      for (let k = 0; k < count(8); k++) put([part(cyl(0.9, 0.9, 1.4, 12), (tri, pos, i, c) => (Math.abs(c.y) > 0.6 ? '#e8c45a' : '#f2d86a'), { r: [0, 0, Math.PI / 2], p: [0, 0.9, 0] })], side() * (9 + R() * 50), R() * CHUNK, { ry: R() * 3 });
      for (let k = 0; k < count(30); k++) put([part(sph(0.22, 6, 4), ['#ff6b8b', '#ffffff', '#ffe066', '#c084fc'][k % 4], { p: [0, 0.2, 0], outline: 'none' })], (R() - 0.5) * 60, R() * CHUNK);
      break;
    }
    case 'sea': {
      const isl = 1 + Math.floor(R() * 2);
      for (let k = 0; k < isl; k++) put(island(R, 0.8 + R() * 0.7), side() * (26 + R() * 70), R() * CHUNK, { ry: R() * TAU });
      if (variant === 0) put(lighthouse(), -38, 45);
      for (let k = 0; k < count(3); k++) put(boat(R), side() * (10 + R() * 50), R() * CHUNK, { s: 1 + R() * 0.4 });
      for (let k = 0; k < count(10); k++) put([part(lumpy(ico(1 + R() * 2, 1), 0.2, R() * 9), '#8a8f96', { p: [0, 0, 0] })], side() * (12 + R() * 90), R() * CHUNK);
      for (let k = 0; k < count(4); k++) put([part(cyl(0.4, 0.5, 1.2, 10), (tri, pos, i, c) => (c.y > 0.1 ? '#ef4444' : '#ffffff'), { p: [0, 0.3, 0] }), part(sph(0.15, 8, 6), '#fff3a0', { p: [0, 1.05, 0], glow: 1, flicker: 1, outline: 'none' })], side() * (7 + R() * 30), R() * CHUNK);
      break;
    }
    case 'forest': {
      for (let k = 0; k < 2; k++) put(giantTree(R), (k ? 1 : -1) * (17 + R() * 8), 15 + k * 45 + R() * 20, { ry: R() * TAU, s: 0.9 + R() * 0.25 });
      for (let k = 0; k < count(55); k++) {
        const x = side() * (6 + R() * 130);
        const f = R() * CHUNK;
        if (R() < 0.45) put(pine(R, false, 1.1 + R() * 0.8), x, f);
        else put(roundTree(R, ['#2f8a3e', '#3fa04c', '#2a7a38']), x, f, { s: 1 + R() * 0.7 });
      }
      for (let k = 0; k < count(10); k++) put(mushroom(R), side() * (5 + R() * 40), R() * CHUNK);
      break;
    }
    case 'city': {
      for (let k = 0; k < count(34); k++) {
        const sx = side();
        const x = sx * (16 + R() * 100);
        const f = R() * CHUNK;
        const near = Math.abs(x) < 40;
        const h = near ? 18 + R() * 36 : 12 + R() * 50;
        const w = 6 + Math.floor(R() * 4) * 2;
        put(skyscraper(R, h, w, w), x, f);
      }
      // low shops under the flight path (well below the plane)
      for (let k = 0; k < count(6); k++) put([part(rbox(5, 2.6, 4, 0.1), ['#f2a3b8', '#9fd6ff', '#fde68a', '#a7f3d0'][k % 4], { p: [0, 1.3, 0] }), part(box(5.4, 0.3, 1.6), '#ef4444', { p: [0, 2.3, 2.6] })], side() * (7 + R() * 6), R() * CHUNK, { ry: Math.PI / 2 });
      for (let k = 0; k < count(10); k++) put([part(rbox(1.8, 1.2, 3.6, 0.3), ['#ef4444', '#facc15', '#38bdf8', '#ffffff'][k % 4], { p: [0, 0.7, 0] }), part(rbox(1.6, 0.8, 1.8, 0.25), '#cfe8ff', { p: [0, 1.5, -0.2] })], side() * (1 + R() * 2.5) + (R() < 0.5 ? 0 : 24 * side()), R() * CHUNK);
      for (let k = 0; k < count(8); k++) put(roundTree(R, ['#4fb35a', '#66c46a']), side() * (5.5 + R() * 1), R() * CHUNK, { s: 0.6 });
      break;
    }
    case 'desert': {
      for (let k = 0; k < count(4); k++) put(mesa(R), side() * (45 + R() * 80), R() * CHUNK);
      if (R() < 0.7) put(rockArch(R), side() * (16 + R() * 6), 20 + R() * 50, { ry: Math.PI / 2 + (R() - 0.5) * 0.6 });
      for (let k = 0; k < count(14); k++) put(cactus(R, 0.6 + R() * 0.45), side() * (10 + R() * 20), R() * CHUNK);
      for (let k = 0; k < count(10); k++) put([part(lumpy(ico(0.8 + R() * 1.4, 1), 0.2, R() * 9), '#c06a3c', {})], side() * (5 + R() * 30), R() * CHUNK);
      if (variant === 1) {
        // a little oasis
        put([part(cyl(7, 7, 0.2, 18), '#4fd2ee', { glow: 0.15, outline: 'none' })], -14, 45);
        for (let k = 0; k < 4; k++) put(palm(R, 0.8), -14 + Math.cos(k * 1.6) * 7.5, 45 + Math.sin(k * 1.6) * 7.5);
      }
      break;
    }
    case 'snow': {
      for (let k = 0; k < count(7); k++) {
        const x = side() * (40 + R() * 90);
        const f = R() * CHUNK;
        put(mountain(R, 30 + R() * 30, 18 + R() * 14), x, f, { dy: -4 });
      }
      for (let k = 0; k < count(46); k++) put(pine(R, true, 0.9 + R() * 0.8), side() * (15 + R() * 70), R() * CHUNK);
      for (let k = 0; k < count(5); k++) put(iceberg(R), (R() - 0.5) * 22, R() * CHUNK, { dy: -0.5 });
      // a cosy cabin
      if (variant !== 2) {
        const cab = house(R, '#ffffff');
        put(cab, side() * (18 + R() * 10), 30 + R() * 30);
      }
      break;
    }
    case 'volcano': {
      if (variant !== 1) put(volcanoCone(R), (variant ? 1 : -1) * (85 + R() * 20), 45);
      for (let k = 0; k < count(26); k++) put(lavaRock(R), side() * (6 + R() * 80), R() * CHUNK);
      for (let k = 0; k < count(6); k++) put([part(cyl(1.4 + R() * 1.5, 1.6 + R() * 1.6, 0.2, 12), '#ff8a2a', { glow: 1.2, flicker: 0.6, outline: 'none' })], side() * (8 + R() * 40), R() * CHUNK, { dy: 0.1 });
      for (let k = 0; k < count(6); k++) put([part(cyl(0.5, 0.9, 6 + R() * 6, 6), '#2b2125', { p: [0, 4, 0] })], side() * (20 + R() * 40), R() * CHUNK);
      break;
    }
    case 'cave': {
      parts.push(caveRoof(variant));
      for (let k = 0; k < count(14); k++) {
        const x = side() * (6 + R() * 14);
        const f = R() * CHUNK;
        put(crystals(R, 1 + R() * 0.8), x, f);
      }
      for (let k = 0; k < count(16); k++) {
        const x = (R() - 0.5) * 34;
        const f = R() * CHUNK;
        const roof = roofAt(variant, x, f);
        parts.push(...placeAll(stalactite(R, roof), { p: [x, 0, -f] }));
      }
      for (let k = 0; k < count(10); k++) put([part(lumpy(cone(1 + R(), 3 + R() * 5, 8), 0.08, R() * 9), '#4a3a6e', { p: [0, 2, 0] })], side() * (4 + R() * 12), R() * CHUNK);
      for (let k = 0; k < count(10); k++) put(mushroom(R), side() * (4 + R() * 12), R() * CHUNK, { s: 0.6 });
      break;
    }
    case 'sunset': {
      const cols = [['#fff4f7', '#f4b4cb'], ['#fff0e6', '#efaac0'], ['#fffaf2', '#f6bfd2']];
      for (let k = 0; k < count(24); k++) {
        const x = (R() - 0.5) * 280;
        parts.push(...placeAll(cloudBank(R, cols[k % 3], 1 + R() * 0.8), { p: [x, -1 + R() * 2, -R() * CHUNK], r: [0, R() * TAU, 0] }));
      }
      // a soft carpet of cloud lumps under the flight path
      for (let k = 0; k < count(40); k++) {
        // little clusters of round puffs, white on top, pink underneath
        const x = (R() - 0.5) * 120;
        const f = R() * CHUNK;
        const c = cols[k % 3];
        const y0 = -3 + R() * 1.5;
        for (let j = 0; j < 3; j++) {
          const r = 1.6 + R() * 2.2;
          parts.push(part(sph(r, 11, 7), (tri, pos, i, cc) => (cc.y < y0 + r * 0.05 ? c[1] : c[0]), { p: [x + (j - 1) * r * 1.2, y0 + (j === 1 ? r * 0.35 : 0), -f + (R() - 0.5) * 2], s: [1.2, 0.7, 1.1], glow: 0.42, outline: 'none' }));
        }
      }
      for (let k = 0; k < count(2); k++) parts.push(...placeAll(bigIsland(R), { p: [side() * (24 + R() * 40), 4 + R() * 12, -(15 + k * 45 + R() * 15)], s: 0.8 + R() * 0.5 }));
      break;
    }
    case 'space': {
      for (let k = 0; k < count(18); k++) {
        const x = side() * (12 + R() * 110);
        const y = (R() - 0.4) * 50;
        parts.push(...placeAll(asteroid(R, 0.6 + R() * 1.6), { p: [x, y, -R() * CHUNK], r: [R() * 3, R() * 3, R() * 3] }));
      }
      for (let k = 0; k < count(10); k++) parts.push(...placeAll(asteroid(R, 0.4 + R() * 0.6), { p: [(R() - 0.5) * 40, -6 - R() * 20, -R() * CHUNK], r: [R() * 3, R() * 3, R() * 3] }));
      if (variant === 1) parts.push(...placeAll(spaceStation(), { p: [-55, 25, -45], r: [0.4, 0.6, 0.2], s: 1.4 }));
      break;
    }
    default:
  }
  // Three geometries: outlined parts, flat ones (terrain, tiny details) that skip the outline pass, textured walls
  return {
    geo: merge(parts.filter((g) => !g.userData.noOutline)),
    flat: merge(parts.filter((g) => g.userData.noOutline && !g.userData.textured)),
    tex: merge(parts.filter((g) => g.userData.textured), { uv: true }),
    spinners,
  };
}

/** Window tile textures for the skyscrapers: [map, emissiveMap] (8 × 8 windows, some lit). */
export function windowTextures(canvasTexture) {
  const R = rng(99);
  const lit = [];
  for (let i = 0; i < 64; i++) lit.push(R() < 0.55);
  const draw = (emissive) => (ctx, W) => {
    const c = W / 8;
    ctx.fillStyle = emissive ? '#000000' : '#ffffff';
    ctx.fillRect(0, 0, W, W);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const on = lit[y * 8 + x];
        if (emissive) {
          if (!on) continue;
          ctx.fillStyle = ['#ffe08a', '#fff1c4', '#ffc870'][(x + y) % 3];
        } else ctx.fillStyle = on ? '#fff4d0' : '#5b6796';
        ctx.fillRect(x * c + c * 0.2, y * c + c * 0.22, c * 0.6, c * 0.56);
        if (!emissive) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(x * c + c * 0.2, y * c + c * 0.22, c * 0.6, c * 0.08);
        }
      }
    }
  };
  return [canvasTexture(256, 256, draw(false), { repeat: true }), canvasTexture(256, 256, draw(true), { repeat: true })];
}

// ---------------------------------------------------------------- distant backdrop ring (silhouette)
/** A ring of far silhouettes around the camera (no fog: colours are already hazy). */
export function backdropGeometry(level) {
  const T = THEMES[level];
  if (!T.backdrop) return null;
  const { kind, colors, h } = T.backdrop;
  const N = 160;
  const radius = 420;
  const pos = [];
  const col = [];
  const cBot = new THREE.Color(colors[1]);
  const cTop = new THREE.Color(colors[0]);
  const R = rng(level * 91 + 3);
  const heights = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    let y;
    switch (kind) {
      case 'skyline':
        y = (Math.floor(i / 2) % 2 ? 0.5 : 0.85) * h * (0.4 + R() * 0.6);
        break;
      case 'peaks':
        y = h * (0.35 + 0.65 * Math.abs(Math.sin(a * 7 + 0.5) * Math.sin(a * 3.3)) + R() * 0.08);
        break;
      case 'volcano':
        y = h * (0.25 + 0.2 * Math.abs(Math.sin(a * 5)) + (Math.abs(((a / TAU) * 3) % 1 - 0.5) < 0.06 ? 0.55 : 0) + R() * 0.05);
        break;
      case 'mesas':
        y = h * (Math.sin(a * 6) > 0.2 ? 0.75 : 0.35) * (0.9 + R() * 0.1);
        break;
      case 'cloudsea':
        y = h * (0.6 + 0.4 * Math.abs(Math.sin(a * 11))) * (0.8 + R() * 0.2);
        break;
      case 'islands':
        y = Math.max(0, Math.sin(a * 9) - 0.4) * h * 1.4 + 1;
        break;
      case 'forest':
        y = h * (0.55 + 0.25 * Math.sin(a * 23) + 0.2 * Math.abs(Math.sin(a * 61)));
        break;
      default:
        y = h * (0.45 + 0.35 * Math.sin(a * 4 + 1) * Math.sin(a * 2.3) + 0.2 * Math.sin(a * 9));
    }
    heights.push(Math.max(1, y));
  }
  const base = kind === 'cloudsea' ? -20 : -6;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * TAU;
    const a1 = ((i + 1) / N) * TAU;
    const p = (a, y) => [Math.cos(a) * radius, y, Math.sin(a) * radius];
    const y0 = heights[i];
    const y1 = kind === 'skyline' ? heights[i] : heights[(i + 1) % N];
    const quad = [p(a0, base), p(a1, base), p(a1, y1), p(a0, base), p(a1, y1), p(a0, y0)];
    const cols = [cBot, cBot, cTop, cBot, cTop, cTop];
    quad.forEach((v, k) => {
      pos.push(...v);
      col.push(cols[k].r, cols[k].g, cols[k].b);
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Second (nearer, darker) layer for some backdrops. */
export const backdropTint = (level) => (THEMES[level].backdrop ? shade(THEMES[level].backdrop.colors[0], 0.92) : null);

// ---------------------------------------------------------------- planets for the space level
export function planetGeometry(seed, radius, bands) {
  const R = rng(seed);
  const o = [];
  o.push(part(sph(radius, 40, 24), (tri, pos, i, c) => bands[Math.floor((c.y / radius + 1) * 4 + Math.sin(c.x * 0.2 + R()) * 0.3) % bands.length], { glow: 0.3, outline: 'none' }));
  return merge(o);
}
export function planetRingGeometry(radius) {
  return merge([part(torus(radius * 1.7, radius * 0.18, 4, 64), (tri, pos, i, c) => (Math.floor(Math.hypot(c.x, c.y) * 0.4) % 2 ? '#f5d6a0' : '#d9b07a'), { s: [1, 1, 0.08], glow: 0.35, outline: 'none' })]);
}
