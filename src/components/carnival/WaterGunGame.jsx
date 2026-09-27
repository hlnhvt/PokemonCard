import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  RACES,
  HIT_W,
  createWaterGun,
  stepWaterGun,
  setAim,
  setSpray,
  placeOf,
  placePoints,
  waterStars,
  wins,
} from '../../utils/carnival/watergun';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const W = 360;
const H = 560;
const TAU = Math.PI * 2;
// The child's big station
const RAIL_Y = 312;
const RAIL_X = 180;
const RAIL_HALF = 128;
const TARGET_R = 34;
const NOZZLE = { x: 196, y: 468 };
const PLAYER_AT = { x: 74, y: 482 };
// The race board: 4 little booths, the child in the second one
const BOOTH_W = 90;
const CHILD_BOOTH = 1;
const BOOTH_COLORS = ['#f43f5e', '#0ea5e9', '#22c55e', '#f59e0b'];
const CONFETTI = ['#fde047', '#f472b6', '#38bdf8', '#4ade80', '#ffffff', '#fb923c'];
const MEDAL = ['🥇', '🥈', '🥉', '🎀'];
const SQUIRTLE = 7;

const railX = (x) => RAIL_X + x * RAIL_HALF;
/** Station index (0 = child) to its booth on the race board. */
const boothOf = (who) => (who === 0 ? CHILD_BOOTH : who <= CHILD_BOOTH ? who - 1 : who);
const boothX = (b) => b * BOOTH_W + BOOTH_W / 2;
const balloonR = (fill) => 9 + fill * 27;
const NOZZLE_Y = 132;

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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- the booth, painted once ----------
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
  sky.addColorStop(0, '#0c4a6e');
  sky.addColorStop(1, '#082f49');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Race board booths
  for (let b = 0; b < 4; b++) {
    const x = b * BOOTH_W;
    const g = ctx.createLinearGradient(0, 0, 0, 196);
    g.addColorStop(0, '#1e293b');
    g.addColorStop(1, '#334155');
    ctx.fillStyle = g;
    ctx.fillRect(x + 3, 4, BOOTH_W - 6, 192);
    ctx.fillStyle = BOOTH_COLORS[b];
    ctx.fillRect(x + 3, 4, BOOTH_W - 6, 6);
    // Nozzle the balloon is tied to
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x + BOOTH_W / 2 - 5, NOZZLE_Y, 10, 12);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + BOOTH_W / 2 - 8, NOZZLE_Y + 10, 16, 6);
  }
  // Big station back wall: stripes
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#0284c7' : '#e0f2fe';
    ctx.fillRect(i * 30, 204, 30, 196);
  }
  const shade = ctx.createLinearGradient(0, 204, 0, 400);
  shade.addColorStop(0, 'rgba(8,47,73,0.55)');
  shade.addColorStop(0.3, 'rgba(8,47,73,0.1)');
  shade.addColorStop(1, 'rgba(8,47,73,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 204, W, 196);
  // Scallops under the race board
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#facc15' : '#ef4444';
    ctx.beginPath();
    ctx.arc(i * 30 + 15, 204, 15, 0, Math.PI);
    ctx.fill();
  }
  // Rail
  ctx.fillStyle = '#475569';
  roundRect(ctx, RAIL_X - RAIL_HALF - 24, RAIL_Y - 5, RAIL_HALF * 2 + 48, 10, 5);
  ctx.fill();
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(RAIL_X - RAIL_HALF - 20, RAIL_Y - 4, RAIL_HALF * 2 + 40, 2);
  // Counter
  const top = ctx.createLinearGradient(0, 400, 0, 418);
  top.addColorStop(0, '#fcd34d');
  top.addColorStop(1, '#b45309');
  ctx.fillStyle = top;
  ctx.fillRect(0, 400, W, 18);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#bae6fd' : '#0369a1';
    ctx.fillRect(i * 30, 418, 30, 30);
  }
  const floor = ctx.createLinearGradient(0, 448, 0, H);
  floor.addColorStop(0, '#0c4a6e');
  floor.addColorStop(1, '#172554');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 448, W, H - 448);
  sceneCache = c;
  return c;
}

function drawBalloon(ctx, x, fill, color, t, wob, win) {
  const r = balloonR(fill);
  const y = NOZZLE_Y - r * 1.05 + 2;
  // Stretched shiny rubber: gets lighter as it grows
  const squash = 1 + Math.sin(t * 9) * 0.02 * fill + wob;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / squash, squash);
  if (fill > 0.85) {
    // About to pop: it shivers
    ctx.translate(Math.sin(t * 60) * (fill - 0.85) * 10, 0);
  }
  if (win) {
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 20;
  }
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r * 1.2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25 - fill * 0.1, color);
  g.addColorStop(1, 'rgba(15,23,42,0.9)');
  ctx.fillStyle = g;
  ctx.globalAlpha = 0.85 + fill * 0.15;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.92, r, 0, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.16, r * 0.28, -0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
  // Neck to the nozzle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 4, NOZZLE_Y + 2);
  ctx.lineTo(x + 4, NOZZLE_Y + 2);
  ctx.lineTo(x + 2, y + r * 0.9);
  ctx.lineTo(x - 2, y + r * 0.9);
  ctx.closePath();
  ctx.fill();
}

function drawBooths(ctx, s, v, t, playerImg) {
  const who = [0, 1, 2, 3];
  for (const w of who) {
    const b = boothOf(w);
    const x = boothX(b);
    const fill = s.fill[w];
    const popped = s.phase === 'finish' && s.winner === w;
    const img = w === 0 ? playerImg : loadImage(artworkUrl(s.rivals[w - 1].dex));
    const hitting = s.phase === 'race' && (w === 0 ? s.hitting : s.rivals[w - 1].hitting);
    if (w === 0) {
      // The child's booth glows
      ctx.strokeStyle = `rgba(253,224,71,${0.6 + Math.sin(t * 4) * 0.3})`;
      ctx.lineWidth = 3;
      roundRect(ctx, b * BOOTH_W + 4.5, 5.5, BOOTH_W - 9, 189, 8);
      ctx.stroke();
    }
    if (!popped) drawBalloon(ctx, x, fill, BOOTH_COLORS[b], t, v.wob[w] || 0, false);
    // Pokemon at the bottom of the booth, bouncing while it hits
    const bob = hitting ? Math.abs(Math.sin(t * 14 + w)) * 3 : 0;
    const cheer = s.phase === 'finish' && s.winner === w ? Math.abs(Math.sin(t * 10)) * 10 : 0;
    drawSprite(ctx, img, x, 160 - bob - cheer, 46, { color: BOOTH_COLORS[b] });
    // A little spray when hitting
    if (hitting) {
      for (let i = 0; i < 4; i++) {
        const k = (t * 3 + i / 4) % 1;
        ctx.fillStyle = `rgba(186,230,253,${1 - k})`;
        ctx.beginPath();
        ctx.arc(x + 16 + k * 10, 150 - k * 12 + Math.sin(i * 3) * 3, 2.2, 0, TAU);
        ctx.fill();
      }
    }
    // Fill bar and the name
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, x - 34, 182, 68, 7, 3.5);
    ctx.fill();
    ctx.fillStyle = BOOTH_COLORS[b];
    roundRect(ctx, x - 34, 182, Math.max(7, 68 * fill), 7, 3.5);
    ctx.fill();
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = w === 0 ? '#fde047' : '#e2e8f0';
    ctx.fillText(w === 0 ? 'BÉ' : s.rivals[w - 1].name, x, 24);
    // Bulbs that chase while this booth hits its target
    for (let i = 0; i < 5; i++) {
      const on = hitting ? (Math.floor(t * 12) + i) % 2 === 0 : i === Math.floor(fill * 5);
      ctx.fillStyle = on ? BOOTH_COLORS[b] : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(x - 28 + i * 14, 38, 3, 0, TAU);
      ctx.fill();
    }
  }
}

function drawTarget(ctx, x, y, rot, glow) {
  ctx.save();
  ctx.translate(x, y);
  // Post
  ctx.fillStyle = '#334155';
  ctx.fillRect(-4, 0, 8, 16);
  if (glow > 0) {
    ctx.shadowColor = '#7dd3fc';
    ctx.shadowBlur = 20 * glow;
  }
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(0, 0, TARGET_R + 3, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.rotate(rot);
  // Spinning red / white segments
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#f8fafc' : '#ef4444';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, TARGET_R, (i * TAU) / 8, ((i + 1) * TAU) / 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, TARGET_R * 0.62, 0, TAU);
  ctx.stroke();
  // Pokeball middle
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(0, 0, TARGET_R * 0.42, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, 0, TARGET_R * 0.42, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-TARGET_R * 0.42, -2, TARGET_R * 0.84, 4);
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawGun(ctx, aimX, t, spraying, squirtle) {
  // A Squirtle-shaped water gun that turns to the aim
  const tx = railX(aimX);
  const ang = Math.atan2(RAIL_Y - NOZZLE.y, tx - NOZZLE.x);
  ctx.save();
  ctx.translate(NOZZLE.x, NOZZLE.y + 26);
  ctx.rotate(ang + Math.PI / 2);
  const kick = spraying ? Math.sin(t * 50) * 1.2 : 0;
  ctx.translate(0, kick);
  // Handle
  ctx.fillStyle = '#0369a1';
  roundRect(ctx, -7, 4, 14, 26, 5);
  ctx.fill();
  // Tank shaped like a shell
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.ellipse(0, 0, 19, 16, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.ellipse(0, 1, 13, 11, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-13, 1);
  ctx.lineTo(13, 1);
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 12);
  ctx.stroke();
  // Barrel and head
  ctx.fillStyle = '#38bdf8';
  roundRect(ctx, -6, -40, 12, 30, 5);
  ctx.fill();
  ctx.fillStyle = '#7dd3fc';
  ctx.beginPath();
  ctx.arc(0, -40, 10, 0, TAU);
  ctx.fill();
  ctx.restore();
  // Squirtle's face on the gun, upright so it reads well
  drawSprite(ctx, squirtle, NOZZLE.x + 22, NOZZLE.y + 30, 40, { color: '#38bdf8' });
  return { x: NOZZLE.x + Math.cos(ang) * 40, y: NOZZLE.y + 26 + Math.sin(ang) * 40 + 0 };
}

function drawStream(ctx, from, to, t, hitting) {
  const mx = (from.x + to.x) / 2;
  const my = Math.min(from.y, to.y) - 40;
  ctx.save();
  ctx.lineCap = 'round';
  const wig = Math.sin(t * 30) * 2;
  ctx.strokeStyle = 'rgba(56,189,248,0.55)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(mx + wig, my, to.x, to.y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(224,242,254,0.95)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(mx - wig, my, to.x, to.y);
  ctx.stroke();
  // Blobs running along the stream
  for (let i = 0; i < 7; i++) {
    const k = (t * 3.2 + i / 7) % 1;
    const x = (1 - k) ** 2 * from.x + 2 * (1 - k) * k * mx + k * k * to.x;
    const y = (1 - k) ** 2 * from.y + 2 * (1 - k) * k * my + k * k * to.y;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 2.5 + Math.sin(i) * 1, 0, TAU);
    ctx.fill();
  }
  if (hitting) {
    ctx.fillStyle = 'rgba(224,242,254,0.5)';
    ctx.beginPath();
    ctx.arc(to.x, to.y, 10 + Math.sin(t * 25) * 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drops(list, x, y, n, spread = 1) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6 * spread;
    const v = 60 + Math.random() * 150;
    list.push({ kind: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 1.5 + Math.random() * 2.5, color: Math.random() < 0.5 ? '#e0f2fe' : '#38bdf8', life: 0.6, max: 0.6, g: 600 });
  }
}

function popBurst(list, x, y, color) {
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const v = 140 + Math.random() * 160;
    list.push({ kind: 'shred', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 20, w: 7, h: 4, color, life: 1, max: 1, g: 500 });
  }
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * TAU;
    const v = 80 + Math.random() * 260;
    list.push({ kind: 'confetti', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 160, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, w: 6, h: 3.5, color: CONFETTI[i % CONFETTI.length], life: 1.6, max: 1.6, g: 280 });
  }
  list.push({ kind: 'ring', x, y, r: 30, life: 0.4, max: 0.4, color: '#ffffff' });
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
      p.vx *= 1 - dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
    }
    if (!ctx) continue;
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 6 * a + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + (1 - a) * 50, 0, TAU);
      ctx.stroke();
    } else if (p.kind === 'drop') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.rot * 1.7));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  }
  if (ctx) ctx.globalAlpha = 1;
}

const snap = (s) => ({
  phase: s.phase,
  race: s.race,
  place: placeOf(s),
  places: s.places.slice(),
  fill: Math.round(s.fill[0] * 100),
  hitting: s.hitting,
  spraying: s.spraying,
  winner: s.winner,
  stars: waterStars(s),
  points: placePoints(s),
  wins: wins(s),
});

const freshFx = () => ({ time: 0, particles: [], wob: [0, 0, 0, 0], squeak: 0, flash: 0, shake: 0, key: 0, keyHeld: false, rot: 0 });

/**
 * "Súng nước Squirtle": hold to spray water at the sliding Pokeball target, drag to aim. While the
 * water hits, the child's balloon grows; first balloon to pop wins. 3 races, faster each time.
 */
export function WaterGunGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const size = useFit(stageRef);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createWaterGun({ random, playerName: player?.name }));
  const game = useRef(first);
  const [ui, setUi] = useState(() => snap(first));
  const [card, setCard] = useState(null);
  const fx = useRef(freshFx());
  const later = useLater();
  const cardId = useRef(0);

  // Hold to spray, drag to aim (anywhere on the stage)
  const holding = useRef(false);
  const aimAt = (e) => {
    const p = canvasPoint(canvasRef.current, e, W, H);
    setAim(game.current, (p.x - RAIL_X) / RAIL_HALF);
  };
  const onDown = (e) => {
    if (phase !== 'play' || !canvasRef.current) return;
    holding.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    aimAt(e);
    setSpray(game.current, true);
  };
  const onMove = (e) => {
    if (!holding.current || !canvasRef.current) return;
    aimAt(e);
  };
  const onUp = () => {
    holding.current = false;
    setSpray(game.current, false);
  };

  // Keyboard: arrows aim, hold Space to spray
  useEffect(() => {
    if (phase !== 'play') return undefined;
    const down = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        fx.current.key = e.key === 'ArrowLeft' ? -1 : 1;
      }
      if (e.key === ' ') {
        e.preventDefault();
        fx.current.keyHeld = true;
        setSpray(game.current, true);
      }
    };
    const up = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') fx.current.key = 0;
      if (e.key === ' ') {
        fx.current.keyHeld = false;
        setSpray(game.current, holding.current);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [phase]);

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    const t = v.time;
    v.flash = Math.max(0, v.flash - dt * 2);
    v.shake = Math.max(0, v.shake - dt);
    v.wob = v.wob.map((w) => w * Math.max(0, 1 - dt * 6));
    // The target spins, faster while the water hits it
    v.rot += (s.target.spin + 0.4) * dt;
    if (phase === 'play') {
      if (v.key) setAim(s, s.aim + v.key * dt * 1.6);
      stepWaterGun(s, dt);
      for (const e of s.events.splice(0)) {
        if (e.type === 'intro') {
          const id = ++cardId.current;
          setCard({ id, kind: 'intro', race: e.race });
          sounds.playScanBeep();
        } else if (e.type === 'go') {
          const id = ++cardId.current;
          setCard({ id, kind: 'go' });
          later(() => setCard((c) => (c?.id === id ? null : c)), 700);
          sounds.playWhoosh();
        } else if (e.type === 'spray') sounds.playWhoosh();
        else if (e.type === 'hit') sounds.playNote(1046, { duration: 0.05, volume: 0.12 });
        else if (e.type === 'grow') {
          v.wob[0] = 0.12;
          sounds.playNote(440 + e.level * 160, { duration: 0.12, volume: 0.16 });
        } else if (e.type === 'pop') {
          const b = boothOf(e.who);
          popBurst(v.particles, boothX(b), NOZZLE_Y - balloonR(1), BOOTH_COLORS[b]);
          sounds.playPop();
          v.shake = 0.35;
          v.flash = 0.7;
        } else if (e.type === 'finish') {
          const id = ++cardId.current;
          const name = e.winner === 0 ? player.name : s.rivals[e.winner - 1].name;
          const dex = e.winner === 0 ? null : s.rivals[e.winner - 1].dex;
          setCard({ id, kind: 'finish', place: e.place, name, dex, race: e.race });
          if (e.place === 1) {
            sounds.playSuccessFanfare();
            sounds.playCoin();
          } else if (e.place === 2) sounds.playCoin();
          else sounds.playOops();
          setSpray(s, false);
          holding.current = false;
        } else if (e.type === 'end') {
          setCard(null);
          later(() => setPhase('done'), 300);
        }
      }
      // Balloon squeaks while it grows, and wobbles
      if (s.hitting) {
        v.squeak -= dt;
        v.wob[0] = Math.max(v.wob[0], 0.02);
        if (v.squeak <= 0) {
          v.squeak = 0.22;
          sounds.playNote(300 + s.fill[0] * 700, { duration: 0.06, volume: 0.05 });
        }
      }
      setUi(snap(s));
    }

    const ctx = getCtx();
    const tx = railX(s.target.x);
    const impact = { x: railX(s.impact), y: RAIL_Y - (s.hitting ? 0 : 6) };
    if (s.hitting && Math.random() < dt * 30) drops(v.particles, impact.x, impact.y, 2);
    if (!ctx) {
      drawParticles(null, v.particles, dt);
      return;
    }
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (v.shake > 0) ctx.translate((Math.random() - 0.5) * v.shake * 16, (Math.random() - 0.5) * v.shake * 16);
    const bg = scene();
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else {
      ctx.fillStyle = '#0c4a6e';
      ctx.fillRect(0, 0, W, H);
    }
    const playerImg = loadImage(player.image);
    drawBooths(ctx, s, v, t, playerImg);
    // Lights along the rail
    for (let i = 0; i < 9; i++) {
      const on = s.hitting ? (Math.floor(t * 12) + i) % 2 === 0 : (Math.floor(t * 3) + i) % 3 === 0;
      ctx.fillStyle = on ? '#fde047' : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(RAIL_X - RAIL_HALF + i * (RAIL_HALF / 4), RAIL_Y + 30, 3.5, 0, TAU);
      ctx.fill();
    }
    // Hit zone hint under the target
    ctx.fillStyle = s.hitting ? 'rgba(125,211,252,0.35)' : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(tx, RAIL_Y + 50, HIT_W * RAIL_HALF, 7, 0, 0, TAU);
    ctx.fill();
    drawTarget(ctx, tx, RAIL_Y - 12, v.rot, s.hitting ? 1 : 0);
    // The child and the gun
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(PLAYER_AT.x, PLAYER_AT.y + 46, 38, 8, 0, 0, TAU);
    ctx.fill();
    const cheer = s.phase === 'finish' && s.winner === 0 ? Math.abs(Math.sin(t * 10)) * 14 : 0;
    drawSprite(ctx, playerImg, PLAYER_AT.x, PLAYER_AT.y - cheer + Math.sin(t * 2.4) * 2, 96, { rotate: s.spraying ? Math.sin(t * 20) * 0.03 : 0 });
    const tip = drawGun(ctx, s.aim, t, s.spraying && s.phase === 'race', loadImage(artworkUrl(SQUIRTLE)));
    if (s.spraying && s.phase === 'race') drawStream(ctx, tip, impact, t, s.hitting);
    else if (phase === 'play' && s.phase === 'race') {
      // Where the water would go
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(railX(s.aim), RAIL_Y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawParticles(ctx, v.particles, dt);
    ctx.restore();
    if (v.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${v.flash * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }
  }, phase !== 'done');

  const replay = () => {
    game.current = createWaterGun({ random, playerName: player?.name });
    fx.current = freshFx();
    holding.current = false;
    setUi(snap(game.current));
    setCard(null);
    setPhase('ready');
  };

  const medals = ui.places.map((p) => MEDAL[p - 1]).join(' ');

  return (
    <CarnivalShell
      title="💦 Súng nước Squirtle"
      label="Súng nước Squirtle"
      onClose={onClose}
      background="bg-gradient-to-b from-sky-600 via-cyan-800 to-blue-950"
      dataAttrs={{ 'data-phase': phase, 'data-race': ui.race + 1, 'data-status': ui.phase, 'data-fill': ui.fill, 'data-hitting': ui.hitting ? 'yes' : 'no', 'data-places': ui.places.join(','), 'data-score': ui.points }}
      hud={
        <>
          <HudBar
            items={[
              { icon: '🏁', label: 'Vòng', value: `${Math.min(RACES, ui.race + 1)}/${RACES}`, testId: 'watergun-race' },
              { icon: '🎈', label: 'Bóng', value: `${ui.fill}%` },
              { icon: '🏅', label: 'Hạng', value: ui.phase === 'race' ? ui.place : '–' },
            ]}
          />
          <div className="mt-1 flex items-center justify-center gap-1.5 h-6" data-testid="watergun-medals" aria-label="Huy chương">
            {Array.from({ length: RACES }, (_, i) => (
              <span key={i} className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-base ${ui.places[i] ? 'watergun-medal bg-white/20' : 'bg-black/25'}`}>
                {ui.places[i] ? MEDAL[ui.places[i] - 1] : ''}
              </span>
            ))}
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
        onPointerCancel={onUp}
        onPointerLeave={(e) => e.buttons === 0 && onUp()}
        data-testid="watergun-stage"
      >
        <canvas ref={canvasRef} data-testid="watergun-canvas" className="block max-w-full max-h-full" style={size ? { width: size.w, height: size.h } : { width: '100%', aspectRatio: `${W} / ${H}` }} />
        {phase === 'play' && ui.phase === 'race' && ui.race === 0 && !ui.spraying && ui.fill < 5 && (
          <p className="hint-pulse absolute bottom-3 inset-x-4 mx-auto max-w-xs px-3 py-1.5 rounded-2xl bg-black/60 text-center text-white text-sm font-black pointer-events-none" data-testid="watergun-hint">
            Giữ ngón tay để phun nước, kéo trái phải cho trúng bia! 💦
          </p>
        )}
        {phase === 'play' && ui.phase === 'race' && ui.hitting && (
          <div className="absolute top-[40%] inset-x-0 flex justify-center pointer-events-none">
            <span className="watergun-hit px-3 py-0.5 rounded-full bg-sky-400/90 text-white text-sm font-black shadow">Trúng rồi! 🎯</span>
          </div>
        )}
        {card && phase === 'play' && card.kind === 'intro' && (
          <div key={card.id} className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/25 pointer-events-none" data-testid="watergun-intro">
            <p className="chain-pop text-5xl font-black text-white sport-banner">Vòng {card.race + 1}</p>
            <p className="text-lg font-black text-sky-100 drop-shadow">{card.race === 0 ? 'Sẵn sàng…' : 'Bia chạy nhanh hơn nhé! ⚡'}</p>
          </div>
        )}
        {card && phase === 'play' && card.kind === 'go' && (
          <div key={card.id} className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="chain-pop text-6xl font-black text-yellow-300 sport-banner">BẮN!</p>
          </div>
        )}
        {card && phase === 'play' && card.kind === 'finish' && (
          <div key={card.id} className="absolute inset-x-0 top-[26%] flex justify-center pointer-events-none" data-testid="watergun-finish">
            <div className={`watergun-card w-56 max-w-[80%] rounded-3xl border-4 px-3 py-3 text-center shadow-2xl ${card.place === 1 ? 'bg-gradient-to-b from-yellow-100 to-amber-300 border-yellow-400' : 'bg-gradient-to-b from-sky-50 to-sky-200 border-sky-400'}`}>
              <p className="text-4xl">{MEDAL[card.place - 1]}</p>
              <p className="text-2xl font-black text-slate-800">{card.place === 1 ? 'Bé thắng rồi!' : `Bé về thứ ${card.place}`}</p>
              {card.place !== 1 && (
                <p className="mt-1 flex items-center justify-center gap-1 text-sm font-bold text-slate-600">
                  <img src={artworkUrl(card.dex)} alt="" className="w-8 h-8 object-contain" /> {card.name} nổ bóng trước
                </p>
              )}
            </div>
          </div>
        )}
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Xạ thủ nước cừ khôi! 🏆' : ui.stars === 2 ? 'Bắn nước giỏi lắm! 💦' : 'Lần sau sẽ thắng! 💪'}
            stars={ui.stars}
            detail={`Thắng ${ui.wins}/${RACES} vòng · ${medals}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
