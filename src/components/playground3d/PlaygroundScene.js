// three.js world of the 3D Pokémon playground: a floating diorama themed by the Pokémon's type,
// every Pokémon as a puffy 3D "standee" made from its own artwork,
// the Poké Ball reveal, type aura particles and the props of every activity.
// The scene is "dumb": React drives it with update(dt, view) every frame (view comes from the
// pure engines in utils/playground3d) and fx(type) for one-shot effects. No own RAF loop, so
// pausing = not calling update. Budget: < ~80 draw calls, pixel ratio ≤ 2 (drops to 1 when slow).
import * as THREE from 'three';
import { themeFor } from '../../utils/playground3d/themes';
import { buildStandee } from '../../utils/playground3d/standeeMesh';
import { idlePose, mulberry } from '../../utils/playground3d/activities';
import {
  islandGeometries, buildDecorations, skyClouds, createPokeball, beachBallTexture, bushGeometry, BUSH_TINT, BERRY_COLORS,
  radialTexture, raysGeometry, raysMaterial, beamMesh, spriteAtlas, SPRITE, particleMaterial, particlePool, placeholderCardTexture, canvasTexture,
} from './playgroundArt';
import { TYPE_COLORS } from '../../utils/battle/typeChart';

const TAU = Math.PI * 2;
const ISLAND_R = 2.2;
const STANDEE_H = 1.72;
const col = (c) => new THREE.Color(c);
const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const NIGHT_SKY = ['#070a26', '#2a2f6e'];

/** Adds a fresnel rim glow to a standard material (uniforms shared so they can be animated). */
function addRim(mat, uniforms) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = uniforms.uRim;
    sh.uniforms.uRimColor = uniforms.uRimColor;
    sh.uniforms.uWhite = uniforms.uWhite;
    sh.uniforms.uSelfLit = uniforms.uSelfLit;
    sh.fragmentShader = 'uniform float uRim;\nuniform vec3 uRimColor;\nuniform float uWhite;\nuniform float uSelfLit;\n' + sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float rimF = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
      totalEmissiveRadiance += diffuseColor.rgb * uSelfLit;
      totalEmissiveRadiance += uRimColor * pow(rimF, 2.6) * uRim;
      totalEmissiveRadiance += vec3(uWhite * 1.4);`,
    );
  };
  mat.customProgramCacheKey = () => 'pg3d-rim';
}

function loadImage(src, cors) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed'));
    img.src = src;
  });
}

/** Image → small ImageData for the mask; throws on a tainted canvas. */
function readPixels(img, max = 256) {
  const k = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * k));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export function createPlaygroundScene({ pokemon = {}, image, pixelRatio, onStatus } = {}) {
  const theme = themeFor(pokemon);
  const D = theme.diorama;
  const aura = theme.aura;
  const seed = Number(pokemon.pokedexNumber) || 7;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const maxPR = Math.min(2, pixelRatio || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  let pr = maxPR;
  renderer.setPixelRatio(pr);
  const canvas = renderer.domElement;
  canvas.className = 'pg3d-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 90);
  const owned = new Set(); // geometries / materials / textures to dispose
  const own = (x) => {
    owned.add(x);
    return x;
  };
  const atlas = own(spriteAtlas());
  const blobTex = own(radialTexture('rgba(0,0,0,0.5)', 'rgba(0,0,0,0)'));
  const glowTex = own(radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'));

  // ------------------------------------------------------------------ sky
  const skyU = {
    uTop: { value: col(D.sky[0]) },
    uBottom: { value: col(D.sky[1]) },
    uNTop: { value: col(NIGHT_SKY[0]) },
    uNBottom: { value: col(NIGHT_SKY[1]) },
    uNight: { value: 0 },
  };
  const sky = new THREE.Mesh(
    own(new THREE.SphereGeometry(45, 24, 12)),
    own(new THREE.ShaderMaterial({
      uniforms: skyU,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uNTop; uniform vec3 uNBottom; uniform float uNight; varying vec3 vP;
        void main(){ float h = normalize(vP).y; float k = smoothstep(-0.12, 0.42, h);
          vec3 day = mix(uBottom, uTop, k); vec3 night = mix(uNBottom, uNTop, k);
          gl_FragColor = vec4(mix(day, night, uNight), 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
    })),
  );
  sky.name = 'sky';
  scene.add(sky);

  // Stars (visible at night, always a little in the night themes)
  const rndS = mulberry(11);
  const starPos = [];
  for (let i = 0; i < 260; i++) {
    const a = rndS() * TAU;
    const y = 0.08 + rndS() * 0.9;
    const r = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(a) * r * 40, y * 40 - 2, Math.sin(a) * r * 40);
  }
  const starGeo = own(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = own(new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, map: glowTex, transparent: true, depthWrite: false, opacity: 0, color: '#ffffff', fog: false }));
  const stars = new THREE.Points(starGeo, starMat);
  stars.name = 'stars';
  scene.add(stars);
  const baseNight = D.moon ? 1 : 0;

  // Moon
  const moonTex = own(canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,248,220,1)');
    g.addColorStop(0.45, 'rgba(255,248,220,1)');
    g.addColorStop(0.5, 'rgba(255,240,200,0.45)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(220,210,180,0.6)';
    for (const [x, y, r] of [[52, 54, 7], [74, 70, 5], [60, 80, 4]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  }));
  const moon = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false })));
  moon.position.set(-9, 11, -26);
  moon.scale.setScalar(6);
  scene.add(moon);

  const clouds = D.moon ? null : skyClouds(D.cloudIsland ? 9 : 6, seed, theme.dioramaId === 'volcano' ? '#ffd0c0' : '#ffffff');
  if (clouds) {
    own(clouds.geometry);
    own(clouds.material);
    scene.add(clouds);
  }

  // ------------------------------------------------------------------ lights
  const hemi = new THREE.HemisphereLight(D.hemi[0], D.hemi[1], 1.25);
  const sun = new THREE.DirectionalLight(D.sun, 1.7);
  sun.position.set(3, 6, 5);
  const rim = new THREE.DirectionalLight('#ffffff', 1.6);
  rim.position.set(-2.5, 3.5, -5);
  const party = new THREE.PointLight('#ff4fd8', 0, 9, 1.5);
  party.position.set(0, 2.6, 1.6);
  scene.add(hemi, sun, rim, party);

  // ------------------------------------------------------------------ world (bobs gently)
  const world = new THREE.Group();
  scene.add(world);
  const isl = islandGeometries(D, { R: ISLAND_R, seed });
  const topMat = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  const islandTop = new THREE.Mesh(own(isl.top), topMat);
  islandTop.name = 'island-top';
  world.add(islandTop);
  if (D.cloudIsland) {
    // puffy clouds instead of a rocky underside
    own(isl.under);
    const cgeo = own(new THREE.SphereGeometry(1, 14, 10));
    const cmat = own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#dfe8ff', emissiveIntensity: 0.25 }));
    const puffs = new THREE.InstancedMesh(cgeo, cmat, 14);
    const m = new THREE.Matrix4();
    const rr = mulberry(seed + 5);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const ring = i % 2 ? 1.75 : 1.05;
      const s = 0.55 + rr() * 0.35;
      m.compose(new THREE.Vector3(Math.sin(a) * ring, -0.62 - rr() * 0.25 - (ring < 1.5 ? 0.3 : 0), Math.cos(a) * ring), new THREE.Quaternion(), new THREE.Vector3(s * 1.15, s * 0.8, s * 1.15));
      puffs.setMatrixAt(i, m);
    }
    puffs.name = 'cloud-base';
    world.add(puffs);
  } else {
    const underMat = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    const under = new THREE.Mesh(own(isl.under), underMat);
    under.name = 'island-under';
    world.add(under);
  }
  const deco = buildDecorations(D, { R: ISLAND_R, seed });
  for (const mesh of deco.meshes) {
    own(mesh.geometry);
    own(mesh.material);
    world.add(mesh);
  }
  // Water ring (beach)
  let waterU = null;
  if (D.water) {
    waterU = { uTime: { value: 0 }, uColor: { value: col(D.water) }, uFoam: { value: col('#ffffff') } };
    const water = new THREE.Mesh(
      own(new THREE.RingGeometry(1.9, 10, 72, 6).rotateX(-Math.PI / 2)),
      own(new THREE.ShaderMaterial({
        uniforms: waterU,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform vec3 uFoam; varying vec3 vP;
          void main(){ float r = length(vP.xz); float a = atan(vP.z, vP.x);
            float w = sin(r * 7.0 - uTime * 2.2 + sin(a * 5.0) * 0.6) * 0.5 + 0.5;
            float foam = smoothstep(2.55, 2.1, r) * (0.6 + 0.4 * w);
            vec3 c = mix(uColor * (0.8 + 0.25 * w), uFoam, foam);
            float alpha = smoothstep(10.0, 5.0, r) * 0.92;
            gl_FragColor = vec4(c, alpha);
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
      })),
    );
    water.position.y = -0.2;
    water.name = 'water';
    world.add(water);
  }
  // Lava rim glow (volcano)
  let lavaRing = null;
  if (theme.dioramaId === 'volcano') {
    lavaRing = new THREE.Mesh(own(new THREE.TorusGeometry(ISLAND_R * 1.0, 0.045, 6, 64).rotateX(Math.PI / 2)), own(new THREE.MeshBasicMaterial({ color: D.glow })));
    lavaRing.position.y = -0.2;
    world.add(lavaRing);
  }

  // ------------------------------------------------------------------ Pokémon holder
  const pokeRoot = new THREE.Group(); // x, z, heading
  const pokeBody = new THREE.Group(); // hop & squash (pivot at the feet)
  const pokeTurn = new THREE.Group(); // looking around
  pokeRoot.add(pokeBody);
  pokeBody.add(pokeTurn);
  world.add(pokeRoot);
  const shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), own(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })));
  shadow.position.y = 0.015;
  shadow.renderOrder = 1;
  pokeRoot.add(shadow);
  const proxyMat = own(new THREE.MeshBasicMaterial({ visible: false }));
  let proxy = null;
  let model = null; // { kind, height, width, head: Vector3, update(dt, a), setWhite(k), chomp(), bounce(), wobble(), surface: Vector3[] }
  const rimU = { uRim: { value: 0.42 }, uRimColor: { value: col(aura.colors[0]).lerp(col('#ffffff'), 0.5) }, uWhite: { value: 0 }, uSelfLit: { value: 0.32 } };
  let status = 'loading';
  let resolveReady;
  const ready = new Promise((r) => {
    resolveReady = r;
  });
  const setStatus = (s) => {
    status = s;
    onStatus?.(s);
  };

  function mountModel(m) {
    model = m;
    pokeTurn.add(m.object);
    const r = Math.max(0.3, m.width * 0.42);
    proxy = new THREE.Mesh(own(new THREE.CylinderGeometry(r, r, m.height * 1.05, 10)), proxyMat);
    proxy.position.y = m.height / 2;
    pokeTurn.add(proxy);
    shadow.scale.set(Math.max(0.9, m.footprint * 1.6), 1, Math.max(0.7, m.footprint * 1.1));
    // surface points for soap foam
    if (!m.surface) {
      const pts = [];
      const rr = mulberry(9);
      for (let i = 0; i < 80; i++) {
        const a = rr() * TAU;
        const y = 0.15 + rr() * 0.8;
        const w = Math.sin(Math.PI * y) * 0.5 + 0.2;
        pts.push(new THREE.Vector3(Math.cos(a) * m.width * 0.42 * w, y * m.height, Math.abs(Math.sin(a)) * m.width * 0.3 * w + 0.05));
      }
      m.surface = pts;
    }
    resolveReady();
  }

  function standeeFromData(data, tex) {
    const geo = own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    for (const g of data.groups) geo.addGroup(g.start, g.count, g.materialIndex);
    geo.computeVertexNormals();
    const [er, eg, eb] = data.edgeColor;
    const edge = new THREE.Color(er / 255, eg / 255, eb / 255).convertSRGBToLinear().multiplyScalar(0.78);
    const front = own(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.35, roughness: 0.55, metalness: 0, emissive: '#ffffff', emissiveIntensity: 0 }));
    const back = own(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.35, roughness: 0.7, color: '#9a9aa6', emissive: '#ffffff', emissiveIntensity: 0 }));
    const side = own(new THREE.MeshStandardMaterial({ color: edge, roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0 }));
    for (const m of [front, back, side]) addRim(m, rimU);
    const mesh = new THREE.Mesh(geo, [front, back, side]);
    mesh.name = 'standee';
    const k = Math.min(STANDEE_H, 2.1 / Math.max(0.2, data.width));
    mesh.scale.setScalar(k);
    const holder = new THREE.Group();
    holder.add(mesh);
    // foam points from the front surface
    const surface = [];
    const pos = data.positions;
    const nFront = data.groups[0].count ? data.vertexCount : 0;
    const rr = mulberry(5);
    for (let i = 0; i < 90 && nFront; i++) {
      const j = Math.floor(rr() * (pos.length / 3 / 2));
      if (pos[j * 3 + 2] <= 0) continue;
      surface.push(new THREE.Vector3(pos[j * 3] * k, pos[j * 3 + 1] * k, pos[j * 3 + 2] * k + 0.02));
    }
    return {
      kind: 'standee',
      object: holder,
      height: k,
      width: data.width * k,
      footprint: data.footprint * k,
      head: new THREE.Vector3(data.headTop[0] * k, k, 0),
      surface: surface.length > 10 ? surface : null,
      setWhite: (w) => {
        rimU.uWhite.value = w;
        rimU.uRim.value = 0.42 + w * 1.5;
      },
      update: () => {},
    };
  }

  function billboard(texture) {
    const w = 1.15;
    const h = 1.5;
    const shape = new THREE.Shape();
    const r = 0.16;
    shape.moveTo(-w / 2 + r, 0);
    shape.lineTo(w / 2 - r, 0);
    shape.quadraticCurveTo(w / 2, 0, w / 2, r);
    shape.lineTo(w / 2, h - r);
    shape.quadraticCurveTo(w / 2, h, w / 2 - r, h);
    shape.lineTo(-w / 2 + r, h);
    shape.quadraticCurveTo(-w / 2, h, -w / 2, h - r);
    shape.lineTo(-w / 2, r);
    shape.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
    const geo = own(new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 }));
    geo.translate(0, 0, -0.03);
    // planar UVs over the front
    const p = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, p.getY(i) / h);
    const mat = own(new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5, emissive: '#ffffff', emissiveIntensity: 0 }));
    addRim(mat, rimU);
    const mesh = new THREE.Mesh(geo, mat);
    const holder = new THREE.Group();
    holder.add(mesh);
    return {
      kind: 'billboard',
      object: holder,
      height: h,
      width: w,
      footprint: w * 0.8,
      head: new THREE.Vector3(0, h, 0),
      setWhite: (k) => {
        rimU.uWhite.value = k;
      },
      update: () => {},
    };
  }

  let disposed = false;
  if (!model) {
    const fallbackCard = () => {
      if (disposed || model) return;
      const tex = own(placeholderCardTexture(pokemon.name, TYPE_COLORS[String((pokemon.types || [])[0] || '').toLowerCase()] || '#8a8ab0'));
      mountModel(billboard(tex));
      setStatus('billboard');
    };
    if (!image) fallbackCard();
    else {
      loadImage(image, true)
        .then((img) => {
          if (disposed) return;
          let data = null;
          try {
            data = buildStandee(readPixels(img), { grid: 56 });
          } catch (err) {
            console.warn('[playground3d] artwork pixels unavailable', err);
          }
          const tex = own(new THREE.Texture(img));
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          tex.needsUpdate = true;
          if (data && data.cells > 40) {
            mountModel(standeeFromData(data, tex));
            setStatus('standee');
          } else {
            mountModel(billboard(tex));
            setStatus('billboard');
          }
        })
        .catch(() => {
          // CORS refused: WebGL cannot use the picture; show a rounded card (React overlays the <img>)
          fallbackCard();
          if (!disposed) setStatus('billboard-dom');
        });
    }
  }

  // ------------------------------------------------------------------ reveal props
  const ball = createPokeball(0.3);
  ball.group.traverse((o) => {
    if (o.geometry) own(o.geometry);
    if (o.material) own(o.material);
  });
  world.add(ball.group);
  const flashMat = own(new THREE.SpriteMaterial({ map: glowTex, color: '#fffbe8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  const flash = new THREE.Sprite(flashMat);
  flash.renderOrder = 5;
  world.add(flash);
  const raysMat = own(raysMaterial(col(aura.colors[0]).lerp(col('#ffffff'), 0.55).getStyle()));
  raysMat.depthTest = false;
  const rays = new THREE.Mesh(own(raysGeometry(16, seed)), raysMat);
  rays.renderOrder = 6;
  world.add(rays);

  // Heat shimmer behind fire Pokémon (wavy warm haze)
  let heat = null;
  if (aura.kind === 'embers') {
    heat = new THREE.Mesh(
      own(new THREE.PlaneGeometry(1.8, 2.2)),
      own(new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uColor: { value: col('#ff8a3a') } },
        vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vU;
          void main(){ float x = vU.x + sin(vU.y * 14.0 - uTime * 5.0) * 0.03 + sin(vU.y * 31.0 - uTime * 9.0) * 0.012;
            float band = pow(1.0 - abs(x - 0.5) * 2.0, 1.6);
            float wave = 0.55 + 0.45 * sin(vU.y * 22.0 - uTime * 6.0 + x * 9.0);
            float a = band * wave * smoothstep(0.0, 0.25, vU.y) * smoothstep(1.0, 0.45, vU.y) * 0.32;
            gl_FragColor = vec4(uColor, a);
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })),
    );
    heat.position.set(0, 1.05, -0.35);
    pokeRoot.add(heat);
  }

  // ------------------------------------------------------------------ particles
  const ADDITIVE = new Set(['embers', 'sparks', 'sparkles', 'wisps', 'fireflies', 'glints', 'rings', 'wind', 'impact']);
  const auraPool = particlePool(90, own(particleMaterial(atlas, { additive: ADDITIVE.has(aura.kind) })));
  own(auraPool.points.geometry);
  auraPool.points.name = 'aura';
  world.add(auraPool.points);
  const fxPool = particlePool(240, own(particleMaterial(atlas)));
  own(fxPool.points.geometry);
  fxPool.points.name = 'fx';
  fxPool.points.renderOrder = 3;
  world.add(fxPool.points);
  const foamPool = particlePool(80, own(particleMaterial(atlas)));
  own(foamPool.points.geometry);
  foamPool.points.renderOrder = 2;
  world.add(foamPool.points);

  // Rings (psychic halos, fighting impacts, water splashes, disco floor), additive via dimmed colours
  const ringMesh = new THREE.InstancedMesh(own(new THREE.TorusGeometry(1, 0.035, 6, 48)), own(new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: '#ffffff' })), 8);
  ringMesh.frustumCulled = false;
  const rings = Array.from({ length: 8 }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, r0: 0.2, r1: 1, flat: true, color: col('#ffffff'), vy: 0 }));
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < 8; i++) {
    ringMesh.setMatrixAt(i, zeroM);
    ringMesh.setColorAt(i, col('#000000'));
  }
  world.add(ringMesh);
  let ringCursor = 0;
  const spawnRing = (props) => {
    const r = rings[ringCursor];
    ringCursor = (ringCursor + 1) % rings.length;
    Object.assign(r, { vy: 0, flat: true, r0: 0.2, r1: 1.2 }, props);
    r.max = r.life;
    r.color = col(props.color || '#ffffff');
  };

  // Electric arcs
  let arcs = null;
  if (aura.kind === 'sparks') {
    const g = own(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 2 * 9 * 2), 3));
    arcs = new THREE.LineSegments(g, own(new THREE.LineBasicMaterial({ color: '#fff27a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    arcs.frustumCulled = false;
    world.add(arcs);
  }

  // ------------------------------------------------------------------ activity props
  const toyTex = own(beachBallTexture());
  const toy = new THREE.Mesh(own(new THREE.SphereGeometry(0.15, 20, 14)), own(new THREE.MeshStandardMaterial({ map: toyTex, roughness: 0.35 })));
  toy.visible = false;
  world.add(toy);
  const toyShadow = new THREE.Mesh(shadow.geometry, own(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })));
  toyShadow.position.y = 0.012;
  toyShadow.visible = false;
  world.add(toyShadow);

  const bushMat = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  const bushes = new THREE.InstancedMesh(own(bushGeometry()), bushMat, 3);
  for (let i = 0; i < 3; i++) bushes.setColorAt(i, col(BUSH_TINT[theme.dioramaId] || '#5bbf4a'));
  bushes.visible = false;
  bushes.name = 'bushes';
  world.add(bushes);

  const berryMats = {};
  const berry = new THREE.Group();
  const berryBody = new THREE.Mesh(own(new THREE.SphereGeometry(0.13, 18, 12)), null);
  const berryLeaf = new THREE.Mesh(own(new THREE.ConeGeometry(0.06, 0.1, 6)), own(new THREE.MeshStandardMaterial({ color: '#3f9a3a', roughness: 0.7 })));
  berryLeaf.position.y = 0.14;
  berry.add(berryBody, berryLeaf);
  berry.visible = false;
  world.add(berry);
  const berryMat = (type) => {
    if (!berryMats[type]) berryMats[type] = own(new THREE.MeshStandardMaterial({ color: BERRY_COLORS[type] || '#ec4899', roughness: 0.3, emissive: BERRY_COLORS[type] || '#ec4899', emissiveIntensity: 0.15 }));
    return berryMats[type];
  };

  const beams = beamMesh();
  own(beams.geometry);
  own(beams.material);
  beams.visible = false;
  world.add(beams);

  // ------------------------------------------------------------------ state
  const st = {
    t: 0,
    hop: 0,
    hopV: 0,
    look: 0,
    lookY: 0,
    camYaw: -0.6,
    camPitch: 0.3,
    camDist: 1.2,
    night: 0,
    party: 0,
    auraAcc: 0,
    arcT: 0,
    berryEat: 0,
    wiggle: 0,
    lastHopY: 0,
    frameMs: 16,
    slow: 0,
    last: 0,
    sleepK: 0,
    eatK: 0,
    pose: { x: 0, z: 0, rotY: 0 },
    shine: 0,
  };
  let width = 1;
  let height = 1;
  let baseDist = 6;
  const target = new THREE.Vector3(0, 0.82, 0);
  const tmpV = new THREE.Vector3();
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpE = new THREE.Euler();
  const tmpS = new THREE.Vector3();
  const tmpC = new THREE.Color();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const auraCols = aura.colors.map(col);
  const pick3 = (list) => list[Math.floor(Math.random() * list.length)];

  function resize(w, h) {
    width = Math.max(1, Math.floor(w));
    height = Math.max(1, Math.floor(h));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // fit the island width on narrow (portrait) screens
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    baseDist = clamp(1.9 / (tanH * clamp(camera.aspect, 0.66, 1.25)), 5.0, 10.5);
    camera.updateProjectionMatrix();
    const scale = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * tanH);
    for (const p of [auraPool, fxPool, foamPool]) p.points.material.uniforms.uScale.value = scale;
  }
  resize(320, 360);

  // ------------------------------------------------------------------ aura behaviour
  const pokePos = () => pokeRoot.position;
  const H = () => (model ? model.height : 1.4);
  const Wd = () => (model ? model.width : 1);
  function spawnAura(burst = false) {
    const p = pokePos();
    const c = pick3(auraCols);
    const h = H();
    const w = Wd();
    const a = Math.random() * TAU;
    const base = { r: c.r, g: c.g, b: c.b };
    switch (aura.kind) {
      case 'embers':
        auraPool.spawn({ ...base, life: 1.4 + Math.random(), x: p.x + Math.cos(a) * w * 0.55, y: 0.1 + Math.random() * h * 0.4, z: p.z + Math.sin(a) * 0.45, vy: 0.6 + Math.random() * 0.6, wob: 0.5, size: 0.06 + Math.random() * 0.07, frame: SPRITE.dot });
        break;
      case 'bubbles':
      case 'poison':
        auraPool.spawn({ ...base, life: 2.4 + Math.random(), x: p.x + Math.cos(a) * (0.4 + Math.random() * 0.8), y: 0.05, z: p.z + Math.sin(a) * 0.6, vy: 0.35 + Math.random() * 0.3, wob: 0.6, size: 0.09 + Math.random() * 0.12, frame: SPRITE.bubble, alpha: 0.9 });
        if (Math.random() < 0.12) spawnRing({ life: 1.3, x: p.x + Math.cos(a) * 0.9, y: 0.03, z: p.z + Math.sin(a) * 0.5, r0: 0.05, r1: 0.45, color: aura.kind === 'poison' ? '#7a3aa0' : '#6aa8d8' });
        break;
      case 'leaves':
        auraPool.spawn({ ...base, life: 3.5, orbit: { ang: a, rad: w * 0.55 + 0.25 + Math.random() * 0.4, w: 1.2 + Math.random() * 0.6 }, x: p.x, y: 0.1 + Math.random() * 0.2, z: p.z, vy: 0.32, size: 0.12 + Math.random() * 0.06, frame: SPRITE.leaf, spin: 2 + Math.random() * 2, fade: 'inout' });
        break;
      case 'sparks':
        auraPool.spawn({ ...base, life: 0.22 + Math.random() * 0.2, x: p.x + (Math.random() - 0.5) * w * 1.1, y: 0.2 + Math.random() * h, z: p.z + (Math.random() - 0.5) * 0.4, size: 0.12 + Math.random() * 0.1, frame: SPRITE.sparkle, rot: Math.random() * 3, fade: 'none' });
        break;
      case 'snow':
        auraPool.spawn({ ...base, life: 4.5, x: p.x + (Math.random() - 0.5) * 3.6, y: 2.6 + Math.random() * 0.6, z: p.z + (Math.random() - 0.5) * 2.4, vy: -0.45, wob: 0.5, size: 0.06 + Math.random() * 0.08, frame: SPRITE.snow, spin: Math.random() - 0.5, fade: 'inout' });
        break;
      case 'rings':
        auraPool.spawn({ ...base, life: 2.6, orbit: { ang: a, rad: w * 0.6 + 0.2, w: 0.9 }, x: p.x, y: 0.2 + Math.random() * h, z: p.z, vy: 0.05, size: 0.08, frame: SPRITE.sparkle, fade: 'inout' });
        if (Math.random() < 0.08) spawnRing({ life: 2.4, x: p.x, y: 0.15, z: p.z, r0: w * 0.55 + 0.25, r1: w * 0.6 + 0.35, vy: 0.55, color: c.getStyle() });
        break;
      case 'wisps':
        auraPool.spawn({ ...base, life: 3, orbit: { ang: a, rad: w * 0.6 + 0.35 + Math.random() * 0.3, w: 0.7 + Math.random() * 0.5 }, x: p.x, y: 0.3 + Math.random() * h * 0.8, z: p.z, vy: 0.12, size: 0.16 + Math.random() * 0.1, frame: SPRITE.dot, fade: 'inout' });
        break;
      case 'sparkles':
      case 'glints':
        auraPool.spawn({ ...base, life: 0.8 + Math.random() * 0.6, x: p.x + (Math.random() - 0.5) * (w + 0.8), y: 0.1 + Math.random() * (h + 0.3), z: p.z + (Math.random() - 0.5) * 0.8, size: 0.1 + Math.random() * 0.12, frame: aura.kind === 'glints' ? SPRITE.sparkle : Math.random() < 0.5 ? SPRITE.star : SPRITE.sparkle, spin: 1.5, fade: 'inout' });
        break;
      case 'dust':
        if (Math.random() < 0.55) auraPool.spawn({ ...base, life: 1.8, x: p.x + Math.cos(a) * (0.4 + Math.random() * 0.6), y: 0.05, z: p.z + Math.sin(a) * 0.5, vx: Math.cos(a) * 0.25, vz: Math.sin(a) * 0.15, vy: 0.12, size: 0.22 + Math.random() * 0.18, frame: SPRITE.dot, alpha: 0.55, grow: 0.8, fade: 'inout' });
        else auraPool.spawn({ ...base, r: c.r * 0.7, g: c.g * 0.7, b: c.b * 0.7, life: 1.2, x: p.x + Math.cos(a) * 0.5, y: 0.05, z: p.z + Math.sin(a) * 0.4, vx: Math.cos(a) * 0.6, vz: Math.sin(a) * 0.4, vy: 1.4 + Math.random(), grav: 6, floor: 0.03, size: 0.05, frame: SPRITE.square, spin: 6 });
        break;
      case 'wind':
        auraPool.spawn({ ...base, life: 0.9, x: p.x - 2.4, y: 0.2 + Math.random() * 2, z: p.z + (Math.random() - 0.5) * 1.6, vx: 3.5 + Math.random() * 2, size: 0.5 + Math.random() * 0.3, frame: SPRITE.streak, alpha: 0.75, fade: 'inout' });
        break;
      case 'shadows':
        auraPool.spawn({ ...base, life: 2.5, x: p.x + Math.cos(a) * w * 0.6, y: 0.1 + Math.random() * 0.4, z: p.z + Math.sin(a) * 0.4, vy: 0.3, wob: 0.3, size: 0.25 + Math.random() * 0.2, frame: SPRITE.dot, alpha: 0.6, grow: 0.6, fade: 'inout' });
        break;
      case 'fireflies':
        auraPool.spawn({ ...base, life: 3.5, orbit: { ang: a, rad: 0.6 + Math.random() * 1.1, w: 0.4 + Math.random() * 0.5 }, x: p.x, y: 0.3 + Math.random() * 1.6, z: p.z, vy: (Math.random() - 0.5) * 0.2, size: 0.09, frame: SPRITE.dot, fade: 'inout' });
        break;
      case 'impact':
        auraPool.spawn({ ...base, life: 0.6, x: p.x + Math.cos(a) * 0.3, y: 0.3 + Math.random() * h * 0.6, z: p.z + Math.sin(a) * 0.3, vx: Math.cos(a) * 1.4, vz: Math.sin(a) * 0.8, vy: Math.random(), drag: 3, size: 0.09, frame: SPRITE.star });
        if (burst || Math.random() < 0.1) spawnRing({ life: 0.9, x: p.x, y: 0.03, z: p.z, r0: 0.3, r1: 1.6, color: c.getStyle() });
        break;
      default: // confetti
        auraPool.spawn({ ...base, life: 3, x: p.x + (Math.random() - 0.5) * 2.4, y: 2.2 + Math.random() * 0.5, z: p.z + (Math.random() - 0.5) * 1.4, vy: -0.5, wob: 0.6, size: 0.07, frame: SPRITE.square, spin: 4 + Math.random() * 4, rot: Math.random() * 3 });
    }
  }
  const AURA_RATE = { embers: 18, bubbles: 7, poison: 7, leaves: 5, sparks: 16, snow: 10, rings: 5, wisps: 4, sparkles: 9, glints: 5, dust: 6, wind: 7, shadows: 5, fireflies: 3.5, impact: 3, confetti: 5 };

  // ------------------------------------------------------------------ one-shot effects
  function headWorld(out = tmpV) {
    if (!model) return out.set(pokePos().x, 1.4, pokePos().z);
    pokeTurn.updateWorldMatrix(true, false);
    return out.copy(model.head).applyMatrix4(pokeTurn.matrixWorld).applyMatrix4(tmpM.copy(world.matrixWorld).invert());
  }
  function bodyWorld(fy = 0.5) {
    const p = pokePos();
    return new THREE.Vector3(p.x, H() * fy * pokeBody.scale.y + pokeBody.position.y, p.z + 0.15);
  }
  function fx(type, data = {}) {
    const p = pokePos();
    const head = headWorld(new THREE.Vector3());
    const rnd = Math.random;
    switch (type) {
      case 'hop':
        st.hopV = Math.max(st.hopV, 2.6 * (data.strength || 1));
        model?.bounce?.();
        break;
      case 'hearts':
        for (let i = 0; i < (data.count || 3); i++) {
          const c = col(pick3(['#ff4d8d', '#ff7aa8', '#ff3b6b']));
          fxPool.spawn({ r: c.r, g: c.g, b: c.b, life: 1.3 + rnd() * 0.5, x: head.x + (rnd() - 0.5) * 0.7, y: head.y - 0.2 + rnd() * 0.2, z: head.z + 0.25, vy: 0.9 + rnd() * 0.4, vx: (rnd() - 0.5) * 0.3, wob: 0.6, size: 0.2 + rnd() * 0.08, frame: SPRITE.heart, grow: 0.3 });
        }
        break;
      case 'stars':
        for (let i = 0; i < (data.count || 10); i++) {
          const a = rnd() * TAU;
          const c = col(pick3(['#ffd60a', '#fff3a0', '#ffffff']));
          const o = data.at || head;
          fxPool.spawn({ r: c.r, g: c.g, b: c.b, life: 0.9 + rnd() * 0.4, x: o.x, y: o.y, z: o.z + 0.2, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2 + 0.5, vz: (rnd() - 0.5), drag: 3, size: 0.16, frame: SPRITE.star, spin: 4 });
        }
        break;
      case 'confetti':
        for (let i = 0; i < (data.count || 40); i++) {
          const c = col(pick3(['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#ff70a6', '#ffffff']));
          fxPool.spawn({ r: c.r, g: c.g, b: c.b, life: 2 + rnd(), x: p.x + (rnd() - 0.5) * 0.6, y: 1.2 + rnd() * 0.6, z: p.z + 0.3, vx: (rnd() - 0.5) * 4, vy: 2 + rnd() * 2.5, vz: (rnd() - 0.5) * 2, grav: 3.5, drag: 1.4, size: 0.07, frame: SPRITE.square, spin: 8 * (rnd() - 0.5), rot: rnd() * 3 });
        }
        break;
      case 'crumbs': {
        const c = col(BERRY_COLORS[data.berry] || '#ec4899');
        for (let i = 0; i < 10; i++) {
          const k = rnd() < 0.5 ? c : col('#c98f55');
          fxPool.spawn({ r: k.r, g: k.g, b: k.b, life: 0.9, x: head.x + (rnd() - 0.5) * 0.2, y: head.y - H() * 0.3, z: head.z + 0.35, vx: (rnd() - 0.5) * 1.6, vy: 0.6 + rnd(), vz: 0.4 + rnd() * 0.5, grav: 6, floor: 0.03, size: 0.045, frame: SPRITE.square, spin: 8 });
        }
        model?.chomp?.();
        st.eatK = 1;
        break;
      }
      case 'bubbles': {
        const n = data.count || 3;
        for (let i = 0; i < n; i++) {
          const q = bodyWorld(0.2 + rnd() * 0.75);
          fxPool.spawn({ r: 0.85, g: 0.95, b: 1, life: 1.2 + rnd(), x: q.x + (rnd() - 0.5) * Wd(), y: q.y, z: q.z + 0.2, vy: 0.3 + rnd() * 0.3, wob: 0.6, size: 0.1 + rnd() * 0.12, frame: SPRITE.bubble });
        }
        break;
      }
      case 'spray':
        for (let i = 0; i < 6; i++) {
          const c = col(pick3(['#7cc8ff', '#b8e4ff', '#ffffff']));
          fxPool.spawn({ r: c.r, g: c.g, b: c.b, life: 0.8, x: p.x + (rnd() - 0.5) * 0.5, y: H() + 0.9, z: p.z + 0.35 + (rnd() - 0.5) * 0.3, vx: (rnd() - 0.5) * 1.4, vy: -1.5 - rnd(), grav: 5, floor: 0.04, size: 0.08, frame: SPRITE.drop });
        }
        break;
      case 'sparkle':
        for (let i = 0; i < (data.count || 14); i++) {
          const q = bodyWorld(0.1 + rnd() * 0.9);
          const c = col(pick3(['#ffffff', '#fff3a0', '#bff0ff']));
          fxPool.spawn({ r: c.r, g: c.g, b: c.b, life: 0.7 + rnd() * 0.6, x: q.x + (rnd() - 0.5) * Wd() * 1.1, y: q.y, z: q.z + 0.3, size: 0.12 + rnd() * 0.14, frame: SPRITE.sparkle, spin: 2, fade: 'inout' });
        }
        break;
      case 'zzz':
        fxPool.spawn({ r: 0.75, g: 0.85, b: 1, life: 2.4, x: head.x + 0.25, y: head.y - 0.1, z: head.z + 0.2, vx: 0.25, vy: 0.4, wob: 0.4, size: 0.18, grow: 1.2, frame: SPRITE.z, fade: 'inout' });
        break;
      case 'note': {
        const c = col(pick3(['#ffd166', '#ff8fab', '#80ffdb', '#a0c4ff']));
        fxPool.spawn({ r: c.r, g: c.g, b: c.b, life: 2, x: p.x + (rnd() < 0.5 ? -1 : 1) * (Wd() * 0.5 + 0.3), y: H() * 0.6, z: p.z + 0.3, vy: 0.5, wob: 0.7, size: 0.2, frame: SPRITE.note, fade: 'inout' });
        break;
      }
      case 'burst': {
        const o = new THREE.Vector3(0, 0.35, 0);
        for (let i = 0; i < 46; i++) {
          const a = rnd() * TAU;
          const e = (rnd() - 0.3) * 1.2;
          const c = pick3(auraCols);
          fxPool.spawn({ r: c.r, g: c.g, b: c.b, life: 0.9 + rnd() * 0.6, x: o.x, y: o.y, z: o.z, vx: Math.cos(a) * 3.2, vy: e * 3 + 1, vz: Math.sin(a) * 2.2, drag: 2.6, size: 0.1 + rnd() * 0.1, frame: rnd() < 0.5 ? SPRITE.sparkle : SPRITE.dot, spin: 3 });
        }
        for (let i = 0; i < 24; i++) spawnAura(true);
        spawnRing({ life: 0.8, x: 0, y: 0.04, z: 0, r0: 0.2, r1: 2.2, color: auraCols[0].getStyle() });
        spawnRing({ life: 1.0, x: 0, y: 0.04, z: 0, r0: 0.1, r1: 1.5, color: '#ffffff' });
        break;
      }
      case 'dust':
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          fxPool.spawn({ r: 0.95, g: 0.92, b: 0.85, life: 0.7, x: (data.x ?? p.x) + Math.cos(a) * 0.3, y: 0.05, z: (data.z ?? p.z) + Math.sin(a) * 0.2, vx: Math.cos(a) * 1.4, vz: Math.sin(a) * 0.8, vy: 0.3, drag: 3, size: 0.18, grow: 1, frame: SPRITE.dot, alpha: 0.7 });
        }
        break;
      case 'ring':
        spawnRing({ life: 0.6, x: data.x ?? p.x, y: 0.04, z: data.z ?? p.z, r0: 0.2, r1: data.r || 1.4, color: data.color || '#ffffff' });
        break;
      case 'eat':
        st.berryEat = 1;
        break;
      case 'wiggle':
        st.wiggle = 1;
        model?.wobble?.();
        break;
      case 'shine':
        st.shine = 1;
        break;
      default:
    }
  }

  // ------------------------------------------------------------------ frame
  function update(dt, view = {}) {
    if (disposed) return;
    dt = clamp(dt || 0, 0, 0.1);
    st.t += dt;
    const t = st.t;
    // adaptive pixel ratio (real frame time)
    const now = typeof performance !== 'undefined' ? performance.now() : t * 1000;
    if (st.last) {
      st.frameMs = st.frameMs * 0.94 + Math.min(200, now - st.last) * 0.06;
      st.slow = st.frameMs > 30 ? st.slow + dt : Math.max(0, st.slow - dt);
      if (st.slow > 1.5 && pr > 1) {
        pr = Math.max(1, pr - 0.5);
        renderer.setPixelRatio(pr);
        resize(width, height);
        st.slow = 0;
      }
    }
    st.last = now;

    const reveal = view.reveal || null;
    const v = view.poke || {};
    world.position.y = Math.sin(t * 0.8) * 0.035;

    // night / party
    st.night = ease(st.night, Math.max(view.night || 0, 0), 4, dt);
    skyU.uNight.value = st.night;
    const darkTheme = baseNight;
    starMat.opacity = clamp(Math.max(st.night, darkTheme * 0.8), 0, 1) * (0.7 + 0.3 * Math.sin(t * 2));
    moon.visible = darkTheme > 0 || st.night > 0.05;
    moon.material.opacity = Math.max(darkTheme, st.night);
    hemi.intensity = 1.25 * (1 - st.night * 0.55);
    sun.intensity = 1.7 * (1 - st.night * 0.8);
    rim.color.setRGB(1, 1, 1).lerp(col('#9fb6ff'), st.night);
    rim.intensity = 1.6 + st.night * 0.6;
    st.party = ease(st.party, view.party || 0, 6, dt);
    party.intensity = st.party * (6 + (view.beat || 0) * 10);
    party.color.setHSL((t * 0.25) % 1, 0.9, 0.6);
    beams.visible = st.party > 0.02;
    if (beams.visible) {
      beams.material.uniforms.uOpacity.value = st.party * (0.55 + (view.beat || 0) * 0.45);
      for (let i = 0; i < 3; i++) {
        const sx = (i - 1) * 1.7;
        tmpQ.setFromEuler(tmpE.set(Math.sin(t * 1.3 + i * 2) * 0.25 + 0.15, 0, Math.sin(t * 1.7 + i) * 0.35 - (i - 1) * 0.3));
        tmpM.compose(tmpS.set(sx, 4.4, 0.6), tmpQ, tmpV.set(1, 1, 1));
        beams.setMatrixAt(i, tmpM);
      }
      beams.instanceMatrix.needsUpdate = true;
    }
    for (const a of deco.animated) {
      if (a.kind === 'lava') a.material.color.setHSL(0.04 + Math.sin(t * 2) * 0.015, 1, 0.5 + Math.sin(t * 3.1) * 0.08);
      else a.uniform.value = a.base * (1 + st.night * 1.2) * (0.85 + 0.15 * Math.sin(t * 2.3));
    }
    if (lavaRing) lavaRing.material.color.setHSL(0.05, 1, 0.5 + Math.sin(t * 2.6) * 0.1);
    if (waterU) waterU.uTime.value = t;
    if (heat) heat.material.uniforms.uTime.value = t;
    if (clouds) clouds.rotation.y = Math.sin(t * 0.02) * 0.2;

    // ---------------- Pokémon pose
    st.look = ease(st.look, clamp(view.look || 0, -1, 1), 5, dt);
    // own hop physics (taps)
    st.hopV -= 9.8 * dt;
    st.hop += st.hopV * dt;
    let landed = false;
    if (st.hop <= 0) {
      if (st.hopV < -1.5) {
        landed = true;
        fx('dust', {});
      }
      st.hop = 0;
      st.hopV = 0;
    }
    st.wiggle = Math.max(0, st.wiggle - dt * 1.8);
    st.eatK = Math.max(0, st.eatK - dt * 2.5);
    st.shine = Math.max(0, st.shine - dt * 0.6);
    const anim = v.anim || 'idle';
    const wig = Math.max(st.wiggle, v.wiggle || 0);
    const idle = idlePose(t, { look: anim === 'idle' || anim === 'happy' || anim === 'eat' ? st.look : 0, hop: 0, excited: wig });
    st.sleepK = ease(st.sleepK, v.sleep || 0, 3, dt);
    const px = v.x ?? 0;
    const pz = v.z ?? 0;
    st.pose.x = view.instant ? px : ease(st.pose.x, px, 14, dt);
    st.pose.z = view.instant ? pz : ease(st.pose.z, pz, 14, dt);
    pokeRoot.position.set(st.pose.x, 0, st.pose.z);
    const rotT = v.rotY ?? 0;
    let dr = rotT - st.pose.rotY;
    while (dr > Math.PI) dr -= TAU;
    while (dr < -Math.PI) dr += TAU;
    st.pose.rotY += dr * (1 - Math.exp(-10 * dt));
    pokeRoot.rotation.y = st.pose.rotY;
    pokeTurn.rotation.y = idle.rotY * (1 - st.sleepK);
    pokeTurn.rotation.x = st.lookY * 0.1 + (v.lean || 0) * 0.35 + st.eatK * 0.15;
    let y = st.hop + (v.y || 0);
    let sx = idle.sx;
    let sy = idle.sy;
    let rz = idle.rotZ * (1 - st.sleepK);
    const isStandee = model && (model.kind === 'standee' || model.kind === 'billboard');
    if (anim === 'run' && isStandee) {
      y += Math.abs(Math.sin(t * 15)) * 0.13;
      rz += Math.sin(t * 15) * 0.12;
    }
    if (anim === 'dance') {
      y += (v.hop || 0) * 0.28;
      rz += (v.sway || 0) * 0.22;
      sy *= 1 + (v.hop || 0) * 0.06;
    }
    if (anim === 'celebrate' && isStandee) y += Math.abs(Math.sin(t * 9)) * 0.18;
    if (v.hop && anim !== 'dance') y += Math.sin(clamp(v.hop, 0, 1) * Math.PI) * 0.35;
    // sleeping: lean over, flatter, slow breathing
    rz += st.sleepK * 0.42;
    sy *= 1 - st.sleepK * (0.12 + Math.sin(t * 1.6) * 0.03);
    sx *= 1 + st.sleepK * 0.05;
    // land squash after a hop
    if (st.hop === 0 && st.lastHopY > 0.05) st.wiggle = Math.max(st.wiggle, 0.15);
    st.lastHopY = st.hop;
    let scale = v.scale ?? 1;
    let visible = v.visible !== false && !!model;
    if (reveal) {
      scale *= reveal.poke.scale;
      y += reveal.poke.y;
      const q = reveal.poke.squash;
      sy *= 1 - q * 0.32;
      sx *= 1 + q * 0.22;
      visible = visible && reveal.poke.visible;
    }
    if (landed) {
      sy *= 0.85;
      sx *= 1.1;
    }
    pokeBody.position.y = y;
    pokeBody.rotation.z = rz;
    pokeBody.scale.set(sx * scale, sy * scale, sx * scale);
    pokeBody.visible = visible;
    shadow.visible = visible || (reveal && reveal.t > 2);
    const shk = clamp(1 - y * 0.5, 0.3, 1) * scale;
    shadow.material.opacity = 0.9 * shk;
    shadow.scale.x = (model ? Math.max(0.9, model.footprint * 1.6) : 1) * (0.6 + 0.4 * shk);
    shadow.scale.z = (model ? Math.max(0.7, model.footprint * 1.1) : 0.8) * (0.6 + 0.4 * shk);
    if (model) {
      model.setWhite(reveal ? reveal.poke.white : st.shine * 0.25);
      model.update(dt, { anim, t, airborne: st.hop > 0.05, vy: st.hopV, landed });
    }

    // ---------------- reveal props
    ball.group.visible = !!reveal && reveal.ball.visible;
    if (reveal) {
      const b = reveal.ball;
      const s = 1 - b.fade;
      ball.group.position.set(0, b.y, 0);
      ball.group.scale.set((1 + b.squash * 0.25) * s, (1 - b.squash) * s, (1 + b.squash * 0.25) * s);
      ball.group.rotation.set(0, 0, b.tilt);
      ball.hinge.rotation.x = -b.open * 1.9;
      ball.btnMat.emissiveIntensity = b.glow * 1.2 + b.open * 2;
      for (const m of ball.mats) m.emissiveIntensity = b.open * 0.6;
    }
    const fl = reveal ? reveal.flash : 0;
    flash.visible = fl > 0.01;
    flash.position.set(0, 0.45, 0.2);
    flash.scale.setScalar(0.6 + fl * 5.5);
    flashMat.opacity = fl;
    const ry = reveal ? reveal.rays : 0;
    rays.visible = ry > 0.01;
    if (rays.visible) {
      rays.position.set(0, 0.45, 0);
      rays.quaternion.copy(camera.quaternion);
      rays.rotateZ(t * 0.6);
      rays.scale.setScalar(0.5 + ry * 0.8);
      raysMat.uniforms.uOpacity.value = ry * 0.85;
    }

    // ---------------- activity props
    const vb = view.ball;
    toy.visible = !!(vb && vb.visible);
    toyShadow.visible = toy.visible;
    if (toy.visible) {
      toy.position.set(vb.x, vb.y, vb.z);
      toy.rotation.x -= dt * 8;
      toyShadow.position.set(vb.x, 0.012, vb.z);
      const k = clamp(1 - vb.y * 0.3, 0.3, 1);
      toyShadow.scale.set(0.45 * k, 1, 0.45 * k);
      toyShadow.material.opacity = k;
    }
    const vbs = view.bushes;
    bushes.visible = !!vbs;
    if (vbs) {
      for (let i = 0; i < 3; i++) {
        const b = vbs[i];
        const shake = b.shake || 0;
        tmpQ.setFromEuler(tmpE.set(0, 0, Math.sin(t * 34 + i) * 0.14 * shake));
        tmpM.compose(tmpS.set(b.x, 0, b.z), tmpQ, tmpV.set(0.78 + shake * 0.06, 0.82 - shake * 0.05, 0.78));
        bushes.setMatrixAt(i, tmpM);
      }
      bushes.instanceMatrix.needsUpdate = true;
    }
    const drag = view.dragBerry;
    st.berryEat = Math.max(0, st.berryEat - dt * 2.2);
    if (drag) {
      berry.visible = true;
      berryBody.material = berryMat(drag.type);
      // unproject the finger onto a plane in front of the Pokémon
      ndc.set(drag.nx * 2 - 1, -(drag.ny * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(pokeRoot.position.z + 0.7));
      const hit = raycaster.ray.intersectPlane(plane, tmpV);
      if (hit) berry.position.copy(hit).sub(world.position);
      berry.scale.setScalar(1.3);
      berry.rotation.y += dt * 2;
    } else if (st.berryEat > 0) {
      const h = headWorld(new THREE.Vector3());
      berry.position.lerp(tmpV.set(h.x, h.y - H() * 0.3, h.z + 0.3), 1 - Math.exp(-14 * dt));
      berry.scale.setScalar(st.berryEat * 1.3);
    } else berry.visible = false;

    // foam (bath)
    const soap = view.soap || 0;
    const surf = model?.surface || [];
    if (surf.length) pokeTurn.updateWorldMatrix(true, false);
    const invWorld = tmpM.copy(world.matrixWorld).invert();
    for (let i = 0; i < foamPool.items.length; i++) {
      const it = foamPool.items[i];
      const on = i < Math.round(soap * foamPool.items.length) && surf.length && visible;
      if (!on) {
        it.life = 0;
        continue;
      }
      const sp = surf[i % surf.length];
      tmpS.copy(sp).applyMatrix4(pokeTurn.matrixWorld).applyMatrix4(invWorld);
      it.life = 1;
      it.max = 1;
      it.x = tmpS.x + Math.sin(t * 2 + i) * 0.02;
      it.y = tmpS.y + Math.cos(t * 2.3 + i) * 0.02;
      it.z = tmpS.z + 0.04;
      it.size = (0.14 + (i % 5) * 0.03) * (0.9 + 0.1 * Math.sin(t * 4 + i));
      it.frame = i % 3 ? SPRITE.bubble : SPRITE.dot;
      it.r = 1;
      it.g = 1;
      it.b = 1;
      it.alpha = 0.95;
      it.fade = 'none';
    }
    foamPool.flush();
    if (view.water && Math.random() < dt * 30) fx('spray');
    if (view.shine && Math.random() < dt * 14) fx('sparkle', { count: 2 });

    // ---------------- aura & particles
    if (model && visible) {
      st.auraAcc += dt * (AURA_RATE[aura.kind] || 5) * (reveal ? 1.6 : 1);
      while (st.auraAcc >= 1) {
        st.auraAcc -= 1;
        spawnAura();
      }
    }
    for (const it of auraPool.items) {
      if (it.life > 0 && it.orbit) {
        it.orbit.ang += it.orbit.w * dt;
        it.x = pokeRoot.position.x + Math.cos(it.orbit.ang) * it.orbit.rad;
        it.z = pokeRoot.position.z + Math.sin(it.orbit.ang) * it.orbit.rad * 0.7;
      }
    }
    auraPool.step(dt, t);
    auraPool.flush();
    fxPool.step(dt, t);
    fxPool.flush();
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      if (r.life <= 0) {
        ringMesh.setMatrixAt(i, zeroM);
        continue;
      }
      r.life -= dt;
      r.y += r.vy * dt;
      const k = 1 - Math.max(0, r.life) / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) ** 2);
      tmpQ.setFromEuler(tmpE.set(Math.PI / 2, 0, 0));
      tmpM.compose(tmpS.set(r.x, r.y, r.z), tmpQ, tmpV.set(rad, rad, rad * (r.flat ? 1 : 1)));
      ringMesh.setMatrixAt(i, tmpM);
      ringMesh.setColorAt(i, tmpC.copy(r.color).multiplyScalar(Math.sin(Math.PI * Math.min(1, k * 1.2)) * 0.9));
    }
    ringMesh.instanceMatrix.needsUpdate = true;
    if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
    if (arcs) {
      st.arcT -= dt;
      if (st.arcT <= 0) {
        st.arcT = 0.06 + Math.random() * 0.08;
        const pos = arcs.geometry.attributes.position;
        const show = visible && Math.random() < 0.55;
        const h = H();
        const w = Wd();
        let k = 0;
        for (let a = 0; a < 2; a++) {
          const sx0 = pokeRoot.position.x + (Math.random() - 0.5) * w * 1.3;
          const sy0 = 0.3 + Math.random() * h;
          const ex = sx0 + (Math.random() - 0.5) * 0.9;
          const ey = sy0 + (Math.random() - 0.5) * 0.7;
          let x0 = sx0;
          let y0 = sy0;
          const z = pokeRoot.position.z + 0.3;
          for (let s = 1; s <= 9; s++) {
            const f = s / 9;
            const x1 = sx0 + (ex - sx0) * f + (s < 9 ? (Math.random() - 0.5) * 0.18 : 0);
            const y1 = sy0 + (ey - sy0) * f + (s < 9 ? (Math.random() - 0.5) * 0.18 : 0);
            pos.setXYZ(k++, show ? x0 : 0, show ? y0 : -99, z);
            pos.setXYZ(k++, show ? x1 : 0, show ? y1 : -99, z);
            x0 = x1;
            y0 = y1;
          }
        }
        pos.needsUpdate = true;
      }
    }

    // ---------------- camera
    const cam = view.camera;
    const r = reveal ? reveal.camera : null;
    const yawT = (cam ? cam.yaw : Math.sin(t * 0.13) * 0.2 + st.look * 0.06) + (r ? r.yaw : 0);
    const pitchT = 0.2 + (cam ? cam.pitch : 0) + (r ? r.lift : 0) + st.night * 0.05;
    const distT = (r ? r.dist : 1) * (view.zoom || 1);
    st.camYaw = ease(st.camYaw, yawT, cam ? 8 : 3, dt);
    st.camPitch = ease(st.camPitch, pitchT, 3, dt);
    st.camDist = ease(st.camDist, distT, 3, dt);
    const d = baseDist * st.camDist;
    const bob = (view.beat || 0) * 0.04;
    camera.position.set(Math.sin(st.camYaw) * Math.cos(st.camPitch) * d, target.y + Math.sin(st.camPitch) * d + bob, Math.cos(st.camYaw) * Math.cos(st.camPitch) * d);
    camera.lookAt(target);

    renderer.render(scene, camera);
  }

  /** What is under the finger (nx, ny in 0..1 of the canvas). */
  function pick(nx, ny) {
    ndc.set(nx * 2 - 1, -(ny * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const out = { pokemon: false, bush: -1 };
    if (proxy && pokeBody.visible) out.pokemon = raycaster.intersectObject(proxy, false).length > 0;
    if (bushes.visible) {
      const hit = raycaster.intersectObject(bushes, false)[0];
      if (hit) out.bush = hit.instanceId;
    }
    return out;
  }

  /** Screen anchors (0..1) for HTML overlays: head (hats, speech), body (DOM image fallback). */
  function anchors() {
    const proj = (p) => {
      const q = p.clone().add(world.position).project(camera);
      return { x: (q.x + 1) / 2, y: (1 - q.y) / 2 };
    };
    const head = proj(headWorld(new THREE.Vector3()));
    const feet = proj(new THREE.Vector3(pokeRoot.position.x, 0, pokeRoot.position.z));
    return { head, feet, visible: pokeBody.visible, status };
  }

  function capture() {
    renderer.render(scene, camera);
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  function stats() {
    return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: pr, status, frameMs: Math.round(st.frameMs * 10) / 10 };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    try {
      model?.dispose?.();
    } catch {
      // ignore
    }
    scene.traverse((o) => {
      if (o.geometry) owned.add(o.geometry);
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        owned.add(m);
        if (m.map) owned.add(m.map);
      }
    });
    for (const x of owned) x?.dispose?.();
    owned.clear();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
  }

  return { canvas, ready, resize, update, fx, pick, anchors, capture, stats, dispose, theme, get status() { return status; } };
}
