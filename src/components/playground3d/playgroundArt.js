// Procedural art for the 3D playground (no downloads): floating island, decorations per
// diorama, Poké Ball, bushes, toy ball, berries, the particle sprite atlas and shaders.
// Decorations are merged per kind into one geometry with vertex colours and drawn instanced,
// so a whole diorama costs only a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry } from '../../utils/playground3d/activities';

const TAU = Math.PI * 2;
const col = (c) => new THREE.Color(c);

/** Paints a geometry with one colour (vertex colours) after applying a matrix. */
function paint(geo, color, matrix) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (matrix) g.applyMatrix4(matrix);
  const c = col(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const M4 = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function merged(parts) {
  const g = mergeGeometries(parts.map(([geo, color, m]) => paint(geo, color, m)));
  parts.forEach(([geo]) => geo.dispose());
  g.computeBoundingSphere();
  return g;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------------ island
/** Value noise on a circle (smooth, seeded). */
function ringNoise(rnd, n = 24) {
  const v = Array.from({ length: n }, () => rnd());
  return (a) => {
    const x = ((a / TAU) % 1 + 1) % 1 * n;
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    return v[i % n] * (1 - s) + v[(i + 1) % n] * s;
  };
}

/**
 * Floating island: a flat top (radius R) with a soft lip, and a rocky underside cone.
 * Returns { top, under } geometries (vertex colours).
 */
export function islandGeometries(theme, { R = 2.2, seed = 1 } = {}) {
  const rnd = mulberry(seed);
  const noise = ringNoise(rnd, 20);
  const noise2 = ringNoise(rnd, 9);
  // Top: rings × segments
  const RINGS = 9;
  const SEG = 56;
  const pos = [];
  const colr = [];
  const idx = [];
  const cTop = col(theme.top);
  const cTop2 = col(theme.top2);
  const tmp = new THREE.Color();
  pos.push(0, 0, 0);
  colr.push(cTop.r, cTop.g, cTop.b);
  for (let r = 1; r <= RINGS; r++) {
    const k = r / RINGS;
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * TAU;
      const rr = R * k * (0.94 + 0.08 * noise(a));
      const lip = k > 0.86 ? -(k - 0.86) * 0.9 : 0;
      const y = lip + (k < 0.86 ? (noise2(a * 3 + k * 5) - 0.5) * 0.04 * k : 0);
      pos.push(Math.sin(a) * rr, y, Math.cos(a) * rr);
      tmp.copy(cTop).lerp(cTop2, Math.max(0, Math.min(1, noise2(a * 2 + k * 7) * 1.3 - 0.15)));
      if (k > 0.9) tmp.lerp(col(theme.side), 0.35);
      colr.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let s = 0; s < SEG; s++) idx.push(0, 1 + s, 1 + ((s + 1) % SEG));
  for (let r = 1; r < RINGS; r++) {
    const a0 = 1 + (r - 1) * SEG;
    const a1 = 1 + r * SEG;
    for (let s = 0; s < SEG; s++) {
      const s1 = (s + 1) % SEG;
      idx.push(a0 + s, a1 + s, a1 + s1, a0 + s, a1 + s1, a0 + s1);
    }
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  top.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  top.setIndex(idx);
  top.computeVertexNormals();

  // Underside: profile from the rim down to a point, jagged, flat-shaded
  const profile = [
    [1.0, -0.12], [1.02, -0.3], [0.9, -0.6], [0.72, -0.95], [0.5, -1.35], [0.28, -1.75], [0.08, -2.1], [0, -2.25],
  ];
  const LS = 28;
  const up = [];
  const uc = [];
  const ui = [];
  const cS = col(theme.side);
  const cS2 = col(theme.side2);
  for (let p = 0; p < profile.length; p++) {
    const [pr, py] = profile[p];
    for (let s = 0; s < LS; s++) {
      const a = (s / LS) * TAU + (p % 2) * (Math.PI / LS);
      const jag = p === 0 ? 0.94 + 0.08 * noise(a) : 0.85 + 0.3 * rnd();
      const rr = R * pr * jag;
      up.push(Math.sin(a) * rr, py * (0.9 + 0.2 * (p ? rnd() : 0)) - (p === 0 ? 0.04 : 0), Math.cos(a) * rr);
      tmp.copy(cS).lerp(cS2, p / (profile.length - 1));
      // stripes of soil
      if (p > 0 && rnd() < 0.25) tmp.multiplyScalar(0.88);
      uc.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let p = 0; p < profile.length - 1; p++) {
    for (let s = 0; s < LS; s++) {
      const s1 = (s + 1) % LS;
      const a = p * LS + s;
      const b = p * LS + s1;
      const c = (p + 1) * LS + s;
      const d = (p + 1) * LS + s1;
      ui.push(a, c, b, b, c, d);
    }
  }
  let under = new THREE.BufferGeometry();
  under.setAttribute('position', new THREE.Float32BufferAttribute(up, 3));
  under.setAttribute('color', new THREE.Float32BufferAttribute(uc, 3));
  under.setIndex(ui);
  under = under.toNonIndexed();
  under.computeVertexNormals();
  return { top, under };
}

// ------------------------------------------------------------------ decorations
const G = {
  ball: (d = 10) => new THREE.SphereGeometry(1, d, Math.max(6, Math.round(d * 0.7))),
  cyl: (rt = 1, rb = 1, s = 8) => new THREE.CylinderGeometry(rt, rb, 1, s),
  cone: (s = 8) => new THREE.ConeGeometry(1, 1, s),
  ico: () => new THREE.IcosahedronGeometry(1, 0),
  oct: () => new THREE.OctahedronGeometry(1, 0),
};

/** One decoration kind → { geo (vertex coloured), tall (needs the back), emissive?, tint [] }. */
function decoGeometry(kind, theme) {
  switch (kind) {
    case 'flower':
      return {
        geo: merged([
          [G.cyl(0.012, 0.016, 5), '#3f9a3a', M4(0, 0.09, 0, 1, 0.18, 1)],
          [G.ball(6), '#ffffff', M4(0.035, 0.19, 0, 0.035, 0.022, 0.035)],
          [G.ball(6), '#ffffff', M4(-0.035, 0.19, 0, 0.035, 0.022, 0.035)],
          [G.ball(6), '#ffffff', M4(0, 0.19, 0.035, 0.035, 0.022, 0.035)],
          [G.ball(6), '#ffffff', M4(0, 0.19, -0.035, 0.035, 0.022, 0.035)],
          [G.ball(6), '#ffd84a', M4(0, 0.2, 0, 0.026, 0.022, 0.026)],
          [G.ball(5), '#4fae46', M4(0.04, 0.05, 0, 0.04, 0.012, 0.02, 0, 0, 0.4)],
        ]),
        tint: ['#ff7eb6', '#ffffff', '#ffd23a', '#ff9a5a', '#b48cff', '#7ad7ff'],
        tintPart: true,
      };
    case 'tree':
      return {
        geo: merged([
          [G.cyl(0.06, 0.09, 7), '#8a5a34', M4(0, 0.3, 0, 1, 0.6, 1)],
          [G.ball(10), '#4caf50', M4(0, 0.75, 0, 0.36, 0.32, 0.36)],
          [G.ball(9), '#5cc75c', M4(0.18, 0.62, 0.1, 0.24, 0.22, 0.24)],
          [G.ball(9), '#43a047', M4(-0.17, 0.66, -0.06, 0.25, 0.23, 0.25)],
          [G.ball(8), '#7bd86b', M4(0.05, 0.92, 0.08, 0.18, 0.16, 0.18)],
          [G.ball(6), '#e53935', M4(0.2, 0.72, 0.24, 0.04, 0.04, 0.04)],
          [G.ball(6), '#e53935', M4(-0.22, 0.78, 0.18, 0.04, 0.04, 0.04)],
        ]),
        tall: true,
      };
    case 'pine':
      return {
        geo: merged([
          [G.cyl(0.05, 0.07, 6), '#7a5030', M4(0, 0.12, 0, 1, 0.24, 1)],
          [G.cone(8), '#2e7d5b', M4(0, 0.42, 0, 0.32, 0.46, 0.32)],
          [G.cone(8), '#3a9470', M4(0, 0.66, 0, 0.24, 0.38, 0.24)],
          [G.cone(8), '#f4fbff', M4(0, 0.86, 0, 0.13, 0.2, 0.13)],
          [G.cone(8), '#e8f6ff', M4(0, 0.5, 0, 0.27, 0.12, 0.27)],
        ]),
        tall: true,
      };
    case 'palm': {
      const parts = [];
      for (let i = 0; i < 6; i++) parts.push([G.cyl(0.05, 0.06, 6), i % 2 ? '#a0703e' : '#8a5e33', M4(Math.sin(i * 0.25) * 0.08 * i * 0.3, 0.1 + i * 0.17, 0, 1, 0.18, 1, 0, 0, -0.06 * i)]);
      const tx = 0.12;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        parts.push([G.ball(6), i % 2 ? '#3fa34d' : '#2f8f3f', M4(tx + Math.sin(a) * 0.26, 1.08, Math.cos(a) * 0.26, 0.3, 0.035, 0.09, 0, a + Math.PI / 2, 0.35)]);
      }
      parts.push([G.ball(6), '#7a4a1e', M4(tx, 1.02, 0.05, 0.06, 0.06, 0.06)]);
      parts.push([G.ball(6), '#7a4a1e', M4(tx + 0.06, 1.0, -0.03, 0.06, 0.06, 0.06)]);
      return { geo: merged(parts), tall: true };
    }
    case 'rock':
    case 'boulder':
      return { geo: merged([[G.ico(), '#ffffff', M4(0, 0.08, 0, kind === 'boulder' ? 0.28 : 0.16, kind === 'boulder' ? 0.22 : 0.11, kind === 'boulder' ? 0.24 : 0.14)]]), tint: [theme.side, theme.side2, '#9aa0a6'], flat: true };
    case 'pebble':
      return { geo: merged([[G.ico(), '#ffffff', M4(0, 0.02, 0, 0.06, 0.035, 0.05)]]), tint: [theme.side, theme.top2, '#c8b08a'], flat: true };
    case 'shell':
      return {
        geo: merged([
          [G.cone(7), '#ffd1dc', M4(0, 0.04, 0, 0.07, 0.08, 0.07, Math.PI / 2.4, 0, 0)],
          [G.ball(6), '#ffe9f0', M4(0, 0.03, 0.03, 0.05, 0.03, 0.04)],
        ]),
        tint: ['#ffd1dc', '#fff0c8', '#ffc4a8'],
      };
    case 'crystal':
      return {
        geo: merged([
          [G.oct(), '#ffffff', M4(0, 0.35, 0, 0.12, 0.38, 0.12)],
          [G.oct(), '#ffffff', M4(0.13, 0.2, 0.04, 0.07, 0.22, 0.07, 0, 0, -0.45)],
          [G.oct(), '#ffffff', M4(-0.11, 0.16, -0.03, 0.06, 0.18, 0.06, 0, 0, 0.5)],
        ]),
        tint: theme.glow ? [theme.glow, '#ffffff', '#c9b6ff'] : ['#bff0ff', '#e0fbff', '#9fe3ff'],
        crystal: true,
        tall: true,
      };
    case 'snowball':
      return { geo: merged([[G.ball(10), '#ffffff', M4(0, 0.1, 0, 0.13, 0.12, 0.13)], [G.ball(8), '#ffffff', M4(0.1, 0.06, 0.05, 0.08, 0.07, 0.08)]]), tint: ['#ffffff', '#eaf6ff'] };
    case 'mushroom':
      return {
        geo: merged([
          [G.cyl(0.035, 0.045, 7), '#f4ead8', M4(0, 0.07, 0, 1, 0.14, 1)],
          [G.ball(10), '#ffffff', M4(0, 0.15, 0, 0.12, 0.07, 0.12)],
          [G.ball(5), '#ffffff', M4(0.05, 0.19, 0.05, 0.022, 0.012, 0.022)],
          [G.ball(5), '#ffffff', M4(-0.06, 0.18, 0.02, 0.02, 0.012, 0.02)],
        ]),
        tint: theme.glow ? [theme.glow, '#7ad7ff', '#ff8ad8'] : ['#ef5350', '#ffb74d'],
        glowTint: !!theme.glow,
      };
    case 'lantern':
      return {
        geo: merged([
          [G.cyl(0.018, 0.022, 6), '#3a3050', M4(0, 0.3, 0, 1, 0.6, 1)],
          [G.cyl(0.07, 0.07, 6), '#ffe9a8', M4(0, 0.66, 0, 1, 0.13, 1)],
          [G.cone(6), '#3a3050', M4(0, 0.77, 0, 0.09, 0.07, 0.09)],
        ]),
        tint: ['#ffd27a'],
        glowTint: true,
        tall: true,
      };
    case 'spire':
      return {
        geo: merged([
          [G.cone(7), '#3a2a28', M4(0, 0.35, 0, 0.22, 0.7, 0.22)],
          [G.cone(7), '#ff7a2a', M4(0, 0.69, 0, 0.06, 0.06, 0.06, Math.PI, 0, 0)],
          [G.ico(), '#4a3532', M4(0.12, 0.08, 0.06, 0.12, 0.1, 0.12)],
        ]),
        flat: true,
        tall: true,
      };
    case 'lavapool':
      return { geo: merged([[new THREE.CircleGeometry(1, 20), '#ffffff', M4(0, 0.012, 0, 0.42, 1, 0.32, -Math.PI / 2, 0, 0)]]), lava: true };
    case 'cloud':
      return {
        geo: merged([
          [G.ball(9), '#ffffff', M4(0, 0.12, 0, 0.26, 0.18, 0.22)],
          [G.ball(8), '#ffffff', M4(0.2, 0.08, 0.02, 0.18, 0.13, 0.16)],
          [G.ball(8), '#f2f6ff', M4(-0.2, 0.08, -0.02, 0.17, 0.12, 0.15)],
        ]),
        tint: ['#ffffff', '#fff0f8', '#eef6ff'],
      };
    case 'pillar':
      return {
        geo: merged([
          [G.cyl(0.11, 0.11, 10), '#f4f1ea', M4(0, 0.45, 0, 1, 0.82, 1)],
          [G.cyl(0.16, 0.16, 10), '#e8e2d6', M4(0, 0.03, 0, 1, 0.06, 1)],
          [G.cyl(0.16, 0.14, 10), '#e8e2d6', M4(0, 0.89, 0, 1, 0.07, 1)],
        ]),
        tall: true,
      };
    case 'bolt': {
      const s = new THREE.Shape();
      s.moveTo(0.05, 0.5);
      s.lineTo(-0.12, 0.12);
      s.lineTo(0.0, 0.12);
      s.lineTo(-0.06, -0.2);
      s.lineTo(0.14, 0.2);
      s.lineTo(0.02, 0.2);
      s.lineTo(0.12, 0.5);
      s.closePath();
      const ex = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false });
      return { geo: merged([[ex, '#ffe14d', M4(0, 0.3, 0, 1, 1, 1)], [G.cyl(0.03, 0.05, 6), '#6a6a6a', M4(0.03, 0.05, 0.03, 1, 0.1, 1)]]), glowTint: true, tint: ['#ffe14d'], tall: true };
    }
    case 'cactus':
      return {
        geo: merged([
          [G.cyl(0.08, 0.09, 8), '#4caf50', M4(0, 0.3, 0, 1, 0.6, 1)],
          [G.ball(8), '#4caf50', M4(0, 0.6, 0, 0.08, 0.06, 0.08)],
          [G.cyl(0.05, 0.05, 7), '#43a047', M4(0.14, 0.38, 0, 1, 0.22, 1)],
          [G.cyl(0.05, 0.05, 7), '#43a047', M4(0.08, 0.3, 0, 1, 0.12, 1, 0, 0, Math.PI / 2)],
          [G.ball(6), '#ff7eb6', M4(0, 0.66, 0, 0.04, 0.03, 0.04)],
        ]),
        tall: true,
      };
    case 'post':
      return {
        geo: merged([
          [G.cyl(0.06, 0.07, 8), '#c0392b', M4(0, 0.4, 0, 1, 0.8, 1)],
          [G.ball(8), '#f4d03f', M4(0, 0.82, 0, 0.08, 0.06, 0.08)],
        ]),
        tall: true,
      };
    case 'gear': {
      const parts = [[new THREE.TorusGeometry(0.22, 0.07, 6, 14), '#9aa8b8', M4(0, 0.3, 0)]];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        parts.push([new THREE.BoxGeometry(0.08, 0.08, 0.1), '#8a98a8', M4(Math.cos(a) * 0.32, 0.3 + Math.sin(a) * 0.32, 0, 1, 1, 1, 0, 0, a)]);
      }
      return { geo: merged(parts), metal: true, tall: true };
    }
    default:
      return null;
  }
}

/**
 * Places decorations on the island top: tall things at the back, nothing in the play area
 * in front of the Pokémon. Returns an array of THREE objects (InstancedMesh per kind) + list of
 * animated materials.
 */
export function buildDecorations(theme, { R = 2.2, seed = 1 } = {}) {
  const rnd = mulberry(seed * 7 + 3);
  const meshes = [];
  const animated = [];
  for (const { kind, count } of theme.deco) {
    const d = decoGeometry(kind, theme);
    if (!d) continue;
    const material = d.lava
      ? new THREE.MeshBasicMaterial({ color: theme.glow || '#ff5a1f' })
      : new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: d.crystal ? 0.18 : d.metal ? 0.35 : 0.8,
          metalness: d.metal ? 0.6 : d.crystal ? 0.1 : 0,
          flatShading: !!(d.flat || d.crystal),
          emissive: '#000000',
          transparent: !!d.crystal,
          opacity: d.crystal ? 0.88 : 1,
        });
    if (d.lava) animated.push({ kind: 'lava', material });
    if (d.glowTint || d.crystal) {
      // glow in its own (instance) colour
      const glow = { value: d.crystal ? 0.35 : 0.75 };
      material.onBeforeCompile = (sh) => {
        sh.uniforms.uGlow = glow;
        sh.fragmentShader = 'uniform float uGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uGlow;');
      };
      material.customProgramCacheKey = () => 'pg3d-glow';
      animated.push({ kind: 'glow', material, uniform: glow, base: glow.value });
    }
    const inst = new THREE.InstancedMesh(d.geo, material, count);
    const m = new THREE.Matrix4();
    const placed = [];
    let n = 0;
    for (let tries = 0; n < count && tries < count * 40; tries++) {
      const a = rnd() * TAU;
      const r = (d.lava ? 1.15 : 1.25) + rnd() * (R * 0.86 - 1.25);
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      // keep the front play area free (z > 0 is towards the camera), tall things only at the back
      const frontness = z / r;
      if (d.tall && z > -0.2) continue;
      if (!d.tall && frontness > 0.55 && r < 1.9) continue;
      if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr)) continue;
      const s = d.tall ? 0.85 + rnd() * 0.45 : 0.8 + rnd() * 0.6;
      placed.push([x, z, d.tall ? 0.55 : 0.22]);
      m.compose(new THREE.Vector3(x, -0.01, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * TAU, 0)), new THREE.Vector3(s, s, s));
      inst.setMatrixAt(n, m);
      if (d.tint) inst.setColorAt(n, col(d.tint[n % d.tint.length]));
      n++;
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.name = `deco-${kind}`;
    meshes.push(inst);
  }
  return { meshes, animated };
}

/** Distant puffy clouds for the sky (one instanced mesh). */
export function skyClouds(count = 7, seed = 2, tint = '#ffffff') {
  const rnd = mulberry(seed);
  const geo = merged([
    [G.ball(9), '#ffffff', M4(0, 0, 0, 1, 0.55, 0.7)],
    [G.ball(9), '#ffffff', M4(0.8, -0.1, 0, 0.7, 0.42, 0.55)],
    [G.ball(9), '#f4f7ff', M4(-0.8, -0.12, 0, 0.65, 0.38, 0.5)],
    [G.ball(8), '#ffffff', M4(0.25, 0.3, 0, 0.55, 0.4, 0.5)],
  ]);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, color: tint, transparent: true, opacity: 0.92, fog: false });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (i / count) * Math.PI * 1.6 + rnd() * 0.3 - 1.1;
    const r = 16 + rnd() * 5;
    const s = 1.2 + rnd() * 1.4;
    m.compose(new THREE.Vector3(Math.sin(a) * r, -1 + rnd() * 6, -Math.abs(Math.cos(a)) * r - 4), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    inst.setMatrixAt(i, m);
  }
  inst.name = 'sky-clouds';
  return inst;
}

// ------------------------------------------------------------------ props
export function pokeballTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h / 2);
    grad.addColorStop(0, '#ff5a5a');
    grad.addColorStop(1, '#e02424');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, h / 2, w, h / 2);
  });
}

/** Poké Ball split in two halves (top hinged at the back). */
export function createPokeball(r = 0.3) {
  const group = new THREE.Group();
  group.name = 'pokeball';
  const red = new THREE.MeshStandardMaterial({ color: '#ef3b3b', roughness: 0.3, metalness: 0.05, emissive: '#ffffff', emissiveIntensity: 0 });
  const white = new THREE.MeshStandardMaterial({ color: '#f6f7fb', roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0 });
  const black = new THREE.MeshStandardMaterial({ color: '#1f2433', roughness: 0.5 });
  const btnMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2, emissive: '#ffffff', emissiveIntensity: 0 });
  const hinge = new THREE.Group();
  hinge.position.set(0, r, -r);
  group.add(hinge);
  const topHalf = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 14, 0, TAU, 0, Math.PI / 2), red);
  topHalf.position.set(0, 0, r);
  hinge.add(topHalf);
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 14, 0, TAU, Math.PI / 2, Math.PI / 2), white);
  bottom.position.y = r;
  group.add(bottom);
  const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, r * 0.07, 8, 36), black);
  band.rotation.x = Math.PI / 2;
  band.position.y = r;
  group.add(band);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.28, r * 0.12, 20).rotateX(Math.PI / 2), btnMat);
  btn.position.set(0, r, r * 0.99);
  const btnRing = new THREE.Mesh(new THREE.TorusGeometry(r * 0.3, r * 0.07, 6, 20), black);
  btnRing.position.set(0, r, r * 0.98);
  group.add(btn, btnRing);
  return { group, hinge, topHalf, bottom, btnMat, mats: [red, white], r };
}

/** Beach ball with coloured gores. */
export function beachBallTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    const cols = ['#ff4d6d', '#ffffff', '#ffd23a', '#ffffff', '#3a86ff', '#ffffff'];
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect((i * w) / cols.length, 0, w / cols.length + 1, h);
    });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, 10);
    ctx.fillRect(0, h - 10, w, 10);
  });
}

/** A round bush (merged lumps with highlights), white so instance colours tint it. */
export function bushGeometry() {
  return merged([
    [G.ball(12), '#d8d8d8', M4(0, 0.42, 0, 0.6, 0.48, 0.5)],
    [G.ball(10), '#ffffff', M4(0.36, 0.3, 0.08, 0.36, 0.32, 0.34)],
    [G.ball(10), '#e8e8e8', M4(-0.36, 0.32, 0.05, 0.38, 0.33, 0.34)],
    [G.ball(10), '#ffffff', M4(0.05, 0.72, 0.05, 0.36, 0.3, 0.32)],
    [G.ball(8), '#f2f2f2', M4(0.15, 0.3, 0.36, 0.3, 0.26, 0.2)],
    [G.ball(8), '#f2f2f2', M4(-0.18, 0.28, 0.36, 0.28, 0.24, 0.2)],
  ]);
}
export const BUSH_TINT = {
  meadow: '#5bbf4a', beach: '#4fb84a', volcano: '#7a5a4a', ice: '#d8f2ff', night: '#3fae8a', crystal: '#c58ae0',
  canyon: '#b08a50', clouds: '#ffffff', power: '#9ccf3a', dojo: '#5bbf4a', steel: '#9aa8b8',
};

export function berryGeometry() {
  return merged([
    [G.ball(14), '#ffffff', M4(0, 0, 0, 0.13, 0.12, 0.13)],
    [G.cone(6), '#3f9a3a', M4(0, 0.13, 0, 0.05, 0.06, 0.05)],
    [G.ball(6), '#4caf50', M4(0.05, 0.13, 0, 0.06, 0.012, 0.03, 0, 0, 0.3)],
  ]);
}
export const BERRY_COLORS = { oran: '#3b82f6', razz: '#ec4899' };

/** Soft round blob (shadow / glow). */
export function radialTexture(inner = 'rgba(0,0,0,0.55)', outer = 'rgba(0,0,0,0)', size = 128) {
  return canvasTexture(size, size, (ctx) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Light rays: thin triangles from the centre (billboard). */
export function raysGeometry(n = 14, seed = 4) {
  const rnd = mulberry(seed);
  const pos = [];
  const alpha = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd() * 0.2;
    const w = 0.05 + rnd() * 0.08;
    const L = 2.2 + rnd() * 1.6;
    pos.push(0, 0, 0, Math.cos(a - w) * L, Math.sin(a - w) * L, 0, Math.cos(a + w) * L, Math.sin(a + w) * L, 0);
    alpha.push(1, 0, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('alpha', new THREE.Float32BufferAttribute(alpha, 1));
  return g;
}
export function raysMaterial(color = '#fff6c8') {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: col(color) }, uOpacity: { value: 0 } },
    vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA * uOpacity);
#include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** Spotlight beams (open cones, gradient alpha), instanced ×3. */
export function beamMesh() {
  const geo = new THREE.CylinderGeometry(0.05, 0.9, 5, 20, 1, true);
  geo.translate(0, -2.5, 0);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = geo.attributes.position.getY(i) > -0.1 ? 0.55 : 0.0;
  geo.setAttribute('alpha', new THREE.BufferAttribute(a, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: `attribute float alpha; varying float vA; varying vec3 vC;
      void main(){ vA = alpha; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uOpacity; varying float vA; varying vec3 vC; void main(){ gl_FragColor = vec4(vC, (0.08 + vA) * uOpacity);
#include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const inst = new THREE.InstancedMesh(geo, mat, 3);
  ['#ff4fd8', '#4fd8ff', '#ffe14d'].forEach((c, i) => inst.setColorAt(i, col(c)));
  inst.name = 'beams';
  inst.frustumCulled = false;
  return inst;
}

// ------------------------------------------------------------------ particles
/** 4 × 3 sprite atlas: soft dot, sparkle, heart, leaf, snowflake, note, Z, bubble, streak, star, square, drop. */
export const SPRITE = { dot: 0, sparkle: 1, heart: 2, leaf: 3, snow: 4, note: 5, z: 6, bubble: 7, streak: 8, star: 9, square: 10, drop: 11 };
export function spriteAtlas() {
  const S = 64;
  return canvasTexture(S * 4, S * 3, (ctx) => {
    const cell = (i, draw) => {
      ctx.save();
      ctx.translate((i % 4) * S + S / 2, Math.floor(i / 4) * S + S / 2);
      draw();
      ctx.restore();
    };
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    cell(0, () => {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-32, -32, 64, 64);
    });
    cell(1, () => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 6 : 28;
        const a = (i / 8) * TAU;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.fill();
    });
    cell(2, () => {
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.bezierCurveTo(-30, 2, -24, -24, 0, -10);
      ctx.bezierCurveTo(24, -24, 30, 2, 0, 22);
      ctx.fill();
    });
    cell(3, () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 12, -0.6, 0, TAU);
      ctx.fill();
    });
    cell(4, () => {
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-26, 0);
        ctx.lineTo(26, 0);
        ctx.moveTo(16, -7);
        ctx.lineTo(20, 0);
        ctx.lineTo(16, 7);
        ctx.moveTo(-16, -7);
        ctx.lineTo(-20, 0);
        ctx.lineTo(-16, 7);
        ctx.stroke();
      }
    });
    cell(5, () => {
      ctx.beginPath();
      ctx.ellipse(-8, 16, 11, 8, -0.4, 0, TAU);
      ctx.fill();
      ctx.fillRect(1, -24, 5, 40);
      ctx.beginPath();
      ctx.moveTo(6, -24);
      ctx.quadraticCurveTo(24, -16, 18, 0);
      ctx.quadraticCurveTo(18, -12, 6, -12);
      ctx.fill();
    });
    cell(6, () => {
      ctx.font = 'bold 50px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Z', 0, 2);
    });
    cell(7, () => {
      const g = ctx.createRadialGradient(-8, -8, 2, 0, 0, 28);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.15)');
      g.addColorStop(0.8, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, TAU);
      ctx.stroke();
    });
    cell(8, () => {
      const g = ctx.createLinearGradient(-30, 0, 30, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-30, -3, 60, 6);
    });
    cell(9, () => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 11 : 27;
        const a = (i / 10) * TAU - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.fill();
    });
    cell(10, () => ctx.fillRect(-16, -10, 32, 20));
    cell(11, () => {
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.quadraticCurveTo(18, 4, 0, 22);
      ctx.quadraticCurveTo(-18, 4, 0, -26);
      ctx.fill();
    });
  });
}

/** Point sprites from the atlas: per-particle colour, size, alpha, frame and rotation. */
export function particleMaterial(atlas, { additive = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uAtlas: { value: atlas }, uScale: { value: 400 } },
    vertexShader: `attribute float size; attribute float alpha; attribute float frame; attribute float rot; attribute vec3 tint;
      varying float vA; varying float vF; varying float vR; varying vec3 vC;
      uniform float uScale;
      void main(){ vA = alpha; vF = frame; vR = rot; vC = tint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uScale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uAtlas; varying float vA; varying float vF; varying float vR; varying vec3 vC;
      void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR);
        p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
        if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
        float fx = mod(vF, 4.0); float fy = floor(vF / 4.0);
        vec2 uv = vec2((fx + p.x) / 4.0, 1.0 - (fy + p.y) / 3.0);
        vec4 t = texture2D(uAtlas, uv);
        float a = t.a * vA; if (a < 0.01) discard;
        gl_FragColor = vec4(vC * t.rgb, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** A pool of N sprites; returns { points, items, flush() }. Items: { life, max, x,y,z, vx,vy,vz, size, frame, rot, spin, r,g,b, alpha, ... }. */
export function particlePool(n, material) {
  const geo = new THREE.BufferGeometry();
  const P = new Float32Array(n * 3);
  const C = new Float32Array(n * 3);
  const S = new Float32Array(n);
  const A = new Float32Array(n);
  const F = new Float32Array(n);
  const R = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('tint', new THREE.BufferAttribute(C, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(S, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(A, 1));
  geo.setAttribute('frame', new THREE.BufferAttribute(F, 1));
  geo.setAttribute('rot', new THREE.BufferAttribute(R, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 30);
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  const items = Array.from({ length: n }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.1, frame: 0, rot: 0, spin: 0, r: 1, g: 1, b: 1, alpha: 1, grav: 0, drag: 0 }));
  let cursor = 0;
  const spawn = (props) => {
    // reuse the next dead one (or the oldest)
    for (let k = 0; k < n; k++) {
      const i = (cursor + k) % n;
      if (items[i].life <= 0 || k === n - 1) {
        cursor = (i + 1) % n;
        const it = items[i];
        Object.assign(it, { vx: 0, vy: 0, vz: 0, rot: 0, spin: 0, grav: 0, drag: 0, alpha: 1, fade: 'out', grow: 0, wob: 0, ph: Math.random() * 6.28 }, props);
        it.max = it.life;
        return it;
      }
    }
    return null;
  };
  const flush = () => {
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const on = it.life > 0;
      P[i * 3] = it.x;
      P[i * 3 + 1] = on ? it.y : -999;
      P[i * 3 + 2] = it.z;
      C[i * 3] = it.r;
      C[i * 3 + 1] = it.g;
      C[i * 3 + 2] = it.b;
      const k = on ? it.life / it.max : 0;
      const fade = it.fade === 'inout' ? Math.min(1, (1 - k) * 5, k * 3) : it.fade === 'none' ? 1 : Math.min(1, k * 2.5);
      A[i] = on ? it.alpha * fade : 0;
      S[i] = it.size * (1 + it.grow * (1 - k));
      F[i] = it.frame;
      R[i] = it.rot;
    }
    for (const k of ['position', 'tint', 'size', 'alpha', 'frame', 'rot']) geo.attributes[k].needsUpdate = true;
  };
  const step = (dt, t) => {
    for (const it of items) {
      if (it.life <= 0) continue;
      it.life -= dt;
      it.vy -= it.grav * dt;
      if (it.drag) {
        const k = Math.exp(-it.drag * dt);
        it.vx *= k;
        it.vy *= k;
        it.vz *= k;
      }
      it.x += it.vx * dt + (it.wob ? Math.sin(t * 3 + it.ph) * it.wob * dt : 0);
      it.y += it.vy * dt;
      it.z += it.vz * dt;
      it.rot += it.spin * dt;
      if (it.floor != null && it.y < it.floor) {
        it.y = it.floor;
        it.vy = Math.abs(it.vy) * 0.3;
        it.vx *= 0.6;
        it.vz *= 0.6;
      }
    }
  };
  return { points, items, spawn, flush, step };
}

/** Rounded placeholder card (when the artwork cannot be read): type colour, Poké Ball, name. */
export function placeholderCardTexture(name, color = '#8888aa') {
  return canvasTexture(256, 340, (ctx, w, h) => {
    const r = 36;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(w, 0, w, h, r);
    ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r);
    ctx.arcTo(0, 0, w, 0, r);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.42, 70, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.42, 70, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#1f2433';
    ctx.fillRect(w / 2 - 70, h * 0.42 - 6, 140, 12);
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.42, 20, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.42, 11, 0, TAU);
    ctx.fill();
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(name || '').slice(0, 14), w / 2, h * 0.85);
  });
}
