// three.js view of "Pokémon Chạy 3 làn": draws the engine state, never changes it.
// Engine forward distance f maps to three.js z = -f (the camera looks down -z, +x is right).
import * as THREE from 'three';
import { artworkUrl } from '../../../services/pokemonOnlineService';
import { LANE_W, CRATE, worldAt } from '../../../utils/three3d/run3d';
import {
  canvasTexture, drawTrack, drawGround, drawGlow, drawShadow, drawWarn, drawStar, drawCoinFace, drawBanner, drawCrate, drawBalloon, drawZzz, drawPower,
  drawPlaceholder, buildChunk, CHUNK_LEN, barrierGeometry, barPostsGeometry, basketGeometry, rng,
} from './run3dArt';

const DEX = { zubat: 41, snorlax: 143, geodude: 74 };

// World palettes (forest, city, cave, beach), crossfaded as the run goes on
const PAL = [
  { skyTop: 0x3d9cf0, skyBot: 0xd6f2ff, fog: 0xcdeefb, near: 40, far: 155, ground: 0x6cc24a, track: 0xd8ad74, hemiSky: 0xffffff, hemiGround: 0x6b8f3a, hemi: 1.05, sun: 0xfff1d0, sunI: 1.5, disc: 0xfff6c8, discY: 55, discA: 0.85, tint: 0xffffff },
  { skyTop: 0x29306e, skyBot: 0xff9f70, fog: 0xeaa68a, near: 40, far: 155, ground: 0x8d96a3, track: 0x5b6472, hemiSky: 0xffe2c8, hemiGround: 0x404860, hemi: 0.95, sun: 0xffc99a, sunI: 1.25, disc: 0xffd2a0, discY: 14, discA: 0.9, tint: 0xfff0e6 },
  { skyTop: 0x0d0820, skyBot: 0x3a2860, fog: 0x2d2050, near: 22, far: 100, ground: 0x4b3f63, track: 0x85779c, hemiSky: 0xc4b3ff, hemiGround: 0x2a1f40, hemi: 0.95, sun: 0xd2c4ff, sunI: 0.8, disc: 0x9b7bff, discY: 30, discA: 0, tint: 0xe6dcff },
  { skyTop: 0xff6fa8, skyBot: 0xffd27a, fog: 0xffc79a, near: 40, far: 155, ground: 0xf3d79e, track: 0xeccb8f, hemiSky: 0xfff0d8, hemiGround: 0xd8a070, hemi: 1.05, sun: 0xffb37a, sunI: 1.3, disc: 0xffe08a, discY: 9, discA: 1, tint: 0xfff3e6 },
].map((p) => {
  const o = { ...p };
  for (const k of Object.keys(p)) if (['skyTop', 'skyBot', 'fog', 'ground', 'track', 'hemiSky', 'hemiGround', 'sun', 'disc', 'tint'].includes(k)) o[k] = new THREE.Color(p[k]);
  return o;
});
const POWER_COLOR = { magnet: 0x60a5fa, shield: 0x7dd3fc, double: 0xfacc15, revive: 0xfde047, boost: 0xfb923c };

const TRACK_LEN = 300;
const TRACK_W = LANE_W * 3 + 0.8;
const NCH = 5;
const MAX_COINS = 180;

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = `uniform vec3 uTop; uniform vec3 uBot; varying vec3 vDir;
void main(){ float h = clamp(vDir.y * 1.8 + 0.05, 0.0, 1.0); gl_FragColor = vec4(mix(uBot, uTop, pow(h, 0.75)), 1.0); }`;
const PT_VERT = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale; varying float vAlpha; varying vec3 vColor;
void main(){ vAlpha = aAlpha; vColor = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PT_FRAG = `uniform sampler2D uTex; varying float vAlpha; varying vec3 vColor;
void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha); }`;

/**
 * Create the scene inside `container`. Throws when WebGL is not available.
 * Returns { update(state, dt, events), resize(), dispose() }.
 */
export function createRun3DScene(container, { playerImage, playerColor = '#fbbf24' } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const disposables = new Set();
  const own = (x) => {
    if (x) disposables.add(x);
    return x;
  };
  const tex = (w, h, draw, opts) => own(canvasTexture(w, h, draw, opts));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcdeefb, 40, 155);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
  scene.add(camera);

  // Sky dome and sun / moon
  const skyMat = own(new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() } }, side: THREE.BackSide, depthWrite: false, fog: false }));
  const sky = new THREE.Mesh(own(new THREE.SphereGeometry(480, 24, 12)), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);
  const glowTex = tex(64, 64, drawGlow);
  const sunMat = own(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  const sun = new THREE.Sprite(sunMat);
  sun.scale.set(60, 60, 1);
  sun.renderOrder = -9;
  scene.add(sun);
  const sunCoreMat = own(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, fog: false }));
  const sunCore = new THREE.Sprite(sunCoreMat);
  sunCore.scale.set(16, 16, 1);
  sunCore.renderOrder = -8;
  scene.add(sunCore);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x6b8f3a, 1.05);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.5);
  dir.position.set(-6, 12, 8);
  scene.add(dir);
  scene.add(dir.target);

  // Track and ground follow the runner; their textures scroll so the world seems to move
  const trackTex = tex(256, 256, drawTrack, { repeat: true });
  trackTex.repeat.set(1, TRACK_LEN / 6);
  const trackMat = own(new THREE.MeshLambertMaterial({ map: trackTex, color: 0xd8ad74 }));
  const trackGeo = own(new THREE.PlaneGeometry(TRACK_W, TRACK_LEN));
  trackGeo.rotateX(-Math.PI / 2);
  const track = new THREE.Mesh(trackGeo, trackMat);
  track.position.y = 0.01;
  scene.add(track);
  const groundTex = tex(128, 128, drawGround, { repeat: true });
  const GROUND = 420;
  groundTex.repeat.set(GROUND / 6, GROUND / 6);
  const groundMat = own(new THREE.MeshLambertMaterial({ map: groundTex, color: 0x6cc24a }));
  const groundGeo = own(new THREE.PlaneGeometry(GROUND, GROUND));
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.02;
  scene.add(ground);
  const scroll = (t, center, len, tile) => {
    const v = center / tile - len / (2 * tile);
    t.offset.y = v - Math.floor(v);
  };

  // Scenery chunks (merged low-poly geometry per world and layout)
  const solidMat = own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  const glowMat = own(new THREE.MeshBasicMaterial({ vertexColors: true }));
  const chunkCache = new Map();
  const chunkGeo = (world, variant) => {
    const key = `${world}:${variant}`;
    if (!chunkCache.has(key)) {
      const g = buildChunk(world, variant);
      own(g.solid);
      own(g.glow);
      chunkCache.set(key, g);
    }
    return chunkCache.get(key);
  };
  const chunks = [];
  for (let i = 0; i < NCH; i++) {
    const solid = new THREE.Mesh(undefined, solidMat);
    const glow = new THREE.Mesh(undefined, glowMat);
    const group = new THREE.Group();
    group.add(solid, glow);
    scene.add(group);
    chunks.push({ start: null, group, solid, glow });
  }
  const placeChunk = (c, start) => {
    c.start = start;
    const w = worldAt(start + CHUNK_LEN / 2).index;
    const variant = Math.floor(start / CHUNK_LEN) % 3;
    const g = chunkGeo(w, variant);
    c.solid.geometry = g.solid || emptyGeo;
    c.glow.geometry = g.glow || emptyGeo;
    c.solid.visible = !!g.solid;
    c.glow.visible = !!g.glow;
    c.group.position.z = -start;
  };
  const emptyGeo = own(new THREE.BufferGeometry());

  // Shared bits
  const shadowTex = tex(64, 64, drawShadow);
  const warnTex = tex(128, 128, drawWarn);
  const shadowGeo = own(new THREE.PlaneGeometry(1, 1));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = own(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
  const makeShadow = (size) => {
    const m = new THREE.Mesh(shadowGeo, shadowMat);
    m.scale.set(size, 1, size * 0.8);
    m.position.y = 0.03;
    m.renderOrder = 1;
    return m;
  };

  // Pokémon artwork textures (with a coloured placeholder until they load)
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const artCache = new Map();
  const artMaterial = (url, color) => {
    const key = `${url}|${color}`;
    if (artCache.has(key)) return artCache.get(key);
    const mat = own(new THREE.SpriteMaterial({ map: tex(64, 64, drawPlaceholder(color)), transparent: true, alphaTest: 0.08 }));
    artCache.set(key, mat);
    if (url) {
      try {
        loader.load(
          url,
          (t) => {
            if (disposed) {
              t.dispose();
              return;
            }
            t.colorSpace = THREE.SRGBColorSpace;
            own(t);
            mat.map = t;
            mat.needsUpdate = true;
          },
          undefined,
          () => {}
        );
      } catch {
        // keep the placeholder
      }
    }
    return mat;
  };

  // ---------------------------------------------------------------- player
  const playerMat = own(new THREE.SpriteMaterial({ map: tex(64, 64, drawPlaceholder(playerColor)), transparent: true, alphaTest: 0.08 }));
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
          playerMat.map = t;
          playerMat.needsUpdate = true;
        },
        undefined,
        () => {}
      );
    } catch {
      // placeholder stays
    }
  }
  const player = new THREE.Sprite(playerMat);
  player.center.set(0.5, 0.06);
  scene.add(player);
  const playerShadow = makeShadow(1.5);
  scene.add(playerShadow);
  // Bubble: bright at the rim, clear in the middle (fresnel)
  const shieldMat = own(
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x9ee7ff) }, uOpacity: { value: 1 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uColor, (0.04 + f * 0.85) * uOpacity); }',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const shield = new THREE.Mesh(own(new THREE.SphereGeometry(1.25, 24, 16)), shieldMat);
  const ringMat = own(new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.8 }));
  const shieldRing = new THREE.Mesh(own(new THREE.TorusGeometry(1.26, 0.022, 6, 48)), ringMat);
  shieldRing.rotation.x = Math.PI / 2;
  shield.add(shieldRing);
  scene.add(shield);
  const powerTex = {};
  const powerSpriteMat = {};
  for (const k of ['magnet', 'shield', 'double', 'revive', 'boost']) {
    powerTex[k] = tex(128, 128, drawPower(k));
    powerSpriteMat[k] = own(new THREE.SpriteMaterial({ map: powerTex[k], transparent: true, depthWrite: false }));
  }
  const orbit = new THREE.Sprite(powerSpriteMat.magnet);
  orbit.scale.set(0.6, 0.6, 1);
  scene.add(orbit);
  const starTex = tex(64, 64, drawStar);
  const dizzyMat = own(new THREE.SpriteMaterial({ map: starTex, color: 0xfde047, transparent: true, depthWrite: false }));
  const dizzy = [0, 1, 2].map(() => {
    const sp = new THREE.Sprite(dizzyMat);
    sp.scale.set(0.45, 0.45, 1);
    scene.add(sp);
    return sp;
  });

  // ---------------------------------------------------------------- obstacles
  const barrierGeo = own(barrierGeometry());
  const barPostsGeo = own(barPostsGeometry());
  const basketGeo = own(basketGeometry());
  const bannerMat = own(new THREE.MeshLambertMaterial({ map: tex(256, 128, drawBanner) }));
  const bannerGeo = own(new THREE.BoxGeometry(2.0, 0.85, 0.08));
  const crateMat = own(new THREE.MeshLambertMaterial({ map: tex(128, 128, drawCrate) }));
  const crateGeo = own(new THREE.BoxGeometry(1.25, CRATE.h, 1.25));
  const balloonMat = own(new THREE.MeshLambertMaterial({ map: tex(512, 256, drawBalloon) }));
  const balloonGeo = own(new THREE.SphereGeometry(1.5, 24, 16));
  const earGeo = own(new THREE.ConeGeometry(0.45, 0.9, 6));
  const earMat = own(new THREE.MeshLambertMaterial({ color: 0xf5e6c4 }));
  const zzzMat = own(new THREE.SpriteMaterial({ map: tex(128, 128, drawZzz), transparent: true, depthWrite: false }));
  const warnMat = own(new THREE.MeshBasicMaterial({ map: warnTex, transparent: true, depthWrite: false }));
  const pool = {};
  const views = new Map();

  function makeView(type) {
    const group = new THREE.Group();
    const v = { type, group, parts: {} };
    if (type === 'barrier') {
      group.add(new THREE.Mesh(barrierGeo, solidMat));
      group.add(makeShadow(2.2));
    } else if (type === 'bar') {
      group.add(new THREE.Mesh(barPostsGeo, solidMat));
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.y = 1.52;
      group.add(banner);
      v.parts.bats = [-0.65, 0, 0.65].map((x, i) => {
        const sp = new THREE.Sprite(artMaterial(artworkUrl(DEX.zubat), '#8b5cf6'));
        sp.position.set(x, 2.25 + (i % 2) * 0.2, 0.1);
        sp.scale.set(0.85, 0.85, 1);
        group.add(sp);
        return sp;
      });
      group.add(makeShadow(2.2));
    } else if (type === 'snorlax') {
      const sp = new THREE.Sprite(artMaterial(artworkUrl(DEX.snorlax), '#0f766e'));
      sp.center.set(0.5, 0.04);
      sp.scale.set(3.1, 3.1, 1);
      group.add(sp);
      v.parts.body = sp;
      const z = new THREE.Sprite(zzzMat);
      z.scale.set(1.1, 1.1, 1);
      group.add(z);
      v.parts.zzz = z;
      group.add(makeShadow(3.0));
    } else if (type === 'geodude') {
      const sp = new THREE.Sprite(artMaterial(artworkUrl(DEX.geodude), '#78716c'));
      sp.scale.set(1.5, 1.5, 1);
      sp.position.y = 0.72;
      group.add(sp);
      v.parts.body = sp;
      group.add(makeShadow(1.5));
    } else if (type === 'crate') {
      const crate = new THREE.Mesh(crateGeo, crateMat);
      group.add(crate);
      v.parts.crate = crate;
      const balloon = new THREE.Group();
      const ball = new THREE.Mesh(balloonGeo, balloonMat);
      ball.scale.set(1, 1.12, 1);
      ball.position.y = 2.6;
      balloon.add(ball);
      for (const d of [-1, 1]) {
        const ear = new THREE.Mesh(earGeo, earMat);
        ear.position.set(d * 0.85, 4.05, 0.2);
        ear.rotation.z = -d * 0.45;
        balloon.add(ear);
      }
      const basket = new THREE.Mesh(basketGeo, solidMat);
      basket.position.y = 0;
      balloon.add(basket);
      group.add(balloon);
      v.parts.balloon = balloon;
      const warn = new THREE.Mesh(shadowGeo, warnMat);
      warn.position.y = 0.04;
      warn.renderOrder = 2;
      group.add(warn);
      v.parts.warn = warn;
      const sh = makeShadow(1.6);
      group.add(sh);
      v.parts.shadow = sh;
    }
    scene.add(group);
    return v;
  }
  const getView = (o) => {
    let v = views.get(o.id);
    if (!v) {
      const list = pool[o.type] || (pool[o.type] = []);
      v = list.pop() || makeView(o.type);
      v.group.visible = true;
      v.drift = 0;
      v.group.scale.set(1, 1, 1);
      v.group.rotation.set(0, 0, 0);
      views.set(o.id, v);
    }
    return v;
  };

  // ---------------------------------------------------------------- coins and power-ups
  const coinGeo = own(new THREE.CylinderGeometry(0.4, 0.4, 0.09, 20));
  coinGeo.rotateX(Math.PI / 2);
  const coinSide = own(new THREE.MeshLambertMaterial({ color: 0xfbbf24, emissive: 0x7a5200 }));
  const coinFace = own(new THREE.MeshLambertMaterial({ map: tex(128, 128, drawCoinFace), emissive: 0x4a3600 }));
  const coins = new THREE.InstancedMesh(coinGeo, [coinSide, coinFace, coinFace], MAX_COINS);
  coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  coins.frustumCulled = false;
  scene.add(coins);
  const pickViews = new Map();
  const ringGeo = own(new THREE.TorusGeometry(0.95, 0.13, 8, 32));
  const ringMat2 = own(new THREE.MeshBasicMaterial({ color: 0xfb923c }));
  const haloMat = {};
  const pickupView = (p) => {
    let v = pickViews.get(p.id);
    if (v) return v;
    const group = new THREE.Group();
    if (!haloMat[p.kind]) haloMat[p.kind] = own(new THREE.SpriteMaterial({ map: glowTex, color: POWER_COLOR[p.kind], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    const halo = new THREE.Sprite(haloMat[p.kind]);
    halo.scale.set(2.2, 2.2, 1);
    group.add(halo);
    const icon = new THREE.Sprite(powerSpriteMat[p.kind]);
    icon.scale.set(1.15, 1.15, 1);
    group.add(icon);
    let ring = null;
    if (p.kind === 'boost') {
      ring = new THREE.Mesh(ringGeo, ringMat2);
      group.add(ring);
    }
    group.add(makeShadow(1));
    scene.add(group);
    v = { group, icon, halo, ring };
    pickViews.set(p.id, v);
    return v;
  };

  // ---------------------------------------------------------------- particles
  function particleSystem(max, texture, blending) {
    const geo = own(new THREE.BufferGeometry());
    const pos = new Float32Array(max * 3);
    const col = new Float32Array(max * 3);
    const size = new Float32Array(max);
    const alpha = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = own(new THREE.ShaderMaterial({ vertexShader: PT_VERT, fragmentShader: PT_FRAG, uniforms: { uTex: { value: texture }, uScale: { value: 400 } }, transparent: true, depthWrite: false, blending }));
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 5;
    scene.add(points);
    const list = [];
    const tmp = new THREE.Color();
    return {
      mat,
      add(x, y, z, { n = 8, color = 0xffffff, colors, speed = 3, up = 2, life = 0.6, size: sz = 0.35, gravity = -6, spread = 0.2 } = {}) {
        const cap = quality === 'low' ? max / 2 : max;
        for (let i = 0; i < n && list.length < cap; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = speed * (0.4 + Math.random() * 0.8);
          tmp.set(colors ? colors[i % colors.length] : color);
          list.push({
            x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread, z: z + (Math.random() - 0.5) * spread,
            vx: Math.cos(a) * sp, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * sp,
            life, max: life, size: sz * (0.6 + Math.random() * 0.8), r: tmp.r, g: tmp.g, b: tmp.b, gravity,
          });
        }
      },
      update(dt) {
        let n = 0;
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i];
          p.life -= dt;
          if (p.life <= 0) {
            list[i] = list[list.length - 1];
            list.pop();
            continue;
          }
          p.vy += p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.y < 0.02) {
            p.y = 0.02;
            p.vy = 0;
          }
        }
        for (const p of list) {
          pos[n * 3] = p.x;
          pos[n * 3 + 1] = p.y;
          pos[n * 3 + 2] = -p.z;
          col[n * 3] = p.r;
          col[n * 3 + 1] = p.g;
          col[n * 3 + 2] = p.b;
          const k = p.life / p.max;
          size[n] = p.size * (0.6 + 0.4 * k);
          alpha[n] = Math.min(1, k * 1.6);
          n++;
        }
        geo.setDrawRange(0, n);
        for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) geo.attributes[k].needsUpdate = true;
      },
    };
  }
  let quality = 'high';
  const sparks = particleSystem(420, starTex, THREE.AdditiveBlending);
  const dust = particleSystem(260, glowTex, THREE.NormalBlending);

  // ---------------------------------------------------------------- speed lines (in camera space)
  const LINES = 34;
  const lineGeo = own(new THREE.PlaneGeometry(0.018, 1));
  lineGeo.rotateX(-Math.PI / 2);
  const lineMat = own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
  const lines = new THREE.InstancedMesh(lineGeo, lineMat, LINES);
  lines.frustumCulled = false;
  lines.renderOrder = 20;
  camera.add(lines);
  const lr = rng(5);
  const lineData = Array.from({ length: LINES }, () => ({ a: lr() * Math.PI * 2, f: 0.8 + lr() * 0.25, z: -4 - lr() * 10, len: 0.6 + lr() * 0.9 }));
  const _o = new THREE.Object3D();

  // ---------------------------------------------------------------- frame
  const cur = { skyTop: new THREE.Color(), skyBot: new THREE.Color(), fog: new THREE.Color(), ground: new THREE.Color(), track: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), sun: new THREE.Color(), disc: new THREE.Color(), tint: new THREE.Color() };
  const camPos = new THREE.Vector3(0, 3.6, 6);
  const camLook = new THREE.Vector3(0, 1.2, -10);
  let fov = 62;
  let time = 0;
  let slowTime = 0;
  let avgDt = 1 / 60;
  let disposed = false;
  let width = 1;
  let height = 1;
  let geodudeDust = 0;
  let lastLand = 0;

  function resize() {
    const r = container.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width));
    height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(container);
  if (!ro) window.addEventListener('resize', resize);

  function applyWorld(d) {
    const w = worldAt(d);
    const a = PAL[w.index];
    const b = PAL[w.next];
    const t = w.blend;
    for (const k of Object.keys(cur)) cur[k].copy(a[k]).lerp(b[k], t);
    const mix = (k) => a[k] + (b[k] - a[k]) * t;
    skyMat.uniforms.uTop.value.copy(cur.skyTop);
    skyMat.uniforms.uBot.value.copy(cur.skyBot);
    scene.fog.color.copy(cur.fog);
    scene.fog.near = mix('near');
    scene.fog.far = mix('far');
    groundMat.color.copy(cur.ground);
    trackMat.color.copy(cur.track);
    hemi.color.copy(cur.hemiSky);
    hemi.groundColor.copy(cur.hemiGround);
    hemi.intensity = mix('hemi');
    dir.color.copy(cur.sun);
    dir.intensity = mix('sunI');
    sunMat.color.copy(cur.disc);
    sunMat.opacity = mix('discA') * 0.45;
    sunCoreMat.color.copy(cur.disc);
    sunCoreMat.opacity = mix('discA');
    return { y: mix('discY') };
  }

  function handleEvents(s, events) {
    for (const e of events) {
      if (e.type === 'coin') sparks.add(e.x, e.y, e.z + 0.4, { n: 6, colors: [0xfde047, 0xffffff, 0xfacc15], speed: 1.8, up: 1.6, life: 0.4, size: 0.28, gravity: -2 });
      else if (e.type === 'land') {
        if (time - lastLand > 0.1) dust.add(s.x, 0.1, s.d, { n: 9, color: 0xe7d8c0, speed: 2.4, up: 0.8, life: 0.5, size: 0.7, gravity: -1 });
        lastLand = time;
      } else if (e.type === 'jump') dust.add(s.x, 0.1, s.d, { n: 5, color: 0xe7d8c0, speed: 1.6, up: 0.6, life: 0.4, size: 0.6, gravity: -1 });
      else if (e.type === 'slide') dust.add(s.x, 0.1, s.d + 0.3, { n: 8, color: 0xe7d8c0, speed: 1.8, up: 0.5, life: 0.5, size: 0.6, gravity: -1 });
      else if (e.type === 'crateLand') dust.add(e.x, 0.2, e.z, { n: 16, color: 0xd6c3a5, speed: 3.5, up: 1.2, life: 0.7, size: 0.9, gravity: -2, spread: 1 });
      else if (e.type === 'crash') {
        sparks.add(s.x, 1.3, s.d + 0.5, { n: 18, colors: [0xffffff, 0xfde047, 0xfb7185], speed: 3.5, up: 3, life: 0.7, size: 0.5 });
        dust.add(s.x, 0.3, s.d + 0.5, { n: 10, color: 0xe7d8c0, speed: 2.5, up: 1, life: 0.6, size: 0.8, gravity: -1 });
      } else if (e.type === 'shieldBreak') sparks.add(s.x, 1, s.d + 0.4, { n: 30, colors: [0x7dd3fc, 0xffffff, 0xef4444], speed: 5, up: 3, life: 0.8, size: 0.5 });
      else if (e.type === 'smash') {
        sparks.add(e.x, 1, e.z, { n: 20, colors: [0xfb923c, 0xfde047, 0xffffff], speed: 6, up: 4, life: 0.7, size: 0.55 });
        dust.add(e.x, 0.4, e.z, { n: 8, color: 0xd6c3a5, speed: 4, up: 2, life: 0.6, size: 0.9 });
      } else if (e.type === 'power') sparks.add(e.x, e.y, e.z, { n: 26, color: POWER_COLOR[e.kind] || 0xffffff, speed: 4, up: 2.5, life: 0.8, size: 0.55, gravity: -1 });
      else if (e.type === 'revive' || e.type === 'continue') sparks.add(s.x, 1, s.d, { n: 40, colors: [0xfde047, 0xffffff, 0x86efac], speed: 4, up: 4, life: 1, size: 0.55, gravity: -2, spread: 1 });
    }
  }

  function update(s, dt, events = []) {
    if (disposed || !s) return;
    time += dt;
    // Auto-lower quality when frames are slow for a few seconds
    avgDt += (dt - avgDt) * 0.05;
    if (quality === 'high') {
      slowTime = avgDt > 1 / 38 ? slowTime + dt : Math.max(0, slowTime - dt);
      if (slowTime > 3) {
        quality = 'low';
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        resize();
        chunks[NCH - 1].group.visible = false;
      }
    }
    handleEvents(s, events);
    const d = s.d;
    const disc = applyWorld(d);
    const tint = cur.tint;

    // Chunks: recycle the ones left behind
    const base = Math.floor(Math.max(0, d - 20) / CHUNK_LEN) * CHUNK_LEN;
    for (let i = 0; i < NCH; i++) {
      const want = base + i * CHUNK_LEN;
      const c = chunks.find((ch) => ch.start === want);
      if (!c) {
        const free = chunks.find((ch) => ch.start === null || ch.start < base || ch.start >= base + NCH * CHUNK_LEN);
        if (free) placeChunk(free, want);
      }
    }
    track.position.z = -(d + TRACK_LEN / 2 - 30);
    scroll(trackTex, d + TRACK_LEN / 2 - 30, TRACK_LEN, 6);
    ground.position.z = -(d + 120);
    ground.position.x = 0;
    scroll(groundTex, d + 120, GROUND, 6);

    // Player sprite: run bob, lean, squash on slide, stretch on jump, blink when safe-time
    const running = s.phase === 'run';
    const sliding = s.slideT > 0;
    let sx = 1;
    let sy = 1;
    if (sliding) {
      sx = 1.3;
      sy = 0.55;
    } else if (s.y > 0.02) {
      sx = s.vy > 0 ? 0.9 : 1.04;
      sy = s.vy > 0 ? 1.12 : 0.98;
    } else if (running) {
      const b = Math.abs(Math.sin(time * 13));
      sx = 1 + (1 - b) * 0.05;
      sy = 1 - (1 - b) * 0.05;
    }
    const bob = running && !sliding && s.y <= 0.02 ? Math.abs(Math.sin(time * 13)) * 0.12 : 0;
    const size = 1.85;
    player.scale.set(size * sx, size * sy, 1);
    player.position.set(s.x, s.y + bob, -d);
    let rot = -s.lean * 0.9;
    if (running && s.y <= 0.02 && !sliding) rot += Math.sin(time * 13) * 0.05;
    if (s.phase === 'crashed' || s.phase === 'over') rot = Math.min(1.3, (s.crashT || 0) * 5) * (s.x >= 0 ? -1 : 1);
    playerMat.rotation = rot;
    playerMat.color.copy(tint);
    playerMat.opacity = s.invuln > 0 && s.power.boost <= 0 && Math.floor(time * 10) % 2 === 0 ? 0.45 : 1;
    playerShadow.position.set(s.x, 0.03, -d);
    const shK = Math.max(0.35, 1 - s.y / 3);
    playerShadow.scale.set(1.5 * shK * (sliding ? 1.3 : 1), 1, 1.2 * shK);
    shield.visible = s.power.shield > 0;
    if (shield.visible) {
      shield.position.set(s.x, s.y + (sliding ? 0.55 : 0.95), -d);
      const p = 1 + Math.sin(time * 6) * 0.04;
      shield.scale.set(p, sliding ? p * 0.7 : p, p);
      shieldRing.rotation.z = time * 2;
      shieldMat.uniforms.uOpacity.value = s.power.shield < 3 && Math.floor(time * 6) % 2 ? 0.3 : 1;
    }
    const orbitKind = s.power.magnet > 0 ? 'magnet' : s.power.double > 0 ? 'double' : null;
    orbit.visible = !!orbitKind && running;
    if (orbit.visible) {
      orbit.material = powerSpriteMat[orbitKind];
      orbit.position.set(s.x + Math.cos(time * 4) * 0.9, s.y + 1.9 + Math.sin(time * 8) * 0.1, -d + Math.sin(time * 4) * 0.5);
    }
    const isDizzy = s.phase === 'crashed' || s.phase === 'over';
    dizzy.forEach((sp, i) => {
      sp.visible = isDizzy;
      if (isDizzy) {
        const a = time * 4 + (i * Math.PI * 2) / 3;
        sp.position.set(s.x + Math.cos(a) * 0.7, 1.1 + Math.sin(time * 6 + i) * 0.1, -d + Math.sin(a) * 0.4);
      }
    });
    if (s.power.boost > 0 && running) {
      sparks.add(s.x + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 1.2, d + 0.1, { n: 2, colors: [0xfb923c, 0xfde047, 0xef4444], speed: 0.4, up: 0.8, life: 0.18, size: 0.3, gravity: 0 });
    }

    // Obstacles
    const seen = new Set();
    for (const o of s.obstacles) {
      if (o.z > d + 140 || o.z < d - 12) continue;
      const v = getView(o);
      seen.add(o.id);
      const g = v.group;
      g.position.set(o.x, 0, -o.z);
      if (o.smashed) {
        v.drift += dt;
        g.position.y = v.drift * 6 - v.drift * v.drift * 9;
        g.position.x = o.x + (o.lane || 1) * v.drift * 4;
        g.rotation.z = v.drift * 6;
        const k = Math.max(0, 1 - v.drift * 1.5);
        g.scale.set(k, k, k);
      }
      if (v.type === 'bar') {
        v.parts.bats.forEach((b, i) => {
          b.material.color.copy(tint);
          const flap = 0.75 + Math.abs(Math.sin(time * 14 + i * 1.7)) * 0.35;
          b.scale.set(0.95 * flap, 0.95, 1);
          b.position.y = 2.3 + Math.sin(time * 3 + i) * 0.12 + (i % 2) * 0.15;
        });
      } else if (v.type === 'snorlax') {
        v.parts.body.material.color.copy(tint);
        const br = 1 + Math.sin(time * 2 + o.id) * 0.025;
        v.parts.body.scale.set(3.1 * br, 3.1 / br, 1);
        const zt = (time * 0.6 + o.id * 0.3) % 1;
        v.parts.zzz.position.set(0.9 + zt * 0.4, 2.6 + zt * 1.0, 0);
        v.parts.zzz.material.opacity = Math.sin(zt * Math.PI);
      } else if (v.type === 'geodude') {
        v.parts.body.material.color.copy(tint);
        if (o.state === 'roll') {
          v.parts.body.material.rotation = (o.spin || 0) * 0.9;
          v.parts.body.position.y = 0.72 + Math.abs(Math.sin((o.spin || 0) * 1.5)) * 0.12;
        }
      } else if (v.type === 'crate') {
        const crate = v.parts.crate;
        crate.position.y = o.y + CRATE.h / 2;
        crate.rotation.y = o.state === 'fall' ? o.y * 0.1 : 0;
        const balloon = v.parts.balloon;
        if (o.state === 'hold' || o.state === 'warn') {
          v.drift = 0;
          balloon.position.set(0, CRATE.hold + CRATE.h + 1.2 + Math.sin(time * 1.5 + o.id) * 0.15, 0);
        } else {
          v.drift += dt;
          balloon.position.set(v.drift * 1.5 * (o.lane >= 0 ? 1 : -1), CRATE.hold + CRATE.h + 1.2 + v.drift * 3, 0);
        }
        balloon.rotation.y = Math.sin(time * 0.8 + o.id) * 0.25;
        const warning = o.state === 'warn' || o.state === 'fall';
        v.parts.warn.visible = warning;
        if (warning) {
          const p = 1.6 + Math.sin(time * 14) * 0.18;
          v.parts.warn.scale.set(p, 1, p);
        }
        v.parts.shadow.visible = !warning;
      }
    }
    for (const [id, v] of views) {
      if (!seen.has(id)) {
        v.group.visible = false;
        views.delete(id);
        (pool[v.type] || (pool[v.type] = [])).push(v);
      }
    }

    // Geodude dust trail
    geodudeDust -= dt;
    if (geodudeDust <= 0) {
      geodudeDust = 0.08;
      for (const o of s.obstacles) if (o.type === 'geodude' && o.state === 'roll' && o.z > d && o.z < d + 60) dust.add(o.x, 0.1, o.z + 0.6, { n: 2, color: 0xcbb89a, speed: 1, up: 0.6, life: 0.6, size: 0.8, gravity: -0.5 });
    }

    // Coins
    let n = 0;
    for (const c of s.coinList) {
      if (c.taken || c.z < d - 3 || c.z > d + 120) continue;
      if (n >= MAX_COINS) break;
      _o.position.set(c.x, c.y + Math.sin(time * 3 + c.id) * 0.06, -c.z);
      _o.rotation.set(0, time * 3.5 + c.id * 0.4, 0);
      const k = c.mag ? 0.8 : 1;
      _o.scale.set(k, k, k);
      _o.updateMatrix();
      coins.setMatrixAt(n++, _o.matrix);
    }
    coins.count = n;
    coins.instanceMatrix.needsUpdate = true;

    // Power-ups
    const pseen = new Set();
    for (const p of s.pickups) {
      if (p.taken || p.z > d + 130) continue;
      const v = pickupView(p);
      pseen.add(p.id);
      v.group.position.set(p.x, p.y + Math.sin(time * 3 + p.id) * 0.15, -p.z);
      v.group.children[v.group.children.length - 1].position.y = -(p.y + Math.sin(time * 3 + p.id) * 0.15) + 0.03;
      const pulse = 1 + Math.sin(time * 5) * 0.08;
      v.halo.scale.set(2.2 * pulse, 2.2 * pulse, 1);
      if (v.ring) v.ring.rotation.y = time * 2.5;
    }
    for (const [id, v] of pickViews) {
      if (!pseen.has(id)) {
        scene.remove(v.group);
        pickViews.delete(id);
      }
    }

    // Camera: behind and above, follows smoothly (never shakes)
    const k = 1 - Math.exp(-dt * 6);
    const tx = s.x * 0.55;
    const ty = 3.5 + s.y * 0.35;
    camPos.x += (tx - camPos.x) * k;
    camPos.y += (ty - camPos.y) * k;
    camPos.z = -(d - 6.4);
    camLook.x += (s.x * 0.75 - camLook.x) * k;
    camLook.y += (1.25 + s.y * 0.25 - camLook.y) * k;
    camLook.z = -(d + 10);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const portrait = width / height < 0.85;
    const baseFov = portrait ? 66 : 52;
    const wantFov = baseFov + (s.power.boost > 0 ? 9 : 0) + Math.max(0, s.speed - 12) * 0.35;
    fov += (wantFov - fov) * k;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
    sun.position.set(camera.position.x - 70, disc.y + 20, camera.position.z - 320);
    sunCore.position.copy(sun.position);
    dir.position.set(camera.position.x - 6, 14, camera.position.z + 4);
    dir.target.position.set(camera.position.x, 0, camera.position.z - 10);

    // Speed lines when fast or boosting
    const fast = running ? Math.max(0, Math.min(1, (s.speed - 13) / 6)) + (s.power.boost > 0 ? 0.7 : 0) : 0;
    lineMat.opacity += (Math.min(0.4, fast * 0.35) - lineMat.opacity) * k;
    lines.visible = lineMat.opacity > 0.02 && quality === 'high';
    if (lines.visible) {
      const th = Math.tan((camera.fov * Math.PI) / 360);
      for (let i = 0; i < LINES; i++) {
        const L = lineData[i];
        L.z += dt * (30 + s.speed * 2);
        if (L.z > -3) {
          L.z = -12 - Math.random() * 3;
          L.a = Math.random() * Math.PI * 2;
        }
        const hh = th * -L.z;
        _o.position.set(Math.cos(L.a) * hh * camera.aspect * L.f, Math.sin(L.a) * hh * L.f, L.z);
        _o.rotation.set(0, 0, L.a + Math.PI / 2);
        _o.scale.set(1, 1, L.len);
        _o.updateMatrix();
        lines.setMatrixAt(i, _o.matrix);
      }
      lines.instanceMatrix.needsUpdate = true;
    }

    const scale = (height * pixelRatio) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    sparks.mat.uniforms.uScale.value = scale;
    dust.mat.uniforms.uScale.value = scale;
    sparks.update(dt);
    dust.update(dt);
    renderer.render(scene, camera);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    ro?.disconnect();
    if (!ro) window.removeEventListener('resize', resize);
    scene.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    for (const x of disposables) x.dispose?.();
    disposables.clear();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
  }

  return { update, resize, dispose, get quality() { return quality; } };
}

