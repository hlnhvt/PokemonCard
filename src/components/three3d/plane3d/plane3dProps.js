// Collectibles and set pieces for "Đua máy bay Pokémon": coins, golden star rings, power-up icons,
// the finish gate (rainbow arch with balloon bunches and a checkered banner) and cloud puffs.
import { part, merge, cyl, sph, cone, torus, lathe, slab, shade, rng, TAU, canvasTexture } from './plane3dGeo';

const starPoints = (r1, r2, n = 5, rot = Math.PI / 2) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i / (n * 2)) * TAU;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
};

/** A thick gold coin facing +Z with a raised rim and an embossed star on both faces (spins around Y). */
export function coinGeometry() {
  const o = [];
  o.push(part(cyl(0.5, 0.5, 0.14, 20), '#ffcf33', { r: [Math.PI / 2, 0, 0], glow: 0.32 }));
  o.push(part(torus(0.47, 0.06, 4, 20), '#f0a91c', { glow: 0.25 }));
  for (const sz of [-1, 1]) o.push(part(slab(starPoints(0.27, 0.12), 0.04, 0, 1), '#fff1a8', { p: [0, 0, sz * 0.08], glow: 0.45, outline: 'none' }));
  return merge(o);
}

/** Golden star ring (fly through it): a fat torus studded with little stars. */
export function ringGeometry() {
  const o = [];
  o.push(part(torus(1.25, 0.16, 10, 40), (tri, pos, i, c) => (Math.sin(Math.atan2(c.y, c.x) * 10) > 0 ? '#ffd23f' : '#ffb703'), { glow: 0.45 }));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + Math.PI / 2;
    o.push(part(slab(starPoints(0.3, 0.13), 0.1, 0.03, 1), '#fff4a8', { p: [Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0.05], r: [0, 0, a - Math.PI / 2], glow: 0.7 }));
  }
  return merge(o);
}

/** Power-up icon inside its bubble: shield = Poké Ball, magnet = red U magnet, boost = flame. */
export function powerIconGeometry(kind) {
  const o = [];
  if (kind === 'shield') {
    o.push(part(sph(0.5, 22, 14), (tri, pos, i, c) => (Math.abs(c.y) < 0.06 ? '#1f1d2b' : c.y > 0 ? '#ef4444' : '#ffffff'), {}));
    o.push(part(cyl(0.17, 0.17, 0.1, 18), '#1f1d2b', { p: [0, 0, 0.47], r: [Math.PI / 2, 0, 0] }));
    o.push(part(cyl(0.1, 0.1, 0.12, 18), '#ffffff', { p: [0, 0, 0.5], r: [Math.PI / 2, 0, 0], glow: 0.2 }));
  } else if (kind === 'magnet') {
    o.push(part(torus(0.34, 0.15, 10, 20, Math.PI), '#ef4444', { p: [0, 0.05, 0], r: [0, 0, Math.PI] }));
    for (const sx of [-1, 1]) {
      o.push(part(cyl(0.15, 0.15, 0.3, 14), '#ef4444', { p: [sx * 0.34, 0.2, 0] }));
      o.push(part(cyl(0.155, 0.155, 0.2, 14), '#e5e7eb', { p: [sx * 0.34, 0.45, 0], glow: 0.2 }));
    }
  } else {
    const flame = [[0, -0.55], [0.32, -0.42], [0.42, -0.1], [0.3, 0.25], [0.12, 0.55], [0, 0.7]];
    o.push(part(lathe(flame, 16), (tri, pos, i, c) => (c.y > 0.15 ? '#ffd23f' : '#ff7a1a'), { glow: 0.6, flicker: 0.4 }));
    o.push(part(lathe(flame.map(([x, y]) => [x * 0.5, y * 0.6 - 0.15]), 12), '#fff7c2', { p: [0, 0, 0.28], glow: 0.8, outline: 'none' }));
  }
  return merge(o);
}

function balloonBunch(out, x, y, z, colors, R) {
  colors.forEach((c, k) => {
    const a = (k / colors.length) * TAU + R() * 0.4;
    const bx = x + Math.cos(a) * 0.75;
    const bz = z + Math.sin(a) * 0.5;
    const by = y + 1.2 + R() * 0.8;
    out.push(part(sph(0.55, 16, 12), c, { p: [bx, by, bz], s: [1, 1.18, 1], flap: 0.05 }));
    out.push(part(cone(0.1, 0.14, 8), shade(c, 0.8), { p: [bx, by - 0.68, bz], r: [Math.PI, 0, 0] }));
    out.push(part(cyl(0.015, 0.015, 1.3, 4), '#ffffff', { p: [(bx + x) / 2, (by - 0.7 + y) / 2, (bz + z) / 2], r: [(bz - z) * 0.6, 0, -(bx - x) * 0.6], outline: 'none' }));
  });
}

/** The finish gate: two striped pillars from the ground, a rainbow arch, balloons, flags. Origin at flying height. */
export function finishGateGeometry(ground = -9, { pillars = true } = {}) {
  const o = [];
  const R = rng(77);
  const span = 7.4;
  const bands = ['#ef4444', '#f97316', '#facc15', '#4ade80', '#38bdf8', '#a78bfa'];
  bands.forEach((c, k) => o.push(part(torus(span + 0.9 - k * 0.32, 0.17, 8, 48, Math.PI), c, { p: [0, 0.6, 0], glow: 0.25 })));
  for (const sx of [-1, 1]) {
    const x = sx * (span + 0.1);
    if (pillars) {
      const h = 0.6 - ground;
      o.push(part(cyl(0.55, 0.65, h, 16, 8), (tri, pos, i, c) => (Math.floor((c.y - ground) * 0.9) % 2 ? '#ffffff' : '#ef4444'), { p: [x, ground + h / 2, 0] }));
      o.push(part(cyl(1.0, 1.15, 0.6, 16), '#e5e7eb', { p: [x, ground + 0.3, 0] }));
    }
    o.push(part(sph(0.7, 16, 12), '#ffd23f', { p: [x, 0.7, 0], glow: 0.3 }));
    balloonBunch(o, x, 0.7, 0, sx < 0 ? ['#ef4444', '#facc15', '#38bdf8', '#f472b6'] : ['#4ade80', '#a78bfa', '#fb923c', '#ffffff'], R);
    // pennant flags along the arch
  }
  for (let k = 1; k < 12; k++) {
    const a = (k / 12) * Math.PI;
    const r = span + 1.3;
    const fx = Math.cos(a) * r;
    const fy = 0.6 + Math.sin(a) * r;
    o.push(part(cone(0.32, 0.7, 3), bands[k % bands.length], { p: [fx, fy - 0.42, 0.25], r: [0, 0, Math.PI], s: [1, 1, 0.2], flap: 0.05, outline: 'none' }));
  }
  return merge(o);
}

/** Checkered "ĐÍCH" banner texture. */
export function finishBannerTexture() {
  return canvasTexture(512, 128, (ctx, w, h) => {
    const s = 32;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      ctx.fillStyle = ((x + y) / s) % 2 ? '#1f1d2b' : '#ffffff';
      ctx.fillRect(x, y, s, s);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect?.(110, 14, 292, 100, 26);
    if (!ctx.roundRect) ctx.rect(110, 14, 292, 100);
    ctx.fill();
    ctx.font = 'bold 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1e3a8a';
    ctx.strokeText('ĐÍCH', w / 2, h / 2 + 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('ĐÍCH', w / 2, h / 2 + 4);
  });
}

/** A fluffy toon cloud puff (several lumpy spheres). */
export function puffGeometry(seed = 1, { color = '#ffffff', shadow = '#dfe8f6', glow = 0.05 } = {}) {
  const o = [];
  const R = rng(seed);
  const n = 5 + Math.floor(R() * 3);
  for (let k = 0; k < n; k++) {
    const r = 0.9 + R() * 0.9;
    const x = (k - (n - 1) / 2) * 1.1 + (R() - 0.5) * 0.4;
    const y = (R() - 0.3) * 0.7 + (1 - Math.abs(x) / n) * 0.6;
    const z = (R() - 0.5) * 1.4;
    o.push(part(sph(r, 11, 8), (tri, pos, i, c) => (c.y < -0.35 ? shadow : color), { p: [x, y, z], s: [1, 0.85, 1], glow, outline: 'none' }));
  }
  return merge(o);
}
