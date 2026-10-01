// Three.js world for "Vượt chướng ngại Pokémon": pastel obstacle courses floating over a cloud sea,
// drawn from the engine state. Racers are procedural 3D models (racers.js).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PHY, floorBelow, standings } from '../../../utils/three3d/obby3d';
import { createRacerModel, TYPE_COLORS } from './racers';
import { canvasTexture, mulberry, surfaceTexture, stripeTexture, arrowTexture, voltorbTexture, mushroomTexture, pokeballEmblem, bannerTexture, tagTexture, glowTexture, starTexture, shadowTexture, badgeTexture } from './obby3dDecor';

const SKY = {
  candy: { top: '#8fd3ff', mid: '#ffd6ec', bottom: '#ffeef7', fog: '#ffe1f0', hemiSky: '#ffffff', hemiGround: '#e9b7d8', sun: '#fff4e0', cloud: '#ffffff', cloud2: '#ffc7e3', trim: '#ffffff' },
  castle: { top: '#9db4ff', mid: '#d8c8ff', bottom: '#ffe2c4', fog: '#eadcff', hemiSky: '#ffffff', hemiGround: '#b8a0d8', sun: '#ffe8cc', cloud: '#f4ecff', cloud2: '#d7c6ff', trim: '#8fd07a' },
  rainbow: { top: '#6cc4ff', mid: '#bfe6ff', bottom: '#fff0fa', fog: '#e6f4ff', hemiSky: '#ffffff', hemiGround: '#b8d4f0', sun: '#ffffff', cloud: '#ffffff', cloud2: '#e4f1ff', trim: '#ffffff' },
  factory: { top: '#7fb6f0', mid: '#cfe2f5', bottom: '#ffe7c2', fog: '#dce8f3', hemiSky: '#ffffff', hemiGround: '#9aa8b8', sun: '#fff1d6', cloud: '#eef4fa', cloud2: '#c9d6e4', trim: '#ffcc33' },
  mountain: { top: '#62b0f5', mid: '#bde0ff', bottom: '#fff3dc', fog: '#e0eefc', hemiSky: '#ffffff', hemiGround: '#a8b890', sun: '#fff2d8', cloud: '#ffffff', cloud2: '#e3eef8', trim: '#7ccb6a' },
};

/** Top / side colours of the trim slab that caps each walkable platform. */
const TRIM = {
  candy: (c) => [tint(c, 0.55), '#ffffff'], // frosting
  castle: (c) => [tint(c, 0.35), '#8fd07a'], // pastel flagstones with a grass rim
  rainbow: (c) => [tint(c, 0.2), '#ffffff'], // rainbow tops on white cloud edges
  factory: (c) => [tint(c, 0.45), '#ffcc33'], // painted plates with a yellow safety rim
  mountain: () => ['#8fd47a', '#6fb85a'], // grass
};
const STATIC_ROLES = new Set(['start', 'platform', 'finish', 'bridge', 'ramp', 'rail', 'post', 'lintel', 'disc', 'pillar']);
const tmpColor = new THREE.Color();
const shade = (hex, k) => '#' + tmpColor.set(hex).multiplyScalar(k).getHexString();
const tint = (hex, white) => '#' + tmpColor.set(hex).lerp(new THREE.Color('#ffffff'), white).getHexString();

/** Sets vertex colours (top lighter than sides) and world-scaled UVs on a geometry. */
function paint(geo, top, side, uvScale = 0.5) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const uv = new Float32Array(pos.count * 2);
  const ct = new THREE.Color(top);
  const cs = new THREE.Color(side);
  for (let i = 0; i < pos.count; i++) {
    const ny = nor.getY(i);
    const c = ny > 0.55 ? ct : cs;
    col.set([c.r, c.g, c.b], i * 3);
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(ny);
    const az = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (ay >= ax && ay >= az) uv.set([x * uvScale, z * uvScale], i * 2);
    else if (ax >= az) uv.set([z * uvScale, y * uvScale], i * 2);
    else uv.set([x * uvScale, y * uvScale], i * 2);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Geometry for a collider in its own local frame. */
function colliderGeometry(c, extra = 0) {
  if (c.kind === 'cyl') {
    const seg = c.role === 'tile' ? 6 : c.role === 'pillar' ? 16 : 32;
    const g = new THREE.CylinderGeometry(c.r + extra, c.r + extra, c.hy * 2, seg, 1);
    if (c.role === 'tile') g.rotateY(Math.PI / 6);
    return g;
  }
  const w = c.hx * 2 + extra;
  const h = c.hy * 2;
  const d = c.hz * 2 + extra;
  const r = Math.min(0.28, h / 2 - 0.02, w / 2 - 0.02, d / 2 - 0.02);
  return r > 0.04 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
}

const euler = new THREE.Euler();
const quat = new THREE.Quaternion();
const mat4 = new THREE.Matrix4();
const one = new THREE.Vector3(1, 1, 1);
const vpos = new THREE.Vector3();
function colliderMatrix(c) {
  euler.set(c.pitch || 0, c.yaw || 0, c.roll || 0, 'YXZ');
  quat.setFromEuler(euler);
  vpos.set(c.x, c.y, c.z);
  return mat4.compose(vpos, quat, one);
}

/** Particle pool drawn as glowing points. */
function particlePool(count, size, texture, blending) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const mat = new THREE.PointsMaterial({ size, map: texture, vertexColors: true, transparent: true, depthWrite: false, blending, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const list = Array.from({ length: count }, () => ({ life: 0, max: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, g: 0, r: 1, gC: 1, b: 1 }));
  let cursor = 0;
  const tmp = new THREE.Color();
  return {
    points,
    emit(x, y, z, n, { color = '#ffffff', colors, speed = 4, life = 0.8, gravity = 0, spread = 0.4, up = 0, flat = false } = {}) {
      for (let i = 0; i < n; i++) {
        const p = list[cursor];
        cursor = (cursor + 1) % count;
        const u = flat ? Math.random() * 0.3 : Math.random() * 2 - 1;
        const a = Math.random() * Math.PI * 2;
        const k = Math.sqrt(1 - u * u);
        const v = speed * (0.4 + Math.random() * 0.8);
        p.x = x + (Math.random() - 0.5) * spread;
        p.y = y + (Math.random() - 0.5) * spread * 0.5;
        p.z = z + (Math.random() - 0.5) * spread;
        p.vx = Math.cos(a) * k * v;
        p.vy = u * v + up;
        p.vz = Math.sin(a) * k * v;
        p.g = gravity;
        p.life = life * (0.6 + Math.random() * 0.6);
        p.max = p.life;
        tmp.set(colors ? colors[i % colors.length] : color);
        p.r = tmp.r;
        p.gC = tmp.g;
        p.b = tmp.b;
      }
    },
    update(dt) {
      for (let i = 0; i < count; i++) {
        const p = list[i];
        if (p.life > 0) {
          p.life -= dt;
          p.vy -= p.g * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vx *= 0.985;
          p.vz *= 0.985;
        }
        const f = Math.max(0, p.life / p.max);
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.life > 0 ? p.y : -9999;
        pos[i * 3 + 2] = p.z;
        col[i * 4] = p.r;
        col[i * 4 + 1] = p.gC;
        col[i * 4 + 2] = p.b;
        col[i * 4 + 3] = f;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

/** Confetti: small coloured paper squares that tumble down. */
function confettiPool(count) {
  const geo = new THREE.PlaneGeometry(0.22, 0.14);
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const colors = ['#ff5fa2', '#ffd166', '#4dd6ff', '#7ee081', '#b388ff', '#ffffff', '#ff8a5c'];
  const c = new THREE.Color();
  const list = Array.from({ length: count }, (_, i) => {
    mesh.setColorAt(i, c.set(colors[i % colors.length]));
    return { life: 0, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, sx: 0, sy: 0 };
  });
  let cursor = 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  return {
    mesh,
    burst(x, y, z, n, power = 7) {
      for (let i = 0; i < n; i++) {
        const k = list[cursor];
        cursor = (cursor + 1) % count;
        const a = Math.random() * Math.PI * 2;
        const v = power * (0.4 + Math.random() * 0.8);
        Object.assign(k, { life: 2.6 + Math.random(), x, y, z, vx: Math.cos(a) * v * 0.6, vy: v * (0.8 + Math.random() * 0.6), vz: Math.sin(a) * v * 0.6, rx: Math.random() * 6, ry: Math.random() * 6, sx: 4 + Math.random() * 6, sy: 3 + Math.random() * 5 });
      }
    },
    update(dt) {
      for (let i = 0; i < count; i++) {
        const k = list[i];
        if (k.life > 0) {
          k.life -= dt;
          k.vy = Math.max(-2.2, k.vy - 9 * dt);
          k.vx *= 0.97;
          k.vz *= 0.97;
          k.x += k.vx * dt + Math.sin(k.rx) * 0.01;
          k.y += k.vy * dt;
          k.z += k.vz * dt;
          k.rx += k.sx * dt;
          k.ry += k.sy * dt;
          e.set(k.rx, k.ry, 0);
          q.setFromEuler(e);
          p.set(k.x, k.y, k.z);
          m.compose(p, q, s);
        } else m.compose(zero, q.identity(), zero);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/**
 * Builds the world for one race into `container`. Throws if WebGL is unavailable.
 * opts = { state (engine state at the start), playerImage }
 */
export function createObby3DScene(container, { state, playerImage }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const course = state.course;
  const theme = course.theme;
  const pal = course.palette;
  const sky = SKY[theme] || SKY.candy;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sky.mid);
  scene.fog = new THREE.Fog(sky.fog, 45, 190);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.3, 700);
  const disposables = new Set();
  const own = (x) => {
    disposables.add(x);
    return x;
  };
  const rnd = mulberry(course.index * 31 + 5);
  let time = 0;
  let slowFor = 0;
  let lowPower = false;
  let baseFov = 60;
  let portrait = false;

  const resize = () => {
    const w = container.clientWidth || 360;
    const h = container.clientHeight || 640;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    portrait = camera.aspect < 0.9;
    baseFov = portrait ? 62 + (0.9 - camera.aspect) * 14 : 56;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  };
  resize();
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(resize);
    ro.observe(container);
  } else window.addEventListener('resize', resize);

  // ---------------------------------------------------------------- sky, light, cloud sea
  let skyDome = null;
  {
    const g = own(new THREE.SphereGeometry(600, 24, 16));
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const top = new THREE.Color(sky.top);
    const mid = new THREE.Color(sky.mid);
    const bot = new THREE.Color(sky.bottom);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 600;
      if (y > 0) c.copy(mid).lerp(top, Math.pow(y, 0.7));
      else c.copy(mid).lerp(bot, Math.min(1, -y * 3));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dome = new THREE.Mesh(g, own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
    dome.renderOrder = -10;
    scene.add(dome);
    skyDome = dome;
  }
  scene.add(new THREE.HemisphereLight(sky.hemiSky, sky.hemiGround, 1.25));
  const sun = new THREE.DirectionalLight(sky.sun, 1.55);
  sun.position.set(-30, 60, 20);
  scene.add(sun);
  scene.add(sun.target);

  const seaY = course.killY + 3;
  {
    // Cloud sea: a soft plane plus puffy instanced clouds
    const tex = own(
      canvasTexture(256, 256, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
        g.addColorStop(0, sky.cloud);
        g.addColorStop(1, sky.fog);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      })
    );
    const sea = new THREE.Mesh(own(new THREE.PlaneGeometry(900, 900)), own(new THREE.MeshBasicMaterial({ map: tex, color: '#ffffff' })));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, seaY - 2, course.finishZ / 2);
    scene.add(sea);
  }
  const puffGeo = own(new THREE.IcosahedronGeometry(1, 2));
  let clouds = null;
  const props = new THREE.Group(); // theme scenery (thinned out on slow devices)
  scene.add(props);
  const cloudMat = own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: sky.cloud, emissiveIntensity: 0.35, flatShading: false }));
  {
    const n = 150;
    clouds = new THREE.InstancedMesh(puffGeo, cloudMat, n);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const zLen = course.endZ - 40;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const below = i % 3 === 0;
      const r = below ? 3 + rnd() * 5 : 4 + rnd() * 5;
      p.set(below ? (rnd() - 0.5) * 60 : side * (22 + r * 1.2 + rnd() * 60), below ? seaY + rnd() * 2 : seaY + rnd() * 5, 40 + rnd() * (zLen - 40));
      s.set(r * 1.6, r * 0.7, r);
      m.compose(p, quat.identity(), s);
      clouds.setMatrixAt(i, m);
      clouds.setColorAt(i, c.set(rnd() < 0.35 ? sky.cloud2 : sky.cloud));
    }
    scene.add(clouds);
  }

  // ---------------------------------------------------------------- platforms
  const surfTex = own(surfaceTexture(theme));
  const platMat = own(new THREE.MeshStandardMaterial({ vertexColors: true, map: surfTex, roughness: 0.62, metalness: theme === 'factory' ? 0.15 : 0 }));
  const trimColor = sky.trim;
  const staticGeos = [];
  const kinematic = []; // { c, mesh }
  const tileMeshes = new Map();
  const doorMeshes = new Map();
  const padMeshes = [];
  const conveyorTex = [];

  const topSide = (c) => {
    const base = c.color || pal.colors[0];
    if (theme === 'factory' && c.role !== 'rail' && c.role !== 'pillar') return [tint(base, 0.15), shade(pal.metal || '#c9d3df', 0.9)];
    if (theme === 'castle' && (c.role === 'platform' || c.role === 'bridge' || c.role === 'start' || c.role === 'finish')) return [tint(base, 0.2), pal.stone];
    if (theme === 'mountain' && (c.role === 'platform' || c.role === 'ramp' || c.role === 'start' || c.role === 'finish')) return [tint(base, 0.1), pal.rock];
    return [tint(base, 0.18), shade(base, 0.86)];
  };

  for (const c of course.colliders) {
    if (c.motion || c.tile || c.door || c.role === 'pad' || c.role === 'conveyor' || c.role === 'gate' || !STATIC_ROLES.has(c.role)) continue;
    const [top, side] = topSide(c);
    const g = colliderGeometry(c);
    paint(g, top, side);
    g.applyMatrix4(colliderMatrix(c));
    staticGeos.push(g.index ? g.toNonIndexed() : g);
    if (g.index) g.dispose();
    // A frosting / grass / cloud trim along the top edge of walkable slabs
    if (c.kind === 'box' && ['platform', 'start', 'finish', 'bridge', 'ramp'].includes(c.role)) {
      const trim = new RoundedBoxGeometry(c.hx * 2 + 0.16, 0.32, c.hz * 2 + 0.16, 2, 0.14);
      trim.translate(0, c.hy - 0.12, 0);
      const [tt, ts] = TRIM[theme] ? TRIM[theme](c.color) : [tint(c.color, 0.4), trimColor];
      paint(trim, tt, ts);
      trim.applyMatrix4(colliderMatrix(c));
      if (trim.index) {
        staticGeos.push(trim.toNonIndexed());
        trim.dispose();
      } else staticGeos.push(trim);
    }
  }
  if (staticGeos.length) {
    // strip attributes down to the shared set
    for (const g of staticGeos) {
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    }
    const merged = own(mergeGeometries(staticGeos, false));
    for (const g of staticGeos) g.dispose();
    const world = new THREE.Mesh(merged, platMat);
    scene.add(world);
  }

  // Moving, special and breakable pieces get their own meshes
  const discTop = (color) =>
    own(
      canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = shade(color, 0.95);
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.moveTo(w / 2, h / 2);
          ctx.arc(w / 2, h / 2, w / 2, (i / 8) * Math.PI * 2, ((i + 0.5) / 8) * Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w * 0.1, 0, Math.PI * 2);
        ctx.fill();
      })
    );
  const hazard = own(stripeTexture('#ffcc33', '#3b3f4a', 6));
  const gateMat = own(new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.5 }));
  hazard.repeat.set(2, 1);
  const emblem = own(pokeballEmblem());
  const emblemMat = own(new THREE.MeshBasicMaterial({ map: emblem, transparent: true }));
  const emblemGeo = own(new THREE.PlaneGeometry(1.2, 1.2));
  const tileMat = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: '#3a2a00', emissiveIntensity: 0.05 }));

  for (const c of course.colliders) {
    if (staticGeosHas(c)) continue;
    let mesh;
    if (c.tile) {
      const g = own(colliderGeometry(c));
      paint(g, theme === 'factory' ? '#9fd8ff' : '#ffd84a', theme === 'factory' ? '#5a7a9a' : '#f0a020');
      mesh = new THREE.Mesh(g, tileMat);
      tileMeshes.set(c.id, { mesh, c, t: 0, last: 'solid' });
    } else if (c.door) {
      const g = own(colliderGeometry(c));
      paint(g, tint(c.color, 0.3), c.color);
      mesh = new THREE.Mesh(g, platMat);
      const e = new THREE.Mesh(emblemGeo, emblemMat);
      e.position.set(0, 0.2, c.hz + 0.02);
      const s = Math.min(1, (c.hx * 2) / 1.5);
      e.scale.setScalar(s);
      mesh.add(e);
      const e2 = e.clone();
      e2.position.z = -c.hz - 0.02;
      e2.rotation.y = Math.PI;
      mesh.add(e2);
      doorMeshes.set(c.id, { mesh, c, t: -1 });
    } else if (c.role === 'pad') {
      const grp = new THREE.Group();
      const cap = new THREE.Mesh(own(new THREE.SphereGeometry(c.r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2)), own(new THREE.MeshStandardMaterial({ map: own(mushroomTexture(c.color)), roughness: 0.45, emissive: c.color, emissiveIntensity: 0.12 })));
      cap.scale.y = 0.55;
      cap.position.y = -c.hy;
      grp.add(cap);
      const stalk = new THREE.Mesh(own(new THREE.CylinderGeometry(c.r * 0.38, c.r * 0.5, 6, 16)), own(new THREE.MeshStandardMaterial({ color: '#fff3e0', roughness: 0.8 })));
      stalk.position.y = -c.hy - 3;
      grp.add(stalk);
      mesh = grp;
      padMeshes.push({ mesh: cap, ob: course.obstacles.find((o) => o.collider === c) });
    } else if (c.role === 'conveyor') {
      const g = own(colliderGeometry(c));
      paint(g, '#5b6b7f', '#3e4a5a');
      mesh = new THREE.Mesh(g, platMat);
      const tex = own(arrowTexture());
      tex.repeat.set(c.hx, c.hz);
      conveyorTex.push({ tex, speed: c.belt.z });
      const belt = new THREE.Mesh(own(new THREE.PlaneGeometry(c.hx * 2 - 0.3, c.hz * 2)), own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })));
      belt.rotation.x = -Math.PI / 2;
      belt.position.y = c.hy + 0.01;
      mesh.add(belt);
    } else if (c.role === 'gate') {
      mesh = new THREE.Mesh(own(colliderGeometry(c)), gateMat);
    } else if (c.kind === 'cyl') {
      const g = own(colliderGeometry(c));
      const [, side] = topSide(c);
      paint(g, tint(c.color, 0.25), side);
      const top = own(new THREE.MeshStandardMaterial({ map: discTop(c.color), roughness: 0.55 }));
      mesh = new THREE.Mesh(g, [platMat, top, platMat]);
    } else {
      const g = own(colliderGeometry(c));
      const [top, side] = topSide(c);
      paint(g, top, side);
      mesh = new THREE.Mesh(g, platMat);
      if (c.role === 'seesaw') {
        const stripe = new THREE.Mesh(own(new THREE.BoxGeometry(0.3, 0.05, c.hz * 2 - 0.4)), own(new THREE.MeshBasicMaterial({ color: '#ffffff' })));
        stripe.position.y = c.hy + 0.01;
        mesh.add(stripe);
      }
    }
    mesh.position.set(c.x, c.y, c.z);
    mesh.rotation.set(c.pitch || 0, c.yaw || 0, c.roll || 0, 'YXZ');
    scene.add(mesh);
    if (c.motion) kinematic.push({ c, mesh });
  }
  function staticGeosHas(c) {
    return !(c.motion || c.tile || c.door || c.role === 'pad' || c.role === 'conveyor' || c.role === 'gate' || !STATIC_ROLES.has(c.role));
  }

  // ---------------------------------------------------------------- obstacles
  const caneTex = own(stripeTexture('#ffffff', '#ff4f7b', 5));
  caneTex.repeat.set(4, 1);
  const caneMat = own(new THREE.MeshStandardMaterial({ map: caneTex, roughness: 0.35, emissive: '#552233', emissiveIntensity: 0.12 }));
  const voltTex = own(voltorbTexture());
  const voltMat = own(new THREE.MeshStandardMaterial({ map: voltTex, roughness: 0.3, metalness: 0.05 }));
  const ballGeo = own(new THREE.SphereGeometry(1, 28, 18));
  const darkMat = own(new THREE.MeshStandardMaterial({ color: '#4b4f63', roughness: 0.5, metalness: 0.3 }));
  const accentMat = own(new THREE.MeshStandardMaterial({ color: pal.accent, roughness: 0.5, emissive: pal.accent, emissiveIntensity: 0.1 }));
  const sweepers = [];
  const swingers = [];
  const ballSets = [];
  for (const ob of course.obstacles) {
    if (ob.type === 'sweeper') {
      const g = new THREE.Group();
      g.position.set(ob.x, ob.y, ob.z);
      const a = ob.arms === 2 ? -ob.len : 0;
      const len = ob.len - a;
      const bar = new THREE.Mesh(own(new THREE.CylinderGeometry(ob.r, ob.r, len, 16, 1)), caneMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.x = a + len / 2;
      g.add(bar);
      for (const x of ob.arms === 2 ? [-ob.len, ob.len] : [ob.len]) {
        const capM = new THREE.Mesh(ballGeo, accentMat);
        capM.scale.setScalar(ob.r * 1.25);
        capM.position.x = x;
        g.add(capM);
      }
      const hub = new THREE.Mesh(ballGeo, accentMat);
      hub.scale.set(0.6, 0.45, 0.6);
      g.add(hub);
      scene.add(g);
      sweepers.push({ ob, g });
    } else if (ob.type === 'hammer' || ob.type === 'pendulum') {
      // Frame: two posts and a beam
      const frame = new THREE.Group();
      frame.position.set(ob.px, ob.py, ob.pz);
      const postGeo = own(new THREE.CylinderGeometry(0.22, 0.28, ob.len + 2.2, 10));
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(postGeo, accentMat);
        p.position.set(s * 4.6, -(ob.len + 2.2) / 2 + 0.3, 0);
        frame.add(p);
      }
      const beam = new THREE.Mesh(own(new THREE.CylinderGeometry(0.25, 0.25, 9.4, 10)), accentMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.y = 0.3;
      frame.add(beam);
      scene.add(frame);
      const arm = new THREE.Group();
      arm.position.set(ob.px, ob.py, ob.pz);
      const rod = new THREE.Mesh(own(new THREE.CylinderGeometry(0.09, 0.09, ob.len, 8)), darkMat);
      rod.position.y = -ob.len / 2;
      arm.add(rod);
      if (ob.type === 'hammer') {
        const headLen = ob.head.half * 2 + ob.head.r * 2;
        const head = new THREE.Mesh(own(new THREE.CylinderGeometry(ob.head.r, ob.head.r, headLen, 24)), own(new THREE.MeshStandardMaterial({ color: '#ff6b8a', roughness: 0.4, emissive: '#ff6b8a', emissiveIntensity: 0.12 })));
        head.rotation.x = Math.PI / 2;
        head.position.y = -ob.len;
        arm.add(head);
        for (const s of [-1, 1]) {
          const capM = new THREE.Mesh(own(new THREE.CylinderGeometry(ob.head.r * 1.04, ob.head.r * 1.04, 0.22, 24)), own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 })));
          capM.rotation.x = Math.PI / 2;
          capM.position.set(0, -ob.len, s * (headLen / 2 - 0.1));
          arm.add(capM);
        }
      } else {
        const head = new THREE.Mesh(ballGeo, voltMat);
        head.scale.setScalar(ob.head.r);
        head.position.y = -ob.len;
        head.rotation.y = 0;
        arm.add(head);
      }
      scene.add(arm);
      swingers.push({ ob, arm });
    } else if (ob.type === 'balls') {
      const pool = Array.from({ length: 16 }, () => {
        const m = new THREE.Mesh(ballGeo, voltMat);
        m.scale.setScalar(ob.R);
        m.visible = false;
        scene.add(m);
        return m;
      });
      ballSets.push({ ob, pool });
    }
  }

  // ---------------------------------------------------------------- decor: arches, flags, balloons, theme props
  const flags = [];
  const balloons = [];
  const bobbers = []; // { o, y, k }
  const spinners = []; // { o, w }
  const flagGeo = own(new THREE.BufferGeometry());
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.7, 0, 1.2, -0.35, 0], 3));
  flagGeo.computeVertexNormals();
  const poleGeo = own(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8));
  const poleMat = own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
  const balloonGeo = own(new THREE.SphereGeometry(0.55, 16, 12));
  const stringMat = own(new THREE.LineBasicMaterial({ color: '#ffffff' }));
  const balloonColors = ['#ff5fa2', '#ffd166', '#4dd6ff', '#7ee081', '#b388ff', '#ff8a5c'];
  const balloonMats = balloonColors.map((c) => own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, emissive: c, emissiveIntensity: 0.15 })));
  const addBalloons = (x, y, z, n) => {
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const bx = x + (rnd() - 0.5) * 1.6;
      const bz = z + (rnd() - 0.5) * 1.2;
      const h = 2.2 + rnd() * 1.6;
      g.position.set(bx, y + h, bz);
      const b = new THREE.Mesh(balloonGeo, balloonMats[i % balloonMats.length]);
      b.scale.set(1, 1.18, 1);
      g.add(b);
      const lg = own(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.6, 0), new THREE.Vector3(x - bx, -h, z - bz)]));
      g.add(new THREE.Line(lg, stringMat));
      scene.add(g);
      balloons.push({ g, y: y + h, k: rnd() * 6 });
    }
  };
  for (const d of course.decor) {
    if (d.type === 'flag') {
      const g = new THREE.Group();
      g.position.set(d.x, d.y, d.z);
      const mats = [];
      for (const s of [-1, 1]) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(s * (d.w / 2 + 0.6), 1.7, 0);
        g.add(pole);
        const fm = own(new THREE.MeshStandardMaterial({ color: '#4dd6ff', side: THREE.DoubleSide, roughness: 0.5, emissive: '#4dd6ff', emissiveIntensity: 0.25 }));
        mats.push(fm);
        const f = new THREE.Mesh(flagGeo, fm);
        f.position.set(s * (d.w / 2 + 0.6), 3.35, 0);
        if (s > 0) f.scale.x = -1;
        g.add(f);
      }
      // checker line on the floor
      const line = new THREE.Mesh(own(new THREE.PlaneGeometry(d.w - 0.6, 0.5)), own(new THREE.MeshBasicMaterial({ map: own(stripeTexture('#ffffff', '#4dd6ff', 10, false)), transparent: true, opacity: 0.85 })));
      line.rotation.x = -Math.PI / 2;
      line.position.y = 0.02;
      g.add(line);
      scene.add(g);
      flags.push({ g, mats, index: d.index + 1, on: false, t: 0 });
    } else if (d.type === 'startArch' || d.type === 'finishArch') {
      const fin = d.type === 'finishArch';
      const g = new THREE.Group();
      g.position.set(d.x, d.y, d.z);
      const r = d.w / 2 + 0.4;
      const arch = new THREE.Mesh(own(new THREE.TorusGeometry(r, 0.34, 12, 40, Math.PI)), own(new THREE.MeshStandardMaterial({ map: own(stripeTexture(fin ? '#ffffff' : pal.accent, fin ? '#222831' : '#ffffff', 16, false)), roughness: 0.45 })));
      arch.scale.set(1, 1.05, 1);
      g.add(arch);
      const banner = new THREE.Mesh(own(new THREE.PlaneGeometry(6, 1.5)), own(new THREE.MeshBasicMaterial({ map: own(bannerTexture(fin ? 'VỀ ĐÍCH' : 'XUẤT PHÁT', fin ? '#ff5fa2' : '#38bdf8')), side: THREE.DoubleSide, transparent: true })));
      banner.position.set(0, r * 1.05 - 0.9, 0);
      g.add(banner);
      scene.add(g);
      if (fin) {
        addBalloons(d.x - r - 0.5, d.y, d.z, 6);
        addBalloons(d.x + r + 0.5, d.y, d.z, 6);
        const line = new THREE.Mesh(own(new THREE.PlaneGeometry(d.w, 1.2)), own(new THREE.MeshBasicMaterial({ map: own(stripeTexture('#ffffff', '#222831', 12, false)) })));
        line.rotation.x = -Math.PI / 2;
        line.position.set(d.x, d.y + 0.03, d.z);
        scene.add(line);
      }
    } else if (d.type === 'pivot') {
      const p = new THREE.Mesh(own(new THREE.CylinderGeometry(0.5, 0.5, d.len - 0.6, 3)), darkMat);
      p.rotation.x = Math.PI / 2;
      p.rotation.y = Math.PI;
      p.position.set(d.x, d.y - 0.1, d.z);
      scene.add(p);
    }
  }

  buildThemeProps();

  function buildThemeProps() {
    const zStart = 20;
    const zEnd = course.endZ - 30;
    const spots = [];
    for (let z = zStart; z > zEnd; z -= 11 + rnd() * 6) {
      for (const side of [-1, 1]) if (rnd() < 0.8) spots.push({ x: side * (14 + rnd() * 22), z: z + rnd() * 5, y: -3 - rnd() * 6, side });
    }
    const add = (o) => {
      props.add(o);
      return o;
    };
    const std = (color, extra = {}) => own(new THREE.MeshStandardMaterial({ color, roughness: 0.55, emissive: color, emissiveIntensity: 0.12, ...extra }));
    // Floating islands under the props
    const islandGeo = own(new THREE.CylinderGeometry(1, 0.35, 1.6, 9, 1));
    const islandTop = std(theme === 'castle' ? '#a7e08a' : theme === 'factory' ? '#b8c4d4' : theme === 'mountain' ? '#8fd47a' : theme === 'rainbow' ? '#ffffff' : '#ffd0e8');
    const islands = new THREE.InstancedMesh(islandGeo, islandTop, spots.length);
    const m = new THREE.Matrix4();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    spots.forEach((sp, i) => {
      const r = 3 + rnd() * 3;
      p.set(sp.x, sp.y - 0.8, sp.z);
      s.set(r, r * 0.6, r);
      m.compose(p, quat.identity(), s);
      islands.setMatrixAt(i, m);
      sp.r = r;
    });
    add(islands);

    if (theme === 'candy') {
      const stick = own(new THREE.CylinderGeometry(0.18, 0.18, 6, 8));
      const swirlTex = own(
        canvasTexture(256, 256, (ctx, w, h) => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          const cols = ['#ff5fa2', '#ffd166', '#4dd6ff', '#7ee081'];
          ctx.lineWidth = 18;
          for (let k = 0; k < 4; k++) {
            ctx.strokeStyle = cols[k];
            ctx.beginPath();
            for (let t = 0; t < 60; t++) {
              const a = t * 0.35 + (k * Math.PI) / 2;
              const rr = t * 2.1;
              ctx.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr);
            }
            ctx.stroke();
          }
        })
      );
      const disc = own(new THREE.CylinderGeometry(1.8, 1.8, 0.45, 32));
      const discMats = [std('#ffb3d6'), own(new THREE.MeshStandardMaterial({ map: swirlTex, roughness: 0.3 })), own(new THREE.MeshStandardMaterial({ map: swirlTex, roughness: 0.3 }))];
      const gum = own(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6));
      const gumMats = ['#ff7ab8', '#7ee0c3', '#ffd166', '#a0c4ff', '#c4a0ff'].map((c) => std(c, { roughness: 0.3 }));
      const donut = own(new THREE.TorusGeometry(1.3, 0.6, 12, 24));
      spots.forEach((sp, i) => {
        const k = i % 3;
        if (k === 0) {
          const g = new THREE.Group();
          g.position.set(sp.x, sp.y + 3, sp.z);
          g.add(new THREE.Mesh(stick, poleMat));
          const d = new THREE.Mesh(disc, discMats);
          d.rotation.x = Math.PI / 2;
          d.position.y = 3.6;
          g.add(d);
          g.rotation.y = sp.side * 0.5;
          add(g);
          spinners.push({ o: d, w: 0.4 * sp.side, axis: 'y' });
        } else if (k === 1) {
          for (let j = 0; j < 3; j++) {
            const gm = new THREE.Mesh(gum, gumMats[(i + j) % gumMats.length]);
            gm.position.set(sp.x + (j - 1) * 1.8, sp.y, sp.z + (j % 2) * 1.4);
            gm.scale.setScalar(1 + rnd() * 0.6);
            add(gm);
          }
        } else {
          const dn = new THREE.Mesh(donut, gumMats[i % gumMats.length]);
          dn.position.set(sp.x, sp.y + 2.5, sp.z);
          dn.rotation.set(0.4, sp.side * 0.6, 0);
          add(dn);
          bobbers.push({ o: dn, y: dn.position.y, k: rnd() * 6 });
        }
      });
    } else if (theme === 'castle') {
      const tower = own(new THREE.CylinderGeometry(1.6, 1.8, 7, 14));
      const roof = own(new THREE.ConeGeometry(2.2, 3, 14));
      const towerMat = std('#d9cdf2', { map: surfTex });
      const roofMats = ['#ff7ab8', '#7ea8ff', '#ffb347'].map((c) => std(c));
      const mound = own(new THREE.SphereGeometry(1.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2));
      const moundMat = std('#a5734a');
      const diglettBody = own(new THREE.CapsuleGeometry(0.55, 0.7, 6, 14));
      const diglettMat = std('#b07a52');
      const noseMat = std('#ff8fb0');
      const eyeMat = own(new THREE.MeshBasicMaterial({ color: '#1b1420' }));
      const small = own(new THREE.SphereGeometry(1, 10, 8));
      spots.forEach((sp, i) => {
        if (i % 2 === 0) {
          const t = new THREE.Mesh(tower, towerMat);
          t.position.set(sp.x, sp.y + 3.5, sp.z);
          add(t);
          const r = new THREE.Mesh(roof, roofMats[i % 3]);
          r.position.set(sp.x, sp.y + 8.5, sp.z);
          add(r);
        } else {
          // Diglett trio popping in and out
          for (let j = 0; j < 2; j++) {
            const g = new THREE.Group();
            g.position.set(sp.x + (j ? 1.4 : -1.2), sp.y, sp.z + j);
            g.add(new THREE.Mesh(mound, moundMat));
            const d = new THREE.Group();
            d.add(new THREE.Mesh(diglettBody, diglettMat));
            for (const sx of [-1, 1]) {
              const e = new THREE.Mesh(small, eyeMat);
              e.scale.set(0.07, 0.14, 0.05);
              e.position.set(sx * 0.18, 0.35, sp.side > 0 ? -0.5 : 0.5);
              d.add(e);
            }
            const n = new THREE.Mesh(small, noseMat);
            n.scale.set(0.2, 0.13, 0.12);
            n.position.set(0, 0.12, sp.side > 0 ? -0.53 : 0.53);
            d.add(n);
            d.rotation.y = sp.side > 0 ? -0.5 : 0.5;
            g.add(d);
            add(g);
            bobbers.push({ o: d, y: 0.3, k: rnd() * 6, pop: true });
          }
        }
      });
    } else if (theme === 'rainbow') {
      const ring = own(new THREE.TorusGeometry(1, 0.06, 6, 40, Math.PI));
      const bands = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'].map((c) => std(c, { emissiveIntensity: 0.35 }));
      spots.forEach((sp, i) => {
        if (i % 3 === 0) {
          const g = new THREE.Group();
          g.position.set(sp.x, sp.y, sp.z);
          bands.forEach((mtl, k) => {
            const r = new THREE.Mesh(ring, mtl);
            r.scale.setScalar(8 - k * 0.55);
            g.add(r);
          });
          g.rotation.y = Math.PI / 2 + sp.side * 0.3;
          add(g);
        } else {
          for (let j = 0; j < 4; j++) {
            const c = new THREE.Mesh(puffGeo, cloudMat);
            c.position.set(sp.x + (j - 1.5) * 1.6, sp.y + 2 + (j % 2) * 0.6, sp.z + rnd());
            c.scale.setScalar(1.3 + rnd() * 0.8);
            add(c);
            bobbers.push({ o: c, y: c.position.y, k: i * 0.7 });
          }
        }
      });
    } else if (theme === 'factory') {
      // Gears and floating Magnemite
      const gearShape = new THREE.Shape();
      const teeth = 10;
      for (let k = 0; k < teeth * 2; k++) {
        const a = (k / (teeth * 2)) * Math.PI * 2;
        const r = k % 2 ? 2.1 : 2.6;
        const a2 = a + Math.PI / (teeth * 2);
        if (k === 0) gearShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else gearShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        gearShape.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
      }
      const hole = new THREE.Path();
      hole.absarc(0, 0, 0.7, 0, Math.PI * 2, true);
      gearShape.holes.push(hole);
      const gear = own(new THREE.ExtrudeGeometry(gearShape, { depth: 0.6, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 }));
      gear.translate(0, 0, -0.3);
      const gearMats = ['#ffcc33', '#9fd8ff', '#ff9f6e'].map((c) => std(c, { metalness: 0.3, roughness: 0.35 }));
      const pipe = own(new THREE.CylinderGeometry(0.5, 0.5, 9, 12));
      const pipeMat = std('#9aa8b8', { metalness: 0.4, roughness: 0.3 });
      spots.forEach((sp, i) => {
        if (i % 3 === 2) {
          add(magnemite(sp.x, sp.y + 4 + rnd() * 2, sp.z));
        } else if (i % 3 === 1) {
          const pp = new THREE.Mesh(pipe, pipeMat);
          pp.position.set(sp.x, sp.y + 4, sp.z);
          pp.rotation.z = 0.2 * sp.side;
          add(pp);
        } else {
          const gm = new THREE.Mesh(gear, gearMats[i % 3]);
          gm.position.set(sp.x, sp.y + 4, sp.z);
          gm.rotation.y = Math.PI / 2;
          add(gm);
          spinners.push({ o: gm, w: (i % 2 ? 0.6 : -0.6), axis: 'z' });
        }
      });
    } else {
      // Mountain: rocky peaks, pine trees and sleepy Voltorbs
      const peak = own(new THREE.ConeGeometry(3, 9, 7));
      const peakMat = std('#c8a27a', { flatShading: true, roughness: 0.9 });
      const snowMat = std('#ffffff', { flatShading: true });
      const snow = own(new THREE.ConeGeometry(1.25, 3.7, 7));
      const pine = own(new THREE.ConeGeometry(1.2, 2.6, 9));
      const pineMat = std('#4caf6a');
      const trunk = own(new THREE.CylinderGeometry(0.2, 0.25, 1, 6));
      const trunkMat = std('#8a5a3a');
      spots.forEach((sp, i) => {
        if (i % 3 === 0) {
          const pk = new THREE.Mesh(peak, peakMat);
          pk.position.set(sp.x, sp.y + 4.5, sp.z);
          add(pk);
          const sn = new THREE.Mesh(snow, snowMat);
          sn.position.set(sp.x, sp.y + 7.2, sp.z);
          add(sn);
        } else if (i % 3 === 1) {
          for (let j = 0; j < 3; j++) {
            const x = sp.x + (j - 1) * 1.7;
            const z = sp.z + (j % 2) * 1.5;
            const tr = new THREE.Mesh(trunk, trunkMat);
            tr.position.set(x, sp.y + 0.5, z);
            add(tr);
            for (let k = 0; k < 2; k++) {
              const pn = new THREE.Mesh(pine, pineMat);
              pn.position.set(x, sp.y + 1.8 + k * 1.1, z);
              pn.scale.setScalar(1 - k * 0.3);
              add(pn);
            }
          }
        } else {
          const v = new THREE.Mesh(ballGeo, voltMat);
          v.scale.setScalar(1.2);
          v.position.set(sp.x, sp.y + 1.2, sp.z);
          v.rotation.y = sp.side > 0 ? -Math.PI / 2 : Math.PI / 2;
          add(v);
          bobbers.push({ o: v, y: v.position.y, k: rnd() * 6, amp: 0.15 });
        }
      });
    }
  }

  function magnemite(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const steel = own(new THREE.MeshStandardMaterial({ color: '#c9d3df', metalness: 0.5, roughness: 0.3 }));
    const body = new THREE.Mesh(ballGeo, steel);
    g.add(body);
    const eyeW = new THREE.Mesh(ballGeo, own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 })));
    eyeW.scale.set(0.55, 0.55, 0.3);
    eyeW.position.z = 0.85;
    g.add(eyeW);
    const pupil = new THREE.Mesh(ballGeo, own(new THREE.MeshBasicMaterial({ color: '#1b1420' })));
    pupil.scale.set(0.22, 0.22, 0.1);
    pupil.position.z = 1.08;
    g.add(pupil);
    const magnetGeo = own(new THREE.TorusGeometry(0.45, 0.16, 8, 16, Math.PI));
    for (const s of [-1, 1]) {
      const mg = new THREE.Mesh(magnetGeo, steel);
      mg.position.set(s * 1.3, 0, 0);
      mg.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(mg);
      for (const [k, col] of [
        [1, '#ef4444'],
        [-1, '#3b82f6'],
      ]) {
        const tip = new THREE.Mesh(own(new THREE.CylinderGeometry(0.17, 0.17, 0.25, 10)), own(new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })));
        tip.position.set(s * 1.3, k * 0.45, 0);
        tip.rotation.z = Math.PI / 2;
        tip.position.x += s * 0.12;
        g.add(tip);
      }
    }
    const screw = new THREE.Mesh(own(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8)), steel);
    screw.position.y = 1.1;
    g.add(screw);
    g.rotation.y = x > 0 ? -1.2 : 1.2;
    bobbers.push({ o: g, y, k: x, amp: 0.5 });
    return g;
  }

  // ---------------------------------------------------------------- racers
  const shadowTex = own(shadowTexture());
  const shadowMat = own(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  const shadowGeo = own(new THREE.PlaneGeometry(1.3, 1.3));
  shadowGeo.rotateX(-Math.PI / 2);
  const starTex = own(starTexture());
  const starMat = own(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false }));
  const ringMat = own(new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.85, depthWrite: false }));
  const ringGeo = own(new THREE.RingGeometry(0.55, 0.72, 32));
  ringGeo.rotateX(-Math.PI / 2);
  const racers = state.racers.map((r, i) => {
    const model = createRacerModel({ species: r.species, shiny: r.shiny, type: r.type, seed: i + 1 });
    scene.add(model.group);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.renderOrder = 1;
    scene.add(shadow);
    const label = r.isPlayer ? 'Bé ★' : `${r.name}${r.shiny ? ' ✨' : ''}`;
    const tagTex = own(tagTexture(label, r.isPlayer ? { bg: 'rgba(250,204,21,0.92)', fg: '#3b2a00' } : {}));
    const tag = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: tagTex, transparent: true, depthWrite: false, depthTest: false })));
    tag.scale.set(r.isPlayer ? 1.1 : 1.2, r.isPlayer ? 0.28 : 0.3, 1);
    tag.renderOrder = 20;
    scene.add(tag);
    const stars = Array.from({ length: 3 }, () => {
      const sp = new THREE.Sprite(starMat);
      sp.scale.set(0.32, 0.32, 1);
      sp.visible = false;
      scene.add(sp);
      return sp;
    });
    let ring = null;
    let badge = null;
    if (r.isPlayer) {
      ring = new THREE.Mesh(ringGeo, ringMat);
      ring.renderOrder = 2;
      scene.add(ring);
      if (r.species === 'generic') {
        const btex = own(badgeTexture(playerImage, TYPE_COLORS[r.type] || '#94a3b8', (r.name || '?').slice(0, 1).toUpperCase()));
        badge = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: btex, transparent: true, depthWrite: false })));
        badge.scale.set(0.75, 0.75, 1);
        scene.add(badge);
      }
    }
    return { r, model, shadow, tag, stars, ring, badge, hidden: 0, pop: 0, dustT: rnd() };
  });
  // Crown for whoever leads (and the winner)
  const crown = new THREE.Group();
  {
    const gold = own(new THREE.MeshStandardMaterial({ color: '#ffcf33', metalness: 0.6, roughness: 0.25, emissive: '#a07000', emissiveIntensity: 0.35 }));
    const band = new THREE.Mesh(own(new THREE.CylinderGeometry(0.22, 0.2, 0.14, 16, 1, true)), gold);
    crown.add(band);
    const spike = own(new THREE.ConeGeometry(0.06, 0.16, 6));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const sm = new THREE.Mesh(spike, gold);
      sm.position.set(Math.cos(a) * 0.2, 0.14, Math.sin(a) * 0.2);
      crown.add(sm);
    }
    const gem = new THREE.Mesh(own(new THREE.SphereGeometry(0.045, 8, 6)), own(new THREE.MeshBasicMaterial({ color: '#ff4f7b' })));
    gem.position.set(0, 0, -0.21);
    crown.add(gem);
    scene.add(crown);
  }

  // ---------------------------------------------------------------- particles
  const glow = own(glowTexture());
  const sparks = particlePool(500, 0.45, glow, THREE.AdditiveBlending);
  const dust = particlePool(300, 0.7, glow, THREE.NormalBlending);
  const confetti = confettiPool(260);
  scene.add(sparks.points, dust.points, confetti.mesh);
  own(sparks.points.geometry);
  own(sparks.points.material);
  own(dust.points.geometry);
  own(dust.points.material);
  own(confetti.mesh.geometry);
  own(confetti.mesh.material);

  // ---------------------------------------------------------------- camera rig
  const cam = { ready: false, pos: new THREE.Vector3(), look: new THREE.Vector3(), anchor: new THREE.Vector3(), ground: null, turn: 0 };
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const near = (e, dist = 40) => {
    const p = state.player;
    return Math.abs(e.z - p.z) < dist;
  };

  /** Particle effects for engine events. */
  function fx(e) {
    const isMe = e.id === 0;
    switch (e.type) {
      case 'jump':
        if (near(e, 25)) dust.emit(e.x, e.y - PHY.R, e.z, isMe ? 6 : 3, { color: '#ffffff', speed: 1.6, life: 0.45, flat: true, spread: 0.4 });
        break;
      case 'land':
        if (near(e, 25)) dust.emit(e.x, e.y + 0.05, e.z, isMe ? 12 : 5, { color: '#ffffff', speed: 2.8 * (0.5 + e.power), life: 0.55, flat: true, spread: 0.6 });
        break;
      case 'dive':
        if (near(e, 25)) dust.emit(e.x, e.y - 0.2, e.z, 8, { color: '#e0f2fe', speed: 2, life: 0.5, spread: 0.5 });
        break;
      case 'knock':
        sparks.emit(e.x, e.y + 0.5, e.z, isMe ? 26 : 12, { colors: ['#fde047', '#ffffff', '#f9a8d4'], speed: 4, life: 0.6 });
        break;
      case 'respawn':
        sparks.emit(e.x, e.y + 0.3, e.z, isMe ? 50 : 20, { colors: ['#fff7b0', '#a5f3fc', '#f5d0fe'], speed: 2.6, life: 1, up: 2.5, gravity: 1, spread: 0.8 });
        break;
      case 'checkpoint':
        if (isMe) {
          const f = flags.find((x) => x.index === e.index);
          if (f && !f.on) {
            f.on = true;
            f.t = 0;
            for (const mt of f.mats) {
              mt.color.set('#ffd23f');
              mt.emissive.set('#ffd23f');
            }
            sparks.emit(e.x, e.y + 2.5, e.z, 28, { colors: ['#ffd23f', '#7ee081', '#4dd6ff'], speed: 5, life: 0.9, gravity: 4, spread: 3 });
            confetti.burst(e.x, e.y + 3, e.z, 30, 5);
          }
        }
        break;
      case 'bounce':
        sparks.emit(e.x, e.y - 0.3, e.z, isMe ? 22 : 8, { colors: ['#ffffff', '#ff9ccf', '#fff1a0'], speed: 4, life: 0.5, flat: true });
        break;
      case 'tileDrop':
        dust.emit(e.x, e.y, e.z, 8, { color: '#ffe08a', speed: 2, life: 0.6, gravity: 4 });
        break;
      case 'tileBack': {
        const t = tileMeshes.get(e.id);
        if (t) t.pop = 1;
        break;
      }
      case 'doorBreak': {
        const d = doorMeshes.get(e.door);
        if (d) d.t = 0;
        sparks.emit(e.x, e.y, e.z, 30, { colors: ['#ffffff', '#ffd166', '#ff8fc7'], speed: 6, life: 0.7, gravity: 6, spread: 1.4 });
        dust.emit(e.x, e.y - 1, e.z, 14, { color: '#ffffff', speed: 3, life: 0.7, spread: 1 });
        break;
      }
      case 'doorSolid':
        if (isMe) sparks.emit(e.x, e.y + 0.4, e.z - 0.4, 10, { colors: ['#fde047', '#ffffff'], speed: 3, life: 0.4 });
        break;
      case 'ballPop':
        sparks.emit(e.x, e.y, e.z, 30, { colors: ['#ffef8a', '#ffffff', '#ff6b6b'], speed: 7, life: 0.6, gravity: 3, spread: 1 });
        dust.emit(e.x, e.y, e.z, 10, { color: '#ffffff', speed: 3, life: 0.7, spread: 1.2 });
        break;
      case 'finish':
        confetti.burst(e.x, e.y + 1, e.z, isMe ? 120 : 20, isMe ? 9 : 6);
        if (isMe) sparks.emit(e.x, e.y + 1, e.z, 70, { colors: ['#ffd23f', '#ffffff', '#ff5fa2', '#4dd6ff'], speed: 7, life: 1.1, gravity: 5 });
        break;
      case 'raceEnd':
        confetti.burst(state.player.x, state.player.y + 3, state.player.z - 2, 150, 10);
        break;
      default:
    }
  }

  /** Draws the engine state. */
  function update(s, dt) {
    time += dt;
    // Auto quality: drop to pixel ratio 1 when frames are slow for a while
    if (dt > 1 / 38) slowFor += dt;
    else slowFor = Math.max(0, slowFor - dt * 0.5);
    if (!lowPower && slowFor > 3) {
      lowPower = true;
      pixelRatio = 1;
      renderer.setPixelRatio(1);
      resize();
      if (clouds) clouds.count = Math.floor(clouds.count / 2);
      props.children.forEach((o, i) => {
        if (i % 2) o.visible = false;
      });
    }

    // Kinematic pieces
    for (const { c, mesh } of kinematic) {
      mesh.position.set(c.x, c.y, c.z);
      mesh.rotation.set(c.pitch || 0, c.yaw || 0, c.roll || 0, 'YXZ');
    }
    for (const { tex, speed } of conveyorTex) tex.offset.y = (tex.offset.y + speed * dt * 0.5) % 1;
    for (const t of tileMeshes.values()) {
      const st = t.c.tile.state;
      const m = t.mesh;
      if (st === 'shake') {
        m.visible = true;
        m.position.set(t.c.x + Math.sin(time * 60) * 0.05, t.c.y + Math.sin(time * 47) * 0.03, t.c.z);
        m.material = tileMat;
        t.fall = 0;
      } else if (st === 'gone') {
        t.fall = (t.fall || 0) + dt;
        m.position.set(t.c.x, t.c.y - t.fall * t.fall * 9, t.c.z);
        m.rotation.x = t.fall * 1.5;
        m.visible = t.fall < 1.4;
      } else {
        t.pop = Math.max(0, (t.pop || 0) - dt * 3);
        m.visible = true;
        m.position.set(t.c.x, t.c.y, t.c.z);
        m.rotation.set(0, 0, 0);
        const k = 1 - t.pop * 0.6;
        m.scale.set(k, k, k);
      }
    }
    for (const d of doorMeshes.values()) {
      if (d.t < 0) continue;
      d.t += dt;
      d.mesh.rotation.x = -Math.min(Math.PI / 2, d.t * d.t * 9);
      d.mesh.position.y = d.c.y - Math.min(1.5, d.t * 2);
      d.mesh.position.z = d.c.z - Math.min(1.2, d.t * 2);
      if (d.t > 1.2) d.mesh.visible = false;
    }
    for (const p of padMeshes) {
      const q = p.ob?.squish || 0;
      p.mesh.scale.set(1 + q * 0.25, 0.55 * (1 - q * 0.45 + Math.sin(q * 12) * q * 0.2), 1 + q * 0.25);
    }
    for (const { ob, g } of sweepers) g.rotation.y = -ob.angle;
    for (const { ob, arm } of swingers) arm.rotation.z = ob.phi || 0;
    for (const { ob, pool } of ballSets) {
      pool.forEach((m, i) => {
        const b = ob.list[i];
        m.visible = !!b;
        if (b) {
          m.position.set(b.x, b.y, b.z);
          m.rotation.set(b.spin, Math.PI, 0);
        }
      });
    }
    for (const f of flags) {
      f.t += dt;
      f.g.children.forEach((ch, k) => {
        if (ch.geometry === flagGeo) ch.rotation.y = Math.sin(time * 4 + k) * 0.25;
      });
    }
    for (const b of balloons) b.g.position.y = b.y + Math.sin(time * 1.6 + b.k) * 0.15;
    for (const b of bobbers) {
      if (b.pop) b.o.position.y = -0.6 + Math.max(0, Math.sin(time * 1.3 + b.k)) * 1.1;
      else b.o.position.y = b.y + Math.sin(time * 1.2 + b.k) * (b.amp ?? 0.3);
    }
    for (const sp of spinners) sp.o.rotation[sp.axis] += sp.w * dt;

    // Racers
    const order = standings(s);
    const leader = order[0];
    for (const v of racers) {
      const r = v.r;
      const m = v.model;
      let state = 'idle';
      const hs = Math.hypot(r.vx, r.vz);
      if (r.out) state = 'out';
      else if (r.finished && hs < 1) state = 'celebrate';
      else if (r.stun > 0) state = 'stun';
      else if (r.diving || r.recover > 0) state = 'dive';
      else if (!r.grounded) state = 'air';
      else if (hs > 0.5) state = 'run';
      if (r.out) {
        v.hidden += dt;
        // keep falling out of view, then vanish
        m.group.position.y -= dt * 10 * v.hidden;
      } else {
        if (v.hidden > 0) v.pop = 1;
        v.hidden = 0;
        m.group.position.set(r.x, r.y - PHY.R, r.z);
      }
      m.group.visible = v.hidden < 0.6;
      v.pop = Math.max(0, v.pop - dt * 3);
      const ps = 1 - v.pop * 0.7 + Math.sin(v.pop * 9) * v.pop * 0.15;
      m.group.scale.setScalar(ps);
      if (state === 'celebrate') {
        // turn to wave at the camera
        const want = Math.atan2(r.x - camera.position.x, r.z - camera.position.z);
        const d = Math.atan2(Math.sin(want - m.group.rotation.y), Math.cos(want - m.group.rotation.y));
        m.group.rotation.y += d * Math.min(1, dt * 4);
      } else m.group.rotation.y = r.yaw;
      m.update(dt, { state, speed: hs / PHY.speed, vy: r.vy, land: r.land });
      // shield shimmer after a respawn
      if (r.shield > 0 && Math.floor(time * 12) % 2 === 0) m.group.scale.setScalar(ps * 1.04);
      // Running dust for the ones nearby
      if (state === 'run' && Math.abs(r.z - s.player.z) < 20) {
        v.dustT -= dt * (hs / PHY.speed);
        if (v.dustT <= 0) {
          v.dustT = 0.22;
          dust.emit(r.x, r.y - PHY.R + 0.05, r.z, 1, { color: '#ffffff', speed: 0.6, life: 0.4, flat: true, spread: 0.2 });
        }
      }
      // Blob shadow on the floor below
      const floor = r.out ? null : floorBelow(s, r.x, r.z, r.y);
      v.shadow.visible = floor != null && m.group.visible;
      if (floor != null) {
        const h = Math.max(0, r.y - PHY.R - floor);
        v.shadow.position.set(r.x, floor + 0.03, r.z);
        const k = Math.max(0.35, 1 - h * 0.12);
        v.shadow.scale.set(k, 1, k);
        v.shadow.material.opacity = 1;
      }
      // Name tag, badge, stars
      m.headTop.getWorldPosition(tmpV);
      const tagY = tmpV.y + (v.badge ? 0.95 : 0.45) + (r === leader ? 0.3 : 0);
      v.tag.position.set(tmpV.x, tagY, tmpV.z);
      v.camDist = tmpV.distanceTo(camera.position);
      m.setDetail(v.camDist < 22);
      v.tag.visible = m.group.visible && (r.isPlayer || (v.camDist > 6.5 && v.camDist < 18));
      if (v.badge) {
        v.badge.position.set(tmpV.x, tmpV.y + 0.42 + Math.sin(time * 3) * 0.05, tmpV.z);
        v.badge.visible = m.group.visible;
      }
      const dizzy = r.stun > 0 && !r.out;
      v.stars.forEach((sp, k) => {
        sp.visible = dizzy;
        if (dizzy) {
          const a = time * 7 + (k * Math.PI * 2) / 3;
          sp.position.set(tmpV.x + Math.cos(a) * 0.45, tmpV.y + 0.05 + Math.sin(a * 2) * 0.05, tmpV.z + Math.sin(a) * 0.45);
        }
      });
      if (v.ring) {
        v.ring.visible = m.group.visible && floor != null;
        if (floor != null) v.ring.position.set(r.x, floor + 0.04, r.z);
        v.ring.rotation.y = time * 2;
        ringMat.opacity = 0.6 + Math.sin(time * 5) * 0.25;
      }
      if (r === leader) {
        crown.visible = m.group.visible;
        crown.position.set(tmpV.x, tmpV.y + 0.22 + (v.badge ? 0.82 : 0), tmpV.z);
        crown.rotation.y = time * 1.5;
      }
    }

    // Only the few nearest name tags, so a crowd stays readable
    let shown = 0;
    for (const v of [...racers].sort((a, b) => a.camDist - b.camDist)) {
      if (v.r.isPlayer || !v.tag.visible) continue;
      shown += 1;
      if (shown > 3) v.tag.visible = false;
    }
    sparks.update(dt);
    dust.update(dt);
    confetti.update(dt);

    // Camera: behind the child along the path heading, smooth, no shake
    const p = s.player;
    if (p.grounded && !p.out) cam.ground = p.y;
    if (!p.out) cam.anchor.set(p.x, Math.max(p.y, (cam.ground ?? p.y) - 2.5), p.z);
    // After the finish the camera swings round to see the happy face
    cam.turn += ((p.finished && !p.out ? Math.PI * 0.85 : 0) - cam.turn) * (1 - Math.exp(-dt * 0.9));
    const back = portrait ? 7.4 : 6.6;
    const up = portrait ? 4.1 : 3.5;
    const yaw = s.camYaw + cam.turn;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    tmpV.set(cam.anchor.x - fx * back, cam.anchor.y + up, cam.anchor.z - fz * back);
    tmpV2.set(cam.anchor.x + fx * 4, cam.anchor.y + 0.6, cam.anchor.z + fz * 4);
    if (!cam.ready) {
      cam.pos.copy(tmpV);
      cam.look.copy(tmpV2);
      cam.ready = true;
    } else {
      const kp = 1 - Math.exp(-dt * 5);
      const ky = 1 - Math.exp(-dt * 3);
      cam.pos.x += (tmpV.x - cam.pos.x) * kp;
      cam.pos.z += (tmpV.z - cam.pos.z) * kp;
      cam.pos.y += (tmpV.y - cam.pos.y) * ky;
      cam.look.lerp(tmpV2, 1 - Math.exp(-dt * 6));
    }
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    if (Math.abs(camera.fov - baseFov) > 0.01) {
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
    }
    skyDome.position.set(cam.pos.x, 0, cam.pos.z);
    sun.position.set(cam.anchor.x - 30, cam.anchor.y + 60, cam.anchor.z + 20);
    sun.target.position.copy(cam.anchor);
    renderer.render(scene, camera);
  }

  function dispose() {
    for (const v of racers) v.model.dispose();
    if (ro) ro.disconnect();
    else window.removeEventListener('resize', resize);
    scene.traverse((o) => {
      if (o.geometry) disposables.add(o.geometry);
      const mt = o.material;
      if (Array.isArray(mt)) mt.forEach((x) => disposables.add(x));
      else if (mt) disposables.add(mt);
    });
    for (const d of disposables) {
      if (d.map) d.map.dispose?.();
      d.dispose?.();
    }
    disposables.clear();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
  }

  return {
    update,
    fx,
    resize,
    dispose,
    get lowPower() {
      return lowPower;
    },
    renderer,
  };
}
