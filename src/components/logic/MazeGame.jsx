import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Lightbulb, Lock, Map as MapIcon, RotateCcw } from 'lucide-react';
import { MAZE_LEVELS, MAZE_WORLDS, createMazeLevel, slide, shortestPath, mazeStars, swipeDirection, cellAt } from '../../utils/logic/maze';
import { getProgress, recordStars, isUnlocked, goldForLevel, totalStars } from '../../utils/progress';
import { sounds } from '../../utils/soundEffects';
import { KidGameShell, StarRow, GoldReward } from '../kidgames/Common';
import { useLoop, useLater, useCanvas, loadImage, drawSprite, drawPokeball, burst, updateParticles } from '../sports/sportsKit';

const W = 340;
const H = 440;
const SPEED = 6; // cells per second while walking
const HINT_TIME = 3;
const GAME = 'maze';

// Look of each world: background, path and walls (shadow, body, highlight)
const THEMES = {
  garden: { bg: ['#bbf7d0', '#4ade80'], dots: ['#f9a8d4', '#fde047', '#ffffff'], path: '#fef3c7', tile: 'rgba(251, 191, 36, 0.12)', walls: ['rgba(0,0,0,0.18)', '#166534', '#22c55e'], shell: 'bg-gradient-to-b from-emerald-200 via-lime-100 to-emerald-200', pad: 'from-emerald-400 to-green-600 border-green-800' },
  forest: { bg: ['#4ade80', '#14532d'], dots: ['#fca5a5', '#fde68a', '#bbf7d0'], path: '#e7d3a8', tile: 'rgba(120, 53, 15, 0.12)', walls: ['rgba(0,0,0,0.28)', '#14532d', '#15803d'], shell: 'bg-gradient-to-b from-green-300 via-emerald-200 to-green-400', pad: 'from-green-500 to-emerald-800 border-emerald-950' },
  castle: { bg: ['#e0f2fe', '#7dd3fc'], dots: ['#ffffff', '#e0f2fe', '#bae6fd'], path: '#f8fafc', tile: 'rgba(56, 189, 248, 0.12)', walls: ['rgba(15,23,42,0.25)', '#1e40af', '#93c5fd'], shell: 'bg-gradient-to-b from-sky-200 via-slate-100 to-sky-300', pad: 'from-sky-400 to-blue-700 border-blue-900' },
};

function layout(maze) {
  const cell = Math.floor(Math.min((W - 24) / maze.w, (H - 24) / maze.h));
  return { cell, ox: (W - cell * maze.w) / 2, oy: (H - cell * maze.h) / 2 };
}

function drawGround(ctx, maze, geo, time, theme) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, theme.bg[0]);
  bg.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = theme.dots[i % 3];
    ctx.beginPath();
    ctx.arc((i * 97) % W, ((i * 53 + 17) % H) + Math.sin(time * 2 + i) * 0.8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const { cell, ox, oy } = geo;
  ctx.fillStyle = theme.path;
  ctx.beginPath();
  ctx.roundRect(ox - 4, oy - 4, cell * maze.w + 8, cell * maze.h + 8, 14);
  ctx.fill();
  ctx.fillStyle = theme.tile;
  for (let y = 0; y < maze.h; y++) for (let x = 0; x < maze.w; x++) if ((x + y) % 2) ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
}

function drawWalls(ctx, maze, geo, theme) {
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
  [[theme.walls[0], 0.26, 3], [theme.walls[1], 0.24, 0], [theme.walls[2], 0.13, -1.5]].forEach(([color, width, dy]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(4, cell * width);
    ctx.beginPath();
    for (const [a, b, c, d] of segments) {
      ctx.moveTo(a, b + dy);
      ctx.lineTo(c, d + dy);
    }
    ctx.stroke();
  });
  ctx.lineCap = 'butt';
}

const PAD_LABELS = { up: 'Lên', down: 'Xuống', left: 'Trái', right: 'Phải' };
function Pad({ dir, Icon, onGo, colors }) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onGo(dir);
      }}
      aria-label={PAD_LABELS[dir]}
      className={`w-14 h-14 rounded-2xl bg-gradient-to-b ${colors} text-white shadow-lg border-b-4 flex items-center justify-center active:scale-90`}
    >
      <Icon className="w-7 h-7" />
    </button>
  );
}

const center = (geo, p) => ({ x: geo.ox + (p.x + 0.5) * geo.cell, y: geo.oy + (p.y + 0.5) * geo.cell });
const worldOf = (index) => MAZE_LEVELS[index].world;

/** Map of the 9 mazes in 3 worlds: stars won, locked ones, and the next one to play. */
function LevelMap({ progress, onPlay }) {
  const next = MAZE_LEVELS.findIndex((l, i) => isUnlocked(MAZE_LEVELS, progress, i) && !progress[l.id]);
  return (
    <div className="px-4 pt-3 pb-5 space-y-3" data-testid="maze-map">
      <div className="flex items-center justify-between">
        <p className="text-xl font-black text-emerald-900">Chọn mê cung</p>
        <span className="px-3 py-1 rounded-full bg-white/80 text-sm font-black text-amber-600">⭐ {totalStars(progress)}/{MAZE_LEVELS.length * 3}</span>
      </div>
      {MAZE_WORLDS.map((world) => (
        <section key={world.id} className="rounded-3xl bg-white/60 p-3 shadow-inner" aria-label={world.name}>
          <p className="text-sm font-black text-emerald-900">
            {world.emoji} {world.name}
            {world.id === 'castle' && <span className="ml-1 text-xs font-bold text-sky-700">(tìm chìa khóa 🔑 trước!)</span>}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {MAZE_LEVELS.map((level, i) => {
              if (level.world !== world.id) return null;
              const open = isUnlocked(MAZE_LEVELS, progress, i);
              const stars = progress[level.id] || 0;
              return (
                <button
                  key={level.id}
                  onClick={() => open && onPlay(i)}
                  disabled={!open}
                  aria-label={open ? `Mê cung ${i + 1}` : `Mê cung ${i + 1} (chưa mở)`}
                  className={`pop-in relative flex flex-col items-center gap-1 p-2 rounded-2xl ${open ? 'bg-white shadow-lg active:scale-95' : 'bg-slate-200/70'} ${i === next ? 'ring-4 ring-amber-300 hint-pulse' : ''}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <span className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black ${open ? 'bg-gradient-to-b from-emerald-400 to-green-600 text-white' : 'bg-slate-300 text-slate-500'}`}>
                    {open ? i + 1 : <Lock className="w-5 h-5" />}
                  </span>
                  <StarRow stars={stars} size="w-4 h-4" />
                  <span className="text-[10px] font-bold text-slate-500">
                    {level.w}×{level.h}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * "Pokémon thoát mê cung": 9 mazes in 3 worlds. Swipe (or arrows) to walk the Pokemon to
 * the Pokeball; it follows bends and stops at crossings. In the ice castle the Pokeball is
 * locked until the key is found. Stars and the next maze are unlocked level by level.
 */
export function MazeGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [progress, setProgress] = useState(() => getProgress(GAME));
  const [screen, setScreen] = useState('map'); // map | play
  const [ui, setUi] = useState({ levelIndex: 0, collected: 0, hasKey: true, result: null });
  const [banner, setBanner] = useState(null);
  const game = useRef(null);
  const later = useLater();
  const img = loadImage(player.image);

  const say = (text) => setBanner((b) => ({ id: (b?.id || 0) + 1, text }));

  const start = (index) => {
    const level = createMazeLevel(index, random);
    game.current = { level, walk: [], from: level.pos, t: 0, facing: 1, trail: [], particles: [], hint: 0, nextDir: null, time: 0, celebrating: false, lastCollected: 0, hadKey: level.hasKey };
    setUi({ levelIndex: index, collected: 0, hasKey: level.hasKey, result: null });
    setBanner(null);
    setScreen('play');
    if (level.key) later(() => say('Tìm chìa khóa 🔑 trước nhé!'), 400);
  };

  const go = (dir) => {
    const s = game.current;
    if (!s || s.celebrating || s.level.done) return;
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

  const finishLevel = () => {
    const s = game.current;
    const stars = mazeStars(s.level.steps, s.level.shortest);
    const { improved, progress: next } = recordStars(GAME, MAZE_LEVELS[s.level.level].id, stars);
    const gold = goldForLevel(stars, improved);
    onGold?.(gold);
    setProgress(next);
    setUi((u) => ({ ...u, result: { stars, gold, improved } }));
  };

  const arrive = () => {
    const s = game.current;
    const geo = layout(s.level.maze);
    const p = center(geo, s.level.pos);
    if (s.level.collected > s.lastCollected) {
      s.lastCollected = s.level.collected;
      burst(s.particles, p.x, p.y, { count: 16, colors: ['#60a5fa', '#bfdbfe', '#ffffff'], speed: 110, size: 3 });
      sounds.playMunch();
      say('+1 quả mọng! 🫐');
      setUi((u) => ({ ...u, collected: s.level.collected }));
    }
    if (s.level.hasKey && !s.hadKey) {
      s.hadKey = true;
      burst(s.particles, p.x, p.y, { count: 26, colors: ['#fde047', '#facc15', '#ffffff'], speed: 160 });
      sounds.playSuccessFanfare();
      say('Có chìa khóa rồi! 🔑');
      setUi((u) => ({ ...u, hasKey: true }));
    }
    if (s.level.locked) {
      sounds.playOops();
      say('Pokéball bị khóa! Tìm chìa khóa 🔑');
    }
    if (s.level.done) {
      s.celebrating = true;
      burst(s.particles, p.x, p.y, { count: 30, speed: 180 });
      sounds.playSuccessFanfare();
      say('Thoát rồi! 🎉');
      try {
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.45 }, zIndex: 9999 });
      } catch {
        // decoration
      }
      later(finishLevel, 1200);
      return;
    }
    if (s.nextDir) {
      const d = s.nextDir;
      s.nextDir = null;
      go(d);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
      if (dir && screen === 'play') {
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
    if (!s) return;
    s.time += dt;
    s.hint = Math.max(0, s.hint - dt);
    const { maze } = s.level;
    const geo = layout(maze);
    const theme = THEMES[worldOf(s.level.level)];

    let pos;
    if (s.walk.length) {
      s.t += dt * SPEED;
      while (s.t >= 1 && s.walk.length) {
        s.t -= 1;
        s.from = s.walk.shift();
        s.trail.push({ ...s.from });
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
    drawGround(ctx, maze, geo, s.time, theme);

    for (const t of s.trail) {
      const p = center(geo, t);
      ctx.fillStyle = 'rgba(180, 83, 9, 0.28)';
      ctx.beginPath();
      ctx.arc(p.x - geo.cell * 0.1, p.y + geo.cell * 0.08, geo.cell * 0.06, 0, Math.PI * 2);
      ctx.arc(p.x + geo.cell * 0.1, p.y - geo.cell * 0.08, geo.cell * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hint: golden dotted path (to the key first when it is still missing)
    if (s.hint > 0) {
      const from = s.walk.length ? s.walk[s.walk.length - 1] : s.level.pos;
      const route = shortestPath(maze, from, s.level.hasKey ? maze.goal : s.level.key);
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

    // Goal: glowing Pokeball (locked with a padlock until the key is found)
    const g = center(geo, maze.goal);
    const open = s.level.hasKey;
    const glow = ctx.createRadialGradient(g.x, g.y, 2, g.x, g.y, geo.cell * 0.8);
    glow.addColorStop(0, open ? `rgba(253, 224, 71, ${0.7 + Math.sin(s.time * 4) * 0.2})` : 'rgba(148, 163, 184, 0.35)');
    glow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(g.x - geo.cell, g.y - geo.cell, geo.cell * 2, geo.cell * 2);
    drawPokeball(ctx, g.x, g.y - (open ? Math.abs(Math.sin(s.time * 3)) * geo.cell * 0.12 : 0), geo.cell * 0.3, open ? Math.sin(s.time * 3) * 0.3 : 0);
    if (!open) {
      ctx.font = `${Math.round(geo.cell * 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🔒', g.x + geo.cell * 0.22, g.y + geo.cell * 0.3);
    }

    // The key, bobbing and sparkling
    if (s.level.key && !s.level.hasKey) {
      const k = center(geo, s.level.key);
      const ky = k.y + Math.sin(s.time * 4) * 3;
      const kg = ctx.createRadialGradient(k.x, ky, 1, k.x, ky, geo.cell * 0.55);
      kg.addColorStop(0, 'rgba(253, 224, 71, 0.8)');
      kg.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = kg;
      ctx.fillRect(k.x - geo.cell, ky - geo.cell, geo.cell * 2, geo.cell * 2);
      ctx.font = `${Math.round(geo.cell * 0.55)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔑', k.x, ky);
      ctx.textBaseline = 'alphabetic';
    }

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

    drawWalls(ctx, maze, geo, theme);

    const walking = s.walk.length > 0;
    const hop = walking ? Math.abs(Math.sin(s.time * 16)) * geo.cell * 0.12 : s.celebrating ? Math.abs(Math.sin(s.time * 8)) * geo.cell * 0.4 : Math.sin(s.time * 3) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y + geo.cell * 0.38, geo.cell * 0.3, geo.cell * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    drawSprite(ctx, img, pos.x, pos.y - hop, geo.cell * 1.2, { flip: s.facing < 0 });
    updateParticles(ctx, s.particles, dt);
  }, screen === 'play' && !ui.result);

  const index = ui.levelIndex;
  const level = MAZE_LEVELS[index];
  const theme = THEMES[level.world];
  const hasNext = index + 1 < MAZE_LEVELS.length;

  return (
    <KidGameShell
      title="🌿 Thoát mê cung"
      label="Pokémon thoát mê cung"
      round={screen === 'map' ? 0 : index}
      rounds={MAZE_LEVELS.length}
      onClose={onClose}
      background={screen === 'map' ? THEMES.garden.shell : theme.shell}
      dataAttrs={{ 'data-screen': screen, 'data-level': index, 'data-won': !!ui.result, 'data-collected': ui.collected, 'data-key': ui.hasKey }}
    >
      {screen === 'map' ? (
        <LevelMap progress={progress} onPlay={start} />
      ) : (
        <div className="px-3 pt-2 pb-4 flex flex-col items-center gap-2">
          <div className="w-full flex items-center justify-between gap-2 text-sm font-black text-slate-800">
            <button onClick={() => setScreen('map')} className="px-2.5 py-1 rounded-full bg-white/80 shadow flex items-center gap-1" aria-label="Bản đồ mê cung">
              <MapIcon className="w-4 h-4" /> {index + 1}/{MAZE_LEVELS.length}
            </button>
            <span className="flex items-center gap-2">
              🫐 {ui.collected}/{level.berries}
              {level.key && <span className={ui.hasKey ? '' : 'opacity-40 grayscale'} aria-label={ui.hasKey ? 'Đã có chìa khóa' : 'Chưa có chìa khóa'}>🔑</span>}
            </span>
            <button onClick={() => { if (game.current) game.current.hint = HINT_TIME; sounds.playPop(); }} className="px-3 py-1 rounded-full bg-amber-400 text-white shadow flex items-center gap-1 active:scale-95" aria-label="Gợi ý đường đi">
              <Lightbulb className="w-4 h-4" /> Gợi ý
            </button>
          </div>
          <div className="relative w-full touch-none" onPointerDown={onDown} onPointerUp={onUp} data-testid="maze-stage">
            <canvas ref={canvasRef} data-testid="maze-canvas" className="w-full h-auto rounded-3xl shadow-xl" style={{ aspectRatio: `${W} / ${H}` }} />
            {banner && (
              <div key={banner.id} className="banner-slam sport-banner absolute left-1/2 top-[42%] text-3xl font-black text-amber-300 whitespace-nowrap pointer-events-none">
                {banner.text}
              </div>
            )}
            {ui.result && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 rounded-3xl" data-testid="maze-result">
                <div className="pop-in mx-4 p-5 rounded-3xl bg-white shadow-2xl flex flex-col items-center gap-3 text-center">
                  <p className="text-2xl font-black text-emerald-700">Thoát mê cung {index + 1}! 🎉</p>
                  <StarRow stars={ui.result.stars} size="w-10 h-10" animate />
                  <GoldReward amount={ui.result.gold} />
                  {!ui.result.improved && <p className="text-xs font-bold text-slate-500">Chơi lại: phá kỷ lục sao để nhận nhiều vàng hơn!</p>}
                  <div className="flex flex-wrap justify-center gap-2">
                    <button onClick={() => start(index)} className="px-4 py-2.5 rounded-2xl bg-slate-200 text-slate-700 font-black flex items-center gap-1 active:scale-95">
                      <RotateCcw className="w-4 h-4" /> Chơi lại
                    </button>
                    <button onClick={() => setScreen('map')} className="px-4 py-2.5 rounded-2xl bg-sky-500 text-white font-black flex items-center gap-1 active:scale-95">
                      <MapIcon className="w-4 h-4" /> Bản đồ
                    </button>
                    {hasNext && (
                      <button onClick={() => start(index + 1)} className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black shadow-lg active:scale-95">
                        Màn tiếp theo ➜
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs font-bold text-slate-700/80">Vuốt trên mê cung hoặc bấm mũi tên để đi tới quả Pokéball ✨</p>
          <div className="grid grid-cols-3 gap-1.5" data-testid="maze-pad">
            <span />
            <Pad dir="up" Icon={ArrowUp} onGo={go} colors={theme.pad} />
            <span />
            <Pad dir="left" Icon={ArrowLeft} onGo={go} colors={theme.pad} />
            <Pad dir="down" Icon={ArrowDown} onGo={go} colors={theme.pad} />
            <Pad dir="right" Icon={ArrowRight} onGo={go} colors={theme.pad} />
          </div>
        </div>
      )}
    </KidGameShell>
  );
}
