// Procedural toy-like props for "Tiệm Pizza Pokémon": pizzas with real layers and toppings, pizza boxes,
// a brick oven with fire, cash registers, tables, plants, lamps and the chef hat / cap / bow tie that the
// Pokémon wear. Everything is built from three.js primitives with soft plastic materials.
import * as THREE from 'three';

const TAU = Math.PI * 2;

/** Geometry/material factory that remembers everything it makes (for dispose). */
export function makeKit() {
  const owned = new Set();
  const own = (x) => {
    owned.add(x);
    return x;
  };
  const mats = new Map();
  const std = (color, extra = {}) => {
    const key = JSON.stringify([color, Object.entries(extra).map(([k, v]) => [k, v && v.isTexture ? v.uuid : v])]);
    if (!mats.has(key)) mats.set(key, own(new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...extra })));
    return mats.get(key);
  };
  const toy = (color, extra = {}) => std(color, { emissive: color, emissiveIntensity: 0.12, roughness: 0.5, ...extra });
  const basic = (color, extra = {}) => own(new THREE.MeshBasicMaterial({ color, ...extra }));
  const geos = new Map();
  const geo = (key, make) => {
    if (!geos.has(key)) geos.set(key, own(make()));
    return geos.get(key);
  };
  const mesh = (parent, g, m, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1], rot = null) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(o);
    return o;
  };
  const box = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));
  const sphere = () => geo('sphere', () => new THREE.SphereGeometry(1, 16, 12));
  const sphereLo = () => geo('sphereLo', () => new THREE.SphereGeometry(1, 9, 7));
  const cyl = () => geo('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 18));
  const cylLo = () => geo('cylLo', () => new THREE.CylinderGeometry(1, 1, 1, 8));
  /** Rounded box (bevelled) of size w×h×d, cached. */
  const rbox = (w, h, d, r = 0.04) =>
    geo(`rbox${w},${h},${d},${r}`, () => {
      const s = new THREE.Shape();
      const x = -w / 2;
      const y = -h / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y);
      s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r);
      s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h);
      s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r);
      s.quadraticCurveTo(x, y, x + r, y);
      const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * Math.min(r, d / 3), bevelEnabled: true, bevelThickness: Math.min(r, d / 3), bevelSize: Math.min(r, d / 3) * 0.9, bevelSegments: 2, curveSegments: 3 });
      g.translate(0, 0, -(d - 2 * Math.min(r, d / 3)) / 2);
      g.computeVertexNormals();
      return g;
    });
  return { own, owned, std, toy, basic, geo, mesh, box, sphere, sphereLo, cyl, cylLo, rbox };
}

/** Disposes everything a kit made. */
export function disposeKit(kit) {
  for (const o of kit.owned) o.dispose?.();
  kit.owned.clear();
}

// ---------------------------------------------------------------- pizza
const TOP_SPOTS = (n, seed, r0 = 0.08, r1 = 0.2) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU + seed * 1.3;
    const r = i % 2 ? r1 : r0 + ((seed * 0.37) % 0.06);
    return [Math.cos(a) * r, Math.sin(a) * r, a * 1.7 + seed];
  });

const TOP_COUNT = { sausage: 6, mushroom: 5, pepper: 5, pineapple: 6, oran: 5 };
const TOP_SEED = { sausage: 0.2, mushroom: 1.1, pepper: 2.3, pineapple: 0.7, oran: 1.9 };

/**
 * Pizza with layers that appear as the child taps: dough (raised rim), tomato sauce, cheese (bumpy edge),
 * toppings. Origin at its bottom centre, radius ~0.33.
 * Returns { group, set(items, extras), bake(stage 'raw'|'baked'|'burnt'), slices(k 0..1) }.
 */
export function createPizza(kit) {
  const doughGeo = kit.geo('pz-dough', () =>
    new THREE.LatheGeometry(
      [
        [0.0, 0.0],
        [0.3, 0.0],
        [0.326, 0.016],
        [0.334, 0.04],
        [0.318, 0.06],
        [0.29, 0.054],
        [0.275, 0.036],
        [0.0, 0.034],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      30
    )
  );
  const sauceGeo = kit.geo('pz-sauce', () => new THREE.CylinderGeometry(0.268, 0.272, 0.012, 30));
  const cheeseGeo = kit.geo('pz-cheese', () => {
    const g = new THREE.CylinderGeometry(0.25, 0.25, 0.016, 30, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r > 0.2) {
        const a = Math.atan2(z, x);
        const k = 1 + 0.06 * Math.sin(a * 7) + 0.04 * Math.sin(a * 13 + 1);
        p.setX(i, x * k);
        p.setZ(i, z * k);
      }
      if (p.getY(i) > 0) p.setY(i, p.getY(i) + 0.004 * Math.sin(x * 40) * Math.cos(z * 37));
    }
    g.computeVertexNormals();
    return g;
  });
  const mat = {
    doughRaw: kit.toy('#f6dca4'),
    doughBaked: kit.toy('#e3a253'),
    doughBurnt: kit.std('#4a2f1c'),
    sauce: kit.toy('#d8382a', { roughness: 0.3 }),
    cheeseRaw: kit.toy('#fff1a8', { roughness: 0.35 }),
    cheeseBaked: kit.toy('#ffc23a', { roughness: 0.3 }),
    cheeseBurnt: kit.std('#6b4320'),
    sausage: kit.toy('#c2382b'),
    sausageDot: kit.toy('#f2b0a0'),
    mushroom: kit.toy('#e6d2b8'),
    mushroomDark: kit.toy('#a07a58'),
    pepper: kit.toy('#2fae4f'),
    pineapple: kit.toy('#ffd23f'),
    oran: kit.toy('#3f6fe0', { roughness: 0.25 }),
    leaf: kit.toy('#48b34f'),
  };
  const topGeo = {
    sausage: kit.geo('pz-sausage', () => new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14)),
    mushroom: kit.geo('pz-mush', () => new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2)),
    pepper: kit.geo('pz-pepper', () => new THREE.TorusGeometry(0.036, 0.011, 6, 16)),
    pineapple: kit.geo('pz-pine', () => new THREE.BoxGeometry(0.06, 0.024, 0.042)),
    oran: kit.geo('pz-oran', () => new THREE.SphereGeometry(0.034, 12, 9)),
  };
  const group = new THREE.Group();
  const inner = new THREE.Group(); // pops when a layer is added
  group.add(inner);
  const dough = kit.mesh(inner, doughGeo, mat.doughRaw);
  const sauce = kit.mesh(inner, sauceGeo, mat.sauce, [0, 0.04, 0]);
  const cheese = kit.mesh(inner, cheeseGeo, mat.cheeseRaw, [0, 0.05, 0]);
  const tops = {};
  for (const [id, n] of Object.entries(TOP_COUNT)) {
    const g = new THREE.Group();
    inner.add(g);
    TOP_SPOTS(n, TOP_SEED[id]).forEach(([x, z, a]) => {
      const y = 0.064;
      if (id === 'sausage') {
        kit.mesh(g, topGeo.sausage, mat.sausage, [x, y, z]);
        kit.mesh(g, kit.sphereLo(), mat.sausageDot, [x + 0.015, y + 0.011, z - 0.01], [0.012, 0.003, 0.01]);
      } else if (id === 'mushroom') {
        kit.mesh(g, topGeo.mushroom, mat.mushroom, [x, y - 0.004, z], [0.046, 0.026, 0.038], [0, a, 0]);
        kit.mesh(g, kit.box(), mat.mushroomDark, [x, y + 0.004, z + 0.012], [0.018, 0.01, 0.03], [0, a, 0]);
      } else if (id === 'pepper') kit.mesh(g, topGeo.pepper, mat.pepper, [x, y, z], [1, 1, 0.7], [Math.PI / 2, 0, a]);
      else if (id === 'pineapple') kit.mesh(g, topGeo.pineapple, mat.pineapple, [x, y + 0.002, z], [1, 1, 1], [0, a, 0]);
      else {
        kit.mesh(g, topGeo.oran, mat.oran, [x, y + 0.016, z]);
        kit.mesh(g, kit.sphereLo(), mat.leaf, [x + 0.01, y + 0.048, z], [0.012, 0.006, 0.02], [0, a, 0.4]);
      }
    });
    g.visible = false;
    tops[id] = g;
  }
  let shown = '';
  let pop = 0;
  function set(items = [], extras = []) {
    const all = [...items, ...extras];
    const key = all.join(',');
    if (key === shown) return false;
    const grew = all.length > shown.split(',').filter(Boolean).length;
    shown = key;
    dough.visible = all.includes('dough');
    sauce.visible = all.includes('sauce');
    cheese.visible = all.includes('cheese');
    for (const [id, g] of Object.entries(tops)) g.visible = all.includes(id);
    if (grew) pop = 1;
    return grew;
  }
  function bake(stage) {
    dough.material = stage === 'burnt' ? mat.doughBurnt : stage === 'baked' ? mat.doughBaked : mat.doughRaw;
    cheese.material = stage === 'burnt' ? mat.cheeseBurnt : stage === 'baked' ? mat.cheeseBaked : mat.cheeseRaw;
  }
  function update(dt) {
    if (pop > 0) {
      pop = Math.max(0, pop - dt * 4);
      const k = 1 + Math.sin(pop * Math.PI) * 0.18;
      inner.scale.set(k, 1 + Math.sin(pop * Math.PI) * 0.4, k);
    }
  }
  /** Eaten: hides slices of the pizza (k = part left). */
  function slices(k) {
    const s = Math.max(0.0001, k);
    inner.scale.set(s ** 0.5, 1, s ** 0.5);
  }
  set([]);
  return { group, set, bake, update, slices, inner };
}

/** Pizza box: a base and a hinged lid with the shop logo. open(k) 0 closed … 1 open. */
export function createBox(kit, lidTex) {
  const group = new THREE.Group();
  const card = kit.toy('#efd2a2');
  const cardDark = kit.toy('#d9b884');
  kit.mesh(group, kit.box(), card, [0, 0.035, 0], [0.74, 0.07, 0.74]);
  kit.mesh(group, kit.box(), cardDark, [0, 0.071, 0], [0.7, 0.004, 0.7]);
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.075, -0.37);
  group.add(hinge);
  const lidMats = [card, card, kit.std('#ffffff', { map: lidTex, emissive: '#ffffff', emissiveMap: lidTex, emissiveIntensity: 0.12 }), card, card, card];
  const lid = new THREE.Mesh(kit.box(), lidMats);
  lid.scale.set(0.75, 0.016, 0.75);
  lid.position.set(0, 0.006, 0.375);
  hinge.add(lid);
  let k = 0;
  const open = (v) => {
    k = v;
    hinge.rotation.x = -k * 1.9;
  };
  open(0);
  return { group, open, get k() {
    return k;
  } };
}

// ---------------------------------------------------------------- headwear
/** Puffy white chef hat (sits on a racer's headTop). */
export function chefHat(kit, { big = false, star = false } = {}) {
  const g = new THREE.Group();
  const white = kit.toy('#ffffff', { emissiveIntensity: 0.18 });
  const s = big ? 1.12 : 1;
  kit.mesh(g, kit.cyl(), white, [0, 0.04 * s, 0], [0.17 * s, 0.1 * s, 0.17 * s]);
  kit.mesh(g, kit.cyl(), kit.toy('#f1ece2'), [0, 0.0, 0], [0.172 * s, 0.02, 0.172 * s]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    kit.mesh(g, kit.sphere(), white, [Math.cos(a) * 0.1 * s, 0.17 * s, Math.sin(a) * 0.1 * s], [0.1 * s, 0.09 * s, 0.1 * s]);
  }
  kit.mesh(g, kit.sphere(), white, [0, 0.22 * s, 0], [0.13 * s, 0.1 * s, 0.13 * s]);
  if (star) kit.mesh(g, kit.sphereLo(), kit.toy('#ffcf33', { emissiveIntensity: 0.4 }), [0, 0.05 * s, -0.17 * s], [0.04, 0.04, 0.015]);
  return g;
}

/** Cashier's cap with a visor. */
export function visorCap(kit, color = '#16a34a') {
  const g = new THREE.Group();
  const m = kit.toy(color);
  kit.mesh(g, kit.geo('capDome', () => new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, Math.PI / 2)), m, [0, -0.02, 0], [0.2, 0.13, 0.2]);
  kit.mesh(g, kit.cyl(), m, [0, -0.02, -0.17], [0.15, 0.015, 0.11]);
  kit.mesh(g, kit.sphereLo(), kit.toy('#ffffff'), [0, 0.09, 0], [0.03, 0.03, 0.03]);
  return g;
}

/** Waiter's red bow tie. */
export function bowTie(kit) {
  const g = new THREE.Group();
  const m = kit.toy('#e11d48');
  kit.mesh(g, kit.sphereLo(), m, [-0.055, 0, 0], [0.055, 0.04, 0.02], [0, 0, 0.3]);
  kit.mesh(g, kit.sphereLo(), m, [0.055, 0, 0], [0.055, 0.04, 0.02], [0, 0, -0.3]);
  kit.mesh(g, kit.sphereLo(), kit.toy('#9f1239'), [0, 0, 0.004], [0.022, 0.022, 0.022]);
  return g;
}

// ---------------------------------------------------------------- kitchen
/** Arch-shaped geometry (oven mouth). */
function archGeo(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  return new THREE.ShapeGeometry(s, 12);
}

/**
 * Brick pizza oven facing +x (into the kitchen). Returns { group, mouth (Object3D where the pizza sits),
 * update(t, dt, heat 0..1, level), setLevel(n) }.
 */
export function createOven(kit, { brick, glowTex }) {
  const g = new THREE.Group();
  const brickMat = kit.std('#ffffff', { map: brick });
  const stone = kit.toy('#efe2cc');
  const dark = kit.std('#2a1712');
  // base with a wood store under it
  kit.mesh(g, kit.box(), brickMat, [0, 0.33, 0], [1.25, 0.66, 1.45]);
  kit.mesh(g, kit.box(), stone, [0.05, 0.68, 0], [1.33, 0.06, 1.53]);
  kit.mesh(g, kit.box(), dark, [0.63, 0.25, 0], [0.02, 0.3, 0.8]);
  const logMat = kit.toy('#a8693a');
  for (let i = 0; i < 3; i++) kit.mesh(g, kit.cylLo(), logMat, [0.55, 0.15 + (i % 2) * 0.1, -0.22 + i * 0.22], [0.06, 0.6, 0.06], [0, 0, Math.PI / 2]);
  // dome
  const domeGeo = kit.geo('ovenDome', () =>
    new THREE.LatheGeometry(
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 11) * (Math.PI / 2);
        return new THREE.Vector2(Math.max(0.001, Math.cos(a) * 0.62), Math.sin(a) * 0.72);
      }),
      24
    )
  );
  const dome = kit.mesh(g, domeGeo, brickMat, [0, 0.71, 0], [1, 1, 1.1]);
  void dome;
  // brick facade around the mouth
  kit.mesh(g, kit.box(), brickMat, [0.46, 0.71 + 0.31, 0], [0.2, 0.62, 0.9]);
  // mouth arch with stone rim, glowing inside
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0.565, 0.71, 0);
  mouthGroup.rotation.y = Math.PI / 2;
  g.add(mouthGroup);
  const rim = kit.mesh(mouthGroup, kit.geo('ovenRim', () => archGeo(0.66, 0.56)), stone, [0, -0.0, 0.0]);
  rim.position.z = 0.0;
  const inside = new THREE.MeshBasicMaterial({ color: '#ff7a2a' });
  kit.own(inside);
  const hole = kit.mesh(mouthGroup, kit.geo('ovenHole', () => archGeo(0.5, 0.44)), inside, [0, 0.0, 0.012]);
  const coal = kit.mesh(mouthGroup, kit.geo('ovenCoal', () => archGeo(0.5, 0.12)), kit.basic('#ffd27a'), [0, 0.0, 0.016]);
  void coal;
  // flames
  const flameMats = ['#ff4a1c', '#ff9a20', '#fff1a0'].map((c) => kit.basic(c, { transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  const flameGeo = kit.geo('flame', () => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector2(Math.max(0.0001, Math.sin(Math.PI * Math.pow(t, 0.55)) * Math.pow(1 - t, 0.35) * 0.08), t * 0.26));
    }
    return new THREE.LatheGeometry(pts, 8);
  });
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = kit.mesh(mouthGroup, flameGeo, flameMats[i % 3], [-0.16 + i * 0.08, 0.02, 0.03 + (i % 2) * 0.01], [1, 1, 0.4]);
    f.renderOrder = 6;
    flames.push(f);
  }
  const glow = new THREE.Sprite(kit.own(new THREE.SpriteMaterial({ map: glowTex, color: '#ff8a2a', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })));
  glow.position.set(0.0, 0.18, 0.15);
  glow.scale.set(1.1, 0.9, 1);
  mouthGroup.add(glow);
  // chimney
  kit.mesh(g, kit.cyl(), brickMat, [-0.2, 1.65, 0], [0.13, 0.75, 0.13]);
  kit.mesh(g, kit.cyl(), stone, [-0.2, 2.05, 0], [0.17, 0.08, 0.17]);
  // level trim around the dome
  const trimMat = kit.toy('#c87533', { metalness: 0.4, roughness: 0.35 });
  const trim = kit.mesh(g, kit.geo('ovenTrim', () => new THREE.TorusGeometry(0.62, 0.035, 8, 28)), trimMat, [0, 0.73, 0], [1, 1.1, 1], [Math.PI / 2, 0, 0]);
  void trim;
  const stars = [];
  const starMat = kit.toy('#ffcf33', { emissiveIntensity: 0.5, metalness: 0.3 });
  for (let i = 0; i < 3; i++) {
    const st = kit.mesh(g, kit.sphereLo(), starMat, [0.67, 0.5, -0.22 + i * 0.22], [0.012, 0.055, 0.055]);
    st.visible = false;
    stars.push(st);
  }
  // where the pizza goes (on the oven floor, half in the mouth)
  const mouth = new THREE.Object3D();
  mouth.position.set(0.5, 0.72, 0);
  g.add(mouth);
  const chimneyTop = new THREE.Object3D();
  chimneyTop.position.set(-0.2, 2.15, 0);
  g.add(chimneyTop);
  const TRIM = ['#c87533', '#c87533', '#d6dde6', '#ffcf33'];
  function setLevel(n) {
    trimMat.color.set(TRIM[Math.min(3, n)]);
    trimMat.emissive.set(TRIM[Math.min(3, n)]);
    stars.forEach((s, i) => (s.visible = i < n));
  }
  function update(t, dt, heat) {
    const fl = 0.85 + Math.sin(t * 17) * 0.08 + Math.sin(t * 29) * 0.05;
    const k = 0.55 + heat * 0.45;
    inside.color.setRGB(1, 0.42 * fl + 0.1 * heat, 0.12);
    glow.material.opacity = (0.35 + 0.35 * heat) * fl;
    glow.scale.set(1 + heat * 0.4, 0.8 + heat * 0.3, 1);
    flames.forEach((f, i) => {
      const s = k * (1 + Math.sin(t * (15 + i * 3) + i) * 0.22);
      f.scale.set(0.9 + 0.2 * Math.sin(t * 11 + i), s * (1.2 + 0.3 * Math.sin(t * 23 + i * 2)), 0.4);
    });
    void hole;
    void dt;
  }
  return { group: g, mouth, chimneyTop, update, setLevel };
}

/** Cash register: red body, screen, keys and a drawer that slides out on "ka-ching". */
export function createRegister(kit) {
  const g = new THREE.Group();
  const red = kit.toy('#e2412f');
  const cream = kit.toy('#fff3d6');
  kit.mesh(g, kit.rbox(0.46, 0.16, 0.38, 0.04), red, [0, 0.08, 0]);
  kit.mesh(g, kit.rbox(0.4, 0.1, 0.18, 0.03), cream, [0, 0.2, 0.06], [1, 1, 1], [-0.5, 0, 0]);
  const keyMat = kit.toy('#ffffff');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) kit.mesh(g, kit.box(), keyMat, [-0.1 + i * 0.1, 0.27 - j * 0.035, 0.06 + j * 0.05], [0.06, 0.02, 0.035], [-0.5, 0, 0]);
  // screen faces the customer (-z)
  const screen = kit.mesh(g, kit.rbox(0.3, 0.14, 0.05, 0.02), kit.toy('#2b3a4a'), [0, 0.32, -0.08], [1, 1, 1], [0.35, 0, 0]);
  kit.mesh(screen, kit.box(), kit.basic('#7dffb0'), [0, 0, -0.027], [0.24, 0.08, 0.002]);
  const drawer = new THREE.Group();
  g.add(drawer);
  kit.mesh(drawer, kit.box(), cream, [0, 0.04, 0.12], [0.4, 0.07, 0.3]);
  kit.mesh(drawer, kit.box(), kit.toy('#ffcf33', { metalness: 0.4 }), [0, 0.08, 0.12], [0.3, 0.012, 0.2]);
  kit.mesh(drawer, kit.box(), red, [0, 0.04, 0.275], [0.42, 0.08, 0.02]);
  let open = 0;
  return {
    group: g,
    ding() {
      open = 1;
    },
    update(dt) {
      open = Math.max(0, open - dt * 1.4);
      drawer.position.z = Math.sin(Math.min(1, open * 1.6) * Math.PI * 0.5) * 0.2 * (open > 0 ? 1 : 0);
      g.scale.setScalar(1 + Math.max(0, open - 0.75) * 0.3);
    },
  };
}

/** Round café table with a checkered cloth, two chairs and a little flower vase. */
export function createDiningTable(kit, clothTex) {
  const g = new THREE.Group();
  const wood = kit.toy('#b8743c');
  const woodLight = kit.toy('#d99a5a');
  kit.mesh(g, kit.cyl(), wood, [0, 0.22, 0], [0.05, 0.44, 0.05]);
  kit.mesh(g, kit.cyl(), wood, [0, 0.02, 0], [0.22, 0.04, 0.22]);
  kit.mesh(g, kit.cyl(), woodLight, [0, 0.45, 0], [0.46, 0.04, 0.46]);
  const cloth = kit.std('#ffffff', { map: clothTex });
  kit.mesh(g, kit.geo('cloth', () => new THREE.CylinderGeometry(0.4, 0.47, 0.1, 24, 1, true)), cloth, [0, 0.42, 0]);
  kit.mesh(g, kit.geo('clothTop', () => new THREE.CircleGeometry(0.4, 24)), cloth, [0, 0.476, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  // vase + flower
  kit.mesh(g, kit.cyl(), kit.toy('#7cc6f0', { roughness: 0.2 }), [0, 0.53, -0.18], [0.04, 0.1, 0.04]);
  kit.mesh(g, kit.sphereLo(), kit.toy('#ff7ab0'), [0, 0.62, -0.18], [0.045, 0.04, 0.045]);
  kit.mesh(g, kit.sphereLo(), kit.toy('#ffd84a'), [0, 0.625, -0.16], [0.018, 0.018, 0.018]);
  const plate = kit.mesh(g, kit.cyl(), kit.toy('#ffffff'), [0, 0.49, 0.05], [0.2, 0.012, 0.2]);
  const chairs = [-1, 1].map((sd) => {
    const c = new THREE.Group();
    c.position.set(sd * 0.72, 0, 0.05);
    g.add(c);
    kit.mesh(c, kit.rbox(0.36, 0.06, 0.36, 0.025), kit.toy('#e2412f'), [0, 0.27, 0]);
    for (const [x, z] of [
      [-0.14, -0.14],
      [0.14, -0.14],
      [-0.14, 0.14],
      [0.14, 0.14],
    ])
      kit.mesh(c, kit.cylLo(), wood, [x, 0.12, z], [0.025, 0.25, 0.025]);
    kit.mesh(c, kit.rbox(0.06, 0.36, 0.36, 0.025), wood, [sd * 0.17, 0.48, 0]);
    return c;
  });
  return { group: g, plate, chairs, top: 0.5 };
}

/** Potted plant (variant 0 = round bush, 1 = tall leaves, 2 = small flowers). */
export function createPlant(kit, variant = 0, scale = 1) {
  const g = new THREE.Group();
  const pot = kit.geo('pot', () =>
    new THREE.LatheGeometry(
      [
        [0.0, 0],
        [0.14, 0],
        [0.17, 0.2],
        [0.19, 0.22],
        [0.19, 0.26],
        [0.0, 0.26],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      14
    )
  );
  kit.mesh(g, pot, kit.toy('#d0703c'));
  kit.mesh(g, kit.cyl(), kit.toy('#6b4423'), [0, 0.25, 0], [0.17, 0.02, 0.17]);
  const leaf = kit.toy('#4cb050');
  const leaf2 = kit.toy('#6fcf5e');
  if (variant === 0) {
    kit.mesh(g, kit.sphere(), leaf, [0, 0.5, 0], [0.26, 0.24, 0.26]);
    kit.mesh(g, kit.sphere(), leaf2, [0.1, 0.62, 0.06], [0.16, 0.15, 0.16]);
    kit.mesh(g, kit.sphere(), leaf2, [-0.12, 0.55, -0.05], [0.14, 0.13, 0.14]);
  } else if (variant === 1) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      kit.mesh(g, kit.sphere(), i % 2 ? leaf : leaf2, [Math.cos(a) * 0.1, 0.55, Math.sin(a) * 0.1], [0.06, 0.32, 0.12], [Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5]);
    }
  } else {
    kit.mesh(g, kit.sphere(), leaf, [0, 0.36, 0], [0.18, 0.12, 0.18]);
    const fl = ['#ff7ab0', '#ffd84a', '#ffffff', '#b38cff'];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      kit.mesh(g, kit.sphereLo(), kit.toy(fl[i % 4]), [Math.cos(a) * 0.11, 0.44, Math.sin(a) * 0.11], [0.045, 0.04, 0.045]);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

/** Hanging pendant lamp (cone shade + glowing bulb). Returns { group, bulb }. */
export function createPendant(kit, color = '#e2412f') {
  const g = new THREE.Group();
  kit.mesh(g, kit.cylLo(), kit.toy('#3a2a20'), [0, 0.45, 0], [0.008, 0.9, 0.008]);
  kit.mesh(g, kit.geo('shade', () => new THREE.ConeGeometry(0.2, 0.18, 16, 1, true)), kit.toy(color, { side: THREE.DoubleSide }), [0, 0, 0]);
  const bulbMat = kit.own(new THREE.MeshBasicMaterial({ color: '#fff3c0' }));
  const bulb = kit.mesh(g, kit.sphereLo(), bulbMat, [0, -0.08, 0], [0.07, 0.07, 0.07]);
  return { group: g, bulb, bulbMat };
}

/** Chunky toy coin. */
export const coinGeometry = (kit) => kit.geo('coin', () => new THREE.CylinderGeometry(0.075, 0.075, 0.022, 16));
