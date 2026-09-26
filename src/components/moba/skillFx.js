// Looks for skills 1 and 2 in the Pokemon arena. Every type has its own style (flames, bubbles,
// lightning, leaves, ice crystals, magic stars, rocks, wind). Only the look changes: the engine
// alone decides what is hit. Nothing here moves the camera.
import { TYPE_COLORS } from '../../utils/battle/typeChart';

const TAU = Math.PI * 2;
const MAX_PARTICLES = 700;

const STYLE = {
  fire: 'flame',
  water: 'aqua',
  ice: 'frost',
  electric: 'spark',
  grass: 'leaf',
  bug: 'leaf',
  psychic: 'mystic',
  fairy: 'mystic',
  ghost: 'mystic',
  dark: 'mystic',
  poison: 'mystic',
  rock: 'rock',
  ground: 'rock',
  steel: 'rock',
  fighting: 'rock',
  normal: 'wind',
  flying: 'wind',
  dragon: 'wind',
};
export const styleOf = (type) => STYLE[type] || 'wind';

// [light core, main, deep]; null main = the type's own colour
const PALETTE = {
  flame: ['#fff7ae', '#fb923c', '#dc2626'],
  aqua: ['#e0f2fe', '#38bdf8', '#1d4ed8'],
  frost: ['#ffffff', '#a5f3fc', '#0891b2'],
  spark: ['#ffffff', '#fde047', '#f59e0b'],
  leaf: ['#ecfccb', '#84cc16', '#15803d'],
  mystic: ['#fdf4ff', null, '#3b0764'],
  rock: ['#fef3c7', '#a8a29e', '#57534e'],
  wind: ['#ffffff', null, '#64748b'],
};
export function paletteOf(type) {
  const p = PALETTE[styleOf(type)];
  return [p[0], p[1] || TYPE_COLORS[type] || '#e5e7eb', p[2]];
}

const PARTICLE_FOR = { flame: 'flame', aqua: 'drop', frost: 'shard', spark: 'spark', leaf: 'leaf', mystic: 'star', rock: 'rock', wind: 'wisp' };
const alpha = (hex, a) => `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;
const easeOut = (k) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

export function emit(fx, x, y, { shape = 'dot', color = '#ffffff', count = 1, speed = 120, dir = null, spread = TAU, size = 4, life = 0.6, g = 0, drag = 0.92, up = 0, swirl = 0 } = {}) {
  const base = dir ? Math.atan2(dir.y, dir.x) : 0;
  for (let i = 0; i < count; i++) {
    const a = dir ? base + (Math.random() - 0.5) * spread : Math.random() * TAU;
    const v = speed * (0.4 + Math.random() * 0.8);
    const l = life * (0.7 + Math.random() * 0.6);
    fx.particles.push({
      x,
      y,
      vx: Math.cos(a) * v - Math.sin(a) * swirl,
      vy: Math.sin(a) * v + Math.cos(a) * swirl - up,
      life: l,
      max: l,
      size: size * (0.6 + Math.random() * 0.8),
      color: Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color,
      shape,
      rot: Math.random() * TAU,
      spin: (Math.random() - 0.5) * 12,
      g,
      drag,
    });
  }
  if (fx.particles.length > MAX_PARTICLES) fx.particles.splice(0, fx.particles.length - MAX_PARTICLES);
}

/** Particles in the type's own shape: embers rise, drops and rocks fall, leaves drift. */
export function styleBurst(fx, type, x, y, { count = 12, speed = 160, dir = null, spread = TAU, size = 4, life = 0.6, swirl = 0 } = {}) {
  const shape = PARTICLE_FOR[styleOf(type)];
  const [c0, c1, c2] = paletteOf(type);
  const heavy = shape === 'drop' || shape === 'rock';
  const g = heavy ? 620 : shape === 'flame' ? -180 : shape === 'leaf' ? 50 : 0;
  emit(fx, x, y, { shape, color: [c0, c1, c1, c2], count, speed, dir, spread, size, life, g, up: heavy ? 170 : 0, swirl });
}

function star(ctx, x, y, outer, inner, points, rot) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / points;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function flameShape(ctx, x, y, w, h, lean = 0) {
  ctx.beginPath();
  ctx.moveTo(x + lean, y - h);
  ctx.bezierCurveTo(x + w * 0.9, y - h * 0.45, x + w, y - h * 0.05, x, y);
  ctx.bezierCurveTo(x - w, y - h * 0.05, x - w * 0.9, y - h * 0.45, x + lean, y - h);
  ctx.closePath();
}

/** Moves and draws every particle (dots from older effects and the shaped ones above). */
export function drawParticles(ctx, fx, dt) {
  const list = fx.particles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list[i] = list[list.length - 1];
      list.pop();
      continue;
    }
    const drag = (p.drag ?? 0.92) ** (dt * 60);
    p.vx *= drag;
    p.vy = p.vy * drag + (p.g || 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.spin) p.rot += p.spin * dt;
    const a = p.life / p.max;
    ctx.globalAlpha = Math.min(1, a * 1.5);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    const s = p.size;
    switch (p.shape) {
      case 'flame': {
        const w = s * (0.5 + a * 0.7);
        ctx.fillStyle = a > 0.65 ? '#fff7ae' : p.color;
        flameShape(ctx, p.x, p.y, w, w * 2.6);
        ctx.fill();
        break;
      }
      case 'drop':
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, s * 1.3, s * 0.75, Math.atan2(p.vy, p.vx), 0, TAU);
        ctx.fill();
        break;
      case 'spark':
        ctx.lineWidth = Math.max(1, s * 0.6);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
        ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      case 'leaf':
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, s * 1.6, s * 0.65, p.rot, 0, TAU);
        ctx.fill();
        break;
      case 'shard':
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.rot) * s * 1.9, p.y + Math.sin(p.rot) * s * 1.9);
        ctx.lineTo(p.x + Math.cos(p.rot + 2.4) * s * 0.7, p.y + Math.sin(p.rot + 2.4) * s * 0.7);
        ctx.lineTo(p.x + Math.cos(p.rot + 3.9) * s * 0.7, p.y + Math.sin(p.rot + 3.9) * s * 0.7);
        ctx.closePath();
        ctx.fill();
        break;
      case 'star':
        star(ctx, p.x, p.y, s * 1.7, s * 0.45, 4, p.rot);
        ctx.fill();
        break;
      case 'rock':
        star(ctx, p.x, p.y, s * 1.2, s * 0.95, 3, p.rot);
        ctx.fill();
        break;
      case 'wisp':
        ctx.globalAlpha = a * 0.45;
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * (1 + (1 - a) * 2.2), 0, TAU);
        ctx.fill();
        break;
      default:
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, TAU);
        ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- Skill 1: the shot ----------

/** Flash at the Pokemon's hand when skill 1 is thrown. */
export function castFx(fx, type, x, y, dir) {
  const [c0, c1] = paletteOf(type);
  const hx = x + dir.x * 24;
  const hy = y + dir.y * 24;
  fx.flashes.push({ x: hx, y: hy, ang: Math.atan2(dir.y, dir.x), color: c1, core: c0, life: 0.2, max: 0.2 });
  styleBurst(fx, type, hx, hy, { count: 10, speed: 280, dir, spread: 0.9, size: 3.5, life: 0.4 });
}

/** A star-shaped burst where a skill-1 shot ends or hits. */
export function impactFx(fx, type, x, y) {
  const [c0, c1] = paletteOf(type);
  fx.impacts.push({ x, y, color: c1, core: c0, life: 0.32, max: 0.32, rot: Math.random() * TAU });
  styleBurst(fx, type, x, y, { count: 12, speed: 230, size: 4, life: 0.55 });
}

export function drawSkillShot(ctx, p, fx, time, dt) {
  const s = styleOf(p.type);
  const [c0, c1, c2] = paletteOf(p.type);
  let trail = fx.trails.get(p.id);
  if (!trail) fx.trails.set(p.id, (trail = []));
  trail.push({ x: p.x, y: p.y });
  if (trail.length > 12) trail.shift();
  const r = p.r;

  // Glowing ribbon behind the shot, then a soft halo
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 1; i < trail.length; i++) {
    const k = i / trail.length;
    ctx.globalAlpha = k * 0.6;
    ctx.strokeStyle = i > trail.length - 4 ? c0 : c1;
    ctx.lineWidth = r * 2.1 * k;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.4);
  halo.addColorStop(0, alpha(c0, 0.9));
  halo.addColorStop(0.35, alpha(c1, 0.55));
  halo.addColorStop(1, alpha(c2, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 3.4, 0, TAU);
  ctx.fill();
  ctx.restore();

  // The head, pointing where it flies
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(p.vy, p.vx));
  switch (s) {
    case 'flame': {
      // A comet: three flickering tongues of fire swept backwards
      [c2, c1, c0].forEach((c, k) => {
        const wob = Math.sin(time * 40 + k * 2) * r * 0.35;
        const len = r * (3.4 - k * 0.9);
        const w = r * (1.15 - k * 0.28);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(r * 0.95, 0);
        ctx.quadraticCurveTo(0, -w - wob * 0.3, -len, wob);
        ctx.quadraticCurveTo(0, w - wob * 0.3, r * 0.95, 0);
        ctx.fill();
      });
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(r * 0.2, 0, r * 0.45, 0, TAU);
      ctx.fill();
      break;
    }
    case 'aqua': {
      // A bubble with a shine and droplets spinning around it
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.2);
      g.addColorStop(0, c0);
      g.addColorStop(0.5, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.15, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.35, r * 0.2, -0.6, 0, TAU);
      ctx.fill();
      for (let k = 0; k < 3; k++) {
        const a = time * 12 + k * 2.1;
        ctx.fillStyle = k ? c1 : c0;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 1.8, Math.sin(a) * r * 1.8, r * 0.3, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'spark': {
      // Crackling lightning around a white-hot core
      ctx.strokeStyle = c0;
      ctx.lineWidth = 2;
      ctx.shadowColor = c1;
      ctx.shadowBlur = 12;
      for (let k = 0; k < 4; k++) {
        let a = Math.random() * TAU;
        let x = 0;
        let y = 0;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let j = 0; j < 3; j++) {
          a += (Math.random() - 0.5) * 1.4;
          x += Math.cos(a) * r * 0.8;
          y += Math.sin(a) * r * 0.8;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.moveTo(r * 1.6, 0);
      ctx.lineTo(-r * 0.2, -r * 0.9);
      ctx.lineTo(r * 0.1, -r * 0.1);
      ctx.lineTo(-r * 1.6, 0);
      ctx.lineTo(r * 0.2, r * 0.9);
      ctx.lineTo(-r * 0.1, r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case 'leaf': {
      // A spinning three-leaf shuriken
      ctx.rotate(time * 18);
      for (let k = 0; k < 3; k++) {
        ctx.rotate(TAU / 3);
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.ellipse(r * 0.95, 0, r * 1.15, r * 0.45, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = c2;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 2, 0);
        ctx.stroke();
      }
      ctx.fillStyle = c0;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, TAU);
      ctx.fill();
      break;
    }
    case 'frost': {
      // A turning snowflake crystal
      ctx.rotate(time * 6);
      for (let k = 0; k < 6; k++) {
        ctx.rotate(TAU / 6);
        ctx.fillStyle = c1;
        ctx.strokeStyle = c0;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.28);
        ctx.lineTo(r * 1.9, 0);
        ctx.lineTo(0, r * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      star(ctx, 0, 0, r * 0.6, r * 0.5, 3, 0);
      ctx.fill();
      break;
    }
    case 'mystic': {
      // A dark orb in a bright ring, little stars orbiting
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = c1;
      ctx.lineWidth = 3;
      ctx.shadowColor = c1;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.rotate(time * 8);
      ctx.fillStyle = c0;
      for (let k = 0; k < 5; k++) {
        const a = (k * TAU) / 5;
        star(ctx, Math.cos(a) * r * 1.8, Math.sin(a) * r * 1.8, r * 0.5, r * 0.18, 4, 0);
        ctx.fill();
      }
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, TAU);
      ctx.fill();
      break;
    }
    case 'rock': {
      // A tumbling boulder
      ctx.rotate(time * 14);
      const g = ctx.createRadialGradient(-r * 0.4, -r * 0.4, 1, 0, 0, r * 1.4);
      g.addColorStop(0, c0);
      g.addColorStop(0.45, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k * TAU) / 7;
        const rr = r * (1.05 + ((p.id * 7 + k * 3) % 5) * 0.08);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    default: {
      // Two crescent wind blades
      for (let k = 0; k < 2; k++) {
        const off = -k * r * 1.5;
        const sc = 1 - k * 0.3;
        ctx.fillStyle = k ? alpha(c1, 0.8) : c0;
        ctx.beginPath();
        ctx.arc(off, 0, r * 1.9 * sc, -1.25, 1.25);
        ctx.arc(off - r * 0.9 * sc, 0, r * 1.6 * sc, 1.0, -1.0, true);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // Sprinkle the type's particles along the way
  trail.acc = (trail.acc || 0) + dt;
  while (trail.acc > 0.03) {
    trail.acc -= 0.03;
    const back = { x: -p.vx, y: -p.vy };
    styleBurst(fx, p.type, p.x, p.y, { count: 1, speed: 70, dir: back, spread: 1.4, size: 3, life: 0.45 });
  }
}

// ---------- Skill 2: the blast around the Pokemon ----------

export function novaFx(fx, type, x, y, r) {
  const s = styleOf(type);
  const pal = paletteOf(type);
  fx.novas.push({ x, y, r, s, pal, life: 0.75, max: 0.75, seed: Math.random() * TAU, bolts: null, boltT: 0 });
  const rim = (n, f) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + Math.random() * 0.3;
      f(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, { x: Math.cos(a), y: Math.sin(a) });
    }
  };
  switch (s) {
    case 'aqua':
      // Splash: drops thrown up all round the edge
      rim(18, (px, py, d) => emit(fx, px, py, { shape: 'drop', color: pal, speed: 70, dir: d, spread: 0.6, size: 4, life: 0.8, g: 760, up: 300 }));
      break;
    case 'leaf':
      // A whirlwind of leaves
      rim(20, (px, py, d) => emit(fx, (px + x) / 2, (py + y) / 2, { shape: 'leaf', color: pal, speed: 140, dir: d, spread: 0.3, size: 4.5, life: 0.9, g: 30, swirl: 260, drag: 0.95 }));
      break;
    case 'flame':
      rim(22, (px, py) => emit(fx, px, py, { shape: 'flame', color: pal, speed: 40, size: 5, life: 0.7, g: -260 }));
      break;
    case 'frost':
      rim(16, (px, py, d) => emit(fx, px, py, { shape: 'shard', color: pal, speed: 180, dir: d, spread: 0.5, size: 4, life: 0.6 }));
      emit(fx, x, y, { shape: 'star', color: '#ffffff', count: 10, speed: 200, size: 3, life: 0.6 });
      break;
    case 'rock':
      rim(14, (px, py, d) => emit(fx, px, py, { shape: 'rock', color: pal, speed: 90, dir: d, spread: 0.6, size: 5, life: 0.8, g: 820, up: 320 }));
      rim(10, (px, py) => emit(fx, px, py, { shape: 'wisp', color: '#d6d3d1', speed: 30, size: 7, life: 0.7 }));
      break;
    case 'spark':
      emit(fx, x, y, { shape: 'spark', color: pal, count: 26, speed: 460, size: 3.5, life: 0.45 });
      break;
    case 'mystic':
      rim(16, (px, py) => emit(fx, px, py, { shape: 'star', color: [pal[0], pal[1]], speed: 30, size: 4, life: 0.9, g: -140 }));
      break;
    default:
      rim(16, (px, py, d) => emit(fx, px, py, { shape: 'wisp', color: pal[0], speed: 120, dir: d, spread: 0.5, size: 6, life: 0.6, swirl: 200 }));
  }
}

function boltPath(x, y, a, len) {
  const pts = [{ x, y }];
  for (let j = 1; j <= 5; j++) {
    const t = j / 5;
    const side = j < 5 ? (Math.random() - 0.5) * len * 0.22 : 0;
    pts.push({ x: x + Math.cos(a) * len * t - Math.sin(a) * side, y: y + Math.sin(a) * len * t + Math.cos(a) * side });
  }
  return pts;
}

/** Ground part of skill 2 (under the Pokemon): glowing disc, shock rings, magic circle, wind spiral. */
export function drawNovasGround(ctx, fx, dt) {
  for (let i = fx.novas.length - 1; i >= 0; i--) {
    const n = fx.novas[i];
    n.life -= dt;
    if (n.life <= 0) {
      fx.novas.splice(i, 1);
      continue;
    }
    const k = 1 - n.life / n.max;
    const fade = 1 - k;
    const R = n.r * easeOut(k * 2);
    const [c0, c1] = n.pal;
    if (R < 2) continue;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, R);
    g.addColorStop(0, alpha(c1, 0));
    g.addColorStop(0.7, alpha(c1, 0.22 * fade));
    g.addColorStop(1, alpha(c0, 0.5 * fade));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(n.x, n.y, R, 0, TAU);
    ctx.fill();
    // Shock rings: a bright leading edge and an echo
    ctx.globalAlpha = fade;
    ctx.strokeStyle = c0;
    ctx.lineWidth = 2 + 7 * fade;
    ctx.beginPath();
    ctx.arc(n.x, n.y, R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = c1;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r * easeOut(k * 2 - 0.25), 0, TAU);
    ctx.stroke();
    if (n.s === 'mystic') {
      // Magic circle: two rings, a turning five-point star, rune dots
      const rot = n.seed + k * 3;
      ctx.lineWidth = 2;
      ctx.strokeStyle = c0;
      ctx.beginPath();
      ctx.arc(n.x, n.y, R * 0.88, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = c1;
      ctx.beginPath();
      for (let j = 0; j <= 5; j++) {
        const a = rot + ((j * 2) % 5) * (TAU / 5);
        ctx.lineTo(n.x + Math.cos(a) * R * 0.75, n.y + Math.sin(a) * R * 0.75);
      }
      ctx.stroke();
      ctx.fillStyle = c0;
      for (let j = 0; j < 12; j++) {
        const a = -rot + (j * TAU) / 12;
        ctx.beginPath();
        ctx.arc(n.x + Math.cos(a) * R * 0.81, n.y + Math.sin(a) * R * 0.81, 2.5, 0, TAU);
        ctx.fill();
      }
    } else if (n.s === 'wind' || n.s === 'leaf') {
      const rot = n.seed + k * 9;
      ctx.lineCap = 'round';
      ctx.strokeStyle = n.s === 'wind' ? c0 : c1;
      for (let j = 0; j < 3; j++) {
        ctx.lineWidth = 5 * fade;
        ctx.beginPath();
        ctx.arc(n.x, n.y, R * (0.45 + j * 0.17), rot + j * 2.1, rot + j * 2.1 + 1.7);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    } else if (n.s === 'aqua') {
      ctx.lineWidth = 2;
      ctx.strokeStyle = c0;
      for (let j = 1; j <= 2; j++) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(1, R * (1 - j * 0.22)), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/** Upright part of skill 2 (over the Pokemon): fire pillars, ice or rock spikes, lightning. */
export function drawNovasTop(ctx, fx, dt) {
  for (const n of fx.novas) {
    const k = 1 - n.life / n.max;
    const fade = 1 - k;
    const [c0, c1, c2] = n.pal;
    const R = n.r * easeOut(k * 2);
    if (n.s === 'flame') {
      // A ring of fire pillars bursting up
      const rise = Math.sin(Math.PI * Math.min(1, k * 1.3));
      for (let j = 0; j < 12; j++) {
        const a = n.seed + (j * TAU) / 12;
        const px = n.x + Math.cos(a) * R;
        const py = n.y + Math.sin(a) * R;
        const h = n.r * 0.5 * rise * (0.75 + ((j * 5) % 3) * 0.15);
        if (h < 2) continue;
        const g = ctx.createLinearGradient(px, py, px, py - h);
        g.addColorStop(0, c2);
        g.addColorStop(0.5, c1);
        g.addColorStop(1, c0);
        ctx.globalAlpha = Math.min(1, fade * 1.6);
        ctx.fillStyle = g;
        flameShape(ctx, px, py, 9 + h * 0.08, h, Math.sin(k * 30 + j) * 4);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (n.s === 'frost' || n.s === 'rock') {
      // Spikes erupting from the edge, then sinking
      const up = k < 0.25 ? easeOut(k / 0.25) * 1.1 : k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      for (let j = 0; j < 12; j++) {
        const a = n.seed + (j * TAU) / 12;
        const px = n.x + Math.cos(a) * n.r * 0.92;
        const py = n.y + Math.sin(a) * n.r * 0.92;
        const h = n.r * 0.42 * up * (0.7 + ((j * 7) % 4) * 0.12);
        if (h < 2) continue;
        const lean = Math.cos(a) * h * 0.25;
        ctx.fillStyle = c1;
        ctx.strokeStyle = n.s === 'frost' ? c0 : c2;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px - 8, py);
        ctx.lineTo(px + lean, py - h);
        ctx.lineTo(px + 8, py);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = n.s === 'frost' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(px - 8, py);
        ctx.lineTo(px + lean, py - h);
        ctx.lineTo(px, py);
        ctx.closePath();
        ctx.fill();
      }
    } else if (n.s === 'spark' && k < 0.6) {
      // Lightning bolts from the Pokemon to the edge, flickering
      n.boltT -= dt;
      if (!n.bolts || n.boltT <= 0) {
        n.boltT = 0.05;
        n.bolts = Array.from({ length: 7 }, (_, j) => boltPath(n.x, n.y - 10, n.seed + (j * TAU) / 7 + (Math.random() - 0.5) * 0.3, Math.max(20, R)));
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      for (const [w, c, al] of [[7, c1, 0.4], [2.5, c0, 1]]) {
        ctx.lineWidth = w;
        ctx.strokeStyle = c;
        ctx.globalAlpha = al * (1 - k / 0.6);
        for (const b of n.bolts) {
          ctx.beginPath();
          b.forEach((pt) => ctx.lineTo(pt.x, pt.y));
          ctx.stroke();
        }
      }
      if (k < 0.2) {
        ctx.globalAlpha = 1 - k / 0.2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(n.x, n.y - 10, 26, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

/** Hand flashes (skill 1 thrown) and star-shaped impacts (skill 1 landing). */
export function drawFlashes(ctx, fx, dt) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = fx.flashes.length - 1; i >= 0; i--) {
    const f = fx.flashes[i];
    f.life -= dt;
    if (f.life <= 0) {
      fx.flashes.splice(i, 1);
      continue;
    }
    const k = 1 - f.life / f.max;
    ctx.globalAlpha = 1 - k;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.ang);
    const len = 20 + 30 * easeOut(k * 2);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, f.core);
    g.addColorStop(1, alpha(f.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(len, -14);
    ctx.lineTo(len * 0.8, 0);
    ctx.lineTo(len, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = f.core;
    star(ctx, 0, 0, 16 * (1 - k * 0.5), 4, 4, k * 2);
    ctx.fill();
    ctx.restore();
  }
  for (let i = fx.impacts.length - 1; i >= 0; i--) {
    const m = fx.impacts[i];
    m.life -= dt;
    if (m.life <= 0) {
      fx.impacts.splice(i, 1);
      continue;
    }
    const k = 1 - m.life / m.max;
    const e = easeOut(k * 1.5);
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = m.color;
    star(ctx, m.x, m.y, 12 + 30 * e, 5 + 6 * e, 8, m.rot);
    ctx.fill();
    ctx.fillStyle = m.core;
    star(ctx, m.x, m.y, 8 + 16 * e, 3 + 3 * e, 8, m.rot + 0.4);
    ctx.fill();
    ctx.strokeStyle = m.core;
    ctx.lineWidth = 3 * (1 - k);
    ctx.beginPath();
    ctx.arc(m.x, m.y, 10 + 34 * e, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}
