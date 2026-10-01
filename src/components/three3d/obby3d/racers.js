// Procedural chibi 3D racers for "Vượt chướng ngại Pokémon": eight popular Pokémon plus a generic
// blob for any other card, coloured by its type. No model files: scaled spheres, lathes, tubes and
// extrusions with soft plastic-toy materials, eyes with highlights, procedural run/jump/dive/fall/
// celebrate animation (squash & stretch, swinging limbs, floppy ears, wagging tails, blinking).
// Local frame: forward -Z, up +Y, feet at y = 0, about 1.1 units tall.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const RACER_SPECIES = ['pikachu', 'jigglypuff', 'psyduck', 'bulbasaur', 'squirtle', 'charmander', 'eevee', 'piplup'];

/** Pokémon TCG and game type -> body colour for the generic racer. */
export const TYPE_COLORS = {
  Fire: '#f5894a',
  Water: '#5aa0f0',
  Grass: '#6cc75a',
  Electric: '#f6d23c',
  Lightning: '#f6d23c',
  Psychic: '#f07ab0',
  Fighting: '#d0704a',
  Darkness: '#6a6080',
  Dark: '#6a6080',
  Metal: '#a8b4c4',
  Steel: '#a8b4c4',
  Dragon: '#7a6af0',
  Fairy: '#f4a4d4',
  Ice: '#8ee0f0',
  Ground: '#d8b060',
  Rock: '#bca068',
  Bug: '#a8c040',
  Ghost: '#8a70c0',
  Poison: '#b070c8',
  Flying: '#90b0f0',
  Normal: '#d8c8a8',
  Colorless: '#e0dccc',
};

/** Normal and shiny palettes. */
const PALETTES = {
  pikachu: { main: '#ffd23a', shiny: '#ffb52e', dark: '#7a4a1e', cheek: '#f0483c' },
  jigglypuff: { main: '#ffb3cf', shiny: '#ffd3e6', iris: '#33b5c2', ear: '#5a3048' },
  psyduck: { main: '#ffd94e', shiny: '#9edcf0', beak: '#fbe7b2' },
  bulbasaur: { main: '#7dd3b8', shiny: '#b4e07a', spot: '#4a9a86', bulb: '#5bb35a', bulbShiny: '#f0a040', iris: '#e2463c' },
  squirtle: { main: '#8fd3f5', shiny: '#6aa8e8', shell: '#c9803d', shellShiny: '#b07ad0', cream: '#fbe3a6', iris: '#7a2c1a' },
  charmander: { main: '#f99a48', shiny: '#ffd24a', cream: '#fde3a0', iris: '#2f6fc8' },
  eevee: { main: '#c98f55', shiny: '#d8d8e4', cream: '#f8e7c2', dark: '#7a4c26', iris: '#4a2814' },
  piplup: { main: '#4d8ee0', shiny: '#9a8ee8', light: '#bfe3fb', beak: '#fbc93c' },
};

/** Geometry/material factory that remembers everything it makes (for dispose). */
function makeKit() {
  const owned = new Set();
  const own = (x) => {
    owned.add(x);
    return x;
  };
  const geos = {
    ball: own(new THREE.SphereGeometry(1, 20, 13)),
    mid: own(new THREE.SphereGeometry(1, 11, 8)),
    eye: own(new THREE.SphereGeometry(1, 12, 8)),
    small: own(new THREE.SphereGeometry(1, 8, 6)),
    tiny: own(new THREE.SphereGeometry(1, 6, 4)),
  };
  // Soft plastic-toy look: standard shading with a little self-glow so pastel colours stay bright in shadow
  const toon = (color, extra = {}) => own(new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, emissive: extra.vertexColors ? '#000000' : color, emissiveIntensity: 0.16, ...extra }));
  const basic = (color, extra = {}) => own(new THREE.MeshBasicMaterial({ color, ...extra }));
  const mesh = (parent, geo, mat, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1], rot = null) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(m);
    return m;
  };
  const ball = (parent, mat, pos, scale, rot, geo = geos.ball) => mesh(parent, geo, mat, pos, scale, rot);
  return { own, geos, toon, basic, mesh, ball, owned };
}

/** Lathe around +Y from [radius, y] pairs, optional vertex colours by height (0..1). */
function lathe(kit, pts, seg = 12, colorAt = null) {
  const g = kit.own(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg));
  if (colorAt) {
    const pos = g.attributes.position;
    const y0 = pts[0][1];
    const y1 = pts[pts.length - 1][1];
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      c.set(colorAt((pos.getY(i) - y0) / (y1 - y0 || 1)));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  return g;
}

/** Tube along points with a radius profile (tails, hair, curls). */
function tube(kit, points, radius, segs = 16, radial = 7) {
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
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return kit.own(g);
}

/** Point on an ellipsoid (centre c, radii r) in direction d, with its outward normal. */
function onEllipsoid(c, r, d) {
  const n0 = v3(d[0], d[1], d[2]).normalize();
  const k = 1 / Math.sqrt((n0.x / r[0]) ** 2 + (n0.y / r[1]) ** 2 + (n0.z / r[2]) ** 2);
  const p = v3(c[0] + n0.x * k, c[1] + n0.y * k, c[2] + n0.z * k);
  const n = v3((p.x - c[0]) / r[0] ** 2, (p.y - c[1]) / r[1] ** 2, (p.z - c[2]) / r[2] ** 2).normalize();
  return { p, n };
}

const UP = v3(0, 1, 0);
const basis = new THREE.Matrix4();
/** Group placed on a surface point: its +Z along the outward normal, its +Y as close to "up" as possible. */
function surfaceGroup(parent, { p, n }, sink = 0) {
  const g = new THREE.Group();
  g.position.copy(p).addScaledVector(n, -sink);
  const x = new THREE.Vector3().crossVectors(UP, n);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(n, x).normalize();
  basis.makeBasis(x, y, n);
  g.quaternion.setFromRotationMatrix(basis);
  parent.add(g);
  return g;
}

/**
 * A cartoon eye on the head ellipsoid: white sclera (optional), coloured iris, pupil, two highlights.
 * Returns the eye group (scale.y is animated to blink).
 */
function eye(kit, head, c, r, dir, { size = 0.085, iris = null, sclera = true, pupil = '#16131c', tall = 1.25, mats }) {
  const s = onEllipsoid(c, r, dir);
  const g = surfaceGroup(head, s, size * 0.25);
  const lid = new THREE.Group(); // blinking pivot
  g.add(lid);
  if (sclera) kit.ball(lid, mats.white, [0, 0, 0], [size, size * tall, size * 0.42], null, kit.geos.eye);
  if (iris) kit.ball(lid, kit.toon(iris), [0, -size * 0.08, size * 0.18], [size * 0.72, size * 0.86 * tall, size * 0.34], null, kit.geos.eye);
  const pr = iris ? size * 0.42 : size * (sclera ? 0.5 : 1);
  kit.ball(lid, mats.pupil || kit.basic(pupil), [0, -size * 0.1, size * 0.3], [pr, pr * tall, size * 0.3], null, kit.geos.small);
  kit.ball(lid, mats.shine, [-size * 0.26, size * 0.3, size * 0.6], [size * 0.3, size * 0.34, size * 0.1], null, kit.geos.tiny);
  kit.ball(lid, mats.shine, [size * 0.2, -size * 0.3, size * 0.6], [size * 0.13, size * 0.13, size * 0.08], null, kit.geos.tiny);
  return lid;
}

/** Soft round alpha texture made in memory (glows). */
function radialTexture(size = 32) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const a = Math.max(0, 1 - d);
      data.set([255, 255, 255, Math.round(255 * a * a)], (y * size + x) * 4);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Simple spring for floppy parts. */
const spring = () => ({ x: 0, v: 0 });
function springStep(sp, target, dt, k = 90, damp = 9) {
  sp.v += (target - sp.x) * k * dt - sp.v * damp * dt;
  sp.x += sp.v * dt;
  return sp.x;
}

/** Flame made of nested additive teardrops (Charmander's tail). */
function flame(kit, parent) {
  const tear = (r, h) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push([Math.sin(Math.PI * Math.pow(t, 0.55)) * Math.pow(1 - t, 0.35) * r, t * h - h * 0.15]);
    }
    return lathe(kit, pts, 9);
  };
  const g = new THREE.Group();
  parent.add(g);
  const layers = [
    [tear(0.12, 0.36), kit.basic('#ff4a1c', { transparent: true, opacity: 0.8, depthWrite: false })],
    [tear(0.085, 0.27), kit.basic('#ff9a20', { transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })],
    [tear(0.05, 0.17), kit.basic('#fff1a0', { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })],
  ].map(([geo, mat], i) => {
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 4 + i;
    g.add(m);
    return m;
  });
  return { group: g, layers };
}

// ---------------------------------------------------------------- species builders
// Each returns parts for the shared animator: { body, head, arms: [L, R], legs: [...], ears: [...], tails: [...], eyes: [...], quad, extra(t, dt, anim) }

function biped(kit, M, { bodyColor, bodyR = [0.27, 0.25, 0.25], bodyY = 0.37, headR = [0.33, 0.3, 0.3], headY = 0.79, legLen = 0.17, armColor, footColor, footScale = [0.1, 0.06, 0.13] }) {
  const root = new THREE.Group();
  const bodyMat = kit.toon(bodyColor);
  const body = new THREE.Group();
  body.position.y = 0;
  root.add(body);
  const torso = kit.ball(body, bodyMat, [0, bodyY, 0], bodyR);
  const head = new THREE.Group();
  head.position.set(0, headY - 0.05, 0);
  body.add(head);
  const headMesh = kit.ball(head, bodyMat, [0, 0.05, 0], headR);
  const arms = [-1, 1].map((sd) => {
    const a = new THREE.Group();
    a.position.set(sd * (bodyR[0] - 0.02), bodyY + 0.08, -0.02);
    body.add(a);
    kit.ball(a, armColor ? kit.toon(armColor) : bodyMat, [sd * 0.05, -0.1, 0], [0.065, 0.13, 0.065], [0, 0, sd * 0.3], kit.geos.mid);
    return a;
  });
  const legs = [-1, 1].map((sd) => {
    const l = new THREE.Group();
    l.position.set(sd * 0.12, legLen + 0.02, 0.02);
    root.add(l);
    kit.ball(l, bodyMat, [0, -legLen * 0.45, 0], [0.075, legLen * 0.6, 0.075], null, kit.geos.mid);
    kit.ball(l, footColor ? kit.toon(footColor) : bodyMat, [0, -legLen + 0.03, -0.04], footScale, null, kit.geos.mid);
    return l;
  });
  return { root, body, torso, head, headMesh, headC: [0, 0.05, 0], headR, arms, legs, bodyMat };
}

function quadruped(kit, M, { bodyColor, bodyR = [0.27, 0.23, 0.36], bodyY = 0.36, headR = [0.31, 0.28, 0.28], headPos = [0, 0.7, -0.3], legLen = 0.2, legColor }) {
  const root = new THREE.Group();
  const bodyMat = kit.toon(bodyColor);
  const body = new THREE.Group();
  root.add(body);
  const torso = kit.ball(body, bodyMat, [0, bodyY, 0.05], bodyR);
  const head = new THREE.Group();
  head.position.set(headPos[0], headPos[1], headPos[2]);
  body.add(head);
  const headMesh = kit.ball(head, bodyMat, [0, 0, 0], headR);
  const legMat = legColor ? kit.toon(legColor) : bodyMat;
  const legs = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].map(([sx, sz]) => {
    const l = new THREE.Group();
    l.position.set(sx * 0.16, legLen + 0.02, sz * 0.2 + 0.05);
    body.add(l);
    kit.ball(l, legMat, [0, -legLen * 0.5, 0], [0.085, legLen * 0.62, 0.09], null, kit.geos.small);
    kit.ball(l, legMat, [0, -legLen + 0.035, -0.03], [0.095, 0.05, 0.11], null, kit.geos.small);
    l.userData.front = sz < 0;
    l.userData.side = sx;
    return l;
  });
  return { root, body, torso, head, headMesh, headC: [0, 0, 0], headR, arms: [], legs, bodyMat, quad: true };
}

const BUILDERS = {
  pikachu(kit, M, P, shiny) {
    const main = shiny ? P.shiny : P.main;
    const b = biped(kit, M, { bodyColor: main, headR: [0.34, 0.29, 0.3], bodyR: [0.26, 0.26, 0.24] });
    const { head, headC, headR } = b;
    const eyes = [-1, 1].map((sd) => eye(kit, head, headC, headR, [sd * 0.42, 0.18, -1], { size: 0.072, sclera: false, tall: 1.15, mats: M, pupil: '#1b1410' }));
    for (const sd of [-1, 1]) {
      const s = onEllipsoid(headC, headR, [sd * 0.78, -0.25, -0.75]);
      const g = surfaceGroup(head, s, 0.02);
      kit.ball(g, kit.toon(P.cheek), [0, 0, 0], [0.072, 0.066, 0.025], null, kit.geos.mid);
    }
    kit.ball(head, M.pupil, onEllipsoid(headC, headR, [0, 0.0, -1]).p.toArray(), [0.018, 0.012, 0.012], null, kit.geos.small);
    const mouth = surfaceGroup(head, onEllipsoid(headC, headR, [0, -0.18, -1]), 0.005);
    kit.mesh(mouth, tube(kit, [v3(-0.045, 0.008, 0), v3(-0.03, -0.01, 0), v3(-0.012, -0.008, 0), v3(0, 0.004, 0), v3(0.012, -0.008, 0), v3(0.03, -0.01, 0), v3(0.045, 0.008, 0)], 0.0065, 16, 4), M.pupil);
    // Long ears with black tips
    const earGeo = lathe(kit, Array.from({ length: 9 }, (_, i) => [0.085 * Math.sin(Math.PI * Math.min(1, (i / 8) * 0.95 + 0.12)) * Math.pow(1 - i / 8, 0.4), (i / 8) * 0.46]), 10, (t) => (t > 0.68 ? '#1d1712' : main));
    const earMat = kit.toon('#ffffff', { vertexColors: true });
    const ears = [-1, 1].map((sd) => {
      const e = new THREE.Group();
      e.position.set(sd * 0.17, 0.27, 0.02);
      e.rotation.set(0.12, 0, sd * -0.42);
      head.add(e);
      kit.mesh(e, earGeo, earMat, [0, 0, 0], [1, 1, 0.55]);
      e.userData.base = e.rotation.z;
      e.userData.side = sd;
      return e;
    });
    // Brown back stripes
    for (const y of [0.42, 0.3]) kit.ball(b.body, kit.toon(P.dark), [0, y, 0.2], [0.17, 0.032, 0.08], [0.2, 0, 0], kit.geos.mid);
    // Lightning-bolt tail with a brown base
    const bolt = new THREE.Shape();
    const pts = [
      [0, 0],
      [0.09, 0.1],
      [0.03, 0.14],
      [0.17, 0.3],
      [0.11, 0.33],
      [0.3, 0.6],
      [0.04, 0.42],
      [0.1, 0.39],
      [-0.03, 0.2],
      [0.02, 0.17],
      [-0.06, 0.06],
    ];
    bolt.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) bolt.lineTo(x, y);
    bolt.closePath();
    const boltGeo = kit.own(new THREE.ExtrudeGeometry(bolt, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 1, curveSegments: 1 }));
    boltGeo.translate(0, 0, -0.025);
    const tail = new THREE.Group();
    tail.position.set(0, 0.3, 0.22);
    tail.rotation.set(0, -Math.PI / 2, 0.35);
    b.body.add(tail);
    kit.mesh(tail, boltGeo, b.bodyMat, [0, 0, 0], [1.25, 1.25, 1]);
    kit.ball(tail, kit.toon(P.dark), [0.0, 0.05, 0], [0.06, 0.08, 0.05], null, kit.geos.mid);
    return { ...b, eyes, ears, tails: [tail], earFlop: 0.5 };
  },

  jigglypuff(kit, M, P, shiny) {
    const main = shiny ? P.shiny : P.main;
    const root = new THREE.Group();
    const bodyMat = kit.toon(main);
    const body = new THREE.Group();
    root.add(body);
    const head = new THREE.Group();
    head.position.set(0, 0.5, 0);
    body.add(head);
    const headR = [0.42, 0.4, 0.4];
    const headC = [0, 0, 0];
    const torso = kit.ball(head, bodyMat, headC, headR);
    const eyes = [-1, 1].map((sd) => eye(kit, head, headC, headR, [sd * 0.4, 0.1, -1], { size: 0.115, iris: P.iris, tall: 1.05, mats: M }));
    const mouth = surfaceGroup(head, onEllipsoid(headC, headR, [0, -0.38, -1]), 0.005);
    kit.mesh(mouth, tube(kit, [v3(-0.04, 0.01, 0), v3(0, -0.015, 0), v3(0.04, 0.01, 0)], 0.008, 8, 4), M.pupil);
    // Pointed ears with dark insides
    const earGeo = lathe(kit, [[0.12, 0], [0.1, 0.06], [0.06, 0.14], [0.001, 0.22]], 4);
    const ears = [-1, 1].map((sd) => {
      const e = new THREE.Group();
      const s = onEllipsoid(headC, headR, [sd * 0.62, 0.78, -0.1]);
      e.position.copy(s.p);
      e.rotation.set(-0.15, 0, sd * -0.62);
      head.add(e);
      kit.mesh(e, earGeo, bodyMat, [0, -0.04, 0], [1, 1, 0.55], [0, Math.PI / 4, 0]);
      kit.mesh(e, earGeo, kit.toon(P.ear), [0, -0.02, -0.035], [0.6, 0.72, 0.25], [0, Math.PI / 4, 0]);
      e.userData.base = e.rotation.z;
      e.userData.side = sd;
      return e;
    });
    // The famous curl on the forehead
    const curlPts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const a = t * TAU * 1.15 + 0.3;
      const rr = 0.13 * (1 - t * 0.75);
      curlPts.push(v3(Math.sin(a) * rr * 0.4, 0.3 + Math.cos(a) * rr, -0.33 - Math.sin(a) * rr * 0.75 - t * 0.05));
    }
    kit.mesh(head, tube(kit, curlPts, (t) => 0.05 * (1 - t) + 0.012, 22, 7), bodyMat);
    const arms = [-1, 1].map((sd) => {
      const a = new THREE.Group();
      a.position.set(sd * 0.36, 0.42, -0.04);
      body.add(a);
      kit.ball(a, bodyMat, [sd * 0.05, -0.05, 0], [0.08, 0.11, 0.07], [0, 0, sd * 0.7], kit.geos.mid);
      return a;
    });
    const legs = [-1, 1].map((sd) => {
      const l = new THREE.Group();
      l.position.set(sd * 0.16, 0.12, 0);
      root.add(l);
      kit.ball(l, bodyMat, [0, -0.06, -0.04], [0.11, 0.07, 0.15], null, kit.geos.mid);
      return l;
    });
    return { root, body, torso, head, headMesh: torso, headC, headR, arms, legs, eyes, ears, tails: [], bodyMat, round: true, earFlop: 0.25 };
  },

  psyduck(kit, M, P, shiny) {
    const main = shiny ? P.shiny : P.main;
    const b = biped(kit, M, { bodyColor: main, headR: [0.33, 0.31, 0.31], bodyR: [0.28, 0.27, 0.26], footColor: P.beak, footScale: [0.12, 0.045, 0.17] });
    const { head, headC, headR } = b;
    const eyes = [-1, 1].map((sd) => eye(kit, head, headC, headR, [sd * 0.38, 0.28, -1], { size: 0.075, tall: 1.05, mats: M }));
    // Wide flat beak
    const beakMat = kit.toon(P.beak);
    kit.ball(head, beakMat, [0, -0.04, -0.3], [0.2, 0.07, 0.14], [0.1, 0, 0], kit.geos.mid);
    kit.ball(head, beakMat, [0, -0.1, -0.27], [0.17, 0.05, 0.11], [0.15, 0, 0], kit.geos.mid);
    for (const sd of [-1, 1]) kit.ball(head, M.pupil, [sd * 0.05, -0.0, -0.43], [0.012, 0.008, 0.01], null, kit.geos.small);
    // Three hair strands
    const hairMat = kit.toon('#2a2420');
    const hairs = [-1, 0, 1].map((k) => {
      const h = new THREE.Group();
      h.position.set(k * 0.045, 0.33, -0.02);
      h.rotation.z = -k * 0.35;
      head.add(h);
      kit.mesh(h, tube(kit, [v3(0, 0, 0), v3(0, 0.07, 0.01), v3(k * 0.02, 0.13, -0.01)], (t) => 0.014 * (1 - t * 0.6), 6, 5), hairMat);
      return h;
    });
    kit.ball(b.body, b.bodyMat, [0, 0.22, 0.26], [0.08, 0.06, 0.06], null, kit.geos.mid); // tiny tail
    return { ...b, eyes, ears: hairs, tails: [], earFlop: 0.8, headHold: true };
  },

  bulbasaur(kit, M, P, shiny) {
    const main = shiny ? P.shiny : P.main;
    const b = quadruped(kit, M, { bodyColor: main, headR: [0.34, 0.27, 0.29], headPos: [0, 0.62, -0.32] });
    const { head, headC, headR } = b;
    const eyes = [-1, 1].map((sd) => eye(kit, head, headC, headR, [sd * 0.62, 0.15, -0.8], { size: 0.085, iris: P.iris, tall: 0.95, mats: M }));
    const mouth = surfaceGroup(head, onEllipsoid(headC, headR, [0, -0.35, -1]), 0.005);
    kit.mesh(mouth, tube(kit, [v3(-0.12, 0.03, 0), v3(-0.06, -0.01, 0), v3(0, -0.015, 0), v3(0.06, -0.01, 0), v3(0.12, 0.03, 0)], 0.008, 10, 4), M.pupil);
    for (const sd of [-1, 1]) kit.ball(head, M.pupil, [sd * 0.04, -0.03, -0.285], [0.01, 0.008, 0.008], null, kit.geos.small);
    // Dark spots
    const spotMat = kit.toon(P.spot);
    for (const [dx, dy, dz, s] of [
      [0.2, 0.6, -0.4, 0.06],
      [-0.25, 0.55, -0.2, 0.05],
      [0.05, 0.85, 0.1, 0.05],
    ]) {
      const g = surfaceGroup(head, onEllipsoid(headC, headR, [dx, dy, dz]), 0.012);
      kit.ball(g, spotMat, [0, 0, 0], [s, s * 0.8, 0.02], null, kit.geos.small);
    }
    for (const [x, y, z] of [
      [0.24, 0.45, 0.15],
      [-0.22, 0.42, 0.25],
    ])
      kit.ball(b.body, spotMat, [x, y, z], [0.06, 0.05, 0.05], null, kit.geos.small);
    // Pointed ears
    const earGeo = lathe(kit, [[0.065, 0], [0.05, 0.05], [0.001, 0.12]], 7);
    const ears = [-1, 1].map((sd) => {
      const e = new THREE.Group();
      e.position.set(sd * 0.2, 0.2, -0.02);
      e.rotation.set(-0.1, 0, sd * -0.45);
      head.add(e);
      kit.mesh(e, earGeo, b.bodyMat, [0, 0, 0], [1, 1, 0.6]);
      e.userData.base = e.rotation.z;
      e.userData.side = sd;
      return e;
    });
    // The bulb: an onion-shaped lathe wrapped in leaf ridges
    const bulbMat = kit.toon(shiny ? P.bulbShiny : P.bulb);
    const bulb = new THREE.Group();
    bulb.position.set(0, 0.55, 0.12);
    b.body.add(bulb);
    const prof = Array.from({ length: 10 }, (_, i) => {
      const t = i / 9;
      return [0.25 * Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)) * (1 - 0.35 * t) + (t > 0.85 ? 0 : 0), t * 0.42];
    });
    kit.mesh(bulb, lathe(kit, prof, 14), bulbMat);
    const leafMat = kit.toon(shiny ? '#e08a30' : '#47a04a');
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      kit.ball(bulb, leafMat, [Math.cos(a) * 0.16, 0.16, Math.sin(a) * 0.16], [0.07, 0.19, 0.11], [Math.sin(a) * 0.45, -a, -Math.cos(a) * 0.45], kit.geos.small);
    }
    kit.ball(bulb, leafMat, [0, 0.42, 0], [0.04, 0.06, 0.04], null, kit.geos.small);
    return { ...b, eyes, ears, tails: [bulb], earFlop: 0.3, bulb };
  },

  squirtle(kit, M, P, shiny) {
    const main = shiny ? P.shiny : P.main;
    const b = biped(kit, M, { bodyColor: main, headR: [0.33, 0.3, 0.31], bodyR: [0.27, 0.27, 0.26] });
    const { head, headC, headR } = b;
    const eyes = [-1, 1].map((sd) => eye(kit, head, headC, headR, [sd * 0.45, 0.15, -1], { size: 0.088, iris: P.iris, tall: 1.2, mats: M }));
    const mouth = surfaceGroup(head, onEllipsoid(headC, headR, [0, -0.38, -1]), 0.004);
    kit.mesh(mouth, tube(kit, [v3(-0.08, 0.02, 0), v3(-0.03, -0.012, 0), v3(0.03, -0.012, 0), v3(0.08, 0.02, 0)], 0.008, 10, 4), M.pupil);
    // Shell on the back with a cream rim, belly plate in front
    const shellMat = kit.toon(shiny ? P.shellShiny : P.shell);
    const creamMat = kit.toon(P.cream);
    const shell = new THREE.Group();
    shell.position.set(0, 0.38, 0.1);
    shell.rotation.x = Math.PI / 2;
    b.body.add(shell);
    kit.mesh(shell, lathe(kit, Array.from({ length: 8 }, (_, i) => [0.31 * Math.cos((i / 7) * Math.PI * 0.5), 0.22 * Math.sin((i / 7) * Math.PI * 0.5)]), 16), shellMat, [0, 0, 0], [1, 1, 1.08]);
    kit.mesh(shell, kit.own(new THREE.TorusGeometry(0.3, 0.045, 7, 20)), creamMat, [0, 0.01, 0], [1, 1.08, 1], [Math.PI / 2, 0, 0]);
    kit.ball(b.body, creamMat, [0, 0.36, -0.13], [0.21, 0.23, 0.13], null, kit.geos.mid);
    for (const y of [0.3, 0.42]) kit.ball(b.body, kit.toon('#d8b878'), [0, y, -0.255], [0.16, 0.008, 0.01], null, kit.geos.small);
    // Curly tail
    const tailPts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const a = t * Math.PI * 1.4;
      tailPts.push(v3(0, 0.1 + Math.sin(a) * 0.12 * (1 - t * 0.3), 0.02 + t * 0.12 + (1 - Math.cos(a)) * 0.05));
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.16, 0.25);
    b.body.add(tail);
    kit.mesh(tail, tube(kit, tailPts, (t) => 0.07 * (1 - t * 0.55), 14, 8), b.bodyMat);
    return { ...b, eyes, ears: [], tails: [tail] };
  },

  charmander(kit, M, P, shiny) {
    const main = shiny ? P.shiny : P.main;
    const b = biped(kit, M, { bodyColor: main, headR: [0.32, 0.3, 0.32], bodyR: [0.26, 0.27, 0.25] });
    const { head, headC, headR } = b;
    const eyes = [-1, 1].map((sd) => eye(kit, head, headC, headR, [sd * 0.45, 0.2, -1], { size: 0.08, iris: P.iris, tall: 1.3, mats: M }));
    const mouth = surfaceGroup(head, onEllipsoid(headC, headR, [0, -0.3, -1]), 0.004);
    kit.mesh(mouth, tube(kit, [v3(-0.1, 0.03, 0), v3(-0.04, -0.008, 0), v3(0.04, -0.008, 0), v3(0.1, 0.03, 0)], 0.008, 10, 4), M.pupil);
    for (const sd of [-1, 1]) kit.ball(head, M.pupil, [sd * 0.035, 0.04, -0.315], [0.01, 0.008, 0.008], null, kit.geos.small);
    kit.ball(b.body, kit.toon(P.cream), [0, 0.34, -0.12], [0.2, 0.22, 0.14], null, kit.geos.mid);
    // Tapered tail curling up, flame on the tip
    const tail = new THREE.Group();
    tail.position.set(0, 0.24, 0.2);
    b.body.add(tail);
    const pts = [v3(0, 0, 0), v3(0, 0.0, 0.16), v3(0, 0.08, 0.3), v3(0, 0.22, 0.36)];
    kit.mesh(tail, tube(kit, pts, (t) => 0.085 * (1 - t * 0.6), 12, 8), b.bodyMat);
    const tip = new THREE.Group();
    tip.position.copy(pts[3]).add(v3(0, 0.03, 0));
    tail.add(tip);
    const fl = flame(kit, tip);
    const glow = kit.own(new THREE.SpriteMaterial({ map: kit.own(radialTexture()), color: '#ff8a2a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    const spr = new THREE.Sprite(glow);
    spr.scale.set(0.4, 0.4, 1);
    spr.position.y = 0.08;
    tip.add(spr);
    return { ...b, eyes, ears: [], tails: [tail], flame: fl, flameTip: tip };
  },

  eevee(kit, M, P, shiny) {
    const main = shiny ? P.shiny : P.main;
    const b = quadruped(kit, M, { bodyColor: main, headR: [0.32, 0.28, 0.29], headPos: [0, 0.68, -0.3], bodyR: [0.24, 0.22, 0.34] });
    const { head, headC, headR } = b;
    const eyes = [-1, 1].map((sd) => eye(kit, head, headC, headR, [sd * 0.5, 0.12, -1], { size: 0.09, iris: P.iris, tall: 1.15, mats: M }));
    kit.ball(head, kit.toon(P.dark), onEllipsoid(headC, headR, [0, -0.15, -1]).p.toArray(), [0.025, 0.018, 0.018], null, kit.geos.small);
    const mouth = surfaceGroup(head, onEllipsoid(headC, headR, [0, -0.4, -1]), 0.004);
    kit.mesh(mouth, tube(kit, [v3(-0.04, 0.012, 0), v3(-0.015, -0.01, 0), v3(0, 0.003, 0), v3(0.015, -0.01, 0), v3(0.04, 0.012, 0)], 0.006, 8, 4), M.pupil);
    // Big ears with dark tips
    const earGeo = lathe(kit, Array.from({ length: 9 }, (_, i) => [0.13 * Math.sin(Math.PI * Math.min(1, (i / 8) * 0.9 + 0.15)) * Math.pow(1 - i / 8, 0.5), (i / 8) * 0.42]), 10, (t) => (t > 0.78 ? P.dark : main));
    const earMat = kit.toon('#ffffff', { vertexColors: true });
    const ears = [-1, 1].map((sd) => {
      const e = new THREE.Group();
      e.position.set(sd * 0.17, 0.19, 0.02);
      e.rotation.set(0.05, 0, sd * -0.7);
      head.add(e);
      kit.mesh(e, earGeo, earMat, [0, 0, 0], [1, 1, 0.45]);
      kit.ball(e, kit.toon(P.dark), [0, 0.15, -0.035], [0.06, 0.13, 0.01], null, kit.geos.small);
      e.userData.base = e.rotation.z;
      e.userData.side = sd;
      return e;
    });
    // Fluffy cream collar
    const cream = kit.toon(P.cream);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 1.6 - Math.PI * 1.3;
      kit.ball(b.body, cream, [Math.cos(a) * 0.2, 0.52 + Math.sin(k * 1.7) * 0.02, -0.2 + Math.sin(a) * 0.12], [0.1, 0.12, 0.08], [0.3, a, 0], kit.geos.small);
    }
    // Bushy tail with a cream tip
    const tail = new THREE.Group();
    tail.position.set(0, 0.42, 0.34);
    tail.rotation.x = -0.5;
    b.body.add(tail);
    kit.ball(tail, b.bodyMat, [0, 0.16, 0.06], [0.13, 0.2, 0.12], [0.3, 0, 0], kit.geos.mid);
    kit.ball(tail, cream, [0, 0.34, 0.14], [0.1, 0.11, 0.09], [0.4, 0, 0], kit.geos.mid);
    return { ...b, eyes, ears, tails: [tail], earFlop: 0.4 };
  },

  piplup(kit, M, P, shiny) {
    const main = shiny ? P.shiny : P.main;
    const b = biped(kit, M, { bodyColor: P.light, headR: [0.32, 0.3, 0.3], bodyR: [0.27, 0.27, 0.25], armColor: main, footColor: '#f6a93a', footScale: [0.1, 0.04, 0.15] });
    const { head, headC, headR } = b;
    const headMat = kit.toon(main);
    b.headMesh.material = headMat;
    // White face patches around the eyes and the eyes
    for (const sd of [-1, 1]) {
      const g = surfaceGroup(head, onEllipsoid(headC, headR, [sd * 0.45, 0.12, -1]), 0.02);
      kit.ball(g, M.white, [0, 0, 0], [0.11, 0.1, 0.03], null, kit.geos.mid);
    }
    const eyes = [-1, 1].map((sd) => eye(kit, head, headC, headR, [sd * 0.42, 0.12, -1], { size: 0.06, sclera: false, tall: 1.3, mats: M }));
    // Beak and the crown-like crest
    const beakMat = kit.toon(P.beak);
    kit.ball(head, beakMat, [0, -0.06, -0.31], [0.11, 0.05, 0.09], null, kit.geos.mid);
    kit.ball(head, beakMat, [0, -0.1, -0.28], [0.08, 0.035, 0.07], null, kit.geos.mid);
    const crest = kit.toon(shiny ? '#6a5ec8' : '#2f62b8');
    for (const [x, y, z, r] of [
      [0, 0.1, -0.29, 0.0],
      [-0.08, 0.2, -0.23, 0.4],
      [0.08, 0.2, -0.23, -0.4],
    ])
      kit.ball(head, crest, [x, y, z], [0.035, 0.1, 0.03], [0.3, 0, r], kit.geos.mid);
    // Blue cape over the back, white chest dots
    kit.ball(b.body, headMat, [0, 0.42, 0.06], [0.28, 0.2, 0.22], [0.2, 0, 0], kit.geos.mid);
    for (const sd of [-1, 1]) kit.ball(b.body, M.white, [sd * 0.08, 0.44, -0.24], [0.035, 0.035, 0.02], null, kit.geos.small);
    b.arms.forEach((a, i) => {
      a.children[0].scale.set(0.05, 0.16, 0.1);
      a.children[0].rotation.z = (i ? 1 : -1) * 0.45;
    });
    return { ...b, eyes, ears: [], tails: [], flippers: true };
  },
};

function genericRacer(kit, M, color) {
  const c = new THREE.Color(color);
  const light = c.clone().lerp(new THREE.Color('#ffffff'), 0.25);
  const b = biped(kit, M, { bodyColor: '#' + c.getHexString(), headR: [0.34, 0.31, 0.31], bodyR: [0.27, 0.27, 0.25] });
  const { head, headC, headR } = b;
  b.headMesh.material = kit.toon('#' + light.getHexString());
  const eyes = [-1, 1].map((sd) => eye(kit, head, headC, headR, [sd * 0.4, 0.14, -1], { size: 0.08, tall: 1.2, mats: M, iris: '#3a3550' }));
  for (const sd of [-1, 1]) {
    const g = surfaceGroup(head, onEllipsoid(headC, headR, [sd * 0.75, -0.25, -0.8]), 0.02);
    kit.ball(g, kit.toon('#ff9aa8'), [0, 0, 0], [0.06, 0.05, 0.02], null, kit.geos.mid);
  }
  const mouth = surfaceGroup(head, onEllipsoid(headC, headR, [0, -0.3, -1]), 0.004);
  kit.mesh(mouth, tube(kit, [v3(-0.05, 0.015, 0), v3(0, -0.015, 0), v3(0.05, 0.015, 0)], 0.008, 8, 4), M.pupil);
  const earGeo = lathe(kit, [[0.09, 0], [0.08, 0.06], [0.05, 0.12], [0.001, 0.17]], 9);
  const ears = [-1, 1].map((sd) => {
    const e = new THREE.Group();
    e.position.set(sd * 0.2, 0.25, 0.02);
    e.rotation.set(0, 0, sd * -0.5);
    head.add(e);
    kit.mesh(e, earGeo, b.bodyMat, [0, 0, 0], [1, 1, 0.7]);
    e.userData.base = e.rotation.z;
    e.userData.side = sd;
    return e;
  });
  return { ...b, eyes, ears, tails: [], earFlop: 0.4 };
}

/**
 * Builds one racer. opts = { species ('pikachu'… or 'generic'), shiny, type (for generic) }.
 * Returns { group, headTop, update(dt, anim), dispose(), triangles() }.
 * anim = { state: 'idle'|'run'|'air'|'dive'|'stun'|'celebrate'|'out', speed 0..1, vy, land 0..1 }.
 */
export function createRacerModel({ species = 'generic', shiny = false, type = 'Normal', seed = 0 } = {}) {
  const kit = makeKit();
  const M = {
    white: kit.toon('#ffffff'),
    pupil: kit.basic('#17131d'),
    shine: kit.basic('#ffffff'),
  };
  const build = BUILDERS[species];
  const parts = build ? build(kit, M, PALETTES[species], shiny) : genericRacer(kit, M, TYPE_COLORS[type] || TYPE_COLORS.Normal);
  const group = new THREE.Group();
  group.name = `racer-${species}`;
  const squash = new THREE.Group(); // squash & stretch around the feet
  group.add(squash);
  const lean = new THREE.Group(); // whole-body pitch/roll (dive, wobble)
  lean.position.y = 0.4;
  squash.add(lean);
  parts.root.position.y = -0.4;
  lean.add(parts.root);
  const headTop = new THREE.Object3D();
  headTop.position.set(0, (parts.headR?.[1] || 0.3) + 0.12, 0);
  parts.head.add(headTop);
  const shadowAnchor = new THREE.Object3D();
  group.add(shadowAnchor);

  // Shiny racers get a little sparkle ring so children can tell the twins apart
  if (shiny) {
    const ringMat = kit.basic('#fff6b0', { transparent: true, opacity: 0.85 });
    for (let k = 0; k < 3; k++) {
      const st = kit.ball(parts.head, ringMat, [0, 0, 0], [0.03, 0.03, 0.03], null, kit.geos.small);
      st.userData.sparkle = k;
    }
  }

  // Small details (eyes, mouths, spots) can be hidden far from the camera to save draw calls
  const details = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const s = Math.max(o.scale.x, o.scale.y, o.scale.z);
    if (g === kit.geos.eye || g === kit.geos.tiny || (g === kit.geos.small && s < 0.05)) details.push(o);
    else if (g.type === 'BufferGeometry') {
      g.computeBoundingSphere();
      if (g.boundingSphere.radius < 0.13) details.push(o);
    }
  });
  let detailOn = true;
  const setDetail = (on) => {
    if (on === detailOn) return;
    detailOn = on;
    for (const o of details) o.visible = on;
  };

  const headBaseY = parts.head.position.y;
  const st = { t: seed * 1.37, phase: seed, blink: 2 + (seed % 3), land: 0, ears: parts.ears.map(spring), tail: spring(), state: 'idle', stateT: 0 };
  const sparkles = [];
  parts.head.traverse((o) => o.userData.sparkle != null && sparkles.push(o));
  const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
  const pose = { lean: 0, roll: 0, armUp: 0, armFwd: 0, tuck: 0, bob: 0 };

  function update(dt = 1 / 60, anim = {}) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    const state = anim.state || 'idle';
    if (state !== st.state) {
      st.state = state;
      st.stateT = 0;
    }
    st.stateT += dt;
    st.t += dt;
    const t = st.t;
    const speed = Math.min(1, Math.max(0, anim.speed || 0));
    const vy = anim.vy || 0;
    if ((anim.land || 0) > st.land) st.land = anim.land;
    st.land = Math.max(0, st.land - dt * 3.2);

    // Running cycle
    const running = state === 'run' && speed > 0.05;
    st.phase += dt * (running ? 7 + 9 * speed : state === 'celebrate' ? 9 : 2);
    const ph = st.phase;
    const swing = running ? Math.sin(ph) * (0.35 + 0.65 * speed) : 0;

    // Target pose per state
    let leanT = 0;
    let rollT = 0;
    let armUpT = 0;
    let armFwdT = 0;
    let tuckT = 0;
    let bobT = 0;
    if (running) {
      leanT = -0.22 * speed;
      bobT = Math.abs(Math.sin(ph)) * 0.07 * speed;
    } else if (state === 'air') {
      leanT = vy > 0 ? -0.1 : 0.05;
      armUpT = vy > 0 ? 0.9 : 1.6;
      tuckT = vy > 0 ? 0.7 : 0.2;
    } else if (state === 'dive') {
      leanT = -1.35;
      armFwdT = 1;
      tuckT = -0.3;
    } else if (state === 'stun') {
      rollT = Math.sin(t * 13) * 0.3;
      armUpT = 1.3;
      leanT = 0.15;
    } else if (state === 'celebrate') {
      bobT = Math.abs(Math.sin(ph)) * 0.22;
      armUpT = 1.9;
    } else if (state === 'out') {
      armUpT = 2;
      tuckT = 0.4;
      rollT = Math.sin(t * 9) * 0.4;
    }
    pose.lean = ease(pose.lean, leanT, state === 'dive' ? 14 : 8, dt);
    pose.roll = ease(pose.roll, rollT, 10, dt);
    pose.armUp = ease(pose.armUp, armUpT, 10, dt);
    pose.armFwd = ease(pose.armFwd, armFwdT, 12, dt);
    pose.tuck = ease(pose.tuck, tuckT, 10, dt);
    pose.bob = ease(pose.bob, bobT, 20, dt);

    // Squash & stretch: landings squash, rising stretches, idle breathes
    const q = st.land;
    const stretch = state === 'air' ? Math.min(0.14, Math.max(-0.06, vy * 0.016)) : 0;
    const breathe = state === 'idle' || state === 'celebrate' ? Math.sin(t * 3) * 0.02 : 0;
    const sy = 1 - q * 0.32 + stretch + breathe;
    const sxz = 1 + q * 0.22 - stretch * 0.5 - breathe * 0.5;
    squash.scale.set(sxz, sy, sxz);
    lean.rotation.set(pose.lean, 0, pose.roll);
    lean.position.y = 0.4 + pose.bob + (state === 'dive' ? -0.12 : 0);
    parts.body.rotation.y = running ? Math.sin(ph) * 0.12 * speed : 0;
    parts.head.position.y = headBaseY + (running ? Math.sin(ph * 2) * 0.012 : 0);
    parts.head.rotation.x = state === 'dive' ? 0.9 : state === 'celebrate' ? -0.15 : -pose.lean * 0.3;
    parts.head.rotation.z = state === 'stun' ? Math.sin(t * 7) * 0.2 : 0;

    // Arms: swing when running, flail in the air, forward when diving, wave when celebrating
    parts.arms.forEach((a, i) => {
      const sd = i ? 1 : -1;
      const wave = state === 'celebrate' ? Math.sin(t * 12 + i * 2) * 0.4 : state === 'air' && vy < 0 ? Math.sin(t * 22 + i * 3) * 0.35 : 0;
      let rx = -swing * 1.1 * (i ? 1 : -1) + pose.armFwd * 2.9;
      let rz = sd * (0.15 + pose.armUp * 1.2 + wave);
      if (parts.headHold && state === 'idle') {
        // Psyduck holds its head
        rx = -2.3;
        rz = sd * 0.9;
      }
      a.rotation.set(rx, 0, rz);
    });
    // Legs
    parts.legs.forEach((l, i) => {
      if (parts.quad) {
        const front = l.userData.front;
        const gallop = running ? Math.sin(ph + (front ? 0 : Math.PI) + (l.userData.side > 0 ? 0.5 : 0)) * (0.5 + 0.6 * speed) : 0;
        const air = state === 'air' ? (front ? -0.7 : 0.7) : state === 'dive' ? (front ? -1.3 : 1.3) : 0;
        l.rotation.x = gallop + air;
      } else {
        const sd = i ? 1 : -1;
        l.rotation.x = swing * 1.15 * sd + pose.tuck * (i ? 0.9 : -0.5) + (state === 'dive' ? 0.25 : 0);
        l.rotation.z = state === 'out' ? sd * 0.4 : 0;
      }
    });
    // Floppy ears / hair: lag behind vertical motion and the run bounce
    parts.ears.forEach((e, i) => {
      const flop = parts.earFlop ?? 0.4;
      const target = (vy > 0 ? -0.2 : vy < -1 ? 0.35 : 0) * flop + (running ? Math.cos(ph * 2) * 0.12 * speed : 0) + (state === 'dive' ? 0.5 * flop : 0);
      const x = springStep(st.ears[i], target, dt);
      if (e.userData.base != null) e.rotation.z = e.userData.base + e.userData.side * x * -1;
      else e.rotation.x = x;
    });
    // Tails wag
    const wagT = running ? Math.sin(ph) * 0.5 : state === 'celebrate' ? Math.sin(t * 14) * 0.6 : Math.sin(t * 2.2) * 0.15;
    const wag = springStep(st.tail, wagT, dt, 60, 7);
    parts.tails.forEach((tl) => {
      if (tl === parts.bulb) {
        // the bulb wobbles like jelly
        const k = 1 + Math.sin(t * 9) * 0.02 + st.land * 0.12;
        tl.scale.set(k, 2 - k, k);
      } else tl.rotation.y = wag * 0.6;
    });
    if (parts.flame) {
      const big = 1 + speed * 0.25 + (state === 'dive' ? 0.3 : 0);
      parts.flame.layers.forEach((m, k) => {
        const f = 1 + Math.sin(t * 19 + k * 1.7) * 0.15 + Math.sin(t * 31 + k) * 0.08;
        m.scale.set(big * (1 + Math.sin(t * 23 + k) * 0.07), big * f, big);
        m.rotation.y = t * 4 + k;
      });
      // keep the flame upright in the world
      parts.flameTip.rotation.set(-pose.lean - (parts.tails[0].rotation.x || 0), 0, -pose.roll);
    }
    // Blink
    st.blink -= dt;
    const closed = st.blink < 0.12 && st.blink > 0;
    if (st.blink <= 0) st.blink = 2.2 + ((seed * 7 + Math.floor(t)) % 5) * 0.5;
    const lid = state === 'stun' ? 0.25 : closed ? 0.1 : 1;
    parts.eyes.forEach((e) => (e.scale.y = lid));
    sparkles.forEach((o) => {
      const a = t * 2.5 + (o.userData.sparkle * TAU) / 3;
      o.position.set(Math.cos(a) * 0.42, 0.22 + Math.sin(t * 4 + o.userData.sparkle) * 0.05, Math.sin(a) * 0.42);
    });
  }

  function dispose() {
    for (const o of kit.owned) o.dispose?.();
    kit.owned.clear();
    group.removeFromParent();
  }

  function triangles() {
    let n = 0;
    group.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry;
      n += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    return n;
  }

  update(0);
  return { group, headTop, species: build ? species : 'generic', update, dispose, triangles, setDetail, details: details.length };
}
