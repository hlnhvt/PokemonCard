// Three.js world for "Snorlax nuốt cả thành phố": a toy town drawn from the gulp3d engine state.
// Look: ACES tone mapping, hemisphere + one soft shadow-casting sun that follows Snorlax, toon
// characters with outlines, bevelled vertex-coloured town (one InstancedMesh + outline per kind),
// swaying trees, painted ground (roads, sidewalks, gardens, beach), grass tufts, rocks and clouds.
// Adaptive quality: on slow devices shadows, outlines and small decorations switch off.
import * as THREE from 'three';
import { KINDS, MAPS, EAT_K } from '../../../utils/three3d/gulp3d';
import { createSnorlax } from './snorlaxModel';
import { kindGeometry, kindHeight, VARIANTS, powerupGeometry, createChibi, decorGeometry } from './gulp3dModels';
import { lookTime, toonRamp, townMaterial, outlineMaterial, outlineOf } from './gulp3dLook';

const TAU = Math.PI * 2;
const SPARE_BERRIES = 70; // room in the berry InstancedMesh for berries dropped by Pokemon
const MARGIN = 16; // ground texture margin around the town (m)
const TINY = new Set(['berry', 'apple', 'pokeball', 'flower', 'coconut', 'shell']); // many instances: no outline, blob shadow only
const CASTS = new Set(['tree', 'palm', 'house', 'hut', 'mart', 'center', 'tower', 'lighthouse', 'car', 'bus', 'boat', 'fountain', 'umbrella', 'sandcastle']); // real sun shadow

const THEMES = [
  { sky: ['#4aa8f0', '#bfe6ff', '#fff4e0'], fog: '#cfeafc', grass: '#86d16f', grass2: '#74c35f', grass3: '#9ade7f', road: '#9097a6', walk: '#efe4cc', curb: '#d6c9ab', edge: '#69b357', sun: '#fff1d6', hemi: ['#e4f4ff', '#7fb36a'] },
  { sky: ['#4f9fe6', '#cfe6ff', '#fff0f3'], fog: '#d8e9fb', grass: '#8ccf78', grass2: '#7bc267', grass3: '#a2dc8d', road: '#878ea0', walk: '#e7e0d2', curb: '#cfc5b3', edge: '#67ad5c', sun: '#fff4e6', hemi: ['#e8f0ff', '#83b071'] },
  { sky: ['#2fa6ea', '#bff0ff', '#fff6dc'], fog: '#c4ecfb', grass: '#93d66c', grass2: '#82cb5d', grass3: '#a8e283', road: '#f3d9a0', walk: '#f3d9a0', curb: '#e9c98a', edge: '#f1d38f', sun: '#fff1d0', sand: '#f6dfa4', sand2: '#ecca86', sea: '#2fb3e6', shallow: '#7fdcf2', hemi: ['#e6f8ff', '#9cc27a'] },
];

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const radial = (inner, outer) =>
  canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

function textTexture(text, color = '#ffffff', stroke = '#1e3a8a') {
  return canvasTexture(128, 128, (ctx) => {
    ctx.font = 'bold 96px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, 64, 68);
    ctx.fillStyle = color;
    ctx.fillText(text, 64, 68);
  });
}

/** Ground: mottled grass, roads with curbs and markings, tiled sidewalks, gardens, plazas; the island adds beach and shallows. */
function groundTexture(map, city, theme) {
  const N = 2048;
  const half = map.half + MARGIN; // texture covers a margin around the town
  return canvasTexture(N, N, (ctx) => {
    const k = N / (2 * half);
    const X = (x) => (x + half) * k;
    let rnd = 7;
    const r = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
    const blob = (x, y, rad, color) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    };
    const cx = X(0);
    if (map.island) {
      ctx.fillStyle = theme.sea;
      ctx.fillRect(0, 0, N, N);
      const sh = ctx.createRadialGradient(cx, cx, (map.half - 1) * k, cx, cx, (map.half + 12) * k);
      sh.addColorStop(0, theme.shallow);
      sh.addColorStop(1, theme.sea);
      ctx.fillStyle = sh;
      ctx.beginPath();
      ctx.arc(cx, cx, (map.half + 12) * k, 0, TAU);
      ctx.fill();
      // wet sand, dry sand with speckles
      ctx.fillStyle = theme.sand2;
      ctx.beginPath();
      ctx.arc(cx, cx, (map.half + 1.6) * k, 0, TAU);
      ctx.fill();
      ctx.fillStyle = theme.sand;
      ctx.beginPath();
      ctx.arc(cx, cx, (map.half + 0.4) * k, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 5000; i++) {
        const a = r() * TAU;
        const rr = (map.half - 9 + r() * 10) * k;
        ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(190,140,70,0.25)';
        ctx.fillRect(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr, 2, 2);
      }
      ctx.fillStyle = theme.grass;
      ctx.beginPath();
      ctx.arc(cx, cx, (map.half - 9) * k, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = theme.edge;
      ctx.fillRect(0, 0, N, N);
      ctx.fillStyle = theme.grass;
      ctx.fillRect(X(-map.half), X(-map.half), 2 * map.half * k, 2 * map.half * k);
    }
    // grass: soft light/dark patches, then tiny blades
    ctx.save();
    if (map.island) {
      ctx.beginPath();
      ctx.arc(cx, cx, (map.half - 9) * k, 0, TAU);
      ctx.clip();
    }
    for (let i = 0; i < 260; i++) blob(r() * N, r() * N, (6 + r() * 16) * k, r() < 0.5 ? `${theme.grass3}88` : `${theme.grass2}99`);
    for (let i = 0; i < 16000; i++) {
      ctx.fillStyle = r() < 0.6 ? theme.grass2 : 'rgba(255,255,255,0.1)';
      ctx.fillRect(r() * N, r() * N, 1.5, 2 + r() * 3);
    }
    ctx.restore();
    const inIsland = (x, z) => !map.island || Math.hypot(x, z) < map.half - 2;
    // roads
    const lim = map.half - 1.5;
    const band = (rv, axis, w, color) => {
      ctx.fillStyle = color;
      if (axis) ctx.fillRect(X(-lim), X(rv - w / 2), 2 * lim * k, w * k);
      else ctx.fillRect(X(rv - w / 2), X(-lim), w * k, 2 * lim * k);
    };
    for (const pass of ['walk', 'tiles', 'curb', 'road', 'marks']) {
      for (const rv of city.roads) {
        for (const axis of [0, 1]) {
          ctx.save();
          if (map.island) {
            ctx.beginPath();
            ctx.arc(X(0), X(0), (map.half - 3) * k, 0, TAU);
            ctx.clip();
          }
          if (pass === 'walk') band(rv, axis, 7.4, theme.walk);
          else if (pass === 'tiles' && !map.island) {
            ctx.fillStyle = 'rgba(120,100,70,0.13)';
            for (let u = -lim; u < lim; u += 1.2) {
              if (axis) ctx.fillRect(X(u), X(rv - 3.7), 1.5, 7.4 * k);
              else ctx.fillRect(X(rv - 3.7), X(u), 7.4 * k, 1.5);
            }
            for (const o of [-3.1, -2.95, 2.95, 3.1]) band(rv + o, axis, 0.04, 'rgba(120,100,70,0.13)');
          } else if (pass === 'curb' && !map.island) band(rv, axis, 5.8, theme.curb);
          else if (pass === 'road') {
            band(rv, axis, 5.2, theme.road);
            if (!map.island) {
              ctx.fillStyle = 'rgba(255,255,255,0.05)';
              for (let i = 0; i < 260; i++) {
                const u = -lim + r() * 2 * lim;
                const v = rv - 2.5 + r() * 5;
                if (axis) ctx.fillRect(X(u), X(v), 3, 2);
                else ctx.fillRect(X(v), X(u), 2, 3);
              }
            }
          } else if (pass === 'marks' && !map.island) {
            band(rv - 2.3, axis, 0.12, 'rgba(255,255,255,0.7)');
            band(rv + 2.3, axis, 0.12, 'rgba(255,255,255,0.7)');
            ctx.fillStyle = '#ffe58a';
            for (let u = -lim; u < lim; u += 3) {
              if (city.roads.some((q) => Math.abs(q - u) < 3.4)) continue;
              if (axis) ctx.fillRect(X(u), X(rv - 0.12), 1.5 * k, 0.24 * k);
              else ctx.fillRect(X(rv - 0.12), X(u), 0.24 * k, 1.5 * k);
            }
          }
          ctx.restore();
        }
      }
    }
    // crossroads: clean asphalt square, zebra crossings
    if (!map.island) {
      for (const a of city.roads)
        for (const b of city.roads) {
          ctx.fillStyle = theme.road;
          ctx.fillRect(X(a - 2.6), X(b - 2.6), 5.2 * k, 5.2 * k);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          for (let i = -2; i <= 2; i++) {
            ctx.fillRect(X(a + i * 0.9 - 0.3), X(b + 3.0), 0.6 * k, 1.4 * k);
            ctx.fillRect(X(a + i * 0.9 - 0.3), X(b - 4.4), 0.6 * k, 1.4 * k);
            ctx.fillRect(X(b + 3.0), X(a + i * 0.9 - 0.3), 1.4 * k, 0.6 * k);
            ctx.fillRect(X(b - 4.4), X(a + i * 0.9 - 0.3), 1.4 * k, 0.6 * k);
          }
        }
    }
    // plazas under fountains and landmarks, gardens with stepping stones under houses
    for (const o of city.objects) {
      if (!inIsland(o.x, o.z)) continue;
      if (o.kind === 'fountain' || o.kind === 'tower' || o.kind === 'lighthouse' || o.kind === 'mart' || o.kind === 'center') {
        const R0 = KINDS[o.kind].r + 2.2;
        ctx.fillStyle = map.island ? '#f7e3b0' : '#efe5cf';
        ctx.beginPath();
        ctx.arc(X(o.x), X(o.z), R0 * k, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = map.island ? 'rgba(180,130,60,0.25)' : 'rgba(150,120,80,0.22)';
        ctx.lineWidth = 2;
        for (let q = 1; q < 5; q++) {
          ctx.beginPath();
          ctx.arc(X(o.x), X(o.z), (R0 - q * 0.9) * k, 0, TAU);
          ctx.stroke();
        }
        for (let q = 0; q < 24; q++) {
          const a = (q / 24) * TAU;
          ctx.beginPath();
          ctx.moveTo(X(o.x + Math.cos(a) * (R0 - 3.6)), X(o.z + Math.sin(a) * (R0 - 3.6)));
          ctx.lineTo(X(o.x + Math.cos(a) * R0), X(o.z + Math.sin(a) * R0));
          ctx.stroke();
        }
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(X(o.x), X(o.z), R0 * k, 0, TAU);
        ctx.stroke();
      } else if (o.kind === 'house' || o.kind === 'hut') {
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.beginPath();
        ctx.roundRect?.(X(o.x - 3.4), X(o.z - 3.2), 6.8 * k, 6.4 * k, 1.2 * k);
        ctx.fill();
        const fx = Math.sin(o.rot);
        const fz = Math.cos(o.rot);
        ctx.fillStyle = map.island ? '#e9cf98' : '#e3dccb';
        for (let s = 0; s < 3; s++) {
          const d = 2.5 + s * 0.85;
          ctx.beginPath();
          ctx.ellipse(X(o.x + fx * d), X(o.z + fz * d), 0.38 * k, 0.3 * k, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
  });
}

/** Particle pool drawn as soft points. */
function particlePool(count, size, texture, { additive = false } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3).fill(-999);
  const col = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, map: texture, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true, alphaTest: additive ? 0 : 0.02 });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const list = Array.from({ length: count }, () => ({ life: 0, max: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, g: 0, c: new THREE.Color() }));
  let cursor = 0;
  return {
    points,
    emit(x, y, z, n, { colors = ['#ffffff'], speed = 4, life = 0.7, gravity = -9, spread = 0.3, up = 2 } = {}) {
      for (let i = 0; i < n; i++) {
        const p = list[cursor];
        cursor = (cursor + 1) % count;
        const a = Math.random() * TAU;
        const v = speed * (0.4 + Math.random() * 0.8);
        p.x = x + (Math.random() - 0.5) * spread;
        p.y = y + Math.random() * spread * 0.5;
        p.z = z + (Math.random() - 0.5) * spread;
        p.vx = Math.cos(a) * v;
        p.vz = Math.sin(a) * v;
        p.vy = up * (0.6 + Math.random() * 0.8);
        p.g = gravity;
        p.max = p.life = life * (0.6 + Math.random() * 0.6);
        p.c.set(colors[i % colors.length]);
      }
    },
    update(dt) {
      for (let i = 0; i < count; i++) {
        const p = list[i];
        if (p.life > 0) {
          p.life -= dt;
          p.vy += p.g * dt;
          p.x += p.vx * dt;
          p.y = Math.max(0.03, p.y + p.vy * dt);
          p.z += p.vz * dt;
          if (p.y <= 0.03) {
            p.vx *= 0.8;
            p.vz *= 0.8;
          }
        }
        const f = p.life > 0 ? Math.min(1, (p.life / p.max) * 2) : 0;
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.life > 0 ? p.y : -999;
        pos[i * 3 + 2] = p.z;
        col[i * 3] = p.c.r * (additive ? f : 1);
        col[i * 3 + 1] = p.c.g * (additive ? f : 1);
        col[i * 3 + 2] = p.c.b * (additive ? f : 1);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

/**
 * createGulp3DScene(container, { state }) → { update(state, dt), fx(event, state), project(x, y, z), resize(), dispose() }.
 * Throws when WebGL is unavailable.
 */
export function createGulp3DScene(container, { state }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const map = state.map;
  const mapIndex = Math.max(0, MAPS.indexOf(map));
  const theme = THEMES[mapIndex] || THEMES[0];
  const textures = [];
  const disposables = new Set();
  const D = (x) => (disposables.add(x), x);
  const T = (t) => (textures.push(t), t);
  const outlines = []; // hidden on slow devices
  const decor = []; // small decorations, hidden on slow devices

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(theme.fog, 60, 170);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 600);

  // ---- Sky dome (three-stop vertical gradient) and a few puffy clouds
  const skyGeo = D(new THREE.SphereGeometry(400, 24, 12));
  {
    const top = new THREE.Color(theme.sky[0]);
    const mid = new THREE.Color(theme.sky[1]);
    const low = new THREE.Color(theme.sky[2]);
    const p = skyGeo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, Math.min(1, p.getY(i) / 400 + 0.1));
      if (t < 0.25) c.copy(low).lerp(mid, t / 0.25);
      else c.copy(mid).lerp(top, Math.pow((t - 0.25) / 0.75, 0.7));
      col.set([c.r, c.g, c.b], i * 3);
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const sky = new THREE.Mesh(skyGeo, D(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  sky.renderOrder = -10;
  scene.add(sky);
  const cloudGeo = D(decorGeometry('cloud'));
  const clouds = new THREE.InstancedMesh(cloudGeo, D(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.35, fog: false })), 14);
  clouds.frustumCulled = false;
  const cloudData = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + i * 0.7;
    const rr = map.half + 30 + (i % 4) * 22;
    cloudData.push({ x: Math.cos(a) * rr, z: Math.sin(a) * rr, y: 38 + (i % 5) * 7, s: 1.6 + (i % 3) * 0.7, v: 0.6 + (i % 3) * 0.3 });
  }
  scene.add(clouds);

  // ---- Lights: soft day, one shadow-casting sun that follows Snorlax
  scene.add(new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], 1.35));
  const sun = new THREE.DirectionalLight(theme.sun, 2.1);
  sun.position.set(30, 60, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  const SUN_DIR = new THREE.Vector3(30, 60, 25).normalize();
  let shadowHalf = 0;
  scene.add(sun);
  scene.add(sun.target);

  // ---- Ground
  const groundTex = T(groundTexture(map, state.city, theme));
  groundTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
  const gSize = 2 * (map.half + MARGIN);
  const ground = new THREE.Mesh(D(new THREE.PlaneGeometry(gSize, gSize)), D(new THREE.MeshLambertMaterial({ map: groundTex })));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // Far surroundings: green hills or open sea with a foamy shore
  let seaTex = null;
  let foam = null;
  if (map.island) {
    seaTex = T(
      canvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = theme.sea;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 30; i++) {
          ctx.fillStyle = `rgba(255,255,255,${0.1 + (i % 4) * 0.05})`;
          const x = (i * 37) % w;
          const y = (i * 53) % h;
          ctx.beginPath();
          ctx.ellipse(x, y, 6 + (i % 5) * 3, 1.5, 0, 0, TAU);
          ctx.fill();
        }
      })
    );
    seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping;
    seaTex.repeat.set(60, 60);
    const sea = new THREE.Mesh(D(new THREE.PlaneGeometry(1200, 1200)), D(new THREE.MeshLambertMaterial({ map: seaTex })));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.08;
    scene.add(sea);
    const foamTex = T(
      canvasTexture(256, 16, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.45, 'rgba(255,255,255,0.95)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 40; i++) ctx.fillRect((i * 29) % w, 0, 3 + (i % 3) * 3, h);
      })
    );
    foamTex.wrapS = THREE.RepeatWrapping;
    foamTex.repeat.set(10, 1);
    foam = new THREE.Mesh(D(new THREE.RingGeometry(map.half + 1.0, map.half + 2.6, 96, 1)), D(new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.85 })));
    // ring UVs run radially: rotate the texture so the foam band follows the shore
    {
      const g = foam.geometry;
      const p = g.attributes.position;
      const uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getY(i), p.getX(i));
        const rr = Math.hypot(p.getX(i), p.getY(i));
        uv.setXY(i, (a / TAU + 0.5) * 6, (rr - map.half - 1.0) / 1.6);
      }
    }
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = 0.03;
    foam.renderOrder = 1;
    scene.add(foam);
  } else {
    const far = new THREE.Mesh(D(new THREE.PlaneGeometry(1200, 1200)), D(new THREE.MeshLambertMaterial({ color: theme.edge })));
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.05;
    scene.add(far);
  }

  // ---- City: one InstancedMesh (+ outline sharing its matrices) per (kind, variant)
  const cityMat = D(townMaterial());
  const lineMat = D(outlineMaterial({ vertexColors: true, darken: 0.4, sway: true, width: 0.0026, max: 0.07 }));
  const buckets = new Map(); // key -> { mesh, height, n }
  const slots = []; // object id -> { b, i }
  const keyOf = (kind, variant) => {
    const nv = VARIANTS[kind] || 1;
    const v = kind === 'tower' ? mapIndex % 2 : variant % nv;
    return `${kind}:${v}`;
  };
  {
    const counts = new Map();
    for (const o of state.objects) counts.set(keyOf(o.kind, o.variant), (counts.get(keyOf(o.kind, o.variant)) || 0) + 1);
    if (!counts.has('berry:0')) counts.set('berry:0', 0);
    counts.set('berry:0', counts.get('berry:0') + SPARE_BERRIES);
    for (const [key, n] of counts) {
      const [kind, v] = key.split(':');
      const geo = D(kindGeometry(kind, Number(v), mapIndex));
      const mesh = new THREE.InstancedMesh(geo, cityMat, n);
      mesh.name = key;
      mesh.count = 0; // grows as slots are handed out
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = CASTS.has(kind);
      mesh.receiveShadow = true;
      scene.add(mesh);
      let line = null;
      if (!TINY.has(kind) && kind !== 'lamp') {
        line = outlineOf(mesh, lineMat);
        scene.add(line);
        outlines.push(line);
      }
      buckets.set(key, { mesh, line, height: kindHeight(geo), n: 0, cap: n });
    }
  }
  // Blob shadows for everything (one InstancedMesh): contact shade under the real sun shadow
  const shadowTex = T(radial('rgba(20,40,30,0.42)', 'rgba(20,40,30,0)'));
  const shadowCap = state.objects.length + SPARE_BERRIES + 4;
  const blobMatCity = D(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.6 }));
  const shadowMesh = new THREE.InstancedMesh(D(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), blobMatCity, shadowCap);
  shadowMesh.frustumCulled = false;
  shadowMesh.renderOrder = 1;
  scene.add(shadowMesh);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const vp = new THREE.Vector3();
  const vs = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  // Float64: engine positions are doubles (Float32 would make every object look "moved" and spin)
  const lastX = new Float64Array(shadowCap);
  const lastZ = new Float64Array(shadowCap);
  const setObj = (o, sx = 1, sy = 1, y = 0, extraRot = 0) => {
    const sl = slots[o.id];
    if (!sl) return;
    q.setFromAxisAngle(up, o.rot + extraRot);
    vp.set(o.x, y, o.z);
    vs.set(sx, sy, sx);
    m4.compose(vp, q, vs);
    sl.b.mesh.setMatrixAt(sl.i, m4);
    sl.b.mesh.instanceMatrix.needsUpdate = true;
  };
  const setShadow = (o, k = 1) => {
    const r = KINDS[o.kind].r * 2.3 * k;
    q.identity();
    vp.set(o.x, 0.02 + (o.id % 7) * 0.002, o.z);
    vs.set(r, 1, r);
    m4.compose(vp, q, vs);
    shadowMesh.setMatrixAt(o.id, m4);
    shadowMesh.instanceMatrix.needsUpdate = true;
  };
  const hideObj = (o) => {
    const sl = slots[o.id];
    if (sl) {
      sl.b.mesh.setMatrixAt(sl.i, zero);
      sl.b.mesh.instanceMatrix.needsUpdate = true;
    }
    shadowMesh.setMatrixAt(o.id, zero);
    shadowMesh.instanceMatrix.needsUpdate = true;
  };
  const addSlot = (o) => {
    const b = buckets.get(keyOf(o.kind, o.variant));
    if (!b || b.n >= b.cap || o.id >= shadowCap) return false;
    slots[o.id] = { b, i: b.n++ };
    b.mesh.count = b.n; // only draw the slots in use (spare berries cost nothing until dropped)
    if (b.line) b.line.count = b.n;
    lastX[o.id] = o.x;
    lastZ[o.id] = o.z;
    return true;
  };
  for (let i = 0; i < shadowCap; i++) shadowMesh.setMatrixAt(i, zero);
  for (const b of buckets.values()) for (let i = 0; i < b.cap; i++) b.mesh.setMatrixAt(i, zero);
  for (const o of state.objects) {
    if (!addSlot(o)) continue;
    if (o.alive) {
      setObj(o);
      setShadow(o);
    }
  }
  const knownObjects = { n: state.objects.length };

  // ---- Scenery (not edible): grass tufts, flower patches, rocks; tree ring and hills or sea rocks
  let rs = 99;
  const rr = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  {
    const roadNear = (x, z, pad) => state.city.roads.some((v) => Math.abs(v - x) < pad || Math.abs(v - z) < pad);
    const objNear = (x, z) => state.objects.some((o) => Math.abs(o.x - x) < KINDS[o.kind].r + 0.6 && Math.abs(o.z - z) < KINDS[o.kind].r + 0.6);
    const scatter = (type, n, pad, sc) => {
      const mesh = new THREE.InstancedMesh(D(decorGeometry(type)), cityMat, n);
      let c = 0;
      for (let i = 0; i < n * 6 && c < n; i++) {
        const x = (rr() - 0.5) * 2 * (map.half - 2);
        const z = (rr() - 0.5) * 2 * (map.half - 2);
        if (map.island ? Math.hypot(x, z) > map.half - 10 : false) continue;
        if (roadNear(x, z, pad) || objNear(x, z)) continue;
        q.setFromAxisAngle(up, rr() * TAU);
        const s = sc * (0.7 + rr() * 0.6);
        m4.compose(vp.set(x, 0, z), q, vs.set(s, s, s));
        mesh.setMatrixAt(c++, m4);
      }
      mesh.count = c;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    decor.push(scatter('tuft', 520, 4.2, 1), scatter('flowers', 70, 4.4, 1));
    const rocks = scatter('rock', 26, 4.4, 0.9);
    rocks.castShadow = true;
  }
  if (!map.island) {
    // Outer ring of decorative pines so the town does not end in nothing, hills behind
    const ring = [new THREE.InstancedMesh(D(kindGeometry('tree', 1, mapIndex)), cityMat, 200)];
    const nRing = [0];
    for (let i = 0; i < 200; i++) {
      const side = i % 4;
      const u = (rr() - 0.5) * 2 * (map.half + 14);
      const w = map.half + 3 + rr() * 14;
      const x = side === 0 ? u : side === 1 ? u : side === 2 ? w : -w;
      const z = side === 0 ? w : side === 1 ? -w : u;
      q.setFromAxisAngle(up, rr() * TAU);
      const sc = 1.5 + rr() * 1.5;
      m4.compose(vp.set(x, 0, z), q, vs.set(sc, sc, sc));
      ring[0].setMatrixAt(nRing[0]++, m4);
    }
    ring.forEach((m, k) => {
      m.count = nRing[k];
      scene.add(m);
    });
    const hills = new THREE.InstancedMesh(D(decorGeometry('hill')), cityMat, 16);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.3;
      const d = map.half + 40 + (i % 3) * 14;
      const s = 18 + (i % 4) * 7;
      m4.compose(vp.set(Math.cos(a) * d, -1, Math.sin(a) * d), q.identity(), vs.set(s, s * (0.7 + (i % 3) * 0.25), s));
      hills.setMatrixAt(i, m4);
    }
    scene.add(hills);
  } else {
    // a few rocks in the shallow water
    const rock = new THREE.InstancedMesh(D(decorGeometry('rock')), cityMat, 24);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU + 0.2;
      const d = map.half + 6 + (i % 3) * 5;
      q.setFromAxisAngle(up, i);
      const sc = 1.2 + (i % 4) * 0.7;
      m4.compose(vp.set(Math.cos(a) * d, -0.25, Math.sin(a) * d), q, vs.set(sc, sc * 0.8, sc));
      rock.setMatrixAt(i, m4);
    }
    scene.add(rock);
  }

  // ---- Snorlax, rival Munchlax
  const snorlax = createSnorlax({ variant: 'snorlax' });
  scene.add(snorlax.group);
  // Blob shadows of the characters: one InstancedMesh (0 Snorlax, 1 Munchlax, 2.. chibis)
  const blobTex = T(radial('rgba(10,30,30,0.5)', 'rgba(10,30,30,0)'));
  const blobMat = D(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.55 }));
  const charShadow = new THREE.InstancedMesh(D(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), blobMat, 2 + state.pokemon.length);
  charShadow.frustumCulled = false;
  charShadow.renderOrder = 2;
  for (let i = 0; i < charShadow.count; i++) charShadow.setMatrixAt(i, zero);
  scene.add(charShadow);
  const putShadow = (i, x, z, sx, sz) => {
    m4.compose(vp.set(x, 0.04 - i * 0.001, z), q.identity(), vs.set(sx, 1, sz));
    charShadow.setMatrixAt(i, m4);
    charShadow.instanceMatrix.needsUpdate = true;
  };
  let munch = null;
  if (state.rival) {
    munch = createSnorlax({ variant: 'munchlax' });
    scene.add(munch.group);
  }
  for (const m of [snorlax, munch]) if (m) outlines.push(...m.parts.outlines);

  // ---- Friendly Pokemon (3D chibis)
  const chibiCache = { geos: {}, mats: {}, ramp: T(toonRamp([130, 200, 240, 255])) };
  const chibis = state.pokemon.map((p) => {
    const c = createChibi(p.species, chibiCache);
    c.group.scale.setScalar(1.1);
    scene.add(c.group);
    c.group.traverse((o) => o.userData.outline && outlines.push(o));
    return { ...c, alert: 0 };
  });
  const alertTex = T(textTexture('!', '#fde047', '#b45309'));
  const alertMat = D(new THREE.SpriteMaterial({ map: alertTex, transparent: true, depthWrite: false }));
  chibis.forEach((c) => {
    const s = new THREE.Sprite(alertMat);
    s.scale.set(0.5, 0.5, 1);
    s.position.y = 1.25;
    s.visible = false;
    c.group.add(s);
    c.bang = s;
  });

  // ---- Powerups
  const powerGeos = { gold: D(powerupGeometry('gold')), speed: D(powerupGeometry('speed')), magnet: D(powerupGeometry('magnet')) };
  const powerMat = D(townMaterial({ emissive: '#ffffff', emissiveIntensity: 0.18 }));
  const glowTex = T(radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
  const glowColors = { gold: '#fde047', speed: '#f87171', magnet: '#93c5fd' };
  const powerViews = new Map();
  const ringGeo = D(new THREE.RingGeometry(0.75, 0.95, 28).rotateX(-Math.PI / 2));

  // ---- Particles
  const crumbs = particlePool(260, 0.34, T(radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)')), {});
  const dust = particlePool(90, 1.1, T(radial('rgba(255,250,240,0.9)', 'rgba(255,250,240,0)')), {});
  const sparks = particlePool(160, 0.55, glowTex, { additive: true });
  scene.add(crumbs.points, dust.points, sparks.points);

  // ---- Zzz when asleep, hearts on a sniff
  const zTex = T(textTexture('Z', '#ffffff', '#3b82f6'));
  const heartTex = T(textTexture('♥', '#fb7185', '#ffffff'));
  const floaters = [];
  const floatMat = (tex) => D(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const zMat = floatMat(zTex);
  const heartMat = floatMat(heartTex);
  const addFloater = (mat, x, y, z, size, life = 1.6, vx = 0.4) => {
    const sp = new THREE.Sprite(mat.clone());
    disposables.add(sp.material);
    sp.position.set(x, y, z);
    sp.scale.set(size, size, 1);
    scene.add(sp);
    floaters.push({ sp, t: 0, life, vx, size });
  };

  // ---- Swallow animations (instances flying into the mouth)
  const swallows = [];
  const mouthPos = new THREE.Vector3();
  const v1 = new THREE.Vector3();

  // ---- Camera follow
  const cam = { x: state.x, z: state.z, R: state.R, ready: false };
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();

  const resize = () => {
    const w = container.clientWidth || window.innerWidth || 360;
    const h = container.clientHeight || window.innerHeight || 640;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 55 : 45;
    camera.updateProjectionMatrix();
  };
  resize();
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(resize);
    ro.observe(container);
  } else window.addEventListener('resize', resize);

  let slowT = 0;
  let lowPower = false;
  let t = 0;
  let dustAcc = 0;
  let lastSX = state.x;
  let lastSZ = state.z;
  let zAcc = 0;

  /** Slow device: drop the sun shadow, outlines and small decorations; blob shadows take over. */
  function goLowPower() {
    lowPower = true;
    pixelRatio = 1;
    renderer.setPixelRatio(1);
    resize();
    dust.points.visible = false;
    sun.castShadow = false;
    renderer.shadowMap.enabled = false;
    for (const o of outlines) o.visible = false;
    for (const d of decor) d.visible = false;
    blobMatCity.opacity = 1;
    blobMat.opacity = 1;
  }

  function syncBody(model, shadowIndex, b, dt, opts) {
    const k = b.R; // model radius 1 → engine R
    model.group.position.set(b.x, 0, b.z);
    model.group.scale.setScalar(k);
    // Standing still for a moment: turn round to smile at the camera
    model.idleT = b.moving > 0.12 ? 0 : (model.idleT || 0) + dt;
    const want = model.idleT > 0.7 || opts.sleeping ? 0 : b.heading;
    let d = want - model.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    model.group.rotation.y += d * Math.min(1, dt * (model.idleT > 0.7 ? 4 : 12));
    model.update(dt, opts);
    putShadow(shadowIndex, b.x, b.z, k * 2.9, k * 2.6);
  }

  function update(s, dt) {
    dt = Math.min(dt, 0.1);
    t += dt;
    lookTime.value = t;
    const sleeping = s.status === 'done';
    // New objects (berries dropped by Pokemon)
    while (knownObjects.n < s.objects.length) {
      const o = s.objects[knownObjects.n++];
      if (addSlot(o)) {
        o.popT = 0.35;
        setShadow(o);
      }
    }
    // Snorlax
    syncBody(snorlax, 0, s, dt, { moving: s.moving, sleeping });
    const moved = Math.hypot(s.x - lastSX, s.z - lastSZ);
    lastSX = s.x;
    lastSZ = s.z;
    dustAcc += moved;
    if (dustAcc > 1.1 + s.R * 0.6 && !sleeping) {
      dustAcc = 0;
      const back = s.R * 0.6;
      dust.emit(s.x - Math.sin(s.heading) * back, 0.1, s.z - Math.cos(s.heading) * back, 2, { colors: ['#f5efe0', '#e9e1cc'], speed: 0.8 + s.R * 0.4, life: 0.8, gravity: 0.6, spread: s.R * 0.6, up: 0.6 });
    }
    if (s.powers.speed > 0 && Math.random() < 0.5) sparks.emit(s.x, 0.3, s.z, 1, { colors: ['#fca5a5', '#fde047'], speed: 1, life: 0.5, gravity: 1, spread: s.R, up: 1 });
    if (s.powers.gold > 0 && Math.random() < 0.35) sparks.emit(s.x, s.R * 2.2, s.z, 1, { colors: ['#fde047', '#fff7c2'], speed: 1.5, life: 0.7, gravity: -1, spread: s.R * 1.6, up: 1 });
    if (sleeping) {
      zAcc += dt;
      if (zAcc > 0.7) {
        zAcc = 0;
        addFloater(zMat, s.x + s.R * 0.3, s.R * 2.5, s.z + s.R * 0.3, s.R * 0.5, 2.2, s.R * 0.25);
      }
    }
    if (munch && s.rival) syncBody(munch, 1, s.rival, dt, { moving: s.rival.moving, sleeping });

    // Objects: magnet pulls, jiggles, new berries popping in
    for (let i = 0; i < s.objects.length; i++) {
      const o = s.objects[i];
      if (!o.alive || o.swallowing) continue;
      const moving = o.x !== lastX[o.id] || o.z !== lastZ[o.id];
      if (moving || o.jig > 0 || o.popT > 0 || o.wasJig) {
        lastX[o.id] = o.x;
        lastZ[o.id] = o.z;
        let sx = 1;
        let sy = 1;
        if (o.jig > 0) {
          const w = Math.sin(o.jig * 40) * o.jig * 0.25;
          sx = 1 - w * 0.5;
          sy = 1 + w;
          o.wasJig = true;
        } else o.wasJig = false;
        let y = 0;
        if (o.popT > 0) {
          o.popT = Math.max(0, o.popT - dt);
          const f = 1 - o.popT / 0.35;
          sx = sy = 0.3 + 0.7 * f;
          y = Math.sin(Math.PI * f) * 0.8;
        }
        setObj(o, sx, sy, y, moving ? t * 6 : 0);
        setShadow(o);
      }
    }
    // Swallows: arc into the mouth while shrinking
    snorlax.mouth.getWorldPosition(mouthPos);
    for (let i = swallows.length - 1; i >= 0; i--) {
      const w = swallows[i];
      w.t += dt / w.dur;
      const o = w.o;
      const target = w.by === 'rival' && munch ? munch.mouth.getWorldPosition(v1) : mouthPos;
      if (w.t >= 1) {
        swallows.splice(i, 1);
        o.swallowing = false;
        hideObj(o);
        crumbs.emit(target.x, target.y, target.z, w.big ? 18 : 8, { colors: [KINDS[o.kind].crumb, '#ffffff', '#fde68a'], speed: 1.5 + w.size, life: 0.7, gravity: -9, spread: 0.3, up: 2 + w.size });
        continue;
      }
      const e = w.t * w.t * (3 - 2 * w.t);
      const x = w.x0 + (target.x - w.x0) * e;
      const z = w.z0 + (target.z - w.z0) * e;
      const y = target.y * e + Math.sin(Math.PI * w.t) * (0.8 + w.size * 0.6);
      const sc = Math.max(0.02, (1 - e) ** 1.3);
      const sl = slots[o.id];
      if (sl) {
        q.setFromAxisAngle(up, o.rot + w.t * 4);
        m4.compose(vp.set(x, y, z), q, vs.set(sc, sc * (1 + 0.3 * Math.sin(w.t * 20)), sc));
        sl.b.mesh.setMatrixAt(sl.i, m4);
        sl.b.mesh.instanceMatrix.needsUpdate = true;
      }
    }

    // Friendly Pokemon
    s.pokemon.forEach((p, i) => {
      const c = chibis[i];
      if (!c) return;
      const hop = Math.abs(Math.sin(p.hop)) * (p.fleeing ? 0.35 : Math.hypot(p.vx, p.vz) > 0.3 ? 0.15 : 0.03);
      c.group.position.set(p.x, hop, p.z);
      let d = p.heading - c.group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      c.group.rotation.y += d * Math.min(1, dt * 10);
      const sq = 1 + Math.sin(p.hop * 2) * 0.06;
      c.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      if (c.parts.wag) c.parts.wag.rotation.x = Math.sin(t * 8 + i) * 0.4;
      if (c.parts.wings) c.parts.wings.forEach((w, k) => (w.rotation.z = (k ? -1 : 1) * (-0.25 - (p.fleeing ? Math.abs(Math.sin(t * 22)) * 0.9 : 0))));
      c.bang.visible = p.fleeing && Math.sin(t * 10) > -0.5;
      putShadow(2 + i, p.x, p.z, 1.1 - hop, 1.1 - hop);
    });

    // Powerups
    for (const p of s.powerups) {
      let v = powerViews.get(p.id);
      if (!v && p.alive) {
        const g = new THREE.Group();
        const m = new THREE.Mesh(powerGeos[p.type], powerMat);
        m.scale.setScalar(1.3);
        g.add(m);
        const glow = new THREE.Sprite(D(new THREE.SpriteMaterial({ map: glowTex, color: glowColors[p.type], transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })));
        glow.scale.set(2.6, 2.6, 1);
        g.add(glow);
        const ring = new THREE.Mesh(ringGeo, D(new THREE.MeshBasicMaterial({ color: glowColors[p.type], transparent: true, opacity: 0.7, depthWrite: false })));
        ring.position.y = -0.95;
        g.add(ring);
        g.position.set(p.x, 1.2, p.z);
        scene.add(g);
        v = { g, m, ring, born: t };
        powerViews.set(p.id, v);
      }
      if (!v) continue;
      if (!p.alive) {
        v.g.removeFromParent();
        v.ring.material.dispose();
        powerViews.delete(p.id);
        continue;
      }
      const grow = Math.min(1, (t - v.born) * 3);
      v.g.scale.setScalar(grow);
      v.g.position.y = 1.1 + Math.sin(t * 2.5 + p.id) * 0.2;
      v.m.rotation.y = t * 2;
      v.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    }

    // Floaters
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.t += dt;
      const k = f.t / f.life;
      f.sp.position.y += dt * 0.9 * (f.size * 1.2);
      f.sp.position.x += dt * f.vx * Math.cos(f.t * 3);
      f.sp.material.opacity = Math.max(0, 1 - k);
      const sc = f.size * (0.6 + k * 0.8);
      f.sp.scale.set(sc, sc, 1);
      if (k >= 1) {
        f.sp.removeFromParent();
        f.sp.material.dispose();
        disposables.delete(f.sp.material);
        floaters.splice(i, 1);
      }
    }
    crumbs.update(dt);
    dust.update(dt);
    sparks.update(dt);
    if (seaTex) seaTex.offset.set(t * 0.01, t * 0.006);
    if (foam) {
      foam.material.map.offset.x = t * 0.01;
      const b = 1 + Math.sin(t * 1.3) * 0.012;
      foam.scale.set(b, b, 1);
      foam.material.opacity = 0.65 + Math.sin(t * 1.3) * 0.2;
    }
    // Clouds drift slowly
    for (let i = 0; i < cloudData.length; i++) {
      const c = cloudData[i];
      const x = ((c.x + t * c.v + 260) % 520) - 260;
      m4.compose(vp.set(x, c.y, c.z), q.identity(), vs.set(c.s, c.s, c.s));
      clouds.setMatrixAt(i, m4);
    }
    clouds.instanceMatrix.needsUpdate = true;

    // Camera: high 3/4 view, pulls back as Snorlax grows
    const a = cam.ready ? 1 - Math.exp(-dt * 5) : 1;
    cam.ready = true;
    cam.x += (s.x - cam.x) * a;
    cam.z += (s.z - cam.z) * a;
    cam.R += (s.R - cam.R) * (1 - Math.exp(-dt * 2.5));
    const dist = 7.8 + cam.R * 7.2 + (sleeping ? -cam.R * 2 : 0);
    camPos.set(cam.x, dist * 1.2, cam.z + dist * 0.8);
    camera.position.copy(camPos);
    look.set(cam.x, cam.R * 0.9, cam.z - cam.R * 0.3);
    camera.lookAt(look);
    sky.position.copy(camera.position);
    scene.fog.near = 40 + dist * 1.2;
    scene.fog.far = 120 + dist * 3;
    // Sun shadow box follows the view (snapped to texels so edges do not shimmer)
    if (sun.castShadow) {
      const want = Math.ceil((8 + dist * 0.95) / 4) * 4;
      if (want !== shadowHalf) {
        shadowHalf = want;
        const sc = sun.shadow.camera;
        sc.left = sc.bottom = -want;
        sc.right = sc.top = want;
        sc.near = 1;
        sc.far = 160 + want;
        sc.updateProjectionMatrix();
      }
      const texel = (2 * shadowHalf) / sun.shadow.mapSize.x;
      const tx = Math.round(cam.x / texel) * texel;
      const tz = Math.round((cam.z - dist * 0.15) / texel) * texel;
      sun.target.position.set(tx, 0, tz);
      sun.position.set(tx + SUN_DIR.x * 90, SUN_DIR.y * 90, tz + SUN_DIR.z * 90);
    } else {
      sun.position.set(cam.x + 30, 60, cam.z + 25);
      sun.target.position.set(cam.x, 0, cam.z);
    }

    // Adaptive quality
    if (!lowPower) {
      slowT = dt > 0.034 ? slowT + dt : Math.max(0, slowT - dt * 0.5);
      if (slowT > 3) goLowPower();
    }
    renderer.render(scene, camera);
    return { sx: project(s.x, s.R * 2.6, s.z) };
  }

  /** Engine event → effects. */
  function fx(e, s) {
    if (e.type === 'eat') {
      const o = s.objects[e.id];
      if (!o) return;
      const k = KINDS[o.kind];
      const by = e.by;
      o.swallowing = true;
      shadowMesh.setMatrixAt(o.id, zero);
      shadowMesh.instanceMatrix.needsUpdate = true;
      const sl = slots[o.id];
      swallows.push({ o, by, t: 0, dur: 0.28 + Math.min(0.5, k.size * 0.07), x0: o.x, z0: o.z, size: k.size, big: k.size > 1, height: sl ? sl.b.height : 1 });
      const model = by === 'rival' ? munch : snorlax;
      model?.chomp(k.size > s.R * 0.5 ? 1 : 0);
      if (k.size > 2) dust.emit(o.x, 0.2, o.z, 10, { colors: ['#f5efe0'], speed: 3, life: 1, gravity: 0.5, spread: k.r, up: 1 });
    } else if (e.type === 'bump') {
      snorlax.wobble();
    } else if (e.type === 'levelup') {
      snorlax.bounce(1);
      sparks.emit(s.x, s.R * 1.2, s.z, 40, { colors: ['#fde047', '#ffffff', '#a5f3fc', '#f9a8d4'], speed: 4 + s.R * 2, life: 1, gravity: -3, spread: s.R, up: 3 + s.R });
    } else if (e.type === 'power') {
      sparks.emit(e.x, 1.2, e.z, 30, { colors: [glowColors[e.power], '#ffffff'], speed: 5, life: 0.8, gravity: -4, spread: 0.5, up: 4 });
      snorlax.bounce(0.4);
    } else if (e.type === 'sniff') {
      addFloater(heartMat, e.x, 1.4, e.z, 0.7, 1.4);
      addFloater(heartMat, (e.x + s.x) / 2, s.R * 2, (e.z + s.z) / 2, 0.6, 1.2);
    } else if (e.type === 'finish') {
      snorlax.bounce(0.6);
    }
  }

  const pv = new THREE.Vector3();
  /** World point → percent position on screen. */
  function project(x, y, z) {
    pv.set(x, y, z).project(camera);
    return { x: (pv.x * 0.5 + 0.5) * 100, y: (1 - (pv.y * 0.5 + 0.5)) * 100, visible: pv.z < 1 };
  }

  function dispose() {
    if (ro) ro.disconnect();
    else window.removeEventListener('resize', resize);
    snorlax.dispose();
    munch?.dispose();
    for (const g of Object.values(chibiCache.geos)) g.dispose();
    for (const m of Object.values(chibiCache.mats)) m.dispose();
    scene.traverse((o) => {
      if (o.geometry) disposables.add(o.geometry);
      if (o.material) disposables.add(o.material);
      if (o.isInstancedMesh && !o.userData.outline) disposables.add(o);
    });
    for (const d of disposables) d.dispose?.();
    for (const tx of textures) tx.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
  }

  return {
    update,
    fx,
    project,
    resize,
    dispose,
    get lowPower() {
      return lowPower;
    },
    debug: { snorlax, scene, camera, renderer, buckets, EAT_K },
  };
}
