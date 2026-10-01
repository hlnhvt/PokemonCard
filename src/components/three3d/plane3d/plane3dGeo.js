// Geometry kit for "Đua máy bay Pokémon": bake primitives into vertex-coloured, non-indexed parts with the
// `anim` and `onormal` attributes (see plane3dLook), and merge them into one BufferGeometry.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const TAU = Math.PI * 2;
const tmpColor = new THREE.Color();
const tmpV = new THREE.Vector3();

/** Smoothed normals (vertices at the same spot share one), for crack-free outlines. */
function smoothNormals(pos, nor) {
  const acc = new Map();
  const key = (i) => ((Math.round(pos[i] * 400) * 73856093) ^ (Math.round(pos[i + 1] * 400) * 19349663) ^ (Math.round(pos[i + 2] * 400) * 83492791)) | 0;
  for (let i = 0; i < pos.length; i += 3) {
    const k = key(i);
    let a = acc.get(k);
    if (!a) {
      a = [0, 0, 0];
      acc.set(k, a);
    }
    a[0] += nor[i];
    a[1] += nor[i + 1];
    a[2] += nor[i + 2];
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
 * Bake a primitive: transform, flatten, paint.
 * color: hex string or fn(triIndex, pos (attribute), vertexIndex, centroid) → hex.
 * flap: amplitude (fn(localPosBeforeTransform) or number) for anim.x; glow → anim.y; flicker → anim.z.
 * outline: 'smooth' (default) | 'radial' (from the part's centre, cheap) | 'normal' | 'none'.
 */
export function part(geo, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], flap = 0, glow = 0, flicker = 0, outline = 'smooth', order = 'XYZ', uv = null } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  geo.dispose();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(uv && k === 'uv')) g.deleteAttribute(k);
  if (uv && g.attributes.uv) {
    // scale (and offset) the texture coordinates: uv = [su, sv, ou, ov]
    const a = g.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * uv[0] + (uv[2] || 0), a.getY(i) * uv[1] + (uv[3] || 0));
    g.userData.textured = true;
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  const local = typeof flap === 'function' ? g.attributes.position.array.slice() : null;
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r, order)), new THREE.Vector3(...s));
  g.applyMatrix4(m);
  const pos = g.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const anim = new Float32Array(n * 3);
  const cen = new THREE.Vector3();
  const perTri = typeof color === 'function' || typeof glow === 'function' || typeof flicker === 'function';
  let gl = typeof glow === 'function' ? 0 : glow;
  let fl = typeof flicker === 'function' ? 0 : flicker;
  if (typeof color !== 'function') tmpColor.set(color);
  for (let i = 0; i < n; i++) {
    if (perTri && i % 3 === 0) {
      cen.set(0, 0, 0);
      for (let k = 0; k < 3; k++) cen.add(tmpV.fromBufferAttribute(pos, i + k));
      cen.multiplyScalar(1 / 3);
      if (typeof color === 'function') tmpColor.set(color(Math.floor(i / 3), pos, i, cen));
      if (typeof glow === 'function') gl = glow(cen);
      if (typeof flicker === 'function') fl = flicker(cen);
    }
    col[i * 3] = tmpColor.r;
    col[i * 3 + 1] = tmpColor.g;
    col[i * 3 + 2] = tmpColor.b;
    anim[i * 3] = local ? flap(local[i * 3], local[i * 3 + 1], local[i * 3 + 2]) : flap;
    anim[i * 3 + 1] = gl;
    anim[i * 3 + 2] = fl;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('anim', new THREE.BufferAttribute(anim, 3));
  let on;
  if (outline === 'none') on = new Float32Array(n * 3);
  else if (outline === 'normal') on = g.attributes.normal.array.slice();
  else if (outline === 'radial') {
    on = new Float32Array(n * 3);
    const c = new THREE.Vector3(...p);
    for (let i = 0; i < n; i++) {
      tmpV.fromBufferAttribute(pos, i).sub(c).normalize();
      on[i * 3] = tmpV.x;
      on[i * 3 + 1] = tmpV.y;
      on[i * 3 + 2] = tmpV.z;
    }
  } else on = smoothNormals(pos.array, g.attributes.normal.array);
  g.setAttribute('onormal', new THREE.BufferAttribute(on, 3));
  g.userData.noOutline = outline === 'none';
  return g;
}

const ATTRS = ['position', 'normal', 'color', 'anim', 'onormal'];
/** Concatenate baked parts into one geometry (null when empty). With `uv`, the parts' texture coordinates too. */
export function merge(parts, { uv = false } = {}) {
  const list = parts.filter(Boolean);
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  if (!n) return null;
  const names = uv ? [...ATTRS, 'uv'] : ATTRS;
  const size = (a) => (a === 'uv' ? 2 : 3);
  const arrays = Object.fromEntries(names.map((a) => [a, new Float32Array(n * size(a))]));
  let o = 0;
  for (const g of list) {
    for (const a of names) if (g.attributes[a]) arrays[a].set(g.attributes[a].array, o * size(a));
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  for (const a of names) out.setAttribute(a, new THREE.BufferAttribute(arrays[a], size(a)));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/** Copy a baked part list with an extra transform (for placing whole sub-models). */
export function placeAll(parts, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...(typeof s === 'number' ? [s, s, s] : s)));
  const nm = new THREE.Matrix3().getNormalMatrix(m);
  for (const g of parts) {
    if (!g) continue;
    g.applyMatrix4(m); // position + normal
    const on = g.attributes.onormal;
    for (let i = 0; i < on.count; i++) {
      tmpV.fromBufferAttribute(on, i);
      if (tmpV.lengthSq() > 0) {
        tmpV.applyMatrix3(nm).normalize();
        on.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);
      }
    }
  }
  return parts;
}

// ---------------------------------------------------------------- primitives
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const rbox = (w, h, d, r = 0.08, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
export const cyl = (rt, rb, h, seg = 12, hs = 1, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, hs, open);
export const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
export const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
export const cone = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);
export const torus = (r, t, rs = 8, ts = 24, arc = TAU) => new THREE.TorusGeometry(r, t, rs, ts, arc);
export const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(Math.max(1e-4, x), y)), seg);

/** A flat shape (array of [x, y]) extruded along z by `depth` with a soft bevel, centred on z. */
export function slab(points, depth, bevel = 0.04, curveSegments = 8) {
  const sh = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** A rounded planform (wings, fins): points of a smooth closed curve through `ctrl`. */
export function roundShape(ctrl, n = 40) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
  return curve.getPoints(n).map((v) => [v.x, v.y]);
}

/** Displace the vertices of a (non-indexed) geometry by a noise fn(x, y, z) along the radial direction. */
export function lumpy(geo, amount, seed = 1, freq = 1.6) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const n3 = (x, y, z) => Math.sin(x * freq + seed) * Math.cos(y * freq * 1.3 + seed * 2.1) * Math.sin(z * freq * 0.9 + seed * 0.7) + 0.5 * Math.sin(x * freq * 2.7 + y * 1.9 + seed * 3.3);
  for (let i = 0; i < pos.count; i++) {
    tmpV.fromBufferAttribute(pos, i);
    tmpV.multiplyScalar(1 + amount * n3(tmpV.x, tmpV.y, tmpV.z));
    pos.setXYZ(i, tmpV.x, tmpV.y, tmpV.z);
  }
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

/** Darker / lighter shade of a colour. */
export const shade = (hex, k) => `#${tmpColor.set(hex).multiplyScalar(k).getHexString()}`;
export const mix = (a, b, t) => `#${tmpColor.set(a).lerp(new THREE.Color(b), t).getHexString()}`;

/** Tiny deterministic random for layouts. */
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

/** Canvas texture (sRGB). Works with a DOM canvas only (the scene is never built in tests). */
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

/** Soft round glow sprite texture. */
export const glowTexture = (inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') =>
  canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, mid);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

/** Four-point sparkle texture. */
export const sparkleTexture = () =>
  canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.quadraticCurveTo(36, 28, 64, 32);
    ctx.quadraticCurveTo(36, 36, 32, 64);
    ctx.quadraticCurveTo(28, 36, 0, 32);
    ctx.quadraticCurveTo(28, 28, 32, 0);
    ctx.fill();
  });
