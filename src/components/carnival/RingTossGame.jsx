import React, { useEffect, useRef, useState } from 'react';
import { createToss, stepToss, throwRing, tossStars, pegAt, zForPower, RINGS, PEG_H, Z_MIN, Z_MAX } from '../../utils/carnival/ringtoss';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite, burst, updateParticles } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const W = 360;
const H = 560;
// Perspective of the field: a point (x, z) with height h
const HORIZON = 30;
const BASE = 630;
const DEPTH = 0.5;
const K = 190;
const RING_R = 0.27;
const SWIPE_MIN = 22;
const SWIPE_FULL = 280;

function project(x, z, h = 0) {
  const s = 1 / (1 + z * DEPTH);
  return { x: W / 2 + x * K * s, y: HORIZON + (BASE - HORIZON) * s - h * K * s, s };
}
const ORIGIN = project(0, 0.15, 0.55);

/** A swipe (screen pixels, y down) to the point of the field it throws at. */
function swipeTarget(dx, dy) {
  if (-dy < SWIPE_MIN) return null;
  const len = Math.hypot(dx, dy);
  const z = zForPower((len - SWIPE_MIN) / SWIPE_FULL);
  const p = project(0, z);
  const tan = dx / -dy;
  return { x: (tan * (ORIGIN.y - p.y)) / (K * p.s), z };
}

const snap = (s) => ({ score: s.score, ringsLeft: s.ringsLeft, status: s.status, hits: s.hits, streak: s.streak, best: s.best, stars: tossStars(s) });

const ROW_COLORS = ['#f59e0b', '#38bdf8', '#4ade80'];

function drawBooth(ctx, time) {
  // Night sky behind the booth
  const sky = ctx.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#1e1b4b');
  sky.addColorStop(1, '#6d28d9');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Back curtain with folds
  const back = project(0, Z_MAX + 0.1);
  for (let i = 0; i < 12; i++) {
    const x = i * 30;
    const g = ctx.createLinearGradient(x, 0, x + 30, 0);
    g.addColorStop(0, '#9f1239');
    g.addColorStop(0.5, '#e11d48');
    g.addColorStop(1, '#881337');
    ctx.fillStyle = g;
    ctx.fillRect(x, 40, 30, back.y - 40);
  }
  // Prize shelf with big Pokeball plushes
  ctx.fillStyle = '#78350f';
  ctx.fillRect(20, back.y - 58, W - 40, 8);
  for (let i = 0; i < 5; i++) {
    const x = 52 + i * 64;
    const y = back.y - 72 + Math.sin(time * 2 + i) * 1.5;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ['#ef4444', '#3b82f6', '#facc15', '#a855f7', '#22c55e'][i];
    ctx.beginPath();
    ctx.arc(x, y, 13, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 13, y - 1.5, 26, 3);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Striped canopy with scallops
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? '#fef3c7' : '#ef4444';
    ctx.fillRect(i * 40, 0, 40, 34);
    ctx.beginPath();
    ctx.arc(i * 40 + 20, 34, 20, 0, Math.PI);
    ctx.fill();
  }
  // Twinkling lights under the canopy
  for (let i = 0; i < 13; i++) {
    const x = 14 + i * 27.5;
    const y = 60 + Math.sin(i * 1.3) * 4;
    const on = 0.55 + 0.45 * Math.sin(time * 4 + i * 1.7);
    ctx.fillStyle = ['#fde047', '#f472b6', '#67e8f9', '#86efac'][i % 4];
    ctx.globalAlpha = on;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(15,23,42,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 13; i++) ctx.lineTo(14 + i * 27.5, 56 + Math.sin(i * 1.3) * 4);
  ctx.stroke();
  // Sign
  ctx.save();
  ctx.font = '900 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 12 + Math.sin(time * 3) * 5;
  ctx.fillText('NÉM VÒNG', W / 2, 100);
  ctx.restore();
  // Wooden floor of the booth
  const floor = ctx.createLinearGradient(0, back.y, 0, H);
  floor.addColorStop(0, '#451a03');
  floor.addColorStop(1, '#92400e');
  ctx.fillStyle = floor;
  ctx.fillRect(0, back.y, W, H - back.y);
  // The field (green felt) in perspective
  const a = project(-1.7, 0.2);
  const b = project(1.7, 0.2);
  const c = project(1.7, Z_MAX + 0.1);
  const d = project(-1.7, Z_MAX + 0.1);
  const felt = ctx.createLinearGradient(0, c.y, 0, a.y);
  felt.addColorStop(0, '#166534');
  felt.addColorStop(1, '#22c55e');
  ctx.fillStyle = felt;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
  // Coloured bands under each row
  [3, 2, 1].forEach((z, row) => {
    const p1 = project(-1.7, z - 0.45);
    const p2 = project(1.7, z - 0.45);
    const p3 = project(1.7, z + 0.45);
    const p4 = project(-1.7, z + 0.45);
    ctx.fillStyle = ROW_COLORS[row];
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
  // Felt lines
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    const p = project(i * 0.42, 0.2);
    const q = project(i * 0.42, Z_MAX + 0.1);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  // Wooden rim
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(d.x, d.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  // Counter at the front
  const counter = ctx.createLinearGradient(0, 515, 0, H);
  counter.addColorStop(0, '#b45309');
  counter.addColorStop(1, '#78350f');
  ctx.fillStyle = counter;
  ctx.fillRect(0, 518, W, H - 518);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(0, 515, W, 5);
}

/** A ring: an ellipse split into red and white halves that turn with the spin. */
function drawRing(ctx, x, z, h, { spin = 0, tilt = 0, alpha = 1, part = 'all', glow = false }) {
  const p = project(x, z, h);
  const rx = RING_R * K * p.s;
  const ry = rx * Math.max(0.12, 0.36 + tilt);
  const lw = Math.max(2.5, rx * 0.3);
  const ranges = part === 'back' ? [[Math.PI, Math.PI * 2]] : part === 'front' ? [[0, Math.PI]] : [[0, Math.PI * 2]];
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(tilt * 0.6);
  ctx.lineCap = 'butt';
  if (glow) {
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 14;
  }
  const pieces = 16;
  for (const [a0, a1] of ranges) {
    for (let i = 0; i < pieces; i++) {
      const s0 = a0 + ((a1 - a0) * i) / pieces;
      const s1 = a0 + ((a1 - a0) * (i + 1)) / pieces;
      const mid = (((s0 + s1) / 2 - spin) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const red = mid < Math.PI;
      const front = Math.sin((s0 + s1) / 2) > 0;
      // Dark outline, the colour, then a shine on top
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = lw + 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, s0, s1 + 0.02);
      ctx.stroke();
      ctx.strokeStyle = red ? (front ? '#ef4444' : '#b91c1c') : front ? '#ffffff' : '#cbd5e1';
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, s0, s1 + 0.02);
      ctx.stroke();
      if (Math.abs(mid) < 0.2 || Math.abs(mid - Math.PI) < 0.2) {
        // The black band between the halves
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = lw + 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, s0, s1);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    const h0 = Math.max(a0, Math.PI * 1.1);
    const h1 = Math.min(a1, Math.PI * 1.6);
    if (h0 < h1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(1, lw * 0.25);
      ctx.beginPath();
      ctx.ellipse(0, -lw * 0.2, rx, ry, 0, h0, h1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPeg(ctx, peg, time, rings, active) {
  const base = project(peg.x, peg.z);
  const top = project(peg.x, peg.z, PEG_H);
  const w = 0.085 * K * base.s;
  // Shadow and base plate
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(base.x, base.y + 2, w * 2.6, w * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rings resting on it (their back halves first)
  rings.forEach((r) => drawRing(ctx, peg.x, peg.z, 0.04 + r.level * 0.06, { spin: r.spin, part: 'back' }));
  active?.forEach((r) => drawRing(ctx, r.x, r.z, r.h, { spin: r.spin, tilt: r.tilt, part: 'back', glow: true }));
  // The wooden post
  const g = ctx.createLinearGradient(base.x - w, 0, base.x + w, 0);
  g.addColorStop(0, '#92400e');
  g.addColorStop(0.45, '#fcd34d');
  g.addColorStop(1, '#b45309');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(base.x - w / 2, top.y, w, base.y - top.y, w / 2);
  ctx.fill();
  // Small platform on top
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.ellipse(top.x, top.y, w * 1.4, w * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Points sticker on the post
  const sy = (top.y + base.y) / 2;
  const br = Math.max(7, 13 * base.s + 2);
  ctx.fillStyle = ROW_COLORS[peg.row];
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(base.x, sy, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${Math.round(br * 1.05)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(peg.points), base.x, sy + 1);
  ctx.textBaseline = 'alphabetic';
  // The doll: a happy hop when a ring lands
  const size = 0.46 * K * top.s;
  const hop = peg.hop > 0 ? Math.sin((1 - peg.hop / 0.6) * Math.PI) * 22 * top.s : 0;
  const sway = Math.sin(time * 2 + peg.id) * 0.05;
  drawSprite(ctx, loadImage(artworkUrl(peg.dex)), top.x, top.y - size * 0.45 - hop, size, { rotate: sway + (peg.hop > 0 ? Math.sin(peg.hop * 30) * 0.12 : 0) });
  // Front halves go over the post
  rings.forEach((r) => drawRing(ctx, peg.x, peg.z, 0.04 + r.level * 0.06, { spin: r.spin, part: 'front' }));
  active?.forEach((r) => drawRing(ctx, r.x, r.z, r.h, { spin: r.spin, tilt: r.tilt, part: 'front', glow: true }));
}

function drawShadow(ctx, x, z, h) {
  const p = project(x, z);
  const rx = RING_R * K * p.s * (1 - Math.min(0.6, h * 0.2));
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0.08, 0.3 - h * 0.08)})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, rx * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAim(ctx, target, time, onPeg) {
  const end = project(target.x, target.z);
  ctx.save();
  // Dotted flight arc
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 1; i < 14; i++) {
    const k = i / 14;
    const x = target.x * k;
    const z = 0.15 + (target.z - 0.15) * k;
    const h = 0.55 * (1 - k) + 4 * (0.9 + (target.z / Z_MAX) * 0.9) * k * (1 - k);
    const p = project(x, z, h);
    ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(time * 6 - i * 0.5));
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5 * p.s + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const rx = RING_R * K * end.s;
  ctx.strokeStyle = onPeg ? '#4ade80' : '#ffffff';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -time * 20;
  ctx.shadowColor = onPeg ? '#4ade80' : '#fff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(end.x, end.y, rx * (1 + Math.sin(time * 8) * 0.06), rx * 0.36, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTexts(ctx, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const t = list[i];
    t.life -= dt;
    if (t.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    const age = t.max - t.life;
    const pop = age < 0.15 ? 0.5 + (age / 0.15) * 0.8 : Math.max(1, 1.3 - (age - 0.15) * 1.5);
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.life / 0.3);
    ctx.translate(t.x, t.y - age * 45);
    ctx.scale(pop, pop);
    ctx.font = `900 ${t.size || 26}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(15,23,42,0.85)';
    ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
}

/**
 * "Ném vòng Pokéball": swipe up to toss a ring over the pegs; the Pokemon dolls on the back row
 * are worth the most. 8 rings.
 */
export function RingTossGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createToss({ random }));
  const game = useRef(first);
  const [ui, setUi] = useState(() => snap(first));
  const [banner, setBanner] = useState(null);
  const fx = useRef({ particles: [], texts: [], time: 0, drag: null, throwT: 0, shake: 0, key: null });
  const later = useLater();
  const bannerId = useRef(0);
  const say = (text) => {
    const id = ++bannerId.current;
    setBanner({ id, text });
    later(() => setBanner((b) => (b?.id === id ? null : b)), 1300);
  };

  const throwAt = (target) => {
    const s = game.current;
    if (phase !== 'play' || !target) return;
    if (!throwRing(s, target)) return;
    fx.current.throwT = 0.45;
    setUi(snap(s));
  };

  // Swipe up to throw
  const pointer = useRef(null);
  const toCanvas = (e) => canvasPoint(canvasRef.current, e, W, H);
  const onDown = (e) => {
    if (phase !== 'play' || game.current.status !== 'aim') return;
    const p = toCanvas(e);
    pointer.current = { start: p, cur: p };
    fx.current.drag = null;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!pointer.current) return;
    const p = toCanvas(e);
    pointer.current.cur = p;
    fx.current.drag = swipeTarget(p.x - pointer.current.start.x, p.y - pointer.current.start.y);
  };
  const onUp = (e) => {
    const ptr = pointer.current;
    pointer.current = null;
    fx.current.drag = null;
    if (!ptr) return;
    const p = toCanvas(e);
    throwAt(swipeTarget(p.x - ptr.start.x, p.y - ptr.start.y));
  };

  // Keyboard: arrows move the aim, Space throws
  useEffect(() => {
    if (phase !== 'play') return undefined;
    const onKey = (e) => {
      const v = fx.current;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) return;
      e.preventDefault();
      if (!v.key) v.key = { x: 0, z: 2 };
      if (e.key === 'ArrowLeft') v.key.x = Math.max(-1.5, v.key.x - 0.15);
      if (e.key === 'ArrowRight') v.key.x = Math.min(1.5, v.key.x + 0.15);
      if (e.key === 'ArrowUp') v.key.z = Math.min(Z_MAX, v.key.z + 0.2);
      if (e.key === 'ArrowDown') v.key.z = Math.max(Z_MIN, v.key.z - 0.2);
      if (e.key === ' ' && game.current.status === 'aim') throwAt({ ...v.key });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    v.throwT = Math.max(0, v.throwT - dt);
    v.shake = Math.max(0, v.shake - dt);
    if (phase === 'play') {
      stepToss(s, dt);
      for (const e of s.events.splice(0)) {
        if (e.type === 'throw') sounds.playWhoosh();
        if (e.type === 'ringed') {
          const top = project(e.x, e.z, PEG_H);
          burst(v.particles, top.x, top.y, { count: 26, speed: 190, colors: ['#fde047', '#ffffff', '#f472b6', '#38bdf8'], size: 3.5 });
          burst(v.particles, top.x, top.y - 20, { count: 10, speed: 90, colors: ['#fef08a'], size: 2.2, gravity: 40, life: 1 });
          v.texts.push({ x: top.x, y: top.y - 50 * top.s - 30, text: `+${e.points}`, color: e.points >= 30 ? '#fde047' : '#ffffff', life: 1.1, max: 1.1, size: 30 });
          v.shake = 0.18;
          sounds.playCoin();
          later(() => sounds.playNote(1046, { duration: 0.18, volume: 0.25 }), 120);
          if (e.streak >= 3) say(`${e.streak} vòng liền! 🔥`);
          else if (e.points >= 30) say('Tuyệt vời! ⭐');
        }
        if (e.type === 'clank') {
          const p = project(e.x, e.z, PEG_H);
          burst(v.particles, p.x, p.y, { count: 10, speed: 120, colors: ['#e2e8f0', '#94a3b8'], size: 2.5 });
          sounds.playNote(330, { duration: 0.08, volume: 0.3 });
          later(() => sounds.playNote(262, { duration: 0.12, volume: 0.25 }), 90);
          v.texts.push({ x: p.x, y: p.y - 30, text: 'Suýt trúng!', color: '#bae6fd', life: 0.9, max: 0.9, size: 18 });
        }
        if (e.type === 'miss') {
          const p = project(e.x, e.z);
          burst(v.particles, p.x, p.y, { count: 8, speed: 70, colors: ['#bbf7d0', '#86efac'], size: 2.5 });
          sounds.playPop();
        }
        if (e.type === 'end') later(() => setPhase('done'), 900);
      }
      setUi(snap(s));
    }

    const ctx = getCtx();
    if (!ctx) {
      updateParticles(null, v.particles, dt);
      return;
    }
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (v.shake > 0) ctx.translate((Math.random() - 0.5) * v.shake * 18, (Math.random() - 0.5) * v.shake * 18);
    drawBooth(ctx, v.time);
    const ring = s.ring;
    const items = s.pegs.map((peg) => ({
      z: peg.z,
      draw: () => drawPeg(ctx, peg, v.time, s.rested.filter((r) => r.peg === peg.id), ring && ring.phase === 'drop' && ring.peg === peg.id ? [ring] : null),
    }));
    if (ring && ring.phase !== 'drop') {
      items.push({ z: ring.z + 0.01, draw: () => {
        drawShadow(ctx, ring.x, ring.z, ring.h);
        drawRing(ctx, ring.x, ring.z, ring.h, { spin: ring.spin, tilt: ring.tilt, alpha: ring.alpha });
      } });
    }
    items.sort((a, b) => b.z - a.z).forEach((it) => it.draw());
    // Aim guide while swiping (or with the keyboard)
    const target = v.drag || (v.key && phase === 'play' ? v.key : null);
    if (target && s.status === 'aim') drawAim(ctx, target, v.time, !!pegAt(s, target.x, target.z));
    // The ring in the hand, waiting
    if (s.status === 'aim' && phase === 'play') drawRing(ctx, 0, 0.15, 0.55 + Math.sin(v.time * 3) * 0.03, { spin: v.time * 0.8, tilt: 0.1 });
    // The child's Pokemon at the counter
    const lean = v.throwT > 0 ? Math.sin((v.throwT / 0.45) * Math.PI) : 0;
    drawSprite(ctx, loadImage(player.image), 58, 512 - lean * 16 + Math.sin(v.time * 3) * 2, 92, { rotate: lean * 0.25 });
    updateParticles(ctx, v.particles, dt);
    drawTexts(ctx, v.texts, dt);
    ctx.restore();
  }, phase !== 'done');

  const replay = () => {
    game.current = createToss({ random });
    fx.current.particles = [];
    fx.current.texts = [];
    setUi(snap(game.current));
    setBanner(null);
    setPhase('ready');
  };

  return (
    <CarnivalShell
      title="🎯 Ném vòng Pokéball"
      label="Ném vòng Pokéball"
      onClose={onClose}
      background="bg-gradient-to-b from-indigo-900 via-purple-800 to-rose-800"
      dataAttrs={{ 'data-phase': phase, 'data-score': ui.score, 'data-rings': ui.ringsLeft, 'data-status': ui.status }}
      hud={
        <>
          <HudBar items={[{ icon: '⭐', label: 'Điểm', value: ui.score, testId: 'ringtoss-score' }, { icon: '🎯', label: 'Trúng', value: ui.hits }]} />
          <div className="mt-1 flex items-center justify-center gap-1" data-testid="ringtoss-rings" aria-label={`Còn ${ui.ringsLeft} vòng`}>
            {Array.from({ length: RINGS }, (_, i) => {
              const left = i < ui.ringsLeft;
              return (
                <svg key={i} viewBox="0 0 24 14" className={`w-7 h-4 transition-all duration-300 ${left ? '' : 'opacity-25 scale-75 grayscale'}`} aria-hidden="true">
                  <ellipse cx="12" cy="7" rx="9.5" ry="4.5" fill="none" stroke="#1e293b" strokeWidth="4.5" />
                  <path d="M2.5 7a9.5 4.5 0 0 1 19 0" fill="none" stroke="#ef4444" strokeWidth="3" />
                  <path d="M21.5 7a9.5 4.5 0 0 1-19 0" fill="none" stroke="#fff" strokeWidth="3" />
                </svg>
              );
            })}
          </div>
        </>
      }
    >
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          pointer.current = null;
          fx.current.drag = null;
        }}
        data-testid="ringtoss-stage"
      >
        <canvas ref={canvasRef} data-testid="ringtoss-canvas" className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, width: '100%', height: 'auto' }} />
        {phase === 'play' && ui.status === 'aim' && ui.ringsLeft === RINGS && (
          <p className="hint-pulse absolute bottom-3 left-1/2 -translate-x-1/2 w-[88%] px-3 py-1.5 rounded-2xl bg-black/60 text-center text-white text-sm font-black pointer-events-none" data-testid="ringtoss-hint">
            Vuốt lên để ném vòng! Vuốt dài thì ném xa hơn 👆
          </p>
        )}
        {banner && phase === 'play' && (
          <p key={banner.id} className="chain-pop absolute top-[18%] left-1/2 -translate-x-1/2 whitespace-nowrap text-3xl font-black text-yellow-300 drop-shadow-[0_3px_3px_rgba(0,0,0,0.8)] pointer-events-none">
            {banner.text}
          </p>
        )}
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Tay ném vàng! 🏆' : ui.stars === 2 ? 'Ném giỏi lắm! 🎯' : 'Cố lên nhé! 💪'}
            stars={ui.stars}
            detail={`${ui.score} điểm · trúng ${ui.hits}/${RINGS} vòng${ui.best >= 3 ? ` · ${ui.best} vòng liền` : ''}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
