import React, { useEffect, useRef, useState } from 'react';
import {
  FISH_W as W,
  FISH_H as H,
  DURATION,
  POND,
  ROD_TIP,
  FISH_KINDS,
  CAST_TIME,
  createFishing,
  stepFishing,
  tapPond,
  engaged,
  timeLeft,
  fishingStars,
} from '../../utils/carnival/fishing';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite, burst, updateParticles } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const TAU = Math.PI * 2;
const HAND = { x: 92, y: 476 };
const PADS = [
  { x: 64, y: 196, r: 22, a: 0.4, flower: true },
  { x: 292, y: 168, r: 18, a: 2.2 },
  { x: 268, y: 372, r: 24, a: 4.1, flower: true },
  { x: 150, y: 128, r: 14, a: 1.3 },
];
const REEDS = [
  [14, 250], [22, 300], [30, 330], [338, 240], [346, 280], [330, 330], [300, 104], [60, 110],
];
const fishImage = (kind) => (FISH_KINDS[kind].dex ? loadImage(artworkUrl(FISH_KINDS[kind].dex)) : null);

// Sky, bank and the pond bed painted once
let sceneCache = null;
function scene() {
  if (sceneCache || typeof document === 'undefined') return sceneCache;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  // Sky and hills
  const sky = ctx.createLinearGradient(0, 0, 0, 140);
  sky.addColorStop(0, '#7dd3fc');
  sky.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 140);
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.moveTo(0, 110);
  ctx.quadraticCurveTo(90, 50, 190, 96);
  ctx.quadraticCurveTo(280, 60, W, 92);
  ctx.lineTo(W, 160);
  ctx.lineTo(0, 160);
  ctx.fill();
  // Tree line
  for (let i = 0; i < 9; i++) {
    const x = 10 + i * 42;
    const y = 96 + Math.sin(i * 1.7) * 8;
    ctx.fillStyle = i % 2 ? '#15803d' : '#166534';
    ctx.beginPath();
    ctx.arc(x, y, 22 + (i % 3) * 5, 0, TAU);
    ctx.fill();
  }
  // Grass everywhere round the pond
  const grass = ctx.createLinearGradient(0, 100, 0, H);
  grass.addColorStop(0, '#4ade80');
  grass.addColorStop(1, '#15803d');
  ctx.fillStyle = grass;
  ctx.fillRect(0, 108, W, H - 108);
  // Flowers on the bank
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W;
    const y = 440 + rnd() * 120;
    ctx.fillStyle = `rgba(20,83,45,${0.25 + rnd() * 0.2})`;
    ctx.fillRect(x, y, 2, 6);
    if (i % 3 === 0) {
      ctx.fillStyle = ['#fde047', '#f9a8d4', '#ffffff'][i % 3 === 0 ? (i / 3) % 3 : 0];
      ctx.beginPath();
      ctx.arc(x + 1, y, 3, 0, TAU);
      ctx.fill();
    }
  }
  // Sandy shore and the water
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.ellipse(POND.x, POND.y + 4, POND.rx + 8, POND.ry + 9, 0, 0, TAU);
  ctx.fill();
  const water = ctx.createRadialGradient(POND.x, POND.y - 30, 20, POND.x, POND.y, POND.rx);
  water.addColorStop(0, '#22d3ee');
  water.addColorStop(0.6, '#0891b2');
  water.addColorStop(1, '#155e75');
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, TAU);
  ctx.fill();
  // Pebbles on the bottom
  for (let i = 0; i < 30; i++) {
    const a = rnd() * TAU;
    const d = Math.sqrt(rnd()) * 0.9;
    ctx.fillStyle = `rgba(8,51,68,${0.15 + rnd() * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(POND.x + Math.cos(a) * POND.rx * d, POND.y + Math.sin(a) * POND.ry * d, 3 + rnd() * 5, 2 + rnd() * 3, rnd() * 3, 0, TAU);
    ctx.fill();
  }
  sceneCache = c;
  return c;
}

function pondClip(ctx) {
  ctx.beginPath();
  ctx.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, TAU);
  ctx.clip();
}

function drawShimmer(ctx, t) {
  ctx.save();
  pondClip(ctx);
  // Moving light bands
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 11; k++) {
    const y0 = POND.y - POND.ry + 18 + k * 30;
    ctx.beginPath();
    for (let x = POND.x - POND.rx; x <= POND.x + POND.rx; x += 12) {
      const y = y0 + Math.sin(x / 26 + t * 1.6 + k) * 3 + Math.sin(x / 11 - t * 2.3) * 1.2;
      if (x === POND.x - POND.rx) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Glints
  for (let i = 0; i < 12; i++) {
    const x = POND.x + Math.sin(i * 2.3) * POND.rx * 0.8;
    const y = POND.y + Math.cos(i * 1.9) * POND.ry * 0.75;
    const tw = Math.max(0, Math.sin(t * 2 + i * 1.3));
    ctx.fillStyle = `rgba(255,255,255,${tw * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 6 * tw + 1, 1.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawBoot(ctx, x, y, size, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const s = size / 34;
  ctx.scale(s, s);
  ctx.fillStyle = '#78350f';
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -16);
  ctx.lineTo(6, -16);
  ctx.lineTo(6, 2);
  ctx.quadraticCurveTo(20, 2, 20, 10);
  ctx.lineTo(20, 14);
  ctx.lineTo(-10, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a16207';
  ctx.fillRect(-9, -18, 16, 5);
  ctx.fillStyle = '#292524';
  ctx.fillRect(-10, 11, 30, 3);
  ctx.restore();
}

function drawFish(ctx, f, t) {
  const k = FISH_KINDS[f.kind];
  const flip = Math.cos(f.heading) < 0;
  const size = k.size;
  const tilt = Math.sin(f.heading) * (flip ? -0.35 : 0.35);
  const wig = Math.sin(t * (f.state === 'flee' ? 22 : 9) + f.phase);
  ctx.save();
  ctx.globalAlpha = f.fade;
  // Shadow under the water
  ctx.fillStyle = 'rgba(8,47,73,0.35)';
  ctx.beginPath();
  ctx.ellipse(f.x + 4, f.y + 7, size * 0.42, size * 0.16, tilt, 0, TAU);
  ctx.fill();
  if (k.junk) {
    ctx.globalAlpha = f.fade * 0.8;
    drawBoot(ctx, f.x, f.y, size, Math.sin(t + f.phase) * 0.2);
  } else {
    // The sprite, seen through the water (a little faded, tail waving)
    ctx.globalAlpha = f.fade * (f.state === 'hooked' ? 1 : 0.72);
    ctx.translate(f.x, f.y);
    ctx.rotate(f.state === 'hooked' ? Math.sin(t * 18) * 0.35 : tilt);
    ctx.scale((flip ? -1 : 1) * (1 + wig * 0.05), 1 - wig * 0.03);
    // Magikarp art faces left, so flip the other way
    drawSprite(ctx, fishImage(f.kind), 0, 0, size, { flip: true, color: f.kind === 'goldeen' ? '#fdba74' : f.kind === 'gyarados' ? '#3b82f6' : '#f97316' });
  }
  ctx.restore();
  if (k.rare && f.state !== 'hooked') {
    const tw = (Math.sin(t * 5 + f.phase) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.5})`;
    ctx.beginPath();
    ctx.arc(f.x + Math.cos(t * 2) * size * 0.5, f.y - size * 0.3, 1.5 + tw * 2, 0, TAU);
    ctx.fill();
  }
}

function drawPads(ctx, t) {
  for (const p of PADS) {
    const a = p.a + Math.sin(t * 0.6 + p.x) * 0.08;
    ctx.fillStyle = 'rgba(8,47,73,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x + 3, p.y + 4, p.r, p.r * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r, p.r * 0.62, 0, a, a + TAU - 0.55);
    ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(187,247,208,0.5)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(a + 2) * p.r * 0.8, p.y + Math.sin(a + 2) * p.r * 0.5);
    ctx.stroke();
    if (p.flower) {
      for (let i = 0; i < 6; i++) {
        const b = (i * TAU) / 6 + t * 0.2;
        ctx.fillStyle = i % 2 ? '#f9a8d4' : '#fbcfe8';
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(b) * 5, p.y - 4 + Math.sin(b) * 3, 5, 3, b, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 4, 3, 0, TAU);
      ctx.fill();
    }
  }
}

function drawReeds(ctx, t) {
  for (const [x, y] of REEDS) {
    for (let i = 0; i < 3; i++) {
      const sway = Math.sin(t * 1.4 + x * 0.1 + i) * 4;
      const h = 34 + i * 8;
      ctx.strokeStyle = i % 2 ? '#15803d' : '#166534';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + i * 4 - 4, y);
      ctx.quadraticCurveTo(x + i * 4 - 4, y - h / 2, x + i * 4 - 4 + sway, y - h);
      ctx.stroke();
      if (i === 1) {
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.ellipse(x + sway * 0.85, y - h + 6, 3, 8, sway * 0.03, 0, TAU);
        ctx.fill();
      }
    }
  }
}

function bobberPos(b, t) {
  if (b.state === 'fly') {
    const k = Math.min(1, b.t / CAST_TIME);
    return { x: b.from.x + (b.x - b.from.x) * k, y: b.from.y + (b.y - b.from.y) * k - Math.sin(k * Math.PI) * 90, flying: true };
  }
  const bob = Math.sin(t * 3) * 1.5;
  const twitch = b.twitch > 0 ? Math.sin((b.twitch / 0.28) * Math.PI) * 5 : 0;
  return { x: b.x, y: b.y + bob + twitch + (b.dip ? 7 : 0), dip: b.dip };
}

function drawBobber(ctx, b, t, v, hooked) {
  // While reeling, the line goes to the fish in the air
  const p = hooked ? { x: hooked.x, y: hooked.y + 6 } : bobberPos(b, t);
  // Line from the rod tip, sagging a little
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ROD_TIP.x, ROD_TIP.y);
  const sag = p.flying ? 0 : 30;
  ctx.quadraticCurveTo((ROD_TIP.x + p.x) / 2, Math.max(ROD_TIP.y, p.y) + sag - 40, p.x, p.y - 6);
  ctx.stroke();
  if (b.state === 'reel') return;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.dip) {
    // Pulled under: only a red tip shows, shaking
    ctx.translate(Math.sin(t * 40) * 1.5, 0);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, -3, 4, Math.PI, 0);
    ctx.fill();
  } else {
    if (!p.flying) {
      ctx.fillStyle = 'rgba(8,47,73,0.3)';
      ctx.beginPath();
      ctx.ellipse(2, 5, 8, 3, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 7, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-1, -12, 2, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(-2.5, -3, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // "!" when a fish bites
  if (v.exclaim > 0) {
    const k = 1 - v.exclaim / 0.9;
    const s = k < 0.2 ? 0.5 + k * 4 : 1.3 - Math.min(0.3, (k - 0.2) * 1.2);
    ctx.save();
    ctx.translate(p.x, p.y - 32);
    ctx.scale(s, s);
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b91c1c';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
  }
}

function drawRipples(ctx, v, dt) {
  for (let i = v.ripples.length - 1; i >= 0; i--) {
    const r = v.ripples[i];
    r.life -= dt;
    if (r.life <= 0) {
      v.ripples.splice(i, 1);
      continue;
    }
    const k = 1 - r.life / r.max;
    for (let ring = 0; ring < r.rings; ring++) {
      const kk = k - ring * 0.18;
      if (kk <= 0) continue;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - kk) * 0.8})`;
      ctx.lineWidth = 2 * (1 - kk) + 0.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.size * kk, r.size * kk * 0.45, 0, 0, TAU);
      ctx.stroke();
    }
  }
}

function drawAngler(ctx, img, t, v) {
  // The child's Pokemon on the bank with a rod; leans back when reeling
  const lean = v.reeling ? -0.14 + Math.sin(t * 16) * 0.04 : Math.sin(t * 1.8) * 0.03;
  const hop = v.cheer > 0 ? Math.abs(Math.sin(v.cheer * 12)) * 10 : 0;
  ctx.fillStyle = 'rgba(20,83,45,0.35)';
  ctx.beginPath();
  ctx.ellipse(62, 520, 40, 9, 0, 0, TAU);
  ctx.fill();
  drawSprite(ctx, img, 62, 480 - hop, 92, { rotate: lean });
  // Rod
  const bend = v.reeling ? 16 : v.biting ? 6 : 0;
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(HAND.x - 14, HAND.y + 14);
  ctx.quadraticCurveTo(HAND.x + 10, HAND.y - 40, ROD_TIP.x + bend * 0.4, ROD_TIP.y + bend);
  ctx.stroke();
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(HAND.x - 6, HAND.y + 4, 5, 0, TAU);
  ctx.fill();
}

const snap = (s) => {
  const f = engaged(s);
  return {
    score: s.score,
    left: timeLeft(s),
    catches: s.catches.length,
    stars: fishingStars(s),
    biting: f?.state === 'bite',
    bobber: s.bobber ? s.bobber.state : 'none',
    early: s.early,
    status: s.status,
    best: s.catches.reduce((b, k) => (!b || FISH_KINDS[k].points > FISH_KINDS[b].points ? k : b), null),
    gyarados: s.catches.filter((k) => k === 'gyarados').length,
  };
};

/**
 * "Câu cá Magikarp": tap the pond to cast from the rod the child's Pokemon holds. Fish nibble
 * then bite; tap on the bite (not the nibble!) to hook them. 60 seconds.
 */
export function FishingGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createFishing({ random }));
  const game = useRef(first);
  const fx = useRef({ time: 0, particles: [], ripples: [], exclaim: 0, cheer: 0, reeling: false, biting: false });
  const [ui, setUi] = useState(() => snap(first));
  const [card, setCard] = useState(null);
  const [banner, setBanner] = useState(null);
  const [shake, setShake] = useState(false);
  const later = useLater();
  const idRef = useRef(0);
  const img = loadImage(player.image);

  const say = (text, tone, ms = 1300) => {
    const id = ++idRef.current;
    setBanner({ text, tone, id });
    later(() => setBanner((b) => (b?.id === id ? null : b)), ms);
  };

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    v.exclaim = Math.max(0, v.exclaim - dt);
    v.cheer = Math.max(0, v.cheer - dt);
    if (phase === 'play') {
      stepFishing(s, dt);
      for (const e of s.events.splice(0)) {
        if (e.type === 'cast') sounds.playWhoosh();
        else if (e.type === 'splash') {
          sounds.playPop();
          v.ripples.push({ x: e.x, y: e.y, size: 34, rings: 3, life: 1.1, max: 1.1 });
          burst(v.particles, e.x, e.y, { count: 8, colors: ['#e0f2fe', '#ffffff'], speed: 80, gravity: 300, size: 2.5 });
        } else if (e.type === 'nibble') {
          sounds.playNote(1320, { duration: 0.06, volume: 0.12 });
          v.ripples.push({ x: e.x, y: e.y, size: 18, rings: 1, life: 0.6, max: 0.6 });
        } else if (e.type === 'bite') {
          sounds.playNote(988, { duration: 0.14, volume: 0.28 });
          sounds.playNote(1318, { duration: 0.18, delay: 0.08, volume: 0.28 });
          v.exclaim = 0.9;
          v.ripples.push({ x: e.x, y: e.y, size: 56, rings: 3, life: 0.9, max: 0.9 });
          burst(v.particles, e.x, e.y, { count: 10, colors: ['#e0f2fe', '#ffffff', '#67e8f9'], speed: 110, gravity: 320, size: 3 });
        } else if (e.type === 'hook') {
          const big = FISH_KINDS[e.kind].rare;
          sounds.playPop();
          if (big) sounds.playEnergySurge();
          v.ripples.push({ x: e.x, y: e.y, size: big ? 90 : 60, rings: 4, life: 1.2, max: 1.2 });
          burst(v.particles, e.x, e.y, { count: big ? 40 : 22, colors: ['#e0f2fe', '#ffffff', '#67e8f9', '#38bdf8'], speed: big ? 240 : 170, gravity: 420, size: big ? 4.5 : 3.5 });
          if (big) {
            setShake(true);
            later(() => setShake(false), 550);
            say('GYARADOS!!! Kéo mạnh lên! 💪', 'blue', 1100);
          }
        } else if (e.type === 'catch') {
          const k = FISH_KINDS[e.kind];
          v.cheer = e.junk ? 0 : 0.8;
          burst(v.particles, ROD_TIP.x - 30, ROD_TIP.y + 20, { count: e.rare ? 36 : 18, colors: e.junk ? ['#a16207', '#e7e5e4'] : ['#fde047', '#f472b6', '#38bdf8', '#ffffff'], speed: 180, gravity: 260 });
          if (e.junk) {
            sounds.playOops();
          } else {
            sounds.playCoin();
            const notes = e.rare ? [523, 659, 784, 1047, 1319] : [659, 784, 1047];
            notes.forEach((f, i) => sounds.playNote(f, { duration: 0.22, delay: 0.06 + i * 0.09, volume: 0.2 }));
          }
          const id = ++idRef.current;
          setCard({ id, kind: e.kind, name: k.name, points: e.points, rare: e.rare, junk: e.junk });
          later(() => setCard((c) => (c?.id === id ? null : c)), 1500);
        } else if (e.type === 'early') {
          sounds.playOops();
          say('Sớm quá! Cá sợ chạy mất rồi 🐟💨', 'soft');
        } else if (e.type === 'escape') {
          sounds.playNote(330, { duration: 0.25, volume: 0.16 });
          say('Chậm mất rồi! Cá bơi đi mất 😅', 'soft');
        } else if (e.type === 'end') {
          sounds.playWhoosh();
          later(() => setPhase('done'), 700);
        }
      }
      const f = engaged(s);
      v.reeling = s.bobber?.state === 'reel';
      v.biting = f?.state === 'bite';
      setUi(snap(s));
    }
    const ctx = getCtx();
    if (!ctx) {
      updateParticles(null, v.particles, dt);
      v.ripples = v.ripples.filter((r) => (r.life -= dt) > 0);
      return;
    }
    const t = v.time;
    ctx.clearRect(0, 0, W, H);
    const bg = scene();
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else {
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0891b2';
      ctx.beginPath();
      ctx.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, TAU);
      ctx.fill();
    }
    // Sun and a drifting cloud
    ctx.fillStyle = 'rgba(253,224,71,0.95)';
    ctx.beginPath();
    ctx.arc(318, 36, 18, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const cx = ((t * 7) % (W + 100)) - 50;
    ctx.beginPath();
    ctx.arc(cx, 34, 11, 0, TAU);
    ctx.arc(cx + 14, 28, 14, 0, TAU);
    ctx.arc(cx + 30, 34, 10, 0, TAU);
    ctx.fill();
    // Water, fish under it, then what floats on top
    ctx.save();
    pondClip(ctx);
    for (const f of s.fish) if (f.state !== 'hooked') drawFish(ctx, f, t);
    ctx.restore();
    drawShimmer(ctx, t);
    drawRipples(ctx, v, dt);
    drawPads(ctx, t);
    drawReeds(ctx, t);
    drawAngler(ctx, img, t, v);
    if (s.bobber) drawBobber(ctx, s.bobber, t, v, s.bobber.state === 'reel' ? engaged(s) : null);
    for (const f of s.fish) if (f.state === 'hooked') drawFish(ctx, f, t);
    updateParticles(ctx, v.particles, dt);
    // Tap hint before the first cast
    if (phase === 'play' && !s.bobber && s.casts === 0) {
      const k = (Math.sin(t * 5) + 1) / 2;
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + k * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(POND.x, POND.y, 18 + k * 10, 0, TAU);
      ctx.stroke();
    }
  }, phase !== 'done');

  const tap = (e) => {
    if (phase !== 'play' || !canvasRef.current) return;
    const p = canvasPoint(canvasRef.current, e, W, H);
    const out = tapPond(game.current, p.x, p.y);
    if (out === 'land' && !game.current.bobber) say('Chạm vào mặt nước để thả câu nhé! 💧', 'soft', 1100);
    setUi(snap(game.current));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      e.preventDefault();
      if (phase !== 'play') return;
      const s = game.current;
      // Space hooks a bite, or casts to the middle of the pond
      const b = s.bobber;
      tapPond(s, b ? b.x : POND.x, b ? b.y : POND.y);
      setUi(snap(s));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const replay = () => {
    game.current = createFishing({ random });
    fx.current = { time: 0, particles: [], ripples: [], exclaim: 0, cheer: 0, reeling: false, biting: false };
    setUi(snap(game.current));
    setCard(null);
    setBanner(null);
    setPhase('ready');
  };

  const left = Math.ceil(ui.left);
  const bestKind = ui.best;

  return (
    <CarnivalShell
      title="🎣 Câu cá Magikarp"
      label="Câu cá Magikarp"
      onClose={onClose}
      background="bg-gradient-to-b from-sky-400 via-cyan-600 to-emerald-800"
      dataAttrs={{ 'data-phase': phase, 'data-score': ui.score, 'data-catches': ui.catches, 'data-bobber': ui.bobber, 'data-biting': ui.biting ? 'yes' : 'no' }}
      hud={
        <>
          <HudBar
            items={[
              { icon: '⭐', label: 'Điểm', value: ui.score, testId: 'fishing-score' },
              { icon: '🐟', label: 'Cá', value: ui.catches },
              { icon: '⏱', label: 'Còn', value: `${left}s`, warn: left <= 10 && phase === 'play' },
            ]}
          />
          <div className="mt-1 h-2 rounded-full bg-black/30 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-300 to-emerald-400 transition-[width] duration-200" style={{ width: `${(ui.left / DURATION) * 100}%` }} />
          </div>
        </>
      }
    >
      <div className="relative flex-1 min-h-0 flex items-start justify-center overflow-hidden">
        <div className={`relative h-full flex items-start justify-center ${shake ? 'fishing-shake' : ''}`}>
          <canvas
            ref={canvasRef}
            onPointerDown={tap}
            className="max-w-full max-h-full touch-none"
            style={{ aspectRatio: `${W} / ${H}`, height: '100%', width: 'auto' }}
            data-testid="fishing-stage"
          />
        </div>
        {ui.biting && phase === 'play' && (
          <p className="fishing-now absolute top-[40%] inset-x-0 text-center text-4xl font-black text-yellow-300 drop-shadow-[0_3px_3px_rgba(0,0,0,0.8)] pointer-events-none" data-testid="fishing-bite">
            GIẬT NGAY!
          </p>
        )}
        {banner && (
          <p key={banner.id} className={`banner-slam absolute top-[6%] inset-x-6 text-center text-lg font-black px-3 py-2 rounded-2xl shadow-xl pointer-events-none ${banner.tone === 'blue' ? 'bg-sky-500 text-white' : 'bg-white/90 text-slate-700'}`}>
            {banner.text}
          </p>
        )}
        {card && (
          <div key={card.id} className={`fishing-card absolute top-[14%] left-1/2 w-48 rounded-3xl border-4 px-3 py-3 text-center shadow-2xl pointer-events-none ${card.junk ? 'bg-stone-100 border-stone-400' : card.rare ? 'bg-gradient-to-b from-sky-200 to-indigo-300 border-yellow-300' : 'bg-gradient-to-b from-amber-50 to-orange-200 border-orange-400'}`} data-testid="fishing-card">
            <p className="text-xs font-black uppercase tracking-wide text-slate-600">{card.junk ? 'Ôi…' : card.rare ? 'Siêu hiếm!' : 'Câu được!'}</p>
            <div className="relative mx-auto my-1 w-24 h-24 flex items-center justify-center">
              {card.rare && <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,#fef9c3,transparent_70%)] shiny-twinkle" />}
              {card.junk ? <span className="text-6xl">🥾</span> : <img src={artworkUrl(FISH_KINDS[card.kind].dex)} alt={card.name} className="relative w-full h-full object-contain drop-shadow-lg" />}
            </div>
            <p className="text-lg font-black text-slate-800">{card.name}</p>
            <p className={`text-2xl font-black ${card.junk ? 'text-stone-500' : 'text-orange-600'}`}>{card.junk ? '0 điểm 😅' : `+${card.points}`}</p>
          </div>
        )}
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Cần thủ siêu đẳng! 🏆' : ui.catches ? 'Câu giỏi lắm! 🎣' : 'Lần sau cá sẽ cắn câu! 💪'}
            stars={ui.stars}
            detail={`${ui.score} điểm · câu được ${ui.catches} con${ui.gyarados ? ` · có ${ui.gyarados} Gyarados!` : bestKind && !FISH_KINDS[bestKind].junk ? ` · to nhất: ${FISH_KINDS[bestKind].name}` : ''}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
