import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles } from 'lucide-react';
import { playCry } from '../utils/cries';
import { sounds } from '../utils/soundEffects';

// Minimum glowing time so the moment feels special even when data loads instantly
export const EVOLVE_GLOW_MS = 2600;

/**
 * Full-screen evolution moment. `to` is null while the evolved Pokemon is loading;
 * `error` shows a friendly message instead.
 */
export function EvolutionScene({ from, to, error, onDone }) {
  const [minTimeDone, setMinTimeDone] = useState(false);

  useEffect(() => {
    sounds.playEnergySurge();
    const timer = setTimeout(() => setMinTimeDone(true), EVOLVE_GLOW_MS);
    return () => clearTimeout(timer);
  }, []);

  const revealed = minTimeDone && !!to;

  useEffect(() => {
    if (!revealed) return;
    sounds.playSuccessFanfare();
    playCry(to);
    try {
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.5 } });
    } catch {
      // ignore
    }
  }, [revealed, to]);

  const fromImage = from.fallbackImage || from.image;
  const toImage = to ? (to.isShiny && to.shinyImage) || to.fallbackImage || to.image : null;

  return (
    <div data-theme="dark" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-6 bg-gradient-to-b from-indigo-950 via-slate-950 to-black text-center" role="dialog" aria-label="Tiến hóa">
      <div className="relative w-64 h-64 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-white/10 blur-2xl animate-pulse" />
        {revealed ? (
          <img src={toImage} alt={to.name} className="relative w-60 h-60 object-contain poke-hop" />
        ) : (
          <img src={fromImage} alt={from.name} className="relative w-56 h-56 object-contain evolve-glow" />
        )}
      </div>

      {error ? (
        <>
          <p className="text-xl font-black text-rose-300">Ôi! Chưa tiến hóa được lúc này.</p>
          <p className="text-sm text-slate-300">{error}</p>
          <button onClick={onDone} className="px-6 py-3 rounded-2xl bg-slate-700 text-white font-black text-lg">Quay lại</button>
        </>
      ) : revealed ? (
        <>
          <p className="text-2xl font-black text-amber-300 flex items-center gap-2">
            <Sparkles className="w-7 h-7" /> Chúc mừng!
          </p>
          <p className="text-lg font-bold text-white">
            {from.name} đã tiến hóa thành <strong className="text-cyan-300">{to.name}</strong>!
          </p>
          <button onClick={onDone} className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-black text-xl shadow-xl active:scale-95">
            Xem {to.name}
          </button>
        </>
      ) : (
        <p role="status" className="text-xl font-black text-white animate-pulse">Ồ? {from.name} đang tiến hóa...</p>
      )}
    </div>
  );
}
