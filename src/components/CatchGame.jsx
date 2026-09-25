import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, RotateCcw, Star } from 'lucide-react';
import {
  BALLS_PER_ROUND,
  FLIGHT_MS,
  TRAVEL,
  catchChance,
  flightPoint,
  movementSpeed,
  planThrow,
  pokemonX,
  ringScaleAt,
  throwQuality,
} from '../utils/catchGame';
import { playCry } from '../utils/cries';
import { sounds } from '../utils/soundEffects';

const ABSORB_MS = 450;
const DROP_MS = 400;
const SHAKE_MS = 550;
const SHAKES = 3;
const ESCAPE_MS = 500;
const RESULT_MS = 1300;
const TRAIL = 6;

// Vertical positions (px from the arena top) of the Pokemon centre and the ground
const POKEMON_Y = 120;
const GROUND_Y = 225;
const BALL_SIZE = 56;

const MESSAGES = {
  aim: 'Bấm NÉM hoặc vuốt bóng lên! Mẹo: ném lúc Pokémon chậm lại ở hai bên.',
  flying: 'Vút...!',
  absorbing: 'Trúng rồi!',
  dropping: 'Trúng rồi!',
  shaking: 'Lắc... lắc...',
  missed: 'Trượt mất rồi! Thử lại nhé!',
  escaping: 'Ôi!',
  escaped: 'Ôi! Pokémon thoát ra rồi! Cố lên nào!',
  caught: 'Bắt được rồi!',
  outOfBalls: 'Hết bóng rồi! Chơi lại nhé?',
};

function Pokeball({ open = false, click = false }) {
  return (
    <div className="relative w-14 h-14 drop-shadow-xl">
      <div className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-full bg-white border-[3px] border-t-0 border-slate-900" />
      <div className={`ball-lid absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-red-500 border-[3px] border-b-0 border-slate-900 ${open ? 'ball-lid-open' : ''}`}>
        <div className="absolute left-2 top-1.5 w-3 h-2 rounded-full bg-white/60" />
      </div>
      {!open && <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[5px] bg-slate-900" />}
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-slate-900 ${click ? 'ball-click' : ''}`} />
    </div>
  );
}

const place = ({ x, y }, scale = 1, rotate = 0) =>
  `translate(${x - BALL_SIZE / 2}px, ${y - BALL_SIZE / 2}px) scale(${scale}) rotate(${rotate}deg)`;

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
  const [ballPos, setBallPos] = useState(null); // where the ball sits after the flight
  const [missDx, setMissDx] = useState(40);
  const [quality, setQuality] = useState(null);
  const [caughtCount, setCaughtCount] = useState(0);

  const arenaRef = useRef(null);
  const pokemonRef = useRef(null);
  const ringRef = useRef(null);
  const ballRef = useRef(null);
  const trailRefs = useRef([]);
  const flightRef = useRef(null); // { start, from, to } while the ball flies
  const historyRef = useRef([]);
  const timersRef = useRef([]);
  const pointerStartRef = useRef(null);
  // The game clock pauses while the ball holds the Pokemon, so it resumes where it stopped
  const clockRef = useRef({ start: now(), pausedAt: null });

  const speed = movementSpeed(pokemon);
  const elapsed = useCallback(() => {
    const { start, pausedAt } = clockRef.current;
    return ((pausedAt ?? now()) - start) / 1000;
  }, [now]);
  const pauseClock = () => {
    if (clockRef.current.pausedAt == null) clockRef.current.pausedAt = now();
  };
  const resumeClock = () => {
    const c = clockRef.current;
    if (c.pausedAt != null) {
      c.start += now() - c.pausedAt;
      c.pausedAt = null;
    }
  };

  const later = (fn, ms) => {
    timersRef.current.push(setTimeout(fn, ms));
  };
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const arenaSize = () => {
    const el = arenaRef.current;
    const rect = el?.getBoundingClientRect?.();
    return {
      width: el?.clientWidth || rect?.width || 0,
      height: el?.clientHeight || rect?.height || 0,
    };
  };

  // Animation loop: moves the Pokemon, pulses the ring and flies the ball with its trail
  useEffect(() => {
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(() => cb(), 16));
    const caf = window.cancelAnimationFrame || clearTimeout;
    let id;
    const tick = () => {
      const t = elapsed();
      const travelPx = arenaSize().width * TRAVEL;
      if (pokemonRef.current) {
        pokemonRef.current.style.transform = `translateX(${pokemonX(t, speed) * travelPx}px)`;
      }
      if (ringRef.current) ringRef.current.style.transform = `scale(${ringScaleAt(t)})`;

      const flight = flightRef.current;
      if (flight && ballRef.current) {
        const p = Math.min(1, (now() - flight.start) / FLIGHT_MS);
        const point = flightPoint(p, flight.from, flight.to);
        ballRef.current.style.transform = place(point, point.scale, point.rotate);
        const history = historyRef.current;
        history.push(point);
        if (history.length > TRAIL * 2) history.shift();
        trailRefs.current.forEach((el, i) => {
          const ghost = history[history.length - 1 - (i + 1) * 2];
          if (!el) return;
          if (!ghost) {
            el.style.opacity = '0';
            return;
          }
          el.style.opacity = String(0.5 - i * 0.08);
          el.style.transform = place(ghost, ghost.scale * (0.9 - i * 0.1));
        });
      }
      id = raf(tick);
    };
    id = raf(tick);
    return () => caf(id);
  }, [elapsed, speed, now]);

  const afterResult = (remaining) => {
    later(() => setPhase(remaining > 0 ? 'aim' : 'outOfBalls'), RESULT_MS);
  };

  const throwBall = (aimX) => {
    if (phase !== 'aim' || ballsLeft <= 0) return;
    const t = elapsed();
    const ring = ringScaleAt(t);
    // Where the Pokemon will be when the ball arrives (same clock as the animation)
    const targetX = pokemonX(t + FLIGHT_MS / 1000, speed);
    const { landX, hit } = planThrow(aimX, targetX);
    const remaining = ballsLeft - 1;

    const { width, height } = arenaSize();
    const travelPx = width * TRAVEL;
    const from = { x: 0, y: Math.max(POKEMON_Y, height - 52) };
    const to = { x: landX * travelPx, y: POKEMON_Y };

    setBallsLeft(remaining);
    setQuality(throwQuality(ring));
    historyRef.current = [];
    flightRef.current = { start: now(), from, to };
    setBallPos(null);
    setPhase('flying');
    sounds.playWhoosh();

    later(() => {
      flightRef.current = null;
      if (!hit) {
        setBallPos(to);
        setMissDx(landX >= targetX ? 60 : -60);
        setPhase('missed');
        afterResult(remaining);
        return;
      }

      // Hit: the Pokemon stops, turns into light and is pulled into the ball
      pauseClock();
      const pokemonPx = targetX * travelPx;
      setBallPos({ x: pokemonPx, y: POKEMON_Y });
      setPhase('absorbing');
      sounds.playPop();
      const success = random() < catchChance({ ...pokemon, ringScale: ring });

      later(() => {
        setBallPos({ x: pokemonPx, y: GROUND_Y });
        setPhase('dropping');
        later(() => {
          setPhase('shaking');
          for (let i = 0; i < SHAKES; i++) later(() => sounds.playScanBeep(), i * SHAKE_MS);
          later(() => {
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
              setPhase('escaping');
              sounds.playPop();
              later(() => {
                resumeClock();
                setBallPos(null);
                setPhase('escaped');
                afterResult(remaining);
              }, ESCAPE_MS);
            }
          }, SHAKE_MS * SHAKES);
        }, DROP_MS);
      }, ABSORB_MS);
    }, FLIGHT_MS);
  };

  const restart = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    flightRef.current = null;
    resumeClock();
    setBallsLeft(BALLS_PER_ROUND);
    setBallPos(null);
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
    if (e.clientY - start.y > -40) return; // not an upward swipe
    const rect = arenaRef.current?.getBoundingClientRect();
    const aimX = rect && rect.width > 0 ? (e.clientX - rect.left - rect.width / 2) / (rect.width * TRAVEL) : 0;
    throwBall(Math.max(-1.3, Math.min(1.3, aimX)));
  };

  // The NÉM button throws at where the Pokemon is right now
  const throwAtPokemon = () => throwBall(pokemonX(elapsed(), speed));

  const pokemonHidden = ['dropping', 'shaking', 'caught'].includes(phase);
  const pokemonClass = phase === 'absorbing' ? 'poke-absorb' : phase === 'escaping' ? 'poke-escape' : 'animate-float';
  const ringVisible = ['aim', 'flying', 'missed', 'escaped'].includes(phase);
  const message = phase === 'shaking' && quality ? `${quality.label} ${MESSAGES.shaking}` : MESSAGES[phase];

  // Portal to <body>: inside <main> (its own stacking context) the header would cover the game
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-4" role="dialog" aria-label="Trò chơi bắt Pokémon" data-phase={phase}>
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
          className="relative h-80 select-none touch-none overflow-hidden"
        >
          {/* Grass ground */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-emerald-300/0 to-emerald-500/40" />

          {/* Pokemon + target ring (moved by the animation loop) */}
          <div ref={pokemonRef} className="absolute left-1/2 w-40 h-40 -ml-20 flex items-center justify-center" style={{ top: POKEMON_Y - 80 }}>
            {!pokemonHidden && (
              <div aria-hidden="true" className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-24 h-4 rounded-[50%] bg-emerald-900/25 blur-[2px]" />
            )}
            {ringVisible && (
              <div ref={ringRef} className="absolute inset-0 rounded-full border-[6px] border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.9)]" />
            )}
            {!pokemonHidden && (
              <img
                key={phase === 'escaping' ? 'escape' : 'pokemon'}
                src={image}
                alt={pokemon.name}
                draggable={false}
                className={`relative w-32 h-32 object-contain drop-shadow-xl ${pokemonClass}`}
              />
            )}
          </div>

          {/* Ball layer: coordinates are relative to the arena's horizontal centre */}
          <div className="absolute left-1/2 top-0 pointer-events-none">
            {phase === 'flying' && (
              <>
                {Array.from({ length: TRAIL }).map((_, i) => (
                  <div
                    key={i}
                    ref={(el) => { trailRefs.current[i] = el; }}
                    className="absolute left-0 top-0 w-14 h-14 rounded-full bg-gradient-to-b from-red-400/70 to-white/60 blur-[2px]"
                    style={{ opacity: 0 }}
                  />
                ))}
                <div ref={ballRef} data-testid="flying-ball" className="absolute left-0 top-0 will-change-transform">
                  <Pokeball />
                </div>
              </>
            )}

            {ballPos && phase !== 'flying' && (
              <div className="absolute left-0 top-0" style={{ transform: place(ballPos) }}>
                {['dropping', 'shaking', 'caught'].includes(phase) && (
                  <div aria-hidden="true" data-testid="ball-shadow" className="absolute left-1/2 top-full -translate-x-1/2 -mt-1 w-12 h-3 rounded-[50%] bg-emerald-900/30 blur-[2px]" />
                )}
                {phase === 'absorbing' && (
                  <>
                    <div className="impact-burst absolute left-1/2 top-1/2 w-20 h-20 rounded-full border-4 border-white bg-white/40" />
                    <Pokeball open />
                  </>
                )}
                {phase === 'dropping' && (
                  <div className="ball-drop">
                    <Pokeball />
                  </div>
                )}
                {phase === 'shaking' && (
                  <div className="ball-shake">
                    <Pokeball />
                  </div>
                )}
                {phase === 'caught' && (
                  <>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <span
                        key={i}
                        aria-hidden="true"
                        className="star-ray absolute left-1/2 top-1/2 -ml-2.5 -mt-2.5 text-xl"
                        style={{ '--angle': `${i * 45}deg` }}
                      >
                        ⭐
                      </span>
                    ))}
                    <Pokeball click />
                  </>
                )}
                {phase === 'escaping' && (
                  <>
                    <div className="impact-burst absolute left-1/2 top-1/2 w-24 h-24 rounded-full border-4 border-red-300 bg-red-200/40" />
                    <div className="opacity-60">
                      <Pokeball open />
                    </div>
                  </>
                )}
                {phase === 'missed' && (
                  <div className="ball-miss" style={{ '--miss-dx': `${missDx}px` }}>
                    <Pokeball />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ball ready to throw */}
          {phase === 'aim' && (
            <div className="absolute left-1/2 bottom-6 -ml-7 animate-bounce cursor-grab">
              <Pokeball />
            </div>
          )}

          {/* Message bubble */}
          {/* Top of the arena stays clear of the Pokemon, the ball path and the ground */}
          <div className="absolute inset-x-3 top-2 flex justify-center pointer-events-none z-10">
            <span role="status" className="px-4 py-2 rounded-2xl bg-white/90 text-sky-900 text-sm sm:text-base font-black shadow-lg text-center">
              {message}
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
              onClick={throwAtPokemon}
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
