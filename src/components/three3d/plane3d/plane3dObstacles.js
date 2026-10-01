// Obstacle models for "Đua máy bay Pokémon" (procedural, vertex-coloured, toon + outline).
// Origin = the centre of the lane at flying height; the front (towards the plane) faces +Z.
// Things standing on the ground reach down to y = -ALT.
import * as THREE from 'three';
import { part, merge, placeAll, box, rbox, cyl, sph, ico, cone, torus, lathe, slab, roundShape, lumpy, shade, rng, TAU } from './plane3dGeo';

export const ALT = 9; // flying height above the ground (m)

// ---------------------------------------------------------------- small helpers
const eye = (out, x, y, z, r = 0.12, { white = '#ffffff', iris = '#1d1a2b', slit = false, look = [0, 0] } = {}) => {
  out.push(part(sph(r, 10, 7), white, { p: [x, y, z], s: [0.85, 1.1, 0.45] }));
  out.push(part(sph(r * 0.55, 8, 6), iris, { p: [x + look[0] * r * 0.3, y + look[1] * r * 0.3, z + r * 0.3], s: slit ? [0.35, 1.3, 0.4] : [0.95, 1.1, 0.45] }));
  out.push(part(sph(r * 0.18, 6, 4), '#ffffff', { p: [x + r * 0.22, y + r * 0.35, z + r * 0.48], outline: 'none' }));
};
const rope = (out, a, b, r = 0.025, color = '#6b4a2e') => {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  const len = A.distanceTo(B);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  out.push(part(cyl(r, r, len, 5), color, { p: [mid.x, mid.y, mid.z], r: [e.x, e.y, e.z], outline: 'none' }));
};
const wicker = (light, dark) => (tri, pos, i, c) => ((Math.floor(c.y * 9) + Math.floor((Math.atan2(c.z, c.x) + 4) * 4)) % 2 ? light : dark);

function basket(out, y, w, { color = '#c58a4a', rim = '#7a4a22' } = {}) {
  out.push(part(rbox(w, w * 0.62, w, 0.08), wicker(color, shade(color, 0.85)), { p: [0, y, 0] }));
  out.push(part(rbox(w + 0.12, 0.12, w + 0.12, 0.05), rim, { p: [0, y + w * 0.31, 0] }));
  out.push(part(rbox(w + 0.06, 0.08, w + 0.06, 0.03), rim, { p: [0, y - w * 0.3, 0] }));
}

// ---------------------------------------------------------------- balloons
function meowthBalloon() {
  const o = [];
  const cream = '#f6e6b4';
  const brown = '#3a2a24';
  o.push(part(sph(1.12, 22, 14), (tri, pos, i, c) => (c.y < -0.2 && c.z > 0.6 ? '#fff4d6' : cream), { p: [0, 0.55, 0], s: [1.1, 0.95, 1] }));
  // ears: dark outside, warm inside
  for (const sx of [-1, 1]) {
    o.push(part(cone(0.42, 0.85, 14), brown, { p: [sx * 0.72, 1.42, -0.05], r: [0, 0, -sx * 0.5] }));
    o.push(part(cone(0.26, 0.55, 12), '#c9805c', { p: [sx * 0.7, 1.38, 0.12], r: [0, 0, -sx * 0.5], outline: 'none' }));
  }
  // golden charm on the forehead
  o.push(part(cyl(0.28, 0.28, 0.1, 22), '#ffd54a', { p: [0, 1.15, 0.86], r: [Math.PI / 2 - 0.35, 0, 0], glow: 0.25 }));
  o.push(part(cyl(0.16, 0.16, 0.12, 6), '#e0a92a', { p: [0, 1.15, 0.9], r: [Math.PI / 2 - 0.35, 0, 0], outline: 'none' }));
  eye(o, -0.4, 0.66, 0.92, 0.23, { slit: true });
  eye(o, 0.4, 0.66, 0.92, 0.23, { slit: true });
  o.push(part(sph(0.08, 10, 8), '#f08aa0', { p: [0, 0.42, 1.12] }));
  o.push(part(torus(0.2, 0.035, 6, 14, Math.PI), brown, { p: [-0.12, 0.33, 1.07], r: [0, 0, Math.PI], outline: 'none' }));
  o.push(part(torus(0.2, 0.035, 6, 14, Math.PI), brown, { p: [0.12, 0.33, 1.07], r: [0, 0, Math.PI], outline: 'none' }));
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) o.push(part(cyl(0.022, 0.012, 0.8, 5), brown, { p: [sx * 0.95, 0.5 - k * 0.12, 0.72], r: [0, sx * 0.35, Math.PI / 2 + sx * (k - 1) * 0.18], outline: 'none' }));
  // ropes and the Team Rocket basket with a red "R"
  for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) rope(o, [x * 1.1, -0.35, z * 1.1], [x * 0.85, -1.38, z * 0.85]);
  basket(o, -1.62, 0.95);
  o.push(part(rbox(0.56, 0.44, 0.06, 0.04), '#ffffff', { p: [0, -1.64, 0.5] }));
  const R = '#e11d48';
  o.push(part(box(0.08, 0.32, 0.05), R, { p: [-0.1, -1.64, 0.54], outline: 'none' }));
  o.push(part(torus(0.08, 0.035, 6, 12, Math.PI), R, { p: [-0.06, -1.56, 0.54], r: [0, 0, -Math.PI / 2], outline: 'none' }));
  o.push(part(box(0.06, 0.18, 0.05), R, { p: [0.03, -1.72, 0.54], r: [0, 0, 0.6], outline: 'none' }));
  return merge(o);
}

const HOTAIR = [
  ['#ff5a5f', '#ffd166', '#ffffff'],
  ['#4cc9f0', '#ffffff', '#f72585'],
  ['#7bd389', '#fff3b0', '#ff9f1c'],
];
function hotAirBalloon(variant = 0) {
  const [a, b, band] = HOTAIR[variant % HOTAIR.length];
  const o = [];
  const prof = [[0.34, -1.55], [0.55, -1.2], [0.95, -0.6], [1.25, 0.1], [1.32, 0.7], [1.18, 1.25], [0.82, 1.62], [0.36, 1.84], [0, 1.88]];
  o.push(
    part(lathe(prof, 32), (tri, pos, i, c) => {
      if (c.y > -0.78 && c.y < -0.52) return band;
      const ang = (Math.atan2(c.z, c.x) + TAU) % TAU;
      return Math.floor((ang / TAU) * 12) % 2 ? a : b;
    }, { p: [0, 0.35, 0] })
  );
  o.push(part(torus(0.36, 0.05, 6, 20), shade(a, 0.7), { p: [0, -1.2, 0], r: [Math.PI / 2, 0, 0] }));
  // burner glow
  o.push(part(cyl(0.16, 0.2, 0.22, 10), '#5b5566', { p: [0, -1.6, 0] }));
  o.push(part(cone(0.14, 0.4, 10), '#ffb347', { p: [0, -1.35, 0], glow: 0.8, flicker: 0.6, outline: 'none' }));
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) rope(o, [x, -1.25, z], [x * 1.2, -1.95, z * 1.2]);
  basket(o, -2.2, 0.72);
  return merge(o);
}

// ---------------------------------------------------------------- storm cloud
function stormCloud() {
  const o = [];
  const R = rng(5);
  const puffs = [[0, 0.3, 0.1, 1.0], [-0.95, 0.05, 0, 0.78], [0.95, 0.12, -0.05, 0.8], [0.35, 0.95, 0, 0.72], [-0.45, 0.85, -0.2, 0.66], [0, 0.2, -0.8, 0.85], [-0.5, -0.35, 0.35, 0.6], [0.55, -0.32, 0.35, 0.58]];
  for (const [x, y, z, r] of puffs) {
    o.push(
      part(sph(r, 14, 10), (tri, pos, i, c) => (c.y > 0.7 ? '#9a94b8' : c.y > 0.0 ? '#77709a' : '#544d74'), { p: [x, y, z], s: [1, 0.9 + R() * 0.1, 1] })
    );
  }
  // grumpy face
  for (const sx of [-1, 1]) {
    eye(o, sx * 0.32, 0.42, 0.98, 0.16, { look: [-sx * 0.3, -0.3] });
    o.push(part(rbox(0.32, 0.07, 0.06, 0.02), '#2a2440', { p: [sx * 0.32, 0.66, 1.04], r: [0, 0, sx * 0.4], outline: 'none' }));
  }
  o.push(part(torus(0.13, 0.03, 6, 12, Math.PI), '#2a2440', { p: [0, 0.12, 1.05], outline: 'none' }));
  // lightning bolts (flickering)
  const bolt = [[0, 0], [0.32, 0], [0.12, -0.55], [0.36, -0.55], [-0.1, -1.4], [0.02, -0.75], [-0.2, -0.75]];
  o.push(part(slab(bolt, 0.08, 0.03, 1), '#ffe14d', { p: [-0.4, -0.45, 0.5], s: [1.1, 1.3, 1], glow: 0.7, flicker: 1 }));
  o.push(part(slab(bolt, 0.08, 0.03, 1), '#fff27a', { p: [0.5, -0.35, 0.2], s: [-0.8, 1.0, 1], glow: 0.7, flicker: 1 }));
  return merge(o);
}

// ---------------------------------------------------------------- birds
const BIRDS = {
  pidgey: { body: '#b8834f', belly: '#f4dcae', wing: '#a5703f', tip: '#f4dcae', beak: '#d9a3a0', crest: '#e3a07a', tail: '#8a5a33' },
  spearow: { body: '#9c6b45', belly: '#f2d2a6', wing: '#c4553a', tip: '#7a3a24', beak: '#f2c7a5', crest: '#c4553a', tail: '#6e4429' },
};
function bird(out, kind, at, s) {
  const C = BIRDS[kind];
  const P = [];
  P.push(part(sph(0.34, 12, 9), (tri, pos, i, c) => (c.z > 0.08 && c.y < 0.08 ? C.belly : C.body), { s: [1, 0.92, 1.15] }));
  P.push(part(sph(0.25, 12, 9), (tri, pos, i, c) => (c.z > 0.42 && c.y < 0.36 ? C.belly : C.body), { p: [0, 0.3, 0.26] }));
  P.push(part(cone(0.07, 0.2, 8), C.beak, { p: [0, 0.27, kind === 'spearow' ? 0.58 : 0.53], r: [Math.PI / 2, 0, 0], s: [1, kind === 'spearow' ? 1.5 : 1, 1] }));
  for (const sx of [-1, 1]) {
    eye(P, sx * 0.12, 0.36, 0.44, 0.075, { look: [0, 0] });
    if (kind === 'pidgey') P.push(part(cone(0.05, 0.16, 6), '#1d1a2b', { p: [sx * 0.2, 0.36, 0.38], r: [0, 0, sx * 1.4], outline: 'none' }));
    else P.push(part(box(0.14, 0.03, 0.03), '#1d1a2b', { p: [sx * 0.12, 0.46, 0.47], r: [0, 0, sx * 0.5], outline: 'none' }));
    // wings: flattened ellipsoids that flap at the tips
    P.push(
      part(sph(0.32, 10, 6), (tri, pos, i, c) => (Math.abs(c.x) > 0.75 ? C.tip : C.wing), {
        p: [sx * 0.5, 0.08, -0.02],
        s: [1.65, 0.16, 0.78],
        r: [0, 0, sx * 0.1],
        flap: (x) => Math.max(0, (sx * x + 0.32) / 0.64) * 0.32,
      })
    );
  }
  for (let k = -1; k <= 1; k++) P.push(part(cone(0.1, 0.42, 6), C.tail, { p: [k * 0.1, 0.02, -0.42], r: [-Math.PI / 2 + 0.25, 0, k * 0.3], s: [1, 1, 0.35] }));
  for (let k = -1; k <= 1; k++) P.push(part(cone(0.05, 0.22, 6), C.crest, { p: [k * 0.05, 0.56, 0.16 - Math.abs(k) * 0.04], r: [-0.6, 0, k * 0.35] }));
  out.push(...placeAll(P, { p: at, s }));
}
function zubat(out, at, s) {
  const P = [];
  const blue = '#5b8fd9';
  const purple = '#8a6fd8';
  const inner = '#c39bf0';
  P.push(part(sph(0.3, 12, 9), blue, { s: [1, 1.1, 0.9] }));
  for (const sx of [-1, 1]) {
    P.push(part(cone(0.13, 0.5, 10), blue, { p: [sx * 0.15, 0.42, 0], r: [0, 0, -sx * 0.25] }));
    P.push(part(cone(0.07, 0.32, 8), inner, { p: [sx * 0.15, 0.4, 0.06], r: [0, 0, -sx * 0.25], outline: 'none' }));
    const wing = roundShape([[0.0, 0.1], [0.5, 0.32], [0.95, 0.2], [0.85, -0.05], [0.68, -0.22], [0.5, -0.08], [0.3, -0.24], [0.12, -0.08]], 40).map(([x, y]) => [x * sx, y]);
    P.push(part(slab(wing, 0.05, 0.02, 1).rotateX(-Math.PI / 2 + 0.15), (tri, pos, i, c) => (c.y < -0.01 ? inner : purple), { p: [sx * 0.16, 0.05, 0], flap: (x) => Math.min(0.42, Math.abs(x) * 0.42) }));
    P.push(part(cyl(0.025, 0.015, 0.5, 5), blue, { p: [sx * 0.1, -0.5, -0.1], r: [0.3, 0, 0], outline: 'none' }));
  }
  // open mouth with fangs (Zubat has no eyes)
  P.push(part(sph(0.15, 12, 8), '#3b1f4a', { p: [0, -0.04, 0.24], s: [1.1, 0.9, 0.4], outline: 'none' }));
  for (const sx of [-1, 1]) P.push(part(cone(0.03, 0.08, 5), '#ffffff', { p: [sx * 0.07, 0.06, 0.29], r: [Math.PI, 0, 0], outline: 'none' }));
  out.push(...placeAll(P, { p: at, s }));
}
function flock(kind) {
  const o = [];
  const spots = [[0, 0.45, 0.6, 1.25], [-0.9, -0.25, -0.35, 1.1], [0.9, -0.05, -0.55, 1.1]];
  for (const [x, y, z, s] of spots) {
    if (kind === 'zubat') zubat(o, [x, y, z], s);
    else bird(o, kind, [x, y, z], s);
  }
  return merge(o);
}

// ---------------------------------------------------------------- floating rocks
const ROCKS = {
  grass: { top: '#7cc95a', top2: '#5fb04a', rock: ['#a77a52', '#8b6141', '#6e4b33'] },
  tropic: { top: '#f2d79a', top2: '#7cc95a', rock: ['#b38a63', '#93694a', '#6d4b35'] },
  sand: { top: '#f0c27b', top2: '#e3a85c', rock: ['#d98b52', '#c06a3c', '#9c4f2e'] },
  sunset: { top: '#a8e07a', top2: '#ff9fb8', rock: ['#b5869a', '#93667e', '#714b61'] },
  cave: { top: '#5b4a78', top2: '#c084fc', rock: ['#6b5a86', '#54456d', '#3f3354'] },
  asteroid: { top: '#8b8794', top2: '#6e6a78', rock: ['#9a95a3', '#7a7584', '#5d5967'] },
};
function floatingRock(theme = 'grass') {
  const T = ROCKS[theme] || ROCKS.grass;
  const o = [];
  const R = rng(theme.length * 13);
  if (theme === 'asteroid') {
    o.push(part(lumpy(ico(1.2, 2), 0.16, 3.3, 1.7), (tri, pos, i, c) => (Math.sin(c.x * 3.1) * Math.sin(c.y * 2.7 + c.z * 2) > 0.45 ? T.rock[2] : c.y > 0.3 ? T.rock[0] : T.rock[1]), { s: [1.1, 0.95, 1] }));
    for (const [x, y, z, r] of [[0.5, 0.6, 0.85, 0.28], [-0.55, -0.2, 0.95, 0.22], [0.2, -0.6, 0.9, 0.18]]) o.push(part(cyl(r, r * 0.7, 0.12, 12), T.rock[2], { p: [x, y, z], r: [Math.PI / 2 - 0.4, 0, 0], outline: 'none' }));
    o.push(part(lumpy(ico(0.35, 1), 0.15, 7.7), T.rock[1], { p: [1.45, 0.75, -0.3] }));
    return merge(o);
  }
  if (theme === 'cave') {
    // a stalactite hanging from the cave roof down into the lane
    o.push(part(lumpy(cone(1.15, 7, 9), 0.08, 2.1, 1.2), (tri, pos, i, c) => (Math.floor(c.y * 1.5) % 2 ? T.rock[0] : T.rock[1]), { p: [0, 2.5, 0], r: [Math.PI, 0, 0] }));
    o.push(part(lumpy(cone(0.5, 3.5, 7), 0.08, 4.4), T.rock[2], { p: [0.75, 3.8, -0.4], r: [Math.PI, 0, 0.1] }));
    for (const [x, y, z, r] of [[-0.4, 0.4, 0.6, 0.3], [0.3, -0.2, 0.55, 0.22], [-0.2, 1.6, 0.8, 0.26]]) o.push(part(cone(r * 0.6, r * 2.4, 6), '#e879f9', { p: [x, y, z], r: [0.9, 0, 0.3], glow: 0.7 }));
    return merge(o);
  }
  // body: a chunky rock with strata, a pointed root below and two pebbles floating beside it
  const strata = (tri, pos, i, c) => T.rock[Math.min(2, Math.max(0, Math.floor((0.35 - c.y) / 0.55)))];
  o.push(part(lumpy(ico(1.3, 1), 0.12, 1.7, 1.6), strata, { p: [0, -0.15, 0], s: [1.08, 0.62, 1.05] }));
  o.push(part(lumpy(cone(0.95, 1.7, 8), 0.1, 2.3, 1.8), strata, { p: [0.1, -1.25, 0.05], r: [Math.PI, 0.4, 0.08] }));
  o.push(part(lumpy(ico(0.32, 1), 0.15, 3.1), T.rock[1], { p: [1.45, -0.7, 0.3] }));
  o.push(part(lumpy(ico(0.22, 0), 0.15, 5.1), T.rock[2], { p: [-1.35, -1.0, -0.2] }));
  o.push(part(lumpy(cyl(1.38, 1.3, 0.32, 14), 0.05, 2.9, 2), (tri, pos, i, c) => (c.y > 0.6 ? T.top : T.top2), { p: [0, 0.48, 0] }));
  // little things on top
  if (theme === 'tropic') {
    const trunk = [];
    for (let k = 0; k < 6; k++) trunk.push(part(cyl(0.08, 0.1, 0.32, 7), k % 2 ? '#9a6b3e' : '#b5834f', { p: [0.3 + k * 0.04, 0.85 + k * 0.29, 0], r: [0, 0, -0.12] }));
    o.push(...trunk);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      o.push(part(sph(0.5, 10, 6), '#3fae5a', { p: [0.55 + Math.cos(a) * 0.45, 2.55, Math.sin(a) * 0.45], s: [1.2, 0.14, 0.4], r: [0, -a, -0.35], flap: 0.04 }));
    }
    o.push(part(sph(0.12, 8, 6), '#8a5a2b', { p: [0.5, 2.42, 0.12] }));
  } else if (theme === 'sand') {
    o.push(part(cyl(0.14, 0.16, 1.1, 8), '#4f9a4a', { p: [-0.3, 1.25, 0.2] }));
    o.push(part(cyl(0.08, 0.09, 0.45, 8), '#4f9a4a', { p: [-0.05, 1.3, 0.2], r: [0, 0, -1.2] }));
    o.push(part(cyl(0.08, 0.09, 0.4, 8), '#4f9a4a', { p: [0.08, 1.55, 0.2] }));
    o.push(part(sph(0.12, 8, 6), '#ff7aa8', { p: [-0.3, 1.82, 0.2] }));
  } else {
    o.push(part(cyl(0.1, 0.14, 0.7, 7), '#8a5a33', { p: [-0.35, 1.05, -0.1] }));
    o.push(part(ico(0.5, 1), theme === 'sunset' ? '#ff9fb8' : '#4fb35a', { p: [-0.35, 1.55, -0.1], outline: 'radial' }));
    o.push(part(ico(0.36, 1), theme === 'sunset' ? '#ffc2d1' : '#66c46a', { p: [-0.05, 1.75, 0.05], outline: 'radial' }));
    o.push(part(sph(0.2, 10, 6), '#6fca5e', { p: [0.55, 0.85, 0.5] }));
    for (const [x, z, c] of [[0.2, 0.9, '#ff6b8b'], [0.7, 0.2, '#ffe066'], [-0.8, 0.6, '#ffffff']]) o.push(part(sph(0.07, 8, 6), c, { p: [x, 0.8, z], outline: 'none' }));
    if (theme === 'sunset') o.push(part(box(0.32, 2.4, 0.06), '#d8f3ff', { p: [0.9, -0.4, 0.95], glow: 0.35, outline: 'none' }));
  }
  // hanging roots / vines
  for (let k = 0; k < 4; k++) o.push(part(cyl(0.03, 0.015, 0.7 + R() * 0.6, 4), theme === 'sand' ? '#9c6b3e' : '#4f8f3a', { p: [Math.cos(k * 1.7) * 1.0, 0.0, Math.sin(k * 1.7) * 1.0], outline: 'none' }));
  return merge(o);
}

// ---------------------------------------------------------------- ground-standing obstacles
function turbineTower() {
  const o = [];
  o.push(part(cyl(0.15, 0.34, ALT + 0.3, 14), (tri, pos, i, c) => (c.y > -2.0 && c.y < -1.6 ? '#ef4444' : '#f4f6fa'), { p: [0, -ALT / 2 + 0.05, -0.3] }));
  o.push(part(cyl(0.9, 1.0, 0.3, 14), '#c9c5bb', { p: [0, -ALT + 0.1, -0.3] }));
  o.push(part(rbox(0.5, 0.5, 1.1, 0.18), '#f4f6fa', { p: [0, 0.3, -0.25] }));
  o.push(part(sph(0.08, 8, 6), '#ef4444', { p: [0, 0.6, -0.6], glow: 0.6, flicker: 0.8 }));
  return merge(o);
}
function turbineBlades() {
  const o = [];
  o.push(part(cone(0.22, 0.4, 14), '#ffffff', { r: [Math.PI / 2, 0, 0], p: [0, 0, 0.15] }));
  for (let k = 0; k < 3; k++) {
    const blade = roundShape([[-0.1, 0.15], [0.12, 0.15], [0.14, 0.7], [0.06, 1.42], [-0.04, 1.45], [-0.12, 0.6]], 24);
    o.push(part(slab(blade, 0.05, 0.02, 1), (tri, pos, i, c) => (Math.hypot(c.x, c.y) > 1.15 ? '#ef4444' : '#f4f6fa'), { r: [0, 0.2, (k / 3) * TAU], order: 'ZYX' }));
  }
  return merge(o);
}

function prism(out, { x = 0, z = 0, y0 = -ALT, h, r, tip = 0.8, tilt = [0, 0], color, tipColor, glow = 0, seg = 6 }) {
  const P = [];
  P.push(part(cyl(r * 0.95, r, h, seg), color, { p: [0, h / 2, 0], glow }));
  P.push(part(cone(r * 0.95, r * tip * 2, seg), tipColor || color, { p: [0, h + r * tip, 0], glow: glow * 1.2 }));
  out.push(...placeAll(P, { p: [x, y0, z], r: [tilt[0], 0, tilt[1]] }));
}
function iceSpikes() {
  const o = [];
  o.push(part(lumpy(ico(1.6, 2), 0.1, 2.2), (tri, pos, i, c) => (c.y > -ALT + 0.6 ? '#ffffff' : '#dff4ff'), { p: [0, -ALT, 0], s: [1.1, 0.7, 1.1] }));
  prism(o, { h: ALT + 1.6, r: 0.62, tip: 1.0, color: '#a5e4f7', tipColor: '#e8fbff', glow: 0.12 });
  prism(o, { x: -0.75, z: 0.35, h: ALT - 0.4, r: 0.42, tilt: [0.1, 0.12], color: '#7fd0ef', tipColor: '#d6f6ff', glow: 0.1 });
  prism(o, { x: 0.8, z: -0.2, h: ALT + 0.2, r: 0.45, tilt: [-0.05, -0.14], color: '#bdeeff', tipColor: '#ffffff', glow: 0.12 });
  prism(o, { x: 0.25, z: 0.75, h: ALT - 1.6, r: 0.35, tilt: [0.2, -0.05], color: '#93dcf5', tipColor: '#ffffff', glow: 0.1 });
  // snow caps on the shoulders
  o.push(part(sph(0.5, 10, 6), '#ffffff', { p: [0, 1.1, 0], s: [1.2, 0.35, 1.2] }));
  return merge(o);
}
function lavaPillar() {
  const o = [];
  const crack = (c) => (Math.abs(Math.sin(c.y * 1.9 + Math.atan2(c.z, c.x) * 0.5)) < 0.22 ? 1.0 : 0);
  const col = (tri, pos, i, c) => (crack(c) ? '#ff7a1a' : Math.floor(c.y * 1.2) % 2 ? '#3b2f36' : '#4a3a40');
  const P = [];
  P.push(part(cyl(0.7, 0.85, ALT + 1.4, 6, 12), col, { p: [0, -ALT / 2 + 0.7, 0], glow: (c) => crack(c), flicker: (c) => crack(c) * 0.8 }));
  P.push(part(cyl(0.45, 0.55, ALT - 1.0, 6, 10), col, { p: [-0.85, -ALT / 2 - 0.5, 0.3], glow: (c) => crack(c), flicker: (c) => crack(c) * 0.8 }));
  P.push(part(cyl(0.42, 0.5, ALT + 0.3, 6, 10), col, { p: [0.8, -ALT / 2 + 0.15, -0.35], glow: (c) => crack(c), flicker: (c) => crack(c) * 0.8 }));
  o.push(...P);
  o.push(part(cyl(0.6, 0.6, 0.1, 6), '#ffb347', { p: [0, 1.42, 0], glow: 1.2, flicker: 0.6, outline: 'none' }));
  o.push(part(cyl(0.36, 0.36, 0.1, 6), '#ffb347', { p: [0.8, 0.47, -0.35], glow: 1.2, flicker: 0.6, outline: 'none' }));
  // lava dripping down the side
  o.push(part(rbox(0.16, 1.4, 0.1, 0.05), '#ff8c1a', { p: [0.3, 0.75, 0.62], glow: 1, flicker: 0.5, outline: 'none' }));
  o.push(part(lumpy(ico(1.4, 1), 0.12, 5.5), '#2e252b', { p: [0, -ALT, 0], s: [1.2, 0.5, 1.2] }));
  return merge(o);
}
function crystalCluster() {
  const o = [];
  o.push(part(lumpy(ico(1.5, 2), 0.12, 6.1), '#3f3354', { p: [0, -ALT, 0], s: [1.1, 0.6, 1.1] }));
  prism(o, { h: ALT + 1.3, r: 0.6, tip: 1.3, color: '#e879f9', tipColor: '#fbcfe8', glow: 0.55 });
  prism(o, { x: -0.75, z: 0.3, h: ALT - 0.6, r: 0.4, tilt: [0.15, 0.2], color: '#67e8f9', tipColor: '#e0fbff', glow: 0.6 });
  prism(o, { x: 0.78, z: -0.1, h: ALT + 0.1, r: 0.42, tilt: [-0.1, -0.18], color: '#a78bfa', tipColor: '#ede9fe', glow: 0.55 });
  prism(o, { x: 0.2, z: 0.8, h: ALT - 2.2, r: 0.3, tilt: [0.3, -0.1], color: '#f0abfc', tipColor: '#ffffff', glow: 0.6 });
  return merge(o);
}

// ---------------------------------------------------------------- space
function satellite() {
  const o = [];
  o.push(part(rbox(0.8, 0.8, 1.0, 0.08), (tri, pos, i, c) => (Math.floor(c.x * 6 + 10) % 2 ? '#f2c14e' : '#e0a93a'), {}));
  o.push(part(rbox(0.86, 0.12, 1.06, 0.04), '#c8ccd8', { p: [0, 0.4, 0] }));
  for (const sx of [-1, 1]) {
    o.push(part(cyl(0.04, 0.04, 0.3, 6), '#c8ccd8', { p: [sx * 0.55, 0, 0], r: [0, 0, Math.PI / 2] }));
    o.push(
      part(box(0.9, 0.05, 0.62), (tri, pos, i, c) => {
        const u = Math.abs(c.x) * 5;
        const v = (c.z + 1) * 6;
        return u % 1 < 0.12 || v % 1 < 0.12 ? '#9cc3ff' : '#1f3c88';
      }, { p: [sx * 1.1, 0, 0], glow: 0.15 })
    );
  }
  o.push(part(lathe([[0.0, 0.0], [0.28, 0.06], [0.42, 0.18], [0.44, 0.2]], 18), '#f4f6fa', { p: [0, 0.55, 0.15], r: [-0.6, 0, 0] }));
  o.push(part(cyl(0.02, 0.02, 0.5, 5), '#c8ccd8', { p: [0, 0.75, 0.35], r: [-0.6, 0, 0], outline: 'none' }));
  o.push(part(sph(0.06, 8, 6), '#ff4d6d', { p: [0, 1.0, 0.5], glow: 0.8, flicker: 1 }));
  return merge(o);
}
function meteor() {
  const o = [];
  const hot = (c) => (Math.sin(c.x * 4.1 + c.y * 1.3) * Math.sin(c.y * 3.7 - c.z * 2.2) > 0.42 ? 1 : 0);
  o.push(part(lumpy(ico(1.05, 2), 0.18, 4.4, 1.9), (tri, pos, i, c) => (hot(c) ? '#ff8a2a' : c.y > 0.3 ? '#6a5a54' : '#4f433f'), { glow: (c) => hot(c) * 1.1, flicker: (c) => hot(c) * 0.6 }));
  for (const [x, y, z] of [[1.0, 0.5, -0.6], [-0.9, -0.6, -0.8]]) o.push(part(lumpy(ico(0.28, 1), 0.2, x * 9), '#5a4c47', { p: [x, y, z] }));
  return merge(o);
}

/** All obstacle models: { geo, blades?, bladesAt?, trail?, embers? } per kind (and variant). */
export function obstacleModel(kind, theme) {
  switch (kind) {
    case 'balloon':
      return { geo: meowthBalloon(), bob: 0.25 };
    case 'hotair':
      return { geo: hotAirBalloon(theme | 0), bob: 0.2 };
    case 'storm':
      return { geo: stormCloud(), bob: 0.12, lightning: true };
    case 'pidgey':
    case 'spearow':
    case 'zubat':
      return { geo: flock(kind), bob: 0.35 };
    case 'rock':
      return { geo: floatingRock(theme), bob: theme === 'cave' ? 0 : 0.18, spinY: theme === 'asteroid' ? 0.4 : 0 };
    case 'turbine':
      return { geo: turbineTower(), blades: turbineBlades(), bladesAt: [0, 0.3, 0.38] };
    case 'ice':
      return { geo: iceSpikes() };
    case 'lava':
      return { geo: lavaPillar(), embers: true };
    case 'crystal':
      return { geo: crystalCluster(), sparkle: true };
    case 'satellite':
      return { geo: satellite(), bob: 0.15, spinZ: 0.25 };
    case 'meteor':
      return { geo: meteor(), trail: true, tumble: 0.8 };
    default:
      return { geo: floatingRock('grass') };
  }
}
