import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, RotateCcw, Star } from 'lucide-react';
import {
  BALLS_PER_ROUND,
  catchChance,
  isHit,
  movementSpeed,
  pokemonX,
  ringScaleAt,
  throwQuality,
} from '../utils/catchGame';
import { playCry } from '../utils/cries';
import { sounds } from '../utils/soundEffects';

const FLIGHT_MS = 650;
const SHAKE_MS = 550;
const SHAKES = 3;
const RESULT_MS = 1400;

const MESSAGES = {
  aim: 'Vuốt bóng lên, hoặc bấm NÉM khi Pokémon ở giữa!',
  throwing: 'Bóng đang bay...',
  shaking: 'Lắc... lắc...',
  missed: 'Trượt mất rồi! Thử lại nhé!',
  escaped: 'Ôi! Pokémon thoát ra rồi! Cố lên nào!',
  caught: 'Bắt được rồi!',
  outOfBalls: 'Hết bóng rồi! Chơi lại nhé?',
};

function Pokeball({ className = '', style }) {
  return (
    <div className={`relative w-14 h-14 rounded-full overflow-hidden border-[3px] border-slate-900 shadow-xl ${className}`} style={style}>
      <div className="absolute inset-x-0 top-0 h-1/2 bg-red-500" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-white" />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[5px] bg-slate-900" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-slate-900" />
    </div>
  );
}

/**
 * Pokeball minigame shown as a full-screen overlay.
 * `now` and `random` can be injected for deterministic tests.
 */
export function CatchGame({
  pokemon,
  image,
  onClose,
  onCaught,
  now = () => performance.now(),
  random = Math.random,
}) {
  const [phase, setPhase] = useState('aim');
  const [ballsLeft, setBallsLeft] = useState(BALLS_PER_ROUND);
  const [flight, setFlight] = useState(null); // { x, y } px target of the ball
  const [quality, setQuality] = useState(null);
  const [caughtCount, setCaughtCount] = useState(0);

  const arenaRef = useRef(null);
  const pokemonRef = useRef(null);
  const ringRef = useRef(null);
  const startRef = useRef(now());
  const timersRef = useRef([]);
  const pointerStartRef = useRef(null);
  const frozenXRef = useRef(null); // Pokemon stops moving once hit

  const speed = movementSpeed(pokemon);
  const elapsed = useCallback(() => (now() - startRef.current) / 1000, [now]);

  const later = (fn, ms) => {
    timersRef.current.push(setTimeout(fn, ms));
  };
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  // Animation loop: moves the Pokemon and pulses the ring without re-rendering React
  useEffect(() => {
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(() => cb(), 16));
    const caf = window.cancelAnimationFrame || clearTimeout;
    let id;
    const tick = () => {
      const t = elapsed();
      const x = frozenXRef.current ?? pokemonX(t, speed);
      const width = arenaRef.current?.clientWidth || 0;
      if (pokemonRef.current) {
        pokemonRef.current.style.transform = `translateX(${x * width * 0.32}px)`;
      }
      if (ringRef.current) ringRef.current.style.transform = `scale(${ringScaleAt(t)})`;
      id = raf(tick);
    };
    id = raf(tick);
    return () => caf(id);
  }, [elapsed, speed]);

  const afterResult = (remaining) => {
    later(() => setPhase(remaining > 0 ? 'aim' : 'outOfBalls'), RESULT_MS);
  };

  const throwBall = (aimX) => {
    if (phase !== 'aim' || ballsLeft <= 0) return;
    const t = elapsed();
    const ring = ringScaleAt(t);
    const remaining = ballsLeft - 1;
    setBallsLeft(remaining);
    setQuality(throwQuality(ring));
    setPhase('throwing');
    sounds.playShutter();

    const rect = arenaRef.current?.getBoundingClientRect();
    const width = rect?.width || 0;
    const height = rect?.height || 0;
    setFlight({ x: aimX * width * 0.32, y: -height * 0.5 });

    later(() => {
      // Where the Pokemon actually is when the ball arrives (same clock as the animation)
      const targetX = pokemonX(elapsed(), speed);
      if (!isHit(aimX, targetX)) {
        setPhase('missed');
        setFlight(null);
        afterResult(remaining);
        return;
      }

      frozenXRef.current = targetX;
      setPhase('shaking');
      sounds.playScanBeep();
      const success = random() < catchChance({ ...pokemon, ringScale: ring });

      later(() => {
        frozenXRef.current = null;
        setFlight(null);
        if (success) {
          setPhase('caught');
          setCaughtCount((c) => c + 1);
          sounds.playSuccessFanfare();
          playCry(pokemon);
          try {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 } });
          } catch {
            // ignore
          }
          onCaught?.();
        } else {
          setPhase('escaped');
          afterResult(remaining);
        }
      }, SHAKE_MS * SHAKES);
    }, FLIGHT_MS);
  };

  const restart = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    frozenXRef.current = null;
    setBallsLeft(BALLS_PER_ROUND);
    setFlight(null);
    setQuality(null);
    setPhase('aim');
  };

  const onPointerDown = (e) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const dy = e.clientY - start.y;
    if (dy > -40) return; // not an upward swipe
    const rect = arenaRef.current?.getBoundingClientRect();
    const aimX = rect && rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
    // Arena half-width maps to the Pokemon's travel range (32% of the width each side)
    throwBall(Math.max(-1, Math.min(1, aimX / 0.64)));
  };

  const showPokemon = phase !== 'shaking' && phase !== 'caught';

  // Portal to <body>: inside <main> (its own stacking context) the header would cover the game
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-4" role="dialog" aria-label="Trò chơi bắt Pokémon">
      <div className="w-full max-w-md rounded-3xl overflow-hidden border-4 border-white/80 shadow-2xl bg-gradient-to-b from-sky-300 via-sky-200 to-emerald-300">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/70">
          <div className="flex items-center gap-1" aria-label={`Còn ${ballsLeft} quả bóng`}>
            {Array.from({ length: BALLS_PER_ROUND }).map((_, i) => (
              <span key={i} className={`w-4 h-4 rounded-full border-2 border-slate-900 ${i < ballsLeft ? 'bg-red-500' : 'bg-gray-300'}`} />
            ))}
          </div>
          <span className="text-sm font-black text-sky-900">Bắt {pokemon.name}!</span>
          <button onClick={onClose} aria-label="Đóng trò chơi" className="p-1.5 rounded-full bg-white text-sky-900 hover:bg-sky-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Arena */}
        <div
          ref={arenaRef}
          data-testid="catch-arena"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className="relative h-80 select-none touch-none"
        >
          {/* Pokemon + target ring */}
          <div ref={pokemonRef} className="absolute left-1/2 top-10 -ml-20 w-40 h-40 flex items-center justify-center">
            {showPokemon && (
              <>
                <div ref={ringRef} className="absolute inset-0 rounded-full border-[6px] border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.9)]" />
                <img src={image} alt={pokemon.name} className="relative w-32 h-32 object-contain drop-shadow-xl animate-float" draggable={false} />
              </>
            )}
            {phase === 'shaking' && <Pokeball className="ball-shake" />}
            {phase === 'caught' && <Pokeball className="animate-bounce" />}
          </div>

          {/* Flying ball */}
          {phase === 'throwing' && flight && (
            <div
              className="absolute left-1/2 bottom-6 -ml-7 transition-transform ease-out"
              style={{ transform: `translate(${flight.x}px, ${flight.y}px) scale(0.6)`, transitionDuration: `${FLIGHT_MS}ms` }}
            >
              <Pokeball />
            </div>
          )}

          {/* Ball ready to throw */}
          {phase === 'aim' && (
            <div className="absolute left-1/2 bottom-6 -ml-7 animate-bounce cursor-grab">
              <Pokeball />
            </div>
          )}

          {/* Message bubble */}
          <div className="absolute inset-x-4 bottom-24 flex justify-center pointer-events-none">
            <span role="status" className="px-4 py-2 rounded-2xl bg-white/90 text-sky-900 text-base font-black shadow-lg text-center">
              {phase === 'shaking' && quality ? `${quality.label} ${MESSAGES.shaking}` : MESSAGES[phase]}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 py-4 bg-white/70 flex flex-col items-center gap-2">
          {phase === 'caught' ? (
            <>
              <div className="flex items-center gap-1" aria-label={`${quality?.stars || 1} sao`}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Star key={i} className={`w-8 h-8 ${i < (quality?.stars || 1) ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`} />
                ))}
              </div>
              <p className="text-lg font-black text-emerald-700">🎉 Bé đã bắt được {pokemon.name}! (x{caughtCount})</p>
              <div className="flex gap-2">
                <button onClick={restart} className="px-5 py-3 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-black text-base flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" /> Chơi tiếp
                </button>
                <button onClick={onClose} className="px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black text-base">
                  Xong
                </button>
              </div>
            </>
          ) : phase === 'outOfBalls' ? (
            <button onClick={restart} className="px-6 py-3 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-black text-lg flex items-center gap-2">
              <RotateCcw className="w-5 h-5" /> Chơi lại
            </button>
          ) : (
            <button
              onClick={() => throwBall(0)}
              disabled={phase !== 'aim'}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 disabled:opacity-50 text-white font-black text-xl shadow-lg active:scale-95 transition-transform"
            >
              NÉM!
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
