import React, { useEffect, useRef, useState } from 'react';
import {
  CLAW_W as W,
  CLAW_H as H,
  TRIES,
  FLOOR_Y,
  CHUTE,
  PLUSH_R,
  GRAB_R,
  PERFECT,
  HOLD_DY,
  PLUSH_KINDS,
  createClaw,
  stepClawGame,
  drop,
  aimAt,
  setMove,
  target,
  canMove,
  clawStars,
} from '../../utils/carnival/claw';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite, burst, updateParticles } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown } from './CarnivalCommon';

const TAU = Math.PI * 2;
const GLASS = { left: 16, right: 344, top: 88, bottom: 502 };
const CARRIAGE_Y = 100;
const plushImage = (kind) => loadImage(artworkUrl(PLUSH_KINDS[kind].dex));
const sizeOf = (kind) => PLUSH_KINDS[kind].size || 1;

// Bulbs round the glass: a list of points along the frame, lit in a chasing pattern
const BULBS = (() => {
  const pts = [];
  const { left, right, top, bottom } = GLASS;
  const step = 22;
  for (let x = left; x < right; x += step) pts.push([x, top - 6]);
  for (let y = top; y < bottom; y += step) pts.push([right + 6, y]);
  for (let x = right; x > left; x -= step) pts.push([x, bottom + 6]);
  for (let y = bottom; y > top; y -= step) pts.push([left - 6, y]);
  return pts;
})();

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCabinet(ctx, t, celebrate) {
  // Body
  const body = ctx.createLinearGradient(0, 0, W, H);
  body.addColorStop(0, '#f472b6');
  body.addColorStop(0.5, '#c026d3');
  body.addColorStop(1, '#6d28d9');
  ctx.fillStyle = body;
  roundRect(ctx, 0, 0, W, H, 26);
  ctx.fill();
  // Marquee sign
  const sign = ctx.createLinearGradient(0, 8, 0, 70);
  sign.addColorStop(0, '#fde68a');
  sign.addColorStop(1, '#f59e0b');
  ctx.fillStyle = sign;
  roundRect(ctx, 30, 10, W - 60, 56, 20);
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.save();
  ctx.font = '900 25px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = celebrate > 0 ? '#fff' : '#f472b6';
  ctx.shadowBlur = 8 + Math.sin(t * 4) * 4 + celebrate * 12;
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#9d174d';
  ctx.strokeText('GẮP THÚ POKÉMON', W / 2, 39);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('GẮP THÚ POKÉMON', W / 2, 39);
  ctx.restore();
  // Marquee bulbs
  for (let i = 0; i < 13; i++) {
    const x = 46 + i * 22.3;
    for (const y of [16, 60]) {
      const on = (Math.floor(t * 6) + i + (y > 30 ? 1 : 0)) % 2 === 0;
      ctx.fillStyle = on ? '#fffbeb' : '#fb923c';
      ctx.beginPath();
      ctx.arc(x, y, on ? 3.2 : 2.4, 0, TAU);
      ctx.fill();
    }
  }
  // Glass back: night-sky wallpaper with faint Pokeballs
  const { left, right, top, bottom } = GLASS;
  const back = ctx.createLinearGradient(0, top, 0, bottom);
  back.addColorStop(0, '#312e81');
  back.addColorStop(0.6, '#5b21b6');
  back.addColorStop(1, '#831843');
  ctx.fillStyle = back;
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 2;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const x = left + 30 + c * 56 + (r % 2) * 28;
      const y = top + 40 + r * 62;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, TAU);
      ctx.moveTo(x - 12, y);
      ctx.lineTo(x + 12, y);
      ctx.stroke();
    }
  }
  // Twinkling stars in the back
  for (let i = 0; i < 14; i++) {
    const x = left + ((i * 83) % (right - left));
    const y = top + 20 + ((i * 47) % 220);
    const tw = (Math.sin(t * 2.5 + i * 1.7) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + tw * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + tw * 1.3, 0, TAU);
    ctx.fill();
  }
  // Soft cushion floor
  const floor = ctx.createLinearGradient(0, FLOOR_Y - 6, 0, bottom);
  floor.addColorStop(0, '#f9a8d4');
  floor.addColorStop(1, '#db2777');
  ctx.fillStyle = floor;
  ctx.fillRect(left, FLOOR_Y - 4, right - left, bottom - FLOOR_Y + 4);
  // Chute: dark hole with a sign
  const hole = ctx.createLinearGradient(0, CHUTE.top, 0, bottom);
  hole.addColorStop(0, '#1e1b4b');
  hole.addColorStop(1, '#020617');
  ctx.fillStyle = hole;
  ctx.fillRect(CHUTE.left, CHUTE.top + 8, CHUTE.right - CHUTE.left, bottom - CHUTE.top - 8);
}

function drawChuteFront(ctx, t, glow) {
  // Clear acrylic walls round the chute, with a bouncing arrow
  ctx.fillStyle = 'rgba(186,230,253,0.28)';
  ctx.fillRect(CHUTE.left - 4, CHUTE.top, 6, GLASS.bottom - CHUTE.top);
  ctx.fillRect(CHUTE.right - 2, CHUTE.top, 6, GLASS.bottom - CHUTE.top);
  ctx.fillStyle = glow > 0 ? `rgba(253,224,71,${0.6 + glow * 0.4})` : 'rgba(255,255,255,0.75)';
  ctx.fillRect(CHUTE.left - 4, CHUTE.top - 4, CHUTE.right - CHUTE.left + 10, 8);
  ctx.save();
  ctx.font = '900 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fde047';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 4;
  ctx.fillText('QUÀ', CHUTE.x, CHUTE.top + 30);
  const bob = Math.sin(t * 5) * 4;
  ctx.beginPath();
  ctx.moveTo(CHUTE.x - 9, CHUTE.top + 40 + bob);
  ctx.lineTo(CHUTE.x + 9, CHUTE.top + 40 + bob);
  ctx.lineTo(CHUTE.x, CHUTE.top + 52 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlush(ctx, p, t, { glow = false, rotate = 0 } = {}) {
  const size = sizeOf(p.kind);
  const r = PLUSH_R * size;
  const resting = p.state === 'rest';
  const bob = resting ? Math.sin(t * 2.2 + p.phase) : 0;
  // Shadow on the cushion, smaller when high up
  if (p.state !== 'chute') {
    const h = Math.max(0, FLOOR_Y - (p.y + r));
    const k = Math.max(0.25, 1 - h / 300);
    ctx.fillStyle = `rgba(80,7,36,${0.35 * k})`;
    ctx.beginPath();
    ctx.ellipse(p.x, FLOOR_Y - 2, r * 0.9 * k, 5 * k, 0, 0, TAU);
    ctx.fill();
  }
  const kind = PLUSH_KINDS[p.kind];
  if (kind.rare) {
    // Rare plush glows and sparkles
    ctx.save();
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r * 1.5);
    g.addColorStop(0, `rgba(251,207,232,${0.5 + Math.sin(t * 4) * 0.2})`);
    g.addColorStop(1, 'rgba(251,207,232,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  if (glow) {
    ctx.save();
    ctx.strokeStyle = `rgba(253,224,71,${0.55 + Math.sin(t * 8) * 0.35})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -t * 20;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.12, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // Squishy breathing: a plush is soft
  ctx.save();
  ctx.translate(p.x, p.y + r);
  ctx.rotate(rotate + (p.tilt || 0));
  ctx.scale(1 + bob * 0.025, 1 - bob * 0.03);
  drawSprite(ctx, plushImage(p.kind), 0, -r, r * 2.5, { color: '#f9a8d4' });
  ctx.restore();
  if (kind.rare) {
    for (let i = 0; i < 3; i++) {
      const a = t * 1.6 + (i * TAU) / 3;
      const tw = (Math.sin(t * 6 + i * 2) + 1) / 2;
      star4(ctx, p.x + Math.cos(a) * r * 1.1, p.y + Math.sin(a) * r * 0.9, 2 + tw * 4, `rgba(255,255,255,${0.4 + tw * 0.6})`);
    }
  }
}

function star4(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? s * 0.3 : s;
    const a = (i * Math.PI) / 4;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function prong(ctx, side, open, front) {
  // One claw finger: an upper arm and a hooked tip
  const spread = 0.18 + open * 0.75;
  ctx.save();
  ctx.rotate(side * spread);
  ctx.strokeStyle = front ? '#e2e8f0' : '#94a3b8';
  ctx.lineWidth = front ? 6 : 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(side * 7, 24);
  ctx.quadraticCurveTo(side * 10, 38, side * -3, 44);
  ctx.stroke();
  ctx.strokeStyle = front ? '#64748b' : '#475569';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawClaw(ctx, s, t, heldPlush) {
  const c = s.claw;
  // Rail and carriage
  const rail = ctx.createLinearGradient(0, CARRIAGE_Y - 8, 0, CARRIAGE_Y + 4);
  rail.addColorStop(0, '#f1f5f9');
  rail.addColorStop(1, '#64748b');
  ctx.fillStyle = rail;
  ctx.fillRect(GLASS.left, CARRIAGE_Y - 8, GLASS.right - GLASS.left, 9);
  ctx.fillStyle = '#334155';
  roundRect(ctx, c.x - 20, CARRIAGE_Y - 12, 40, 16, 5);
  ctx.fill();
  ctx.fillStyle = (Math.floor(t * 4) % 2 === 0 && c.state !== 'idle') ? '#f87171' : '#4ade80';
  ctx.beginPath();
  ctx.arc(c.x + 12, CARRIAGE_Y - 4, 2.5, 0, TAU);
  ctx.fill();
  // The claw swings like a pendulum from the carriage
  const len = c.y - 18 - CARRIAGE_Y;
  ctx.save();
  ctx.translate(c.x, CARRIAGE_Y);
  ctx.rotate(c.sway);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, len);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(15,23,42,0.4)';
  ctx.lineWidth = 1;
  for (let y = 6; y < len; y += 7) {
    ctx.beginPath();
    ctx.moveTo(-1, y);
    ctx.lineTo(1, y + 3);
    ctx.stroke();
  }
  ctx.translate(0, len);
  // Back finger, the plush, then the front fingers
  ctx.save();
  ctx.translate(0, 14);
  prong(ctx, 0, 0, false);
  ctx.restore();
  if (heldPlush) {
    ctx.save();
    ctx.translate(0, 18 + HOLD_DY);
    const wig = s.claw.slipY != null ? Math.sin(t * 22) * 0.12 : 0;
    drawSprite(ctx, plushImage(heldPlush.kind), 0, 0, PLUSH_R * sizeOf(heldPlush.kind) * 2.5, { rotate: wig, color: '#f9a8d4' });
    ctx.restore();
  }
  ctx.save();
  ctx.translate(0, 14);
  prong(ctx, -1, c.open, true);
  prong(ctx, 1, c.open, true);
  ctx.restore();
  // Hub
  const hub = ctx.createLinearGradient(-16, 0, 16, 18);
  hub.addColorStop(0, '#f8fafc');
  hub.addColorStop(1, '#64748b');
  ctx.fillStyle = hub;
  roundRect(ctx, -16, 0, 32, 18, 7);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, 9, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-1.5, 7.5, 1.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawGlassAndLights(ctx, t, celebrate) {
  const { left, right, top, bottom } = GLASS;
  // Reflections
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, right - left, bottom - top);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (const [x0, w] of [[40, 34], [96, 12], [250, 22]]) {
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x0 + w, top);
    ctx.lineTo(x0 + w - 150, bottom);
    ctx.lineTo(x0 - 150, bottom);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Frame
  ctx.strokeStyle = '#fbcfe8';
  ctx.lineWidth = 5;
  roundRect(ctx, left - 2, top - 2, right - left + 4, bottom - top + 4, 8);
  ctx.stroke();
  // Chasing lights (faster and all gold when a prize is won)
  const speed = celebrate > 0 ? 30 : 10;
  const head = Math.floor(t * speed);
  BULBS.forEach(([x, y], i) => {
    const lit = celebrate > 0 ? (i + head) % 2 === 0 : (i + head) % 5 < 2;
    if (lit) {
      ctx.save();
      ctx.shadowColor = celebrate > 0 ? '#fde047' : '#fff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = celebrate > 0 ? '#fef08a' : ['#fff7ed', '#bae6fd', '#fbcfe8'][i % 3];
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(88,28,135,0.8)';
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, TAU);
      ctx.fill();
    }
  });
  // Control panel below the glass: prize door and coin slot
  const panel = ctx.createLinearGradient(0, bottom + 12, 0, H);
  panel.addColorStop(0, '#7e22ce');
  panel.addColorStop(1, '#4c1d95');
  ctx.fillStyle = panel;
  roundRect(ctx, 12, bottom + 14, W - 24, H - bottom - 20, 12);
  ctx.fill();
  ctx.fillStyle = '#1e1b4b';
  roundRect(ctx, CHUTE.left - 4, bottom + 20, CHUTE.right - CHUTE.left + 8, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LẤY QUÀ', CHUTE.x, bottom + 39);
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, W - 70, bottom + 24, 40, 20, 6);
  ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.fillRect(W - 54, bottom + 28, 8, 12);
}

function drawAimGuide(ctx, s, t) {
  const c = s.claw;
  if (c.state !== 'idle') return null;
  const tg = target(s);
  const good = tg && tg.dx / GRAB_R <= PERFECT;
  ctx.save();
  ctx.strokeStyle = good ? 'rgba(74,222,128,0.85)' : tg ? 'rgba(253,224,71,0.6)' : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = good ? 3 : 2;
  ctx.setLineDash([6, 8]);
  ctx.lineDashOffset = -t * 30;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y + 44);
  ctx.lineTo(c.x, FLOOR_Y);
  ctx.stroke();
  ctx.restore();
  return tg?.p || null;
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
    const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.5);
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life * 3);
    ctx.translate(f.x, f.y - k * 40);
    ctx.scale(pop, pop);
    ctx.font = `900 ${f.size || 26}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(f.text, 0, 0);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  }
}

function drawFlights(ctx, v, t) {
  // A won plush flies from the prize door up to the shelf
  for (const f of v.flights) {
    const k = Math.min(1, f.t / f.dur);
    const e = 1 - (1 - k) * (1 - k);
    const x = f.from.x + (f.to.x - f.from.x) * e;
    const y = f.from.y + (f.to.y - f.from.y) * e - Math.sin(k * Math.PI) * 120;
    const size = 64 + Math.sin(k * Math.PI) * 30 - k * 20;
    ctx.save();
    ctx.globalAlpha = k > 0.9 ? (1 - k) * 10 : 1;
    star4(ctx, x - 26, y + 10, 5 + Math.sin(t * 12) * 2, '#fde047');
    star4(ctx, x + 24, y - 16, 4 + Math.cos(t * 10) * 2, '#ffffff');
    drawSprite(ctx, plushImage(f.kind), x, y, size, { rotate: k * TAU, color: '#f9a8d4' });
    ctx.restore();
  }
}

const snap = (s) => ({
  score: s.score,
  tries: s.tries,
  prizes: s.prizes.map((p) => p.kind),
  state: s.claw.state,
  status: s.status,
  stars: clawStars(s),
  slips: s.slips,
});

const FANFARE = [523, 659, 784, 1047];

/**
 * "Máy gắp thú Pokémon": move the claw over the plush pile, press GẮP! and carry a plush to
 * the prize chute. Dead-centre grabs always hold; off-centre ones may slip. 6 tries.
 */
export function ClawGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [phase, setPhase] = useState('ready'); // ready | play | done
  const [first] = useState(() => createClaw({ random }));
  const game = useRef(first);
  const fx = useRef({ time: 0, particles: [], floats: [], flights: [], celebrate: 0, chuteGlow: 0 });
  const [ui, setUi] = useState(() => snap(first));
  const [landed, setLanded] = useState(0); // prizes that reached the shelf
  const [mood, setMood] = useState(null); // the child's Pokemon reacting
  const [banner, setBanner] = useState(null);
  const dragging = useRef(false);
  const later = useLater();
  const idRef = useRef(0);

  const react = (kind, text) => {
    const id = ++idRef.current;
    setMood({ kind, id });
    if (text) setBanner({ text, id, kind });
    later(() => setMood((m) => (m?.id === id ? null : m)), 900);
    if (text) later(() => setBanner((b) => (b?.id === id ? null : b)), 1400);
  };

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    v.celebrate = Math.max(0, v.celebrate - dt);
    v.chuteGlow = Math.max(0, v.chuteGlow - dt);
    if (phase === 'play') {
      stepClawGame(s, dt);
      for (const e of s.events.splice(0)) {
        if (e.type === 'drop') sounds.playWhoosh();
        else if (e.type === 'bottom') burst(v.particles, e.x, e.y + 30, { count: 8, colors: ['#fbcfe8', '#ffffff'], speed: 70, gravity: 120, size: 3 });
        else if (e.type === 'grab') {
          sounds.playPop();
          const c = s.claw;
          if (e.perfect) {
            burst(v.particles, c.x, c.y + 20, { count: 16, colors: ['#4ade80', '#fde047', '#ffffff'], speed: 130, gravity: 60 });
            v.floats.push({ x: c.x, y: c.y - 6, text: 'Chuẩn!', color: '#86efac', life: 1, max: 1, size: 22 });
          } else if (e.risky) v.floats.push({ x: c.x, y: c.y - 6, text: 'Lỏng tay…', color: '#fde68a', life: 1, max: 1, size: 18 });
        } else if (e.type === 'miss') {
          sounds.playNote(262, { duration: 0.25, volume: 0.18 });
          sounds.playNote(196, { duration: 0.35, delay: 0.12, volume: 0.18 });
          v.floats.push({ x: e.x, y: e.y, text: 'Hụt rồi!', color: '#e2e8f0', life: 1.1, max: 1.1, size: 20 });
          react('sad');
        } else if (e.type === 'slip') {
          sounds.playOops();
          v.floats.push({ x: e.x, y: e.y - 20, text: 'Ối!', color: '#fda4af', life: 1.2, max: 1.2, size: 34 });
          burst(v.particles, e.x, e.y, { count: 10, colors: ['#fda4af', '#ffffff'], speed: 110, gravity: 200 });
          react('sad', 'Tuột mất rồi! Thử lại nhé 💪');
        } else if (e.type === 'bounce') {
          if (e.hard) sounds.playPop();
          burst(v.particles, e.x, e.y, { count: e.hard ? 10 : 5, colors: ['#fbcfe8', '#f9a8d4', '#ffffff'], speed: 90, gravity: 220, size: 3 });
        } else if (e.type === 'release') {
          v.chuteGlow = 0.8;
        } else if (e.type === 'prize') {
          sounds.playCoin();
          FANFARE.forEach((f, i) => sounds.playNote(f, { duration: 0.28, delay: 0.1 + i * 0.1, volume: 0.22 }));
          v.celebrate = e.rare ? 2.5 : 1.4;
          burst(v.particles, CHUTE.x, CHUTE.top + 40, { count: e.rare ? 44 : 26, colors: ['#fde047', '#f472b6', '#38bdf8', '#ffffff'], speed: e.rare ? 260 : 190, gravity: 240 });
          v.floats.push({ x: CHUTE.x + 30, y: CHUTE.top + 10, text: `+${e.points}`, color: e.rare ? '#fde047' : '#ffffff', life: 1.3, max: 1.3, size: e.rare ? 34 : 28 });
          const index = s.prizes.length - 1;
          v.flights.push({ kind: e.kind, from: { x: CHUTE.x, y: GLASS.bottom + 30 }, to: { x: ((index + 0.5) / TRIES) * W, y: -30 }, t: 0, dur: 0.9 });
          later(() => setLanded((n) => Math.max(n, index + 1)), 900);
          const name = PLUSH_KINDS[e.kind].name;
          react('happy', e.rare ? `WOA! Gắp được ${name} hiếm! 🌟` : `Gắp được ${name}! 🎉`);
        } else if (e.type === 'end') {
          later(() => setPhase('done'), 1200);
        }
      }
      setUi(snap(s));
    }
    for (let i = v.flights.length - 1; i >= 0; i--) {
      v.flights[i].t += dt;
      if (v.flights[i].t >= v.flights[i].dur) v.flights.splice(i, 1);
    }
    const ctx = getCtx();
    if (!ctx) {
      updateParticles(null, v.particles, dt);
      v.floats = v.floats.filter((f) => (f.life -= dt) > 0);
      return;
    }
    ctx.clearRect(0, 0, W, H);
    drawCabinet(ctx, v.time, v.celebrate);
    const aimed = phase === 'play' ? drawAimGuide(ctx, s, v.time) : null;
    const held = s.claw.held ? s.plushes.find((p) => p.id === s.claw.held) : null;
    const order = [...s.plushes].filter((p) => p.state === 'rest' || p.state === 'fall' || p.state === 'chute').sort((a, b) => b.tier - a.tier);
    for (const p of order) drawPlush(ctx, p, v.time, { glow: p === aimed });
    drawChuteFront(ctx, v.time, v.chuteGlow);
    drawClaw(ctx, s, v.time, held);
    drawGlassAndLights(ctx, v.time, v.celebrate);
    updateParticles(ctx, v.particles, dt);
    drawFloats(ctx, v, dt);
    drawFlights(ctx, v, v.time);
  }, phase !== 'done');

  const move = (dir) => {
    if (phase !== 'play') return;
    setMove(game.current, dir);
  };
  const grab = () => {
    if (phase !== 'play') return;
    if (drop(game.current)) setUi(snap(game.current));
  };
  const aimFrom = (e) => {
    if (phase !== 'play' || !canvasRef.current || !canMove(game.current)) return;
    aimAt(game.current, canvasPoint(canvasRef.current, e, W, H).x);
  };

  useEffect(() => {
    const down = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        if (!e.repeat) move(e.code === 'ArrowLeft' ? -1 : 1);
      } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') {
        e.preventDefault();
        grab();
      }
    };
    const up = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') move(0);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const replay = () => {
    game.current = createClaw({ random });
    fx.current = { time: 0, particles: [], floats: [], flights: [], celebrate: 0, chuteGlow: 0 };
    setUi(snap(game.current));
    setLanded(0);
    setBanner(null);
    setPhase('ready');
  };

  const idle = ui.state === 'idle' && phase === 'play' && ui.tries > 0;
  const holdProps = (dir) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      move(dir);
    },
    onPointerUp: () => move(0),
    onPointerLeave: () => move(0),
    onPointerCancel: () => move(0),
  });

  return (
    <CarnivalShell
      title="🧸 Máy gắp thú"
      label="Máy gắp thú Pokémon"
      onClose={onClose}
      background="bg-gradient-to-b from-fuchsia-700 via-purple-800 to-indigo-950"
      dataAttrs={{ 'data-phase': phase, 'data-score': ui.score, 'data-tries': ui.tries, 'data-prizes': ui.prizes.length, 'data-claw': ui.state }}
      hud={
        <>
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-black/35 px-3 py-1 text-white text-sm font-black">
            <span className="tabular-nums" data-testid="claw-score">
              ⭐ Điểm: {ui.score}
            </span>
            <span className="flex items-center gap-0.5" aria-label={`Còn ${ui.tries} lượt`} data-testid="claw-coins">
              {Array.from({ length: TRIES }, (_, i) => (
                <span key={i} className={`claw-coin inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-black border-2 ${i < ui.tries ? 'bg-gradient-to-b from-yellow-200 to-amber-500 border-amber-600 text-amber-800' : 'bg-white/10 border-white/20 text-white/30 claw-coin-used'}`}>
                  P
                </span>
              ))}
            </span>
          </div>
          {/* Prize shelf */}
          <div className="mt-1 grid grid-cols-6 gap-1 rounded-2xl bg-gradient-to-b from-amber-200/90 to-amber-400/90 px-1.5 py-1 shadow-inner" data-testid="claw-shelf">
            {Array.from({ length: TRIES }, (_, i) => {
              const kind = i < landed ? ui.prizes[i] : null;
              return (
                <span key={i} className="relative aspect-square rounded-xl bg-amber-900/25 flex items-center justify-center overflow-visible">
                  {kind ? (
                    <img key={kind + i} src={artworkUrl(PLUSH_KINDS[kind].dex)} alt={PLUSH_KINDS[kind].name} className={`claw-shelf-pop w-full h-full object-contain drop-shadow ${PLUSH_KINDS[kind].rare ? 'shiny-twinkle' : ''}`} />
                  ) : (
                    <span className="text-amber-900/30 text-lg font-black">?</span>
                  )}
                </span>
              );
            })}
          </div>
        </>
      }
    >
      <div className="relative flex-1 min-h-0 flex flex-col items-center">
        <div className="relative flex-1 min-h-0 w-full flex items-start justify-center overflow-hidden px-2">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full touch-none"
            style={{ aspectRatio: `${W} / ${H}`, height: '100%', width: 'auto' }}
            data-testid="claw-stage"
            onPointerDown={(e) => {
              dragging.current = true;
              aimFrom(e);
            }}
            onPointerMove={(e) => dragging.current && aimFrom(e)}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
            onPointerLeave={() => (dragging.current = false)}
          />
          {banner && (
            <p key={banner.id} className={`banner-slam absolute top-[16%] inset-x-6 text-center text-xl font-black px-3 py-2 rounded-2xl shadow-xl pointer-events-none ${banner.kind === 'happy' ? 'bg-yellow-300 text-fuchsia-800' : 'bg-white/90 text-slate-700'}`}>
              {banner.text}
            </p>
          )}
        </div>
        <div className="relative w-full flex items-center justify-center gap-3 px-3 py-2">
          <img
            key={mood?.id || 'idle'}
            src={player.image}
            alt={player.name}
            className={`absolute left-2 bottom-2 w-14 h-14 object-contain drop-shadow-lg ${mood?.kind === 'happy' ? 'poke-hop' : mood?.kind === 'sad' ? 'wrong-shake' : 'sport-bob'}`}
          />
          <button type="button" aria-label="Sang trái" disabled={!idle} className="claw-arrow w-16 h-16 rounded-2xl bg-gradient-to-b from-sky-300 to-sky-600 border-b-4 border-sky-800 text-white text-3xl font-black shadow-lg active:translate-y-1 active:border-b-0 disabled:opacity-50 touch-none" {...holdProps(-1)}>
            ◀
          </button>
          <button
            type="button"
            onClick={grab}
            disabled={!idle}
            data-testid="claw-grab"
            className={`w-24 h-24 rounded-full bg-gradient-to-b from-red-400 to-red-700 border-4 border-yellow-300 text-white text-2xl font-black shadow-[0_6px_0_#7f1d1d,0_10px_20px_rgba(0,0,0,0.4)] active:translate-y-1 active:shadow-[0_2px_0_#7f1d1d] disabled:opacity-60 disabled:saturate-50 ${idle ? 'claw-grab-ready' : ''}`}
          >
            GẮP!
          </button>
          <button type="button" aria-label="Sang phải" disabled={!idle} className="claw-arrow w-16 h-16 rounded-2xl bg-gradient-to-b from-sky-300 to-sky-600 border-b-4 border-sky-800 text-white text-3xl font-black shadow-lg active:translate-y-1 active:border-b-0 disabled:opacity-50 touch-none" {...holdProps(1)}>
            ▶
          </button>
        </div>
        <p className="pb-2 text-[11px] font-bold text-white/70">Giữ ◀ ▶ hoặc kéo máy gắp · vạch xanh là chuẩn nhất!</p>
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Vua gắp thú! 🏆' : ui.prizes.length ? 'Giỏi lắm! 🧸' : 'Lần sau sẽ gắp được! 💪'}
            stars={ui.stars}
            detail={`${ui.score} điểm · gắp được ${ui.prizes.length} thú bông${ui.prizes.includes('mew') ? ' · có cả Mew hiếm!' : ''}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
