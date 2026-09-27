import React, { useEffect, useRef, useState } from 'react';
import {
  GH_W as W,
  GH_H as H,
  DURATION,
  LIGHT_R,
  CAUGHT_TIME,
  CART,
  LAMP,
  KINDS,
  createGhostHouse,
  stepGhostHouse,
  tapGhost,
  aimLight,
  ghostPos,
  spotScreenX,
  timeLeft,
  ghostStars,
} from '../../utils/carnival/ghosthouse';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite, drawPokeball, burst, updateParticles } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const TAU = Math.PI * 2;
const FLOOR_Y = 418;
const RAIL_Y = 500;
const TILE = 120;
const kindImage = (kind) => loadImage(artworkUrl(KINDS[kind].dex));

// ---------- painted once ----------

let wallCache = null;
function wallTile() {
  if (wallCache || typeof document === 'undefined') return wallCache;
  const c = document.createElement('canvas');
  c.width = TILE * 2;
  c.height = FLOOR_Y * 2;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  // Wallpaper: soft purple stripes with little diamonds
  const g = ctx.createLinearGradient(0, 80, 0, FLOOR_Y);
  g.addColorStop(0, '#4c1d95');
  g.addColorStop(1, '#2e1065');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TILE, FLOOR_Y);
  ctx.fillStyle = 'rgba(167,139,250,0.14)';
  for (let x = 0; x < TILE; x += 30) ctx.fillRect(x + 12, 80, 6, FLOOR_Y - 80);
  ctx.fillStyle = 'rgba(221,214,254,0.16)';
  for (let y = 100; y < 360; y += 44) {
    for (let x = 0; x < TILE; x += 60) {
      const ox = (y / 44) % 2 ? 30 : 0;
      ctx.beginPath();
      ctx.moveTo(x + ox, y - 7);
      ctx.lineTo(x + ox + 6, y);
      ctx.lineTo(x + ox, y + 7);
      ctx.lineTo(x + ox - 6, y);
      ctx.fill();
    }
  }
  // Ceiling: dark wood with a beam
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(0, 0, TILE, 84);
  ctx.fillStyle = '#312e81';
  ctx.fillRect(0, 70, TILE, 14);
  ctx.fillStyle = '#3b0764';
  ctx.fillRect(TILE / 2 - 9, 0, 18, 84);
  // Wainscot panels
  ctx.fillStyle = '#3f2a1d';
  ctx.fillRect(0, 352, TILE, FLOOR_Y - 352);
  ctx.fillStyle = '#5b3a25';
  ctx.fillRect(0, 348, TILE, 7);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 364, TILE / 2 - 20, 44);
  ctx.strokeRect(TILE / 2 + 10, 364, TILE / 2 - 20, 44);
  wallCache = c;
  return c;
}

// ---------- scene pieces ----------

function drawWindow(ctx, x, y, w, h, flash, t) {
  ctx.save();
  // Night sky, moon, twinkling stars; white in the lightning
  const sky = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  sky.addColorStop(0, flash > 0.05 ? `rgba(224,231,255,${0.5 + flash * 0.5})` : '#1e3a8a');
  sky.addColorStop(1, flash > 0.05 ? '#c7d2fe' : '#312e81');
  ctx.fillStyle = sky;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + h / 2);
  ctx.lineTo(x - w / 2, y - h / 2 + w / 2);
  ctx.arc(x, y - h / 2 + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#fef9c3';
  ctx.beginPath();
  ctx.arc(x + w * 0.18, y - h * 0.18, 11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = flash > 0.05 ? '#c7d2fe' : '#1e3a8a';
  ctx.beginPath();
  ctx.arc(x + w * 0.24, y - h * 0.22, 9, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const tw = (Math.sin(t * 3 + i * 1.7 + x * 0.01) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.7})`;
    ctx.fillRect(x - w * 0.35 + ((i * 17) % (w * 0.6)), y - h * 0.3 + ((i * 23) % (h * 0.5)), 2, 2);
  }
  // Lightning bolt far away
  if (flash > 0.55) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - h / 2);
    ctx.lineTo(x + 4, y - h * 0.15);
    ctx.lineTo(x - 4, y - h * 0.05);
    ctx.lineTo(x + 8, y + h * 0.3);
    ctx.stroke();
  }
  ctx.restore();
  // Frame and cross bars
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + h / 2);
  ctx.lineTo(x - w / 2, y - h / 2 + w / 2);
  ctx.arc(x, y - h / 2 + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x, y + h / 2);
  ctx.moveTo(x - w / 2, y + 4);
  ctx.lineTo(x + w / 2, y + 4);
  ctx.stroke();
  // Sill
  ctx.fillStyle = '#92400e';
  ctx.fillRect(x - w / 2 - 8, y + h / 2 - 2, w + 16, 9);
}

function drawCurtain(ctx, x, y, w, h, side, t) {
  const top = y - h / 2;
  // Rod
  ctx.fillStyle = '#ca8a04';
  ctx.fillRect(x - w / 2 - 12, top - 6, w + 24, 5);
  ctx.beginPath();
  ctx.arc(x - w / 2 - 12, top - 3.5, 5, 0, TAU);
  ctx.arc(x + w / 2 + 12, top - 3.5, 5, 0, TAU);
  ctx.fill();
  // Dark doorway behind
  ctx.fillStyle = '#0f0a1f';
  ctx.fillRect(x - w / 2 + 6, top, w - 12, h);
  // Two velvet drapes, swaying
  for (const s of [-1, 1]) {
    const sway = Math.sin(t * 1.4 + x * 0.05 + s) * 3;
    const g = ctx.createLinearGradient(x + (s * w) / 2, 0, x, 0);
    g.addColorStop(0, '#9f1239');
    g.addColorStop(1, '#e11d48');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + (s * w) / 2, top);
    ctx.lineTo(x + s * 6, top);
    ctx.quadraticCurveTo(x + s * (10 + (s === side ? 6 : 0)) + sway, y, x + s * 20 + sway, top + h);
    ctx.lineTo(x + (s * w) / 2, top + h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(76,5,25,0.5)';
    ctx.lineWidth = 1.5;
    for (let k = 1; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x + s * (6 + k * 9), top);
      ctx.quadraticCurveTo(x + s * (12 + k * 9) + sway, y, x + s * (20 + k * 7) + sway, top + h);
      ctx.stroke();
    }
    // Tie-back
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(x + s * (w / 2 - 6), y + 12, 6, 3.5, 0, 0, TAU);
    ctx.fill();
  }
  // Scalloped pelmet
  ctx.fillStyle = '#be123c';
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 6, top - 2);
  for (let i = 0; i <= 4; i++) {
    const px = x - w / 2 - 6 + ((w + 12) * i) / 4;
    ctx.arc(px + (w + 12) / 8, top + 8, (w + 12) / 8, Math.PI, 0, true);
  }
  ctx.lineTo(x + w / 2 + 6, top - 2);
  ctx.fill();
}

function drawPainting(ctx, x, y, w, h, empty, id, t) {
  // Gold frame
  ctx.fillStyle = '#a16207';
  ctx.fillRect(x - w / 2 - 7, y - h / 2 - 7, w + 14, h + 14);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(x - w / 2 - 4, y - h / 2 - 4, w + 8, h + 8);
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, id % 2 ? '#1e3a8a' : '#064e3b');
  g.addColorStop(1, id % 2 ? '#6d28d9' : '#15803d');
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  // A little hill and a moon in the picture
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + h / 2, w * 0.7, h * 0.3, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(x + w * 0.25, y - h * 0.25, 6, 0, TAU);
  ctx.fill();
  if (!empty) {
    // The ghost's portrait: a round purple shape with a grin (it comes out of here!)
    const bob = Math.sin(t * 2 + id) * 2;
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.arc(x - 4, y + 4 + bob, 17, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fef2f2';
    ctx.beginPath();
    ctx.ellipse(x - 10, y + bob, 4, 5, 0.3, 0, TAU);
    ctx.ellipse(x + 2, y + bob, 4, 5, -0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fef2f2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 4, y + 8 + bob, 7, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    // Empty frame: just a dotted outline where it was
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 4, y + 4, 17, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Nail and string
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - w / 3, y - h / 2 - 7);
  ctx.lineTo(x, y - h / 2 - 22);
  ctx.lineTo(x + w / 3, y - h / 2 - 7);
  ctx.stroke();
}

function candleFlicker(t, i) {
  return 0.8 + Math.sin(t * 13 + i * 2.1) * 0.1 + Math.sin(t * 7.3 + i) * 0.1;
}

function drawCandle(ctx, x, y, t, i) {
  // Wall sconce with a candle
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 16);
  ctx.quadraticCurveTo(x, y + 26, x + 12, y + 16);
  ctx.lineTo(x + 2, y + 16);
  ctx.lineTo(x + 2, y + 30);
  ctx.lineTo(x - 2, y + 30);
  ctx.lineTo(x - 2, y + 16);
  ctx.fill();
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(x - 4, y, 8, 16);
  ctx.fillStyle = 'rgba(254,243,199,0.6)';
  ctx.beginPath();
  ctx.arc(x + 2, y + 2, 2, 0, TAU);
  ctx.fill();
  const f = candleFlicker(t, i);
  ctx.fillStyle = 'rgba(253,186,116,0.35)';
  ctx.beginPath();
  ctx.arc(x, y - 8, 14 * f, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.ellipse(x + Math.sin(t * 9 + i) * 1.2, y - 7, 3.6 * f, 8 * f, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.ellipse(x, y - 5, 1.8, 4 * f, 0, 0, TAU);
  ctx.fill();
}

function drawCobweb(ctx, x, y, r, flip) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.strokeStyle = 'rgba(226,232,240,0.45)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      const rr = (r * k) / 3.4;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.quadraticCurveTo(Math.cos(a - 0.2) * rr * 0.8, Math.sin(a - 0.2) * rr * 0.8, px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawBat(ctx, b, t) {
  const flap = Math.sin(t * 16 + b.phase);
  ctx.save();
  ctx.translate(b.x, b.y + Math.sin(t * 4 + b.phase) * 6);
  ctx.fillStyle = '#4c1d95';
  // Wings
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 10, -10 - flap * 8, s * 20, -4 - flap * 10);
    ctx.quadraticCurveTo(s * 16, 0, s * 18, 4);
    ctx.quadraticCurveTo(s * 10, 1, s * 8, 6);
    ctx.closePath();
    ctx.fill();
  }
  // Body, big cute eyes, a smile
  ctx.fillStyle = '#6d28d9';
  ctx.beginPath();
  ctx.ellipse(0, 1, 7, 6.5, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-5, -4);
  ctx.lineTo(-3, -10);
  ctx.lineTo(-1, -5);
  ctx.moveTo(5, -4);
  ctx.lineTo(3, -10);
  ctx.lineTo(1, -5);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-2.6, 0, 2.3, 0, TAU);
  ctx.arc(2.6, 0, 2.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.arc(-2.2, 0.4, 1.1, 0, TAU);
  ctx.arc(3, 0.4, 1.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#f9a8d4';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 3, 2, 0.3, Math.PI - 0.3);
  ctx.stroke();
  ctx.restore();
}

function drawCart(ctx, img, t, scroll, light, cheer) {
  const clack = Math.abs(Math.sin(scroll / 16)) * 1.5;
  const x = CART.x;
  const y = CART.y + clack;
  // Rider: the child's Pokemon, hopping when it catches one
  const hop = cheer > 0 ? Math.abs(Math.sin(cheer * 14)) * 10 : 0;
  drawSprite(ctx, img, x - 2, y - 44 - hop, 80, { rotate: Math.sin(t * 2) * 0.04 });
  // Flashlight in the hand, pointing at the light
  const a = Math.atan2(light.y - LAMP.y, light.x - LAMP.x);
  ctx.save();
  ctx.translate(LAMP.x, LAMP.y);
  ctx.rotate(a);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(-18, -5, 18, 10);
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(-2, -7, 7, 14);
  ctx.fillStyle = '#fef9c3';
  ctx.fillRect(4, -6, 2, 12);
  ctx.restore();
  // Mine cart: a wooden tub with iron bands
  ctx.fillStyle = '#7c2d12';
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 50, y - 16);
  ctx.lineTo(x + 50, y - 16);
  ctx.lineTo(x + 42, y + 22);
  ctx.lineTo(x - 42, y + 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9a3412';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 44 + i * 24, y - 12, 18, 30);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(x - 52, y - 20, 104, 7);
  ctx.fillRect(x - 46, y + 6, 92, 5);
  ctx.fillStyle = '#cbd5e1';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(x - 44 + i * 17.6, y - 16.5, 1.8, 0, TAU);
    ctx.fill();
  }
  // A little Pokeball badge on the side
  drawPokeball(ctx, x, y + 3, 8, 0);
  // Wheels, turning with the ride
  for (const wx of [-28, 28]) {
    ctx.save();
    ctx.translate(x + wx, y + 26);
    ctx.rotate(scroll / 12);
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(9, 0);
    ctx.moveTo(0, -9);
    ctx.lineTo(0, 9);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFloor(ctx, scroll) {
  const g = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
  g.addColorStop(0, '#422006');
  g.addColorStop(1, '#1c0a02');
  ctx.fillStyle = g;
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  // Planks
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  for (let y = FLOOR_Y + 18; y < H; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  const off = scroll % 70;
  for (let row = 0; row < 7; row++) {
    for (let x = -off + (row % 2) * 35; x < W; x += 70) {
      ctx.beginPath();
      ctx.moveTo(x, FLOOR_Y + row * 22);
      ctx.lineTo(x, FLOOR_Y + row * 22 + 18);
      ctx.stroke();
    }
  }
  // Rails and sleepers
  const toff = scroll % 26;
  ctx.fillStyle = '#57534e';
  for (let x = -toff; x < W + 26; x += 26) ctx.fillRect(x, RAIL_Y - 2, 14, 10);
  ctx.fillStyle = '#a8a29e';
  ctx.fillRect(0, RAIL_Y - 4, W, 4);
  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(0, RAIL_Y - 4, W, 1.5);
}

function drawGhost(ctx, g, p, t, alpha = 1) {
  const k = KINDS[g.kind];
  ctx.save();
  ctx.globalAlpha *= alpha * p.k;
  const wob = Math.sin(t * 4 + g.phase);
  drawSprite(ctx, kindImage(g.kind), p.x, p.y, k.size * (0.85 + p.k * 0.15), { rotate: wob * 0.08, color: k.ghost ? '#7c3aed' : '#f9a8d4' });
  ctx.restore();
}

function drawEyes(ctx, g, p, t) {
  // In the dark: only two glowing eyes that blink now and then
  const blink = Math.sin(t * 1.3 + g.phase * 3) > 0.96 ? 0.15 : 1;
  const a = p.k * 0.95;
  ctx.save();
  ctx.fillStyle = `rgba(250,204,21,${a * 0.25})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 6, 20, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(254,249,195,${a})`;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(p.x + s * 8, p.y - 6, 4.2, 5.5 * blink, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function darkness(v) {
  if (v.dark || typeof document === 'undefined') return v.dark;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  v.dark = c;
  return c;
}

function cutLight(d, x, y, r, strength = 1) {
  const g = d.createRadialGradient(x, y, r * 0.15, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(0.65, `rgba(0,0,0,${strength * 0.75})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  d.fillStyle = g;
  d.beginPath();
  d.arc(x, y, r, 0, TAU);
  d.fill();
}

function drawDarkness(ctx, v, s, candles, t) {
  const c = darkness(v);
  const d = c?.getContext?.('2d');
  if (!d) return;
  d.setTransform(2, 0, 0, 2, 0, 0);
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, W, H);
  d.fillStyle = `rgba(9,4,24,${0.9 * (1 - s.flash * 0.75)})`;
  d.fillRect(0, 0, W, H);
  d.globalCompositeOperation = 'destination-out';
  // Candles
  candles.forEach((cd, i) => cutLight(d, cd.x, cd.y - 6, 46 * candleFlicker(t, i), 0.6));
  // A soft glow round the cart so the child always sees its Pokemon
  cutLight(d, CART.x, CART.y - 30, 110, 0.8);
  // The flashlight beam: a cone from the lamp to the circle
  const L = s.light;
  const a = Math.atan2(L.y - LAMP.y, L.x - LAMP.x);
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  const beam = d.createLinearGradient(LAMP.x, LAMP.y, L.x, L.y);
  beam.addColorStop(0, 'rgba(0,0,0,0.35)');
  beam.addColorStop(1, 'rgba(0,0,0,0.7)');
  d.fillStyle = beam;
  d.beginPath();
  d.moveTo(LAMP.x + nx * 5, LAMP.y + ny * 5);
  d.lineTo(L.x + nx * LIGHT_R * 0.8, L.y + ny * LIGHT_R * 0.8);
  d.lineTo(L.x - nx * LIGHT_R * 0.8, L.y - ny * LIGHT_R * 0.8);
  d.lineTo(LAMP.x - nx * 5, LAMP.y - ny * 5);
  d.closePath();
  d.fill();
  cutLight(d, L.x, L.y, LIGHT_R * 1.25, 1);
  ctx.drawImage(c, 0, 0, W, H);
  // Warm light and dust in the beam
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const warm = ctx.createRadialGradient(L.x, L.y, 4, L.x, L.y, LIGHT_R * 1.2);
  warm.addColorStop(0, 'rgba(254,240,138,0.16)');
  warm.addColorStop(1, 'rgba(254,240,138,0)');
  ctx.fillStyle = warm;
  ctx.beginPath();
  ctx.arc(L.x, L.y, LIGHT_R * 1.2, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 10; i++) {
    const u = ((t * 0.25 + i * 0.1) % 1 + 1) % 1;
    const bx = LAMP.x + (L.x - LAMP.x) * u + nx * Math.sin(i * 7 + t) * LIGHT_R * 0.6 * u;
    const by = LAMP.y + (L.y - LAMP.y) * u + ny * Math.sin(i * 7 + t) * LIGHT_R * 0.6 * u;
    ctx.fillStyle = `rgba(255,255,255,${0.25 * Math.sin(u * Math.PI)})`;
    ctx.beginPath();
    ctx.arc(bx, by, 1.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawTexts(ctx, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    q.life -= dt;
    if (q.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    const k = 1 - q.life / q.max;
    const sc = k < 0.15 ? 0.4 + (k / 0.15) * 0.9 : k < 0.3 ? 1.3 - ((k - 0.15) / 0.15) * 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, q.life / 0.3);
    ctx.translate(q.x, q.y - k * 40);
    ctx.scale(sc, sc);
    ctx.font = `900 ${q.size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(30,27,75,0.9)';
    ctx.strokeText(q.text, 0, 0);
    ctx.fillStyle = q.color;
    ctx.fillText(q.text, 0, 0);
    ctx.restore();
  }
}

function drawCaught(ctx, g, t) {
  const u = Math.min(1, (g.t - g.caughtAt) / CAUGHT_TIME);
  const { x, y } = g.caughtPos;
  if (u < 0.35) {
    // Shrinks and spins into a Pokeball in a flash of light
    const k = u / 0.35;
    ctx.save();
    ctx.globalAlpha = 1 - k * 0.6;
    ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x, y, 50 * (1 - k * 0.5), 0, TAU);
    ctx.fill();
    drawSprite(ctx, kindImage(g.kind), x, y, KINDS[g.kind].size * (1 - k * 0.85), { rotate: k * 5 });
    ctx.restore();
  }
  const k = Math.max(0, (u - 0.2) / 0.8);
  const wob = Math.sin(k * 18) * (1 - k) * 0.5;
  const pop = k < 0.2 ? k / 0.2 : 1;
  drawPokeball(ctx, x, y, 13 * pop, wob);
  // Sparkles going round it
  for (let i = 0; i < 5; i++) {
    const a = t * 5 + (i * TAU) / 5;
    ctx.fillStyle = i % 2 ? '#fde047' : '#ffffff';
    ctx.globalAlpha = 1 - u;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * (20 + k * 12), y + Math.sin(a) * (20 + k * 12), 2.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------- the game ----------

const snap = (s) => ({
  score: s.score,
  catches: s.catches,
  caught: { ...s.caught },
  friends: s.friends,
  missed: s.missed,
  left: timeLeft(s),
  stars: ghostStars(s),
  // Where the ghosts are (for the stage's data attribute)
  targets: s.ghosts
    .filter((g) => !g.caught && !g.bumped)
    .map((g) => {
      const p = ghostPos(s, g);
      return { x: Math.round(p.x), y: Math.round(p.y), lit: g.revealed ? 1 : 0, friend: KINDS[g.kind].ghost ? 0 : 1, k: Math.round(p.k * 10) / 10 };
    }),
});

function newFx() {
  return { time: 0, particles: [], texts: [], bats: [], nextBat: 2, cheer: 0, dark: null };
}

/**
 * "Nhà ma Gengar": ride through the (friendly) haunted house, shine the flashlight on the
 * glowing eyes, tap the ghosts to catch them - but not Clefairy and Togepi! 45 seconds.
 */
export function GhostHouseGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createGhostHouse({ random }));
  const game = useRef(first);
  const fx = useRef(newFx());
  const [ui, setUi] = useState(() => snap(first));
  const [banner, setBanner] = useState(null);
  const [bump, setBump] = useState(0);
  const later = useLater();
  const idRef = useRef(0);
  const hints = useRef(0);
  const img = loadImage(player.image);

  const say = (text, tone, ms = 1200) => {
    const id = ++idRef.current;
    setBanner({ text, tone, id });
    later(() => setBanner((b) => (b?.id === id ? null : b)), ms);
  };

  const onEvent = (e, v) => {
    if (e.type === 'peek') {
      sounds.playNote(KINDS[e.kind].ghost ? 196 : 294, { duration: 0.35, volume: 0.07 });
    } else if (e.type === 'reveal') {
      if (e.ghost) sounds.playNote(e.kind === 'gengar' ? 247 : 330, { duration: 0.18, volume: 0.14 });
      else sounds.playNote(1175, { duration: 0.18, volume: 0.14 });
      v.texts.push({ x: e.x, y: e.y - 46, text: e.ghost ? (e.kind === 'gengar' ? 'Hí hí!' : 'Boo!') : '💗', color: e.ghost ? '#e9d5ff' : '#fbcfe8', size: 18, life: 0.9, max: 0.9 });
    } else if (e.type === 'lightning') {
      sounds.playWhoosh();
      sounds.playNote(82, { duration: 0.6, delay: 0.15, volume: 0.25 });
    } else if (e.type === 'catch') {
      const k = KINDS[e.kind];
      sounds.playCoin();
      const notes = e.kind === 'gengar' ? [523, 659, 784, 1047, 1319] : [659, 880, 1175];
      notes.forEach((f, i) => sounds.playNote(f, { duration: 0.18, delay: 0.05 + i * 0.07, volume: 0.18 }));
      if (e.kind === 'gengar') sounds.playEnergySurge();
      burst(v.particles, e.x, e.y, { count: e.kind === 'gengar' ? 34 : 20, colors: ['#fde047', '#c4b5fd', '#ffffff', '#f0abfc'], speed: e.kind === 'gengar' ? 220 : 160, gravity: 60, size: 3.5, life: 0.9 });
      v.texts.push({ x: e.x, y: e.y - 30, text: 'Bắt được!', color: '#fde047', size: 22, life: 1.1, max: 1.1 });
      v.texts.push({ x: e.x, y: e.y - 6, text: `+${e.points}`, color: '#ffffff', size: 20, life: 1.1, max: 1.1 });
      v.cheer = 0.6;
      setBump((b) => b + 1);
      if (e.kind === 'gengar') say(`GENGAR! +${e.points} 🎉`, 'gold', 1100);
      else if (k.points >= 20 && Math.random() < 0.5) say(`Bắt được ${k.name}! 👻`, 'purple', 900);
    } else if (e.type === 'friend') {
      sounds.playOops();
      burst(v.particles, e.x, e.y, { count: 10, colors: ['#fbcfe8', '#f9a8d4', '#ffffff'], speed: 90, gravity: -40, size: 3 });
      v.texts.push({ x: e.x, y: e.y - 20, text: `${e.points}`, color: '#fda4af', size: 22, life: 1, max: 1 });
      say(`Ối! Là bạn ${KINDS[e.kind].name} mà! 💗`, 'pink', 1400);
    } else if (e.type === 'dark') {
      sounds.playNote(523, { duration: 0.08, volume: 0.1 });
      v.texts.push({ x: e.x, y: e.y - 36, text: '?', color: '#fef08a', size: 26, life: 0.7, max: 0.7 });
      if (hints.current < 2) {
        hints.current += 1;
        say('Soi đèn cho rõ đã rồi hãy chạm nhé! 🔦', 'soft', 1400);
      }
    } else if (e.type === 'end') {
      sounds.playWhoosh();
      later(() => setPhase('done'), 700);
    }
  };

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    v.cheer = Math.max(0, v.cheer - dt);
    if (phase === 'play') {
      stepGhostHouse(s, dt);
      for (const e of s.events.splice(0)) onEvent(e, v);
      setUi(snap(s));
    }
    // Cute bats flutter by now and then
    v.nextBat -= dt;
    if (v.nextBat <= 0) {
      v.nextBat = 4 + Math.random() * 4;
      const n = Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < n; i++) v.bats.push({ x: W + 20 + i * 30, y: 110 + Math.random() * 90 + i * 16, vx: -(70 + Math.random() * 40), phase: Math.random() * 6 });
    }
    for (let i = v.bats.length - 1; i >= 0; i--) {
      v.bats[i].x += v.bats[i].vx * dt;
      if (v.bats[i].x < -30) v.bats.splice(i, 1);
    }
    const ctx = getCtx();
    if (!ctx) {
      updateParticles(null, v.particles, dt);
      v.texts = v.texts.filter((q) => (q.life -= dt) > 0);
      return;
    }
    const t = v.time;
    ctx.clearRect(0, 0, W, H);
    // Wall
    const tile = wallTile();
    const off = Math.round(s.scroll % TILE);
    for (let x = -off; x < W; x += TILE) {
      if (tile) ctx.drawImage(tile, x, 0, TILE + 1, FLOOR_Y);
      else {
        ctx.fillStyle = '#3b0764';
        ctx.fillRect(x, 0, TILE, FLOOR_Y);
      }
    }
    // Wall pieces: windows, curtains, paintings, candles, cobwebs
    const candles = [];
    for (const spot of s.spots) {
      const x = spotScreenX(s, spot);
      if (x < -90 || x > W + 90) continue;
      const busy = s.ghosts.some((g) => g.spot === spot && !g.caught);
      if (spot.kind === 'window') drawWindow(ctx, x, spot.y, spot.w, spot.h, s.flash, t);
      else if (spot.kind === 'curtain') drawCurtain(ctx, x, spot.y, spot.w, spot.h, spot.side, t);
      else drawPainting(ctx, x, spot.y, spot.w, spot.h, busy, spot.id, t);
      if (spot.id % 2) {
        const cx = x + spot.w / 2 + 26;
        candles.push({ x: cx, y: 318 });
      }
      if (spot.id % 3 === 0) drawCobweb(ctx, x - spot.w / 2 - 10, 84, 34, false);
    }
    candles.forEach((c, i) => drawCandle(ctx, c.x, c.y, t, i));
    drawCobweb(ctx, 0, 0, 60, false);
    drawCobweb(ctx, W, 0, 60, true);
    drawFloor(ctx, s.scroll);
    // Ghosts in the dark (only seen inside the light)
    for (const g of s.ghosts) if (!g.caught && !g.revealed) drawGhost(ctx, g, ghostPos(s, g), t, 0.95);
    drawCart(ctx, img, t, s.scroll, s.light, v.cheer);
    drawDarkness(ctx, v, s, candles, t);
    // Glowing eyes, then the ones we can see
    for (const g of s.ghosts) if (!g.caught && !g.revealed) drawEyes(ctx, g, ghostPos(s, g), t);
    for (const g of s.ghosts) {
      if (g.caught || !g.revealed) continue;
      const p = ghostPos(s, g);
      const friend = !KINDS[g.kind].ghost;
      const pulse = (Math.sin(t * 6 + g.phase) + 1) / 2;
      const halo = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, 54);
      halo.addColorStop(0, friend ? 'rgba(251,207,232,0.55)' : 'rgba(196,181,253,0.55)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 54, 0, TAU);
      ctx.fill();
      drawGhost(ctx, g, p, t, g.bumped ? 0.6 : 1);
      if (!friend && !g.bumped) {
        // Target ring: tap me!
        ctx.strokeStyle = `rgba(253,224,71,${0.5 + pulse * 0.5})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -t * 20;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 36 + pulse * 4, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (friend) {
        ctx.font = '900 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(g.bumped ? '👋' : '💗', p.x + 26, p.y - 30 - pulse * 3);
      }
    }
    for (const g of s.ghosts) if (g.caught) drawCaught(ctx, g, t);
    for (const b of v.bats) drawBat(ctx, b, t);
    updateParticles(ctx, v.particles, dt);
    drawTexts(ctx, v.texts, dt);
    // Lightning flash (a soft white, never a shake)
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(237,233,254,${s.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Soft vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }, phase !== 'done');

  const point = (e) => (canvasRef.current ? canvasPoint(canvasRef.current, e, W, H) : null);
  const down = (e) => {
    if (phase !== 'play') return;
    const p = point(e);
    if (!p) return;
    tapGhost(game.current, p.x, p.y);
    for (const ev of game.current.events.splice(0)) onEvent(ev, fx.current);
    setUi(snap(game.current));
  };
  const move = (e) => {
    if (phase !== 'play') return;
    const p = point(e);
    if (p) aimLight(game.current, p.x, p.y);
  };

  useEffect(() => {
    // Arrows move the light, Space taps where it shines
    const onKey = (e) => {
      if (phase !== 'play') return;
      const s = game.current;
      const d = { ArrowLeft: [-30, 0], ArrowRight: [30, 0], ArrowUp: [0, -30], ArrowDown: [0, 30] }[e.code];
      if (d) {
        e.preventDefault();
        aimLight(s, s.aim.x + d[0], s.aim.y + d[1]);
      } else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        tapGhost(s, s.light.x, s.light.y);
        for (const ev of s.events.splice(0)) onEvent(ev, fx.current);
        setUi(snap(s));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const replay = () => {
    game.current = createGhostHouse({ random });
    fx.current = newFx();
    hints.current = 0;
    setUi(snap(game.current));
    setBanner(null);
    setPhase('ready');
  };

  const left = Math.ceil(ui.left);
  const c = ui.caught;

  return (
    <CarnivalShell
      title="👻 Nhà ma Gengar"
      label="Nhà ma Gengar"
      onClose={onClose}
      background="bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950"
      dataAttrs={{ 'data-phase': phase, 'data-score': ui.score, 'data-catches': ui.catches, 'data-friends': ui.friends }}
      hud={
        <>
          <HudBar
            items={[
              { icon: '⭐', label: 'Điểm', value: <span key={bump} className="score-bump">{ui.score}</span>, testId: 'ghost-score' },
              { icon: '👻', label: 'Bắt', value: ui.catches },
              { icon: '⏱', label: 'Còn', value: `${left}s`, warn: left <= 8 && phase === 'play' },
            ]}
          />
          <div className="mt-1 h-2 rounded-full bg-black/40 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-500 transition-[width] duration-200" style={{ width: `${(ui.left / DURATION) * 100}%` }} />
          </div>
        </>
      }
    >
      <div className="relative flex-1 min-h-0 flex items-start justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onContextMenu={(e) => e.preventDefault()}
          className="max-w-full max-h-full touch-none"
          style={{ aspectRatio: `${W} / ${H}`, height: '100%', width: 'auto' }}
          data-testid="ghost-stage"
          data-targets={JSON.stringify(ui.targets)}
        />
        {/* Who to catch, who to leave alone */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-2 flex items-center gap-1 rounded-2xl bg-black/55 px-2 py-1 pointer-events-none" aria-hidden="true">
          {['gastly', 'haunter', 'gengar'].map((k) => (
            <span key={k} className="relative flex flex-col items-center">
              <img src={artworkUrl(KINDS[k].dex)} alt="" className="w-8 h-8 object-contain" />
              <span className="text-[10px] font-black text-yellow-200 leading-none">+{KINDS[k].points}</span>
              {c[k] > 0 && <span key={c[k]} className="pop-in absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-emerald-400 text-[10px] font-black text-white flex items-center justify-center">{c[k]}</span>}
            </span>
          ))}
          <span className="mx-1 h-8 w-px bg-white/30" />
          {['clefairy', 'togepi'].map((k) => (
            <span key={k} className="relative flex flex-col items-center">
              <img src={artworkUrl(KINDS[k].dex)} alt="" className="w-7 h-7 object-contain opacity-90" />
              <span className="text-[10px] font-black text-rose-300 leading-none">🚫</span>
            </span>
          ))}
        </div>
        {phase === 'play' && ui.left > DURATION - 4 && (
          <p className="ghost-hint absolute left-1/2 top-[34%] whitespace-nowrap rounded-2xl bg-black/60 px-3 py-1.5 text-base font-black text-yellow-100 shadow-xl pointer-events-none">
            Kéo ngón tay để soi đèn 🔦
          </p>
        )}
        {banner && (
          <p key={banner.id} className={`banner-slam absolute top-[5%] inset-x-6 text-center text-lg font-black px-3 py-2 rounded-2xl shadow-xl pointer-events-none ${banner.tone === 'gold' ? 'bg-yellow-300 text-purple-900' : banner.tone === 'pink' ? 'bg-pink-400 text-white' : banner.tone === 'purple' ? 'bg-violet-500 text-white' : 'bg-white/90 text-slate-700'}`}>
            {banner.text}
          </p>
        )}
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Thợ săn ma siêu đẳng! 🏆' : ui.catches ? 'Dũng cảm lắm! 👻' : 'Lần sau soi đèn kỹ nhé! 🔦'}
            stars={ui.stars}
            detail={`${ui.score} điểm · bắt ${ui.catches} con ma${c.gengar ? ` · có ${c.gengar} Gengar!` : ''}${ui.friends ? ` · lỡ chạm ${ui.friends} bạn` : ''}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}

