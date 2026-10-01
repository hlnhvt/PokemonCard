// Three.js world for "Cưỡi Charizard bay lượn": a floating sky archipelago drawn from the engine state.
import * as THREE from 'three';
import { heightAt, floorAt, ringPos, mulberry, WATER } from '../../../utils/three3d/sky3d';
import { artworkUrl } from '../../../services/pokemonOnlineService';

const CHARIZARD = 6;

const SKIES = {
  morning: { top: '#6fb2ee', bottom: '#ffd9c4', fog: '#f4d8cf', sun: [0.55, 0.22, -0.8], sunColor: '#ffd9a8', hemiSky: '#d6e9ff', hemiGround: '#8a7a5a', light: 1.1, hemi: 0.75, sea: '#3d8fc4', near: 160, far: 820 },
  noon: { top: '#2f86e6', bottom: '#c4e6ff', fog: '#cfe7fb', sun: [0.25, 0.85, -0.45], sunColor: '#fffaf0', hemiSky: '#dff0ff', hemiGround: '#6f8a55', light: 1.25, hemi: 0.85, sea: '#2f86c9', near: 180, far: 900 },
  afternoon: { top: '#4b8fd8', bottom: '#ffe5b4', fog: '#f2e1c2', sun: [-0.55, 0.42, -0.7], sunColor: '#ffe2a6', hemiSky: '#ffeccc', hemiGround: '#7a6a48', light: 1.15, hemi: 0.75, sea: '#3a86bf', near: 170, far: 860 },
  sunset: { top: '#4458a6', bottom: '#ff9b5c', fog: '#f0a47c', sun: [0.15, 0.1, -1], sunColor: '#ff9450', hemiSky: '#ffc9a0', hemiGround: '#6a4a5a', light: 1.0, hemi: 0.7, sea: '#3f6fa8', near: 150, far: 760 },
  dusk: { top: '#26296a', bottom: '#c46aa0', fog: '#86598d', sun: [-0.35, 0.08, -1], sunColor: '#ffa0c8', hemiSky: '#b9a0ff', hemiGround: '#4a3a5a', light: 0.85, hemi: 0.75, sea: '#3a4f8f', near: 140, far: 700 },
  night: { top: '#060a24', bottom: '#24306c', fog: '#1d2654', sun: [0.3, 0.45, -0.8], sunColor: '#cfd8ff', hemiSky: '#8fa6ff', hemiGround: '#2a2a4a', light: 0.7, hemi: 0.8, sea: '#1f3a73', near: 120, far: 620, night: true },
};

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

const glowTexture = (inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') =>
  canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.6)'));
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });

function pokeballTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, h / 2, w, h / 2);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, h / 2 - 7, w, 14);
    ctx.beginPath();
    ctx.arc(w * 0.25, h / 2, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.25, h / 2, 10, 0, Math.PI * 2);
    ctx.fill();
  });
}

function meowthFaceTexture() {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#f5e6b8';
    ctx.beginPath();
    ctx.arc(128, 136, 110, 0, Math.PI * 2);
    ctx.fill();
    // Gold charm
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(128, 62, 26, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Eyes
    for (const x of [86, 170]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, 130, 24, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(x + 3, 134, 9, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Nose, smile, whiskers
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.ellipse(128, 168, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7c4a1e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(112, 182, 16, 0.1, Math.PI - 0.4);
    ctx.arc(144, 182, 16, 0.4, Math.PI - 0.1);
    ctx.stroke();
    ctx.lineWidth = 4;
    for (const [x0, y0, x1, y1] of [[60, 175, 5, 160], [60, 188, 5, 196], [196, 175, 251, 160], [196, 188, 251, 196]]) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  });
}

const stripeTexture = (colors) =>
  canvasTexture(256, 64, (ctx, w, h) => {
    const n = colors.length * 2;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect((i * w) / n, 0, w / n + 1, h);
    }
  });

function waterTexture() {
  const tex = canvasTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(160,215,255,0.55)';
    ctx.fillRect(0, 0, w, h);
    const rnd = mulberry(5);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.5})`;
      ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 30 + rnd() * 80);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function starShape(outer = 1, inner = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

/** A Pokemon artwork billboard: a coloured circle until the picture arrives. */
function billboard(url, color, size, loader, textures) {
  const ph = canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(32, 32, 22, 0, Math.PI * 2);
    ctx.fill();
  });
  textures.push(ph);
  const mat = new THREE.SpriteMaterial({ map: ph, transparent: true, alphaTest: 0.08 });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  if (url) {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.push(tex);
        mat.map = tex;
        mat.needsUpdate = true;
      },
      undefined,
      () => {}
    );
  }
  return sprite;
}

/** Particle pool drawn as glowing points. */
function particlePool(count, size, texture, blending) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, map: texture, vertexColors: true, transparent: true, depthWrite: false, blending, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const list = Array.from({ length: count }, () => ({ life: 0, max: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, g: 0, r: 1, gC: 1, b: 1 }));
  let cursor = 0;
  return {
    points,
    emit(x, y, z, n, { color = '#ffffff', colors, speed = 10, life = 0.8, gravity = 0, spread = 1, up = 0 } = {}) {
      const tmp = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const p = list[cursor];
        cursor = (cursor + 1) % count;
        const u = Math.random() * 2 - 1;
        const a = Math.random() * Math.PI * 2;
        const k = Math.sqrt(1 - u * u);
        const v = speed * (0.4 + Math.random() * 0.8);
        p.x = x + (Math.random() - 0.5) * spread;
        p.y = y + (Math.random() - 0.5) * spread;
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
          p.vx *= 1 - dt * 1.2;
          p.vz *= 1 - dt * 1.2;
        }
        const f = Math.max(0, p.life / p.max);
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.life > 0 ? p.y : -9999;
        pos[i * 3 + 2] = p.z;
        col[i * 3] = p.r * f;
        col[i * 3 + 1] = p.gC * f;
        col[i * 3 + 2] = p.b * f;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

/** A ribbon following a moving point (wing trails, friend trails). */
function ribbon(length, color, width) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(length * 2 * 3);
  const col = new Float32Array(length * 2 * 4);
  const idx = [];
  for (let i = 0; i < length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const c = new THREE.Color(color);
  const hist = [];
  return {
    mesh,
    push(p, side, strength = 1) {
      hist.unshift({ x: p.x, y: p.y, z: p.z, sx: side.x, sy: side.y, sz: side.z, s: strength });
      if (hist.length > length) hist.pop();
      for (let i = 0; i < length; i++) {
        const h = hist[Math.min(i, hist.length - 1)] || { x: 0, y: -9999, z: 0, sx: 0, sy: 0, sz: 0, s: 0 };
        const f = 1 - i / (length - 1);
        const w = width * f;
        pos.set([h.x + h.sx * w, h.y + h.sy * w, h.z + h.sz * w, h.x - h.sx * w, h.y - h.sy * w, h.z - h.sz * w], i * 6);
        const a = f * f * 0.85 * h.s * (i < hist.length ? 1 : 0);
        col.set([c.r, c.g, c.b, a, c.r, c.g, c.b, a], i * 8);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

/**
 * Builds the world for one course into `container`. Throws if WebGL is unavailable.
 * opts = { course, playerImage, riderIsCharizard, todOverride }
 */
export function createSky3DScene(container, { course, playerImage, riderIsCharizard = false }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const lv = course.level;
  const sky = SKIES[lv.tod] || SKIES.noon;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sky.bottom);
  scene.fog = new THREE.Fog(sky.fog, sky.near, sky.far);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 2600);
  const textures = [];
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const rnd = mulberry(77 + course.index * 31);
  const B = course.bounds;

  // Lights
  scene.add(new THREE.HemisphereLight(sky.hemiSky, sky.hemiGround, sky.hemi));
  const sunDir = new THREE.Vector3(...sky.sun).normalize();
  const sunLight = new THREE.DirectionalLight(sky.sunColor, sky.light);
  sunLight.position.copy(sunDir).multiplyScalar(100);
  scene.add(sunLight);

  // Sky dome with a vertical gradient (and stars at night)
  const domeGeo = new THREE.SphereGeometry(2000, 32, 16);
  {
    const top = new THREE.Color(sky.top);
    const bottom = new THREE.Color(sky.bottom);
    const p = domeGeo.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, p.getY(i) / 2000);
      c.copy(bottom).lerp(top, Math.pow(t, 0.6));
      cols.set([c.r, c.g, c.b], i * 3);
    }
    domeGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
  const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -2;
  scene.add(dome);
  const sparkTex = glowTexture();
  textures.push(sparkTex);
  if (sky.night) {
    const g = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 700; i++) {
      const a = rnd() * Math.PI * 2;
      const y = 0.15 + rnd() * 0.85;
      const k = Math.sqrt(1 - y * y);
      pts.push(Math.cos(a) * k * 1800, y * 1800, Math.sin(a) * k * 1800);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 7, map: sparkTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    dome.add(stars);
  }
  // Sun (or moon at night) with a soft halo
  const sunTex = glowTexture(sky.night ? 'rgba(230,236,255,1)' : 'rgba(255,250,230,1)', 'rgba(255,220,160,0)');
  textures.push(sunTex);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: sky.sunColor, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  sun.scale.set(sky.night ? 160 : 300, sky.night ? 160 : 300, 1);
  sun.renderOrder = -1;
  scene.add(sun);

  // Terrain from the engine's height function, coloured by height and slope
  const size = B.r * 2.8;
  const seg = 150;
  const terrainGeo = new THREE.PlaneGeometry(size, size, seg, seg);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(B.cx, 0, B.cz);
  const treeSpots = [];
  {
    const p = terrainGeo.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    const sand = new THREE.Color('#ead9a2');
    const wet = new THREE.Color('#c9b27a');
    const grassA = new THREE.Color(lv.tod === 'night' ? '#3f7a45' : '#71c24c');
    const grassB = new THREE.Color(lv.tod === 'night' ? '#2f6338' : '#4c9a3a');
    const rock = new THREE.Color('#8f877c');
    const rock2 = new THREE.Color('#a7927a');
    const snow = new THREE.Color('#f6f8ff');
    const town = new THREE.Color('#9bd36a');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const h = heightAt(course, x, z);
      p.setY(i, h);
      const slope = Math.hypot(heightAt(course, x + 3, z) - heightAt(course, x - 3, z), heightAt(course, x, z + 3) - heightAt(course, x, z - 3)) / 6;
      const n = Math.sin(x * 0.11) * Math.cos(z * 0.13) * 0.5 + 0.5;
      if (h < -1) c.copy(wet);
      else if (h < 2.2) c.copy(sand);
      else if (h > 46) c.copy(snow);
      else if (slope > 0.85 || h > 34) c.copy(rock).lerp(rock2, n);
      else c.copy(grassA).lerp(grassB, n);
      if (h > 40 && h <= 46) c.lerp(snow, (h - 40) / 6);
      if (Math.hypot(x - course.town.x, z - course.town.z) < course.town.r && h < 8) c.copy(town);
      cols.set([c.r, c.g, c.b], i * 3);
      if (h > 3 && h < 30 && slope < 0.5 && rnd() < 0.05 && Math.hypot(x - course.town.x, z - course.town.z) > course.town.r + 4) treeSpots.push([x, h, z]);
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    terrainGeo.computeVertexNormals();
  }
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  scene.add(terrain);

  // Sea with gentle low-poly waves, following the camera
  const SEA = 2600;
  const SEA_SEG = 64;
  const seaGeo = new THREE.PlaneGeometry(SEA, SEA, SEA_SEG, SEA_SEG);
  seaGeo.rotateX(-Math.PI / 2);
  const seaBase = Float32Array.from(seaGeo.attributes.position.array);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshPhongMaterial({ color: sky.sea, emissive: new THREE.Color(sky.sea).multiplyScalar(0.45), shininess: 70, specular: '#cfe8ff', flatShading: true, transparent: true, opacity: 0.88 }));
  sea.renderOrder = -1; // drawn before the billboards, so it never covers them
  scene.add(sea);
  let seaTick = 0;
  const updateSea = (t, cx, cz) => {
    const cell = SEA / SEA_SEG;
    sea.position.set(Math.round(cx / cell) * cell, WATER, Math.round(cz / cell) * cell);
    const p = seaGeo.attributes.position;
    const ox = sea.position.x;
    const oz = sea.position.z;
    for (let i = 0; i < p.count; i++) {
      const x = seaBase[i * 3] + ox;
      const z = seaBase[i * 3 + 2] + oz;
      p.array[i * 3 + 1] = Math.sin(x * 0.05 + t * 1.3) * 0.45 + Math.cos(z * 0.06 - t * 1.1) * 0.45;
    }
    p.needsUpdate = true;
    seaGeo.computeVertexNormals();
  };

  // Shared bits
  const disposables = [];
  const mat = (m) => {
    disposables.push(m);
    return m;
  };
  const geo = (g) => {
    disposables.push(g);
    return g;
  };

  // Trees (instanced)
  const trees = Math.min(treeSpots.length, 260);
  const crownGeo = geo(new THREE.ConeGeometry(2.2, 5.5, 6));
  crownGeo.translate(0, 4.6, 0);
  const trunkGeo = geo(new THREE.CylinderGeometry(0.35, 0.45, 2.2, 5));
  trunkGeo.translate(0, 1.1, 0);
  const crowns = new THREE.InstancedMesh(crownGeo, mat(new THREE.MeshLambertMaterial({ color: lv.tod === 'night' ? '#2b6a3a' : '#3f9b45', flatShading: true })), trees);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(new THREE.MeshLambertMaterial({ color: '#7a5233' })), trees);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    for (let i = 0; i < trees; i++) {
      const [x, h, z] = treeSpots[i];
      const k = 0.7 + rnd() * 0.7;
      sc.set(k, k * (0.8 + rnd() * 0.5), k);
      m.compose(new THREE.Vector3(x, h - 0.3, z), q, sc);
      crowns.setMatrixAt(i, m);
      trunks.setMatrixAt(i, m);
    }
  }
  scene.add(crowns, trunks);

  // Pokemon Center town
  {
    const town = new THREE.Group();
    town.position.set(course.town.x, course.town.y, course.town.z);
    const box = geo(new THREE.BoxGeometry(1, 1, 1));
    const roof = geo(new THREE.ConeGeometry(0.75, 0.6, 4));
    roof.rotateY(Math.PI / 4);
    const white = mat(new THREE.MeshLambertMaterial({ color: '#f8fafc' }));
    const red = mat(new THREE.MeshLambertMaterial({ color: '#ef4444' }));
    const blue = mat(new THREE.MeshLambertMaterial({ color: '#3b82f6' }));
    const cols = ['#fde68a', '#fecaca', '#bfdbfe', '#ddd6fe', '#bbf7d0'].map((c) => mat(new THREE.MeshLambertMaterial({ color: c })));
    const roofs = ['#b45309', '#be123c', '#1d4ed8', '#6d28d9', '#15803d'].map((c) => mat(new THREE.MeshLambertMaterial({ color: c })));
    const add = (g, m, x, y, z, sx, sy, sz) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      town.add(o);
      return o;
    };
    // The Pokemon Center: white walls, red roof band, a Poke Ball sign
    add(box, white, 0, 3, 0, 14, 6, 10);
    add(box, red, 0, 6.6, 0, 14.6, 1.4, 10.6);
    add(roof, red, 0, 9.2, 0, 13, 6, 9);
    const ballTex = pokeballTexture();
    textures.push(ballTex);
    const sign = new THREE.Mesh(geo(new THREE.SphereGeometry(1.6, 16, 12)), mat(new THREE.MeshLambertMaterial({ map: ballTex })));
    sign.position.set(0, 9.5, 5.4);
    town.add(sign);
    // Poke Mart
    add(box, white, -20, 2.5, 4, 9, 5, 8);
    add(box, blue, -20, 5.4, 4, 9.4, 1.2, 8.4);
    // Houses
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const d = 15 + (i % 2) * 6;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (Math.abs(x + 20) < 7 && Math.abs(z - 4) < 7) continue;
      const w = 4 + (i % 3);
      add(box, cols[i % cols.length], x, 2, z, w, 4, w);
      add(roof, roofs[i % roofs.length], x, 5.2, z, w * 1.2, 3, w * 1.2);
    }
    scene.add(town);
  }

  // Waterfalls on cliffs near the course (and curtains on the waterfall level)
  const fallTex = waterTexture();
  textures.push(fallTex);
  const fallMat = mat(new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  const curtainMat = mat(new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  const mistSpots = [];
  {
    let made = 0;
    for (let k = 0; k < 400 && made < 4; k++) {
      const p = course.path[1 + Math.floor(rnd() * (course.path.length - 1))];
      const a = rnd() * Math.PI * 2;
      const d = 40 + rnd() * 70;
      const x = p.x + Math.cos(a) * d;
      const z = p.z + Math.sin(a) * d;
      const top = heightAt(course, x, z);
      if (top < 16) continue;
      // Steepest way down
      let best = null;
      for (let j = 0; j < 8; j++) {
        const b = (j / 8) * Math.PI * 2;
        const h2 = heightAt(course, x + Math.cos(b) * 9, z + Math.sin(b) * 9);
        if (!best || h2 < best.h) best = { h: h2, b };
      }
      if (top - best.h < 10) continue;
      const bottom = Math.max(WATER, best.h) - 1;
      const hgt = top - bottom;
      const g = geo(new THREE.PlaneGeometry(7, hgt));
      const fall = new THREE.Mesh(g, fallMat);
      fall.position.set(x + Math.cos(best.b) * 5, bottom + hgt / 2, z + Math.sin(best.b) * 5);
      fall.rotation.y = -best.b + Math.PI / 2;
      fall.rotation.x = -0.15;
      scene.add(fall);
      mistSpots.push([x + Math.cos(best.b) * 9, bottom + 1, z + Math.sin(best.b) * 9]);
      made += 1;
    }
  }
  const curtainGeo = geo(new THREE.PlaneGeometry(1, 1));
  for (const r of course.rings) {
    if (!r.curtain) continue;
    const top = r.y + 30;
    const bottom = Math.max(WATER, heightAt(course, r.x, r.z)) - 1;
    const c = new THREE.Mesh(curtainGeo, curtainMat);
    c.scale.set(r.r * 4, top - bottom, 1);
    c.position.set(r.x + r.nx * 2, (top + bottom) / 2, r.z + r.nz * 2);
    c.rotation.y = Math.atan2(r.nx, r.nz);
    scene.add(c);
    // Rock arch over the curtain
    const arch = new THREE.Mesh(geo(new THREE.BoxGeometry(r.r * 4.6, 6, 8)), mat(new THREE.MeshLambertMaterial({ color: '#8f877c', flatShading: true })));
    arch.position.set(r.x + r.nx * 2, top + 2, r.z + r.nz * 2);
    arch.rotation.y = Math.atan2(r.nx, r.nz);
    scene.add(arch);
    mistSpots.push([r.x, bottom + 1, r.z]);
  }

  // Clouds (instanced puffs) and storm clouds
  const puffGeo = geo(new THREE.IcosahedronGeometry(1, 1));
  const cloudMat = mat(new THREE.MeshLambertMaterial({ color: sky.night ? '#aab4dd' : '#ffffff', emissive: sky.night ? '#2a3060' : '#b8bccb', flatShading: true, transparent: true, opacity: 0.95 }));
  const PUFFS = 6;
  const clouds = new THREE.InstancedMesh(puffGeo, cloudMat, course.clouds.length * PUFFS);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let i = 0;
    for (const c of course.clouds) {
      for (let k = 0; k < PUFFS; k++) {
        const a = (k / PUFFS) * Math.PI * 2 + rnd();
        const off = k === 0 ? 0 : c.r * (0.35 + rnd() * 0.3);
        const s = c.r * (k === 0 ? 0.62 : 0.38 + rnd() * 0.2);
        m.compose(new THREE.Vector3(c.x + Math.cos(a) * off, c.y + (rnd() - 0.3) * c.r * 0.25, c.z + Math.sin(a) * off * 0.7), q, new THREE.Vector3(s * 1.2, s * 0.8, s));
        clouds.setMatrixAt(i++, m);
      }
    }
  }
  scene.add(clouds);
  const storms = course.hazards.filter((h) => h.kind === 'storm');
  const stormMat = mat(new THREE.MeshLambertMaterial({ color: '#5b6478', emissive: '#1b2030', flatShading: true }));
  const stormMesh = new THREE.InstancedMesh(puffGeo, stormMat, Math.max(1, storms.length * PUFFS));
  stormMesh.count = storms.length * PUFFS;
  const stormOffsets = storms.map(() => Array.from({ length: PUFFS }, (_, k) => ({ a: (k / PUFFS) * Math.PI * 2 + rnd(), d: k === 0 ? 0 : 0.55, s: k === 0 ? 0.7 : 0.45 + rnd() * 0.15 })));
  scene.add(stormMesh);
  const boltMat = mat(new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const boltGeo = geo(new THREE.ConeGeometry(0.5, 8, 4));
  const bolts = storms.map(() => {
    const b = new THREE.Mesh(boltGeo, boltMat);
    b.rotation.x = Math.PI;
    scene.add(b);
    return b;
  });

  // Team Rocket Meowth balloons
  const faceTex = meowthFaceTexture();
  textures.push(faceTex);
  const balloonParts = {
    ball: geo(new THREE.SphereGeometry(1, 20, 14)),
    ear: geo(new THREE.ConeGeometry(0.35, 0.7, 4)),
    face: geo(new THREE.CircleGeometry(0.82, 24)),
    basket: geo(new THREE.BoxGeometry(1.4, 1, 1.4)),
    rope: geo(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 3)),
  };
  const meowthMat = mat(new THREE.MeshLambertMaterial({ color: '#f1dfae' }));
  const earMat = mat(new THREE.MeshLambertMaterial({ color: '#5b3b23' }));
  const faceMat = mat(new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }));
  const basketMat = mat(new THREE.MeshLambertMaterial({ color: '#9a6b3c' }));
  const rTex = canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', 32, 36);
  });
  textures.push(rTex);
  const rMat = mat(new THREE.MeshLambertMaterial({ map: rTex }));
  const balloons = course.hazards
    .filter((h) => h.kind === 'balloon')
    .map((h) => {
      const g = new THREE.Group();
      const s = h.r;
      const ball = new THREE.Mesh(balloonParts.ball, meowthMat);
      ball.scale.set(s, s * 1.05, s);
      g.add(ball);
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(balloonParts.ear, earMat);
        ear.scale.setScalar(s);
        ear.position.set(side * s * 0.55, s * 0.95, 0);
        ear.rotation.z = -side * 0.4;
        g.add(ear);
      }
      const face = new THREE.Mesh(balloonParts.face, faceMat);
      face.scale.setScalar(s);
      face.position.set(0, 0, s * 0.62);
      g.add(face);
      const basket = new THREE.Mesh(balloonParts.basket, [basketMat, basketMat, basketMat, basketMat, rMat, rMat]);
      basket.scale.setScalar(s * 0.55);
      basket.position.set(0, -s * 1.55, 0);
      g.add(basket);
      for (const sx of [-1, 1]) {
        const rope = new THREE.Mesh(balloonParts.rope, basketMat);
        rope.scale.setScalar(s * 0.55);
        rope.position.set(sx * s * 0.35, -s * 1.05, 0);
        g.add(rope);
      }
      scene.add(g);
      return { g, h };
    });

  // Hot-air balloons (scenery)
  const hotAir = [];
  {
    const sets = [['#ef4444', '#fde047'], ['#3b82f6', '#ffffff'], ['#22c55e', '#facc15'], ['#a855f7', '#f9a8d4'], ['#f97316', '#ffffff'], ['#06b6d4', '#fef08a']];
    const envGeo = balloonParts.ball;
    for (let i = 0; i < 7; i++) {
      const tex = stripeTexture(sets[i % sets.length]);
      textures.push(tex);
      const m = mat(new THREE.MeshLambertMaterial({ map: tex }));
      const g = new THREE.Group();
      const env = new THREE.Mesh(envGeo, m);
      env.scale.set(5, 6, 5);
      g.add(env);
      const basket = new THREE.Mesh(balloonParts.basket, basketMat);
      basket.scale.set(1.6, 1.4, 1.6);
      basket.position.y = -8.5;
      g.add(basket);
      const p = course.path[1 + ((i * 3) % (course.path.length - 1))];
      const a = rnd() * Math.PI * 2;
      const d = 45 + rnd() * 60;
      g.position.set(p.x + Math.cos(a) * d, p.y + 10 + rnd() * 30, p.z + Math.sin(a) * d);
      scene.add(g);
      hotAir.push({ g, y: g.position.y, ph: rnd() * 6 });
    }
  }

  // Rings
  const torus = geo(new THREE.TorusGeometry(1, 0.11, 10, 48));
  const discGeo = geo(new THREE.CircleGeometry(1, 40));
  const glowTex = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  textures.push(glowTex);
  const rings = course.rings.map((r) => {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: r.gold ? '#ffcf33' : '#5ee7ff', transparent: true, opacity: 0.9, fog: false });
    disposables.push(m);
    const t = new THREE.Mesh(torus, m);
    g.add(t);
    const dm = new THREE.MeshBasicMaterial({ color: r.gold ? '#fff1a8' : '#c7f6ff', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, fog: false });
    disposables.push(dm);
    const disc = new THREE.Mesh(discGeo, dm);
    g.add(disc);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: r.gold ? '#ffd23f' : '#7dd3fc', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    disposables.push(halo.material);
    halo.scale.set(3.2, 3.2, 1);
    g.add(halo);
    g.scale.setScalar(r.r);
    g.lookAt(r.x + r.nx, r.y + r.ny, r.z + r.nz);
    g.position.set(r.x, r.y, r.z);
    scene.add(g);
    return { g, m, dm, halo, torus: t };
  });

  // Stars and Poke Balls
  const starGeo = geo(new THREE.ExtrudeGeometry(starShape(1.3, 0.58), { depth: 0.45, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 1 }));
  starGeo.center();
  const starMat = mat(new THREE.MeshLambertMaterial({ color: '#ffd23f', emissive: '#b8860b', emissiveIntensity: 0.6 }));
  const ballTex2 = pokeballTexture();
  textures.push(ballTex2);
  const ballMat = mat(new THREE.MeshLambertMaterial({ map: ballTex2, emissive: '#331111', emissiveIntensity: 0.3 }));
  const ballGeo = geo(new THREE.SphereGeometry(1.2, 18, 12));
  const items = course.items.map((it) => {
    const m = new THREE.Mesh(it.kind === 'star' ? starGeo : ballGeo, it.kind === 'star' ? starMat : ballMat);
    m.position.set(it.x, it.y, it.z);
    scene.add(m);
    return m;
  });

  // The rider on Charizard
  const player = new THREE.Group();
  scene.add(player);
  const dragon = billboard(riderIsCharizard ? playerImage || artworkUrl(CHARIZARD) : artworkUrl(CHARIZARD), '#fb923c', 7.5, loader, textures);
  dragon.position.set(0, 0, 0);
  player.add(dragon);
  let rider = null;
  if (!riderIsCharizard) {
    rider = billboard(playerImage, '#fde047', 3.6, loader, textures);
    rider.position.set(0, 2.4, 0.6);
    rider.renderOrder = 2;
    player.add(rider);
  }
  const shadowTex = canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  textures.push(shadowTex);
  const shadow = new THREE.Mesh(geo(new THREE.PlaneGeometry(7, 7)), mat(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  const wingL = ribbon(28, '#ffd9a0', 0.35);
  const wingR = ribbon(28, '#ffd9a0', 0.35);
  scene.add(wingL.mesh, wingR.mesh);

  // Friend Pokemon with a glowing trail
  let friend = null;
  let friendTrail = null;
  if (lv.friend) {
    friend = billboard(artworkUrl(lv.friend.dex), '#93c5fd', lv.friend.dex === 249 ? 9 : 7, loader, textures);
    scene.add(friend);
    friendTrail = ribbon(40, lv.friend.dex === 249 ? '#a5b4fc' : '#fcd34d', 0.8);
    scene.add(friendTrail.mesh);
  }

  // Particles
  const sparks = particlePool(500, 1.3, sparkTex, THREE.AdditiveBlending);
  const puffTexture = glowTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)');
  textures.push(puffTexture);
  const puffs = particlePool(160, 7, puffTexture, THREE.NormalBlending);
  scene.add(sparks.points, puffs.points);

  // Camera rig state
  const cam = { ready: false, pos: new THREE.Vector3(), look: new THREE.Vector3(), bank: 0, fov: 62 };
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  let time = 0;
  let slowFor = 0;
  let lowPower = false;
  let mistT = 0;

  const resize = () => {
    const w = container.clientWidth || 360;
    const h = container.clientHeight || 640;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Portrait screens see a little wider
    camera.updateProjectionMatrix();
  };
  resize();
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(resize);
    ro.observe(container);
  } else window.addEventListener('resize', resize);

  const COLOR_NEXT = new THREE.Color('#9dfcff');
  const COLOR_TODO = new THREE.Color('#38bdf8');
  const COLOR_GOLD = new THREE.Color('#ffcf33');
  const COLOR_MISS = new THREE.Color('#94a3b8');

  /** Particle effects for engine events. */
  function fx(e, s) {
    if (e.type === 'ring') {
      sparks.emit(e.x, e.y, e.z, e.gold ? 90 : 60, { colors: e.gold ? ['#ffd23f', '#fff7cc', '#ff9f1c'] : ['#5ee7ff', '#ffffff', '#fde047'], speed: 16, life: 0.9, spread: 3 });
      const r = course.rings[e.index];
      if (r.curtain) puffs.emit(e.x, e.y, e.z, 26, { color: '#d9f0ff', speed: 8, life: 0.9, gravity: 6, spread: 4 });
    } else if (e.type === 'item') sparks.emit(e.x, e.y, e.z, 30, { colors: e.kind === 'star' ? ['#ffd23f', '#ffffff'] : ['#ef4444', '#ffffff'], speed: 10, life: 0.7 });
    else if (e.type === 'bump') sparks.emit(e.x, e.y, e.z, 45, { colors: ['#fde047', '#ffffff', '#a5b4fc'], speed: 14, life: 0.6 });
    else if (e.type === 'cloud') puffs.emit(e.x, e.y, e.z, 18, { color: '#ffffff', speed: 6, life: 1, spread: 5 });
    else if (e.type === 'splash') puffs.emit(s.x, WATER + 0.5, s.z, 4, { color: '#e0f4ff', speed: 4, life: 0.7, gravity: 9, up: 5, spread: 2 });
    else if (e.type === 'miss') {
      const r = s.rings[e.index];
      const c = ringPos(r, s.t);
      sparks.emit(c.x, c.y, c.z, 14, { color: '#94a3b8', speed: 5, life: 0.6 });
    }
  }

  /** Draws the engine state. Returns screen hints for the HUD (arrow to the next ring, sun glare). */
  function update(s, dt) {
    time += dt;
    // Auto quality: drop to pixel ratio 1 and fewer decorations when frames are slow
    if (dt > 1 / 38) slowFor += dt;
    else slowFor = Math.max(0, slowFor - dt * 0.5);
    if (!lowPower && slowFor > 3) {
      lowPower = true;
      pixelRatio = 1;
      renderer.setPixelRatio(1);
      resize();
      crowns.count = trunks.count = Math.floor(trees / 2);
      for (const b of hotAir) b.g.visible = false;
    }

    const fwdX = -Math.sin(s.yaw);
    const fwdZ = -Math.cos(s.yaw);
    player.position.set(s.x, s.y, s.z);
    player.rotation.set(0, s.yaw, 0);
    const flap = Math.sin(time * (s.boosting ? 11 : 7));
    dragon.scale.set(7.5 * (1 + 0.07 * flap), 7.5 * (1 - 0.035 * flap), 1);
    dragon.material.rotation = -s.bank * 0.35;
    if (rider) {
      rider.material.rotation = -s.bank * 0.3;
      rider.position.y = 2.4 + Math.sin(time * 3) * 0.15;
    }
    // Wing trails from the wing tips
    const rightX = -fwdZ;
    const rightZ = fwdX;
    const tipY = s.y + 0.6;
    const span = 3.4;
    const side = { x: 0, y: 1, z: 0 };
    const strength = s.boosting ? 1 : 0.55;
    wingL.push({ x: s.x - rightX * span, y: tipY + s.bank * 1.2, z: s.z - rightZ * span }, side, strength);
    wingR.push({ x: s.x + rightX * span, y: tipY - s.bank * 1.2, z: s.z + rightZ * span }, side, strength);
    // Blob shadow on the ground or the water
    const floor = floorAt(course, s.x, s.z);
    const alt = s.y - floor;
    shadow.position.set(s.x, floor + 0.3, s.z);
    shadow.material.opacity = Math.max(0, 1 - alt / 45);
    shadow.scale.setScalar(1 + alt / 40);

    // Rings: next one bright and pulsing, passed ones burst away
    for (let i = 0; i < rings.length; i++) {
      const v = rings[i];
      const r = s.rings[i];
      const c = ringPos(r, s.t);
      v.g.position.set(c.x, c.y, c.z);
      if (r.state === 'todo') {
        const isNext = i === s.next;
        const pulse = isNext ? 1 + Math.sin(time * 5) * 0.06 : 1;
        v.g.scale.setScalar(r.r * pulse);
        v.g.visible = i <= s.next + 4;
        v.m.color.copy(r.gold ? COLOR_GOLD : isNext ? COLOR_NEXT : COLOR_TODO);
        v.m.opacity = isNext ? 1 : 0.55;
        v.dm.opacity = isNext ? 0.18 + Math.sin(time * 5) * 0.06 : 0.06;
        v.halo.material.opacity = isNext ? 0.55 : 0;
        if (isNext) v.torus.rotation.z = time * 0.6;
      } else {
        const k = Math.min(1, (s.t - r.at) / (r.state === 'hit' ? 0.35 : 0.6));
        v.g.visible = k < 1;
        if (r.state === 'hit') {
          v.g.scale.setScalar(r.r * (1 + k * 0.6));
          v.m.opacity = 0.9 * (1 - k) * (1 - k);
          v.dm.opacity = 0;
          v.halo.material.opacity = 0.5 * (1 - k);
        } else {
          v.m.color.copy(COLOR_MISS);
          v.m.opacity = 0.5 * (1 - k);
          v.dm.opacity = 0;
          v.halo.material.opacity = 0;
        }
      }
    }
    // Items spin and bob
    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      const it = s.items[i];
      m.visible = !it.taken;
      if (!it.taken) {
        m.rotation.y = time * 2 + i;
        m.position.y = it.y + Math.sin(time * 2 + i) * 0.5;
      }
    }
    // Hazards (same bobbing as the engine)
    for (const b of balloons) {
      const h = s.hazards[b.h.i];
      b.g.position.set(h.x, h.y + Math.sin(s.t * 0.9 + h.phase) * h.bob, h.z);
      b.g.rotation.y = Math.atan2(camera.position.x - h.x, camera.position.z - h.z);
      b.g.rotation.z = Math.sin(time * 1.3 + h.phase) * 0.06;
    }
    {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      let i = 0;
      storms.forEach((st, k) => {
        const h = s.hazards[st.i];
        const y = h.y + Math.sin(s.t * 0.9 + h.phase) * h.bob;
        for (const o of stormOffsets[k]) {
          const sc = h.r * o.s;
          m.compose(tmpV.set(h.x + Math.cos(o.a + time * 0.2) * h.r * o.d, y + (o.d ? -0.1 : 0.15) * h.r, h.z + Math.sin(o.a + time * 0.2) * h.r * o.d), q, tmpV2.set(sc * 1.25, sc * 0.85, sc));
          stormMesh.setMatrixAt(i++, m);
        }
        const flash = Math.sin(time * 3.1 + k * 2.3) > 0.97;
        bolts[k].visible = flash;
        bolts[k].position.set(h.x, y - h.r * 1.2, h.z);
      });
      stormMesh.instanceMatrix.needsUpdate = true;
      boltMat.opacity = 0.95;
      stormMat.emissive.setRGB(0.1, 0.12, 0.2).multiplyScalar(1 + (Math.sin(time * 3.1) > 0.97 ? 4 : 0));
    }
    for (const b of hotAir) b.g.position.y = b.y + Math.sin(time * 0.5 + b.ph) * 2;
    // Friend
    if (friend && s.friend) {
      friend.position.set(s.friend.x, s.friend.y, s.friend.z);
      const f2 = Math.sin(time * 6);
      const base = lv.friend.dex === 249 ? 9 : 7;
      friend.scale.set(base * (1 + 0.06 * f2), base * (1 - 0.03 * f2), 1);
      const fy = s.friend.yaw ?? 0;
      friendTrail.push({ x: s.friend.x + Math.sin(fy) * 2, y: s.friend.y - 0.5, z: s.friend.z + Math.cos(fy) * 2 }, { x: -Math.cos(fy), y: 0, z: Math.sin(fy) }, s.friend.inTrail ? 1 : 0.6);
      if (s.friend.inTrail && Math.random() < 0.5) sparks.emit(s.x, s.y, s.z, 1, { colors: ['#fde68a', '#ffffff'], speed: 3, life: 0.5, spread: 3 });
    }
    // Boost sparkles behind the dragon
    if (s.boosting && Math.random() < 0.5) sparks.emit(s.x - fwdX * 2, s.y - 0.5, s.z - fwdZ * 2, 1, { colors: ['#ff9f1c', '#ffd23f'], speed: 3, life: 0.3 });
    // Waterfall flow and mist
    fallTex.offset.y = (fallTex.offset.y + dt * 1.6) % 1;
    mistT += dt;
    if (mistT > 0.15 && mistSpots.length) {
      mistT = 0;
      const m = mistSpots[Math.floor(Math.random() * mistSpots.length)];
      puffs.emit(m[0], m[1], m[2], 1, { color: '#eaf6ff', speed: 2, life: 1.4, up: 2, spread: 5 });
    }
    sparks.update(dt);
    puffs.update(dt);

    // Chase camera: behind and a little above, following with a gentle lag and a small roll
    const back = 15 + (s.speed - 30) * 0.12;
    tmpV.set(s.x - fwdX * back, s.y + 4.2 - Math.sin(s.pitch) * 6, s.z - fwdZ * back);
    const camFloor = floorAt(course, tmpV.x, tmpV.z) + 2;
    if (tmpV.y < camFloor) tmpV.y = camFloor;
    tmpV2.set(s.x + fwdX * 10, s.y + 1.5 + Math.sin(s.pitch) * 8, s.z + fwdZ * 10);
    if (!cam.ready) {
      cam.pos.copy(tmpV);
      cam.look.copy(tmpV2);
      cam.ready = true;
    } else {
      const k = 1 - Math.exp(-dt * 3.2);
      cam.pos.lerp(tmpV, k);
      cam.look.lerp(tmpV2, 1 - Math.exp(-dt * 6));
    }
    cam.bank += (s.bank - cam.bank) * (1 - Math.exp(-dt * 3));
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    camera.rotateZ(-cam.bank * 0.1);
    const wantFov = s.boosting ? 72 : 62;
    cam.fov += (wantFov - cam.fov) * (1 - Math.exp(-dt * 3));
    if (Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }
    dome.position.copy(camera.position);
    sun.position.copy(camera.position).addScaledVector(sunDir, 1500);
    seaTick += 1;
    if (!lowPower || seaTick % 2 === 0) updateSea(time, camera.position.x, camera.position.z);

    renderer.render(scene, camera);

    // HUD hints: arrow towards the next ring when it is off screen, and the sun glare
    const out = { arrow: null, glare: null };
    const nr = s.rings[s.next];
    if (nr && s.status === 'play') {
      const c = ringPos(nr, s.t);
      tmpV.set(c.x, c.y, c.z).project(camera);
      const camDir = camera.getWorldDirection(tmpV2);
      const behind = (c.x - camera.position.x) * camDir.x + (c.y - camera.position.y) * camDir.y + (c.z - camera.position.z) * camDir.z < 0;
      let x = tmpV.x;
      let y = tmpV.y;
      if (behind) {
        x = -x;
        y = -y;
      }
      const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.9;
      if (off) {
        const a = Math.atan2(y, x);
        out.arrow = { angle: a, x: 50 + Math.cos(a) * 40, y: 50 - Math.sin(a) * 40 };
      }
    }
    const camDir = camera.getWorldDirection(tmpV2);
    const align = camDir.dot(sunDir);
    if (align > 0.75 && !sky.night) {
      tmpV.copy(camera.position).addScaledVector(sunDir, 100).project(camera);
      out.glare = { x: (tmpV.x * 0.5 + 0.5) * 100, y: (-tmpV.y * 0.5 + 0.5) * 100, a: Math.min(1, (align - 0.75) * 4) };
    }
    return out;
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
    for (const t of textures) t.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
  }

  return { update, fx, resize, dispose, get lowPower() {
    return lowPower;
  } };
}
