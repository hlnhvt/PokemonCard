// Drawing of everything that moves in the quest: portals, loot with rarity beams, chests,
// wild Pokemon (elites glow, the boss has an aura), the team, the trainer (drawn here: cap
// with a Pokeball logo, backpack), shots and effects. World space; the camera never shakes.
import { TYPE_COLORS } from '../../utils/battle/typeChart';
import { RARITY } from '../../utils/quest/items';
import { drawSprite, imageReady, loadImage } from '../sports/sportsKit';
import { drawParticles, drawSkillShot, drawNovasGround, drawNovasTop, drawFlashes, styleBurst, emit, paletteOf } from '../moba/skillFx';

const TAU = Math.PI * 2;
export const typeColor = (t) => TYPE_COLORS[t] || '#e5e7eb';
const PORTAL_COLORS = { next: '#38bdf8', back: '#a3e635', act: '#fbbf24', return: '#c084fc' };

export function createFx() {
  return { particles: [], rings: [], numbers: [], trails: new Map(), beams: [], novas: [], flashes: [], impacts: [], slashes: [], balls: [], texts: [], flash: {}, lunge: {} };
}

export function burstFx(fx, x, y, color, { count = 14, speed = 180, size = 4, life = 0.6, up = 0 } = {}) {
  emit(fx, x, y, { color: [color, color, '#ffffff'], count, speed, size, life, up });
}

export function sparkle(fx, x, y, colors = ['#fde047', '#ffffff', '#fbbf24'], count = 16, speed = 160) {
  emit(fx, x, y, { shape: 'star', color: colors, count, speed, size: 3.5, life: 0.9, g: -60 });
}

export function numberFx(fx, x, y, text, color = '#ffffff', size = 18, life = 0.9, spread = 14) {
  fx.numbers.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.4, text, color, size, life, max: life });
  if (fx.numbers.length > 60) fx.numbers.shift();
}

export function ringFx(fx, x, y, color, from = 10, to = 80, life = 0.5, width = 8, fill = false) {
  fx.rings.push({ x, y, color, from, to, life, max: life, width, fill });
}

/** Big level-up: a column of light, golden rings, stars and "LÊN CẤP! n". */
export function levelUpFx(fx, x, y, level) {
  fx.beams.push({ x, y, life: 1.1, max: 1.1, color: '#fde047', w: 30, h: 220 });
  ringFx(fx, x, y, '#fde047', 10, 90, 0.7, 10, true);
  ringFx(fx, x, y - 20, '#ffffff', 6, 60, 0.5, 5);
  sparkle(fx, x, y - 30, ['#fde047', '#ffffff', '#fbbf24', '#fb923c'], 28, 220);
  fx.texts.push({ x, y: y - 70, text: 'LÊN CẤP!', sub: String(level), life: 1.6, max: 1.6 });
}

// ---------- the trainer ----------

function rr(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function cap(ctx, face) {
  // Red cap, white front panel with a Pokeball logo, dark brim towards where the trainer looks
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, -33, 12.5, Math.PI, TAU);
  ctx.fill();
  ctx.fillRect(-12.5, -34, 25, 3);
  if (face === 'down') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -34, 7.5, Math.PI, TAU);
    ctx.fill();
    // Pokeball logo
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -37, 3.6, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -37, 3.6, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-3.6, -37.5, 7.2, 1);
    ctx.beginPath();
    ctx.arc(0, -37, 1.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(0, -31.5, 13, 3.6, 0, 0, Math.PI);
    ctx.fill();
  } else if (face === 'up') {
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(-7, -33, 14, 3);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -45, 2, 0, TAU);
    ctx.fill();
  } else {
    // Side view (drawn facing right)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, -35, 6, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(5, -37, 2.8, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(2.2, -37.3, 5.6, 0.9);
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(12, -32.5, 8, 2.8, 0.08, 0, TAU);
    ctx.fill();
  }
}

function backpack(ctx, x, y, w, h) {
  rr(ctx, x, y, w, h, 5, '#facc15');
  rr(ctx, x + 2, y + h * 0.45, w - 4, h * 0.4, 3, '#eab308');
  ctx.fillStyle = '#a16207';
  ctx.fillRect(x + w / 2 - 1, y + h * 0.45, 2, 3);
}

/** A cute trainer: feet at (t.x, t.y + 10). face: down / up / left / right. */
export function drawTrainer(ctx, t, time) {
  const walking = t.moving;
  const sw = walking ? Math.sin(t.walk) : 0;
  const bob = walking ? Math.abs(Math.sin(t.walk)) * 2.2 : Math.sin(time * 2.6) * 0.7;
  const face = t.face || 'down';
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 5.5, 0, 0, TAU);
  ctx.fill();
  // Yellow ring: this is the child
  ctx.strokeStyle = 'rgba(250,204,21,0.8)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 10, 18 + Math.sin(time * 4) * 1.5, 7, 0, 0, TAU);
  ctx.stroke();
  ctx.translate(0, -bob);
  const side = face === 'left' || face === 'right';
  if (face === 'left') ctx.scale(-1, 1);
  const skin = '#fcd9b8';
  // Legs and shoes
  if (side) {
    rr(ctx, -5 + sw * 4, -2, 6, 11, 2, '#1e3a8a');
    rr(ctx, -1 - sw * 4, -2, 6, 11, 2, '#1e40af');
    rr(ctx, -6 + sw * 4, 7, 9, 4, 2, '#ef4444');
    rr(ctx, -2 - sw * 4, 7, 9, 4, 2, '#dc2626');
  } else {
    rr(ctx, -7, -2 + sw * 2, 6, 11, 2, '#1e3a8a');
    rr(ctx, 1, -2 - sw * 2, 6, 11, 2, '#1e3a8a');
    rr(ctx, -8, 7 + sw * 2, 8, 4, 2, '#ef4444');
    rr(ctx, 0, 7 - sw * 2, 8, 4, 2, '#ef4444');
  }
  // Backpack behind the body
  if (face === 'down') {
    backpack(ctx, -12, -21, 24, 14);
  } else if (side) backpack(ctx, -15, -21, 10, 17);
  // Arms behind (side view)
  if (side) {
    ctx.save();
    ctx.translate(-1, -17);
    ctx.rotate(-sw * 0.6);
    rr(ctx, -3, 0, 6, 12, 3, '#1d4ed8');
    ctx.restore();
  }
  // Body: blue jacket with a white stripe
  rr(ctx, -10, -22, 20, 22, 7, '#2563eb');
  if (!side) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(face === 'up' ? -10 : -1, -21, face === 'up' ? 20 : 2, face === 'up' ? 3 : 20);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-10, -14, 20, 3);
  }
  // Backpack straps (front) or the big backpack (back)
  if (face === 'down') {
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(-8, -21, 3, 16);
    ctx.fillRect(5, -21, 3, 16);
  } else if (face === 'up') backpack(ctx, -11, -22, 22, 19);
  // Arms
  if (side) {
    ctx.save();
    ctx.translate(1, -17);
    ctx.rotate(sw * 0.6);
    rr(ctx, -3, 0, 6, 12, 3, '#2563eb');
    rr(ctx, -3, 10, 6, 4, 2, skin);
    ctx.restore();
  } else {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 11, -19);
      ctx.rotate(s * 0.12 + sw * 0.45 * s);
      rr(ctx, -3, 0, 6, 12, 3, '#2563eb');
      rr(ctx, -3, 10, 6, 4, 2, skin);
      ctx.restore();
    }
  }
  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -31, 11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3f2a1d';
  if (face === 'up') {
    ctx.beginPath();
    ctx.arc(0, -31, 11, 0, TAU);
    ctx.fill();
  } else if (side) {
    ctx.beginPath();
    ctx.arc(-4, -31, 9, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.ellipse(6, -29.5, 1.6, 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.arc(4, -25.5, 2, 0, TAU);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(-9, -30, 3.5, 0, TAU);
    ctx.arc(9, -30, 3.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 4, -29, 1.7, 2.5, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-3.4, -30, 0.7, 0, TAU);
    ctx.arc(4.6, -30, 0.7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.arc(-7, -25.5, 1.9, 0, TAU);
    ctx.arc(7, -25.5, 1.9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, -26, 2.2, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  cap(ctx, face);
  ctx.restore();
}

// ---------- loot, chests, portals ----------

function drawItemIcon(ctx, item, x, y, time) {
  switch (item) {
    case 'coin': {
      const w = Math.abs(Math.cos(time * 4 + x)) * 7 + 1.5;
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(x, y, w + 1, 8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(x, y, w, 7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(x - Math.min(1.2, w * 0.3), y - 4, Math.min(2.4, w * 0.6), 8);
      break;
    }
    case 'berry':
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(x, y + 1, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#93c5fd';
      ctx.beginPath();
      ctx.arc(x - 2.5, y - 1.5, 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.ellipse(x + 3, y - 7, 4, 2, -0.5, 0, TAU);
      ctx.fill();
      break;
    case 'potion':
    case 'superPotion': {
      const c = item === 'potion' ? '#a855f7' : '#facc15';
      rr(ctx, x - 6, y - 5, 12, 14, 4, c);
      rr(ctx, x - 3, y - 10, 6, 6, 2, '#e2e8f0');
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x - 4, y - 3, 2, 8);
      if (item === 'superPotion') {
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(x - 6, y + 1, 12, 3);
      }
      break;
    }
    case 'revive':
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x, y + 9);
      ctx.lineTo(x - 7, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fef9c3';
      ctx.fillRect(x - 1.5, y - 5, 3, 10);
      ctx.fillRect(x - 5, y - 1.5, 10, 3);
      break;
    case 'candy':
      ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 5);
      ctx.lineTo(x - 6, y);
      ctx.lineTo(x - 12, y + 5);
      ctx.moveTo(x + 12, y - 5);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x + 12, y + 5);
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 7, -0.6, 0.9);
      ctx.lineTo(x, y);
      ctx.fill();
      break;
    case 'stone': {
      const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 9);
      g.addColorStop(0, '#fef08a');
      g.addColorStop(0.5, '#f97316');
      g.addColorStop(1, '#7c2d12');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 8, y - 2);
      ctx.lineTo(x + 5, y + 8);
      ctx.lineTo(x - 5, y + 8);
      ctx.lineTo(x - 8, y - 2);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default: {
      // Charms: a ring with a gem
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y + 1, 7, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = item === 'charmAtk' ? '#ef4444' : item === 'charmHp' ? '#22c55e' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(x, y - 6, 4, 0, TAU);
      ctx.fill();
    }
  }
}

function drawDrop(ctx, d, time) {
  const bob = d.z > 0 ? 0 : Math.sin(time * 3 + d.id) * 2;
  const y = d.y - d.z - 10 + bob;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(d.x, d.y + 2, 8, 3, 0, 0, TAU);
  ctx.fill();
  drawItemIcon(ctx, d.kind === 'coin' ? 'coin' : d.item, d.x, y, time);
}

/** Light beams of loot (drawn under the Pokemon). */
function drawDropBeam(ctx, d, time) {
  if (d.kind === 'coin') return;
  const c = RARITY[d.rarity]?.color || '#ffffff';
  const a = 0.35 + Math.sin(time * 4 + d.id) * 0.12;
  const h = d.rarity === 'common' ? 60 : d.rarity === 'uncommon' ? 90 : 140;
  const g = ctx.createLinearGradient(d.x, d.y - h, d.x, d.y);
  g.addColorStop(0, `${c}00`);
  g.addColorStop(1, c);
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(d.x - 6, d.y - h, 12, h);
  ctx.globalAlpha = a * 0.8;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(d.x, d.y + 1, 16, 6, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawChest(ctx, c, time) {
  const x = c.x;
  const y = c.y;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 22, 7, 0, 0, TAU);
  ctx.fill();
  if (!c.opened) {
    const glow = 0.3 + Math.sin(time * 3 + c.id) * 0.15;
    const g = ctx.createRadialGradient(x, y, 4, x, y, 44);
    g.addColorStop(0, `rgba(253,224,71,${glow})`);
    g.addColorStop(1, 'rgba(253,224,71,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 44, y - 44, 88, 88);
  }
  rr(ctx, x - 18, y - 6, 36, 18, 3, '#92400e');
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(x - 18, y - 1, 36, 3);
  if (c.opened) {
    rr(ctx, x - 18, y - 22, 36, 10, 3, '#78350f');
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(x - 14, y - 8, 28, 3);
  } else {
    rr(ctx, x - 19, y - 17, 38, 13, 5, '#b45309');
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x - 19, y - 8, 38, 3);
    rr(ctx, x - 4, y - 9, 8, 9, 2, '#fde047');
  }
}

function drawPortal(ctx, p, time) {
  const c = PORTAL_COLORS[p.kind] || '#38bdf8';
  const pulse = 1 + Math.sin(time * 3 + p.id) * 0.06;
  ctx.save();
  ctx.translate(p.x, p.y);
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 60 * pulse);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, c);
  g.addColorStop(1, `${c}00`);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 60 * pulse, 30 * pulse, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = k === 1 ? '#ffffff' : c;
    const a = time * (2 + k * 0.7) + k * 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26 + k * 8, 12 + k * 4, 0, a, a + 2.4);
    ctx.stroke();
  }
  // Swirling column of light
  const col = ctx.createLinearGradient(0, -120, 0, 0);
  col.addColorStop(0, `${c}00`);
  col.addColorStop(1, `${c}aa`);
  ctx.fillStyle = col;
  ctx.fillRect(-18, -120, 36, 120);
  ctx.restore();
  if (p.label) {
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(15,23,42,0.85)';
    const text = p.kind === 'back' ? `← ${p.label}` : p.kind === 'return' || p.kind === 'act' ? `✦ ${p.label}` : `${p.label} →`;
    ctx.strokeText(text, p.x, p.y - 46);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, p.x, p.y - 46);
  }
}

const SPOT_LABEL = { center: '💖 Hồi máu', shop: '🛒 Mua đồ', board: '🗺️ Hành trình' };
function drawSpot(ctx, s, time, active) {
  const k = 0.5 + Math.sin(time * 3) * 0.2;
  ctx.strokeStyle = active ? '#fde047' : 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -time * 20;
  ctx.globalAlpha = active ? 1 : k + 0.2;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, s.r, s.r * 0.45, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.font = '900 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(15,23,42,0.8)';
  ctx.strokeText(SPOT_LABEL[s.id], s.x, s.y + 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(SPOT_LABEL[s.id], s.x, s.y + 4);
}

function drawWarning(ctx, w, time) {
  const k = 1 - Math.max(0, w.t) / w.max;
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
    ctx.arc(w.x, w.y, w.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(239,68,68,${0.42 * blink})`;
    ctx.beginPath();
    ctx.arc(w.x, w.y, Math.max(1, w.r * k), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fecaca';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    if (w.kind === 'meteor') {
      const h = (1 - k) * 260;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(w.x, w.y, 18 + k * 14, 8 + k * 6, 0, 0, TAU);
      ctx.fill();
      const [c0, c1, c2] = paletteOf(w.type || 'rock');
      const g = ctx.createRadialGradient(w.x - 6, w.y - h - 6, 2, w.x, w.y - h, 22);
      g.addColorStop(0, c0);
      g.addColorStop(0.5, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(w.x, w.y - h, 20, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------- Pokemon ----------

function hpBar(ctx, x, y, w, ratio, color) {
  ctx.fillStyle = 'rgba(15,23,42,0.8)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2 - 2, y, w + 4, 8, 4);
  ctx.fill();
  ctx.fillStyle = ratio > 0.5 ? color : ratio > 0.25 ? '#facc15' : '#ef4444';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y + 2, Math.max(0, w * ratio), 4, 2);
  ctx.fill();
}

function label(ctx, text, x, y, color = '#ffffff', size = 10) {
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawSpriteLit(ctx, img, x, y, size, flip, flash, color) {
  drawSprite(ctx, img, x, y, size, { flip, color });
  if (flash > 0 && imageReady(img)) {
    // Hit: the sprite itself lights up white for a moment
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawSprite(ctx, img, x, y, size, { flip, alpha: flash * 0.75 });
    ctx.restore();
  }
}

function drawEnemy(ctx, e, fx, time) {
  const img = loadImage(e.image);
  const flash = fx.flash[`e${e.id}`] || 0;
  const bob = e.moving ? Math.abs(Math.sin(time * 12 + e.id)) * 4 : Math.sin(time * 3 + e.id) * 1.5;
  const k = e.boss ? 1 : e.elite ? 1.25 : 1;
  const size = e.boss ? 176 : 58 * k;
  const feet = e.y + e.r * 0.7;
  if (e.boss) {
    const c = e.angry ? '#ef4444' : typeColor(e.types[0]);
    const p = 1 + Math.sin(time * (e.angry ? 8 : 3)) * 0.08;
    const g = ctx.createRadialGradient(e.x, e.y - 30, 10, e.x, e.y - 30, e.r * 2.4 * p);
    g.addColorStop(0, `${c}66`);
    g.addColorStop(1, `${c}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y - 30, e.r * 2.4 * p, 0, TAU);
    ctx.fill();
  } else if (e.elite) {
    const g = ctx.createRadialGradient(e.x, e.y - 20, 6, e.x, e.y - 20, 58);
    g.addColorStop(0, 'rgba(250,204,21,0.5)');
    g.addColorStop(1, 'rgba(250,204,21,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y - 20, 58, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(e.x, feet, e.r * 1.15, e.r * 0.42, 0, 0, TAU);
  ctx.fill();
  if (e.elite) {
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -time * 20;
    ctx.beginPath();
    ctx.ellipse(e.x, feet, e.r * 1.4, e.r * 0.55, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (!e.boss) {
    ctx.strokeStyle = e.mode === 'chase' ? 'rgba(248,113,113,0.8)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(e.x, feet, e.r * 1.2, e.r * 0.45, 0, 0, TAU);
    ctx.stroke();
  }
  const wind = e.windup > 0 ? 1 + Math.sin(time * 40) * 0.05 : 1;
  const lift = e.boss ? size * 0.36 : size * 0.4;
  drawSpriteLit(ctx, img, e.x, feet - lift - bob, size * wind * (1 + flash * 0.08), e.facing < 0, flash, typeColor(e.types[0]));
  if (e.boss) return;
  const top = feet - size * 0.85 - bob;
  // Only the ones that matter get a bar and a level (a quiet pack stays clean)
  if (e.hp < e.maxHp || e.elite) hpBar(ctx, e.x, top - 4, e.elite ? 56 : 40, e.hp / e.maxHp, e.elite ? '#f59e0b' : '#f87171');
  if (e.elite || e.mode === 'chase' || e.hp < e.maxHp) label(ctx, `${e.elite ? '👑 ' : ''}Lv ${e.level}`, e.x, top - 8, e.elite ? '#fde047' : '#fecaca', e.elite ? 11 : 9);
  if (e.alertT > 0) {
    const s = 1 + (1 - e.alertT / 0.9) * 0.3;
    ctx.font = `900 ${Math.round(22 * s)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#7f1d1d';
    ctx.strokeText('!', e.x + 18, top - 14);
    ctx.fillStyle = '#fde047';
    ctx.fillText('!', e.x + 18, top - 14);
  }
}

function drawMember(ctx, m, fx, time, isLead) {
  const img = loadImage(m.image);
  const flash = fx.flash[`p${m.idx}`] || 0;
  const bob = m.moving ? Math.abs(Math.sin(time * 13 + m.idx)) * 4 : Math.sin(time * 3 + m.idx) * 1.5;
  const feet = m.y + 12;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(m.x, feet, 19, 7, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = isLead ? '#facc15' : '#38bdf8';
  ctx.lineWidth = isLead ? 3.5 : 2.5;
  ctx.shadowColor = isLead ? '#facc15' : '#38bdf8';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(m.x, feet, 22 + (isLead ? Math.sin(time * 5) * 1.5 : 0), 8.5, 0, 0, TAU);
  ctx.stroke();
  ctx.shadowBlur = 0;
  const lunge = m.lunge > 0 ? Math.sin((m.lunge / 0.18) * Math.PI) * 10 : 0;
  const size = 56 * (1 + flash * 0.1);
  drawSpriteLit(ctx, img, m.x + lunge * (m.facing || 1), feet - 26 - bob, size, m.facing < 0, flash, typeColor(m.types[0]));
  hpBar(ctx, m.x, feet - 64 - bob, 38, m.hp / m.maxHp, '#4ade80');
  label(ctx, `${m.level}`, m.x - 27, feet - 57 - bob, '#fde047', 10);
  if (isLead) {
    const ay = feet - 76 + Math.sin(time * 6) * 3 - bob;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(m.x, ay + 7);
    ctx.lineTo(m.x - 6, ay);
    ctx.lineTo(m.x + 6, ay);
    ctx.fill();
  }
}

function drawShot(ctx, p, fx, time) {
  const enemy = p.side === 'enemy';
  const c = enemy ? '#f43f5e' : typeColor(p.type);
  let trail = fx.trails.get(p.id);
  if (!trail) fx.trails.set(p.id, (trail = []));
  trail.push({ x: p.x, y: p.y });
  if (trail.length > 6) trail.shift();
  for (let i = 0; i < trail.length; i++) {
    ctx.globalAlpha = (i / trail.length) * 0.5;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(trail[i].x, trail[i].y, p.r * (i / trail.length), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowColor = c;
  ctx.shadowBlur = enemy ? 14 : 10;
  ctx.fillStyle = enemy ? typeColor(p.type) : c;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r + Math.sin(time * 30) * 0.8, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = enemy ? '#450a0a' : '#ffffff';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * 0.45, 0, TAU);
  ctx.fill();
  if (enemy) {
    ctx.strokeStyle = '#fecaca';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 2, 0, TAU);
    ctx.stroke();
  }
}

// ---------- effects ----------

function drawEffects(ctx, fx, dt) {
  // Melee swipes
  for (let i = fx.slashes.length - 1; i >= 0; i--) {
    const s = fx.slashes[i];
    s.life -= dt;
    if (s.life <= 0) {
      fx.slashes.splice(i, 1);
      continue;
    }
    const k = 1 - s.life / s.max;
    const a = Math.atan2(s.dy, s.dx);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = s.color;
    ctx.lineCap = 'round';
    ctx.lineWidth = 7 * (1 - k) + 2;
    ctx.beginPath();
    ctx.arc(s.x - s.dx * 12, s.y - s.dy * 12, 24 + k * 10, a - 1.1 + k * 0.6, a + 0.9 + k * 0.6);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x - s.dx * 12, s.y - s.dy * 12, 22 + k * 10, a - 0.8 + k * 0.6, a + 0.6 + k * 0.6);
    ctx.stroke();
    ctx.restore();
  }
  // Rings
  for (let i = fx.rings.length - 1; i >= 0; i--) {
    const r = fx.rings[i];
    r.life -= dt;
    if (r.life <= 0) {
      fx.rings.splice(i, 1);
      continue;
    }
    const k = 1 - r.life / r.max;
    const rad = r.from + (r.to - r.from) * (1 - (1 - k) ** 3);
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * (1 - k * 0.6);
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, rad, rad * 0.62, 0, 0, TAU);
    ctx.stroke();
    if (r.fill) {
      ctx.globalAlpha = (1 - k) * 0.22;
      ctx.fillStyle = r.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Columns of light (level up, revive, arrival)
  for (let i = fx.beams.length - 1; i >= 0; i--) {
    const b = fx.beams[i];
    b.life -= dt;
    if (b.life <= 0) {
      fx.beams.splice(i, 1);
      continue;
    }
    const a = b.life / b.max;
    const h = b.h || 240;
    const w = (b.w || 34) * (0.4 + a * 0.6);
    const g = ctx.createLinearGradient(b.x, b.y - h, b.x, b.y);
    g.addColorStop(0, `${b.color}00`);
    g.addColorStop(1, b.color);
    ctx.globalAlpha = Math.min(1, a * 1.4);
    ctx.fillStyle = g;
    ctx.fillRect(b.x - w / 2, b.y - h, w, h);
    ctx.globalAlpha = 1;
  }
  // Pokeballs: a fainted Pokemon flies back to the trainer's ball
  for (let i = fx.balls.length - 1; i >= 0; i--) {
    const b = fx.balls[i];
    b.t += dt;
    const k = Math.min(1, b.t / b.dur);
    if (k >= 1) {
      fx.balls.splice(i, 1);
      continue;
    }
    const tx = b.to.x;
    const ty = b.to.y;
    const x = b.from.x + (tx - b.from.x) * k;
    const y = b.from.y + (ty - b.from.y) * k - Math.sin(k * Math.PI) * 70;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(k * 12);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 8, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-8, -1, 16, 2);
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawTexts(ctx, fx, dt) {
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
  // "LÊN CẤP!" with the new level in a big golden number
  for (let i = fx.texts.length - 1; i >= 0; i--) {
    const t = fx.texts[i];
    t.life -= dt;
    if (t.life <= 0) {
      fx.texts.splice(i, 1);
      continue;
    }
    const k = 1 - t.life / t.max;
    const s = k < 0.12 ? 0.4 + (k / 0.12) * 0.8 : k < 0.2 ? 1.2 - ((k - 0.12) / 0.08) * 0.2 : 1;
    ctx.globalAlpha = Math.min(1, t.life * 2);
    ctx.save();
    ctx.translate(t.x, t.y - k * 26);
    ctx.scale(s, s);
    ctx.textAlign = 'center';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#7c2d12';
    ctx.strokeText(t.text, 0, 0);
    const g = ctx.createLinearGradient(0, -16, 0, 2);
    g.addColorStop(0, '#fef9c3');
    g.addColorStop(1, '#f59e0b');
    ctx.fillStyle = g;
    ctx.fillText(t.text, 0, 0);
    if (t.sub) {
      ctx.font = '900 30px system-ui, sans-serif';
      ctx.strokeText(t.sub, 0, 30);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t.sub, 0, 30);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Everything that moves, in world space (the camera transform is already set). */
export function drawScene(ctx, state, fx, time, dt, view) {
  const { cam, w, h } = view;
  const pad = 200;
  const inView = (o) => o.x > cam.x - pad && o.x < cam.x + w + pad && o.y > cam.y - pad && o.y < cam.y + h + pad;
  const town = state.area.kind === 'town';
  if (town) for (const s of state.area.spots) if (inView(s)) drawSpot(ctx, s, time, state.townSpot === s.id);
  for (const p of state.portals) if (inView(p)) drawPortal(ctx, p, time);
  for (const wn of state.telegraphs) drawWarning(ctx, wn, time);
  drawNovasGround(ctx, fx, dt);
  for (const d of state.drops) if (inView(d)) drawDropBeam(ctx, d, time);

  const items = [];
  for (const c of state.chests) if (inView(c)) items.push({ y: c.y, c });
  for (const d of state.drops) if (inView(d)) items.push({ y: d.y, d });
  for (const e of state.enemies) if (inView(e)) items.push({ y: e.y + e.r * 0.7, e });
  for (const m of state.party) if (!m.fainted) items.push({ y: m.y + 12, m });
  items.push({ y: state.trainer.y + 10, t: true });
  for (const p of state.projectiles) if (inView(p)) items.push({ y: p.y + 18, p });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.c) drawChest(ctx, it.c, time);
    else if (it.d) drawDrop(ctx, it.d, time);
    else if (it.e) drawEnemy(ctx, it.e, fx, time);
    else if (it.m) drawMember(ctx, it.m, fx, time, it.m.idx === state.lead);
    else if (it.t) drawTrainer(ctx, state.trainer, time);
    else if (it.p) {
      if (it.p.skill === 's1') drawSkillShot(ctx, it.p, fx, time, dt);
      else drawShot(ctx, it.p, fx, time);
    }
  }
  // The trainer shows through anything big standing in front (a see-through copy on top)
  const t = state.trainer;
  if (state.enemies.some((e) => (e.boss || e.elite) && e.y > t.y && Math.abs(e.x - t.x) < (e.boss ? 90 : 40) && e.y - t.y < (e.boss ? 130 : 60))) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawTrainer(ctx, t, time);
    ctx.restore();
  }
  drawNovasTop(ctx, fx, dt);
  drawFlashes(ctx, fx, dt);
  drawEffects(ctx, fx, dt);
  drawParticles(ctx, fx, dt);
  drawTexts(ctx, fx, dt);
}

/** Decay per-entity flashes (called once per frame). */
export function tickFx(fx, dt) {
  for (const k of Object.keys(fx.flash)) {
    fx.flash[k] -= dt * 5;
    if (fx.flash[k] <= 0) delete fx.flash[k];
  }
}

/** Minimap (screen space): explored ground, portals, chests, wild Pokemon, the trainer. */
export function drawMinimap(ctx, state, art, x, y, w, maxH, time) {
  const area = state.area;
  let s = w / area.w;
  let h = area.h * s;
  if (h > maxH) {
    s = maxH / area.h;
    h = maxH;
    w = area.w * s;
  }
  ctx.save();
  ctx.fillStyle = 'rgba(15,23,42,0.8)';
  ctx.beginPath();
  ctx.roundRect(x - 4, y - 4, w + 8, h + 8, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.imageSmoothingEnabled = false;
  if (art?.minimap) ctx.drawImage(art.minimap, x, y, w, h);
  ctx.imageSmoothingEnabled = true;
  if (art?.fog) ctx.drawImage(art.fog, x, y, state.fog.cols * state.fog.cell * s, state.fog.rows * state.fog.cell * s);
  const f = state.fog;
  const seen = (o) => {
    if (!f) return true;
    const cx = Math.floor(o.x / f.cell);
    const cy = Math.floor(o.y / f.cell);
    return !!f.data[cy * f.cols + cx];
  };
  for (const c of state.chests) if (!c.opened && seen(c)) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + c.x * s - 2, y + c.y * s - 2, 4, 4);
  }
  for (const p of state.portals) if (seen(p)) {
    ctx.fillStyle = PORTAL_COLORS[p.kind];
    ctx.beginPath();
    ctx.arc(x + p.x * s, y + p.y * s, 3.5 + Math.sin(time * 4) * 0.8, 0, TAU);
    ctx.fill();
  }
  for (const e of state.enemies) if (seen(e)) {
    ctx.fillStyle = e.boss ? '#ef4444' : e.elite ? '#f59e0b' : '#f87171';
    ctx.beginPath();
    ctx.arc(x + e.x * s, y + e.y * s, e.boss ? 4.5 : e.elite ? 2.6 : 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + state.trainer.x * s, y + state.trainer.y * s, 3.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  return { w, h };
}

export { styleBurst };
