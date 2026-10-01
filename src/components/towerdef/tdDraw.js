// Thủ thành Pokémon: canvas drawing (map, towers, enemies, attacks, effects).
import { TD_W as W, TD_H as H, THEMES, distToPath } from '../../utils/towerdef/levels';
import { LINES, HERO } from '../../utils/towerdef/towers';
import { energyNeed, energyFull } from '../../utils/towerdef/engine';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { loadImage, drawSprite, drawPokeball, updateParticles } from '../sports/sportsKit';

const TAU = Math.PI * 2;

export const LINE_COLOR = { fire: '#f97316', water: '#3b82f6', grass: '#22c55e', electric: '#facc15', psychic: '#d946ef', hero: '#fde047' };

export const art = (dex) => (dex ? loadImage(artworkUrl(dex)) : null);

// ---------- Background (painted once per level) ----------

const bgCache = new Map();

function seededRnd(seed) {
  let a = seed;
  return () => ((a = (a * 16807) % 2147483647) - 1) / 2147483646;
}

function deco(ctx, kind, x, y, s, rnd) {
  ctx.save();
  ctx.translate(x, y);
  switch (kind) {
    case 'tree':
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(0, 10 * s, 12 * s, 4 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-2.5 * s, 0, 5 * s, 10 * s);
      ctx.fillStyle = rnd() < 0.5 ? '#15803d' : '#166534';
      ctx.beginPath();
      ctx.arc(0, -6 * s, 11 * s, 0, TAU);
      ctx.arc(-7 * s, 0, 7 * s, 0, TAU);
      ctx.arc(7 * s, 0, 7 * s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(-3 * s, -10 * s, 4 * s, 0, TAU);
      ctx.fill();
      break;
    case 'palm':
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(0, 10 * s);
      ctx.quadraticCurveTo(4 * s, 0, 1 * s, -10 * s);
      ctx.stroke();
      ctx.fillStyle = '#16a34a';
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(1 * s, -10 * s);
        ctx.rotate(-Math.PI / 2 + (i - 2) * 0.7);
        ctx.beginPath();
        ctx.ellipse(8 * s, 0, 9 * s, 3 * s, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'crystal':
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(125,211,252,0.85)' : 'rgba(196,181,253,0.85)';
      ctx.beginPath();
      ctx.moveTo(0, -12 * s);
      ctx.lineTo(5 * s, 0);
      ctx.lineTo(0, 8 * s);
      ctx.lineTo(-5 * s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-1 * s, -8 * s, 2 * s, 8 * s);
      break;
    case 'house':
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-10 * s, -4 * s, 20 * s, 14 * s);
      ctx.fillStyle = ['#ef4444', '#3b82f6', '#f59e0b'][Math.floor(rnd() * 3)];
      ctx.beginPath();
      ctx.moveTo(-13 * s, -3 * s);
      ctx.lineTo(0, -14 * s);
      ctx.lineTo(13 * s, -3 * s);
      ctx.fill();
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(-7 * s, 0, 5 * s, 4 * s);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(2 * s, 2 * s, 5 * s, 8 * s);
      break;
    case 'lava':
      ctx.fillStyle = 'rgba(249,115,22,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 13 * s, 6 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(253,224,71,0.8)';
      ctx.beginPath();
      ctx.ellipse(-2 * s, -1 * s, 6 * s, 2.5 * s, 0, 0, TAU);
      ctx.fill();
      break;
    case 'pine':
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-2 * s, 4 * s, 4 * s, 7 * s);
      ctx.fillStyle = '#166534';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, -16 * s + i * 6 * s);
        ctx.lineTo(10 * s - i, 5 * s + i * 1 * s - 6 * s + i * 4 * s);
        ctx.lineTo(-10 * s + i, 5 * s + i * 1 * s - 6 * s + i * 4 * s);
        ctx.fill();
      }
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(0, -16 * s);
      ctx.lineTo(4 * s, -10 * s);
      ctx.lineTo(-4 * s, -10 * s);
      ctx.fill();
      break;
    case 'crate':
      ctx.fillStyle = '#a16207';
      ctx.fillRect(-9 * s, -9 * s, 18 * s, 18 * s);
      ctx.strokeStyle = '#713f12';
      ctx.lineWidth = 2 * s;
      ctx.strokeRect(-9 * s, -9 * s, 18 * s, 18 * s);
      ctx.fillStyle = '#dc2626';
      ctx.font = `900 ${Math.round(12 * s)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('R', 0, 1);
      break;
    case 'pillar':
      ctx.fillStyle = '#f5f5f4';
      ctx.fillRect(-5 * s, -14 * s, 10 * s, 24 * s);
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(-8 * s, -16 * s, 16 * s, 4 * s);
      ctx.fillRect(-8 * s, 9 * s, 16 * s, 4 * s);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -20 * s, 3 * s, 0, TAU);
      ctx.fill();
      break;
    default:
  }
  ctx.restore();
}

function roadPath(ctx, lv) {
  ctx.beginPath();
  lv.path.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

function paintBackground(lv) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  const th = THEMES[lv.theme];
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.ground[0]);
  g.addColorStop(1, th.ground[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rnd = seededRnd(11 + lv.index * 97);
  // Speckles / grass tufts / snow
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + rnd() * 0.07})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * W, rnd() * H, 2 + rnd() * 5, 1 + rnd() * 2, rnd() * 3, 0, TAU);
    ctx.fill();
  }
  if (lv.theme === 'beach') {
    // The sea along one side
    ctx.fillStyle = 'rgba(14,165,233,0.75)';
    ctx.beginPath();
    ctx.moveTo(W, 0);
    for (let y = 0; y <= H; y += 20) ctx.lineTo(W - 26 - Math.sin(y / 30) * 6, y);
    ctx.lineTo(W, H);
    ctx.fill();
  }
  // Road: edge, dirt, lighter middle, pebbles
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  roadPath(ctx, lv);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 44;
  ctx.stroke();
  roadPath(ctx, lv);
  ctx.strokeStyle = th.edge;
  ctx.lineWidth = 40;
  ctx.stroke();
  roadPath(ctx, lv);
  ctx.strokeStyle = th.road;
  ctx.lineWidth = 32;
  ctx.stroke();
  roadPath(ctx, lv);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.setLineDash([3, 14]);
  roadPath(ctx, lv);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.setLineDash([]);
  // Decorations away from road and pads
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < 26; tries++) {
    const x = 12 + rnd() * (W - 24);
    const y = 16 + rnd() * (H - 28);
    if (distToPath(lv.path, x, y) < 34) continue;
    if (lv.pads.some((p) => Math.hypot(p.x - x, p.y - y) < 30)) continue;
    deco(ctx, th.deco, x, y, 0.8 + rnd() * 0.5, rnd);
    placed++;
  }
  // Team Rocket gate where they come from
  const a = lv.path.pts[0];
  const b = lv.path.pts[1];
  const gx = Math.max(16, Math.min(W - 16, a.x + (b.x - a.x) * 0.12));
  const gy = Math.max(16, Math.min(H - 16, a.y + (b.y - a.y) * 0.12));
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  ctx.beginPath();
  ctx.arc(gx, gy, 15, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.font = '900 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('R', gx, gy + 1);
  return c;
}

export function background(lv) {
  if (!bgCache.has(lv.id)) {
    const c = paintBackground(lv);
    if (!c) return null;
    bgCache.set(lv.id, c);
  }
  return bgCache.get(lv.id);
}

/** The Pokémon Center the child protects, at the end of the road. */
function drawCenter(ctx, x, y, t, hurt) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 18, 34, 8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff7ed';
  ctx.fillRect(-28, -6, 56, 24);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(-34, -4);
  ctx.lineTo(0, -26);
  ctx.lineTo(34, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(-8, 4, 16, 14);
  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(-22, 0, 9, 8);
  ctx.fillRect(13, 0, 9, 8);
  drawPokeball(ctx, 0, -10, 7 + Math.sin(t * 3) * 0.6);
  if (hurt > 0) {
    ctx.globalAlpha = Math.min(1, hurt * 2) * 0.55;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -2, 40, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------- Pads, towers ----------

function drawPad(ctx, p, t, empty, selected) {
  const pulse = (Math.sin(t * 3 + p.id) + 1) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 10, 20, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = empty ? `rgba(253,224,71,${0.18 + pulse * 0.25})` : 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 6, 19, 9, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = selected ? '#ffffff' : empty ? `rgba(253,224,71,${0.6 + pulse * 0.4})` : 'rgba(148,163,184,0.8)';
  ctx.lineWidth = selected ? 3 : 2;
  ctx.stroke();
  if (empty) {
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 8 + pulse * 10;
    drawPokeball(ctx, p.x, p.y + 1 - pulse * 2, 9);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function star5(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function drawTower(ctx, s, tw, v, heroImg) {
  const line = tw.line;
  const color = LINE_COLOR[line];
  const size = (line === 'hero' ? 42 : 38) + tw.stage * 9;
  const recoil = v.recoil.get(tw.id) || 0;
  const bob = Math.sin(v.time * 2.4 + tw.id) * 1.5;
  const full = energyFull(s, tw);
  const glow = full ? (Math.sin(v.time * 6) + 1) / 2 : 0;
  ctx.save();
  if (full || line === 'hero') {
    const r = size * 0.62 + glow * 5;
    const g = ctx.createRadialGradient(tw.x, tw.y - 6, 4, tw.x, tw.y - 6, r);
    g.addColorStop(0, full ? 'rgba(255,255,255,0.8)' : 'rgba(253,224,71,0.45)');
    g.addColorStop(1, full ? 'rgba(253,224,71,0)' : 'rgba(253,224,71,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tw.x, tw.y - 6, r, 0, TAU);
    ctx.fill();
  }
  const img = line === 'hero' ? heroImg : art(tw.dex);
  const flip = Math.cos(tw.angle) > 0.2;
  drawSprite(ctx, img, tw.x - Math.cos(tw.angle) * recoil * 4, tw.y - size * 0.32 + bob - Math.sin(tw.angle) * recoil * 4, size, { flip, color });
  // Hero stars
  if (line === 'hero') {
    for (let i = 0; i <= tw.stage; i++) {
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1;
      star5(ctx, tw.x - tw.stage * 6 + i * 12, tw.y - size * 0.85, 5);
      ctx.fill();
      ctx.stroke();
    }
  }
  // Evolution energy bar
  if (tw.stage < 2) {
    const need = energyNeed(s, tw);
    const k = Math.min(1, tw.energy / need);
    const bw = 34;
    ctx.fillStyle = 'rgba(15,23,42,0.75)';
    ctx.fillRect(tw.x - bw / 2 - 1, tw.y + 15, bw + 2, 6);
    const eg = ctx.createLinearGradient(tw.x - bw / 2, 0, tw.x + bw / 2, 0);
    eg.addColorStop(0, '#a855f7');
    eg.addColorStop(1, full ? '#fde047' : '#38bdf8');
    ctx.fillStyle = eg;
    ctx.fillRect(tw.x - bw / 2, tw.y + 16, bw * k, 4);
    if (full) {
      // "!" bubble: tap me!
      const by = tw.y - size * 0.95 - 6 - glow * 3;
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tw.x + size * 0.38, by, 8, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7c2d12';
      ctx.font = '900 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', tw.x + size * 0.38, by + 1);
    }
  }
  ctx.restore();
}

// ---------- Enemies ----------

function drawEnemy(ctx, e, t) {
  const img = art(e.dex);
  const bob = Math.abs(Math.sin(t * 9 + e.id)) * (e.fly ? 0 : 4);
  const hover = e.fly ? 14 + Math.sin(t * 5 + e.id) * 4 : 0;
  ctx.save();
  // Shadow on the road
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + 6, e.size * 0.34, e.size * 0.12, 0, 0, TAU);
  ctx.fill();
  if (e.slowT > 0) {
    ctx.strokeStyle = 'rgba(96,165,250,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 6, e.size * 0.42, e.size * 0.16, 0, 0, TAU);
    ctx.stroke();
  }
  if (e.boss) {
    const g = ctx.createRadialGradient(e.x, e.y - e.size * 0.4, 4, e.x, e.y - e.size * 0.4, e.size * 0.8);
    g.addColorStop(0, 'rgba(239,68,68,0.35)');
    g.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y - e.size * 0.4, e.size * 0.8, 0, TAU);
    ctx.fill();
  }
  const y = e.y - e.size * 0.42 - bob - hover;
  const flip = Math.cos(e.angle) > 0.3;
  drawSprite(ctx, img, e.x, y, e.size, { flip, rotate: Math.sin(t * 9 + e.id) * 0.06, color: '#a78bfa' });
  if (e.flash > 0) {
    ctx.globalAlpha = Math.min(1, e.flash * 6) * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(e.x, y, e.size * 0.36, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (e.poisonT > 0) {
    ctx.fillStyle = 'rgba(168,85,247,0.85)';
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.3 + i / 3 + e.id * 0.17) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(e.x - 8 + i * 8, y - e.size * 0.3 - k * 14, 2.5, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // HP bar
  if (!e.boss || e.hp < e.maxHp) {
    const bw = e.boss ? 46 : 28;
    const k = Math.max(0, e.hp / e.maxHp);
    const by = y - e.size * 0.5 - 6;
    ctx.fillStyle = 'rgba(15,23,42,0.75)';
    ctx.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = k > 0.5 ? '#22c55e' : k > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(e.x - bw / 2, by, bw * k, 4);
  }
  ctx.restore();
}

// ---------- Projectiles and attacks ----------

function drawProjectile(ctx, p, t) {
  ctx.save();
  switch (p.kind) {
    case 'fireball': {
      const r = 5 + p.stage * 2;
      const dx = p.x - p.sx;
      const dy = p.y - p.sy;
      const d = Math.hypot(dx, dy) || 1;
      for (let i = 4; i >= 1; i--) {
        ctx.globalAlpha = 0.18 * (5 - i);
        ctx.fillStyle = i > 2 ? '#fde047' : '#fb923c';
        ctx.beginPath();
        ctx.arc(p.x - (dx / d) * i * 5, p.y - (dy / d) * i * 5, r * (1 - i * 0.15), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, r + 2);
      g.addColorStop(0, '#fff7ae');
      g.addColorStop(0.5, '#fb923c');
      g.addColorStop(1, 'rgba(220,38,38,0.2)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 2, 0, TAU);
      ctx.fill();
      break;
    }
    case 'bubble':
    case 'cannon': {
      const r = p.kind === 'cannon' ? 7 : 4 + p.stage * 1.5;
      ctx.fillStyle = 'rgba(147,197,253,0.55)';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(p.x - r * 0.35, p.y - r * 0.35, r * 0.28, 0, TAU);
      ctx.fill();
      if (p.kind === 'cannon') {
        ctx.strokeStyle = 'rgba(59,130,246,0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      break;
    }
    case 'leaf': {
      ctx.translate(p.x, p.y);
      ctx.rotate(t * 14 + p.id);
      ctx.fillStyle = p.stage ? '#16a34a' : '#4ade80';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7 + p.stage * 2, 3, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      break;
    }
    case 'psy': {
      const r = 5 + p.stage * 2 + Math.sin(t * 20) * 1.5;
      ctx.strokeStyle = '#f0abfc';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#d946ef';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.5, 0, TAU);
      ctx.stroke();
      break;
    }
    default: {
      // Hero: a spinning star in the hero's colour
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 10;
      ctx.translate(p.x, p.y);
      ctx.rotate(t * 10);
      star5(ctx, 0, 0, 6 + p.stage * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function jagged(ctx, pts, amp, rnd) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    for (let k = 1; k <= 4; k++) {
      const f = k / 4;
      const j = k === 4 ? 0 : (rnd() - 0.5) * amp;
      ctx.lineTo(a.x + (b.x - a.x) * f + j, a.y + (b.y - a.y) * f + j);
    }
  }
}

function drawAttackFx(ctx, v) {
  for (let i = v.attacks.length - 1; i >= 0; i--) {
    const a = v.attacks[i];
    a.life -= v.dt;
    if (a.life <= 0) {
      v.attacks.splice(i, 1);
      continue;
    }
    const k = a.life / a.max;
    ctx.save();
    if (a.type === 'cone') {
      // Charizard's flamethrower
      const g = ctx.createRadialGradient(a.x, a.y - 10, 4, a.x, a.y - 10, a.range);
      g.addColorStop(0, `rgba(255,247,174,${0.9 * k})`);
      g.addColorStop(0.45, `rgba(251,146,60,${0.75 * k})`);
      g.addColorStop(1, 'rgba(220,38,38,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 10);
      ctx.arc(a.x, a.y - 10, a.range, a.angle - a.spread, a.angle + a.spread);
      ctx.closePath();
      ctx.fill();
    } else if (a.type === 'beam') {
      // Venusaur's solar beam
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(190,242,100,${0.5 * k})`;
      ctx.lineWidth = 16 * k + 4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 12);
      ctx.lineTo(a.tx, a.ty);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * k})`;
      ctx.lineWidth = 5 * k + 1;
      ctx.stroke();
    } else if (a.type === 'chain') {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(253,224,71,${k})`;
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2 + a.stage * 1.5;
      jagged(ctx, a.points, 10 + a.stage * 4, Math.random);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${k})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (a.type === 'psywave') {
      // Alakazam: rings of psychic power
      for (let r = 0; r < 3; r++) {
        const rr = a.range * (1 - k) + r * 10;
        if (rr > a.range) continue;
        ctx.strokeStyle = `rgba(240,171,252,${k * (1 - r * 0.25)})`;
        ctx.lineWidth = 4 - r;
        ctx.beginPath();
        ctx.arc(a.x, a.y - 8, rr, 0, TAU);
        ctx.stroke();
      }
    } else if (a.type === 'splash') {
      ctx.strokeStyle = a.color;
      ctx.globalAlpha = k;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * (1.2 - k * 0.6), 0, TAU);
      ctx.stroke();
    } else if (a.type === 'poof') {
      // Enemy fainted: white flash, then a Poké Ball that shrinks away
      const r = a.size * 0.5;
      if (k > 0.6) {
        ctx.globalAlpha = (k - 0.6) / 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(a.x, a.y - r, r * (1.4 - k * 0.4), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = Math.min(1, k * 2);
      drawPokeball(ctx, a.x, a.y - r - (1 - k) * 18, 4 + 8 * k, (1 - k) * 6);
    } else if (a.type === 'ring') {
      ctx.strokeStyle = a.color;
      ctx.globalAlpha = k;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * (1.6 - k), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawFloats(ctx, v) {
  for (let i = v.floats.length - 1; i >= 0; i--) {
    const f = v.floats[i];
    f.life -= v.dt;
    if (f.life <= 0) {
      v.floats.splice(i, 1);
      continue;
    }
    const k = 1 - f.life / f.max;
    ctx.globalAlpha = Math.min(1, f.life * 3);
    const size = f.size * (k < 0.15 ? 0.7 + k * 2 : 1);
    ctx.font = `900 ${Math.round(size)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    const y = f.y - k * f.rise;
    ctx.strokeText(f.text, f.x, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, y);
  }
  ctx.globalAlpha = 1;
}

function drawCandy(ctx, d, t) {
  const y = d.y - 8 - Math.abs(Math.sin(t * 4)) * 6;
  ctx.save();
  const g = ctx.createRadialGradient(d.x, y, 2, d.x, y, 22);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(96,165,250,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(d.x, y, 22, 0, TAU);
  ctx.fill();
  // Wrapper ends
  ctx.fillStyle = '#93c5fd';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d.x + sx * 6, y);
    ctx.lineTo(d.x + sx * 14, y - 6);
    ctx.lineTo(d.x + sx * 14, y + 6);
    ctx.fill();
  }
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(d.x, y, 8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(d.x - 8, y - 2, 16, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(d.x - 3, y - 4, 2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawRange(ctx, x, y, r, color, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -t * 20;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Draw a whole frame. v = visual state (particles, floats, attack effects, selection). */
export function drawFrame(ctx, s, v, heroImg) {
  const t = v.time;
  const lv = s.lv;
  const bg = background(lv);
  if (bg) ctx.drawImage(bg, 0, 0, W, H);
  else {
    ctx.fillStyle = THEMES[lv.theme].ground[0];
    ctx.fillRect(0, 0, W, H);
  }
  const end = lv.path.pts[lv.path.pts.length - 1];
  drawCenter(ctx, end.x, end.y - 6, t, v.centerHurt);
  if (v.centerHurt > 0) v.centerHurt -= v.dt;
  // Range of the selected pad / tower
  if (v.selected != null) {
    const p = lv.pads[v.selected];
    const tw = s.towers.find((q) => q.pad === v.selected);
    if (p) {
      const st = tw ? (tw.line === 'hero' ? HERO : LINES[tw.line]).stages[tw.stage] : null;
      drawRange(ctx, p.x, p.y, st ? st.range : 85, tw ? LINE_COLOR[tw.line] : '#fde047', t);
    }
  }
  for (const p of lv.pads) {
    const tw = s.towers.find((q) => q.pad === p.id);
    drawPad(ctx, p, t, !tw, v.selected === p.id);
  }
  // Draw top to bottom so nearer things overlap farther ones
  const things = [...s.towers.map((q) => ({ y: q.y, tw: q })), ...s.enemies.map((e) => ({ y: e.y, e }))].sort((a, b) => a.y - b.y);
  for (const it of things) {
    if (it.tw) drawTower(ctx, s, it.tw, v, heroImg);
    else drawEnemy(ctx, it.e, t);
  }
  for (const d of s.drops) drawCandy(ctx, d, t);
  for (const p of s.projectiles) drawProjectile(ctx, p, t);
  drawAttackFx(ctx, v);
  updateParticles(ctx, v.particles, v.dt);
  drawFloats(ctx, v);
  for (const [id, r] of v.recoil) {
    const n = r - v.dt * 6;
    if (n <= 0) v.recoil.delete(id);
    else v.recoil.set(id, n);
  }
}
