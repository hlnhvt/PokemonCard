// Low-poly toy-town models for "Snorlax nuốt cả thành phố". Every edible kind is ONE merged,
// vertex-coloured BufferGeometry (drawn with an InstancedMesh per kind/variant), built in code.
// Units are metres, origin on the ground at the centre of the footprint, front faces +Z.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const tmpColor = new THREE.Color();

/** Bake a geometry: transform, flatten (non-indexed) and paint a vertex colour (or a per-triangle colour fn). */
function part(geo, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  geo.dispose();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
  g.applyMatrix4(m);
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = typeof color === 'function' ? color(Math.floor(i / 3), g.attributes.position, i) : color;
    tmpColor.set(c);
    col[i * 3] = tmpColor.r;
    col[i * 3 + 1] = tmpColor.g;
    col[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Concatenate baked parts into one geometry. */
export function merge(parts) {
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
const cone = (r, h, seg = 10) => new THREE.ConeGeometry(r, h, seg);

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

const HOUSE_ROOFS = ['#e0524f', '#3f7fd6', '#3fae6a', '#f08a2c'];
const HOUSE_WALLS = ['#fff3dc', '#fde2e4', '#e6f0ff', '#fff7c2'];
const CAR_COLORS = ['#ef4444', '#3b82f6', '#facc15', '#22c55e'];
const FLOWER_COLORS = ['#f472b6', '#facc15', '#a78bfa', '#fb7185'];

/** Number of colour variants per kind (one InstancedMesh each). */
export const VARIANTS = { house: 4, car: 4, flower: 4, tree: 2, hut: 2, tower: 2 };

const BUILD = {
  berry: () => [part(sph(0.16, 10, 8), '#3b82f6', { p: [0, 0.16, 0] }), part(cone(0.07, 0.12, 5), '#16a34a', { p: [0, 0.33, 0] })],
  apple: () => [part(sph(0.18, 10, 8), '#e11d48', { p: [0, 0.18, 0], s: [1, 0.92, 1] }), part(cyl(0.015, 0.015, 0.1, 4), '#78350f', { p: [0, 0.38, 0] }), part(sph(0.06, 5, 4), '#22c55e', { p: [0.06, 0.38, 0], s: [1.4, 0.4, 0.8] })],
  pokeball: () => [
    part(new THREE.SphereGeometry(0.19, 12, 6, 0, TAU, 0, Math.PI / 2), '#ef4444', { p: [0, 0.19, 0] }),
    part(new THREE.SphereGeometry(0.19, 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2), '#f8fafc', { p: [0, 0.19, 0] }),
    part(cyl(0.195, 0.195, 0.035, 12), '#1e293b', { p: [0, 0.19, 0] }),
    part(cyl(0.06, 0.06, 0.04, 10), '#f8fafc', { p: [0, 0.19, 0.18], r: [Math.PI / 2, 0, 0] }),
  ],
  flower: (v) => {
    const out = [part(cyl(0.015, 0.02, 0.36, 4), '#16a34a', { p: [0, 0.18, 0] }), part(sph(0.05, 6, 4), '#16a34a', { p: [0.06, 0.12, 0], s: [1.5, 0.4, 0.8] })];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      out.push(part(sph(0.075, 6, 4), FLOWER_COLORS[v % 4], { p: [Math.cos(a) * 0.08, 0.38, Math.sin(a) * 0.08], s: [1, 0.5, 1] }));
    }
    out.push(part(sph(0.05, 6, 4), '#fde047', { p: [0, 0.4, 0] }));
    return out;
  },
  coconut: () => [part(sph(0.2, 8, 6), '#8b5a2b', { p: [0, 0.2, 0] }), part(sph(0.04, 4, 3), '#3f2a14', { p: [0, 0.38, 0.08] })],
  shell: () => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * 2.2;
      out.push(part(cone(0.06, 0.32, 4), i % 2 ? '#fda4af' : '#fecdd3', { p: [Math.sin(a) * 0.1, 0.06, Math.cos(a) * 0.1 - 0.05], r: [Math.PI / 2 - 0.3, a, 0] }));
    }
    out.push(part(sph(0.07, 6, 4), '#fecdd3', { p: [0, 0.05, -0.12] }));
    return out;
  },
  mailbox: () => [
    part(cyl(0.04, 0.04, 0.9, 6), '#64748b', { p: [0, 0.45, 0] }),
    part(box(0.34, 0.3, 0.5), '#ef4444', { p: [0, 1.0, 0] }),
    part(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 10, 1, false, 0, Math.PI), '#ef4444', { p: [0, 1.15, 0], r: [Math.PI / 2, 0, Math.PI / 2] }),
    part(box(0.03, 0.22, 0.06), '#facc15', { p: [0.19, 1.15, -0.1] }),
    part(box(0.2, 0.04, 0.02), '#1e293b', { p: [0, 1.05, 0.26] }),
  ],
  lamp: () => [
    part(cyl(0.12, 0.16, 0.2, 8), '#1f513a', { p: [0, 0.1, 0] }),
    part(cyl(0.05, 0.06, 2.4, 6), '#2f6b4f', { p: [0, 1.3, 0] }),
    part(sph(0.22, 10, 8), '#fff4b0', { p: [0, 2.62, 0] }),
    part(cone(0.27, 0.18, 8), '#2f6b4f', { p: [0, 2.86, 0] }),
  ],
  bench: () => {
    const out = [];
    for (let i = 0; i < 3; i++) out.push(part(box(1.3, 0.06, 0.13), '#c2773a', { p: [0, 0.45, -0.15 + i * 0.15] }));
    for (let i = 0; i < 2; i++) out.push(part(box(1.3, 0.12, 0.05), '#b0652c', { p: [0, 0.68 + i * 0.16, -0.27], r: [-0.15, 0, 0] }));
    for (const x of [-0.55, 0.55]) out.push(part(box(0.07, 0.45, 0.4), '#475569', { p: [x, 0.22, -0.05] }), part(box(0.07, 0.45, 0.06), '#475569', { p: [x, 0.62, -0.28] }));
    return out;
  },
  umbrella: () => [
    part(cyl(0.03, 0.03, 2, 5), '#f8fafc', { p: [0, 1, 0] }),
    part(cone(1.0, 0.45, 8), (tri) => (Math.floor(tri / 2) % 2 ? '#f97316' : '#fef3c7'), { p: [0, 2.05, 0] }),
    part(box(0.9, 0.08, 0.5), '#38bdf8', { p: [0.5, 0.04, 0.6] }),
  ],
  sandcastle: () => [
    part(cyl(0.55, 0.62, 0.35, 10), '#f6d38b', { p: [0, 0.17, 0] }),
    part(cyl(0.32, 0.38, 0.35, 10), '#f2c56f', { p: [0, 0.5, 0] }),
    part(cone(0.22, 0.35, 8), '#f6d38b', { p: [0, 0.85, 0] }),
    ...[0, 1, 2, 3].map((i) => part(cyl(0.12, 0.13, 0.4, 6), '#f2c56f', { p: [Math.cos((i / 4) * TAU) * 0.48, 0.3, Math.sin((i / 4) * TAU) * 0.48] })),
    part(box(0.02, 0.2, 0.12), '#ef4444', { p: [0, 1.1, 0.06] }),
  ],
  bush: () => [
    part(ico(0.5, 1), '#3fa34d', { p: [0, 0.42, 0], s: [1, 0.85, 1] }),
    part(ico(0.38, 1), '#4fbf5a', { p: [0.38, 0.32, 0.1] }),
    part(ico(0.36, 1), '#38944a', { p: [-0.36, 0.3, -0.05] }),
    part(sph(0.07, 5, 4), '#f43f5e', { p: [0.2, 0.75, 0.3] }),
    part(sph(0.07, 5, 4), '#f43f5e', { p: [-0.3, 0.55, 0.32] }),
  ],
  tree: (v) =>
    v % 2
      ? [part(cyl(0.12, 0.18, 0.9, 6), '#8b5a2b', { p: [0, 0.45, 0] }), part(cone(0.95, 1.5, 8), '#2f8f4e', { p: [0, 1.5, 0] }), part(cone(0.72, 1.2, 8), '#38a35a', { p: [0, 2.25, 0] }), part(cone(0.45, 0.9, 8), '#45b468', { p: [0, 2.85, 0] })]
      : [part(cyl(0.14, 0.2, 1.3, 6), '#8b5a2b', { p: [0, 0.65, 0] }), part(ico(0.95, 1), '#3cae55', { p: [0, 1.95, 0] }), part(ico(0.62, 1), '#4cc464', { p: [0.5, 1.6, 0.25] }), part(ico(0.58, 1), '#34a04c', { p: [-0.5, 1.75, -0.2] }), part(sph(0.1, 5, 4), '#ef4444', { p: [0.3, 2.3, 0.75] })],
  palm: () => {
    const out = [];
    for (let i = 0; i < 6; i++) out.push(part(cyl(0.11 - i * 0.008, 0.13 - i * 0.008, 0.5, 6), i % 2 ? '#a0703c' : '#b9874d', { p: [Math.sin(i * 0.18) * 0.35, 0.25 + i * 0.47, 0], r: [0, 0, -0.1 - i * 0.03] }));
    const top = [0.75, 2.85, 0];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      out.push(part(cone(0.22, 1.6, 4), i % 2 ? '#3fa34d' : '#5cc15a', { p: [top[0] + Math.cos(a) * 0.65, top[1] - 0.15, Math.sin(a) * 0.65], r: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1], s: [1, 1, 0.25] }));
    }
    for (let i = 0; i < 3; i++) out.push(part(sph(0.12, 6, 4), '#7c4a1e', { p: [top[0] + Math.cos(i * 2) * 0.16, top[1] - 0.2, Math.sin(i * 2) * 0.16] }));
    return out;
  },
  car: (v) => {
    const c = CAR_COLORS[v % 4];
    const out = [part(box(1.1, 0.5, 2.2), c, { p: [0, 0.5, 0] }), part(box(0.95, 0.45, 1.1), c, { p: [0, 0.95, -0.15] }), part(box(0.97, 0.32, 0.9), '#bfe3ff', { p: [0, 0.98, -0.15] }), part(box(1.0, 0.3, 0.02), '#bfe3ff', { p: [0, 0.98, 0.42] })];
    for (const x of [-0.55, 0.55]) for (const z of [-0.7, 0.7]) out.push(part(cyl(0.24, 0.24, 0.2, 10), '#1f2937', { p: [x, 0.26, z], r: [0, 0, Math.PI / 2] }));
    for (const x of [-0.35, 0.35]) out.push(part(box(0.22, 0.12, 0.04), '#fef9c3', { p: [x, 0.55, 1.1] }));
    return out;
  },
  bus: () => {
    const out = [part(box(1.5, 1.5, 4.2), '#facc15', { p: [0, 1.0, 0] }), part(box(1.52, 0.5, 3.6), '#bfe3ff', { p: [0, 1.35, -0.15] }), part(box(1.3, 0.55, 0.04), '#bfe3ff', { p: [0, 1.3, 2.1] }), part(box(1.55, 0.12, 4.25), '#f97316', { p: [0, 0.6, 0] }), part(box(1.0, 0.2, 0.05), '#1e293b', { p: [0, 1.85, 2.11] })];
    for (const x of [-0.75, 0.75]) for (const z of [-1.4, 1.4]) out.push(part(cyl(0.32, 0.32, 0.22, 10), '#1f2937', { p: [x, 0.32, z], r: [0, 0, Math.PI / 2] }));
    return out;
  },
  boat: () => {
    const hull = new THREE.CylinderGeometry(0.85, 0.55, 3.2, 10, 1, false, Math.PI / 2, Math.PI);
    return [
      part(hull, '#f8fafc', { p: [0, 0.55, 0], r: [Math.PI / 2, 0, Math.PI], s: [1, 1, 0.75] }),
      part(box(1.4, 0.12, 2.6), '#c2773a', { p: [0, 0.55, 0] }),
      part(box(1.72, 0.18, 3.2), '#2563eb', { p: [0, 0.38, 0], s: [0.98, 1, 0.98] }),
      part(cyl(0.05, 0.05, 2.6, 5), '#78350f', { p: [0, 1.85, 0.2] }),
      part(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.3, 0), new THREE.Vector2(0, 2.1)])), '#fef2f2', { p: [0.03, 0.9, 0.2], r: [0, Math.PI / 2, 0] }),
      part(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.3, 0), new THREE.Vector2(0, 2.1)])), '#fecaca', { p: [-0.03, 0.9, 0.2], r: [0, -Math.PI / 2, 0], s: [-1, 1, 1] }),
    ];
  },
  fountain: () => [
    part(cyl(2.0, 2.1, 0.5, 16), '#cbd5e1', { p: [0, 0.25, 0] }),
    part(cyl(1.8, 1.8, 0.06, 16), '#60b8f0', { p: [0, 0.48, 0] }),
    part(cyl(0.3, 0.4, 1.4, 10), '#e2e8f0', { p: [0, 1.1, 0] }),
    part(cyl(0.9, 0.5, 0.3, 14), '#cbd5e1', { p: [0, 1.85, 0] }),
    part(cyl(0.8, 0.8, 0.05, 14), '#7cc8f5', { p: [0, 1.98, 0] }),
    part(cone(0.32, 0.9, 10), '#bae6fd', { p: [0, 2.45, 0] }),
    part(sph(0.18, 8, 6), '#e0f2fe', { p: [0, 2.95, 0] }),
  ],
  hut: (v) => [
    part(cyl(1.7, 1.8, 1.8, 10), v % 2 ? '#d6a467' : '#c8915a', { p: [0, 0.9, 0] }),
    part(cone(2.4, 1.8, 10), '#e8c770', { p: [0, 2.6, 0] }),
    part(box(0.8, 1.2, 0.1), '#7c4a1e', { p: [0, 0.6, 1.75] }),
    part(box(0.5, 0.4, 0.1), '#7dd3fc', { p: [1.1, 1.1, 1.35], r: [0, 0.65, 0] }),
    part(cyl(0.08, 0.08, 1.8, 5), '#7c4a1e', { p: [-1.6, 0.9, 1.3] }),
  ],
  house: (v) => {
    const wall = HOUSE_WALLS[v % 4];
    const roof = HOUSE_ROOFS[v % 4];
    const out = [part(box(4.2, 2.4, 3.6), wall, { p: [0, 1.2, 0] }), part(gable(4.6, 1.7, 4.2), roof, { p: [0, 2.4, 0] }), part(box(0.5, 1.0, 0.5), '#94a3b8', { p: [1.3, 3.4, -0.5] })];
    out.push(part(box(0.9, 1.5, 0.08), '#8b5a2b', { p: [0, 0.75, 1.82] }), part(sph(0.06, 5, 4), '#facc15', { p: [0.3, 0.75, 1.88] }));
    for (const x of [-1.4, 1.4]) out.push(part(box(0.85, 0.75, 0.08), '#bfe3ff', { p: [x, 1.4, 1.82] }), part(box(0.95, 0.1, 0.12), '#ffffff', { p: [x, 1.0, 1.85] }));
    for (const x of [-1.2, 1.2]) out.push(part(box(0.08, 0.7, 0.8), '#bfe3ff', { p: [2.12, 1.4, x * 0.6] }));
    out.push(part(box(1.2, 0.08, 0.9), '#e2e8f0', { p: [0, 0.04, 2.3] }));
    return out;
  },
  mart: () => {
    const out = [part(box(6, 3.4, 5), '#f8fafc', { p: [0, 1.7, 0] }), part(box(6.4, 0.9, 5.4), '#2f6fd6', { p: [0, 3.6, 0] }), part(box(6.6, 0.25, 5.6), '#1e4fa8', { p: [0, 4.1, 0] })];
    out.push(part(box(3.2, 0.9, 0.12), '#2f6fd6', { p: [0, 2.85, 2.56] }), part(box(2.6, 0.35, 0.05), '#f8fafc', { p: [0, 2.85, 2.63] }));
    out.push(part(box(2.2, 2.0, 0.08), '#bfe3ff', { p: [0, 1.0, 2.52] }), part(box(0.06, 2.0, 0.1), '#94a3b8', { p: [0, 1.0, 2.56] }));
    for (const x of [-2.2, 2.2]) out.push(part(box(1.0, 1.0, 0.08), '#bfe3ff', { p: [x, 1.5, 2.52] }));
    out.push(part(box(6.4, 0.12, 1.2), '#2f6fd6', { p: [0, 2.3, 3.0], r: [0.25, 0, 0] }));
    return out;
  },
  center: () => {
    const out = [part(box(6.4, 3.2, 5.4), '#fff1f2', { p: [0, 1.6, 0] }), part(box(6.8, 1.0, 5.8), '#e8434d', { p: [0, 3.6, 0] }), part(new THREE.SphereGeometry(1.8, 16, 8, 0, TAU, 0, Math.PI / 2), '#e8434d', { p: [0, 4.1, 0], s: [1, 0.6, 1] })];
    // Poké Ball emblem on the front
    out.push(part(new THREE.CircleGeometry(1.0, 20, 0, Math.PI), '#e8434d', { p: [0, 2.45, 2.73] }), part(new THREE.CircleGeometry(1.0, 20, Math.PI, Math.PI), '#ffffff', { p: [0, 2.45, 2.73] }), part(box(2.0, 0.14, 0.02), '#1e293b', { p: [0, 2.45, 2.75] }), part(new THREE.CircleGeometry(0.28, 14), '#1e293b', { p: [0, 2.45, 2.76] }), part(new THREE.CircleGeometry(0.17, 14), '#ffffff', { p: [0, 2.45, 2.77] }));
    out.push(part(box(2.4, 1.5, 0.08), '#bfe3ff', { p: [0, 0.75, 2.72] }), part(box(0.06, 1.5, 0.1), '#e8434d', { p: [0, 0.75, 2.75] }));
    for (const x of [-2.4, 2.4]) out.push(part(box(1.0, 0.9, 0.08), '#bfe3ff', { p: [x, 1.7, 2.72] }));
    return out;
  },
  tower: (v) => {
    const out = [];
    if (v % 2) {
      // Celadon: glass skyscraper with stripes
      for (let i = 0; i < 4; i++) {
        const w = 6.4 - i * 1.2;
        out.push(part(box(w, 4, w), i % 2 ? '#7dd3fc' : '#e0f2fe', { p: [0, 2 + i * 4, 0] }));
        out.push(part(box(w + 0.2, 0.3, w + 0.2), '#475569', { p: [0, 4 + i * 4, 0] }));
        for (let k = 0; k < 3; k++) out.push(part(box(w + 0.04, 0.35, w + 0.04), '#38bdf8', { p: [0, 1 + i * 4 + k * 1.1, 0] }));
      }
      out.push(part(cyl(0.12, 0.12, 3, 6), '#94a3b8', { p: [0, 17.5, 0] }), part(sph(0.35, 8, 6), '#ef4444', { p: [0, 19.1, 0] }));
    } else {
      // Pallet: stone bell tower with a purple roof
      out.push(part(box(6.5, 1.2, 6.5), '#cbd5e1', { p: [0, 0.6, 0] }), part(box(5.2, 9, 5.2), '#f1e9da', { p: [0, 5.6, 0] }));
      for (let i = 0; i < 4; i++) out.push(part(box(5.4, 0.4, 5.4), '#c9b79a', { p: [0, 2.5 + i * 2.2, 0] }));
      out.push(part(box(1.4, 2.4, 0.1), '#8b5a2b', { p: [0, 1.6, 2.62] }));
      for (let i = 0; i < 3; i++) out.push(part(box(0.9, 1.2, 0.1), '#7dd3fc', { p: [0, 4.2 + i * 2.2, 2.62] }));
      out.push(part(box(4.4, 3.2, 4.4), '#f8fafc', { p: [0, 11.6, 0] }), part(box(2.6, 2.4, 4.6), '#6b7280', { p: [0, 11.5, 0] }), part(box(4.6, 2.4, 2.6), '#6b7280', { p: [0, 11.5, 0] }));
      out.push(part(sph(0.9, 10, 8), '#facc15', { p: [0, 11.4, 0] }), part(cone(3.6, 4.5, 4), '#8b5cf6', { p: [0, 15.4, 0], r: [0, Math.PI / 4, 0] }), part(cyl(0.08, 0.08, 1.6, 5), '#475569', { p: [0, 18.3, 0] }), part(sph(0.35, 8, 6), '#ef4444', { p: [0, 19.2, 0] }));
      out.push(part(cyl(1.1, 1.1, 0.1, 16), '#ffffff', { p: [0, 8.7, 2.62], r: [Math.PI / 2, 0, 0] }), part(box(0.08, 0.8, 0.04), '#1e293b', { p: [0, 8.9, 2.7] }), part(box(0.6, 0.08, 0.04), '#1e293b', { p: [0.25, 8.7, 2.7] }));
    }
    return out;
  },
  lighthouse: () => {
    const out = [part(cyl(4.0, 4.2, 0.8, 14), '#94a3b8', { p: [0, 0.4, 0] })];
    for (let i = 0; i < 6; i++) out.push(part(cyl(2.6 - (i + 1) * 0.22, 2.6 - i * 0.22, 2.4, 14), i % 2 ? '#ef4444' : '#f8fafc', { p: [0, 2.0 + i * 2.4, 0] }));
    out.push(part(cyl(1.8, 1.8, 0.3, 14), '#334155', { p: [0, 15.3, 0] }), part(cyl(1.15, 1.15, 1.6, 12), '#fde68a', { p: [0, 16.2, 0] }), part(cone(1.5, 1.4, 12), '#ef4444', { p: [0, 17.7, 0] }), part(sph(0.25, 6, 4), '#facc15', { p: [0, 18.5, 0] }));
    out.push(part(box(1.2, 2.0, 0.1), '#7c4a1e', { p: [0, 1.8, 2.5] }));
    return out;
  },
};

/** Geometry for (kind, variant); the caller owns it. */
export function kindGeometry(kind, variant = 0) {
  const build = BUILD[kind];
  if (!build) throw new Error(`unknown kind ${kind}`);
  return merge(build(variant));
}

/** Height of a kind (for the swallow arc and the shadow). */
export function kindHeight(geo) {
  geo.computeBoundingBox();
  return geo.boundingBox.max.y;
}

/* ---------------- Powerups ---------------- */

export function powerupGeometry(type) {
  if (type === 'gold') return merge([part(sph(0.42, 14, 10), '#facc15', { p: [0, 0, 0] }), part(sph(0.12, 6, 4), '#fde68a', { p: [-0.15, 0.18, 0.3] }), part(cone(0.16, 0.3, 5), '#16a34a', { p: [0, 0.5, 0] }), part(sph(0.14, 6, 4), '#22c55e', { p: [0.18, 0.48, 0], s: [1.6, 0.4, 0.9] })]);
  if (type === 'speed')
    return merge([
      part(box(0.5, 0.36, 0.9), '#ef4444', { p: [0, 0.05, 0] }),
      part(sph(0.28, 10, 8), '#ef4444', { p: [0, 0.1, 0.38], s: [0.9, 0.65, 0.8] }),
      part(box(0.55, 0.14, 1.15), '#f8fafc', { p: [0, -0.18, 0.08] }),
      part(box(0.46, 0.5, 0.18), '#ef4444', { p: [0, 0.32, -0.36] }),
      part(box(0.52, 0.06, 0.4), '#facc15', { p: [0, 0.24, 0.05], r: [0, 0, 0] }),
      part(box(0.04, 0.25, 0.5), '#fde047', { p: [0.27, 0.05, -0.05], r: [0, 0, 0] }),
    ]);
  // magnet
  return merge([
    part(new THREE.TorusGeometry(0.38, 0.14, 8, 14, Math.PI), '#ef4444', { p: [0, 0.1, 0], r: [0, 0, Math.PI] }),
    part(cyl(0.14, 0.14, 0.3, 10), '#ef4444', { p: [-0.38, 0.25, 0] }),
    part(cyl(0.14, 0.14, 0.3, 10), '#ef4444', { p: [0.38, 0.25, 0] }),
    part(cyl(0.145, 0.145, 0.18, 10), '#e2e8f0', { p: [-0.38, 0.48, 0] }),
    part(cyl(0.145, 0.145, 0.18, 10), '#e2e8f0', { p: [0.38, 0.48, 0] }),
  ]);
}

/* ---------------- Friendly chibi Pokemon ---------------- */

/** Small 3D chibi Pokemon (Rattata, Pidgey, Wurmple), facing +Z, ~0.8 m tall. Shares geometry via `cache`. */
export function createChibi(species, cache) {
  const geo = (key, make) => {
    if (!cache.geos[key]) cache.geos[key] = make();
    return cache.geos[key];
  };
  const mat = (color) => {
    if (!cache.mats[color]) cache.mats[color] = new THREE.MeshToonMaterial({ color, gradientMap: cache.ramp });
    return cache.mats[color];
  };
  const S = geo('s', () => new THREE.SphereGeometry(1, 16, 12));
  const s = geo('ss', () => new THREE.SphereGeometry(1, 8, 6));
  const C = geo('c', () => new THREE.ConeGeometry(1, 1, 8));
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const add = (g, color, p, sc, r) => {
    const m = new THREE.Mesh(g, mat(color));
    m.position.set(...p);
    m.scale.set(...sc);
    if (r) m.rotation.set(...r);
    body.add(m);
    return m;
  };
  const eyes = (y, z, x, er = 0.07, iris = '#1e1b2e') => {
    for (const sx of [-1, 1]) {
      add(s, '#ffffff', [sx * x, y, z], [er, er * 1.2, er * 0.6]);
      add(s, iris, [sx * x, y - 0.005, z + er * 0.4], [er * 0.6, er * 0.8, er * 0.3]);
      add(s, '#ffffff', [sx * x + sx * 0.012, y + er * 0.35, z + er * 0.6], [er * 0.25, er * 0.25, er * 0.12]);
    }
  };
  const parts = {};
  if (species === 'rattata') {
    add(S, '#9a6cc0', [0, 0.36, 0], [0.34, 0.3, 0.42]);
    add(S, '#f3e2c0', [0, 0.3, 0.16], [0.24, 0.2, 0.28]);
    add(S, '#9a6cc0', [0, 0.6, 0.26], [0.27, 0.25, 0.25]);
    add(S, '#f3e2c0', [0, 0.54, 0.43], [0.15, 0.11, 0.11]);
    add(s, '#c0507f', [0, 0.59, 0.53], [0.04, 0.03, 0.03]);
    add(s, '#ffffff', [-0.03, 0.47, 0.5], [0.03, 0.05, 0.015]);
    add(s, '#ffffff', [0.03, 0.47, 0.5], [0.03, 0.05, 0.015]);
    eyes(0.67, 0.44, 0.1, 0.07, '#b91c1c');
    for (const sx of [-1, 1]) {
      add(S, '#9a6cc0', [sx * 0.2, 0.86, 0.18], [0.16, 0.18, 0.05], [0, sx * -0.3, sx * -0.3]);
      add(S, '#f4b3c8', [sx * 0.2, 0.86, 0.2], [0.1, 0.12, 0.02], [0, sx * -0.3, sx * -0.3]);
      add(s, '#f3e2c0', [sx * 0.14, 0.08, 0.2], [0.07, 0.06, 0.1]);
      add(s, '#f3e2c0', [sx * 0.16, 0.08, -0.22], [0.08, 0.06, 0.12]);
    }
    const tail = new THREE.Mesh(geo('rtail', () => new THREE.TorusGeometry(0.16, 0.025, 5, 12, Math.PI * 1.6)), mat('#9a6cc0'));
    tail.position.set(0, 0.42, -0.5);
    tail.rotation.set(0, Math.PI / 2, 0);
    body.add(tail);
    parts.wag = tail;
  } else if (species === 'pidgey') {
    add(S, '#b07a4a', [0, 0.4, 0], [0.34, 0.34, 0.36]);
    add(S, '#f2dfbb', [0, 0.34, 0.15], [0.26, 0.26, 0.24]);
    add(S, '#b07a4a', [0, 0.72, 0.12], [0.24, 0.22, 0.23]);
    add(S, '#f2dfbb', [0, 0.68, 0.24], [0.17, 0.13, 0.12]);
    add(C, '#4b5563', [0, 0.7, 0.4], [0.06, 0.12, 0.06], [Math.PI / 2, 0, 0]);
    eyes(0.78, 0.31, 0.1, 0.055);
    add(C, '#b07a4a', [0, 0.98, 0.08], [0.08, 0.22, 0.08], [-0.6, 0, 0]);
    add(C, '#e07a5a', [0.0, 0.95, 0.15], [0.05, 0.16, 0.05], [-0.3, 0, 0]);
    const wings = [];
    for (const sx of [-1, 1]) {
      const w = add(S, '#9a6a3e', [sx * 0.32, 0.42, -0.04], [0.08, 0.2, 0.26], [0, 0, sx * 0.25]);
      wings.push(w);
      add(s, '#f4a3a3', [sx * 0.12, 0.05, 0.1], [0.05, 0.05, 0.1]);
    }
    add(S, '#7a4f2a', [0, 0.36, -0.36], [0.16, 0.06, 0.16], [0.4, 0, 0]);
    parts.wings = wings;
  } else {
    // wurmple
    const seg = [
      [0, 0.22, -0.36, 0.2],
      [0, 0.25, -0.12, 0.22],
      [0, 0.3, 0.12, 0.23],
    ];
    seg.forEach(([x, y, z, r], i) => {
      add(S, '#e2435a', [x, y, z], [r, r, r * 0.95]);
      add(s, '#f6e7b0', [x, y - r * 0.55, z + 0.02], [r * 0.7, r * 0.35, r * 0.6]);
      if (i < 2) add(s, '#f6e7b0', [r * 0.9, y + 0.02, z], [0.04, 0.04, 0.04]);
      if (i < 2) add(s, '#f6e7b0', [-r * 0.9, y + 0.02, z], [0.04, 0.04, 0.04]);
    });
    add(S, '#e2435a', [0, 0.48, 0.34], [0.26, 0.24, 0.24]);
    add(S, '#f6e7b0', [0, 0.42, 0.5], [0.15, 0.1, 0.08]);
    eyes(0.53, 0.53, 0.1, 0.05);
    add(C, '#fde047', [0, 0.76, 0.34], [0.05, 0.18, 0.05]);
    add(C, '#f8fafc', [0.12, 0.66, 0.3], [0.035, 0.1, 0.035], [0, 0, -0.4]);
    add(C, '#f8fafc', [-0.12, 0.66, 0.3], [0.035, 0.1, 0.035], [0, 0, 0.4]);
    add(C, '#fde047', [0, 0.36, -0.56], [0.05, 0.2, 0.05], [-1.0, 0, 0]);
    add(C, '#fde047', [0.06, 0.38, -0.55], [0.04, 0.16, 0.04], [-1.0, 0, -0.5]);
  }
  return { group, body, parts, species };
}
