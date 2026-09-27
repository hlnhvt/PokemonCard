import React, { useEffect, useRef, useState } from 'react';
import {
  VIEW_W as W,
  VIEW_H as H,
  WORLD_H,
  RIDES,
  TARGETS,
  COVERS,
  HINT_COST,
  createFerris,
  stepFerris,
  tapView,
  askHint,
  cameraY,
  wheelAngle,
  rideLeft,
  targetsLeft,
  ferrisStars,
} from '../../utils/carnival/ferris';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { Lightbulb } from '../icons/PokeIcons';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite, burst, updateParticles } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const TAU = Math.PI * 2;
const HUB = { x: 86, y: 300 };
const WHEEL_R = 94;
const CABINS = 8;
const RIDE_NAMES = ['Buổi sáng ☀️', 'Hoàng hôn 🌇', 'Ban đêm 🌙'];

// Colours for each ride's time of day
const PALETTE = {
  day: { skyTop: '#38bdf8', skyLow: '#e0f2fe', cloud: '#ffffff', cloudShade: '#dbeafe', grass: ['#86efac', '#22c55e'], water: ['#67e8f9', '#0891b2'], tint: null, city: ['#fecaca', '#fde68a', '#bfdbfe', '#ddd6fe', '#bbf7d0'], window: '#e0f2fe' },
  sunset: { skyTop: '#7c3aed', skyLow: '#fdba74', cloud: '#fed7aa', cloudShade: '#f9a8d4', grass: ['#a3e635', '#15803d'], water: ['#fdba74', '#be185d'], tint: 'rgba(249,115,22,0.10)', city: ['#fda4af', '#fcd34d', '#c4b5fd', '#f9a8d4', '#fdba74'], window: '#fef08a' },
  night: { skyTop: '#020617', skyLow: '#312e81', cloud: '#94a3b8', cloudShade: '#64748b', grass: ['#166534', '#052e16'], water: ['#1e3a8a', '#0c1e4a'], tint: 'rgba(15,23,42,0.30)', city: ['#475569', '#334155', '#3f3f76', '#4c1d95', '#1e3a8a'], window: '#fde047' },
};

let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const STARS = Array.from({ length: 90 }, () => ({ x: rnd() * W, y: rnd() * 900, r: 0.5 + rnd() * 1.4, ph: rnd() * 6 }));
const DRIFT = Array.from({ length: 7 }, (_, i) => ({ x: rnd() * W, y: 40 + i * 70 + rnd() * 30, s: 0.5 + rnd() * 0.5, v: 5 + rnd() * 6 }));
// Background buildings for the rooftops band (not hiding places)
const BUILDINGS = Array.from({ length: 16 }, (_, i) => ({ x: (i % 8) * 50 + (i >= 8 ? 25 : 0) - 10, base: i >= 8 ? 980 : 760, w: 40 + rnd() * 16, h: 70 + rnd() * 90, c: i % 5 }));

// Sky, city, park, fairground: painted once per time of day
const worldCache = {};
function world(sky) {
  if (worldCache[sky] || typeof document === 'undefined') return worldCache[sky] || null;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = WORLD_H * 2;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  const p = PALETTE[sky];
  const g = ctx.createLinearGradient(0, 0, 0, 1000);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(1, p.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 1000);
  // Far skyline
  for (const b of BUILDINGS) {
    ctx.fillStyle = p.city[b.c];
    ctx.globalAlpha = b.base > 900 ? 1 : 0.8;
    ctx.fillRect(b.x, b.base - b.h, b.w, b.h + 40);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(b.x + b.w - 6, b.base - b.h, 6, b.h + 40);
    ctx.globalAlpha = 1;
    for (let wy = b.base - b.h + 10; wy < b.base + 20; wy += 16) {
      for (let wx = b.x + 6; wx < b.x + b.w - 10; wx += 12) {
        ctx.fillStyle = sky === 'night' ? ((wx + wy) % 3 ? p.window : 'rgba(15,23,42,0.6)') : 'rgba(255,255,255,0.55)';
        ctx.fillRect(wx, wy, 6, 8);
      }
    }
  }
  // Houses under the chimneys and roofs (the covers are drawn on top later)
  for (const cv of COVERS) {
    if (cv.kind === 'chimney') {
      ctx.fillStyle = p.city[(cv.x / 10) % 5 | 0];
      ctx.fillRect(cv.x - 44, cv.y + 18, 88, 70);
      ctx.fillStyle = sky === 'night' ? '#7f1d1d' : '#dc2626';
      ctx.beginPath();
      ctx.moveTo(cv.x - 54, cv.y + 22);
      ctx.lineTo(cv.x, cv.y - 8);
      ctx.lineTo(cv.x + 54, cv.y + 22);
      ctx.fill();
      ctx.fillStyle = sky === 'night' ? p.window : '#bae6fd';
      ctx.fillRect(cv.x - 28, cv.y + 36, 14, 16);
      ctx.fillRect(cv.x + 14, cv.y + 36, 14, 16);
    }
  }
  // Park: grass hill, path and lake
  const gr = ctx.createLinearGradient(0, 950, 0, WORLD_H);
  gr.addColorStop(0, p.grass[0]);
  gr.addColorStop(1, p.grass[1]);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(0, 990);
  ctx.quadraticCurveTo(120, 940, 220, 975);
  ctx.quadraticCurveTo(300, 1000, W, 960);
  ctx.lineTo(W, WORLD_H);
  ctx.lineTo(0, WORLD_H);
  ctx.fill();
  ctx.strokeStyle = sky === 'night' ? 'rgba(254,243,199,0.25)' : 'rgba(254,243,199,0.9)';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(150, WORLD_H);
  ctx.quadraticCurveTo(200, 1300, 170, 1230);
  ctx.quadraticCurveTo(140, 1120, 250, 1060);
  ctx.stroke();
  const wg = ctx.createLinearGradient(0, 1100, 0, 1220);
  wg.addColorStop(0, p.water[0]);
  wg.addColorStop(1, p.water[1]);
  ctx.fillStyle = sky === 'night' ? '#0f172a' : '#fde68a';
  ctx.beginPath();
  ctx.ellipse(276, 1160, 104, 56, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.ellipse(276, 1160, 96, 50, 0, 0, TAU);
  ctx.fill();
  // Fairground sand
  ctx.fillStyle = sky === 'night' ? 'rgba(120,53,15,0.55)' : 'rgba(253,230,138,0.85)';
  ctx.beginPath();
  ctx.moveTo(0, 1290);
  ctx.quadraticCurveTo(200, 1260, W, 1280);
  ctx.lineTo(W, WORLD_H);
  ctx.lineTo(0, WORLD_H);
  ctx.fill();
  // Flowers
  for (let i = 0; i < 50; i++) {
    const x = rnd() * W;
    const y = 1000 + rnd() * 480;
    if (Math.hypot((x - 276) / 104, (y - 1160) / 56) < 1.1) continue;
    ctx.fillStyle = ['#fde047', '#f9a8d4', '#ffffff', '#fca5a5'][i % 4];
    ctx.globalAlpha = sky === 'night' ? 0.4 : 0.9;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  worldCache[sky] = c;
  return c;
}

function drawCloudShape(ctx, x, y, r, p) {
  ctx.fillStyle = p.cloudShade;
  ctx.beginPath();
  ctx.arc(x - r * 0.9, y + r * 0.25, r * 0.62, 0, TAU);
  ctx.arc(x + r * 0.95, y + r * 0.25, r * 0.6, 0, TAU);
  ctx.arc(x, y + r * 0.3, r * 0.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p.cloud;
  ctx.beginPath();
  ctx.arc(x - r * 0.8, y + r * 0.12, r * 0.58, 0, TAU);
  ctx.arc(x + r * 0.85, y + r * 0.12, r * 0.56, 0, TAU);
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function drawCover(ctx, c, y, p, t, sky) {
  const { x, r } = c;
  switch (c.kind) {
    case 'cloud':
      drawCloudShape(ctx, x, y, r, p);
      break;
    case 'balloon': {
      const by = y + Math.sin(t * 1.2 + x) * 3;
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, by + r * 0.8);
      ctx.lineTo(x - 8, by + r * 1.45);
      ctx.moveTo(x + r * 0.5, by + r * 0.8);
      ctx.lineTo(x + 8, by + r * 1.45);
      ctx.stroke();
      ctx.fillStyle = '#a16207';
      ctx.fillRect(x - 10, by + r * 1.45, 20, 14);
      const cols = ['#ef4444', '#fde047', '#3b82f6', '#fde047', '#ef4444'];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = cols[i];
        ctx.beginPath();
        ctx.ellipse(x, by, r * (1 - i * 0.2), r * 1.1, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.4, by - r * 0.4, r * 0.18, r * 0.35, -0.3, 0, TAU);
      ctx.fill();
      break;
    }
    case 'chimney': {
      ctx.fillStyle = sky === 'night' ? '#57534e' : '#b45309';
      ctx.fillRect(x - r, y - r, r * 2, r * 2.2);
      ctx.fillStyle = sky === 'night' ? '#44403c' : '#92400e';
      ctx.fillRect(x - r - 3, y - r - 4, r * 2 + 6, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let k = 0; k < 3; k++) ctx.fillRect(x - r, y - r + 10 + k * 9, r * 2, 1.5);
      // Smoke
      for (let k = 0; k < 3; k++) {
        const q = (t * 0.4 + k / 3) % 1;
        ctx.fillStyle = `rgba(226,232,240,${0.5 * (1 - q)})`;
        ctx.beginPath();
        ctx.arc(x + 6 + q * 18 + Math.sin(q * 6) * 4, y - r - 14 - q * 50, 5 + q * 9, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'roof': {
      const col = p.city[(x / 7) % 5 | 0];
      ctx.fillStyle = col;
      ctx.fillRect(x - r, y + r * 0.5, r * 2, r * 1.6);
      ctx.fillStyle = sky === 'night' ? p.window : '#bae6fd';
      ctx.fillRect(x - r * 0.6, y + r * 0.85, r * 0.4, r * 0.45);
      ctx.fillRect(x + r * 0.2, y + r * 0.85, r * 0.4, r * 0.45);
      ctx.fillStyle = sky === 'night' ? '#1e3a8a' : '#2563eb';
      ctx.beginPath();
      ctx.moveTo(x - r * 1.25, y + r * 0.6);
      ctx.lineTo(x, y - r);
      ctx.lineTo(x + r * 1.25, y + r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let k = 1; k < 4; k++) {
        const yy = y - r + (k * r * 1.6) / 4;
        const hw = ((yy - (y - r)) / (r * 1.6)) * r * 1.25;
        ctx.beginPath();
        ctx.moveTo(x - hw, yy);
        ctx.lineTo(x + hw, yy);
        ctx.stroke();
      }
      break;
    }
    case 'tree': {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x - 6, y + r * 0.5, 12, r * 0.9);
      const dark = sky === 'night';
      ctx.fillStyle = dark ? '#14532d' : '#15803d';
      ctx.beginPath();
      ctx.arc(x - r * 0.5, y + r * 0.2, r * 0.65, 0, TAU);
      ctx.arc(x + r * 0.55, y + r * 0.2, r * 0.62, 0, TAU);
      ctx.arc(x, y - r * 0.15, r * 0.85, 0, TAU);
      ctx.fill();
      ctx.fillStyle = dark ? '#166534' : '#22c55e';
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.5, 0, TAU);
      ctx.arc(x + r * 0.3, y - r * 0.05, r * 0.45, 0, TAU);
      ctx.fill();
      ctx.fillStyle = dark ? 'rgba(254,240,138,0.25)' : '#ef4444';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(k * 1.9) * r * 0.55, y + Math.sin(k * 1.9) * r * 0.45, 3, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'boat': {
      const by = y + Math.sin(t * 1.6 + x) * 2;
      const top = by - r;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, top + r * 0.62, r * 1.3, 4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = x > 300 ? '#f472b6' : '#fde047';
      ctx.beginPath();
      ctx.moveTo(x - r * 1.15, top);
      ctx.lineTo(x + r * 1.15, top);
      ctx.quadraticCurveTo(x + r * 0.9, top + r * 0.62, x, top + r * 0.62);
      ctx.quadraticCurveTo(x - r * 0.9, top + r * 0.62, x - r * 1.15, top);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x - r * 1.1, top, r * 2.2, 3);
      // A swan head on the front
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + r * 1.05, top + 2);
      ctx.quadraticCurveTo(x + r * 1.45, top - 14, x + r * 1.2, top - 20);
      ctx.stroke();
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(x + r * 1.12, top - 20, 3, 0, TAU);
      ctx.fill();
      break;
    }
    case 'bush': {
      ctx.fillStyle = sky === 'night' ? '#14532d' : '#16a34a';
      ctx.beginPath();
      ctx.arc(x - r * 0.6, y + r * 0.2, r * 0.6, 0, TAU);
      ctx.arc(x + r * 0.6, y + r * 0.2, r * 0.6, 0, TAU);
      ctx.arc(x, y, r * 0.85, 0, TAU);
      ctx.rect(x - r * 1.2, y + r * 0.2, r * 2.4, r * 0.6);
      ctx.fill();
      ctx.fillStyle = sky === 'night' ? '#fde04788' : '#f9a8d4';
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(k * 2.3) * r * 0.7, y + Math.sin(k * 2.3) * r * 0.4, 2.5, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'tent': {
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k % 2 ? '#fef3c7' : '#ef4444';
        ctx.fillRect(x - r + (k * r) / 3, y - r * 0.6, r / 3, r * 1.8);
      }
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(x - r * 1.15, y - r * 0.55);
      ctx.lineTo(x, y - r * 1.6);
      ctx.lineTo(x + r * 1.15, y - r * 0.55);
      ctx.fill();
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(x - 9, y + r * 1.2);
      ctx.lineTo(x, y + r * 0.2);
      ctx.lineTo(x + 9, y + r * 1.2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.6);
      ctx.lineTo(x + 12, y - r * 1.75);
      ctx.lineTo(x, y - r * 1.9);
      ctx.fill();
      break;
    }
    default:
  }
}

function drawSpot(ctx, p, cam, t, s) {
  const c = COVERS[p.cover];
  const sy = p.y - cam;
  if (sy < -80 || sy > H + 80) return;
  // Peeking in and out a little
  const peek = p.found ? 0 : Math.max(0, Math.sin(t * 1.4 + p.id * 1.7)) * 4;
  const out = p.found ? Math.min(1, (s.time - p.foundAt) * 4) * p.size * 0.55 : 0;
  const dx = p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0;
  const dy = p.dir === 'top' ? -1 : 0;
  const shake = s.time - p.wrongAt < 0.5 ? Math.sin((s.time - p.wrongAt) * 50) * 4 : 0;
  const hop = p.found ? Math.abs(Math.sin((s.time - p.foundAt) * 6)) * 6 : 0;
  const x = p.x + dx * (peek + out) + shake;
  const y = sy + dy * (peek + out) - hop;
  ctx.save();
  if ((c.kind === 'chimney' || c.kind === 'boat') && !p.found) {
    // Inside the chimney / boat: only the part above its rim shows
    const rim = c.y - c.r - cam + (c.kind === 'boat' ? Math.sin(t * 1.6 + c.x) * 2 : -4);
    ctx.beginPath();
    ctx.rect(0, -100, W, rim + 100);
    ctx.clip();
  }
  drawSprite(ctx, loadImage(artworkUrl(p.dex)), x, y, p.size, { flip: p.dir === 'left', rotate: dx * 0.12 + (p.found ? Math.sin(t * 8) * 0.08 : 0), color: '#fbbf24' });
  ctx.restore();
  // "?" over a Pokemon that is not on the list
  if (s.time - p.wrongAt < 0.9) {
    const k = (s.time - p.wrongAt) / 0.9;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = '#fff';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✖', p.hx, p.hy - cam - p.size * 0.6 - k * 16);
    ctx.globalAlpha = 1;
  }
}

function drawHint(ctx, p, cam, t) {
  const sy = p.hy - cam;
  if (sy < 0) {
    drawEdgeArrow(ctx, p.hx, 18, -1, t);
    return;
  }
  if (sy > H) {
    drawEdgeArrow(ctx, p.hx, H - 18, 1, t);
    return;
  }
  const k = (Math.sin(t * 8) + 1) / 2;
  ctx.save();
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = `rgba(253,224,71,${0.6 + k * 0.4})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(p.hx, sy, p.hr + 6 + k * 6, 0, TAU);
  ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 5; i++) {
    const a = t * 2.5 + (i * TAU) / 5;
    const rr = p.hr + 14;
    const tw = Math.max(0, Math.sin(t * 6 + i));
    ctx.fillStyle = `rgba(255,255,255,${tw})`;
    ctx.beginPath();
    ctx.arc(p.hx + Math.cos(a) * rr, sy + Math.sin(a) * rr, 2 + tw * 2, 0, TAU);
    ctx.fill();
  }
}

function drawEdgeArrow(ctx, x, y, dir, t) {
  const b = Math.sin(t * 8) * 4;
  ctx.fillStyle = '#fde047';
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + dir * (10 + b));
  ctx.lineTo(x - 14, y - dir * (6 - b));
  ctx.lineTo(x + 14, y - dir * (6 - b));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawWheel(ctx, angle, img, t, night) {
  const { x, y } = HUB;
  // Stand
  ctx.strokeStyle = night ? '#e2e8f0' : '#f8fafc';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 56, H + 10);
  ctx.moveTo(x, y);
  ctx.lineTo(x + 56, H + 10);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 38, y + 180);
  ctx.lineTo(x + 38, y + 180);
  ctx.stroke();
  // Rims and spokes
  ctx.strokeStyle = night ? 'rgba(244,114,182,0.9)' : '#ec4899';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, WHEEL_R, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, WHEEL_R - 12, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = night ? 'rgba(226,232,240,0.7)' : 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < CABINS * 2; i++) {
    const a = (i / (CABINS * 2)) * TAU - angle;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * WHEEL_R, y + Math.sin(a) * WHEEL_R);
    ctx.stroke();
  }
  // Bulbs on the rim
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU - angle;
    const on = (Math.sin(t * 5 + i * 0.8) + 1) / 2;
    ctx.fillStyle = night ? `rgba(253,224,71,${0.5 + on * 0.5})` : `rgba(254,240,138,${0.6 + on * 0.4})`;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * WHEEL_R, y + Math.sin(a) * WHEEL_R, night ? 3 : 2.2, 0, TAU);
    ctx.fill();
  }
  // Cabins, always hanging down; ours is the gold one (starts at the bottom)
  const cols = ['#38bdf8', '#4ade80', '#f472b6', '#a78bfa', '#fb923c', '#facc15', '#f87171'];
  for (let i = 0; i < CABINS; i++) {
    const a = Math.PI / 2 - angle - (i / CABINS) * TAU;
    const cx = x + Math.cos(a) * WHEEL_R;
    const cy = y + Math.sin(a) * WHEEL_R;
    const mine = i === 0;
    const sw = Math.sin(t * 2 + i) * 0.06;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sw);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 6);
    ctx.stroke();
    const w = mine ? 40 : 24;
    const h = mine ? 34 : 20;
    ctx.fillStyle = mine ? '#fbbf24' : cols[(i - 1) % cols.length];
    ctx.beginPath();
    ctx.roundRect(-w / 2, 6, w, h, 6);
    ctx.fill();
    ctx.fillStyle = mine ? '#fef3c7' : 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 4, 10, w - 8, h * 0.45, 3);
    ctx.fill();
    if (mine) {
      drawSprite(ctx, img, 0, 18, 34);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-w / 2, 6 + h * 0.62, w, 3);
    }
    ctx.restore();
  }
  // Hub
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(x, y, 11, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-11 + x, y - 1.5, 22, 3);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, TAU);
  ctx.fill();
}

function drawFx(ctx, v, dt) {
  // Magnifier rings, "?" marks and flying finds
  for (let i = v.rings.length - 1; i >= 0; i--) {
    const r = v.rings[i];
    r.life -= dt;
    if (r.life <= 0) {
      v.rings.splice(i, 1);
      continue;
    }
    const k = 1 - r.life / r.max;
    const rad = r.r * (0.6 + Math.min(1, k * 3) * 0.5);
    ctx.globalAlpha = Math.min(1, r.life * 3);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(r.x + rad * 0.72, r.y + rad * 0.72);
    ctx.lineTo(r.x + rad * 1.25, r.y + rad * 1.25);
    ctx.stroke();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, rad, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(r.x + rad * 0.75, r.y - rad * 0.75, 11, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r.x + rad * 0.75 - 5, r.y - rad * 0.75);
    ctx.lineTo(r.x + rad * 0.75 - 1, r.y - rad * 0.75 + 4);
    ctx.lineTo(r.x + rad * 0.75 + 6, r.y - rad * 0.75 - 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (let i = v.marks.length - 1; i >= 0; i--) {
    const m = v.marks[i];
    m.life -= dt;
    if (m.life <= 0) {
      v.marks.splice(i, 1);
      continue;
    }
    const k = 1 - m.life / m.max;
    const s = k < 0.2 ? 0.5 + k * 3 : 1.1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, m.life * 2.5);
    ctx.translate(m.x, m.y - k * 24);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7c3aed';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 1);
    ctx.fillStyle = '#fda4af';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.fillText(m.text, 0, 26);
    ctx.restore();
  }
  for (let i = v.flying.length - 1; i >= 0; i--) {
    const f = v.flying[i];
    f.t += dt;
    const k = Math.min(1, f.t / 0.8);
    if (k >= 1) {
      v.flying.splice(i, 1);
      continue;
    }
    const e = k * k;
    const x = f.x + (f.tx - f.x) * e;
    const y = f.y + (f.ty - f.y) * e - Math.sin(k * Math.PI) * 60;
    drawSprite(ctx, loadImage(artworkUrl(f.dex)), x, y, f.size * (1 + Math.sin(k * Math.PI) * 0.5), { alpha: 1 - k * 0.3, rotate: k * TAU });
  }
}

const snap = (s) => {
  const ride = s.ride;
  return {
    stage: s.stage,
    ride: s.rideIndex,
    score: s.score,
    found: s.found,
    wrong: s.wrong,
    left: rideLeft(s),
    rideTime: ride.cfg.time,
    list: ride.targets.map((id) => ({ id, dex: ride.spots[id].dex, name: ride.spots[id].name, found: ride.spots[id].found })),
    rideFound: ride.spots.filter((p) => p.target && p.found).length,
    hint: s.hint?.id ?? null,
    stars: ferrisStars(s),
    status: s.status,
  };
};

const freshFx = () => ({ time: 0, cam: WORLD_H - H, particles: [], rings: [], marks: [], flying: [], targetsAttr: '' });

/**
 * "Đu quay tìm Pokémon": ride the ferris wheel and find the 5 Pokemon on the list hiding in
 * the view (trees, chimneys, boats, clouds). 3 rides: day, sunset, night.
 */
export function FerrisGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createFerris({ random, playerName: player?.name }));
  const game = useRef(first);
  const fx = useRef(freshFx());
  const [ui, setUi] = useState(() => snap(first));
  const [targetsAttr, setTargetsAttr] = useState('');
  const [banner, setBanner] = useState(null);
  const [popId, setPopId] = useState(null);
  const later = useLater();
  const idRef = useRef(0);
  const img = loadImage(player.image);

  const say = (text, tone, ms = 1600) => {
    const id = ++idRef.current;
    setBanner({ text, tone, id });
    later(() => setBanner((b) => (b?.id === id ? null : b)), ms);
  };

  const onEvent = (e, s, v) => {
    if (e.type === 'board') {
      say(`Vòng ${e.ride + 1}/${RIDES.length}: ${RIDE_NAMES[e.ride]}`, 'blue', 1500);
      sounds.playNote(523, { duration: 0.15, volume: 0.16 });
      sounds.playNote(659, { duration: 0.15, delay: 0.12, volume: 0.16 });
    } else if (e.type === 'go') {
      sounds.playWhoosh();
    } else if (e.type === 'found') {
      sounds.playCoin();
      [784, 988, 1318].forEach((f, i) => sounds.playNote(f, { duration: 0.18, delay: 0.05 + i * 0.07, volume: 0.18 }));
      v.rings.push({ x: e.x, y: e.y, r: 30, life: 0.9, max: 0.9 });
      burst(v.particles, e.x, e.y, { count: 22, colors: ['#fde047', '#ffffff', '#f472b6', '#4ade80'], speed: 200, gravity: 120, size: 3.5 });
      const p = s.ride.spots[e.id];
      p.foundAt = s.time;
      const slot = s.ride.targets.indexOf(e.id);
      v.flying.push({ dex: p.dex, x: e.x, y: e.y, tx: W * ((slot + 0.5) / TARGETS), ty: H + 30, t: 0, size: p.size });
      setPopId(e.id);
      later(() => setPopId((cur) => (cur === e.id ? null : cur)), 900);
      if (e.left > 0 && e.left <= 2) say(`Còn ${e.left} bạn nữa thôi! 🔍`, 'gold', 1100);
    } else if (e.type === 'wrong') {
      sounds.playOops();
      v.marks.push({ x: e.x, y: e.y, life: 0.9, max: 0.9, text: '-1s' });
    } else if (e.type === 'hint') {
      sounds.playEnergySurge();
      if (e.up) say('Bạn ấy ở phía trên kìa! ⬆️', 'soft', 1300);
      else if (e.down) say('Bạn ấy ở phía dưới kìa! ⬇️', 'soft', 1300);
    } else if (e.type === 'ride-end') {
      if (e.all) {
        sounds.playEnergySurge();
        [523, 659, 784, 1047, 1318].forEach((f, i) => sounds.playNote(f, { duration: 0.22, delay: i * 0.08, volume: 0.2 }));
        say(`Tìm đủ ${TARGETS}/${TARGETS}! ⭐ Thưởng nhanh +${e.bonus}`, 'gold', 2300);
        for (let i = 0; i < 4; i++) burst(v.particles, 150 + i * 60, 200 + (i % 2) * 80, { count: 18, colors: ['#fde047', '#f472b6', '#38bdf8', '#ffffff'], speed: 220, gravity: 200, size: 4 });
      } else {
        sounds.playNote(392, { duration: 0.3, volume: 0.16 });
        say(`Hết vòng! Tìm được ${e.found}/${TARGETS} bạn`, 'soft', 2300);
      }
    } else if (e.type === 'end') {
      later(() => setPhase('done'), 300);
    }
  };

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    const t = v.time;
    if (phase === 'play') {
      stepFerris(s, dt);
      for (const e of s.events.splice(0)) onEvent(e, s, v);
      setUi(snap(s));
    }
    const want = cameraY(s);
    v.cam += (want - v.cam) * Math.min(1, dt * (s.stage === 'ride' ? 12 : 2.5));
    // Where the targets are now (for tests and screen readers)
    const attr = s.stage === 'ride' ? targetsLeft(s).map((p) => `${Math.round(p.hx)},${Math.round(p.hy - v.cam)}`).join(';') : '';
    if (attr !== v.targetsAttr) {
      v.targetsAttr = attr;
      setTargetsAttr(attr);
    }
    const ctx = getCtx();
    if (!ctx) {
      updateParticles(null, v.particles, dt);
      v.rings = v.rings.filter((r) => (r.life -= dt) > 0);
      v.marks = v.marks.filter((m) => (m.life -= dt) > 0);
      v.flying = v.flying.filter((f) => (f.t += dt) < 0.8);
      return;
    }
    const cfg = s.ride.cfg;
    const pal = PALETTE[cfg.sky];
    const cam = v.cam;
    ctx.clearRect(0, 0, W, H);
    const bg = world(cfg.sky);
    if (bg) ctx.drawImage(bg, 0, cam * 2, W * 2, H * 2, 0, 0, W, H);
    else {
      ctx.fillStyle = pal.skyLow;
      ctx.fillRect(0, 0, W, H);
    }
    // Sky life: stars at night, sun or moon, drifting clouds
    if (cfg.sky === 'night') {
      for (const st of STARS) {
        const y = st.y - cam;
        if (y < -4 || y > H + 4) continue;
        const tw = 0.4 + Math.sin(t * 3 + st.ph) * 0.4;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + tw})`;
        ctx.beginPath();
        ctx.arc(st.x, y, st.r, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.arc(300, 150 - cam, 24, 0, TAU);
      ctx.fill();
    } else {
      const sunY = (cfg.sky === 'day' ? 130 : 880) - cam;
      ctx.fillStyle = cfg.sky === 'day' ? 'rgba(253,224,71,0.35)' : 'rgba(251,146,60,0.45)';
      ctx.beginPath();
      ctx.arc(170, sunY, cfg.sky === 'day' ? 40 : 56, 0, TAU);
      ctx.fill();
      ctx.fillStyle = cfg.sky === 'day' ? '#fde047' : '#fb923c';
      ctx.beginPath();
      ctx.arc(170, sunY, cfg.sky === 'day' ? 26 : 38, 0, TAU);
      ctx.fill();
    }
    for (const d of DRIFT) {
      const y = d.y - cam;
      if (y < -40 || y > H + 40) continue;
      const x = ((d.x + t * d.v) % (W + 120)) - 60;
      ctx.globalAlpha = 0.55;
      drawCloudShape(ctx, x, y, 18 * d.s, pal);
      ctx.globalAlpha = 1;
    }
    // Lake shimmer
    const ly = 1160 - cam;
    if (ly > -60 && ly < H + 60) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        const x = 220 + ((k * 37 + t * 12) % 110);
        ctx.beginPath();
        ctx.moveTo(x, ly - 30 + k * 14);
        ctx.lineTo(x + 14, ly - 30 + k * 14);
        ctx.stroke();
      }
    }
    // Hidden Pokemon, then what they hide behind
    for (const p of s.ride.spots) if (!p.found) drawSpot(ctx, p, cam, t, s);
    for (const c of COVERS) {
      const y = c.y - cam;
      if (y < -90 || y > H + 90) continue;
      drawCover(ctx, c, y, pal, t, cfg.sky);
    }
    // Found ones sit on top of their cover, waving
    for (const p of s.ride.spots) if (p.found) drawSpot(ctx, p, cam, t, s);
    // String lights over the fairground
    const fy = 1280 - cam;
    if (fy > -40 && fy < H + 40) {
      ctx.strokeStyle = 'rgba(30,41,59,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(150, fy);
      ctx.quadraticCurveTo(255, fy + 26, W, fy);
      ctx.stroke();
      for (let k = 0; k < 9; k++) {
        const q = k / 8;
        const x = 150 + q * (W - 150);
        const y = fy + Math.sin(q * Math.PI) * 13;
        const on = (Math.sin(t * 4 + k) + 1) / 2;
        ctx.fillStyle = ['#fde047', '#f472b6', '#38bdf8'][k % 3];
        ctx.globalAlpha = 0.5 + on * 0.5;
        ctx.beginPath();
        ctx.arc(x, y + 4, 3.5, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (pal.tint) {
      ctx.fillStyle = pal.tint;
      ctx.fillRect(0, 0, W, H);
    }
    if (s.hint) drawHint(ctx, s.ride.spots[s.hint.id], cam, t);
    drawWheel(ctx, wheelAngle(s), img, t, cfg.sky === 'night');
    drawFx(ctx, v, dt);
    updateParticles(ctx, v.particles, dt);
    // Height gauge on the wheel side
    const h = 1 - cam / (WORLD_H - H);
    ctx.fillStyle = 'rgba(15,23,42,0.35)';
    ctx.beginPath();
    ctx.roundRect(8, 16, 10, 150, 5);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(13, 160 - h * 140, 7, 0, TAU);
    ctx.fill();
  }, phase !== 'done');

  const onDown = (e) => {
    if (phase !== 'play' || !canvasRef.current) return;
    const s = game.current;
    const p = canvasPoint(canvasRef.current, e, W, H);
    tapView(s, p.x, p.y, fx.current.cam);
    for (const ev of s.events.splice(0)) onEvent(ev, s, fx.current);
    setUi(snap(s));
  };
  const onHint = () => {
    if (phase !== 'play') return;
    const s = game.current;
    askHint(s);
    for (const ev of s.events.splice(0)) onEvent(ev, s, fx.current);
    setUi(snap(s));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'h' || e.key === 'H') onHint();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const replay = () => {
    game.current = createFerris({ random, playerName: player?.name });
    fx.current = freshFx();
    setUi(snap(game.current));
    setBanner(null);
    setTargetsAttr('');
    setPhase('ready');
  };

  const left = Math.ceil(ui.left);
  const riding = phase === 'play' && ui.stage === 'ride';
  const tones = { blue: 'bg-sky-500 text-white', gold: 'bg-gradient-to-b from-yellow-200 to-amber-400 text-rose-700', soft: 'bg-white/90 text-slate-700' };

  return (
    <CarnivalShell
      title="🎡 Đu quay tìm Pokémon"
      label="Đu quay tìm Pokémon"
      onClose={onClose}
      background={ui.ride === 2 ? 'bg-gradient-to-b from-slate-900 via-indigo-950 to-violet-950' : ui.ride === 1 ? 'bg-gradient-to-b from-violet-600 via-rose-500 to-orange-400' : 'bg-gradient-to-b from-sky-400 via-sky-500 to-emerald-600'}
      dataAttrs={{ 'data-phase': phase, 'data-stage': ui.stage, 'data-ride': ui.ride + 1, 'data-score': ui.score, 'data-found': ui.found, 'data-wrong': ui.wrong }}
      hud={
        <>
          <HudBar
            items={[
              { icon: '🎡', label: 'Vòng', value: `${ui.ride + 1}/${RIDES.length}` },
              { icon: '⭐', label: 'Điểm', value: ui.score, testId: 'ferris-score' },
              { icon: '⏱', label: 'Còn', value: `${left}s`, warn: riding && left <= 8 },
            ]}
          />
          <div className="mt-1 h-2 rounded-full bg-black/30 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-300 to-pink-400 transition-[width] duration-200" style={{ width: `${(ui.left / ui.rideTime) * 100}%` }} />
          </div>
        </>
      }
    >
      <div className="relative flex-1 min-h-0 flex flex-col items-center overflow-hidden">
        <div className="relative flex-1 min-h-0 w-full flex items-start justify-center">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            className="max-w-full max-h-full touch-none"
            style={{ aspectRatio: `${W} / ${H}`, height: '100%', width: 'auto' }}
            data-testid="ferris-stage"
            data-targets={targetsAttr}
          />
          {banner && (
            <p key={banner.id} className={`banner-slam absolute top-[6%] inset-x-6 text-center text-lg font-black px-3 py-2 rounded-2xl shadow-xl pointer-events-none ${tones[banner.tone]}`}>
              {banner.text}
            </p>
          )}
        </div>
        <div className="relative z-10 w-full flex-none px-2 pb-2 pt-1">
          <div className="flex items-center gap-1.5 rounded-3xl bg-white/90 px-2 py-1.5 shadow-lg">
            <span className="flex-none text-xs font-black text-sky-700 leading-tight text-center w-8">
              🔍
              <br />
              Tìm
            </span>
            <div className="flex-1 min-w-0 grid grid-cols-5 gap-1" data-testid="ferris-list">
              {ui.list.map((it) => (
                <div
                  key={`${ui.ride}-${it.id}`}
                  className={`relative aspect-square rounded-2xl border-2 flex items-center justify-center ${it.found ? 'bg-emerald-100 border-emerald-400' : ui.hint === it.id ? 'bg-yellow-100 border-yellow-400 hint-pulse' : 'bg-sky-50 border-sky-200'} ${popId === it.id ? 'ferris-got' : ''}`}
                  data-testid="ferris-target"
                  data-found={it.found ? 'yes' : 'no'}
                  title={it.name}
                >
                  <img src={artworkUrl(it.dex)} alt={it.name} className={`w-[86%] h-[86%] object-contain drop-shadow ${it.found ? 'opacity-60' : ''}`} draggable={false} />
                  {it.found && <span className="pop-in absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-black flex items-center justify-center shadow">✓</span>}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onHint}
              disabled={!riding || ui.hint != null || ui.rideFound >= TARGETS}
              className="flex-none w-12 self-stretch rounded-2xl bg-amber-400 text-amber-950 font-black text-[10px] leading-tight flex flex-col items-center justify-center shadow active:scale-90 disabled:opacity-40"
              data-testid="ferris-hint"
              aria-label={`Gợi ý (trừ ${HINT_COST} điểm)`}
            >
              <Lightbulb className="w-5 h-5" />
              -{HINT_COST}
            </button>
          </div>
        </div>
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} text="LÊN ĐU QUAY!" />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Mắt thần tìm Pokémon! 🏆' : ui.stars === 2 ? 'Tìm giỏi lắm! 🔍' : 'Lần sau tìm được nhiều hơn! 💪'}
            stars={ui.stars}
            detail={`${ui.score} điểm · tìm được ${ui.found}/${TARGETS * RIDES.length} bạn Pokémon`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
