import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  DARTS_W as W,
  DARTS_H as H,
  DARTS,
  HAND,
  FLIGHT,
  BALLOON_R,
  createDarts,
  stepDarts,
  throwDart,
  aimFromSwipe,
  balloonPos,
  balloonAt,
  dartAt,
  dartsStars,
} from '../../utils/carnival/darts';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite, imageReady } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const TAU = Math.PI * 2;
const COLORS = [
  ['#f87171', '#dc2626', '#7f1d1d'],
  ['#60a5fa', '#2563eb', '#1e3a8a'],
  ['#4ade80', '#16a34a', '#14532d'],
  ['#fb923c', '#ea580c', '#7c2d12'],
  ['#c084fc', '#9333ea', '#4c1d95'],
  ['#f472b6', '#db2777', '#831843'],
];
const GOLD = ['#fef08a', '#facc15', '#a16207'];
const tone = (c) => (c === 'gold' ? GOLD : COLORS[c] || COLORS[0]);
const CONFETTI = ['#fde047', '#f472b6', '#38bdf8', '#4ade80', '#ffffff', '#fb923c'];
const PLAYER_AT = { x: 118, y: 500 };
const PRIZES = [143, 133, 25, 39];

/** Canvas size that fits the stage (centred, never overflowing). */
function useFit(ref) {
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const k = Math.min(w / W, h / H);
      setSize((old) => (old && old.w === Math.floor(W * k) ? old : { w: Math.floor(W * k), h: Math.floor(H * k) }));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// ---------- the stall, painted once ----------
let sceneCache = null;
function scene() {
  if (sceneCache || typeof document === 'undefined') return sceneCache;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  // Night fair behind
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1e1b4b');
  sky.addColorStop(0.6, '#4c1d95');
  sky.addColorStop(1, '#2e1065');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Posts
  for (const x of [6, W - 20]) {
    const g = ctx.createLinearGradient(x, 0, x + 14, 0);
    g.addColorStop(0, '#92400e');
    g.addColorStop(0.5, '#d97706');
    g.addColorStop(1, '#78350f');
    ctx.fillStyle = g;
    ctx.fillRect(x, 40, 14, 400);
  }
  // Back board: wooden frame, cork inside
  ctx.fillStyle = '#7c2d12';
  roundRect(ctx, 22, 66, W - 44, 296, 14);
  ctx.fill();
  const cork = ctx.createLinearGradient(0, 74, 0, 354);
  cork.addColorStop(0, '#d6a266');
  cork.addColorStop(1, '#b7793f');
  ctx.fillStyle = cork;
  roundRect(ctx, 30, 74, W - 60, 280, 9);
  ctx.fill();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '120,53,15' : '254,243,199'},${0.12 + rnd() * 0.18})`;
    ctx.beginPath();
    ctx.arc(32 + rnd() * (W - 64), 76 + rnd() * 276, 0.8 + rnd() * 1.6, 0, TAU);
    ctx.fill();
  }
  // Inner shadow at the top of the board
  const sh = ctx.createLinearGradient(0, 74, 0, 110);
  sh.addColorStop(0, 'rgba(0,0,0,0.35)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(30, 74, W - 60, 36);
  // Counter
  const top = ctx.createLinearGradient(0, 392, 0, 408);
  top.addColorStop(0, '#fcd34d');
  top.addColorStop(1, '#b45309');
  ctx.fillStyle = top;
  ctx.fillRect(0, 392, W, 16);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#fef3c7' : '#e11d48';
    ctx.fillRect(i * 30, 408, 30, 44);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 408, W, 6);
  // Floor
  const floor = ctx.createLinearGradient(0, 452, 0, H);
  floor.addColorStop(0, '#3b0764');
  floor.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 452, W, H - 452);
  const spot = ctx.createRadialGradient(180, 520, 10, 180, 520, 170);
  spot.addColorStop(0, 'rgba(253,224,71,0.22)');
  spot.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 452, W, H - 452);
  // Awning with scallops
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#fef3c7' : '#ef4444';
    ctx.fillRect(i * 30, 0, 30, 40);
    ctx.beginPath();
    ctx.arc(i * 30 + 15, 40, 15, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 34, W, 6);
  sceneCache = c;
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawLights(ctx, t, flash) {
  for (let i = 0; i < 12; i++) {
    const x = i * 30 + 15;
    const on = (Math.floor(t * 4) + i) % 3 !== 0 || flash > 0;
    const c = ['#fde047', '#f472b6', '#38bdf8'][i % 3];
    ctx.fillStyle = on ? c : 'rgba(255,255,255,0.25)';
    if (on) {
      ctx.shadowColor = c;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.arc(x, 58, 4, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawPrizes(ctx, t) {
  // Plushies on the counter corners
  [
    [34, 380, 0],
    [326, 380, 1],
  ].forEach(([x, y, i]) => {
    const dex = PRIZES[(i + Math.floor(t / 6)) % PRIZES.length];
    drawSprite(ctx, loadImage(artworkUrl(dex)), x, y + Math.sin(t * 2 + i) * 1.5, 50, { color: '#fbbf24' });
  });
}

function drawBalloon(ctx, x, y, pin, color, t, phase, jig, glow) {
  const [light, mid, dark] = tone(color);
  const r = BALLOON_R;
  const wob = jig > 0 ? Math.sin(jig * 40) * jig * 0.35 : 0;
  // String down to the pin
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y + r + 4);
  const sway = Math.sin(t * 2 + phase) * 4;
  ctx.bezierCurveTo(x + sway, y + r + 14, pin.x - sway, pin.y - 12, pin.x, pin.y);
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.3 + phase) * 0.06);
  ctx.scale(1 + wob, 1 - wob);
  if (glow) {
    ctx.shadowColor = color === 'gold' ? '#fde047' : '#ffffff';
    ctx.shadowBlur = glow;
  }
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, 2, 0, 0, r * 1.25);
  g.addColorStop(0, light);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.9, r, 0, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Knot
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.moveTo(-4, r - 1);
  ctx.lineTo(4, r - 1);
  ctx.lineTo(0, r + 5);
  ctx.closePath();
  ctx.fill();
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.45, r * 0.18, r * 0.3, -0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(-r * 0.1, -r * 0.72, 2, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (color === 'gold') {
    // Twinkles round the rare ones
    for (let i = 0; i < 3; i++) {
      const a = t * 1.5 + phase + (i * TAU) / 3;
      const k = (Math.sin(t * 5 + i * 2) + 1) / 2;
      star(ctx, x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 4), 2 + k * 3, `rgba(255,255,255,${0.4 + k * 0.6})`);
    }
  }
}

function star(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const d = i % 2 ? r * 0.35 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}

/** A dart pointing along `angle` (tip first), `scale` for depth. */
function drawDart(ctx, x, y, angle, scale = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  // Flights
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-26, -9);
  ctx.lineTo(-22, 0);
  ctx.lineTo(-26, 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-24, -4);
  ctx.lineTo(-24, 4);
  ctx.closePath();
  ctx.fill();
  // Shaft and barrel
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-24, 0);
  ctx.lineTo(0, 0);
  ctx.stroke();
  const g = ctx.createLinearGradient(0, -3, 0, 3);
  g.addColorStop(0, '#e2e8f0');
  g.addColorStop(1, '#64748b');
  ctx.fillStyle = g;
  roundRect(ctx, -6, -3, 16, 6, 3);
  ctx.fill();
  // Tip
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(10, -1.5);
  ctx.lineTo(20, 0);
  ctx.lineTo(10, 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStuck(ctx, d, t, at) {
  // Seen from behind: flights towards us, a little wobble just after it lands
  const age = t - at;
  const wob = age < 0.6 ? Math.sin(age * 45) * (0.6 - age) * 0.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(d.x, d.y, 2.2, 0, TAU);
  ctx.fill();
  drawDart(ctx, d.x + 1, d.y + 10, -Math.PI / 2 + d.tilt + wob, 0.55);
}

function drawAim(ctx, from, to, t, onBalloon) {
  ctx.save();
  ctx.setLineDash([6, 8]);
  ctx.lineDashOffset = -t * 40;
  ctx.strokeStyle = onBalloon ? 'rgba(253,224,71,0.95)' : 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const arc = 22 + Math.abs(from.y - to.y) * 0.08;
  for (let k = 0; k <= 1.001; k += 0.05) {
    const x = from.x + (to.x - from.x) * k;
    const y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * arc;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  const pulse = 1 + Math.sin(t * 10) * 0.12;
  ctx.strokeStyle = onBalloon ? '#fde047' : '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(to.x, to.y, 12 * pulse, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x - 18, to.y);
  ctx.lineTo(to.x - 7, to.y);
  ctx.moveTo(to.x + 7, to.y);
  ctx.lineTo(to.x + 18, to.y);
  ctx.moveTo(to.x, to.y - 18);
  ctx.lineTo(to.x, to.y - 7);
  ctx.moveTo(to.x, to.y + 7);
  ctx.lineTo(to.x, to.y + 18);
  ctx.stroke();
  ctx.restore();
}

// ---------- effects ----------
function shreds(list, x, y, color) {
  const [light, mid] = tone(color);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + Math.random() * 0.5;
    const v = 120 + Math.random() * 170;
    list.push({ kind: 'shred', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 20, w: 5 + Math.random() * 6, h: 3 + Math.random() * 3, color: i % 2 ? light : mid, life: 0.9, max: 0.9, g: 520 });
  }
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * TAU;
    const v = 60 + Math.random() * 220;
    list.push({ kind: 'confetti', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, w: 5, h: 3, color: CONFETTI[i % CONFETTI.length], life: 1.3, max: 1.3, g: 300 });
  }
  list.push({ kind: 'ring', x, y, r: BALLOON_R, life: 0.35, max: 0.35, color: light });
}

function explosion(list, x, y) {
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * TAU;
    const v = 80 + Math.random() * 260;
    list.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 3 + Math.random() * 3, color: ['#fde047', '#f97316', '#ef4444', '#ffffff'][i % 4], life: 0.7, max: 0.7, g: 200 });
  }
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * TAU;
    list.push({ kind: 'smoke', x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 30 - 40, size: 10 + Math.random() * 8, life: 1.1, max: 1.1, g: -30 });
  }
  list.push({ kind: 'ring', x, y, r: 30, life: 0.45, max: 0.45, color: '#fdba74' });
}

function drawParticles(ctx, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    if (p.kind !== 'ring') {
      p.vy += p.g * dt;
      p.vx *= 1 - dt * 1.2;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
    }
    if (!ctx) continue;
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.kind === 'ring') {
      const k = 1 - a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 5 * a + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + k * 36, 0, TAU);
      ctx.stroke();
    } else if (p.kind === 'shred' || p.kind === 'confetti') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.rot * 1.7));
      ctx.fillStyle = p.color;
      if (p.kind === 'shred') {
        ctx.beginPath();
        ctx.moveTo(-p.w / 2, -p.h / 2);
        ctx.quadraticCurveTo(0, -p.h, p.w / 2, -p.h / 3);
        ctx.lineTo(p.w / 3, p.h / 2);
        ctx.quadraticCurveTo(0, p.h / 3, -p.w / 2, p.h / 2);
        ctx.closePath();
        ctx.fill();
      } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    } else if (p.kind === 'smoke') {
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 0.5, 0, TAU);
      ctx.fill();
    }
  }
  if (ctx) ctx.globalAlpha = 1;
}

const easeBack = (k) => {
  const c = 1.9;
  return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
};

function drawReveal(ctx, rv, t) {
  const age = t - rv.at;
  const c = rv.content;
  const grow = easeBack(Math.min(1, age / 0.35));
  const fade = age > 1.1 ? Math.max(0, 1 - (age - 1.1) / 0.35) : 1;
  const y = rv.y - Math.min(1, age / 1.4) * 34;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(rv.x, y);
  if (c.rare) {
    // Golden rays
    ctx.save();
    ctx.rotate(age * 1.5);
    ctx.fillStyle = 'rgba(253,224,71,0.35)';
    for (let i = 0; i < 10; i++) {
      ctx.rotate(TAU / 10);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-7, -58 * grow);
      ctx.lineTo(7, -58 * grow);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  const big = c.rare ? 1.25 : 1;
  ctx.scale(grow * big, grow * big);
  if (c.kind === 'bonus') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, TAU);
    ctx.fill();
    ctx.stroke();
    drawDart(ctx, -2, 4, -Math.PI / 4, 0.95);
  } else {
    const ring = c.kind === 'bomb' ? '#f97316' : c.rare ? '#facc15' : c.points >= 20 ? '#38bdf8' : '#4ade80';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = ring;
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    const img = loadImage(artworkUrl(c.dex));
    if (imageReady(img)) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 23, 0, TAU);
      ctx.clip();
      ctx.drawImage(img, -24, -26, 48, 48);
      ctx.restore();
    } else {
      ctx.fillStyle = c.kind === 'bomb' ? '#ef4444' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  // The points under it
  const label = c.kind === 'bonus' ? '+1 phi tiêu' : c.kind === 'bomb' ? '-15' : `+${rv.points}`;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.font = `900 ${c.rare ? 26 : 22}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  const ly = y + 42 * grow;
  ctx.strokeText(label, rv.x, ly);
  ctx.fillStyle = c.kind === 'bomb' ? '#fca5a5' : c.rare ? '#fde047' : '#ffffff';
  ctx.fillText(label, rv.x, ly);
  ctx.restore();
}

function drawPopWord(ctx, pw, t) {
  const age = t - pw.at;
  if (age > 0.45) return;
  const k = age / 0.45;
  ctx.save();
  ctx.globalAlpha = 1 - k;
  ctx.translate(pw.x + 18, pw.y - 24);
  ctx.rotate(-0.25);
  ctx.scale(0.6 + k * 0.7, 0.6 + k * 0.7);
  ctx.font = '900 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#7c2d12';
  ctx.strokeText(pw.text, 0, 0);
  ctx.fillStyle = '#fde047';
  ctx.fillText(pw.text, 0, 0);
  ctx.restore();
}

const snap = (s) => ({ score: s.score, dartsLeft: s.dartsLeft, status: s.status, pops: s.pops, bombs: s.bombs, bonus: s.bonus, rares: s.rares, thrown: s.thrown, stars: dartsStars(s) });

const freshFx = () => ({ time: 0, particles: [], reveals: [], words: [], jiggle: new Map(), stuckAt: new Map(), lastSaid: false, drag: null, key: null, throwT: 0, shake: 0, flash: 0, cheer: 0, trail: [] });

/**
 * "Ném phi tiêu bóng bay": swipe up to throw darts at a board of balloons. Each one hides a
 * sticker, a bonus dart or a Voltorb! Golden balloons hold rare Pokemon. 10 darts.
 */
export function DartsGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const size = useFit(stageRef);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createDarts({ random }));
  const game = useRef(first);
  const [ui, setUi] = useState(() => snap(first));
  const [banner, setBanner] = useState(null);
  const fx = useRef(freshFx());
  const later = useLater();
  const bannerId = useRef(0);
  const say = (text, tone = 'gold', ms = 1300) => {
    const id = ++bannerId.current;
    setBanner({ id, text, tone });
    later(() => setBanner((b) => (b?.id === id ? null : b)), ms);
  };

  const throwAt = (target) => {
    const s = game.current;
    if (phase !== 'play' || !target) return;
    if (!throwDart(s, target)) return;
    fx.current.throwT = 0.35;
    fx.current.trail = [];
    setUi(snap(s));
  };

  // Swipe up to throw
  const pointer = useRef(null);
  const toCanvas = (e) => canvasPoint(canvasRef.current, e, W, H);
  const onDown = (e) => {
    if (phase !== 'play' || game.current.status !== 'aim' || !canvasRef.current) return;
    const p = toCanvas(e);
    pointer.current = { start: p };
    fx.current.drag = null;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!pointer.current) return;
    const p = toCanvas(e);
    fx.current.drag = aimFromSwipe(p.x - pointer.current.start.x, p.y - pointer.current.start.y);
  };
  const onUp = (e) => {
    const ptr = pointer.current;
    pointer.current = null;
    fx.current.drag = null;
    if (!ptr) return;
    const p = toCanvas(e);
    const target = aimFromSwipe(p.x - ptr.start.x, p.y - ptr.start.y);
    if (!target) say('Vuốt mạnh lên trên nhé! 👆', 'soft', 1000);
    throwAt(target);
  };

  // Keyboard: arrows move the aim, Space throws
  useEffect(() => {
    if (phase !== 'play') return undefined;
    const onKey = (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) return;
      e.preventDefault();
      const v = fx.current;
      if (!v.key) v.key = { x: 180, y: 214 };
      if (e.key === 'ArrowLeft') v.key.x = Math.max(30, v.key.x - 15);
      if (e.key === 'ArrowRight') v.key.x = Math.min(W - 30, v.key.x + 15);
      if (e.key === 'ArrowUp') v.key.y = Math.max(70, v.key.y - 15);
      if (e.key === 'ArrowDown') v.key.y = Math.min(380, v.key.y + 15);
      if (e.key === ' ' && game.current.status === 'aim') throwAt({ ...v.key });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    const t = v.time;
    v.throwT = Math.max(0, v.throwT - dt);
    v.shake = Math.max(0, v.shake - dt);
    v.flash = Math.max(0, v.flash - dt * 2.5);
    v.cheer = Math.max(0, v.cheer - dt);
    for (const [id, j] of v.jiggle) {
      if (j - dt <= 0) v.jiggle.delete(id);
      else v.jiggle.set(id, j - dt);
    }
    if (phase === 'play') {
      stepDarts(s, dt);
      for (const e of s.events.splice(0)) {
        if (e.type === 'throw') sounds.playWhoosh();
        else if (e.type === 'pop') {
          const c = e.content;
          sounds.playPop();
          v.words.push({ x: e.x, y: e.y, at: t, text: c.kind === 'bomb' ? 'BÙM!' : 'BỤP!' });
          v.reveals.push({ x: e.x, y: e.y, at: t, content: c, points: e.points });
          // Neighbours jiggle
          for (const b of s.balloons) if (!b.popped && Math.hypot(b.hx - e.x, b.hy - e.y) < 90) v.jiggle.set(b.id, 0.5);
          if (c.kind === 'bomb') {
            explosion(v.particles, e.x, e.y);
            v.shake = 0.4;
            v.flash = 0.6;
            sounds.playOops();
            say('Ôi! Voltorb nổ tung! 💥', 'red', 1200);
          } else {
            shreds(v.particles, e.x, e.y, e.color);
            if (c.kind === 'bonus') {
              sounds.playEnergySurge();
              say('Thêm 1 phi tiêu! 🎯', 'green', 1100);
            } else {
              v.cheer = 0.7;
              sounds.playCoin();
              const notes = c.rare ? [659, 784, 988, 1319] : c.points >= 20 ? [784, 1047] : [880];
              notes.forEach((f, i) => sounds.playNote(f, { duration: 0.16, delay: 0.05 + i * 0.08, volume: 0.2 }));
              if (c.rare) {
                v.flash = 0.5;
                sounds.playSuccessFanfare();
                say('SIÊU HIẾM! +50 ⭐', 'gold', 1400);
              }
            }
          }
        } else if (e.type === 'miss') {
          sounds.playNote(220, { duration: 0.08, volume: 0.25 });
          v.words.push({ x: e.x, y: e.y, at: t, text: 'Phập!' });
        }
        if (e.type === 'end') {
          sounds.playWhoosh();
          later(() => setPhase('done'), 1100);
        }
      }
      if (s.status === 'aim' && s.dartsLeft === 1 && !v.lastSaid) {
        v.lastSaid = true;
        say('Phi tiêu cuối cùng! 🎯', 'soft', 1100);
      }
      setUi(snap(s));
    }
    // Old reveals go
    v.reveals = v.reveals.filter((r) => t - r.at < 1.5);
    v.words = v.words.filter((w) => t - w.at < 0.5);

    const ctx = getCtx();
    if (!ctx) {
      drawParticles(null, v.particles, dt);
      return;
    }
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (v.shake > 0) ctx.translate((Math.random() - 0.5) * v.shake * 22, (Math.random() - 0.5) * v.shake * 22);
    const bg = scene();
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else {
      ctx.fillStyle = '#4c1d95';
      ctx.fillRect(0, 0, W, H);
    }
    drawLights(ctx, t, v.flash);
    // Where the dart is heading, to make that balloon glow
    const aimTarget = v.drag || (v.key && s.status === 'aim' ? v.key : null);
    const aimed = aimTarget && s.status === 'aim' ? balloonAt(s, aimTarget.x, aimTarget.y, s.time + FLIGHT) : null;
    // Pins, balloons
    for (const b of s.balloons) {
      const pin = { x: b.hx, y: b.hy + BALLOON_R + 34 };
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 2, 0, TAU);
      ctx.fill();
      if (b.popped) {
        // A little knot left on its string
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pin.x, pin.y);
        ctx.quadraticCurveTo(pin.x + 4, pin.y - 8, pin.x + 1, pin.y - 14);
        ctx.stroke();
        ctx.fillStyle = tone(b.color)[1];
        ctx.beginPath();
        ctx.arc(pin.x + 1, pin.y - 15, 2.5, 0, TAU);
        ctx.fill();
        continue;
      }
      const p = balloonPos(s, b);
      const glow = aimed === b ? 18 + Math.sin(t * 10) * 6 : b.color === 'gold' ? 10 + Math.sin(t * 4) * 5 : 0;
      drawBalloon(ctx, p.x, p.y, pin, b.color, t, b.phase, v.jiggle.get(b.id) || 0, glow);
    }
    for (const d of s.stuck) {
      if (!v.stuckAt.has(d.id)) v.stuckAt.set(d.id, t);
      drawStuck(ctx, d, t, v.stuckAt.get(d.id));
    }
    drawPrizes(ctx, t);
    // The child's Pokemon behind the counter edge, throwing
    const lean = v.throwT > 0 ? Math.sin((v.throwT / 0.35) * Math.PI) : 0;
    const hop = v.cheer > 0 ? Math.abs(Math.sin(v.cheer * 12)) * 12 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(PLAYER_AT.x, PLAYER_AT.y + 48, 38, 8, 0, 0, TAU);
    ctx.fill();
    drawSprite(ctx, loadImage(player.image), PLAYER_AT.x, PLAYER_AT.y - lean * 10 - hop + Math.sin(t * 2.5) * 2, 100, { rotate: -lean * 0.2 });
    // The dart: in the hand, or flying with a trail
    if (s.dart) {
      const k = Math.min(1, s.dart.t / FLIGHT);
      const p = dartAt(s.dart, k);
      const q = dartAt(s.dart, Math.min(1, k + 0.04));
      v.trail.push({ x: p.x, y: p.y });
      if (v.trail.length > 8) v.trail.shift();
      v.trail.forEach((tp, i) => {
        ctx.fillStyle = `rgba(255,255,255,${(i / v.trail.length) * 0.4})`;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, 1 + i * 0.35, 0, TAU);
        ctx.fill();
      });
      const ang = Math.atan2(q.y - p.y, q.x - p.x) || -Math.PI / 2;
      drawDart(ctx, p.x, p.y, ang, 1.25 - k * 0.6);
    } else if (phase === 'play' && s.status === 'aim') {
      const target = aimTarget || { x: HAND.x, y: 100 };
      const ang = Math.atan2(target.y - HAND.y, target.x - HAND.x);
      drawDart(ctx, HAND.x, HAND.y + Math.sin(t * 3) * 2, ang, 1.25);
    }
    if (aimTarget && s.status === 'aim' && phase === 'play') drawAim(ctx, HAND, aimTarget, t, !!aimed);
    drawParticles(ctx, v.particles, dt);
    for (const w of v.words) drawPopWord(ctx, w, t);
    for (const rv of v.reveals) drawReveal(ctx, rv, t);
    ctx.restore();
    if (v.flash > 0) {
      ctx.fillStyle = `rgba(255,247,200,${v.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
    // First throw hint: a finger swiping up
    if (phase === 'play' && s.thrown === 0 && !v.drag && s.status === 'aim') {
      const k = (t % 1.4) / 1.4;
      ctx.globalAlpha = Math.sin(k * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(HAND.x + 40, 470 - k * 120, 11, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, phase !== 'done');

  const replay = () => {
    game.current = createDarts({ random });
    fx.current = freshFx();
    setUi(snap(game.current));
    setBanner(null);
    setPhase('ready');
  };

  const bannerTone = {
    gold: 'text-yellow-300',
    red: 'text-rose-300',
    green: 'text-emerald-300',
    soft: 'text-white',
  };

  return (
    <CarnivalShell
      title="🎈 Phi tiêu bóng bay"
      label="Ném phi tiêu bóng bay"
      onClose={onClose}
      background="bg-gradient-to-b from-indigo-950 via-purple-900 to-fuchsia-900"
      dataAttrs={{ 'data-phase': phase, 'data-score': ui.score, 'data-darts': ui.dartsLeft, 'data-status': ui.status, 'data-pops': ui.pops }}
      hud={
        <>
          <HudBar
            items={[
              { icon: '⭐', label: 'Điểm', value: ui.score, testId: 'darts-score' },
              { icon: '🎈', label: 'Nổ', value: ui.pops },
            ]}
          />
          <div className="mt-1 flex items-center justify-center gap-0.5 flex-wrap" data-testid="darts-left" aria-label={`Còn ${ui.dartsLeft} phi tiêu`}>
            {Array.from({ length: Math.max(DARTS, ui.dartsLeft) }, (_, i) => {
              const left = i < ui.dartsLeft;
              return (
                <svg key={i} viewBox="0 0 12 28" className={`w-3 h-6 transition-all duration-300 ${left ? '' : 'opacity-20 scale-75 grayscale'} ${i >= DARTS && left ? 'darts-extra' : ''}`} aria-hidden="true">
                  <path d="M6 0l1.6 7H4.4z" fill="#cbd5e1" />
                  <rect x="4" y="7" width="4" height="7" rx="2" fill="#94a3b8" />
                  <path d="M6 14v6" stroke="#1e293b" strokeWidth="1.4" />
                  <path d="M6 18L1 27h10z" fill="#ef4444" />
                  <path d="M6 20l-2 6h4z" fill="#fde047" />
                </svg>
              );
            })}
          </div>
        </>
      }
    >
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          pointer.current = null;
          fx.current.drag = null;
        }}
        data-testid="darts-stage"
      >
        <canvas ref={canvasRef} data-testid="darts-canvas" className="block max-w-full max-h-full" style={size ? { width: size.w, height: size.h } : { width: '100%', aspectRatio: `${W} / ${H}` }} />
        {phase === 'play' && ui.thrown === 0 && ui.status === 'aim' && (
          <p className="hint-pulse absolute bottom-3 inset-x-4 mx-auto max-w-xs px-3 py-1.5 rounded-2xl bg-black/60 text-center text-white text-sm font-black pointer-events-none" data-testid="darts-hint">
            Vuốt lên để ném phi tiêu! Bóng vàng có Pokémon hiếm ✨
          </p>
        )}
        {banner && phase === 'play' && (
          <div className="absolute top-[9%] inset-x-0 flex justify-center pointer-events-none">
            <p key={banner.id} className={`chain-pop whitespace-nowrap text-2xl sm:text-3xl font-black drop-shadow-[0_3px_3px_rgba(0,0,0,0.85)] ${bannerTone[banner.tone] || 'text-white'}`}>
              {banner.text}
            </p>
          </div>
        )}
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Tay phi tiêu vàng! 🏆' : ui.stars === 2 ? 'Ném giỏi lắm! 🎈' : 'Cố lên nhé! 💪'}
            stars={ui.stars}
            detail={`${ui.score} điểm · nổ ${ui.pops} bóng${ui.rares ? ` · ${ui.rares} Pokémon hiếm ✨` : ''}${ui.bombs ? ` · ${ui.bombs} Voltorb 💥` : ''}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
