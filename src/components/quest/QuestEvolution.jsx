import React, { useEffect, useRef, useState } from 'react';
import { sounds } from '../../utils/soundEffects';

// Faster and faster flips between the two white silhouettes, like the games
const FLIPS = [420, 380, 340, 300, 260, 220, 190, 160, 130, 110, 90, 80, 70, 60];

/**
 * The evolution sequence: white glow, silhouettes morphing, a white flash, then the new
 * Pokemon in colour with sparkles and the "Tiến hóa!" banner. onDone when the child taps
 * "Tuyệt vời!" (or by itself after a while).
 */
export function QuestEvolution({ evo, onDone }) {
  const [phase, setPhase] = useState('glow'); // glow | morph | flash | reveal
  const [showTo, setShowTo] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    sounds.playEnergySurge();
    let t = 1100;
    at(t, () => setPhase('morph'));
    FLIPS.forEach((ms, i) => {
      t += ms;
      at(t, () => {
        setShowTo((v) => !v);
        sounds.playNote(440 + i * 45, { duration: 0.08, volume: 0.06 });
      });
    });
    t += 120;
    at(t, () => {
      setShowTo(true);
      setPhase('flash');
    });
    at(t + 450, () => {
      setPhase('reveal');
      sounds.playSuccessFanfare();
    });
    at(t + 7000, () => done.current?.());
    return () => timers.forEach(clearTimeout);
  }, []);

  const reveal = phase === 'reveal';
  const silhouette = phase !== 'reveal';
  return (
    <div className="quest-evo absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 overflow-hidden" role="dialog" aria-label="Tiến hóa" data-testid="quest-evolution" data-phase={phase} onPointerDown={(e) => e.stopPropagation()}>
      <div className={`quest-evo-rays absolute inset-[-50%] ${reveal ? 'opacity-60' : 'opacity-25'}`} />
      <p className="relative text-lg sm:text-2xl font-black text-white text-center px-4 min-h-[2rem]">
        {reveal ? (
          <span className="quest-evo-banner inline-block">✨ Tiến hóa! ✨</span>
        ) : (
          <>
            Ồ! <span className="text-amber-300">{evo.fromName}</span> đang tiến hóa...
          </>
        )}
      </p>
      <div className="relative w-44 h-44 sm:w-56 sm:h-56 my-2">
        <div className={`quest-evo-glow absolute inset-[-30%] rounded-full ${phase}`} />
        <img src={evo.fromImage} alt={evo.fromName} className={`quest-evo-img absolute inset-0 w-full h-full object-contain ${silhouette ? 'quest-evo-white' : ''} ${showTo || reveal ? 'quest-evo-hide' : 'quest-evo-show'} ${phase === 'glow' ? 'quest-evo-pulse' : ''}`} />
        <img src={evo.toImage} alt={evo.toName} className={`quest-evo-img absolute inset-0 w-full h-full object-contain ${silhouette ? 'quest-evo-white' : 'quest-evo-reveal'} ${showTo || reveal ? 'quest-evo-show' : 'quest-evo-hide'}`} />
        {reveal &&
          Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="quest-sparkle absolute left-1/2 top-1/2 text-xl" style={{ '--a': `${(i / 14) * 360}deg`, '--d': `${90 + (i % 3) * 30}px`, animationDelay: `${(i % 4) * 90}ms` }}>
              {i % 3 ? '✦' : '⭐'}
            </span>
          ))}
      </div>
      {reveal && (
        <div className="relative flex flex-col items-center gap-2 pop-in">
          <p className="text-base sm:text-xl font-black text-white text-center px-4">
            {evo.fromName} đã tiến hóa thành <span className="text-amber-300">{evo.toName}</span>!
          </p>
          <p className="text-xs font-bold text-emerald-300">Mạnh hơn, nhiều máu hơn, hồi đầy máu! 💪</p>
          <button type="button" onClick={() => done.current?.()} className="mt-1 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 text-lg font-black shadow-lg active:scale-95">
            Tuyệt vời!
          </button>
        </div>
      )}
      <div className={`quest-evo-flash absolute inset-0 bg-white pointer-events-none ${phase === 'flash' ? 'on' : ''}`} />
    </div>
  );
}
