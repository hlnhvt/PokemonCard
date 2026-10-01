// three.js view of "Đảo nhà Pokémon": voxel chunk mesh (hidden faces culled, vertex AO), decorations
// (InstancedMesh per type), sea with waves, sky with clouds, day/night, residents as billboards.
import * as THREE from 'three';
import { W, H, D, AIR, LAMP, GOLD, LANTERN, TREE, FLOWER, BERRY, BLOCK_BY_ID, DECOR, DECOR_BY_ID, PAINTS, isBlock, isDecor, idx } from '../../../utils/three3d/island3d';
import { buildAtlas, tileUV, blobTexture, glowTexture, emoteTexture, heartTexture, placeholderTexture, moonTexture } from './island3dTextures';
import { buildDecorModels, cloudGeometry } from './island3dModels';
import { artworkUrl } from '../../../services/pokemonOnlineService';

export const SEA_Y = 0.82;
const CENTER = new THREE.Vector3(W / 2, 2, D / 2);
const AO = [0.48, 0.66, 0.83, 1];
const TURNED = new Set([TREE, FLOWER, BERRY]); // decorations with a random turn

// Faces: normal, 4 corners (bottom-left, bottom-right, top-right, top-left seen from outside), atlas row
const FACES = [
  { n: [1, 0, 0], row: 1, c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], row: 1, c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], row: 0, c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], row: 2, c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], row: 1, c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], row: 1, c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const see = (v) => !!BLOCK_BY_ID[v]?.see;
const glows = (v) => !!BLOCK_BY_ID[v]?.glow;

/** Geometry buffers being filled. */
const buffers = () => ({ pos: [], nor: [], uv: [], col: [], index: [] });

function toGeometry(b) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setIndex(b.index);
  g.computeBoundingSphere();
  return g;
}

const tint = new THREE.Color();
function pushFace(b, f, x, y, z, id, paint, ao) {
  const base = b.pos.length / 3;
  const [u0, v0, u1, v1] = tileUV(id, f.row + (paint ? 3 : 0));
  const uvs = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  if (paint) tint.set(PAINTS[paint]);
  else tint.setRGB(1, 1, 1);
  for (let k = 0; k < 4; k++) {
    const c = f.c[k];
    b.pos.push(x + c[0], y + c[1], z + c[2]);
    b.nor.push(...f.n);
    b.uv.push(...uvs[k]);
    const a = AO[ao[k]];
    b.col.push(tint.r * a, tint.g * a, tint.b * a);
  }
  if (ao[0] + ao[2] < ao[1] + ao[3]) b.index.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
  else b.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/** One cube (for the squash animation and the ghost), bottom centre at the origin. */
function cubeGeometry(id, paint) {
  const b = buffers();
  for (const f of FACES) pushFace(b, f, -0.5, 0, -0.5, id, paint, [3, 3, 3, 3]);
  return toGeometry(b);
}

/** Chunk meshes for the whole grid: opaque, see-through and glowing blocks. */
function buildChunk(grid, skip) {
  const cells = grid.cells;
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D ? AIR : cells[idx(x, y, z)]);
  const occ = (x, y, z) => {
    const v = at(x, y, z);
    return isBlock(v) && !see(v) && !skip.has(idx(x, y, z)) ? 1 : 0;
  };
  const out = { opaque: buffers(), see: buffers(), glow: buffers() };
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = idx(x, y, z);
        const v = cells[i];
        if (!isBlock(v) || skip.has(i)) continue;
        const target = see(v) ? out.see : glows(v) ? out.glow : out.opaque;
        const paint = grid.paint[i];
        for (const f of FACES) {
          const [nx, ny, nz] = f.n;
          if (y === 0 && ny === -1) continue;
          const nb = at(x + nx, y + ny, z + nz);
          const nbSkip = skip.has(idx(x + nx, y + ny, z + nz));
          if (!nbSkip && isBlock(nb) && (!see(nb) || nb === v)) continue;
          // Ambient occlusion from the layer in front of the face
          const ax = [0, 1, 2].filter((a) => f.n[a] === 0);
          const ao = f.c.map((c) => {
            const p = [x + nx, y + ny, z + nz];
            const s1 = [...p];
            const s2 = [...p];
            s1[ax[0]] += c[ax[0]] ? 1 : -1;
            s2[ax[1]] += c[ax[1]] ? 1 : -1;
            const cr = [...s1];
            cr[ax[1]] += c[ax[1]] ? 1 : -1;
            const a = occ(...s1);
            const bb = occ(...s2);
            return a && bb ? 0 : 3 - (a + bb + occ(...cr));
          });
          pushFace(target, f, x, y, z, v, paint, ao);
        }
      }
    }
  }
  return { opaque: toGeometry(out.opaque), see: toGeometry(out.see), glow: toGeometry(out.glow) };
}

const lerpColor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

/**
 * Create the scene in `container`. Throws if WebGL is unavailable.
 * Returns { update, pick, orbit, zoom, pan, rotate90, resetView, effect, dispose }.
 */
export function createIsland3DScene(container, { random = Math.random } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
  const textures = [];
  const keep = (t) => (textures.push(t), t);

  // ---------- sky, sun, moon, stars, clouds
  const skyUniforms = { top: { value: new THREE.Color('#4aa8ff') }, bottom: { value: new THREE.Color('#d4f0ff') } };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.02, 0.55, h)), 1.0); }',
    })
  );
  sky.renderOrder = -10;
  scene.add(sky);
  scene.fog = new THREE.Fog('#d4f0ff', 70, 230);

  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: keep(glowTexture('rgba(255,250,220,1)', 'rgba(255,230,150,0)')), fog: false, depthWrite: false, transparent: true }));
  sun.scale.set(60, 60, 1);
  scene.add(sun);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: keep(moonTexture()), fog: false, depthWrite: false, transparent: true, opacity: 0 }));
  moon.scale.set(46, 46, 1);
  scene.add(moon);

  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let k = 0; k < 500; k++) {
    const a = random() * Math.PI * 2;
    const h = 0.08 + random() * 0.9;
    const r = 380;
    starPos.push(Math.cos(a) * Math.sqrt(1 - h * h) * r, h * r, Math.sin(a) * Math.sqrt(1 - h * h) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);

  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.94 });
  const clouds = [];
  for (let k = 0; k < 7; k++) {
    const m = new THREE.Mesh(cloudGeometry(random), k ? cloudMat.clone() : cloudMat);
    const a = (k / 7) * Math.PI * 2 + random();
    const r = 24 + random() * 26;
    m.position.set(CENTER.x + Math.cos(a) * r, 12 + random() * 6, CENTER.z + Math.sin(a) * r);
    m.userData.speed = 0.6 + random() * 0.8;
    scene.add(m);
    clouds.push(m);
  }

  // Fireflies at night
  const flyCount = 40;
  const flyGeo = new THREE.BufferGeometry();
  const flySeed = Array.from({ length: flyCount }, () => [random() * W, 2 + random() * 4, random() * D, random() * 6]);
  flyGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(flyCount * 3), 3));
  const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ color: '#e9ff8a', size: 0.22, map: keep(glowTexture('rgba(240,255,170,1)', 'rgba(200,255,120,0)')), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  flies.visible = false;
  scene.add(flies);

  // ---------- lights
  const hemi = new THREE.HemisphereLight('#dff2ff', '#6b8f5a', 1.7);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight('#ffffff', 0.35);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight('#fff4dd', 2.3);
  dir.position.set(CENTER.x + 14, 26, CENTER.z + 9);
  dir.target.position.copy(CENTER);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  Object.assign(dir.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
  dir.shadow.bias = -0.0008;
  dir.shadow.normalBias = 0.03;
  dir.shadow.radius = 3;
  scene.add(dir, dir.target);
  const sunDir = new THREE.Vector3().subVectors(dir.position, CENTER).normalize();
  sun.position.copy(CENTER).addScaledVector(sunDir, 300);
  moon.position.copy(CENTER).addScaledVector(new THREE.Vector3(-0.6, 0.55, -0.55).normalize(), 300);

  // ---------- sea
  const seaGeo = new THREE.PlaneGeometry(260, 260, 72, 72).rotateX(-Math.PI / 2);
  seaGeo.translate(CENTER.x, SEA_Y, CENTER.z);
  const seaBase = seaGeo.attributes.position.array.slice();
  const seaMat = new THREE.MeshPhongMaterial({ color: '#2aa6d9', specular: '#cdefff', shininess: 70, transparent: true, opacity: 0.8, depthWrite: false });
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.receiveShadow = true;
  sea.renderOrder = 2;
  scene.add(sea);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(200, 32).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#4fb8b3' }));
  floor.position.set(CENTER.x, -1.6, CENTER.z);
  scene.add(floor);
  // Lighter shallow water around the island
  const shallow = new THREE.Mesh(
    new THREE.CircleGeometry(15, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: keep(glowTexture('rgba(190,255,240,0.9)', 'rgba(120,230,220,0)')), transparent: true, depthWrite: false, opacity: 0.55 })
  );
  shallow.position.set(CENTER.x, -1.55, CENTER.z);
  scene.add(shallow);

  // ---------- blocks
  const atlas = keep(buildAtlas());
  const blockMat = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
  const seeMat = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false });
  const glowMat = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, emissive: '#ffd36b', emissiveMap: atlas, emissiveIntensity: 0 });
  const chunk = { opaque: new THREE.Mesh(new THREE.BufferGeometry(), blockMat), see: new THREE.Mesh(new THREE.BufferGeometry(), seeMat), glow: new THREE.Mesh(new THREE.BufferGeometry(), glowMat) };
  chunk.opaque.castShadow = chunk.opaque.receiveShadow = true;
  chunk.glow.castShadow = chunk.glow.receiveShadow = true;
  chunk.see.receiveShadow = true;
  chunk.see.renderOrder = 3;
  Object.values(chunk).forEach((m) => scene.add(m));

  // ---------- decorations
  const models = buildDecorModels();
  const decorMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const decorGlowMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffcf5a', emissiveIntensity: 0 });
  const decorWaterMat = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.85, shininess: 90 });
  const CAP = 160;
  const decorMeshes = {}; // id -> [InstancedMesh]
  const decorCells = {}; // id -> [cell idx] per instance
  for (const d of DECOR) {
    decorMeshes[d.id] = models[d.id].map((p) => {
      const m = new THREE.InstancedMesh(p.geo, p.glow ? decorGlowMat : p.water ? decorWaterMat : decorMat, CAP);
      m.count = 0;
      m.castShadow = !p.water;
      m.receiveShadow = true;
      m.userData.decor = d.id;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    });
    decorCells[d.id] = [];
  }

  // Night glow sprites (lamps, lanterns, gold)
  const glowTex = keep(glowTexture());
  const glowSprites = [];
  for (let k = 0; k < 48; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false;
    sp.scale.set(2.6, 2.6, 1);
    scene.add(sp);
    glowSprites.push(sp);
  }
  let glowSpots = [];

  // ---------- rebuild from the grid
  let builtRev = -1;
  let needRebuild = false;
  const skip = new Set(); // cells hidden while their squash animation plays
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  function rebuild(grid) {
    const geos = buildChunk(grid, skip);
    for (const k of Object.keys(chunk)) {
      chunk[k].geometry.dispose();
      chunk[k].geometry = geos[k];
    }
    const lists = Object.fromEntries(DECOR.map((d) => [d.id, []]));
    glowSpots = [];
    for (let i = 0; i < grid.cells.length; i++) {
      const v = grid.cells[i];
      if (v === AIR) continue;
      if (isDecor(v) && lists[v] && !skip.has(i)) lists[v].push(i);
      if (v === LAMP || v === GOLD || v === LANTERN) glowSpots.push({ i, v });
    }
    for (const d of DECOR) {
      const cells = lists[d.id].slice(0, CAP);
      decorCells[d.id] = cells;
      for (const m of decorMeshes[d.id]) {
        cells.forEach((i, k) => {
          const x = i % W;
          const z = Math.floor(i / W) % D;
          const y = Math.floor(i / (W * D));
          const rot = TURNED.has(d.id) ? ((i * 2654435761) % 628) / 100 : 0;
          q.setFromAxisAngle(up, rot);
          mtx.compose(new THREE.Vector3(x + 0.5, y, z + 0.5), q, one);
          m.setMatrixAt(k, mtx);
        });
        m.count = cells.length;
        m.instanceMatrix.needsUpdate = true;
        m.computeBoundingSphere();
      }
    }
  }

  // ---------- squash animations, particles, hearts
  const anims = [];
  const animGeos = new Map();
  const cubeGeo = (id, paint) => {
    const k = `${id}:${paint}`;
    if (!animGeos.has(k)) animGeos.set(k, cubeGeometry(id, paint));
    return animGeos.get(k);
  };

  const PCAP = 420;
  const partMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff' }), PCAP);
  partMesh.count = 0;
  partMesh.frustumCulled = false;
  partMesh.setColorAt(0, new THREE.Color('#ffffff'));
  scene.add(partMesh);
  const parts = [];
  const pColor = new THREE.Color();
  function burst(x, y, z, colors, { n = 14, speed = 3, size = 0.16, life = 0.8, up: lift = 2.5, flat = false } = {}) {
    for (let k = 0; k < n && parts.length < PCAP; k++) {
      const a = random() * Math.PI * 2;
      const v = speed * (0.4 + random() * 0.8);
      parts.push({ x, y, z, vx: Math.cos(a) * v, vy: lift * (0.5 + random()), vz: Math.sin(a) * v, life, max: life, size: size * (0.6 + random() * 0.8), color: colors[k % colors.length], rot: random() * 6, flat });
    }
  }

  const heartTex = keep(heartTexture());
  const hearts = [];
  for (let k = 0; k < 18; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
    sp.visible = false;
    scene.add(sp);
    hearts.push({ sp, life: 0 });
  }
  function heartsAt(x, y, z, n = 6) {
    let made = 0;
    for (const h of hearts) {
      if (h.life > 0 || made >= n) continue;
      made++;
      h.life = 1.6 + random() * 0.6;
      h.max = h.life;
      h.sp.position.set(x + (random() - 0.5) * 1.6, y + 0.8 + random() * 0.6, z + (random() - 0.5) * 1.6);
      h.vx = (random() - 0.5) * 0.4;
      h.sp.visible = true;
    }
  }

  // ---------- ghost (where the block goes)
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false });
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.04, 1.04, 1.04), ghostMat);
  const ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.06, 1.06, 1.06)), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 }));
  ghost.add(ghostEdges);
  ghost.visible = false;
  ghost.renderOrder = 5;
  scene.add(ghost);

  // ---------- residents
  const blobTex = keep(blobTexture());
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const emoteTex = {};
  const emoteFor = (kind) => emoteTex[kind] || (emoteTex[kind] = keep(emoteTexture(kind)));
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const residents = new Map();
  const COLORS = ['#fbbf24', '#38bdf8', '#f472b6', '#4ade80', '#a78bfa', '#fb923c', '#f87171'];
  function residentView(r, k) {
    if (residents.has(r.key)) return residents.get(r.key);
    const group = new THREE.Group();
    const mat = new THREE.SpriteMaterial({ map: keep(placeholderTexture(r.name, COLORS[k % COLORS.length])), transparent: true, alphaTest: 0.08 });
    const sprite = new THREE.Sprite(mat);
    sprite.center.set(0.5, 0.04);
    const size = r.isPlayer ? 1.75 : 1.6;
    sprite.scale.set(size, size, 1);
    const shadow = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    shadow.scale.set(0.95, 1, 0.95);
    shadow.renderOrder = 4;
    const emote = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteFor('heart'), transparent: true, depthWrite: false }));
    emote.visible = false;
    emote.renderOrder = 6;
    group.add(sprite, emote);
    scene.add(group, shadow);
    const view = { group, sprite, shadow, emote, size, kind: null, phase: random() * 6, alive: true };
    const url = r.image || (r.dex ? artworkUrl(Number(r.dex)) : null);
    if (url) {
      loader.load(
        url,
        (tex) => {
          if (!view.alive) return tex.dispose();
          tex.colorSpace = THREE.SRGBColorSpace;
          keep(tex);
          mat.map = tex;
          mat.needsUpdate = true;
        },
        undefined,
        () => {}
      );
    }
    residents.set(r.key, view);
    return view;
  }
  function dropResident(key) {
    const v = residents.get(key);
    if (!v) return;
    v.alive = false;
    scene.remove(v.group, v.shadow);
    v.sprite.material.dispose();
    v.shadow.material.dispose();
    v.emote.material.dispose();
    residents.delete(key);
  }

  // ---------- camera (orbit with damping)
  const cam = { yaw: Math.PI / 4, pitch: 0.78, dist: 40, tx: CENTER.x, ty: CENTER.y, tz: CENTER.z };
  const goal = { ...cam };
  let defaultDist = 40;
  const clampGoal = () => {
    goal.pitch = Math.max(0.22, Math.min(1.38, goal.pitch));
    goal.dist = Math.max(9, Math.min(72, goal.dist));
    goal.tx = Math.max(0, Math.min(W, goal.tx));
    goal.tz = Math.max(0, Math.min(D, goal.tz));
    goal.ty = Math.max(1, Math.min(8, goal.ty));
  };
  function placeCamera() {
    const cp = Math.cos(cam.pitch);
    camera.position.set(cam.tx + Math.sin(cam.yaw) * cp * cam.dist, cam.ty + Math.sin(cam.pitch) * cam.dist, cam.tz + Math.cos(cam.yaw) * cp * cam.dist);
    camera.position.y = Math.max(SEA_Y + 1, camera.position.y); // never under water
    camera.lookAt(cam.tx, cam.ty, cam.tz);
  }
  function resize() {
    const w = container.clientWidth || 360;
    const h = container.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Fit the island across the screen width
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const fit = Math.max(20, Math.min(56, 10.2 / Math.tan(hfov / 2)));
    if (Math.abs(goal.dist - defaultDist) < 0.01) goal.dist = fit;
    defaultDist = fit;
    camera.updateProjectionMatrix();
  }
  resize();
  cam.dist = goal.dist;
  placeCamera();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(container);
  else window.addEventListener('resize', resize);

  // ---------- picking
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const seaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SEA_Y);
  function pick(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const targets = [chunk.opaque, chunk.glow, chunk.see, ...Object.values(decorMeshes).flat()];
    const hits = raycaster.intersectObjects(targets, false);
    for (const h of hits) {
      if (h.object.isInstancedMesh) {
        const i = decorCells[h.object.userData.decor][h.instanceId];
        if (i == null) continue;
        return { cell: [i % W, Math.floor(i / (W * D)), Math.floor(i / W) % D], normal: [0, 1, 0] };
      }
      if (!h.face) continue;
      const n = h.face.normal;
      const p = h.point;
      const cell = [Math.floor(p.x - n.x * 0.01), Math.floor(p.y - n.y * 0.01), Math.floor(p.z - n.z * 0.01)];
      return { cell, normal: [Math.round(n.x), Math.round(n.y), Math.round(n.z)] };
    }
    const at = raycaster.ray.intersectPlane(seaPlane, new THREE.Vector3());
    if (at) {
      const x = Math.floor(at.x);
      const z = Math.floor(at.z);
      if (x >= 0 && z >= 0 && x < W && z < D) return { sea: [x, z] };
    }
    return null;
  }

  // ---------- effects from engine events
  function effect(e) {
    if (!e?.cell && e?.type !== 'wish') return;
    const colorOf = (id, paint) => (paint ? PAINTS[paint] : BLOCK_BY_ID[id]?.top || DECOR_BY_ID[id]?.color || '#ffffff');
    if (e.type === 'place' || (e.type === 'undo' && e.kind === 'remove')) {
      const [x, y, z] = e.cell;
      const i = idx(x, y, z);
      if (isBlock(e.id)) {
        skip.add(i);
        anims.push({ i, cell: e.cell, id: e.id, paint: 0, t: 0, mesh: null });
      }
      burst(x + 0.5, y + 0.05, z + 0.5, ['#ffffff', '#f1f5f9'], { n: 8, speed: 2.2, size: 0.12, life: 0.45, up: 1.2 });
    } else if (e.type === 'decor') {
      const [x, y, z] = e.cell;
      burst(x + 0.5, y + 0.2, z + 0.5, [DECOR_BY_ID[e.id]?.color || '#fff', '#ffffff', '#fde047'], { n: 12, speed: 2, size: 0.12, life: 0.6 });
    } else if (e.type === 'remove' || (e.type === 'undo' && e.kind !== 'paint')) {
      const [x, y, z] = e.cell;
      const c = colorOf(e.id, e.paint);
      burst(x + 0.5, y + 0.5, z + 0.5, [c, c, BLOCK_BY_ID[e.id]?.side || c, '#ffffff'], { n: 18, speed: 3.2, size: 0.2, life: 0.75 });
    } else if (e.type === 'paint') {
      const [x, y, z] = e.cell;
      burst(x + 0.5, y + 1, z + 0.5, [PAINTS[e.color] || '#ffffff', '#ffffff'], { n: 12, speed: 2, size: 0.12, life: 0.6 });
    } else if (e.type === 'wish') {
      const [x, y, z] = e.at;
      burst(x + 0.5, y + 1.5, z + 0.5, ['#ef4444', '#facc15', '#38bdf8', '#f472b6', '#4ade80', '#ffffff'], { n: 70, speed: 4, size: 0.18, life: 1.8, up: 6, flat: true });
      heartsAt(x + 0.5, y + 1, z + 0.5, 8);
    }
  }

  // ---------- frame
  let time = 0;
  let night = 0;
  let slow = 0;
  let lowQuality = false;
  let lastGhost = '';
  const dayTop = '#4aa8ff';
  const dayBottom = '#d4f0ff';
  const nightTop = '#070b24';
  const nightBottom = '#28356a';
  const dummy = new THREE.Object3D();

  function update(state, dt, view = {}) {
    if (typeof document !== 'undefined' && document.hidden) return;
    time += dt;
    // Quality: drop to pixel ratio 1, no shadows and fewer clouds if frames are slow for a while
    slow = dt > 1 / 38 ? slow + dt : Math.max(0, slow - dt * 0.5);
    if (!lowQuality && slow > 3) {
      lowQuality = true;
      pixelRatio = 1;
      renderer.setPixelRatio(1);
      resize();
      dir.castShadow = false;
    }

    if (state.rev !== builtRev || needRebuild) {
      builtRev = state.rev;
      needRebuild = false;
      rebuild(state.grid);
    }

    // Day / night
    night += ((state.night ? 1 : 0) - night) * Math.min(1, dt * 2.2);
    skyUniforms.top.value.copy(lerpColor(dayTop, nightTop, night));
    skyUniforms.bottom.value.copy(lerpColor(dayBottom, nightBottom, night));
    scene.fog.color.copy(skyUniforms.bottom.value);
    hemi.intensity = 1.7 - night * 0.95;
    hemi.color.copy(lerpColor('#dff2ff', '#8ea6ff', night));
    ambient.intensity = 0.35 - night * 0.15;
    dir.intensity = 2.3 - night * 1.65;
    dir.color.copy(lerpColor('#fff4dd', '#9fb4ff', night));
    sun.material.opacity = 1 - night;
    moon.material.opacity = night;
    stars.material.opacity = night * 0.95;
    flies.visible = night > 0.05;
    if (flies.visible) {
      const fp = flyGeo.attributes.position.array;
      flySeed.forEach(([x, y, z, ph], k) => {
        fp[k * 3] = x + Math.sin(time * 0.5 + ph) * 1.5;
        fp[k * 3 + 1] = y + Math.sin(time * 0.9 + ph * 2) * 0.6;
        fp[k * 3 + 2] = z + Math.cos(time * 0.4 + ph) * 1.5;
      });
      flyGeo.attributes.position.needsUpdate = true;
      flies.material.opacity = night * (0.6 + Math.sin(time * 2) * 0.25);
    }
    seaMat.color.copy(lerpColor('#2aa6d9', '#173e7a', night));
    glowMat.emissiveIntensity = 0.15 + night * 0.85;
    decorGlowMat.emissiveIntensity = 0.1 + night * 1.1;
    let gs = 0;
    for (const spot of glowSpots) {
      if (gs >= glowSprites.length) break;
      const sp = glowSprites[gs++];
      const i = spot.i;
      const x = i % W;
      const z = Math.floor(i / W) % D;
      const y = Math.floor(i / (W * D));
      sp.position.set(x + 0.5, y + (spot.v === LANTERN ? 1.08 : 0.5), z + 0.5);
      sp.visible = night > 0.05;
      sp.material.opacity = night * (0.75 + Math.sin(time * 3 + i) * 0.08);
    }
    for (let k = gs; k < glowSprites.length; k++) glowSprites[k].visible = false;

    // Sea waves (CPU, small grid)
    const pa = seaGeo.attributes.position.array;
    for (let k = 0; k < pa.length; k += 3) {
      const x = seaBase[k];
      const z = seaBase[k + 2];
      pa[k + 1] = SEA_Y + Math.sin(x * 0.42 + time * 1.3) * 0.05 + Math.cos(z * 0.37 - time * 1.1) * 0.05;
    }
    seaGeo.attributes.position.needsUpdate = true;
    if (Math.floor(time * 30) % 2 === 0) seaGeo.computeVertexNormals();

    // Clouds drift around the island
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > CENTER.x + 70) c.position.x = CENTER.x - 70;
      // Fade out a cloud that drifts close to the camera so it never blocks the island
      const near = c.position.distanceTo(camera.position);
      c.material.opacity = 0.94 * Math.max(0, Math.min(1, (near - 10) / 14)) * (1 - night * 0.45);
      c.visible = c.material.opacity > 0.02 && (!lowQuality || clouds.indexOf(c) % 2 === 0);
    }

    // Squash animations
    for (let k = anims.length - 1; k >= 0; k--) {
      const a = anims[k];
      if (!a.mesh) {
        a.paint = state.grid.paint[a.i] || 0;
        a.mesh = new THREE.Mesh(cubeGeo(a.id, a.paint), see(a.id) ? seeMat : glows(a.id) ? glowMat : blockMat);
        a.mesh.position.set(a.cell[0] + 0.5, a.cell[1], a.cell[2] + 0.5);
        a.mesh.castShadow = true;
        scene.add(a.mesh);
      }
      a.t += dt;
      const p = Math.min(1, a.t / 0.28);
      // squash flat, overshoot tall, settle
      const sy = p < 0.45 ? 0.55 + (p / 0.45) * 0.7 : 1.25 - ((p - 0.45) / 0.55) * 0.25;
      const sxz = 1 + (1 - sy) * 0.5;
      a.mesh.scale.set(sxz, sy, sxz);
      if (p >= 1 || state.grid.cells[a.i] !== a.id) {
        scene.remove(a.mesh);
        skip.delete(a.i);
        anims.splice(k, 1);
        needRebuild = true;
      }
    }

    // Particles
    let n = 0;
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k];
      p.life -= dt;
      if (p.life <= 0) {
        parts.splice(k, 1);
        continue;
      }
      p.vy -= (p.flat ? 4 : 9) * dt;
      if (p.flat) {
        p.vx *= 1 - dt * 1.5;
        p.vz *= 1 - dt * 1.5;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += dt * 6;
    }
    for (const p of parts) {
      const s = p.size * Math.min(1, (p.life / p.max) * 2.5);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rot, p.rot * 0.7, 0);
      dummy.scale.set(s, p.flat ? s * 0.25 : s, s);
      dummy.updateMatrix();
      partMesh.setMatrixAt(n, dummy.matrix);
      partMesh.setColorAt(n, pColor.set(p.color));
      n++;
    }
    partMesh.count = n;
    partMesh.instanceMatrix.needsUpdate = true;
    if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
    for (const h of hearts) {
      if (h.life <= 0) continue;
      h.life -= dt;
      h.sp.position.y += dt * 1.1;
      h.sp.position.x += h.vx * dt;
      const k = h.life / h.max;
      const s = 0.55 * Math.min(1, (1 - k) * 6);
      h.sp.scale.set(s, s, 1);
      h.sp.material.opacity = Math.min(1, k * 2);
      if (h.life <= 0) h.sp.visible = false;
    }

    // Ghost
    const gh = view.ghost;
    if (gh && gh.cell) {
      ghost.visible = true;
      const key = `${gh.kind}:${gh.color}`;
      if (key !== lastGhost) {
        lastGhost = key;
        ghostMat.color.set(gh.kind === 'remove' ? '#ef4444' : gh.color || '#ffffff');
        ghostEdges.material.color.set(gh.kind === 'remove' ? '#fecaca' : '#ffffff');
      }
      const small = gh.kind === 'decor';
      ghost.position.set(gh.cell[0] + 0.5, gh.cell[1] + (small ? 0.45 : 0.5), gh.cell[2] + 0.5);
      const pulse = 1 + Math.sin(time * 7) * 0.03;
      ghost.scale.set(small ? 0.8 * pulse : pulse, small ? 0.9 * pulse : pulse, small ? 0.8 * pulse : pulse);
      ghostMat.opacity = gh.kind === 'remove' ? 0.35 : 0.42 + Math.sin(time * 5) * 0.08;
    } else ghost.visible = false;

    // Residents
    const keys = new Set();
    state.residents.forEach((r, k) => {
      keys.add(r.key);
      const v = residentView(r, k);
      const walking = !!r.to;
      const t = time * 3 + v.phase;
      let y = r.pos.y;
      if (r.celebrate > 0) y += Math.abs(Math.sin(r.celebrate * 7)) * 0.7;
      const bob = walking ? Math.abs(Math.sin(t * 2.6)) * 0.08 : Math.sin(t) * 0.025;
      v.group.position.set(r.pos.x + 0.5, y + bob, r.pos.z + 0.5);
      const squash = walking ? 1 + Math.sin(t * 5.2) * 0.05 : 1 + Math.sin(t) * 0.03;
      const sleeping = state.night && r.sleeping;
      v.sprite.scale.set(v.size * (r.face < 0 ? -1 : 1) * (2 - squash), v.size * squash * (sleeping ? 0.92 : 1), 1);
      v.sprite.material.rotation = sleeping ? 0.18 : 0;
      v.sprite.material.color.setScalar(1 - night * 0.3);
      v.shadow.position.set(r.pos.x + 0.5, Math.floor(r.pos.y + 0.001) + 0.03, r.pos.z + 0.5);
      const shadowK = 1 - Math.min(0.5, (y - Math.floor(r.pos.y)) * 0.6);
      v.shadow.scale.set(shadowK, 1, shadowK);
      if (r.emote) {
        if (v.kind !== r.emote.kind) {
          v.kind = r.emote.kind;
          v.emote.material.map = emoteFor(r.emote.kind);
          v.emote.material.needsUpdate = true;
          v.popT = 0;
        }
        v.popT = (v.popT || 0) + dt;
        const s = 0.95 * Math.min(1, v.popT * 6) * (1 + Math.sin(time * 4) * 0.04);
        v.emote.scale.set(s, s, 1);
        v.emote.position.set(0.35, v.size + 0.25 + Math.sin(time * 2.5) * 0.05, 0);
        v.emote.material.opacity = Math.min(1, r.emote.t * 3);
        v.emote.visible = true;
      } else {
        v.emote.visible = false;
        v.kind = null;
      }
    });
    for (const key of [...residents.keys()]) if (!keys.has(key)) dropResident(key);

    // Camera damping
    const k = 1 - Math.exp(-dt * 9);
    for (const f of ['yaw', 'pitch', 'dist', 'tx', 'ty', 'tz']) cam[f] += (goal[f] - cam[f]) * k;
    placeCamera();
    renderer.render(scene, camera);
  }

  return {
    canvas: renderer.domElement,
    update,
    pick,
    effect,
    /** One-finger drag / mouse drag (pixels). */
    orbit(dx, dy) {
      goal.yaw -= dx * 0.008;
      goal.pitch += dy * 0.006;
      clampGoal();
    },
    /** Pinch / wheel: factor > 1 zooms out. */
    zoom(f) {
      goal.dist *= f;
      clampGoal();
    },
    /** Two-finger drag (pixels): move the look-at point on the ground. */
    pan(dx, dy) {
      const s = goal.dist * 0.0022;
      // right = (cos yaw, -sin yaw), forward (away from the camera) = (-sin yaw, -cos yaw)
      goal.tx += -dx * Math.cos(goal.yaw) * s - dy * Math.sin(goal.yaw) * s;
      goal.tz += dx * Math.sin(goal.yaw) * s - dy * Math.cos(goal.yaw) * s;
      clampGoal();
    },
    rotate90(dirn = 1) {
      goal.yaw += (Math.PI / 2) * dirn;
    },
    resetView() {
      const turns = Math.round((goal.yaw - Math.PI / 4) / (Math.PI * 2));
      Object.assign(goal, { yaw: Math.PI / 4 + turns * Math.PI * 2, pitch: 0.78, dist: defaultDist, tx: CENTER.x, ty: CENTER.y, tz: CENTER.z });
    },
    get quality() {
      return lowQuality ? 'low' : 'high';
    },
    dispose() {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resize);
      for (const key of [...residents.keys()]) dropResident(key);
      for (const a of anims) scene.remove(a.mesh);
      animGeos.forEach((g) => g.dispose());
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => m.dispose());
      });
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    },
  };
}
