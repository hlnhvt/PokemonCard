import { useEffect, useLayoutEffect, useRef } from 'react';
import { POPULAR_POKEMON } from '../../utils/guessGame';
import { pickCustomers } from '../../utils/kidGamesCommon';

// Hooks and canvas helpers shared by the sports matches.

/** Well-known Pokemon to play against, never the child's own. */
export const pickOpponents = (playerName, count, random) => pickCustomers(POPULAR_POKEMON, count, playerName, random);

/** requestAnimationFrame loop calling `callback(dt)` (seconds, capped) while `active`. */
export function useLoop(callback, active = true) {
  const cb = useRef(callback);
  useLayoutEffect(() => {
    cb.current = callback;
  });
  useEffect(() => {
    if (!active) return undefined;
    const raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (f) => setTimeout(() => f(performance.now()), 16);
    const cancel = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : clearTimeout;
    let id;
    let last = null;
    const tick = (now) => {
      const dt = last == null ? 1 / 60 : Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      cb.current(dt);
      id = raf(tick);
    };
    id = raf(tick);
    return () => cancel(id);
  }, [active]);
}

/** setTimeout that is cleared when the component unmounts. */
export function useLater() {
  const timers = useRef([]);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach(clearTimeout);
    };
  }, []);
  return (fn, ms) => timers.current.push(setTimeout(() => alive.current && fn(), ms));
}

/** Sharp canvas of a fixed logical size (W x H), scaled for the screen's pixel ratio. */
export function useCanvas(ref, width, height) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.getContext?.('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [ref, width, height]);
  return () => ref.current?.getContext?.('2d') || null;
}

/** Pointer position in the canvas' logical coordinates. */
export function canvasPoint(canvas, event, width, height) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: width / 2, y: height / 2 };
  return { x: ((event.clientX - rect.left) / rect.width) * width, y: ((event.clientY - rect.top) / rect.height) * height };
}

const imageCache = new Map();
export function loadImage(src) {
  if (!src) return null;
  if (!imageCache.has(src)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    imageCache.set(src, img);
  }
  return imageCache.get(src);
}

export const imageReady = (img) => !!img && img.complete && img.naturalWidth > 0;

/** Draw a Pokemon image centred at (x, y) with its feet at y + size/2; falls back to a circle. */
export function drawSprite(ctx, img, x, y, size, { flip = false, rotate = 0, alpha = 1, color = '#fbbf24' } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rotate) ctx.rotate(rotate);
  if (flip) ctx.scale(-1, 1);
  if (imageReady(img)) {
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A Pokeball (used as the bowling ball and the racing trophy). */
export function drawPokeball(ctx, x, y, r, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-r, -r * 0.12, r * 2, r * 0.24);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.5, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Little sparks, updated and drawn by the games. */
export function burst(list, x, y, { count = 14, colors = ['#fde047', '#f97316', '#ffffff'], speed = 160, life = 0.7, size = 4, gravity = 260 } = {}) {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const v = speed * (0.5 + Math.random() * 0.7);
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life, max: life, size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], gravity });
  }
}

export function updateParticles(ctx, list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (!ctx) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ctx) ctx.globalAlpha = 1;
}
