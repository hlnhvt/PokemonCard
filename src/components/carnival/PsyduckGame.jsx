import React, { useRef, useState } from 'react';
import { createGallery, stepGallery, shoot, galleryStars, timeLeft, centreOf, DURATION, RAILS, SCALE, NOZZLE, W, H } from '../../utils/carnival/psyduck';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, drawSprite, burst, updateParticles } from '../sports/sportsKit';
import { CarnivalShell, CarnivalResult, Countdown, HudBar } from './CarnivalCommon';

const PSYDUCK = artworkUrl(54);
const PIKACHU = artworkUrl(25);

const snap = (s) => ({ score: s.score, combo: s.combo, best: s.best, hits: s.hits, oops: s.oops, misses: s.misses, left: timeLeft(s), stars: galleryStars(s) });

function drawBackdrop(ctx, time) {
  // Booth wall: blue and white planks
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#0c4a6e');
  wall.addColorStop(1, '#075985');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(i * 40, 0, 40, H);
  }
  // Clouds and stars painted on the wall
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  [[60, 110], [250, 95], [320, 140]].forEach(([x, y], i) => {
    const dx = Math.sin(time * 0.3 + i) * 6;
    ctx.beginPath();
    ctx.arc(x + dx, y, 16, 0, Math.PI * 2);
    ctx.arc(x + dx + 18, y - 6, 20, 0, Math.PI * 2);
    ctx.arc(x + dx + 38, y, 15, 0, Math.PI * 2);
    ctx.fill();
  });
  // Canopy: yellow and blue scallops
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? '#fde047' : '#2563eb';
    ctx.fillRect(i * 40, 0, 40, 30);
    ctx.beginPath();
    ctx.arc(i * 40 + 20, 30, 20, 0, Math.PI);
    ctx.fill();
  }
  // Bulbs
  for (let i = 0; i < 12; i++) {
    const x = 15 + i * 30;
    const on = 0.5 + 0.5 * Math.sin(time * 5 + i * 2.1);
    ctx.globalAlpha = 0.4 + on * 0.6;
    ctx.fillStyle = i % 2 ? '#fef08a' : '#fda4af';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8 + on * 6;
    ctx.beginPath();
    ctx.arc(x, 62, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.font = '900 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fef9c3';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 10 + Math.sin(time * 3) * 4;
  ctx.fillText('BẮN VỊT PSYDUCK', W / 2, 96);
  ctx.restore();
}

/** A strip of wavy water just in front of a rail (it hides the bottom of the targets). */
function drawWater(ctx, y, row, time) {
  const top = y - 8;
  const g = ctx.createLinearGradient(0, top, 0, top + 46);
  g.addColorStop(0, '#38bdf8');
  g.addColorStop(1, '#0369a1');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, top + 46);
  for (let x = 0; x <= W; x += 6) ctx.lineTo(x, top + Math.sin(x * 0.06 + time * (2.2 + row * 0.5) * (row % 2 ? -1 : 1)) * 4);
  ctx.lineTo(W, top + 46);
  ctx.closePath();
  ctx.fill();
  // Foam crests
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 6) {
    const yy = top + Math.sin(x * 0.06 + time * (2.2 + row * 0.5) * (row % 2 ? -1 : 1)) * 4;
    if (x === 0) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.stroke();
  // Rail under the water line
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, top + 38, W, 8);
  ctx.fillStyle = '#f59e0b';
  for (let x = ((time * 40 * (row % 2 ? -1 : 1)) % 24 + 24) % 24; x < W; x += 24) ctx.fillRect(x, top + 40, 10, 3);
}

function drawTarget(ctx, t, time) {
  const c = centreOf(t);
  const sc = SCALE[t.row];
  const bob = Math.sin(t.bob * 3) * 3 * sc;
  if (t.kind === 'pikachu') {
    if (t.hit) return; // popped
    const sway = Math.sin(t.bob * 2) * 0.08;
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.rotate(sway);
    // String down to the rail
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, c.r);
    ctx.quadraticCurveTo(6, c.r + 20, 0, t.y - c.y + 10);
    ctx.stroke();
    // Balloon
    const g = ctx.createRadialGradient(-c.r * 0.35, -c.r * 0.4, 2, 0, 0, c.r * 1.2);
    g.addColorStop(0, '#fef9c3');
    g.addColorStop(0.5, '#facc15');
    g.addColorStop(1, '#ca8a04');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, c.r, c.r * 1.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.moveTo(-4, c.r * 1.1);
    ctx.lineTo(4, c.r * 1.1);
    ctx.lineTo(0, c.r * 1.1 + 6);
    ctx.fill();
    // Ears
    ctx.fillStyle = '#facc15';
    [-1, 1].forEach((d) => {
      ctx.beginPath();
      ctx.moveTo(d * c.r * 0.45, -c.r * 0.9);
      ctx.lineTo(d * c.r * 0.95, -c.r * 1.75);
      ctx.lineTo(d * c.r * 0.9, -c.r * 0.55);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(d * c.r * 0.82, -c.r * 1.45);
      ctx.lineTo(d * c.r * 0.95, -c.r * 1.75);
      ctx.lineTo(d * c.r * 0.93, -c.r * 1.35);
      ctx.fill();
      ctx.fillStyle = '#facc15';
    });
    drawSprite(ctx, loadImage(PIKACHU), 0, 2, c.r * 1.7, { color: '#fde047' });
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-c.r * 0.45, -c.r * 0.5, c.r * 0.18, c.r * 0.3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  // A duck target on a stick, flipping backwards when hit
  const flip = Math.cos(Math.min(1, t.down) * Math.PI * 0.5);
  ctx.save();
  ctx.translate(t.x, t.y + bob);
  const cy = c.y - t.y;
  // Stick
  ctx.fillStyle = '#92400e';
  ctx.fillRect(-3 * sc, cy, 6 * sc, -cy + 6);
  ctx.scale(1, Math.max(0.08, flip));
  // Board: bullseye rings (gold for the golden duck)
  const gold = t.kind === 'gold';
  const rings = gold ? ['#fef08a', '#facc15', '#ca8a04'] : ['#ffffff', '#ef4444', '#ffffff'];
  rings.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(0, cy, c.r * (1 - i * 0.22), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = gold ? '#a16207' : '#7f1d1d';
  ctx.beginPath();
  ctx.arc(0, cy, c.r, 0, Math.PI * 2);
  ctx.stroke();
  if (t.down < 0.5) {
    if (gold) {
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 18 + Math.sin(time * 8) * 6;
    }
    drawSprite(ctx, loadImage(PSYDUCK), 0, cy - 2, c.r * 1.75, { color: gold ? '#fde047' : '#fbbf24' });
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  if (gold && !t.hit) {
    // Twinkles around the golden one
    for (let i = 0; i < 3; i++) {
      const a = time * 3 + (i * Math.PI * 2) / 3;
      const k = 0.5 + 0.5 * Math.sin(time * 9 + i * 2);
      const x = c.x + Math.cos(a) * c.r * 1.25;
      const y = c.y + bob + Math.sin(a) * c.r * 1.25;
      ctx.fillStyle = `rgba(254,240,138,${0.4 + k * 0.6})`;
      ctx.beginPath();
      ctx.moveTo(x, y - 6 * k - 2);
      ctx.lineTo(x + 2, y);
      ctx.lineTo(x, y + 6 * k + 2);
      ctx.lineTo(x - 2, y);
      ctx.fill();
    }
  }
  if (t.kind === 'small' && !t.hit) {
    ctx.fillStyle = '#fff';
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+20', c.x, c.y + bob - c.r - 4);
  }
}

function drawShot(ctx, shot, trail) {
  // Fading trail behind the water ball
  trail.forEach((p, i) => {
    const k = (i + 1) / trail.length;
    ctx.fillStyle = `rgba(125,211,252,${k * 0.5})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + k * 6, 0, Math.PI * 2);
    ctx.fill();
  });
  const g = ctx.createRadialGradient(shot.x - 3, shot.y - 3, 1, shot.x, shot.y, 10);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.4, '#7dd3fc');
  g.addColorStop(1, '#0284c7');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(shot.x, shot.y, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawNozzle(ctx, angle, kick) {
  ctx.save();
  ctx.translate(NOZZLE.x, NOZZLE.y + 6);
  // Base
  ctx.fillStyle = '#1e3a8a';
  ctx.beginPath();
  ctx.ellipse(0, 12, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(-12, 0, 12, 0);
  g.addColorStop(0, '#1d4ed8');
  g.addColorStop(0.5, '#60a5fa');
  g.addColorStop(1, '#1e40af');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-11, -54 + kick * 8, 22, 58, 8);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-13, -56 + kick * 8, 26, 8);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-11, -30 + kick * 8, 22, 5);
  ctx.restore();
  // Tank (a Pokeball)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(NOZZLE.x, NOZZLE.y + 10, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(NOZZLE.x, NOZZLE.y + 10, 17, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(NOZZLE.x - 17, NOZZLE.y + 8, 34, 4);
  ctx.beginPath();
  ctx.arc(NOZZLE.x, NOZZLE.y + 10, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(NOZZLE.x, NOZZLE.y + 10, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawCross(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(time * 0.8);
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
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
    const pop = age < 0.12 ? 0.4 + (age / 0.12) * 0.9 : Math.max(1, 1.3 - (age - 0.12) * 1.6);
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.life / 0.3);
    ctx.translate(t.x, t.y - age * 50);
    ctx.scale(pop, pop);
    ctx.font = `900 ${t.size || 24}px system-ui, sans-serif`;
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
 * "Bắn vịt Psyduck": tap to shoot water balls at the Psyduck gliding along 3 rails.
 * Golden +30, small +20, but don't pop the Pikachu balloon! 40 seconds.
 */
export function PsyduckGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [phase, setPhase] = useState('ready');
  const [first] = useState(() => createGallery({ random }));
  const game = useRef(first);
  const [ui, setUi] = useState(() => snap(first));
  const fx = useRef({ particles: [], texts: [], trails: new Map(), time: 0, cross: null, angle: 0, kick: 0, shake: 0, flash: 0 });
  const later = useLater();

  const toCanvas = (e) => canvasPoint(canvasRef.current, e, W, H);
  const onDown = (e) => {
    const p = toCanvas(e);
    fx.current.cross = p;
    if (phase !== 'play') return;
    const s = game.current;
    if (!shoot(s, p.x, p.y)) return;
    const v = fx.current;
    v.kick = 1;
    v.angle = Math.atan2(p.x - NOZZLE.x, NOZZLE.y - p.y);
    burst(v.particles, NOZZLE.x + Math.sin(v.angle) * 50, NOZZLE.y - Math.cos(v.angle) * 50, { count: 6, speed: 80, colors: ['#bae6fd', '#ffffff'], size: 2.5 });
    sounds.playWhoosh();
    setUi(snap(s));
  };
  const onMove = (e) => {
    if (e.pointerType === 'touch') return;
    fx.current.cross = toCanvas(e);
  };

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    v.kick = Math.max(0, v.kick - dt * 6);
    v.shake = Math.max(0, v.shake - dt);
    v.flash = Math.max(0, v.flash - dt * 2.5);
    if (phase === 'play') {
      stepGallery(s, dt);
      for (const e of s.events.splice(0)) {
        if (e.type === 'hit') {
          const gold = e.kind === 'gold';
          burst(v.particles, e.x, e.y, { count: 22, speed: 200, colors: ['#7dd3fc', '#e0f2fe', '#38bdf8', '#ffffff'], size: 3.5, gravity: 420 });
          if (gold) burst(v.particles, e.x, e.y, { count: 18, speed: 240, colors: ['#fde047', '#facc15', '#ffffff'], size: 3 });
          v.texts.push({ x: e.x, y: e.y - 24, text: `+${e.points}`, color: gold ? '#fde047' : e.kind === 'small' ? '#f9a8d4' : '#ffffff', life: 0.9, max: 0.9, size: gold ? 32 : 26 });
          if (e.combo >= 3 && e.combo % 5 === 0) v.texts.push({ x: W / 2, y: 150, text: `${e.combo} COMBO!`, color: '#fb923c', life: 1, max: 1, size: 30 });
          sounds.playCoin();
          if (gold) later(() => sounds.playNote(1318, { duration: 0.2, volume: 0.25 }), 100);
          v.shake = gold ? 0.2 : 0.08;
        }
        if (e.type === 'pikachu') {
          burst(v.particles, e.x, e.y, { count: 26, speed: 230, colors: ['#facc15', '#fde047', '#ca8a04'], size: 4 });
          v.texts.push({ x: e.x, y: e.y - 20, text: `${e.points}`, color: '#fb7185', life: 1, max: 1, size: 28 });
          v.texts.push({ x: e.x, y: e.y + 16, text: 'Ối! Pikachu 😢', color: '#fde68a', life: 1.1, max: 1.1, size: 16 });
          sounds.playOops();
          v.flash = 0.6;
          v.shake = 0.35;
        }
        if (e.type === 'miss' || e.type === 'splash') {
          burst(v.particles, e.x, e.y, { count: 9, speed: 100, colors: ['#bae6fd', '#ffffff'], size: 2.5, gravity: 380 });
          if (e.type === 'miss') sounds.playPop();
        }
        if (e.type === 'end') {
          sounds.playWhoosh();
          later(() => setPhase('done'), 700);
        }
      }
      // Trails of the water balls
      const alive = new Set();
      for (const shot of s.shots) {
        alive.add(shot.id);
        const trail = v.trails.get(shot.id) || [];
        trail.push({ x: shot.x, y: shot.y });
        if (trail.length > 7) trail.shift();
        v.trails.set(shot.id, trail);
      }
      for (const id of v.trails.keys()) if (!alive.has(id)) v.trails.delete(id);
      setUi(snap(s));
    }
    if (v.cross) v.angle += (Math.atan2(v.cross.x - NOZZLE.x, NOZZLE.y - v.cross.y) - v.angle) * Math.min(1, dt * 10);

    const ctx = getCtx();
    if (!ctx) {
      updateParticles(null, v.particles, dt);
      return;
    }
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (v.shake > 0) ctx.translate((Math.random() - 0.5) * v.shake * 14, (Math.random() - 0.5) * v.shake * 14);
    drawBackdrop(ctx, v.time);
    // Back row first; each row's water goes over its targets
    RAILS.forEach((y, row) => {
      s.targets.filter((t) => t.row === row).forEach((t) => drawTarget(ctx, t, v.time));
      drawWater(ctx, y, row, v.time);
    });
    // Counter
    const counter = ctx.createLinearGradient(0, 470, 0, H);
    counter.addColorStop(0, '#b45309');
    counter.addColorStop(1, '#78350f');
    ctx.fillStyle = counter;
    ctx.fillRect(0, 476, W, H - 476);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(0, 474, W, 4);
    drawSprite(ctx, loadImage(player.image), 88, 500 - v.kick * 6 + Math.sin(v.time * 3) * 2, 86, { flip: true });
    drawNozzle(ctx, v.angle, v.kick);
    for (const shot of s.shots) drawShot(ctx, shot, v.trails.get(shot.id) || []);
    updateParticles(ctx, v.particles, dt);
    drawTexts(ctx, v.texts, dt);
    if (v.cross && phase === 'play') drawCross(ctx, v.cross, v.time);
    ctx.restore();
    if (v.flash > 0) {
      ctx.fillStyle = `rgba(254,202,202,${v.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }, phase !== 'done');

  const replay = () => {
    game.current = createGallery({ random });
    fx.current.particles = [];
    fx.current.texts = [];
    fx.current.trails = new Map();
    setUi(snap(game.current));
    setPhase('ready');
  };

  const left = Math.ceil(ui.left);
  return (
    <CarnivalShell
      title="🦆 Bắn vịt Psyduck"
      label="Bắn vịt Psyduck"
      onClose={onClose}
      background="bg-gradient-to-b from-sky-700 via-sky-800 to-blue-950"
      dataAttrs={{ 'data-phase': phase, 'data-score': ui.score, 'data-combo': ui.combo, 'data-hits': ui.hits }}
      hud={
        <>
          <HudBar items={[{ icon: '⭐', label: 'Điểm', value: ui.score, testId: 'psyduck-score' }, { icon: '🔥', label: 'Combo', value: ui.combo }, { icon: '⏱', label: 'Còn', value: `${left}s`, warn: left <= 8 && phase === 'play' }]} />
          <div className="mt-1 h-2 rounded-full bg-black/30 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-300 to-blue-500 transition-[width] duration-200" style={{ width: `${(ui.left / DURATION) * 100}%` }} />
          </div>
        </>
      }
    >
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden touch-none cursor-crosshair"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerLeave={() => (fx.current.cross = null)}
        data-testid="psyduck-stage"
      >
        <canvas ref={canvasRef} data-testid="psyduck-canvas" className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, width: '100%', height: 'auto' }} />
        {phase === 'play' && ui.left > DURATION - 5 && (
          <p className="hint-pulse absolute bottom-3 left-1/2 -translate-x-1/2 w-[88%] px-3 py-1.5 rounded-2xl bg-black/60 text-center text-white text-sm font-black pointer-events-none" data-testid="psyduck-hint">
            Chạm để bắn vịt! Đừng bắn bóng bay Pikachu nhé 🎈
          </p>
        )}
        {ui.combo >= 3 && phase === 'play' && (
          <p key={ui.combo} className="chain-pop absolute top-2 right-3 text-2xl font-black text-orange-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] pointer-events-none" data-testid="psyduck-combo">
            x{ui.combo} 🔥
          </p>
        )}
        {phase === 'ready' && <Countdown onDone={() => setPhase('play')} />}
        {phase === 'done' && (
          <CarnivalResult
            title={ui.stars === 3 ? 'Xạ thủ siêu đỉnh! 🏆' : ui.stars === 2 ? 'Bắn giỏi lắm! 💦' : 'Cố lên nhé! 🦆'}
            stars={ui.stars}
            detail={`${ui.score} điểm · bắn trúng ${ui.hits} vịt · combo cao nhất ${ui.best}${ui.oops ? ` · lỡ bắn ${ui.oops} bóng Pikachu` : ''}`}
            onReplay={replay}
            onClose={onClose}
            onGold={onGold}
          />
        )}
      </div>
    </CarnivalShell>
  );
}
