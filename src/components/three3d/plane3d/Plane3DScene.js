// three.js view of "Đua máy bay Pokémon": draws the engine state, never changes it.
// Engine forward distance d maps to three.js z = -d; lanes are x; the plane flies at y = ALT above the ground (y = 0).
// Look: ACES tone mapping, gradient sky dome with sun / stars / nebula, fog, hemisphere + sun light, toon shading with
// outlines, recycled scenery chunks per level, cloud puffs flying past, weather particles, vapor trails, speed lines.
import * as THREE from 'three';
import { LANE_W, LEVELS } from '../../../utils/three3d/plane3d';
import { ALT, obstacleModel } from './plane3dObstacles';
import { THEMES, CHUNK, buildChunk, windmillSails, backdropGeometry, planetGeometry, planetRingGeometry, windowTextures } from './plane3dScenery';
import { coinGeometry, ringGeometry, powerIconGeometry, finishGateGeometry, finishBannerTexture, puffGeometry } from './plane3dProps';
import { createPlane, WINGTIPS } from './planeModel';
import { toonRamp, toonMaterial, outlineMaterial, outlineOf, bubbleMaterial, lookTime } from './plane3dLook';
import { createBursts, createWeather, createTrail, createSpeedLines } from './plane3dFx';
import { glowTexture, sparkleTexture, canvasTexture } from './plane3dGeo';

const NCH = 4;
const VIEW_AHEAD = 280;
const MAX_COINS = 420;
const POWER_COLOR = { shield: '#7dd3fc', magnet: '#93c5fd', boost: '#fdba74' };

const SKY_VERT = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SKY_FRAG = `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform float uSunSize; uniform float uSunGlow; uniform float uStars; uniform float uNebula; uniform float uTime; varying vec3 vDir;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uMid, uTop, smoothstep(0.02, 0.62, h));
  col = mix(uBot, col, smoothstep(-0.04, 0.2, h));
  vec3 sd3 = normalize(uSunDir);
  float sd = max(0.0, dot(d, sd3));
  col += uSunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 40.0) * 0.5) * uSunGlow;
  if (uSunSize > 0.0) col = mix(col, uSunColor * 1.15 + 0.15, smoothstep(1.0 - uSunSize * 0.055, 1.0 - uSunSize * 0.045, sd));
  if (uNebula > 0.0) {
    float n1 = sin(d.x * 3.1 + 1.0) * sin(d.y * 4.3 + d.z * 2.7) * sin(d.z * 5.1 - d.x * 1.7);
    float n2 = sin(d.x * 7.3 - d.y * 3.1) * sin(d.z * 6.7 + 2.0);
    col += vec3(0.55, 0.18, 0.75) * max(0.0, n1) * 0.55 * uNebula + vec3(0.1, 0.45, 0.9) * max(0.0, -n1) * 0.35 * uNebula + vec3(0.9, 0.3, 0.5) * max(0.0, n2 - 0.4) * 0.4 * uNebula;
  }
  if (uStars > 0.0) {
    vec3 q = floor(d * 260.0);
    float s = hash(q);
    float tw = 0.55 + 0.45 * sin(uTime * 2.5 + s * 60.0);
    col += vec3(step(0.9965, s) * tw * 1.4 + step(0.9993, s) * 2.0) * uStars;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const WATER_VERT = `uniform float uTime; varying vec3 vW; varying float vH;
#include <fog_pars_vertex>
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  float h = sin(w.x * 0.08 + uTime * 1.3) * 0.5 + sin(w.z * 0.11 + uTime * 1.7) * 0.45 + sin((w.x + w.z) * 0.21 - uTime * 2.1) * 0.22;
  w.y += h;
  vH = h; vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FRAG = `uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform float uTime; varying vec3 vW; varying float vH;
#include <common>
#include <fog_pars_fragment>
void main(){
  float band = smoothstep(-0.2, 0.6, vH);
  vec3 col = mix(uDeep, uShallow, floor(band * 3.0) / 3.0);
  float crest = smoothstep(0.78, 0.95, vH + 0.15 * sin(vW.x * 0.9 + uTime * 2.0) * sin(vW.z * 0.7));
  col = mix(col, uFoam, crest * 0.85);
  float sp = sin(vW.x * 1.7 + uTime * 3.0) * sin(vW.z * 1.3 - uTime * 2.2);
  col += uFoam * step(0.985, sp) * 0.6;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpM = new THREE.Matrix4();
const tmpS = new THREE.Vector3();

/**
 * Create the scene inside `container`. Throws when WebGL is not available.
 * Returns { setLevel(levelIndex, flight), setLivery(livery), update(state, dt, events, view), resize(), dispose(), info() }.
 * view: { mode: 'menu' | 'map' | 'fly', countdown?: bool }
 */
export function createPlane3DScene(container, { playerImage, livery, level = 0 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  let disposed = false;
  const disposables = new Set();
  const own = (x) => {
    if (x) disposables.add(x);
    return x;
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd5efff, 70, 330);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1400);
  scene.add(camera);
  const ramp = own(toonRamp());

  // Sky dome
  const skyU = {
    uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 0.4, -1) },
    uSunColor: { value: new THREE.Color() }, uSunSize: { value: 0.03 }, uSunGlow: { value: 0.5 }, uStars: { value: 0 }, uNebula: { value: 0 }, uTime: lookTime,
  };
  const sky = new THREE.Mesh(own(new THREE.SphereGeometry(1000, 32, 16)), own(new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false })));
  sky.renderOrder = -10;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x6f9f4a, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  scene.add(sun, sun.target);

  // Shared materials
  const sceneryRim = { value: 0.2 };
  const sceneryRimColor = { value: new THREE.Color('#ffffff') };
  const sceneryMat = own(toonMaterial({ ramp, key: 'scenery', flapF: 1.4, rim: sceneryRim, rimColor: sceneryRimColor }));
  const sceneryLine = own(outlineMaterial({ width: 0.0022, max: 0.35, key: 'scenery', flapF: 1.4, darken: 0.42 }));
  const glowBoost = { value: 1 };
  const objMat = own(toonMaterial({ ramp, key: 'obst', flapF: 13, rim: 0.4, glowBoost }));
  const objLine = own(outlineMaterial({ width: 0.003, max: 0.08, key: 'obst', flapF: 13 }));
  const puffMat = own(toonMaterial({ ramp: own(toonRamp([214, 236, 250, 255])), key: 'puff', flapF: 0.8, rim: 0.55 }));
  const glowTex = own(glowTexture());
  const sparkTex = own(sparkleTexture());
  const confettiTex = own(canvasTexture(16, 16, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 1, 10, 14);
  }));

  // Ground variants (water, cloud floor) and the far backdrop ring
  const waterU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() } }]);
  waterU.uTime = lookTime;
  const waterMat = own(new THREE.ShaderMaterial({ uniforms: waterU, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, fog: true }));
  const waterGeo = own(new THREE.PlaneGeometry(1000, 1000, 100, 100).rotateX(-Math.PI / 2));
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.visible = false;
  scene.add(water);
  const floorMat = own(new THREE.MeshBasicMaterial({ color: '#ffd3e0' }));
  const floor = new THREE.Mesh(own(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2)), floorMat);
  floor.position.y = -3;
  floor.visible = false;
  scene.add(floor);
  const backdropMat = own(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  const backdrop = new THREE.Mesh(undefined, backdropMat);
  backdrop.renderOrder = -5;
  backdrop.visible = false;
  scene.add(backdrop);
  const backdropCache = new Map();

  // Space set pieces
  const planets = new THREE.Group();
  planets.visible = false;
  scene.add(planets);
  const planetMat = own(toonMaterial({ ramp, key: 'planet', rim: 0.7, rimColor: '#c7d2fe', fog: false }));
  {
    const p1 = new THREE.Mesh(own(planetGeometry(3, 60, ['#f2a65a', '#e07a3a', '#f6c48a', '#c86a3a'])), planetMat);
    p1.position.set(-260, 90, -700);
    const r1 = new THREE.Mesh(own(planetRingGeometry(60)), planetMat);
    r1.rotation.set(1.2, 0.3, 0.2);
    p1.add(r1);
    const p2 = new THREE.Mesh(own(planetGeometry(9, 26, ['#7dd3fc', '#38bdf8', '#a5f3fc', '#0ea5e9'])), planetMat);
    p2.position.set(230, 150, -640);
    const p3 = new THREE.Mesh(own(planetGeometry(15, 140, ['#4f9ae8', '#3b82f6', '#6fcf6f', '#ffffff', '#3b82f6'])), planetMat);
    p3.position.set(90, -330, -640);
    const moon = new THREE.Mesh(own(planetGeometry(21, 14, ['#d4d4d8', '#a1a1aa'])), planetMat);
    moon.position.set(120, 60, -380);
    planets.add(p1, p2, p3, moon);
  }

  // Scenery chunks
  const [winMap, winGlow] = windowTextures(canvasTexture).map(own);
  const windowMat = own(new THREE.MeshToonMaterial({ map: winMap, emissiveMap: winGlow, emissive: '#ffffff', emissiveIntensity: 0.9, vertexColors: true, gradientMap: ramp }));
  const chunkCache = new Map();
  const sailsGeo = own(windmillSails());
  const chunks = [];
  for (let i = 0; i < NCH; i++) {
    const group = new THREE.Group();
    const solid = new THREE.Mesh(undefined, sceneryMat);
    const line = outlineOf(solid, sceneryLine);
    const flat = new THREE.Mesh(undefined, sceneryMat);
    const tex = new THREE.Mesh(undefined, windowMat);
    group.add(solid, flat, tex);
    const sails = [];
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Mesh(sailsGeo, sceneryMat);
      outlineOf(s, sceneryLine);
      s.visible = false;
      group.add(s);
      sails.push(s);
    }
    scene.add(group);
    chunks.push({ start: null, group, solid, line, flat, tex, sails });
  }
  let quality = 2; // 2 rich, 1 lighter
  const chunkData = (lv, variant) => {
    const key = `${lv}:${variant}:${quality > 1 ? 1 : 0}`;
    if (!chunkCache.has(key)) {
      const c = buildChunk(lv, variant, { rich: quality > 1 });
      if (c.geo) own(c.geo);
      if (c.flat) own(c.flat);
      if (c.tex) own(c.tex);
      chunkCache.set(key, c);
    }
    return chunkCache.get(key);
  };
  const placeChunk = (c, start) => {
    c.start = start;
    const variant = ((Math.floor(start / CHUNK) % 3) + 3) % 3;
    const data = chunkData(curLevel, variant);
    c.solid.geometry = data.geo || emptyGeo;
    c.line.geometry = data.geo || emptyGeo;
    c.solid.visible = !!data.geo;
    c.flat.geometry = data.flat || emptyGeo;
    c.flat.visible = !!data.flat;
    c.tex.geometry = data.tex || emptyGeo;
    c.tex.visible = !!data.tex;
    c.group.position.z = -start;
    c.sails.forEach((s, k) => {
      const sp = data.spinners[k];
      s.visible = !!sp;
      if (sp) s.position.set(sp.p[0], sp.p[1], sp.p[2]);
    });
  };
  const emptyGeo = own(new THREE.BufferGeometry());

  // Cloud puffs flying past
  const puffGeos = [1, 2, 3].map((k) => own(puffGeometry(k * 7)));
  const puffs = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(puffGeos[i % 3], puffMat);
    m.visible = false;
    scene.add(m);
    puffs.push({ mesh: m, z: 0 });
  }
  const placePuff = (p, zMin, zMax, R = Math.random) => {
    const side = R() < 0.5 ? -1 : 1;
    let x = side * (14 + R() * 55);
    let y = ALT + (R() - 0.4) * 24;
    if (R() < 0.2) {
      x = (R() - 0.5) * 16; // high overhead
      y = ALT + 17 + R() * 8;
    }
    p.z = zMin + R() * (zMax - zMin);
    p.mesh.position.set(x, y, -p.z);
    const s = 1.2 + R() * 1.8;
    p.mesh.scale.set(s, s * (0.7 + R() * 0.3), s);
    p.mesh.rotation.y = R() * 6;
  };

  // Plane
  const plane = createPlane({ livery, ramp });
  scene.add(plane.group);
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  if (playerImage) {
    try {
      loader.load(
        playerImage,
        (t) => {
          if (disposed) {
            t.dispose();
            return;
          }
          t.colorSpace = THREE.SRGBColorSpace;
          own(t);
          plane.setPilot(t);
        },
        undefined,
        () => {}
      );
    } catch {
      // keep the placeholder
    }
  }
  const shadowMat = own(new THREE.MeshBasicMaterial({ map: glowTex, color: '#000000', transparent: true, opacity: 0.22, depthWrite: false }));
  const shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(4.2, 3.4).rotateX(-Math.PI / 2)), shadowMat);
  shadow.renderOrder = 2;
  scene.add(shadow);
  // dizzy stars (after a hit)
  const dizzyMat = own(new THREE.SpriteMaterial({ map: sparkTex, color: '#fde047', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const dizzy = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Sprite(dizzyMat);
    s.scale.set(0.55, 0.55, 1);
    dizzy.add(s);
  }
  dizzy.visible = false;
  scene.add(dizzy);

  const trails = [createTrail(44, 0.06), createTrail(44, 0.06)];
  trails.forEach((t) => scene.add(t.mesh));
  const speedLines = createSpeedLines();
  camera.add(speedLines.object);
  speedLines.object.position.set(0, 0, 0);
  const bursts = createBursts(sparkTex, confettiTex);
  bursts.objects.forEach((o) => scene.add(o));
  const weather = createWeather(sparkTex);
  scene.add(weather.object);

  // Coins (instanced), star rings, power-ups
  const coinMat = own(toonMaterial({ ramp, key: 'coin', rim: 0.6, rimColor: '#fff7cc' }));
  const coins = new THREE.InstancedMesh(own(coinGeometry()), coinMat, MAX_COINS);
  coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  coins.frustumCulled = false;
  coins.count = 0;
  const coinLine = outlineOf(coins, objLine);
  scene.add(coins, coinLine);
  const ringGeo = own(ringGeometry());
  const ringGlowMat = own(new THREE.SpriteMaterial({ map: glowTex, color: '#ffe680', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  const rings = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(ringGeo, coinMat);
    outlineOf(m, objLine);
    const g = new THREE.Sprite(ringGlowMat);
    g.scale.set(4.4, 4.4, 1);
    m.add(g);
    m.visible = false;
    scene.add(m);
    rings.push(m);
  }
  const bubbleGeo = own(new THREE.IcosahedronGeometry(1.15, 3));
  const powerPools = {};
  for (const kind of ['shield', 'magnet', 'boost']) {
    const icon = own(powerIconGeometry(kind));
    const bm = own(bubbleMaterial(POWER_COLOR[kind], { power: 2.0, strength: 1.3, base: 0.12 }));
    powerPools[kind] = [0, 1, 2].map(() => {
      const g = new THREE.Group();
      const ic = new THREE.Mesh(icon, objMat);
      outlineOf(ic, objLine);
      ic.scale.setScalar(1.25);
      const b = new THREE.Mesh(bubbleGeo, bm);
      const halo = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowTex, color: POWER_COLOR[kind], transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })));
      halo.scale.set(4, 4, 1);
      g.add(ic, b, halo);
      g.visible = false;
      g.userData.icon = ic;
      scene.add(g);
      return g;
    });
  }

  // Obstacle pools (per kind + theme)
  const modelCache = new Map();
  const pools = new Map();
  const getModel = (kind, theme) => {
    const key = `${kind}:${theme}`;
    if (!modelCache.has(key)) {
      const m = obstacleModel(kind, theme);
      own(m.geo);
      if (m.blades) own(m.blades);
      modelCache.set(key, m);
    }
    return modelCache.get(key);
  };
  const trailMat = own(new THREE.MeshBasicMaterial({ color: '#ff9a3a', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
  const trailGeo = own(new THREE.ConeGeometry(0.9, 5, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -2.6));
  const emberMat = own(new THREE.SpriteMaterial({ map: glowTex, color: '#ff8a2a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  const flashMat = own(new THREE.SpriteMaterial({ map: glowTex, color: '#fff3a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const makeObstacleMesh = (kind, theme) => {
    const m = getModel(kind, theme);
    const g = new THREE.Group();
    const body = new THREE.Mesh(m.geo, objMat);
    outlineOf(body, objLine);
    g.add(body);
    if (m.blades) {
      const b = new THREE.Mesh(m.blades, objMat);
      outlineOf(b, objLine);
      b.position.set(...m.bladesAt);
      body.add(b);
      g.userData.blades = b;
    }
    if (m.trail) {
      const t = new THREE.Mesh(trailGeo, trailMat);
      t.rotation.x = -0.5;
      t.position.set(0, 0.6, -0.4);
      g.add(t);
      g.userData.trail = t;
    }
    if (m.embers || m.lightning) {
      const e = new THREE.Sprite(m.lightning ? flashMat : emberMat);
      e.scale.set(m.lightning ? 5 : 3, m.lightning ? 5 : 3, 1);
      e.position.set(0, m.lightning ? -0.8 : 1.6, 0.4);
      g.add(e);
      g.userData.glow = e;
    }
    g.userData.body = body;
    g.userData.model = m;
    g.visible = false;
    scene.add(g);
    return g;
  };
  const poolFor = (kind, theme) => {
    const key = `${kind}:${theme}`;
    if (!pools.has(key)) pools.set(key, { free: [], kind, theme });
    return pools.get(key);
  };
  const assigned = new Map(); // obstacle id -> mesh group

  // Finish gate
  const gate = new THREE.Group();
  const gateMesh = new THREE.Mesh(undefined, objMat);
  const gateLine = outlineOf(gateMesh, objLine);
  void gateLine;
  gate.add(gateMesh);
  const bannerTex = own(finishBannerTexture());
  const banner = new THREE.Mesh(own(new THREE.PlaneGeometry(9, 2.25)), own(new THREE.MeshToonMaterial({ map: bannerTex, gradientMap: ramp, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.15, emissiveMap: bannerTex })));
  banner.position.set(0, 5.4, 0);
  gate.add(banner);
  const gateGlow = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowTex, color: '#fff3c4', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
  gateGlow.scale.set(20, 14, 1);
  gateGlow.position.set(0, 3, -1);
  gate.add(gateGlow);
  scene.add(gate);
  const gateGeoCache = new Map();

  // ---------------------------------------------------------------- level setup
  let curLevel = -1;
  let theme = THEMES[0];
  let flightRef = null;
  const camPos = new THREE.Vector3(0, ALT + 4, 12);
  const camLook = new THREE.Vector3(0, ALT, -20);
  let fov = 60;
  let snapNext = true;

  function applyTheme(lv) {
    theme = THEMES[lv];
    const T = theme;
    skyU.uTop.value.set(T.sky[0]);
    skyU.uMid.value.set(T.sky[1]);
    skyU.uBot.value.set(T.sky[2]);
    skyU.uSunDir.value.set(...T.sun.dir).normalize();
    skyU.uSunColor.value.set(T.sun.color);
    skyU.uSunSize.value = T.sun.size;
    skyU.uSunGlow.value = T.sun.glow;
    skyU.uStars.value = T.stars ? 1 : T.key === 'city' ? 0.25 : T.key === 'volcano' ? 0.2 : 0;
    skyU.uNebula.value = T.nebula ? 1 : 0;
    scene.fog.color.set(T.fog[0]);
    scene.fog.near = T.fog[1];
    scene.fog.far = T.fog[2];
    hemi.color.set(T.hemi[0]);
    hemi.groundColor.set(T.hemi[1]);
    hemi.intensity = T.hemi[2];
    sun.color.set(T.dir[0]);
    sun.intensity = T.dir[1];
    glowBoost.value = T.glowBoost || 1;
    sceneryRim.value = T.cave ? 0.12 : T.key === 'volcano' ? 0.3 : 0.2;
    sceneryRimColor.value.set(T.cave ? '#a78bfa' : T.key === 'volcano' ? '#ff9a5a' : T.key === 'city' ? '#ffd0b0' : T.key === 'sunset' ? '#ffd6e0' : '#ffffff');
    water.visible = T.ground === 'water';
    if (water.visible) {
      waterU.uDeep.value.set(T.water.deep);
      waterU.uShallow.value.set(T.water.shallow);
      waterU.uFoam.value.set(T.water.foam);
    }
    floor.visible = T.ground === 'clouds';
    if (floor.visible) floorMat.color.set('#f9c9d6');
    if (!backdropCache.has(lv)) {
      const g = backdropGeometry(lv);
      if (g) own(g);
      backdropCache.set(lv, g);
    }
    const bg = backdropCache.get(lv);
    backdrop.visible = !!bg;
    if (bg) backdrop.geometry = bg;
    planets.visible = T.key === 'space';
    puffMat.color.set(T.puffs ? T.puffs.color : '#ffffff');
    weather.setKind(T.particles, camPos);
    renderer.toneMappingExposure = T.key === 'cave' ? 1.12 : T.key === 'space' ? 1.08 : 1.0;
  }

  function setLevel(lv, flight = null) {
    flightRef = flight;
    snapNext = true;
    if (lv !== curLevel) {
      curLevel = lv;
      applyTheme(lv);
      for (const c of chunks) c.start = null;
    }
    // every obstacle mesh goes back to its pool (pools of other levels stay cached)
    for (const [, g] of assigned) poolFor(g.userData.poolKind, g.userData.poolTheme).free.push(g);
    assigned.clear();
    for (const p of pools.values()) for (const g of p.free) g.visible = false;
    bursts.clear();
    trails.forEach((t) => t.reset());
    const T = THEMES[lv];
    const ground = T.ground === 'none' || T.ground === 'clouds' ? -6 : -ALT;
    const gkey = `${ground}`;
    if (!gateGeoCache.has(gkey)) gateGeoCache.set(gkey, own(finishGateGeometry(ground)));
    gateMesh.geometry = gateGeoCache.get(gkey);
    gateMesh.children[0].geometry = gateMesh.geometry;
    gate.position.set(0, ALT, -(flight ? flight.length : 99999));
    gate.visible = !!flight;
    puffs.forEach((p) => {
      p.mesh.visible = !!T.puffs;
      placePuff(p, -10, VIEW_AHEAD);
    });
  }

  function setLivery(L) {
    plane.setLivery(L);
  }

  // ---------------------------------------------------------------- frame
  let frameAvg = 1 / 60;
  let slowT = 0;
  let infoT = 0;
  let menuT = 0;
  let lastPhase = null;
  const wingW = [new THREE.Vector3(), new THREE.Vector3()];

  function emitAt(x, y, z, opts) {
    tmpV.set(x, y, z);
    bursts.emit(tmpV, opts);
  }

  function handleEvents(s, events) {
    for (const e of events) {
      switch (e.type) {
        case 'coin':
          emitAt(e.x, ALT + (e.y || 0), -e.z, { count: 7, colors: ['#ffe066', '#fff7cc', '#ffb703'], speed: 4, life: 0.45, size: 0.7, gravity: 2, up: 1.5 });
          break;
        case 'ring':
          emitAt(e.x, ALT + 0.3, -e.z, { count: 40, colors: ['#ffe066', '#ffffff', '#ffd23f', '#fff3a0'], speed: 9, life: 0.9, size: 1.1, gravity: 1, up: 1, spread: 2.4 });
          break;
        case 'power':
          emitAt(e.x, ALT, -e.z, { count: 30, colors: [POWER_COLOR[e.kind], '#ffffff'], speed: 8, life: 0.8, size: 1.0, gravity: 0.5, up: 0.5, spread: 1.5 });
          break;
        case 'hit':
          emitAt(s.x, ALT + 0.5, -s.d - 1, { count: 22, colors: ['#ffffff', '#fde047', '#fbcfe8'], speed: 7, life: 0.8, size: 1.0, gravity: 2, up: 2 });
          break;
        case 'bump':
          emitAt(s.x, ALT, -s.d, { count: 10, colors: ['#ffffff', '#bae6fd'], speed: 4, life: 0.5, size: 0.7 });
          break;
        case 'shieldBreak':
          emitAt(s.x, ALT, -s.d - 1, { count: 36, colors: ['#7dd3fc', '#ffffff', '#a5f3fc'], speed: 9, life: 0.8, size: 1.0, gravity: 0, up: 0, spread: 2 });
          break;
        case 'smash':
          emitAt(e.x, ALT, -e.z, { count: 26, colors: ['#fdba74', '#ffffff', '#fde047'], speed: 10, life: 0.7, size: 1.0, gravity: 1, up: 2, spread: 1.5 });
          break;
        case 'nearMiss':
          emitAt(s.x, ALT, -s.d - 0.5, { count: 8, colors: ['#ffffff', '#f9a8d4'], speed: 3, life: 0.5, size: 0.6, gravity: 0 });
          break;
        case 'continue':
          emitAt(s.x, ALT, -s.d, { count: 40, colors: ['#fde047', '#ffffff', '#86efac'], speed: 8, life: 1, size: 1, gravity: 0, up: 1, spread: 2 });
          break;
        case 'finish':
          for (let k = 0; k < 4; k++) emitAt((k - 1.5) * 4, ALT + 7, -s.length - 2, { count: 70, confetti: true, colors: ['#ef4444', '#facc15', '#38bdf8', '#4ade80', '#f472b6', '#ffffff', '#a78bfa'], speed: 9, life: 2.6, size: 1.1, gravity: 4, up: 4, spread: 2, drag: 1.2 });
          break;
        default:
      }
    }
  }

  function drawWorld(s, dt, mode) {
    const d = s ? s.d : 0;
    const t = lookTime.value;
    // Chunks: keep NCH consecutive chunks from one behind the plane
    const first = Math.floor((d - 30) / CHUNK) * CHUNK;
    const want = new Set();
    for (let i = 0; i < NCH; i++) want.add(first + i * CHUNK);
    for (const c of chunks) if (c.start == null || !want.has(c.start)) c.start = null;
    for (const start of want) {
      if (chunks.some((c) => c.start === start)) continue;
      const c = chunks.find((q) => q.start == null);
      if (c) placeChunk(c, start);
    }
    for (const c of chunks) {
      c.group.visible = c.start != null;
      c.line.visible = quality > 1 && c.start != null && c.start - d < 150; // far chunks skip the outline pass
      for (const sp of c.sails) if (sp.visible) sp.rotation.z = t * 0.9 + c.start;
    }
    // Puffs recycle when they pass behind the camera
    if (theme.puffs) for (const p of puffs) if (p.z < d - 15) placePuff(p, d + VIEW_AHEAD * 0.7, d + VIEW_AHEAD);

    // Ground follows the camera (snapped to the wave pattern so it does not slide)
    water.position.set(Math.round(camera.position.x / 20) * 20, 0, Math.round(camera.position.z / 20) * 20);
    floor.position.x = camera.position.x;
    floor.position.z = camera.position.z;
    backdrop.position.set(camera.position.x, 0, camera.position.z);
    sky.position.copy(camera.position);
    planets.position.set(camera.position.x * 0.9, 0, camera.position.z);

    if (!s || mode !== 'fly') {
      coins.count = 0;
      coinLine.count = 0;
      rings.forEach((r) => (r.visible = false));
      for (const k of Object.keys(powerPools)) powerPools[k].forEach((g) => (g.visible = false));
      for (const [, g] of assigned) g.visible = false;
      return;
    }

    // Obstacles in view
    const live = new Set();
    for (const o of s.obstacles) {
      if (o.z < d - 25) continue;
      if (o.z > d + VIEW_AHEAD) break;
      live.add(o.id);
      let g = assigned.get(o.id);
      const th = o.kind === 'rock' ? theme.rock : o.kind === 'hotair' ? (theme.hotair + Math.floor(o.seed * 3)) % 3 : 0;
      if (!g) {
        const pool = poolFor(o.kind, th);
        g = pool.free.pop() || makeObstacleMesh(o.kind, th);
        g.userData.poolKind = o.kind;
        g.userData.poolTheme = th;
        g.userData.goneT = 0;
        g.userData.hitT = 0;
        assigned.set(o.id, g);
      }
      const m = g.userData.model;
      g.visible = true;
      g.userData.body.children[0].visible = o.z - d < 120; // outlines only where they can be seen
      const ph = o.seed * 10;
      const bob = (m.bob || 0) * Math.sin(t * 1.6 + ph);
      g.position.set(o.x, ALT + bob, -o.z);
      g.rotation.set(0, (m.spinY || 0) * t + (o.kind === 'hotair' ? o.seed * 6 : 0), (m.spinZ || 0) * Math.sin(t * 0.6 + ph));
      if (m.tumble) g.userData.body.rotation.set(t * m.tumble + ph, t * m.tumble * 0.6, 0);
      if (g.userData.blades) g.userData.blades.rotation.z = t * 2.2 + ph;
      if (g.userData.glow) {
        const e = g.userData.glow;
        if (m.lightning) e.material.opacity = Math.max(0, Math.sin(t * 7 + ph) * Math.sin(t * 2.3 + ph * 1.7)) * 0.9;
        else e.material.opacity = 0.5 + 0.3 * Math.sin(t * 5 + ph);
      }
      if (g.userData.trail) g.userData.trail.scale.set(1, 1, 0.85 + 0.2 * Math.sin(t * 20 + ph));
      // hit / smash / pop reactions (kid-friendly: bounce aside, sparkle, shrink away)
      let sc = 1;
      if (o.hit) {
        g.userData.hitT += dt;
        const k = g.userData.hitT;
        sc = 1 + 0.25 * Math.exp(-k * 5) * Math.sin(k * 30);
        g.position.x += Math.sign(o.x - s.x || 1) * Math.min(1, k * 3) * 0.9;
      }
      if (o.gone) {
        g.userData.goneT += dt;
        const k = g.userData.goneT;
        sc = Math.max(0.001, 1 - k * 2.2);
        g.position.y += k * 8;
        g.position.x += Math.sign(o.x || 1) * k * 10;
        g.rotation.z += k * 6;
      }
      g.scale.setScalar(sc);
    }
    for (const [id, g] of assigned) {
      if (live.has(id)) continue;
      g.visible = false;
      poolFor(g.userData.poolKind, g.userData.poolTheme).free.push(g);
      assigned.delete(id);
    }

    // Coins
    let n = 0;
    for (const c of s.coinList) {
      if (c.taken) continue;
      if (c.z < d - 6) continue;
      if (c.z > d + 175) break;
      if (n >= MAX_COINS) break;
      const bob = Math.sin(t * 3 + c.z * 0.3) * 0.12;
      tmpQ.setFromEuler(tmpE.set(0, t * 3.2 + c.z * 0.25, 0));
      tmpS.setScalar(c.mag ? 0.8 : 1);
      tmpM.compose(tmpV.set(c.x, ALT + (c.y || 0) + bob, -c.z), tmpQ, tmpS);
      coins.setMatrixAt(n++, tmpM);
    }
    coins.count = n;
    coinLine.count = n;
    coins.instanceMatrix.needsUpdate = true;

    // Rings
    let ri = 0;
    for (const r of s.ringList) {
      if (r.taken || r.z < d - 6 || r.z > d + VIEW_AHEAD) continue;
      if (ri >= rings.length) break;
      const m = rings[ri++];
      m.visible = true;
      m.position.set(r.x, ALT + r.y + Math.sin(t * 2 + r.z) * 0.1, -r.z);
      m.rotation.set(0, 0, t * 0.8);
      m.scale.setScalar(1 + 0.05 * Math.sin(t * 5));
    }
    for (; ri < rings.length; ri++) rings[ri].visible = false;

    // Power-ups
    const used = { shield: 0, magnet: 0, boost: 0 };
    for (const p of s.pickups) {
      if (p.taken || p.z < d - 6 || p.z > d + VIEW_AHEAD) continue;
      const pool = powerPools[p.kind];
      if (used[p.kind] >= pool.length) continue;
      const g = pool[used[p.kind]++];
      g.visible = true;
      g.position.set(p.x, ALT + 0.3 + Math.sin(t * 2.4 + p.z) * 0.25, -p.z);
      g.userData.icon.rotation.y = t * 1.8;
    }
    for (const k of Object.keys(powerPools)) for (let i = used[k]; i < powerPools[k].length; i++) powerPools[k][i].visible = false;
  }

  function drawPlane(s, dt, mode, view) {
    const t = lookTime.value;
    const g = plane.group;
    if (!s || mode !== 'fly') {
      // Showcase: the plane hovers while the camera orbits it
      menuT += dt;
      g.position.set(0, ALT + Math.sin(t * 1.4) * 0.25, 0);
      g.rotation.set(0, 0, 0);
      plane.tilt.rotation.set(Math.sin(t * 1.1) * 0.04, 0, Math.sin(t * 0.9) * 0.12);
      plane.update(dt, { prop: 1, t });
      plane.flash.value = 0;
      shadow.visible = theme.ground !== 'none' && theme.ground !== 'clouds';
      shadow.position.set(0, 0.05 + (theme.ground === 'water' ? 0.6 : 0), 0);
      dizzy.visible = false;
      trails.forEach((tr) => tr.mesh.visible = false);
      const a = menuT * 0.35 + 0.6;
      const r = mode === 'map' ? 10 : 8.6;
      camPos.set(Math.sin(a) * r, ALT + (mode === 'map' ? 4 : 1.6), Math.cos(a) * r);
      camLook.set(0, ALT + (mode === 'map' ? 1.2 : -0.9), 0);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      fov = 55;
      speedLines.update(dt, 0, 0);
      return;
    }
    menuT = 0;
    const boost = s.power.boost > 0;
    const hover = Math.sin(t * 1.7) * 0.18;
    let roll = s.bank + Math.sin(t * 22) * s.wobble * 0.3;
    let pitch = Math.sin(t * 17) * s.wobble * 0.12 + (boost ? -0.04 : 0);
    let y = ALT + hover;
    if (s.phase === 'finish') roll += Math.min(1, s.finishT / 1.1) * Math.PI * 2; // a happy barrel roll through the gate
    if (s.phase === 'down') {
      pitch -= 0.12;
      y -= Math.min(1.2, s.downT * 1.5);
      roll += Math.sin(t * 6) * 0.15;
    }
    g.position.set(s.x, y, -s.d);
    g.rotation.set(0, s.yaw, 0);
    plane.tilt.rotation.set(pitch, 0, roll);
    plane.update(dt, { prop: s.phase === 'ready' ? s.prop : s.phase === 'down' ? 0.5 : 1, boost, shield: s.power.shield > 0, magnet: s.power.magnet > 0, t });
    plane.flash.value = s.invuln > 0 && s.phase === 'fly' && !boost ? (Math.sin(t * 28) > 0 ? 0.55 : 0) : s.wobble * 0.5;
    shadow.visible = theme.ground !== 'none' && theme.ground !== 'clouds';
    shadow.position.set(s.x, theme.ground === 'water' ? 0.7 : 0.25, -s.d + 0.4);
    // Dizzy stars after a hit
    dizzy.visible = s.wobble > 0.05 || s.phase === 'down';
    if (dizzy.visible) {
      dizzy.position.set(s.x, y + 1.2, -s.d);
      dizzy.children.forEach((c, k) => {
        const a = t * 5 + (k / 4) * Math.PI * 2;
        c.position.set(Math.cos(a) * 0.9, Math.sin(a * 2) * 0.1, Math.sin(a) * 0.9);
      });
    }
    // Vapor trails from the wingtips
    g.updateMatrixWorld(true);
    const up = tmpV.set(0, 1, 0).applyQuaternion(plane.tilt.getWorldQuaternion(tmpQ)).clone();
    const vapor = Math.min(1, Math.abs(s.bank) * 1.6 + (boost ? 0.7 : 0.18)) * (s.phase === 'ready' ? 0 : 1);
    WINGTIPS.forEach((w, i) => {
      wingW[i].copy(w);
      plane.tilt.localToWorld(wingW[i]);
      trails[i].mesh.visible = true;
      trails[i].push(wingW[i], up, vapor * 0.75);
    });
    // afterburner sparks streaming behind while boosting
    if (boost && s.phase === 'fly') {
      tmpS.set(0, 0, 2.2);
      plane.tilt.localToWorld(tmpS);
      bursts.emit(tmpS, { count: 3, colors: ['#ffb347', '#ff7a1a', '#ffe08a'], speed: 2.5, life: 0.35, size: 0.9, gravity: 0, up: 0.5, spread: 0.5 });
    }

    // Chase camera: behind and above, smooth, no shake
    const snapNow = view.snap || snapNext;
    snapNext = false;
    const k = 1 - Math.exp(-dt * 5);
    const target = tmpV.set(s.x * 0.55, ALT + 4.1, -s.d + 11.2);
    camPos.lerp(target, snapNow ? 1 : k);
    camLook.lerp(tmpS.set(s.x * 0.8, ALT + 0.7, -s.d - 20), snapNow ? 1 : 1 - Math.exp(-dt * 7));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    fov += ((boost ? 70 : 60) + (s.phase === 'finish' ? 4 : 0) - fov) * Math.min(1, dt * 3);
    speedLines.update(dt, s.speed, s.phase === 'fly' || s.phase === 'finish' ? (boost ? 0.75 : 0.16 + Math.min(0.12, (s.speed - 15) * 0.01)) : 0);
  }

  function update(s, dt, events = [], view = { mode: 'fly' }) {
    if (disposed) return;
    lookTime.value += dt;
    const mode = view.mode || 'fly';
    const lv = s ? s.level : view.level ?? 0;
    if (lv !== curLevel) setLevel(lv, mode === 'fly' ? s : null);
    if (mode === 'fly' && s && flightRef !== s) setLevel(lv, s);
    if (events.length && s) handleEvents(s, events);
    drawPlane(s, dt, mode, view);
    drawWorld(s, dt, mode);
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    sun.position.set(camera.position.x - 30, camera.position.y + 60, camera.position.z + 20);
    sun.target.position.set(camera.position.x, 0, camera.position.z - 40);
    const scale = renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    bursts.update(dt, scale * 0.42);
    weather.update(dt, tmpV.copy(camera.position).add(new THREE.Vector3(0, -2, 0)), lookTime.value, scale);
    renderer.render(scene, camera);
    lastPhase = s?.phase;

    // Adaptive quality: drop the pixel ratio (then the decorations) when frames are slow for a while
    frameAvg = frameAvg * 0.95 + dt * 0.05;
    if (frameAvg > 1 / 38) slowT += dt;
    else slowT = Math.max(0, slowT - dt * 0.5);
    if (slowT > 3) {
      slowT = 0;
      if (pixelRatio > 1) {
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        resize();
      } else if (quality > 1) {
        quality = 1;
        for (const c of chunks) c.start = null;
        for (const c of chunks) c.line.visible = false;
        weather.setCount(0.5);
      }
    }
    infoT += dt;
    if (infoT > 1) {
      infoT = 0;
      container.dataset.tris = String(renderer.info.render.triangles);
      container.dataset.calls = String(renderer.info.render.calls);
    }
  }

  function resize() {
    const w = container.clientWidth || 360;
    const h = container.clientHeight || 640;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(resize);
    ro.observe(container);
  } else window.addEventListener('resize', resize);

  setLevel(level, null);

  function dispose() {
    disposed = true;
    ro?.disconnect();
    window.removeEventListener('resize', resize);
    plane.dispose();
    trails.forEach((t) => t.dispose());
    speedLines.dispose();
    bursts.dispose();
    weather.dispose();
    for (const d of disposables) d.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
  }

  return {
    setLevel,
    setLivery,
    update,
    resize,
    dispose,
    info: () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, lastPhase, levels: LEVELS.length, lane: LANE_W }),
  };
}
