// Effects for "Đua máy bay Pokémon": sparkle bursts / confetti (one pooled Points cloud), weather particles,
// wingtip vapor trails (ribbons), speed lines (camera space).
import * as THREE from 'three';

const PT_VERT = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; attribute float aSpin;
uniform float uScale; varying float vAlpha; varying vec3 vColor; varying float vSpin;
void main(){ vAlpha = aAlpha; vColor = aColor; vSpin = aSpin; vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PT_FRAG = `uniform sampler2D uTex; varying float vAlpha; varying vec3 vColor; varying float vSpin;
void main(){ vec2 c = gl_PointCoord - 0.5; float s = sin(vSpin), co = cos(vSpin); vec2 r = vec2(c.x * co - c.y * s, c.x * s + c.y * co) + 0.5;
  vec4 t = texture2D(uTex, r); gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
  #include <colorspace_fragment>
}`;

function pointsMaterial(tex, additive = true) {
  return new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex }, uScale: { value: 300 } },
    vertexShader: PT_VERT,
    fragmentShader: PT_FRAG,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** Pool of short-lived particles (sparkles, stars, confetti). */
export function createBursts(tex, confettiTex, max = 700) {
  const make = (t, additive) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSpin', new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage));
    const mat = pointsMaterial(t, additive);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 8;
    return { geo, mat, pts, list: [] };
  };
  const glow = make(tex, true);
  const paper = make(confettiTex, false);
  const c = new THREE.Color();
  function emit(at, { count = 12, colors = ['#fde047', '#ffffff'], speed = 6, life = 0.7, size = 0.8, gravity = 4, up = 2, spread = 1, confetti = false, drag = 1.5 } = {}) {
    const P = confetti ? paper : glow;
    for (let i = 0; i < count && P.list.length < max; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * Math.PI;
      const v = speed * (0.4 + Math.random() * 0.8);
      P.list.push({
        x: at.x + (Math.random() - 0.5) * spread,
        y: at.y + (Math.random() - 0.5) * spread,
        z: at.z + (Math.random() - 0.5) * spread,
        vx: Math.cos(a) * Math.cos(b) * v,
        vy: Math.sin(b) * v + up,
        vz: Math.sin(a) * Math.cos(b) * v,
        life,
        max: life,
        size: size * (0.6 + Math.random() * 0.8),
        color: c.set(colors[i % colors.length]).clone(),
        spin: Math.random() * 6,
        vs: (Math.random() - 0.5) * 10,
        gravity,
        drag,
      });
    }
  }
  function updateOne(P, dt) {
    const pos = P.geo.attributes.position.array;
    const size = P.geo.attributes.aSize.array;
    const alpha = P.geo.attributes.aAlpha.array;
    const col = P.geo.attributes.aColor.array;
    const spin = P.geo.attributes.aSpin.array;
    let n = 0;
    for (let i = P.list.length - 1; i >= 0; i--) {
      const p = P.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        P.list[i] = P.list[P.list.length - 1];
        P.list.pop();
      }
    }
    for (const p of P.list) {
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vz *= k;
      p.vy = p.vy * k - p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.spin += p.vs * dt;
      pos[n * 3] = p.x;
      pos[n * 3 + 1] = p.y;
      pos[n * 3 + 2] = p.z;
      const t = p.life / p.max;
      size[n] = p.size * (0.5 + 0.5 * Math.min(1, t * 2.5));
      alpha[n] = Math.min(1, t * 2.2);
      col[n * 3] = p.color.r;
      col[n * 3 + 1] = p.color.g;
      col[n * 3 + 2] = p.color.b;
      spin[n] = p.spin;
      n++;
    }
    P.geo.setDrawRange(0, n);
    for (const a of ['position', 'aSize', 'aAlpha', 'aColor', 'aSpin']) P.geo.attributes[a].needsUpdate = true;
  }
  return {
    objects: [glow.pts, paper.pts],
    emit,
    update(dt, scale) {
      glow.mat.uniforms.uScale.value = scale;
      paper.mat.uniforms.uScale.value = scale;
      updateOne(glow, dt);
      updateOne(paper, dt);
    },
    clear() {
      glow.list.length = 0;
      paper.list.length = 0;
    },
    dispose() {
      for (const P of [glow, paper]) {
        P.geo.dispose();
        P.mat.dispose();
      }
    },
  };
}

/** Weather / ambience particles in a box around the camera. kind: pollen | sea | leaves | dust | sand | snow | embers | sparkle | petals | space. */
export function createWeather(tex, max = 360) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3);
  const seed = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(max), 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geo.setAttribute('aSpin', new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage));
  const mat = pointsMaterial(tex, true);
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 7;
  const BOX = { x: 46, y: 26, z: 110 };
  let kind = 'none';
  let count = 0;
  const C = {
    pollen: [['#fff6b0', '#ffffff'], 0.5, 120],
    sea: [['#ffffff', '#d8f6ff'], 0.35, 60],
    leaves: [['#a3e36b', '#ffd166', '#7cc95a'], 0.7, 140],
    dust: [['#ffd9a8', '#ffffff'], 0.35, 110],
    sand: [['#ffe4b0', '#f2c27b'], 0.4, 160],
    snow: [['#ffffff', '#e6f3ff'], 0.7, 340],
    embers: [['#ffb347', '#ff6a1a', '#ffe08a'], 0.6, 260],
    sparkle: [['#f0abfc', '#67e8f9', '#ffffff'], 0.6, 220],
    petals: [['#ffc2d1', '#ffffff', '#ffd6a5'], 0.6, 140],
    space: [['#ffffff', '#c7d2fe', '#a5f3fc'], 0.45, 340],
  };
  const col = new THREE.Color();
  function reset(i, center, anywhere) {
    pos[i * 3] = center.x + (Math.random() - 0.5) * BOX.x * 2;
    pos[i * 3 + 1] = center.y + (Math.random() - 0.5) * BOX.y * 2;
    pos[i * 3 + 2] = center.z - (anywhere ? Math.random() * BOX.z : BOX.z * (0.85 + Math.random() * 0.15));
    const k = kind;
    const vx = k === 'sand' ? 6 : k === 'leaves' || k === 'petals' ? 1.2 : 0;
    const vy = k === 'snow' ? -2.6 : k === 'embers' ? 2.4 : k === 'leaves' || k === 'petals' ? -1.0 : 0;
    vel[i * 3] = vx * (0.5 + Math.random());
    vel[i * 3 + 1] = vy * (0.6 + Math.random() * 0.8);
    vel[i * 3 + 2] = k === 'space' ? 8 : 0;
    seed[i] = Math.random() * 100;
  }
  return {
    object: pts,
    setKind(next, center) {
      kind = next || 'none';
      const spec = C[kind];
      count = spec ? spec[2] : 0;
      const sizes = geo.attributes.aSize.array;
      const colors = geo.attributes.aColor.array;
      for (let i = 0; i < count; i++) {
        reset(i, center, true);
        sizes[i] = spec[1] * (0.6 + Math.random() * 0.8) * (kind === 'space' ? 1.4 : 1);
        col.set(spec[0][i % spec[0].length]);
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }
      geo.attributes.aSize.needsUpdate = true;
      geo.attributes.aColor.needsUpdate = true;
      geo.setDrawRange(0, count);
      pts.visible = count > 0;
    },
    setCount(frac) {
      const spec = C[kind];
      if (spec) geo.setDrawRange(0, Math.round(count * frac));
    },
    update(dt, center, t, scale) {
      mat.uniforms.uScale.value = scale;
      const alpha = geo.attributes.aAlpha.array;
      const spin = geo.attributes.aSpin.array;
      for (let i = 0; i < count; i++) {
        const s = seed[i];
        pos[i * 3] += (vel[i * 3] + Math.sin(t * 1.3 + s) * 0.6) * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const dz = pos[i * 3 + 2] - center.z;
        if (dz > 12 || dz < -BOX.z * 1.05 || Math.abs(pos[i * 3] - center.x) > BOX.x * 1.2 || Math.abs(pos[i * 3 + 1] - center.y) > BOX.y * 1.2) reset(i, center, false);
        const tw = kind === 'sparkle' || kind === 'space' || kind === 'embers' ? 0.5 + 0.5 * Math.sin(t * 4 + s) : 1;
        alpha[i] = tw * Math.min(1, (BOX.z + Math.min(0, dz)) / 30);
        spin[i] = t * (kind === 'leaves' || kind === 'petals' ? 2 : 0.3) + s;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      geo.attributes.aSpin.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** A fading ribbon behind a moving point (wingtip vapor). */
export function createTrail(n = 40, width = 0.09, color = '#ffffff') {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 2 * 3);
  const alpha = new Float32Array(n * 2);
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: 'attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA * uOpacity); }',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  const hist = [];
  return {
    mesh,
    reset() {
      hist.length = 0;
    },
    push(p, up, opacity) {
      hist.unshift(p.clone());
      if (hist.length > n) hist.pop();
      mat.uniforms.uOpacity.value = opacity;
      for (let i = 0; i < n; i++) {
        const h = hist[Math.min(i, hist.length - 1)] || p;
        const w = width * (1 - i / n) + 0.01;
        pos[i * 6] = h.x - up.x * w;
        pos[i * 6 + 1] = h.y - up.y * w;
        pos[i * 6 + 2] = h.z - up.z * w;
        pos[i * 6 + 3] = h.x + up.x * w;
        pos[i * 6 + 4] = h.y + up.y * w;
        pos[i * 6 + 5] = h.z + up.z * w;
        const a = i < hist.length ? (1 - i / n) ** 1.5 : 0;
        alpha[i * 2] = a;
        alpha[i * 2 + 1] = a;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** Speed lines streaming past the camera (child of the camera). */
export function createSpeedLines(n = 46) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 2 * 3);
  const alpha = new Float32Array(n * 2);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: 'attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(1.0, 1.0, 1.0, vA * uOpacity); }',
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 20;
  const L = [];
  const spawn = (l, anywhere) => {
    const a = Math.random() * Math.PI * 2;
    const r = 2.4 + Math.random() * 3.2;
    l.x = Math.cos(a) * r * 1.0;
    l.y = Math.sin(a) * r * 1.4;
    l.z = anywhere ? -2 - Math.random() * 26 : -26 - Math.random() * 4;
    l.len = 1.5 + Math.random() * 2.5;
  };
  for (let i = 0; i < n; i++) {
    const l = {};
    spawn(l, true);
    L.push(l);
    alpha[i * 2] = 0;
    alpha[i * 2 + 1] = 0.9;
  }
  return {
    object: lines,
    update(dt, speed, opacity) {
      mat.uniforms.uOpacity.value = opacity;
      lines.visible = opacity > 0.01;
      if (!lines.visible) return;
      for (let i = 0; i < n; i++) {
        const l = L[i];
        l.z += speed * 1.4 * dt;
        if (l.z > -0.5) spawn(l, false);
        const len = l.len * (0.4 + speed / 30);
        pos[i * 6] = l.x;
        pos[i * 6 + 1] = l.y;
        pos[i * 6 + 2] = l.z - len;
        pos[i * 6 + 3] = l.x;
        pos[i * 6 + 4] = l.y;
        pos[i * 6 + 5] = l.z;
      }
      geo.attributes.position.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
