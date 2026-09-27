import React, { useEffect, useRef, useState } from 'react';
import {
  CANDY_W as W,
  CANDY_H as H,
  DRUM,
  COLORS,
  CUSTOMERS,
  ARRIVE_TIME,
  MAX_FLUFF,
  createCandy,
  stepCandy,
  pickColor,
  spin,
  trace,
  traceEnd,
  serve,
  currentOrder,
  candyStars,
} from '../../utils/carnival/candy';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite, burst, updateParticles } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const TAU = Math.PI * 2;
const SUGAR = {
  pink: { name: 'hồng', base: '#f472b6', light: '#fbcfe8', dark: '#db2777' },
  blue: { name: 'xanh', base: '#60a5fa', light: '#dbeafe', dark: '#2563eb' },
  yellow: { name: 'vàng', base: '#facc15', light: '#fef9c3', dark: '#ca8a04' },
  purple: { name: 'tím', base: '#a78bfa', light: '#ede9fe', dark: '#7c3aed' },
};
const SIZE_NAME = { small: 'Nhỏ', medium: 'Vừa', big: 'To' };
const CUST = { x: 92, y: 150, size: 116 };
const MOUTH = { x: 100, y: 176 };
const BOWL = { x: 180, y: 384, rx: 142, ry: 34 };
const radiusFor = (fluff) => 14 + fluff * 82;
const orderText = (o) => `${o.colors.length === 2 ? `xoáy ${SUGAR[o.colors[0]].name}–${SUGAR[o.colors[1]].name}` : SUGAR[o.colors[0]].name}, cỡ ${SIZE_NAME[o.size].toLowerCase()}`;
const easeOut = (k) => 1 - (1 - k) ** 3;

// Awning, lights and counter, painted once
let sceneCache = null;
function scene() {
  if (sceneCache || typeof document === 'undefined') return sceneCache;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#fbcfe8');
  sky.addColorStop(0.45, '#e9d5ff');
  sky.addColorStop(1, '#c7d2fe');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Soft far tents
  for (let i = 0; i < 5; i++) {
    const x = 20 + i * 84;
    ctx.fillStyle = i % 2 ? 'rgba(244,114,182,0.25)' : 'rgba(129,140,248,0.25)';
    ctx.beginPath();
    ctx.moveTo(x - 40, 232);
    ctx.lineTo(x, 150);
    ctx.lineTo(x + 40, 232);
    ctx.fill();
  }
  // Back wall of the stall
  const wall = ctx.createLinearGradient(0, 60, 0, 230);
  wall.addColorStop(0, 'rgba(255,255,255,0.55)');
  wall.addColorStop(1, 'rgba(255,255,255,0.15)');
  ctx.fillStyle = wall;
  ctx.fillRect(8, 56, W - 16, 176);
  // Awning stripes with a scalloped edge
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#fdf2f8' : '#ec4899';
    ctx.fillRect(i * 30, 0, 30, 44);
    ctx.beginPath();
    ctx.arc(i * 30 + 15, 44, 15, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 38, W, 6);
  // Poles
  ctx.fillStyle = '#f9a8d4';
  ctx.fillRect(6, 44, 8, 200);
  ctx.fillRect(W - 14, 44, 8, 200);
  // Sign
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#db2777';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(W / 2 - 74, 60, 148, 26, 13);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#db2777';
  ctx.font = '900 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('KẸO BÔNG', W / 2, 74);
  // Counter
  const wood = ctx.createLinearGradient(0, 214, 0, 250);
  wood.addColorStop(0, '#fcd34d');
  wood.addColorStop(1, '#d97706');
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.roundRect(0, 214, W, 22, 6);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(0, 236, W, H - 236);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? '#f9a8d4' : '#fdf2f8';
    ctx.fillRect(i * 40, 236, 40, H - 236);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 236, W, 6);
  // Floor shine
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, H - 22, W, 22);
  sceneCache = c;
  return c;
}

function drawBulbs(ctx, t) {
  for (let i = 0; i < 13; i++) {
    const x = 6 + i * 29;
    const y = 50 + Math.sin((i / 12) * Math.PI) * 10;
    const on = (Math.sin(t * 4 + i * 1.3) + 1) / 2;
    ctx.fillStyle = `rgba(254,240,138,${0.25 + on * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ['#fde047', '#f9a8d4', '#a5f3fc', '#c4b5fd'][i % 4];
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, TAU);
    ctx.fill();
  }
}

/** A mini candy on a stick (the order bubble and the jars). */
function drawMiniCandy(ctx, x, y, r, colors, t) {
  ctx.strokeStyle = '#e7e5e4';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.6);
  ctx.lineTo(x, y + r + 16);
  ctx.stroke();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + t * 0.4;
    const c = SUGAR[colors[i % colors.length]];
    ctx.fillStyle = c.base;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.4, r * 0.55, 0, TAU);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function drawBubble(ctx, order, k, t) {
  // Order bubble: a picture (colour + size) for children who cannot read yet
  const s = easeOut(Math.min(1, k)) * (1 + Math.sin(Math.min(1, k) * Math.PI) * 0.12);
  if (s <= 0.01) return;
  ctx.save();
  ctx.translate(262, 140);
  ctx.scale(s, s);
  ctx.translate(0, Math.sin(t * 2) * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.roundRect(-84, -44, 172, 96, 22);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-88, -48, 172, 94, 22);
  ctx.fill();
  ctx.stroke();
  // Tail towards the customer
  ctx.beginPath();
  ctx.moveTo(-86, 4);
  ctx.lineTo(-106, 22);
  ctx.lineTo(-80, 20);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-88, 4);
  ctx.lineTo(-106, 22);
  ctx.lineTo(-82, 22);
  ctx.stroke();
  const r = order.size === 'small' ? 11 : order.size === 'medium' ? 16 : 21;
  drawMiniCandy(ctx, -46, -12 - (r - 16) * 0.3, r, order.colors, t);
  // Size choices, the ordered one lit
  const sizes = ['small', 'medium', 'big'];
  sizes.forEach((sz, i) => {
    const x = 6 + i * 26;
    const rr = 5 + i * 3.2;
    const on = sz === order.size;
    ctx.fillStyle = on ? SUGAR[order.colors[0]].base : '#e5e7eb';
    ctx.beginPath();
    ctx.arc(x, -6, rr, 0, TAU);
    ctx.fill();
    if (on) {
      ctx.strokeStyle = '#be185d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, -6, rr + 3 + Math.sin(t * 6) * 1, 0, TAU);
      ctx.stroke();
    }
  });
  ctx.fillStyle = '#9d174d';
  ctx.font = '900 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Cỡ ${SIZE_NAME[order.size]}`, 32, 22);
  if (order.colors.length === 2) {
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillStyle = '#7c3aed';
    ctx.fillText('2 màu xoáy', -46, 36);
  } else {
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillStyle = SUGAR[order.colors[0]].dark;
    ctx.fillText(`màu ${SUGAR[order.colors[0]].name}`, -46, 36);
  }
  ctx.restore();
}

function drawCustomer(ctx, c, t) {
  if (!c) return;
  const hop = c.hop > 0 ? Math.abs(Math.sin(c.hop * 10)) * 16 : 0;
  const shake = c.shake > 0 ? Math.sin(c.shake * 40) * 5 : 0;
  const walkBob = c.walking ? Math.abs(Math.sin(t * 12)) * 7 : Math.sin(t * 2.2) * 2;
  ctx.fillStyle = 'rgba(120,53,15,0.18)';
  ctx.beginPath();
  ctx.ellipse(c.x, 214, 38, 6, 0, 0, TAU);
  ctx.fill();
  const squash = c.munch > 0 ? 1 + Math.sin(c.munch * 30) * 0.05 : 1;
  ctx.save();
  ctx.translate(c.x + shake, CUST.y - walkBob - hop);
  ctx.scale(squash, 2 - squash);
  drawSprite(ctx, loadImage(artworkUrl(c.dex)), 0, 0, CUST.size, { flip: c.walking && c.dir < 0, rotate: c.walking ? Math.sin(t * 12) * 0.06 : 0, color: '#f9a8d4' });
  ctx.restore();
  // Grumpy puff cloud
  if (c.mood === 'grumpy' && c.react > 0) {
    const a = Math.min(1, c.react * 2);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#64748b';
    const x = c.x + 34;
    const y = CUST.y - 64 + Math.sin(t * 5) * 2;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, TAU);
    ctx.arc(x + 14, y - 4, 14, 0, TAU);
    ctx.arc(x + 28, y, 11, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 8);
    ctx.lineTo(x + 7, y + 18);
    ctx.lineTo(x + 15, y + 18);
    ctx.lineTo(x + 10, y + 28);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawMachine(ctx, t, v) {
  const { x, y, rx, ry } = BOWL;
  // Body
  const body = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  body.addColorStop(0, '#94a3b8');
  body.addColorStop(0.3, '#f1f5f9');
  body.addColorStop(0.55, '#cbd5e1');
  body.addColorStop(1, '#64748b');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(x - rx, y);
  ctx.lineTo(x - rx + 22, H - 8);
  ctx.lineTo(x + rx - 22, H - 8);
  ctx.lineTo(x + rx, y);
  ctx.fill();
  // Pink band with stars
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.moveTo(x - rx + 8, y + 28);
  ctx.lineTo(x + rx - 8, y + 28);
  ctx.lineTo(x + rx - 14, y + 48);
  ctx.lineTo(x - rx + 14, y + 48);
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const sx = x - 100 + i * 33;
    const tw = (Math.sin(t * 3 + i) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.5 + tw * 0.5})`;
    ctx.beginPath();
    for (let p = 0; p < 10; p++) {
      const rr = p % 2 ? 2.2 : 5;
      const a = (p / 10) * TAU - Math.PI / 2;
      ctx.lineTo(sx + Math.cos(a) * rr, y + 38 + Math.sin(a) * rr);
    }
    ctx.fill();
  }
  // Bowl opening
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  const inner = ctx.createRadialGradient(x, y + 6, 10, x, y, rx);
  inner.addColorStop(0, '#fdf2f8');
  inner.addColorStop(0.7, '#f5d0fe');
  inner.addColorStop(1, '#a78bfa');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.ellipse(x, y + 3, rx - 10, ry - 7, 0, 0, TAU);
  ctx.fill();
  // Wisps of sugar stuck to the bowl, turning
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + v.spinAngle;
    const c = SUGAR[COLORS[i % 4]];
    ctx.strokeStyle = `${c.base}55`;
    ctx.beginPath();
    ctx.ellipse(x, y + 3, (rx - 18) * (0.55 + (i % 3) * 0.15), (ry - 10) * (0.55 + (i % 3) * 0.15), 0, a, a + 0.9);
    ctx.stroke();
  }
  // Spinner head in the middle
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 26, 8, 0, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + v.spinAngle * 3;
    ctx.fillStyle = i % 2 ? '#f472b6' : '#e2e8f0';
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 18, y + 4 + Math.sin(a) * 5, 4, 2, 0, 0, TAU);
    ctx.fill();
  }
  // Rim shine
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
}

function drawThreads(ctx, v, dt, colors) {
  // Sugar threads spiral from the spinner up into the candy
  if (v.spinSpeed > 0.6 && colors.length) {
    v.threadClock -= dt * Math.min(40, v.spinSpeed * 6);
    while (v.threadClock <= 0) {
      v.threadClock += 1;
      v.threads.push({ a: Math.random() * TAU, life: 0.7, color: colors[v.threads.length % colors.length], w: 0.6 + Math.random() * 1.2 });
    }
  }
  for (let i = v.threads.length - 1; i >= 0; i--) {
    const th = v.threads[i];
    th.life -= dt;
    if (th.life <= 0) {
      v.threads.splice(i, 1);
      continue;
    }
    const k = 1 - th.life / 0.7;
    const R = v.radius;
    ctx.strokeStyle = SUGAR[th.color].base;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8;
    ctx.lineWidth = th.w;
    ctx.beginPath();
    for (let j = 0; j <= 14; j++) {
      const q = j / 14;
      const a = th.a + q * 3.2 + v.spinAngle;
      const rad = (BOWL.rx - 20) * (1 - q) + (R + 6) * q;
      const px = BOWL.x + Math.cos(a) * rad;
      const py = BOWL.y + (DRUM.y - BOWL.y) * q * k + Math.sin(a) * rad * (0.25 + q * 0.6);
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCandy(ctx, cx, cy, R, blobs, t, spinAngle, scale = 1) {
  if (!blobs.length && R <= 14) {
    // Just the stick top
    ctx.fillStyle = '#f5f5f4';
    ctx.beginPath();
    ctx.arc(cx, cy, 5 * scale, 0, TAU);
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  // Soft glow
  const glow = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.35);
  glow.addColorStop(0, 'rgba(255,255,255,0.35)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.35, 0, TAU);
  ctx.fill();
  const rot = spinAngle * 0.25;
  for (const b of blobs) {
    const a = b.a + rot;
    const d = b.r0 * 0.62;
    const bx = Math.cos(a) * d;
    const by = Math.sin(a) * d * 0.9;
    const br = b.r0 * 0.5 + 6 + Math.sin(t * 2 + b.wob) * 0.8;
    const c = SUGAR[b.color];
    const g = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.35, br * 0.1, bx, by, br);
    g.addColorStop(0, c.light);
    g.addColorStop(0.65, c.base);
    g.addColorStop(1, `${c.base}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, TAU);
    ctx.fill();
  }
  // Fluffy highlight and sugar sparkles
  const hl = ctx.createRadialGradient(-R * 0.35, -R * 0.4, 1, -R * 0.2, -R * 0.2, R * 0.9);
  hl.addColorStop(0, 'rgba(255,255,255,0.55)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();
  const n = Math.min(14, 3 + Math.floor(R / 8));
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + rot * 2;
    const d = R * (0.2 + ((i * 37) % 70) / 100);
    const tw = Math.max(0, Math.sin(t * 4 + i * 1.7));
    if (tw < 0.2) continue;
    const sx = Math.cos(a) * d;
    const sy = Math.sin(a) * d;
    ctx.fillStyle = `rgba(255,255,255,${tw})`;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 4 * tw);
    ctx.lineTo(sx + 1.2, sy - 1.2);
    ctx.lineTo(sx + 4 * tw, sy);
    ctx.lineTo(sx + 1.2, sy + 1.2);
    ctx.lineTo(sx, sy + 4 * tw);
    ctx.lineTo(sx - 1.2, sy + 1.2);
    ctx.lineTo(sx - 4 * tw, sy);
    ctx.lineTo(sx - 1.2, sy - 1.2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTarget(ctx, order, fluff, t) {
  const R = radiusFor(order.target);
  const d = fluff - order.target;
  const near = Math.abs(d) <= 0.08;
  const over = d > 0.08;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -t * 30;
  ctx.lineWidth = near ? 5 : 3.5;
  ctx.strokeStyle = near ? '#22c55e' : over ? '#f97316' : 'rgba(255,255,255,0.95)';
  if (near) {
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 14 + Math.sin(t * 10) * 6;
  }
  ctx.beginPath();
  ctx.arc(DRUM.x, DRUM.y, R, 0, TAU);
  ctx.stroke();
  ctx.restore();
  // Little flag on top of the ring
  const fx = DRUM.x + R * 0.72;
  const fy = DRUM.y - R * 0.72;
  ctx.fillStyle = near ? '#16a34a' : over ? '#ea580c' : '#be185d';
  ctx.beginPath();
  ctx.roundRect(fx - 4, fy - 24, near ? 64 : over ? 58 : 44, 22, 11);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '900 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(near ? 'Vừa đẹp!' : over ? 'To quá!' : SIZE_NAME[order.size], fx + 5, fy - 13);
}

function drawHintCircle(ctx, t, needColor) {
  if (needColor) {
    // Arrow down to the jars
    const b = Math.abs(Math.sin(t * 4)) * 10;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#db2777';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(DRUM.x - 70, DRUM.y - 16, 140, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#db2777';
    ctx.font = '900 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Chọn màu đường 👇', DRUM.x, DRUM.y);
    ctx.fillStyle = '#db2777';
    ctx.beginPath();
    ctx.moveTo(DRUM.x - 12, H - 36 + b);
    ctx.lineTo(DRUM.x + 12, H - 36 + b);
    ctx.lineTo(DRUM.x, H - 18 + b);
    ctx.fill();
    return;
  }
  // A finger going round
  const a = t * 3.2;
  ctx.save();
  ctx.setLineDash([4, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(DRUM.x, DRUM.y, 78, 0, TAU);
  ctx.stroke();
  ctx.restore();
  // Arrow heads on the circle
  for (let i = 0; i < 3; i++) {
    const aa = a + (i * TAU) / 3;
    const px = DRUM.x + Math.cos(aa) * 78;
    const py = DRUM.y + Math.sin(aa) * 78;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(aa + Math.PI / 2);
    ctx.fillStyle = i === 0 ? '#db2777' : 'rgba(219,39,119,0.45)';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-6, 7);
    ctx.fill();
    ctx.restore();
  }
  ctx.font = '34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('👆', DRUM.x + Math.cos(a) * 78 + 6, DRUM.y + Math.sin(a) * 78 + 16);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(DRUM.x - 62, DRUM.y + 96 - 14, 124, 28, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7c3aed';
  ctx.font = '900 13px system-ui, sans-serif';
  ctx.fillText('Vẽ vòng tròn nào!', DRUM.x, DRUM.y + 96);
}

function drawTrail(ctx, v, dt) {
  for (let i = v.trail.length - 1; i >= 0; i--) {
    v.trail[i].life -= dt;
    if (v.trail[i].life <= 0) v.trail.splice(i, 1);
  }
  if (v.trail.length < 2) return;
  ctx.lineCap = 'round';
  for (let i = 1; i < v.trail.length; i++) {
    const p = v.trail[i];
    const q = v.trail[i - 1];
    if (p.stroke !== q.stroke) continue;
    const k = p.life / 0.45;
    ctx.strokeStyle = SUGAR[p.color]?.base || '#ffffff';
    ctx.globalAlpha = k * 0.9;
    ctx.lineWidth = 7 * k + 2;
    ctx.beginPath();
    ctx.moveTo(q.x, q.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = k * 0.7;
    ctx.lineWidth = 3 * k + 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCoins(ctx, v, dt) {
  for (let i = v.coins.length - 1; i >= 0; i--) {
    const c = v.coins[i];
    c.t += dt;
    if (c.t < 0) continue;
    const k = Math.min(1, c.t / c.dur);
    if (k >= 1) {
      v.coins.splice(i, 1);
      v.arrived += 1;
      continue;
    }
    const e = k * k * (3 - 2 * k);
    const x = c.x + (c.tx - c.x) * e;
    const y = c.y + (c.ty - c.y) * e - Math.sin(k * Math.PI) * c.arc;
    const w = Math.abs(Math.cos(c.t * 14));
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 9 * w + 1, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(x, y, 8 * w + 1, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.ellipse(x - 2 * w, y - 2, 2.5 * w + 0.5, 2.5, 0, 0, TAU);
    ctx.fill();
  }
}

function drawHearts(ctx, v, dt) {
  for (let i = v.hearts.length - 1; i >= 0; i--) {
    const h = v.hearts[i];
    h.life -= dt;
    if (h.life <= 0) {
      v.hearts.splice(i, 1);
      continue;
    }
    h.y -= 50 * dt;
    const k = h.life / h.max;
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.fillStyle = h.color;
    const s = h.size * (1.2 - k * 0.2);
    const x = h.x + Math.sin(h.life * 6 + h.phase) * 8;
    ctx.beginPath();
    ctx.moveTo(x, h.y + s * 0.35);
    ctx.bezierCurveTo(x - s, h.y - s * 0.4, x - s * 0.4, h.y - s, x, h.y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.4, h.y - s, x + s, h.y - s * 0.4, x, h.y + s * 0.35);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function Jar({ color, selected, order, onPick }) {
  const c = SUGAR[color];
  const idx = selected.indexOf(color);
  const on = idx >= 0;
  return (
    <button
      type="button"
      onClick={() => onPick(color)}
      aria-label={`Đường màu ${c.name}`}
      aria-pressed={on}
      data-testid={`candy-jar-${color}`}
      className={`candy-jar relative flex-1 min-w-0 max-w-[76px] aspect-[4/5] rounded-2xl transition-transform active:scale-90 ${on ? 'candy-jar-on -translate-y-1.5' : ''}`}
    >
      <svg viewBox="0 0 60 74" className="w-full h-full overflow-visible" aria-hidden="true">
        {on && <ellipse cx="30" cy="42" rx="31" ry="34" fill={c.light} opacity="0.9" />}
        <rect x="12" y="4" width="36" height="10" rx="4" fill={c.dark} />
        <rect x="14" y="2" width="32" height="6" rx="3" fill={c.base} />
        <path d="M10 16h40a4 4 0 0 1 4 4v40a10 10 0 0 1-10 10H16A10 10 0 0 1 6 60V20a4 4 0 0 1 4-4z" fill="rgba(255,255,255,0.75)" stroke={on ? c.dark : '#cbd5e1'} strokeWidth={on ? 3.5 : 2} />
        <path d="M9 34c6-4 12 3 21 0s15-4 21 0v26a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8z" fill={c.base} />
        <circle cx="20" cy="46" r="2" fill="#fff" opacity="0.8" />
        <circle cx="36" cy="54" r="1.6" fill="#fff" opacity="0.8" />
        <circle cx="42" cy="42" r="1.3" fill="#fff" opacity="0.8" />
        <path d="M14 22v30" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      </svg>
      {on && (
        <span className="absolute -top-2 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white text-sm font-black flex items-center justify-center shadow pop-in">
          {selected.length === 2 ? idx + 1 : '✓'}
        </span>
      )}
      {order && order.colors.includes(color) && !on && <span className="candy-want absolute -bottom-1 left-1/2 w-2.5 h-2.5 rounded-full bg-white shadow" />}
    </button>
  );
}

const snap = (s) => {
  const o = currentOrder(s);
  return {
    stage: s.stage,
    index: s.index,
    order: o,
    selected: [...s.selected],
    fluff: s.fluff,
    score: s.score,
    coins: s.coins,
    results: s.results.length,
    hearts: s.results.reduce((t, r) => t + r.hearts, 0),
    happy: s.results.filter((r) => r.mood === 'happy').length,
    stars: candyStars(s),
    status: s.status,
  };
};

const freshFx = () => ({
  time: 0,
  particles: [],
  blobs: [],
  threads: [],
  threadClock: 0,
  trail: [],
  stroke: 0,
  coins: [],
  arrived: 0,
  hearts: [],
  spinAngle: 0,
  spinSpeed: 0,
  radius: 14,
  bubble: 0,
  flying: null,
  customer: null,
  leaving: null,
  cheer: 0,
});

/**
 * "Tiệm kẹo bông": Pokemon customers order cotton candy (a colour or a two-colour swirl, and a
 * size). Pick the sugar, draw circles round the drum to wrap it, stop at the size ring, "Xong".
 */
export function CottonCandyGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createCandy({ random, playerName: player?.name }));
  const game = useRef(first);
  const fx = useRef(freshFx());
  const down = useRef(false);
  const [ui, setUi] = useState(() => snap(first));
  const [react, setReact] = useState(null);
  const [banner, setBanner] = useState(null);
  const [coinBump, setCoinBump] = useState(0);
  const later = useLater();
  const idRef = useRef(0);
  const img = loadImage(player.image);

  const say = (text, tone, ms = 1300) => {
    const id = ++idRef.current;
    setBanner({ text, tone, id });
    later(() => setBanner((b) => (b?.id === id ? null : b)), ms);
  };

  const onEvent = (e, s, v) => {
    if (e.type === 'arrive') {
      if (v.customer) v.leaving = { ...v.customer, walking: true, dir: -1, hop: 0, shake: 0, react: 0 };
      v.customer = { dex: e.order.dex, x: W + 70, walking: true, dir: -1, t: 0, hop: 0, shake: 0, react: 0, mood: null, munch: 0 };
      v.blobs = [];
      v.bubble = 0;
      v.radius = 14;
      if (e.index > 0) sounds.playWhoosh();
      sounds.playNote(660, { duration: 0.12, delay: 0.3, volume: 0.14 });
    } else if (e.type === 'order') {
      sounds.playPop();
      sounds.playNote(880, { duration: 0.14, delay: 0.06, volume: 0.16 });
    } else if (e.type === 'color') {
      sounds.playNote(e.selected.length === 2 ? 988 : 784, { duration: 0.12, volume: 0.18 });
    } else if (e.type === 'need-color') {
      if (!v.needSaid) {
        v.needSaid = true;
        sounds.playOops();
        say('Chọn màu đường trước nhé! 🍬', 'soft');
        later(() => {
          fx.current.needSaid = false;
        }, 1500);
      }
    } else if (e.type === 'turn') {
      // A rising little tune as the candy grows
      const scale = [523, 587, 659, 698, 784, 880, 988, 1047];
      sounds.playNote(scale[Math.min(scale.length - 1, e.turns - 1)], { duration: 0.12, volume: 0.13 });
      burst(v.particles, DRUM.x, DRUM.y - v.radius, { count: 6, colors: ['#ffffff', '#fde68a', ...s.selected.map((c) => SUGAR[c].light)], speed: 90, gravity: 60, size: 2.5, life: 0.6 });
    } else if (e.type === 'near-size') {
      sounds.playNote(1318, { duration: 0.18, volume: 0.2 });
      burst(v.particles, DRUM.x, DRUM.y, { count: 16, colors: ['#4ade80', '#bbf7d0', '#ffffff'], speed: 160, gravity: 40, size: 3, life: 0.7 });
    } else if (e.type === 'full') {
      if (!v.fullSaid) {
        v.fullSaid = true;
        sounds.playOops();
        say('Que đầy kẹo rồi! Bấm “Xong” nhé', 'soft');
      }
    } else if (e.type === 'serve') {
      v.flying = { t: 0, blobs: v.blobs, R: v.radius };
      v.blobs = [];
      v.radius = 14;
      v.fullSaid = false;
      sounds.playWhoosh();
      const c = v.customer;
      const happy = e.mood === 'happy';
      later(() => {
        const cu = fx.current.customer;
        if (!cu) return;
        sounds.playMunch();
        cu.munch = 0.5;
        burst(fx.current.particles, MOUTH.x, MOUTH.y, { count: 14, colors: e.layers.flatMap((l) => l.colors.map((k) => SUGAR[k].base)).concat('#ffffff'), speed: 130, gravity: 200, size: 3.5 });
      }, 480);
      later(() => {
        const cu = fx.current.customer;
        if (!cu) return;
        cu.mood = e.mood;
        cu.react = 1.6;
        if (happy) {
          cu.hop = 0.9;
          fx.current.cheer = 1.2;
          [659, 784, 988, 1318].forEach((f, i) => sounds.playNote(f, { duration: 0.2, delay: i * 0.08, volume: 0.2 }));
          for (let i = 0; i < 4 + e.hearts * 2; i++) fx.current.hearts.push({ x: MOUTH.x - 30 + Math.random() * 60, y: CUST.y - 20 + Math.random() * 30, life: 1.4 + Math.random() * 0.5, max: 1.8, size: 8 + Math.random() * 7, color: ['#f43f5e', '#fb7185', '#f472b6'][i % 3], phase: i });
          burst(fx.current.particles, c.x, CUST.y - 30, { count: 26, colors: ['#fde047', '#f472b6', '#a78bfa', '#ffffff'], speed: 220, gravity: 260, size: 4 });
        } else {
          cu.shake = 0.6;
          sounds.playOops();
        }
        // Coins fly to the counter at the top
        const n = Math.min(10, 2 + Math.round(e.coins / 14));
        for (let i = 0; i < n; i++) fx.current.coins.push({ x: c.x + (Math.random() * 30 - 15), y: CUST.y - 10, tx: W - 24, ty: 10, t: -i * 0.07, dur: 0.7, arc: 40 + Math.random() * 40 });
        later(() => {
          sounds.playCoin();
          setCoinBump((b) => b + 1);
        }, 700);
        const id = ++idRef.current;
        const line = e.hearts === 3 ? 'Tuyệt vời! Đúng y như mình muốn!' : e.hearts === 2 ? 'Ngon quá! Cảm ơn nha!' : e.color < 0.5 ? 'Ơ… sai màu rồi!' : e.fit === 'big' ? 'Hơi to quá…' : e.fit === 'small' ? 'Nhỏ xíu à…' : 'Cũng được…';
        setReact({ id, hearts: e.hearts, mood: e.mood, text: line, coins: e.coins, tip: e.tip });
        later(() => setReact((r) => (r?.id === id ? null : r)), 1750);
      }, 820);
    } else if (e.type === 'empty') {
      sounds.playOops();
      say('Chưa có kẹo! Vẽ vòng tròn quanh máy nhé 🌀', 'soft');
    } else if (e.type === 'end') {
      later(() => setPhase('done'), 500);
    }
  };

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    const t = v.time;
    if (phase === 'play') {
      stepCandy(s, dt);
      for (const e of s.events.splice(0)) onEvent(e, s, v);
      setUi(snap(s));
    }
    // Candy blobs keep up with the fluff (two per step, in the colour being spun)
    const want = s.stage === 'make' ? Math.floor(s.fluff / 0.012) * 2 : 0;
    while (v.blobs.length < want && s.layers.length) {
      const top = s.layers[s.layers.length - 1];
      const i = v.blobs.length;
      const r0 = radiusFor((i / 2) * 0.012);
      v.blobs.push({ a: i * 2.39996 + Math.random() * 0.5, r0, color: top.colors[Math.floor(i / 2) % top.colors.length], wob: Math.random() * 6 });
    }
    v.radius += (radiusFor(s.stage === 'make' ? s.fluff : 0) - v.radius) * Math.min(1, dt * 10);
    v.spinSpeed += (s.spinSpeed - v.spinSpeed) * Math.min(1, dt * 8);
    v.spinAngle += (0.8 + v.spinSpeed) * dt;
    v.cheer = Math.max(0, v.cheer - dt);
    // Customers walk in / out
    const c = v.customer;
    if (c) {
      c.t += dt;
      if (s.stage === 'arrive' && s.orders[s.index]?.dex === c.dex) {
        const k = Math.min(1, s.stageT / (ARRIVE_TIME * 0.85));
        c.x = W + 70 + (CUST.x - W - 70) * easeOut(k);
        c.walking = k < 1;
      } else c.walking = false;
      c.hop = Math.max(0, c.hop - dt);
      c.shake = Math.max(0, c.shake - dt);
      c.react = Math.max(0, c.react - dt);
      c.munch = Math.max(0, c.munch - dt);
      v.bubble = s.stage === 'make' ? Math.min(1, v.bubble + dt * 3) : Math.max(0, v.bubble - dt * 4);
    }
    const l = v.leaving;
    if (l) {
      l.x -= 260 * dt;
      if (l.x < -90) v.leaving = null;
    }
    if (v.flying) {
      v.flying.t += dt;
      if (v.flying.t > 0.5) v.flying = null;
    }
    const ctx = getCtx();
    if (!ctx) {
      updateParticles(null, v.particles, dt);
      v.trail = v.trail.filter((p) => (p.life -= dt) > 0);
      v.coins = v.coins.filter((q) => (q.t += dt) < q.dur);
      v.hearts = v.hearts.filter((h) => (h.life -= dt) > 0);
      v.threads = [];
      return;
    }
    ctx.clearRect(0, 0, W, H);
    const bg = scene();
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else {
      ctx.fillStyle = '#fbcfe8';
      ctx.fillRect(0, 0, W, H);
    }
    drawBulbs(ctx, t);
    // Customers behind the counter (only the top half shows over it)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, 222);
    ctx.clip();
    drawCustomer(ctx, v.leaving, t);
    drawCustomer(ctx, c, t);
    ctx.restore();
    if (c && s.stage !== 'done') drawBubble(ctx, currentOrder(s), v.bubble, t);
    // The child's Pokemon, the candy maker, beside the machine
    const hop = v.cheer > 0 ? Math.abs(Math.sin(v.cheer * 10)) * 14 : Math.abs(Math.sin(t * 3)) * (v.spinSpeed > 1 ? 4 : 1);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(40, H - 16, 30, 6, 0, 0, TAU);
    ctx.fill();
    drawSprite(ctx, img, 42, H - 56 - hop, 82, { rotate: v.spinSpeed > 1 ? Math.sin(t * 10) * 0.08 : 0 });
    drawMachine(ctx, t, v);
    // Stick from the spinner
    ctx.strokeStyle = '#fafaf9';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(DRUM.x, BOWL.y + 4);
    ctx.lineTo(DRUM.x, DRUM.y);
    ctx.stroke();
    drawThreads(ctx, v, dt, s.stage === 'make' ? s.selected : []);
    drawCandy(ctx, DRUM.x, DRUM.y, v.radius, v.blobs, t, v.spinAngle);
    if (s.stage === 'make' && phase === 'play') {
      drawTarget(ctx, currentOrder(s), s.fluff, t);
      if (s.fluff === 0) drawHintCircle(ctx, t, s.selected.length === 0);
    }
    if (v.flying) {
      const k = easeOut(Math.min(1, v.flying.t / 0.5));
      const x = DRUM.x + (MOUTH.x - DRUM.x) * k;
      const y = DRUM.y + (MOUTH.y - DRUM.y) * k - Math.sin(k * Math.PI) * 60;
      drawCandy(ctx, x, y, v.flying.R, v.flying.blobs, t, v.spinAngle, 1 - k * 0.55);
    }
    drawTrail(ctx, v, dt);
    drawHearts(ctx, v, dt);
    updateParticles(ctx, v.particles, dt);
    drawCoins(ctx, v, dt);
    if (s.fluff >= MAX_FLUFF && s.stage === 'make') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '900 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Đầy que rồi!', DRUM.x, DRUM.y + v.radius + 16);
    }
  }, phase !== 'done');

  const point = (e) => canvasPoint(canvasRef.current, e, W, H);
  const onDown = (e) => {
    if (phase !== 'play' || !canvasRef.current) return;
    down.current = true;
    fx.current.stroke += 1;
    try {
      canvasRef.current.setPointerCapture?.(e.pointerId);
    } catch {
      // not supported
    }
    const p = point(e);
    traceEnd(game.current);
    trace(game.current, p.x, p.y);
  };
  const onMove = (e) => {
    if (!down.current || phase !== 'play' || !canvasRef.current) return;
    const p = point(e);
    const s = game.current;
    trace(s, p.x, p.y);
    if (s.stage === 'make') {
      const v = fx.current;
      v.trailN = (v.trailN || 0) + 1;
      v.trail.push({ x: p.x, y: p.y, life: 0.45, color: s.selected[Math.floor(v.trailN / 5) % Math.max(1, s.selected.length)] || null, stroke: v.stroke });
    }
    if (fx.current.trail.length > 40) fx.current.trail.shift();
  };
  const onUp = () => {
    down.current = false;
    traceEnd(game.current);
  };

  const onPick = (color) => {
    if (phase !== 'play') return;
    pickColor(game.current, color);
    for (const e of game.current.events.splice(0)) onEvent(e, game.current, fx.current);
    setUi(snap(game.current));
  };
  const onServe = () => {
    if (phase !== 'play') return;
    serve(game.current);
    for (const e of game.current.events.splice(0)) onEvent(e, game.current, fx.current);
    setUi(snap(game.current));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (phase !== 'play') return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) onPick(COLORS[n - 1]);
      else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
        e.preventDefault();
        spin(game.current, 0.7);
      } else if (e.code === 'Enter') {
        e.preventDefault();
        onServe();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const replay = () => {
    game.current = createCandy({ random, playerName: player?.name });
    fx.current = freshFx();
    setUi(snap(game.current));
    setReact(null);
    setBanner(null);
    setPhase('ready');
  };

  const making = ui.stage === 'make' && phase === 'play';
  const o = ui.order;

  return (
    <CarnivalShell
      title="🍭 Tiệm kẹo bông"
      label="Tiệm kẹo bông"
      onClose={onClose}
      background="bg-gradient-to-b from-pink-400 via-fuchsia-500 to-violet-700"
      dataAttrs={{
        'data-phase': phase,
        'data-stage': ui.stage,
        'data-customer': ui.index,
        'data-score': ui.score,
        'data-order': o.colors.join('+'),
        'data-target': o.target,
        'data-fluff': ui.fluff.toFixed(3),
        'data-served': ui.results,
      }}
      hud={
        <HudBar
          items={[
            { icon: '🧁', label: 'Khách', value: `${Math.min(ui.index + 1, CUSTOMERS)}/${CUSTOMERS}` },
            { icon: '💰', label: 'Xu', value: <span key={coinBump} className="score-bump inline-block">{ui.coins}</span>, testId: 'candy-score' },
            { icon: '❤️', label: 'Tim', value: ui.hearts },
          ]}
        />
      }
    >
      <div className="relative flex-1 min-h-0 flex flex-col items-center overflow-hidden">
        <div className="relative flex-1 min-h-0 w-full flex items-start justify-center">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={onUp}
            className="max-w-full max-h-full touch-none"
            style={{ aspectRatio: `${W} / ${H}`, height: '100%', width: 'auto' }}
            data-testid="candy-stage"
            aria-label={making ? `Khách muốn kẹo ${orderText(o)}` : 'Tiệm kẹo bông'}
          />
          {banner && (
            <p key={banner.id} className="banner-slam absolute top-[40%] inset-x-6 text-center text-base font-black px-3 py-2 rounded-2xl shadow-xl pointer-events-none bg-white/95 text-pink-700">
              {banner.text}
            </p>
          )}
          {react && (
            <div key={react.id} className={`candy-react absolute left-1/2 top-[46%] w-60 max-w-[86%] rounded-3xl border-4 px-3 py-2 text-center shadow-2xl pointer-events-none ${react.mood === 'happy' ? 'bg-gradient-to-b from-white to-pink-100 border-pink-400' : 'bg-gradient-to-b from-white to-slate-100 border-slate-400'}`} data-testid="candy-react" data-mood={react.mood}>
              <p className="text-2xl leading-none tracking-wider">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`inline-block ${i < react.hearts ? 'candy-heart' : 'opacity-25 grayscale'}`} style={{ animationDelay: `${i * 110}ms` }}>
                    ❤️
                  </span>
                ))}
              </p>
              <p className={`mt-1 text-base font-black ${react.mood === 'happy' ? 'text-pink-600' : 'text-slate-600'}`}>{react.text}</p>
              <p className="text-lg font-black text-amber-600">
                +{react.coins} xu{react.tip > 0 ? <span className="text-xs text-emerald-600"> (thưởng nhanh +{react.tip})</span> : null}
              </p>
            </div>
          )}
        </div>
        <div className="relative z-10 w-full flex-none px-3 pb-3 pt-1">
          <div className="flex items-end justify-center gap-2 rounded-3xl bg-white/25 backdrop-blur px-2 pt-2 pb-2 shadow-inner">
            {COLORS.map((c) => (
              <Jar key={c} color={c} selected={ui.selected} order={making ? o : null} onPick={onPick} />
            ))}
            <button
              type="button"
              onClick={onServe}
              disabled={!making || ui.fluff < 0.08}
              data-testid="candy-serve"
              className={`flex-none w-[76px] self-stretch rounded-2xl text-white text-lg font-black shadow-lg transition-all active:scale-90 disabled:opacity-45 disabled:saturate-50 ${making && Math.abs(ui.fluff - o.target) <= 0.08 ? 'bg-emerald-500 candy-ready' : 'bg-fuchsia-600'}`}
            >
              Xong
              <span className="block text-xl leading-none">🍭</span>
            </button>
          </div>
        </div>
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} text="MỞ HÀNG!" />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Thợ kẹo bông tài ba! 🏆' : ui.stars === 2 ? 'Kẹo ngon lắm! 🍭' : 'Lần sau khách sẽ thích hơn! 💪'}
            stars={ui.stars}
            detail={`${ui.coins} xu · ${ui.happy}/${CUSTOMERS} khách vui · ${ui.hearts} ❤️`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
