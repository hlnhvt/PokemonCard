import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Star, Heart, ArrowUp, ArrowDown } from 'lucide-react';
import {
  WORLD,
  LIVES,
  GROUND_POKEMON,
  FLYING_POKEMON,
  createRunner,
  start,
  step,
  jump,
  releaseJump,
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
  const [initialGame] = useState(() => createRunner({ random }));
  const gameRef = useRef(initialGame);
  const assetsRef = useRef({ player: null, pokemon: new Map() });
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
    // Narrow (portrait) screens show 480 of the 600 world units so sprites stay big enough;
    // the right edge, where obstacles enter, is simply cropped
    const visibleWidth = available < 520 ? 480 : WORLD.width;
    // Short (landscape phone) screens: keep the HUD and buttons on screen
    const maxHeight = Math.max(140, (window.innerHeight || 800) - 190);
    const scale = Math.min(available / visibleWidth, maxHeight / WORLD.height);
    const cssWidth = Math.min(available, visibleWidth * scale);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${WORLD.height * scale}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(WORLD.height * scale * dpr);
    canvas.getContext?.('2d')?.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    setPortrait(window.innerHeight > window.innerWidth && available < 520);
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
      if (ctx) drawRunner(ctx, game, assetsRef.current);

      // Update the DOM overlay ~10 times a second, or immediately on state changes
      if (now - lastHud > 100 || game.status !== hud.status || game.lives !== hud.lives) {
        lastHud = now;
        const berries = BERRY_TYPES.reduce((sum, t) => sum + (game.collected[t] || 0), 0);
        setHud((h) =>
          h.status === game.status && h.lives === game.lives && h.score === score(game) && h.berries === berries
            ? h
            : { status: game.status, score: score(game), lives: game.lives, berries }
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
    gameRef.current = createRunner({ random });
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

  const stars = starsForScore(hud.score);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-3"
      role="dialog"
      aria-label="Trò chơi Pokémon chạy nhảy"
      data-status={hud.status}
      data-score={hud.score}
      data-lives={hud.lives}
    >
      <div className="w-full max-w-3xl max-h-full overflow-y-auto rounded-3xl border-4 border-white/80 shadow-2xl bg-sky-100">
        {/* HUD */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white/80">
          <div className="flex items-center gap-1" aria-label={`Còn ${hud.lives} mạng`}>
            {Array.from({ length: LIVES }).map((_, i) => (
              <Heart key={i} className={`w-6 h-6 ${i < hud.lives ? 'fill-rose-500 text-rose-500' : 'text-gray-300'}`} />
            ))}
          </div>
          <div className="flex items-center gap-1 text-sm font-black text-sky-900" aria-label={`Nhặt được ${hud.berries} quả mọng`}>
            <BerryIcon type="oran" className="w-4 h-4" /> x{hud.berries}
          </div>
          <div className="text-right leading-tight">
            <div className="text-xl font-black text-sky-900 font-tech tabular-nums" aria-label="Điểm">
              {String(hud.score).padStart(5, '0')}
            </div>
            <div className="text-[11px] font-bold text-sky-700">Kỷ lục {best}</div>
          </div>
          <button onClick={onClose} aria-label="Đóng trò chơi" className="p-1.5 rounded-full bg-white text-sky-900 hover:bg-sky-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game canvas: tap anywhere on it to jump */}
        <div
          ref={wrapRef}
          className="relative select-none touch-none cursor-pointer"
          onPointerDown={(e) => {
            e.preventDefault();
            press();
          }}
          onPointerUp={release}
          onPointerLeave={release}
        >
          <canvas ref={canvasRef} className="block mx-auto" data-testid="runner-canvas" />

          {hud.status === 'ready' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/40 text-center px-4">
              <p className="text-xl sm:text-2xl font-black text-sky-900">Chạy cùng {pokemon.name}!</p>
              <p className="text-sm font-bold text-sky-800">Chạm để bắt đầu và nhảy • Giữ lâu để nhảy cao • Nút CÚI để cúi xuống</p>
              {portrait && <p className="text-xs font-bold text-sky-700">📱 Mẹo: xoay ngang điện thoại để chơi to hơn</p>}
            </div>
          )}

          {hud.status === 'over' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 sm:gap-1.5 bg-white/80 text-center px-3" onPointerDown={(e) => e.stopPropagation()}>
              <p className="text-lg sm:text-2xl font-black text-sky-900 leading-tight">Kết thúc!</p>
              <div className="flex gap-1" aria-label={`${stars} sao`}>
                {[0, 1, 2].map((i) => (
                  <Star key={i} className={`w-6 h-6 sm:w-8 sm:h-8 ${i < stars ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`} />
                ))}
              </div>
              <p className="text-sm sm:text-lg font-bold text-sky-900 leading-snug">
                {pokemon.name} chạy được <strong>{hud.score}</strong> điểm{newBest ? ' — Kỷ lục mới! 🎉' : ''}
              </p>
              {hud.berries > 0 && (
                <p className="text-xs sm:text-sm font-bold text-emerald-700 flex items-center gap-1">
                  <BerryIcon type="razz" className="w-4 h-4" /> Nhặt được {hud.berries} quả mọng, đã cất vào túi để cho Pokémon ăn!
                </p>
              )}
              <div className="flex gap-2 mt-0.5 sm:mt-1">
                <button onClick={restart} className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-black flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" /> Chơi lại
                </button>
                <button onClick={onClose} className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black">
                  Xong
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Big buttons for small hands */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-white/80">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              duck(true);
            }}
            onPointerUp={() => duck(false)}
            onPointerLeave={() => duck(false)}
            className="py-3 sm:py-4 rounded-2xl bg-sky-600 active:bg-sky-700 text-white font-black text-lg flex items-center justify-center gap-2 select-none touch-none"
          >
            <ArrowDown className="w-6 h-6" /> CÚI
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              press();
            }}
            onPointerUp={release}
            onPointerLeave={release}
            className="py-3 sm:py-4 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 active:from-red-600 text-white font-black text-lg flex items-center justify-center gap-2 select-none touch-none"
          >
            <ArrowUp className="w-6 h-6" /> NHẢY
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
