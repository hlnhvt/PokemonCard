// Thủ thành Pokémon: canvas drawing (map, towers, enemies, attacks, effects).
// The static 2.5D map lives in tdScene.js (painted once per level); this file draws the live layer on top.
import { TD_W as W, TD_H as H, THEMES } from '../../utils/towerdef/levels';
import { LINES, LINE_IDS, HERO, lineUnlocked } from '../../utils/towerdef/towers';
import { energyNeed, energyFull } from '../../utils/towerdef/engine';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { loadImage, drawPokeball, updateParticles } from '../sports/sportsKit';
import { scene, drawCenter, centerSpot, drawAmbientUnder, drawAmbientOver, PAD_TOP } from './tdScene';
import { softShadow, cylinder, lighten, darken, drawGlow, drawOutlined, pillBar } from './tdKit';

const TAU = Math.PI * 2;

export const LINE_COLOR = { fire: '#f97316', water: '#3b82f6', grass: '#22c55e', electric: '#facc15', psychic: '#d946ef', hero: '#fde047' };

export const art = (dex) => (dex ? loadImage(artworkUrl(dex)) : null);

// ---------- Pads, towers ----------

function drawPadLive(ctx, p, t, empty, selected, afford) {
  const cy = p.y + PAD_TOP;
  const pulse = (Math.sin(t * 3 + p.id) + 1) / 2;
  if (empty) {
    if (afford) {
      drawGlow(ctx, '#fde047', p.x, cy, 24 + pulse * 5, 0.3 + pulse * 0.3);
      ctx.strokeStyle = `rgba(253,224,71,${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(p.x, cy, 16.5, 8.2, 0, 0, TAU);
      ctx.stroke();
      softShadow(ctx, p.x + 1, cy + 1, 7 - pulse * 1.5, 2.6, 0.4);
      drawPokeball(ctx, p.x, cy - 7 - pulse * 3, 7);
    } else {
      softShadow(ctx, p.x + 1, cy + 1, 6, 2.2, 0.35);
      ctx.globalAlpha = 0.75;
      drawPokeball(ctx, p.x, cy - 4, 5.5);
      ctx.globalAlpha = 1;
    }
  }
  if (selected) {
    drawGlow(ctx, '#ffffff', p.x, cy, 26, 0.35);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, cy, 18.5, 9.3, 0, 0, TAU);
    ctx.stroke();
  }
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

/** Type-coloured pedestal on the pad; one tier (and gem) per evolution stage. Returns the top y. */
function pedestal(ctx, x, y, color, stage) {
  const cy = y + PAD_TOP;
  cylinder(ctx, x, cy + 3, 15, 7.4, 3, lighten(color, 0.3), darken(color, 0.2), 'rgba(0,0,0,0.3)');
  let top = cy;
  if (stage >= 1) {
    cylinder(ctx, x, cy + 0.5, 11, 5.4, 2.8, lighten(color, 0.45), color, 'rgba(0,0,0,0.25)');
    top = cy - 2.3;
  }
  if (stage >= 2) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(x, top, 10, 4.9, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(x, top, 10, 4.9, 0, Math.PI * 1.1, Math.PI * 1.6);
    ctx.stroke();
  }
  // Gems on the front band
  for (let i = 0; i <= stage; i++) {
    const a = Math.PI / 2 + (i - stage / 2) * 0.5;
    const gx = x + Math.cos(a) * 14.6;
    const gy = cy + 1.6 + Math.sin(a) * 7.2;
    ctx.fillStyle = stage >= 2 ? '#fde047' : '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(gx, gy - 2.4);
    ctx.lineTo(gx + 1.8, gy);
    ctx.lineTo(gx, gy + 2.4);
    ctx.lineTo(gx - 1.8, gy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  return top;
}

function drawTower(ctx, s, tw, v, heroImg, dpr) {
  const line = tw.line;
  const color = LINE_COLOR[line];
  const size = (line === 'hero' ? 42 : 38) + tw.stage * 9;
  const recoil = v.recoil.get(tw.id) || 0;
  const bob = Math.sin(v.time * 2.4 + tw.id) * 1.5;
  const full = energyFull(s, tw);
  const glow = full ? (Math.sin(v.time * 6) + 1) / 2 : 0;
  ctx.save();
  const top = pedestal(ctx, tw.x, tw.y, color, tw.stage);
  const cy = top - size * 0.4 + bob;
  if (full || line === 'hero') drawGlow(ctx, full ? '#fef9c3' : '#fde047', tw.x, cy, size * 0.62 + glow * 5, full ? 0.7 : 0.35);
  softShadow(ctx, tw.x + 1.5, top + 0.5, size * 0.3, size * 0.1, 0.45);
  const img = line === 'hero' ? heroImg : art(tw.dex);
  const flip = Math.cos(tw.angle) > 0.2;
  drawOutlined(ctx, img, tw.x - Math.cos(tw.angle) * recoil * 4, cy - Math.sin(tw.angle) * recoil * 4, size, dpr, {
    flip, color, rim: line === 'hero' ? '#fde047' : '#ffffff', rimW: line === 'hero' ? 2 : 1.4,
  });
  // Hero stars
  if (line === 'hero') {
    for (let i = 0; i <= tw.stage; i++) {
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 1;
      star5(ctx, tw.x - tw.stage * 6 + i * 12, cy - size * 0.55, 5);
      ctx.fill();
      ctx.stroke();
    }
  }
  // Evolution energy bar
  if (tw.stage < 2) {
    const need = energyNeed(s, tw);
    const k = Math.min(1, tw.energy / need);
    const bw = 30;
    const eg = ctx.createLinearGradient(tw.x - bw / 2, 0, tw.x + bw / 2, 0);
    eg.addColorStop(0, '#a855f7');
    eg.addColorStop(1, full ? '#fde047' : '#38bdf8');
    pillBar(ctx, tw.x - bw / 2, tw.y + 19, bw, 4, k, eg);
    if (full) {
      // "!" bubble: tap me!
      const by = cy - size * 0.55 - 4 - glow * 3;
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

function drawEnemy(ctx, e, t, dpr) {
  const img = art(e.dex);
  const bob = Math.abs(Math.sin(t * 9 + e.id)) * (e.fly ? 0 : 4);
  const hover = e.fly ? 14 + Math.sin(t * 5 + e.id) * 4 : 0;
  ctx.save();
  // Shadow on the road (smaller and fainter for flyers)
  const sk = e.fly ? 0.7 : 1 - bob * 0.03;
  softShadow(ctx, e.x + 2, e.y + 5, e.size * 0.36 * sk, e.size * 0.13 * sk, e.fly ? 0.25 : 0.45);
  if (e.slowT > 0) {
    ctx.strokeStyle = 'rgba(96,165,250,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 5, e.size * 0.42, e.size * 0.16, 0, 0, TAU);
    ctx.stroke();
  }
  const y = e.y - e.size * 0.42 - bob - hover;
  if (e.boss) drawGlow(ctx, '#ef4444', e.x, y, e.size * 0.8, 0.45);
  const flip = Math.cos(e.angle) > 0.3;
  const rot = Math.sin(t * 9 + e.id) * 0.06;
  drawOutlined(ctx, img, e.x, y, e.size, dpr, { flip, rotate: rot, color: '#a78bfa', rim: e.boss ? '#ef4444' : '#ffffff', rimW: e.boss ? 2.2 : 1.5 });
  if (e.flash > 0) drawOutlined(ctx, img, e.x, y, e.size, dpr, { flip, rotate: rot, rim: '#ffffff', rimW: 1.5, solid: true, alpha: Math.min(1, e.flash * 6) * 0.75 });
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
    pillBar(ctx, e.x - bw / 2, y - e.size * 0.5 - 7, bw, 4, k, k > 0.5 ? '#22c55e' : k > 0.25 ? '#facc15' : '#ef4444');
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
  const tr = ctx.getTransform ? ctx.getTransform() : null;
  const dpr = tr && tr.a > 0 ? Math.round(tr.a * 4) / 4 : 2;
  const sc = scene(lv, dpr);
  if (sc) ctx.drawImage(sc.canvas, 0, 0, W, H);
  else {
    ctx.fillStyle = THEMES[lv.theme].ground[0];
    ctx.fillRect(0, 0, W, H);
  }
  if (sc) drawAmbientUnder(ctx, sc, t);
  // Range of the selected pad / tower
  if (v.selected != null) {
    const p = lv.pads[v.selected];
    const tw = s.towers.find((q) => q.pad === v.selected);
    if (p) {
      const st = tw ? (tw.line === 'hero' ? HERO : LINES[tw.line]).stages[tw.stage] : null;
      drawRange(ctx, p.x, p.y, st ? st.range : 85, tw ? LINE_COLOR[tw.line] : '#fde047', t);
    }
  }
  let minCost = Infinity;
  for (const l of LINE_IDS) if (lineUnlocked(l, s.level)) minCost = Math.min(minCost, LINES[l].cost);
  const afford = (s.hero && !s.heroUsed) || s.coins >= minCost;
  for (const p of lv.pads) {
    const tw = s.towers.find((q) => q.pad === p.id);
    drawPadLive(ctx, p, t, !tw, v.selected === p.id, afford);
  }
  // Draw back to front so nearer things overlap farther ones
  const cs = centerSpot(lv);
  const things = [...s.towers.map((q) => ({ y: q.y + 6, tw: q })), ...s.enemies.map((e) => ({ y: e.y, e })), { y: cs.y + 4, center: true }].sort((a, b) => a.y - b.y);
  for (const it of things) {
    if (it.tw) drawTower(ctx, s, it.tw, v, heroImg, dpr);
    else if (it.e) drawEnemy(ctx, it.e, t, dpr);
    else drawCenter(ctx, lv, dpr, t, v.centerHurt);
  }
  if (v.centerHurt > 0) v.centerHurt -= v.dt;
  for (const d of s.drops) drawCandy(ctx, d, t);
  for (const p of s.projectiles) drawProjectile(ctx, p, t);
  drawAttackFx(ctx, v);
  updateParticles(ctx, v.particles, v.dt);
  if (sc) drawAmbientOver(ctx, sc, t);
  drawFloats(ctx, v);
  for (const [id, r] of v.recoil) {
    const n = r - v.dt * 6;
    if (n <= 0) v.recoil.delete(id);
    else v.recoil.set(id, n);
  }
}
