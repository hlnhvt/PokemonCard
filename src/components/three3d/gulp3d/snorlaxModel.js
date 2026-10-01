// Procedural toon Snorlax (and its little cousin Munchlax) for "Snorlax nuốt cả thành phố".
// No model files: the body is ONE sculpted surface (a sphere projected onto a smooth union of
// ellipsoids, so head, jowls, belly and hips melt into each other), the cream face mask with the
// teal widow's peak and the big cream belly are painted by the shader (crisp at any zoom), plus
// separate ears, chubby arms with cream claws and big feet with cream soles, brown pads and claws.
// Toon ramp + soft rim light + inverted-hull outlines for a cartoon look.
// Local frame: the model faces +Z, up is +Y, feet at y = 0, body radius ~1 (scale it by the engine R).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonRamp, toonMaterial, outlineMaterial, outlineOf } from './gulp3dLook';

const TAU = Math.PI * 2;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const SNORLAX_COLORS = {
  body: '#3a7d93',
  cream: '#f4e3bd',
  claw: '#ffffff',
  pad: '#a8774c',
  lid: '#1d2b38',
  mouth: '#8a2a3f',
  tongue: '#f38ba3',
  white: '#ffffff',
  pupil: '#18202b',
  blush: '#f7a1b5',
  line: '#17323d',
};
export const MUNCHLAX_COLORS = { ...SNORLAX_COLORS, body: '#2b5672', cream: '#f2ddb0', line: '#13283a' };

/* ---------------- Signed distance helpers (for sculpting) ---------------- */

function sdEll(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = (px - cx) / rx;
  const y = (py - cy) / ry;
  const z = (pz - cz) / rz;
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const k1 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);
/** Capsule with a radius going from r1 (at a) to r2 (at b). */
function sdRoundCone(px, py, pz, a, b, r1, r2) {
  const bx = b[0] - a[0];
  const by = b[1] - a[1];
  const bz = b[2] - a[2];
  const l2 = bx * bx + by * by + bz * bz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - a[0];
  const pay = py - a[1];
  const paz = pz - a[2];
  const y = pax * bx + pay * by + paz * bz;
  const z = y - l2;
  const xx = pax * l2 - bx * y;
  const xy = pay * l2 - by * y;
  const xz = paz * l2 - bz * y;
  const x2 = xx * xx + xy * xy + xz * xz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

/** A sphere whose vertices are pushed out along rays from `c` onto the surface sdf = 0 (smooth normals from the gradient). */
function sculpt(sdf, c, wSeg, hSeg, maxR = 2.4) {
  const g = new THREE.SphereGeometry(1, wSeg, hSeg);
  g.deleteAttribute('uv');
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const n = new THREE.Vector3();
  const stepL = maxR / 120;
  const e = 1e-3;
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i);
    const dy = pos.getY(i);
    const dz = pos.getZ(i);
    const at = (t) => sdf(c[0] + dx * t, c[1] + dy * t, c[2] + dz * t);
    let lo = 0;
    let hi = maxR;
    for (let t = stepL; t <= maxR; t += stepL) {
      if (at(t) > 0) {
        hi = t;
        lo = t - stepL;
        break;
      }
    }
    for (let k = 0; k < 16; k++) {
      const m = (lo + hi) / 2;
      if (at(m) > 0) hi = m;
      else lo = m;
    }
    const t = (lo + hi) / 2;
    const x = c[0] + dx * t;
    const y = c[1] + dy * t;
    const z = c[2] + dz * t;
    pos.setXYZ(i, x, y, z);
    n.set(sdf(x + e, y, z) - sdf(x - e, y, z), sdf(x, y + e, z) - sdf(x, y - e, z), sdf(x, y, z + e) - sdf(x, y, z - e)).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  g.computeBoundingSphere();
  return g;
}

/** Tube swept along a curve with a varying radius (eyelids, mouth line, claws). */
function sweep(points, radius, { segs = 10, radial = 6 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points);
  const r = typeof radius === 'function' ? radius : () => radius;
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = g.attributes.position;
  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, c);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r(t)).add(c);
      pos.setXYZ(k, p.x, p.y, p.z);
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.deleteAttribute('uv');
  return g;
}

/** Paint a vertex colour and (optionally) transform. */
function paint(g, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  if (g.attributes.uv) g.deleteAttribute('uv');
  g.applyMatrix4(new THREE.Matrix4().compose(v3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), v3(...s)));
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const sphere = (w, h) => {
  const g = new THREE.SphereGeometry(1, w, h);
  g.deleteAttribute('uv');
  return g;
};
/** A small curved claw pointing along +Z (cream). */
const clawGeo = (len = 0.12, r = 0.045) => sweep([v3(0, 0, 0), v3(0, -len * 0.25, len * 0.55), v3(0, -len * 0.75, len)], (t) => r * (1 - t) + 0.008, { segs: 5, radial: 6 });

/* ---------------- Body shapes ---------------- */

const SHAPES = {
  snorlax: {
    H: 2.36,
    center: [0, 1.1, 0.02],
    sdf: (x, y, z) => {
      let d = sdEll(x, y, z, 0, 0.92, 0, 1.06, 0.92, 0.93);
      d = smin(d, sdEll(x, y, z, 0, 0.56, -0.02, 1.02, 0.56, 0.86), 0.2);
      d = smin(d, sdEll(x, y, z, 0, 0.84, 0.2, 0.9, 0.76, 0.79), 0.16);
      d = smin(d, sdEll(x, y, z, 0, 1.87, 0.05, 0.7, 0.49, 0.62), 0.34);
      d = smin(d, sdEll(x, y, z, 0, 1.68, 0.12, 0.76, 0.32, 0.6), 0.14); // jowls
      return smax(d, 0.03 - y, 0.08);
    },
    // cream masks (object space): belly oval, face with the teal widow's peak
    mask: { belly: [0, 0.78, 0.78, 0.57], face: [0, 1.77, 0.56, 0.34], peak: [1.85, 0.7, 0.9] },
    eye: { x: 0.25, y: 1.9 },
    mouthY: 1.64,
    mouthW: 0.3,
    ear: { x: 0.42, y: 2.18, z: 0.02, tilt: 0.42, len: 0.36, r: 0.17 },
    shoulder: { x: 0.9, y: 1.32, z: 0.1 },
    arm: { r1: 0.28, r2: 0.22, len: 0.56 },
    foot: { x: 0.52, z: 0.46, s: 1 },
  },
  munchlax: {
    H: 2.06,
    center: [0, 0.98, 0.02],
    sdf: (x, y, z) => {
      let d = sdEll(x, y, z, 0, 0.74, 0, 0.88, 0.74, 0.82);
      d = smin(d, sdEll(x, y, z, 0, 0.7, 0.14, 0.78, 0.62, 0.72), 0.14);
      d = smin(d, sdEll(x, y, z, 0, 1.5, 0.04, 0.8, 0.56, 0.7), 0.28);
      return smax(d, 0.03 - y, 0.08);
    },
    mask: { belly: [0, 0.6, 0.56, 0.4], face: [0, 1.46, 0.66, 0.36], peak: [1.62, 0.5, 0.2] },
    eye: { x: 0.27, y: 1.58 },
    mouthY: 1.32,
    mouthW: 0.32,
    ear: { x: 0.5, y: 1.88, z: 0.02, tilt: 0.36, len: 0.5, r: 0.2 },
    shoulder: { x: 0.78, y: 1.1, z: 0.1 },
    arm: { r1: 0.23, r2: 0.18, len: 0.46 },
    foot: { x: 0.46, z: 0.4, s: 0.85 },
  },
};

/** Shader patch painting the cream face mask and belly onto the body, and jiggling the belly. */
function bodyPatch(shape, C, uniforms) {
  const [bx, by, brx, bry] = shape.mask.belly;
  const [fx, fy, frx, fry] = shape.mask.face;
  const [py, pk, pq] = shape.mask.peak;
  const f = (n) => n.toFixed(4);
  return (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nuniform float uJig;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vObj = position;
        {
          float bl = length(vec2((position.x - ${f(bx)}) / ${f(brx * 1.05)}, (position.y - ${f(by)}) / ${f(bry * 1.1)}));
          float bm = (1.0 - smoothstep(0.0, 1.0, bl)) * smoothstep(0.0, 0.5, position.z);
          transformed += normal * bm * uJig;
        }`
      );
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;\nuniform vec3 uCream;').replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        vec3 q = vObj;
        float fb = 1.0 - length(vec2((q.x - ${f(bx)}) / ${f(brx)}, (q.y - ${f(by)}) / ${f(bry)}));
        float ff = 1.0 - length(vec2((q.x - ${f(fx)}) / ${f(frx)}, (q.y - ${f(fy)}) / ${f(fry)}));
        float ax = abs(q.x);
        float top = ${f(py)} + ${f(pk)} * ax - ${f(pq)} * ax * ax;
        ff = min(ff, (top - q.y) * 2.6);
        float wb = fwidth(fb) * 0.8 + 1e-4;
        float wf = fwidth(ff) * 0.8 + 1e-4;
        float m = max(smoothstep(-wb, wb, fb) * smoothstep(0.0, 0.25, q.z), smoothstep(-wf, wf, ff) * smoothstep(0.05, 0.3, q.z));
        diffuseColor.rgb = mix(diffuseColor.rgb, uCream, m);
      }`
    );
  };
}

/**
 * createSnorlax({ variant: 'snorlax' | 'munchlax' }) →
 *  group (add to the moving object; rotate.y = heading), mouth (Object3D: where food goes),
 *  update(dt, { moving, sleeping }), chomp(), bounce(k), wobble(), dispose(), parts.
 */
export function createSnorlax({ variant = 'snorlax' } = {}) {
  const munch = variant === 'munchlax';
  const C = munch ? MUNCHLAX_COLORS : SNORLAX_COLORS;
  const S = SHAPES[munch ? 'munchlax' : 'snorlax'];
  const disposables = new Set();
  const G = (g) => (disposables.add(g), g);
  const M = (m) => (disposables.add(m), m);
  const ramp = toonRamp();
  disposables.add(ramp);
  const uniforms = { uCream: { value: new THREE.Color(C.cream) }, uJig: { value: 0 } };
  const mats = {
    body: M(toonMaterial(C.body, { ramp, key: `body-${variant}`, rim: 0.16, rimColor: '#d6f3ff', patch: bodyPatch(S, C, uniforms) })),
    paint: M(toonMaterial('#ffffff', { ramp, key: 'paint', vertexColors: true, rim: 0.14, rimColor: '#d6f3ff' })),
    lid: M(new THREE.MeshBasicMaterial({ color: C.lid })),
    mouth: M(toonMaterial(C.mouth, { ramp, key: 'mouth', rim: 0 })),
    tongue: M(toonMaterial(C.tongue, { ramp, key: 'tongue', rim: 0 })),
    claw: M(toonMaterial(C.claw, { ramp, key: 'claw', rim: 0.2 })),
    eye: M(new THREE.MeshBasicMaterial({ vertexColors: true })),
    blush: M(new THREE.MeshBasicMaterial({ color: C.blush, transparent: true, opacity: 0.75, depthWrite: false })),
    bubble: M(new THREE.MeshBasicMaterial({ color: '#d9f3ff', transparent: true, opacity: 0.45, depthWrite: false })),
    outline: M(outlineMaterial({ color: C.line, attr: 'normal', width: 0.0034, max: 0.03 })),
    outlineV: M(outlineMaterial({ vertexColors: true, darken: 0.36, attr: 'normal', width: 0.0034, max: 0.03 })),
  };
  const outlined = [];
  const mesh = (geo, mat, parent, { outline = null, shadow = true } = {}) => {
    const m = new THREE.Mesh(G(geo), mat);
    m.castShadow = shadow;
    parent.add(m);
    if (outline) outlined.push(outlineOf(m, outline));
    return m;
  };

  const group = new THREE.Group();
  group.name = variant;
  const root = new THREE.Group(); // bounce / sleep pose
  group.add(root);
  const body = new THREE.Group(); // squash & stretch, wobble
  root.add(body);

  // ---- Body: one sculpted surface (cream masks painted in the shader)
  const torso = mesh(sculpt(S.sdf, S.center, 48, 36), mats.body, body, { outline: mats.outline });
  torso.name = 'torso';
  /** z of the body surface in front of (x, y). */
  const surfZ = (x, y) => {
    let lo = 0;
    let hi = 1.6;
    for (let k = 0; k < 22; k++) {
      const m = (lo + hi) / 2;
      if (S.sdf(x, y, m) > 0) hi = m;
      else lo = m;
    }
    return (lo + hi) / 2;
  };
  const belly = new THREE.Object3D(); // drives the belly jiggle in the shader
  belly.name = 'belly';
  belly.position.set(0, S.mask.belly[1], surfZ(0, S.mask.belly[1]));
  body.add(belly);
  const face = new THREE.Object3D();
  face.name = 'face';
  face.position.set(0, S.mask.face[1], surfZ(0, S.mask.face[1]));
  body.add(face);
  const faceFront = face.position.z;

  // ---- Ears: small pointed triangles on top of the head (flattened front-to-back)
  const E = S.ear;
  const earGeo = sculpt((x, y, z) => sdRoundCone(x, y, z * 1.55, [0, -0.08, 0], [0, E.len, 0], E.r, 0.03), [0, E.len * 0.35, 0], 14, 12, 1);
  disposables.add(earGeo);
  const ears = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * E.x, E.y, E.z);
    pivot.rotation.z = -s * E.tilt;
    body.add(pivot);
    const ear = new THREE.Mesh(earGeo, mats.body);
    ear.castShadow = false;
    pivot.add(ear);
    outlined.push(outlineOf(ear, mats.outline));
    ears.push(pivot);
  }

  // ---- Eyes: closed sleepy lids (Snorlax) that swap to big sparkly eyes when eating
  const eyeY = S.eye.y;
  const eyeX = S.eye.x;
  const lidParts = [];
  const eyes = [];
  for (const s of [-1, 1]) {
    const x0 = s * eyeX;
    const zc = (x, y) => surfZ(x, y) + 0.004;
    lidParts.push(sweep([-0.13, -0.05, 0.05, 0.13].map((dx, k) => v3(x0 + dx, eyeY + (k === 0 || k === 3 ? 0.012 : -0.024), zc(x0 + dx, eyeY))), (t) => 0.014 + 0.012 * Math.sin(Math.PI * t), { segs: 12, radial: 5 }));
    const eye = new THREE.Group();
    const ez = surfZ(x0, eyeY);
    eye.position.set(x0, eyeY, ez - 0.02);
    eye.lookAt(x0 * 2.2, eyeY + 0.2, ez + 2);
    body.add(eye);
    const er = munch ? 0.11 : 0.1;
    const eg = mergeGeometries([
      paint(sphere(14, 10), C.pupil, { s: [er, er * 1.22, er * 0.45] }),
      paint(sphere(8, 6), C.white, { p: [s * -er * 0.28, er * 0.38, er * 0.38], s: [er * 0.34, er * 0.38, er * 0.12] }),
      paint(sphere(6, 4), C.white, { p: [s * er * 0.3, -er * 0.42, er * 0.38], s: [er * 0.16, er * 0.16, er * 0.08] }),
    ]);
    const em = mesh(eg, mats.eye, eye, { shadow: false });
    em.name = 'eye';
    eyes.push(eye);
  }
  const lidMesh = mesh(mergeGeometries(lidParts), mats.lid, body, { shadow: false });
  lidParts.forEach((g) => g.dispose());
  const lids = [lidMesh];

  // Rosy cheeks while munching
  const blushParts = [-1, 1].map((s) => {
    const x = s * (eyeX + 0.2);
    const y = eyeY - 0.18;
    const g = sphere(12, 6);
    g.applyMatrix4(new THREE.Matrix4().compose(v3(x, y, surfZ(x, y) - 0.012), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s * 0.5, 0)), v3(0.1, 0.06, 0.03)));
    return g;
  });
  const blush = mesh(mergeGeometries(blushParts), mats.blush, body, { shadow: false });
  blushParts.forEach((g) => g.dispose());
  blush.renderOrder = 3;

  // ---- Mouth: a smile line when closed; a cavity with tongue and two little fangs when open
  const mouthY = S.mouthY;
  const mw = S.mouthW;
  const mouthZ = surfZ(0, mouthY);
  const smile = mesh(
    sweep([-1, -0.55, 0, 0.55, 1].map((u) => v3(u * mw, mouthY + (Math.abs(u) > 0.9 ? 0.045 : Math.abs(u) > 0.4 ? 0.0 : -0.018), surfZ(u * mw, mouthY) + 0.004)), (t) => 0.012 + 0.008 * Math.sin(Math.PI * t), { segs: 16, radial: 5 }),
    mats.lid,
    body,
    { shadow: false }
  );
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, mouthY, mouthZ - 0.06);
  body.add(mouthGroup);
  const cavity = mesh(sphere(18, 10), mats.mouth, mouthGroup, { shadow: false });
  const tongue = mesh(sphere(12, 8), mats.tongue, mouthGroup, { shadow: false });
  tongue.scale.set(0.15, 0.05, 0.07);
  const jaw = new THREE.Group(); // lower lip with the fangs
  mouthGroup.add(jaw);
  const fangGeo = G(new THREE.ConeGeometry(0.036, munch ? 0.08 : 0.095, 8));
  fangGeo.deleteAttribute('uv');
  const fangs = [];
  for (const s of [-1, 1]) {
    const fx = s * mw * 0.48;
    const f = new THREE.Mesh(fangGeo, mats.claw);
    f.position.set(fx, 0.03, surfZ(fx, mouthY) - mouthZ + 0.07);
    f.rotation.x = 0.12;
    jaw.add(f);
    fangs.push(f);
  }
  const mouth = new THREE.Object3D(); // world target for swallowed things
  mouth.position.set(0, -0.04, 0.12);
  mouthGroup.add(mouth);
  // Snot bubble while asleep
  const bubble = mesh(sphere(16, 10), mats.bubble, body, { shadow: false });
  bubble.position.set(0.15, mouthY + 0.1, surfZ(0.15, mouthY + 0.1) + 0.04);
  bubble.visible = false;
  bubble.renderOrder = 4;

  // ---- Arms: chubby, swinging, with three cream claws (one vertex-coloured mesh each)
  const A = S.arm;
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * S.shoulder.x, S.shoulder.y, S.shoulder.z);
    body.add(shoulder);
    const tip = [s * 0.2, -A.len, 0.16];
    const armG = paint(
      sculpt((x, y, z) => sdRoundCone(x, y, z, [0, 0, 0], tip, A.r1, A.r2), [tip[0] / 2, tip[1] / 2, tip[2] / 2], 20, 14, 1.2),
      C.body
    );
    const claws = [-1, 0, 1].map((k) => paint(clawGeo(munch ? 0.1 : 0.12, 0.045), C.claw, { p: [tip[0] + k * 0.085 + s * 0.02, tip[1] - 0.06 + (k === 0 ? -0.01 : 0), tip[2] + A.r2 * 0.72], r: [0.35, k * 0.25, 0] }));
    const g = mergeGeometries([armG, ...claws]);
    [armG, ...claws].forEach((q) => q.dispose());
    mesh(g, mats.paint, shoulder, { outline: mats.outlineV });
    arms.push(shoulder);
  }

  // ---- Feet: big rounded feet with cream soles, a brown paw pad and three claws (one mesh each)
  const F = S.foot;
  const feet = [];
  for (const s of [-1, 1]) {
    const foot = new THREE.Group();
    foot.position.set(s * F.x, 0.2 * F.s, F.z);
    root.add(foot);
    const k = F.s;
    const sole = [0, 0.04 * k, 0.27 * k];
    const tilt = -0.55;
    const soleQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, 0));
    const at = (x, y, z) => v3(x, y, z).applyQuaternion(soleQ).add(v3(...sole)).toArray();
    const parts = [
      paint(sculpt((x, y, z) => sdEll(x, y, z, 0, 0, -0.04 * k, 0.33 * k, 0.25 * k, 0.38 * k), [0, 0, -0.04 * k], 18, 12, 1), C.body),
      paint(sphere(20, 10), C.cream, { p: sole, r: [tilt, 0, 0], s: [0.29 * k, 0.28 * k, 0.09 * k] }),
      paint(sphere(14, 8), C.pad, { p: at(0, -0.035 * k, 0.07 * k), r: [tilt, 0, 0], s: [0.15 * k, 0.13 * k, 0.04 * k] }),
      ...[-1, 0, 1].map((q) => paint(clawGeo(0.1 * k, 0.04 * k), C.claw, { p: at(q * 0.11 * k, 0.17 * k - Math.abs(q) * 0.03 * k, 0.04 * k), r: [tilt - 0.9, q * 0.2, 0] })),
    ];
    const g = mergeGeometries(parts);
    parts.forEach((q) => q.dispose());
    mesh(g, mats.paint, foot, { outline: mats.outlineV });
    feet.push(foot);
  }

  // ---- Animation state
  const st = { t: 0, phase: 0, move: 0, chomp: 0, chompN: 0, eyeOpen: munch ? 1 : 0, happy: 0, jig: 0, jigV: 0, wob: 0, wobV: 0, hop: 0, hopV: 0, sleep: 0, earLag: 0 };
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

  /** A bite: mouth snaps open and chews, eyes go wide and sparkly, ears flick, belly jiggles. */
  function chomp(big = 0) {
    st.chomp = 0.42;
    st.chompN += 1;
    st.jigV += 2.2 + big * 3;
    st.earLag += 0.5;
    st.happy = 1;
  }
  /** Belly bounce (level up). */
  function bounce(k = 1) {
    st.jigV += 6 * k;
    st.hopV += 3.2 * k;
    st.happy = 1;
  }
  /** Soft wobble when bumping into something too big. */
  function wobble() {
    st.wobV += 5;
    st.jigV += 2;
  }

  function update(dt = 1 / 60, { moving = 0, sleeping = false } = {}) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    st.t += dt;
    const t = st.t;
    st.move = ease(st.move, sleeping ? 0 : moving, 8, dt);
    st.sleep = ease(st.sleep, sleeping ? 1 : 0, 2.5, dt);
    const mv = st.move;
    st.phase = (st.phase + dt * (3 + mv * 7)) % TAU;
    const ph = st.phase;

    // Springs: belly jiggle, bump wobble, hop
    st.jigV += (-st.jig * 140 - st.jigV * 7) * dt;
    st.jig += st.jigV * dt;
    st.wobV += (-st.wob * 90 - st.wobV * 5) * dt;
    st.wob += st.wobV * dt;
    st.hopV -= 18 * dt;
    st.hop = Math.max(0, st.hop + st.hopV * dt);
    if (st.hop === 0 && st.hopV < 0) st.hopV = 0;

    // Walk: bouncy squash & stretch, waddle roll, breathing
    const step = Math.abs(Math.sin(ph));
    const breathe = Math.sin(t * (sleeping ? 1.2 : 2)) * (0.015 + st.sleep * 0.03);
    const squash = mv * 0.07 * Math.cos(ph * 2) + breathe - st.jig * 0.5;
    body.scale.set(1 - squash * 0.6 + st.jig * 0.3, 1 + squash, 1 - squash * 0.6 + st.jig * 0.3);
    root.position.y = step * 0.14 * mv + st.hop;
    root.rotation.z = Math.sin(ph) * 0.1 * mv + st.wob * 0.12;
    root.rotation.y = Math.sin(ph) * 0.06 * mv;
    root.rotation.x = -st.sleep * 0.3 + mv * 0.06 + st.wob * 0.05;
    root.position.z = -st.sleep * 0.15;
    const bj = st.jig * 0.6 + st.sleep * 0.08 + breathe * 2;
    belly.scale.set(1 + bj, 1 + st.jig * 0.35 + st.sleep * 0.05, 1 + st.jig * 0.9 + st.sleep * 0.12 + breathe * 3);
    uniforms.uJig.value = Math.max(-0.08, Math.min(0.14, st.jig * 0.32 + st.sleep * 0.04 + breathe * 1.2));

    // Feet: alternate steps (legs out front when sleeping)
    feet.forEach((f, i) => {
      const s = i === 0 ? 1 : -1;
      const lift = Math.max(0, Math.sin(ph + (i ? Math.PI : 0))) * mv;
      f.position.y = 0.2 * F.s + lift * 0.2;
      f.position.z = F.z + Math.sin(ph + (i ? Math.PI : 0)) * 0.12 * mv + st.sleep * 0.3;
      f.rotation.x = -lift * 0.5 + st.sleep * 0.2;
      f.rotation.z = s * st.sleep * 0.25;
    });

    // Chomp: mouth open → chew chew, eyes wide while eating
    st.chomp = Math.max(0, st.chomp - dt);
    const c = st.chomp > 0 ? st.chomp / 0.42 : 0;
    const open = st.chomp > 0 ? Math.sin(Math.PI * c) * (0.6 + 0.4 * Math.abs(Math.sin(c * 9))) : st.sleep * (0.18 + 0.06 * Math.sin(t * 1.2));
    cavity.scale.set(mw * 0.8 + open * 0.05, 0.02 + open * 0.17, 0.08);
    cavity.position.y = -0.02 - open * 0.08;
    cavity.visible = open > 0.03;
    tongue.visible = open > 0.15;
    tongue.position.set(0, -0.04 - open * 0.14, 0.07);
    jaw.position.y = -open * 0.2;
    smile.visible = open < 0.1;
    const wantEyes = munch ? 1 : st.chomp > 0 || st.chompN > 0 ? 1 : 0;
    if (st.chomp === 0) st.chompN = Math.max(0, st.chompN - dt * 2.5); // stays wide-eyed between quick bites
    st.eyeOpen = ease(st.eyeOpen, sleeping ? 0 : wantEyes, wantEyes ? 18 : 4, dt);
    const blink = munch && Math.sin(t * 0.9) > 0.985 ? 0.1 : 1;
    const sparkle = 1 + st.happy * 0.12 * Math.sin(t * 18);
    eyes.forEach((e) => {
      e.scale.set(st.eyeOpen * sparkle, st.eyeOpen * blink * (1 + st.eyeOpen * 0.15) * sparkle, st.eyeOpen);
      e.visible = st.eyeOpen > 0.02;
    });
    lids.forEach((l) => (l.visible = st.eyeOpen < 0.5));
    st.happy = Math.max(0, st.happy - dt * 0.8);
    const bl = Math.min(1, st.happy * 2.2);
    blush.visible = bl > 0.02;
    blush.scale.setScalar(0.6 + 0.4 * bl);
    mats.blush.opacity = 0.75 * bl;
    // Snot bubble grows and shrinks with the snores
    const bub = st.sleep > 0.6 ? 0.5 + 0.5 * Math.sin(t * 1.2) : 0;
    bubble.visible = bub > 0.05;
    bubble.scale.setScalar(0.02 + bub * 0.08);

    // Arms swing while walking, lift to the mouth on a bite, rest on the belly asleep
    arms.forEach((a, i) => {
      const s = i === 0 ? -1 : 1;
      a.rotation.x = Math.sin(ph + (i ? 0 : Math.PI)) * 0.45 * mv - c * 0.9 - st.sleep * 0.9;
      a.rotation.z = s * (0.1 + c * 0.25 - st.sleep * 0.8) + Math.sin(t * 2 + i) * 0.03;
    });

    // Ears: lag behind the bounce and flick on a bite
    st.earLag = ease(st.earLag, 0, 5, dt);
    ears.forEach((e, i) => {
      const s = i === 0 ? -1 : 1;
      e.rotation.z = -s * E.tilt + s * (Math.sin(ph * 2 + 0.6) * 0.08 * mv + Math.sin(t * 30) * st.earLag * 0.25 - st.jig * 0.4);
      e.rotation.x = -Math.cos(ph * 2) * 0.06 * mv;
    });
  }

  function dispose() {
    group.traverse((o) => {
      if (o.geometry) disposables.add(o.geometry);
      if (o.material) disposables.add(o.material);
    });
    for (const d of disposables) d.dispose?.();
    disposables.clear();
    group.removeFromParent();
  }

  update(0);
  return { group, mouth, height: S.H, faceFront, update, chomp, bounce, wobble, dispose, parts: { body, belly, face, ears, eyes, lids, arms, feet, cavity, fangs, torso, blush, bubble, outlines: outlined } };
}
