// Three.js world for "Tiệm Pizza Pokémon": a cosy cut-away pizzeria (wood floor, tiled kitchen, brick
// ovens, counter with cash registers, café tables, a street seen through the windows) drawn from the
// pizza3d engine state. All Pokémon are real procedural 3D models (obby3d racers) wearing work clothes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRacerModel, TYPE_COLORS } from '../obby3d/racers';
import { badgeTexture } from '../obby3d/obby3dDecor';
import { LAYOUT, recipeById, INGREDIENTS, menuOf, ovenCount, registerCount, tableCount, hasExpand, bakeZone, toppingsOf } from '../../../utils/three3d/pizza3d';
import { artworkUrl } from '../../../services/pokemonOnlineService';
import * as TX from './pizza3dTextures';
import { makeKit, disposeKit, createPizza, createBox, chefHat, visorCap, bowTie, createOven, createRegister, createDiningTable, createPlant, createPendant, coinGeometry } from './pizza3dModels';

const TAU = Math.PI * 2;
const WALL_H = 2.6;
const LOW_WALL = 0.42;
const COUNTER_TOP = LAYOUT.counter.h + 0.05;
const PREP_TOP = 0.6;
const EAT_TIME = 7;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const angLerp = (a, b, t) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
};
const elastic = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -9 * t) * Math.cos(t * 9.5));

/**
 * Merges the static meshes of a group into one mesh per material (fewer draw calls on phones).
 * Meshes under a `skip` object stay as they are.
 */
function mergeStatic(group, kit, skip = []) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map();
  const victims = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent) return;
    for (let p = o; p && p !== group; p = p.parent) if (skip.includes(p)) return;
    const g = o.geometry;
    if (!g.attributes.uv || !g.attributes.normal || g.attributes.color || g.morphAttributes?.position) return;
    const geo = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(geo);
    victims.push(o);
  });
  for (const o of victims) o.removeFromParent();
  for (const [mat, list] of byMat) {
    const merged = list.length > 1 ? mergeGeometries(list, false) : list[0];
    if (list.length > 1) list.forEach((g) => g.dispose());
    if (!merged) continue;
    kit.own(merged);
    group.add(new THREE.Mesh(merged, mat));
  }
}

// ---------------------------------------------------------------- particles
function particlePool(kit, n, size, map, blending) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 4);
  const vel = new Float32Array(n * 3);
  const life = new Float32Array(n);
  const max = new Float32Array(n);
  const grav = new Float32Array(n);
  const base = new Float32Array(n * 3);
  const geo = kit.own(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const mat = kit.own(new THREE.PointsMaterial({ size, map, vertexColors: true, transparent: true, depthWrite: false, blending, sizeAttenuation: true }));
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 8;
  let head = 0;
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) pos[i * 3 + 1] = -100;
  return {
    points,
    emit(x, y, z, count, { colors = ['#ffffff'], speed = 1, up = 1, spread = 0.1, life: l = 0.8, gravity = 0 } = {}) {
      for (let k = 0; k < count; k++) {
        const i = head;
        head = (head + 1) % n;
        const a = Math.random() * TAU;
        const r = Math.random() * spread;
        pos.set([x + Math.cos(a) * r, y + Math.random() * spread * 0.5, z + Math.sin(a) * r], i * 3);
        const sp = speed * (0.4 + Math.random() * 0.8);
        vel.set([Math.cos(a) * sp, up * (0.6 + Math.random() * 0.8), Math.sin(a) * sp], i * 3);
        life[i] = max[i] = l * (0.7 + Math.random() * 0.6);
        grav[i] = gravity;
        c.set(colors[k % colors.length]);
        base.set([c.r, c.g, c.b], i * 3);
      }
    },
    update(dt) {
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) {
          pos[i * 3 + 1] = -100;
          col[i * 4 + 3] = 0;
          continue;
        }
        vel[i * 3 + 1] -= grav[i] * dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const k = life[i] / max[i];
        col.set([base[i * 3], base[i * 3 + 1], base[i * 3 + 2], Math.min(1, k * 1.6)], i * 4);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

/** Sky colours by time of day (0 morning … 1 evening). */
const SKY = [
  [0, '#69b8f5', '#dff3ff', '#ffffff', 1.25, 1.7],
  [0.55, '#5aa7ee', '#fff0cf', '#fff3dc', 1.15, 1.5],
  [0.8, '#f08a5d', '#ffd29a', '#ffc489', 0.95, 1.0],
  [1, '#2f2f78', '#e9786a', '#ff8a55', 0.55, 0.35],
];
function skyAt(k) {
  let i = 0;
  while (i < SKY.length - 2 && k > SKY[i + 1][0]) i++;
  const a = SKY[i];
  const b = SKY[i + 1];
  const t = clamp((k - a[0]) / (b[0] - a[0]), 0, 1);
  const c1 = new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), t);
  const c2 = new THREE.Color(a[2]).lerp(new THREE.Color(b[2]), t);
  const sun = new THREE.Color(a[3]).lerp(new THREE.Color(b[3]), t);
  return { top: c1, bottom: c2, sun, hemi: lerp(a[4], b[4], t), sunI: lerp(a[5], b[5], t) };
}

/**
 * createPizza3DScene(container, { shop, player }) →
 *   { update(state, dt, { light }), fx(event, state), setShop(shop, { animate }), project(x, y, z), resize(), dispose() }.
 * player = { species ('pikachu'… or 'generic'), type, image, name }. Throws when WebGL is unavailable.
 */
export function createPizza3DScene(container, { shop, player = {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const kit = makeKit();
  const textures = [];
  const T = (t) => (textures.push(t), t);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.3, 120);

  // ---------------------------------------------------------------- textures
  const tex = {
    wood: T(TX.woodTexture([2, 2])),
    tile: T(TX.tileTexture([4, 2])),
    small: T(TX.smallTileTexture([6, 1])),
    brick: T(TX.brickTexture([2, 1])),
    brickWall: T(TX.brickTexture([3, 1.6])),
    ovenBrick: T(TX.brickTexture([2, 1])),
    wallpaper: T(TX.wallpaperTexture([4, 1])),
    cloth: T(TX.clothTexture()),
    box: T(TX.boxTexture()),
    shadow: T(TX.shadowTexture()),
    glow: T(TX.glowTexture()),
    heart: T(TX.heartTexture()),
    sign: T(TX.signTexture()),
    counterWood: T(TX.woodTexture([4, 0.5])),
  };
  tex.wood.wrapS = tex.wood.wrapT = THREE.RepeatWrapping;

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight('#fff6e8', '#b88a5a', 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 1.6);
  sun.position.set(6, 12, 8);
  scene.add(sun);
  const ovenLight = new THREE.PointLight('#ff8a3a', 0.9, 5, 1.6);
  ovenLight.position.set(-2.6, 1.0, 1.2);
  scene.add(ovenLight);
  const warm = new THREE.PointLight('#ffd6a0', 0, 9, 1.4);
  warm.position.set(0.5, 2.3, -2.8);
  scene.add(warm);
  const warm2 = new THREE.PointLight('#ffc98a', 0, 8, 1.4);
  warm2.position.set(0.5, 2.2, 1.4);
  scene.add(warm2);

  // ---------------------------------------------------------------- outside: grass, street, houses, sky
  const ground = kit.mesh(scene, kit.geo('ground', () => new THREE.PlaneGeometry(60, 60)), kit.std('#8fcf6a'), [0, -0.12, -4], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  void ground;
  kit.mesh(scene, kit.box(), kit.std('#ddd5c6'), [5.6, -0.08, -2], [3.2, 0.06, 16]);
  const street = new THREE.Group();
  scene.add(street);
  const skyGeo = kit.own(new THREE.PlaneGeometry(90, 34, 1, 8));
  skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
  const sky = new THREE.Mesh(skyGeo, kit.own(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false })));
  sky.position.set(0, 9, -26);
  sky.renderOrder = -5;
  street.add(sky);
  const lampHeads = [];
  const houseMats = [];
  {
    kit.mesh(street, kit.box(), kit.std('#ded6c8'), [0, -0.08, -1.2], [40, 0.07, 2.4]);
    kit.mesh(street, kit.box(), kit.std('#6f7686'), [0, -0.1, -4.4], [40, 0.05, 4]);
    for (let x = -18; x < 18; x += 2.4) kit.mesh(street, kit.box(), kit.std('#f8f1d8'), [x, -0.07, -4.4], [1.1, 0.02, 0.12]);
    kit.mesh(street, kit.box(), kit.std('#ded6c8'), [0, -0.08, -7.2], [40, 0.07, 1.6]);
    const pastel = ['#ffb4a2', '#a8d8ff', '#ffe08a', '#c3f0b4', '#e3c7ff', '#ffc9e3'];
    for (let i = 0; i < 7; i++) {
      const x = -13 + i * 4.4;
      const h = 2.6 + ((i * 7) % 3) * 0.6;
      const lit = T(TX.facadeTexture(pastel[i % pastel.length], i + 1, true));
      const day = T(TX.facadeTexture(pastel[i % pastel.length], i + 1, false));
      const m = new THREE.MeshStandardMaterial({ map: day, emissiveMap: lit, emissive: '#ffcf80', emissiveIntensity: 0, roughness: 0.8 });
      kit.own(m);
      houseMats.push(m);
      const side = kit.std(pastel[i % pastel.length]);
      const house = new THREE.Mesh(kit.box(), [side, side, side, side, m, side]);
      house.position.set(x, h / 2, -9.6);
      house.scale.set(3.6, h, 2.4);
      street.add(house);
      const roof = kit.mesh(street, kit.geo('roof', () => new THREE.ConeGeometry(1, 1, 4, 1)), kit.toy(['#d0563c', '#5b6fb5', '#8a5a3c'][i % 3]), [x, h + 0.55, -9.6], [2.75, 1.1, 1.85], [0, Math.PI / 4, 0]);
      void roof;
      // tree in front
      if (i % 2 === 0) {
        kit.mesh(street, kit.cylLo(), kit.toy('#8a5a32'), [x + 2.2, 0.55, -7.2], [0.09, 1.1, 0.09]);
        kit.mesh(street, kit.sphere(), kit.toy('#4cb050'), [x + 2.2, 1.45, -7.2], [0.65, 0.6, 0.65]);
        kit.mesh(street, kit.sphere(), kit.toy('#6fcf5e'), [x + 2.4, 1.75, -7.0], [0.4, 0.38, 0.4]);
      }
    }
    for (const x of [-6.5, -1.5, 3.5, 8.5]) {
      kit.mesh(street, kit.cylLo(), kit.toy('#3a4252'), [x, 1.0, -0.6], [0.05, 2.0, 0.05]);
      const headMat = kit.own(new THREE.MeshBasicMaterial({ color: '#d8dde6' }));
      kit.mesh(street, kit.sphereLo(), headMat, [x, 2.05, -0.6], [0.16, 0.13, 0.16]);
      const glow = new THREE.Sprite(kit.own(new THREE.SpriteMaterial({ map: tex.glow, color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })));
      glow.position.set(x, 2.05, -0.6);
      glow.scale.set(1.4, 1.4, 1);
      street.add(glow);
      lampHeads.push({ headMat, glow });
    }
  }

  // ---------------------------------------------------------------- room (rebuilt when the shop grows)
  const mats = {
    wood: kit.std('#ffffff', { map: tex.wood, roughness: 0.7 }),
    tile: kit.std('#ffffff', { map: tex.tile, roughness: 0.45 }),
    wall: kit.std('#ffffff', { map: tex.wallpaper, roughness: 0.9 }),
    brickWall: kit.std('#ffffff', { map: tex.brickWall, roughness: 0.85 }),
    slab: kit.toy('#8a5530'),
    trim: kit.toy('#fff8ec'),
    wainscot: kit.toy('#b8743c'),
    glass: kit.own(new THREE.MeshStandardMaterial({ color: '#cfeeff', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false })),
    frame: kit.toy('#ffffff'),
  };
  let room = null;
  function buildRoom(z0) {
    if (room) scene.remove(room);
    room = new THREE.Group();
    scene.add(room);
    const { x0, x1, z1 } = LAYOUT.room;
    const W = x1 - x0;
    const kz = LAYOUT.counter.z;
    // floor slab: wood for customers, tiles for the kitchen
    kit.mesh(room, kit.box(), mats.slab, [(x0 + x1) / 2, -0.07, (z0 + z1) / 2], [W + 0.3, 0.14, z1 - z0 + 0.3]);
    const wood = kit.mesh(room, kit.geo(`floorW${z0}`, () => new THREE.PlaneGeometry(W, kz - z0)), mats.wood, [(x0 + x1) / 2, 0.002, (z0 + kz) / 2], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    void wood;
    tex.wood.repeat.set(W / 2.2, (kz - z0) / 2.2);
    kit.mesh(room, kit.geo('floorK', () => new THREE.PlaneGeometry(W, z1 - kz)), mats.tile, [(x0 + x1) / 2, 0.003, (kz + z1) / 2], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    // back wall with three windows
    const wins = [-2.45, 2.45];
    const winW = 1.7;
    const y0 = 0.85;
    const y1 = 2.15;
    const t = 0.18;
    const zb = z0 - t / 2;
    kit.mesh(room, kit.box(), mats.wall, [(x0 + x1) / 2, y0 / 2, zb], [W + t * 2, y0, t]);
    kit.mesh(room, kit.box(), mats.wall, [(x0 + x1) / 2, (y1 + WALL_H) / 2, zb], [W + t * 2, WALL_H - y1, t]);
    const edges = [x0 - t, ...wins.flatMap((x) => [x - winW / 2, x + winW / 2]), x1 + t];
    for (let i = 0; i < edges.length; i += 2) kit.mesh(room, kit.box(), mats.wall, [(edges[i] + edges[i + 1]) / 2, (y0 + y1) / 2, zb], [edges[i + 1] - edges[i], y1 - y0, t]);
    for (const x of wins) {
      kit.mesh(room, kit.box(), mats.glass, [x, (y0 + y1) / 2, zb], [winW, y1 - y0, 0.02]);
      for (const [px, py, sx, sy] of [
        [x, y0, winW + 0.1, 0.08],
        [x, y1, winW + 0.1, 0.08],
        [x - winW / 2, (y0 + y1) / 2, 0.08, y1 - y0],
        [x + winW / 2, (y0 + y1) / 2, 0.08, y1 - y0],
        [x, (y0 + y1) / 2, 0.05, y1 - y0],
        [x, (y0 + y1) / 2, winW, 0.05],
      ])
        kit.mesh(room, kit.box(), mats.frame, [px, py, z0 + 0.01], [sx, sy, 0.06]);
      kit.mesh(room, kit.box(), mats.trim, [x, y0 - 0.04, z0 + 0.07], [winW + 0.2, 0.05, 0.16]);
      // little awning stripes above each window (outside, visible through the glass)
    }
    kit.mesh(room, kit.box(), mats.wainscot, [(x0 + x1) / 2, 0.36, z0 + 0.02], [W, 0.72, 0.04]);
    kit.mesh(room, kit.box(), mats.trim, [(x0 + x1) / 2, 0.73, z0 + 0.04], [W, 0.04, 0.06]);
    // left wall: bricks in the kitchen, wallpaper in the shop
    const lx = x0 - t / 2;
    kit.mesh(room, kit.box(), mats.wall, [lx, WALL_H / 2, (z0 + kz) / 2], [t, WALL_H, kz - z0]);
    kit.mesh(room, kit.box(), mats.brickWall, [lx, WALL_H / 2, (kz + z1) / 2], [t, WALL_H, z1 - kz]);
    kit.mesh(room, kit.box(), mats.wainscot, [x0 + 0.02, 0.36, (z0 + kz) / 2], [0.04, 0.72, kz - z0]);
    kit.mesh(room, kit.box(), mats.trim, [x0 + 0.04, 0.73, (z0 + kz) / 2], [0.06, 0.04, kz - z0]);
    kit.mesh(room, kit.box(), mats.trim, [lx, WALL_H + 0.03, (z0 + z1) / 2], [t + 0.06, 0.06, z1 - z0 + t]);
    kit.mesh(room, kit.box(), mats.trim, [(x0 + x1) / 2, WALL_H + 0.03, zb], [W + t * 2 + 0.06, 0.06, t + 0.06]);
    // right wall: a low cut-away wall with the door gap
    const rx = x1 + t / 2;
    const d0 = LAYOUT.door.z - 0.75;
    const d1 = LAYOUT.door.z + 0.75;
    kit.mesh(room, kit.box(), mats.wainscot, [rx, LOW_WALL / 2, (z0 + d0) / 2], [t, LOW_WALL, d0 - z0]);
    kit.mesh(room, kit.box(), mats.wainscot, [rx, LOW_WALL / 2, (d1 + z1) / 2], [t, LOW_WALL, z1 - d1]);
    kit.mesh(room, kit.box(), mats.trim, [rx, LOW_WALL + 0.02, (z0 + d0) / 2], [t + 0.05, 0.04, d0 - z0]);
    kit.mesh(room, kit.box(), mats.trim, [rx, LOW_WALL + 0.02, (d1 + z1) / 2], [t + 0.05, 0.04, z1 - d1]);
    for (const z of [d0, d1]) kit.mesh(room, kit.box(), kit.toy('#c0392b'), [rx, 1.1, z], [0.16, 2.2, 0.16]);
    kit.mesh(room, kit.box(), kit.toy('#c0392b'), [rx, 2.2, LAYOUT.door.z], [0.18, 0.16, 1.66]);
    kit.mesh(room, kit.box(), kit.toy('#3f8f5a'), [rx + 0.5, 0.01, LAYOUT.door.z], [0.8, 0.02, 1.1]);
    // after expanding: pillars and a beam where the old back wall was
    if (z0 < LAYOUT.room.z0) {
      for (const x of [x0 + 0.15, -0.6, x1 - 0.15]) kit.mesh(room, kit.box(), mats.trim, [x, WALL_H / 2, LAYOUT.room.z0], [0.22, WALL_H, 0.22]);
      kit.mesh(room, kit.box(), mats.wainscot, [(x0 + x1) / 2, WALL_H - 0.12, LAYOUT.room.z0], [W, 0.22, 0.24]);
      kit.mesh(room, kit.box(), kit.std('#ffffff', { map: tex.wood }), [(x0 + x1) / 2, 0.004, (z0 + LAYOUT.room.z0) / 2], [W, 0.004, LAYOUT.room.z0 - z0]);
    }
    street.position.z = z0 - t;
    mergeStatic(room, kit);
  }

  // ---------------------------------------------------------------- counter, prep tables, boxes
  const fixed = new THREE.Group();
  scene.add(fixed);
  const C = LAYOUT.counter;
  {
    const len = C.x1 - C.x0;
    const front = kit.std('#ffffff', { map: tex.counterWood, roughness: 0.7 });
    kit.mesh(fixed, kit.box(), front, [(C.x0 + C.x1) / 2, C.h / 2, C.z], [len, C.h, C.depth]);
    kit.mesh(fixed, kit.box(), kit.toy('#e2412f'), [(C.x0 + C.x1) / 2, C.h * 0.62, C.z - C.depth / 2 - 0.005], [len, 0.08, 0.02]);
    kit.mesh(fixed, kit.box(), kit.toy('#ffd84a'), [(C.x0 + C.x1) / 2, C.h * 0.52, C.z - C.depth / 2 - 0.006], [len, 0.025, 0.02]);
    kit.mesh(fixed, kit.box(), kit.std('#ffffff', { map: tex.small, roughness: 0.3 }), [(C.x0 + C.x1) / 2, C.h + 0.025, C.z], [len + 0.08, 0.05, C.depth + 0.1]);
    // pickup bell + boxes stack at the left end
    kit.mesh(fixed, kit.geo('bell', () => new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2)), kit.toy('#ffcf33', { metalness: 0.5, roughness: 0.3 }), [LAYOUT.pickupX + 0.38, COUNTER_TOP, C.z - 0.18], [0.08, 0.07, 0.08]);
    kit.mesh(fixed, kit.cyl(), kit.toy('#3a2a20'), [LAYOUT.pickupX + 0.38, COUNTER_TOP + 0.005, C.z - 0.18], [0.1, 0.01, 0.1]);
    for (let i = 0; i < 4; i++) {
      const b = createBox(kit, tex.box);
      b.group.position.set(C.x0 + 0.38, COUNTER_TOP + i * 0.085, C.z + 0.02);
      b.group.rotation.y = (i % 2) * 0.12;
      b.group.scale.setScalar(0.9);
      fixed.add(b.group);
    }
    // a beam above the counter to hang the lamps on
    kit.mesh(fixed, kit.box(), mats.wainscot, [(LAYOUT.room.x0 + LAYOUT.room.x1) / 2, WALL_H + 0.1, C.z], [LAYOUT.room.x1 - LAYOUT.room.x0 + 0.2, 0.14, 0.18]);
    kit.mesh(fixed, kit.box(), mats.wainscot, [LAYOUT.room.x1 + 0.09, (WALL_H + 0.1) / 2, C.z], [0.16, WALL_H + 0.1, 0.16]);
  }
  const prepTables = LAYOUT.prep.map((p, idx) => {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    fixed.add(g);
    const steel = kit.toy('#c9d3dd', { metalness: 0.35, roughness: 0.35 });
    kit.mesh(g, kit.rbox(1.7, 0.08, 0.82, 0.03), kit.toy('#e9c08a'), [0, PREP_TOP - 0.04, 0]);
    kit.mesh(g, kit.box(), steel, [0, 0.12, 0], [1.55, 0.03, 0.7]);
    for (const [x, z] of [
      [-0.75, -0.34],
      [0.75, -0.34],
      [-0.75, 0.34],
      [0.75, 0.34],
    ])
      kit.mesh(g, kit.cylLo(), steel, [x, (PREP_TOP - 0.08) / 2, z], [0.035, PREP_TOP - 0.08, 0.035]);
    // tubs: sauce + cheese on the left, dough balls tray
    const tub = (x, z, color, r = 0.11) => {
      kit.mesh(g, kit.cyl(), kit.toy('#ffffff'), [x, PREP_TOP + 0.05, z], [r, 0.1, r]);
      kit.mesh(g, kit.cyl(), kit.toy(color), [x, PREP_TOP + 0.1, z], [r * 0.85, 0.01, r * 0.85]);
    };
    tub(-0.66, -0.18, INGREDIENTS.sauce.color);
    tub(-0.66, 0.12, INGREDIENTS.cheese.color);
    kit.mesh(g, kit.cyl(), kit.toy('#b8743c'), [-0.42, PREP_TOP + 0.01, 0.25], [0.15, 0.02, 0.15]);
    for (let i = 0; i < 3; i++) kit.mesh(g, kit.sphereLo(), kit.toy('#f6dca4'), [-0.46 + (i % 2) * 0.08, PREP_TOP + 0.06, 0.2 + i * 0.05], [0.055, 0.045, 0.055]);
    kit.mesh(g, kit.cylLo(), kit.toy('#d99a5a'), [0.38, PREP_TOP + 0.03, 0.28], [0.03, 0.42, 0.03], [0, 0, Math.PI / 2]);
    const tubsRight = new THREE.Group();
    g.add(tubsRight);
    const pizzaSpot = new THREE.Object3D();
    pizzaSpot.position.set(0, PREP_TOP, 0);
    g.add(pizzaSpot);
    return { g, idx, tubsRight, pizzaSpot, tub };
  });
  mergeStatic(fixed, kit, prepTables.flatMap((p) => [p.tubsRight, p.pizzaSpot]));
  mergeStatic(street, kit, [sky]);
  function syncTubs(shopNow) {
    const tops = toppingsOf(shopNow);
    for (const pt of prepTables) {
      pt.tubsRight.clear();
      tops.forEach((id, i) => {
        const x = 0.62 - (i % 2) * 0.2;
        const z = -0.24 + Math.floor(i / 2) * 0.22;
        kit.mesh(pt.tubsRight, kit.cyl(), kit.toy('#ffffff'), [x, PREP_TOP + 0.045, z], [0.085, 0.09, 0.085]);
        kit.mesh(pt.tubsRight, kit.cyl(), kit.toy(INGREDIENTS[id].color), [x, PREP_TOP + 0.092, z], [0.072, 0.01, 0.072]);
      });
    }
  }

  // ---------------------------------------------------------------- upgradeable props
  const props = new THREE.Group();
  scene.add(props);
  const grows = []; // props scaling in after a purchase
  const ovens = [];
  const registers = [];
  const tables = [];
  const decor = { lights: null, plants: null, posters: null, sign: null };
  let pendants = [];
  let bulbs = null;
  let signBulbs = null;
  let menuBoard = null;
  let menuTex = null;
  let menuKey = '';
  let expanded = null;
  let backZ = LAYOUT.room.z0;

  const addGrow = (obj, animate, at) => {
    if (!animate) return;
    obj.scale.setScalar(0.001);
    grows.push({ obj, t: 0, s: obj.userData.baseScale || 1 });
    const p = at || obj.getWorldPosition(new THREE.Vector3());
    poof(p.x, p.y + 0.4, p.z);
  };

  function makeOven(i) {
    const o = createOven(kit, { brick: tex.ovenBrick, glowTex: tex.glow });
    const p = LAYOUT.ovens[i];
    o.group.position.set(p.x, 0, p.z);
    props.add(o.group);
    // timer ring above the oven
    const ringBg = new THREE.Mesh(kit.geo('ringBg', () => new THREE.RingGeometry(0.17, 0.25, 40)), kit.basic('#ffffff', { transparent: true, opacity: 0.85, depthTest: false }));
    const ringFg = new THREE.Mesh(kit.geo(`ringFg${i}`, () => new THREE.RingGeometry(0.18, 0.24, 40, 1, Math.PI / 2, -TAU)), kit.own(new THREE.MeshBasicMaterial({ color: '#22c55e', depthTest: false, transparent: true })));
    const ring = new THREE.Group();
    ring.add(ringBg, ringFg);
    ringBg.renderOrder = 30;
    ringFg.renderOrder = 31;
    ring.position.set(p.x + 0.55, 1.95, p.z);
    ring.visible = false;
    props.add(ring);
    return { ...o, ring, ringFg, heat: 0, smokeT: 0 };
  }
  function makeRegister(i) {
    const r = createRegister(kit);
    r.group.position.set(LAYOUT.registers[i].x, COUNTER_TOP, C.z + 0.05);
    props.add(r.group);
    return r;
  }
  function makeTable(i) {
    const t = createDiningTable(kit, tex.cloth);
    const p = LAYOUT.tables[i];
    t.group.position.set(p.x, 0, p.z);
    props.add(t.group);
    const pizza = createPizza(kit);
    pizza.set(['dough', 'sauce', 'cheese']);
    pizza.bake('baked');
    pizza.group.scale.setScalar(0.62);
    pizza.group.position.set(0, 0.5, 0.05);
    pizza.group.visible = false;
    t.group.add(pizza.group);
    const dirt = new THREE.Group();
    kit.mesh(dirt, kit.sphereLo(), kit.toy('#e3a253'), [0.05, 0.5, 0.08], [0.05, 0.015, 0.04]);
    kit.mesh(dirt, kit.sphereLo(), kit.toy('#d8382a'), [-0.08, 0.5, 0.0], [0.04, 0.01, 0.03]);
    kit.mesh(dirt, kit.box(), kit.toy('#ffffff'), [0.16, 0.49, -0.04], [0.12, 0.005, 0.1], [0, 0.4, 0]);
    dirt.visible = false;
    t.group.add(dirt);
    mergeStatic(t.group, kit, [pizza.group, dirt]);
    return { ...t, pizza, dirt };
  }

  function buildDecor(id, on, animate) {
    if (decor[id]) {
      props.remove(decor[id]);
      decor[id] = null;
    }
    if (!on) return;
    const g = new THREE.Group();
    const { x0, x1 } = LAYOUT.room;
    if (id === 'lights') {
      // string lights along the top of the back and left walls + pendant lamps over the counter
      const pts = [];
      const nB = 26;
      for (let i = 0; i <= nB; i++) {
        const t = i / nB;
        pts.push([lerp(x0 + 0.1, x1 - 0.1, t), WALL_H - 0.12 - Math.abs(Math.sin(t * Math.PI * 4)) * 0.18, backZ + 0.12]);
      }
      const nL = 18;
      for (let i = 0; i <= nL; i++) {
        const t = i / nL;
        pts.push([x0 + 0.12, WALL_H - 0.12 - Math.abs(Math.sin(t * Math.PI * 3)) * 0.18, lerp(backZ + 0.2, LAYOUT.room.z1 - 0.2, t)]);
      }
      const geo = kit.geo('bulb', () => new THREE.SphereGeometry(0.045, 8, 6));
      const mat = kit.own(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      bulbs = new THREE.InstancedMesh(geo, mat, pts.length);
      const m4 = new THREE.Matrix4();
      const cols = ['#ffd84a', '#ff7a7a', '#7ad0ff', '#9cff8a', '#ffb0f0'];
      pts.forEach(([x, y, z], i) => {
        m4.makeTranslation(x, y, z);
        bulbs.setMatrixAt(i, m4);
        bulbs.setColorAt(i, new THREE.Color(cols[i % cols.length]));
      });
      bulbs.userData.base = pts.map((_, i) => new THREE.Color(cols[i % cols.length]));
      g.add(bulbs);
      pendants = [-0.4, 1.6, 3.3].map((x, i) => {
        const p = createPendant(kit, ['#e2412f', '#2f9e5a', '#f59e0b'][i]);
        p.group.position.set(x, 1.85, C.z);
        g.add(p.group);
        return p;
      });
    } else if (id === 'plants') {
      [
        [x0 + 0.35, backZ + 0.35, 1, 1.25],
        [x1 - 0.35, backZ + 0.35, 0, 1.15],
        [x1 - 0.4, LAYOUT.door.z + 1.05, 1, 1.0],
        [C.x1 - 0.3, C.z, 2, 0.6],
        [x0 + 0.35, LAYOUT.counter.z - 0.4, 0, 0.95],
      ].forEach(([x, z, v, s]) => {
        const p = createPlant(kit, v, s);
        p.position.set(x, v === 2 ? COUNTER_TOP : 0, z);
        g.add(p);
      });
    } else if (id === 'posters') {
      [
        [25, '#ffe066', 'Pikachu', [x0 + 0.02, 1.62, -2.1], Math.PI / 2],
        [4, '#ffb38a', 'Charmander', [x0 + 0.02, 1.62, -4.1], Math.PI / 2],
        [143, '#9fd8e6', 'Snorlax', [x1 - 1.0, 1.62, backZ + 0.03], 0],
      ].forEach(([dex, color, name, [x, y, z], ry]) => {
        const t = T(TX.posterTexture(artworkUrl(dex), color, name));
        const f = new THREE.Group();
        f.position.set(x, y, z);
        f.rotation.y = ry;
        kit.mesh(f, kit.box(), kit.toy('#6b4423'), [0, 0, 0.01], [0.78, 1.02, 0.03]);
        kit.mesh(f, kit.geo('poster', () => new THREE.PlaneGeometry(0.7, 0.94)), kit.std('#ffffff', { map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.15 }), [0, 0, 0.03]);
        g.add(f);
      });
    } else if (id === 'sign') {
      const s = new THREE.Group();
      s.position.set(0.0, WALL_H + 0.62, backZ - 0.05);
      kit.mesh(s, kit.box(), kit.toy('#6b4423'), [-1.0, -0.4, 0], [0.08, 0.5, 0.08]);
      kit.mesh(s, kit.box(), kit.toy('#6b4423'), [1.0, -0.4, 0], [0.08, 0.5, 0.08]);
      kit.mesh(s, kit.geo('signPlane', () => new THREE.PlaneGeometry(2.6, 0.82)), kit.std('#ffffff', { map: tex.sign, emissive: '#ffffff', emissiveMap: tex.sign, emissiveIntensity: 0.25 }), [0, 0, 0.05]);
      kit.mesh(s, kit.box(), kit.toy('#b8281d'), [0, 0, 0], [2.7, 0.9, 0.06]);
      const n = 22;
      const geo = kit.geo('signBulb', () => new THREE.SphereGeometry(0.035, 6, 5));
      signBulbs = new THREE.InstancedMesh(geo, kit.own(new THREE.MeshBasicMaterial({ color: '#ffffff' })), n);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const per = 2 * (2.6 + 0.8);
        let d = t * per;
        let x;
        let y;
        if (d < 2.6) [x, y] = [-1.3 + d, 0.43];
        else if ((d -= 2.6) < 0.8) [x, y] = [1.3, 0.43 - d];
        else if ((d -= 0.8) < 2.6) [x, y] = [1.3 - d, -0.43];
        else [x, y] = [-1.3, -0.43 + (d - 2.6)];
        m4.makeTranslation(x, y, 0.07);
        signBulbs.setMatrixAt(i, m4);
        signBulbs.setColorAt(i, new THREE.Color('#fff3b0'));
      }
      s.add(signBulbs);
      g.add(s);
    }
    mergeStatic(g, kit);
    props.add(g);
    decor[id] = g;
    addGrow(g, animate, id === 'sign' ? new THREE.Vector3(0, WALL_H + 0.6, backZ) : id === 'posters' ? new THREE.Vector3(LAYOUT.room.x0 + 0.3, 1.6, -3) : id === 'plants' ? new THREE.Vector3(LAYOUT.room.x1 - 0.4, 0.4, backZ + 0.4) : new THREE.Vector3(0, 2.2, C.z));
  }

  function syncMenu(shopNow) {
    const menu = menuOf(shopNow);
    const key = menu.map((r) => r.id).join(',');
    if (key === menuKey && menuBoard) return;
    menuKey = key;
    if (menuTex) {
      menuTex.dispose();
      textures.splice(textures.indexOf(menuTex), 1);
    }
    menuTex = T(TX.menuTexture(menu));
    if (!menuBoard) {
      menuBoard = new THREE.Mesh(kit.geo('menuPlane', () => new THREE.PlaneGeometry(1.75, 1.3)), new THREE.MeshStandardMaterial({ map: menuTex, emissive: '#ffffff', emissiveMap: menuTex, emissiveIntensity: 0.2, roughness: 0.9 }));
      kit.own(menuBoard.material);
      props.add(menuBoard);
    } else {
      menuBoard.material.map = menuTex;
      menuBoard.material.emissiveMap = menuTex;
      menuBoard.material.needsUpdate = true;
    }
    menuBoard.position.set(0, 1.52, backZ + 0.03);
  }

  let shopState = null;
  const staffSparkle = []; // staff ids that just levelled up
  /** Bring the 3D shop in line with the bought upgrades; new things pop in with a poof when `animate`. */
  function setShop(shopNow, { animate = false } = {}) {
    const exp = hasExpand(shopNow);
    if (exp !== expanded) {
      expanded = exp;
      backZ = exp ? LAYOUT.expandZ0 : LAYOUT.room.z0;
      buildRoom(backZ);
      if (animate) {
        for (let i = 0; i < 8; i++) poof(lerp(LAYOUT.room.x0, LAYOUT.room.x1, i / 7), 0.8, lerp(LAYOUT.room.z0, backZ, 0.5));
      }
      // wall-mounted things follow the back wall
      for (const id of ['lights', 'posters', 'sign', 'plants']) if (decor[id]) buildDecor(id, true, false);
      menuKey = '';
      fit();
    }
    while (ovens.length < ovenCount(shopNow)) {
      const o = makeOven(ovens.length);
      ovens.push(o);
      addGrow(o.group, animate);
    }
    ovens.forEach((o) => o.setLevel(shopNow.up.oven || 0));
    if (animate && shopState && (shopNow.up.oven || 0) > (shopState.up.oven || 0)) ovens.forEach((o) => sparkle(o.group.position.x + 0.6, 1.1, o.group.position.z, 26));
    while (registers.length < registerCount(shopNow)) {
      const r = makeRegister(registers.length);
      registers.push(r);
      addGrow(r.group, animate);
    }
    while (tables.length < tableCount(shopNow)) {
      const t = makeTable(tables.length);
      tables.push(t);
      addGrow(t.group, animate);
    }
    for (const id of ['lights', 'plants', 'posters', 'sign']) {
      const on = (shopNow.up[id] || 0) > 0;
      if (on !== !!decor[id]) buildDecor(id, on, animate);
    }
    syncMenu(shopNow);
    syncTubs(shopNow);
    // a new Pokémon joins the team: poof at their work place
    if (animate && shopState) {
      const before = new Set(shopState.staff.map((m) => m.id));
      for (const m of shopNow.staff) {
        if (before.has(m.id)) continue;
        const at = m.role === 'cashier' ? [LAYOUT.registers[0].x, LAYOUT.staffZ] : m.role === 'chef' ? [LAYOUT.prep[1].x, LAYOUT.cookZ] : [LAYOUT.pickupX - 0.5, LAYOUT.staffZ];
        poof(at[0], 0.5, at[1]);
      }
      const lv = new Map(shopState.staff.map((m) => [m.id, m.level]));
      for (const m of shopNow.staff) if (lv.has(m.id) && m.level > lv.get(m.id)) staffSparkle.push(m.id);
    }
    shopState = shopNow;
  }

  // ---------------------------------------------------------------- FX: particles, coins, hearts, puffs
  const sparks = particlePool(kit, 400, 0.16, tex.glow, THREE.AdditiveBlending);
  const steam = particlePool(kit, 220, 0.42, tex.glow, THREE.NormalBlending);
  const smoke = particlePool(kit, 160, 0.6, tex.glow, THREE.NormalBlending);
  scene.add(sparks.points, steam.points, smoke.points);
  function sparkle(x, y, z, n = 18, colors = ['#fff6b0', '#ffd84a', '#ffffff', '#ffb0f0']) {
    sparks.emit(x, y, z, n, { colors, speed: 1.6, up: 2.2, spread: 0.25, life: 0.9, gravity: 3 });
  }
  const puffs = Array.from({ length: 24 }, () => {
    const m = kit.own(new THREE.SpriteMaterial({ map: tex.glow, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    const sp = new THREE.Sprite(m);
    sp.visible = false;
    sp.renderOrder = 9;
    scene.add(sp);
    return { sp, t: 1, x: 0, y: 0, z: 0, vx: 0, vz: 0 };
  });
  let puffHead = 0;
  function poof(x, y, z) {
    for (let k = 0; k < 7; k++) {
      const p = puffs[puffHead];
      puffHead = (puffHead + 1) % puffs.length;
      const a = (k / 7) * TAU;
      Object.assign(p, { t: 0, x: x + Math.cos(a) * 0.15, y: y + Math.random() * 0.2, z: z + Math.sin(a) * 0.15, vx: Math.cos(a) * 1.2, vz: Math.sin(a) * 1.2 });
      p.sp.visible = true;
    }
    sparkle(x, y + 0.2, z, 30);
  }
  const hearts = Array.from({ length: 18 }, () => {
    const sp = new THREE.Sprite(kit.own(new THREE.SpriteMaterial({ map: tex.heart, transparent: true, depthWrite: false, depthTest: false })));
    sp.visible = false;
    sp.renderOrder = 40;
    scene.add(sp);
    return { sp, t: 1, x: 0, y: 0, z: 0, d: 0 };
  });
  let heartHead = 0;
  function floatHeart(x, y, z, delay = 0) {
    const h = hearts[heartHead];
    heartHead = (heartHead + 1) % hearts.length;
    Object.assign(h, { t: -delay, x, y, z });
    h.sp.visible = false;
  }
  // coins: the pile on the counter and the flying ones
  const coinGeo = coinGeometry(kit);
  const coinMat = kit.toy('#ffcf33', { metalness: 0.55, roughness: 0.28, emissive: '#b07a00', emissiveIntensity: 0.3 });
  const PILE = 30;
  const pile = new THREE.InstancedMesh(coinGeo, coinMat, PILE);
  pile.frustumCulled = false;
  scene.add(pile);
  const FLY = 80;
  const flyMesh = new THREE.InstancedMesh(coinGeo, coinMat, FLY);
  flyMesh.frustumCulled = false;
  scene.add(flyMesh);
  const flights = [];
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const e4 = new THREE.Euler();
  const v4 = new THREE.Vector3();
  const s4 = new THREE.Vector3(1, 1, 1);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const pileSpot = () => new THREE.Vector3(LAYOUT.registers[0].x - 0.42, COUNTER_TOP, C.z - 0.18);
  const regSpot = () => new THREE.Vector3(LAYOUT.registers[0].x, COUNTER_TOP + 0.15, C.z + 0.15);
  function flyCoins(from, to, n, { delay = 0.05, arc = 1.1 } = {}) {
    for (let i = 0; i < n; i++) {
      if (flights.length >= FLY) flights.shift();
      flights.push({ a: from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2)), b: to.clone(), t: -i * delay, dur: 0.55 + Math.random() * 0.15, arc: arc * (0.8 + Math.random() * 0.5), spin: Math.random() * TAU });
    }
  }
  let pileCount = 0;

  // ---------------------------------------------------------------- characters
  const shadowGeo = kit.geo('shadow', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const shadowMat = kit.own(new THREE.MeshBasicMaterial({ map: tex.shadow, transparent: true, depthWrite: false }));
  const ringMat = kit.own(new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.85, depthWrite: false }));
  const ringGeo = kit.geo('pring', () => new THREE.RingGeometry(0.42, 0.52, 32).rotateX(-Math.PI / 2));
  const bubbleTex = new Map();
  const bubbleFor = (recipe, mode) => {
    const key = `${recipe}|${mode}`;
    if (!bubbleTex.has(key)) {
      const r = recipeById(recipe);
      bubbleTex.set(key, T(TX.bubbleTexture({ icons: r.toppings.map((t) => INGREDIENTS[t].icon), mode })));
    }
    return bubbleTex.get(key);
  };
  const views = new Map();
  const pool = new Map();
  let seedN = 1;
  const lookKey = (look) => `${look.species}|${look.shiny ? 1 : 0}|${look.type}|${look.image || ''}`;

  function makeView(look, role) {
    const species = look.species && look.species !== 'generic' ? look.species : 'generic';
    const model = createRacerModel({ species, shiny: !!look.shiny, type: look.type || 'Normal', seed: seedN++ });
    scene.add(model.group);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.renderOrder = 1;
    scene.add(shadow);
    const head = model.headTop.parent;
    const headR = model.headTop.position.y - 0.12;
    let acc = null;
    if (role === 'player' || role === 'chef') {
      acc = chefHat(kit, { big: role === 'player', star: role === 'player' });
      acc.position.set(0, -0.11, 0.02);
      model.headTop.add(acc);
    } else if (role === 'cashier') {
      acc = visorCap(kit);
      acc.position.set(0, -0.1, 0);
      model.headTop.add(acc);
    } else if (role === 'waiter') {
      acc = bowTie(kit);
      acc.position.set(0, -headR + 0.02, -0.2);
      head.add(acc);
    }
    let badge = null;
    if (species === 'generic' && look.image) {
      const bt = T(badgeTexture(look.image, TYPE_COLORS[look.type] || '#94a3b8', (look.name || '?').slice(0, 1).toUpperCase()));
      badge = new THREE.Sprite(kit.own(new THREE.SpriteMaterial({ map: bt, transparent: true, depthWrite: false })));
      badge.scale.set(0.5, 0.5, 1);
      badge.renderOrder = 12;
      scene.add(badge);
    }
    const bubble = new THREE.Sprite(kit.own(new THREE.SpriteMaterial({ map: null, transparent: true, depthWrite: false, depthTest: false })));
    bubble.scale.set(1.0, 0.69, 1);
    bubble.renderOrder = 35;
    bubble.visible = false;
    scene.add(bubble);
    let ring = null;
    if (role === 'player') {
      ring = new THREE.Mesh(ringGeo, ringMat);
      ring.renderOrder = 2;
      scene.add(ring);
    }
    const carry = createBox(kit, tex.box);
    carry.group.scale.setScalar(0.62);
    carry.group.position.set(0, 0.42, -0.36);
    carry.group.visible = false;
    model.group.add(carry.group);
    const scale = role === 'customer' ? 1.08 + Math.random() * 0.12 : role === 'player' ? 1.22 : 1.15;
    model.group.scale.setScalar(scale);
    return { model, shadow, badge, bubble, ring, carry, acc, key: lookKey(look), role, x: null, z: 0, y: 0, yaw: 0, hop: 0, stun: 0, mode: '', scale, seen: 0 };
  }
  function getView(id, look, role) {
    let v = views.get(id);
    if (v) return v;
    const key = lookKey(look);
    const list = role === 'customer' ? pool.get(key) : null;
    if (list && list.length) {
      v = list.pop();
      for (const o of [v.model.group, v.shadow, v.badge, v.bubble]) if (o) o.visible = true;
      v.x = null;
      v.mode = '';
      v.hop = 0;
      v.stun = 0;
    } else v = makeView(look, role);
    views.set(id, v);
    return v;
  }
  function releaseView(id) {
    const v = views.get(id);
    if (!v) return;
    views.delete(id);
    if (v.role === 'customer') {
      for (const o of [v.model.group, v.shadow, v.badge, v.bubble]) if (o) o.visible = false;
      v.carry.group.visible = false;
      if (!pool.has(v.key)) pool.set(v.key, []);
      pool.get(v.key).push(v);
      return;
    }
    destroyView(v);
  }
  function destroyView(v) {
    v.model.dispose();
    for (const o of [v.shadow, v.badge, v.bubble, v.ring]) if (o) scene.remove(o);
  }

  const headV = new THREE.Vector3();
  function driveView(v, e, dt, { state: anim = 'idle', speed = 0, sit = 0, bubble = null, carry = false } = {}) {
    if (v.x == null) {
      v.x = e.x;
      v.z = e.z;
      v.yaw = e.face || 0;
    }
    v.x = ease(v.x, e.x, 18, dt);
    v.z = ease(v.z, e.z, 18, dt);
    v.yaw = angLerp(v.yaw, e.face ?? v.yaw, 1 - Math.exp(-12 * dt));
    v.y = ease(v.y, sit, 10, dt);
    v.hop = Math.max(0, v.hop - dt);
    v.stun = Math.max(0, v.stun - dt);
    const hopY = v.hop > 0 ? Math.abs(Math.sin((1 - v.hop) * Math.PI * 2)) * 0.25 : 0;
    const g = v.model.group;
    g.position.set(v.x, v.y + hopY, v.z);
    g.rotation.y = v.yaw;
    const st = v.stun > 0 ? 'stun' : v.hop > 0 ? 'celebrate' : anim;
    v.model.update(dt, { state: st, speed, land: v.hop > 0.95 ? 0.6 : 0 });
    v.shadow.position.set(v.x, sit > 0 ? 0.28 : 0.012, v.z);
    const ss = (0.9 - hopY * 0.8) * v.scale;
    v.shadow.scale.set(ss, 1, ss);
    if (v.ring) {
      v.ring.position.set(v.x, 0.015, v.z);
      v.ring.rotation.y += dt * 0.8;
    }
    v.carry.group.visible = carry;
    v.model.headTop.getWorldPosition(headV);
    if (v.badge) {
      v.badge.position.set(headV.x, headV.y + 0.28 + Math.sin(time * 3) * 0.03, headV.z);
    }
    if (bubble) {
      const mode = `${bubble.recipe}|${bubble.mode}`;
      if (mode !== v.mode) {
        v.mode = mode;
        v.bubble.material.map = bubbleFor(bubble.recipe, bubble.mode);
        v.bubble.material.needsUpdate = true;
        v.bubblePop = 1;
      }
      v.bubblePop = Math.max(0, (v.bubblePop || 0) - dt * 3);
      const k = 1 + Math.sin(v.bubblePop * Math.PI) * 0.25;
      v.bubble.visible = true;
      v.bubble.scale.set(1.0 * k, 0.69 * k, 1);
      v.bubble.position.set(headV.x, headV.y + (v.badge ? 0.8 : 0.5) + Math.sin(time * 2.4 + v.x) * 0.03, headV.z);
    } else {
      v.bubble.visible = false;
      v.mode = '';
    }
  }

  // ---------------------------------------------------------------- pizzas on tables, in ovens, on the counter
  const pizzas = new Map(); // order id -> { pizza, box, stretch }
  const boardMat = kit.toy('#c98f55');
  function pizzaView(id) {
    let p = pizzas.get(id);
    if (p) return p;
    const pizza = createPizza(kit);
    const group = new THREE.Group();
    group.add(pizza.group);
    const board = kit.mesh(group, kit.cyl(), boardMat, [0, -0.012, 0], [0.37, 0.024, 0.37]);
    board.visible = false;
    const box = createBox(kit, tex.box);
    box.open(1);
    box.group.visible = false;
    group.add(box.group);
    scene.add(group);
    p = { group, pizza, box, board, lid: 1, stage: '', outT: 0, seen: 0, place: '' };
    pizzas.set(id, p);
    return p;
  }
  function dropPizza(id) {
    const p = pizzas.get(id);
    if (!p) return;
    scene.remove(p.group);
    pizzas.delete(id);
  }
  // cheese stretch: a slice lifts with gooey strings before the box closes
  const stretchG = new THREE.Group();
  stretchG.visible = false;
  scene.add(stretchG);
  const sliceGeo = kit.geo('slice', () => new THREE.CylinderGeometry(0.3, 0.3, 0.05, 10, 1, false, -0.3, 0.6));
  const slice = kit.mesh(stretchG, sliceGeo, kit.toy('#ffc23a'), [0, 0, 0]);
  kit.mesh(slice, kit.geo('sliceCrust', () => new THREE.CylinderGeometry(0.31, 0.31, 0.04, 10, 1, true, -0.3, 0.6)), kit.toy('#e3a253'), [0, -0.01, 0]);
  const strings = [0, 1, 2].map((i) => kit.mesh(stretchG, kit.cylLo(), kit.toy('#ffe27a'), [0, 0, 0], [0.012, 1, 0.012]).translateX(0.1 + i * 0.05));
  let stretch = null;

  const placeOf = (s, o) => {
    if (o.state === 'prep' || o.state === 'built') return o.owner === 'player' ? 'prep0' : 'prep1';
    if (o.state === 'oven') {
      const ov = s.ovens.find((x) => x.orderId === o.id);
      return ov ? `oven${ov.i}` : 'prep0';
    }
    return 'pass';
  };
  const passX = [-1.0, -0.42, 0.14, -0.7, -0.15];
  const tmp = new THREE.Vector3();

  function updatePizzas(s, dt) {
    const alive = new Set();
    let passI = 0;
    for (const o of s.orders) {
      alive.add(o.id);
      const p = pizzaView(o.id);
      p.pizza.set(o.items, o.extras);
      p.pizza.update(dt);
      const place = placeOf(s, o);
      let stage = 'raw';
      if (o.state === 'oven') {
        const ov = s.ovens.find((x) => x.orderId === o.id);
        const z = ov ? bakeZone(ov.t / s.bake) : 'raw';
        stage = z === 'burnt' ? 'burnt' : z === 'raw' ? 'raw' : 'baked';
      } else if (o.bakeQ) stage = o.bakeQ === 'burnt' ? 'burnt' : o.bakeQ === 'raw' ? 'raw' : 'baked';
      if (stage !== p.stage) {
        p.stage = stage;
        p.pizza.bake(stage);
      }
      let target;
      if (place === 'prep0' || place === 'prep1') target = prepTables[place === 'prep0' ? 0 : 1].pizzaSpot.getWorldPosition(tmp).clone();
      else if (place.startsWith('oven')) {
        const ov = ovens[Number(place.slice(4))];
        target = ov ? ov.mouth.getWorldPosition(tmp).clone() : new THREE.Vector3();
      } else {
        const i = passI++;
        target = new THREE.Vector3(passX[i % passX.length] ?? -0.4, COUNTER_TOP + (i >= 3 ? 0.09 : 0), C.z - (i >= 3 ? 0.0 : 0.05));
      }
      if (place !== p.place) {
        // jump straight there the first time, glide afterwards
        if (!p.place) p.group.position.copy(target);
        p.place = place;
        if (o.state === 'out') p.outT = 0;
      }
      p.group.position.lerp(target, 1 - Math.exp(-14 * dt));
      const boxed = o.state === 'boxed' || o.state === 'served';
      const stretching = !!stretch && stretch.id === o.id;
      p.box.group.visible = boxed || stretching;
      p.board.visible = o.state === 'out';
      p.lid = ease(p.lid, boxed && !stretching ? 0 : 1, 9, dt);
      p.box.open(p.lid);
      p.pizza.group.visible = !(boxed && p.lid < 0.12);
      p.pizza.group.position.y = boxed || stretching ? 0.012 : 0;
      // steam from hot pizzas
      if (o.state === 'out' || (boxed && p.lid > 0.2)) {
        p.outT += dt;
        if (Math.random() < dt * 9) steam.emit(p.group.position.x, p.group.position.y + 0.1, p.group.position.z, 1, { colors: ['#ffffff'], speed: 0.06, up: 0.55, spread: 0.18, life: 1.3, gravity: -0.1 });
      }
    }
    for (const id of [...pizzas.keys()]) if (!alive.has(id)) dropPizza(id);
    if (stretch) {
      stretch.t += dt;
      const p = pizzas.get(stretch.id);
      const k = stretch.t / 0.75;
      if (!p || k >= 1) {
        stretch = null;
        stretchG.visible = false;
      } else {
        stretchG.visible = true;
        const lift = Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) * 0.3;
        stretchG.position.copy(p.group.position);
        slice.position.set(0, 0.07 + lift, 0);
        strings.forEach((sm, i) => {
          sm.scale.set(0.012 * (1 - k * 0.6), lift + 0.01, 0.012);
          sm.position.set(0.12 + i * 0.05, 0.06 + lift / 2, (i - 1) * 0.04);
        });
      }
    }
  }

  // ---------------------------------------------------------------- camera framing
  const YAW = 0.24;
  const PITCH = 0.98;
  const camDir = new THREE.Vector3(Math.sin(YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(YAW) * Math.cos(PITCH)).normalize();
  const target = new THREE.Vector3();
  function fit() {
    const { x0, x1, z1 } = LAYOUT.room;
    const z0 = backZ;
    // frame the floor (walls may run off the top edge): characters stay big on a phone
    target.set((x0 + x1) / 2 + 0.15, 0.3, (z0 + z1) / 2 + 0.2);
    const corners = [];
    for (const x of [x0 + 0.1, x1 + 0.1]) for (const z of [z0 + 0.3, z1 + 0.1]) corners.push(new THREE.Vector3(x, 0, z));
    corners.push(new THREE.Vector3(0, WALL_H + 1.05, z0));
    let dist = 5;
    for (; dist < 60; dist += 0.2) {
      camera.position.copy(target).addScaledVector(camDir, dist);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      const ok = corners.every((c) => {
        const p = c.clone().project(camera);
        return Math.abs(p.x) < 1.06 && Math.abs(p.y) < 0.97;
      });
      if (ok) break;
    }
    camera.position.copy(target).addScaledVector(camDir, dist);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    // centre the floor vertically (the top may run under the HUD, the bottom should not be empty grass)
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of corners) {
      const y = c.clone().project(camera).y;
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    const shift = (hi + lo) / 2; // > 0: everything sits too high, move it down
    if (Math.abs(shift) > 0.01) {
      const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      camera.position.addScaledVector(up, (shift * h) / 2);
    }
    void hi;
  }
  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 360;
    const h = container.clientHeight || window.innerHeight || 640;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fit();
  };
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(resize);
    ro.observe(container);
  } else window.addEventListener('resize', resize);

  // ---------------------------------------------------------------- per frame
  let time = 0;
  let slowT = 0;
  let lowPower = false;
  let lastState = null;
  let lightK = -1;
  function setLight(k) {
    if (Math.abs(k - lightK) < 0.004) return;
    lightK = k;
    const c = skyAt(k);
    const col = skyGeo.attributes.color;
    const p = skyGeo.attributes.position;
    const tmpC = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const t = clamp((p.getY(i) + 17) / 34, 0, 1);
      tmpC.copy(c.bottom).lerp(c.top, Math.pow(t, 0.8));
      col.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
    }
    col.needsUpdate = true;
    hemi.intensity = c.hemi;
    hemi.color.set('#fff6e8').lerp(new THREE.Color('#ffd0a8'), k);
    sun.color.copy(c.sun);
    sun.intensity = c.sunI;
    const night = clamp((k - 0.6) / 0.4, 0, 1);
    const lights = decor.lights ? 1 : 0;
    warm.intensity = night * (1.4 + 1.6 * lights) + lights * 0.3;
    warm2.intensity = night * (0.9 + 0.8 * lights);
    for (const m of houseMats) m.emissiveIntensity = night * 0.9;
    for (const l of lampHeads) {
      l.headMat.color.set(night > 0.2 ? '#fff1b8' : '#d8dde6');
      l.glow.material.opacity = night * 0.9;
    }
    scene.background = c.bottom.clone().lerp(c.top, 0.3);
  }

  function update(s, dt, { light = null } = {}) {
    dt = Math.min(0.05, Math.max(0, dt));
    time += dt;
    if (s !== lastState) {
      // a new day (or the shop view): forget the old customers and pizzas
      for (const id of [...views.keys()]) if (String(id).startsWith('c')) releaseView(id);
      for (const id of [...pizzas.keys()]) dropPizza(id);
      lastState = s;
    }
    setLight(light ?? (s.phase === 'open' ? clamp(s.t / s.dayLen, 0, 1) : 1));
    const night = clamp((lightK - 0.6) / 0.4, 0, 1);
    if (bulbs) {
      const base = bulbs.userData.base;
      const c = new THREE.Color();
      for (let i = 0; i < base.length; i++) {
        const tw = 0.55 + 0.45 * Math.sin(time * 2.2 + i * 1.3);
        c.copy(base[i]).multiplyScalar(0.55 + 0.45 * (night * 0.6 + 0.4) * tw + 0.2);
        bulbs.setColorAt(i, c);
      }
      bulbs.instanceColor.needsUpdate = true;
      pendants.forEach((p) => p.bulbMat.color.set(night > 0.1 ? '#fff0a8' : '#fff7d6'));
    }
    if (signBulbs) {
      const c = new THREE.Color();
      for (let i = 0; i < 22; i++) {
        const on = (Math.floor(time * 4) + i) % 3 !== 0;
        c.set(on ? '#fff3b0' : '#c89040');
        signBulbs.setColorAt(i, c);
      }
      signBulbs.instanceColor.needsUpdate = true;
    }

    // grow-in of new props
    for (let i = grows.length - 1; i >= 0; i--) {
      const g = grows[i];
      g.t += dt * 1.3;
      g.obj.scale.setScalar(Math.max(0.001, elastic(Math.min(1, g.t)) * g.s));
      if (g.t >= 1) grows.splice(i, 1);
    }

    // ovens, registers
    ovens.forEach((o, i) => {
      const ov = s.ovens[i];
      const baking = !!ov && ov.orderId != null;
      o.heat = ease(o.heat, baking ? 1 : 0.25, 3, dt);
      o.update(time, dt, o.heat);
      o.ring.visible = baking;
      if (baking) {
        const p = ov.t / s.bake;
        const z = bakeZone(p);
        const frac = clamp(p / 1.85, 0, 1);
        o.ringFg.geometry.setDrawRange(0, Math.max(6, Math.floor(frac * 40) * 6));
        o.ringFg.material.color.set(z === 'perfect' ? '#22c55e' : z === 'burnt' ? '#ef4444' : z === 'ok' ? '#f59e0b' : '#fb923c');
        o.ring.quaternion.copy(camera.quaternion);
        const pulse = z === 'perfect' ? 1 + Math.sin(time * 10) * 0.08 : 1;
        o.ring.scale.setScalar(pulse);
        o.smokeT -= dt;
        if (o.smokeT <= 0) {
          o.smokeT = z === 'burnt' ? 0.05 : 0.35;
          const top = o.chimneyTop.getWorldPosition(tmp);
          smoke.emit(top.x, top.y, top.z, 1, { colors: z === 'burnt' ? ['#4b4b4b', '#333333'] : ['#f2efe9', '#e2ddd5'], speed: 0.1, up: 0.6, spread: 0.06, life: 1.8, gravity: -0.1 });
          if (z === 'burnt') {
            const m = o.mouth.getWorldPosition(tmp);
            smoke.emit(m.x + 0.2, m.y + 0.2, m.z, 2, { colors: ['#3a3a3a', '#555555'], speed: 0.25, up: 0.7, spread: 0.15, life: 1.4, gravity: -0.2 });
          }
        }
      }
    });
    ovenLight.intensity = 0.5 + 0.6 * Math.max(...ovens.map((o) => o.heat), 0) + Math.sin(time * 13) * 0.08;
    registers.forEach((r) => r.update(dt));

    // tables
    tables.forEach((t, i) => {
      const st = s.tables[i];
      t.dirt.visible = !!st?.dirty;
      const eater = st && st.cust != null ? s.customers.find((c) => c.id === st.cust) : null;
      const eating = eater && eater.state === 'eat';
      t.pizza.group.visible = !!eating;
      if (eating) {
        t.pizza.slices(clamp(eater.eatT / EAT_TIME, 0.15, 1));
        t.pizza.group.position.x = eater.seat * 0.16;
        if (Math.random() < dt * 3) steam.emit(t.group.position.x + eater.seat * 0.16, 0.6, t.group.position.z + 0.05, 1, { colors: ['#ffffff'], speed: 0.05, up: 0.45, spread: 0.12, life: 1.0, gravity: -0.1 });
      }
    });

    // characters
    const seen = new Set();
    for (const c of s.customers) {
      const id = `c${c.id}`;
      seen.add(id);
      const v = getView(id, c.look, 'customer');
      let bubble = null;
      const low = c.patience / c.maxPatience < 0.3;
      if (c.state === 'order') bubble = { recipe: c.recipe, mode: low ? 'angry' : 'order' };
      else if (c.state === 'wait') bubble = { recipe: c.recipe, mode: low ? 'angry' : 'wait' };
      else if ((c.state === 'line' || c.state === 'toReg') && low) bubble = { recipe: c.recipe, mode: 'angry' };
      else if (c.state === 'eat' || ((c.state === 'leave' || c.state === 'toTable') && c.mood === 'happy' && c.hearts >= 2)) bubble = v.happyT > 0 ? { recipe: c.recipe, mode: 'happy' } : null;
      v.happyT = Math.max(0, (v.happyT || 0) - dt);
      const sit = c.state === 'eat' ? 0.16 : 0;
      driveView(v, c, dt, { state: c.walking ? 'run' : 'idle', speed: c.walking ? 0.32 : 0, sit, bubble, carry: !!c.carry && c.state !== 'eat' });
      if (c.state === 'eat') v.model.group.position.y += Math.abs(Math.sin(time * 6 + c.id)) * 0.02;
    }
    for (const m of s.staff) {
      const id = `s${m.id}`;
      seen.add(id);
      const v = getView(id, { species: m.species, type: 'Normal', shiny: false }, m.role);
      const working = !m.walking && m.task && (m.task.type === 'build' || m.task.type === 'clean' || m.task.type === 'box');
      if (staffSparkle.includes(m.id)) {
        staffSparkle.splice(staffSparkle.indexOf(m.id), 1);
        v.hop = 1;
        sparkle(m.x, 1.3, m.z, 30);
      }
      driveView(v, m, dt, { state: m.walking ? 'run' : working ? 'celebrate' : 'idle', speed: m.walking ? 0.5 : 0, carry: m.task?.type === 'serve' });
    }
    {
      const ch = s.chef;
      const v = getView('player', { species: player.species || 'generic', type: player.type || 'Normal', image: player.image || null, name: player.name }, 'player');
      seen.add('player');
      const busy = ch.cueT < 0.45 && (ch.cue === 'make' || ch.cue === 'clean' || ch.cue === 'box');
      driveView(v, ch, dt, { state: ch.walking ? 'run' : busy ? 'celebrate' : 'idle', speed: ch.walking ? 0.6 : 0 });
    }
    for (const id of [...views.keys()]) if (!seen.has(id)) releaseView(id);

    updatePizzas(s, dt);

    // coin pile on the counter
    const want = Math.min(PILE, Math.ceil(s.coins / 4));
    if (want !== pileCount) {
      const ps = pileSpot();
      for (let i = 0; i < PILE; i++) {
        if (i < want) {
          const col = i % 3;
          const h = Math.floor(i / 3);
          e4.set(0, i * 0.7, 0);
          q4.setFromEuler(e4);
          v4.set(ps.x + (col - 1) * 0.15, ps.y + 0.012 + h * 0.022, ps.z + (col === 1 ? 0.06 : 0));
          m4.compose(v4, q4, s4);
          pile.setMatrixAt(i, m4);
        } else pile.setMatrixAt(i, ZERO);
      }
      pile.instanceMatrix.needsUpdate = true;
      pileCount = want;
    }
    // flying coins
    for (let i = 0; i < FLY; i++) {
      const f = flights[i];
      if (!f) {
        flyMesh.setMatrixAt(i, ZERO);
        continue;
      }
      f.t += dt;
      const k = clamp(f.t / f.dur, 0, 1);
      if (f.t < 0) {
        flyMesh.setMatrixAt(i, ZERO);
        continue;
      }
      v4.lerpVectors(f.a, f.b, k);
      v4.y += Math.sin(k * Math.PI) * f.arc;
      e4.set(Math.PI / 2 + f.spin + f.t * 12, f.t * 6, 0);
      q4.setFromEuler(e4);
      m4.compose(v4, q4, s4);
      flyMesh.setMatrixAt(i, m4);
    }
    flyMesh.instanceMatrix.needsUpdate = true;
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      if (f.t >= f.dur) {
        if (Math.random() < 0.35) sparks.emit(f.b.x, f.b.y, f.b.z, 3, { colors: ['#fff6b0', '#ffd84a'], speed: 1, up: 1.2, spread: 0.05, life: 0.4, gravity: 2 });
        flights.splice(i, 1);
      }
    }

    // hearts and puffs
    for (const h of hearts) {
      if (h.t >= 1.4) {
        h.sp.visible = false;
        continue;
      }
      h.t += dt;
      if (h.t < 0) continue;
      h.sp.visible = true;
      const k = h.t / 1.4;
      h.sp.position.set(h.x + Math.sin(h.t * 6) * 0.08, h.y + k * 0.9, h.z);
      const sc = 0.3 * (k < 0.15 ? k / 0.15 : 1) * (1 - Math.max(0, k - 0.8) * 4);
      h.sp.scale.set(sc, sc, 1);
    }
    for (const p of puffs) {
      if (p.t >= 1) {
        p.sp.visible = false;
        continue;
      }
      p.t += dt * 1.6;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.y += dt * 0.5;
      p.sp.position.set(p.x, p.y, p.z);
      const sc = 0.4 + p.t * 0.9;
      p.sp.scale.set(sc, sc, 1);
      p.sp.material.opacity = 0.85 * (1 - p.t);
    }
    sparks.update(dt);
    steam.update(dt);
    smoke.update(dt);

    // adaptive quality
    if (!lowPower) {
      slowT = dt > 0.034 ? slowT + dt : Math.max(0, slowT - dt * 0.5);
      if (slowT > 3) {
        lowPower = true;
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        resize();
        for (const v of views.values()) v.model.setDetail?.(false);
        street.children.forEach((o, i) => {
          if (i > 6 && o.geometry === kit.sphere()) o.visible = false;
        });
      }
    }
    renderer.render(scene, camera);
  }

  /** Engine event → effects. */
  function fx(e, s) {
    const custView = (id) => views.get(`c${id}`);
    const byView = (by) => (by === 'player' || by == null ? views.get('player') : views.get(`s${by}`));
    if (e.type === 'order') {
      const v = custView(e.custId);
      if (v) v.hop = 0.6;
      const r = registers[0]?.group.position;
      if (r) sparkle(r.x, COUNTER_TOP + 0.4, r.z, 8, ['#ffffff', '#a5f3fc']);
    } else if (e.type === 'add') {
      const o = s.orders.find((x) => x.id === e.id);
      const pt = prepTables[o && o.owner !== 'player' ? 1 : 0];
      const at = pt.pizzaSpot.getWorldPosition(tmp);
      const color = INGREDIENTS[e.item]?.color || '#ffffff';
      if (e.item === 'dough') steam.emit(at.x, at.y + 0.05, at.z, 10, { colors: ['#ffffff', '#fff6e0'], speed: 0.8, up: 0.5, spread: 0.2, life: 0.7, gravity: 0.4 });
      sparks.emit(at.x, at.y + 0.1, at.z, e.ok ? 10 : 4, { colors: e.ok ? [color, '#ffffff'] : ['#94a3b8'], speed: 1.1, up: 1.4, spread: 0.2, life: 0.6, gravity: 4 });
      if (e.done) sparkle(at.x, at.y + 0.2, at.z, 16);
    } else if (e.type === 'oven') {
      const o = ovens[e.oven];
      if (o) {
        const m = o.mouth.getWorldPosition(tmp);
        sparks.emit(m.x + 0.2, m.y + 0.2, m.z, 16, { colors: ['#ff9a20', '#ffd27a', '#ff4a1c'], speed: 1.2, up: 1.6, spread: 0.2, life: 0.6, gravity: 2 });
      }
    } else if (e.type === 'take') {
      const o = ovens[e.oven];
      if (o) {
        const m = o.mouth.getWorldPosition(tmp);
        steam.emit(m.x + 0.3, m.y + 0.15, m.z, 14, { colors: ['#ffffff'], speed: 0.3, up: 0.9, spread: 0.2, life: 1.2, gravity: -0.1 });
        if (e.quality === 'perfect') sparkle(m.x + 0.4, m.y + 0.3, m.z, 26);
        if (e.quality === 'burnt') smoke.emit(m.x + 0.3, m.y + 0.2, m.z, 16, { colors: ['#333333', '#555555'], speed: 0.4, up: 0.9, spread: 0.2, life: 1.4, gravity: -0.2 });
      }
    } else if (e.type === 'box') {
      stretch = { id: e.id, t: 0 };
      const v = byView(e.by);
      if (v) v.hop = 0;
    } else if (e.type === 'serve') {
      const p = pizzas.get(e.id);
      if (p) sparkle(p.group.position.x, p.group.position.y + 0.25, p.group.position.z, 12);
    } else if (e.type === 'pay') {
      const v = custView(e.custId);
      if (v) {
        v.hop = 1;
        v.happyT = 2.2;
        v.model.headTop.getWorldPosition(tmp);
        for (let i = 0; i < e.hearts; i++) floatHeart(tmp.x + (i - (e.hearts - 1) / 2) * 0.22, tmp.y + 0.35, tmp.z, i * 0.15);
        flyCoins(new THREE.Vector3(v.x, 0.9, v.z), pileSpot(), Math.min(8, 2 + Math.round(e.amount / 6)), { arc: 0.5 });
      }
    } else if (e.type === 'collect') {
      const n = Math.min(26, 4 + Math.round(e.amount / 3));
      flyCoins(pileSpot().add(new THREE.Vector3(0, 0.05, 0)), regSpot(), n, { delay: 0.035, arc: 0.9 });
      registers[0]?.ding();
      const r = regSpot();
      setTimeout(() => sparkle(r.x, r.y + 0.3, r.z, 30, ['#fff6b0', '#ffd84a', '#ffffff']), 450);
    } else if (e.type === 'dine') {
      const t = tables[e.table];
      if (t) flyCoins(new THREE.Vector3(t.group.position.x, 0.6, t.group.position.z), regSpot(), Math.min(8, 2 + Math.round(e.amount / 3)), { arc: 1.6, delay: 0.06 });
      registers[0]?.ding();
    } else if (e.type === 'clean') {
      const t = tables[e.table];
      if (t) sparks.emit(t.group.position.x, 0.6, t.group.position.z, 22, { colors: ['#a5f3fc', '#ffffff', '#bae6fd'], speed: 1, up: 1.4, spread: 0.3, life: 0.8, gravity: 1 });
    } else if (e.type === 'angry') {
      const v = custView(e.id);
      if (v) {
        v.stun = 1.1;
        smoke.emit(v.x, 1.4, v.z, 8, { colors: ['#ef4444', '#f87171'], speed: 0.5, up: 0.6, spread: 0.15, life: 0.7, gravity: 0 });
      }
    }
  }

  const pv = new THREE.Vector3();
  /** World point → percent position on the stage. */
  function project(x, y, z) {
    pv.set(x, y, z).project(camera);
    return { x: (pv.x * 0.5 + 0.5) * 100, y: (1 - (pv.y * 0.5 + 0.5)) * 100, visible: pv.z < 1 };
  }

  function triangles() {
    let n = 0;
    scene.traverse((o) => {
      if (!o.visible || !(o.isMesh || o.isInstancedMesh)) return;
      const g = o.geometry;
      const c = g.index ? g.index.count : g.attributes.position.count;
      n += (c / 3) * (o.isInstancedMesh ? o.count : 1);
    });
    return Math.round(n);
  }

  function dispose() {
    if (ro) ro.disconnect();
    else window.removeEventListener('resize', resize);
    for (const v of views.values()) destroyView(v);
    for (const list of pool.values()) for (const v of list) destroyView(v);
    views.clear();
    pool.clear();
    disposeKit(kit);
    for (const t of textures) t.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
  }

  setShop(shop || { up: {}, recipes: ['cheese', 'sausage'], staff: [] });
  resize();
  setLight(0);

  const api = {
    update,
    fx,
    setShop,
    project,
    resize,
    dispose,
    triangles,
    get lowPower() {
      return lowPower;
    },
    debug: { scene, camera, renderer, views },
  };
  if (import.meta.env?.DEV && typeof window !== 'undefined') window.__pz3 = api; // screenshots / debugging
  return api;
}
