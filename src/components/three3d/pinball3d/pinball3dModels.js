// Procedural chibi Pokémon for "Pinball Pokémon" (no model files): Voltorb / Electrode bumpers,
// Diglett drop targets, Psyduck, Cloyster (ramp catcher), six wild Pokémon and a Poké Ball.
// Local frame of every model: +Y up, the face looks at +Z (towards the player).
import * as THREE from 'three';

const TAU = Math.PI * 2;
const Z = new THREE.Vector3(0, 0, 1);

/** Shared geometries and materials for all models (disposed together). */
export function createModelKit() {
  const geos = new Set();
  const mats = new Map();
  const G = (g) => {
    geos.add(g);
    return g;
  };
  const sphere = G(new THREE.SphereGeometry(1, 20, 14));
  const smallSphere = G(new THREE.SphereGeometry(1, 12, 9));
  const cone = G(new THREE.ConeGeometry(1, 1, 14, 1));
  const cyl = G(new THREE.CylinderGeometry(1, 1, 1, 18, 1));
  /** Cached standard material (key = colour + options). `glow` brightens it a little, like the Charizard. */
  const mat = (color, { glow = 0.28, rough = 0.5, metal = 0, emissive = null, ei = null, transparent = false, opacity = 1, side = THREE.FrontSide } = {}) => {
    const key = [color, glow, rough, metal, emissive, ei, transparent, opacity, side].join('|');
    if (!mats.has(key)) {
      mats.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: emissive || color, emissiveIntensity: ei ?? glow, transparent, opacity, side })
      );
    }
    return mats.get(key);
  };
  const dispose = () => {
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  };
  return { G, sphere, smallSphere, cone, cyl, mat, dispose };
}

function blob(kit, parent, color, [x, y, z], [sx, sy, sz], { rot = null, geo = null, opts } = {}) {
  const m = new THREE.Mesh(geo || kit.sphere, typeof color === 'string' ? kit.mat(color, opts) : color);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}

/** Orients a flattened part so that its local +Z points along `dir` (outwards from a surface). */
function face(m, dir, spin = 0) {
  m.quaternion.setFromUnitVectors(Z, dir.clone().normalize());
  if (spin) m.rotateZ(spin);
  return m;
}

/**
 * A cute eye on a sphere (centre c, radius r) at the spherical direction (yaw, pitch):
 * a black oval, a white highlight, optionally a coloured iris.
 */
function eye(kit, parent, c, r, yaw, pitch, size, { iris = null, white = false, spin = 0, tall = 1.25 } = {}) {
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const at = (k) => new THREE.Vector3(c[0], c[1], c[2]).addScaledVector(dir, r * k);
  const g = new THREE.Group();
  if (white) {
    const w = blob(kit, g, '#ffffff', [0, 0, 0], [size * 1.25, size * 1.25 * tall, size * 0.4], { opts: { glow: 0.5, rough: 0.3 } });
    face(w, dir, spin).position.copy(at(0.97));
  }
  const p = blob(kit, g, iris || '#151520', [0, 0, 0], [size * 0.78, size * tall * 0.95, size * 0.35], { opts: { glow: iris ? 0.35 : 0.05, rough: 0.25 } });
  face(p, dir, spin).position.copy(at(white ? 1.0 : 0.98));
  if (iris) {
    const pu = blob(kit, g, '#151520', [0, 0, 0], [size * 0.42, size * 0.55 * tall, size * 0.3], { opts: { glow: 0.05 } });
    face(pu, dir, spin).position.copy(at(1.02));
  }
  const hl = blob(kit, g, '#ffffff', [0, 0, 0], [size * 0.28, size * 0.28, size * 0.2], { geo: kit.smallSphere, opts: { glow: 1, rough: 0.2 } });
  hl.position.copy(at(1.04)).add(new THREE.Vector3(-size * 0.25, size * 0.32, 0));
  parent.add(g);
  return g;
}

/** A sphere whose top is one colour and bottom another (Voltorb / Electrode / Poké Ball). */
function twoToneSphere(kit, top, bottom, radius, opts) {
  const g = new THREE.Group();
  const hiGeo = kit.G(new THREE.SphereGeometry(radius, 28, 12, 0, TAU, 0, Math.PI / 2));
  const loGeo = kit.G(new THREE.SphereGeometry(radius, 28, 12, 0, TAU, Math.PI / 2, Math.PI / 2));
  g.add(new THREE.Mesh(hiGeo, kit.mat(top, opts)));
  g.add(new THREE.Mesh(loGeo, kit.mat(bottom, opts)));
  const seam = new THREE.Mesh(kit.G(new THREE.TorusGeometry(radius * 1.0, radius * 0.035, 6, 40)), kit.mat('#3b2a2a', { glow: 0.05 }));
  seam.rotation.x = Math.PI / 2;
  g.add(seam);
  return g;
}

/** A thin curved line (mouth, brow) as a tube along points. */
function tube(kit, parent, pts, r, color, opts) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(kit.G(new THREE.TubeGeometry(curve, 14, r, 6, false)), kit.mat(color, opts));
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------- Voltorb / Electrode
/** Pop bumper Pokémon (radius ~0.5). `electrode` = white on top, red below, wide grin. */
export function createVoltorb(kit, { electrode = false } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const R = 0.46;
  const ball = twoToneSphere(kit, electrode ? '#f4f4f6' : '#e8323c', electrode ? '#e8323c' : '#f4f4f6', R, { glow: 0.3, rough: 0.28 });
  ball.position.y = R;
  body.add(ball);
  const c = [0, R, 0];
  // Eyes slightly above the seam; Voltorb glares, Electrode looks wide awake
  for (const sx of [-1, 1]) {
    eye(kit, body, c, R, sx * 0.36, electrode ? 0.28 : 0.2, electrode ? 0.085 : 0.075, { white: true, tall: electrode ? 1.1 : 0.85, spin: sx * (electrode ? 0 : 0.25) });
    // Brow wedge (angry)
    const brow = blob(kit, body, '#151520', [0, 0, 0], [0.12, 0.03, 0.03], { opts: { glow: 0.02 } });
    const dir = new THREE.Vector3(Math.sin(sx * 0.36) * Math.cos(0.38), Math.sin(0.38), Math.cos(sx * 0.36) * Math.cos(0.38));
    brow.position.set(0, R, 0).addScaledVector(dir, R * 1.01);
    face(brow, dir, sx * (electrode ? -0.15 : -0.45));
  }
  if (electrode) {
    // Big grin below the seam
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = -0.55 + (1.1 * i) / 10;
      const p = -0.22 - Math.cos((a / 0.55) * (Math.PI / 2)) * 0.12;
      pts.push([Math.sin(a) * Math.cos(p) * R * 1.01, R + Math.sin(p) * R * 1.01, Math.cos(a) * Math.cos(p) * R * 1.01]);
    }
    tube(kit, body, pts, 0.018, '#151520', { glow: 0.02 });
  }
  // Highlight
  blob(kit, body, '#ffffff', [-0.16, R + 0.3, 0.2], [0.08, 0.05, 0.04], { opts: { glow: 1, rough: 0.1 }, rot: [0.6, 0, 0.5] });
  let squash = 0;
  let t = Math.random() * 10;
  return {
    group,
    hit() {
      squash = 1;
    },
    update(dt, { charge = 0 } = {}) {
      t += dt;
      squash = Math.max(0, squash - dt * 4.5);
      const s = Math.sin(squash * Math.PI) * squash;
      body.scale.set(1 + s * 0.22, 1 - s * 0.32, 1 + s * 0.22);
      body.rotation.y = Math.sin(t * (electrode ? 2.2 : 1.6)) * 0.25 + charge * Math.sin(t * 40) * 0.08;
      body.position.y = Math.abs(Math.sin(t * 2.4)) * 0.03;
    },
  };
}

// ---------------------------------------------------------------- Diglett
/** Drop target Diglett (about 0.75 tall). `pop` 0..1 is how far it stands out of its hole. */
export function createDiglett(kit) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = t * 0.8;
    const r = t < 0.7 ? 0.24 + t * 0.02 : 0.258 * Math.sqrt(Math.max(0, 1 - ((t - 0.7) / 0.3) ** 2));
    pts.push(new THREE.Vector2(Math.max(0.001, r), y - 0.3));
  }
  const bodyGeo = kit.G(new THREE.LatheGeometry(pts, 22));
  body.add(new THREE.Mesh(bodyGeo, kit.mat('#9a6a3e', { glow: 0.3, rough: 0.6 })));
  const c = [0, 0.27, 0];
  for (const sx of [-1, 1]) eye(kit, body, c, 0.25, sx * 0.3, 0.12, 0.055, { tall: 1.6 });
  blob(kit, body, '#f06aa6', [0, 0.18, 0.24], [0.1, 0.07, 0.07], { opts: { glow: 0.45, rough: 0.3 } });
  blob(kit, body, '#ffffff', [-0.03, 0.21, 0.31], [0.025, 0.018, 0.012], { opts: { glow: 1 } });
  let squash = 0;
  let t = Math.random() * 5;
  return {
    group,
    hit() {
      squash = 1;
    },
    update(dt, { pop = 1, cheer = 0 } = {}) {
      t += dt;
      squash = Math.max(0, squash - dt * 5);
      body.position.y = -0.62 * (1 - pop) + cheer * Math.abs(Math.sin(t * 9)) * 0.12;
      body.scale.set(1 + squash * 0.2, 1 - squash * 0.25, 1 + squash * 0.2);
      body.rotation.y = Math.sin(t * 1.3) * 0.25;
      body.rotation.z = Math.sin(t * 2.1) * 0.04 + cheer * Math.sin(t * 12) * 0.12;
      body.visible = pop > 0.02;
    },
  };
}

// ---------------------------------------------------------------- Psyduck
/** Psyduck holding its head (about 0.9 tall); `spin` makes it flail and its head wobble. */
export function createPsyduck(kit) {
  const group = new THREE.Group();
  const Y = '#f7d23e';
  const body = new THREE.Group();
  group.add(body);
  blob(kit, body, Y, [0, 0.27, 0], [0.24, 0.26, 0.22]);
  for (const sx of [-1, 1]) blob(kit, body, '#f4c9a0', [sx * 0.11, 0.03, 0.06], [0.1, 0.05, 0.14]);
  const head = new THREE.Group();
  head.position.y = 0.6;
  body.add(head);
  blob(kit, head, Y, [0, 0, 0], [0.27, 0.25, 0.25]);
  // Beak
  blob(kit, head, '#f4c9a0', [0, -0.06, 0.22], [0.15, 0.06, 0.12], { opts: { glow: 0.3 } });
  blob(kit, head, '#e8b488', [0, -0.11, 0.2], [0.12, 0.04, 0.1]);
  for (const sx of [-1, 1]) eye(kit, head, [0, 0, 0], 0.255, sx * 0.38, 0.12, 0.05, { white: true, tall: 1.0 });
  // Three hair strands
  for (const a of [-0.25, 0, 0.25]) tube(kit, head, [[0, 0.22, 0], [a * 0.3, 0.33, 0.02], [a * 0.6, 0.38, -0.02]], 0.012, '#151520', { glow: 0.02 });
  // Arms holding the head
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.2, 0.42, 0.02);
    body.add(arm);
    blob(kit, arm, Y, [sx * 0.06, 0.1, 0], [0.06, 0.16, 0.06], { rot: [0, 0, -sx * 0.6] });
    arms.push(arm);
  }
  let t = 0;
  return {
    group,
    head,
    update(dt, { spin = 0 } = {}) {
      t += dt;
      const k = Math.min(1, spin);
      head.rotation.z = Math.sin(t * (2 + k * 14)) * (0.08 + k * 0.2);
      head.rotation.y = Math.sin(t * 0.9) * 0.3;
      arms.forEach((a, i) => {
        a.rotation.z = (i ? -1 : 1) * (Math.sin(t * (3 + k * 16) + i) * (0.05 + k * 0.4));
      });
      body.position.y = Math.abs(Math.sin(t * (1.5 + k * 8))) * (0.02 + k * 0.06);
    },
  };
}

// ---------------------------------------------------------------- Cloyster
/** Cloyster's spiky shell that opens to eat the ramp ball and spit it out (about 1.1 wide). */
export function createCloyster(kit) {
  const group = new THREE.Group();
  const shellMat = kit.mat('#8e86c4', { glow: 0.3, rough: 0.35, side: THREE.DoubleSide });
  const rimMat = kit.mat('#d6d0f2', { glow: 0.35, rough: 0.3 });
  const spikeMat = kit.mat('#ece8ff', { glow: 0.35, rough: 0.3 });
  /** Scalloped half-shell: a flattened hemisphere with ridges, opening along -Y (bottom half) or +Y. */
  const halfShell = (up) => {
    const g = kit.G(new THREE.SphereGeometry(0.55, 32, 10, 0, TAU, 0, Math.PI / 2));
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const a = Math.atan2(v.z, v.x);
      const ridge = 1 + 0.07 * Math.cos(a * 9);
      p.setXYZ(i, v.x * ridge, v.y * 0.62 * (up ? 1 : -1), v.z * ridge);
    }
    g.computeVertexNormals();
    return g;
  };
  // Hinge at the back (-Z): shells rotate about X
  const lower = new THREE.Group();
  const upper = new THREE.Group();
  lower.position.z = -0.45;
  upper.position.z = -0.45;
  group.add(lower, upper);
  const lowShell = new THREE.Mesh(halfShell(false), shellMat);
  lowShell.position.z = 0.45;
  lower.add(lowShell);
  const upShell = new THREE.Mesh(halfShell(true), shellMat);
  upShell.position.z = 0.45;
  upper.add(upShell);
  for (const [grp, sy] of [[lower, -1], [upper, 1]]) {
    const rim = new THREE.Mesh(kit.G(new THREE.TorusGeometry(0.56, 0.035, 6, 48)), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, sy * 0.01, 0.45);
    grp.add(rim);
  }
  // Spikes on the top shell
  for (let i = 0; i < 6; i++) {
    const a = -0.7 + (i / 5) * 1.4 + Math.PI / 2;
    const sp = new THREE.Mesh(kit.cone, spikeMat);
    const r = i % 2 ? 0.42 : 0.3;
    sp.position.set(Math.cos(a) * r * 0.9, 0.24 + (i % 2 ? 0 : 0.06), 0.45 - Math.sin(a) * r * 0.5 - 0.05);
    sp.scale.set(0.07, 0.26, 0.07);
    sp.rotation.set(-0.5, 0, Math.cos(a) * -0.6);
    upper.add(sp);
  }
  const top = new THREE.Mesh(kit.cone, spikeMat);
  top.position.set(0, 0.36, 0.25);
  top.scale.set(0.09, 0.36, 0.09);
  top.rotation.x = -0.3;
  upper.add(top);
  // The dark pearl inside, with eyes and a horn
  const pearl = new THREE.Group();
  pearl.position.set(0, 0.03, 0.05);
  group.add(pearl);
  blob(kit, pearl, '#3d3560', [0, 0, 0], [0.27, 0.25, 0.27], { opts: { glow: 0.15, rough: 0.2 } });
  for (const sx of [-1, 1]) eye(kit, pearl, [0, 0, 0], 0.26, sx * 0.4, 0.08, 0.055, { white: true, tall: 0.75, spin: sx * 0.3 });
  const horn = new THREE.Mesh(kit.cone, kit.mat('#5c5288', { glow: 0.2 }));
  horn.position.set(0, 0.3, 0.03);
  horn.scale.set(0.07, 0.22, 0.07);
  pearl.add(horn);
  let open = 0;
  let target = 0;
  let t = 0;
  let gulp = 0;
  return {
    group,
    mouth: pearl,
    update(dt, { opening = 0, eat = 0 } = {}) {
      t += dt;
      target = Math.max(opening, 0.38 + Math.sin(t * 1.6) * 0.08);
      open += (target - open) * Math.min(1, dt * 12);
      upper.rotation.x = -open * 0.95;
      lower.rotation.x = open * 0.15;
      gulp = Math.max(gulp - dt * 3, eat);
      const g = Math.sin(gulp * Math.PI);
      group.scale.set(1 + g * 0.12, 1 - g * 0.08, 1 + g * 0.12);
      pearl.position.y = 0.03 + open * 0.08;
    },
  };
}

// ---------------------------------------------------------------- wild Pokémon
function pikachu(kit, root) {
  const Y = '#f9d548';
  blob(kit, root, Y, [0, 0.33, 0], [0.3, 0.32, 0.27]);
  const head = new THREE.Group();
  head.position.y = 0.82;
  root.add(head);
  blob(kit, head, Y, [0, 0, 0], [0.36, 0.32, 0.32]);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(sx * 0.2, 0.24, 0);
    ear.rotation.z = -sx * 0.45;
    head.add(ear);
    blob(kit, ear, Y, [0, 0.22, 0], [0.08, 0.26, 0.06]);
    blob(kit, ear, '#1f1f28', [0, 0.42, 0], [0.065, 0.1, 0.05], { opts: { glow: 0.05 } });
    eye(kit, head, [0, 0, 0], 0.32, sx * 0.42, 0.08, 0.06, { tall: 1.1 });
    blob(kit, head, '#ef4444', [sx * 0.24, -0.1, 0.2], [0.075, 0.06, 0.04], { opts: { glow: 0.4 }, rot: [0, sx * 0.7, 0] });
    blob(kit, root, Y, [sx * 0.26, 0.42, 0.12], [0.06, 0.12, 0.06], { rot: [0.5, 0, sx * 0.6] });
    blob(kit, root, Y, [sx * 0.15, 0.05, 0.08], [0.1, 0.06, 0.14]);
  }
  blob(kit, head, '#2a1a12', [0, -0.03, 0.315], [0.02, 0.014, 0.01]);
  tube(kit, head, [[-0.06, -0.09, 0.3], [-0.03, -0.11, 0.31], [0, -0.09, 0.315], [0.03, -0.11, 0.31], [0.06, -0.09, 0.3]], 0.008, '#2a1a12', { glow: 0.02 });
  // Lightning tail
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(0.12, 0.05);
  sh.lineTo(0.08, 0.22);
  sh.lineTo(0.26, 0.28);
  sh.lineTo(0.2, 0.5);
  sh.lineTo(0.5, 0.62);
  sh.lineTo(0.36, 0.34);
  sh.lineTo(0.18, 0.3);
  sh.lineTo(0.22, 0.12);
  sh.lineTo(0.04, 0.08);
  sh.closePath();
  const tail = new THREE.Mesh(kit.G(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 })), kit.mat(Y));
  tail.position.set(0.12, 0.2, -0.28);
  tail.rotation.y = -0.6;
  root.add(tail);
  return head;
}

function bulbasaur(kit, root) {
  const T = '#6cc6a8';
  blob(kit, root, T, [0, 0.27, -0.05], [0.34, 0.24, 0.36]);
  for (const [x, z] of [[-0.2, 0.15], [0.2, 0.15], [-0.2, -0.22], [0.2, -0.22]]) blob(kit, root, T, [x, 0.08, z], [0.09, 0.1, 0.09]);
  // Bulb
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(Math.max(0.001, Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.28 * (1 - t * 0.3)), t * 0.5));
  }
  const bulb = new THREE.Mesh(kit.G(new THREE.LatheGeometry(pts, 16)), kit.mat('#3f9a4a', { glow: 0.3 }));
  bulb.position.set(0, 0.4, -0.15);
  root.add(bulb);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    blob(kit, root, '#2f7d3a', [Math.cos(a) * 0.18, 0.62, -0.15 + Math.sin(a) * 0.18], [0.02, 0.18, 0.08], { rot: [Math.sin(a) * 0.4, -a, Math.cos(a) * 0.4] });
  }
  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.25);
  root.add(head);
  blob(kit, head, T, [0, 0, 0], [0.32, 0.25, 0.27]);
  for (const sx of [-1, 1]) {
    eye(kit, head, [0, 0, 0], 0.27, sx * 0.5, 0.15, 0.065, { white: true, iris: '#d23c3c', tall: 1.0 });
    blob(kit, head, T, [sx * 0.22, 0.2, -0.02], [0.07, 0.08, 0.05], { rot: [0, 0, -sx * 0.5] });
    blob(kit, root, '#3f8f7a', [sx * 0.24, 0.32, -0.02], [0.08, 0.06, 0.08]);
  }
  tube(kit, head, [[-0.1, -0.08, 0.24], [0, -0.12, 0.26], [0.1, -0.08, 0.24]], 0.01, '#2a3a30', { glow: 0.02 });
  return head;
}

function charmander(kit, root) {
  const O = '#f3913f';
  blob(kit, root, O, [0, 0.32, 0], [0.27, 0.32, 0.25]);
  blob(kit, root, '#fbe1a0', [0, 0.28, 0.12], [0.18, 0.22, 0.15]);
  const head = new THREE.Group();
  head.position.y = 0.8;
  root.add(head);
  blob(kit, head, O, [0, 0, 0.02], [0.32, 0.29, 0.31]);
  for (const sx of [-1, 1]) {
    eye(kit, head, [0, 0, 0.02], 0.3, sx * 0.4, 0.1, 0.065, { white: true, iris: '#2b6fd6', tall: 1.2 });
    blob(kit, root, O, [sx * 0.24, 0.42, 0.1], [0.06, 0.13, 0.06], { rot: [0.5, 0, sx * 0.7] });
    blob(kit, root, O, [sx * 0.13, 0.05, 0.08], [0.09, 0.06, 0.13]);
  }
  tube(kit, head, [[-0.1, -0.1, 0.27], [0, -0.14, 0.3], [0.1, -0.1, 0.27]], 0.012, '#7a2e10', { glow: 0.02 });
  // Tail with a flame
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.15, -0.2), new THREE.Vector3(0.1, 0.12, -0.42), new THREE.Vector3(0.22, 0.28, -0.55), new THREE.Vector3(0.26, 0.48, -0.55)]);
  root.add(new THREE.Mesh(kit.G(new THREE.TubeGeometry(curve, 12, 0.06, 8, false)), kit.mat(O)));
  const flame = new THREE.Group();
  flame.position.set(0.26, 0.55, -0.55);
  root.add(flame);
  const f1 = new THREE.Mesh(kit.cone, kit.mat('#ff6a1a', { emissive: '#ff6a1a', ei: 1.2 }));
  f1.scale.set(0.09, 0.26, 0.09);
  f1.position.y = 0.08;
  const f2 = new THREE.Mesh(kit.cone, kit.mat('#ffe066', { emissive: '#ffe066', ei: 1.4 }));
  f2.scale.set(0.05, 0.16, 0.05);
  f2.position.y = 0.05;
  flame.add(f1, f2);
  head.userData.flame = flame;
  return head;
}

function squirtle(kit, root) {
  const B = '#7cc4ec';
  blob(kit, root, B, [0, 0.33, 0], [0.26, 0.3, 0.24]);
  blob(kit, root, '#f2e2a4', [0, 0.3, 0.12], [0.19, 0.24, 0.14]);
  blob(kit, root, '#a8643a', [0, 0.36, -0.1], [0.3, 0.32, 0.22], { opts: { glow: 0.25, rough: 0.4 } });
  const rim = new THREE.Mesh(kit.G(new THREE.TorusGeometry(0.27, 0.04, 8, 30)), kit.mat('#f5ead0'));
  rim.position.set(0, 0.36, -0.02);
  rim.scale.set(1, 1.15, 1);
  root.add(rim);
  const head = new THREE.Group();
  head.position.y = 0.82;
  root.add(head);
  blob(kit, head, B, [0, 0, 0.02], [0.32, 0.29, 0.3]);
  for (const sx of [-1, 1]) {
    eye(kit, head, [0, 0, 0.02], 0.3, sx * 0.4, 0.1, 0.065, { white: true, iris: '#7a3b1e', tall: 1.2 });
    blob(kit, root, B, [sx * 0.25, 0.42, 0.08], [0.06, 0.12, 0.06], { rot: [0.5, 0, sx * 0.7] });
    blob(kit, root, B, [sx * 0.13, 0.05, 0.08], [0.09, 0.06, 0.13]);
  }
  tube(kit, head, [[-0.1, -0.09, 0.27], [0, -0.13, 0.3], [0.1, -0.09, 0.27]], 0.011, '#244a66', { glow: 0.02 });
  // Curly tail
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const a = t * TAU * 0.9;
    const r = 0.16 * (1 - t * 0.6);
    pts.push(new THREE.Vector3(0.05, 0.25 + Math.sin(a) * r, -0.32 - 0.12 - Math.cos(a) * r + 0.16));
  }
  root.add(new THREE.Mesh(kit.G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.05, 8, false)), kit.mat('#a5d8f5')));
  return head;
}

function jigglypuff(kit, root) {
  const P = '#f7b6cf';
  blob(kit, root, P, [0, 0.45, 0], [0.42, 0.41, 0.4]);
  for (const sx of [-1, 1]) {
    eye(kit, root, [0, 0.45, 0], 0.41, sx * 0.36, 0.08, 0.1, { white: true, iris: '#3aa7a3', tall: 1.0 });
    const ear = new THREE.Mesh(kit.cone, kit.mat(P));
    ear.position.set(sx * 0.24, 0.85, -0.02);
    ear.scale.set(0.12, 0.2, 0.06);
    ear.rotation.z = -sx * 0.4;
    root.add(ear);
    const inner = new THREE.Mesh(kit.cone, kit.mat('#2a2a3a', { glow: 0.05 }));
    inner.position.set(sx * 0.235, 0.84, 0.01);
    inner.scale.set(0.07, 0.13, 0.03);
    inner.rotation.z = -sx * 0.4;
    root.add(inner);
    blob(kit, root, P, [sx * 0.38, 0.4, 0.08], [0.07, 0.1, 0.06], { rot: [0, 0, sx * 0.8] });
    blob(kit, root, P, [sx * 0.15, 0.05, 0.1], [0.1, 0.05, 0.13]);
  }
  // Curl
  const curl = new THREE.Mesh(kit.G(new THREE.TorusGeometry(0.08, 0.035, 8, 20, Math.PI * 1.5)), kit.mat('#f29cbe'));
  curl.position.set(0, 0.82, 0.22);
  curl.rotation.set(-0.4, 0, 0.6);
  root.add(curl);
  tube(kit, root, [[-0.06, 0.28, 0.38], [0, 0.25, 0.4], [0.06, 0.28, 0.38]], 0.012, '#7a2a48', { glow: 0.02 });
  return root;
}

function meowth(kit, root) {
  const C = '#f4e3b2';
  blob(kit, root, C, [0, 0.3, 0], [0.24, 0.28, 0.22]);
  const head = new THREE.Group();
  head.position.y = 0.78;
  root.add(head);
  blob(kit, head, C, [0, 0, 0], [0.35, 0.3, 0.3]);
  // Gold charm
  const coin = new THREE.Mesh(kit.cyl, kit.mat('#f5c518', { metal: 0.6, rough: 0.25, glow: 0.4 }));
  coin.position.set(0, 0.22, 0.2);
  coin.scale.set(0.09, 0.03, 0.09);
  coin.rotation.x = Math.PI / 2 - 0.5;
  head.add(coin);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(kit.cone, kit.mat(C));
    ear.position.set(sx * 0.22, 0.28, -0.04);
    ear.scale.set(0.11, 0.24, 0.07);
    ear.rotation.z = -sx * 0.35;
    head.add(ear);
    const inner = new THREE.Mesh(kit.cone, kit.mat('#2a2230', { glow: 0.05 }));
    inner.position.set(sx * 0.215, 0.27, -0.01);
    inner.scale.set(0.065, 0.16, 0.03);
    inner.rotation.z = -sx * 0.35;
    head.add(inner);
    eye(kit, head, [0, 0, 0], 0.3, sx * 0.36, 0.06, 0.06, { white: true, tall: 1.3 });
    for (const dy of [-0.07, -0.12]) tube(kit, head, [[sx * 0.18, dy, 0.24], [sx * 0.33, dy + 0.02, 0.22], [sx * 0.46, dy + 0.05, 0.16]], 0.007, '#3a3030', { glow: 0.02 });
    blob(kit, root, C, [sx * 0.22, 0.36, 0.08], [0.05, 0.12, 0.05], { rot: [0.5, 0, sx * 0.7] });
    blob(kit, root, '#8a5a32', [sx * 0.12, 0.04, 0.08], [0.08, 0.05, 0.12]);
  }
  blob(kit, head, '#f472b6', [0, -0.05, 0.3], [0.025, 0.018, 0.015]);
  tube(kit, head, [[-0.08, -0.12, 0.27], [0, -0.1, 0.3], [0.08, -0.12, 0.27]], 0.009, '#5a3030', { glow: 0.02 });
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.12, -0.18), new THREE.Vector3(0.18, 0.18, -0.38), new THREE.Vector3(0.3, 0.45, -0.4), new THREE.Vector3(0.22, 0.62, -0.32)]);
  root.add(new THREE.Mesh(kit.G(new THREE.TubeGeometry(curve, 14, 0.035, 6, false)), kit.mat(C)));
  blob(kit, root, '#8a5a32', [0.22, 0.64, -0.32], [0.05, 0.06, 0.05]);
  return head;
}

const BUILDERS = { pikachu, bulbasaur, charmander, squirtle, jigglypuff, meowth };
export const WILD_IDS = Object.keys(BUILDERS);

/** A wild Pokémon (about 1.1 tall). update(dt, { flash, hop }) animates it. */
export function createWild(kit, id) {
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);
  const head = (BUILDERS[id] || pikachu)(kit, root);
  let t = Math.random() * 3;
  let hop = 0;
  return {
    group,
    hit() {
      hop = 1;
    },
    update(dt, { spinSpeed = 0.9 } = {}) {
      t += dt;
      hop = Math.max(0, hop - dt * 2.5);
      const h = Math.sin(hop * Math.PI);
      root.position.y = Math.abs(Math.sin(t * 3)) * 0.06 + h * 0.35;
      root.scale.set(1 + h * 0.1, 1 - h * 0.12 + Math.sin(t * 6) * 0.015, 1 + h * 0.1);
      group.rotation.y = Math.sin(t * spinSpeed) * 0.85 + hop * TAU;
      if (head && head !== root) head.rotation.z = Math.sin(t * 2.2) * 0.1;
      const fl = head?.userData?.flame;
      if (fl) fl.scale.set(1 + Math.sin(t * 20) * 0.12, 1 + Math.sin(t * 17) * 0.2, 1);
    },
  };
}

// ---------------------------------------------------------------- Poké Ball
/** Canvas-free Poké Ball: red top, white bottom, black band and a button. Radius r. */
export function createPokeBall(kit, r = 0.27, { shiny = 0.25 } = {}) {
  const group = new THREE.Group();
  const opts = { glow: 0.18, rough: shiny, metal: 0.05 };
  group.add(twoToneSphere(kit, '#e3262f', '#f6f6f6', r, opts));
  const band = new THREE.Mesh(kit.G(new THREE.TorusGeometry(r * 1.0, r * 0.08, 6, 36)), kit.mat('#1a1a22', { glow: 0.02, rough: 0.4 }));
  band.rotation.x = Math.PI / 2;
  group.add(band);
  const btn = new THREE.Mesh(kit.cyl, kit.mat('#1a1a22', { glow: 0.02 }));
  btn.scale.set(r * 0.36, r * 0.16, r * 0.36);
  btn.rotation.x = Math.PI / 2;
  btn.position.z = r * 0.96;
  group.add(btn);
  const btn2 = new THREE.Mesh(kit.cyl, kit.mat('#ffffff', { glow: 0.5, rough: 0.2 }));
  btn2.scale.set(r * 0.22, r * 0.12, r * 0.22);
  btn2.rotation.x = Math.PI / 2;
  btn2.position.z = r * 1.06;
  group.add(btn2);
  return group;
}

/** Counts the triangles of an object tree (for the report). */
export function countTriangles(obj) {
  let n = 0;
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    const c = g.index ? g.index.count : g.attributes.position.count;
    n += (c / 3) * (o.isInstancedMesh ? o.count : 1);
  });
  return Math.round(n);
}
