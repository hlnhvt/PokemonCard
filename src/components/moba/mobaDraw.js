// Drawing for the Pokemon arena. The map (grass, paths, river, bridges, trees, rocks,
// bases) is painted once into an offscreen canvas; each frame only the moving parts are drawn.
import { WORLD, RIVER, BRIDGES, BRIDGE_HALF, BASES, OBSTACLES, BUSHES } from '../../utils/moba/map';
import { TYPE_COLORS } from '../../utils/battle/typeChart';
import { drawSprite, imageReady } from '../sports/sportsKit';

export const TEAM_COLORS = { blue: '#38bdf8', red: '#f43f5e' };
const MAP_SCALE = 1.5; // offscreen resolution (sharper when the camera zooms)

// Small deterministic random so the decorations never move between frames
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function lanePath(ctx, y) {
  const b = BASES.blue;
  const r = BASES.red;
  ctx.beginPath();
  if (y === 450) {
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(r.x, r.y);
  } else {
    ctx.moveTo(b.x + 40, b.y + (y < 450 ? -40 : 40));
    ctx.quadraticCurveTo(b.x + 90, y, 330, y);
    ctx.lineTo(WORLD.w - 330, y);
    ctx.quadraticCurveTo(r.x - 90, y, r.x - 40, r.y + (y < 450 ? -40 : 40));
  }
}

function drawTree(ctx, o) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(o.x + 8, o.y + o.r * 0.55, o.r * 1.05, o.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (o.kind === 'rock') {
    const g = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.4, 2, o.x, o.y, o.r * 1.1);
    g.addColorStop(0, '#e7e5e4');
    g.addColorStop(0.6, '#a8a29e');
    g.addColorStop(1, '#57534e');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = o.r * (0.82 + ((i * 37) % 7) / 30);
      if (i === 0) ctx.moveTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr);
      else ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(41,37,36,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }
  if (o.kind === 'pine') {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(o.x - 4, o.y + o.r * 0.2, 8, o.r * 0.5);
    for (let i = 0; i < 3; i++) {
      const w = o.r * (1.1 - i * 0.28);
      const top = o.y - o.r * (0.2 + i * 0.45);
      ctx.fillStyle = ['#14532d', '#166534', '#15803d'][i];
      ctx.beginPath();
      ctx.moveTo(o.x, top - o.r * 0.6);
      ctx.lineTo(o.x + w, top + o.r * 0.35);
      ctx.lineTo(o.x - w, top + o.r * 0.35);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }
  // Round tree: layered canopy with a highlight
  ctx.fillStyle = '#78350f';
  ctx.fillRect(o.x - 5, o.y, 10, o.r * 0.6);
  const blobs = [[0, 0, 1], [-0.45, 0.15, 0.7], [0.45, 0.15, 0.7], [0, -0.35, 0.75]];
  for (const [dx, dy, s] of blobs) {
    const g = ctx.createRadialGradient(o.x + dx * o.r - o.r * 0.2, o.y + dy * o.r - o.r * 0.3, 2, o.x + dx * o.r, o.y + dy * o.r, o.r * s);
    g.addColorStop(0, '#4ade80');
    g.addColorStop(1, '#15803d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x + dx * o.r, o.y + dy * o.r - o.r * 0.25, o.r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f472b6';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(o.x + Math.cos(i * 2.1 + o.x) * o.r * 0.55, o.y - o.r * 0.3 + Math.sin(i * 2.1 + o.y) * o.r * 0.4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBasePlatform(ctx, team) {
  const b = BASES[team];
  const c = TEAM_COLORS[team];
  const g = ctx.createRadialGradient(b.x, b.y, 10, b.x, b.y, b.r);
  g.addColorStop(0, '#e2e8f0');
  g.addColorStop(0.75, '#94a3b8');
  g.addColorStop(1, '#475569');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = c;
  ctx.lineWidth = 8;
  ctx.stroke();
  // Pokeball emblem on the floor
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = team === 'blue' ? '#0ea5e9' : '#e11d48';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r * 0.62, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r * 0.62, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(b.x - b.r * 0.62, b.y - 5, b.r * 1.24, 10);
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Stone pillars round the edge
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const px = b.x + Math.cos(a) * (b.r + 6);
    const py = b.y + Math.sin(a) * (b.r + 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px - 6, py - 2, 14, 10);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(px - 7, py - 14, 14, 16);
    ctx.fillStyle = c;
    ctx.fillRect(px - 7, py - 16, 14, 4);
  }
}

/** Paint the static map once. Returns an offscreen canvas of WORLD * MAP_SCALE. */
export function renderMap() {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD.w * MAP_SCALE;
  canvas.height = WORLD.h * MAP_SCALE;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;
  ctx.scale(MAP_SCALE, MAP_SCALE);
  const r = rng(42);

  // Grass with lighter and darker patches
  const grass = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  grass.addColorStop(0, '#4ade80');
  grass.addColorStop(1, '#22c55e');
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(21,128,61,0.18)' : 'rgba(187,247,208,0.18)';
    ctx.beginPath();
    ctx.ellipse(r() * WORLD.w, r() * WORLD.h, 30 + r() * 60, 18 + r() * 30, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Grass tufts
  ctx.strokeStyle = 'rgba(21,128,61,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 500; i++) {
    const x = r() * WORLD.w;
    const y = r() * WORLD.h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y - 7);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3, y - 7);
    ctx.stroke();
  }

  // Dirt lanes over the bridges
  for (const y of BRIDGES) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    lanePath(ctx, y);
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 66;
    ctx.stroke();
    lanePath(ctx, y);
    ctx.strokeStyle = '#e7c98a';
    ctx.lineWidth = 56;
    ctx.stroke();
    lanePath(ctx, y);
    ctx.setLineDash([4, 22]);
    ctx.strokeStyle = 'rgba(161,98,7,0.4)';
    ctx.lineWidth = 30;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Flowers and pebbles
  for (let i = 0; i < 160; i++) {
    const x = r() * WORLD.w;
    const y = r() * WORLD.h;
    if (Math.abs(x - RIVER.x) < 70) continue;
    ctx.fillStyle = ['#fde047', '#f9a8d4', '#ffffff', '#c4b5fd'][i % 4];
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(k * 1.57) * 2.5, y + Math.sin(k * 1.57) * 2.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // River with banks
  const river = ctx.createLinearGradient(RIVER.x - RIVER.half, 0, RIVER.x + RIVER.half, 0);
  river.addColorStop(0, '#0369a1');
  river.addColorStop(0.5, '#38bdf8');
  river.addColorStop(1, '#0369a1');
  ctx.fillStyle = '#65a30d';
  ctx.fillRect(RIVER.x - RIVER.half - 8, 0, RIVER.half * 2 + 16, WORLD.h);
  ctx.fillStyle = river;
  ctx.fillRect(RIVER.x - RIVER.half, 0, RIVER.half * 2, WORLD.h);
  // Wooden bridges
  for (const y of BRIDGES) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(RIVER.x - RIVER.half - 16, y - BRIDGE_HALF + 6, RIVER.half * 2 + 32, BRIDGE_HALF * 2);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(RIVER.x - RIVER.half - 16, y - BRIDGE_HALF, RIVER.half * 2 + 32, BRIDGE_HALF * 2);
    ctx.fillStyle = '#b45309';
    for (let px = RIVER.x - RIVER.half - 14; px < RIVER.x + RIVER.half + 14; px += 14) ctx.fillRect(px, y - BRIDGE_HALF + 2, 11, BRIDGE_HALF * 2 - 4);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(RIVER.x - RIVER.half - 16, y - BRIDGE_HALF - 4, RIVER.half * 2 + 32, 6);
    ctx.fillRect(RIVER.x - RIVER.half - 16, y + BRIDGE_HALF - 2, RIVER.half * 2 + 32, 6);
  }

  drawBasePlatform(ctx, 'blue');
  drawBasePlatform(ctx, 'red');

  // Bushes (walk-through) then solid trees and rocks
  for (const b of BUSHES) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#15803d' : '#166534';
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(i * 1.3) * b.r * 0.5, b.y + Math.sin(i * 1.3) * b.r * 0.35, b.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const o of [...OBSTACLES].sort((a, b) => a.y - b.y)) drawTree(ctx, o);
  return canvas;
}

/** Frame effects kept by the component: particles, rings, floating numbers, trails. */
export function createFx() {
  return { particles: [], rings: [], numbers: [], trails: new Map(), beams: [], afterimages: [], flash: 0, shake: 0, slow: 0 };
}

export function burstFx(fx, x, y, color, { count = 14, speed = 180, size = 4, life = 0.6 } = {}) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, size: size * (0.6 + Math.random() * 0.8), color: Math.random() < 0.3 ? '#ffffff' : color });
  }
}

export const typeColor = (t) => TYPE_COLORS[t] || '#e5e7eb';

/** Everything that moves: river shimmer, base crystals, fighters, shots, effects. World space. */
export function drawWorld(ctx, state, fx, images, time, dt, controlId) {
  // River shimmer
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const y = ((i * 53 + time * 40) % WORLD.h + WORLD.h) % WORLD.h;
    const x = RIVER.x - RIVER.half + 8 + ((i * 29) % (RIVER.half * 2 - 16));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 10, y + 3);
    ctx.stroke();
  }
  ctx.restore();

  // Base crystals
  for (const team of ['blue', 'red']) {
    const b = BASES[team];
    const pulse = 0.6 + Math.sin(time * 3) * 0.25;
    const g = ctx.createRadialGradient(b.x, b.y - 18, 2, b.x, b.y - 18, 70);
    g.addColorStop(0, `${TEAM_COLORS[team]}cc`);
    g.addColorStop(1, `${TEAM_COLORS[team]}00`);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = g;
    ctx.fillRect(b.x - 70, b.y - 88, 140, 140);
    ctx.globalAlpha = 1;
    const cy = b.y - 20 + Math.sin(time * 2) * 5;
    ctx.fillStyle = TEAM_COLORS[team];
    ctx.beginPath();
    ctx.moveTo(b.x, cy - 30);
    ctx.lineTo(b.x + 14, cy);
    ctx.lineTo(b.x, cy + 22);
    ctx.lineTo(b.x - 14, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(b.x - 3, cy - 22);
    ctx.lineTo(b.x + 5, cy - 2);
    ctx.lineTo(b.x - 5, cy - 2);
    ctx.fill();
  }

  // Afterimages of dashing ultimates
  for (let i = fx.afterimages.length - 1; i >= 0; i--) {
    const a = fx.afterimages[i];
    a.life -= dt;
    if (a.life <= 0) {
      fx.afterimages.splice(i, 1);
      continue;
    }
    drawSprite(ctx, images[a.id], a.x, a.y - 22, 60, { flip: a.flip, alpha: (a.life / a.max) * 0.5 });
  }

  // Fighters and shots in depth order
  const items = [];
  for (const f of state.fighters) if (!f.dead) items.push({ y: f.y, f });
  for (const p of state.projectiles) items.push({ y: p.y, p });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.p) {
      drawShot(ctx, it.p, fx, time);
      continue;
    }
    const f = it.f;
    const c = TEAM_COLORS[f.team];
    const hitFlash = fx.hitFlash?.[f.id] || 0;
    const bob = f.moving ? Math.abs(Math.sin(time * 14 + f.idx)) * 5 : Math.sin(time * 3 + f.idx) * 1.5;
    // Shadow and team ring
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 14, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = f.id === controlId ? '#facc15' : c;
    ctx.lineWidth = f.id === controlId ? 4 : 3;
    ctx.shadowColor = f.id === controlId ? '#facc15' : c;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 14, 25 + Math.sin(time * 5) * 1.5, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Ultimate ready: a swirling aura
    if (f.ult >= 100) {
      ctx.strokeStyle = typeColor(f.types[0]);
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(f.x, f.y - 20, 34, time * 4 + k * 2.1, time * 4 + k * 2.1 + 1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const size = 62 * (1 + hitFlash * 0.12);
    drawSprite(ctx, images[f.id], f.x, f.y - 20 - bob, size, { flip: f.facing < 0, color: c });
    if (hitFlash > 0) {
      ctx.globalAlpha = hitFlash * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(f.x, f.y - 20 - bob, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // HP bar and name
    const w = 46;
    const ratio = Math.max(0, f.hp / f.maxHp);
    ctx.fillStyle = 'rgba(15,23,42,0.8)';
    ctx.beginPath();
    ctx.roundRect(f.x - w / 2 - 2, f.y - 62, w + 4, 9, 4);
    ctx.fill();
    ctx.fillStyle = ratio > 0.5 ? c : ratio > 0.25 ? '#facc15' : '#ef4444';
    ctx.beginPath();
    ctx.roundRect(f.x - w / 2, f.y - 60, w * ratio, 5, 3);
    ctx.fill();
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.name, f.x, f.y - 66);
    ctx.fillText(f.name, f.x, f.y - 66);
    if (f.id === controlId) {
      const ay = f.y - 84 + Math.sin(time * 6) * 3;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(f.x, ay + 8);
      ctx.lineTo(f.x - 7, ay);
      ctx.lineTo(f.x + 7, ay);
      ctx.fill();
    }
  }

  // Rings (novas, respawns, combo impacts)
  for (let i = fx.rings.length - 1; i >= 0; i--) {
    const r = fx.rings[i];
    r.life -= dt;
    if (r.life <= 0) {
      fx.rings.splice(i, 1);
      continue;
    }
    const k = 1 - r.life / r.max;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * (1 - k * 0.6);
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.from + (r.to - r.from) * (1 - (1 - k) ** 3), 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (r.fill) {
      ctx.globalAlpha = (1 - k) * 0.25;
      ctx.fillStyle = r.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Light beams (respawn)
  for (let i = fx.beams.length - 1; i >= 0; i--) {
    const b = fx.beams[i];
    b.life -= dt;
    if (b.life <= 0) {
      fx.beams.splice(i, 1);
      continue;
    }
    const a = b.life / b.max;
    const g = ctx.createLinearGradient(b.x, b.y - 260, b.x, b.y);
    g.addColorStop(0, `${b.color}00`);
    g.addColorStop(1, b.color);
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(b.x - 18 * a, b.y - 260, 36 * a, 260);
    ctx.globalAlpha = 1;
  }
  // Particles
  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Floating damage numbers
  for (let i = fx.numbers.length - 1; i >= 0; i--) {
    const n = fx.numbers[i];
    n.life -= dt;
    if (n.life <= 0) {
      fx.numbers.splice(i, 1);
      continue;
    }
    const k = 1 - n.life / n.max;
    const scale = k < 0.15 ? 0.6 + k * 4 : 1.2 - Math.min(0.2, k * 0.3);
    ctx.globalAlpha = Math.min(1, n.life * 2.5);
    ctx.font = `900 ${Math.round(n.size * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(n.text, n.x, n.y - k * 40);
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, n.x, n.y - k * 40);
  }
  ctx.globalAlpha = 1;
}

function drawShot(ctx, p, fx, time) {
  const c = typeColor(p.type);
  // Trail
  let trail = fx.trails.get(p.id);
  if (!trail) fx.trails.set(p.id, (trail = []));
  trail.push({ x: p.x, y: p.y });
  if (trail.length > (p.skill === 'basic' ? 5 : 9)) trail.shift();
  for (let i = 0; i < trail.length; i++) {
    ctx.globalAlpha = (i / trail.length) * 0.5;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(trail[i].x, trail[i].y, p.r * (i / trail.length), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowColor = c;
  ctx.shadowBlur = p.skill === 'basic' ? 10 : 22;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r + Math.sin(time * 30) * (p.skill === 'basic' ? 0.5 : 1.5), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/** Minimap in screen space: map, fighters as dots, the camera's view. */
export function drawMinimap(ctx, state, camera, view, x, y, w) {
  const h = (w * WORLD.h) / WORLD.w;
  const s = w / WORLD.w;
  ctx.fillStyle = 'rgba(15,23,42,0.75)';
  ctx.beginPath();
  ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 6);
  ctx.fill();
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(x + (RIVER.x - RIVER.half) * s, y, RIVER.half * 2 * s, h);
  ctx.fillStyle = '#e7c98a';
  for (const by of BRIDGES) ctx.fillRect(x, y + by * s - 1.5, w, 3);
  ctx.fillStyle = 'rgba(20,83,45,0.9)';
  for (const o of OBSTACLES) ctx.fillRect(x + o.x * s - 1.5, y + o.y * s - 1.5, 3, 3);
  for (const team of ['blue', 'red']) {
    ctx.fillStyle = TEAM_COLORS[team];
    ctx.beginPath();
    ctx.arc(x + BASES[team].x * s, y + BASES[team].y * s, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const f of state.fighters) {
    if (f.dead) continue;
    ctx.fillStyle = f.id === state.control ? '#facc15' : TEAM_COLORS[f.team];
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + f.x * s, y + f.y * s, f.id === state.control ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + camera.x * s, y + camera.y * s, view.w * s, view.h * s);
}

export { imageReady };
