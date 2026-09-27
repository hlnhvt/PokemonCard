import React, { useEffect, useRef, useState } from 'react';
import {
  DURATION,
  CONTACT,
  MAX_APEX,
  TRICKS,
  LAYERS,
  createTrampoline,
  stepTrampoline,
  tapBounce,
  swipeTrick,
  timeToLand,
  press,
  timeLeft,
  layerAt,
  trampolineStars,
} from '../../utils/carnival/trampoline';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite, burst, updateParticles } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const W = 360;
const H = 560;
const TAU = Math.PI * 2;
const MAT_Y = 470; // screen y of the mat when the camera is on the ground
const MAT = { x: 170, rx: 118, ry: 22 };
const PX = 17; // pixels per metre
const SIZE = 84;
const SWIPE = 26;
const METER = { x: 340, top: 54, bottom: 520 };
const LAYER_ICONS = ['🌳', '☁️', '🐦', '🎈', '⭐'];
const QUALITY = {
  perfect: { text: 'TUYỆT!', tone: 'gold' },
  good: { text: 'Tốt!', tone: 'green' },
  early: { text: 'Sớm quá!', tone: 'soft' },
  late: { text: 'Muộn rồi!', tone: 'soft' },
  none: { text: 'Chạm để nhún cao!', tone: 'soft' },
  dizzy: { text: 'Chóng mặt quá! 💫', tone: 'purple' },
};
const pidgey = () => loadImage(artworkUrl(16));
const pidgeotto = () => loadImage(artworkUrl(17));
const jiggly = () => loadImage(artworkUrl(39));

const lerp = (a, b, k) => a + (b - a) * k;
function mix(c1, c2, k) {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [a, b] = [p(c1), p(c2)];
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`;
}
// Sky colour by height (metres)
const SKY = [
  [0, '#bae6fd'],
  [14, '#7dd3fc'],
  [28, '#60a5fa'],
  [40, '#818cf8'],
  [52, '#4338ca'],
  [66, '#0f172a'],
];
function skyAt(h) {
  for (let i = 1; i < SKY.length; i++) {
    if (h <= SKY[i][0]) return mix(SKY[i - 1][1], SKY[i][1], (h - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]));
  }
  return SKY[SKY.length - 1][1];
}

// Fixed things in the sky (metres)
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const CLOUDS = Array.from({ length: 12 }, (_, i) => ({ x: rnd() * W, h: 9 + i * 2.3 + rnd() * 2, s: 0.7 + rnd() * 0.7, v: 4 + rnd() * 8 }));
const BIRDS = Array.from({ length: 6 }, (_, i) => ({ x: rnd() * W, h: 21 + i * 3 + rnd() * 2, v: (rnd() < 0.5 ? -1 : 1) * (22 + rnd() * 18), big: i % 3 === 2, ph: rnd() * 6 }));
const BALLOONS = Array.from({ length: 9 }, (_, i) => ({ x: 20 + rnd() * (W - 70), h: 35 + i * 2 + rnd() * 2, c: ['#f43f5e', '#facc15', '#38bdf8', '#a78bfa', '#4ade80', '#fb923c'][i % 6], ph: rnd() * 6 }));
const STARS = Array.from({ length: 70 }, () => ({ x: rnd() * W, h: 46 + rnd() * 40, r: 0.6 + rnd() * 1.6, ph: rnd() * 6 }));

function drawCloud(ctx, x, y, s, alpha = 0.95) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, 16 * s, 0, TAU);
  ctx.arc(x + 18 * s, y - 8 * s, 20 * s, 0, TAU);
  ctx.arc(x + 40 * s, y, 15 * s, 0, TAU);
  ctx.arc(x + 20 * s, y + 6 * s, 16 * s, 0, TAU);
  ctx.fill();
}

function drawBalloon(ctx, x, y, c, t, ph) {
  const sway = Math.sin(t * 1.3 + ph) * 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + sway, y + 18);
  ctx.quadraticCurveTo(x + sway - 6, y + 34, x + sway + 2, y + 50);
  ctx.stroke();
  const g = ctx.createRadialGradient(x + sway - 5, y - 6, 2, x + sway, y, 18);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, c);
  g.addColorStop(1, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x + sway, y, 14, 18, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(x + sway - 3, y + 20);
  ctx.lineTo(x + sway + 3, y + 20);
  ctx.lineTo(x + sway, y + 16);
  ctx.fill();
}

function drawStarShape(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let p = 0; p < 10; p++) {
    const rr = p % 2 ? r * 0.45 : r;
    const a = (p / 10) * TAU - Math.PI / 2 + rot;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function drawSky(ctx, cam, t) {
  const topH = cam + MAT_Y / PX;
  const botH = cam - (H - MAT_Y) / PX;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, skyAt(topH));
  g.addColorStop(1, skyAt(Math.max(0, botH)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const y = (h) => MAT_Y - (h - cam) * PX;
  // Stars (brighter the darker the sky)
  const dark = Math.min(1, Math.max(0, (topH - 38) / 20));
  if (dark > 0) {
    for (const s of STARS) {
      const sy = y(s.h);
      if (sy < -5 || sy > H + 5) continue;
      const tw = 0.5 + Math.sin(t * 3 + s.ph) * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${dark * (0.3 + tw * 0.7)})`;
      ctx.beginPath();
      ctx.arc(s.x, sy, s.r, 0, TAU);
      ctx.fill();
    }
    // Moon with a soft glow
    const my = y(70);
    if (my > -40) {
      const mg = ctx.createRadialGradient(70, my, 10, 70, my, 50);
      mg.addColorStop(0, `rgba(254,249,195,${dark * 0.45})`);
      mg.addColorStop(1, 'rgba(254,249,195,0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(70, my, 50, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(254,249,195,${dark})`;
      ctx.beginPath();
      ctx.arc(70, my, 20, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(234,179,8,${dark * 0.25})`;
      for (const [cx, cy, cr] of [[-6, -5, 4], [6, 4, 5], [-4, 8, 2.5]]) {
        ctx.beginPath();
        ctx.arc(70 + cx, my + cy, cr, 0, TAU);
        ctx.fill();
      }
    }
  }
  // Sun low in the sky
  const sy = y(16);
  if (sy > -40 && sy < H + 40) {
    ctx.fillStyle = 'rgba(253,224,71,0.35)';
    ctx.beginPath();
    ctx.arc(282, sy, 34, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(282, sy, 22, 0, TAU);
    ctx.fill();
  }
  for (const c of CLOUDS) {
    const cy = y(c.h);
    if (cy < -40 || cy > H + 40) continue;
    const cx = ((c.x + t * c.v) % (W + 120)) - 70;
    drawCloud(ctx, cx, cy, c.s, 0.9);
  }
  for (const b of BALLOONS) {
    const by = y(b.h) + Math.sin(t + b.ph) * 5;
    if (by < -60 || by > H + 60) continue;
    drawBalloon(ctx, b.x, by, b.c, t, b.ph);
  }
  for (const b of BIRDS) {
    const by = y(b.h) + Math.sin(t * 2 + b.ph) * 6;
    if (by < -40 || by > H + 40) continue;
    const span = W + 100;
    const bx = ((((b.x + t * b.v) % span) + span) % span) - 50;
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(1, 0.85 + Math.abs(Math.sin(t * 9 + b.ph)) * 0.25);
    drawSprite(ctx, b.big ? pidgeotto() : pidgey(), 0, 0, b.big ? 52 : 40, { flip: b.v > 0, color: '#a16207' });
    ctx.restore();
  }
}

function drawPark(ctx, cam, t) {
  const base = MAT_Y + cam * PX;
  if (base - 200 > H) return;
  // Far hills (a little parallax)
  const far = MAT_Y + cam * PX * 0.75;
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.moveTo(0, far - 40);
  ctx.quadraticCurveTo(90, far - 110, 180, far - 50);
  ctx.quadraticCurveTo(270, far - 100, W, far - 44);
  ctx.lineTo(W, H + 400);
  ctx.lineTo(0, H + 400);
  ctx.fill();
  // Carnival tents
  const tents = [
    [40, '#f43f5e'],
    [300, '#3b82f6'],
  ];
  for (const [x, c] of tents) {
    const y = base - 40;
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(x - 30, y - 30, 60, 40);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#fef3c7' : c;
      ctx.beginPath();
      ctx.moveTo(x, y - 76);
      ctx.lineTo(x - 36 + i * 18, y - 30);
      ctx.lineTo(x - 18 + i * 18, y - 30);
      ctx.fill();
    }
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x, y - 90);
    ctx.lineTo(x + 14, y - 84);
    ctx.lineTo(x, y - 78);
    ctx.fill();
  }
  // Trees
  for (let i = 0; i < 6; i++) {
    const x = 16 + i * 66;
    const y = base - 20 + (i % 2) * 6;
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x - 3, y - 10, 6, 16);
    ctx.fillStyle = i % 2 ? '#16a34a' : '#22c55e';
    ctx.beginPath();
    ctx.arc(x, y - 22, 16 + (i % 3) * 3, 0, TAU);
    ctx.fill();
  }
  // Grass
  const g = ctx.createLinearGradient(0, base - 10, 0, base + 100);
  g.addColorStop(0, '#4ade80');
  g.addColorStop(1, '#15803d');
  ctx.fillStyle = g;
  ctx.fillRect(0, base - 6, W, H + 400);
  for (let i = 0; i < 24; i++) {
    const x = (i * 53) % W;
    const y = base + 40 + ((i * 29) % 50);
    ctx.fillStyle = ['#fde047', '#f9a8d4', '#ffffff'][i % 3];
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, TAU);
    ctx.fill();
  }
  // Jigglypuff, the host, cheering beside the trampoline
  const hop = Math.abs(Math.sin(t * 3.2)) * 6;
  drawSprite(ctx, jiggly(), 318, base + 38 - hop, 54, { color: '#f9a8d4' });
}

function drawTrampoline(ctx, cam, p, back) {
  const y0 = MAT_Y + cam * PX;
  if (y0 - 60 > H) return;
  const dip = p * 26;
  const { x, rx, ry } = MAT;
  if (back) {
    // Legs
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (const lx of [-rx + 12, -rx * 0.35, rx * 0.35, rx - 12]) {
      ctx.beginPath();
      ctx.moveTo(x + lx, y0 + 6);
      ctx.lineTo(x + lx * 1.06, y0 + 64);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y0 + 66, rx + 10, 10, 0, 0, TAU);
    ctx.fill();
    // Frame (back half)
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.ellipse(x, y0, rx + 16, ry + 8, 0, Math.PI, TAU);
    ctx.stroke();
    // Springs, stretched as the mat goes down
    const mrx = rx - p * 5;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const ox = x + Math.cos(a) * (rx + 14);
      const oy = y0 + Math.sin(a) * (ry + 7);
      const ix = x + Math.cos(a) * mrx;
      const iy = y0 + Math.sin(a) * ry + dip * (0.35 + 0.15 * Math.sin(a));
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const q = k / 6;
        const zx = lerp(ox, ix, q) + (k % 2 ? 2.5 : -2.5) * Math.sin(a + Math.PI / 2);
        const zy = lerp(oy, iy, q) + (k % 2 ? 2 : -2) * Math.cos(a);
        if (k === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(zx, zy);
      }
      ctx.stroke();
    }
    // The mat, pressed in the middle
    const g = ctx.createRadialGradient(x, y0 + dip * 0.6, 4, x, y0, rx);
    g.addColorStop(0, p > 0.05 ? '#db2777' : '#f472b6');
    g.addColorStop(0.55, '#f9a8d4');
    g.addColorStop(1, '#fbcfe8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - mrx, y0 + dip * 0.35);
    ctx.bezierCurveTo(x - mrx * 0.6, y0 - ry + dip * 0.5, x + mrx * 0.6, y0 - ry + dip * 0.5, x + mrx, y0 + dip * 0.35);
    ctx.bezierCurveTo(x + mrx * 0.6, y0 + ry + dip * 1.4, x - mrx * 0.6, y0 + ry + dip * 1.4, x - mrx, y0 + dip * 0.35);
    ctx.fill();
    // Jigglypuff curl on the mat
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x - 34, y0 - 2 + dip * 0.5, 9, 3.5, 0, 0.3, TAU * 0.85);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + 40, y0 - 6 + dip * 0.4, 16, 3, -0.1, 0, TAU);
    ctx.fill();
  } else {
    // Frame (front half) over the springs
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(x, y0, rx + 16, ry + 8, 0, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y0 - 2, rx + 16, ry + 8, 0, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
}

function drawTimingRing(ctx, s, cam, t) {
  // Two rings on the mat: the moving one meets the fixed one at the perfect moment
  if (s.status !== 'play' || s.dizzy) return;
  const ttl = s.phase === 'contact' ? -s.contactT : timeToLand(s);
  if (s.phase === 'air' && (s.vy > 0 || ttl > 0.7)) return;
  const until = ttl + CONTACT / 2;
  if (until < -0.08) return;
  const y0 = MAT_Y + cam * PX + press(s) * 12;
  const r = 34 + Math.max(0, until) * 150;
  const near = Math.abs(until) < 0.07;
  ctx.save();
  ctx.lineWidth = near ? 6 : 4;
  ctx.strokeStyle = near ? '#fde047' : 'rgba(255,255,255,0.95)';
  if (near) {
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 16;
  }
  ctx.beginPath();
  ctx.ellipse(MAT.x, y0, r, r * 0.22, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = `rgba(253,224,71,${0.6 + Math.sin(t * 12) * 0.3})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.ellipse(MAT.x, y0, 34, 34 * 0.22, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPlayer(ctx, s, v, img, cam, t) {
  const p = press(s);
  const feet = MAT_Y - (s.y - cam) * PX + p * 26 * 0.8;
  let sx = 1;
  let sy = 1;
  let rot = 0;
  let glow = 0;
  if (s.phase === 'contact') {
    sx = 1 + p * 0.28;
    sy = 1 - p * 0.24;
  } else {
    // Stretch with speed
    const st = Math.min(0.14, Math.abs(s.vy) / 300);
    sx = 1 - st;
    sy = 1 + st;
  }
  const tr = s.trick;
  if (tr) {
    const k = Math.min(1, tr.t / tr.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    if (tr.kind === 'flip') rot = e * TAU;
    else if (tr.kind === 'spin') sx *= Math.cos(e * TAU);
    else {
      const pop = Math.sin(k * Math.PI);
      sx *= 1 + pop * 0.35;
      sy *= 1 + pop * 0.35;
      rot = Math.sin(k * TAU * 2) * 0.15;
      glow = pop;
    }
  }
  if (s.wasDizzy && s.phase === 'air') rot += Math.sin(t * 9) * 0.25;
  const cy = feet - (SIZE / 2) * sy;
  // Shadow on the mat, smaller when high
  const y0 = MAT_Y + cam * PX;
  if (y0 < H + 20) {
    const k = Math.max(0.15, 1 - s.y / 18);
    ctx.fillStyle = `rgba(131,24,67,${0.3 * k})`;
    ctx.beginPath();
    ctx.ellipse(MAT.x, y0 + p * 14, 32 * k, 7 * k, 0, 0, TAU);
    ctx.fill();
  }
  if (glow > 0) {
    ctx.save();
    ctx.globalAlpha = glow * 0.9;
    const gg = ctx.createRadialGradient(MAT.x, cy, 4, MAT.x, cy, SIZE);
    gg.addColorStop(0, 'rgba(254,240,138,0.95)');
    gg.addColorStop(1, 'rgba(254,240,138,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(MAT.x, cy, SIZE, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    drawStarShape(ctx, MAT.x, cy, SIZE * 0.75 * glow, t * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(MAT.x, cy);
  ctx.rotate(rot);
  ctx.scale(sx, sy);
  drawSprite(ctx, img, 0, 0, SIZE);
  ctx.restore();
  if (tr && (v.ghostClock -= 1) <= 0) {
    // A sparkly trail while doing a trick
    v.ghostClock = 2;
    const color = tr.kind === 'flip' ? '#f9a8d4' : tr.kind === 'spin' ? '#7dd3fc' : '#fde047';
    v.particles.push({ x: MAT.x + (Math.random() - 0.5) * SIZE * 0.8, y: cy + (Math.random() - 0.5) * SIZE * 0.6, vx: (Math.random() - 0.5) * 40, vy: 20 + Math.random() * 40, life: 0.6, max: 0.6, size: 2 + Math.random() * 2.5, color, gravity: 30 });
    v.particles.push({ x: MAT.x + (Math.random() - 0.5) * SIZE * 0.8, y: cy + (Math.random() - 0.5) * SIZE * 0.6, vx: 0, vy: 30, life: 0.5, max: 0.5, size: 1.5, color: '#ffffff', gravity: 0 });
  }
  // Dizzy stars round the head
  if (s.wasDizzy && s.phase === 'air') {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * TAU) / 3;
      ctx.fillStyle = '#fde047';
      drawStarShape(ctx, MAT.x + Math.cos(a) * 30, cy - SIZE * 0.45 + Math.sin(a) * 8, 6, a);
      ctx.fill();
    }
  }
  return { cy };
}

function drawMeter(ctx, s, t) {
  const { x, top, bottom } = METER;
  const hy = (h) => bottom - (h / MAX_APEX) * (bottom - top);
  ctx.fillStyle = 'rgba(15,23,42,0.35)';
  ctx.beginPath();
  ctx.roundRect(x - 8, top - 8, 16, bottom - top + 16, 8);
  ctx.fill();
  const g = ctx.createLinearGradient(0, bottom, 0, top);
  g.addColorStop(0, '#4ade80');
  g.addColorStop(0.3, '#e0f2fe');
  g.addColorStop(0.55, '#fde047');
  g.addColorStop(0.8, '#a78bfa');
  g.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x - 4, top - 4, 8, bottom - top + 8, 4);
  ctx.fill();
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  LAYERS.forEach((l, i) => {
    const y = hy(l.from + 2);
    ctx.globalAlpha = layerAt(s.best) >= i ? 1 : 0.45;
    ctx.fillText(LAYER_ICONS[i], x - 20, y);
  });
  ctx.globalAlpha = 1;
  // Best height
  const by = hy(s.best);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 10, by);
  ctx.lineTo(x + 10, by);
  ctx.stroke();
  // Now
  const ny = hy(Math.max(0, s.y));
  ctx.fillStyle = '#f472b6';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, ny, 7 + Math.sin(t * 8) * 0.8, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

function drawFloats(ctx, v, dt) {
  for (let i = v.floats.length - 1; i >= 0; i--) {
    const f = v.floats[i];
    f.life -= dt;
    if (f.life <= 0) {
      v.floats.splice(i, 1);
      continue;
    }
    const k = 1 - f.life / f.max;
    const s = k < 0.15 ? 0.6 + k * 4 : 1.2 - Math.min(0.2, (k - 0.15) * 0.6);
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life * 3);
    ctx.font = `900 ${f.size}px system-ui, sans-serif`;
    // Keep the whole text on screen (left of the height meter)
    const half = (ctx.measureText(f.text).width * 1.2) / 2;
    const x = Math.min(METER.x - 22 - half, Math.max(8 + half, f.x));
    ctx.translate(x, f.y - k * 50);
    ctx.scale(s, s);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(30,27,75,0.85)';
    ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, 0, 0);
    if (f.sub) {
      ctx.font = '900 13px system-ui, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeText(f.sub, 0, 18);
      ctx.fillStyle = '#fef08a';
      ctx.fillText(f.sub, 0, 18);
    }
    ctx.restore();
  }
}

const snap = (s) => ({
  score: s.score,
  left: timeLeft(s),
  air: s.phase,
  contact: s.contactT,
  ttl: timeToLand(s),
  vy: s.vy,
  y: s.y,
  apex: s.apex,
  best: s.best,
  tricks: s.tricks,
  trick: s.trick?.kind || '',
  perfects: s.perfects,
  dizzies: s.dizzies,
  bounces: s.bounces,
  stars: trampolineStars(s),
  status: s.status,
});

const freshFx = () => ({ time: 0, cam: 0, particles: [], ghostClock: 0, floats: [], lastLayer: 0, cy: MAT_Y - SIZE / 2 });

/**
 * "Bạt nhún Jigglypuff": the child's Pokemon bounces on a trampoline. Tap when it presses the
 * mat to go higher; swipe ← → ↑ in the air for tricks, finished before landing. 60 seconds.
 */
export function TrampolineGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createTrampoline({ random }));
  const game = useRef(first);
  const fx = useRef(freshFx());
  const touch = useRef(null);
  const [ui, setUi] = useState(() => snap(first));
  const [banner, setBanner] = useState(null);
  const [layerBanner, setLayerBanner] = useState(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const later = useLater();
  const idRef = useRef(0);
  const img = loadImage(player.image);

  const say = (q) => {
    const id = ++idRef.current;
    setBanner({ ...QUALITY[q], id, q });
    later(() => setBanner((b) => (b?.id === id ? null : b)), 800);
  };

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    const t = v.time;
    if (phase === 'play') {
      stepTrampoline(s, dt);
      for (const e of s.events.splice(0)) {
        if (e.type === 'land') {
          sounds.playNote(e.dizzy ? 196 : 262, { duration: 0.16, volume: 0.16 });
          if (e.dizzy) say('dizzy');
        } else if (e.type === 'tap') {
          if (e.quality === 'early') {
            sounds.playOops();
            say('early');
          }
        } else if (e.type === 'bounce') {
          const q = e.quality;
          const y0 = MAT_Y + v.cam * PX;
          if (q === 'perfect') {
            sounds.playEnergySurge();
            sounds.playNote(1047, { duration: 0.2, volume: 0.2 });
            burst(v.particles, MAT.x, y0 - 6, { count: 30, colors: ['#fde047', '#f472b6', '#ffffff', '#38bdf8'], speed: 260, gravity: 300, size: 4 });
          } else if (q === 'good') {
            sounds.playNote(784, { duration: 0.18, volume: 0.2 });
            burst(v.particles, MAT.x, y0 - 6, { count: 16, colors: ['#bbf7d0', '#ffffff', '#f9a8d4'], speed: 170, gravity: 300, size: 3 });
          } else {
            sounds.playPop();
            if (q === 'late') sounds.playOops();
          }
          if (q !== 'dizzy' && (q !== 'none' || s.bounces <= 3 || s.bounces % 3 === 0)) say(q);
          if (e.points) v.floats.push({ text: `+${e.points}`, x: MAT.x + 70, y: y0 - 40, life: 0.9, max: 0.9, color: q === 'perfect' ? '#fde047' : '#bbf7d0', size: 20 });
          if (e.layer > v.lastLayer) {
            v.lastLayer = e.layer;
            const id = ++idRef.current;
            setLayerBanner({ id, text: `${LAYER_ICONS[e.layer]} ${LAYERS[e.layer].name}!` });
            later(() => setLayerBanner((b) => (b?.id === id ? null : b)), 1600);
            [659, 880, 1175].forEach((f, i) => sounds.playNote(f, { duration: 0.2, delay: 0.25 + i * 0.08, volume: 0.16 }));
          }
          if (e.apex > 9 && s.tricks === 0) setShowSwipeHint(true);
        } else if (e.type === 'apex') {
          if (e.h >= 20) sounds.playNote(1318 + e.h * 6, { duration: 0.1, volume: 0.08 });
        } else if (e.type === 'trick-start') {
          sounds.playWhoosh();
          setShowSwipeHint(false);
        } else if (e.type === 'trick') {
          sounds.playCoin();
          const scale = [784, 880, 988, 1175, 1318];
          sounds.playNote(scale[Math.min(4, e.combo - 1)], { duration: 0.18, volume: 0.18 });
          const color = e.kind === 'flip' ? '#f472b6' : e.kind === 'spin' ? '#38bdf8' : '#fde047';
          burst(v.particles, MAT.x, v.cy, { count: 18, colors: [color, '#ffffff', '#fde047'], speed: 200, gravity: 80, size: 3.5, life: 0.8 });
          v.side = -(v.side || 1);
          v.floats.push({ text: `${TRICKS[e.kind].name} +${e.points}`, x: MAT.x + v.side * 48, y: Math.max(96, v.cy - 64 - (e.combo - 1) * 10), life: 1.1, max: 1.1, color, size: 17, sub: e.combo >= 2 ? `COMBO x${e.combo}!` : null });
        } else if (e.type === 'dizzy') {
          sounds.playOops();
          burst(v.particles, MAT.x, v.cy, { count: 10, colors: ['#fde047', '#c4b5fd'], speed: 120, gravity: 100, size: 3 });
        } else if (e.type === 'end') {
          sounds.playWhoosh();
          later(() => setPhase('done'), 800);
        }
      }
      setUi(snap(s));
    }
    // Camera follows the Pokemon up (it stays below the top of the screen)
    const want = Math.max(0, s.y - (MAT_Y - 190) / PX);
    v.cam += (want - v.cam) * Math.min(1, dt * 7);
    const ctx = getCtx();
    if (!ctx) {
      updateParticles(null, v.particles, dt);
      v.floats = v.floats.filter((f) => (f.life -= dt) > 0);
      return;
    }
    ctx.clearRect(0, 0, W, H);
    drawSky(ctx, v.cam, t);
    drawPark(ctx, v.cam, t);
    const p = press(s);
    drawTrampoline(ctx, v.cam, p, true);
    drawTimingRing(ctx, s, v.cam, t);
    const out = drawPlayer(ctx, s, v, img, v.cam, t);
    v.cy = out.cy;
    drawTrampoline(ctx, v.cam, p, false);
    updateParticles(ctx, v.particles, dt);
    drawFloats(ctx, v, dt);
    drawMeter(ctx, s, t);
    // Height label
    ctx.fillStyle = 'rgba(15,23,42,0.45)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 86, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '900 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`↑ ${Math.max(0, s.y).toFixed(0)} m`, 18, 24);
  }, phase !== 'done');

  const act = (fn) => {
    if (phase !== 'play') return;
    fn(game.current);
    setUi(snap(game.current));
  };

  const onDown = (e) => {
    if (phase !== 'play' || !canvasRef.current) return;
    const p = canvasPoint(canvasRef.current, e, W, H);
    touch.current = { x: p.x, y: p.y, used: false };
    try {
      canvasRef.current.setPointerCapture?.(e.pointerId);
    } catch {
      // not supported
    }
    act(tapBounce);
  };
  const onMove = (e) => {
    const tc = touch.current;
    if (!tc || tc.used || phase !== 'play' || !canvasRef.current) return;
    const p = canvasPoint(canvasRef.current, e, W, H);
    const dx = p.x - tc.x;
    const dy = p.y - tc.y;
    if (Math.hypot(dx, dy) < SWIPE) return;
    tc.used = true;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : null;
    if (dir) act((s) => swipeTrick(s, dir));
  };
  const onUp = () => {
    touch.current = null;
  };

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up' };
      if (e.code === 'Space' || e.code === 'ArrowDown') {
        e.preventDefault();
        act(tapBounce);
      } else if (map[e.code]) {
        e.preventDefault();
        act((s) => swipeTrick(s, map[e.code]));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const replay = () => {
    game.current = createTrampoline({ random });
    fx.current = freshFx();
    setUi(snap(game.current));
    setBanner(null);
    setLayerBanner(null);
    setShowSwipeHint(false);
    setPhase('ready');
  };

  const left = Math.ceil(ui.left);
  const tones = { gold: 'bg-gradient-to-b from-yellow-200 to-amber-400 text-rose-700 text-4xl border-white', green: 'bg-emerald-400 text-white text-2xl border-emerald-100', soft: 'bg-white/90 text-slate-700 text-xl border-white', purple: 'bg-violet-500 text-white text-xl border-violet-200' };

  return (
    <CarnivalShell
      title="🤸 Bạt nhún Jigglypuff"
      label="Bạt nhún Jigglypuff"
      onClose={onClose}
      background="bg-gradient-to-b from-sky-400 via-pink-400 to-fuchsia-600"
      dataAttrs={{
        'data-phase': phase,
        'data-score': ui.score,
        'data-air': ui.air,
        'data-contact': ui.contact.toFixed(3),
        'data-ttl': ui.ttl.toFixed(3),
        'data-falling': ui.vy < 0 ? 'yes' : 'no',
        'data-apex': ui.apex.toFixed(1),
        'data-best': ui.best.toFixed(1),
        'data-tricks': ui.tricks,
        'data-trick': ui.trick,
        'data-perfects': ui.perfects,
      }}
      hud={
        <>
          <HudBar
            items={[
              { icon: '⭐', label: 'Điểm', value: ui.score, testId: 'trampoline-score' },
              { icon: '🏔️', label: 'Cao nhất', value: `${Math.round(ui.best)}m` },
              { icon: '⏱', label: 'Còn', value: `${left}s`, warn: left <= 10 && phase === 'play' },
            ]}
          />
          <div className="mt-1 h-2 rounded-full bg-black/30 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-pink-300 to-sky-300 transition-[width] duration-200" style={{ width: `${(ui.left / DURATION) * 100}%` }} />
          </div>
        </>
      }
    >
      <div className="relative flex-1 min-h-0 flex items-start justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="max-w-full max-h-full touch-none"
          style={{ aspectRatio: `${W} / ${H}`, height: '100%', width: 'auto' }}
          data-testid="trampoline-stage"
        />
        {banner && (
          <p key={banner.id} className={`trampoline-pop absolute left-1/2 top-[64%] whitespace-nowrap font-black px-4 py-1.5 rounded-2xl border-4 shadow-xl pointer-events-none ${tones[banner.tone]}`} data-testid="trampoline-banner" data-quality={banner.q}>
            {banner.text}
          </p>
        )}
        {layerBanner && (
          <p key={layerBanner.id} className="banner-slam absolute top-[8%] inset-x-8 text-center text-xl font-black px-3 py-2 rounded-2xl shadow-xl pointer-events-none bg-indigo-500/90 text-white">
            {layerBanner.text}
          </p>
        )}
        {showSwipeHint && phase === 'play' && (
          <div className="trampoline-hint absolute top-[20%] inset-x-0 flex flex-col items-center gap-1 pointer-events-none" data-testid="trampoline-swipe-hint">
            <p className="px-3 py-1 rounded-full bg-white/90 text-sm font-black text-fuchsia-700 shadow">Đang bay: vuốt để nhào lộn!</p>
            <div className="flex gap-3 text-2xl font-black text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]">
              <span className="trampoline-arrow-l">⬅️</span>
              <span className="trampoline-arrow-u">⬆️</span>
              <span className="trampoline-arrow-r">➡️</span>
            </div>
          </div>
        )}
        {phase === 'play' && ui.bounces < 2 && ui.air === 'air' && (
          <p className="absolute bottom-[3%] inset-x-6 text-center text-sm font-black px-3 py-1.5 rounded-2xl bg-white/85 text-pink-700 shadow pointer-events-none">Chạm khi 2 vòng tròn gặp nhau! 👆</p>
        )}
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} text="NHÚN NÀO!" />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Siêu sao nhào lộn! 🏆' : ui.stars === 2 ? 'Nhún giỏi quá! 🤸' : 'Lần sau bay cao hơn nhé! 💪'}
            stars={ui.stars}
            detail={`${ui.score} điểm · cao nhất ${Math.round(ui.best)} m · ${ui.tricks} lần nhào lộn · ${ui.perfects} lần TUYỆT`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
