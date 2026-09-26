// Drawing for the Pokemon arena. The map (ground, lanes, trees, rocks, bases; colours from
// the chosen map's theme) is painted once into an offscreen canvas; each frame only the moving parts are drawn.
import { WORLD, CENTER, LANES_Y, BASES, OBSTACLES, BUSHES, currentMap } from '../../utils/moba/map';
import { TYPE_COLORS } from '../../utils/battle/typeChart';
import { drawSprite, imageReady } from '../sports/sportsKit';
import { drawParticles, drawSkillShot, drawNovasGround, drawNovasTop, drawFlashes } from './skillFx';

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
  if (o.kind === 'lava') return drawLava(ctx, o);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(o.x + 8, o.y + o.r * 0.55, o.r * 1.05, o.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (EXTRA_KINDS[o.kind]) return EXTRA_KINDS[o.kind](ctx, o);
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

function boulder(ctx, o, colors) {
  const g = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.4, 2, o.x, o.y, o.r * 1.1);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.6, colors[1]);
  g.addColorStop(1, colors[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = o.r * (0.82 + ((i * 37) % 7) / 30);
    ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawLava(ctx, o) {
  // A glowing pool with a dark crust
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y, o.r * 1.12, o.r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, o.r);
  g.addColorStop(0, '#fef08a');
  g.addColorStop(0.35, '#fb923c');
  g.addColorStop(0.8, '#dc2626');
  g.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(o.x, o.y, o.r * 0.95, o.r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(254,240,138,0.7)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(o.x + Math.cos(i * 1.9 + o.x) * o.r * 0.45, o.y + Math.sin(i * 1.9 + o.y) * o.r * 0.35, 3 + (i % 2) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Obstacles of the other maps (the forest ones are drawn in drawTree)
const EXTRA_KINDS = {
  cactus(ctx, o) {
    const h = o.r * 1.5;
    ctx.fillStyle = '#15803d';
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 2;
    const arm = (x, y, w, hh) => {
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - hh, w, hh, w / 2);
      ctx.fill();
      ctx.stroke();
    };
    arm(o.x, o.y + o.r * 0.5, o.r * 0.55, h);
    arm(o.x - o.r * 0.55, o.y, o.r * 0.34, o.r * 0.7);
    arm(o.x + o.r * 0.55, o.y - o.r * 0.2, o.r * 0.34, o.r * 0.8);
    ctx.fillRect(o.x - o.r * 0.55, o.y - o.r * 0.1, o.r * 0.3, o.r * 0.2);
    ctx.fillRect(o.x + o.r * 0.25, o.y - o.r * 0.3, o.r * 0.3, o.r * 0.2);
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.arc(o.x, o.y + o.r * 0.5 - h, 4, 0, Math.PI * 2);
    ctx.fill();
  },
  snowpine(ctx, o) {
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
      // Snow on each layer
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(o.x, top - o.r * 0.6);
      ctx.lineTo(o.x + w * 0.55, top - o.r * 0.05);
      ctx.lineTo(o.x - w * 0.55, top - o.r * 0.05);
      ctx.closePath();
      ctx.fill();
    }
  },
  ice(ctx, o) {
    // A cluster of ice crystals
    const g = ctx.createLinearGradient(o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r);
    g.addColorStop(0, '#ecfeff');
    g.addColorStop(0.5, '#67e8f9');
    g.addColorStop(1, '#0e7490');
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    for (const [dx, h, w] of [[-0.45, 0.9, 0.35], [0.45, 1, 0.35], [0, 1.4, 0.45]]) {
      ctx.beginPath();
      ctx.moveTo(o.x + dx * o.r - w * o.r, o.y + o.r * 0.5);
      ctx.lineTo(o.x + dx * o.r, o.y + o.r * 0.5 - h * o.r);
      ctx.lineTo(o.x + dx * o.r + w * o.r, o.y + o.r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  },
  snowrock(ctx, o) {
    boulder(ctx, o, ['#e2e8f0', '#94a3b8', '#475569']);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y - o.r * 0.5, o.r * 0.7, o.r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  basalt(ctx, o) {
    boulder(ctx, o, ['#78716c', '#44403c', '#1c1917']);
    ctx.strokeStyle = 'rgba(249,115,22,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(o.x - o.r * 0.4, o.y - o.r * 0.2);
    ctx.lineTo(o.x, o.y + o.r * 0.1);
    ctx.lineTo(o.x + o.r * 0.3, o.y - o.r * 0.1);
    ctx.stroke();
  },
  deadtree(ctx, o) {
    ctx.strokeStyle = '#292524';
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + o.r * 0.6);
    ctx.lineTo(o.x, o.y - o.r * 0.6);
    ctx.stroke();
    ctx.lineWidth = 4;
    for (const [s, y] of [[-1, -0.1], [1, -0.35], [-1, -0.55]]) {
      ctx.beginPath();
      ctx.moveTo(o.x, o.y + y * o.r);
      ctx.lineTo(o.x + s * o.r * 0.7, o.y + (y - 0.4) * o.r);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  },
};

/** Paint the static map once (the chosen map). Returns an offscreen canvas of WORLD * MAP_SCALE. */
export function renderMap() {
  const T = currentMap.theme;
  const canvas = document.createElement('canvas');
  canvas.width = WORLD.w * MAP_SCALE;
  canvas.height = WORLD.h * MAP_SCALE;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;
  ctx.scale(MAP_SCALE, MAP_SCALE);
  const r = rng(42);

  // Grass with lighter and darker patches
  const grass = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  grass.addColorStop(0, T.ground[0]);
  grass.addColorStop(1, T.ground[1]);
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = T.patches[i % 2];
    ctx.beginPath();
    ctx.ellipse(r() * WORLD.w, r() * WORLD.h, 30 + r() * 60, 18 + r() * 30, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Grass tufts
  ctx.strokeStyle = T.tuft;
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

  // The three lanes
  for (const y of LANES_Y) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    lanePath(ctx, y);
    ctx.strokeStyle = T.lane[0];
    ctx.lineWidth = 66;
    ctx.stroke();
    lanePath(ctx, y);
    ctx.strokeStyle = T.lane[1];
    ctx.lineWidth = 56;
    ctx.stroke();
    lanePath(ctx, y);
    ctx.setLineDash([4, 22]);
    ctx.strokeStyle = T.lane[2];
    ctx.lineWidth = 30;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Flowers and pebbles
  for (let i = 0; i < 160; i++) {
    const x = r() * WORLD.w;
    const y = r() * WORLD.h;
    ctx.fillStyle = T.deco[i % 4];
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(k * 1.57) * 2.5, y + Math.sin(k * 1.57) * 2.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Centre of the arena: a stone ring with a Pokeball painted on the ground
  ctx.fillStyle = 'rgba(120,113,108,0.35)';
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, 95, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, 60, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, 60, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(CENTER.x - 60, CENTER.y - 5, 120, 10);
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawBasePlatform(ctx, 'blue');
  drawBasePlatform(ctx, 'red');

  // Bushes (walk-through) then solid trees and rocks
  for (const b of BUSHES) {
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = T.bush[i % 2];
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
  return { particles: [], rings: [], numbers: [], trails: new Map(), beams: [], afterimages: [], streaks: [], novas: [], flashes: [], impacts: [], castPulse: {} };
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

  // Flash trails: a fading streak of light from where the Pokemon was to where it landed
  for (let i = fx.streaks.length - 1; i >= 0; i--) {
    const k = fx.streaks[i];
    k.life -= dt;
    if (k.life <= 0) {
      fx.streaks.splice(i, 1);
      continue;
    }
    const a = k.life / k.max;
    const g = ctx.createLinearGradient(k.from.x, k.from.y, k.to.x, k.to.y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, k.color);
    ctx.globalAlpha = a;
    ctx.strokeStyle = g;
    ctx.lineWidth = 16 * a;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(k.from.x, k.from.y - 20);
    ctx.lineTo(k.to.x, k.to.y - 20);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }

  // Boss raid: red warning shapes on the ground, filling up until the attack lands
  for (const w of state.telegraphs || []) drawWarning(ctx, w, time);

  // Skill 2 on the ground, under the Pokemon
  drawNovasGround(ctx, fx, dt);

  // Fighters and shots in depth order
  const items = [];
  for (const f of state.fighters) if (!f.dead) items.push({ y: f.y, f });
  for (const p of state.projectiles) items.push({ y: p.y, p });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.p) {
      if (it.p.skill === 's1') drawSkillShot(ctx, it.p, fx, time, dt);
      else drawShot(ctx, it.p, fx, time);
      continue;
    }
    const f = it.f;
    const c = TEAM_COLORS[f.team];
    const hitFlash = fx.hitFlash?.[f.id] || 0;
    const bob = f.moving ? Math.abs(Math.sin(time * 14 + f.idx)) * 5 : Math.sin(time * 3 + f.idx) * 1.5;
    // Shadow and team ring (bigger for the boss)
    const k = f.boss ? f.r / 20 : 1;
    const feet = f.y + 14 * k;
    if (f.boss) drawBossAura(ctx, f, time);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(f.x, feet, 22 * k, 8 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = f.id === controlId ? '#facc15' : c;
    ctx.lineWidth = f.id === controlId ? 4 : 3;
    ctx.shadowColor = f.id === controlId ? '#facc15' : c;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(f.x, feet, (25 + Math.sin(time * 5) * 1.5) * k, 10 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Ultimate ready: a swirling aura
    if (f.ult >= 100 && !f.boss) {
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
    // Casting a skill: a quick swell and a glow in the type's colour at the feet
    const cast = fx.castPulse?.[f.id] || 0;
    if (cast > 0) {
      ctx.globalAlpha = cast * 0.55;
      ctx.fillStyle = typeColor(f.types[0]);
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + 14, 30 + (1 - cast) * 14, 12 + (1 - cast) * 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const size = (f.boss ? 150 : 62) * (1 + hitFlash * (f.boss ? 0.04 : 0.12) + cast * 0.1);
    drawSprite(ctx, images[f.id], f.x, f.y - 20 * k - bob, size, { flip: f.facing < 0, color: c });
    if (hitFlash > 0) {
      ctx.globalAlpha = hitFlash * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(f.x, f.y - 20 - bob, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // HP bar and name (the boss has its big bar at the top of the screen)
    if (f.boss) continue;
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

  // Skill 2 standing parts (fire pillars, spikes, lightning) and skill 1 flashes
  drawNovasTop(ctx, fx, dt);
  drawFlashes(ctx, fx, dt);

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
  // Particles (dots and type shapes)
  drawParticles(ctx, fx, dt);
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

function drawWarning(ctx, w, time) {
  const k = 1 - Math.max(0, w.t) / w.max; // 0 -> 1 as the attack gets closer
  const blink = 0.55 + Math.sin(time * 18) * 0.15 * k;
  ctx.save();
  if (w.shape === 'strip') {
    ctx.translate(w.x, w.y);
    ctx.rotate(w.ang);
    ctx.fillStyle = `rgba(239,68,68,${0.18 * blink})`;
    ctx.fillRect(0, -w.w / 2, w.len, w.w);
    ctx.fillStyle = `rgba(239,68,68,${0.45 * blink})`;
    ctx.fillRect(0, -w.w / 2, w.len * k, w.w);
    ctx.strokeStyle = '#fecaca';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(0, -w.w / 2, w.len, w.w);
    ctx.setLineDash([]);
    // Arrows along the strip
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let x = 40; x < w.len; x += 70) {
      ctx.beginPath();
      ctx.moveTo(x + 16, 0);
      ctx.lineTo(x, -12);
      ctx.lineTo(x, 12);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = `rgba(239,68,68,${0.18 * blink})`;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(239,68,68,${0.42 * blink})`;
    ctx.beginPath();
    ctx.arc(w.x, w.y, Math.max(1, w.r * k), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fecaca';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (w.kind === 'meteor') {
      // A rock falling into the circle
      const h = (1 - k) * 260;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(w.x, w.y, 18 + k * 14, 8 + k * 6, 0, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(w.x - 6, w.y - h - 6, 2, w.x, w.y - h, 22);
      g.addColorStop(0, '#fde68a');
      g.addColorStop(0.5, '#f97316');
      g.addColorStop(1, '#7c2d12');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(w.x, w.y - h, 20, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawBossAura(ctx, f, time) {
  const c = f.angry ? '#ef4444' : typeColor(f.types[0]);
  const pulse = 1 + Math.sin(time * (f.angry ? 8 : 3)) * 0.08;
  const g = ctx.createRadialGradient(f.x, f.y - 20, 10, f.x, f.y - 20, f.r * 2.4 * pulse);
  g.addColorStop(0, `${c}66`);
  g.addColorStop(1, `${c}00`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(f.x, f.y - 20, f.r * 2.4 * pulse, 0, Math.PI * 2);
  ctx.fill();
  if (f.angry) {
    // Angry: flames licking up round the boss
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + time * 1.5;
      const x = f.x + Math.cos(a) * f.r * 1.1;
      const y = f.y + 10 + Math.sin(a) * f.r * 0.45;
      const h = 22 + Math.sin(time * 12 + i) * 8;
      ctx.fillStyle = i % 2 ? 'rgba(251,146,60,0.75)' : 'rgba(239,68,68,0.75)';
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.quadraticCurveTo(x, y - h * 1.3, x + 7, y);
      ctx.fill();
    }
  }
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
  ctx.fillStyle = currentMap.theme.mini;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = currentMap.theme.lane[1];
  for (const by of LANES_Y) ctx.fillRect(x, y + by * s - 1.5, w, 3);
  ctx.fillStyle = currentMap.theme.miniDot;
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
