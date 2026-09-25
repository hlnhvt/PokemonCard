import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Star, Heart, ArrowDown, Hand } from 'lucide-react';
import {
  WORLD,
  SPEED,
  PORTRAIT_SPEED,
  LIVES,
  GROUND_POKEMON,
  FLYING_POKEMON,
  createRunner,
  start,
  step,
  jump,
  releaseJump,
  cancelJump,
  setDuck,
  score,
  starsForScore,
} from '../utils/runnerGame';
import { drawRunner } from '../utils/runnerDraw';
import { artworkUrl } from '../services/pokemonOnlineService';
import { sounds } from '../utils/soundEffects';
import { playCry } from '../utils/cries';
import { BERRY_TYPES } from '../utils/friendship';
import { BerryIcon } from './BerryIcon';

const BEST_KEY = 'pokescan_runner_best';
// World units visible across a portrait phone (zoomed in from 600 so sprites are large)
const PORTRAIT_VIEW_WIDTH = 340;

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // ignore
  }
}

function loadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img;
}

/**
 * "Pokemon runner": Chrome's offline dino game with the child's Pokemon as the runner.
 * Tap / Space / Up to jump (hold for a higher jump), Down or the CÚI button to duck.
 */
export function RunnerGame({ pokemon, image, onClose, onBerries, random = Math.random }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  // Portrait phones zoom in, so they also run on the slower speed profile
  const isPortraitScreen = () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth && window.innerWidth < 560;
  const newGame = () => createRunner({ random, speed: isPortraitScreen() ? PORTRAIT_SPEED : SPEED });
  const [initialGame] = useState(newGame);
  const gameRef = useRef(initialGame);
  const assetsRef = useRef({ player: null, pokemon: new Map() });
  const viewRef = useRef({ width: WORLD.width });
  const [hud, setHud] = useState({ status: 'ready', score: 0, lives: LIVES, berries: 0 });
  const [best, setBest] = useState(readBest);
  const [newBest, setNewBest] = useState(false);
  const [portrait, setPortrait] = useState(false);

  // Load the runner and obstacle Pokemon images once
  useEffect(() => {
    const assets = assetsRef.current;
    assets.player = image ? loadImage(image) : null;
    for (const p of [...GROUND_POKEMON, ...FLYING_POKEMON]) {
      if (!assets.pokemon.has(p.id)) assets.pokemon.set(p.id, loadImage(artworkUrl(p.id)));
    }
  }, [image]);

  // Fit the canvas to its container at device resolution
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const available = wrap.clientWidth || WORLD.width;
    const viewportHeight = window.innerHeight || 800;
    const isPortrait = viewportHeight > (window.innerWidth || 0) && available < 520;
    // Portrait phones zoom in (400 of the 600 world units across, the right edge where
    // obstacles enter is cropped) and get a tall canvas: extra sky is shown above the scene
    const visibleWidth = isPortrait ? PORTRAIT_VIEW_WIDTH : WORLD.width;
    // Short (landscape phone) screens: keep the HUD on screen
    const maxHeight = Math.max(140, viewportHeight - 130);
    const scale = Math.min(available / visibleWidth, maxHeight / WORLD.height);
    const cssWidth = Math.min(available, visibleWidth * scale);
    const cssHeight = isPortrait
      ? Math.max(WORLD.height * scale, Math.min(cssWidth * 0.85, viewportHeight * 0.55))
      : WORLD.height * scale;
    // Shift the world down so the ground stays at the bottom of a taller canvas
    const extraTop = cssHeight / scale - WORLD.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.getContext?.('2d')?.setTransform(scale * dpr, 0, 0, scale * dpr, 0, extraTop * scale * dpr);
    viewRef.current = { width: visibleWidth };
    setPortrait(isPortrait);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  const finish = useCallback(
    (finalScore) => {
      if (finalScore > best) {
        setBest(finalScore);
        setNewBest(true);
        saveBest(finalScore);
      }
      playCry(pokemon);
    },
    [best, pokemon]
  );

  // Put the berries picked up in this run into the child's bag (once per run)
  const onBerriesRef = useRef(onBerries);
  useEffect(() => {
    onBerriesRef.current = onBerries;
  }, [onBerries]);
  const awardBerries = useCallback((game) => {
    if (game.awarded) return;
    game.awarded = true;
    const total = BERRY_TYPES.reduce((sum, t) => sum + (game.collected[t] || 0), 0);
    if (total > 0) onBerriesRef.current?.({ ...game.collected });
  }, []);
  // Closing mid-run must not lose berries
  useEffect(() => () => awardBerries(gameRef.current), [awardBerries]);

  // Game loop
  useEffect(() => {
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(() => cb(performance.now()), 16));
    const caf = window.cancelAnimationFrame || clearTimeout;
    let id;
    let last = null;
    let lastHud = 0;

    const frame = (now) => {
      const game = gameRef.current;
      const dt = last == null ? 16 : now - last;
      last = now;
      step(game, dt);

      for (const event of game.events) {
        if (event === 'jump') sounds.playJump();
        else if (event === 'hit') sounds.playPop();
        else if (event === 'berry' || event === 'milestone') sounds.playScanBeep();
        else if (event === 'gameover') {
          finish(score(game));
          awardBerries(game);
        }
      }
      game.events = [];

      const ctx = canvasRef.current?.getContext?.('2d');
      if (ctx) drawRunner(ctx, game, assetsRef.current, viewRef.current);

      // Update the DOM overlay ~10 times a second, or immediately on state changes
      if (now - lastHud > 100 || game.status !== hud.status || game.lives !== hud.lives) {
        lastHud = now;
        const berries = BERRY_TYPES.reduce((sum, t) => sum + (game.collected[t] || 0), 0);
        const pose = !game.player.onGround ? 'jump' : game.player.ducking ? 'duck' : 'run';
        setHud((h) =>
          h.status === game.status && h.lives === game.lives && h.score === score(game) && h.berries === berries && h.pose === pose
            ? h
            : { status: game.status, score: score(game), lives: game.lives, berries, pose }
        );
      }
      id = raf(frame);
    };
    id = raf(frame);
    return () => caf(id);
  }, [finish, awardBerries, hud.status, hud.lives]);

  const press = useCallback(() => {
    const game = gameRef.current;
    if (game.status === 'ready') start(game);
    if (game.status === 'running') jump(game);
  }, []);
  const release = useCallback(() => releaseJump(gameRef.current), []);
  const duck = useCallback((on) => {
    const game = gameRef.current;
    if (game.status === 'running') setDuck(game, on);
  }, []);

  const restart = () => {
    awardBerries(gameRef.current);
    gameRef.current = newGame();
    setNewBest(false);
    setHud({ status: 'ready', score: 0, lives: LIVES, berries: 0 });
  };

  // Keyboard: Space / Up / W jump, Down / S duck, Escape closes
  useEffect(() => {
    const down = (e) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) press();
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        duck(true);
      } else if (e.code === 'Escape') {
        onClose?.();
      }
    };
    const up = (e) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) release();
      else if (['ArrowDown', 'KeyS'].includes(e.code)) duck(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [press, release, duck, onClose]);

  // Touch gestures anywhere on screen: tap = jump (hold = higher), swipe down = duck
  const gestureRef = useRef(null);
  const SWIPE_DOWN_PX = 30;
  const onPointerDown = (e) => {
    if (e.target.closest?.('button')) return; // close / replay buttons keep working
    e.preventDefault();
    gestureRef.current = { id: e.pointerId, y: e.clientY, ducking: false };
    press();
  };
  const onPointerMove = (e) => {
    const g = gestureRef.current;
    if (!g || g.id !== e.pointerId || g.ducking) return;
    if (e.clientY - g.y > SWIPE_DOWN_PX) {
      g.ducking = true;
      cancelJump(gameRef.current); // the touch that started the swipe already jumped
      duck(true);
    }
  };
  const onPointerEnd = (e) => {
    const g = gestureRef.current;
    if (!g || g.id !== e.pointerId) return;
    gestureRef.current = null;
    release();
    if (g.ducking) duck(false);
  };

  const stars = starsForScore(hud.score);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-3 select-none touch-none"
      role="dialog"
      aria-label="Trò chơi Pokémon chạy nhảy"
      data-status={hud.status}
      data-score={hud.score}
      data-lives={hud.lives}
      data-pose={hud.pose || 'run'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div className="w-full max-w-3xl max-h-full overflow-hidden rounded-3xl border-4 border-white/80 shadow-2xl bg-sky-100">
        {/* HUD */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white/80">
          <div className="flex items-center gap-1" aria-label={`Còn ${hud.lives} mạng`}>
            {Array.from({ length: LIVES }).map((_, i) => (
              <Heart key={i} className={`w-7 h-7 ${i < hud.lives ? 'fill-rose-500 text-rose-500' : 'text-gray-300'}`} />
            ))}
          </div>
          <div className="flex items-center gap-1 text-base font-black text-sky-900" aria-label={`Nhặt được ${hud.berries} quả mọng`}>
            <BerryIcon type="oran" className="w-5 h-5" /> x{hud.berries}
          </div>
          <div className="text-right leading-tight">
            <div className="text-2xl font-black text-sky-900 font-tech tabular-nums" aria-label="Điểm">
              {String(hud.score).padStart(5, '0')}
            </div>
            <div className="text-xs font-bold text-sky-700">Kỷ lục {best}</div>
          </div>
          <button onClick={onClose} aria-label="Đóng trò chơi" className="p-2 rounded-full bg-white text-sky-900 hover:bg-sky-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div ref={wrapRef} className="relative cursor-pointer">
          <canvas ref={canvasRef} className="block mx-auto" data-testid="runner-canvas" />

          {hud.status === 'ready' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/40 text-center px-4">
              <p className="text-2xl sm:text-3xl font-black text-sky-900">Chạy cùng {pokemon.name}!</p>
              <div className="flex flex-col gap-2 text-base sm:text-lg font-bold text-sky-900">
                <span className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-white/80">
                  <Hand className="w-6 h-6 text-rose-500" /> Chạm màn hình để nhảy (giữ lâu nhảy cao)
                </span>
                <span className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-white/80">
                  <ArrowDown className="w-6 h-6 text-sky-600" /> Vuốt xuống để cúi
                </span>
              </div>
              {portrait && <p className="text-sm font-bold text-sky-700">📱 Mẹo: xoay ngang điện thoại để chơi to hơn</p>}
            </div>
          )}

          {hud.status === 'over' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 sm:gap-1.5 bg-white/85 text-center px-3">
              <p className="text-2xl sm:text-3xl font-black text-sky-900 leading-tight">Kết thúc!</p>
              <div className="flex gap-1" aria-label={`${stars} sao`}>
                {[0, 1, 2].map((i) => (
                  <Star key={i} className={`w-8 h-8 ${i < stars ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`} />
                ))}
              </div>
              <p className="text-base sm:text-lg font-bold text-sky-900 leading-snug">
                {pokemon.name} chạy được <strong>{hud.score}</strong> điểm{newBest ? ' — Kỷ lục mới! 🎉' : ''}
              </p>
              {hud.berries > 0 && (
                <p className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                  <BerryIcon type="razz" className="w-4 h-4" /> Nhặt được {hud.berries} quả mọng, đã cất vào túi để cho Pokémon ăn!
                </p>
              )}
              <div className="flex gap-2 mt-1">
                <button onClick={restart} className="px-5 py-3 rounded-2xl bg-red-500 hover:bg-red-400 text-white text-lg font-black flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" /> Chơi lại
                </button>
                <button onClick={onClose} className="px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-lg font-black">
                  Xong
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Gesture reminder instead of buttons */}
        <div className="flex items-center justify-center gap-4 px-3 py-2 bg-white/80 text-sm font-bold text-sky-800">
          <span className="flex items-center gap-1"><Hand className="w-4 h-4" /> Chạm: nhảy</span>
          <span className="flex items-center gap-1"><ArrowDown className="w-4 h-4" /> Vuốt xuống: cúi</span>
        </div>
      </div>
    </div>,
    document.body
  );
}