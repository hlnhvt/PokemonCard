import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react';
import { MAZE_LEVELS, createMazeLevel, slide, shortestPath, mazeStars, swipeDirection, cellAt } from '../../utils/logic/maze';
import { goldForStars } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { KidGameShell, SessionSummary, StarRow } from '../kidgames/Common';
import { useLoop, useLater, useCanvas, loadImage, drawSprite, drawPokeball, burst, updateParticles } from '../sports/sportsKit';

const W = 340;
const H = 440;
const SPEED = 6; // cells per second while walking
const HINT_TIME = 3;

function layout(maze) {
  const cell = Math.floor(Math.min((W - 24) / maze.w, (H - 24) / maze.h));
  return { cell, ox: (W - cell * maze.w) / 2, oy: (H - cell * maze.h) / 2 };
}

function drawGarden(ctx, maze, geo, time) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#bbf7d0');
  bg.addColorStop(1, '#4ade80');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Little flowers in the grass (fixed places)
  for (let i = 0; i < 26; i++) {
    const x = (i * 97) % W;
    const y = (i * 53 + 17) % H;
    ctx.fillStyle = ['#f9a8d4', '#fde047', '#ffffff'][i % 3];
    ctx.beginPath();
    ctx.arc(x, y + Math.sin(time * 2 + i) * 0.8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const { cell, ox, oy } = geo;
  // Sandy path
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.roundRect(ox - 4, oy - 4, cell * maze.w + 8, cell * maze.h + 8, 14);
  ctx.fill();
  for (let y = 0; y < maze.h; y++) {
    for (let x = 0; x < maze.w; x++) {
      if ((x + y) % 2) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }
  }
}

function drawHedges(ctx, maze, geo) {
  const { cell, ox, oy } = geo;
  const segments = [];
  for (let y = 0; y < maze.h; y++) {
    for (let x = 0; x < maze.w; x++) {
      const c = cellAt(maze, x, y);
      const x0 = ox + x * cell;
      const y0 = oy + y * cell;
      if (c.n) segments.push([x0, y0, x0 + cell, y0]);
      if (c.w) segments.push([x0, y0, x0, y0 + cell]);
      if (x === maze.w - 1 && c.e) segments.push([x0 + cell, y0, x0 + cell, y0 + cell]);
      if (y === maze.h - 1 && c.s) segments.push([x0, y0 + cell, x0 + cell, y0 + cell]);
    }
  }
  ctx.lineCap = 'round';
  // Shadow, dark hedge, then a lighter top so the walls look like bushes
  for (const [color, width, dy] of [['rgba(0,0,0,0.18)', 0.26, 3], ['#166534', 0.24, 0], ['#22c55e', 0.13, -1.5]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(4, cell * width);
    ctx.beginPath();
    for (const [a, b, c, d] of segments) {
      ctx.moveTo(a, b + dy);
      ctx.lineTo(c, d + dy);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

const PAD_LABELS = { up: 'Lên', down: 'Xuống', left: 'Trái', right: 'Phải' };
function Pad({ dir, Icon, onGo }) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onGo(dir);
      }}
      aria-label={PAD_LABELS[dir]}
      className="w-14 h-14 rounded-2xl bg-gradient-to-b from-emerald-400 to-green-600 text-white shadow-lg border-b-4 border-green-800 flex items-center justify-center active:scale-90"
    >
      <Icon className="w-7 h-7" />
    </button>
  );
}

const center = (geo, p) => ({ x: geo.ox + (p.x + 0.5) * geo.cell, y: geo.oy + (p.y + 0.5) * geo.cell });

/**
 * "Pokémon thoát mê cung": swipe (or use the arrows) to walk the Pokemon along the garden
 * paths to the Pokeball. It keeps walking round bends and stops at crossings. Berries on
 * dead ends are a bonus. 3 mazes, bigger each time.
 */
export function MazeGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [initial] = useState(() => ({ level: createMazeLevel(0, random) }));
  const game = useRef({ ...initial, walk: [], from: initial.level.pos, t: 0, facing: 1, trail: [], particles: [], hint: 0, nextDir: null, time: 0, celebrating: false });
  const [ui, setUi] = useState({ levelIndex: 0, collected: 0, berries: MAZE_LEVELS[0].berries, levelStars: [], won: false, done: false });
  const [banner, setBanner] = useState(null);
  const paid = useRef(false);
  const later = useLater();
  const img = loadImage(player.image);

  const sync = (patch = {}) => {
    const s = game.current;
    setUi((u) => ({ ...u, collected: s.level.collected, ...patch }));
  };

  const go = (dir) => {
    const s = game.current;
    if (s.celebrating || s.level.done) return;
    if (s.walk.length) {
      s.nextDir = dir; // remember one move made while walking
      return;
    }
    const before = s.level;
    const { state, path } = slide(before, dir);
    if (!path.length) {
      sounds.playOops();
      return;
    }
    s.level = state;
    s.walk = path;
    s.from = before.pos;
    s.t = 0;
    if (dir === 'left') s.facing = -1;
    if (dir === 'right') s.facing = 1;
    sounds.playWhoosh();
  };

  const arrive = () => {
    const s = game.current;
    const geo = layout(s.level.maze);
    if (s.level.collected > (s.lastCollected || 0)) {
      s.lastCollected = s.level.collected;
      const p = center(geo, s.level.pos);
      burst(s.particles, p.x, p.y, { count: 16, colors: ['#60a5fa', '#bfdbfe', '#ffffff'], speed: 110, size: 3 });
      sounds.playMunch();
      setBanner((b) => ({ id: (b?.id || 0) + 1, text: '+1 quả mọng! 🫐' }));
      sync();
    }
    if (s.level.done) {
      s.celebrating = true;
      const p = center(geo, s.level.pos);
      burst(s.particles, p.x, p.y, { count: 30, speed: 180 });
      sounds.playSuccessFanfare();
      const stars = mazeStars(s.level.steps, s.level.shortest);
      setBanner((b) => ({ id: (b?.id || 0) + 1, text: 'Thoát rồi! 🎉' }));
      try {
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.45 }, zIndex: 9999 });
      } catch {
        // decoration
      }
      s.levelStars = [...(s.levelStars || []), stars];
      setUi((u) => ({ ...u, won: true, levelStars: s.levelStars, collected: s.level.collected }));
      later(nextLevel, 2000);
      return;
    }
    if (s.nextDir) {
      const d = s.nextDir;
      s.nextDir = null;
      go(d);
    }
  };

  const nextLevel = () => {
    const s = game.current;
    const index = s.level.level + 1;
    if (index >= MAZE_LEVELS.length) {
      const avg = Math.round(s.levelStars.reduce((a, b) => a + b, 0) / s.levelStars.length);
      if (!paid.current) {
        paid.current = true;
        onGold?.(goldForStars(avg));
      }
      setUi((u) => ({ ...u, done: true }));
      return;
    }
    const level = createMazeLevel(index, random);
    Object.assign(s, { level, walk: [], from: level.pos, t: 0, trail: [], hint: 0, nextDir: null, celebrating: false, lastCollected: 0 });
    setUi((u) => ({ ...u, levelIndex: index, collected: 0, berries: MAZE_LEVELS[index].berries, won: false }));
  };

  useEffect(() => {
    const onKey = (e) => {
      const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
      if (dir) {
        e.preventDefault();
        go(dir);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const swipe = useRef(null);
  const onDown = (e) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e) => {
    if (!swipe.current) return;
    const dir = swipeDirection(e.clientX - swipe.current.x, e.clientY - swipe.current.y, 20);
    swipe.current = null;
    if (dir) go(dir);
  };

  useLoop((dt) => {
    const s = game.current;
    s.time += dt;
    s.hint = Math.max(0, s.hint - dt);
    const { maze } = s.level;
    const geo = layout(maze);

    // Walk cell by cell along the slide path
    let pos;
    if (s.walk.length) {
      s.t += dt * SPEED;
      while (s.t >= 1 && s.walk.length) {
        s.t -= 1;
        s.from = s.walk.shift();
        s.trail.push({ ...s.from, born: s.time });
        if (s.trail.length > 60) s.trail.shift();
      }
      if (!s.walk.length) {
        s.t = 0;
        pos = center(geo, s.from);
        arrive();
      } else {
        const a = center(geo, s.from);
        const b = center(geo, s.walk[0]);
        pos = { x: a.x + (b.x - a.x) * s.t, y: a.y + (b.y - a.y) * s.t };
      }
    } else {
      pos = center(geo, s.level.pos);
    }

    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawGarden(ctx, maze, geo, s.time);

    // Paw prints of the way walked
    for (const t of s.trail) {
      const p = center(geo, t);
      ctx.fillStyle = 'rgba(180, 83, 9, 0.28)';
      ctx.beginPath();
      ctx.arc(p.x - geo.cell * 0.1, p.y + geo.cell * 0.08, geo.cell * 0.06, 0, Math.PI * 2);
      ctx.arc(p.x + geo.cell * 0.1, p.y - geo.cell * 0.08, geo.cell * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hint: golden dotted path to the goal
    if (s.hint > 0) {
      const route = shortestPath(maze, s.walk.length ? s.walk[s.walk.length - 1] : s.level.pos, maze.goal);
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.hint);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = Math.max(3, geo.cell * 0.12);
      ctx.setLineDash([geo.cell * 0.15, geo.cell * 0.2]);
      ctx.lineDashOffset = -s.time * 30;
      ctx.lineCap = 'round';
      ctx.beginPath();
      route.forEach((p, i) => {
        const c = center(geo, p);
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // Goal: glowing, bouncing Pokeball
    const g = center(geo, maze.goal);
    const glow = ctx.createRadialGradient(g.x, g.y, 2, g.x, g.y, geo.cell * 0.8);
    glow.addColorStop(0, `rgba(253, 224, 71, ${0.7 + Math.sin(s.time * 4) * 0.2})`);
    glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(g.x - geo.cell, g.y - geo.cell, geo.cell * 2, geo.cell * 2);
    drawPokeball(ctx, g.x, g.y - Math.abs(Math.sin(s.time * 3)) * geo.cell * 0.12, geo.cell * 0.3, Math.sin(s.time * 3) * 0.3);

    // Berries
    for (const b of s.level.berries) {
      const c = center(geo, b);
      const y = c.y + Math.sin(s.time * 3 + b.x + b.y) * 2;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(c.x, y, geo.cell * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(c.x - geo.cell * 0.05, y - geo.cell * 0.05, geo.cell * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.ellipse(c.x + geo.cell * 0.08, y - geo.cell * 0.17, geo.cell * 0.09, geo.cell * 0.04, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    drawHedges(ctx, maze, geo);

    // The Pokemon (hops while walking, jumps for joy at the goal)
    const walking = s.walk.length > 0;
    const hop = walking ? Math.abs(Math.sin(s.time * 16)) * geo.cell * 0.12 : s.celebrating ? Math.abs(Math.sin(s.time * 8)) * geo.cell * 0.4 : Math.sin(s.time * 3) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y + geo.cell * 0.38, geo.cell * 0.3, geo.cell * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    drawSprite(ctx, img, pos.x, pos.y - hop, geo.cell * 1.2, { flip: s.facing < 0 });
    updateParticles(ctx, s.particles, dt);
  }, !ui.done);

  const replay = () => {
    paid.current = false;
    const level = createMazeLevel(0, random);
    Object.assign(game.current, { level, walk: [], from: level.pos, t: 0, trail: [], hint: 0, nextDir: null, celebrating: false, lastCollected: 0, levelStars: [] });
    setUi({ levelIndex: 0, collected: 0, berries: MAZE_LEVELS[0].berries, levelStars: [], won: false, done: false });
    setBanner(null);
  };

  const avgStars = ui.levelStars.length ? Math.round(ui.levelStars.reduce((a, b) => a + b, 0) / ui.levelStars.length) : 1;

  return (
    <KidGameShell
      title="🌿 Thoát mê cung"
      label="Pokémon thoát mê cung"
      round={ui.done ? MAZE_LEVELS.length : ui.levelIndex}
      rounds={MAZE_LEVELS.length}
      onClose={onClose}
      background="bg-gradient-to-b from-emerald-200 via-lime-100 to-emerald-200"
      dataAttrs={{ 'data-level': ui.levelIndex, 'data-won': ui.won, 'data-done': ui.done, 'data-collected': ui.collected }}
    >
      {ui.done ? (
        <SessionSummary
          title="Giỏi quá! 🏆"
          stars={avgStars}
          maxStars={3}
          gold={goldForStars(avgStars)}
          detail={`Bé đã thoát ${MAZE_LEVELS.length} mê cung!`}
          onReplay={replay}
          onClose={onClose}
        />
      ) : (
        <div className="px-3 pt-2 pb-4 flex flex-col items-center gap-2">
          <div className="w-full flex items-center justify-between text-sm font-black text-emerald-900">
            <span>Mê cung {ui.levelIndex + 1}/{MAZE_LEVELS.length}</span>
            <span className="flex items-center gap-1">🫐 {ui.collected}/{ui.berries}</span>
            <button onClick={() => { game.current.hint = HINT_TIME; sounds.playPop(); }} className="px-3 py-1 rounded-full bg-amber-400 text-white shadow flex items-center gap-1 active:scale-95" aria-label="Gợi ý đường đi">
              <Lightbulb className="w-4 h-4" /> Gợi ý
            </button>
          </div>
          <div className="relative w-full touch-none" onPointerDown={onDown} onPointerUp={onUp} data-testid="maze-stage">
            <canvas ref={canvasRef} data-testid="maze-canvas" className="w-full h-auto rounded-3xl shadow-xl" style={{ aspectRatio: `${W} / ${H}` }} />
            {banner && (
              <div key={banner.id} className="banner-slam sport-banner absolute left-1/2 top-[42%] text-4xl font-black text-amber-300 whitespace-nowrap pointer-events-none">
                {banner.text}
              </div>
            )}
            {ui.won && (
              <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
                <div className="pop-in px-4 py-2 rounded-2xl bg-white/90 shadow"><StarRow stars={ui.levelStars[ui.levelStars.length - 1]} animate /></div>
              </div>
            )}
          </div>
          <p className="text-xs font-bold text-emerald-900/70">Vuốt trên mê cung hoặc bấm mũi tên để đi tới quả Pokéball ✨</p>
          <div className="grid grid-cols-3 gap-1.5" data-testid="maze-pad">
            <span />
            <Pad dir="up" Icon={ArrowUp} onGo={go} />
            <span />
            <Pad dir="left" Icon={ArrowLeft} onGo={go} />
            <Pad dir="down" Icon={ArrowDown} onGo={go} />
            <Pad dir="right" Icon={ArrowRight} onGo={go} />
          </div>
        </div>
      )}
    </KidGameShell>
  );
}
