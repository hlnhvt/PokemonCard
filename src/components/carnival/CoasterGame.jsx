import React, { useEffect, useRef, useState } from 'react';
import {
  CO_W as W,
  CO_H as H,
  VMAX,
  AIR_TIME,
  CART_GAP,
  createCoaster,
  stepCoaster,
  setHold,
  trackAt,
  pieceAt,
  climbAt,
  curveAt,
  curveAhead,
  coasterScore,
  coasterStars,
  smoothBonus,
  progress,
} from '../../utils/carnival/coaster';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, loadImage, drawSprite, burst, updateParticles } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const TAU = Math.PI * 2;
const GROUND = 70; // world y of the grass
const ANCHOR = { x: 118, y: 318 }; // where the camera keeps the front car
const FRIENDS = [
  ['Pikachu', 25],
  ['Eevee', 133],
  ['Jigglypuff', 39],
  ['Psyduck', 54],
  ['Togepi', 175],
  ['Bulbasaur', 1],
];
const CAR_COLORS = [
  ['#ef4444', '#b91c1c'],
  ['#3b82f6', '#1d4ed8'],
  ['#f59e0b', '#b45309'],
];

function pickFriends(name, random) {
  const pool = FRIENDS.filter(([n]) => n.toLowerCase() !== String(name || '').toLowerCase());
  const a = pool.splice(Math.floor(random() * pool.length), 1)[0];
  const b = pool.splice(Math.floor(random() * pool.length), 1)[0];
  return [a[1], b[1]];
}

// ---------- drawing ----------

function drawStar(ctx, x, y, r, rot, fill = '#fde047', stroke = '#ca8a04') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.25, r * 0.16, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawSky(ctx, camX, t) {
  const g = ctx.createLinearGradient(0, -150, 0, H + 150);
  g.addColorStop(0, '#38bdf8');
  g.addColorStop(0.55, '#bae6fd');
  g.addColorStop(0.8, '#fed7aa');
  g.addColorStop(1, '#fdba74');
  ctx.fillStyle = g;
  ctx.fillRect(-160, -160, W + 320, H + 320);
  // Sun
  ctx.fillStyle = 'rgba(254,240,138,0.5)';
  ctx.beginPath();
  ctx.arc(296, 70, 40, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(296, 70, 26, 0, TAU);
  ctx.fill();
  // Clouds (slow parallax)
  for (let i = 0; i < 6; i++) {
    const span = W + 360;
    const x = ((((i * 173 - camX * 0.08 - t * 6) % span) + span) % span) - 180;
    const y = 40 + ((i * 61) % 140);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, TAU);
    ctx.arc(x + 17, y - 7, 18, 0, TAU);
    ctx.arc(x + 38, y, 13, 0, TAU);
    ctx.fill();
  }
}

function drawSkyline(ctx, camX, camY, t) {
  // Far carnival: tents and a turning ferris wheel (parallax), sitting on the horizon
  const groundScreen = GROUND - camY;
  const base = Math.max(250, Math.min(620, 250 + groundScreen * 0.4));
  const off = -camX * 0.25;
  const span = 900;
  for (let k = -1; k <= 1; k++) {
    const ox = ((off % span) + span) % span - span + k * span + span;
    // Hills
    ctx.fillStyle = '#86efac';
    ctx.beginPath();
    ctx.moveTo(ox - 40, base + 200);
    for (let x = 0; x <= span + 80; x += 30) ctx.lineTo(ox + x - 40, base - 30 - Math.sin(x / 90) * 26 - Math.sin(x / 37) * 8);
    ctx.lineTo(ox + span + 40, base + 200);
    ctx.fill();
    // Ferris wheel
    const wx = ox + 220;
    const wy = base - 120;
    ctx.strokeStyle = 'rgba(190,24,93,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wx, wy, 70, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = t * 0.3 + (i * TAU) / 8;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(a) * 70, wy + Math.sin(a) * 70);
      ctx.stroke();
      ctx.fillStyle = ['#f472b6', '#38bdf8', '#fde047', '#a78bfa'][i % 4];
      ctx.beginPath();
      ctx.arc(wx + Math.cos(a) * 70, wy + Math.sin(a) * 70 + 6, 7, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(wx - 40, base);
    ctx.lineTo(wx, wy);
    ctx.lineTo(wx + 40, base);
    ctx.stroke();
    // Tents
    for (const [tx, tw, c] of [
      [430, 70, '#ef4444'],
      [540, 90, '#8b5cf6'],
      [680, 60, '#f59e0b'],
    ]) {
      const x = ox + tx;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x - tw / 2, base - 10);
      ctx.lineTo(x, base - tw * 0.9);
      ctx.lineTo(x + tw / 2, base - 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(x - tw / 6, base - 10);
      ctx.lineTo(x, base - tw * 0.9);
      ctx.lineTo(x + tw / 6, base - 10);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.fillRect(x - tw / 2, base - 12, tw, 12);
    }
  }
}

function drawGroundDecor(ctx, camX, t) {
  // Bushes, trees, flowers and balloons along the grass (world space)
  const start = Math.floor((camX - 120) / 80);
  for (let i = start; i < start + 9; i++) {
    const x = i * 80 + ((i * 37) % 30);
    const h = (i * 7919) % 5;
    const y = GROUND + 6;
    if (h === 0) {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(x - 3, y - 28, 6, 30);
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(x, y - 36, 17, 0, TAU);
      ctx.arc(x - 12, y - 26, 12, 0, TAU);
      ctx.arc(x + 12, y - 26, 12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      for (const [ax, ay] of [[-6, -38], [7, -30], [-10, -24]]) {
        ctx.beginPath();
        ctx.arc(x + ax, y + ay, 2.5, 0, TAU);
        ctx.fill();
      }
    } else if (h === 1 || h === 3) {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(x, y - 4, 11, Math.PI, 0);
      ctx.arc(x + 14, y - 4, 9, Math.PI, 0);
      ctx.fill();
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = ['#fde047', '#f9a8d4', '#ffffff', '#c4b5fd'][(i + k) % 4];
        ctx.beginPath();
        ctx.arc(x - 16 + k * 12, y + 10 + (k % 2) * 6, 2.6, 0, TAU);
        ctx.fill();
      }
    } else if (h === 2) {
      // A bunch of balloons tied to a post
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const bx = x + (k - 1) * 10 + Math.sin(t * 1.5 + k + i) * 3;
        const by = y - 58 - (k % 2) * 10;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(bx, by + 9);
        ctx.stroke();
        ctx.fillStyle = ['#f43f5e', '#38bdf8', '#facc15'][k];
        ctx.beginPath();
        ctx.ellipse(bx, by, 7, 9, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(bx - 2.5, by - 3, 1.8, 0, TAU);
        ctx.fill();
      }
    }
  }
  // Lighter mowing stripes for depth
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let k = 0; k < 4; k++) ctx.fillRect(camX - 200, GROUND + 34 + k * 46, W + 400, 18);
}

function visibleRange(track, camX) {
  // Indices of the samples roughly on screen (loops go back in x, so scan by x)
  const xs = track.xs;
  let lo = 0;
  while (lo < xs.length - 1 && xs[lo] < camX - 220) lo++;
  let hi = lo;
  while (hi < xs.length - 1 && (xs[hi] < camX + W + 220 || hi - lo < 4)) hi++;
  return [Math.max(0, lo - 60), Math.min(xs.length - 1, hi + 60)];
}

function drawTrack(ctx, s, lo, hi, t) {
  const tr = s.track;
  const { xs, ys } = tr;
  // Supports: white lattice legs down to the grass (not under loops)
  ctx.lineWidth = 3;
  for (let i = lo; i <= hi; i += 10) {
    const p = pieceAt(tr, tr.dist[i]);
    if (p.kind === 'loop') continue;
    const x = xs[i];
    const y = ys[i] + 8;
    if (y > GROUND - 4) continue;
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, GROUND);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(148,163,184,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let yy = y; yy < GROUND - 20; yy += 26) {
      ctx.moveTo(x, yy);
      ctx.lineTo(x + 20, yy + 26);
    }
    ctx.stroke();
    ctx.lineWidth = 3;
  }
  // Loop supports: one tall leg in the middle
  for (const p of tr.pieces) {
    if (p.kind !== 'loop' || p.d1 < tr.dist[lo] || p.d0 > tr.dist[hi]) continue;
    const a = trackAt(tr, p.d0);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(a.x + 20, a.y - 60);
    ctx.lineTo(a.x + 20, GROUND);
    ctx.stroke();
  }
  // Curves glow in warning colours
  for (const c of tr.curves) {
    if (c.d1 < tr.dist[lo] || c.d0 > tr.dist[hi]) continue;
    ctx.save();
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.setLineDash([12, 12]);
    ctx.lineDashOffset = -t * 30;
    ctx.strokeStyle = '#facc15';
    ctx.beginPath();
    for (let d = c.d0; d <= c.d1; d += 8) {
      const p = trackAt(tr, d);
      if (d === c.d0) ctx.moveTo(p.x, p.y + 4);
      else ctx.lineTo(p.x, p.y + 4);
    }
    ctx.stroke();
    ctx.strokeStyle = '#1e293b';
    ctx.lineDashOffset = -t * 30 + 12;
    ctx.stroke();
    ctx.restore();
  }
  // Rails: a thick bottom rail, ties, a bright top rail
  const rail = (off, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = lo; i <= hi; i += 2) {
      const j = Math.min(xs.length - 1, i + 1);
      const a = Math.atan2(ys[j] - ys[i], xs[j] - xs[i]);
      const x = xs[i] - Math.sin(a) * off;
      const y = ys[i] + Math.cos(a) * off;
      if (i === lo) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  ctx.lineJoin = 'round';
  rail(8, '#7f1d1d', 5);
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = lo - (lo % 4); i <= hi; i += 4) {
    if (i < 0) continue;
    const j = Math.min(xs.length - 1, i + 1);
    const a = Math.atan2(ys[j] - ys[i], xs[j] - xs[i]);
    ctx.moveTo(xs[i], ys[i]);
    ctx.lineTo(xs[i] - Math.sin(a) * 10, ys[i] + Math.cos(a) * 10);
  }
  ctx.stroke();
  rail(0, '#dc2626', 5);
  rail(-1.5, 'rgba(254,202,202,0.9)', 1.5);
  // Warning signs before the curves
  for (const c of tr.curves) {
    const p = trackAt(tr, c.sign);
    if (p.x < xs[lo] - 40 || p.x > xs[hi] + 40) continue;
    const blink = Math.sin(t * 8) > 0;
    ctx.fillStyle = '#475569';
    ctx.fillRect(p.x - 2, p.y - 70, 4, 62);
    ctx.save();
    ctx.translate(p.x, p.y - 84);
    ctx.fillStyle = blink ? '#fde047' : '#facc15';
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(24, 18);
    ctx.lineTo(-24, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // A curved arrow
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(4, 8, 9, Math.PI * 1.05, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(14, 1);
    ctx.lineTo(9, -3);
    ctx.lineTo(16, -6);
    ctx.fill();
    ctx.restore();
    if (blink) {
      ctx.fillStyle = 'rgba(254,240,138,0.35)';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 80, 34, 0, TAU);
      ctx.fill();
    }
  }
}

function drawStation(ctx, x, y, label, colors) {
  ctx.fillStyle = '#a16207';
  ctx.fillRect(x - 70, y + 10, 150, 12);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(x - 64, y - 96, 6, 106);
  ctx.fillRect(x + 66, y - 96, 6, 106);
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.moveTo(x - 80, y - 90);
  ctx.lineTo(x + 4, y - 128);
  ctx.lineTo(x + 88, y - 90);
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = i % 2 ? colors[1] : '#fff7ed';
    ctx.beginPath();
    ctx.moveTo(x - 80 + i * 24, y - 90);
    ctx.lineTo(x - 68 + i * 24, y - 76);
    ctx.lineTo(x - 56 + i * 24, y - 90);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + 4, y - 97);
}

function drawStars(ctx, s, t, lo, hi) {
  const tr = s.track;
  const d0 = tr.dist[lo];
  const d1 = tr.dist[hi];
  for (let i = s.nextStar; i < tr.stars.length; i++) {
    const st = tr.stars[i];
    if (st.d > d1) break;
    if (st.d < d0) continue;
    const p = trackAt(tr, st.d);
    const x = p.x + Math.sin(p.angle) * st.h;
    const y = p.y - Math.cos(p.angle) * st.h + Math.sin(t * 3 + i) * 4;
    const r = st.high ? 13 : 10;
    ctx.fillStyle = st.high ? 'rgba(253,224,71,0.35)' : 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(x, y, r * 1.8, 0, TAU);
    ctx.fill();
    drawStar(ctx, x, y, r, Math.sin(t * 2 + i) * 0.4, st.high ? '#fde047' : '#fef08a');
    if (st.high && Math.sin(t * 6 + i) > 0.6) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + r, y - r, 2.5, 0, TAU);
      ctx.fill();
    }
  }
}

function drawCar(ctx, img, x, y, angle, colors, riderHop, arms) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Rider sits in the car (drawn upright relative to the car)
  drawSprite(ctx, img, 0, -32 - riderHop, 52);
  if (arms) {
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -28);
    ctx.lineTo(-17, -48 - riderHop);
    ctx.moveTo(10, -28);
    ctx.lineTo(17, -48 - riderHop);
    ctx.stroke();
  }
  // Car body
  ctx.fillStyle = colors[0];
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-19, -20);
  ctx.lineTo(19, -20);
  ctx.quadraticCurveTo(24, -20, 23, -12);
  ctx.lineTo(20, -4);
  ctx.lineTo(-20, -4);
  ctx.lineTo(-23, -12);
  ctx.quadraticCurveTo(-24, -20, -19, -20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fde047';
  ctx.fillRect(-18, -15, 36, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(-16, -19, 10, 2);
  // Wheels
  ctx.fillStyle = '#1e293b';
  for (const wx of [-12, 12]) {
    ctx.beginPath();
    ctx.arc(wx, -2, 4.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawWind(ctx, v, t) {
  const k = Math.max(0, (v - 140) / (VMAX - 140));
  if (k <= 0) return;
  ctx.strokeStyle = `rgba(255,255,255,${0.25 + k * 0.45})`;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const n = Math.round(4 + k * 10);
  for (let i = 0; i < n; i++) {
    const y = 60 + ((i * 97) % (H - 120));
    const len = 30 + k * 60 + (i % 3) * 12;
    const x = W - ((t * (500 + k * 600) + i * 131) % (W + len * 2)) + len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
}

// ---------- the game ----------

const snap = (s) => {
  const piece = pieceAt(s.track, s.d);
  return {
    got: s.got,
    v: Math.max(0, s.v),
    progress: progress(s),
    holding: s.holding,
    climb: climbAt(s) > 0.08 && piece.kind !== 'loop' && s.roll <= 0,
    warn: !!curveAhead(s.track, s.d),
    inCurve: !!curveAt(s.track, s.d),
    lift: s.lift,
    roll: s.roll > 0,
    status: s.status,
    score: coasterScore(s),
    stars: coasterStars(s),
    airs: s.airs,
    rollbacks: s.rollbacks,
    wobbles: s.wobbles,
    smooth: smoothBonus(s),
    total: s.track.stars.length,
  };
};

function newFx() {
  return { time: 0, camX: 0, camY: 0, tilt: 0, particles: [], flying: [], cheer: 0, placed: false };
}

/**
 * "Tàu lượn siêu tốc": HOLD to speed up the train on the way up, LET GO on the sharp curves with
 * a warning sign. Come over the hill tops fast to fly up to the high stars.
 */
export function CoasterGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createCoaster({ random }));
  const game = useRef(first);
  const fx = useRef(newFx());
  const [friends] = useState(() => pickFriends(player.name, random));
  const [ui, setUi] = useState(() => snap(first));
  const [banner, setBanner] = useState(null);
  const [bump, setBump] = useState(0);
  const later = useLater();
  const idRef = useRef(0);
  const img = loadImage(player.image);
  const friendImgs = friends.map((d) => loadImage(artworkUrl(d)));

  const say = (text, tone, ms = 1100) => {
    const id = ++idRef.current;
    setBanner({ text, tone, id });
    later(() => setBanner((b) => (b?.id === id ? null : b)), ms);
  };

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    v.cheer = Math.max(0, v.cheer - dt);
    const front = trackAt(s.track, s.d);
    if (phase === 'play') {
      stepCoaster(s, dt);
      for (const e of s.events.splice(0)) {
        if (e.type === 'star') {
          sounds.playNote(e.high ? 1319 : 1047 + (s.got % 4) * 110, { duration: 0.12, volume: 0.18 });
          if (e.high) sounds.playCoin();
          const st = s.track.stars[e.index];
          const p = trackAt(s.track, st.d);
          const x = p.x + Math.sin(p.angle) * st.h;
          const y = p.y - Math.cos(p.angle) * st.h;
          burst(v.particles, x, y, { count: e.high ? 14 : 8, colors: ['#fde047', '#ffffff', '#facc15'], speed: 120, gravity: 120, size: 3 });
          setBump((b) => b + 1);
        } else if (e.type === 'air') {
          sounds.playEnergySurge();
          say('Bay lên nào! ✨', 'gold', 900);
          v.cheer = 1;
        } else if (e.type === 'slowtop') {
          say('Chậm quá, không với tới sao trên cao 😅', 'soft', 1000);
        } else if (e.type === 'rollback') {
          sounds.playOops();
          say(e.lost ? `Ối! Tụt dốc, rơi ${e.lost} sao! Giữ để leo nhé!` : 'Ối! Tụt dốc rồi! Giữ để leo nhé!', 'red', 1500);
          for (let i = 0; i < e.lost; i++) v.flying.push({ x: front.x + i * 10, y: front.y - 30, vx: -60 + i * 50, vy: -220, life: 1.2, rot: 0 });
        } else if (e.type === 'wobble') {
          sounds.playNote(220, { duration: 0.2, volume: 0.2 });
          if (e.lost) {
            sounds.playOops();
            v.flying.push({ x: front.x, y: front.y - 30, vx: 40 + Math.random() * 60, vy: -240, life: 1.2, rot: 0 });
          }
          say('Chòng chành! Thả tay ra ở khúc cua!', 'red', 1000);
        } else if (e.type === 'curve') {
          sounds.playNote(880, { duration: 0.1, volume: 0.2 });
          sounds.playNote(880, { duration: 0.1, delay: 0.18, volume: 0.2 });
        } else if (e.type === 'loop') {
          sounds.playWhoosh();
          say('Vòng nhào lộn! 🌀', 'blue', 1000);
          v.cheer = 1.2;
        } else if (e.type === 'whee') {
          sounds.playWhoosh();
          v.cheer = 1.2;
          say(['Yeee! 🙌', 'Vui quá! 🎉', 'Wooo! 🎢'][Math.floor(Math.random() * 3)], 'gold', 800);
        } else if (e.type === 'end') {
          sounds.playWhoosh();
          later(() => setPhase('done'), 900);
        }
      }
      setUi(snap(s));
    }
    // Camera: follow the front car (look a little ahead), tilt a bit with the slope
    const cart = trackAt(s.track, s.d);
    const tx = cart.x - ANCHOR.x + Math.max(0, s.v) * 0.12;
    const ty = cart.y - ANCHOR.y;
    if (!v.placed) {
      v.camX = tx;
      v.camY = ty;
      v.placed = true;
    }
    const f = Math.min(1, dt * 5);
    v.camX += (tx - v.camX) * f;
    v.camY += (ty - v.camY) * Math.min(1, dt * 3.5);
    const inLoop = pieceAt(s.track, s.d).kind === 'loop';
    const tiltTarget = inLoop ? 0 : Math.max(-0.5, Math.min(0.5, cart.angle)) * 0.28;
    v.tilt += (tiltTarget - v.tilt) * Math.min(1, dt * 3);
    const ctx = getCtx();
    if (!ctx) {
      updateParticles(null, v.particles, dt);
      return;
    }
    const t = v.time;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-v.tilt);
    ctx.translate(-W / 2, -H / 2);
    drawSky(ctx, v.camX, t);
    drawSkyline(ctx, v.camX, v.camY, t);
    ctx.save();
    ctx.translate(-v.camX, -v.camY);
    // Grass
    const gy = GROUND;
    const grass = ctx.createLinearGradient(0, gy, 0, gy + 200);
    grass.addColorStop(0, '#4ade80');
    grass.addColorStop(1, '#15803d');
    ctx.fillStyle = grass;
    ctx.fillRect(v.camX - 200, gy, W + 400, Math.max(200, v.camY + H + 200 - gy));
    ctx.fillStyle = 'rgba(21,128,61,0.5)';
    for (let x = Math.floor((v.camX - 200) / 40) * 40; x < v.camX + W + 200; x += 40) {
      ctx.beginPath();
      ctx.arc(x + 12, gy + 2, 10, Math.PI, 0);
      ctx.fill();
    }
    drawGroundDecor(ctx, v.camX, t);
    const [lo, hi] = visibleRange(s.track, v.camX);
    drawStation(ctx, 70, 0, 'XUẤT PHÁT', ['#ef4444', '#fde047']);
    const end = trackAt(s.track, s.track.length - 120);
    if (Math.abs(end.x - v.camX) < W + 300) drawStation(ctx, end.x, end.y, 'VỀ ĐÍCH 🏁', ['#8b5cf6', '#f472b6']);
    drawTrack(ctx, s, lo, hi, t);
    drawStars(ctx, s, t, lo, hi);
    // The train: the child's Pokemon in front, two friends behind
    const hop = s.air > 0 ? Math.sin(Math.PI * (1 - s.air / AIR_TIME)) * 26 : 0;
    const wob = s.wobble > 0 ? Math.sin(t * 38) * 0.16 * (s.wobble / 0.7) : 0;
    const arms = v.cheer > 0 || hop > 0;
    const riders = [img, ...friendImgs];
    for (let i = 2; i >= 0; i--) {
      const p = trackAt(s.track, Math.max(0, s.d - i * CART_GAP));
      const n = { x: Math.sin(p.angle), y: -Math.cos(p.angle) };
      const riderHop = arms ? Math.abs(Math.sin(t * 10 + i)) * 5 : Math.abs(Math.sin(t * 4 + i)) * 1.5;
      drawCar(ctx, riders[i], p.x + n.x * hop, p.y + n.y * hop - 4 * Math.cos(p.angle), p.angle + wob * (i % 2 ? -1 : 1), CAR_COLORS[i], riderHop, arms);
    }
    // Stars that fell out of the cart
    for (let i = v.flying.length - 1; i >= 0; i--) {
      const q = v.flying[i];
      q.life -= dt;
      if (q.life <= 0) {
        v.flying.splice(i, 1);
        continue;
      }
      q.vy += 500 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += dt * 8;
      ctx.globalAlpha = Math.min(1, q.life * 2);
      drawStar(ctx, q.x, q.y, 10, q.rot, '#fef08a');
      ctx.globalAlpha = 1;
    }
    updateParticles(ctx, v.particles, dt);
    ctx.restore();
    ctx.restore();
    drawWind(ctx, s.v, t);
    // Speed glow at the edges when going fast
    const k = Math.max(0, (s.v - 200) / (VMAX - 200));
    if (k > 0) {
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, 'rgba(255,255,255,0)');
      vg.addColorStop(1, `rgba(255,255,255,${k * 0.35})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
  }, phase !== 'done');

  const hold = (on) => {
    if (phase !== 'play') return;
    setHold(game.current, on);
    if (on) sounds.playNote(440, { duration: 0.05, volume: 0.08 });
    setUi(snap(game.current));
  };

  useEffect(() => {
    const down = (e) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp' && e.code !== 'ArrowRight') return;
      e.preventDefault();
      if (!e.repeat) hold(true);
    };
    const up = (e) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp' && e.code !== 'ArrowRight') return;
      e.preventDefault();
      hold(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const replay = () => {
    game.current = createCoaster({ random });
    fx.current = newFx();
    setUi(snap(game.current));
    setBanner(null);
    setPhase('ready');
  };

  const speed = Math.min(1, ui.v / VMAX);
  const needle = -90 + speed * 180;
  const hint = phase !== 'play' ? null : ui.warn && ui.holding ? 'release' : ui.warn ? 'curve' : ui.climb && !ui.holding ? 'hold' : null;

  return (
    <CarnivalShell
      title="🎢 Tàu lượn siêu tốc"
      label="Tàu lượn siêu tốc"
      onClose={onClose}
      background="bg-gradient-to-b from-sky-400 via-sky-300 to-orange-300"
      dataAttrs={{ 'data-phase': phase, 'data-score': ui.score, 'data-stars-got': ui.got, 'data-holding': ui.holding ? 'yes' : 'no', 'data-warn': ui.warn ? 'yes' : 'no', 'data-climb': ui.climb ? 'yes' : 'no' }}
      hud={
        <>
          <HudBar
            items={[
              { icon: '⭐', label: 'Sao', value: <span key={bump} className="score-bump">{ui.got}</span>, testId: 'coaster-stars' },
              { icon: '🎢', label: 'Chặng', value: `${Math.round(ui.progress * 100)}%` },
              { icon: '💨', label: 'Êm', value: ui.smooth },
            ]}
          />
          <div className="relative mt-1 h-2.5 rounded-full bg-black/30 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-yellow-300 via-orange-400 to-rose-500" style={{ width: `${ui.progress * 100}%` }} />
            <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-xs" style={{ left: `${Math.max(3, ui.progress * 100)}%` }} aria-hidden="true">
              🚃
            </span>
          </div>
        </>
      }
    >
      <div
        className="relative flex-1 min-h-0 flex items-start justify-center overflow-hidden touch-none"
        onPointerDown={(e) => {
          if (phase !== 'play') return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          hold(true);
        }}
        onPointerUp={() => hold(false)}
        onPointerCancel={() => hold(false)}
        onLostPointerCapture={() => hold(false)}
        onContextMenu={(e) => e.preventDefault()}
        data-testid="coaster-stage"
      >
        <canvas ref={canvasRef} className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, height: '100%', width: 'auto' }} />
        {/* Speed gauge */}
        <div className="absolute left-2 bottom-2 w-28 rounded-2xl bg-slate-900/70 px-2 pt-1 pb-1.5 shadow-lg pointer-events-none" data-testid="coaster-gauge" aria-hidden="true">
          <svg viewBox="0 0 100 60" className="w-full">
            <path d="M10 52a40 40 0 0 1 80 0" fill="none" stroke="#334155" strokeWidth="10" strokeLinecap="round" />
            <path d="M10 52a40 40 0 0 1 26-37.5" fill="none" stroke="#38bdf8" strokeWidth="10" strokeLinecap="round" />
            <path d="M40 13a40 40 0 0 1 28 3" fill="none" stroke="#4ade80" strokeWidth="10" />
            <path d="M72 18a40 40 0 0 1 18 34" fill="none" stroke="#f97316" strokeWidth="10" strokeLinecap="round" />
            <g transform={`rotate(${needle} 50 52)`}>
              <path d="M47 52L50 16L53 52z" fill="#fde047" stroke="#a16207" strokeWidth="1" />
            </g>
            <circle cx="50" cy="52" r="6" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
          </svg>
          <p className="text-center text-[10px] font-black tracking-wider text-white/90">TỐC ĐỘ</p>
        </div>
        {/* Hold button look-alike: the whole screen is the button */}
        <div className={`absolute right-3 bottom-3 w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center gap-0.5 font-black shadow-xl pointer-events-none transition-transform duration-100 ${ui.holding ? 'scale-90 bg-gradient-to-b from-orange-400 to-rose-600 border-yellow-200 text-white shadow-[0_0_24px_rgba(251,146,60,0.9)]' : 'bg-gradient-to-b from-white to-slate-200 border-rose-400 text-rose-600'}`} aria-hidden="true">
          <span className="text-2xl leading-none">{ui.holding ? '🔥' : '👆'}</span>
          <span className="text-[11px] leading-none">{ui.holding ? 'TĂNG TỐC' : 'GIỮ'}</span>
        </div>
        {hint === 'hold' && (
          <p className="coaster-hint absolute left-1/2 top-[30%] whitespace-nowrap rounded-2xl bg-orange-500/90 px-3 py-1.5 text-lg font-black text-white shadow-xl pointer-events-none" data-testid="coaster-hint">
            Giữ để leo dốc! 👆
          </p>
        )}
        {(hint === 'curve' || hint === 'release') && (
          <p className={`coaster-warn absolute left-1/2 top-[30%] whitespace-nowrap rounded-2xl px-3 py-1.5 text-lg font-black shadow-xl pointer-events-none ${hint === 'release' ? 'bg-rose-600 text-white' : 'bg-yellow-300 text-rose-700'}`} data-testid="coaster-hint">
            ⚠️ Cua gấp! {hint === 'release' ? 'THẢ TAY RA!' : 'Đừng giữ nhé'}
          </p>
        )}
        {banner && (
          <p key={banner.id} className={`banner-slam absolute top-[8%] inset-x-6 text-center text-lg font-black px-3 py-2 rounded-2xl shadow-xl pointer-events-none ${banner.tone === 'red' ? 'bg-rose-500 text-white' : banner.tone === 'gold' ? 'bg-yellow-300 text-amber-900' : banner.tone === 'blue' ? 'bg-sky-500 text-white' : 'bg-white/90 text-slate-700'}`}>
            {banner.text}
          </p>
        )}
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} text="XUẤT PHÁT!" />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Vua tàu lượn! 🏆' : ui.stars === 2 ? 'Chuyến đi tuyệt vời! 🎢' : 'Lần sau giữ – thả khéo hơn nhé! 💪'}
            stars={ui.stars}
            detail={`${ui.got} sao · ${ui.airs} lần bay · điểm êm ${ui.smooth}${ui.rollbacks ? ` · tụt dốc ${ui.rollbacks} lần` : ''}${ui.wobbles ? ` · chòng chành ${ui.wobbles} lần` : ''}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
