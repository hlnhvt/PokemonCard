// Toy-town models for "Snorlax nuốt cả thành phố". Every edible kind is ONE merged, vertex-coloured
// BufferGeometry (drawn with an InstancedMesh per kind/variant), built in code: bevelled boxes,
// tiled roofs, framed windows, glowing bulbs, swaying canopies, rippling water.
// Extra attributes: `anim` (sway weight, glow, water — see gulp3dLook.townMaterial) and `onormal`
// (smoothed normals so the inverted-hull outline has no cracks at hard edges).
// Units are metres, origin on the ground at the centre of the footprint, front faces +Z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toonMaterial, outlineMaterial, outlineOf } from './gulp3dLook';

const TAU = Math.PI * 2;
const tmpColor = new THREE.Color();

function smoothNormals(pos, nor) {
  const acc = new Map();
  const key = (i) => `${Math.round(pos[i] * 500)},${Math.round(pos[i + 1] * 500)},${Math.round(pos[i + 2] * 500)}`;
  for (let i = 0; i < pos.length; i += 3) {
    const k = key(i);
    const a = acc.get(k) || [0, 0, 0];
    a[0] += nor[i];
    a[1] += nor[i + 1];
    a[2] += nor[i + 2];
    acc.set(k, a);
  }
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const a = acc.get(key(i));
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i] = a[0] / l;
    out[i + 1] = a[1] / l;
    out[i + 2] = a[2] / l;
  }
  return out;
}

/**
 * Bake a geometry: transform, flatten (non-indexed) and paint a vertex colour (or a per-triangle colour fn).
 * sway: wind amplitude at the top of the part, glow: self-lit amount, water: ripple amount.
 */
function part(geo, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], sway = 0, glow = 0, water = 0 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  geo.dispose();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
  g.applyMatrix4(m);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const anim = new Float32Array(n * 3);
  let ymax = 1e-3;
  for (let i = 0; i < n; i++) ymax = Math.max(ymax, pos.getY(i));
  for (let i = 0; i < n; i++) {
    const c = typeof color === 'function' ? color(Math.floor(i / 3), pos, i) : color;
    tmpColor.set(c);
    col[i * 3] = tmpColor.r;
    col[i * 3 + 1] = tmpColor.g;
    col[i * 3 + 2] = tmpColor.b;
    if (sway) anim[i * 3] = sway * Math.max(0, Math.min(1, pos.getY(i) / ymax)) ** 1.3;
    anim[i * 3 + 1] = glow;
    anim[i * 3 + 2] = water;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('anim', new THREE.BufferAttribute(anim, 3));
  g.setAttribute('onormal', new THREE.BufferAttribute(smoothNormals(pos.array, g.attributes.normal.array), 3));
  return g;
}

const ATTRS = ['position', 'normal', 'color', 'anim', 'onormal'];
/** Concatenate baked parts into one geometry. */
export function merge(parts) {
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const arrays = Object.fromEntries(ATTRS.map((a) => [a, new Float32Array(n * 3)]));
  let o = 0;
  for (const g of parts) {
    for (const a of ATTRS) arrays[a].set(g.attributes[a].array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  for (const a of ATTRS) out.setAttribute(a, new THREE.BufferAttribute(arrays[a], 3));
  out.computeBoundingSphere();
  return out;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.08, seg = 1) => new RoundedBoxGeometry(w, h, d, seg, r);
const cyl = (rt, rb, h, seg = 10, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
const sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
const cone = (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg);
const torus = (r, t, rs = 6, ts = 16, arc = TAU) => new THREE.TorusGeometry(r, t, rs, ts, arc);
/** Half disc facing +Z (top half when `top`). */
const halfDisc = (r, d, top, seg = 18) => new THREE.CylinderGeometry(r, r, d, seg, 1, false, top ? Math.PI / 2 : -Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
/** Colour by the angle of each triangle around Y (stripes on umbrellas and tents). */
const stripes = (n, a, b) => (tri, pos) => {
  const i = tri * 3;
  const x = pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2);
  const z = pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2);
  const ang = (Math.atan2(z, x) + TAU) % TAU;
  return Math.floor((ang / TAU) * n) % 2 ? a : b;
};
const shade = (hex, k) => `#${tmpColor.set(hex).multiplyScalar(k).getHexString()}`;

/** A gable roof prism (ridge along X). */
function gable(w, h, d) {
  const sh = new THREE.Shape();
  sh.moveTo(-d / 2, 0);
  sh.lineTo(d / 2, 0);
  sh.lineTo(0, h);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** Tiled gable roof: two bevelled slabs with tile ridges and a ridge cap. y0 = eave line. */
function tiledRoof(out, { W, D, H, y0, ov = 0.35, color, rows = 4, cap }) {
  const a = Math.atan2(H, D / 2);
  const run = D / 2 + ov;
  const drop = ov * Math.tan(a);
  const L = Math.hypot(run, H + drop);
  for (const side of [1, -1]) {
    const cz = (side * run) / 2;
    const cy = y0 + (H - drop) / 2;
    out.push(part(rbox(W + 2 * ov, 0.18, L + 0.04, 0.07), color, { p: [0, cy, cz], r: [side * a, 0, 0] }));
    const dir = [0, -Math.sin(a), side * Math.cos(a)];
    const nrm = [0, Math.cos(a), side * Math.sin(a)];
    for (let i = 0; i < rows; i++) {
      const f = (i + 0.7) / (rows + 0.4) - 0.5;
      out.push(part(box(W + 2 * ov + 0.02, 0.07, 0.12), shade(color, 0.82), { p: [0, cy + dir[1] * f * L + nrm[1] * 0.1, cz + dir[2] * f * L + nrm[2] * 0.1], r: [side * a, 0, 0] }));
    }
  }
  out.push(part(cyl(0.13, 0.13, W + 2 * ov + 0.08, 8), cap || shade(color, 0.75), { p: [0, y0 + H + 0.06, 0], r: [0, 0, Math.PI / 2] }));
}

/** Framed window facing +Z at (x, y, z) (with a cross and an optional flower box). */
function windowAt(out, x, y, z, { w = 0.85, h = 0.8, frame = '#ffffff', glass = '#a9dcff', flowers = null, ry = 0 } = {}) {
  const rot = [0, ry, 0];
  const at = (dx, dy, dz) => {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    return [x + dx * c + dz * s, y + dy, z - dx * s + dz * c];
  };
  out.push(part(box(w + 0.16, h + 0.16, 0.12), frame, { p: at(0, 0, 0), r: rot }));
  out.push(part(box(w, h, 0.06), glass, { p: at(0, 0, 0.05), r: rot, glow: 0.18 }));
  out.push(part(box(0.06, h, 0.05), frame, { p: at(0, 0, 0.08), r: rot }), part(box(w, 0.06, 0.05), frame, { p: at(0, 0, 0.08), r: rot }));
  if (flowers) {
    out.push(part(box(w + 0.2, 0.2, 0.24), '#b9774a', { p: at(0, -h / 2 - 0.16, 0.12), r: rot }));
    for (let i = 0; i < 3; i++) out.push(part(sph(0.085, 6, 4), flowers[i % flowers.length], { p: at((i - 1) * (w / 3), -h / 2 - 0.02, 0.14), r: rot }));
  }
}

/** Pixel letters (5×5) made of boxes, centred at (x, y) on a plane facing +Z at z. */
const FONT = {
  M: ['10001', '11011', '10101', '10001', '10001'],
  A: ['01110', '10001', '11111', '10001', '10001'],
  R: ['11110', '10001', '11110', '10010', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100'],
};
function letters(out, text, x, y, z, cell, color) {
  const lw = cell * 5;
  const gap = cell * 1.1;
  const total = text.length * lw + (text.length - 1) * gap;
  [...text].forEach((ch, li) => {
    const x0 = x - total / 2 + li * (lw + gap);
    FONT[ch].forEach((row, ri) => {
      let c = 0;
      while (c < 5) {
        if (row[c] !== '1') {
          c++;
          continue;
        }
        let e = c;
        while (e < 5 && row[e] === '1') e++;
        out.push(part(box((e - c) * cell, cell, 0.06), color, { p: [x0 + ((c + e) / 2) * cell, y + (2 - ri) * cell, z], glow: 0.25 }));
        c = e;
      }
    });
  });
}

const PALETTES = [
  { roofs: ['#e8595b', '#4d8fe0', '#f2a33c', '#4fb878'], walls: ['#fff6e3', '#fde6df', '#e9f3ff', '#fffadb'], doors: ['#a86a3d', '#7c5a3c', '#c0583f', '#5a7fa8'] },
  { roofs: ['#7b6fe0', '#3fb0a2', '#e2649a', '#4f86d6'], walls: ['#f7f3ff', '#ecfaf5', '#fff0f5', '#eef5ff'], doors: ['#6b5aa8', '#3d7f78', '#b04a72', '#41679e'] },
  { roofs: ['#e8595b', '#4d8fe0', '#f2a33c', '#4fb878'], walls: ['#fff6e3', '#fde6df', '#e9f3ff', '#fffadb'], doors: ['#a86a3d', '#7c5a3c', '#c0583f', '#5a7fa8'] },
];
const CAR_COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#5fd08a'];
const FLOWER_COLORS = ['#f472b6', '#facc15', '#a78bfa', '#fb7185'];
const LEAF = ['#4cb85c', '#3ea653', '#5cc96a', '#46ad57', '#68d176'];

/** Number of colour variants per kind (one InstancedMesh each). */
export const VARIANTS = { house: 4, car: 4, flower: 4, tree: 3, hut: 2, tower: 2 };

const BUILD = {
  berry: () => [
    part(sph(0.16, 10, 7), '#3d7ff0', { p: [0, 0.16, 0], s: [1, 0.92, 1] }),
    part(sph(0.07, 6, 4), '#8fc0ff', { p: [-0.06, 0.24, 0.08], s: [1, 0.5, 1] }),
    part(cyl(0.012, 0.016, 0.07, 4), '#7a4b25', { p: [0, 0.33, 0] }),
    part(sph(0.07, 6, 4), '#3fae55', { p: [0.06, 0.35, 0], s: [1.5, 0.35, 0.8], r: [0, 0, 0.3] }),
  ],
  apple: () => [
    part(sph(0.18, 10, 7), '#e8314f', { p: [0, 0.18, 0], s: [1.05, 0.9, 1.05] }),
    part(sph(0.06, 6, 4), '#ff8a9c', { p: [-0.08, 0.26, 0.1], s: [1, 0.6, 1] }),
    part(cyl(0.014, 0.018, 0.1, 4), '#6b3d1c', { p: [0, 0.38, 0], r: [0, 0, 0.15] }),
    part(sph(0.065, 6, 4), '#3fae55', { p: [0.07, 0.38, 0], s: [1.5, 0.35, 0.8], r: [0, 0, -0.3] }),
  ],
  pokeball: () => [
    part(new THREE.SphereGeometry(0.19, 10, 4, 0, TAU, 0, Math.PI / 2), '#ef4444', { p: [0, 0.19, 0] }),
    part(new THREE.SphereGeometry(0.19, 10, 4, 0, TAU, Math.PI / 2, Math.PI / 2), '#f8fafc', { p: [0, 0.19, 0] }),
    part(cyl(0.195, 0.195, 0.04, 10), '#1e293b', { p: [0, 0.19, 0] }),
    part(cyl(0.075, 0.075, 0.05, 8), '#1e293b', { p: [0, 0.19, 0.17], r: [Math.PI / 2, 0, 0] }),
    part(cyl(0.05, 0.05, 0.05, 8), '#ffffff', { p: [0, 0.19, 0.19], r: [Math.PI / 2, 0, 0], glow: 0.2 }),
    part(sph(0.05, 6, 4), '#ffffff', { p: [-0.08, 0.3, 0.1], s: [1, 0.6, 0.5], glow: 0.4 }),
  ],
  flower: (v) => {
    const c = FLOWER_COLORS[v % 4];
    const out = [part(cyl(0.016, 0.022, 0.38, 4), '#3e9a4c', { p: [0, 0.19, 0], sway: 0.03 }), part(sph(0.06, 5, 3), '#4cb85c', { p: [0.07, 0.12, 0], s: [1.6, 0.35, 0.8], r: [0, 0, 0.4], sway: 0.01 }), part(sph(0.06, 5, 3), '#4cb85c', { p: [-0.07, 0.16, 0], s: [1.6, 0.35, 0.8], r: [0, 0, -0.4], sway: 0.015 })];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      out.push(part(sph(0.08, 6, 3), i % 2 ? c : shade(c, 1.08), { p: [Math.cos(a) * 0.085, 0.4, Math.sin(a) * 0.085], s: [1, 0.45, 0.8], r: [0, -a, 0], sway: 0.05 }));
    }
    out.push(part(sph(0.052, 6, 4), '#ffd84a', { p: [0, 0.42, 0], s: [1, 0.7, 1], sway: 0.05 }));
    return out;
  },
  coconut: () => [part(sph(0.2, 10, 8), '#8b5a2b', { p: [0, 0.2, 0], s: [1, 0.95, 1] }), part(sph(0.08, 6, 4), '#a8713c', { p: [0.05, 0.3, 0.1], s: [1, 0.5, 0.8] }), ...[0, 1, 2].map((i) => part(sph(0.035, 5, 4), '#3f2a14', { p: [Math.cos(i * 2.1) * 0.06, 0.39, Math.sin(i * 2.1) * 0.06 + 0.02] }))],
  shell: () => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 2.2;
      out.push(part(cone(0.065, 0.34, 5), i % 2 ? '#fb9fb1' : '#ffd0d8', { p: [Math.sin(a) * 0.1, 0.07, Math.cos(a) * 0.1 - 0.05], r: [Math.PI / 2 - 0.3, a, 0] }));
    }
    out.push(part(sph(0.075, 7, 5), '#ffd0d8', { p: [0, 0.05, -0.12] }), part(sph(0.03, 5, 4), '#ffffff', { p: [0.05, 0.12, 0.08], glow: 0.4 }));
    return out;
  },
  mailbox: () => [
    part(box(0.12, 0.9, 0.12), '#8b5a2b', { p: [0, 0.45, 0] }),
    part(rbox(0.36, 0.3, 0.52, 0.05), '#ef4444', { p: [0, 1.02, 0] }),
    part(new THREE.CylinderGeometry(0.18, 0.18, 0.52, 12, 1, false, 0, Math.PI), '#ef4444', { p: [0, 1.17, 0], r: [Math.PI / 2, 0, Math.PI / 2] }),
    part(box(0.04, 0.26, 0.08), '#facc15', { p: [0.21, 1.2, -0.12] }),
    part(box(0.12, 0.08, 0.03), '#facc15', { p: [0.21, 1.3, -0.06] }),
    part(box(0.22, 0.04, 0.02), '#1e293b', { p: [0, 1.08, 0.27] }),
    part(box(0.3, 0.06, 0.3), '#64748b', { p: [0, 0.03, 0] }),
  ],
  lamp: () => [
    part(cyl(0.14, 0.18, 0.22, 10), '#2e5e48', { p: [0, 0.11, 0] }),
    part(cyl(0.05, 0.065, 2.3, 8), '#3a7357', { p: [0, 1.3, 0] }),
    part(torus(0.09, 0.025, 4, 8), '#2e5e48', { p: [0, 2.45, 0], r: [Math.PI / 2, 0, 0] }),
    part(sph(0.24, 10, 7), '#fff2a8', { p: [0, 2.68, 0], glow: 0.9 }),
    part(cone(0.3, 0.2, 10), '#2e5e48', { p: [0, 2.94, 0] }),
    part(sph(0.06, 6, 4), '#facc15', { p: [0, 3.08, 0] }),
  ],
  bench: () => {
    const out = [];
    for (let i = 0; i < 3; i++) out.push(part(rbox(1.36, 0.07, 0.14, 0.03), i % 2 ? '#d98b4a' : '#cf7f3e', { p: [0, 0.46, -0.16 + i * 0.16] }));
    for (let i = 0; i < 2; i++) out.push(part(rbox(1.36, 0.13, 0.06, 0.03), '#c97434', { p: [0, 0.7 + i * 0.17, -0.28], r: [-0.15, 0, 0] }));
    for (const x of [-0.58, 0.58]) out.push(part(box(0.07, 0.46, 0.44), '#2e5e48', { p: [x, 0.23, -0.04] }), part(box(0.07, 0.5, 0.06), '#2e5e48', { p: [x, 0.66, -0.3], r: [-0.15, 0, 0] }), part(box(0.08, 0.06, 0.4), '#2e5e48', { p: [x, 0.62, -0.06] }));
    return out;
  },
  umbrella: () => [
    part(cyl(0.03, 0.03, 2.05, 6), '#f8fafc', { p: [0, 1.02, 0], r: [0, 0, 0.06] }),
    part(cone(1.05, 0.48, 12), stripes(12, '#ff7a45', '#fff4dc'), { p: [0.06, 2.08, 0], r: [0, 0, 0.06], sway: 0.02 }),
    part(sph(0.07, 6, 4), '#ff7a45', { p: [0.08, 2.36, 0] }),
    part(rbox(0.95, 0.04, 0.55, 0.02), (tri) => (Math.floor(tri / 8) % 2 ? '#38bdf8' : '#e0f6ff'), { p: [0.55, 0.03, 0.65], r: [0, 0.3, 0] }),
  ],
  sandcastle: () => {
    const sand = '#f6d38b';
    const dark = '#e9bd68';
    const out = [part(cyl(0.6, 0.68, 0.3, 14), dark, { p: [0, 0.15, 0] }), part(rbox(0.7, 0.45, 0.7, 0.06), sand, { p: [0, 0.52, 0] })];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      const x = Math.cos(a) * 0.45;
      const z = Math.sin(a) * 0.45;
      out.push(part(cyl(0.15, 0.17, 0.62, 8), sand, { p: [x, 0.5, z] }), part(cone(0.19, 0.26, 8), dark, { p: [x, 0.94, z] }));
    }
    for (let i = 0; i < 4; i++) out.push(part(box(0.14, 0.12, 0.14), sand, { p: [(i % 2 ? 1 : -1) * 0.22, 0.8, (i < 2 ? 1 : -1) * 0.22] }));
    out.push(part(cyl(0.012, 0.012, 0.4, 4), '#7a4b25', { p: [0, 0.95, 0] }), part(box(0.02, 0.14, 0.2), '#ef4444', { p: [0, 1.08, 0.1], sway: 0.03 }));
    out.push(part(rbox(0.16, 0.24, 0.05, 0.02), '#b9874d', { p: [0, 0.42, 0.36] }), part(sph(0.05, 5, 4), '#fb9fb1', { p: [0.42, 0.33, 0.52] }));
    return out;
  },
  bush: () => {
    const out = [];
    const lobes = [
      [0, 0.45, 0, 0.5],
      [0.38, 0.34, 0.12, 0.38],
      [-0.38, 0.32, -0.04, 0.37],
      [0.02, 0.4, 0.34, 0.36],
    ];
    lobes.forEach(([x, y, z, r], i) => out.push(part(ico(r, 1), LEAF[i % LEAF.length], { p: [x, y, z], s: [1, 0.86, 1], sway: 0.025 })));
    for (const [x, y, z] of [
      [0.22, 0.74, 0.28],
      [-0.32, 0.58, 0.3],
      [0.45, 0.5, 0.38],
      [-0.05, 0.42, 0.62],
    ])
      out.push(part(sph(0.07, 5, 3), '#f43f5e', { p: [x, y, z], sway: 0.025 }));
    return out;
  },
  tree: (v) => {
    const out = [];
    if (v % 3 === 1) {
      // Pine: stacked cones, light tips
      out.push(part(cyl(0.12, 0.2, 1.0, 7), '#8b5a2b', { p: [0, 0.5, 0] }));
      [
        [0.98, 1.3, 1.45, '#2f8f4e'],
        [0.78, 1.15, 2.2, '#38a35a'],
        [0.55, 0.95, 2.85, '#45b468'],
        [0.3, 0.6, 3.35, '#58c477'],
      ].forEach(([r, h, y, c], i) => out.push(part(cone(r, h, 9), c, { p: [0, y, 0], r: [0, i * 0.35, 0], sway: 0.05 })));
      return out;
    }
    // Broadleaf (v0: green with apples) or blossom (v2: pink)
    const blossom = v % 3 === 2;
    const cols = blossom ? ['#f9a8c9', '#f6b9d3', '#f490b9', '#fcc6dc', '#f7a0c4'] : LEAF;
    out.push(part(cyl(0.13, 0.2, 1.5, 7), '#8b5a2b', { p: [0, 0.75, 0] }), part(cyl(0.2, 0.32, 0.25, 7), '#7a4b25', { p: [0, 0.12, 0] }), part(cyl(0.05, 0.08, 0.6, 5), '#8b5a2b', { p: [0.25, 1.45, 0.05], r: [0, 0, -0.7] }));
    const lobes = [
      [0, 2.05, 0, 0.95],
      [0.55, 1.75, 0.25, 0.62],
      [-0.55, 1.85, -0.2, 0.6],
      [0.1, 1.8, -0.55, 0.58],
      [-0.2, 1.75, 0.55, 0.56],
      [0.15, 2.6, 0.1, 0.55],
    ];
    lobes.forEach(([x, y, z, r], i) => out.push(part(ico(r, 1), cols[i % cols.length], { p: [x, y, z], sway: 0.07 })));
    const dots = [
      [0.4, 2.3, 0.75],
      [-0.6, 2.1, 0.5],
      [0.85, 1.9, 0.1],
      [-0.2, 1.6, 0.95],
      [0.2, 2.7, 0.55],
    ];
    for (const [x, y, z] of dots) out.push(part(sph(blossom ? 0.09 : 0.11, 5, 3), blossom ? '#ffffff' : '#ef3b4e', { p: [x, y, z], sway: 0.07 }));
    return out;
  },
  palm: () => {
    const out = [];
    let x = 0;
    for (let i = 0; i < 7; i++) {
      x = Math.sin(i * 0.17) * 0.4;
      out.push(part(cyl(0.11 - i * 0.007, 0.135 - i * 0.007, 0.44, 7), i % 2 ? '#a0703c' : '#b9874d', { p: [x, 0.22 + i * 0.41, 0], r: [0, 0, -0.1 - i * 0.03], sway: 0.02 }));
    }
    const top = [x + 0.12, 2.95, 0];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      for (let k = 0; k < 4; k++) {
        const d = 0.25 + k * 0.38;
        const droop = -0.1 - k * k * 0.12;
        out.push(part(box(0.36 - k * 0.06, 0.05, 0.42), (i + k) % 2 ? '#3fa34d' : '#5cc15a', { p: [top[0] + Math.cos(a) * d, top[1] + droop, Math.sin(a) * d], r: [0, -a + Math.PI / 2, 0], sway: 0.08 }));
      }
    }
    for (let i = 0; i < 3; i++) out.push(part(sph(0.13, 7, 5), '#7c4a1e', { p: [top[0] + Math.cos(i * 2.1) * 0.17, top[1] - 0.2, Math.sin(i * 2.1) * 0.17], sway: 0.06 }));
    return out;
  },
  car: (v) => {
    const c = CAR_COLORS[v % 4];
    const glass = '#bde6ff';
    const out = [part(rbox(1.15, 0.52, 2.3, 0.2, 2), c, { p: [0, 0.52, 0] }), part(rbox(1.0, 0.52, 1.2, 0.2, 2), c, { p: [0, 0.98, -0.15] })];
    out.push(part(box(1.02, 0.34, 0.06), glass, { p: [0, 1.0, 0.45], r: [-0.25, 0, 0], glow: 0.15 }), part(box(1.02, 0.32, 0.06), glass, { p: [0, 1.0, -0.75], r: [0.2, 0, 0], glow: 0.15 }));
    for (const sx of [-1, 1]) out.push(part(box(0.04, 0.3, 0.95), glass, { p: [sx * 0.505, 1.0, -0.15], glow: 0.15 }));
    for (const x of [-0.56, 0.56])
      for (const z of [-0.72, 0.72]) {
        out.push(part(cyl(0.27, 0.27, 0.24, 14), '#2a3140', { p: [x, 0.27, z], r: [0, 0, Math.PI / 2] }));
        out.push(part(cyl(0.13, 0.13, 0.25, 10), '#e2e8f0', { p: [x, 0.27, z], r: [0, 0, Math.PI / 2] }));
      }
    for (const x of [-0.36, 0.36]) out.push(part(sph(0.1, 8, 6), '#fff7c2', { p: [x, 0.58, 1.13], s: [1, 0.8, 0.5], glow: 0.9 }), part(rbox(0.2, 0.1, 0.05, 0.02), '#ff5d6c', { p: [x, 0.6, -1.15], glow: 0.5 }));
    out.push(part(rbox(1.18, 0.12, 0.14, 0.05), '#e2e8f0', { p: [0, 0.36, 1.16] }), part(rbox(1.18, 0.12, 0.14, 0.05), '#e2e8f0', { p: [0, 0.36, -1.16] }));
    return out;
  },
  bus: () => {
    const out = [part(rbox(1.6, 1.55, 4.4, 0.28, 2), '#ffd43b', { p: [0, 1.05, 0] }), part(rbox(1.62, 0.18, 4.42, 0.06), '#ff8a3d', { p: [0, 0.62, 0] })];
    out.push(part(box(1.64, 0.55, 3.5), '#bde6ff', { p: [0, 1.38, -0.25], glow: 0.15 }));
    for (let i = 0; i < 6; i++) out.push(part(box(1.66, 0.55, 0.07), '#ffd43b', { p: [0, 1.38, -1.95 + i * 0.68] }));
    out.push(part(box(1.36, 0.62, 0.06), '#bde6ff', { p: [0, 1.36, 2.2], glow: 0.15 }), part(rbox(1.0, 0.22, 0.06, 0.03), '#1e293b', { p: [0, 1.9, 2.21] }), part(box(0.8, 0.12, 0.07), '#7dffb0', { p: [0, 1.9, 2.24], glow: 0.8 }));
    out.push(part(box(0.06, 1.0, 0.7), '#bde6ff', { p: [0.81, 1.0, 1.4], glow: 0.1 }));
    for (const x of [-0.78, 0.78])
      for (const z of [-1.45, 1.45]) {
        out.push(part(cyl(0.34, 0.34, 0.24, 14), '#2a3140', { p: [x, 0.34, z], r: [0, 0, Math.PI / 2] }));
        out.push(part(cyl(0.16, 0.16, 0.25, 10), '#e2e8f0', { p: [x, 0.34, z], r: [0, 0, Math.PI / 2] }));
      }
    for (const x of [-0.55, 0.55]) out.push(part(sph(0.12, 8, 6), '#fff7c2', { p: [x, 0.6, 2.2], s: [1, 0.8, 0.5], glow: 0.9 }));
    out.push(part(rbox(1.64, 0.14, 0.16, 0.05), '#e2e8f0', { p: [0, 0.36, 2.22] }));
    return out;
  },
  boat: () => {
    const hull = new THREE.CylinderGeometry(0.85, 0.55, 3.2, 12, 1, false, Math.PI / 2, Math.PI);
    const sail = (k) => new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.3 * k, 0), new THREE.Vector2(0, 2.1)]));
    return [
      part(hull, '#f8fafc', { p: [0, 0.55, 0], r: [Math.PI / 2, 0, Math.PI], s: [1, 1, 0.75] }),
      part(rbox(1.72, 0.2, 3.2, 0.08), '#3b82f6', { p: [0, 0.38, 0], s: [0.98, 1, 0.98] }),
      part(rbox(1.4, 0.12, 2.6, 0.05), '#d9925a', { p: [0, 0.56, 0] }),
      ...[-0.6, 0, 0.6].map((z) => part(box(1.38, 0.13, 0.05), '#b9773f', { p: [0, 0.57, z] })),
      part(cyl(0.05, 0.06, 2.6, 6), '#7a4b25', { p: [0, 1.85, 0.2] }),
      part(sail(1), (tri) => (tri % 4 < 2 ? '#ffffff' : '#ffe1e1'), { p: [0.03, 0.9, 0.2], r: [0, Math.PI / 2, 0], sway: 0.03 }),
      part(sail(1), '#ffe1e1', { p: [-0.03, 0.9, 0.2], r: [0, -Math.PI / 2, 0], s: [-1, 1, 1], sway: 0.03 }),
      part(box(0.02, 0.18, 0.32), '#ef4444', { p: [0, 3.1, 0.38], sway: 0.04 }),
      part(torus(0.2, 0.06, 6, 12), (tri) => (Math.floor(tri / 12) % 2 ? '#ef4444' : '#ffffff'), { p: [0.82, 0.7, -0.6], r: [0, Math.PI / 2, 0] }),
    ];
  },
  fountain: () => {
    const stone = '#d6dde6';
    const dark = '#b7c2cf';
    const water = '#6cc7f2';
    const out = [part(cyl(2.15, 2.25, 0.45, 22), dark, { p: [0, 0.22, 0] }), part(torus(2.0, 0.16, 6, 28), stone, { p: [0, 0.5, 0], r: [Math.PI / 2, 0, 0] })];
    out.push(part(cyl(1.88, 1.88, 0.06, 22), water, { p: [0, 0.47, 0], water: 1, glow: 0.12 }));
    out.push(part(cyl(0.32, 0.42, 1.4, 12), stone, { p: [0, 1.1, 0] }), part(cyl(0.95, 0.5, 0.32, 18), stone, { p: [0, 1.86, 0] }), part(torus(0.9, 0.07, 5, 20), dark, { p: [0, 2.02, 0], r: [Math.PI / 2, 0, 0] }));
    out.push(part(cyl(0.82, 0.82, 0.05, 18), water, { p: [0, 2.03, 0], water: 1, glow: 0.12 }));
    out.push(part(cyl(0.14, 0.2, 0.6, 10), stone, { p: [0, 2.3, 0] }), part(cone(0.3, 0.75, 12), '#bfe8fb', { p: [0, 2.75, 0], water: 1, glow: 0.3 }), part(sph(0.2, 10, 8), '#e3f6ff', { p: [0, 3.15, 0], water: 1, glow: 0.4 }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      out.push(part(sph(0.1, 6, 4), '#bfe8fb', { p: [Math.cos(a) * 0.62, 1.7, Math.sin(a) * 0.62], s: [1, 2.2, 1], water: 1, glow: 0.3 }));
    }
    return out;
  },
  hut: (v) => {
    const wall = v % 2 ? '#d9a86c' : '#c99460';
    const out = [part(cyl(1.75, 1.8, 0.25, 14), '#b38552', { p: [0, 0.12, 0] }), part(cyl(1.65, 1.7, 1.75, 14), wall, { p: [0, 1.1, 0] })];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      out.push(part(cyl(0.07, 0.07, 1.8, 5), '#8a5a2f', { p: [Math.cos(a) * 1.7, 1.1, Math.sin(a) * 1.7] }));
    }
    [
      [2.45, 1.2, 2.45, '#e8c770'],
      [1.9, 1.1, 3.05, '#f0d27f'],
      [1.2, 0.95, 3.6, '#e8c770'],
    ].forEach(([r, h, y, c], i) => out.push(part(cone(r, h, 14), c, { p: [0, y, 0], r: [0, i * 0.2, 0] })));
    out.push(part(cyl(0.06, 0.15, 0.5, 6), '#b9874d', { p: [0, 4.25, 0] }));
    out.push(part(rbox(0.85, 1.25, 0.14, 0.05), '#7c4a1e', { p: [0, 0.82, 1.7] }), part(rbox(1.05, 0.12, 0.2, 0.04), '#a0703c', { p: [0, 1.5, 1.72] }));
    out.push(part(rbox(0.55, 0.45, 0.1, 0.04), '#a8e2ff', { p: [1.12, 1.25, 1.32], r: [0, 0.7, 0], glow: 0.15 }), part(rbox(0.55, 0.45, 0.1, 0.04), '#a8e2ff', { p: [-1.12, 1.25, 1.32], r: [0, -0.7, 0], glow: 0.15 }));
    out.push(part(rbox(1.6, 0.1, 0.8, 0.03), '#a0703c', { p: [0, 0.3, 2.1] }));
    return out;
  },
  house: (v, mi = 0) => {
    const P = PALETTES[mi] || PALETTES[0];
    const wall = P.walls[v % 4];
    const roof = P.roofs[v % 4];
    const door = P.doors[v % 4];
    const out = [part(rbox(4.3, 0.28, 3.7, 0.08), '#c9bfae', { p: [0, 0.14, 0] }), part(rbox(4.0, 2.3, 3.4, 0.12), wall, { p: [0, 1.4, 0] }), part(gable(3.96, 1.5, 3.36), wall, { p: [0, 2.5, 0] })];
    tiledRoof(out, { W: 4.0, D: 3.4, H: 1.5, y0: 2.5, color: roof });
    // chimney
    out.push(part(box(0.55, 1.3, 0.55), '#c86b4f', { p: [1.25, 3.6, -0.75] }), part(box(0.68, 0.14, 0.68), '#9b4f3a', { p: [1.25, 4.3, -0.75] }));
    // door with frame, awning and step
    const dx = v % 2 ? -0.55 : 0;
    out.push(part(box(1.1, 1.65, 0.12), '#ffffff', { p: [dx, 1.08, 1.72] }), part(rbox(0.86, 1.45, 0.12, 0.04), door, { p: [dx, 1.0, 1.77] }));
    out.push(part(box(0.62, 0.05, 0.03), shade(door, 0.8), { p: [dx, 1.2, 1.84] }), part(box(0.62, 0.05, 0.03), shade(door, 0.8), { p: [dx, 0.7, 1.84] }));
    out.push(part(sph(0.06, 6, 4), '#facc15', { p: [dx + 0.28, 0.98, 1.86] }), part(box(1.35, 0.1, 0.55), roof, { p: [dx, 2.02, 1.92], r: [0.18, 0, 0] }), part(box(1.25, 0.14, 0.5), '#d9d2c3', { p: [dx, 0.2, 2.0] }));
    // windows
    const fl = ['#f472b6', '#facc15', '#fb7185'];
    if (v % 2) windowAt(out, 1.0, 1.5, 1.72, { w: 1.1, flowers: fl });
    else for (const x of [-1.35, 1.35]) windowAt(out, x, 1.5, 1.72, { flowers: fl });
    windowAt(out, 2.02, 1.5, 0, { ry: Math.PI / 2 });
    windowAt(out, -2.02, 1.5, 0, { ry: -Math.PI / 2 });
    return out;
  },
  mart: () => {
    const blue = '#3a7be0';
    const out = [part(rbox(6.3, 0.3, 5.3, 0.08), '#c9cfd8', { p: [0, 0.15, 0] }), part(rbox(6.0, 3.1, 5.0, 0.16), '#f7f9fc', { p: [0, 1.85, 0] })];
    out.push(part(rbox(6.12, 0.35, 5.12, 0.08), blue, { p: [0, 0.48, 0] }));
    out.push(part(rbox(6.7, 0.75, 5.7, 0.28, 2), blue, { p: [0, 3.7, 0] }), part(rbox(6.0, 0.3, 5.0, 0.12), '#5b95ea', { p: [0, 4.1, 0] }), part(rbox(1.2, 0.5, 1.2, 0.1), '#c9cfd8', { p: [1.6, 4.4, -1.2] }));
    // sign: MART in white pixel letters on a blue board
    out.push(part(rbox(3.7, 1.05, 0.26, 0.1), blue, { p: [0, 2.85, 2.6] }), part(rbox(3.5, 0.85, 0.05, 0.05), '#2f63bf', { p: [0, 2.85, 2.74] }));
    letters(out, 'MART', 0, 2.85, 2.78, 0.13, '#ffffff');
    // entrance and windows
    out.push(part(rbox(2.4, 2.2, 0.14, 0.05), '#cfd8e6', { p: [0, 1.4, 2.5] }), part(box(2.1, 2.0, 0.08), '#a9dcff', { p: [0, 1.35, 2.56], glow: 0.2 }), part(box(0.07, 2.0, 0.1), '#cfd8e6', { p: [0, 1.35, 2.6] }));
    for (const x of [-2.1, 2.1]) {
      windowAt(out, x, 1.65, 2.5, { w: 1.1, h: 1.0, frame: '#cfd8e6' });
      out.push(part(rbox(1.6, 0.12, 0.7, 0.04), blue, { p: [x, 2.35, 2.82], r: [0.3, 0, 0] }));
    }
    out.push(part(rbox(2.6, 0.12, 0.9, 0.04), blue, { p: [0, 2.32, 2.92], r: [0.25, 0, 0] }));
    for (const x of [-2.1, 2.1]) windowAt(out, 3.0, 1.65, x * 0.7, { w: 1.0, h: 0.9, frame: '#cfd8e6', ry: Math.PI / 2 });
    return out;
  },
  center: () => {
    const red = '#ef4f5a';
    const out = [part(rbox(6.7, 0.3, 5.7, 0.08), '#d5cfd2', { p: [0, 0.15, 0] }), part(rbox(6.4, 3.1, 5.4, 0.16), '#fff6f6', { p: [0, 1.85, 0] })];
    out.push(part(rbox(6.52, 0.22, 5.52, 0.06), red, { p: [0, 3.25, 0] }));
    out.push(part(rbox(7.0, 0.8, 6.0, 0.3, 2), red, { p: [0, 3.75, 0] }), part(new THREE.SphereGeometry(2.0, 20, 8, 0, TAU, 0, Math.PI / 2), red, { p: [0, 4.1, -0.2], s: [1, 0.55, 1] }), part(torus(2.0, 0.1, 5, 24), '#ffffff', { p: [0, 4.12, -0.2], r: [Math.PI / 2, 0, 0] }));
    // big Poké Ball sign on the facade
    const ey = 2.35;
    const ez = 2.78;
    out.push(part(cyl(1.08, 1.08, 0.1, 24), '#1e293b', { p: [0, ey, ez - 0.03], r: [Math.PI / 2, 0, 0] }));
    out.push(part(halfDisc(0.98, 0.16, true, 22), red, { p: [0, ey, ez + 0.04] }), part(halfDisc(0.98, 0.16, false, 22), '#ffffff', { p: [0, ey, ez + 0.04] }));
    out.push(part(box(1.98, 0.16, 0.2), '#1e293b', { p: [0, ey, ez + 0.06] }), part(cyl(0.32, 0.32, 0.22, 18), '#1e293b', { p: [0, ey, ez + 0.07], r: [Math.PI / 2, 0, 0] }), part(cyl(0.2, 0.2, 0.26, 16), '#ffffff', { p: [0, ey, ez + 0.08], r: [Math.PI / 2, 0, 0], glow: 0.35 }));
    // glass sliding doors
    out.push(part(rbox(2.6, 1.6, 0.14, 0.05), red, { p: [0, 0.95, 2.72] }), part(box(2.3, 1.45, 0.08), '#a9dcff', { p: [0, 0.9, 2.78], glow: 0.2 }), part(box(0.07, 1.45, 0.1), red, { p: [0, 0.9, 2.82] }));
    for (const x of [-2.4, 2.4]) windowAt(out, x, 1.75, 2.72, { w: 1.0, h: 0.9, frame: '#ffd9dc' });
    for (const z of [-1.4, 1.4]) windowAt(out, 3.22, 1.75, z, { w: 1.0, h: 0.9, frame: '#ffd9dc', ry: Math.PI / 2 });
    return out;
  },
  tower: (v) => {
    const out = [];
    if (v % 2) {
      // Celadon: stepped glass skyscraper with glowing window bands and a blinking antenna
      for (let i = 0; i < 4; i++) {
        const w = 6.4 - i * 1.2;
        const y = i * 4;
        out.push(part(rbox(w, 4, w, 0.2), i % 2 ? '#8fd3f7' : '#d7efff', { p: [0, y + 2, 0] }));
        for (let k = 0; k < 3; k++) out.push(part(box(w + 0.06, 0.42, w + 0.06), '#5fc0f0', { p: [0, y + 1 + k * 1.15, 0], glow: 0.35 }));
        for (let k = -1; k <= 1; k++) out.push(part(box(0.12, 4, w + 0.1), '#e8f6ff', { p: [k * w * 0.3, y + 2, 0] }), part(box(w + 0.1, 4, 0.12), '#e8f6ff', { p: [0, y + 2, k * w * 0.3] }));
        out.push(part(rbox(w + 0.3, 0.3, w + 0.3, 0.1), '#64748b', { p: [0, y + 4, 0] }));
      }
      out.push(part(cyl(0.12, 0.16, 3, 6), '#94a3b8', { p: [0, 17.5, 0] }), part(sph(0.38, 10, 8), '#ff4d5e', { p: [0, 19.1, 0], glow: 1 }));
      out.push(part(cyl(1.1, 1.1, 0.08, 16), '#475569', { p: [0, 16.2, 0] }));
    } else {
      // Pallet: stone bell tower with a clock, a golden bell and a purple spire
      const stone = '#f1e7d6';
      const trim = '#cdb894';
      out.push(part(rbox(6.6, 1.2, 6.6, 0.15), '#cbd5e1', { p: [0, 0.6, 0] }), part(rbox(5.2, 9, 5.2, 0.15), stone, { p: [0, 5.6, 0] }));
      for (const [x, z] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ])
        out.push(part(rbox(0.7, 9.2, 0.7, 0.1), trim, { p: [x * 2.5, 5.6, z * 2.5] }));
      for (let i = 0; i < 4; i++) out.push(part(rbox(5.5, 0.35, 5.5, 0.08), trim, { p: [0, 2.5 + i * 2.2, 0] }));
      out.push(part(rbox(1.5, 2.5, 0.16, 0.06), '#ffffff', { p: [0, 2.35, 2.62] }), part(rbox(1.25, 2.3, 0.16, 0.05), '#8b5a2b', { p: [0, 2.25, 2.66] }));
      for (let i = 0; i < 2; i++) windowAt(out, 0, 4.6 + i * 2.2, 2.62, { w: 0.8, h: 1.1 });
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) windowAt(out, s * 2.62, 3.6 + i * 2.2, 0, { w: 0.8, h: 1.1, ry: (s * Math.PI) / 2 });
      // clock
      out.push(part(cyl(1.15, 1.15, 0.14, 24), '#ffffff', { p: [0, 9.05, 2.64], r: [Math.PI / 2, 0, 0] }), part(torus(1.15, 0.1, 6, 24), '#e2b23c', { p: [0, 9.05, 2.72] }));
      out.push(part(box(0.1, 0.8, 0.05), '#1e293b', { p: [0, 9.35, 2.76] }), part(box(0.6, 0.1, 0.05), '#1e293b', { p: [0.27, 9.05, 2.77] }));
      for (let i = 0; i < 12; i++) out.push(part(box(0.08, 0.16, 0.04), '#1e293b', { p: [Math.sin((i / 12) * TAU) * 0.95, 9.05 + Math.cos((i / 12) * TAU) * 0.95, 2.73], r: [0, 0, -(i / 12) * TAU] }));
      // belfry
      out.push(part(rbox(4.6, 0.4, 4.6, 0.1), trim, { p: [0, 10.3, 0] }));
      for (const [x, z] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ])
        out.push(part(rbox(0.75, 2.7, 0.75, 0.1), stone, { p: [x * 1.9, 11.75, z * 1.9] }));
      out.push(part(cone(0.85, 1.2, 14), '#f5c33b', { p: [0, 11.8, 0], glow: 0.15 }), part(sph(0.22, 8, 6), '#e2a72a', { p: [0, 11.1, 0] }), part(rbox(4.8, 0.45, 4.8, 0.12), trim, { p: [0, 13.2, 0] }));
      out.push(part(cone(3.5, 4.4, 4), '#9b6cf0', { p: [0, 15.6, 0], r: [0, Math.PI / 4, 0] }), part(cone(3.55, 0.5, 4), '#7c4ddb', { p: [0, 13.6, 0], r: [0, Math.PI / 4, 0] }));
      out.push(part(cyl(0.08, 0.08, 1.6, 5), '#e2b23c', { p: [0, 18.5, 0] }), part(sph(0.3, 8, 6), '#f5c33b', { p: [0, 18.0, 0] }), part(box(0.04, 0.5, 0.8), '#ff4d5e', { p: [0, 19.0, 0.42], sway: 0.05 }));
    }
    return out;
  },
  lighthouse: () => {
    const out = [part(cyl(4.0, 4.3, 0.8, 18), '#94a3b8', { p: [0, 0.4, 0] }), part(cyl(3.0, 3.2, 0.3, 18), '#cbd5e1', { p: [0, 0.95, 0] })];
    for (let i = 0; i < 6; i++) out.push(part(cyl(2.6 - (i + 1) * 0.22, 2.6 - i * 0.22, 2.4, 18), i % 2 ? '#ef4444' : '#f8fafc', { p: [0, 2.3 + i * 2.4, 0] }));
    for (let i = 0; i < 3; i++) out.push(part(rbox(0.5, 0.75, 0.2, 0.06), '#7cc8f5', { p: [0, 4 + i * 4, 2.35 - i * 0.6], glow: 0.3 }));
    out.push(part(cyl(2.0, 1.8, 0.35, 18), '#334155', { p: [0, 15.6, 0] }), part(torus(1.9, 0.06, 4, 24), '#334155', { p: [0, 16.45, 0], r: [Math.PI / 2, 0, 0] }));
    for (let i = 0; i < 12; i++) out.push(part(cyl(0.04, 0.04, 0.8, 4), '#334155', { p: [Math.cos((i / 12) * TAU) * 1.9, 16.05, Math.sin((i / 12) * TAU) * 1.9] }));
    out.push(part(cyl(1.15, 1.15, 1.7, 14), '#fff2a8', { p: [0, 16.65, 0], glow: 0.9 }), part(cyl(1.25, 1.25, 0.12, 14), '#334155', { p: [0, 17.5, 0] }));
    for (let i = 0; i < 6; i++) out.push(part(box(0.08, 1.7, 0.08), '#334155', { p: [Math.cos((i / 6) * TAU) * 1.16, 16.65, Math.sin((i / 6) * TAU) * 1.16] }));
    out.push(part(new THREE.SphereGeometry(1.3, 16, 6, 0, TAU, 0, Math.PI / 2), '#ef4444', { p: [0, 17.55, 0], s: [1, 0.8, 1] }), part(sph(0.25, 8, 6), '#facc15', { p: [0, 18.7, 0], glow: 0.5 }));
    out.push(part(rbox(2.4, 2.0, 2.0, 0.1), '#f8fafc', { p: [0, 1.9, 3.5] }), part(gable(2.6, 0.9, 2.2), '#ef4444', { p: [0, 2.9, 3.5] }), part(rbox(0.8, 1.4, 0.12, 0.04), '#7c4a1e', { p: [0, 1.6, 4.52] }));
    return out;
  },
};

/** Geometry for (kind, variant) in map `mapIndex` (palette); the caller owns it. */
export function kindGeometry(kind, variant = 0, mapIndex = 0) {
  const build = BUILD[kind];
  if (!build) throw new Error(`unknown kind ${kind}`);
  const g = merge(build(variant, mapIndex));
  // Baked contact shading: a little darker where things meet the ground
  const pos = g.attributes.position;
  const col = g.attributes.color;
  g.computeBoundingBox();
  const h = g.boundingBox.max.y;
  const band = Math.min(0.45, h * 0.35);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < band) {
      const k = 0.78 + 0.22 * (y / band);
      col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
    }
  }
  return g;
}

/** Height of a kind (for the swallow arc and the shadow). */
export function kindHeight(geo) {
  geo.computeBoundingBox();
  return geo.boundingBox.max.y;
}

/* ---------------- Decoration (not edible) ---------------- */

/** Grass tuft, rock, pebble cluster, cloud and hill geometries for the scenery. */
export function decorGeometry(type) {
  if (type === 'tuft') {
    const out = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      out.push(part(cone(0.05, 0.32 + (i % 3) * 0.08, 3), i % 2 ? '#5fbf4f' : '#4aa83f', { p: [Math.cos(a) * 0.06, 0.16, Math.sin(a) * 0.06], r: [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35], sway: 0.06 }));
    }
    return merge(out);
  }
  if (type === 'rock') return merge([part(new THREE.DodecahedronGeometry(0.6, 0), '#a7b0bb', { p: [0, 0.25, 0], s: [1, 0.65, 0.9] }), part(new THREE.DodecahedronGeometry(0.32, 0), '#bfc7d0', { p: [0.55, 0.12, 0.2], s: [1, 0.7, 1] })]);
  if (type === 'flowers') {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const r = 0.15 + (i % 3) * 0.18;
      out.push(part(sph(0.07, 5, 3), FLOWER_COLORS[i % 4], { p: [Math.cos(a) * r, 0.08, Math.sin(a) * r], s: [1, 0.6, 1], sway: 0.02 }));
    }
    for (let i = 0; i < 5; i++) out.push(part(cone(0.04, 0.18, 3), '#4aa83f', { p: [Math.cos(i * 1.3) * 0.3, 0.09, Math.sin(i * 1.3) * 0.3], sway: 0.03 }));
    return merge(out);
  }
  if (type === 'cloud') {
    const out = [];
    [
      [0, 0, 0, 3.2],
      [3, -0.6, 0.4, 2.4],
      [-3, -0.7, -0.3, 2.3],
      [1.2, 1.4, -0.4, 2.2],
      [-1.4, 1.0, 0.6, 2.0],
    ].forEach(([x, y, z, r]) => out.push(part(ico(r, 1), y > 0.5 ? '#ffffff' : '#f2f8ff', { p: [x, y, z], s: [1, 0.75, 0.9] })));
    return merge(out);
  }
  // hill
  return merge([part(new THREE.SphereGeometry(1, 14, 7, 0, TAU, 0, Math.PI / 2), '#6fbf5f', { s: [1, 0.45, 1] })]);
}

/* ---------------- Powerups ---------------- */

export function powerupGeometry(type) {
  if (type === 'gold') return merge([part(sph(0.42, 14, 10), '#facc15', { p: [0, 0, 0] }), part(sph(0.12, 6, 4), '#fff3b0', { p: [-0.15, 0.18, 0.3], glow: 0.6 }), part(cone(0.16, 0.3, 5), '#16a34a', { p: [0, 0.5, 0] }), part(sph(0.14, 6, 4), '#22c55e', { p: [0.18, 0.48, 0], s: [1.6, 0.4, 0.9] })]);
  if (type === 'speed')
    return merge([
      part(rbox(0.5, 0.36, 0.9, 0.1), '#ef4444', { p: [0, 0.05, 0] }),
      part(sph(0.28, 10, 8), '#ef4444', { p: [0, 0.1, 0.38], s: [0.9, 0.65, 0.8] }),
      part(rbox(0.55, 0.14, 1.15, 0.05), '#f8fafc', { p: [0, -0.18, 0.08] }),
      part(rbox(0.46, 0.5, 0.18, 0.06), '#ef4444', { p: [0, 0.32, -0.36] }),
      part(box(0.52, 0.06, 0.4), '#facc15', { p: [0, 0.24, 0.05] }),
      part(box(0.04, 0.25, 0.5), '#fde047', { p: [0.27, 0.05, -0.05] }),
    ]);
  // magnet
  return merge([
    part(torus(0.38, 0.14, 8, 14, Math.PI), '#ef4444', { p: [0, 0.1, 0], r: [0, 0, Math.PI] }),
    part(cyl(0.14, 0.14, 0.3, 10), '#ef4444', { p: [-0.38, 0.25, 0] }),
    part(cyl(0.14, 0.14, 0.3, 10), '#ef4444', { p: [0.38, 0.25, 0] }),
    part(cyl(0.145, 0.145, 0.18, 10), '#e2e8f0', { p: [-0.38, 0.48, 0] }),
    part(cyl(0.145, 0.145, 0.18, 10), '#e2e8f0', { p: [0.38, 0.48, 0] }),
  ]);
}

/* ---------------- Friendly chibi Pokemon ---------------- */

const S = (r = 1, w = 12, h = 9) => sph(r, w, h);
/** Eyes facing +Z: dark iris, coloured ring and two highlights. */
function chibiEyes(out, y, z, x, er, iris = '#1e1b2e', ring = null) {
  for (const sx of [-1, 1]) {
    if (ring) out.push(part(S(1, 10, 8), ring, { p: [sx * x, y, z], s: [er * 1.0, er * 1.2, er * 0.5] }));
    out.push(part(S(1, 10, 8), iris, { p: [sx * x, y - er * 0.05, z + er * 0.12], s: [er * (ring ? 0.7 : 1), er * (ring ? 0.85 : 1.2), er * 0.45] }));
    out.push(part(S(1, 6, 4), '#ffffff', { p: [sx * x - sx * er * 0.25, y + er * 0.38, z + er * 0.5], s: [er * 0.32, er * 0.32, er * 0.12], glow: 0.6 }));
    out.push(part(S(1, 5, 3), '#ffffff', { p: [sx * x + sx * er * 0.25, y - er * 0.4, z + er * 0.48], s: [er * 0.15, er * 0.15, er * 0.08], glow: 0.6 }));
  }
}

const CHIBI = {
  rattata: () => {
    const P = '#a77fd0';
    const cream = '#f6e7c8';
    const out = [part(S(), P, { p: [0, 0.34, -0.06], s: [0.32, 0.27, 0.38] }), part(S(), cream, { p: [0, 0.28, 0.1], s: [0.21, 0.18, 0.23] })];
    out.push(part(S(), P, { p: [0, 0.62, 0.16], s: [0.31, 0.28, 0.28] }), part(S(), cream, { p: [0, 0.53, 0.38], s: [0.16, 0.11, 0.11] }), part(S(1, 8, 6), '#7c4a8f', { p: [0, 0.58, 0.48], s: [0.04, 0.03, 0.03] }));
    out.push(part(box(0.035, 0.065, 0.02), '#ffffff', { p: [-0.021, 0.45, 0.46] }), part(box(0.035, 0.065, 0.02), '#ffffff', { p: [0.021, 0.45, 0.46] }));
    for (const sx of [-1, 1]) {
      out.push(part(S(), P, { p: [sx * 0.21, 0.88, 0.14], s: [0.17, 0.19, 0.05], r: [0, sx * -0.3, sx * -0.35] }), part(S(), '#f4b6cc', { p: [sx * 0.21, 0.88, 0.17], s: [0.11, 0.13, 0.02], r: [0, sx * -0.3, sx * -0.35] }));
      for (const k of [0, 1]) out.push(part(box(0.18, 0.008, 0.008), '#5b3f6b', { p: [sx * 0.2, 0.53 - k * 0.04, 0.42], r: [0, sx * -0.25, sx * (k ? 0.18 : -0.12)] }));
      out.push(part(S(1, 8, 6), cream, { p: [sx * 0.15, 0.07, 0.2], s: [0.07, 0.06, 0.1] }), part(S(1, 8, 6), cream, { p: [sx * 0.17, 0.07, -0.24], s: [0.08, 0.06, 0.12] }));
    }
    chibiEyes(out, 0.67, 0.4, 0.11, 0.075, '#2a0f16', '#d4283f');
    return out;
  },
  pidgey: () => {
    const B = '#b9824f';
    const cream = '#f3e0bd';
    const out = [part(S(), B, { p: [0, 0.4, 0], s: [0.33, 0.33, 0.35] }), part(S(), cream, { p: [0, 0.35, 0.14], s: [0.25, 0.26, 0.23] })];
    out.push(part(S(), B, { p: [0, 0.72, 0.1], s: [0.25, 0.23, 0.24] }), part(S(), cream, { p: [0, 0.67, 0.23], s: [0.18, 0.13, 0.12] }));
    for (const sx of [-1, 1]) out.push(part(S(1, 8, 6), '#2b2b33', { p: [sx * 0.14, 0.77, 0.15], s: [0.12, 0.035, 0.09], r: [0, sx * 0.5, sx * -0.15] }));
    chibiEyes(out, 0.78, 0.3, 0.1, 0.058);
    out.push(part(cone(0.06, 0.13, 8), '#8d7f86', { p: [0, 0.7, 0.4], r: [Math.PI / 2, 0, 0] }));
    out.push(part(cone(0.08, 0.24, 6), B, { p: [0, 0.98, 0.06], r: [-0.7, 0, 0] }), part(cone(0.06, 0.2, 6), '#f0b3a0', { p: [0, 0.97, 0.14], r: [-0.35, 0, 0] }), part(cone(0.05, 0.16, 6), B, { p: [0, 0.95, -0.02], r: [-1.0, 0, 0] }));
    for (const sx of [-1, 1]) out.push(part(S(1, 8, 6), '#f4a3a3', { p: [sx * 0.12, 0.05, 0.1], s: [0.05, 0.05, 0.1] }));
    for (const k of [-1, 0, 1]) out.push(part(S(1, 8, 6), '#7a4f2a', { p: [k * 0.08, 0.36, -0.38], s: [0.07, 0.04, 0.17], r: [0.5, k * 0.4, 0] }));
    return out;
  },
  wurmple: () => {
    const R = '#e4475a';
    const cream = '#f5e6a8';
    const out = [];
    [
      [0.2, -0.42, 0.17],
      [0.23, -0.22, 0.2],
      [0.26, 0.0, 0.22],
      [0.29, 0.2, 0.22],
    ].forEach(([y, z, r], i) => {
      out.push(part(S(), R, { p: [0, y, z], s: [r, r, r * 0.95] }), part(S(1, 10, 6), cream, { p: [0, y - r * 0.5, z + 0.02], s: [r * 0.72, r * 0.38, r * 0.62] }));
      for (const sx of [-1, 1]) out.push(part(S(1, 6, 4), cream, { p: [sx * r * 0.62, y - r * 0.75, z], s: [0.045, 0.04, 0.045] }));
      if (i < 3) out.push(part(cone(0.035, 0.09, 5), '#f2c94c', { p: [0, y + r * 0.98, z] }));
    });
    out.push(part(S(), R, { p: [0, 0.5, 0.36], s: [0.27, 0.25, 0.25] }), part(S(), cream, { p: [0, 0.42, 0.52], s: [0.16, 0.1, 0.08] }), part(S(1, 8, 6), '#7a1f2c', { p: [0, 0.42, 0.59], s: [0.06, 0.025, 0.02] }));
    chibiEyes(out, 0.55, 0.55, 0.1, 0.055);
    out.push(part(cone(0.06, 0.26, 8), '#fbfaf5', { p: [0, 0.82, 0.33], r: [0.25, 0, 0] }));
    for (const sx of [-1, 1]) out.push(part(cone(0.035, 0.11, 6), '#fbfaf5', { p: [sx * 0.13, 0.69, 0.3], r: [0, 0, -sx * 0.5] }));
    out.push(part(cone(0.05, 0.22, 6), '#f2c94c', { p: [0.05, 0.3, -0.62], r: [-1.0, 0, -0.3] }), part(cone(0.05, 0.22, 6), '#f2c94c', { p: [-0.05, 0.3, -0.62], r: [-1.0, 0, 0.3] }));
    return out;
  },
};

/** Small 3D chibi Pokemon (Rattata, Pidgey, Wurmple), facing +Z, ~0.8 m tall. Shares geometry/materials via `cache`. */
export function createChibi(species, cache) {
  const geo = (key, make) => {
    if (!cache.geos[key]) cache.geos[key] = make();
    return cache.geos[key];
  };
  if (!cache.mats.toon) cache.mats.toon = toonMaterial('#ffffff', { ramp: cache.ramp, vertexColors: true, key: 'chibi', rim: 0.25 });
  if (!cache.mats.line) cache.mats.line = outlineMaterial({ vertexColors: true, darken: 0.35, width: 0.004, max: 0.03 });
  const { toon, line } = cache.mats;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const add = (g, parent = body) => {
    const m = new THREE.Mesh(g, toon);
    m.castShadow = false; // blob shadow under the chibi
    parent.add(m);
    outlineOf(m, line);
    return m;
  };
  const kind = CHIBI[species] ? species : 'wurmple';
  add(geo(kind, () => merge(CHIBI[kind]())));
  const parts = {};
  if (kind === 'rattata') {
    const tail = add(geo('rtail', () => merge([part(torus(0.16, 0.028, 6, 14, Math.PI * 1.6), '#a77fd0'), part(S(1, 6, 4), '#a77fd0', { p: [0.16, 0, 0], s: [0.04, 0.04, 0.04] })])));
    tail.position.set(0, 0.42, -0.5);
    tail.rotation.set(0, Math.PI / 2, 0);
    parts.wag = tail;
  } else if (kind === 'pidgey') {
    const wg = geo('pwing', () => merge([part(S(), '#9a6a3e', { s: [0.08, 0.2, 0.26] }), part(S(1, 8, 6), '#f3e0bd', { p: [0.02, -0.04, 0.08], s: [0.06, 0.12, 0.12] })]));
    parts.wings = [-1, 1].map((sx) => {
      const w = add(wg);
      w.position.set(sx * 0.32, 0.42, -0.04);
      w.rotation.z = sx * 0.25;
      return w;
    });
  }
  return { group, body, parts, species };
}
