import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { MINER_W as W, MINER_H as H, ORIGIN, LEVELS, createMiner, stepMiner, fire, blast, nextLevel, hookTip, minerResult } from '../../utils/sports/goldminer';
import { sounds } from '../../utils/soundEffects';
import { SportsShell, Banner, MatchResult } from './SportsCommon';
import { useLoop, useLater, useCanvas, loadImage, drawSprite, burst, updateParticles } from './sportsKit';

const GROUND_Y = 150;
const TAU = Math.PI * 2;

// Underground painted once: soil layers, stripes and pebbles
let soilCache = null;
function soil() {
  if (soilCache || typeof document === 'undefined') return soilCache;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = (H - GROUND_Y) * 2;
  const ctx = c.getContext?.('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);
  const h = H - GROUND_Y;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#b45309');
  g.addColorStop(0.35, '#92400e');
  g.addColorStop(0.7, '#78350f');
  g.addColorStop(1, '#451a03');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, h);
  // Wavy strata
  for (let k = 0; k < 6; k++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.08 + k * 0.02})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, 50 + k * 62 + Math.sin(x / 38 + k) * 8);
    ctx.stroke();
  }
  // Pebbles
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,237,213' : '28,25,23'},${0.12 + rnd() * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * W, rnd() * h, 2 + rnd() * 4, 1.5 + rnd() * 2.5, rnd() * 3, 0, TAU);
    ctx.fill();
  }
  soilCache = c;
  return c;
}

function blob(ctx, x, y, r, seed, points = 9) {
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const a = (i / points) * TAU;
    const rr = r * (0.82 + (((seed * 13 + i * 7) % 10) / 10) * 0.3);
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85);
  }
  ctx.closePath();
}

function drawItem(ctx, it, time) {
  const { x, y, r } = it;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + r * 0.75, r * 0.95, r * 0.3, 0, 0, TAU);
  ctx.fill();
  if (it.kind.startsWith('gold')) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r * 1.1);
    g.addColorStop(0, '#fffbeb');
    g.addColorStop(0.3, '#fde047');
    g.addColorStop(0.75, '#eab308');
    g.addColorStop(1, '#a16207');
    ctx.fillStyle = g;
    blob(ctx, x, y, r, it.id);
    ctx.fill();
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Glints that twinkle
    const tw = (Math.sin(time * 3 + it.id * 1.7) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.6})`;
    star4(ctx, x - r * 0.3, y - r * 0.35, 2 + tw * r * 0.18);
    ctx.fill();
  } else if (it.kind.startsWith('rock')) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r * 1.1);
    g.addColorStop(0, '#e7e5e4');
    g.addColorStop(0.5, '#a8a29e');
    g.addColorStop(1, '#57534e');
    ctx.fillStyle = g;
    blob(ctx, x, y, r, it.id, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(41,37,36,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.2, y - r * 0.3);
    ctx.lineTo(x + r * 0.05, y);
    ctx.lineTo(x - r * 0.1, y + r * 0.3);
    ctx.stroke();
  } else if (it.kind === 'diamond') {
    drawDiamond(ctx, x, y, r, time + it.id);
  } else if (it.kind === 'bag') {
    ctx.fillStyle = '#c2a37a';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.35, y - r * 0.75);
    ctx.quadraticCurveTo(x - r * 1.15, y + r * 0.2, x - r * 0.7, y + r * 0.85);
    ctx.lineTo(x + r * 0.7, y + r * 0.85);
    ctx.quadraticCurveTo(x + r * 1.15, y + r * 0.2, x + r * 0.35, y - r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7c5a36';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#7c5a36';
    ctx.fillRect(x - r * 0.45, y - r * 0.85, r * 0.9, r * 0.22);
    ctx.fillStyle = '#fef3c7';
    ctx.font = `900 ${Math.round(r)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('?', x, y + r * 0.55);
  } else if (it.kind === 'diglett') {
    const bob = Math.sin(time * 8 + it.id) * 2;
    ctx.fillStyle = '#44403c';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.7, r * 1.2, r * 0.35, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#a16207';
    ctx.beginPath();
    ctx.ellipse(x, y + bob, r * 0.8, r, 0, Math.PI, 0);
    ctx.lineTo(x + r * 0.8, y + r * 0.7);
    ctx.lineTo(x - r * 0.8, y + r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1c1917';
    const face = it.vx > 0 ? 3 : -3;
    for (const dx of [-4, 4]) {
      ctx.beginPath();
      ctx.ellipse(x + dx + face, y - r * 0.3 + bob, 1.8, 3, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f9a8d4';
    ctx.beginPath();
    ctx.ellipse(x + face, y + 1 + bob, 5, 3.5, 0, 0, TAU);
    ctx.fill();
    if (it.diamond) drawDiamond(ctx, x + (it.vx > 0 ? r : -r), y + bob, 8, time);
  }
}

function star4(ctx, x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? s * 0.3 : s;
    const a = (i * Math.PI) / 4;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function drawDiamond(ctx, x, y, r, t) {
  ctx.save();
  ctx.shadowColor = '#67e8f9';
  ctx.shadowBlur = 12;
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, '#ecfeff');
  g.addColorStop(0.5, '#67e8f9');
  g.addColorStop(1, '#0891b2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.3);
  ctx.lineTo(x - r * 0.5, y - r * 0.9);
  ctx.lineTo(x + r * 0.5, y - r * 0.9);
  ctx.lineTo(x + r, y - r * 0.3);
  ctx.lineTo(x, y + r);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.3);
  ctx.lineTo(x + r, y - r * 0.3);
  ctx.moveTo(x - r * 0.3, y - r * 0.9);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x + r * 0.3, y - r * 0.9);
  ctx.stroke();
  const tw = (Math.sin(t * 5) + 1) / 2;
  ctx.fillStyle = `rgba(255,255,255,${tw})`;
  star4(ctx, x + r * 0.6, y - r * 0.8, 3 + tw * 4);
  ctx.fill();
  ctx.restore();
}

function drawClaw(ctx, tip, angle, open) {
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(-angle);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const spread = open ? 0.75 : 0.25;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(side * 14 * spread + side * 4, 6, side * 8 * spread, 16);
    ctx.stroke();
  }
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(0, -3, 5.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(-1.5, -4.5, 1.8, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawScene(ctx, s, v, img) {
  const t = v.time;
  // Sky with sun and clouds
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#38bdf8');
  sky.addColorStop(1, '#bae6fd');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);
  ctx.fillStyle = 'rgba(253,224,71,0.9)';
  ctx.beginPath();
  ctx.arc(318, 38, 20, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [cx, cy, sc] of [[60, 30, 1], [230, 50, 0.8]]) {
    const x = ((cx + t * 8 * sc) % (W + 80)) - 40;
    ctx.beginPath();
    ctx.arc(x, cy, 12 * sc, 0, TAU);
    ctx.arc(x + 14 * sc, cy - 6 * sc, 15 * sc, 0, TAU);
    ctx.arc(x + 30 * sc, cy, 11 * sc, 0, TAU);
    ctx.fill();
  }
  // Soil
  const sc = soil();
  if (sc) ctx.drawImage(sc, 0, GROUND_Y, W, H - GROUND_Y);
  else {
    ctx.fillStyle = '#92400e';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  }
  // Grass edge
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(0, GROUND_Y - 6, W, 10);
  ctx.fillStyle = '#22c55e';
  for (let x = 0; x < W; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y - 4);
    ctx.lineTo(x + 4, GROUND_Y - 12 - Math.sin(x + t * 2) * 2);
    ctx.lineTo(x + 8, GROUND_Y - 4);
    ctx.fill();
  }
  // Winch and platform
  ctx.fillStyle = '#78350f';
  ctx.fillRect(ORIGIN.x - 60, ORIGIN.y - 14, 120, 12);
  ctx.fillStyle = '#a16207';
  ctx.fillRect(ORIGIN.x - 56, ORIGIN.y - 12, 112, 4);
  const spin = s.hook.state === 'swing' ? 0 : (s.hook.state === 'out' ? 1 : -1) * t * 10;
  ctx.save();
  ctx.translate(ORIGIN.x + 36, ORIGIN.y - 28);
  ctx.rotate(spin);
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, TAU);
  ctx.stroke();
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();
  }
  ctx.restore();
  // The Pokemon: leans back while pulling something heavy
  const pulling = s.hook.state === 'back' && s.hook.grabbed;
  const lean = pulling ? Math.sin(t * 14) * 0.06 - 0.1 : Math.sin(t * 2) * 0.03;
  drawSprite(ctx, img, ORIGIN.x - 20, ORIGIN.y - 48, 76, { rotate: lean });
  // Items
  for (const it of s.items) drawItem(ctx, it, t);
  // Rope and claw
  const tip = hookTip(s);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(ORIGIN.x, ORIGIN.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  if (s.hook.grabbed) drawItem(ctx, s.hook.grabbed, t);
  drawClaw(ctx, tip, s.hook.angle, !s.hook.grabbed);
  // Aim guide while swinging: a faint dotted line
  if (s.hook.state === 'swing') {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x + Math.sin(s.hook.angle) * 220, tip.y + Math.cos(s.hook.angle) * 220);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Explosion rings
  for (let i = v.booms.length - 1; i >= 0; i--) {
    const b = v.booms[i];
    b.life -= v.dt;
    if (b.life <= 0) {
      v.booms.splice(i, 1);
      continue;
    }
    const k = 1 - b.life / b.max;
    ctx.globalAlpha = 1 - k;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 20 + k * 60);
    g.addColorStop(0, '#fff7ae');
    g.addColorStop(0.4, '#fb923c');
    g.addColorStop(1, 'rgba(220,38,38,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 20 + k * 60, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  updateParticles(ctx, v.particles, v.dt);
  // Money flying up
  for (let i = v.floats.length - 1; i >= 0; i--) {
    const f = v.floats[i];
    f.life -= v.dt;
    if (f.life <= 0) {
      v.floats.splice(i, 1);
      continue;
    }
    const k = 1 - f.life / f.max;
    ctx.globalAlpha = Math.min(1, f.life * 3);
    ctx.font = `900 ${Math.round(22 + (k < 0.2 ? k * 40 : 8))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    const y = f.y - k * 50;
    ctx.strokeText(f.text, f.x, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, y);
    ctx.globalAlpha = 1;
  }
}

const snapshot = (s, phase, cleared) => ({ phase, level: s.level, money: s.money, target: s.target, time: Math.ceil(s.time), dynamite: s.dynamite, cleared, canBlast: s.hook.state === 'back' && !!s.hook.grabbed && s.dynamite > 0 });

/**
 * Pokémon Đào vàng: the claw swings under the child's Pokemon; tap to shoot it. Gold and
 * diamonds pay, rocks are heavy (blow them up with dynamite). Reach the target of each of
 * the 5 levels before the time runs out.
 */
export function GoldMinerGame({ player, onClose, onBerries, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [first] = useState(() => createMiner({ random }));
  const game = useRef(first);
  const fx = useRef({ particles: [], floats: [], booms: [], time: 0, dt: 0, intro: 1.8 });
  const [phase, setPhase] = useState('intro');
  const [cleared, setCleared] = useState(0);
  const [ui, setUi] = useState(() => snapshot(first, 'intro', 0));
  const [banner, setBanner] = useState(null);
  const later = useLater();
  const img = loadImage(player.image);
  const say = (text, tone) => setBanner((b) => ({ id: (b?.id || 0) + 1, text, tone }));
  const sync = (p = phase, c = cleared) => setUi(snapshot(game.current, p, c));


  const shoot = () => {
    if (phase !== 'play') return;
    if (fire(game.current)) {
      sounds.playWhoosh();
      sync();
    }
  };
  const boom = () => {
    if (phase !== 'play') return;
    if (blast(game.current)) sync();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowDown') {
        e.preventDefault();
        shoot();
      } else if (e.code === 'ArrowUp' || e.code === 'KeyB') boom();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useLoop((dt) => {
    const s = game.current;
    const v = fx.current;
    v.time += dt;
    v.dt = dt;
    // The level card shows for a moment, then the claw starts swinging
    if (phase === 'intro') {
      v.intro -= dt;
      if (v.intro <= 0) {
        setPhase('play');
        sync('play');
      }
    }
    if (phase === 'play') {
      const before = Math.ceil(s.time);
      stepMiner(s, dt);
      let changed = Math.ceil(s.time) !== before;
      for (const e of s.events.splice(0)) {
        changed = true;
        if (e.type === 'grab') {
          const tip = hookTip(s);
          burst(v.particles, tip.x, tip.y, { count: e.heavy ? 16 : 8, colors: ['#a8a29e', '#d6d3d1', '#78350f'], speed: 90, gravity: 200 });
          if (e.item.kind === 'diamond' || e.item.diamond) sounds.playCoin();
          else sounds.playPop();
          if (e.heavy) say('Nặng quá! 💪', 'blue');
        } else if (e.type === 'miss') {
          sounds.playPop();
        } else if (e.type === 'collect') {
          const good = e.value >= 400;
          v.floats.push({ x: ORIGIN.x, y: ORIGIN.y - 30, text: `+${e.value}`, color: good ? '#fde047' : e.value >= 100 ? '#fef08a' : '#e5e7eb', life: 1.1, max: 1.1 });
          burst(v.particles, ORIGIN.x, ORIGIN.y - 10, { count: good ? 30 : 12, colors: ['#fde047', '#facc15', '#ffffff'], speed: good ? 220 : 140, gravity: 260 });
          sounds.playCoin();
          if (e.item.kind === 'diamond' || e.item.diamond) say('KIM CƯƠNG! 💎', 'blue');
          else if (e.value >= 400) say('VÀNG TO! 🤩', 'gold');
        } else if (e.type === 'jackpot') {
          say('TRÚNG LỚN! 🎉', 'gold');
        } else if (e.type === 'blast') {
          v.booms.push({ x: e.at.x, y: e.at.y, life: 0.5, max: 0.5 });
          burst(v.particles, e.at.x, e.at.y, { count: 34, colors: ['#fb923c', '#fde047', '#dc2626', '#57534e'], speed: 260, gravity: 180 });
          say('BÙM! 💥', 'red');
          sounds.playEnergySurge();
        } else if (e.type === 'end') {
          if (e.status === 'failed') {
            say('Hết giờ!', 'red');
            sounds.playOops?.();
            setPhase('done');
            later(() => sync('done'), 0);
          } else {
            const c = cleared + 1;
            setCleared(c);
            sounds.playSuccessFanfare();
            try {
              confetti({ particleCount: e.status === 'won' ? 160 : 70, spread: 80, origin: { y: 0.35 }, zIndex: 9999 });
            } catch {
              // decoration
            }
            if (e.status === 'won') {
              say('ĐÀO VÀNG CỪ KHÔI! 🏆', 'gold');
              setPhase('done');
              later(() => sync('done', c), 0);
            } else {
              say('QUA CỬA! ⭐', 'green');
              setPhase('clear');
              later(() => sync('clear', c), 0);
            }
          }
        }
      }
      if (changed) sync();
    }
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawScene(ctx, s, v, img);
  }, phase !== 'done');

  const goNext = () => {
    game.current = nextLevel(game.current);
    fx.current.intro = 1.6;
    setPhase('intro');
    sync('intro');
  };

  const replay = () => {
    game.current = createMiner({ random });
    setCleared(0);
    setBanner(null);
    fx.current.intro = 1.6;
    setPhase('intro');
    sync('intro', 0);
  };

  const lowTime = ui.time <= 10 && phase === 'play';
  const reached = ui.money >= ui.target;

  return (
    <SportsShell
      title="⛏️ Pokémon Đào vàng"
      label="Pokémon Đào vàng"
      player={player}
      opponent={null}
      onClose={onClose}
      background="bg-gradient-to-b from-sky-400 via-amber-800 to-[#451a03]"
      dataAttrs={{ 'data-phase': phase, 'data-level': ui.level + 1, 'data-money': ui.money, 'data-cleared': cleared }}
    >
      <div className="relative z-10 flex items-center justify-between gap-2 px-3 py-1.5 bg-black/45 text-white">
        <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-xs font-black">Cửa {ui.level + 1}/{LEVELS.length}</span>
        <span className={`text-sm font-black tabular-nums ${reached ? 'text-emerald-300' : 'text-amber-200'}`} data-testid="miner-money">
          💰 {ui.money} / {ui.target}
        </span>
        <span key={lowTime ? ui.time : 't'} className={`text-sm font-black tabular-nums ${lowTime ? 'text-rose-300 score-bump' : 'text-white'}`} data-testid="miner-time">
          ⏱ {ui.time}s
        </span>
      </div>
      <div className="relative flex-1 min-h-0 flex items-start justify-center overflow-hidden touch-none" onPointerDown={shoot} data-testid="miner-stage">
        <canvas ref={canvasRef} className="max-w-full max-h-full" style={{ aspectRatio: `${W} / ${H}`, width: '100%', height: 'auto' }} />
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            boom();
          }}
          disabled={!ui.canBlast}
          aria-label={`Thuốc nổ (còn ${ui.dynamite})`}
          className={`absolute right-3 bottom-3 w-16 h-16 rounded-full flex flex-col items-center justify-center border-4 shadow-xl transition-all ${ui.canBlast ? 'bg-gradient-to-b from-red-500 to-orange-600 border-yellow-300 scale-110 animate-pulse' : 'bg-slate-700/80 border-white/30 opacity-70'}`}
          data-testid="miner-dynamite"
        >
          <span className="text-2xl leading-none">🧨</span>
          <span className="text-[11px] font-black text-white">×{ui.dynamite}</span>
        </button>
        {phase === 'intro' && (
          <div key={ui.level} className="pop-in absolute inset-x-6 top-[30%] rounded-3xl bg-black/65 px-4 py-4 text-center text-white pointer-events-none" data-testid="miner-intro">
            <p className="text-3xl font-black text-amber-300">Cửa {ui.level + 1}</p>
            <p className="mt-1 text-lg font-black">Mục tiêu: 💰 {ui.target}</p>
            <p className="mt-1 text-xs font-bold text-white/80">Chạm màn hình để thả móc. Đá nặng thì dùng 🧨!</p>
          </div>
        )}
        {phase === 'clear' && (
          <div className="pop-in absolute inset-x-6 top-[30%] rounded-3xl bg-emerald-950/85 border-2 border-emerald-300 px-4 py-4 text-center text-white" data-testid="miner-clear">
            <p className="text-3xl font-black text-emerald-300">Qua cửa {ui.level + 1}! ⭐</p>
            <p className="mt-1 text-sm font-bold">Được thêm 1 🧨. Cửa sau khó hơn nhé!</p>
            <button onClick={goNext} className="mt-3 px-6 py-3 rounded-2xl bg-amber-400 text-slate-900 text-lg font-black shadow-lg active:scale-95">
              Cửa tiếp theo ➜
            </button>
          </div>
        )}
        <Banner banner={banner} />
        {phase === 'done' && (
          <MatchResult
            result={minerResult(cleared)}
            headline={cleared >= LEVELS.length ? 'Qua hết 5 cửa! 🏆' : `Qua ${cleared}/${LEVELS.length} cửa`}
            detail={`Đào được 💰 ${ui.money}`}
            player={player}
            opponent={null}
            onReplay={replay}
            onClose={onClose}
            onBerries={onBerries}
            onGold={onGold}
          />
        )}
      </div>
    </SportsShell>
  );
}
