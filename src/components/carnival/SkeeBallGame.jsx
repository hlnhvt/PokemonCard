import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BALLS,
  RAMP_Z,
  BOARD_TOP,
  LATERAL,
  MAX_ANGLE,
  RING_CENTER,
  RINGS,
  HOLES,
  SPEED_MIN,
  SPEED_FULL,
  createSkee,
  stepSkee,
  rollBall,
  rollFromSwipe,
  reflect,
  skeeStars,
} from '../../utils/carnival/skeeball';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite, drawPokeball } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const W = 360;
const H = 560;
const TAU = Math.PI * 2;
// Lane: near edge and the ramp (perspective)
const LANE_NEAR_Y = 548;
const LANE_FAR_Y = 318;
const LANE_NEAR_HALF = 150;
const LANE_FAR_HALF = 104;
const FAR_SCALE = LANE_FAR_HALF / LANE_NEAR_HALF;
// Board (rings) above the ramp
const BOARD_BOTTOM_Y = 300;
const BOARD_TOP_Y = 152;
const BOARD_MIN = -0.22;
const BOARD_SPAN = BOARD_TOP + 0.08 - BOARD_MIN;
const BOARD_HALF_BOTTOM = 104;
const BOARD_HALF_TOP = 112;
const BALL_R = 17;
const BALL_REST = { x: 180, y: 512 };
const RING_COLORS = { 10: '#22c55e', 20: '#3b82f6', 30: '#a855f7', 50: '#f59e0b', 100: '#ef4444' };
const CONFETTI = ['#fde047', '#f472b6', '#38bdf8', '#4ade80', '#ffffff', '#fb923c'];
const MASCOTS = [25, 39];
const SWIPE_WINDOW = 0.16; // seconds of the swipe that set its speed

function lanePt(x, z) {
  const d = Math.max(0, Math.min(1, z / RAMP_Z));
  const sc = 1 / (1 + d * (1 / FAR_SCALE - 1));
  const k = (1 - sc) / (1 - FAR_SCALE);
  return { x: W / 2 + x * LANE_NEAR_HALF * sc * 0.86, y: LANE_NEAR_Y - (LANE_NEAR_Y - LANE_FAR_Y) * k, s: sc };
}
function boardPt(x, y, h = 0) {
  const v = (y - BOARD_MIN) / BOARD_SPAN;
  const half = BOARD_HALF_BOTTOM + (BOARD_HALF_TOP - BOARD_HALF_BOTTOM) * v;
  return { x: W / 2 + x * half * 0.9, y: BOARD_BOTTOM_Y - v * (BOARD_BOTTOM_Y - BOARD_TOP_Y) - h * 120, s: FAR_SCALE * 0.9, half, ky: (BOARD_BOTTOM_Y - BOARD_TOP_Y) / BOARD_SPAN };
}

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

// ---------- the machine, painted once ----------
let sceneCache = null;
function scene() {
  if (sceneCache || typeof document === 'undefined') return sceneCache;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(1, '#312e81');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Cabinet sides (towards us)
  const near = lanePt(0, 0);
  const far = lanePt(0, RAMP_Z);
  const nl = W / 2 - LANE_NEAR_HALF * 0.86;
  const fl = W / 2 - LANE_FAR_HALF * 0.86;
  for (const side of [-1, 1]) {
    const g = ctx.createLinearGradient(0, BOARD_TOP_Y, 0, H);
    g.addColorStop(0, '#7c2d12');
    g.addColorStop(1, '#431407');
    ctx.fillStyle = g;
    ctx.beginPath();
    const X = (x) => (side < 0 ? x : W - x);
    ctx.moveTo(X(0), H);
    ctx.lineTo(X(nl - 4), H);
    ctx.lineTo(X(fl - 6), far.y);
    ctx.lineTo(X(W / 2 - BOARD_HALF_TOP * 0.9 - 10), BOARD_TOP_Y - 14);
    ctx.lineTo(X(0), BOARD_TOP_Y - 30);
    ctx.closePath();
    ctx.fill();
  }
  // Lane: glossy planks
  const lane = ctx.createLinearGradient(0, far.y, 0, near.y);
  lane.addColorStop(0, '#b45309');
  lane.addColorStop(1, '#fbbf24');
  ctx.fillStyle = lane;
  ctx.beginPath();
  ctx.moveTo(nl, near.y + 12);
  ctx.lineTo(W - nl, near.y + 12);
  ctx.lineTo(W - fl, far.y);
  ctx.lineTo(fl, far.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,53,15,0.35)';
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    const a = lanePt(i / 3.4, 0);
    const b = lanePt(i / 3.4, RAMP_Z);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + 12);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  const gloss = ctx.createLinearGradient(fl, 0, W - fl, 0);
  gloss.addColorStop(0, 'rgba(255,255,255,0)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  gloss.addColorStop(0.55, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, far.y, W, near.y - far.y + 12);
  // Ramp hump
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.moveTo(fl - 2, far.y + 2);
  ctx.quadraticCurveTo(W / 2, far.y - 16, W - fl + 2, far.y + 2);
  ctx.lineTo(W - fl + 2, far.y + 8);
  ctx.quadraticCurveTo(W / 2, far.y - 6, fl - 2, far.y + 8);
  ctx.closePath();
  ctx.fill();
  // Board: a dark ramp with a gutter at the bottom
  const b0 = boardPt(0, BOARD_MIN);
  const b1 = boardPt(0, BOARD_TOP + 0.08);
  const board = ctx.createLinearGradient(0, b1.y, 0, b0.y);
  board.addColorStop(0, '#1e1b4b');
  board.addColorStop(1, '#312e81');
  ctx.fillStyle = board;
  ctx.beginPath();
  ctx.moveTo(W / 2 - b0.half * 0.9 - 8, b0.y + 6);
  ctx.lineTo(W / 2 + b0.half * 0.9 + 8, b0.y + 6);
  ctx.lineTo(W / 2 + b1.half * 0.9 + 8, b1.y - 8);
  ctx.lineTo(W / 2 - b1.half * 0.9 - 8, b1.y - 8);
  ctx.closePath();
  ctx.fill();
  // Gutter slot
  ctx.fillStyle = '#020617';
  roundRect(ctx, W / 2 - b0.half * 0.9, b0.y - 8, b0.half * 1.8, 10, 5);
  ctx.fill();
  // Back net
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 - 110 + i * 14.6, b1.y - 8);
    ctx.lineTo(W / 2 - 110 + i * 14.6 + 10, 120);
    ctx.stroke();
  }
  // Marquee
  const mq = ctx.createLinearGradient(0, 6, 0, 118);
  mq.addColorStop(0, '#be123c');
  mq.addColorStop(1, '#4c0519');
  ctx.fillStyle = mq;
  roundRect(ctx, 14, 6, W - 28, 112, 16);
  ctx.fill();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 3;
  roundRect(ctx, 14, 6, W - 28, 112, 16);
  ctx.stroke();
  ctx.fillStyle = '#020617';
  roundRect(ctx, 110, 62, 140, 44, 10);
  ctx.fill();
  sceneCache = c;
  return c;
}

function drawMarquee(ctx, t, v, s) {
  // Chasing bulbs round the sign
  const n = 26;
  const fast = v.lights > 0;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    let x;
    let y;
    if (k < 0.5) {
      x = 24 + (k / 0.5) * (W - 48);
      y = 14;
    } else {
      x = W - 24 - ((k - 0.5) / 0.5) * (W - 48);
      y = 110;
    }
    const on = fast ? (Math.floor(t * 18) + i) % 2 === 0 : (Math.floor(t * 5) + i) % 4 !== 0;
    const c = fast ? ['#fde047', '#f472b6', '#38bdf8'][i % 3] : '#fde68a';
    ctx.fillStyle = on ? c : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, TAU);
    ctx.fill();
  }
  // Title
  ctx.save();
  ctx.font = '900 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#f472b6';
  ctx.shadowBlur = 12 + Math.sin(t * 3) * 4;
  ctx.fillStyle = '#fff1f2';
  ctx.fillText('SKEE-BALL', W / 2, 40);
  ctx.restore();
  // Display: the last score, or the balls left
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pop = v.last && t - v.last.at < 1.6 ? v.last : null;
  if (pop) {
    const k = Math.min(1, (t - pop.at) / 0.25);
    ctx.font = `900 ${Math.round(22 + (1 - k) * 14)}px ui-monospace, monospace`;
    ctx.fillStyle = Math.floor(t * 10) % 2 ? '#fde047' : '#f97316';
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 14;
    ctx.fillText(pop.text, W / 2, 85);
  } else {
    ctx.font = '900 24px ui-monospace, monospace';
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 8;
    ctx.fillText(String(s.score).padStart(4, '0'), W / 2, 85);
  }
  ctx.restore();
  // Mascots either side of the display
  MASCOTS.forEach((dex, i) => {
    const x = i ? 300 : 60;
    const hop = v.lights > 0 ? Math.abs(Math.sin(t * 12 + i)) * 8 : Math.sin(t * 2 + i) * 2;
    drawSprite(ctx, loadImage(artworkUrl(dex)), x, 80 - hop, 52, { color: '#fbbf24' });
  });
}

function drawBoard(ctx, t, v) {
  const flash = (id) => (v.flashHole === id && v.lights > 0 ? v.lights : 0);
  // Rings, big to small
  const c = boardPt(RING_CENTER.x, RING_CENTER.y);
  for (let i = RINGS.length - 1; i >= 0; i--) {
    const ring = RINGS[i];
    const rx = ring.r * c.half * 0.9;
    const ry = ring.r * c.ky;
    const f = flash(`r${ring.points}`);
    const col = RING_COLORS[ring.points];
    ctx.fillStyle = f > 0 && Math.floor(t * 14) % 2 ? '#fef9c3' : i % 2 ? '#1e1b4b' : '#27235f';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.shadowColor = col;
    ctx.shadowBlur = f > 0 ? 18 : 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Number in the band
    const inner = i > 0 ? RINGS[i - 1].r : 0;
    const my = c.y + ((ring.r + inner) / 2) * c.ky;
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.fillText(String(ring.points), c.x, i === 0 ? c.y : my);
  }
  // Holes
  for (const h of HOLES) {
    const p = boardPt(h.x, h.y);
    const rx = h.r * p.half * 0.9;
    const ry = h.r * p.ky * 0.8;
    const col = RING_COLORS[h.points];
    const f = flash(h.id);
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = f > 0 ? 22 : 8 + Math.sin(t * 4 + h.x) * 4;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx + 4, ry + 4, 0, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = f > 0 && Math.floor(t * 14) % 2 ? '#ffffff' : col;
    ctx.fillText(String(h.points), p.x, p.y - ry - 11);
  }
  // Neon strips on the lane edges
  for (const side of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const z = (i / 9) * RAMP_Z;
      const p = lanePt(side * 1.06, z);
      const on = v.lights > 0 ? (Math.floor(t * 16) + i) % 2 === 0 : (Math.floor(t * 4) - i + 20) % 5 === 0;
      ctx.fillStyle = on ? '#f472b6' : 'rgba(244,114,182,0.3)';
      ctx.beginPath();
      ctx.arc(p.x, p.y + 6, 3 * p.s, 0, TAU);
      ctx.fill();
    }
  }
}

function drawBall(ctx, x, y, r, spin, shadowY, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadowY != null) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, shadowY, r * 0.95, r * 0.3, 0, 0, TAU);
    ctx.fill();
  }
  drawPokeball(ctx, x, y, r, spin);
  ctx.restore();
}

function drawAim(ctx, aim, t) {
  // Path up the lane (bouncing off the walls) and the power meter
  ctx.save();
  ctx.setLineDash([5, 7]);
  ctx.lineDashOffset = -t * 30;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let z = 0; z <= RAMP_Z * 0.98; z += 0.1) {
    const x = reflect(Math.tan(aim.angle) * LATERAL * z);
    const p = lanePt(x, z);
    if (z === 0) ctx.moveTo(p.x, p.y - 10);
    else ctx.lineTo(p.x, p.y - 10);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // Meter at the side
  const x = 330;
  const y0 = 520;
  const h = 150;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, x - 10, y0 - h - 6, 20, h + 12, 10);
  ctx.fill();
  const p = aim.power ?? 0;
  const g = ctx.createLinearGradient(0, y0, 0, y0 - h);
  g.addColorStop(0, '#4ade80');
  g.addColorStop(0.55, '#facc15');
  g.addColorStop(0.8, '#fb923c');
  g.addColorStop(1, '#ef4444');
  ctx.fillStyle = g;
  roundRect(ctx, x - 6, y0 - h * p, 12, Math.max(6, h * p), 6);
  ctx.fill();
  // The sweet spot for the 50
  const lo = y0 - h * 0.72;
  const hi = y0 - h * 0.86;
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 12, hi, 24, lo - hi);
  ctx.font = '900 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fde047';
  ctx.fillText('50', x, hi - 5);
}

function sparkle(list, x, y, n, colors = CONFETTI, speed = 200) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const v = speed * (0.3 + Math.random() * 0.9);
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, w: 5, h: 3, color: colors[i % colors.length], life: 1.1, max: 1.1, g: 320 });
  }
}

function drawParticles(ctx, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    if (p.ring) continue;
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (!ctx) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, Math.cos(p.rot * 1.5));
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
}

function drawTexts(ctx, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const tx = list[i];
    tx.life -= dt;
    if (tx.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    if (!ctx) continue;
    const age = tx.max - tx.life;
    const k = Math.min(1, age / 0.25);
    const sc = k < 1 ? 0.4 + k * 0.9 : 1.3 - Math.min(0.3, (age - 0.25) * 1.2);
    ctx.save();
    ctx.globalAlpha = Math.min(1, tx.life / 0.35);
    ctx.translate(tx.x, tx.y - age * 30);
    ctx.scale(sc, sc);
    ctx.font = `900 ${tx.size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(tx.text, 0, 0);
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.text, 0, 0);
    ctx.restore();
  }
}

/** Where the ball is drawn: { x, y, r, shadowY, alpha }. */
function ballScreen(b) {
  if (b.phase === 'roll' || b.phase === 'weak') {
    const p = lanePt(b.x, b.z);
    const r = BALL_R * p.s;
    const alpha = b.phase === 'weak' && b.t > b.rollTime * 0.85 ? Math.max(0, 1 - (b.t - b.rollTime * 0.85) / (b.rollTime * 0.15)) : 1;
    return { x: p.x, y: p.y - r, r, shadowY: p.y, alpha };
  }
  const p = boardPt(b.bx, b.by, b.h);
  const ground = boardPt(b.bx, b.by).y;
  const r = BALL_R * p.s * (b.phase === 'drop' ? Math.max(0, b.scale) : 1) * (1 + b.h * 0.6);
  const alpha = b.phase === 'gutter' ? Math.max(0, 1 - Math.max(0, b.t - 0.45) / 0.25) : 1;
  return { x: p.x, y: p.y - r * 0.6, r, shadowY: b.phase === 'drop' ? null : ground, alpha };
}

const snap = (s) => ({ score: s.score, ballsLeft: s.ballsLeft, status: s.status, streak: s.streak, best: s.best, big: s.big, bonus: s.bonus, rolled: s.rolled, history: s.history.slice(), stars: skeeStars(s) });

const freshFx = () => ({ time: 0, particles: [], texts: [], lights: 0, flashHole: null, last: null, drag: null, key: null, cheer: 0, shake: 0 });

/**
 * "Lăn bóng Skee-ball": swipe up to roll a Pokeball up the lane; aim with the direction, the speed
 * of the swipe is the power. Rings 10 / 20 / 30, a 50 hole and two tiny 100 holes. 9 balls.
 */
export function SkeeBallGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const size = useFit(stageRef);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createSkee({ random }));
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

  const roll = (aim) => {
    const s = game.current;
    if (phase !== 'play' || !aim) return;
    if (!rollBall(s, aim)) return;
    setUi(snap(s));
  };

  // Swipe up: direction = angle, speed (of the last bit of the swipe) = power
  const pointer = useRef(null);
  const toCanvas = (e) => canvasPoint(canvasRef.current, e, W, H);
  const sample = (p) => {
    const now = Date.now() / 1000;
    const list = pointer.current.samples;
    list.push({ ...p, t: now });
    while (list.length > 2 && now - list[1].t > SWIPE_WINDOW) list.shift();
    // Too short a swipe does nothing; the angle comes from the flick, the power from its speed
    const start = pointer.current.start;
    if (!rollFromSwipe(p.x - start.x, p.y - start.y, 1)) return null;
    const a = list[0];
    const flick = a.y - p.y > 10 ? { dx: p.x - a.x, dy: p.y - a.y } : { dx: p.x - start.x, dy: p.y - start.y };
    const speed = Math.hypot(p.x - a.x, p.y - a.y) / Math.max(0.05, now - a.t);
    return { angle: Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, Math.atan2(flick.dx, -flick.dy))), power: Math.max(0.05, Math.min(1, (speed - SPEED_MIN) / (SPEED_FULL - SPEED_MIN))) };
  };
  const onDown = (e) => {
    if (phase !== 'play' || game.current.status !== 'aim' || !canvasRef.current) return;
    const p = toCanvas(e);
    pointer.current = { start: p, samples: [{ ...p, t: Date.now() / 1000 }] };
    fx.current.drag = null;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!pointer.current) return;
    fx.current.drag = sample(toCanvas(e));
  };
  const onUp = (e) => {
    const ptr = pointer.current;
    if (!ptr) return;
    const aim = sample(toCanvas(e));
    pointer.current = null;
    fx.current.drag = null;
    if (!aim) {
      say('Vuốt nhanh lên phía trên nhé! 👆', 'soft', 1000);
      return;
    }
    roll(aim);
  };

  // Keyboard: arrows for angle and power, Space rolls
  useEffect(() => {
    if (phase !== 'play') return undefined;
    const onKey = (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) return;
      e.preventDefault();
      const v = fx.current;
      if (!v.key) v.key = { angle: 0, power: 0.78 };
      if (e.key === 'ArrowLeft') v.key.angle = Math.max(-MAX_ANGLE, v.key.angle - 0.03);
      if (e.key === 'ArrowRight') v.key.angle = Math.min(MAX_ANGLE, v.key.angle + 0.03);
      if (e.key === 'ArrowUp') v.key.power = Math.min(1, v.key.power + 0.04);
      if (e.key === 'ArrowDown') v.key.power = Math.max(0.1, v.key.power - 0.04);
      if (e.key === ' ' && game.current.status === 'aim') roll({ ...v.key });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    const t = v.time;
    v.lights = Math.max(0, v.lights - dt);
    v.cheer = Math.max(0, v.cheer - dt);
    v.shake = Math.max(0, v.shake - dt);
    if (phase === 'play') {
      stepSkee(s, dt);
      for (const e of s.events.splice(0)) {
        if (e.type === 'roll') {
          sounds.playWhoosh();
          v.rumble = 0;
        } else if (e.type === 'ramp') sounds.playNote(392, { duration: 0.08, volume: 0.2 });
        else if (e.type === 'land') sounds.playNote(262, { duration: 0.06, volume: 0.22 });
        else if (e.type === 'bonk') {
          sounds.playNote(196, { duration: 0.12, volume: 0.28 });
          v.texts.push({ x: boardPt(e.x, e.y).x, y: boardPt(e.x, e.y).y - 20, text: 'Mạnh quá!', color: '#fdba74', size: 18, life: 1, max: 1 });
        } else if (e.type === 'score') {
          const p = boardPt(e.x, e.y);
          const big = e.points >= 50;
          v.lights = big ? 1.6 : 0.9;
          v.flashHole = e.hole;
          v.last = { at: t, text: `+${e.points + e.bonus}` };
          v.texts.push({ x: p.x, y: p.y - 26, text: `+${e.points}`, color: big ? '#fde047' : '#ffffff', size: big ? 34 : 26, life: 1.2, max: 1.2 });
          sparkle(v.particles, p.x, p.y, big ? 40 : 14, big ? CONFETTI : [RING_COLORS[e.points] || '#ffffff', '#ffffff'], big ? 260 : 140);
          sounds.playPop();
          const notes = e.points >= 100 ? [523, 659, 784, 1047, 1319, 1568] : big ? [659, 784, 988, 1319] : e.points >= 30 ? [659, 880] : [587];
          notes.forEach((f, i) => sounds.playNote(f, { duration: 0.16, delay: 0.06 + i * 0.08, volume: 0.22 }));
          if (big) {
            v.cheer = 1;
            v.shake = e.points >= 100 ? 0.35 : 0.18;
            sounds.playCoin();
          }
          if (e.points >= 100) {
            sounds.playEnergySurge();
            say('JACKPOT 100! 🎉', 'gold', 1500);
          } else if (e.bonus) say(`Chuỗi ${e.streak}! +${e.bonus} thưởng 🔥`, 'gold', 1300);
          else if (big) say('Vào lỗ 50! ⭐', 'gold', 1100);
        } else if (e.type === 'gutter') {
          sounds.playOops();
          say('Rơi vào rãnh mất rồi 😅', 'soft', 1000);
        } else if (e.type === 'weak') {
          sounds.playOops();
          say('Nhẹ quá! Vuốt nhanh hơn nhé 💨', 'soft', 1100);
        } else if (e.type === 'end') {
          sounds.playWhoosh();
          later(() => setPhase('done'), 900);
        }
      }
      // Rolling rumble
      if (s.ball && s.ball.phase === 'roll') {
        v.rumble = (v.rumble || 0) - dt;
        if (v.rumble <= 0) {
          v.rumble = 0.09;
          sounds.playNote(90 + s.ball.z * 12, { duration: 0.05, volume: 0.05 });
        }
      }
      setUi(snap(s));
    }

    const ctx = getCtx();
    if (!ctx) {
      drawParticles(null, v.particles, dt);
      drawTexts(null, v.texts, dt);
      return;
    }
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (v.shake > 0) ctx.translate((Math.random() - 0.5) * v.shake * 16, (Math.random() - 0.5) * v.shake * 16);
    const bg = scene();
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, W, H);
    }
    drawMarquee(ctx, t, v, s);
    drawBoard(ctx, t, v);
    // Balls already played wait in the tray at the bottom
    const aim = v.drag || (v.key && s.status === 'aim' && phase === 'play' ? v.key : null);
    const b = s.ball;
    if (b) {
      const p = ballScreen(b);
      if (p.alpha > 0 && p.r > 0.5) drawBall(ctx, p.x, p.y, p.r, b.spin, p.shadowY, p.alpha);
    } else if (phase === 'play' && s.status === 'aim') {
      // The next ball, wiggling to say "roll me"
      const wig = aim ? 0 : Math.sin(t * 4) * 3;
      drawBall(ctx, BALL_REST.x + wig, BALL_REST.y - BALL_R, BALL_R, wig * 0.1, BALL_REST.y);
    }
    if (aim && s.status === 'aim' && phase === 'play') drawAim(ctx, aim, t);
    // Balls left in the tray
    for (let i = 0; i < s.ballsLeft - (s.status === 'aim' ? 1 : 0); i++) drawPokeball(ctx, 228 + (i % 4) * 16, 544 - Math.floor(i / 4) * 14, 7, 0.3);
    // The child's Pokemon beside the lane
    const hop = v.cheer > 0 ? Math.abs(Math.sin(v.cheer * 12)) * 16 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(52, 548, 34, 7, 0, 0, TAU);
    ctx.fill();
    drawSprite(ctx, loadImage(player.image), 52, 506 - hop + Math.sin(t * 2.4) * 2, 88);
    drawParticles(ctx, v.particles, dt);
    drawTexts(ctx, v.texts, dt);
    ctx.restore();
    // First roll hint: a finger flicking up
    if (phase === 'play' && s.rolled === 0 && !aim && s.status === 'aim') {
      const k = (t % 1.2) / 1.2;
      ctx.globalAlpha = Math.sin(k * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(BALL_REST.x + 34, 520 - k * 150, 11, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, phase !== 'done');

  const replay = () => {
    game.current = createSkee({ random });
    fx.current = freshFx();
    setUi(snap(game.current));
    setBanner(null);
    setPhase('ready');
  };

  const bannerTone = { gold: 'text-yellow-300', soft: 'text-white' };

  return (
    <CarnivalShell
      title="🎳 Lăn bóng Skee-ball"
      label="Lăn bóng Skee-ball"
      onClose={onClose}
      background="bg-gradient-to-b from-slate-900 via-indigo-900 to-rose-900"
      dataAttrs={{ 'data-phase': phase, 'data-score': ui.score, 'data-balls': ui.ballsLeft, 'data-status': ui.status, 'data-last': ui.history.length ? ui.history[ui.history.length - 1] : '' }}
      hud={
        <>
          <HudBar
            items={[
              { icon: '⭐', label: 'Điểm', value: ui.score, testId: 'skeeball-score' },
              { icon: '🔥', label: 'Chuỗi', value: ui.streak },
            ]}
          />
          <div className="mt-1 flex items-center justify-center gap-1" data-testid="skeeball-balls" aria-label={`Còn ${ui.ballsLeft} bóng`}>
            {Array.from({ length: BALLS }, (_, i) => {
              const done = i < ui.history.length;
              const pts = ui.history[i];
              return (
                <span key={i} className={`relative inline-flex w-6 h-6 items-center justify-center rounded-full text-[9px] font-black transition-all duration-300 ${done ? (pts >= 50 ? 'bg-amber-400 text-amber-950 skeeball-chip' : pts > 0 ? 'bg-white/85 text-slate-700' : 'bg-white/20 text-white/60') : 'bg-transparent'}`}>
                  {done ? (
                    pts
                  ) : (
                    <svg viewBox="0 0 24 24" className={`w-5 h-5 ${i < ui.rolled ? 'opacity-40' : ''}`} aria-hidden="true">
                      <circle cx="12" cy="12" r="10" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
                      <path d="M2 12a10 10 0 0 1 20 0z" fill="#ef4444" stroke="#1e293b" strokeWidth="2" />
                      <circle cx="12" cy="12" r="3.2" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
                    </svg>
                  )}
                </span>
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
        data-testid="skeeball-stage"
      >
        <canvas ref={canvasRef} data-testid="skeeball-canvas" className="block max-w-full max-h-full" style={size ? { width: size.w, height: size.h } : { width: '100%', aspectRatio: `${W} / ${H}` }} />
        {phase === 'play' && ui.rolled === 0 && ui.status === 'aim' && (
          <p className="hint-pulse absolute bottom-3 inset-x-4 mx-auto max-w-xs px-3 py-1.5 rounded-2xl bg-black/60 text-center text-white text-sm font-black pointer-events-none" data-testid="skeeball-hint">
            Vuốt lên thật nhanh để lăn bóng! Nhắm lỗ 50 nhé 🎯
          </p>
        )}
        {banner && phase === 'play' && (
          <div className="absolute top-[34%] inset-x-0 flex justify-center pointer-events-none">
            <p key={banner.id} className={`chain-pop whitespace-nowrap text-2xl sm:text-3xl font-black drop-shadow-[0_3px_3px_rgba(0,0,0,0.85)] ${bannerTone[banner.tone] || 'text-white'}`}>
              {banner.text}
            </p>
          </div>
        )}
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Vua Skee-ball! 🏆' : ui.stars === 2 ? 'Lăn giỏi lắm! 🎳' : 'Cố lên nhé! 💪'}
            stars={ui.stars}
            detail={`${ui.score} điểm · ${ui.big} lần vào lỗ 50+${ui.bonus ? ` · thưởng chuỗi +${ui.bonus}` : ''}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
