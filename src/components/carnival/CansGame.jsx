import React, { useEffect, useRef, useState } from 'react';
import { createCans, stepCans, throwBall, nextLevel, cansStars, standingCans, CAN_W, CAN_H, BALL_R, BALLS, SHELF_HALF, SHELF_DEPTH, LEVELS, MAX_Y } from '../../utils/carnival/cans';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite, drawPokeball, burst, updateParticles } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const W = 360;
const H = 560;
const PX = 38; // one can width in pixels
const SHELF_Y = 382;
const LAUNCH = { x: W / 2, y: 540 };
const SWIPE_MIN = 22;
const SWIPE_FULL = 300;
const CAN_COLORS = { 25: '#facc15', 1: '#4ade80', 4: '#fb923c', 7: '#38bdf8', 133: '#d97706', 39: '#f472b6', 54: '#fde047', 143: '#14b8a6', 35: '#f9a8d4', 175: '#fde68a' };

/** Shelf point (x across, y up, z back) to the screen. */
function project(x, y, z = 0) {
  const s = 1 / (1 + Math.max(-0.5, z) * 0.35);
  return { x: W / 2 + x * PX * s, y: SHELF_Y - y * PX * s - z * 16, s };
}

function swipeTarget(dx, dy) {
  if (-dy < SWIPE_MIN) return null;
  const len = Math.hypot(dx, dy);
  const y = (Math.max(0, Math.min(1, (len - SWIPE_MIN) / SWIPE_FULL)) * MAX_Y);
  const ty = SHELF_Y - y * PX;
  return { x: ((dx / -dy) * (LAUNCH.y - ty)) / PX, y };
}

const snap = (s) => ({ score: s.score, level: s.level, balls: s.balls, status: s.status, knocked: s.knocked, clears: s.clears, perfect: s.perfect, standing: standingCans(s).length, total: s.cans.length, stars: cansStars(s) });

function drawBooth(ctx, time) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#312e81');
  bg.addColorStop(0.6, '#581c87');
  bg.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Back wall: a big spotlight and a star pattern
  const spot = ctx.createRadialGradient(W / 2, 250, 10, W / 2, 250, 230);
  spot.addColorStop(0, 'rgba(253,230,138,0.35)');
  spot.addColorStop(1, 'rgba(253,230,138,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 18; i++) {
    const x = (i * 97) % W;
    const y = 80 + ((i * 53) % 220);
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 2 + i);
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Canopy
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? '#fef3c7' : '#7c3aed';
    ctx.fillRect(i * 40, 0, 40, 30);
    ctx.beginPath();
    ctx.arc(i * 40 + 20, 30, 20, 0, Math.PI);
    ctx.fill();
  }
  for (let i = 0; i < 12; i++) {
    const on = 0.5 + 0.5 * Math.sin(time * 4 + i * 1.9);
    ctx.globalAlpha = 0.4 + on * 0.6;
    ctx.fillStyle = ['#fde047', '#f472b6', '#67e8f9'][i % 3];
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(15 + i * 30, 60, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawShelf(ctx) {
  // Top surface (receding) then the front board and a cloth skirt
  const a = project(-SHELF_HALF, 0, 0);
  const b = project(SHELF_HALF, 0, 0);
  const c = project(SHELF_HALF, 0, SHELF_DEPTH);
  const d = project(-SHELF_HALF, 0, SHELF_DEPTH);
  const top = ctx.createLinearGradient(0, c.y, 0, a.y);
  top.addColorStop(0, '#92400e');
  top.addColorStop(1, '#d97706');
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
  const front = ctx.createLinearGradient(0, a.y, 0, a.y + 16);
  front.addColorStop(0, '#fbbf24');
  front.addColorStop(1, '#b45309');
  ctx.fillStyle = front;
  ctx.fillRect(a.x, a.y, b.x - a.x, 16);
  // Skirt with stripes and a scalloped hem
  for (let i = 0; i < 8; i++) {
    const x0 = a.x + ((b.x - a.x) * i) / 8;
    ctx.fillStyle = i % 2 ? '#fef3c7' : '#dc2626';
    ctx.fillRect(x0, a.y + 16, (b.x - a.x) / 8 + 0.5, 70);
    ctx.beginPath();
    ctx.arc(x0 + (b.x - a.x) / 16, a.y + 86, (b.x - a.x) / 16, 0, Math.PI);
    ctx.fill();
  }
  // Legs down to the floor
  ctx.fillStyle = '#78350f';
  ctx.fillRect(a.x + 6, a.y + 86, 10, 70);
  ctx.fillRect(b.x - 16, a.y + 86, 10, 70);
}

function drawCan(ctx, can) {
  // Centre height: half the can's height standing, half its width lying down
  const lift = (CAN_H / 2) * Math.abs(Math.cos(can.rot)) + (CAN_W / 2) * Math.abs(Math.sin(can.rot));
  const p = project(can.x, can.y + lift, can.z);
  const w = CAN_W * PX * p.s * 0.94;
  const h = CAN_H * PX * p.s;
  const color = CAN_COLORS[can.face] || '#f87171';
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-can.rot);
  // Metallic body
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, shade(color, -40));
  g.addColorStop(0.35, shade(color, 40));
  g.addColorStop(0.55, color);
  g.addColorStop(1, shade(color, -55));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.14);
  ctx.fill();
  // Rims
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-w / 2, -h / 2, w, h * 0.08);
  ctx.fillRect(-w / 2, h / 2 - h * 0.08, w, h * 0.08);
  ctx.fillStyle = 'rgba(100,116,139,0.8)';
  ctx.fillRect(-w / 2, -h / 2 + h * 0.08, w, 1);
  // Label with the Pokemon
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.36, 0, Math.PI * 2);
  ctx.fill();
  drawSprite(ctx, loadImage(artworkUrl(can.face)), 0, 0, w * 0.78, { color });
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-w * 0.28, -h / 2 + h * 0.1, w * 0.1, h * 0.8);
  ctx.restore();
  // Little wobble shadow under standing cans on the shelf
  if (can.state === 'stand' && can.y < 0.01) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, project(can.x, 0, can.z).y, w * 0.55, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawAim(ctx, target, time) {
  const end = project(target.x, target.y, 0);
  ctx.save();
  ctx.fillStyle = '#fff';
  for (let i = 1; i < 12; i++) {
    const k = i / 12;
    const x = LAUNCH.x + (end.x - LAUNCH.x) * k;
    const y = LAUNCH.y + (end.y - LAUNCH.y) * k - Math.sin(Math.PI * k) * 40;
    ctx.globalAlpha = 0.3 + 0.55 * Math.abs(Math.sin(time * 6 - i * 0.5));
    ctx.beginPath();
    ctx.arc(x, y, 4 - k * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 4]);
  ctx.lineDashOffset = -time * 20;
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(end.x, end.y, BALL_R * PX * (1 + Math.sin(time * 8) * 0.08), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function ballScreen(b) {
  if (!b.arrived) {
    const k = Math.min(1, b.t / b.dur);
    const end = project(b.x, b.y, 0);
    const r = 30 + (BALL_R * PX - 30) * k;
    return { x: LAUNCH.x + (end.x - LAUNCH.x) * k, y: LAUNCH.y + (end.y - LAUNCH.y) * k - Math.sin(Math.PI * k) * 40, r, z: -3 * (1 - k) };
  }
  const p = project(b.x, b.y, b.z);
  return { x: p.x, y: p.y, r: BALL_R * PX * p.s, z: b.z };
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
    const pop = age < 0.12 ? 0.4 + (age / 0.12) * 0.9 : Math.max(1, 1.3 - (age - 0.12) * 1.6);
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.life / 0.3);
    ctx.translate(t.x, t.y - age * 40);
    ctx.scale(pop, pop);
    ctx.font = `900 ${t.size || 22}px system-ui, sans-serif`;
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
 * "Ném bóng đổ tháp lon": swipe up to throw a Pokeball at a tower of Pokemon cans.
 * 3 towers, 3 balls each; knock them all down with fewer balls for a bonus.
 */
export function CansGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createCans({ random }));
  const game = useRef(first);
  const [ui, setUi] = useState(() => snap(first));
  const [banner, setBanner] = useState(null);
  const fx = useRef({ particles: [], dust: [], texts: [], time: 0, drag: null, key: null, throwT: 0, shake: 0, flash: 0 });
  const later = useLater();
  const bannerId = useRef(0);
  const say = (text, tone = 'gold', ms = 1500) => {
    const id = ++bannerId.current;
    setBanner({ id, text, tone });
    later(() => setBanner((b) => (b?.id === id ? null : b)), ms);
  };

  const throwAt = (target) => {
    const s = game.current;
    if (phase !== 'play' || !target) return;
    if (!throwBall(s, target)) return;
    fx.current.throwT = 0.45;
    sounds.playWhoosh();
    setUi(snap(s));
  };

  const pointer = useRef(null);
  const toCanvas = (e) => canvasPoint(canvasRef.current, e, W, H);
  const onDown = (e) => {
    if (phase !== 'play' || game.current.status !== 'aim') return;
    const p = toCanvas(e);
    pointer.current = { start: p };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!pointer.current) return;
    const p = toCanvas(e);
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

  useEffect(() => {
    if (phase !== 'play') return undefined;
    const onKey = (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) return;
      e.preventDefault();
      const v = fx.current;
      if (!v.key) v.key = { x: 0, y: 0.6 };
      if (e.key === 'ArrowLeft') v.key.x = Math.max(-SHELF_HALF, v.key.x - 0.25);
      if (e.key === 'ArrowRight') v.key.x = Math.min(SHELF_HALF, v.key.x + 0.25);
      if (e.key === 'ArrowUp') v.key.y = Math.min(MAX_Y, v.key.y + 0.3);
      if (e.key === 'ArrowDown') v.key.y = Math.max(0, v.key.y - 0.3);
      if (e.key === ' ' && game.current.status === 'aim') throwAt({ ...v.key });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const puff = (x, y, n = 6, big = 1) => {
    const list = fx.current.dust;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (Math.PI * i) / (n - 1 || 1);
      list.push({ x, y, vx: Math.cos(a) * 40 * big * (0.5 + Math.random()), vy: Math.sin(a) * 20 * big - 10, r: 5 * big, life: 0.7, max: 0.7 });
    }
  };

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    v.throwT = Math.max(0, v.throwT - dt);
    v.shake = Math.max(0, v.shake - dt);
    v.flash = Math.max(0, v.flash - dt * 2);
    if (phase === 'play') {
      // A touch of slow motion right after the ball hits
      const slow = s.status === 'settle' && s.settle < 0.25 && s.ball?.hit ? 0.45 : 1;
      stepCans(s, dt * slow);
      for (const e of s.events.splice(0)) {
        if (e.type === 'hit') {
          const p = project(e.x, e.y, 0);
          burst(v.particles, p.x, p.y, { count: 20 + e.cans * 4, speed: 220, colors: ['#fde047', '#ffffff', '#fb923c', '#f87171'], size: 3.5 });
          v.shake = 0.25 + Math.min(0.3, e.cans * 0.06);
          sounds.playPop();
          v.texts.push({ x: p.x, y: p.y - 26, text: e.cans >= 3 ? 'BỐP!' : 'CỐP!', color: '#fef08a', life: 0.7, max: 0.7, size: 26 });
        }
        if (e.type === 'knock') {
          const p = project(e.x, e.y, 0);
          puff(p.x, p.y, 5, 0.8);
          sounds.playNote(620 + Math.random() * 380, { duration: 0.07, volume: 0.18 });
        }
        if (e.type === 'clatter') {
          const p = project(e.x, 0, 0);
          puff(p.x, p.y, 7, 1);
          sounds.playNote(300 + Math.random() * 200, { duration: 0.06, volume: 0.15 });
        }
        if (e.type === 'whiff') v.texts.push({ x: W / 2, y: 150, text: 'Trượt rồi! 💨', color: '#bae6fd', life: 1, max: 1, size: 22 });
        if (e.type === 'settled' && e.newly > 0 && e.standing > 0) {
          v.texts.push({ x: W / 2, y: 140, text: `+${e.newly * 10}`, color: '#ffffff', life: 1, max: 1, size: 30 });
          sounds.playCoin();
        }
        if (e.type === 'clear') {
          say('RẦM! 💥', 'gold');
          v.flash = 1;
          v.shake = 0.5;
          burst(v.particles, W / 2, 250, { count: 50, speed: 300, colors: ['#fde047', '#f472b6', '#38bdf8', '#4ade80', '#ffffff'], size: 4.5, life: 1.1 });
          v.texts.push({ x: W / 2, y: 320, text: `Dọn sạch tháp! +${e.bonus} thưởng`, color: '#fde047', life: 1.6, max: 1.6, size: 20 });
          sounds.playEnergySurge();
          later(() => sounds.playCoin(), 250);
        }
        if (e.type === 'out') {
          say(`Còn ${e.standing} lon 😅`, 'blue', 1400);
          sounds.playOops();
        }
        if ((e.type === 'clear' || e.type === 'out') && s.status === 'levelEnd') {
          later(() => {
            const g = game.current;
            if (g !== s || !nextLevel(g)) return;
            say(`Tháp ${g.level + 1}: ${LEVELS[g.level].name}`, 'purple', 1400);
            sounds.playScanBeep?.();
            setUi(snap(g));
          }, 1900);
        }
        if (e.type === 'end') later(() => setPhase('done'), 1700);
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
    if (v.shake > 0) ctx.translate((Math.random() - 0.5) * v.shake * 16, (Math.random() - 0.5) * v.shake * 16);
    drawBooth(ctx, v.time);
    const visible = s.cans.filter((c) => c.state !== 'gone');
    const b = s.ball && !s.ball.gone ? ballScreen(s.ball) : null;
    // Things behind the shelf, then the shelf, then the rest (far to near)
    const behind = visible.filter((c) => c.z > SHELF_DEPTH).sort((p, q) => q.z - p.z);
    behind.forEach((c) => drawCan(ctx, c));
    if (b && b.z > SHELF_DEPTH) drawPokeball(ctx, b.x, b.y, b.r, s.ball.spin);
    drawShelf(ctx);
    const items = visible.filter((c) => c.z <= SHELF_DEPTH).map((c) => ({ z: c.z, draw: () => drawCan(ctx, c) }));
    if (b && b.z <= SHELF_DEPTH) items.push({ z: b.z - 0.01, draw: () => drawPokeball(ctx, b.x, b.y, b.r, s.ball.spin) });
    items.sort((p, q) => q.z - p.z).forEach((it) => it.draw());
    // Dust puffs
    for (let i = v.dust.length - 1; i >= 0; i--) {
      const d = v.dust[i];
      d.life -= dt;
      if (d.life <= 0) {
        v.dust.splice(i, 1);
        continue;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.94;
      const k = d.life / d.max;
      ctx.fillStyle = `rgba(254,243,199,${k * 0.55})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * (1.8 - k), 0, Math.PI * 2);
      ctx.fill();
    }
    const target = v.drag || (v.key && phase === 'play' ? v.key : null);
    if (target && s.status === 'aim') drawAim(ctx, target, v.time);
    // The ball in hand and the child's Pokemon
    if (s.status === 'aim' && phase === 'play' && s.balls > 0) drawPokeball(ctx, LAUNCH.x, LAUNCH.y - 8 + Math.sin(v.time * 4) * 3, 22, Math.sin(v.time * 2) * 0.3);
    const lean = v.throwT > 0 ? Math.sin((v.throwT / 0.45) * Math.PI) : 0;
    drawSprite(ctx, loadImage(player.image), 64, 500 - lean * 14 + Math.sin(v.time * 3) * 2, 90, { rotate: lean * 0.25 });
    updateParticles(ctx, v.particles, dt);
    drawTexts(ctx, v.texts, dt);
    ctx.restore();
    if (v.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${v.flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
  }, phase !== 'done');

  const replay = () => {
    game.current = createCans({ random });
    Object.assign(fx.current, { particles: [], dust: [], texts: [], key: null });
    setUi(snap(game.current));
    setBanner(null);
    setPhase('ready');
  };

  const bannerTone = banner?.tone === 'blue' ? 'text-sky-200' : banner?.tone === 'purple' ? 'text-fuchsia-200' : 'text-yellow-300';
  return (
    <CarnivalShell
      title="🥫 Ném bóng đổ tháp lon"
      label="Ném bóng đổ tháp lon"
      onClose={onClose}
      background="bg-gradient-to-b from-indigo-900 via-purple-900 to-indigo-950"
      dataAttrs={{ 'data-phase': phase, 'data-score': ui.score, 'data-level': ui.level + 1, 'data-balls': ui.balls, 'data-status': ui.status }}
      hud={
        <>
          <HudBar items={[{ icon: '⭐', label: 'Điểm', value: ui.score, testId: 'cans-score' }, { icon: '🏰', label: 'Tháp', value: `${ui.level + 1}/${LEVELS.length}` }, { icon: '🥫', label: 'Lon', value: `${ui.total - ui.standing}/${ui.total}` }]} />
          <div className="mt-1 flex items-center justify-center gap-1.5" data-testid="cans-balls" aria-label={`Còn ${ui.balls} bóng`}>
            {Array.from({ length: BALLS }, (_, i) => (
              <svg key={i} viewBox="0 0 20 20" className={`w-5 h-5 transition-all duration-300 ${i < ui.balls ? '' : 'opacity-25 scale-75 grayscale'}`} aria-hidden="true">
                <circle cx="10" cy="10" r="8.5" fill="#fff" stroke="#1e293b" strokeWidth="1.5" />
                <path d="M1.5 10a8.5 8.5 0 0 1 17 0z" fill="#ef4444" stroke="#1e293b" strokeWidth="1.5" />
                <circle cx="10" cy="10" r="2.6" fill="#fff" stroke="#1e293b" strokeWidth="1.5" />
              </svg>
            ))}
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
        data-testid="cans-stage"
      >
        <canvas ref={canvasRef} data-testid="cans-canvas" className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, width: '100%', height: 'auto' }} />
        {phase === 'play' && ui.status === 'aim' && ui.level === 0 && ui.balls === BALLS && (
          <p className="hint-pulse absolute bottom-3 left-1/2 -translate-x-1/2 w-[88%] px-3 py-1.5 rounded-2xl bg-black/60 text-center text-white text-sm font-black pointer-events-none" data-testid="cans-hint">
            Vuốt lên để ném bóng! Ném vào lon dưới cùng nhé 👆
          </p>
        )}
        {banner && phase === 'play' && (
          <p key={banner.id} className={`banner-slam absolute top-[22%] left-1/2 -translate-x-1/2 whitespace-nowrap text-4xl font-black drop-shadow-[0_3px_3px_rgba(0,0,0,0.85)] pointer-events-none ${bannerTone}`} data-testid="cans-banner">
            {banner.text}
          </p>
        )}
        {phase === 'ready' && (
          <Countdown
            onDone={() => {
              setPhase('play');
              say(`Tháp 1: ${LEVELS[0].name}`, 'purple', 1300);
            }}
          />
        )}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Vua đổ tháp! 🏆' : ui.stars === 2 ? 'Ném mạnh ghê! 💥' : 'Cố lên nhé! 🥫'}
            stars={ui.stars}
            detail={`${ui.score} điểm · đổ ${ui.knocked} lon · dọn sạch ${ui.clears}/${LEVELS.length} tháp${ui.perfect ? ` · ${ui.perfect} lần chỉ 1 bóng` : ''}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
