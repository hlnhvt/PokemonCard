// Procedural low-poly Charizard for "Cưỡi Charizard bay lượn" (no model files: built from lathes,
// scaled spheres, swept tubes and two skinned chains for the neck and the tail).
// Local frame: forward is -Z, up is +Y, right is +X (the same frame as the chase-camera player group).
import * as THREE from 'three';

export const CHARIZARD_COLORS = {
  orange: '#f08030',
  cream: '#f8d878',
  membrane: '#2a8a8a',
  white: '#ffffff',
  claw: '#f4efe6',
  iris: '#2bb3c8',
  dark: '#1b1b24',
};

const TAU = Math.PI * 2;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Soft round alpha sprite generated in memory (works without a DOM canvas). */
function radialTexture(size = 32) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const a = Math.max(0, 1 - d);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * a * a);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** A tube swept along a curve with a varying radius (horns, claws, wing bones, limbs). */
function sweepGeometry(points, radius, { segs = 10, radial = 7 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [];
  const nor = [];
  const idx = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    const r = typeof radius === 'function' ? radius(t) : radius;
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      nor.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // Round cap at the start so open ends never show a hole
  const r0 = typeof radius === 'function' ? radius(0) : radius;
  if (r0 > 0.001) {
    const c = pos.length / 3;
    const p0 = curve.getPointAt(0);
    const tan = curve.getTangentAt(0);
    pos.push(p0.x - tan.x * r0 * 0.6, p0.y - tan.y * r0 * 0.6, p0.z - tan.z * r0 * 0.6);
    nor.push(-tan.x, -tan.y, -tan.z);
    for (let j = 0; j < radial; j++) idx.push(c, j + 1, j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/**
 * A straight tapered tube along +Y skinned to a chain of bones (neck, tail).
 * colorAt(angle, t) returns the vertex colour (angle 0 = +X, PI/2 = +Z).
 */
function skinnedChain({ length, bones: nb, radius, radial = 12, segs = 18, sx = 1, sz = 1, colorAt, material }) {
  const pos = [];
  const nor = [];
  const col = [];
  const si = [];
  const sw = [];
  const idx = [];
  const c = new THREE.Color();
  const step = length / nb;
  const weight = (y) => {
    const f = Math.min(nb - 1e-4, Math.max(0, y / step));
    const k = Math.floor(f);
    return [k, k + 1, 1 - (f - k), f - k];
  };
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = t * length;
    const r = radius(t);
    const dr = (radius(Math.min(1, t + 0.02)) - radius(Math.max(0, t - 0.02))) / (0.04 * length);
    const [k0, k1, w0, w1] = weight(y);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const nx = Math.cos(a) / sx;
      const nz = Math.sin(a) / sz;
      const n = new THREE.Vector3(nx, -dr, nz).normalize();
      pos.push(Math.cos(a) * r * sx, y, Math.sin(a) * r * sz);
      nor.push(n.x, n.y, n.z);
      c.set(colorAt(a, t));
      col.push(c.r, c.g, c.b);
      si.push(k0, k1, 0, 0);
      sw.push(w0, w1, 0, 0);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // Rounded tip cap
  const tipR = radius(1);
  const tip = pos.length / 3;
  pos.push(0, length + tipR * 0.8, 0);
  nor.push(0, 1, 0);
  c.set(colorAt(0, 1));
  col.push(c.r, c.g, c.b);
  si.push(nb, 0, 0, 0);
  sw.push(1, 0, 0, 0);
  const last = segs * (radial + 1);
  for (let j = 0; j < radial; j++) idx.push(last + j + 1, last + j, tip);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  const bones = [];
  for (let k = 0; k <= nb; k++) {
    const b = new THREE.Bone();
    b.position.y = k === 0 ? 0 : step;
    if (k > 0) bones[k - 1].add(b);
    bones.push(b);
  }
  const mesh = new THREE.SkinnedMesh(g, material);
  mesh.add(bones[0]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false;
  return { mesh, bones };
}

/** Teardrop flame profile for a lathe. */
function flameGeometry(r, h) {
  const pts = [];
  for (let i = 0; i <= 9; i++) {
    const t = i / 9;
    const w = Math.sin(Math.PI * Math.pow(t, 0.55)) * Math.pow(1 - t, 0.35);
    pts.push(new THREE.Vector2(Math.max(0.0001, w * r), t * h - h * 0.18));
  }
  return new THREE.LatheGeometry(pts, 10);
}

/**
 * Builds the Charizard. Returns:
 *  group  – add to the moving player object (faces -Z),
 *  fx     – world-space ember particles (add to the scene root),
 *  saddle – an Object3D on the back between the wings for the rider,
 *  update(dt, { bank, pitch, speed, boosting, flap, wingPhase }) – animation,
 *  dispose().
 * `flap` (0..1) forces the flapping amount, otherwise it flaps on its own (more when boosting or climbing);
 * `wingPhase` freezes the wing beat (screenshots).
 */
export function createCharizard({ scale = 1 } = {}) {
  const disposables = new Set();
  const G = (g) => {
    disposables.add(g);
    return g;
  };
  const M = (m) => {
    disposables.add(m);
    return m;
  };
  const std = (color, extra = {}) => M(new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...extra }));
  const C = CHARIZARD_COLORS;
  const mats = {
    orange: std(C.orange, { emissive: C.orange, emissiveIntensity: 0.42 }),
    cream: std(C.cream, { emissive: C.cream, emissiveIntensity: 0.4 }),
    skin: std('#ffffff', { vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.42 }),
    wingTop: std(C.orange, { side: THREE.BackSide, emissive: C.orange, emissiveIntensity: 0.42 }),
    wingUnder: std(C.membrane, { side: THREE.FrontSide, emissive: C.membrane, emissiveIntensity: 0.55 }),
    white: std(C.white, { roughness: 0.3, emissive: '#555555', emissiveIntensity: 0.3 }),
    claw: std(C.claw, { roughness: 0.4 }),
    iris: std(C.iris, { roughness: 0.3, emissive: '#0b4d58', emissiveIntensity: 0.5 }),
    dark: std(C.dark, { roughness: 0.4 }),
  };
  // Skin glow follows the vertex colour (orange stays orange, the cream throat stays cream in shadow)
  mats.skin.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;');
  };
  const sphere = G(new THREE.SphereGeometry(1, 16, 12));
  const smallSphere = G(new THREE.SphereGeometry(1, 10, 8));

  const group = new THREE.Group();
  group.name = 'charizard';
  const rig = new THREE.Group(); // overall scale
  rig.scale.setScalar(scale);
  group.add(rig);
  const body = new THREE.Group(); // rolls, pitches, bobs
  rig.add(body);

  const blob = (parent, mat, [x, y, z], [sx, sy, sz], rot = null, geo = sphere) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(m);
    return m;
  };

  // ---- Torso: a pear-shaped lathe (hips fuller than the chest), axis along Z
  const TL = 1.5;
  const torsoR = (y) => {
    const t = Math.min(1, Math.max(0, y / TL));
    return 0.5 * Math.pow(Math.sin(Math.PI * t), 0.6) * (1 + 0.16 * Math.cos(Math.PI * t));
  };
  const profile = (y0, y1, n, k = 1) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const y = y0 + ((y1 - y0) * i) / n;
      pts.push(new THREE.Vector2(Math.max(0.0001, torsoR(y) * k), y));
    }
    return pts;
  };
  const torsoGeo = G(new THREE.LatheGeometry(profile(0, TL, 18), 16));
  // Lathe axis Y -> forward (-Z); lathe phi = 0 -> up (+Y), phi = PI -> belly (-Y)
  const toBody = (g) => {
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, 0.78);
    return g;
  };
  toBody(torsoGeo);
  const torso = new THREE.Mesh(torsoGeo, mats.orange);
  torso.scale.set(1.04, 0.94, 1);
  body.add(torso);
  // Cream belly: separate curved plates following the torso, with small gaps (segmented look)
  const plates = [
    [0.1, 0.36],
    [0.4, 0.64],
    [0.68, 0.92],
    [0.96, 1.18],
    [1.22, 1.42],
  ];
  const bellyGroup = new THREE.Group();
  bellyGroup.scale.copy(torso.scale);
  body.add(bellyGroup);
  plates.forEach(([a, b], i) => {
    const w = 1.95 - i * 0.12;
    const g = G(new THREE.LatheGeometry(profile(a, b, 5, 1.035), 10, Math.PI - w / 2, w));
    toBody(g);
    bellyGroup.add(new THREE.Mesh(g, mats.cream));
  });

  // ---- Saddle spot for the rider (between the wing roots)
  const saddle = new THREE.Object3D();
  saddle.position.set(0, 0.42, 0.22);
  body.add(saddle);

  // ---- Neck: skinned chain from the top of the chest, slightly S-shaped
  const neckMat = mats.skin;
  const throat = (a, t) => {
    const s = Math.sin(a); // -1 at local -Z = throat side
    return s < -0.35 && t < 0.97 ? C.cream : C.orange;
  };
  const neck = skinnedChain({ length: 0.72, bones: 3, radius: (t) => 0.23 - 0.06 * t, sz: 1.05, colorAt: throat, material: neckMat });
  const neckRoot = new THREE.Group();
  neckRoot.position.set(0, 0.14, -0.6);
  neckRoot.rotation.x = -0.38; // lean the chain forward
  neckRoot.add(neck.mesh);
  body.add(neckRoot);
  const NECK_REST = [-0.3, 0.12, 0.28, 0];
  neck.bones.forEach((b, i) => (b.rotation.x = NECK_REST[i]));
  const neckTotal = -0.38 + NECK_REST.reduce((a, b) => a + b, 0);

  // ---- Head (its own frame: forward -Z)
  const headPivot = new THREE.Group();
  neck.bones[neck.bones.length - 1].add(headPivot);
  const head = new THREE.Group();
  headPivot.add(head);
  head.position.set(0, 0.02, 0);
  head.scale.setScalar(1.3);
  // Cranium, muzzle, cream lower jaw
  blob(head, mats.orange, [0, 0.13, -0.06], [0.26, 0.24, 0.27]);
  blob(head, mats.orange, [0, 0.1, -0.38], [0.2, 0.15, 0.34], [0.1, 0, 0]);
  blob(head, mats.orange, [0, 0.1, -0.62], [0.15, 0.105, 0.12]);
  blob(head, mats.cream, [0, -0.03, -0.38], [0.17, 0.08, 0.32], [0.04, 0, 0]);
  blob(head, mats.cream, [0, -0.01, -0.06], [0.19, 0.12, 0.19]);
  // Brows
  for (const s of [-1, 1]) {
    blob(head, mats.orange, [s * 0.15, 0.26, -0.27], [0.1, 0.06, 0.13], [0.2, 0, s * -0.35]);
  }
  // Eyes: white, teal iris, black pupil, highlight
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.178, 0.2, -0.3);
    eye.lookAt(eye.position.x + s * 0.8, eye.position.y + 0.15, eye.position.z - 0.6);
    head.add(eye);
    blob(eye, mats.white, [0, 0, 0], [0.068, 0.082, 0.05], null, smallSphere);
    blob(eye, mats.iris, [0, -0.005, 0.03], [0.044, 0.056, 0.026], null, smallSphere);
    blob(eye, mats.dark, [0, -0.005, 0.045], [0.024, 0.036, 0.016], null, smallSphere);
    blob(eye, mats.white, [s * 0.012, 0.022, 0.054], [0.012, 0.012, 0.008], null, smallSphere);
  }
  // Nostrils and mouth line
  for (const s of [-1, 1]) {
    blob(head, mats.dark, [s * 0.06, 0.2, -0.7], [0.02, 0.014, 0.02], null, smallSphere);
    const mouth = new THREE.Mesh(G(sweepGeometry([v3(s * 0.18, 0.03, -0.12), v3(s * 0.175, 0.02, -0.3), v3(s * 0.135, 0.04, -0.58), v3(s * 0.07, 0.05, -0.7)], 0.008, { segs: 8, radial: 4 })), mats.dark);
    head.add(mouth);
  }
  // Horns pointing back
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(G(sweepGeometry([v3(s * 0.12, 0.28, -0.02), v3(s * 0.15, 0.36, 0.14), v3(s * 0.17, 0.42, 0.32), v3(s * 0.175, 0.47, 0.44)], (t) => 0.075 * (1 - t) + 0.004, { segs: 8, radial: 7 })), mats.orange);
    head.add(horn);
  }
  headPivot.rotation.x = -neckTotal; // head level with the body

  // ---- Arms with claws held forward
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.32, -0.08, -0.48);
    body.add(arm);
    arm.add(new THREE.Mesh(G(sweepGeometry([v3(0, 0, 0), v3(s * 0.08, -0.16, -0.05), v3(s * 0.06, -0.2, -0.26)], (t) => 0.085 - 0.03 * t, { segs: 8, radial: 7 })), mats.orange));
    const hand = new THREE.Group();
    hand.position.set(s * 0.06, -0.2, -0.28);
    arm.add(hand);
    blob(hand, mats.orange, [0, 0, 0], [0.07, 0.055, 0.08], null, smallSphere);
    for (const k of [-1, 0, 1]) {
      const claw = new THREE.Mesh(G(sweepGeometry([v3(k * 0.035, 0, -0.04), v3(k * 0.045, -0.02, -0.1), v3(k * 0.045, -0.05, -0.13)], (t) => 0.018 * (1 - t) + 0.002, { segs: 4, radial: 5 })), mats.claw);
      hand.add(claw);
    }
    arms.push(arm);
  }

  // ---- Legs bent back in flight pose, with feet and claws
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.3, -0.18, 0.42);
    body.add(leg);
    blob(leg, mats.orange, [s * 0.04, -0.02, 0.06], [0.2, 0.22, 0.3], [0.5, 0, 0]);
    leg.add(new THREE.Mesh(G(sweepGeometry([v3(s * 0.05, -0.12, 0.18), v3(s * 0.06, -0.24, 0.34), v3(s * 0.06, -0.26, 0.52)], (t) => 0.095 - 0.025 * t, { segs: 6, radial: 7 })), mats.orange));
    const foot = new THREE.Group();
    foot.position.set(s * 0.06, -0.27, 0.55);
    foot.rotation.x = 0.9;
    leg.add(foot);
    blob(foot, mats.orange, [0, 0, 0.06], [0.1, 0.06, 0.15], null, smallSphere);
    for (const k of [-1, 0, 1]) {
      const claw = new THREE.Mesh(G(sweepGeometry([v3(k * 0.05, 0, 0.16), v3(k * 0.06, -0.02, 0.23), v3(k * 0.06, -0.05, 0.27)], (t) => 0.022 * (1 - t) + 0.002, { segs: 4, radial: 5 })), mats.claw);
      foot.add(claw);
    }
    legs.push(leg);
  }

  // ---- Tail: skinned chain, thick at the base, curving up to the flame
  const tailColor = (a, t) => (Math.sin(a) > 0.55 && t < 0.85 ? C.cream : C.orange);
  const tail = skinnedChain({ length: 2.1, bones: 5, radius: (t) => 0.25 * Math.pow(1 - t, 0.85) + 0.06, sx: 1.05, colorAt: tailColor, material: mats.skin, segs: 22 });
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.0, 0.62);
  tailRoot.rotation.x = Math.PI / 2 + 0.42; // back and a little down, then up
  tailRoot.add(tail.mesh);
  body.add(tailRoot);
  const TAIL_REST = [0, -0.04, -0.14, -0.24, -0.34, -0.3];

  // ---- Tail flame
  const flameAnchor = new THREE.Group();
  tail.bones[tail.bones.length - 1].add(flameAnchor);
  flameAnchor.position.y = 0.05;
  const flame = new THREE.Group();
  flame.scale.setScalar(1.25);
  flameAnchor.add(flame);
  const add = (color, opacity, blending = THREE.AdditiveBlending) => M(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending, fog: false }));
  const flameLayers = [
    { geo: G(flameGeometry(0.27, 0.9)), mat: add('#f2380f', 0.62, THREE.NormalBlending), k: 0 },
    { geo: G(flameGeometry(0.2, 0.68)), mat: add('#ff8418', 0.78, THREE.NormalBlending), k: 1.7 },
    { geo: G(flameGeometry(0.13, 0.48)), mat: add('#ffc928', 0.85), k: 3.1 },
    { geo: G(flameGeometry(0.065, 0.28)), mat: add('#fff3b0', 0.9), k: 4.4 },
  ].map((l, i) => {
    const m = new THREE.Mesh(l.geo, l.mat);
    m.renderOrder = 3 + i; // outer layers first, the hot core last
    flame.add(m);
    return { m, k: l.k };
  });
  const glowTex = radialTexture(32);
  disposables.add(glowTex);
  const glow = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: glowTex, color: '#ff7a20', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  glow.scale.set(1.3, 1.3, 1);
  glow.position.y = 0.15;
  glow.renderOrder = 7;
  flame.add(glow);

  // ---- Wings: inner panel on the shoulder hinge, outer panel folding about the middle strut
  const W = { S: [0, 0], E: [1.02, -0.3], Wr: [1.72, -0.12], T1: [3.05, 0.5], T2: [2.15, 1.3], T3: [1.15, 1.38], R: [0.12, 0.92] };
  const toward = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // Lay a shape (x, z) flat in the wing plane; front faces (normal -Y) are the teal underside
  const membraneGeo = (outline, origin) => {
    const shape = new THREE.Shape();
    outline(shape);
    const sg = new THREE.ShapeGeometry(shape, 6);
    const p = sg.attributes.position;
    const n = sg.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getY(i);
      // gentle billow: the membrane sags a little behind the leading edge
      const y = -0.06 * Math.max(0, z + 0.2) * (1 - Math.min(1, x / 3.4) * 0.5);
      p.setXYZ(i, x - origin[0], y, z - origin[1]);
      n.setXYZ(i, 0, -1, 0);
    }
    sg.computeBoundingSphere();
    return G(sg);
  };
  const scallop = (shape, from, to, pull) => {
    const c = toward(mid(from, to), W.Wr, pull);
    shape.quadraticCurveTo(c[0], c[1], to[0], to[1]);
  };
  const innerGeo = membraneGeo((sh) => {
    sh.moveTo(W.S[0], W.S[1]);
    sh.lineTo(W.E[0], W.E[1]);
    sh.lineTo(W.Wr[0], W.Wr[1]);
    sh.lineTo(W.T2[0], W.T2[1]);
    scallop(sh, W.T2, W.T3, 0.3);
    const c = toward(mid(W.T3, W.R), [0.6, 0.2], 0.35);
    sh.quadraticCurveTo(c[0], c[1], W.R[0], W.R[1]);
    sh.lineTo(W.S[0], W.S[1]);
  }, [0, 0]);
  const outerGeo = membraneGeo((sh) => {
    sh.moveTo(W.Wr[0], W.Wr[1]);
    sh.quadraticCurveTo(2.5, -0.2, W.T1[0], W.T1[1]);
    scallop(sh, W.T1, W.T2, 0.32);
    sh.lineTo(W.Wr[0], W.Wr[1]);
  }, W.Wr);
  const bone = (pts, r0, r1, origin = [0, 0]) =>
    G(sweepGeometry(pts.map(([x, z]) => v3(x - origin[0], 0.0, z - origin[1])), (t) => r0 + (r1 - r0) * t, { segs: 8, radial: 6 }));
  const armBoneGeo = bone([W.S, W.E, W.Wr], 0.085, 0.055);
  const strutInner = [bone([W.Wr, toward(W.Wr, W.T3, 0.5), W.T3], 0.045, 0.012), bone([W.Wr, toward(W.Wr, W.T2, 0.5), W.T2], 0.045, 0.014)];
  const strutOuter = bone([W.Wr, [2.5, -0.12], W.T1], 0.05, 0.012, W.Wr);
  const hingeAxis = new THREE.Vector3(W.T2[0] - W.Wr[0], 0, W.T2[1] - W.Wr[1]).normalize();
  const wings = [];
  for (const s of [-1, 1]) {
    const side = new THREE.Group();
    side.scale.x = s; // left wing is the mirror image
    side.position.set(0, 0.36, -0.3);
    body.add(side);
    const root = new THREE.Group();
    root.position.x = 0.2;
    side.add(root);
    root.add(new THREE.Mesh(innerGeo, mats.wingUnder), new THREE.Mesh(innerGeo, mats.wingTop), new THREE.Mesh(armBoneGeo, mats.orange));
    for (const g of strutInner) root.add(new THREE.Mesh(g, mats.orange));
    blob(root, mats.orange, [0.05, 0, 0.02], [0.14, 0.1, 0.16], null, smallSphere); // shoulder
    blob(root, mats.orange, [W.Wr[0], 0, W.Wr[1]], [0.075, 0.065, 0.075], null, smallSphere); // wrist knuckle
    const outer = new THREE.Group();
    outer.position.set(W.Wr[0], 0, W.Wr[1]);
    root.add(outer);
    outer.add(new THREE.Mesh(outerGeo, mats.wingUnder), new THREE.Mesh(outerGeo, mats.wingTop), new THREE.Mesh(strutOuter, mats.orange));
    // Small wrist claw
    const claw = new THREE.Mesh(G(sweepGeometry([v3(0, 0, 0), v3(0.04, 0.03, -0.08), v3(0.03, 0.02, -0.14)], (t) => 0.03 * (1 - t) + 0.002, { segs: 4, radial: 5 })), mats.claw);
    outer.add(claw);
    const tip = new THREE.Object3D();
    tip.position.set(W.T1[0] - W.Wr[0], 0, W.T1[1] - W.Wr[1]);
    outer.add(tip);
    wings.push({ root, outer, tip });
  }

  // ---- World-space embers trailing from the flame
  const EMBERS = 48;
  const emberGeo = new THREE.BufferGeometry();
  const ePos = new Float32Array(EMBERS * 3).fill(0);
  const eCol = new Float32Array(EMBERS * 3).fill(0);
  emberGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  emberGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
  disposables.add(emberGeo);
  const emberMat = M(new THREE.PointsMaterial({ size: 0.38 * scale, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  const fx = new THREE.Points(emberGeo, emberMat);
  fx.frustumCulled = false;
  const embers = Array.from({ length: EMBERS }, () => ({ life: 0, max: 1, x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0 }));
  let emberCursor = 0;
  let emberAcc = 0;

  // ---- Animation state
  const st = { t: 0, phase: 0, flap: 0, bank: 0, pitch: 0, tailYaw: [0, 0, 0, 0, 0, 0], cycle: 0, boost: 0, lastPitch: 0, pitchVel: 0 };
  const qParent = new THREE.Quaternion();
  const qWant = new THREE.Quaternion();
  const qLean = new THREE.Quaternion();
  const axisX = new THREE.Vector3(1, 0, 0);
  const tipPos = new THREE.Vector3();
  const qOuter = new THREE.Quaternion();
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

  function update(dt = 1 / 60, { bank = 0, pitch = 0, speed = 30, boosting = false, flap, wingPhase } = {}) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    st.t += dt;
    st.cycle = (st.cycle + dt) % 4.2;
    st.boost = ease(st.boost, boosting ? 1 : 0, 4, dt);
    st.bank = ease(st.bank, bank, 5, dt);
    st.pitch = ease(st.pitch, pitch, 5, dt);
    st.pitchVel = ease(st.pitchVel, (pitch - st.lastPitch) / Math.max(dt, 1e-3), 3, dt);
    st.lastPitch = pitch;
    // Flap: always when boosting or climbing, otherwise a few beats then a glide
    const auto = boosting || pitch > 0.12 ? 1 : st.cycle < 1.5 ? 0.8 : 0;
    st.flap = ease(st.flap, typeof flap === 'number' ? flap : auto, 3, dt);
    const hz = 1.6 + 1.1 * st.boost + Math.max(0, pitch) * 1.5;
    st.phase = typeof wingPhase === 'number' ? wingPhase : (st.phase + dt * hz * TAU) % TAU;
    const ph = st.phase;
    const fl = st.flap;
    const t = st.t;

    // Body: roll into turns, nose follows the pitch, bob against the wing beat, breathe
    body.rotation.z = -st.bank * 0.55;
    body.rotation.x = 0.1 + st.pitch * 0.45;
    body.rotation.y = st.bank * 0.08;
    body.position.y = -Math.sin(ph) * 0.07 * fl + Math.sin(t * 1.3) * 0.03;
    const breath = 1 + Math.sin(t * 2.4) * 0.018;
    torso.scale.set(1.04 * breath, 0.94 * breath, 1);
    bellyGroup.scale.copy(torso.scale);

    // Wings
    const glide = 0.14 + Math.sin(t * 1.4) * 0.03;
    const rootA = glide + fl * (0.18 + 0.72 * Math.sin(ph));
    const outerA = -0.04 + fl * 0.6 * Math.sin(ph - 1.1) - (1 - fl) * 0.06;
    for (const w of wings) {
      w.root.rotation.set(fl * 0.16 * Math.cos(ph), 0, rootA);
      qOuter.setFromAxisAngle(hingeAxis, -outerA);
      w.outer.quaternion.copy(qOuter);
    }
    // Arms and legs: small sway
    arms.forEach((a, i) => (a.rotation.x = -0.1 + Math.sin(t * 2 + i) * 0.06 - fl * 0.05 * Math.sin(ph)));
    legs.forEach((l, i) => (l.rotation.x = 0.15 + Math.sin(t * 1.6 + i * 0.7) * 0.05 + fl * 0.04 * Math.sin(ph + 0.5)));

    // Neck and head look into the turn and stay level
    neck.bones.forEach((b, i) => {
      b.rotation.x = NECK_REST[i] + (i === 1 ? Math.sin(ph + 0.6) * 0.05 * fl : 0) - st.pitchVel * 0.03;
      b.rotation.z = -st.bank * 0.12;
    });
    headPivot.rotation.set(-neckTotal - st.pitch * 0.35 + Math.sin(t * 1.1) * 0.03, -st.bank * 0.45, st.bank * 0.35);

    // Tail lags behind the turn and swings out, with a slow wave
    for (let i = 0; i < tail.bones.length; i++) {
      const target = st.bank * (0.1 + i * 0.05);
      st.tailYaw[i] = ease(st.tailYaw[i], target, 6 - i * 0.8, dt);
      tail.bones[i].rotation.z = st.tailYaw[i] + Math.sin(t * 1.7 - i * 0.7) * 0.05;
      tail.bones[i].rotation.x = TAIL_REST[i] + Math.sin(t * 1.3 - i * 0.6) * 0.03 + st.pitchVel * 0.02 * i;
    }

    // Flame: upright in the world, leaning back with speed, flickering
    group.updateWorldMatrix(true, true);
    flameAnchor.getWorldQuaternion(qParent).invert();
    group.getWorldQuaternion(qWant);
    qLean.setFromAxisAngle(axisX, 0.35 + Math.min(0.6, speed / 80) + st.boost * 0.25);
    qWant.multiply(qLean);
    flame.quaternion.copy(qParent.multiply(qWant));
    const big = 1 + st.boost * 0.45;
    for (const l of flameLayers) {
      const k = l.k;
      const sy = 1 + Math.sin(t * 17 + k) * 0.16 + Math.sin(t * 29 + k * 2) * 0.09;
      const sx = 1 + Math.sin(t * 23 + k * 1.3) * 0.08;
      l.m.scale.set(sx * big, sy * big, sx * big);
      l.m.rotation.y = t * 3 + k;
    }
    const g = 1.1 * big * (1 + Math.sin(t * 19) * 0.08);
    glow.scale.set(g, g, 1);
    glow.material.opacity = 0.4 + st.boost * 0.3;

    // Embers in world space
    flameAnchor.getWorldPosition(tipPos);
    emberAcc += dt * (14 + st.boost * 30);
    while (emberAcc >= 1) {
      emberAcc -= 1;
      const e = embers[emberCursor];
      emberCursor = (emberCursor + 1) % EMBERS;
      e.x = tipPos.x + (Math.random() - 0.5) * 0.3 * scale;
      e.y = tipPos.y + (0.2 + Math.random() * 0.3) * scale;
      e.z = tipPos.z + (Math.random() - 0.5) * 0.3 * scale;
      e.vx = (Math.random() - 0.5) * 1.5 * scale;
      e.vy = (1 + Math.random() * 1.5) * scale;
      e.vz = (Math.random() - 0.5) * 1.5 * scale;
      e.max = e.life = 0.2 + Math.random() * 0.25;
    }
    for (let i = 0; i < EMBERS; i++) {
      const e = embers[i];
      if (e.life > 0) {
        e.life -= dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.z += e.vz * dt;
      }
      const f = Math.max(0, e.life / e.max);
      ePos[i * 3] = e.x;
      ePos[i * 3 + 1] = e.life > 0 ? e.y : -9999;
      ePos[i * 3 + 2] = e.z;
      eCol[i * 3] = f;
      eCol[i * 3 + 1] = f * (0.2 + 0.45 * f);
      eCol[i * 3 + 2] = f * f * 0.15;
    }
    emberGeo.attributes.position.needsUpdate = true;
    emberGeo.attributes.color.needsUpdate = true;
  }

  function dispose() {
    group.traverse((o) => {
      if (o.geometry) disposables.add(o.geometry);
      if (o.material) disposables.add(o.material);
      if (o.isSkinnedMesh) o.skeleton.dispose();
    });
    for (const d of disposables) d.dispose?.();
    disposables.clear();
    fx.removeFromParent();
    group.removeFromParent();
  }

  update(0);
  return { group, fx, saddle, wings, flame, tail: tail.mesh, scale, update, dispose };
}
