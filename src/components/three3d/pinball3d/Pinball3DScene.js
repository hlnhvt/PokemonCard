// Three.js table for "Pinball Pokémon": draws the pinball engine state.
// Table coordinates (x 0..10 right, y 0..20 up the slope, h above the playfield) map to the
// table group as (x - 5, h, 10 - y); the group is tilted so the far end is higher.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TABLE, RAMP_PATH, CLOYSTER, RAMP_TIME, HOLE_HOLD, BALL_R, LANE_X, CX, FLIPPER, flipperPose, WILD } from '../../../utils/three3d/pinball3d';
import { createModelKit, createVoltorb, createDiglett, createPsyduck, createCloyster, createWild, createPokeBall, countTriangles } from './pinball3dModels';
import { playfieldTexture, apronTexture, backboxTexture, woodTexture, glowTexture, envTexture, canvasTexture, FIELD } from './pinball3dArt';

const TILT = 0.12; // table slope (rad)
const ELEV = (55 * Math.PI) / 180; // camera looks down at ~55°
const FOV = 30;
const WALL_H = 0.75;
const P = (x, y, h = 0) => new THREE.Vector3(x - 5, h, 10 - y);
/** Shape (table x, y) extruded along +Z -> table group space (extrusion = height). */
const toTable = (g) => {
  g.rotateX(-Math.PI / 2);
  g.translate(-5, 0, 10);
  return g;
};
const angleOf = (dx, dy) => Math.atan2(dy, dx);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
/** Marks a mesh that never moves: merged with the others of its material after the build (fewer draw calls). */
const S = (m) => {
  m.userData.static = true;
  return m;
};

/**
 * Builds the table into `container`. Throws when WebGL is unavailable.
 * Returns { update(state, dt), fx(event, state), resize(), dispose(), info() }.
 */
export function createPinball3DScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const textures = [];
  const T = (t) => {
    textures.push(t);
    return t;
  };
  const disposables = [];
  const D = (x) => {
    disposables.push(x);
    return x;
  };
  const kit = createModelKit();
  const scene = new THREE.Scene();
  scene.background = T(
    canvasTexture(16, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1e1b4b');
      g.addColorStop(0.6, '#0f0a2a');
      g.addColorStop(1, '#05030f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    })
  );
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = T(envTexture());
  const envRT = pmrem.fromEquirectangular(envTex);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 200);
  scene.add(new THREE.HemisphereLight('#c7d2fe', '#2e1065', 1.1));
  const key = new THREE.DirectionalLight('#ffffff', 1.5);
  key.position.set(-3, 14, 9);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#f0abfc', 0.45);
  fill.position.set(6, 6, -8);
  scene.add(fill);
  const flashLight = new THREE.PointLight('#fde047', 0, 7, 1.6);
  scene.add(flashLight);

  const table = new THREE.Group();
  table.rotation.x = TILT;
  scene.add(table);

  // ---------------------------------------------------------------- materials
  const M = (m) => D(m);
  const chrome = M(new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.12, envMapIntensity: 1.4 }));
  const darkChrome = M(new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 1, roughness: 0.3 }));
  const wood = T(woodTexture());
  wood.repeat.set(0.35, 0.35);
  const woodMat = M(new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0.05 }));
  const neonMat = M(new THREE.MeshBasicMaterial({ color: '#f472b6' }));
  const neonMat2 = M(new THREE.MeshBasicMaterial({ color: '#22d3ee' }));
  const whitePlastic = M(new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.12 }));
  const rubber = M(new THREE.MeshStandardMaterial({ color: '#f5f5f4', roughness: 0.65, emissive: '#ffffff', emissiveIntensity: 0.1 }));
  const redRubber = M(new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.55, emissive: '#7f1d1d', emissiveIntensity: 0.3 }));
  const dark = M(new THREE.MeshBasicMaterial({ color: '#05050a' }));
  const glowTex = T(glowTexture());
  const pfTex = T(playfieldTexture());
  const playMat = M(new THREE.MeshStandardMaterial({ map: pfTex, roughness: 0.28, metalness: 0.05, envMapIntensity: 0.55 }));

  // ---------------------------------------------------------------- cabinet, playfield, walls
  const fieldW = FIELD.x1 - FIELD.x0;
  const fieldH = FIELD.y1 - FIELD.y0;
  const pf = new THREE.Mesh(D(new THREE.PlaneGeometry(fieldW, fieldH)), playMat);
  pf.rotation.x = -Math.PI / 2;
  pf.position.copy(P((FIELD.x0 + FIELD.x1) / 2, (FIELD.y0 + FIELD.y1) / 2, 0));
  table.add(pf);
  const cabinet = new THREE.Mesh(D(new THREE.BoxGeometry(11.4, 2.4, 23.4)), M(new THREE.MeshStandardMaterial({ color: '#2a1608', roughness: 0.7 })));
  cabinet.position.copy(P(5, 9.3, -1.22));
  table.add(cabinet);
  // Neon strips along the cabinet sides
  for (const sx of [-1, 1]) {
    const strip = new THREE.Mesh(D(new THREE.BoxGeometry(0.06, 0.08, 23.2)), sx < 0 ? neonMat : neonMat2);
    strip.position.copy(P(5 + sx * 5.72, 9.3, -0.4));
    table.add(strip);
  }

  // Inner outline of the playfield (left side, top arc, right side)
  const ARC_N = 40;
  const inner = [[0, -1.5], [0, 15]];
  for (let i = 1; i < ARC_N; i++) {
    const a = Math.PI - (Math.PI * i) / ARC_N;
    inner.push([5 + 5 * Math.cos(a), 15 + 5 * Math.sin(a)]);
  }
  inner.push([10, 15], [10, -1.5]);
  {
    const shape = new THREE.Shape();
    shape.moveTo(-0.6, -1.95);
    shape.lineTo(10.6, -1.95);
    shape.lineTo(10.6, 20.6);
    shape.lineTo(-0.6, 20.6);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(inner[0][0], inner[0][1]);
    for (let i = 1; i < inner.length; i++) hole.lineTo(inner[i][0], inner[i][1]);
    hole.closePath();
    shape.holes.push(hole);
    const g = D(new THREE.ExtrudeGeometry(shape, { depth: WALL_H, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 4 }));
    table.add(new THREE.Mesh(toTable(g), woodMat));
    // Neon tube along the top inner edge, chrome guide rail along the bottom
    const top = new THREE.CatmullRomCurve3(inner.slice(1, -1).map(([x, y]) => P(x + (x < 5 ? -0.02 : 0.02), y, WALL_H + 0.05)), false, 'catmullrom', 0.05);
    table.add(new THREE.Mesh(D(new THREE.TubeGeometry(top, 160, 0.045, 6, false)), neonMat));
    const rail = new THREE.CatmullRomCurve3(inner.slice(1, -1).map(([x, y]) => P(x, y, 0.28)), false, 'catmullrom', 0.05);
    table.add(new THREE.Mesh(D(new THREE.TubeGeometry(rail, 160, 0.05, 6, false)), chrome));
  }
  // Backbox standing above the top of the table
  {
    const bb = new THREE.Group();
    bb.position.copy(P(5, 21.2, 0));
    table.add(bb);
    const box = new THREE.Mesh(D(new THREE.BoxGeometry(11.6, 4.6, 0.8)), M(new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.5 })));
    box.position.y = 2.6;
    bb.add(box);
    const glass = new THREE.Mesh(D(new THREE.PlaneGeometry(10.8, 4.0)), M(new THREE.MeshBasicMaterial({ map: T(backboxTexture()) })));
    glass.position.set(0, 2.65, 0.41);
    bb.add(glass);
    bb.rotation.x = -TILT * 0.6;
  }

  // ---------------------------------------------------------------- apron, plunger, kickback
  {
    const shape = new THREE.Shape();
    shape.moveTo(0, -1.5);
    shape.lineTo(LANE_X, -1.5);
    shape.lineTo(LANE_X, 0.15);
    shape.lineTo(6.0, 0.15);
    shape.quadraticCurveTo(CX, 0.45, 3.2, 0.15);
    shape.lineTo(0, 0.15);
    shape.closePath();
    const g = D(new THREE.ExtrudeGeometry(shape, { depth: 0.62, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }));
    table.add(new THREE.Mesh(toTable(g), M(new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.35 }))));
    const label = new THREE.Mesh(D(new THREE.PlaneGeometry(6.4, 1.25)), M(new THREE.MeshBasicMaterial({ map: T(apronTexture()) })));
    label.rotation.x = -Math.PI / 2;
    label.position.copy(P(CX, -0.65, 0.66));
    table.add(label);
  }
  const plunger = new THREE.Group();
  {
    const x = TABLE.plunger.x;
    const rod = new THREE.Mesh(D(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 10)), chrome);
    rod.rotation.x = Math.PI / 2;
    rod.position.z = 1.1;
    plunger.add(rod);
    const tip = new THREE.Mesh(D(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 20)), M(new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.4 })));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.07;
    plunger.add(tip);
    const knob = new THREE.Mesh(kit.sphere, M(new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.25, emissive: '#7f1d1d', emissiveIntensity: 0.4 })));
    knob.scale.set(0.32, 0.32, 0.26);
    knob.position.z = 2.45;
    plunger.add(knob);
    plunger.position.copy(P(x, TABLE.plunger.y, 0.3));
    table.add(plunger);
  }
  const springPts = [];
  for (let i = 0; i <= 80; i++) {
    const a = i * 0.7;
    springPts.push(new THREE.Vector3(Math.cos(a) * 0.17, Math.sin(a) * 0.17, i / 80));
  }
  const spring = new THREE.Mesh(D(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 200, 0.025, 5, false)), darkChrome);
  table.add(spring);
  const kickPost = new THREE.Group();
  {
    const c = new THREE.Mesh(D(new THREE.CylinderGeometry(0.16, 0.18, 0.3, 14)), redRubber);
    c.position.y = 0.15;
    kickPost.add(c);
    kickPost.position.copy(P(TABLE.kickback.x, 0.85, 0));
    table.add(kickPost);
  }

  // ---------------------------------------------------------------- rails, posts, bank, gate
  const railGeo = D(new THREE.BoxGeometry(1, 0.42, 0.09));
  const postGeo = D(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12));
  const ringGeo = D(new THREE.TorusGeometry(0.11, 0.04, 6, 16));
  let gate = null;
  for (const w of TABLE.walls) {
    if (w.kind === 'outer' || w.kind === 'plunger' || w.kind === 'sling' || w.kind === 'slingSide' || w.kind === 'bank') continue;
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const len = Math.hypot(dx, dy);
    if (w.kind === 'gate') {
      gate = new THREE.Group();
      gate.position.copy(P((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, 0.5));
      gate.rotation.y = angleOf(dx, dy);
      const flap = new THREE.Mesh(D(new THREE.BoxGeometry(len, 0.42, 0.025)), darkChrome);
      flap.position.y = -0.22;
      const pivot = new THREE.Group();
      pivot.add(flap);
      gate.add(pivot);
      gate.userData.pivot = pivot;
      const bar = new THREE.Mesh(D(new THREE.CylinderGeometry(0.03, 0.03, len + 0.1, 8)), chrome);
      bar.rotation.z = Math.PI / 2;
      gate.add(bar);
      table.add(gate);
      continue;
    }
    if (w.kind === 'rampLip') continue;
    const m = S(new THREE.Mesh(railGeo, chrome));
    m.scale.x = len;
    m.position.copy(P((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, 0.21));
    m.rotation.y = angleOf(dx, dy);
    table.add(m);
    for (const [x, y] of [[w.x1, w.y1], [w.x2, w.y2]]) {
      if (y < -1) continue;
      const p = S(new THREE.Mesh(postGeo, chrome));
      p.position.copy(P(x, y, 0.25));
      table.add(p);
    }
  }
  // Rubber rings on the outlane separator tops and the top lane posts
  for (const [x, y] of [[0.75, 5.0], [2 * CX - 0.75, 5.0], ...TABLE.lanePosts.map((x) => [x, 17.7])]) {
    const r = S(new THREE.Mesh(ringGeo, redRubber));
    r.rotation.x = Math.PI / 2;
    r.position.copy(P(x, y, 0.2));
    table.add(r);
  }
  {
    const shape = new THREE.Shape();
    shape.moveTo(-0.05, 10.0);
    shape.lineTo(0.3, 9.6);
    shape.lineTo(0.3, 6.9);
    shape.lineTo(-0.05, 6.5);
    shape.closePath();
    const g = D(new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: false }));
    table.add(new THREE.Mesh(toTable(g), M(new THREE.MeshStandardMaterial({ color: '#7c4a1e', roughness: 0.8 }))));
  }

  // ---------------------------------------------------------------- slingshots
  const slings = TABLE.slings.map((sl) => {
    const g = new THREE.Group();
    table.add(g);
    const [A, B, C] = sl.pts;
    const cx = (A[0] + B[0] + C[0]) / 3;
    const cy = (A[1] + B[1] + C[1]) / 3;
    const shrink = (p, k) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k];
    const tri = (k) => {
      const s = new THREE.Shape();
      const pts = [A, B, C].map((p) => shrink(p, k));
      s.moveTo(pts[0][0], pts[0][1]);
      s.lineTo(pts[1][0], pts[1][1]);
      s.lineTo(pts[2][0], pts[2][1]);
      s.closePath();
      return s;
    };
    const body = new THREE.Mesh(toTable(D(new THREE.ExtrudeGeometry(tri(0.82), { depth: 0.42, bevelEnabled: false }))), whitePlastic);
    g.add(body);
    const capMat = M(new THREE.MeshStandardMaterial({ color: sl.side === 'L' ? '#facc15' : '#38bdf8', roughness: 0.15, transparent: true, opacity: 0.8, emissive: sl.side === 'L' ? '#facc15' : '#38bdf8', emissiveIntensity: 0.3 }));
    const cap = new THREE.Mesh(toTable(D(new THREE.ExtrudeGeometry(tri(1.08), { depth: 0.05, bevelEnabled: false }))), capMat);
    cap.position.y = 0.46;
    g.add(cap);
    // Rubber band around the three corner posts
    const loop = [];
    const corners = [A, B, C];
    for (let i = 0; i < 3; i++) {
      const p = corners[i];
      const q = corners[(i + 1) % 3];
      for (let k = 0; k < 6; k++) {
        const t = k / 6;
        loop.push(P(lerp(p[0], q[0], t), lerp(p[1], q[1], t), 0.22));
      }
    }
    const band = new THREE.Mesh(D(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true, 'catmullrom', 0.1), 60, 0.065, 6, true)), rubber);
    g.add(band);
    for (const p of corners) {
      const post = S(new THREE.Mesh(postGeo, chrome));
      post.position.copy(P(p[0], p[1], 0.25));
      g.add(post);
    }
    return { g, capMat, band, kickN: new THREE.Vector3(), side: sl.side };
  });

  // ---------------------------------------------------------------- flippers
  const flipperGeo = (() => {
    const { length: L, r0, r1 } = FLIPPER;
    const outline = (k) => {
      const s = new THREE.Shape();
      const R0 = r0 + k;
      const R1 = r1 + k;
      const d = Math.asin((r0 - r1) / L);
      const N = 14;
      for (let i = 0; i <= N; i++) {
        const a = Math.PI / 2 + d + ((Math.PI - 2 * d) * i) / N;
        const x = Math.cos(a) * R0;
        const y = Math.sin(a) * R0;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
      }
      for (let i = 0; i <= N; i++) {
        const a = -Math.PI / 2 + d + ((Math.PI - 2 * d) * i) / N;
        s.lineTo(L + Math.cos(a) * R1, Math.sin(a) * R1);
      }
      s.closePath();
      return s;
    };
    const body = D(new THREE.ExtrudeGeometry(outline(-0.02), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2 }));
    body.rotateX(-Math.PI / 2);
    const band = D(new THREE.ExtrudeGeometry(outline(0.02), { depth: 0.12, bevelEnabled: false }));
    band.rotateX(-Math.PI / 2);
    band.translate(0, 0.1, 0);
    return { body, band };
  })();
  const flippers = TABLE.flippers.map((f) => {
    const g = new THREE.Group();
    g.position.copy(P(f.px, f.py, 0.02));
    g.add(new THREE.Mesh(flipperGeo.body, whitePlastic));
    g.add(new THREE.Mesh(flipperGeo.band, redRubber));
    const cap = new THREE.Mesh(D(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16)), chrome);
    cap.position.y = 0.36;
    g.add(cap);
    table.add(g);
    return g;
  });

  // ---------------------------------------------------------------- inserts (lights)
  const lights = [];
  const circleGeo = D(new THREE.CircleGeometry(1, 24));
  const chevronGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 1);
    s.lineTo(0.85, -0.1);
    s.lineTo(0.45, -0.1);
    s.lineTo(0.45, -0.9);
    s.lineTo(-0.45, -0.9);
    s.lineTo(-0.45, -0.1);
    s.lineTo(-0.85, -0.1);
    s.closePath();
    return D(new THREE.ShapeGeometry(s));
  })();
  /** A playfield light: drawn later as one instanced mesh per shape plus one glow point cloud. */
  function insert(x, y, color, size = 0.17, { shape = 'circle', angle = 0 } = {}) {
    const on = new THREE.Color(color);
    const L = {
      x,
      y,
      size,
      shape,
      angle,
      on,
      off: on.clone().multiplyScalar(0.16),
      level: -1,
      dirty: true,
      set(v) {
        const k = clamp(v, 0, 1);
        if (Math.abs(k - L.level) < 0.01) return;
        L.level = k;
        L.dirty = true;
      },
      setColor(c) {
        if (L.on.getHexString() === new THREE.Color(c).getHexString()) return;
        L.on.set(c);
        L.off.copy(L.on).multiplyScalar(0.16);
        L.dirty = true;
      },
    };
    lights.push(L);
    return L;
  }
  const L = {
    lanes: TABLE.lanes.map((l) => insert(l.x, l.y - 0.05, '#fde047', 0.17)),
    laneArrows: TABLE.lanes.map((l) => insert(l.x, l.y - 0.75, '#fef08a', 0.16, { shape: 'chevron' })),
    inlanes: TABLE.inlanes.map((l) => insert(l.x, l.y - 0.55, l.kind === 'inlane' ? '#86efac' : '#fca5a5', 0.14)),
    kickback: insert(TABLE.kickback.x, 2.95, '#f87171', 0.2, { shape: 'chevron' }),
    save: insert(CX, 1.0, '#67e8f9', 0.2),
    mult: [2, 3, 4, 5].map((k) => insert(CX - 1.5 + (k - 2), 5.3, '#facc15', 0.17)),
    center: [0, 1, 2].map((i) => insert(CX - 0.5 + i * 0.5, 9.25, '#f472b6', 0.17, { shape: 'chevron' })),
    ramp: insert(7.9, 9.0, '#38bdf8', 0.32, { shape: 'chevron' }),
    orbitL: insert(0.55, 10.75, '#c4b5fd', 0.2, { shape: 'chevron' }),
    orbitR: insert(8.85, 9.95, '#c4b5fd', 0.2, { shape: 'chevron' }),
    digletts: TABLE.drops.map((d) => insert(1.05, d.y, '#fb923c', 0.12)),
    chase: [],
  };
  for (let i = 0; i < 20; i++) {
    const a = 0.12 + ((Math.PI - 0.24) * i) / 19;
    L.chase.push(insert(5 - 4.45 * Math.cos(a), 15 + 4.45 * Math.sin(a), ['#f472b6', '#22d3ee', '#facc15', '#a3e635'][i % 4], 0.09));
  }
  // Inserts: one instanced mesh per shape; glows: one additive point cloud with a size per light
  const insertMeshes = [];
  for (const [shape, geo] of [['circle', circleGeo], ['chevron', chevronGeo]]) {
    const list = lights.filter((l) => l.shape === shape);
    const im = new THREE.InstancedMesh(geo, M(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 })), list.length);
    const o = new THREE.Object3D();
    list.forEach((l, i) => {
      o.position.copy(P(l.x, l.y, 0.012));
      o.rotation.set(-Math.PI / 2, 0, l.angle);
      o.scale.setScalar(l.size);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      im.setColorAt(i, l.off);
      l.mesh = im;
      l.i = i;
    });
    im.instanceMatrix.needsUpdate = true;
    table.add(im);
    insertMeshes.push(im);
  }
  const glowPos = new Float32Array(lights.length * 3);
  const glowCol = new Float32Array(lights.length * 3);
  const glowSize = new Float32Array(lights.length);
  lights.forEach((l, i) => {
    const p = P(l.x, l.y, 0.08);
    glowPos.set([p.x, p.y, p.z], i * 3);
    glowSize[i] = l.size * 4.2;
    l.g = i;
  });
  const glowGeo = D(new THREE.BufferGeometry());
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  glowGeo.setAttribute('gcolor', new THREE.BufferAttribute(glowCol, 3));
  glowGeo.setAttribute('size', new THREE.BufferAttribute(glowSize, 1));
  const glowMat = M(
    new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTex }, scale: { value: 400 } },
      vertexShader: 'attribute float size; attribute vec3 gcolor; varying vec3 vColor; uniform float scale; void main() { vColor = gcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec3 vColor; void main() { float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vColor * a, a); }',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const glows = new THREE.Points(glowGeo, glowMat);
  glows.frustumCulled = false;
  table.add(glows);
  const lightColor = new THREE.Color();
  function flushLights() {
    let mesh = false;
    let glow = false;
    for (const l of lights) {
      if (!l.dirty) continue;
      l.dirty = false;
      const k = Math.max(0, l.level);
      lightColor.copy(l.off).lerp(l.on, k);
      l.mesh.setColorAt(l.i, lightColor);
      l.mesh.instanceColor.needsUpdate = true;
      mesh = true;
      glowCol[l.g * 3] = l.on.r * k * 0.85;
      glowCol[l.g * 3 + 1] = l.on.g * k * 0.85;
      glowCol[l.g * 3 + 2] = l.on.b * k * 0.85;
      glow = true;
    }
    if (glow) glowGeo.attributes.gcolor.needsUpdate = true;
    return mesh;
  }

  // ---------------------------------------------------------------- bumpers (Voltorb, Electrode)
  const arcMat = M(new THREE.LineBasicMaterial({ color: '#fef08a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  const bumpers = TABLE.bumpers.map((b) => {
    const g = new THREE.Group();
    g.position.copy(P(b.x, b.y, 0));
    table.add(g);
    const skirt = S(new THREE.Mesh(D(new THREE.CylinderGeometry(b.r + 0.02, b.r + 0.08, 0.14, 32)), whitePlastic));
    skirt.position.y = 0.07;
    g.add(skirt);
    const ringMat = M(new THREE.MeshBasicMaterial({ color: '#7c2d12' }));
    const ring = new THREE.Mesh(D(new THREE.TorusGeometry(b.r - 0.02, 0.05, 8, 32)), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.16;
    g.add(ring);
    const metal = S(new THREE.Mesh(D(new THREE.CylinderGeometry(b.r * 0.9, b.r * 0.9, 0.05, 28)), chrome));
    metal.position.y = 0.19;
    g.add(metal);
    const model = createVoltorb(kit, { electrode: b.kind === 'electrode' });
    model.group.position.y = 0.18;
    model.group.scale.setScalar(1.12);
    model.group.rotation.x = -0.42; // eyes towards the camera
    g.add(model.group);
    const arcGeo = D(new THREE.BufferGeometry());
    arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * 2 * 18), 3));
    const arcs = new THREE.LineSegments(arcGeo, arcMat);
    arcs.visible = false;
    g.add(arcs);
    return { g, ringMat, model, arcs };
  });

  // ---------------------------------------------------------------- Digletts
  const holeGeo = D(new THREE.CircleGeometry(0.31, 24));
  const moundGeo = D(new THREE.TorusGeometry(0.32, 0.07, 8, 24));
  const dirtMat = M(new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.9 }));
  const digletts = TABLE.drops.map((d) => {
    const g = new THREE.Group();
    g.position.copy(P(0.42, d.y, 0));
    table.add(g);
    const hole = S(new THREE.Mesh(holeGeo, dark));
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.015;
    g.add(hole);
    const mound = S(new THREE.Mesh(moundGeo, dirtMat));
    mound.rotation.x = Math.PI / 2;
    mound.position.y = 0.03;
    mound.scale.z = 0.6;
    g.add(mound);
    const model = createDiglett(kit);
    model.group.rotation.y = Math.PI / 2 - 0.7;
    model.group.scale.setScalar(1.2);
    g.add(model.group);
    return { model, pop: 1, v: 0 };
  });

  // ---------------------------------------------------------------- spinner + Psyduck
  const spinner = new THREE.Group();
  {
    const sp = TABLE.spinner;
    const w = sp.x1 - sp.x0;
    spinner.position.copy(P((sp.x0 + sp.x1) / 2, sp.y, 0.56));
    table.add(spinner);
    for (const sx of [-1, 1]) {
      const post = S(new THREE.Mesh(D(new THREE.CylinderGeometry(0.035, 0.035, 0.56, 8)), chrome));
      post.position.set((sx * w) / 2, -0.28, 0);
      spinner.add(post);
    }
    const bar = new THREE.Mesh(D(new THREE.CylinderGeometry(0.025, 0.025, w, 8)), chrome);
    bar.rotation.z = Math.PI / 2;
    spinner.add(bar);
    const pivot = new THREE.Group();
    spinner.add(pivot);
    const plate = new THREE.Mesh(D(new THREE.BoxGeometry(w - 0.12, 0.4, 0.03)), M(new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.25, metalness: 0.3, emissive: '#a16207', emissiveIntensity: 0.4 })));
    plate.position.y = -0.22;
    pivot.add(plate);
    const stripe = new THREE.Mesh(D(new THREE.BoxGeometry(w - 0.1, 0.08, 0.04)), M(new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.3 })));
    stripe.position.y = -0.22;
    pivot.add(stripe);
    spinner.userData.pivot = pivot;
  }
  const psyduck = createPsyduck(kit);
  {
    const p = TABLE.posts[0];
    const ped = new THREE.Mesh(D(new THREE.CylinderGeometry(p.r, p.r + 0.04, 0.32, 18)), M(new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.3, emissive: '#1d4ed8', emissiveIntensity: 0.3 })));
    ped.position.copy(P(p.x, p.y, 0.16));
    table.add(ped);
    psyduck.group.position.copy(P(p.x, p.y, 0.32));
    psyduck.group.scale.setScalar(1.15);
    psyduck.group.rotation.set(-0.3, 0.35, 0, 'YXZ');
    table.add(psyduck.group);
  }

  // ---------------------------------------------------------------- ramp + Cloyster
  const rampCurve = new THREE.CatmullRomCurve3(RAMP_PATH.map(([x, y, h]) => P(x, y, h)), false, 'centripetal');
  {
    const N = 140;
    const up = new THREE.Vector3(0, 1, 0);
    const floorPos = [];
    const wallL = [];
    const wallR = [];
    const railL = [];
    const railR = [];
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const side = new THREE.Vector3();
    const HW = 0.48;
    const WH = 0.3;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      rampCurve.getPointAt(u, p);
      rampCurve.getTangentAt(u, t);
      side.crossVectors(t, up).normalize();
      const l = p.clone().addScaledVector(side, -HW);
      const r = p.clone().addScaledVector(side, HW);
      floorPos.push(l.x, l.y, l.z, r.x, r.y, r.z);
      wallL.push(l.x, l.y, l.z, l.x, l.y + WH, l.z);
      wallR.push(r.x, r.y, r.z, r.x, r.y + WH, r.z);
      railL.push(l.clone().setY(l.y + WH));
      railR.push(r.clone().setY(r.y + WH));
    }
    const strip = (arr) => {
      const g = D(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const idx = [];
      for (let i = 0; i < N; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    const plastic = M(new THREE.MeshStandardMaterial({ color: '#7dd3fc', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false, emissive: '#0ea5e9', emissiveIntensity: 0.25 }));
    const floor = new THREE.Mesh(strip(floorPos), plastic);
    floor.renderOrder = 2;
    table.add(floor);
    for (const w of [wallL, wallR]) {
      const m = new THREE.Mesh(strip(w), plastic);
      m.renderOrder = 2;
      table.add(m);
    }
    for (const r of [railL, railR]) table.add(new THREE.Mesh(D(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(r), 140, 0.035, 6, false)), chrome));
    // Supports
    for (const u of [0.18, 0.32, 0.46, 0.6, 0.74, 0.88]) {
      rampCurve.getPointAt(u, p);
      const base = p.x < -4.9 ? WALL_H : 0;
      const hgt = p.y - base;
      if (hgt < 0.25) continue;
      const post = S(new THREE.Mesh(D(new THREE.CylinderGeometry(0.035, 0.035, hgt, 8)), chrome));
      post.position.set(p.x, base + hgt / 2, p.z);
      table.add(post);
    }
  }
  const cloyster = createCloyster(kit);
  cloyster.group.position.copy(P(CLOYSTER.x, CLOYSTER.y, WALL_H + 0.02));
  cloyster.group.rotation.set(0.3, 0.55, 0, 'YXZ');
  cloyster.group.scale.setScalar(1.25);
  table.add(cloyster.group);
  const cloysterMouth = new THREE.Vector3();

  // ---------------------------------------------------------------- centre target, catch hole, wild Pokémon
  const centerBall = createPokeBall(kit, 0.4, { shiny: 0.2 });
  const centerG = new THREE.Group();
  centerG.position.copy(P(TABLE.center.x, TABLE.center.y, 0));
  centerBall.position.y = 0.4;
  centerG.add(centerBall);
  const centerBase = new THREE.Mesh(D(new THREE.CylinderGeometry(0.44, 0.48, 0.08, 24)), chrome);
  centerBase.position.y = 0.04;
  centerG.add(centerBase);
  table.add(centerG);
  const holeG = new THREE.Group();
  holeG.position.copy(P(TABLE.hole.x, TABLE.hole.y, 0));
  table.add(holeG);
  const holeDisc = new THREE.Mesh(D(new THREE.CircleGeometry(TABLE.hole.r, 28)), dark);
  holeDisc.rotation.x = -Math.PI / 2;
  holeDisc.position.y = 0.01;
  holeG.add(holeDisc);
  const holeCap = new THREE.Mesh(D(new THREE.CylinderGeometry(TABLE.hole.r - 0.02, TABLE.hole.r - 0.02, 0.05, 28)), whitePlastic);
  holeCap.position.y = 0.025;
  holeG.add(holeCap);
  const holeRingMat = M(new THREE.MeshBasicMaterial({ color: '#4c1d95' }));
  const holeRing = new THREE.Mesh(D(new THREE.TorusGeometry(TABLE.hole.r + 0.06, 0.05, 8, 32)), holeRingMat);
  holeRing.rotation.x = Math.PI / 2;
  holeRing.position.y = 0.03;
  holeG.add(holeRing);
  const holeGlow = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: glowTex, color: '#f0abfc', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  holeGlow.scale.setScalar(2.2);
  holeGlow.position.y = 0.1;
  holeG.add(holeGlow);

  const wildG = new THREE.Group();
  wildG.position.copy(P(TABLE.wild.x, TABLE.wild.y, 0));
  wildG.rotation.x = -0.32; // lean back a little so the face looks at the player
  table.add(wildG);
  const wildModels = new Map();
  const captureBall = createPokeBall(kit, 0.34);
  captureBall.visible = false;
  wildG.add(captureBall);
  const wildBase = new THREE.Mesh(D(new THREE.CircleGeometry(0.75, 32)), M(new THREE.MeshBasicMaterial({ map: glowTex, color: '#f0abfc', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })));
  wildBase.rotation.x = -Math.PI / 2;
  wildBase.position.y = 0.02;
  wildBase.visible = false;
  wildG.add(wildBase);
  let wildShown = null; // { id, model, t }
  const wildModel = (id) => {
    if (!wildModels.has(id)) {
      const m = createWild(kit, id);
      m.group.visible = false;
      wildG.add(m.group);
      wildModels.set(id, m);
    }
    return wildModels.get(id);
  };

  // ---------------------------------------------------------------- balls, shadows, trails
  const shadowTex = T(
    canvasTexture(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    })
  );
  const shadowMat = M(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  const shadowGeo = D(new THREE.PlaneGeometry(1, 1));
  const haloMat = M(new THREE.SpriteMaterial({ map: glowTex, color: '#fff7d6', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  const ballPool = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const ball = createPokeBall(kit, BALL_R, { shiny: 0.12 });
    g.add(ball);
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(BALL_R * 3.4);
    g.add(halo);
    g.visible = false;
    table.add(g);
    const sh = new THREE.Mesh(shadowGeo, shadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.scale.setScalar(BALL_R * 3.2);
    sh.visible = false;
    table.add(sh);
    ballPool.push({ g, ball, sh, id: null, last: new THREE.Vector3(), has: false, spit: 0, trail: [] });
  }
  const TRAIL_N = 14;
  const trailGeo = D(new THREE.BufferGeometry());
  trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(4 * TRAIL_N * 3), 3));
  trailGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(4 * TRAIL_N * 3), 3));
  const trail = new THREE.Points(trailGeo, M(new THREE.PointsMaterial({ size: 0.42, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  trail.frustumCulled = false;
  table.add(trail);

  // ---------------------------------------------------------------- sparks
  const SPARK_N = 360;
  const sparkPos = new Float32Array(SPARK_N * 3);
  const sparkCol = new Float32Array(SPARK_N * 3);
  const sparkGeo = D(new THREE.BufferGeometry());
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparkPts = new THREE.Points(sparkGeo, M(new THREE.PointsMaterial({ size: 0.26, map: glowTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  sparkPts.frustumCulled = false;
  table.add(sparkPts);
  const sparks = Array.from({ length: SPARK_N }, () => ({ life: 0, max: 1, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, c: new THREE.Color(), g: 9 }));
  let sparkI = 0;
  const tmpC = new THREE.Color();
  function emit(pos, n, { colors = ['#fde047', '#ffffff'], speed = 5, life = 0.6, up = 2, gravity = 9 } = {}) {
    for (let i = 0; i < n; i++) {
      const p = sparks[sparkI];
      sparkI = (sparkI + 1) % SPARK_N;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      p.x = pos.x;
      p.y = pos.y;
      p.z = pos.z;
      p.vx = Math.cos(a) * v;
      p.vz = Math.sin(a) * v;
      p.vy = up * (0.5 + Math.random());
      p.life = p.max = life * (0.6 + Math.random() * 0.6);
      p.g = gravity;
      p.c.set(colors[i % colors.length]);
    }
  }

  // ---------------------------------------------------------------- merge the static parts
  {
    table.updateMatrixWorld(true);
    const inv = table.matrixWorld.clone().invert();
    const groups = new Map();
    const found = [];
    table.traverse((o) => {
      if (o.isMesh && o.userData.static && o.geometry.index) found.push(o);
    });
    for (const o of found) {
      const g = o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!groups.has(o.material)) groups.set(o.material, []);
      groups.get(o.material).push(g);
      o.removeFromParent();
    }
    for (const [mat, list] of groups) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (merged) table.add(new THREE.Mesh(D(merged), mat));
    }
  }

  // ---------------------------------------------------------------- camera & resize
  const cam = { ty: 7, ready: false, D: 34, base: 6.6 };
  const resize = () => {
    const w = container.clientWidth || 360;
    const h = container.clientHeight || 640;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    glowMat.uniforms.scale.value = (h * pixelRatio) / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const half = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const hfov = Math.atan(half * camera.aspect);
    // Fit the cabinet width; on wide screens show ~70% of the length and follow the ball
    cam.D = clamp(Math.max(5.95 / Math.tan(hfov), 34), 34, 64);
    cam.base = camera.aspect > 1 ? 5.4 : 6.6;
  };
  resize();
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(resize);
    ro.observe(container);
  } else window.addEventListener('resize', resize);

  // ---------------------------------------------------------------- effects
  const bumperFlash = [0, 0, 0];
  let psySpin = 0;
  let kickAnim = 0;
  let cloysterEat = 0;
  let cloysterOpen = 0;
  let plungerBounce = 0;
  let centerWobble = 0;
  let dugtrioCheer = 0;
  let multiFlash = 0;
  const tmpV = new THREE.Vector3();

  function fx(e) {
    switch (e.type) {
      case 'bumper': {
        const b = bumpers[e.i];
        b.model.hit();
        bumperFlash[e.i] = 1;
        emit(P(e.x, e.y, 0.6), 18, { colors: ['#fde047', '#ffffff', '#facc15'], speed: 5, life: 0.5 });
        flashLight.position.copy(table.localToWorld(P(e.x, e.y, 1.6)));
        flashLight.intensity = 6;
        break;
      }
      case 'sling':
        emit(P(e.x, e.y, 0.3), 8, { colors: ['#ffffff', e.side === 'L' ? '#facc15' : '#38bdf8'], speed: 3.5, life: 0.35 });
        slings[e.side === 'L' ? 0 : 1].kick = 1;
        break;
      case 'drop':
        digletts[e.i].model.hit();
        emit(P(0.5, e.y, 0.2), 14, { colors: ['#8b5a2b', '#d6a36b', '#fde68a'], speed: 3, life: 0.6, up: 3 });
        break;
      case 'dugtrio':
        dugtrioCheer = 2.2;
        break;
      case 'dropReset':
        for (const d of digletts) emit(P(0.5, TABLE.drops[digletts.indexOf(d)].y, 0.2), 8, { colors: ['#8b5a2b', '#d6a36b'], speed: 2.5, life: 0.5, up: 3 });
        break;
      case 'center':
        centerWobble = 1;
        emit(P(TABLE.center.x, TABLE.center.y, 0.6), 14, { colors: ['#f472b6', '#ffffff'], speed: 4, life: 0.5 });
        break;
      case 'holeOpen':
      case 'hole':
        emit(P(TABLE.hole.x, TABLE.hole.y, 0.2), 30, { colors: ['#f0abfc', '#ffffff', '#c084fc'], speed: 4, life: 0.8, up: 4 });
        break;
      case 'catchStart': {
        const m = wildModel(e.mon.id);
        wildShown = { id: e.mon.id, model: m, t: 0 };
        emit(P(TABLE.wild.x, TABLE.wild.y, 0.6), 40, { colors: ['#ffffff', e.mon.color, '#fde047'], speed: 5, life: 0.9, up: 4 });
        break;
      }
      case 'catchHit':
        wildShown?.model.hit();
        emit(P(TABLE.wild.x, TABLE.wild.y, 0.7), 22, { colors: [WILD.find((w) => w.id === e.mon.id)?.color || '#ffffff', '#ffffff'], speed: 5, life: 0.6 });
        break;
      case 'caught':
        emit(P(TABLE.wild.x, TABLE.wild.y, 0.6), 50, { colors: ['#ffffff', '#ef4444', '#fde047'], speed: 6, life: 1.0, up: 5 });
        break;
      case 'rampEnter':
        break;
      case 'cloysterEat':
        cloysterEat = 1;
        break;
      case 'cloysterSpit': {
        cloysterOpen = 0.6;
        const slot = ballPool.find((b) => b.id === e.id);
        if (slot) slot.spit = 0.35;
        emit(cloysterMouth, 16, { colors: ['#e0e7ff', '#a5b4fc', '#ffffff'], speed: 3, life: 0.5 });
        break;
      }
      case 'kickback':
        kickAnim = 1;
        emit(P(e.x, e.y, 0.2), 20, { colors: ['#f87171', '#ffffff'], speed: 4, life: 0.5, up: 3 });
        break;
      case 'save':
        emit(P(CX, 0.9, 0.3), 30, { colors: ['#67e8f9', '#ffffff'], speed: 4, life: 0.8, up: 4 });
        break;
      case 'launch':
        plungerBounce = 1;
        break;
      case 'spinner':
        psySpin = Math.min(1.5, psySpin + e.speed / 12);
        break;
      case 'lane':
        emit(P(e.x, e.y, 0.3), 14, { colors: ['#fde047', '#ffffff'], speed: 3, life: 0.5 });
        break;
      case 'mult':
      case 'multiball':
        multiFlash = 1.5;
        break;
      default:
    }
  }

  // ---------------------------------------------------------------- per-frame update
  let time = 0;
  let lastState = null;
  let slowFor = 0;
  let lowPower = false;
  const ballPos = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const blink = (hz, duty = 0.5) => ((time * hz) % 1 < duty ? 1 : 0.15);

  function update(s, dt) {
    time += dt;
    if (dt > 1 / 38) slowFor += dt;
    else slowFor = Math.max(0, slowFor - dt * 0.5);
    if (!lowPower && slowFor > 3) {
      lowPower = true;
      pixelRatio = 1;
      renderer.setPixelRatio(1);
      resize();
      trail.visible = false;
    }
    if (s) drawState(s, dt);
    lastState = s;
    // Sparks
    for (let i = 0; i < SPARK_N; i++) {
      const p = sparks[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.03) {
          p.y = 0.03;
          p.vy *= -0.4;
        }
        const k = Math.max(0, p.life / p.max);
        tmpC.copy(p.c).multiplyScalar(k);
        sparkPos[i * 3] = p.x;
        sparkPos[i * 3 + 1] = p.y;
        sparkPos[i * 3 + 2] = p.z;
        sparkCol[i * 3] = tmpC.r;
        sparkCol[i * 3 + 1] = tmpC.g;
        sparkCol[i * 3 + 2] = tmpC.b;
      } else if (sparkPos[i * 3 + 1] !== -99) {
        sparkPos[i * 3 + 1] = -99;
        sparkCol[i * 3] = sparkCol[i * 3 + 1] = sparkCol[i * 3 + 2] = 0;
      }
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 30);
    renderer.render(scene, camera);
  }

  function drawState(s, dt) {
    // Flippers
    s.flippers.forEach((f, i) => {
      flippers[i].rotation.y = flipperPose(f).th;
    });
    // Bumpers
    s.bumpers.forEach((b, i) => {
      const B = bumpers[i];
      bumperFlash[i] = Math.max(0, bumperFlash[i] - dt * 3.5);
      const k = Math.max(bumperFlash[i], b.flash > 0 ? 1 : 0);
      B.ringMat.color.set(k > 0.05 ? '#fde047' : multiFlash > 0 ? (Math.floor(time * 10) % 2 ? '#f472b6' : '#7c2d12') : '#9a3412').lerp(new THREE.Color('#ffffff'), k * 0.5);
      B.model.update(dt, { charge: k });
      B.arcs.visible = k > 0.25;
      if (B.arcs.visible) {
        const pos = B.arcs.geometry.attributes.position;
        let j = 0;
        for (let a = 0; a < 3; a++) {
          const ang = Math.random() * Math.PI * 2;
          let px = Math.cos(ang) * 0.3;
          let pz = Math.sin(ang) * 0.3;
          let py = 0.7;
          for (let sgm = 0; sgm < 6; sgm++) {
            const r = 0.3 + (sgm + 1) * 0.12;
            const na = ang + (Math.random() - 0.5) * 0.9;
            const nx = Math.cos(na) * r;
            const nz = Math.sin(na) * r;
            const ny = 0.7 - (sgm + 1) * 0.1 + (Math.random() - 0.5) * 0.15;
            pos.setXYZ(j++, px, py, pz);
            pos.setXYZ(j++, nx, ny, nz);
            px = nx;
            py = ny;
            pz = nz;
          }
        }
        pos.needsUpdate = true;
      }
    });
    multiFlash = Math.max(0, multiFlash - dt);
    // Slingshots
    slings.forEach((sl, i) => {
      sl.kick = Math.max(0, (sl.kick || 0) - dt * 5);
      const f = Math.max(sl.kick, s.slingFlash[i] * 4);
      sl.capMat.emissiveIntensity = 0.3 + f * 1.6;
      sl.band.scale.setScalar(1 + sl.kick * 0.04);
    });
    // Digletts: spring up when standing, sink fast when hit
    dugtrioCheer = Math.max(0, dugtrioCheer - dt);
    s.drops.forEach((d, i) => {
      const D2 = digletts[i];
      const target = d.up ? 1 : 0;
      if (d.up) {
        D2.v += (target - D2.pop) * 220 * dt - D2.v * 14 * dt;
        D2.pop += D2.v * dt;
      } else {
        D2.pop = Math.max(0, D2.pop - dt * 6);
        D2.v = 0;
      }
      const cheer = s.dugtrio > 0 ? 1 : 0;
      D2.model.update(dt, { pop: s.dugtrio > 0 ? Math.min(1, s.dugtrio * 2) : clamp(D2.pop, 0, 1.25), cheer });
    });
    // Spinner and Psyduck
    spinner.userData.pivot.rotation.x = s.spinner.angle;
    psySpin = Math.max(psySpin - dt * 0.6, Math.min(1.2, s.spinner.w / 25));
    psyduck.update(dt, { spin: psySpin });
    // Gate: swings when a ball passes under it
    if (gate) {
      const near = s.balls.some((b) => b.mode === 'play' && b.x > 8.9 && b.y > 13.2 && b.y < 15.4);
      const pv = gate.userData.pivot;
      pv.rotation.x = lerp(pv.rotation.x, near ? -1.1 : 0, Math.min(1, dt * (near ? 25 : 5)));
    }
    // Plunger
    plungerBounce = Math.max(0, plungerBounce - dt * 4);
    const pullZ = s.pull * 0.7 - Math.sin(plungerBounce * Math.PI * 2) * plungerBounce * 0.15;
    plunger.position.z = 10 - TABLE.plunger.y + pullZ;
    const springLen = 1.5 - pullZ;
    spring.position.copy(P(TABLE.plunger.x, TABLE.plunger.y - pullZ - 0.07, 0.3));
    spring.scale.set(1, 1, springLen);
    kickAnim = Math.max(0, kickAnim - dt * 4);
    kickPost.position.y = Math.sin(kickAnim * Math.PI) * 0.25;
    // Cloyster
    cloysterEat = Math.max(0, cloysterEat - dt * 2);
    cloysterOpen = Math.max(0, cloysterOpen - dt);
    const arriving = s.balls.some((b) => b.mode === 'ramp' && b.t > RAMP_TIME - 0.45);
    const holding = s.balls.some((b) => b.mode === 'cloyster');
    cloyster.update(dt, { opening: arriving || cloysterOpen > 0 ? 1 : holding ? 0.2 : 0, eat: cloysterEat });
    cloyster.mouth.getWorldPosition(cloysterMouth);
    table.worldToLocal(cloysterMouth);
    // Centre target and the catch hole
    centerWobble = Math.max(0, centerWobble - dt * 3);
    const c = s.catch;
    const centerUp = !c;
    centerG.position.y = lerp(centerG.position.y, centerUp ? 0 : -1, Math.min(1, dt * 8));
    centerG.visible = centerG.position.y > -0.95;
    centerBall.rotation.z = Math.sin(time * 30) * centerWobble * 0.3;
    centerBall.rotation.y = Math.sin(time * 0.8) * 0.4;
    const open = s.holeOpen && !c;
    holeCap.position.y = lerp(holeCap.position.y, open ? -0.3 : 0.025, Math.min(1, dt * 6));
    holeCap.visible = holeCap.position.y > -0.25;
    const pulse = open ? 0.5 + 0.5 * Math.sin(time * 8) : 0;
    holeRingMat.color.set(open ? '#f0abfc' : '#4c1d95').multiplyScalar(open ? 0.6 + pulse * 0.4 : 1);
    holeGlow.material.opacity = open ? 0.35 + pulse * 0.45 : 0;
    // Wild Pokémon
    drawWild(s, dt);
    // Lights
    s.lanes.forEach((on, i) => L.lanes[i].set(s.laneFlash > 0 ? blink(8) : on ? 1 : blink(1.2, 0.2) * 0.4));
    L.laneArrows.forEach((l, i) => l.set(s.lanes[i] ? 0.25 : (Math.floor(time * 4) % 3 === i ? 1 : 0.2)));
    L.inlanes.forEach((l, i) => l.set(i < 2 ? (s.inlaneLit[i] ? 1 : 0.15) : 0.35 + 0.3 * Math.sin(time * 3 + i)));
    L.kickback.set(s.kickback ? 0.75 + 0.25 * Math.sin(time * 6) : 0.1);
    L.save.set(s.saveLeft > 3 ? 1 : s.saveLeft > 0 ? blink(6) : 0.08);
    L.mult.forEach((l, i) => l.set(s.mult >= i + 2 ? 1 : s.laneFlash > 0 ? blink(10) : 0.12));
    L.center.forEach((l, i) => l.set(s.holeOpen || c ? blink(5) : i < s.centerHits ? 1 : i === s.centerHits ? blink(2.5) : 0.12));
    L.ramp.set(s.multiball ? blink(7) : blink(1.6));
    L.ramp.setColor(s.multiball ? '#fde047' : '#38bdf8');
    L.orbitL.set(blink(1.3) * 0.9);
    L.orbitR.set((1.15 - blink(1.3)) * 0.9);
    s.drops.forEach((d, i) => L.digletts[i].set(d.up ? 0.9 : 0.1));
    const chaseSpeed = s.multiball || multiFlash > 0 ? 24 : 7;
    L.chase.forEach((l, i) => l.set(((time * chaseSpeed - i) % 20 + 20) % 20 < 3 ? 1 : 0.18));
    flushLights();
    // Balls
    drawBalls(s, dt);
    // Camera: a slight follow of the ball up and down the table
    let focus = 6.5;
    const inPlay = s.balls.filter((b) => b.mode === 'play');
    if (inPlay.length) focus = Math.min(...inPlay.map((b) => b.y));
    else if (s.balls.length) focus = 9;
    const wantTy = clamp(lerp(cam.base, focus, 0.3), cam.base - 1.6, cam.base + 2.6);
    cam.ty = cam.ready ? lerp(cam.ty, wantTy, Math.min(1, dt * 2.2)) : wantTy;
    cam.ready = true;
    const target = table.localToWorld(tmpV.copy(P(5, cam.ty, 0)));
    camera.position.set(target.x, target.y + Math.sin(ELEV) * cam.D, target.z + Math.cos(ELEV) * cam.D);
    camera.lookAt(target);
  }

  function drawWild(s, dt) {
    const c = s.catch;
    for (const [id, m] of wildModels) m.group.visible = !!(c && c.mon.id === id && c.state !== 'caught') || (c && c.state === 'caught' && c.mon.id === id && 2.8 - c.anim < 0.5);
    wildBase.visible = !!c && c.state === 'wild';
    captureBall.visible = false;
    if (!c) {
      wildShown = null;
      return;
    }
    const m = wildModel(c.mon.id);
    if (!wildShown || wildShown.id !== c.mon.id) wildShown = { id: c.mon.id, model: m, t: 0 };
    wildShown.t += dt;
    m.update(dt, { spinSpeed: 0.9 });
    const appear = clamp(wildShown.t / 0.5, 0, 1);
    const pop = appear < 1 ? 1 + Math.sin(appear * Math.PI) * 0.3 : 1;
    let scale = 1.45 * appear * pop;
    m.group.position.set(0, 0, 0);
    if (c.state === 'wild') {
      wildBase.material.opacity = 0.35 + 0.25 * Math.sin(time * 5);
      wildBase.scale.setScalar(1 + (c.timeLeft < 8 ? 0.15 * Math.sin(time * 16) : 0));
    } else if (c.state === 'caught') {
      const t = 2.8 - c.anim;
      // 0..0.5: the Pokémon shrinks into the ball; then the ball shakes three times
      scale *= clamp(1 - t / 0.5, 0, 1);
      m.group.position.y = t * 0.6;
      captureBall.visible = true;
      const drop = clamp((t - 0.35) / 0.3, 0, 1);
      captureBall.position.set(0, 0.34 + (1 - drop) * 0.9, 0);
      const shake = t > 0.8 && t < 2.3 ? Math.sin(((t - 0.8) / 0.5) * Math.PI * 2) * 0.45 * Math.max(0, Math.sin(((t - 0.8) / 0.5) * Math.PI)) : 0;
      captureBall.rotation.set(0, 0, shake);
      if (t > 2.3 && t - dt <= 2.3) emit(P(TABLE.wild.x, TABLE.wild.y, 0.8), 40, { colors: ['#fde047', '#ffffff', '#facc15'], speed: 5, life: 1, up: 5 });
    } else if (c.state === 'fled') {
      const t = 1.2 - c.anim;
      m.group.position.y = Math.sin(clamp(t / 1.2, 0, 1) * Math.PI) * 1.2;
      scale *= clamp(1 - t / 1.2, 0, 1);
    }
    m.group.scale.setScalar(Math.max(0.001, scale));
  }

  function drawBalls(s, dt) {
    const seen = new Set();
    for (const b of s.balls) {
      let slot = ballPool.find((x) => x.id === b.id);
      if (!slot) {
        slot = ballPool.find((x) => x.id == null || !s.balls.some((bb) => bb.id === x.id));
        if (!slot) continue;
        slot.id = b.id;
        slot.has = false;
        slot.trail.length = 0;
      }
      seen.add(slot);
      let visible = true;
      let shadow = true;
      if (b.mode === 'play') {
        let y = b.y;
        if (b.x > LANE_X && b.y < 1.6 && Math.abs(b.vy) < 2.5) y -= s.pull * 0.7;
        const sink = b.y < 0.2 ? clamp((0.2 - b.y) / 0.9, 0, 1) * 0.7 : 0;
        ballPos.copy(P(b.x, y, BALL_R - sink));
        if (slot.spit > 0) {
          slot.spit = Math.max(0, slot.spit - dt);
          const k = slot.spit / 0.35;
          ballPos.lerp(cloysterMouth, k * k);
          ballPos.y += Math.sin(k * Math.PI) * 0.4;
        }
      } else if (b.mode === 'ramp') {
        const u = clamp(b.t / RAMP_TIME, 0, 1);
        rampCurve.getPointAt(u * 0.995, ballPos);
        ballPos.y += BALL_R + 0.02;
        shadow = false;
      } else if (b.mode === 'cloyster') {
        visible = false;
        ballPos.copy(cloysterMouth);
      } else if (b.mode === 'hole') {
        const k = clamp(b.t / HOLE_HOLD, 0, 1);
        const down = k < 0.3 ? k / 0.3 : k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
        ballPos.copy(P(b.x, b.y, BALL_R - down * 0.5));
        shadow = false;
      }
      slot.g.visible = visible;
      if (slot.has) {
        axis.subVectors(ballPos, slot.last);
        const d = Math.hypot(axis.x, axis.z);
        if (d > 1e-5 && d < 2) {
          axis.set(axis.z, 0, -axis.x).normalize();
          q.setFromAxisAngle(axis, d / BALL_R);
          slot.ball.quaternion.premultiply(q);
        }
      }
      slot.last.copy(ballPos);
      slot.has = true;
      slot.g.position.copy(ballPos);
      slot.sh.visible = visible && shadow;
      if (shadow) slot.sh.position.set(ballPos.x + 0.1, 0.016, ballPos.z + 0.08);
      // Trail
      const speed = Math.hypot(b.vx, b.vy);
      if (visible && (speed > 8 || b.mode === 'ramp')) slot.trail.unshift(ballPos.clone());
      else if (slot.trail.length) slot.trail.pop();
      if (slot.trail.length > TRAIL_N) slot.trail.length = TRAIL_N;
    }
    for (const slot of ballPool) {
      if (seen.has(slot)) continue;
      slot.id = null;
      slot.g.visible = false;
      slot.sh.visible = false;
      slot.trail.length = 0;
    }
    const pos = trailGeo.attributes.position;
    const col = trailGeo.attributes.color;
    ballPool.forEach((slot, bi) => {
      for (let i = 0; i < TRAIL_N; i++) {
        const j = bi * TRAIL_N + i;
        const p = slot.trail[i];
        if (p && slot.g.visible) {
          pos.setXYZ(j, p.x, p.y, p.z);
          const k = (1 - i / TRAIL_N) * 0.55;
          col.setXYZ(j, k, k * 0.75, k * 0.9);
        } else {
          pos.setXYZ(j, 0, -99, 0);
          col.setXYZ(j, 0, 0, 0);
        }
      }
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  function info() {
    const s = lastState;
    return { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, sceneTriangles: countTriangles(scene), lowPower, score: s?.score, status: s?.status, balls: s?.balls.map((b) => [b.mode, +b.x.toFixed(2), +b.y.toFixed(2), +b.vx.toFixed(1), +b.vy.toFixed(1)]) };
  }

  function dispose() {
    if (ro) ro.disconnect();
    else window.removeEventListener('resize', resize);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else if (m) m.dispose();
    });
    for (const d of disposables) d.dispose?.();
    kit.dispose();
    for (const t of textures) t.dispose();
    envRT.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
  }

  return {
    update,
    fx,
    resize,
    dispose,
    info,
    get state() {
      return lastState;
    },
  };
}
